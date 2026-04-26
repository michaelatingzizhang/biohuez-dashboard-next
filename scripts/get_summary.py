import sys, json, warnings
warnings.filterwarnings('ignore')
sys.path.insert(0, '/Users/tingzizhang/biohuez-dashboard')
import db

result = {'sales': [], 'inventory': []}

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
            inv = inv[inv['fetched_at'] == latest]
        if 'quantity' in inv.columns and 'total_quantity' not in inv.columns:
            inv = inv.rename(columns={'quantity': 'total_quantity'})
        for col in inv.select_dtypes(include=['datetime64']).columns:
            inv[col] = inv[col].astype(str)
        result['inventory'] = inv[['sku_name', 'total_quantity']].to_dict(orient='records')
except Exception as e:
    result['inventory_error'] = str(e)

print(json.dumps(result))
