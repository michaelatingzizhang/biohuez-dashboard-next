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

# fin_monthly table doesn't exist — compute from sp_finances settlements
try:
    df = db.get_finances()
    if df is not None and not df.empty:
        df = df.copy()
        # Filter to USD and Closed settlements
        df = df[df['currency'] == 'USD'].copy()
        for col in df.select_dtypes(include=['datetime64']).columns:
            df[col] = df[col].astype(str)
        
        # Compute monthly P&L from settlement data
        df['period_start'] = pd.to_datetime(df['period_start'], errors='coerce')
        df = df[df['period_start'].notna()]
        df['month'] = df['period_start'].dt.to_period('M').astype(str)
        
        monthly = df.groupby('month').agg(
            gross_sales=('actual_selling_price', 'sum'),
            shipping_revenue=('shipping_revenue', 'sum'),
            coupons=('coupons_rebates', 'sum'),
            referral_fees=('referral_fees', 'sum'),
            fba_fees=('fba_fulfillment', 'sum'),
            fba_storage=('fba_storage', 'sum'),
            refunds=('refunds', 'sum'),
            ads_spend=('ads_spend', 'sum'),
            units_ordered=('units_ordered', 'sum'),
            refunded_units=('refunded_units', 'sum'),
        ).reset_index()
        
        monthly['net_revenue'] = (
            monthly['gross_sales'] + monthly['shipping_revenue'] + monthly['coupons'] + 
            monthly['referral_fees'] + monthly['fba_fees'] + monthly['fba_storage'] + monthly['refunds']
        )
        monthly['amazon_fees'] = monthly['referral_fees'] + monthly['coupons']
        monthly['fba_total'] = monthly['fba_fees'] + monthly['fba_storage']
        monthly['gross_profit'] = monthly['net_revenue']  # no COGS data available
        monthly['gross_margin_pct'] = (monthly['gross_profit'] / monthly['gross_sales'].replace(0, float('nan')) * 100).round(1)
        monthly = monthly.sort_values('month')

        insight_df = monthly.copy()
        for col in [
            'gross_sales', 'shipping_revenue', 'coupons', 'referral_fees', 'fba_fees',
            'fba_storage', 'refunds', 'ads_spend', 'units_ordered', 'refunded_units',
            'net_revenue', 'amazon_fees', 'fba_total', 'gross_profit', 'gross_margin_pct'
        ]:
            if col in insight_df.columns:
                insight_df[col] = pd.to_numeric(insight_df[col], errors='coerce').fillna(0)

        insight_df['fee_load_pct'] = (
            (insight_df['amazon_fees'].abs() + insight_df['fba_total'].abs()) /
            insight_df['gross_sales'].replace(0, float('nan')) * 100
        ).round(1)
        insight_df['refund_rate_pct'] = (
            insight_df['refunds'].abs() / insight_df['gross_sales'].replace(0, float('nan')) * 100
        ).round(1)
        insight_df['ad_load_pct'] = (
            insight_df['ads_spend'].abs() / insight_df['gross_sales'].replace(0, float('nan')) * 100
        ).round(1)
        insight_df['net_after_ads'] = insight_df['gross_profit'] + insight_df['ads_spend']
        insight_df['ad_adjusted_margin_pct'] = (
            insight_df['net_after_ads'] / insight_df['gross_sales'].replace(0, float('nan')) * 100
        ).round(1)
        insight_df['sales_mom_pct'] = insight_df['gross_sales'].pct_change().replace([float('inf'), -float('inf')], float('nan')) * 100
        insight_df['margin_mom_pct'] = insight_df['gross_margin_pct'].diff()

        latest = insight_df.iloc[-1].to_dict() if not insight_df.empty else {}
        previous = insight_df.iloc[-2].to_dict() if len(insight_df) > 1 else {}
        last3 = insight_df.tail(3)

        signals = []
        if latest:
            margin = latest.get('gross_margin_pct')
            fee_load = latest.get('fee_load_pct')
            refund_rate = latest.get('refund_rate_pct')
            ad_load = latest.get('ad_load_pct')
            sales_mom = latest.get('sales_mom_pct')
            ad_adjusted_margin = latest.get('ad_adjusted_margin_pct')

            if margin < 50:
                signals.append({
                    'type': 'margin',
                    'severity': 'warn' if margin >= 35 else 'alert',
                    'title': 'Fee-adjusted margin is compressed',
                    'detail': f"Latest margin is {margin:.1f}% before COGS.",
                })
            else:
                signals.append({
                    'type': 'margin',
                    'severity': 'normal',
                    'title': 'Fee-adjusted margin is healthy',
                    'detail': f"Latest margin is {margin:.1f}% before COGS.",
                })

            if fee_load > 35:
                signals.append({
                    'type': 'fees',
                    'severity': 'warn' if fee_load <= 45 else 'alert',
                    'title': 'Amazon/FBA fee load is high',
                    'detail': f"Fees are {fee_load:.1f}% of gross sales in the latest month.",
                })

            if refund_rate > 5:
                signals.append({
                    'type': 'refunds',
                    'severity': 'warn' if refund_rate <= 10 else 'alert',
                    'title': 'Refund drag needs review',
                    'detail': f"Refunds are {refund_rate:.1f}% of gross sales in the latest month.",
                })

            if ad_load > 25:
                signals.append({
                    'type': 'ads',
                    'severity': 'warn' if ad_load <= 40 else 'alert',
                    'title': 'Ad spend is pressuring profit',
                    'detail': f"Ad spend is {ad_load:.1f}% of gross sales in the latest month.",
                })

            if ad_adjusted_margin < 35:
                signals.append({
                    'type': 'profit',
                    'severity': 'warn' if ad_adjusted_margin >= 20 else 'alert',
                    'title': 'Ad-adjusted margin is thin',
                    'detail': f"After ads, latest margin is {ad_adjusted_margin:.1f}% before COGS.",
                })

            if pd.notna(sales_mom) and sales_mom < -20:
                signals.append({
                    'type': 'sales',
                    'severity': 'warn',
                    'title': 'Sales dropped month over month',
                    'detail': f"Gross sales changed {sales_mom:.1f}% versus the prior month.",
                })

        drivers = []
        if latest and previous:
            for key, label, direction in [
                ('gross_sales', 'Gross sales', 'higher'),
                ('net_revenue', 'Net revenue', 'higher'),
                ('amazon_fees', 'Amazon fees', 'lower'),
                ('fba_total', 'FBA fees', 'lower'),
                ('refunds', 'Refunds', 'lower'),
                ('ads_spend', 'Ad spend', 'lower'),
                ('units_ordered', 'Units ordered', 'higher'),
            ]:
                current = float(latest.get(key) or 0)
                prev = float(previous.get(key) or 0)
                delta = current - prev
                if abs(delta) > 0:
                    drivers.append({
                        'metric': label,
                        'current': current,
                        'previous': prev,
                        'delta': delta,
                        'direction': direction,
                    })
            drivers = sorted(drivers, key=lambda r: abs(r['delta']), reverse=True)[:8]

        contribution_cols = [
            ('amazon_fees', 'Amazon Fees'),
            ('fba_total', 'FBA Fees'),
            ('refunds', 'Refunds'),
            ('ads_spend', 'Ad Spend'),
            ('coupons', 'Coupons/Rebates'),
        ]
        latest_breakdown = []
        for key, label in contribution_cols:
            value = float(latest.get(key) or 0) if latest else 0
            gross_sales = float(latest.get('gross_sales') or 0) if latest else 0
            latest_breakdown.append({
                'metric': label,
                'amount': value,
                'abs_amount': abs(value),
                'pct_of_sales': abs(value) / gross_sales * 100 if gross_sales > 0 else None,
            })
        latest_breakdown = sorted(latest_breakdown, key=lambda r: r['abs_amount'], reverse=True)

        result['insights'] = clean({
            'summary': {
                'latest_month': latest.get('month'),
                'latest_gross_sales': latest.get('gross_sales'),
                'latest_net_revenue': latest.get('net_revenue'),
                'latest_margin_pct': latest.get('gross_margin_pct'),
                'latest_fee_load_pct': latest.get('fee_load_pct'),
                'latest_refund_rate_pct': latest.get('refund_rate_pct'),
                'latest_ad_load_pct': latest.get('ad_load_pct'),
                'latest_ad_adjusted_margin_pct': latest.get('ad_adjusted_margin_pct'),
                'avg_3m_margin_pct': round(float(last3['gross_margin_pct'].mean()), 1) if not last3.empty else None,
                'avg_3m_fee_load_pct': round(float(last3['fee_load_pct'].mean()), 1) if not last3.empty else None,
                'avg_3m_refund_rate_pct': round(float(last3['refund_rate_pct'].mean()), 1) if not last3.empty else None,
            },
            'monthly_intelligence': insight_df.replace({float('nan'): None}).to_dict(orient='records'),
            'signals': signals,
            'drivers': drivers,
            'latest_breakdown': latest_breakdown,
        })
        
        result['monthly'] = clean(monthly.to_dict(orient='records'))
        result['settlement'] = clean(df.to_dict(orient='records'))
    else:
        result['monthly'] = []
        result['settlement'] = []
except Exception as e:
    result['monthly_error'] = str(e)
    result['monthly'] = []
    result['settlement'] = []

print(json.dumps(result))
