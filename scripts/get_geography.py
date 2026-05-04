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

try:
    df = db.get_orders_comprehensive()
    if df is not None and not df.empty:
        df = df.copy()
        for col in df.select_dtypes(include=['datetime64']).columns:
            df[col] = df[col].astype(str)
        
        result['columns'] = list(df.columns)
        
        # orders_comprehensive doesn't have state/city directly - use SKU/order data
        # Aggregate by SKU using item_price as revenue proxy
        if 'sku' in df.columns and 'item_price' in df.columns:
            sku_agg = df.groupby('sku').agg(
                orders=('sku', 'count'),
                revenue=('item_price', 'sum')
            ).reset_index()
            sku_agg.columns = ['sku', 'orders', 'revenue']
            result['by_sku'] = clean(sku_agg.to_dict(orient='records'))
        
        # Since no state data, use shipment address name patterns for state inference
        # Actually, let's try to get state from get_orders() which may have it
        # For now, group by SKU name mapping
        sku_to_name = {
            'ZH-FH-1B': 'Black',
            'ZH-FH-3C': 'Chocolate', 
            'ZH-FH-5CL': 'Cream Latte',
            'ZH-FH-6R': 'Red',
        }
        
        # Try to get geographic data from orders flat file
        try:
            con = db._conn_read()
            # Check if flat file has state data
            cols = con.execute("SELECT column_name FROM information_schema.columns WHERE table_name='sp_orders_flat_file'").df()['column_name'].tolist()
            state_col = next((c for c in cols if 'state' in c.lower() or 'province' in c.lower()), None)
            
            if state_col:
                query = f"""
                    SELECT {state_col} as state, COUNT(*) as orders, 
                           COALESCE(SUM(item_price), 0) as revenue
                    FROM sp_orders_flat_file
                    WHERE {state_col} IS NOT NULL AND {state_col} != ''
                    GROUP BY {state_col}
                    ORDER BY revenue DESC
                    LIMIT 20
                """
                geo = con.execute(query).df()
                total_rev = geo['revenue'].sum()
                geo['pct'] = (geo['revenue'] / total_rev * 100).round(1) if total_rev > 0 else 0
                geo['aov'] = (geo['revenue'] / geo['orders']).round(2)
                result['states'] = clean(geo.to_dict(orient='records'))
            else:
                result['states'] = []
                result['geo_note'] = 'No state/province column found in order data'
                result['flat_file_cols'] = cols[:20]
            con.close()
        except Exception as e2:
            result['states'] = []
            result['geo_note'] = str(e2)
        
        result['total_rows'] = len(df)
    else:
        result['states'] = []
        result['by_sku'] = []
except Exception as e:
    result['error'] = str(e)
    result['states'] = []
    result['by_sku'] = []

print(json.dumps(result))
