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

def concentration_level(pct):
    if pct >= 70:
        return 'High'
    if pct >= 50:
        return 'Moderate'
    return 'Balanced'

def build_insights(states, by_sku, total_rows, geo_note=None):
    signals = []
    sku_concentration = []
    market_concentration = []

    total_sku_revenue = sum(float(row.get('revenue') or 0) for row in by_sku)
    total_sku_orders = sum(int(row.get('orders') or 0) for row in by_sku)
    sorted_skus = sorted(by_sku, key=lambda row: float(row.get('revenue') or 0), reverse=True)

    for row in sorted_skus:
        revenue = float(row.get('revenue') or 0)
        orders = int(row.get('orders') or 0)
        sku_concentration.append({
            'sku': row.get('sku'),
            'orders': orders,
            'revenue': round(revenue, 2),
            'aov': round(revenue / orders, 2) if orders else 0,
            'pct': round(revenue / total_sku_revenue * 100, 1) if total_sku_revenue else 0,
        })

    top_sku = sku_concentration[0] if sku_concentration else None
    top_sku_share = top_sku.get('pct', 0) if top_sku else 0
    top2_sku_share = round(sum(row.get('pct', 0) for row in sku_concentration[:2]), 1)

    if top_sku and top_sku_share >= 60:
        signals.append({
            'severity': 'warning',
            'title': 'SKU concentration is high',
            'detail': f"{top_sku['sku']} contributes {top_sku_share}% of tracked revenue. Watch supply, stockouts, and margin shifts for this SKU closely.",
        })
    elif top_sku:
        signals.append({
            'severity': 'positive',
            'title': 'SKU mix is reasonably balanced',
            'detail': f"The top SKU contributes {top_sku_share}% of tracked revenue, leaving room for a healthier product mix.",
        })

    total_state_revenue = sum(float(row.get('revenue') or 0) for row in states)
    total_state_orders = sum(int(row.get('orders') or 0) for row in states)
    sorted_states = sorted(states, key=lambda row: float(row.get('revenue') or 0), reverse=True)

    for row in sorted_states:
        revenue = float(row.get('revenue') or 0)
        orders = int(row.get('orders') or 0)
        market_concentration.append({
            'state': row.get('state'),
            'orders': orders,
            'revenue': round(revenue, 2),
            'aov': round(revenue / orders, 2) if orders else 0,
            'pct': round(revenue / total_state_revenue * 100, 1) if total_state_revenue else 0,
        })

    top_state = market_concentration[0] if market_concentration else None
    top_state_share = top_state.get('pct', 0) if top_state else 0
    top3_state_share = round(sum(row.get('pct', 0) for row in market_concentration[:3]), 1)

    if top_state and top3_state_share >= 60:
        signals.append({
            'severity': 'warning',
            'title': 'Market concentration is high',
            'detail': f"The top 3 states contribute {top3_state_share}% of available geographic revenue.",
        })
    elif top_state:
        signals.append({
            'severity': 'positive',
            'title': 'Geographic mix is diversified',
            'detail': f"The top 3 states contribute {top3_state_share}% of available geographic revenue.",
        })
    else:
        signals.append({
            'severity': 'warning',
            'title': 'State-level geography is unavailable',
            'detail': geo_note or 'The current Amazon order export does not include buyer state/province, so this page uses SKU-level distribution as the best available proxy.',
        })

    if total_rows == 0:
        signals.append({
            'severity': 'warning',
            'title': 'No order rows available',
            'detail': 'No rows were returned from the comprehensive orders dataset.',
        })

    return {
        'summary': {
            'total_rows': total_rows,
            'sku_count': len(sku_concentration),
            'state_count': len(market_concentration),
            'top_sku': top_sku.get('sku') if top_sku else None,
            'top_sku_share_pct': top_sku_share,
            'top2_sku_share_pct': top2_sku_share,
            'sku_concentration_level': concentration_level(top_sku_share),
            'top_state': top_state.get('state') if top_state else None,
            'top_state_share_pct': top_state_share,
            'top3_state_share_pct': top3_state_share,
            'market_concentration_level': concentration_level(top3_state_share) if top_state else 'Unavailable',
            'total_sku_revenue': round(total_sku_revenue, 2),
            'total_sku_orders': total_sku_orders,
            'total_state_revenue': round(total_state_revenue, 2),
            'total_state_orders': total_state_orders,
        },
        'signals': signals,
        'sku_concentration': sku_concentration,
        'market_concentration': market_concentration,
        'data_coverage': {
            'state_level_available': bool(market_concentration),
            'rows_analyzed': total_rows,
            'note': geo_note,
        },
    }

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
        else:
            result['by_sku'] = []
        
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
        result['insights'] = clean(build_insights(
            result.get('states', []),
            result.get('by_sku', []),
            result['total_rows'],
            result.get('geo_note'),
        ))
    else:
        result['states'] = []
        result['by_sku'] = []
        result['total_rows'] = 0
        result['insights'] = clean(build_insights([], [], 0, 'No order rows available'))
except Exception as e:
    result['error'] = str(e)
    result['states'] = []
    result['by_sku'] = []
    result['total_rows'] = 0
    result['insights'] = clean(build_insights([], [], 0, str(e)))

print(json.dumps(result))
