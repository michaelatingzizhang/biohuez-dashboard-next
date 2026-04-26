import sys, json, warnings, math
warnings.filterwarnings('ignore')
sys.path.insert(0, '/Users/tingzizhang/biohuez-dashboard')
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
DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

try:
    orders = db.get_orders()
    if orders is not None and not orders.empty:
        orders = orders.copy()
        
        date_col = None
        for c in orders.columns:
            if 'purchase' in c.lower() or ('date' in c.lower() and 'order' not in c.lower()):
                date_col = c
                break
        if date_col is None:
            for c in orders.columns:
                if 'date' in c.lower():
                    date_col = c
                    break
        
        rev_col = None
        for c in orders.columns:
            if 'total' in c.lower() or 'revenue' in c.lower() or 'amount' in c.lower():
                rev_col = c
                break
        
        if date_col:
            orders[date_col] = pd.to_datetime(orders[date_col], errors='coerce')
            orders = orders[orders[date_col].notna()]
            
            # Day of week
            orders['day_of_week'] = orders[date_col].dt.day_name()
            dow = orders.groupby('day_of_week').agg(
                orders=('day_of_week', 'count'),
                revenue=(rev_col, 'sum') if rev_col else ('day_of_week', 'count')
            ).reset_index()
            dow.columns = ['day', 'orders', 'revenue']
            dow['day_order'] = dow['day'].map({d: i for i, d in enumerate(DAY_ORDER)})
            dow = dow.sort_values('day_order').drop('day_order', axis=1)
            result['day_of_week'] = clean(dow.to_dict(orient='records'))
            
            # Monthly
            orders['month'] = orders[date_col].dt.to_period('M').astype(str)
            monthly = orders.groupby('month').agg(
                orders=('month', 'count'),
                revenue=(rev_col, 'sum') if rev_col else ('month', 'count')
            ).reset_index()
            monthly.columns = ['month', 'orders', 'revenue']
            monthly = monthly.sort_values('month')
            result['month_orders'] = clean(monthly.to_dict(orient='records'))
            
            # Weekly
            orders['week'] = orders[date_col].dt.to_period('W').apply(lambda r: str(r.start_time.date()))
            weekly = orders.groupby('week').agg(
                orders=('week', 'count'),
                revenue=(rev_col, 'sum') if rev_col else ('week', 'count')
            ).reset_index()
            weekly.columns = ['week', 'orders', 'revenue']
            weekly = weekly.sort_values('week')
            result['week_orders'] = clean(weekly.to_dict(orient='records'))
            
            # Hour of day (if available)
            try:
                orders['hour'] = orders[date_col].dt.hour
                hourly = orders.groupby('hour').size().reset_index(name='orders')
                result['hour_orders'] = clean(hourly.to_dict(orient='records'))
            except Exception:
                result['hour_orders'] = []
        else:
            result['day_of_week'] = []
            result['month_orders'] = []
            result['week_orders'] = []
            result['hour_orders'] = []
    else:
        result['day_of_week'] = []
        result['month_orders'] = []
        result['week_orders'] = []
        result['hour_orders'] = []
except Exception as e:
    result['orders_error'] = str(e)
    result['day_of_week'] = []
    result['month_orders'] = []
    result['week_orders'] = []
    result['hour_orders'] = []

# Also get sales traffic for revenue context
try:
    sales = db.get_sales_traffic()
    if sales is not None and not sales.empty:
        for col in sales.select_dtypes(include=['datetime64']).columns:
            sales[col] = sales[col].astype(str)
        if 'date' in sales.columns:
            sales['date'] = sales['date'].astype(str)
        # Aggregate by month for combined view
        import pandas as pd2
        sales_pd = sales.copy()
        sales_pd['date'] = pd.to_datetime(sales_pd['date'], errors='coerce')
        sales_pd = sales_pd[sales_pd['date'].notna()]
        sales_pd['month'] = sales_pd['date'].dt.to_period('M').astype(str)
        if 'revenue' in sales_pd.columns:
            monthly_rev = sales_pd.groupby('month')['revenue'].sum().reset_index()
            monthly_rev.columns = ['month', 'sales_revenue']
            result['monthly_revenue'] = clean(monthly_rev.to_dict(orient='records'))
except Exception as e:
    result['sales_error'] = str(e)

print(json.dumps(result))
