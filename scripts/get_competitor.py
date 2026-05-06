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
    df = db.get_competitor()
    if df is not None and not df.empty:
        for col in df.select_dtypes(include=['datetime64']).columns:
            df[col] = df[col].astype(str)
        if 'date' in df.columns:
            df['date'] = df['date'].astype(str)
        result['competitor'] = clean(df.to_dict(orient='records'))
    else:
        result['competitor'] = []
except Exception as e:
    result['competitor_error'] = str(e)
    result['competitor'] = []

try:
    df = db.get_bsr()
    if df is not None and not df.empty:
        for col in df.select_dtypes(include=['datetime64']).columns:
            df[col] = df[col].astype(str)
        if 'date' in df.columns:
            df['date'] = df['date'].astype(str)
        result['bsr'] = clean(df.to_dict(orient='records'))
    else:
        result['bsr'] = []
except Exception as e:
    result['bsr_error'] = str(e)
    result['bsr'] = []

try:
    df = db.get_ba_item_comparison_weekly()
    if df is not None and not df.empty:
        for col in df.select_dtypes(include=['datetime64']).columns:
            df[col] = df[col].astype(str)
        result['item_comparison'] = clean(df.to_dict(orient='records'))
    else:
        result['item_comparison'] = []
except Exception as e:
    result['item_comparison_error'] = str(e)
    result['item_comparison'] = []

try:
    df = db.get_ba_alternate_purchase_weekly()
    if df is not None and not df.empty:
        for col in df.select_dtypes(include=['datetime64']).columns:
            df[col] = df[col].astype(str)
        result['alt_purchase'] = clean(df.to_dict(orient='records'))
    else:
        result['alt_purchase'] = []
except Exception as e:
    result['alt_purchase_error'] = str(e)
    result['alt_purchase'] = []

try:
    df = db.get_competitor_reviews()
    if df is not None and not df.empty:
        for col in df.select_dtypes(include=['datetime64']).columns:
            df[col] = df[col].astype(str)
        result['competitor_reviews'] = clean(df.to_dict(orient='records'))
    else:
        result['competitor_reviews'] = []
except Exception as e:
    result['competitor_reviews_error'] = str(e)
    result['competitor_reviews'] = []

