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
    df = db.get_ba_repeat_purchase_weekly()
    if df is not None and not df.empty:
        for col in df.select_dtypes(include=['datetime64']).columns:
            df[col] = df[col].astype(str)
        result['repeat_weekly'] = clean(df.to_dict(orient='records'))
    else:
        result['repeat_weekly'] = []
except Exception as e:
    result['repeat_weekly_error'] = str(e)
    result['repeat_weekly'] = []

try:
    df = db.get_ba_repeat_purchase_monthly()
    if df is not None and not df.empty:
        for col in df.select_dtypes(include=['datetime64']).columns:
            df[col] = df[col].astype(str)
        result['repeat_monthly'] = clean(df.to_dict(orient='records'))
    else:
        result['repeat_monthly'] = []
except Exception as e:
    result['repeat_monthly_error'] = str(e)
    result['repeat_monthly'] = []

try:
    df = db.get_demographics_weekly()
    if df is not None and not df.empty:
        for col in df.select_dtypes(include=['datetime64']).columns:
            df[col] = df[col].astype(str)
        result['demographics_weekly'] = clean(df.to_dict(orient='records'))
    else:
        result['demographics_weekly'] = []
except Exception as e:
    result['demographics_weekly_error'] = str(e)
    result['demographics_weekly'] = []

try:
    df = db.get_demographics_monthly()
    if df is not None and not df.empty:
        for col in df.select_dtypes(include=['datetime64']).columns:
            df[col] = df[col].astype(str)
        result['demographics_monthly'] = clean(df.to_dict(orient='records'))
    else:
        result['demographics_monthly'] = []
except Exception as e:
    result['demographics_monthly_error'] = str(e)
    result['demographics_monthly'] = []

def pct_value(value):
    try:
        n = float(value)
    except Exception:
        return 0
    return n * 100 if 0 <= n <= 1 else n

def safe_num(value):
    try:
        if value is None or pd.isna(value):
            return 0.0
        return float(value)
    except Exception:
        return 0.0

def date_label(value, granularity):
    try:
        dt = pd.to_datetime(value)
    except Exception:
        return str(value)[:10]
    if granularity == 'monthly':
        return dt.strftime('%b %Y')
    return dt.strftime('%b %d, %Y')

def segment_pct(frame, category, segment):
    rows = frame[(frame['category_type'] == category) & (frame['segment_name'] == segment)]
    if rows.empty:
        return 0.0
    return float(rows['customer_pct'].mean())

def combined_pct(frame, category, segments):
    rows = frame[(frame['category_type'] == category) & (frame['segment_name'].isin(segments))]
    if rows.empty:
        return 0.0
    return float(rows['customer_pct'].sum())

def weighted_segment_pct(frame, category, segment):
    rows = frame[(frame['category_type'] == category) & (frame['segment_name'] == segment)].copy()
    if rows.empty:
        return 0.0
    weights = pd.to_numeric(rows.get('total_customers', 0), errors='coerce').fillna(0)
    if weights.sum() <= 0:
        return float(rows['customer_pct'].mean())
    return float((rows['customer_pct'] * weights).sum() / weights.sum())

def weighted_combined_pct(frame, category, segments):
    values = []
    weights = []
    for _, group in frame[frame['category_type'] == category].groupby('date'):
        subset = group[group['segment_name'].isin(segments)]
        if subset.empty:
            continue
        values.append(float(subset['customer_pct'].sum()))
        weights.append(float(pd.to_numeric(group.get('total_customers', 0), errors='coerce').max()))
    if not values:
        return 0.0
    if sum(weights) <= 0:
        return float(sum(values) / len(values))
    return float(sum(value * weight for value, weight in zip(values, weights)) / sum(weights))

def profile_kpis(frame, label):
    return {
        'label': label,
        'female': segment_pct(frame, 'gender', 'Female'),
        'age_35_44': segment_pct(frame, 'age_group', '35-44'),
        'core_age_45_plus': combined_pct(frame, 'age_group', ['45-54', '55-64', '65+']),
        'income_100_125': segment_pct(frame, 'household_income', '$100k+'),
        'income_125_150': segment_pct(frame, 'household_income', '$125k+'),
        'core_income_150_plus': combined_pct(frame, 'household_income', ['$150k+', '$175k+', '$200k+', '$250k+']),
    }

