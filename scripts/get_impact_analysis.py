import json
import math
import warnings
from datetime import date

from _bootstrap import add_legacy_dashboard_to_path

warnings.filterwarnings("ignore")
add_legacy_dashboard_to_path()

import db
import pandas as pd


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


ACTIONS = {
    "baseline": {"label": "Baseline", "start": "2026-01-05", "end": "2026-02-28"},
    "ads_budget": {"label": "Ads Budget Change", "start": "2026-03-01", "end": "2026-03-15"},
    "search_words": {"label": "Search Words Update", "start": "2026-03-16", "end": "2026-04-11"},
    "new_artwork": {"label": "New Artwork Live", "start": "2026-04-12", "end": date.today().isoformat()},
}


def pct_change(prev, curr):
    if prev is None or curr is None or pd.isna(prev) or pd.isna(curr) or prev == 0:
        return None
    return (curr - prev) / prev * 100


def date_mask(df, date_col, phase):
    action = ACTIONS[phase]
    return (df[date_col] >= pd.Timestamp(action["start"])) & (df[date_col] <= pd.Timestamp(action["end"]))


def load_sales():
    df = db.get_sales_traffic()
    if df is None or df.empty:
        return pd.DataFrame()
    df["date"] = pd.to_datetime(df["date"])
    return df.groupby("date").agg(revenue=("revenue", "sum"), orders=("orders", "sum"), units=("units", "sum")).reset_index().sort_values("date")


def load_traffic():
    df = db.get_traffic()
    if df is None or df.empty:
        return pd.DataFrame()
    if "asin" in df.columns:
        df = df[df["asin"].astype(str).str.upper() == "AGGREGATED"].copy()
    df["date"] = pd.to_datetime(df["date"])
    return df.sort_values("date")


def load_ads():
    df = db.get_ads_by_type()
    if df is None or df.empty:
        return pd.DataFrame()
    df["date"] = pd.to_datetime(df["date"])
    return df.sort_values("date")


def load_bsr():
    df = db.get_bsr()
    if df is None or df.empty:
        return pd.DataFrame()
    df["date"] = pd.to_datetime(df["date"])
    return df.groupby("date")["rank"].mean().reset_index(name="bsr").sort_values("date")


def load_search_query():
    df = db.get_cleaned_search_query()
    if df is None or df.empty:
        return pd.DataFrame()
    df["period_start"] = pd.to_datetime(df["period_start"])
    return df


def load_demographics():
    df = db.get_demographics_weekly()
    if df is None or df.empty:
        return pd.DataFrame()
    df["date"] = pd.to_datetime(df["date"])
    return df


def weekly_sales_traffic(sales, traffic):
    if sales.empty:
        sales_w = pd.DataFrame(columns=["date", "revenue", "orders", "units"])
    else:
        sales_w = sales.set_index("date").resample("W-SUN").sum(numeric_only=True).reset_index()
    if traffic.empty:
        traffic_w = pd.DataFrame(columns=["date", "sessions", "conversion_rate", "buy_box_percentage"])
    else:
        agg = {}
        for col in ["sessions", "conversion_rate", "buy_box_percentage"]:
            if col in traffic.columns:
                agg[col] = "sum" if col == "sessions" else "mean"
        traffic_w = traffic.set_index("date").resample("W-SUN").agg(agg).reset_index() if agg else pd.DataFrame(columns=["date"])
    merged = pd.merge(sales_w, traffic_w, on="date", how="outer").sort_values("date")
    if "conversion_rate" in merged.columns:
        merged["cvr"] = merged["conversion_rate"]
    if "buy_box_percentage" in merged.columns:
        merged["buybox"] = merged["buy_box_percentage"]
    return merged.fillna(0).tail(26).to_dict(orient="records")


