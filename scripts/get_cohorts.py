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

try:
    orders = db.get_orders()
    if orders is not None and not orders.empty:
        orders = orders.copy()
        
        # Parse purchase date
        date_col = None
        for c in orders.columns:
            if 'purchase' in c.lower() or 'date' in c.lower():
                date_col = c
                break
        
        if date_col:
            orders[date_col] = pd.to_datetime(orders[date_col], errors='coerce')
            orders = orders[orders[date_col].notna()]
            orders['cohort_month'] = orders[date_col].dt.to_period('M').astype(str)
            orders['order_month'] = orders[date_col].dt.to_period('M').astype(str)
            
            # Use order_id as proxy for unique customers
            # Group by cohort_month -> count orders as M0, then no repeat since no customer ID
            cohort_sizes = orders.groupby('cohort_month').size().reset_index(name='m0_count')
            cohort_sizes = cohort_sizes.sort_values('cohort_month')
            
            # Build matrix: since we may not have customer IDs, just show cohort sizes
            # and try to compute order-based retention
            id_col = None
            for c in orders.columns:
                if 'order_id' in c.lower() or 'customer' in c.lower() or 'buyer' in c.lower() or 'email' in c.lower():
                    id_col = c
                    break
            
            cohort_data = []
            
            if id_col and id_col != 'order_id':
                # We have customer identifier - do proper cohort analysis
                orders['first_purchase_month'] = orders.groupby(id_col)[date_col].transform('min').dt.to_period('M').astype(str)
                orders['period_number'] = (
                    pd.to_datetime(orders['order_month']).dt.to_period('M') - 
                    pd.to_datetime(orders['first_purchase_month']).dt.to_period('M')
                ).apply(lambda x: x.n if hasattr(x, 'n') else 0)
                
                cohort_pivot = orders.groupby(['first_purchase_month', 'period_number'])[id_col].nunique().unstack(fill_value=0)
                
                for cohort_m in cohort_pivot.index:
                    row = {'cohort_month': str(cohort_m)}
                    m0 = cohort_pivot.loc[cohort_m, 0] if 0 in cohort_pivot.columns else 0
                    row['m0'] = int(m0)
                    for offset in range(1, 7):
                        if offset in cohort_pivot.columns and m0 > 0:
                            row[f'm{offset}'] = round(cohort_pivot.loc[cohort_m, offset] / m0 * 100, 1)
                        else:
                            row[f'm{offset}'] = None
                    cohort_data.append(row)
            else:
                # Use order_id proxy - cohort by first order month, use order count as proxy
                for _, r in cohort_sizes.iterrows():
                    cohort_data.append({
                        'cohort_month': r['cohort_month'],
                        'm0': int(r['m0_count']),
                        'm1': None, 'm2': None, 'm3': None, 'm4': None, 'm5': None, 'm6': None
                    })
            
            result['cohorts'] = clean(cohort_data)
            result['cohort_sizes'] = clean(cohort_sizes.to_dict(orient='records'))
            result['total_orders'] = int(len(orders))
        else:
            result['cohorts'] = []
            result['cohort_sizes'] = []
            result['total_orders'] = 0
    else:
        result['cohorts'] = []
        result['cohort_sizes'] = []
        result['total_orders'] = 0
except Exception as e:
    result['error'] = str(e)
    result['cohorts'] = []
    result['cohort_sizes'] = []
    result['total_orders'] = 0

print(json.dumps(result))
