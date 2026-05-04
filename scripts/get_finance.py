import sys, json, warnings, math
from _bootstrap import add_legacy_dashboard_to_path
warnings.filterwarnings('ignore')
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
    if hasattr(obj, 'isoformat'):
        return obj.isoformat()
    if hasattr(obj, 'item'):
        return obj.item()
    return obj

result = {}

# fin_monthly table doesn't exist — compute from sp_finances settlements
try:
    df = db.get_finances()
    if df is not None and not df.empty:
        df = df.copy()
        # Filter to USD and Closed settlements
        df = df[df['currency'] == 'USD'].copy()
        for col in df.select_dtypes(include=['datetime64']).columns:
            df[col] = df[col].astype(str)
        
        # Compute monthly P&L from settlement data
        df['period_start'] = pd.to_datetime(df['period_start'], errors='coerce')
        df = df[df['period_start'].notna()]
        df['month'] = df['period_start'].dt.to_period('M').astype(str)
        
        monthly = df.groupby('month').agg(
            gross_sales=('actual_selling_price', 'sum'),
            shipping_revenue=('shipping_revenue', 'sum'),
            coupons=('coupons_rebates', 'sum'),
            referral_fees=('referral_fees', 'sum'),
            fba_fees=('fba_fulfillment', 'sum'),
            fba_storage=('fba_storage', 'sum'),
            refunds=('refunds', 'sum'),
            ads_spend=('ads_spend', 'sum'),
            units_ordered=('units_ordered', 'sum'),
            refunded_units=('refunded_units', 'sum'),
        ).reset_index()
        
        monthly['net_revenue'] = (
            monthly['gross_sales'] + monthly['shipping_revenue'] + monthly['coupons'] + 
            monthly['referral_fees'] + monthly['fba_fees'] + monthly['fba_storage'] + monthly['refunds']
        )
        monthly['amazon_fees'] = monthly['referral_fees'] + monthly['coupons']
        monthly['fba_total'] = monthly['fba_fees'] + monthly['fba_storage']
        monthly['gross_profit'] = monthly['net_revenue']  # no COGS data available
        monthly['gross_margin_pct'] = (monthly['gross_profit'] / monthly['gross_sales'].replace(0, float('nan')) * 100).round(1)
        monthly = monthly.sort_values('month')
        
        result['monthly'] = clean(monthly.to_dict(orient='records'))
        result['settlement'] = clean(df.to_dict(orient='records'))
    else:
        result['monthly'] = []
        result['settlement'] = []
except Exception as e:
    result['monthly_error'] = str(e)
    result['monthly'] = []
    result['settlement'] = []

print(json.dumps(result))
