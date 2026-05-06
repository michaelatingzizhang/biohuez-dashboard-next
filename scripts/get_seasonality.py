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
DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

try:
    orders = db.get_orders()
    if orders is not None and not orders.empty:
        orders = orders.copy()
        
        date_col = None
        for c in orders.columns:
            if 'purchase' in c.lower() or ('date' in c.lower() and 'order' not in c.lower()):
                date_col = c
                break
        if date_col is None:
            for c in orders.columns:
                if 'date' in c.lower():
                    date_col = c
                    break
        
        rev_col = None
        for c in orders.columns:
            if 'total' in c.lower() or 'revenue' in c.lower() or 'amount' in c.lower():
                rev_col = c
                break
        
        if date_col:
            orders[date_col] = pd.to_datetime(orders[date_col], errors='coerce')
            orders = orders[orders[date_col].notna()]
            
            # Day of week
            orders['day_of_week'] = orders[date_col].dt.day_name()
            dow = orders.groupby('day_of_week').agg(
                orders=('day_of_week', 'count'),
                revenue=(rev_col, 'sum') if rev_col else ('day_of_week', 'count')
            ).reset_index()
            dow.columns = ['day', 'orders', 'revenue']
            dow['day_order'] = dow['day'].map({d: i for i, d in enumerate(DAY_ORDER)})
            dow = dow.sort_values('day_order').drop('day_order', axis=1)
            result['day_of_week'] = clean(dow.to_dict(orient='records'))
            
            # Monthly
            orders['month'] = orders[date_col].dt.to_period('M').astype(str)
            monthly = orders.groupby('month').agg(
                orders=('month', 'count'),
                revenue=(rev_col, 'sum') if rev_col else ('month', 'count')
            ).reset_index()
            monthly.columns = ['month', 'orders', 'revenue']
            monthly = monthly.sort_values('month')
            result['month_orders'] = clean(monthly.to_dict(orient='records'))
            
            # Weekly
            orders['week'] = orders[date_col].dt.to_period('W').apply(lambda r: str(r.start_time.date()))
            weekly = orders.groupby('week').agg(
                orders=('week', 'count'),
                revenue=(rev_col, 'sum') if rev_col else ('week', 'count')
            ).reset_index()
            weekly.columns = ['week', 'orders', 'revenue']
            weekly = weekly.sort_values('week')
            result['week_orders'] = clean(weekly.to_dict(orient='records'))
            
            # Hour of day (if available)
            try:
                orders['hour'] = orders[date_col].dt.hour
                hourly = orders.groupby('hour').size().reset_index(name='orders')
                result['hour_orders'] = clean(hourly.to_dict(orient='records'))
            except Exception:
                result['hour_orders'] = []
        else:
            result['day_of_week'] = []
            result['month_orders'] = []
            result['week_orders'] = []
            result['hour_orders'] = []
    else:
        result['day_of_week'] = []
        result['month_orders'] = []
        result['week_orders'] = []
        result['hour_orders'] = []
except Exception as e:
    result['orders_error'] = str(e)
    result['day_of_week'] = []
    result['month_orders'] = []
    result['week_orders'] = []
    result['hour_orders'] = []

# Also get sales traffic for revenue context
try:
    sales = db.get_sales_traffic()
    if sales is not None and not sales.empty:
        for col in sales.select_dtypes(include=['datetime64']).columns:
            sales[col] = sales[col].astype(str)
        if 'date' in sales.columns:
            sales['date'] = sales['date'].astype(str)
        # Aggregate by month for combined view
        import pandas as pd2
        sales_pd = sales.copy()
        sales_pd['date'] = pd.to_datetime(sales_pd['date'], errors='coerce')
        sales_pd = sales_pd[sales_pd['date'].notna()]
        sales_pd['month'] = sales_pd['date'].dt.to_period('M').astype(str)
        if 'revenue' in sales_pd.columns:
            monthly_rev = sales_pd.groupby('month')['revenue'].sum().reset_index()
            monthly_rev.columns = ['month', 'sales_revenue']
            result['monthly_revenue'] = clean(monthly_rev.to_dict(orient='records'))
except Exception as e:
    result['sales_error'] = str(e)