def alltime_profile_kpis(frame, label):
    return {
        'label': label,
        'female': weighted_segment_pct(frame, 'gender', 'Female'),
        'age_35_44': weighted_segment_pct(frame, 'age_group', '35-44'),
        'core_age_45_plus': weighted_combined_pct(frame, 'age_group', ['45-54', '55-64', '65+']),
        'income_100_125': weighted_segment_pct(frame, 'household_income', '$100k+'),
        'income_125_150': weighted_segment_pct(frame, 'household_income', '$125k+'),
        'core_income_150_plus': weighted_combined_pct(frame, 'household_income', ['$150k+', '$175k+', '$200k+', '$250k+']),
    }

def comparison_rows(frame, a_date, b_date):
    rows = []
    a = frame[frame['date'] == a_date].copy()
    b = frame[frame['date'] == b_date].copy()
    for category in ['age_group', 'gender', 'household_income', 'marital_status', 'education']:
        category_segments = sorted(set(a[a['category_type'] == category]['segment_name']) | set(b[b['category_type'] == category]['segment_name']))
        for segment in category_segments:
            a_rows = a[(a['category_type'] == category) & (a['segment_name'] == segment)]
            b_rows = b[(b['category_type'] == category) & (b['segment_name'] == segment)]
            a_pct = safe_num(a_rows['customer_pct'].mean()) if not a_rows.empty else 0.0
            b_pct = safe_num(b_rows['customer_pct'].mean()) if not b_rows.empty else 0.0
            a_customers = safe_num(a_rows['customer_count'].sum()) if not a_rows.empty else 0.0
            b_customers = safe_num(b_rows['customer_count'].sum()) if not b_rows.empty else 0.0
            rows.append({
                'category_type': category,
                'segment_name': segment,
                'period_a_pct': a_pct,
                'period_b_pct': b_pct,
                'delta_pct': b_pct - a_pct,
                'period_a_customers': a_customers,
                'period_b_customers': b_customers,
                'delta_customers': b_customers - a_customers,
            })
    return sorted(rows, key=lambda row: abs(row['delta_pct']), reverse=True)

def snapshot_rows(frame, selected_date):
    rows = frame[frame['date'] == selected_date].copy()
    if rows.empty:
        return []
    return rows.sort_values(['category_type', 'customer_pct'], ascending=[True, False]).to_dict(orient='records')

def trend_rows(frame, selected_dates):
    rows = frame[frame['date'].isin(selected_dates)].copy()
    if rows.empty:
        return []
    return rows.sort_values(['category_type', 'segment_name', 'date']).to_dict(orient='records')

def profile_for_frame(frame, granularity):
    if frame.empty:
        return {}
    dates = sorted(frame['date'].dropna().unique())
    labels = {value: date_label(value, granularity) for value in dates}
    latest_date = dates[-1]
    previous_date = dates[-2] if len(dates) >= 2 else dates[-1]
    trend_dates = dates[-min(3, len(dates)):]
    latest = frame[frame['date'] == latest_date].copy()
    latest_customers = safe_num(latest[latest['category_type'] == 'gender']['total_customers'].max()) if 'total_customers' in latest else 0.0
    previous = frame[frame['date'] == previous_date].copy()
    previous_customers = safe_num(previous[previous['category_type'] == 'gender']['total_customers'].max()) if 'total_customers' in previous else 0.0
    return {
        'available_periods': [{'date': value, 'label': labels[value]} for value in dates],
        'latest_date': latest_date,
        'latest_label': labels[latest_date],
        'previous_date': previous_date,
        'previous_label': labels[previous_date],
        'latest_customers': latest_customers,
        'previous_customers': previous_customers,
        'customer_delta': latest_customers - previous_customers,
        'customer_delta_pct': ((latest_customers - previous_customers) / previous_customers * 100) if previous_customers else None,
        'latest_kpis': profile_kpis(latest, labels[latest_date]),
        'alltime_kpis': alltime_profile_kpis(frame, f"{labels[dates[0]]} - {labels[dates[-1]]}"),
        'comparison': comparison_rows(frame, previous_date, latest_date),
        'snapshot': snapshot_rows(frame, latest_date),
        'trend': trend_rows(frame, trend_dates),
        'trend_periods': [{'date': value, 'label': labels[value]} for value in trend_dates],
    }

