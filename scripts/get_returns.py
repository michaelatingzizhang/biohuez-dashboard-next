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

# SKU mapping from SKU code to name
SKU_MAP = {
    'ZH-FH-1B': 'Black',
    'ZH-FH-3C': 'Chocolate',
    'ZH-FH-5CL': 'Cream Latte',
    'ZH-FH-6R': 'Red',
}

result = {}

try:
    returns = db.get_fba_customer_returns_daily()
    if returns is not None and not returns.empty:
        returns = returns.copy()
        
        # Normalize return_date
        returns['return_date'] = pd.to_datetime(returns['return_date'], errors='coerce', utc=True)
        returns['return_date'] = returns['return_date'].dt.tz_convert('America/New_York')
        returns['return_date_str'] = returns['return_date'].dt.strftime('%Y-%m-%d')
        
        # Map SKU to name
        returns['sku_name'] = returns['sku'].map(SKU_MAP).fillna(returns['sku'])
        
        # All returns records
        returns_out = returns.copy()
        for col in returns_out.select_dtypes(include=['datetime64[ns, UTC]', 'datetimetz']).columns:
            returns_out[col] = returns_out[col].astype(str)
        returns_out['return_date'] = returns_out['return_date_str']
        
        returns_simple = returns_out[['return_date', 'sku_name', 'sku', 'quantity', 'reason', 'detailed_disposition', 'customer_comments']].copy()
        result['returns'] = clean(returns_simple.to_dict(orient='records'))
        
        # Aggregate by reason
        if 'reason' in returns.columns:
            reasons = returns.groupby('reason')['quantity'].sum().reset_index()
            reasons.columns = ['reason', 'count']
            reasons = reasons.sort_values('count', ascending=False).head(10)
            result['reasons'] = clean(reasons.to_dict(orient='records'))
        else:
            result['reasons'] = []
        
        # Aggregate by SKU
        by_sku = returns.groupby('sku_name').agg(
            total_returns=('quantity', 'sum')
        ).reset_index()
        if 'reason' in returns.columns:
            top_reason = returns.groupby('sku_name')['reason'].agg(lambda x: x.value_counts().index[0] if len(x) > 0 else '')
            by_sku = by_sku.merge(top_reason.rename('top_reason'), on='sku_name', how='left')
        result['by_sku'] = clean(by_sku.to_dict(orient='records'))
        
        # Returns over time by SKU
        time_series = returns.groupby(['return_date_str', 'sku_name'])['quantity'].sum().reset_index()
        time_series.columns = ['date', 'sku_name', 'returns']
        time_series = time_series.sort_values('date')
        result['time_series'] = clean(time_series.to_dict(orient='records'))
        
    else:
        result['returns'] = []
        result['reasons'] = []
        result['by_sku'] = []
        result['time_series'] = []
except Exception as e:
    result['returns_error'] = str(e)
    result['returns'] = []
    result['reasons'] = []
    result['by_sku'] = []
    result['time_series'] = []

try:
    sales = db.get_sales_traffic()
    if sales is not None and not sales.empty:
        sales = sales.copy()
        # sku column is the sku name in this table
        if 'units' in sales.columns and 'sku' in sales.columns:
            units_by_sku = sales.groupby('sku')['units'].sum().reset_index()
            units_by_sku.columns = ['sku_name', 'units_sold']
            result['units_by_sku'] = clean(units_by_sku.to_dict(orient='records'))
        else:
            result['units_by_sku'] = []
    else:
        result['units_by_sku'] = []
except Exception as e:
    result['sales_error'] = str(e)
    result['units_by_sku'] = []

print(json.dumps(result))
