import sys, json, warnings
from _bootstrap import add_legacy_dashboard_to_path
warnings.filterwarnings('ignore')
add_legacy_dashboard_to_path()
import db

result = {'sales': [], 'inventory': [], 'meta': {'last_updated': None, 'sales_last_date': None, 'inventory_last_fetched_at': None}}

try:
    sales = db.get_sales_traffic()
    if not sales.empty:
        sales = sales.copy()
        if 'sku' in sales.columns and 'sku_name' not in sales.columns:
            sales = sales.rename(columns={'sku': 'sku_name'})
        sales['date'] = sales['date'].astype(str)
        for col in ['revenue', 'orders', 'units']:
            if col in sales.columns:
                sales[col] = sales[col].fillna(0)
        if 'date' in sales.columns and not sales['date'].empty:
            result['meta']['sales_last_date'] = str(sales['date'].max())[:10]
        result['sales'] = sales.to_dict(orient='records')
except Exception as e:
    result['sales_error'] = str(e)

try:
    inv = db.get_inventory()
    if inv is not None and not inv.empty:
        inv = inv.copy()
        # Get latest snapshot only
        if 'fetched_at' in inv.columns:
            latest = inv['fetched_at'].max()
            result['meta']['inventory_last_fetched_at'] = str(latest)
            inv = inv[inv['fetched_at'] == latest]
        if 'quantity' in inv.columns and 'total_quantity' not in inv.columns:
            inv = inv.rename(columns={'quantity': 'total_quantity'})
        for col in inv.select_dtypes(include=['datetime64']).columns:
            inv[col] = inv[col].astype(str)
        result['inventory'] = inv[['sku_name', 'total_quantity']].to_dict(orient='records')
except Exception as e:
    result['inventory_error'] = str(e)

result['meta']['last_updated'] = result['meta']['inventory_last_fetched_at'] or result['meta']['sales_last_date']
print(json.dumps(result))
