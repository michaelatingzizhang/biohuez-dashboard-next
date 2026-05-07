import sys, json, warnings, math
from _bootstrap import add_legacy_dashboard_to_path
warnings.filterwarnings('ignore')
add_legacy_dashboard_to_path()
import db
import pandas as pd

PRICE_PER_UNIT_COGS = 4.93
TIER_ORDER = ['Competitor', 'Niche', 'Specific', 'Broad']

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

def safe_num(value):
    try:
        if value is None or pd.isna(value):
            return 0.0
        return float(value)
    except Exception:
        return 0.0

def proas(sales, orders, spend, cogs=PRICE_PER_UNIT_COGS):
    spend = safe_num(spend)
    if spend <= 0:
        return None
    return (safe_num(sales) - cogs * safe_num(orders)) / spend

def classify_tier(value):
    try:
        classified = db._classify_search_term(str(value))
        return classified.get('tier', 'Broad')
    except Exception:
        text = str(value).lower()
        if 'biohuez' in text:
            return 'Niche'
        if any(word in text for word in ['herbatint', 'naturtint', 'madison', 'clairol', 'revlon']):
            return 'Competitor'
        if len(text.split()) >= 3:
            return 'Specific'
        return 'Broad'

def classify_bucket(row):
    share = safe_num(row.get('purchase_share'))
    spend = safe_num(row.get('spend'))
    row_proas = row.get('proas')
    if share > 10 and (row_proas is None or row_proas >= 1.0):
        return 'Dominator'
    if share > 5 and spend < 30:
        return 'Organic Hero'
    if spend > 30 and row_proas is not None and row_proas < 1.0:
        return 'Money Pit'
    return 'Growth'

def scenario_for(row, cvr_med, share_med):
    if safe_num(row.get('spend')) < 20 or safe_num(row.get('ad_clicks')) < 5:
        return 'Monitor'
    high_cvr = safe_num(row.get('ad_cvr')) >= cvr_med
    high_share = safe_num(row.get('purchase_share')) >= share_med
    if high_cvr and not high_share:
        return 'A'
    if not high_cvr and high_share:
        return 'B'
    if high_cvr and high_share:
        return 'C'
    return 'D'

def rate(num, den):
    den = safe_num(den)
    return safe_num(num) / den * 100 if den > 0 else 0.0

def table_exists(con, table_name):
    try:
        return bool(con.execute(
            "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='main' AND table_name = ?",
            [table_name],
        ).fetchone()[0])
    except Exception:
        return False