try:
    competitor = pd.DataFrame(result.get('competitor') or [])
    bsr = pd.DataFrame(result.get('bsr') or [])
    reviews = pd.DataFrame(result.get('competitor_reviews') or [])

    insights = {
        'summary': {},
        'signals': [],
        'rank_gap': [],
        'price_positioning': [],
        'competitor_threats': [],
        'biohuez_bsr_movers': [],
        'review_positioning': [],
    }

    latest_comp = pd.DataFrame()
    if not competitor.empty:
        competitor['captured_date'] = pd.to_datetime(competitor['captured_date'], errors='coerce')
        competitor = competitor[competitor['captured_date'].notna()].copy()
        for col in ['price', 'rating', 'review_count', 'bsr']:
            if col in competitor.columns:
                competitor[col] = pd.to_numeric(competitor[col], errors='coerce')
        if not competitor.empty:
            latest_date = competitor['captured_date'].max()
            latest_comp = competitor[competitor['captured_date'] == latest_date].copy()
            latest_comp['label'] = latest_comp['asin']
            latest_comp['rank_score'] = latest_comp['bsr'].rank(method='dense')
            insights['summary'].update({
                'latest_competitor_date': str(latest_date.date()),
                'competitor_count': int(latest_comp['asin'].nunique()),
                'best_competitor_bsr': int(latest_comp['bsr'].min()) if latest_comp['bsr'].notna().any() else None,
                'avg_competitor_price': round(float(latest_comp['price'].mean()), 2) if latest_comp['price'].notna().any() else None,
            })
            threats = latest_comp.sort_values('bsr').head(10).copy()
            insights['competitor_threats'] = clean(threats[[
                'asin', 'name', 'price', 'rating', 'review_count', 'bsr', 'bsr_category'
            ]].to_dict(orient='records'))

            price_rows = latest_comp.copy()
            avg_price = float(price_rows['price'].mean()) if price_rows['price'].notna().any() else 0
            price_rows['price_gap_vs_comp_avg'] = price_rows['price'] - avg_price
            insights['price_positioning'] = clean(price_rows.sort_values('price').head(12)[[
                'asin', 'name', 'price', 'price_gap_vs_comp_avg', 'bsr'
            ]].to_dict(orient='records'))

    latest_own = pd.DataFrame()
    if not bsr.empty:
        bsr['date'] = pd.to_datetime(bsr['date'], errors='coerce')
        bsr = bsr[bsr['date'].notna()].copy()
        bsr['rank'] = pd.to_numeric(bsr['rank'], errors='coerce')
        if not bsr.empty:
            latest_bsr_date = bsr['date'].max()
            latest_own = bsr[bsr['date'] == latest_bsr_date].copy()
            insights['summary'].update({
                'latest_biohuez_bsr_date': str(latest_bsr_date.date()),
                'best_biohuez_bsr': int(latest_own['rank'].min()) if latest_own['rank'].notna().any() else None,
                'avg_biohuez_bsr': round(float(latest_own['rank'].mean()), 1) if latest_own['rank'].notna().any() else None,
            })

            bsr['week'] = bsr['date'].dt.to_period('W').apply(lambda r: str(r.start_time.date()))
            weekly = bsr.groupby(['sku_name', 'week']).agg(avg_rank=('rank', 'mean')).reset_index().sort_values(['sku_name', 'week'])
            movers = []
            for sku, rows in weekly.groupby('sku_name'):
                rows = rows.sort_values('week')
                if len(rows) < 2:
                    continue
                latest = rows.iloc[-1]
                previous = rows.iloc[-2]
                delta = float(latest['avg_rank'] - previous['avg_rank'])
                movers.append({
                    'sku': sku,
                    'latest_week': latest['week'],
                    'previous_week': previous['week'],
                    'rank': round(float(latest['avg_rank']), 1),
                    'previous_rank': round(float(previous['avg_rank']), 1),
                    'rank_delta': round(delta, 1),
                    'status': 'improved' if delta < 0 else 'worse' if delta > 0 else 'flat',
                })
            insights['biohuez_bsr_movers'] = clean(sorted(movers, key=lambda r: abs(r['rank_delta']), reverse=True))

    if not latest_comp.empty and not latest_own.empty:
        best_comp = float(latest_comp['bsr'].min()) if latest_comp['bsr'].notna().any() else None
        best_own = float(latest_own['rank'].min()) if latest_own['rank'].notna().any() else None
        avg_comp_price = float(latest_comp['price'].mean()) if latest_comp['price'].notna().any() else None
        if best_comp is not None and best_own is not None:
            gap = best_own - best_comp
            insights['summary']['best_rank_gap_vs_competitor'] = round(gap, 1)
            if gap > 100:
                insights['signals'].append({
                    'severity': 'alert',
                    'title': 'Competitors are materially outranking BioHuez',
                    'detail': f"Best competitor BSR is #{int(best_comp)} versus BioHuez best at #{int(best_own)}.",
                })
            elif gap > 25:
                insights['signals'].append({
                    'severity': 'warn',
                    'title': 'Competitors have a BSR advantage',
                    'detail': f"Best competitor BSR leads BioHuez by {gap:.0f} rank positions.",
                })
            else:
                insights['signals'].append({
                    'severity': 'normal',
                    'title': 'BioHuez is close to the best competitor rank',
                    'detail': f"Best-rank gap is {gap:.0f} positions.",
                })

            rank_rows = []
            for _, row in latest_own.iterrows():
                rank_rows.append({
                    'type': 'BioHuez',
                    'label': row.get('sku_name') or row.get('asin'),
                    'asin': row.get('asin'),
                    'rank': float(row.get('rank') or 0),
                    'price': None,
                    'gap_vs_best_competitor': float(row.get('rank') or 0) - best_comp,
                })
            for _, row in latest_comp.iterrows():
                rank_rows.append({
                    'type': 'Competitor',
                    'label': row.get('asin'),
                    'asin': row.get('asin'),
                    'rank': float(row.get('bsr') or 0),
                    'price': float(row.get('price')) if pd.notna(row.get('price')) else None,
                    'gap_vs_best_competitor': float(row.get('bsr') or 0) - best_comp,
                })
            insights['rank_gap'] = clean(sorted(rank_rows, key=lambda r: r['rank']))

        if avg_comp_price is not None:
            insights['summary']['avg_competitor_price'] = round(avg_comp_price, 2)
            low_price = latest_comp['price'].min()
            high_price = latest_comp['price'].max()
            if pd.notna(low_price) and pd.notna(high_price):
                insights['signals'].append({
                    'severity': 'normal',
                    'title': 'Competitor price band detected',
                    'detail': f"Latest competitor prices range from ${low_price:.2f} to ${high_price:.2f}.",
                })

    if not reviews.empty:
        reviews['captured_date'] = pd.to_datetime(reviews['captured_date'], errors='coerce')
        reviews = reviews[reviews['captured_date'].notna()].copy()
        for col in ['rating', 'review_count', 'price']:
            if col in reviews.columns:
                reviews[col] = pd.to_numeric(reviews[col], errors='coerce')
        latest_review_date = reviews['captured_date'].max() if not reviews.empty else None
        if latest_review_date is not None:
            latest_reviews = reviews[reviews['captured_date'] == latest_review_date].copy()
            insights['review_positioning'] = clean(latest_reviews.sort_values('review_count', ascending=False)[[
                'asin', 'asin_type', 'name', 'rating', 'review_count', 'price'
            ]].to_dict(orient='records'))

    result['insights'] = clean(insights)
except Exception as e:
    result['insights_error'] = str(e)
    result['insights'] = {
        'summary': {},
        'signals': [],
        'rank_gap': [],
        'price_positioning': [],
        'competitor_threats': [],
        'biohuez_bsr_movers': [],
        'review_positioning': [],
    }

print(json.dumps(result))
