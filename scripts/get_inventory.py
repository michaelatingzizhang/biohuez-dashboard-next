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

# ── 1. Inventory planning snapshot (aging + coverage + restock signals) ────────
try:
    df = db.get_fba_inventory_planning_snapshot()
    if df is not None and not df.empty:
        df['snapshot_date'] = pd.to_datetime(df['snapshot_date'], errors='coerce')
        # Latest snapshot per SKU
        df = df.sort_values('snapshot_date', ascending=False).drop_duplicates('sku')

        numeric_cols = [
            'available', 'inbound_quantity', 'days_of_supply', 'total_days_of_supply',
            'historical_days_of_supply',
            'inv_age_0_to_30_days', 'inv_age_31_to_60_days', 'inv_age_61_to_90_days',
            'inv_age_0_to_90_days', 'inv_age_91_to_180_days',
            'inv_age_181_to_270_days', 'inv_age_181_to_330_days',
            'inv_age_271_to_365_days', 'inv_age_331_to_365_days',
            'inv_age_366_to_455_days', 'inv_age_456_plus_days',
            'units_shipped_t7', 'units_shipped_t30', 'units_shipped_t60', 'units_shipped_t90',
            'weeks_of_cover_t30', 'weeks_of_cover_t90',
            'total_reserved_quantity', 'unfulfillable_quantity',
            'estimated_storage_cost_next_month', 'sell_through',
            'inbound_working', 'inbound_shipped', 'inbound_received',
            'reserved_fc_transfer', 'reserved_fc_processing', 'reserved_customer_order',
            'your_price', 'price',
            'sales_shipped_last_7_days', 'sales_shipped_last_30_days',
            'sales_shipped_last_60_days', 'sales_shipped_last_90_days',
            'storage_volume', 'item_volume', 'estimated_storage_cost_next_month',
        ]
        for col in numeric_cols:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors='coerce')

        if 'snapshot_date' in df.columns:
            df['snapshot_date'] = df['snapshot_date'].dt.strftime('%Y-%m-%d')

        result['inventory_planning'] = clean(df.to_dict(orient='records'))
    else:
        result['inventory_planning'] = []
except Exception as e:
    result['inventory_planning'] = []
    result['inventory_planning_error'] = str(e)

# ── 2. Restock recommendations ─────────────────────────────────────────────────
try:
    df = db.get_restock_inventory_recommendations_snapshot()
    if df is not None and not df.empty:
        df['fetched_at'] = pd.to_datetime(df['fetched_at'], errors='coerce')
        df = df.sort_values('fetched_at', ascending=False).drop_duplicates('merchant_sku')

        numeric_cols = [
            'price', 'sales_last_30_days', 'units_sold_last_30_days', 'total_units',
            'inbound', 'available', 'fc_transfer', 'fc_processing', 'customer_order',
            'unfulfillable', 'working', 'shipped', 'receiving',
            'total_days_of_supply', 'days_of_supply_at_amazon_fulfillment_network',
            'recommended_replenishment_qty',
        ]
        for col in numeric_cols:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors='coerce')

        result['restock'] = clean(df.to_dict(orient='records'))
    else:
        result['restock'] = []
except Exception as e:
    result['restock'] = []
    result['restock_error'] = str(e)

# ── 3. Ledger summary (monthly inventory movement history) ─────────────────────
try:
    df = db.get_ledger_summary_daily()
    if df is not None and not df.empty:
        df['date'] = pd.to_datetime(df['date'], errors='coerce')
        df = df[df['date'].notna()].copy()

        numeric_cols = [
            'starting_warehouse_balance', 'in_transit_between_warehouses',
            'receipts', 'customer_shipments', 'customer_returns',
            'vendor_returns', 'warehouse_transfer_in_out',
            'found', 'lost', 'damaged', 'disposed', 'other_events',
            'ending_warehouse_balance', 'unknown_events',
        ]
        for col in numeric_cols:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)

        df['month'] = df['date'].dt.to_period('M').astype(str)
        df['date'] = df['date'].dt.strftime('%Y-%m-%d')

        # Aggregate to month + SKU + disposition for cleaner view
        sellable = df[df['disposition'].str.upper().str.contains('SELLABLE', na=False)].copy() if 'disposition' in df.columns else df.copy()

        agg_cols = [c for c in numeric_cols if c in sellable.columns]
        monthly_agg = sellable.groupby(['month', 'msku', 'asin', 'title'])[agg_cols].sum().reset_index()
        monthly_agg = monthly_agg.sort_values(['msku', 'month'])
        result['ledger_monthly'] = clean(monthly_agg.to_dict(orient='records'))

        # All dispositions for damaged/lost breakdown
        disposition_agg = df.groupby(['month', 'msku', 'disposition'])[agg_cols].sum().reset_index()
        result['ledger_by_disposition'] = clean(disposition_agg.to_dict(orient='records'))
    else:
        result['ledger_monthly'] = []
        result['ledger_by_disposition'] = []