try:
    day_of_week = pd.DataFrame(result.get('day_of_week') or [])
    month_orders = pd.DataFrame(result.get('month_orders') or [])
    week_orders = pd.DataFrame(result.get('week_orders') or [])
    monthly_revenue = pd.DataFrame(result.get('monthly_revenue') or [])

    insights = {
        'summary': {},
        'signals': [],
        'forecast': [],
        'weekly_momentum': [],
        'peak_periods': [],
        'slow_periods': [],
        'volatility': [],
    }

    if not week_orders.empty:
        for col in ['orders', 'revenue']:
            if col in week_orders.columns:
                week_orders[col] = pd.to_numeric(week_orders[col], errors='coerce').fillna(0)
        week_orders = week_orders.sort_values('week').copy()
        week_orders['orders_4w_avg'] = week_orders['orders'].rolling(4, min_periods=1).mean()
        week_orders['revenue_4w_avg'] = week_orders['revenue'].rolling(4, min_periods=1).mean()
        week_orders['orders_wow_pct'] = week_orders['orders'].pct_change().replace([float('inf'), -float('inf')], float('nan')) * 100
        week_orders['revenue_wow_pct'] = week_orders['revenue'].pct_change().replace([float('inf'), -float('inf')], float('nan')) * 100
        insights['weekly_momentum'] = clean(week_orders.replace({float('nan'): None}).to_dict(orient='records'))

        latest = week_orders.iloc[-1].to_dict()
        previous = week_orders.iloc[-2].to_dict() if len(week_orders) > 1 else {}
        last4 = week_orders.tail(4)
        prior4 = week_orders.iloc[-8:-4] if len(week_orders) >= 8 else pd.DataFrame()
        avg4 = float(last4['orders'].mean()) if not last4.empty else 0
        avg_prior4 = float(prior4['orders'].mean()) if not prior4.empty else 0
        demand_delta = (avg4 - avg_prior4) / avg_prior4 * 100 if avg_prior4 > 0 else None
        volatility = float(last4['orders'].std() / avg4 * 100) if avg4 > 0 and len(last4) > 1 else 0

        insights['summary'].update({
            'latest_week': latest.get('week'),
            'latest_orders': latest.get('orders'),
            'latest_revenue': latest.get('revenue'),
            'latest_orders_wow_pct': latest.get('orders_wow_pct'),
            'latest_revenue_wow_pct': latest.get('revenue_wow_pct'),
            'last4_avg_orders': round(avg4, 1),
            'prior4_avg_orders': round(avg_prior4, 1),
            'last4_vs_prior4_pct': round(demand_delta, 1) if demand_delta is not None else None,
            'last4_order_volatility_pct': round(volatility, 1),
        })

        if demand_delta is not None:
            if demand_delta > 20:
                insights['signals'].append({
                    'severity': 'normal',
                    'title': 'Demand is accelerating',
                    'detail': f"Last 4-week average orders are up {demand_delta:.1f}% versus the prior 4 weeks.",
                })
            elif demand_delta < -20:
                insights['signals'].append({
                    'severity': 'warn',
                    'title': 'Demand is cooling',
                    'detail': f"Last 4-week average orders are down {abs(demand_delta):.1f}% versus the prior 4 weeks.",
                })
        if volatility > 35:
            insights['signals'].append({
                'severity': 'warn',
                'title': 'Weekly demand is volatile',
                'detail': f"Last 4-week order volatility is {volatility:.1f}%.",
            })

        last_week = pd.to_datetime(latest.get('week'), errors='coerce')
        forecast_base_orders = avg4
        forecast_base_revenue = float(last4['revenue'].mean()) if not last4.empty else 0
        forecast = []
        if pd.notna(last_week):
            for i in range(1, 5):
                week = (last_week + pd.Timedelta(days=7 * i)).date().isoformat()
                momentum = 1
                if demand_delta is not None:
                    momentum += max(min(demand_delta, 25), -25) / 100 * (i / 4)
                forecast.append({
                    'week': week,
                    'forecast_orders': round(forecast_base_orders * momentum, 1),
                    'forecast_revenue': round(forecast_base_revenue * momentum, 2),
                    'confidence': 'low' if len(week_orders) < 12 or volatility > 35 else 'medium',
                })
        insights['forecast'] = clean(forecast)

        peak_weeks = week_orders.sort_values('orders', ascending=False).head(5).copy()
        slow_weeks = week_orders[week_orders['orders'] > 0].sort_values('orders', ascending=True).head(5).copy()
        for _, row in peak_weeks.iterrows():
            insights['peak_periods'].append({
                'period_type': 'week',
                'period': row['week'],
                'orders': float(row['orders']),
                'revenue': float(row['revenue']),
            })
        for _, row in slow_weeks.iterrows():
            insights['slow_periods'].append({
                'period_type': 'week',
                'period': row['week'],
                'orders': float(row['orders']),
                'revenue': float(row['revenue']),
            })

    if not day_of_week.empty:
        for col in ['orders', 'revenue']:
            day_of_week[col] = pd.to_numeric(day_of_week[col], errors='coerce').fillna(0)
        avg_day_orders = day_of_week['orders'].mean()
        day_of_week['index_vs_avg'] = day_of_week['orders'].apply(lambda v: v / avg_day_orders * 100 if avg_day_orders > 0 else 0)
        peak_day = day_of_week.sort_values('orders', ascending=False).iloc[0].to_dict()
        slow_day = day_of_week.sort_values('orders').iloc[0].to_dict()
        insights['summary'].update({
            'peak_day': peak_day.get('day'),
            'peak_day_index': round(float(peak_day.get('index_vs_avg') or 0), 1),
            'slow_day': slow_day.get('day'),
            'slow_day_index': round(float(slow_day.get('index_vs_avg') or 0), 1),
        })
        insights['peak_periods'].append({
            'period_type': 'day',
            'period': peak_day.get('day'),
            'orders': float(peak_day.get('orders') or 0),
            'revenue': float(peak_day.get('revenue') or 0),
        })
        insights['slow_periods'].append({
            'period_type': 'day',
            'period': slow_day.get('day'),
            'orders': float(slow_day.get('orders') or 0),
            'revenue': float(slow_day.get('revenue') or 0),
        })

    if not month_orders.empty:
        for col in ['orders', 'revenue']:
            month_orders[col] = pd.to_numeric(month_orders[col], errors='coerce').fillna(0)
        avg_month_orders = month_orders['orders'].mean()
        month_orders['index_vs_avg'] = month_orders['orders'].apply(lambda v: v / avg_month_orders * 100 if avg_month_orders > 0 else 0)
        peak_month = month_orders.sort_values('orders', ascending=False).iloc[0].to_dict()
        slow_month = month_orders[month_orders['orders'] > 0].sort_values('orders').iloc[0].to_dict()
        insights['summary'].update({
            'peak_month': peak_month.get('month'),
            'peak_month_index': round(float(peak_month.get('index_vs_avg') or 0), 1),
            'slow_month': slow_month.get('month'),
            'slow_month_index': round(float(slow_month.get('index_vs_avg') or 0), 1),
        })

    if not monthly_revenue.empty:
        monthly_revenue['sales_revenue'] = pd.to_numeric(monthly_revenue['sales_revenue'], errors='coerce').fillna(0)
        monthly_revenue = monthly_revenue.sort_values('month').copy()
        monthly_revenue['revenue_mom_pct'] = monthly_revenue['sales_revenue'].pct_change().replace([float('inf'), -float('inf')], float('nan')) * 100
        if len(monthly_revenue) > 1:
            latest_rev = monthly_revenue.iloc[-1]
            if pd.notna(latest_rev.get('revenue_mom_pct')) and latest_rev['revenue_mom_pct'] < -20:
                insights['signals'].append({
                    'severity': 'warn',
                    'title': 'Monthly sales revenue declined',
                    'detail': f"Latest month revenue changed {latest_rev['revenue_mom_pct']:.1f}% versus prior month.",
                })

    if not insights['signals']:
        insights['signals'].append({
            'severity': 'normal',
            'title': 'No major seasonality warning detected',
            'detail': 'Demand patterns look stable based on the available weekly order history.',
        })

    result['insights'] = clean(insights)
except Exception as e:
    result['insights_error'] = str(e)
    result['insights'] = {
        'summary': {},
        'signals': [],
        'forecast': [],
        'weekly_momentum': [],
        'peak_periods': [],
        'slow_periods': [],
        'volatility': [],
    }

print(json.dumps(result))
