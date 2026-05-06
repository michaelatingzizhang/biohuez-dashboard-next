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
    }

print(json.dumps(result))
