import sys, json, warnings, math
from _bootstrap import add_legacy_dashboard_to_path
warnings.filterwarnings('ignore')
add_legacy_dashboard_to_path()
import db
import pandas as pd


VALID_STATES = {
    'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA',
    'MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX',
    'UT','VT','VA','WA','WV','WI','WY'
}

STATE_NAME_MAP = {
    'ALABAMA':'AL','ALASKA':'AK','ARIZONA':'AZ','ARKANSAS':'AR','CALIFORNIA':'CA','COLORADO':'CO','CONNECTICUT':'CT',
    'DELAWARE':'DE','DISTRICT OF COLUMBIA':'DC','FLORIDA':'FL','GEORGIA':'GA','HAWAII':'HI','IDAHO':'ID','ILLINOIS':'IL',
    'INDIANA':'IN','IOWA':'IA','KANSAS':'KS','KENTUCKY':'KY','LOUISIANA':'LA','MAINE':'ME','MARYLAND':'MD',
    'MASSACHUSETTS':'MA','MICHIGAN':'MI','MINNESOTA':'MN','MISSISSIPPI':'MS','MISSOURI':'MO','MONTANA':'MT',
    'NEBRASKA':'NE','NEVADA':'NV','NEW HAMPSHIRE':'NH','NEW JERSEY':'NJ','NEW MEXICO':'NM','NEW YORK':'NY',
    'NORTH CAROLINA':'NC','NORTH DAKOTA':'ND','OHIO':'OH','OKLAHOMA':'OK','OREGON':'OR','PENNSYLVANIA':'PA',
    'RHODE ISLAND':'RI','SOUTH CAROLINA':'SC','SOUTH DAKOTA':'SD','TENNESSEE':'TN','TEXAS':'TX','UTAH':'UT',
    'VERMONT':'VT','VIRGINIA':'VA','WASHINGTON':'WA','WEST VIRGINIA':'WV','WISCONSIN':'WI','WYOMING':'WY',
}

SKU_MAP = {
    'ZH-FH-1B': 'Black',
    'ZH-FH-3C': 'Chocolate',
    'ZH-FH-5CL': 'Cream Latte',
    'ZH-FH-6R': 'Red',
}


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


def normalize_state(value):
    if not value:
        return ''
    state = str(value).strip().upper()
    return STATE_NAME_MAP.get(state, state)


def concentration_level(pct):
    if pct >= 70:
        return 'High'
    if pct >= 50:
        return 'Moderate'
    return 'Balanced'


def top_n(rows, key, n):
    sorted_rows = sorted(rows, key=lambda row: float(row.get(key) or 0), reverse=True)
    top = sorted_rows[:n]
    rest = sorted_rows[n:]
    if rest:
        item = {k: None for k in top[0].keys()} if top else {}
        item['label'] = 'Others'
        item['state'] = 'Others'
        item['city'] = 'Others'
        item['orders'] = sum(int(row.get('orders') or 0) for row in rest)
        item['units'] = sum(int(row.get('units') or 0) for row in rest)
        item['revenue'] = round(sum(float(row.get('revenue') or 0) for row in rest), 2)
        top.append(item)
    return top


def add_share(rows, total_revenue=None):
    total = total_revenue if total_revenue is not None else sum(float(row.get('revenue') or 0) for row in rows)
    for row in rows:
        orders = int(row.get('orders') or 0)
        units = int(row.get('units') or row.get('orders') or 0)
        revenue = float(row.get('revenue') or 0)
        row['orders'] = orders
        row['units'] = units
        row['revenue'] = round(revenue, 2)
        row['aov'] = round(revenue / orders, 2) if orders else 0
        row['asp'] = round(revenue / units, 2) if units else 0
        row['pct'] = round(revenue / total * 100, 1) if total else 0
    return rows


