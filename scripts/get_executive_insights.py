import json
import warnings
from _bootstrap import add_legacy_dashboard_to_path

warnings.filterwarnings('ignore')
add_legacy_dashboard_to_path()
import db


SEVERITY_WEIGHT = {'critical': 0, 'warning': 1, 'positive': 2, 'neutral': 3}


def clean_value(value):
    try:
        if value is None:
            return 0.0
        return float(value)
    except Exception:
        return 0.0


def add_item(items, section, href, severity, title, detail):
    items.append({
        'section': section,
        'href': href,
        'severity': severity,
        'title': title,
        'detail': detail,
    })


def table_exists(con, table):
    return bool(con.execute(
        "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='main' AND table_name=?",
        [table],
    ).fetchone()[0])


def sales_items(con, items):
    if not table_exists(con, 'sp_sales_traffic'):
        return
    rows = con.execute("""
        SELECT date_trunc('week', date)::DATE AS week, SUM(revenue) AS revenue, SUM(units) AS units, SUM(orders) AS orders
        FROM sp_sales_traffic
        WHERE date IS NOT NULL
        GROUP BY 1
        ORDER BY 1 DESC
        LIMIT 2
    """).fetchall()
    if not rows:
        return
    latest = rows[0]
    previous = rows[1] if len(rows) > 1 else None
    revenue = clean_value(latest[1])
    units = clean_value(latest[2])
    if previous:
        prev_revenue = clean_value(previous[1])
        change = ((revenue - prev_revenue) / prev_revenue * 100) if prev_revenue else 0
        if change <= -20:
            add_item(items, 'Sales', '/sales', 'critical', 'Revenue dropped sharply week over week', f"Latest weekly revenue changed {change:.1f}% versus the prior week.")
        elif change < 0:
            add_item(items, 'Sales', '/sales', 'warning', 'Revenue softened week over week', f"Latest weekly revenue changed {change:.1f}% versus the prior week.")
        elif change >= 15:
            add_item(items, 'Sales', '/sales', 'positive', 'Revenue is growing week over week', f"Latest weekly revenue increased {change:.1f}% versus the prior week.")
    if units > 0:
        add_item(items, 'Sales', '/sales', 'neutral', 'Latest sales activity is available', f"Latest week recorded {int(units):,} units and ${revenue:,.0f} revenue.")


def inventory_items(con, items):
    if not table_exists(con, 'sp_inventory'):
        return
    row = con.execute("""
        WITH latest AS (SELECT MAX(fetched_at) AS fetched_at FROM sp_inventory)
        SELECT COUNT(*) AS sku_count, SUM(quantity) AS quantity, SUM(CASE WHEN quantity <= 20 THEN 1 ELSE 0 END) AS low_stock
        FROM sp_inventory, latest
        WHERE sp_inventory.fetched_at = latest.fetched_at
    """).fetchone()
    if not row:
        return
    sku_count = int(clean_value(row[0]))
    quantity = int(clean_value(row[1]))
    low_stock = int(clean_value(row[2]))
    if low_stock:
        severity = 'critical' if low_stock >= 3 else 'warning'
        add_item(items, 'Inventory', '/inventory', severity, 'Low-stock SKUs need attention', f"{low_stock} of {sku_count} SKUs are at or below 20 units.")
    else:
        add_item(items, 'Inventory', '/inventory', 'positive', 'Inventory coverage looks stable', f"Latest snapshot shows {quantity:,} units across {sku_count} SKUs.")


def ads_items(con, items):
    if not table_exists(con, 'ads_campaigns'):
        return
    row = con.execute("""
        SELECT SUM(spend) AS spend, SUM(sales_1d) AS sales, SUM(clicks) AS clicks, SUM(impressions) AS impressions
        FROM ads_campaigns
        WHERE date >= (SELECT MAX(date) - INTERVAL 30 DAY FROM ads_campaigns)
    """).fetchone()
    if not row:
        return
    spend = clean_value(row[0])
    sales = clean_value(row[1])
    clicks = clean_value(row[2])
    impressions = clean_value(row[3])
    acos = spend / sales * 100 if sales else 0
    ctr = clicks / impressions * 100 if impressions else 0
    if spend > 0 and sales <= 0:
        add_item(items, 'Campaign', '/campaign', 'critical', 'Ad spend has no attributed sales', f"Last 30 days show ${spend:,.0f} spend with no attributed sales.")
    elif acos >= 80:
        add_item(items, 'Campaign', '/campaign', 'critical', 'ACOS is pressuring sales efficiency', f"Last 30 days ACOS is {acos:.1f}%.")
    elif acos >= 35:
        add_item(items, 'Campaign', '/campaign', 'warning', 'ACOS needs optimization', f"Last 30 days ACOS is {acos:.1f}%.")
    elif spend > 0:
        add_item(items, 'Campaign', '/campaign', 'positive', 'Ads efficiency is within range', f"Last 30 days ACOS is {acos:.1f}% with {ctr:.1f}% CTR.")