except Exception as e:
    result['ledger_monthly'] = []
    result['ledger_by_disposition'] = []
    result['ledger_error'] = str(e)

# ── 4. Ledger detail (FC-level breakdown) ─────────────────────────────────────
try:
    df = db.get_ledger_detail_daily()
    if df is not None and not df.empty:
        df['quantity'] = pd.to_numeric(df['quantity'], errors='coerce').fillna(0)
        df['date'] = pd.to_datetime(df['date'], errors='coerce')
        df = df[df['date'].notna()].copy()
        df['date'] = df['date'].dt.strftime('%Y-%m-%d')

        # FC distribution: net quantity per FC+SKU (positive = inbound flow)
        fc_agg = df.groupby(['fulfillment_center', 'msku', 'asin', 'disposition'])['quantity'].sum().reset_index()
        # Focus on sellable inventory at FCs
        fc_sellable = fc_agg[
            fc_agg['disposition'].str.upper().str.contains('SELLABLE', na=False)
        ].copy() if 'disposition' in fc_agg.columns else fc_agg.copy()
        fc_sellable = fc_sellable[fc_sellable['quantity'] != 0].sort_values('quantity', ascending=False)
        result['fc_distribution'] = clean(fc_sellable.to_dict(orient='records'))

        # Shipment events timeline: inbound receipts (Receipts event type)
        receipts = df[df['event_type'].str.contains('Receipt', case=False, na=False)].copy() if 'event_type' in df.columns else pd.DataFrame()
        if not receipts.empty:
            receipts = receipts.sort_values('date', ascending=False).head(50)
            result['receipt_events'] = clean(receipts.to_dict(orient='records'))
        else:
            result['receipt_events'] = []

        # All event types summary
        event_summary = df.groupby(['event_type', 'msku'])['quantity'].sum().reset_index()
        event_summary = event_summary.sort_values('quantity', ascending=False)
        result['event_summary'] = clean(event_summary.to_dict(orient='records'))
    else:
        result['fc_distribution'] = []
        result['receipt_events'] = []
        result['event_summary'] = []
except Exception as e:
    result['fc_distribution'] = []
    result['receipt_events'] = []
    result['event_summary'] = []
    result['ledger_detail_error'] = str(e)