def build_insights(states, by_sku, total_rows, note=None):
    sku_rows = add_share([dict(row) for row in by_sku])
    state_rows = add_share([dict(row) for row in states])
    sku_rows = sorted(sku_rows, key=lambda row: row['revenue'], reverse=True)
    state_rows = sorted(state_rows, key=lambda row: row['revenue'], reverse=True)
    top_sku = sku_rows[0] if sku_rows else None
    top_state = state_rows[0] if state_rows else None
    top2_sku = round(sum(row.get('pct', 0) for row in sku_rows[:2]), 1)
    top3_state = round(sum(row.get('pct', 0) for row in state_rows[:3]), 1)
    signals = []
    if top_sku:
        signals.append({
            'severity': 'warning' if top_sku['pct'] >= 60 else 'positive',
            'title': 'SKU concentration is high' if top_sku['pct'] >= 60 else 'SKU mix is reasonably balanced',
            'detail': f"{SKU_MAP.get(top_sku.get('sku'), top_sku.get('sku'))} contributes {top_sku['pct']}% of tracked revenue.",
        })
    if top_state:
        signals.append({
            'severity': 'warning' if top3_state >= 60 else 'positive',
            'title': 'Market concentration is high' if top3_state >= 60 else 'Geographic mix is diversified',
            'detail': f"The top 3 states contribute {top3_state}% of available geographic revenue.",
        })
    else:
        signals.append({
            'severity': 'warning',
            'title': 'State-level geography is unavailable',
            'detail': note or 'The current export does not include buyer state/province.',
        })
    return {
        'summary': {
            'total_rows': total_rows,
            'sku_count': len(sku_rows),
            'state_count': len(state_rows),
            'top_sku': top_sku.get('sku') if top_sku else None,
            'top_sku_share_pct': top_sku.get('pct') if top_sku else 0,
            'top2_sku_share_pct': top2_sku,
            'sku_concentration_level': concentration_level(top_sku.get('pct') if top_sku else 0),
            'top_state': top_state.get('state') if top_state else None,
            'top_state_share_pct': top_state.get('pct') if top_state else 0,
            'top3_state_share_pct': top3_state,
            'market_concentration_level': concentration_level(top3_state) if top_state else 'Unavailable',
            'total_sku_revenue': round(sum(row.get('revenue', 0) for row in sku_rows), 2),
            'total_sku_orders': sum(row.get('orders', 0) for row in sku_rows),
            'total_state_revenue': round(sum(row.get('revenue', 0) for row in state_rows), 2),
            'total_state_orders': sum(row.get('orders', 0) for row in state_rows),
        },
        'signals': signals,
        'sku_concentration': sku_rows,
        'market_concentration': state_rows,
        'data_coverage': {'state_level_available': bool(state_rows), 'rows_analyzed': total_rows, 'note': note},
    }


def shipment_frame():
    df = db.get_shipments()
    if df is None or df.empty:
        return pd.DataFrame()
    df = df.copy()
    needed = ['amazon_order_id', 'purchase_date', 'ship_city', 'ship_state', 'quantity_shipped', 'item_price']
    if any(col not in df.columns for col in needed):
        return pd.DataFrame()
    df = df[needed]
    df = df[df['purchase_date'].notna() & df['ship_state'].notna()]
    df = df.rename(columns={'quantity_shipped': 'units', 'item_price': 'revenue'})
    df['purchase_date'] = pd.to_datetime(df['purchase_date'], errors='coerce')
    df['state'] = df['ship_state'].apply(normalize_state)
    df['city'] = df['ship_city'].fillna('').astype(str).str.strip().str.title()
    df = df[df['state'].isin(VALID_STATES)]
    df = df[df['purchase_date'].notna()]
    df['month'] = df['purchase_date'].dt.to_period('M').astype(str)
    df['units'] = pd.to_numeric(df['units'], errors='coerce').fillna(0)
    df['revenue'] = pd.to_numeric(df['revenue'], errors='coerce').fillna(0)
    return df


