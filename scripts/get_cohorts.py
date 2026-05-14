import json
import math
import warnings

warnings.filterwarnings("ignore")

from _bootstrap import add_legacy_dashboard_to_path

add_legacy_dashboard_to_path()

import db
import pandas as pd

PRICE_PER_UNIT_COGS = 4.93


def clean(obj):
    if isinstance(obj, dict):
        return {k: clean(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [clean(v) for v in obj]
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return obj
    if hasattr(obj, "isoformat"):
        return obj.isoformat()
    if hasattr(obj, "item"):
        return obj.item()
    return obj


def safe_num(value):
    try:
        if value is None or pd.isna(value):
            return 0.0
        return float(value)
    except Exception:
        return 0.0


def first_present(frame, candidates):
    for col in candidates:
        if col in frame.columns and frame[col].notna().any():
            return col
    return None


result = {
    "cohorts": [],
    "cohort_sizes": [],
    "cohort_summary": [],
    "repeat_rate_trend": [],
    "revenue_mix": [],
    "summary": {},
    "source_notes": [],
    "total_orders": 0,
}

try:
    orders = db.get_orders()
    shipments = db.get_shipments()
    repeat_monthly = db.get_ba_repeat_purchase_monthly()
    ads = db.get_ads()

    if orders is not None and not orders.empty:
        result["total_orders"] = int(len(orders))

    # ------------------------------------------------------------------
    # True customer-cohort analysis using shipment buyer_email when present.
    # This is the closest thing we have locally to the old Streamlit cohort logic.
    # ------------------------------------------------------------------
    cohort_data = []
    cohort_sizes = []
    cohort_summary = []
    repeat_rate_trend = []

    if shipments is not None and not shipments.empty:
        ship = shipments.copy()
        ship["buyer_email"] = ship.get("buyer_email", "").fillna("").astype(str).str.strip().str.lower()
        ship = ship[ship["buyer_email"] != ""].copy()
        if "purchase_date" in ship.columns:
            ship["purchase_date"] = pd.to_datetime(ship["purchase_date"], errors="coerce")
        ship = ship[ship["purchase_date"].notna()].copy()

        if not ship.empty:
            ship["line_revenue"] = (
                ship.get("item_price", 0).apply(safe_num)
                + ship.get("item_tax", 0).apply(safe_num)
                + ship.get("shipping_price", 0).apply(safe_num)
                + ship.get("shipping_tax", 0).apply(safe_num)
                + ship.get("item_promotion_discount", 0).apply(safe_num)
                + ship.get("ship_promotion_discount", 0).apply(safe_num)
            )
            ship["order_month"] = ship["purchase_date"].dt.to_period("M")
            ship["first_purchase_month"] = ship.groupby("buyer_email")["purchase_date"].transform("min").dt.to_period("M")
            ship["period_number"] = (ship["order_month"] - ship["first_purchase_month"]).apply(lambda value: value.n if hasattr(value, "n") else 0)

            user_pivot = (
                ship.groupby(["first_purchase_month", "period_number"])["buyer_email"]
                .nunique()
                .unstack(fill_value=0)
            )
            revenue_pivot = (
                ship.groupby(["first_purchase_month", "period_number"])["line_revenue"]
                .sum()
                .unstack(fill_value=0.0)
            )

            for cohort_period in user_pivot.index:
                cohort_month = str(cohort_period)
                m0 = int(user_pivot.loc[cohort_period, 0]) if 0 in user_pivot.columns else 0
                row = {"cohort_month": cohort_month, "m0": m0}
                if m0 > 0:
                    repeaters = 0
                    for offset in range(1, 7):
                        if offset in user_pivot.columns:
                            retained = int(user_pivot.loc[cohort_period, offset])
                            row[f"m{offset}"] = round(retained / m0 * 100, 1)
                            repeaters += retained
                        else:
                            row[f"m{offset}"] = None
                    acquisition_revenue = safe_num(revenue_pivot.loc[cohort_period, 0]) if 0 in revenue_pivot.columns else 0.0
                    repeat_revenue = sum(safe_num(revenue_pivot.loc[cohort_period, offset]) for offset in revenue_pivot.columns if offset > 0)
                    total_revenue = acquisition_revenue + repeat_revenue
                    repeat_rate = round((repeaters / m0) * 100, 1) if m0 else 0.0
                    avg_ltv = round(total_revenue / m0, 2) if m0 else 0.0
                    cohort_summary.append({
                        "cohort_month": cohort_month,
                        "acquired_customers": m0,
                        "acquisition_revenue": round(acquisition_revenue, 2),
                        "repeat_revenue": round(repeat_revenue, 2),
                        "total_revenue": round(total_revenue, 2),
                        "avg_ltv": avg_ltv,
                        "repeat_rate_pct": repeat_rate,
                        "source": "shipment_customer_email",
                    })
                    repeat_rate_trend.append({
                        "cohort_month": cohort_month,
                        "repeat_rate_pct": repeat_rate,
                        "avg_ltv": avg_ltv,
                        "acquired_customers": m0,
                    })
                else:
                    for offset in range(1, 7):
                        row[f"m{offset}"] = None
                cohort_data.append(row)
                cohort_sizes.append({"cohort_month": cohort_month, "m0_count": m0})

            result["source_notes"].append(
                f"Customer-email cohort retention is based on {ship['buyer_email'].nunique()} uniquely identifiable buyers from shipment data."
            )

    # ------------------------------------------------------------------
    # Brand Analytics repeat-purchase monthly data fills the old Streamlit
    # economics modules: repeat revenue, repeat rate, cohort table, LTV/CAC.
    # ------------------------------------------------------------------
    revenue_mix = []
    if repeat_monthly is not None and not repeat_monthly.empty:
        rm = repeat_monthly.copy()
        period_col = first_present(rm, ["period_start", "date"])
        if period_col:
            rm["cohort_month"] = pd.to_datetime(rm[period_col], errors="coerce").dt.to_period("M").astype(str)
            rm = rm[rm["cohort_month"] != "NaT"].copy()
            for col in ["unique_customers", "repeat_customers", "repeat_pct", "repeat_revenue", "repeat_revenue_pct", "sp_orders"]:
                if col in rm.columns:
                    rm[col] = pd.to_numeric(rm[col], errors="coerce").fillna(0)

            grouped_rows = []
            for cohort_month, rows in rm.groupby("cohort_month"):
                acquired_customers = float(rows["unique_customers"].sum())
                repeat_customers = float(rows["repeat_customers"].sum()) if "repeat_customers" in rows.columns else 0.0
                repeat_revenue = float(rows["repeat_revenue"].sum()) if "repeat_revenue" in rows.columns else 0.0

                total_revenue_estimates = []
                for _, row in rows.iterrows():
                    pct = safe_num(row.get("repeat_revenue_pct"))
                    if pct > 0:
                        total_revenue_estimates.append(safe_num(row.get("repeat_revenue")) / pct)
                total_revenue = sum(total_revenue_estimates) if total_revenue_estimates else None
                acquisition_revenue = max(0.0, total_revenue - repeat_revenue) if total_revenue is not None else None
                repeat_rate_pct = round((repeat_customers / acquired_customers) * 100, 1) if acquired_customers else round(float(rows["repeat_pct"].mean() * 100), 1)
                avg_ltv = round((total_revenue or 0.0) / acquired_customers, 2) if acquired_customers and total_revenue is not None else None
                grouped_rows.append({
                    "cohort_month": cohort_month,
                    "acquired_customers": int(round(acquired_customers)),
                    "repeat_customers": int(round(repeat_customers)),
                    "repeat_rate_pct": repeat_rate_pct,
                    "repeat_revenue": round(repeat_revenue, 2),
                    "acquisition_revenue": round(acquisition_revenue, 2) if acquisition_revenue is not None else None,
                    "total_revenue": round(total_revenue, 2) if total_revenue is not None else None,
                    "avg_ltv": avg_ltv,
                    "source": "brand_analytics_repeat_purchase",
                })

            # Monthly ad spend for CAC/LTV:CAC
            ad_spend_by_month = {}
            if ads is not None and not ads.empty:
                ads_df = ads.copy()
                ads_df["date"] = pd.to_datetime(ads_df["date"], errors="coerce")
                ads_df = ads_df[ads_df["date"].notna()].copy()
                ads_df["cohort_month"] = ads_df["date"].dt.to_period("M").astype(str)
                ads_df["spend"] = pd.to_numeric(ads_df.get("spend", 0), errors="coerce").fillna(0)
                ad_spend_by_month = ads_df.groupby("cohort_month")["spend"].sum().round(2).to_dict()

            for row in grouped_rows:
                ad_spend = safe_num(ad_spend_by_month.get(row["cohort_month"]))
                cac = round(ad_spend / row["acquired_customers"], 2) if row["acquired_customers"] and ad_spend > 0 else None
                ltv_cac = round(row["avg_ltv"] / cac, 2) if cac and row["avg_ltv"] is not None and cac > 0 else None
                row["ad_spend"] = round(ad_spend, 2) if ad_spend > 0 else None
                row["cac"] = cac
                row["ltv_cac"] = ltv_cac
                revenue_mix.append({
                    "cohort_month": row["cohort_month"],
                    "acquisition_revenue": row["acquisition_revenue"],
                    "repeat_revenue": row["repeat_revenue"],
                    "total_revenue": row["total_revenue"],
                    "avg_ltv": row["avg_ltv"],
                    "ad_spend": row["ad_spend"],
                    "cac": row["cac"],
                    "ltv_cac": row["ltv_cac"],
                })

            # If shipment-email cohorts are sparse, use BA monthly rows as the main summary table.
            if not cohort_summary:
                cohort_summary = grouped_rows
                repeat_rate_trend = [{
                    "cohort_month": row["cohort_month"],
                    "repeat_rate_pct": row["repeat_rate_pct"],
                    "avg_ltv": row["avg_ltv"],
                    "acquired_customers": row["acquired_customers"],
                } for row in grouped_rows]
                cohort_sizes = [{"cohort_month": row["cohort_month"], "m0_count": row["acquired_customers"]} for row in grouped_rows]
                cohort_data = [{
                    "cohort_month": row["cohort_month"],
                    "m0": row["acquired_customers"],
                    "m1": row["repeat_rate_pct"],
                    "m2": None,
                    "m3": None,
                    "m4": None,
                    "m5": None,
                    "m6": None,
                } for row in grouped_rows]

            result["source_notes"].append(
                "Revenue, repeat-rate, and LTV/CAC modules are derived from Brand Analytics repeat-purchase monthly exports plus Amazon Ads spend."
            )

    result["cohorts"] = clean(sorted(cohort_data, key=lambda row: row["cohort_month"]))
    result["cohort_sizes"] = clean(sorted(cohort_sizes, key=lambda row: row["cohort_month"]))
    result["cohort_summary"] = clean(sorted(cohort_summary, key=lambda row: row["cohort_month"]))
    result["repeat_rate_trend"] = clean(sorted(repeat_rate_trend, key=lambda row: row["cohort_month"]))
    result["revenue_mix"] = clean(sorted(revenue_mix, key=lambda row: row["cohort_month"]))

    summary_rows = result["cohort_summary"]
    summary_source = result["revenue_mix"] if result["revenue_mix"] else summary_rows
    if summary_rows:
        valid_ltv = [safe_num(row.get("avg_ltv")) for row in summary_rows if row.get("avg_ltv") is not None]
        valid_repeat_rate = [safe_num(row.get("repeat_rate_pct")) for row in summary_rows if row.get("repeat_rate_pct") is not None]
        valid_ltv_cac = [safe_num(row.get("ltv_cac")) for row in summary_source if row.get("ltv_cac") is not None]
        best_ltv_row = max(summary_rows, key=lambda row: safe_num(row.get("avg_ltv")))
        result["summary"] = clean({
            "avg_ltv_per_cohort": round(sum(valid_ltv) / len(valid_ltv), 2) if valid_ltv else None,
            "avg_repeat_rate": round(sum(valid_repeat_rate) / len(valid_repeat_rate), 1) if valid_repeat_rate else None,
            "total_users_acquired": int(sum(safe_num(row.get("acquired_customers")) for row in summary_rows)),
            "best_cohort_ltv": round(safe_num(best_ltv_row.get("avg_ltv")), 2) if best_ltv_row else None,
            "best_cohort_month": best_ltv_row.get("cohort_month") if best_ltv_row else None,
            "latest_ltv_cac": round(valid_ltv_cac[-1], 2) if valid_ltv_cac else None,
            "retention_source": "shipment_customer_email" if any(row.get("source") == "shipment_customer_email" for row in summary_rows) else "brand_analytics_repeat_purchase",
        })
    else:
        result["summary"] = {
            "avg_ltv_per_cohort": None,
            "avg_repeat_rate": None,
            "total_users_acquired": 0,
            "best_cohort_ltv": None,
            "best_cohort_month": None,
            "latest_ltv_cac": None,
            "retention_source": "none",
        }

except Exception as exc:
    result["error"] = str(exc)

print(json.dumps(clean(result)))
