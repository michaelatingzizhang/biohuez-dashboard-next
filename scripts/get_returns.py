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

# SKU mapping from SKU code to name
SKU_MAP = {
    'ZH-FH-1B': 'Black',
    'ZH-FH-3C': 'Chocolate',
    'ZH-FH-5CL': 'Cream Latte',
    'ZH-FH-6R': 'Red',
}

result = {}

def reason_category(reason):
    text = str(reason or '').lower()
    if any(term in text for term in ['not_as_described', 'wrong', 'different']):
        return 'Listing clarity'
    if any(term in text for term in ['defective', 'damaged', 'quality']):
        return 'Quality / damage'
    if any(term in text for term in ['unwanted', 'no_longer', 'accidental']):
        return 'Buyer intent'
    if any(term in text for term in ['late', 'delivery']):
        return 'Fulfillment'
    return 'Other'

def severity_for_rate(rate):
    if rate is None:
        return 'normal'
    if rate >= 5:
        return 'alert'
    if rate >= 2:
        return 'warn'
    return 'normal'

def build_insights(returns, units_by_sku, sales_by_sku=None):
    signals = []
    sales_by_sku = sales_by_sku or []
    if returns is None or returns.empty:
        return {
            'summary': {
                'total_returns': 0,
                'total_units_sold': sum(float(row.get('units_sold') or 0) for row in units_by_sku),
                'overall_return_rate_pct': 0,
                'estimated_refund_impact': 0,
                'top_reason': None,
                'top_reason_share_pct': 0,
                'latest_30_returns': 0,
                'previous_30_returns': 0,
                'latest_vs_previous_30_pct': None,
            },
            'signals': [],
            'sku_risks': [],
            'reason_clusters': [],
            'monthly_trend': [],
            'recommendations': [],
        }

    working = returns.copy()
    working['return_date'] = pd.to_datetime(working['return_date'], errors='coerce')
    working['month'] = working['return_date'].dt.strftime('%Y-%m')
    working['reason_category'] = working['reason'].apply(reason_category) if 'reason' in working.columns else 'Other'

    units_map = {row.get('sku_name'): float(row.get('units_sold') or 0) for row in units_by_sku}
    revenue_map = {row.get('sku_name'): float(row.get('revenue_sold') or 0) for row in sales_by_sku}
    asp_values = []
    for sku_name, units in units_map.items():
        revenue = revenue_map.get(sku_name, 0)
        if units > 0 and revenue > 0:
            asp_values.append(revenue / units)
    avg_asp = sum(asp_values) / len(asp_values) if asp_values else 15.59

    total_returns = float(working['quantity'].fillna(1).sum()) if 'quantity' in working.columns else float(len(working))
    total_units_sold = sum(units_map.values())
    overall_rate = total_returns / total_units_sold * 100 if total_units_sold else None
    estimated_refund_impact = total_returns * avg_asp

    reason_counts = working.groupby('reason')['quantity'].sum().reset_index() if 'reason' in working.columns else pd.DataFrame()
    if not reason_counts.empty:
        reason_counts = reason_counts.sort_values('quantity', ascending=False)
        top_reason = str(reason_counts.iloc[0]['reason'])
        top_reason_count = float(reason_counts.iloc[0]['quantity'])
        top_reason_share = top_reason_count / total_returns * 100 if total_returns else 0
    else:
        top_reason = None
        top_reason_share = 0

    latest_date = working['return_date'].max()
    latest_30 = 0
    previous_30 = 0
    latest_vs_previous = None
    if pd.notna(latest_date):
        latest_start = latest_date - pd.Timedelta(days=30)
        previous_start = latest_date - pd.Timedelta(days=60)
        latest_30 = float(working[working['return_date'] > latest_start]['quantity'].fillna(1).sum())
        previous_30 = float(working[(working['return_date'] <= latest_start) & (working['return_date'] > previous_start)]['quantity'].fillna(1).sum())
        if previous_30 > 0:
            latest_vs_previous = (latest_30 - previous_30) / previous_30 * 100

    if overall_rate is not None and overall_rate >= 5:
        signals.append({
            'severity': 'alert',
            'title': 'Return rate is high',
            'detail': f"Overall return rate is {overall_rate:.1f}% across tracked units sold.",
        })
    elif overall_rate is not None and overall_rate >= 2:
        signals.append({
            'severity': 'warn',
            'title': 'Return rate needs monitoring',
            'detail': f"Overall return rate is {overall_rate:.1f}% across tracked units sold.",
        })
    elif overall_rate is not None:
        signals.append({
            'severity': 'normal',
            'title': 'Return rate is controlled',
            'detail': f"Overall return rate is {overall_rate:.1f}% across tracked units sold.",
        })

    if latest_vs_previous is not None and latest_vs_previous >= 25:
        signals.append({
            'severity': 'warn',
            'title': 'Recent returns are rising',
            'detail': f"Latest 30-day returns increased {latest_vs_previous:.1f}% versus the prior 30 days.",
        })
    elif latest_vs_previous is not None and latest_vs_previous <= -25:
        signals.append({
            'severity': 'normal',
            'title': 'Recent returns are improving',
            'detail': f"Latest 30-day returns declined {abs(latest_vs_previous):.1f}% versus the prior 30 days.",
        })

    if top_reason and top_reason_share >= 30:
        signals.append({
            'severity': 'warn',
            'title': 'Top return reason is concentrated',
            'detail': f"{top_reason.replace('_', ' ')} accounts for {top_reason_share:.1f}% of returns.",
        })

    sku_rows = []
    sku_group = working.groupby('sku_name').agg(total_returns=('quantity', 'sum')).reset_index()
    for _, row in sku_group.iterrows():
        sku_name = row['sku_name']
        returns_count = float(row['total_returns'] or 0)
        units = units_map.get(sku_name, 0)
        revenue = revenue_map.get(sku_name, 0)
        asp = revenue / units if units else avg_asp
        rate = returns_count / units * 100 if units else None
        sku_reasons = working[working['sku_name'] == sku_name]['reason']
        top_sku_reason = sku_reasons.value_counts().index[0] if len(sku_reasons) else None
        risk_score = min(100, (rate or 0) * 12 + returns_count * 0.8)
        sku_rows.append({
            'sku_name': sku_name,
            'total_returns': round(returns_count, 0),
            'units_sold': round(units, 0),
            'return_rate_pct': round(rate, 1) if rate is not None else None,
            'estimated_refund_impact': round(returns_count * asp, 2),
            'top_reason': top_sku_reason,
            'risk_score': round(risk_score, 1),
            'status': 'Critical' if risk_score >= 65 or (rate or 0) >= 5 else 'Watch' if risk_score >= 35 or (rate or 0) >= 2 else 'Healthy',
        })
    sku_rows = sorted(sku_rows, key=lambda row: (row['risk_score'], row['total_returns']), reverse=True)

    if sku_rows and sku_rows[0]['status'] in ('Critical', 'Watch'):
        top_sku = sku_rows[0]
        signals.append({
            'severity': 'alert' if top_sku['status'] == 'Critical' else 'warn',
            'title': f"{top_sku['sku_name']} has elevated return risk",
            'detail': f"{top_sku['sku_name']} has {top_sku['total_returns']:.0f} returns and a {top_sku['return_rate_pct'] or 0:.1f}% return rate.",
        })

    reason_clusters = []
    cluster_group = working.groupby('reason_category').agg(returns=('quantity', 'sum')).reset_index()
    for _, row in cluster_group.sort_values('returns', ascending=False).iterrows():
        count = float(row['returns'] or 0)
        reason_clusters.append({
            'category': row['reason_category'],
            'returns': round(count, 0),
            'share_pct': round(count / total_returns * 100, 1) if total_returns else 0,
        })

    monthly_trend = []
    month_group = working.groupby('month').agg(returns=('quantity', 'sum')).reset_index().sort_values('month')
    for _, row in month_group.iterrows():
        monthly_trend.append({'month': row['month'], 'returns': float(row['returns'] or 0)})

    recommendations = []
    if top_reason:
        if reason_category(top_reason) == 'Listing clarity':
            recommendations.append('Review PDP copy, shade expectations, before/after imagery, and product fit messaging for the top-returned SKUs.')
        elif reason_category(top_reason) == 'Quality / damage':
            recommendations.append('Audit packaging, fulfillment handling, and batch-level customer feedback for defective or damaged return patterns.')
        else:
            recommendations.append('Review the top return reason and customer comments to identify the biggest controllable driver.')
    if sku_rows:
        recommendations.append(f"Prioritize {sku_rows[0]['sku_name']} first because it has the highest return risk score.")

    return {
        'summary': {
            'total_returns': round(total_returns, 0),
            'total_units_sold': round(total_units_sold, 0),
            'overall_return_rate_pct': round(overall_rate, 1) if overall_rate is not None else None,
            'estimated_refund_impact': round(estimated_refund_impact, 2),
            'avg_refund_value': round(avg_asp, 2),
            'top_reason': top_reason,
            'top_reason_share_pct': round(top_reason_share, 1),
            'latest_30_returns': round(latest_30, 0),
            'previous_30_returns': round(previous_30, 0),
            'latest_vs_previous_30_pct': round(latest_vs_previous, 1) if latest_vs_previous is not None else None,
        },
        'signals': signals,
        'sku_risks': sku_rows,
        'reason_clusters': reason_clusters,
        'monthly_trend': monthly_trend,
        'recommendations': recommendations,
    }

