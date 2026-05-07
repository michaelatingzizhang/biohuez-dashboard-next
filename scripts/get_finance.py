import sys, json, warnings, math
from _bootstrap import add_legacy_dashboard_to_path
warnings.filterwarnings('ignore')
add_legacy_dashboard_to_path()
import db
import pandas as pd


PRICE_PER_UNIT = 19.99
TOTAL_COGS_PER_UNIT = 5.53
GP_TARGET_PCT = 65.0
CM_TARGET_PCT = 20.0
AD_TARGET_PCT = 15.0


def clean(obj):
    if isinstance(obj, dict):
        return {k: clean(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [clean(v) for v in obj]
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return obj
    if hasattr(obj, 'isoformat'):
        return obj.isoformat()
    if hasattr(obj, 'item'):
        return obj.item()
    return obj


def safe_num(value):
    try:
        if pd.isna(value):
            return 0.0
        return float(value)
    except Exception:
        return 0.0


def get_sales_months():
    try:
        df = db.get_sales_traffic()
        if df is None or df.empty:
            return {}
        df = df.copy()
        df['date'] = pd.to_datetime(df['date'], errors='coerce')
        df = df[df['date'].notna()]
        df['month'] = df['date'].dt.to_period('M').astype(str)
        grouped = df.groupby('month').agg(units_orders=('units', 'sum'), actual_revenue=('revenue', 'sum')).reset_index()
        return grouped.set_index('month').to_dict('index')
    except Exception:
        return {}


def get_ads_months():
    try:
        df = db.get_ads()
        if df is None or df.empty or 'date' not in df.columns or 'spend' not in df.columns:
            return {}
        df = df.copy()
        df['date'] = pd.to_datetime(df['date'], errors='coerce')
        df = df[df['date'].notna()]
        df['spend'] = pd.to_numeric(df['spend'], errors='coerce').fillna(0)
        df['month'] = df['date'].dt.to_period('M').astype(str)
        return df.groupby('month')['spend'].sum().to_dict()
    except Exception:
        return {}


def finance_monthly():
    try:
        df = db.get_fin_monthly()
        if df is not None and not df.empty:
            df = df.copy()
            df['gross_sales'] = df.get('gross_sales', df.get('actual_selling_price', 0))
            return df
    except Exception:
        pass
    df = db.get_finances()
    if df is None or df.empty:
        return pd.DataFrame()
    df = df.copy()
    if 'currency' in df.columns:
        df = df[df['currency'] == 'USD']
    df['period_start'] = pd.to_datetime(df['period_start'], errors='coerce')
    df = df[df['period_start'].notna()]
    df['month'] = df['period_start'].dt.to_period('M').astype(str)
    return df.groupby('month').agg(
        gross_sales=('actual_selling_price', 'sum'),
        shipping_revenue=('shipping_revenue', 'sum'),
        coupons_rebates=('coupons_rebates', 'sum'),
        referral_fees=('referral_fees', 'sum'),
        fba_fulfillment=('fba_fulfillment', 'sum'),
        fba_storage=('fba_storage', 'sum'),
        fba_other=('fba_other', 'sum'),
        refunds=('refunds', 'sum'),
        ads_spend=('ads_spend', 'sum'),
        transfers=('transfers', 'sum'),
        debt_recovery=('debt_recovery', 'sum'),
        units_ordered=('units_ordered', 'sum'),
        refunded_units=('refunded_units', 'sum'),
    ).reset_index()


def finance_settlements():
    try:
        df = db.get_fin_settlement_groups()
        if df is not None and not df.empty:
            return df.copy()
    except Exception:
        pass
    df = db.get_finances()
    return df.copy() if df is not None else pd.DataFrame()


def normalize_monthly(df):
    if df is None or df.empty:
        return []
    df = df.copy()
    for col in [
        'gross_sales', 'actual_selling_price', 'shipping_revenue', 'coupons_rebates', 'coupons',
        'referral_fees', 'fba_fulfillment', 'fba_fees', 'fba_storage', 'fba_other',
        'refunds', 'ads_spend', 'transfers', 'debt_recovery', 'units_ordered', 'refunded_units'
    ]:
        if col not in df.columns:
            df[col] = 0
        df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)
    if 'coupons' not in df.columns:
        df['coupons'] = df['coupons_rebates']
    df['gross_sales'] = df.apply(
        lambda row: row['actual_selling_price'] if safe_num(row.get('gross_sales')) == 0 else row['gross_sales'],
        axis=1,
    )
    df['fba_total'] = df['fba_fulfillment'] + df['fba_storage'] + df['fba_other']
    df['amazon_fees'] = df['referral_fees'] + df['coupons']
    df['net_revenue'] = (
        df['gross_sales'] + df['shipping_revenue'] + df['coupons'] +
        df['referral_fees'] + df['fba_fulfillment'] + df['fba_storage'] + df['fba_other'] + df['refunds']
    )
    df['gross_profit'] = df['net_revenue']
    df['gross_margin_pct'] = (df['gross_profit'] / df['gross_sales'].replace(0, float('nan')) * 100).round(1)
    return df.sort_values('month').to_dict(orient='records')


def build_pl(monthly_rows, sales_months, ads_months):
    rows = []
    sales_keys = sorted(k for k, v in sales_months.items() if safe_num(v.get('units_orders')) > 0)
    partial_month = sales_keys[0] if sales_keys else None
    current_month = pd.Timestamp.today().strftime('%Y-%m')
    for row in monthly_rows:
        month = row.get('month')
        sales = sales_months.get(month, {})
        units = safe_num(sales.get('units_orders')) or safe_num(row.get('units_ordered'))
        sales_revenue = safe_num(sales.get('actual_revenue'))
        finance_sales = safe_num(row.get('gross_sales')) or safe_num(row.get('actual_selling_price'))
        actual_selling_price = finance_sales if month == partial_month else (sales_revenue or finance_sales)
        target_gross_sales = units * PRICE_PER_UNIT
        price_discount = actual_selling_price - target_gross_sales
        coupons = safe_num(row.get('coupons_rebates') or row.get('coupons'))
        refunds = safe_num(row.get('refunds'))
        net_sales = actual_selling_price + coupons + refunds
        landed_cogs = -(units * TOTAL_COGS_PER_UNIT)
        gross_profit = net_sales + landed_cogs
        ads_from_finance = safe_num(row.get('ads_spend'))
        ads_from_api = safe_num(ads_months.get(month))
        ads_spend = -round(ads_from_api, 2) if ads_from_api > 0 and (month == current_month or ads_from_finance == 0) else ads_from_finance
        referral = safe_num(row.get('referral_fees'))
        fba = safe_num(row.get('fba_fulfillment') or row.get('fba_fees'))
        storage = safe_num(row.get('fba_storage')) + safe_num(row.get('fba_other'))
        marketing_contribution = gross_profit + ads_spend
        contribution_margin = marketing_contribution + referral + fba + storage
        days = max(pd.Timestamp.today().day, 1) if month == current_month else pd.Timestamp(month + '-01').days_in_month
        rows.append({
            'month': month,
            'label': pd.Timestamp(month + '-01').strftime("%b %Y") + (' MTD' if month == current_month else ''),
            'asp_per_unit': round(actual_selling_price / units, 2) if units else 0,
            'units': int(units),
            'units_per_day': round(units / days, 1) if days else 0,
            'target_gross_sales': round(target_gross_sales, 2),
            'price_discount': round(price_discount, 2),
            'actual_selling_price': round(actual_selling_price, 2),
            'coupons_rebates': round(coupons, 2),
            'refunds': round(refunds, 2),
            'net_sales': round(net_sales, 2),
            'landed_cogs': round(landed_cogs, 2),
            'gross_profit': round(gross_profit, 2),
            'ads_spend': round(ads_spend, 2),
            'marketing_contribution': round(marketing_contribution, 2),
            'referral_fees': round(referral, 2),
            'fba_fees': round(fba, 2),
            'storage_fees': round(storage, 2),
            'contribution_margin': round(contribution_margin, 2),
            'refunded_units': int(safe_num(row.get('refunded_units'))),
            'g2n_pct': round((target_gross_sales - net_sales) / target_gross_sales * 100, 1) if target_gross_sales else 0,
            'gm_pct': round(gross_profit / net_sales * 100, 1) if net_sales else 0,
            'ap_pct': round(-ads_spend / net_sales * 100, 1) if net_sales and ads_spend else 0,
            'mktc_pct': round(marketing_contribution / net_sales * 100, 1) if net_sales else 0,
            'cm_pct': round(contribution_margin / net_sales * 100, 1) if net_sales else 0,
        })
    return sorted(rows, key=lambda item: item['month'])


def build_settlement_pl(df):
    if df is None or df.empty:
        return []
    work = df.copy().tail(8)
    out = []
    for _, row in work.iterrows():
        group_id = str(row.get('group_id') or row.get('settlement_id') or row.get('_group_id') or '')
        start = str(row.get('_start') or row.get('period_start') or '')[:10]
        end = str(row.get('_end') or row.get('period_end') or '')[:10]
        units = safe_num(row.get('units_ordered'))
        product_charges = safe_num(row.get('actual_selling_price')) + safe_num(row.get('shipping_revenue'))
        promos = safe_num(row.get('coupons_rebates'))
        refunds = safe_num(row.get('refunds'))
        net_revenue = product_charges + promos + refunds
        referral = safe_num(row.get('referral_fees'))
        fba = safe_num(row.get('fba_fulfillment'))
        ads = safe_num(row.get('ads_spend'))
        storage = safe_num(row.get('fba_storage')) + safe_num(row.get('fba_other'))
        total_fees = referral + fba + ads + storage
        net_proceeds = safe_num(row.get('_orig_total') or row.get('transfers'))
        disbursed = safe_num(row.get('transfers'))
        out.append({
            'group_id': group_id,
            'period': f"{start[5:] if start else '—'} → {end[5:] if end else 'open'}",
            'status': row.get('_status') or row.get('status') or '',
            'units': int(units),
            'product_charges': round(product_charges, 2),
            'promo_rebates': round(promos, 2),
            'refunds': round(refunds, 2),
            'net_revenue': round(net_revenue, 2),
            'referral_fees': round(referral, 2),
            'fba_fees': round(fba, 2),
            'ads_spend': round(ads, 2),
            'storage_other': round(storage, 2),
            'total_fees': round(total_fees, 2),
            'net_proceeds': round(net_proceeds, 2),
            'disbursed': round(disbursed, 2),
        })
    return out


def build_per_unit(pl_rows):
    source = [row for row in pl_rows if row.get('units', 0) > 0][-3:]
    units = sum(row['units'] for row in source)
    fields = [
        'target_gross_sales', 'price_discount', 'actual_selling_price', 'coupons_rebates',
        'refunds', 'net_sales', 'landed_cogs', 'gross_profit', 'ads_spend',
        'marketing_contribution', 'referral_fees', 'fba_fees', 'storage_fees', 'contribution_margin'
    ]
    if not units:
        return []
    return [{'metric': field, 'amount': round(sum(row.get(field, 0) for row in source) / units, 2)} for field in fields]


def build_insights(monthly, pl_rows):
    insight_df = pd.DataFrame(monthly)
    if insight_df.empty:
        return {'summary': {}, 'monthly_intelligence': [], 'signals': [], 'drivers': [], 'latest_breakdown': []}
    for col in ['gross_sales', 'net_revenue', 'amazon_fees', 'fba_total', 'refunds', 'ads_spend', 'gross_profit']:
        insight_df[col] = pd.to_numeric(insight_df.get(col, 0), errors='coerce').fillna(0)
    insight_df['fee_load_pct'] = ((insight_df['amazon_fees'].abs() + insight_df['fba_total'].abs()) / insight_df['gross_sales'].replace(0, float('nan')) * 100).round(1)
    insight_df['refund_rate_pct'] = (insight_df['refunds'].abs() / insight_df['gross_sales'].replace(0, float('nan')) * 100).round(1)
    insight_df['ad_load_pct'] = (insight_df['ads_spend'].abs() / insight_df['gross_sales'].replace(0, float('nan')) * 100).round(1)
    insight_df['net_after_ads'] = insight_df['gross_profit'] + insight_df['ads_spend']
    insight_df['ad_adjusted_margin_pct'] = (insight_df['net_after_ads'] / insight_df['gross_sales'].replace(0, float('nan')) * 100).round(1)
    insight_df['sales_mom_pct'] = insight_df['gross_sales'].pct_change().replace([float('inf'), -float('inf')], float('nan')) * 100
    latest = insight_df.iloc[-1].to_dict()
    previous = insight_df.iloc[-2].to_dict() if len(insight_df) > 1 else {}
    last3 = insight_df.tail(3)
    signals = []
    if latest.get('fee_load_pct', 0) > 35:
        signals.append({'type': 'fees', 'severity': 'warn', 'title': 'Amazon/FBA fee load is high', 'detail': f"Fees are {latest['fee_load_pct']:.1f}% of gross sales in the latest month."})
    if latest.get('refund_rate_pct', 0) > 5:
        signals.append({'type': 'refunds', 'severity': 'warn', 'title': 'Refund drag needs review', 'detail': f"Refunds are {latest['refund_rate_pct']:.1f}% of gross sales in the latest month."})
    if latest.get('ad_load_pct', 0) > 25:
        signals.append({'type': 'ads', 'severity': 'warn', 'title': 'Ad spend is pressuring profit', 'detail': f"Ad spend is {latest['ad_load_pct']:.1f}% of gross sales in the latest month."})
    if not signals:
        signals.append({'type': 'profit', 'severity': 'normal', 'title': 'Finance signals are stable', 'detail': 'Fee, refund, and advertising pressure are within expected ranges.'})
    drivers = []
    for key, label, direction in [
        ('gross_sales', 'Gross sales', 'higher'), ('net_revenue', 'Net revenue', 'higher'),
        ('amazon_fees', 'Amazon fees', 'lower'), ('fba_total', 'FBA fees', 'lower'),
        ('refunds', 'Refunds', 'lower'), ('ads_spend', 'Ad spend', 'lower')
    ]:
        current = safe_num(latest.get(key))
        prev = safe_num(previous.get(key))
        if current != prev:
            drivers.append({'metric': label, 'current': current, 'previous': prev, 'delta': current - prev, 'direction': direction})
    drivers = sorted(drivers, key=lambda row: abs(row['delta']), reverse=True)[:8]
    latest_pl = pl_rows[-1] if pl_rows else {}
    breakdown = []
    for key, label in [
        ('price_discount', 'Price Discount'), ('coupons_rebates', 'Promotions/Coupons'), ('refunds', 'Refunds'),
        ('landed_cogs', 'Landed COGS'), ('ads_spend', 'Advertising'), ('referral_fees', 'Referral Fees'),
        ('fba_fees', 'FBA Fulfillment'), ('storage_fees', 'Storage & Other')
    ]:
        amount = safe_num(latest_pl.get(key))
        gross = safe_num(latest_pl.get('target_gross_sales'))
        breakdown.append({'metric': label, 'amount': amount, 'abs_amount': abs(amount), 'pct_of_sales': abs(amount) / gross * 100 if gross else None})
    return clean({
        'summary': {
            'latest_month': latest.get('month'),
            'latest_gross_sales': latest.get('gross_sales'),
            'latest_net_revenue': latest.get('net_revenue'),
            'latest_margin_pct': latest.get('gross_margin_pct'),
            'latest_fee_load_pct': latest.get('fee_load_pct'),
            'latest_refund_rate_pct': latest.get('refund_rate_pct'),
            'latest_ad_load_pct': latest.get('ad_load_pct'),
            'latest_ad_adjusted_margin_pct': latest.get('ad_adjusted_margin_pct'),
            'avg_3m_margin_pct': round(float(last3['gross_margin_pct'].mean()), 1) if 'gross_margin_pct' in last3 else None,
            'avg_3m_fee_load_pct': round(float(last3['fee_load_pct'].mean()), 1),
            'avg_3m_refund_rate_pct': round(float(last3['refund_rate_pct'].mean()), 1),
        },
        'monthly_intelligence': insight_df.replace({float('nan'): None}).to_dict(orient='records'),
        'signals': signals,
        'drivers': drivers,
        'latest_breakdown': sorted(breakdown, key=lambda row: row['abs_amount'], reverse=True),
    })


result = {}

try:
    monthly_rows = normalize_monthly(finance_monthly())
    settlement_df = finance_settlements()
    sales_months = get_sales_months()
    ads_months = get_ads_months()
    calendar_pl = build_pl(monthly_rows, sales_months, ads_months)
    result['monthly'] = clean(monthly_rows)
    result['settlement'] = clean(settlement_df.to_dict(orient='records')) if settlement_df is not None and not settlement_df.empty else []
    result['calendar_pl'] = clean(calendar_pl)
    result['settlement_pl'] = clean(build_settlement_pl(settlement_df))
    result['per_unit'] = clean(build_per_unit(calendar_pl))
    result['targets'] = {'asp': PRICE_PER_UNIT, 'cogs_per_unit': TOTAL_COGS_PER_UNIT, 'gp_pct': GP_TARGET_PCT, 'cm_pct': CM_TARGET_PCT, 'ad_pct': AD_TARGET_PCT}
    result['insights'] = build_insights(monthly_rows, calendar_pl)
except Exception as e:
    result['error'] = str(e)
    result['monthly'] = []
    result['settlement'] = []
    result['calendar_pl'] = []
    result['settlement_pl'] = []
    result['per_unit'] = []
    result['insights'] = {'summary': {}, 'monthly_intelligence': [], 'signals': [], 'drivers': [], 'latest_breakdown': []}

print(json.dumps(clean(result)))