def phase_comparison(sales, traffic):
    rows = []
    prev = None
    for phase, info in ACTIONS.items():
        sales_sub = sales[date_mask(sales, "date", phase)] if not sales.empty else pd.DataFrame()
        traffic_sub = traffic[date_mask(traffic, "date", phase)] if not traffic.empty else pd.DataFrame()
        revenue = sales_sub["revenue"].mean() if not sales_sub.empty else None
        orders = sales_sub["orders"].mean() if not sales_sub.empty else None
        sessions = traffic_sub["sessions"].mean() if not traffic_sub.empty and "sessions" in traffic_sub else None
        cvr = traffic_sub["conversion_rate"].mean() if not traffic_sub.empty and "conversion_rate" in traffic_sub else None
        row = {
            "phase": phase,
            "label": info["label"],
            "start": info["start"],
            "end": info["end"],
            "avg_daily_revenue": revenue,
            "avg_daily_orders": orders,
            "avg_daily_sessions": sessions,
            "avg_cvr": cvr,
            "revenue_delta_pct": pct_change(prev["revenue"], revenue) if prev else None,
            "orders_delta_pct": pct_change(prev["orders"], orders) if prev else None,
            "sessions_delta_pct": pct_change(prev["sessions"], sessions) if prev else None,
            "cvr_delta_pp": cvr - prev["cvr"] if prev and cvr is not None and prev["cvr"] is not None else None,
        }
        prev = {"revenue": revenue, "orders": orders, "sessions": sessions, "cvr": cvr}
        rows.append(row)
    return rows


def ads_analysis(ads):
    if ads.empty:
        return {"weekly": [], "phase_comparison": []}
    sp = ads[ads["ad_type"].astype(str).str.upper() == "SP"].copy() if "ad_type" in ads.columns else ads.copy()
    sd = ads[ads["ad_type"].astype(str).str.upper() == "SD"].copy() if "ad_type" in ads.columns else pd.DataFrame()
    weekly = sp.set_index("date").resample("W-SUN").agg(spend=("spend", "sum"), sales=("sales_1d", "sum"), clicks=("clicks", "sum"), impressions=("impressions", "sum")).reset_index()
    weekly["roas"] = weekly.apply(lambda r: r["sales"] / r["spend"] if r["spend"] else None, axis=1)
    weekly["ctr"] = weekly.apply(lambda r: r["clicks"] / r["impressions"] * 100 if r["impressions"] else None, axis=1)
    if not sd.empty:
        sd_weekly = sd.set_index("date").resample("W-SUN").agg(sd_spend=("spend", "sum")).reset_index()
        weekly = pd.merge(weekly, sd_weekly, on="date", how="left")
    rows = []
    prev = None
    for phase, info in ACTIONS.items():
        sub = sp[date_mask(sp, "date", phase)]
        spend = sub["spend"].mean() if not sub.empty else None
        sales = sub["sales_1d"].mean() if not sub.empty and "sales_1d" in sub else None
        roas = sales / spend if spend and sales is not None else None
        clicks = sub["clicks"].mean() if not sub.empty and "clicks" in sub else None
        impressions = sub["impressions"].mean() if not sub.empty and "impressions" in sub else None
        ctr = clicks / impressions * 100 if clicks is not None and impressions else None
        row = {
            "phase": phase,
            "label": info["label"],
            "avg_sp_spend": spend,
            "avg_sp_sales": sales,
            "roas": roas,
            "ctr": ctr,
            "spend_delta_pct": pct_change(prev["spend"], spend) if prev else None,
            "roas_delta_pct": pct_change(prev["roas"], roas) if prev else None,
        }
        prev = {"spend": spend, "roas": roas}
        rows.append(row)
    return {"weekly": weekly.fillna(0).tail(26).to_dict(orient="records"), "phase_comparison": rows}


def bsr_weekly(bsr):
    if bsr.empty:
        return []
    weekly = bsr.set_index("date").resample("W-SUN").mean(numeric_only=True).reset_index()
    return weekly.tail(26).to_dict(orient="records")