try:
    repeat_weekly = pd.DataFrame(result.get('repeat_weekly') or [])
    repeat_monthly = pd.DataFrame(result.get('repeat_monthly') or [])
    demo_weekly = pd.DataFrame(result.get('demographics_weekly') or [])
    demo_monthly = pd.DataFrame(result.get('demographics_monthly') or [])

    insights = {
        'summary': {},
        'signals': [],
        'repeat_trend': [],
        'asin_repeat_health': [],
        'segment_leaders': [],
        'segment_shifts': [],
        'demographic_mix': [],
        'profiles': {'monthly': {}, 'weekly': {}},
    }

    repeat_frames = []
    if not repeat_weekly.empty:
        rw = repeat_weekly.copy()
        rw['period'] = rw.get('period_start', rw.get('start_date', '')).astype(str)
        rw['granularity'] = 'weekly'
        rw['orders'] = pd.to_numeric(rw.get('orders', 0), errors='coerce').fillna(0)
        rw['unique_customers'] = pd.to_numeric(rw.get('unique_customers', 0), errors='coerce').fillna(0)
        rw['repeat_rate_pct'] = rw.get('repeat_customers_pct_total', 0).apply(pct_value)
        rw['repeat_revenue'] = pd.to_numeric(rw.get('repeat_purchase_revenue', 0), errors='coerce').fillna(0)
        repeat_frames.append(rw[['period', 'granularity', 'asin', 'orders', 'unique_customers', 'repeat_rate_pct', 'repeat_revenue']])

    if not repeat_monthly.empty:
        rm = repeat_monthly.copy()
        if 'period_start' in rm.columns and rm['period_start'].notna().any():
            rm['period'] = rm['period_start'].astype(str)
        else:
            rm['period'] = rm.get('date', '').astype(str)
        rm['granularity'] = 'monthly'
        rm['orders'] = pd.to_numeric(rm.get('orders', rm.get('sp_orders', 0)), errors='coerce').fillna(0)
        rm['unique_customers'] = pd.to_numeric(rm.get('unique_customers', 0), errors='coerce').fillna(0)
        rm['repeat_rate_pct'] = rm.get('repeat_customers_pct_total', rm.get('repeat_pct', 0)).apply(pct_value)
        rm['repeat_revenue'] = pd.to_numeric(rm.get('repeat_purchase_revenue', rm.get('repeat_revenue', 0)), errors='coerce').fillna(0)
        repeat_frames.append(rm[['period', 'granularity', 'asin', 'orders', 'unique_customers', 'repeat_rate_pct', 'repeat_revenue']])

    if repeat_frames:
        repeat = pd.concat(repeat_frames, ignore_index=True)
        repeat = repeat[repeat['period'].notna() & (repeat['period'] != '')].copy()
        repeat['period_short'] = repeat['period'].astype(str).str.slice(0, 10)
        weekly = repeat[repeat['granularity'] == 'weekly'].copy()
        if not weekly.empty:
            trend = weekly.groupby('period_short').agg(
                orders=('orders', 'sum'),
                unique_customers=('unique_customers', 'sum'),
                repeat_revenue=('repeat_revenue', 'sum'),
                repeat_rate_pct=('repeat_rate_pct', 'mean'),
            ).reset_index().sort_values('period_short')
            trend['repeat_rate_delta'] = trend['repeat_rate_pct'].diff()
            insights['repeat_trend'] = clean(trend.to_dict(orient='records'))
            latest = trend.iloc[-1].to_dict()
            previous = trend.iloc[-2].to_dict() if len(trend) > 1 else {}
            insights['summary'].update({
                'latest_period': latest.get('period_short'),
                'latest_repeat_rate_pct': latest.get('repeat_rate_pct'),
                'latest_unique_customers': latest.get('unique_customers'),
                'latest_orders': latest.get('orders'),
                'latest_repeat_revenue': latest.get('repeat_revenue'),
                'repeat_rate_delta': latest.get('repeat_rate_delta'),
            })
            if latest.get('repeat_rate_pct', 0) < 5:
                insights['signals'].append({
                    'severity': 'warn',
                    'title': 'Repeat purchase rate is low',
                    'detail': f"Latest weekly repeat rate is {latest.get('repeat_rate_pct', 0):.1f}%.",
                })
            if latest.get('repeat_rate_delta') is not None and pd.notna(latest.get('repeat_rate_delta')) and latest.get('repeat_rate_delta') < -2:
                insights['signals'].append({
                    'severity': 'warn',
                    'title': 'Repeat rate declined',
                    'detail': f"Repeat rate changed {latest.get('repeat_rate_delta'):.1f} points versus the prior week.",
                })
            if previous and latest.get('unique_customers', 0) < previous.get('unique_customers', 0) * 0.75:
                insights['signals'].append({
                    'severity': 'warn',
                    'title': 'Customer count dropped',
                    'detail': 'Latest weekly unique customers are down more than 25% versus the prior week.',
                })

        asin_health = repeat.groupby('asin').agg(
            periods=('period_short', 'nunique'),
            orders=('orders', 'sum'),
            unique_customers=('unique_customers', 'sum'),
            avg_repeat_rate_pct=('repeat_rate_pct', 'mean'),
            repeat_revenue=('repeat_revenue', 'sum'),
        ).reset_index().sort_values(['avg_repeat_rate_pct', 'repeat_revenue'], ascending=False)
        insights['asin_repeat_health'] = clean(asin_health.to_dict(orient='records'))

    demo_frames = []
    for granularity, frame in [('weekly', demo_weekly), ('monthly', demo_monthly)]:
        if frame.empty:
            continue
        df = frame.copy()
        df['granularity'] = granularity
        df['date'] = df.get('date', '').astype(str)
        df['category_type'] = df.get('category_type', '').astype(str)
        df['segment_name'] = df.get('segment_name', '').astype(str)
        df['customer_pct'] = pd.to_numeric(df.get('customer_pct', 0), errors='coerce').fillna(0)
        df['customer_count'] = pd.to_numeric(df.get('customer_count', 0), errors='coerce').fillna(0)
        df['units_ordered'] = pd.to_numeric(df.get('units_ordered', 0), errors='coerce').fillna(0)
        df['total_customers'] = pd.to_numeric(df.get('total_customers', 0), errors='coerce').fillna(0)
        demo_frames.append(df[['date', 'granularity', 'category_type', 'segment_name', 'customer_pct', 'customer_count', 'units_ordered', 'total_customers']])

    if demo_frames:
        demo = pd.concat(demo_frames, ignore_index=True)
        latest_date = demo['date'].dropna().max()
        latest_demo = demo[demo['date'] == latest_date].copy()
        leaders = latest_demo.sort_values(['category_type', 'customer_pct'], ascending=[True, False])
        leaders = leaders.groupby('category_type').head(3)
        insights['segment_leaders'] = clean(leaders.to_dict(orient='records'))
        insights['demographic_mix'] = clean(latest_demo.sort_values(['category_type', 'customer_pct'], ascending=[True, False]).to_dict(orient='records'))
        insights['summary']['latest_demographic_date'] = latest_date

        shifts = []
        for category, group in demo.groupby('category_type'):
            dates = sorted(group['date'].dropna().unique())
            if len(dates) < 2:
                continue
            latest_date = dates[-1]
            previous_date = dates[-2]
            latest_group = group[group['date'] == latest_date].set_index('segment_name')
            previous_group = group[group['date'] == previous_date].set_index('segment_name')
            for segment in sorted(set(latest_group.index) | set(previous_group.index)):
                latest_pct = float(latest_group.loc[segment, 'customer_pct']) if segment in latest_group.index else 0
                previous_pct = float(previous_group.loc[segment, 'customer_pct']) if segment in previous_group.index else 0
                delta = latest_pct - previous_pct
                if abs(delta) >= 1:
                    shifts.append({
                        'category_type': category,
                        'segment_name': segment,
                        'latest_date': latest_date,
                        'previous_date': previous_date,
                        'customer_pct': latest_pct,
                        'previous_customer_pct': previous_pct,
                        'delta_pct': delta,
                    })
        insights['segment_shifts'] = clean(sorted(shifts, key=lambda r: abs(r['delta_pct']), reverse=True)[:12])
        if shifts:
            top_shift = sorted(shifts, key=lambda r: abs(r['delta_pct']), reverse=True)[0]
            insights['signals'].append({
                'severity': 'normal',
                'title': 'Demographic mix shifted',
                'detail': f"{top_shift['segment_name']} changed {top_shift['delta_pct']:.1f} points in {top_shift['category_type']}.",
            })

        insights['profiles'] = {
            'monthly': clean(profile_for_frame(demo[demo['granularity'] == 'monthly'].copy(), 'monthly')),
            'weekly': clean(profile_for_frame(demo[demo['granularity'] == 'weekly'].copy(), 'weekly')),
        }

    result['insights'] = clean(insights)
except Exception as e:
    result['insights_error'] = str(e)
    result['insights'] = {
        'summary': {},
        'signals': [],
        'repeat_trend': [],
        'asin_repeat_health': [],
        'segment_leaders': [],
        'segment_shifts': [],
        'demographic_mix': [],
        'profiles': {'monthly': {}, 'weekly': {}},
    }

print(json.dumps(result))
