import sys, json, warnings
warnings.filterwarnings('ignore')
sys.path.insert(0, '/Users/tingzizhang/biohuez-dashboard')
import db

# Map of "canonical label" → actual table name in DB
TABLE_MAP = [
    ('sp_sales_traffic_weekly', 'sp_sales_traffic', 'Sales & Traffic'),
    ('sp_orders', 'sp_orders', 'Orders'),
    ('sp_inventory_snapshots', 'sp_inventory', 'Inventory'),
    ('sp_ads_performance', 'ads_campaigns', 'Ads Performance'),
    ('sp_ads_by_type', 'ads_edit_by_type', 'Ads by Type'),
    ('sp_bsr', 'sp_bsr', 'BSR Rankings'),
    ('sp_finances', 'sp_finances', 'Finances / Settlement'),
    ('ba_repeat_purchase_weekly', 'ba_repeat_purchase_weekly', 'Repeat Purchase (BA)'),
    ('ba_search_query_performance_weekly', 'ba_search_query_performance_weekly', 'Search Query (BA)'),
    ('ba_item_comparison_weekly', 'ba_item_comparison_weekly', 'Item Comparison (BA)'),
]

con = db._conn_read()
actual_tables = con.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='main'").df()
actual_names = set(actual_tables['table_name'].tolist())

results = []
for label, tbl, display in TABLE_MAP:
    if tbl not in actual_names:
        results.append({
            'table': label,
            'actual_table': tbl,
            'display_name': display,
            'status': 'missing',
            'rows': 0,
            'last_updated': None
        })
        continue
    try:
        count = con.execute(f"SELECT COUNT(*) as n FROM {tbl}").fetchone()[0]
        cols = con.execute(f"SELECT column_name FROM information_schema.columns WHERE table_name='{tbl}'").df()['column_name'].tolist()
        date_col = next((c for c in cols if 'date' in c.lower() or 'fetched' in c.lower() or 'updated' in c.lower()), None)
        last_date = None
        if date_col:
            row = con.execute(f"SELECT MAX({date_col}) as d FROM {tbl}").fetchone()
            last_date = str(row[0]) if row and row[0] else None
        results.append({
            'table': label,
            'actual_table': tbl,
            'display_name': display,
            'status': 'ok',
            'rows': int(count),
            'last_updated': last_date
        })
    except Exception as e:
        results.append({
            'table': label,
            'actual_table': tbl,
            'display_name': display,
            'status': 'error',
            'error': str(e),
            'rows': 0,
            'last_updated': None
        })

con.close()
print(json.dumps({'tables': results, 'total': len(results)}))