try:
    returns = db.get_fba_customer_returns_daily()
    if returns is not None and not returns.empty:
        returns = returns.copy()
        
        # Normalize return_date
        returns['return_date'] = pd.to_datetime(returns['return_date'], errors='coerce', utc=True)
        returns['return_date'] = returns['return_date'].dt.tz_convert('America/New_York')
        returns['return_date_str'] = returns['return_date'].dt.strftime('%Y-%m-%d')
        
        # Map SKU to name
        returns['sku_name'] = returns['sku'].map(SKU_MAP).fillna(returns['sku'])
        
        # All returns records
        returns_out = returns.copy()
        for col in returns_out.select_dtypes(include=['datetime64[ns, UTC]', 'datetimetz']).columns:
            returns_out[col] = returns_out[col].astype(str)
        returns_out['return_date'] = returns_out['return_date_str']
        
        returns_simple = returns_out[['return_date', 'sku_name', 'sku', 'quantity', 'reason', 'detailed_disposition', 'customer_comments']].copy()
        returns_simple['date'] = returns_simple['return_date']
        result['returns'] = clean(returns_simple.to_dict(orient='records'))
        
        # Aggregate by reason
        if 'reason' in returns.columns:
            reasons = returns.groupby('reason')['quantity'].sum().reset_index()
            reasons.columns = ['reason', 'count']
            reasons = reasons.sort_values('count', ascending=False).head(10)
            result['reasons'] = clean(reasons.to_dict(orient='records'))
        else:
            result['reasons'] = []
        
        # Aggregate by SKU
        by_sku = returns.groupby('sku_name').agg(
            total_returns=('quantity', 'sum')
        ).reset_index()
        if 'reason' in returns.columns:
            top_reason = returns.groupby('sku_name')['reason'].agg(lambda x: x.value_counts().index[0] if len(x) > 0 else '')
            by_sku = by_sku.merge(top_reason.rename('top_reason'), on='sku_name', how='left')
        result['by_sku'] = clean(by_sku.to_dict(orient='records'))
        
        # Returns over time by SKU
        time_series = returns.groupby(['return_date_str', 'sku_name'])['quantity'].sum().reset_index()
        time_series.columns = ['date', 'sku_name', 'returns']
        time_series = time_series.sort_values('date')
        result['time_series'] = clean(time_series.to_dict(orient='records'))
        
    else:
        result['returns'] = []
        result['reasons'] = []
        result['by_sku'] = []
        result['time_series'] = []