def finance_items(con, items):
    if not table_exists(con, 'sp_finances'):
        return
    row = con.execute("""
        SELECT date_trunc('month', period_start)::DATE AS month,
               SUM(actual_selling_price) AS sales,
               SUM(referral_fees + fba_fulfillment + fba_storage + fba_other) AS fees,
               SUM(refunds) AS refunds
        FROM sp_finances
        WHERE currency='USD' AND period_start IS NOT NULL
        GROUP BY 1
        ORDER BY 1 DESC
        LIMIT 1
    """).fetchone()
    if not row:
        return
    month = str(row[0])[:7]
    sales = clean_value(row[1])
    fees = abs(clean_value(row[2]))
    refunds = abs(clean_value(row[3]))
    fee_load = fees / sales * 100 if sales else 0
    refund_load = refunds / sales * 100 if sales else 0
    if fee_load >= 45:
        add_item(items, 'Finance', '/finance', 'critical', 'Amazon and FBA fees are heavy', f"{month} fee load is {fee_load:.1f}% of settlement sales.")
    elif fee_load >= 30:
        add_item(items, 'Finance', '/finance', 'warning', 'Fee load should be watched', f"{month} fee load is {fee_load:.1f}% of settlement sales.")
    if refund_load >= 8:
        add_item(items, 'Finance', '/finance', 'warning', 'Refund drag is elevated', f"{month} refunds are {refund_load:.1f}% of settlement sales.")


def returns_items(con, items):
    if not table_exists(con, 'sp_fba_customer_returns_daily'):
        return
    row = con.execute("""
        SELECT SUM(quantity) AS units, COUNT(DISTINCT order_id) AS orders
        FROM sp_fba_customer_returns_daily
        WHERE return_date >= (SELECT MAX(return_date) - INTERVAL 30 DAY FROM sp_fba_customer_returns_daily)
    """).fetchone()
    if not row:
        return
    units = int(clean_value(row[0]))
    orders = int(clean_value(row[1]))
    if units >= 10:
        add_item(items, 'Returns', '/returns', 'warning', 'Returns require review', f"Last 30 days show {units:,} returned units across {orders:,} orders.")
    elif units > 0:
        add_item(items, 'Returns', '/returns', 'neutral', 'Returns are being tracked', f"Last 30 days show {units:,} returned units.")


def bsr_items(con, items):
    if not table_exists(con, 'sp_bsr'):
        return
    row = con.execute("""
        SELECT sku_name, MIN(rank) AS best_rank
        FROM sp_bsr
        WHERE date >= (SELECT MAX(date) - INTERVAL 14 DAY FROM sp_bsr)
        GROUP BY sku_name
        ORDER BY best_rank ASC
        LIMIT 1
    """).fetchone()
    if row and clean_value(row[1]) > 0:
        add_item(items, 'Competitor', '/competitor', 'neutral', 'BSR tracking is live', f"Best recent BioHuez rank is #{int(clean_value(row[1])):,} for {row[0]}.")


def build():
    items = []
    con = db._conn_read()
    try:
        sales_items(con, items)
        inventory_items(con, items)
        ads_items(con, items)
        finance_items(con, items)
        returns_items(con, items)
        bsr_items(con, items)
    finally:
        con.close()
    items = sorted(items, key=lambda item: (SEVERITY_WEIGHT.get(item.get('severity'), 3), item.get('section', ''), item.get('title', '')))[:12]
    counts = {'critical': 0, 'warning': 0, 'positive': 0, 'neutral': 0}
    for item in items:
        counts[item['severity']] = counts.get(item['severity'], 0) + 1
    sections = sorted(set(item['section'] for item in items))
    sources = [{'section': section, 'href': next(item['href'] for item in items if item['section'] == section), 'signal_count': sum(1 for item in items if item['section'] == section)} for section in sections]
    return {'items': items, 'counts': counts, 'sources': sources}


result = {'items': [], 'counts': {'critical': 0, 'warning': 0, 'positive': 0, 'neutral': 0}, 'sources': []}

try:
    result = build()
except Exception as e:
    result['error'] = str(e)

print(json.dumps(result))