def search_analysis(df):
    if df.empty:
        return {"cluster_weekly": [], "top_before": [], "top_after": []}
    recent = df[df["period_start"] >= pd.Timestamp("2025-12-01")].copy()
    weekly = recent.groupby(["period_start", "keyword_cluster"]).agg(impressions=("impression_asin", "sum"), clicks=("click_asin", "sum"), purchases=("purchase_asin", "sum")).reset_index()
    top_clusters = weekly.groupby("keyword_cluster")["purchases"].sum().nlargest(8).index.tolist()
    weekly = weekly[weekly["keyword_cluster"].isin(top_clusters)].sort_values(["period_start", "keyword_cluster"])
    def top_terms(start, end=None):
        mask = df["period_start"] >= pd.Timestamp(start)
        if end:
            mask &= df["period_start"] < pd.Timestamp(end)
        sub = df[mask]
        if sub.empty:
            return []
        out = sub.groupby("search_query").agg(cluster=("keyword_cluster", "first"), purchases=("purchase_asin", "sum"), impressions=("impression_asin", "sum")).nlargest(10, "purchases").reset_index()
        return out.to_dict(orient="records")
    return {"cluster_weekly": weekly.to_dict(orient="records"), "top_before": top_terms("2026-02-01", "2026-03-01"), "top_after": top_terms("2026-03-01")}


def demographic_highlights(df):
    if df.empty:
        return {"weekly": [], "highlights": {}}
    dates = sorted(df["date"].dropna().unique())[-6:]
    weekly = df[df["date"].isin(dates)].copy()
    highlights = {}
    for category, segment, key in [
        ("gender", "Female", "female_share"),
        ("age_group", "35-44", "age_35_44_share"),
        ("household_income", "$150k+", "income_150k_share"),
    ]:
        sub = weekly[(weekly["category_type"] == category) & (weekly["segment_name"] == segment)].sort_values("date")
        if not sub.empty:
            first = sub.iloc[0]["customer_pct"]
            latest = sub.iloc[-1]["customer_pct"]
            highlights[key] = {"latest": latest, "delta_pp": latest - first, "latest_date": sub.iloc[-1]["date"]}
    return {"weekly": weekly.to_dict(orient="records"), "highlights": highlights}


def build_takeaways(phases, ads_rows, demographics):
    takeaways = []
    latest_phase = phases[-1] if phases else {}
    if latest_phase.get("revenue_delta_pct") is not None:
        takeaways.append({"title": "New Artwork Revenue Shift", "detail": f"Average daily revenue changed {latest_phase['revenue_delta_pct']:.1f}% versus the prior search-word phase.", "severity": "normal" if latest_phase["revenue_delta_pct"] >= 0 else "warn"})
    if latest_phase.get("cvr_delta_pp") is not None:
        takeaways.append({"title": "Conversion Rate Watch", "detail": f"CVR moved {latest_phase['cvr_delta_pp']:.1f} percentage points in the latest phase.", "severity": "normal" if latest_phase["cvr_delta_pp"] >= 0 else "warn"})
    if ads_rows:
        last_ads = ads_rows[-1]
        if last_ads.get("roas") is not None:
            takeaways.append({"title": "Latest SP ROAS", "detail": f"SP ROAS is {last_ads['roas']:.2f}x in the latest phase.", "severity": "warn" if last_ads["roas"] < 1 else "normal"})
    female = demographics.get("highlights", {}).get("female_share")
    if female:
        takeaways.append({"title": "Audience Mix", "detail": f"Female share is {female['latest']:.1f}% ({female['delta_pp']:+.1f} pp over available weeks).", "severity": "normal"})
    return takeaways


result = {}
try:
    sales = load_sales()
    traffic = load_traffic()
    ads = load_ads()
    bsr = load_bsr()
    search = load_search_query()
    demographics = load_demographics()
    phases = phase_comparison(sales, traffic)
    ads_result = ads_analysis(ads)
    demo_result = demographic_highlights(demographics)
    result = {
        "actions": [{"phase": key, **value} for key, value in ACTIONS.items()],
        "weekly_performance": weekly_sales_traffic(sales, traffic),
        "phase_comparison": phases,
        "ads": ads_result,
        "bsr_weekly": bsr_weekly(bsr),
        "search": search_analysis(search),
        "demographics": demo_result,
        "takeaways": build_takeaways(phases, ads_result.get("phase_comparison", []), demo_result),
    }
except Exception as e:
    result = {"error": str(e), "actions": [], "weekly_performance": [], "phase_comparison": [], "ads": {"weekly": [], "phase_comparison": []}, "bsr_weekly": [], "search": {"cluster_weekly": [], "top_before": [], "top_after": []}, "demographics": {"weekly": [], "highlights": {}}, "takeaways": []}

print(json.dumps(clean(result)))
