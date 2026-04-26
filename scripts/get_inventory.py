import sys, json, warnings, math
warnings.filterwarnings('ignore')
sys.path.insert(0, '/Users/tingzizhang/biohuez-dashboard')
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

print(json.dumps(result))