def campaign_streamlit_parity():
    con = db._conn_read()
    try:
        outputs = {
            'war_room': {},
            'cluster_scenarios': [],
            'scenario_groups': [],
            'tier_summary': [],
            'funnel_tiers': [],
            'funnel_clusters': [],
            'price_benchmark': [],
        }
        has_ads_terms = table_exists(con, 'ads_search_terms_weekly')
        has_ba_clean = table_exists(con, 'ba_search_query_performance_weekly_cleaned')
        has_ba_raw = table_exists(con, 'ba_search_query_performance_weekly')

        ads_c = pd.DataFrame()
        ba_c = pd.DataFrame()
        if has_ads_terms:
            ads_c = con.execute("""
                SELECT
                    COALESCE(keyword_cluster, 'ASIN/Other') AS cluster,
                    COALESCE(tier, 'Broad') AS tier,
                    SUM(impressions) AS ad_impressions,
                    SUM(clicks) AS ad_clicks,
                    SUM(spend) AS spend,
                    SUM(COALESCE(sales_7d, 0)) AS sales,
                    SUM(COALESCE(orders_7d, 0)) AS orders
                FROM ads_search_terms_weekly
                GROUP BY 1, 2
            """).df()

        if has_ba_clean:
            ba_c = con.execute("""
                SELECT
                    COALESCE(keyword_cluster, 'ASIN/Other') AS cluster,
                    COALESCE(tier, 'Broad') AS tier,
                    SUM(search_query_volume) AS search_volume,
                    AVG(impression_share) AS imp_share,
                    AVG(click_share) AS click_share,
                    AVG(cart_add_share) AS cart_add_share,
                    AVG(purchase_share) AS purchase_share,
                    SUM(impression_total) AS mkt_impressions,
                    SUM(impression_asin) AS our_impressions,
                    SUM(click_total) AS mkt_clicks,
                    SUM(click_asin) AS our_clicks,
                    SUM(cart_add_total) AS mkt_cart_adds,
                    SUM(cart_add_asin) AS our_cart_adds,
                    SUM(purchase_total) AS mkt_purchases,
                    SUM(purchase_asin) AS our_purchases
                FROM ba_search_query_performance_weekly_cleaned
                GROUP BY 1, 2
            """).df()

        if ads_c.empty and ba_c.empty:
            return outputs

        if ads_c.empty:
            cluster = ba_c.copy()
            for col in ['ad_impressions', 'ad_clicks', 'spend', 'sales', 'orders']:
                cluster[col] = 0
        elif ba_c.empty:
            cluster = ads_c.copy()
            for col in ['search_volume', 'imp_share', 'click_share', 'cart_add_share', 'purchase_share', 'mkt_impressions', 'our_impressions', 'mkt_clicks', 'our_clicks', 'mkt_cart_adds', 'our_cart_adds', 'mkt_purchases', 'our_purchases']:
                cluster[col] = 0
        else:
            cluster = pd.merge(ads_c, ba_c, on=['cluster', 'tier'], how='outer').fillna(0)

        cluster['tier'] = cluster.apply(lambda row: row['tier'] if row.get('tier') in TIER_ORDER else classify_tier(row.get('cluster')), axis=1)
        for col in ['spend', 'sales', 'orders', 'ad_clicks', 'ad_impressions', 'search_volume', 'purchase_share', 'mkt_impressions', 'our_impressions', 'mkt_clicks', 'our_clicks', 'mkt_cart_adds', 'our_cart_adds', 'mkt_purchases', 'our_purchases']:
            if col in cluster.columns:
                cluster[col] = pd.to_numeric(cluster[col], errors='coerce').fillna(0)

        cluster['proas'] = cluster.apply(lambda row: proas(row['sales'], row['orders'], row['spend']), axis=1)
        cluster['ad_cvr'] = cluster.apply(lambda row: rate(row['orders'], row['ad_clicks']), axis=1)
        cluster['bucket'] = cluster.apply(classify_bucket, axis=1)
        cvr_med = safe_num(cluster.loc[cluster['ad_clicks'] >= 20, 'ad_cvr'].median()) or 5.0
        share_med = safe_num(cluster.loc[cluster['search_volume'] >= 1000, 'purchase_share'].median()) or 5.0
        cluster['scenario'] = cluster.apply(lambda row: scenario_for(row, cvr_med, share_med), axis=1)

        total_spend = safe_num(cluster['spend'].sum())
        total_sales = safe_num(cluster['sales'].sum())
        total_orders = safe_num(cluster['orders'].sum())
        ba_totals = {col: safe_num(cluster[col].sum()) if col in cluster else 0.0 for col in ['mkt_impressions', 'our_impressions', 'mkt_clicks', 'our_clicks', 'mkt_cart_adds', 'our_cart_adds', 'mkt_purchases', 'our_purchases']}
        outputs['war_room'] = {
            'total_spend': total_spend,
            'total_sales': total_sales,
            'total_orders': total_orders,
            'overall_proas': proas(total_sales, total_orders, total_spend),
            'growth_search_volume': safe_num(cluster.loc[cluster['bucket'] == 'Growth', 'search_volume'].sum()),
            'money_pit_spend': safe_num(cluster.loc[cluster['bucket'] == 'Money Pit', 'spend'].sum()),
            'imp_to_click_us': rate(ba_totals['our_clicks'], ba_totals['our_impressions']),
            'imp_to_click_market': rate(ba_totals['mkt_clicks'], ba_totals['mkt_impressions']),
            'click_to_cart_us': rate(ba_totals['our_cart_adds'], ba_totals['our_clicks']),
            'click_to_cart_market': rate(ba_totals['mkt_cart_adds'], ba_totals['mkt_clicks']),
            'cart_to_buy_us': rate(ba_totals['our_purchases'], ba_totals['our_cart_adds']),
            'cart_to_buy_market': rate(ba_totals['mkt_purchases'], ba_totals['mkt_cart_adds']),
            'scenario_threshold_cvr': cvr_med,
            'scenario_threshold_purchase_share': share_med,
        }

        outputs['cluster_scenarios'] = clean(cluster.sort_values(['scenario', 'search_volume', 'spend'], ascending=[True, False, False]).to_dict(orient='records'))
        outputs['scenario_groups'] = clean(cluster.groupby('scenario').agg(
            clusters=('cluster', 'count'),
            spend=('spend', 'sum'),
            sales=('sales', 'sum'),
            orders=('orders', 'sum'),
            search_volume=('search_volume', 'sum'),
            avg_purchase_share=('purchase_share', 'mean'),
            avg_ad_cvr=('ad_cvr', 'mean'),
        ).reset_index().to_dict(orient='records'))
        tier = cluster.groupby('tier').agg(
            clusters=('cluster', 'count'),
            spend=('spend', 'sum'),
            sales=('sales', 'sum'),
            orders=('orders', 'sum'),
            search_volume=('search_volume', 'sum'),
            purchase_share=('purchase_share', 'mean'),
            ad_clicks=('ad_clicks', 'sum'),
        ).reset_index()
        tier['proas'] = tier.apply(lambda row: proas(row['sales'], row['orders'], row['spend']), axis=1)
        tier['ad_cvr'] = tier.apply(lambda row: rate(row['orders'], row['ad_clicks']), axis=1)
        outputs['tier_summary'] = clean(tier.to_dict(orient='records'))

        funnel = cluster.copy()
        funnel['imp_to_click_market'] = funnel.apply(lambda row: rate(row['mkt_clicks'], row['mkt_impressions']), axis=1)
        funnel['imp_to_click_us'] = funnel.apply(lambda row: rate(row['our_clicks'], row['our_impressions']), axis=1)
        funnel['click_to_cart_market'] = funnel.apply(lambda row: rate(row['mkt_cart_adds'], row['mkt_clicks']), axis=1)
        funnel['click_to_cart_us'] = funnel.apply(lambda row: rate(row['our_cart_adds'], row['our_clicks']), axis=1)
        funnel['cart_to_buy_market'] = funnel.apply(lambda row: rate(row['mkt_purchases'], row['mkt_cart_adds']), axis=1)
        funnel['cart_to_buy_us'] = funnel.apply(lambda row: rate(row['our_purchases'], row['our_cart_adds']), axis=1)
        funnel['image_price_leak'] = funnel['imp_to_click_us'] < funnel['imp_to_click_market'] * 0.7
        funnel['cart_leak'] = funnel['click_to_cart_us'] < funnel['click_to_cart_market'] * 0.7
        funnel['content_leak'] = funnel['cart_to_buy_us'] < funnel['cart_to_buy_market'] * 0.7
        outputs['funnel_clusters'] = clean(funnel[funnel['mkt_impressions'] > 100].sort_values('mkt_impressions', ascending=False).head(40).to_dict(orient='records'))

        funnel_tier = funnel.groupby('tier').agg(
            clusters=('cluster', 'count'),
            mkt_impressions=('mkt_impressions', 'sum'),
            our_impressions=('our_impressions', 'sum'),
            mkt_clicks=('mkt_clicks', 'sum'),
            our_clicks=('our_clicks', 'sum'),
            mkt_cart_adds=('mkt_cart_adds', 'sum'),
            our_cart_adds=('our_cart_adds', 'sum'),
            mkt_purchases=('mkt_purchases', 'sum'),
            our_purchases=('our_purchases', 'sum'),
            image_price_leaks=('image_price_leak', 'sum'),
            cart_leaks=('cart_leak', 'sum'),
            content_leaks=('content_leak', 'sum'),
        ).reset_index()
        for prefix in ['imp_to_click', 'click_to_cart', 'cart_to_buy']:
            funnel_tier[f'{prefix}_market'] = 0.0
            funnel_tier[f'{prefix}_us'] = 0.0
        funnel_tier['imp_to_click_market'] = funnel_tier.apply(lambda row: rate(row['mkt_clicks'], row['mkt_impressions']), axis=1)
        funnel_tier['imp_to_click_us'] = funnel_tier.apply(lambda row: rate(row['our_clicks'], row['our_impressions']), axis=1)
        funnel_tier['click_to_cart_market'] = funnel_tier.apply(lambda row: rate(row['mkt_cart_adds'], row['mkt_clicks']), axis=1)
        funnel_tier['click_to_cart_us'] = funnel_tier.apply(lambda row: rate(row['our_cart_adds'], row['our_clicks']), axis=1)
        funnel_tier['cart_to_buy_market'] = funnel_tier.apply(lambda row: rate(row['mkt_purchases'], row['mkt_cart_adds']), axis=1)
        funnel_tier['cart_to_buy_us'] = funnel_tier.apply(lambda row: rate(row['our_purchases'], row['our_cart_adds']), axis=1)
        outputs['funnel_tiers'] = clean(funnel_tier.to_dict(orient='records'))

        if has_ba_raw:
            try:
                prices = con.execute("""
                    SELECT
                        search_query_data_search_query AS search_query,
                        AVG(CASE
                            WHEN TRY_CAST(click_data_total_click_count AS INTEGER) >= 5
                             AND TRY_CAST(click_data_total_median_click_price AS DOUBLE) BETWEEN 1 AND 500
                            THEN TRY_CAST(click_data_total_median_click_price AS DOUBLE)
                        END) AS mkt_price,
                        AVG(CASE
                            WHEN TRY_CAST(click_data_asin_click_count AS INTEGER) >= 5
                             AND TRY_CAST(click_data_asin_median_click_price AS DOUBLE) BETWEEN 1 AND 500
                            THEN TRY_CAST(click_data_asin_median_click_price AS DOUBLE)
                        END) AS our_price
                    FROM ba_search_query_performance_weekly
                    WHERE click_data_total_median_click_price IS NOT NULL
                    GROUP BY 1
                """).df()
                search = con.execute("""
                    SELECT
                        search_query,
                        COALESCE(keyword_cluster, 'ASIN/Other') AS cluster,
                        SUM(search_query_volume) AS search_volume,
                        AVG(purchase_share) AS purchase_share
                    FROM ba_search_query_performance_weekly_cleaned
                    GROUP BY 1, 2
                """).df() if has_ba_clean else pd.DataFrame()
                if not prices.empty and not search.empty:
                    bench = pd.merge(search, prices, on='search_query', how='left')
                    bench = bench.groupby('cluster').agg(
                        search_volume=('search_volume', 'sum'),
                        purchase_share=('purchase_share', 'mean'),
                        mkt_price=('mkt_price', 'mean'),
                        our_price=('our_price', 'mean'),
                    ).reset_index().dropna(subset=['mkt_price', 'our_price'])
                    bench['price_delta'] = bench['our_price'] - bench['mkt_price']
                    outputs['price_benchmark'] = clean(bench.sort_values('search_volume', ascending=False).head(20).to_dict(orient='records'))
            except Exception as e:
                outputs['price_benchmark_error'] = str(e)
        return outputs
    finally:
        con.close()