try:
    planning = pd.DataFrame(result.get('inventory_planning') or [])
    restock = pd.DataFrame(result.get('restock') or [])
    ledger = pd.DataFrame(result.get('ledger_monthly') or [])
    fc = pd.DataFrame(result.get('fc_distribution') or [])

    insights = {
        'summary': {},
        'sku_risks': [],
        'signals': [],
        'restock_priorities': [],
        'aging_exposure': [],
        'fc_concentration': [],
        'movement_anomalies': [],
    }

    if not planning.empty:
        numeric_cols = [
            'available', 'inbound_quantity', 'total_reserved_quantity', 'unfulfillable_quantity',
            'days_of_supply', 'total_days_of_supply', 'historical_days_of_supply',
            'weeks_of_cover_t30', 'weeks_of_cover_t90', 'units_shipped_t7', 'units_shipped_t30',
            'units_shipped_t60', 'units_shipped_t90', 'inv_age_0_to_30_days', 'inv_age_31_to_60_days',
            'inv_age_61_to_90_days', 'inv_age_91_to_180_days', 'inv_age_181_to_330_days',
            'inv_age_331_to_365_days', 'inv_age_366_to_455_days', 'inv_age_456_plus_days',
            'estimated_storage_cost_next_month', 'sell_through',
        ]
        for col in numeric_cols:
            if col in planning.columns:
                planning[col] = pd.to_numeric(planning[col], errors='coerce').fillna(0)

        if not restock.empty:
            for col in ['recommended_replenishment_qty', 'available', 'total_units', 'inbound', 'units_sold_last_30_days', 'total_days_of_supply']:
                if col in restock.columns:
                    restock[col] = pd.to_numeric(restock[col], errors='coerce').fillna(0)

        restock_by_sku = {}
        if not restock.empty and 'merchant_sku' in restock.columns:
            restock_by_sku = restock.set_index('merchant_sku').to_dict(orient='index')

        sku_risks = []
        aging_rows = []
        total_available = float(planning['available'].sum()) if 'available' in planning.columns else 0
        total_inbound = float(planning['inbound_quantity'].sum()) if 'inbound_quantity' in planning.columns else 0
        total_storage_cost = float(planning['estimated_storage_cost_next_month'].sum()) if 'estimated_storage_cost_next_month' in planning.columns else 0

        for _, row in planning.iterrows():
            sku = row.get('sku') or row.get('merchant_sku') or 'Unknown'
            dos = float(row.get('total_days_of_supply') or row.get('days_of_supply') or 0)
            available = float(row.get('available') or 0)
            inbound = float(row.get('inbound_quantity') or 0)
            units_t30 = float(row.get('units_shipped_t30') or 0)
            velocity = units_t30 / 30 if units_t30 > 0 else 0
            unfulfillable = float(row.get('unfulfillable_quantity') or 0)
            reserved = float(row.get('total_reserved_quantity') or 0)
            storage_cost = float(row.get('estimated_storage_cost_next_month') or 0)
            old_units = (
                float(row.get('inv_age_181_to_330_days') or 0) +
                float(row.get('inv_age_331_to_365_days') or 0) +
                float(row.get('inv_age_366_to_455_days') or 0) +
                float(row.get('inv_age_456_plus_days') or 0)
            )
            aging_total = (
                float(row.get('inv_age_0_to_30_days') or 0) +
                float(row.get('inv_age_31_to_60_days') or 0) +
                float(row.get('inv_age_61_to_90_days') or 0) +
                float(row.get('inv_age_91_to_180_days') or 0) +
                old_units
            )
            old_pct = old_units / aging_total * 100 if aging_total > 0 else 0
            restock_row = restock_by_sku.get(sku, {})
            recommended_qty = float(restock_row.get('recommended_replenishment_qty') or 0)

            score = 0
            drivers = []
            if dos <= 0:
                score += 20
                drivers.append('No days-of-supply value')
            elif dos < 30:
                score += 45
                drivers.append('Critical stock coverage')
            elif dos < 60:
                score += 25
                drivers.append('Low stock coverage')
            elif dos > 180:
                score += 25
                drivers.append('Excess stock coverage')
            elif dos > 120:
                score += 12
                drivers.append('Elevated stock coverage')

            if old_pct > 40:
                score += 30
                drivers.append('High aging exposure')
            elif old_pct > 15:
                score += 15
                drivers.append('Moderate aging exposure')

            if unfulfillable > 0:
                score += 10
                drivers.append('Unfulfillable units present')
            if storage_cost > 25:
                score += 10
                drivers.append('Storage cost pressure')
            if recommended_qty > 0:
                score += 20
                drivers.append('Amazon recommends replenishment')

            if score >= 60:
                status = 'Critical'
            elif score >= 35:
                status = 'Watch'
            else:
                status = 'Healthy'

            if dos < 60:
                action = 'Prepare replenishment'
            elif dos > 180 and old_pct > 15:
                action = 'Reduce overstock / review promos'
            elif dos > 180:
                action = 'Monitor excess coverage'
            elif old_pct > 15:
                action = 'Review aging inventory'
            else:
                action = 'Monitor'

            sku_risks.append({
                'sku': sku,
                'asin': row.get('asin'),
                'product_name': row.get('product_name'),
                'risk_score': min(100, int(round(score))),
                'status': status,
                'recommended_action': action,
                'drivers': drivers,
                'available': available,
                'inbound': inbound,
                'days_of_supply': dos,
                'units_shipped_t30': units_t30,
                'daily_velocity': round(velocity, 2),
                'old_units': old_units,
                'old_pct': round(old_pct, 1),
                'unfulfillable': unfulfillable,
                'reserved': reserved,
                'storage_cost_next_month': storage_cost,
                'recommended_replenishment_qty': recommended_qty,
            })

            aging_rows.append({
                'sku': sku,
                'available': available,
                'aging_total': aging_total,
                'old_units': old_units,
                'old_pct': round(old_pct, 1),
                'storage_cost_next_month': storage_cost,
                'days_of_supply': dos,
            })

        sku_risks = sorted(sku_risks, key=lambda r: (r['risk_score'], r['available']), reverse=True)
        insights['sku_risks'] = clean(sku_risks)
        insights['aging_exposure'] = clean(sorted(aging_rows, key=lambda r: (r['old_units'], r['old_pct']), reverse=True))
        insights['restock_priorities'] = clean([r for r in sku_risks if r['days_of_supply'] < 60 or r['recommended_replenishment_qty'] > 0])

        critical_count = sum(1 for r in sku_risks if r['status'] == 'Critical')
        watch_count = sum(1 for r in sku_risks if r['status'] == 'Watch')
        excess_count = sum(1 for r in sku_risks if r['days_of_supply'] > 180)
        aging_units = sum(r['old_units'] for r in aging_rows)
        insights['summary'] = {
            'sku_count': int(len(sku_risks)),
            'critical_count': int(critical_count),
            'watch_count': int(watch_count),
            'excess_count': int(excess_count),
            'total_available': total_available,
            'total_inbound': total_inbound,
            'total_storage_cost_next_month': total_storage_cost,
            'aging_units_181_plus': aging_units,
            'avg_days_of_supply': round(float(planning['total_days_of_supply'].replace(0, pd.NA).dropna().mean()), 1) if 'total_days_of_supply' in planning.columns and not planning['total_days_of_supply'].replace(0, pd.NA).dropna().empty else None,
        }

        if critical_count > 0:
            insights['signals'].append({
                'severity': 'alert',
                'title': 'Critical inventory risks need review',
                'detail': f"{critical_count} SKU(s) have critical stock, aging, or replenishment risk.",
            })
        if excess_count > 0:
            insights['signals'].append({
                'severity': 'warn',
                'title': 'Excess coverage detected',
                'detail': f"{excess_count} SKU(s) have more than 180 days of supply.",
            })
        if aging_units > 0:
            insights['signals'].append({
                'severity': 'warn',
                'title': 'Aging inventory exposure exists',
                'detail': f"{int(aging_units)} unit(s) are 181+ days old.",
            })
        if total_storage_cost > 0:
            insights['signals'].append({
                'severity': 'normal',
                'title': 'Storage cost is being tracked',
                'detail': f"Estimated next-month storage cost is ${total_storage_cost:,.0f}.",
            })

    if not fc.empty:
        if 'quantity' in fc.columns:
            fc['quantity'] = pd.to_numeric(fc['quantity'], errors='coerce').fillna(0)
        fc_positive = fc[fc['quantity'] > 0].copy()
        if not fc_positive.empty:
            fc_totals = fc_positive.groupby('fulfillment_center').agg(
                total_units=('quantity', 'sum'),
                sku_count=('msku', 'nunique'),
            ).reset_index()
            total_units = float(fc_totals['total_units'].sum())
            fc_totals['pct_of_inventory'] = fc_totals['total_units'].apply(lambda v: v / total_units * 100 if total_units > 0 else 0)
            fc_totals = fc_totals.sort_values('total_units', ascending=False).head(12)
            insights['fc_concentration'] = clean(fc_totals.to_dict(orient='records'))

    if not ledger.empty:
        for col in ['customer_shipments', 'receipts', 'customer_returns', 'lost', 'damaged', 'disposed', 'ending_warehouse_balance']:
            if col in ledger.columns:
                ledger[col] = pd.to_numeric(ledger[col], errors='coerce').fillna(0)
        if 'month' in ledger.columns and 'msku' in ledger.columns:
            recent = ledger.sort_values('month').groupby('msku').tail(2)
            anomalies = []
            for sku, rows in recent.groupby('msku'):
                rows = rows.sort_values('month')
                latest = rows.iloc[-1]
                previous = rows.iloc[-2] if len(rows) > 1 else None
                shipped = abs(float(latest.get('customer_shipments') or 0))
                receipts = float(latest.get('receipts') or 0)
                balance = float(latest.get('ending_warehouse_balance') or 0)
                prev_balance = float(previous.get('ending_warehouse_balance') or 0) if previous is not None else None
                balance_delta = balance - prev_balance if prev_balance is not None else None
                anomalies.append({
                    'sku': sku,
                    'month': latest.get('month'),
                    'shipped_units': shipped,
                    'received_units': receipts,
                    'ending_balance': balance,
                    'balance_delta': balance_delta,
                    'lost_units': float(latest.get('lost') or 0),
                    'damaged_units': float(latest.get('damaged') or 0),
                    'disposed_units': float(latest.get('disposed') or 0),
                })
            insights['movement_anomalies'] = clean(sorted(anomalies, key=lambda r: abs(r.get('balance_delta') or 0), reverse=True))

    result['insights'] = clean(insights)
except Exception as e:
    result['insights_error'] = str(e)
    result['insights'] = {
        'summary': {},
        'sku_risks': [],
        'signals': [],
        'restock_priorities': [],
        'aging_exposure': [],
        'fc_concentration': [],
        'movement_anomalies': [],
    }

print(json.dumps(result))
