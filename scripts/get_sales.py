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
    df = db.get_sales_traffic()
    if df is not None and not df.empty:
        for col in df.select_dtypes(include=['datetime64']).columns:
            df[col] = df[col].astype(str)
        if 'date' in df.columns:
            df['date'] = df['date'].astype(str)
        result['sales'] = clean(df.to_dict(orient='records'))
    else:
        result['sales'] = []
except Exception as e:
    result['sales_error'] = str(e)
    result['sales'] = []

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
    sales = pd.DataFrame(result.get('sales') or [])
    ads = pd.DataFrame(result.get('ads') or [])
    bsr = pd.DataFrame(result.get('bsr') or [])

    insights = {
        'summary': {},
        'signals': [],
        'weekly_trend': [],
        'sku_movers': [],
        'ad_dependency': [],
        'bsr_movers': [],
        'diagnostics': [],
    }

    if not sales.empty:
        for col in ['revenue', 'orders', 'units']:
            if col in sales.columns:
                sales[col] = pd.to_numeric(sales[col], errors='coerce').fillna(0)
        sales['date'] = pd.to_datetime(sales['date'], errors='coerce')
        sales = sales[sales['date'].notna()].copy()
        sales['week'] = sales['date'].dt.to_period('W').apply(lambda r: str(r.start_time.date()))
        if 'sku' not in sales.columns and 'sku_name' in sales.columns:
            sales['sku'] = sales['sku_name']
        sales['sku'] = sales['sku'].fillna('Unknown')

        weekly = sales.groupby('week').agg(
            revenue=('revenue', 'sum'),
            orders=('orders', 'sum'),
            units=('units', 'sum'),
        ).reset_index().sort_values('week')
        weekly['aov'] = weekly.apply(lambda r: r['revenue'] / r['orders'] if r['orders'] > 0 else 0, axis=1)
        weekly['asp'] = weekly.apply(lambda r: r['revenue'] / r['units'] if r['units'] > 0 else 0, axis=1)
        weekly['revenue_wow_pct'] = weekly['revenue'].pct_change().replace([float('inf'), -float('inf')], float('nan')) * 100
        weekly['units_wow_pct'] = weekly['units'].pct_change().replace([float('inf'), -float('inf')], float('nan')) * 100

        if not ads.empty:
            for col in ['spend', 'sales_1d', 'purchases_1d', 'impressions', 'clicks']:
                if col in ads.columns:
                    ads[col] = pd.to_numeric(ads[col], errors='coerce').fillna(0)
            ads['date'] = pd.to_datetime(ads['date'], errors='coerce')
            ads = ads[ads['date'].notna()].copy()
            ads['week'] = ads['date'].dt.to_period('W').apply(lambda r: str(r.start_time.date()))
            ad_weekly = ads.groupby('week').agg(
                ad_spend=('spend', 'sum'),
                ad_sales=('sales_1d', 'sum'),
                ad_orders=('purchases_1d', 'sum'),
                impressions=('impressions', 'sum'),
                clicks=('clicks', 'sum'),
            ).reset_index()
            weekly = weekly.merge(ad_weekly, on='week', how='left')
        else:
            for col in ['ad_spend', 'ad_sales', 'ad_orders', 'impressions', 'clicks']:
                weekly[col] = 0

        for col in ['ad_spend', 'ad_sales', 'ad_orders', 'impressions', 'clicks']:
            if col in weekly.columns:
                weekly[col] = weekly[col].fillna(0)
        weekly['acos'] = weekly.apply(lambda r: r['ad_spend'] / r['ad_sales'] * 100 if r['ad_sales'] > 0 else None, axis=1)
        weekly['roas'] = weekly.apply(lambda r: r['ad_sales'] / r['ad_spend'] if r['ad_spend'] > 0 else None, axis=1)
        weekly['ad_sales_share_pct'] = weekly.apply(lambda r: r['ad_sales'] / r['revenue'] * 100 if r['revenue'] > 0 else 0, axis=1)
        weekly['ctr'] = weekly.apply(lambda r: r['clicks'] / r['impressions'] * 100 if r['impressions'] > 0 else 0, axis=1)

        latest = weekly.iloc[-1].to_dict() if not weekly.empty else {}
        previous = weekly.iloc[-2].to_dict() if len(weekly) > 1 else {}
        last4 = weekly.tail(4)
        prior4 = weekly.iloc[-8:-4] if len(weekly) >= 8 else pd.DataFrame()

        insights['weekly_trend'] = clean(weekly.replace({float('nan'): None}).to_dict(orient='records'))
        insights['summary'] = {
            'latest_week': latest.get('week'),
            'latest_revenue': latest.get('revenue'),
            'latest_units': latest.get('units'),
            'latest_orders': latest.get('orders'),
            'latest_revenue_wow_pct': latest.get('revenue_wow_pct'),
            'latest_units_wow_pct': latest.get('units_wow_pct'),
            'latest_acos': latest.get('acos'),
            'latest_roas': latest.get('roas'),
            'latest_ad_sales_share_pct': latest.get('ad_sales_share_pct'),
            'last4_revenue': float(last4['revenue'].sum()) if not last4.empty else 0,
            'prior4_revenue': float(prior4['revenue'].sum()) if not prior4.empty else 0,
        }

        signals = []
        revenue_wow = latest.get('revenue_wow_pct')
        units_wow = latest.get('units_wow_pct')
        latest_acos = latest.get('acos')
        ad_share = latest.get('ad_sales_share_pct')
        if pd.notna(revenue_wow):
            if revenue_wow < -20:
                signals.append({
                    'severity': 'alert',
                    'title': 'Revenue dropped sharply week over week',
                    'detail': f"Latest weekly revenue changed {revenue_wow:.1f}% versus the previous week.",
                })
            elif revenue_wow > 20:
                signals.append({
                    'severity': 'normal',
                    'title': 'Revenue accelerated this week',
                    'detail': f"Latest weekly revenue increased {revenue_wow:.1f}% versus the previous week.",
                })
        if pd.notna(units_wow) and units_wow < -20:
            signals.append({
                'severity': 'warn',
                'title': 'Unit volume is down',
                'detail': f"Units changed {units_wow:.1f}% week over week.",
            })
        if latest_acos is not None and pd.notna(latest_acos) and latest_acos > 40:
            signals.append({
                'severity': 'alert',
                'title': 'ACOS is pressuring sales efficiency',
                'detail': f"Latest weekly ACOS is {latest_acos:.1f}%.",
            })
        elif latest_acos is not None and pd.notna(latest_acos) and latest_acos > 25:
            signals.append({
                'severity': 'warn',
                'title': 'ACOS is elevated',
                'detail': f"Latest weekly ACOS is {latest_acos:.1f}%.",
            })
        if ad_share > 70:
            signals.append({
                'severity': 'warn',
                'title': 'High dependence on ad-attributed sales',
                'detail': f"Ad-attributed sales are {ad_share:.1f}% of latest weekly revenue.",
            })
        insights['signals'] = signals

        sku_weekly = sales.groupby(['sku', 'week']).agg(
            revenue=('revenue', 'sum'),
            units=('units', 'sum'),
            orders=('orders', 'sum'),
        ).reset_index().sort_values(['sku', 'week'])
        latest_week = weekly['week'].max() if not weekly.empty else None
        previous_week = weekly.iloc[-2]['week'] if len(weekly) > 1 else None
        movers = []
        if latest_week and previous_week:
            latest_sku = sku_weekly[sku_weekly['week'] == latest_week].set_index('sku')
            prev_sku = sku_weekly[sku_weekly['week'] == previous_week].set_index('sku')
            for sku in sorted(set(latest_sku.index) | set(prev_sku.index)):
                cur = latest_sku.loc[sku] if sku in latest_sku.index else None
                prev = prev_sku.loc[sku] if sku in prev_sku.index else None
                cur_rev = float(cur['revenue']) if cur is not None else 0
                prev_rev = float(prev['revenue']) if prev is not None else 0
                delta = cur_rev - prev_rev
                pct = delta / prev_rev * 100 if prev_rev > 0 else None
                cur_units = float(cur['units']) if cur is not None else 0
                prev_units = float(prev['units']) if prev is not None else 0
                movers.append({
                    'sku': sku,
                    'latest_week': latest_week,
                    'previous_week': previous_week,
                    'revenue': cur_rev,
                    'previous_revenue': prev_rev,
                    'revenue_delta': delta,
                    'revenue_delta_pct': pct,
                    'units': cur_units,
                    'previous_units': prev_units,
                    'units_delta': cur_units - prev_units,
                    'status': 'up' if delta > 0 else 'down' if delta < 0 else 'flat',
                })
        insights['sku_movers'] = clean(sorted(movers, key=lambda r: abs(r['revenue_delta']), reverse=True))

        ad_dep = []
        if not ads.empty:
            # Campaign data is not reliably SKU-tagged, so this is overall dependency plus total SKU revenue contribution.
            sku_totals = sales.groupby('sku').agg(
                revenue=('revenue', 'sum'),
                units=('units', 'sum'),
            ).reset_index()
            total_rev = float(sku_totals['revenue'].sum())
            for _, row in sku_totals.sort_values('revenue', ascending=False).iterrows():
                ad_dep.append({
                    'sku': row['sku'],
                    'revenue': float(row['revenue']),
                    'units': float(row['units']),
                    'revenue_share_pct': float(row['revenue'] / total_rev * 100) if total_rev > 0 else 0,
                })
        insights['ad_dependency'] = clean(ad_dep)

        diagnostics = []
        if latest and previous:
            for key, label, direction in [
                ('revenue', 'Revenue', 'higher'),
                ('units', 'Units', 'higher'),
                ('orders', 'Orders', 'higher'),
                ('ad_spend', 'Ad spend', 'lower'),
                ('ad_sales', 'Ad sales', 'higher'),
                ('clicks', 'Ad clicks', 'higher'),
                ('impressions', 'Ad impressions', 'higher'),
            ]:
                current = float(latest.get(key) or 0)
                prev = float(previous.get(key) or 0)
                delta = current - prev
                pct = delta / prev * 100 if prev > 0 else None
                diagnostics.append({
                    'metric': label,
                    'current': current,
                    'previous': prev,
                    'delta': delta,
                    'delta_pct': pct,
                    'direction': direction,
                })
        insights['diagnostics'] = clean(sorted(diagnostics, key=lambda r: abs(r['delta']), reverse=True))

    if not bsr.empty:
        if 'rank' in bsr.columns:
            bsr['rank'] = pd.to_numeric(bsr['rank'], errors='coerce')
        bsr['date'] = pd.to_datetime(bsr['date'], errors='coerce')
        bsr = bsr[bsr['date'].notna()].copy()
        bsr['week'] = bsr['date'].dt.to_period('W').apply(lambda r: str(r.start_time.date()))
        bsr['sku_name'] = bsr['sku_name'].fillna(bsr.get('asin', 'Unknown'))
        bsr_weekly = bsr.groupby(['sku_name', 'week']).agg(avg_rank=('rank', 'mean')).reset_index().sort_values(['sku_name', 'week'])
        bsr_movers = []
        for sku, rows in bsr_weekly.groupby('sku_name'):
            rows = rows.sort_values('week')
            if len(rows) < 2:
                continue
            latest = rows.iloc[-1]
            previous = rows.iloc[-2]
            delta = float(latest['avg_rank'] - previous['avg_rank'])
            # Lower rank is better, so a negative delta is improvement.
            bsr_movers.append({
                'sku': sku,
                'latest_week': latest['week'],
                'previous_week': previous['week'],
                'rank': round(float(latest['avg_rank']), 1),
                'previous_rank': round(float(previous['avg_rank']), 1),
                'rank_delta': round(delta, 1),
                'status': 'improved' if delta < 0 else 'worse' if delta > 0 else 'flat',
            })
        insights['bsr_movers'] = clean(sorted(bsr_movers, key=lambda r: abs(r['rank_delta']), reverse=True))

    result['insights'] = clean(insights)
except Exception as e:
    result['insights_error'] = str(e)
    result['insights'] = {
        'summary': {},
        'signals': [],
        'weekly_trend': [],
        'sku_movers': [],
        'ad_dependency': [],
        'bsr_movers': [],
        'diagnostics': [],
    }

print(json.dumps(result))