try:
    df = db.get_ads()
    if df is not None and not df.empty:
        for col in df.select_dtypes(include=['datetime64']).columns:
            df[col] = df[col].astype(str)
        if 'date' in df.columns:
            df['date'] = df['date'].astype(str)
        result['ads'] = clean(df.to_dict(orient='records'))
    else:
        result['ads'] = []
except Exception as e:
    result['ads_error'] = str(e)
    result['ads'] = []

try:
    df = db.get_cleaned_search_query()
    if df is not None and not df.empty:
        for col in df.select_dtypes(include=['datetime64']).columns:
            df[col] = df[col].astype(str)
        result['search_terms'] = clean(df.to_dict(orient='records'))
    else:
        result['search_terms'] = []
except Exception as e:
    result['search_terms_error'] = str(e)
    result['search_terms'] = []

try:
    df = db.get_ads_by_type()
    if df is not None and not df.empty:
        for col in df.select_dtypes(include=['datetime64']).columns:
            df[col] = df[col].astype(str)
        if 'date' in df.columns:
            df['date'] = df['date'].astype(str)
        result['ads_by_type'] = clean(df.to_dict(orient='records'))
    else:
        result['ads_by_type'] = []
except Exception as e:
    result['ads_by_type_error'] = str(e)
    result['ads_by_type'] = []