def sku_rows_from_orders():
    df = db.get_orders_comprehensive()
    if df is None or df.empty or 'sku' not in df.columns or 'item_price' not in df.columns:
        return [], 0
    df = df.copy()
    df['item_price'] = pd.to_numeric(df['item_price'], errors='coerce').fillna(0)
    grouped = df.groupby('sku').agg(orders=('sku', 'count'), revenue=('item_price', 'sum')).reset_index()
    rows = grouped.to_dict(orient='records')
    return add_share(rows), len(df)


result = {}

try:
    ship = shipment_frame()
    by_sku, order_rows = sku_rows_from_orders()
    if not ship.empty:
        state_rows = ship.groupby('state').agg(
            orders=('amazon_order_id', 'nunique'),
            units=('units', 'sum'),
            revenue=('revenue', 'sum'),
        ).reset_index().to_dict(orient='records')
        city_rows = ship.groupby(['state', 'city']).agg(
            orders=('amazon_order_id', 'nunique'),
            units=('units', 'sum'),
            revenue=('revenue', 'sum'),
        ).reset_index()
        city_rows['label'] = city_rows['city'] + ', ' + city_rows['state']
        months = sorted(ship['month'].dropna().unique().tolist())
        latest_month = months[-1] if months else None
        latest = ship[ship['month'] == latest_month] if latest_month else ship
        top_state_month = add_share(latest.groupby('state').agg(
            orders=('amazon_order_id', 'nunique'),
            units=('units', 'sum'),
            revenue=('revenue', 'sum'),
        ).reset_index().to_dict(orient='records'))
        top_state_month = sorted(top_state_month, key=lambda row: row['units'], reverse=True)
        monthly_states = []
        monthly_cities = []
        for month in months[-3:]:
            month_df = ship[ship['month'] == month]
            states = month_df.groupby('state').agg(
                orders=('amazon_order_id', 'nunique'),
                units=('units', 'sum'),
                revenue=('revenue', 'sum'),
            ).reset_index().to_dict(orient='records')
            cities = month_df.groupby(['state', 'city']).agg(
                orders=('amazon_order_id', 'nunique'),
                units=('units', 'sum'),
                revenue=('revenue', 'sum'),
            ).reset_index()
            cities['label'] = cities['city'] + ', ' + cities['state']
            monthly_states.append({'month': month, 'rows': top_n(add_share(states), 'units', 5)})
            monthly_cities.append({'month': month, 'rows': top_n(add_share(cities.to_dict(orient='records')), 'units', 10)})
        result.update({
            'states': clean(sorted(add_share(state_rows), key=lambda row: row['revenue'], reverse=True)[:30]),
            'cities': clean(sorted(add_share(city_rows.to_dict(orient='records')), key=lambda row: row['revenue'], reverse=True)[:50]),
            'by_sku': clean(by_sku),
            'latest_month': latest_month,
            'kpis': clean({
                'top_states': top_state_month[:3],
                'states_reached': len(top_state_month),
                'top5_units_share': round(sum(row.get('units', 0) for row in top_state_month[:5]) / max(sum(row.get('units', 0) for row in top_state_month), 1) * 100, 1),
                'top5_revenue_share': round(sum(row.get('revenue', 0) for row in top_state_month[:5]) / max(sum(row.get('revenue', 0) for row in top_state_month), 1) * 100, 1),
            }),
            'monthly_states': clean(monthly_states),
            'monthly_cities': clean(monthly_cities),
            'total_rows': len(ship),
            'source': 'sp_shipments',
        })
        result['insights'] = clean(build_insights(result['states'], by_sku, len(ship), None))
    else:
        result.update({
            'states': [],
            'cities': [],
            'by_sku': clean(by_sku),
            'total_rows': order_rows,
            'geo_note': 'No shipment state/city data found. Showing SKU distribution from order data.',
            'source': 'orders_comprehensive',
        })
        result['insights'] = clean(build_insights([], by_sku, order_rows, result['geo_note']))
except Exception as e:
    result = {'error': str(e), 'states': [], 'cities': [], 'by_sku': [], 'total_rows': 0}
    result['insights'] = clean(build_insights([], [], 0, str(e)))

print(json.dumps(clean(result)))