except Exception as e:
    result['returns_error'] = str(e)
    result['returns'] = []
    result['reasons'] = []
    result['by_sku'] = []
    result['time_series'] = []

try:
    sales = db.get_sales_traffic()
    if sales is not None and not sales.empty:
        sales = sales.copy()
        # sku column is the sku name in this table
        if 'units' in sales.columns and 'sku' in sales.columns:
            agg_map = {'units': 'sum'}
            if 'revenue' in sales.columns:
                agg_map['revenue'] = 'sum'
            units_by_sku = sales.groupby('sku').agg(agg_map).reset_index()
            rename_cols = {'sku': 'sku_name', 'units': 'units_sold', 'revenue': 'revenue_sold'}
            units_by_sku = units_by_sku.rename(columns=rename_cols)
            result['units_by_sku'] = clean(units_by_sku.to_dict(orient='records'))
        else:
            result['units_by_sku'] = []
    else:
        result['units_by_sku'] = []
except Exception as e:
    result['sales_error'] = str(e)
    result['units_by_sku'] = []

try:
    returns_for_insights = db.get_fba_customer_returns_daily()
    if returns_for_insights is not None and not returns_for_insights.empty:
        returns_for_insights = returns_for_insights.copy()
        returns_for_insights['return_date'] = pd.to_datetime(returns_for_insights['return_date'], errors='coerce', utc=True).dt.tz_convert('America/New_York')
        returns_for_insights['sku_name'] = returns_for_insights['sku'].map(SKU_MAP).fillna(returns_for_insights['sku'])
    result['insights'] = clean(build_insights(
        returns_for_insights if 'returns_for_insights' in locals() else pd.DataFrame(),
        result.get('units_by_sku', []),
        result.get('units_by_sku', []),
    ))
except Exception as e:
    result['insights_error'] = str(e)
    result['insights'] = clean(build_insights(pd.DataFrame(), result.get('units_by_sku', []), result.get('units_by_sku', [])))

print(json.dumps(result))