try:
    ads = pd.DataFrame(result.get('ads') or [])
    search_terms = pd.DataFrame(result.get('search_terms') or [])

    insights = {
        'summary': {},
        'campaign_actions': [],
        'tier_performance': [],
        'winning_terms': [],
        'wasted_terms': [],
        'cluster_opportunities': [],
        'streamlit_parity': {
            'war_room': {},
            'cluster_scenarios': [],
            'scenario_groups': [],
            'tier_summary': [],
            'funnel_tiers': [],
            'funnel_clusters': [],
            'price_benchmark': [],
        },
    }

    if not ads.empty:
        for col in ['spend', 'sales_1d', 'purchases_1d', 'impressions', 'clicks']:
            if col in ads.columns:
                ads[col] = pd.to_numeric(ads[col], errors='coerce').fillna(0)

        campaign = ads.groupby('campaign_name', dropna=False).agg(
            spend=('spend', 'sum'),
            sales=('sales_1d', 'sum'),
            purchases=('purchases_1d', 'sum'),
            impressions=('impressions', 'sum'),
            clicks=('clicks', 'sum'),
        ).reset_index()
        campaign['campaign_name'] = campaign['campaign_name'].fillna('Unknown')
        campaign['roas'] = campaign.apply(lambda r: r['sales'] / r['spend'] if r['spend'] > 0 else 0, axis=1)
        campaign['acos'] = campaign.apply(lambda r: r['spend'] / r['sales'] * 100 if r['sales'] > 0 else None, axis=1)
        campaign['ctr'] = campaign.apply(lambda r: r['clicks'] / r['impressions'] * 100 if r['impressions'] > 0 else 0, axis=1)
        campaign['cvr'] = campaign.apply(lambda r: r['purchases'] / r['clicks'] * 100 if r['clicks'] > 0 else 0, axis=1)

        total_spend = float(campaign['spend'].sum())
        total_sales = float(campaign['sales'].sum())
        insights['summary'].update({
            'campaign_count': int(len(campaign)),
            'total_spend': total_spend,
            'total_sales': total_sales,
            'overall_roas': total_sales / total_spend if total_spend > 0 else 0,
            'overall_acos': total_spend / total_sales * 100 if total_sales > 0 else None,
        })

        campaign['action'] = 'monitor'
        campaign['reason'] = 'Stable campaign; monitor performance before changing budget.'
        campaign.loc[(campaign['roas'] >= 4) & (campaign['acos'].fillna(999) <= 25) & (campaign['purchases'] >= 2), 'action'] = 'scale'
        campaign.loc[campaign['action'] == 'scale', 'reason'] = 'Efficient spend with strong ROAS and acceptable ACOS.'
        campaign.loc[((campaign['acos'].fillna(0) > 40) & (campaign['spend'] >= 20)) | ((campaign['spend'] >= 20) & (campaign['sales'] <= 0)), 'action'] = 'reduce'
        campaign.loc[campaign['action'] == 'reduce', 'reason'] = 'High spend with weak sales efficiency.'

        action_order = {'scale': 0, 'reduce': 1, 'monitor': 2}
        campaign['action_order'] = campaign['action'].map(action_order).fillna(9)
        actions = campaign.sort_values(['action_order', 'spend'], ascending=[True, False]).head(12)
        insights['campaign_actions'] = clean(actions[[
            'campaign_name', 'action', 'reason', 'spend', 'sales', 'purchases', 'roas', 'acos', 'ctr', 'cvr'
        ]].to_dict(orient='records'))

    if not search_terms.empty:
        for col in ['impression_total', 'click_total', 'purchase_total', 'cart_add_total', 'click_rate', 'purchase_share']:
            if col in search_terms.columns:
                search_terms[col] = pd.to_numeric(search_terms[col], errors='coerce').fillna(0)
        for col in ['tier', 'search_query', 'shade_cluster', 'keyword_cluster', 'period_start']:
            if col not in search_terms.columns:
                search_terms[col] = ''

        latest_period = search_terms['period_start'].dropna().max()
        current = search_terms[search_terms['period_start'] == latest_period].copy() if latest_period else search_terms.copy()

        term = current.groupby(['search_query', 'tier'], dropna=False).agg(
            impressions=('impression_total', 'sum'),
            clicks=('click_total', 'sum'),
            purchases=('purchase_total', 'sum'),
            cart_adds=('cart_add_total', 'sum'),
            purchase_share=('purchase_share', 'mean'),
        ).reset_index()
        term['ctr'] = term.apply(lambda r: r['clicks'] / r['impressions'] * 100 if r['impressions'] > 0 else 0, axis=1)
        term['conversion_rate'] = term.apply(lambda r: r['purchases'] / r['clicks'] * 100 if r['clicks'] > 0 else 0, axis=1)

        insights['summary']['latest_search_period'] = str(latest_period) if latest_period else None
        insights['summary']['search_terms_in_period'] = int(len(term))

        tier = term.groupby('tier', dropna=False).agg(
            queries=('search_query', 'count'),
            impressions=('impressions', 'sum'),
            clicks=('clicks', 'sum'),
            purchases=('purchases', 'sum'),
        ).reset_index()
        tier['ctr'] = tier.apply(lambda r: r['clicks'] / r['impressions'] * 100 if r['impressions'] > 0 else 0, axis=1)
        tier['conversion_rate'] = tier.apply(lambda r: r['purchases'] / r['clicks'] * 100 if r['clicks'] > 0 else 0, axis=1)
        insights['tier_performance'] = clean(tier.sort_values('purchases', ascending=False).to_dict(orient='records'))

        winners = term[
            (term['purchases'] > 0) |
            ((term['cart_adds'] > 0) & (term['ctr'] >= 1))
        ].sort_values(['purchases', 'conversion_rate', 'clicks'], ascending=False).head(12)
        insights['winning_terms'] = clean(winners.to_dict(orient='records'))

        wasted = term[
            (term['clicks'] >= 3) &
            (term['purchases'] <= 0) &
            (term['cart_adds'] <= 0)
        ].sort_values(['clicks', 'impressions'], ascending=False).head(12)
        insights['wasted_terms'] = clean(wasted.to_dict(orient='records'))

        cluster_cols = [c for c in ['shade_cluster', 'keyword_cluster', 'tier'] if c in current.columns]
        if cluster_cols:
            cluster = current.groupby(cluster_cols, dropna=False).agg(
                queries=('search_query', 'nunique'),
                impressions=('impression_total', 'sum'),
                clicks=('click_total', 'sum'),
                purchases=('purchase_total', 'sum'),
                cart_adds=('cart_add_total', 'sum'),
            ).reset_index()
            cluster['ctr'] = cluster.apply(lambda r: r['clicks'] / r['impressions'] * 100 if r['impressions'] > 0 else 0, axis=1)
            cluster['conversion_rate'] = cluster.apply(lambda r: r['purchases'] / r['clicks'] * 100 if r['clicks'] > 0 else 0, axis=1)
            cluster = cluster.sort_values(['purchases', 'cart_adds', 'impressions'], ascending=False).head(12)
            insights['cluster_opportunities'] = clean(cluster.to_dict(orient='records'))

    insights['streamlit_parity'] = clean(campaign_streamlit_parity())
    result['insights'] = clean(insights)
except Exception as e:
    result['insights_error'] = str(e)
    result['insights'] = {
        'summary': {},
        'campaign_actions': [],
        'tier_performance': [],
        'winning_terms': [],
        'wasted_terms': [],
        'cluster_opportunities': [],
        'streamlit_parity': {
            'war_room': {},
            'cluster_scenarios': [],
            'scenario_groups': [],
            'tier_summary': [],
            'funnel_tiers': [],
            'funnel_clusters': [],
            'price_benchmark': [],
        },
    }

print(json.dumps(result))
