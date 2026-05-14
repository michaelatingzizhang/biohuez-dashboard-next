'use client'
import { LoadingSkeleton } from '@/components/loading-skeleton'
import { DataState } from '@/components/data-state'
import { useEffect, useState } from 'react'
import { MetricCard } from '@/components/metric-card'
import { SectionHeader } from '@/components/section-header'
import { SignalGrid } from '@/components/insight-card'
import { filterByDashboardState, useDashboardFilters } from '@/components/dashboard-filters'
import { ReportSlide } from '@/components/report-slide'
import { ChartStudio, type ChartStudioDataset, type ChartStudioMetricDef } from '@/components/sales-chart-studio'
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts'

// ── Types ────────────────────────────────────────────────────────────────────

interface PlanningRow {
  sku: string
  asin: string
  product_name: string
  snapshot_date: string
  available: number
  inbound_quantity: number
  total_reserved_quantity: number
  unfulfillable_quantity: number
  days_of_supply: number
  total_days_of_supply: number
  historical_days_of_supply: number
  weeks_of_cover_t30: number
  weeks_of_cover_t90: number
  sell_through: number
  units_shipped_t7: number
  units_shipped_t30: number
  units_shipped_t60: number
  units_shipped_t90: number
  inv_age_0_to_30_days: number
  inv_age_31_to_60_days: number
  inv_age_61_to_90_days: number
  inv_age_91_to_180_days: number
  inv_age_181_to_330_days: number
  inv_age_331_to_365_days: number
  inv_age_366_to_455_days: number
  inv_age_456_plus_days: number
  estimated_storage_cost_next_month: number
  your_price: number
  alert: string
  recommended_action: string
  fba_inventory_level_health_status: string
  storage_volume: number
  storage_type: string
  days_of_supply_at_amazon_fulfillment_network?: number
}

interface RestockRow {
  merchant_sku: string
  asin: string
  product_name: string
  available: number
  inbound: number
  total_units: number
  units_sold_last_30_days: number
  sales_last_30_days: number
  total_days_of_supply: number
  days_of_supply_at_amazon_fulfillment_network: number
  recommended_replenishment_qty: number
  recommended_ship_date: string
  recommended_action: string
  alert: string
}

interface LedgerMonthlyRow {
  month: string
  msku: string
  asin: string
  title: string
  starting_warehouse_balance: number
  receipts: number
  customer_shipments: number
  customer_returns: number
  lost: number
  damaged: number
  disposed: number
  ending_warehouse_balance: number
}

interface FCRow {
  fulfillment_center: string
  msku: string
  asin: string
  disposition: string
  quantity: number
}

interface ReceiptEvent {
  date: string
  msku: string
  asin: string
  event_type: string
  reference_id: string
  quantity: number
  fulfillment_center: string
}

interface InventorySignal {
  severity: 'normal' | 'warn' | 'alert'
  title: string
  detail: string
}

interface SkuRiskRow {
  sku: string
  asin: string
  product_name: string
  risk_score: number
  status: 'Healthy' | 'Watch' | 'Critical'
  recommended_action: string
  drivers: string[]
  available: number
  inbound: number
  days_of_supply: number
  units_shipped_t30: number
  daily_velocity: number
  old_units: number
  old_pct: number
  unfulfillable: number
  reserved: number
  storage_cost_next_month: number
  recommended_replenishment_qty: number
}

interface FcConcentrationRow {
  fulfillment_center: string
  total_units: number
  sku_count: number
  pct_of_inventory: number
}

interface MovementAnomalyRow {
  sku: string
  month: string
  shipped_units: number
  received_units: number
  ending_balance: number
  balance_delta: number | null
  lost_units: number
  damaged_units: number
  disposed_units: number
}

interface InventoryInsights {
  summary: {
    sku_count?: number
    critical_count?: number
    watch_count?: number
    excess_count?: number
    total_available?: number
    total_inbound?: number
    total_storage_cost_next_month?: number
    aging_units_181_plus?: number
    avg_days_of_supply?: number | null
  }
  sku_risks: SkuRiskRow[]
  signals: InventorySignal[]
  restock_priorities: SkuRiskRow[]
  aging_exposure: SkuRiskRow[]
  fc_concentration: FcConcentrationRow[]
  movement_anomalies: MovementAnomalyRow[]
}

interface InventoryData {
  inventory_planning: PlanningRow[]
  restock: RestockRow[]
  ledger_monthly: LedgerMonthlyRow[]
  ledger_by_disposition: unknown[]
  fc_distribution: FCRow[]
  receipt_events: ReceiptEvent[]
  event_summary: { event_type: string; msku: string; quantity: number }[]
  insights?: InventoryInsights
  error?: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function shortSku(sku: string) {
  const map: Record<string, string> = {
    'ZH-FH-1B': 'Black (1B)',
    'ZH-FH-3C': 'Chocolate (3C)',
  }
  return map[sku] || sku
}

function agingColor(pct: number) {
  if (pct >= 60) return '#C0392B'
  if (pct >= 30) return '#E67E22'
  return '#2D4A27'
}

function coverageStatus(days: number | null): { label: string; color: string; bg: string } {
  if (days == null || days <= 0) return { label: 'No Data', color: '#888', bg: '#F5F5F5' }
  if (days < 30) return { label: 'Critical', color: '#C0392B', bg: '#FDECEA' }
  if (days < 60) return { label: 'Low', color: '#E67E22', bg: '#FEF3E2' }
  if (days < 120) return { label: 'Healthy', color: '#2D4A27', bg: '#EAF3E8' }
  return { label: 'Excess', color: '#1565C0', bg: '#E3F0FD' }
}

function riskColor(status: SkuRiskRow['status']) {
  if (status === 'Critical') return '#C0392B'
  if (status === 'Watch') return '#E67E22'
  return '#2D4A27'
}

function riskBg(status: SkuRiskRow['status']) {
  if (status === 'Critical') return '#FDECEA'
  if (status === 'Watch') return '#FFF8E1'
  return '#EEF6EC'
}

function fmtNum(n: number | null | undefined) {
  if (n == null) return '—'
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 })
}

function fmtPct(n: number | null | undefined) {
  if (n == null) return '—'
  return Number(n).toFixed(1) + '%'
}

const SKU_COLORS: Record<string, string> = {
  'ZH-FH-1B': '#1A1A1A',
  'ZH-FH-3C': '#8B4513',
}

function inventoryStudioMetric(
  key: string,
  label: string,
  format: ChartStudioMetricDef['format'],
  color: string,
): ChartStudioMetricDef {
  return { key, label, format, color }
}

// ── Component ────────────────────────────────────────────────────────────────

export default function InventoryPage() {
  const [data, setData] = useState<InventoryData | null>(null)
  const [loading, setLoading] = useState(true)
  const filters = useDashboardFilters()

  useEffect(() => {
    fetch('/api/inventory')
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingSkeleton />
  if (!data || data.error) return (
    <DataState
      title="Inventory data could not load"
      description={data?.error || 'Check the inventory data connection and try refreshing this page.'}
      variant="error"
    />
  )

  const planning = filterByDashboardState(data.inventory_planning || [], filters, row => row.snapshot_date, row => row.sku)
  const restock = filterByDashboardState(data.restock || [], filters, undefined, row => row.merchant_sku)
  const ledgerMonthly = filterByDashboardState(data.ledger_monthly || [], filters, row => `${String(row.month).slice(0, 7)}-01`, row => row.msku)
  const fcDist = filterByDashboardState(data.fc_distribution || [], filters, undefined, row => row.msku)
  const receipts = filterByDashboardState(data.receipt_events || [], filters, row => row.date, row => row.msku)
  const baseInsights = data.insights || {
    summary: {},
    sku_risks: [],
    signals: [],
    restock_priorities: [],
    aging_exposure: [],
    fc_concentration: [],
    movement_anomalies: [],
  }
  const filteredSkuRisks = filterByDashboardState(baseInsights.sku_risks, filters, undefined, row => row.sku)
  const insights = {
    ...baseInsights,
    summary: {
      ...baseInsights.summary,
      critical_count: filteredSkuRisks.filter(row => row.status === 'Critical').length,
      watch_count: filteredSkuRisks.filter(row => row.status === 'Watch').length,
      excess_count: filteredSkuRisks.filter(row => row.days_of_supply > 180).length,
      aging_units_181_plus: filteredSkuRisks.reduce((sum, row) => sum + (row.old_units || 0), 0),
      avg_days_of_supply: filteredSkuRisks.length > 0
        ? filteredSkuRisks.reduce((sum, row) => sum + (row.days_of_supply || 0), 0) / filteredSkuRisks.length
        : baseInsights.summary.avg_days_of_supply,
    },
    sku_risks: filteredSkuRisks,
    restock_priorities: filterByDashboardState(baseInsights.restock_priorities, filters, undefined, row => row.sku),
    aging_exposure: filterByDashboardState(baseInsights.aging_exposure, filters, undefined, row => row.sku),
    movement_anomalies: filterByDashboardState(baseInsights.movement_anomalies, filters, row => `${String(row.month).slice(0, 7)}-01`, row => row.sku),
  }
  if (planning.length === 0 && restock.length === 0 && ledgerMonthly.length === 0 && fcDist.length === 0) return (
    <DataState
      title="No inventory data yet"
      description="Coverage, restock, ledger, and fulfillment center data will appear once inventory exports are available."
    />
  )

  // ── KPI Summary ────────────────────────────────────────────────────────────
  const totalAvailable = planning.reduce((s, r) => s + (r.available || 0), 0)
  const totalInbound = planning.reduce((s, r) => s + (r.inbound_quantity || 0), 0)
  const totalUnfulfillable = planning.reduce((s, r) => s + (r.unfulfillable_quantity || 0), 0)
  const avgDOS = planning.length > 0
    ? Math.round(planning.reduce((s, r) => s + (r.total_days_of_supply || r.days_of_supply || 0), 0) / planning.length)
    : 0
  const totalStorageCost = planning.reduce((s, r) => s + (r.estimated_storage_cost_next_month || 0), 0)

  // ── Aging chart data ───────────────────────────────────────────────────────
  const agingData = planning.map(r => {
    const buckets = {
      '0-30d': r.inv_age_0_to_30_days || 0,
      '31-60d': r.inv_age_31_to_60_days || 0,
      '61-90d': r.inv_age_61_to_90_days || 0,
      '91-180d': r.inv_age_91_to_180_days || 0,
      '181-330d': r.inv_age_181_to_330_days || 0,
      '331-365d': r.inv_age_331_to_365_days || 0,
      '366d+': (r.inv_age_366_to_455_days || 0) + (r.inv_age_456_plus_days || 0),
    }
    const total = Object.values(buckets).reduce((a, b) => a + b, 0) || 1
    return { sku: shortSku(r.sku), ...buckets, total }
  })

  // ── Coverage data ──────────────────────────────────────────────────────────
  const coverageData = planning.map(r => ({
    sku: shortSku(r.sku),
    dos_current: r.days_of_supply || 0,
    dos_total: r.total_days_of_supply || 0,
    dos_historical: r.historical_days_of_supply || 0,
    weeks_t30: r.weeks_of_cover_t30 || 0,
    weeks_t90: r.weeks_of_cover_t90 || 0,
    sell_through: r.sell_through || 0,
    units_t7: r.units_shipped_t7 || 0,
    units_t30: r.units_shipped_t30 || 0,
    units_t60: r.units_shipped_t60 || 0,
    units_t90: r.units_shipped_t90 || 0,
  }))

  // ── Ledger monthly trend ───────────────────────────────────────────────────
  const skus = [...new Set(ledgerMonthly.map(r => r.msku))]
  const months = [...new Set(ledgerMonthly.map(r => r.month))].sort()
  const ledgerTrend = months.map(month => {
    const row: Record<string, unknown> = { month }
    skus.forEach(sku => {
      const r = ledgerMonthly.find(x => x.month === month && x.msku === sku)
      row[`${sku}_ending`] = r?.ending_warehouse_balance ?? null
      row[`${sku}_shipped`] = r ? Math.abs(r.customer_shipments || 0) : null
      row[`${sku}_receipts`] = r?.receipts ?? null
    })
    return row
  })

  // ── FC distribution (latest, sellable, grouped by FC) ─────────────────────
  const fcGrouped = fcDist.reduce((acc, row) => {
    const key = row.fulfillment_center
    if (!acc[key]) acc[key] = { fc: key, total: 0, skus: {} as Record<string, number> }
    acc[key].total += row.quantity
    acc[key].skus[row.msku] = (acc[key].skus[row.msku] || 0) + row.quantity
    return acc
  }, {} as Record<string, { fc: string; total: number; skus: Record<string, number> }>)

  const fcList = Object.values(fcGrouped)
    .filter(f => f.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 20)

  const fcChartData = fcList.map(f => ({
    fc: f.fc,
    ...skus.reduce((a, s) => ({ ...a, [shortSku(s)]: f.skus[s] || 0 }), {}),
    total: f.total,
  }))

  // ── Shipment receipts ──────────────────────────────────────────────────────
  const recentReceipts = receipts
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 30)
  const inventoryChartDatasets: ChartStudioDataset[] = [
    {
      key: 'coverage-by-sku',
      label: 'Coverage by SKU',
      subtitle: 'Days of supply, weeks of cover, and sell-through by SKU.',
      xKey: 'sku',
      data: coverageData.map((row) => ({ ...row })),
      metrics: [
        inventoryStudioMetric('dos_total', 'Total DOS', 'number', '#2D4A27'),
        inventoryStudioMetric('weeks_t30', 'Weeks Cover T30', 'number', '#6B8F61'),
        inventoryStudioMetric('weeks_t90', 'Weeks Cover T90', 'number', '#2980B9'),
        inventoryStudioMetric('sell_through', 'Sell Through', 'number', '#AEA33C'),
        inventoryStudioMetric('units_t30', 'Units T30', 'number', '#C0392B'),
      ],
    },
    {
      key: 'aging-exposure',
      label: 'Aging Exposure',
      subtitle: 'Inventory aging buckets by SKU.',
      xKey: 'sku',
      data: agingData.map((row) => ({ ...row })),
      metrics: [
        inventoryStudioMetric('0-30d', '0-30d', 'number', '#B8D4AE'),
        inventoryStudioMetric('31-60d', '31-60d', 'number', '#6B8F61'),
        inventoryStudioMetric('91-180d', '91-180d', 'number', '#E67E22'),
        inventoryStudioMetric('181-330d', '181-330d', 'number', '#C0392B'),
        inventoryStudioMetric('366d+', '366d+', 'number', '#7F1D1D'),
      ],
    },
    {
      key: 'fc-distribution',
      label: 'FC Distribution',
      subtitle: 'Inventory concentration across fulfillment centers.',
      xKey: 'fc',
      data: fcChartData.map((row) => ({ ...row })),
      metrics: [
        inventoryStudioMetric('total', 'Total Units', 'number', '#2D4A27'),
        ...skus.map((sku, index) => inventoryStudioMetric(shortSku(sku), shortSku(sku), 'number', Object.values(SKU_COLORS)[index % Object.values(SKU_COLORS).length] || '#6B8F61')),
      ],
    },
    {
      key: 'sku-risk',
      label: 'SKU Risk',
      subtitle: 'Risk score, coverage, velocity, and aging for priority SKUs.',
      xKey: 'sku',
      data: insights.sku_risks.map((row) => ({ ...row })),
      metrics: [
        inventoryStudioMetric('risk_score', 'Risk Score', 'number', '#C0392B'),
        inventoryStudioMetric('days_of_supply', 'Days of Supply', 'number', '#2D4A27'),
        inventoryStudioMetric('daily_velocity', 'Daily Velocity', 'number', '#6B8F61'),
        inventoryStudioMetric('old_units', 'Old Units', 'number', '#E67E22'),
        inventoryStudioMetric('storage_cost_next_month', 'Storage Cost', 'money', '#2980B9'),
      ],
    },
    {
      key: 'movement-anomalies',
      label: 'Movement Watchlist',
      subtitle: 'Shipped, received, and balance delta by monthly anomaly row.',
      xKey: 'month',
      data: insights.movement_anomalies.map((row) => ({ ...row })),
      metrics: [
        inventoryStudioMetric('shipped_units', 'Shipped', 'number', '#2D4A27'),
        inventoryStudioMetric('received_units', 'Received', 'number', '#6B8F61'),
        inventoryStudioMetric('balance_delta', 'Balance Delta', 'number', '#C0392B'),
        inventoryStudioMetric('ending_balance', 'Ending Balance', 'number', '#2980B9'),
      ],
    },
  ].filter((dataset) => dataset.data.length > 0)

  return (
      <div style={{ paddingBottom: 40 }}>
      <ReportSlide
        title="Inventory Executive Summary"
        message="This slide should quickly show whether inventory coverage is healthy or whether stock and aging risks need action."
        watch="Available units, days of supply, inbound inventory, critical SKUs, and aging exposure."
        action="Use this slide to decide whether the inventory story is stockout risk, excess risk, or stable coverage."
        order={1}
      >
      <div className="dashboard-kpi-grid">
        <MetricCard label="Total Available" value={totalAvailable.toLocaleString()} sublabel="Units at FBA" />
        <MetricCard label="Avg Days of Supply" value={`${avgDOS}d`} sublabel="Across all SKUs" status={avgDOS < 30 ? 'alert' : avgDOS < 60 ? 'warn' : 'normal'} />
        <MetricCard label="Inbound Units" value={totalInbound.toLocaleString()} sublabel="En route to FBA" />
        <MetricCard label="Est. Storage Cost" value={`$${totalStorageCost.toFixed(0)}`} sublabel="Next month" />
      </div>

      <SectionHeader title="Operations Intelligence" subtitle="Stock risk, aging exposure, replenishment urgency, and fulfillment concentration" />
      <div className="dashboard-kpi-grid">
        <MetricCard
          label="Critical SKUs"
          value={String(insights.summary.critical_count ?? 0)}
          sublabel={`${insights.summary.watch_count ?? 0} watchlist`}
          status={(insights.summary.critical_count ?? 0) > 0 ? 'alert' : (insights.summary.watch_count ?? 0) > 0 ? 'warn' : 'normal'}
        />
        <MetricCard
          label="Excess Coverage"
          value={String(insights.summary.excess_count ?? 0)}
          sublabel="SKUs above 180d supply"
          status={(insights.summary.excess_count ?? 0) > 0 ? 'warn' : 'normal'}
        />
        <MetricCard
          label="Aging Units"
          value={fmtNum(insights.summary.aging_units_181_plus)}
          sublabel="181+ days old"
          status={(insights.summary.aging_units_181_plus ?? 0) > 0 ? 'warn' : 'normal'}
        />
        <MetricCard
          label="Avg Supply"
          value={insights.summary.avg_days_of_supply ? `${Math.round(insights.summary.avg_days_of_supply)}d` : `${avgDOS}d`}
          sublabel="Risk-scored coverage"
          status={(insights.summary.avg_days_of_supply ?? avgDOS) > 180 ? 'warn' : (insights.summary.avg_days_of_supply ?? avgDOS) < 60 ? 'warn' : 'normal'}
        />
      </div>

      <SignalGrid signals={insights.signals} />

      {insights.sku_risks.length > 0 && (
        <>
          <SectionHeader title="SKU Risk Scores" subtitle="Combined stockout, excess, aging, storage, and restock signals" />
          <div className="dashboard-table-card" style={{ marginBottom: 20 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #EBEBEB' }}>
                  {['SKU', 'Status', 'Risk', 'Available', 'DOS', 'Velocity', 'Old Units', 'Action', 'Drivers'].map(h => (
                    <th key={h} style={{ padding: '8px 8px', textAlign: ['Available', 'DOS', 'Velocity', 'Old Units', 'Risk'].includes(h) ? 'right' : 'left', color: '#666', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {insights.sku_risks.map(row => {
                  const color = riskColor(row.status)
                  return (
                    <tr key={row.sku} style={{ borderBottom: '1px solid #F5F5F5' }}>
                      <td style={{ padding: '8px 8px', fontWeight: 700 }}>{shortSku(row.sku)}</td>
                      <td style={{ padding: '8px 8px' }}>
                        <span style={{ background: riskBg(row.status), color, border: `1px solid ${color}33`, borderRadius: 4, padding: '2px 8px', fontWeight: 700, fontSize: '0.72rem' }}>
                          {row.status}
                        </span>
                      </td>
                      <td style={{ padding: '8px 8px', textAlign: 'right', color, fontWeight: 800 }}>{row.risk_score}</td>
                      <td style={{ padding: '8px 8px', textAlign: 'right' }}>{fmtNum(row.available)}</td>
                      <td style={{ padding: '8px 8px', textAlign: 'right' }}>{Math.round(row.days_of_supply)}d</td>
                      <td style={{ padding: '8px 8px', textAlign: 'right' }}>{row.daily_velocity.toFixed(1)}/d</td>
                      <td style={{ padding: '8px 8px', textAlign: 'right', color: row.old_units > 0 ? '#E67E22' : '#444' }}>{fmtNum(row.old_units)}</td>
                      <td style={{ padding: '8px 8px', color: '#1A1A1A', fontWeight: 600 }}>{row.recommended_action}</td>
                      <td style={{ padding: '8px 8px', color: '#666', fontSize: '0.72rem' }}>{row.drivers.join(', ') || 'Stable'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16, marginBottom: 20 }}>
        <div>
          <SectionHeader title="FC Concentration" subtitle="Where sellable units are concentrated" />
          <div className="dashboard-table-card">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #EBEBEB' }}>
                  {['FC', 'Units', 'SKUs', '% Inv.'].map(h => (
                    <th key={h} style={{ padding: '8px 8px', textAlign: h === 'FC' ? 'left' : 'right', color: '#666', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {insights.fc_concentration.slice(0, 8).map(row => (
                  <tr key={row.fulfillment_center} style={{ borderBottom: '1px solid #F5F5F5' }}>
                    <td style={{ padding: '8px 8px', fontFamily: 'monospace', fontWeight: 700 }}>{row.fulfillment_center}</td>
                    <td style={{ padding: '8px 8px', textAlign: 'right' }}>{fmtNum(row.total_units)}</td>
                    <td style={{ padding: '8px 8px', textAlign: 'right' }}>{row.sku_count}</td>
                    <td style={{ padding: '8px 8px', textAlign: 'right' }}>{fmtPct(row.pct_of_inventory)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <SectionHeader title="Movement Watchlist" subtitle="Latest balance movement by SKU" />
          <div className="dashboard-table-card">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #EBEBEB' }}>
                  {['SKU', 'Month', 'Shipped', 'Received', 'Balance Δ'].map(h => (
                    <th key={h} style={{ padding: '8px 8px', textAlign: h === 'SKU' || h === 'Month' ? 'left' : 'right', color: '#666', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {insights.movement_anomalies.slice(0, 8).map(row => (
                  <tr key={`${row.sku}-${row.month}`} style={{ borderBottom: '1px solid #F5F5F5' }}>
                    <td style={{ padding: '8px 8px', fontWeight: 700 }}>{shortSku(row.sku)}</td>
                    <td style={{ padding: '8px 8px' }}>{row.month}</td>
                    <td style={{ padding: '8px 8px', textAlign: 'right' }}>{fmtNum(row.shipped_units)}</td>
                    <td style={{ padding: '8px 8px', textAlign: 'right' }}>{fmtNum(row.received_units)}</td>
                    <td style={{ padding: '8px 8px', textAlign: 'right', color: (row.balance_delta ?? 0) < 0 ? '#C0392B' : '#2D4A27', fontWeight: 700 }}>
                      {row.balance_delta == null ? '—' : `${row.balance_delta > 0 ? '+' : ''}${fmtNum(row.balance_delta)}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      </ReportSlide>

      <ReportSlide
        title="Inventory Coverage And Aging"
        message="This slide should show how protected each SKU is and where aging inventory is starting to become a drag."
        watch="Coverage by SKU, velocity, weeks of cover, and old inventory buckets."
        action="Use this slide to prioritize restocks, cleanups, and slow-moving SKUs."
        order={2}
      >
      <SectionHeader title="Inventory Coverage by SKU" subtitle="Days of supply, velocity, and health status" />
      <div className="dashboard-card-grid">
        {planning.map(r => {
          const dos = r.total_days_of_supply || r.days_of_supply || 0
          const status = coverageStatus(dos)
          const dailyVelocity = r.units_shipped_t30 ? (r.units_shipped_t30 / 30).toFixed(1) : '—'
          const restockRow = restock.find(x => x.merchant_sku === r.sku)
          return (
            <div key={r.sku} style={{ background: 'white', borderRadius: 10, padding: 20, border: '1px solid #EBEBEB' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: '#1A1A1A' }}>{shortSku(r.sku)}</div>
                  <div style={{ fontSize: '0.72rem', color: '#888', marginTop: 2 }}>{r.asin}</div>
                </div>
                <div style={{
                  background: status.bg, color: status.color,
                  borderRadius: 6, padding: '3px 10px', fontSize: '0.75rem', fontWeight: 600,
                }}>
                  {status.label}
                </div>
              </div>

              {/* Coverage bar */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: 4 }}>
                  <span style={{ color: '#555' }}>Days of Supply</span>
                  <span style={{ fontWeight: 700, color: status.color }}>{dos > 0 ? `${dos}d` : '—'}</span>
                </div>
                <div style={{ height: 6, background: '#F0F0F0', borderRadius: 4 }}>
                  <div style={{
                    height: '100%', borderRadius: 4,
                    background: status.color,
                    width: `${Math.min(100, (dos / 180) * 100)}%`,
                  }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                  <span style={{ fontSize: '0.68rem', color: '#AAA' }}>0d</span>
                  <span style={{ fontSize: '0.68rem', color: '#AAA' }}>60d</span>
                  <span style={{ fontSize: '0.68rem', color: '#AAA' }}>120d</span>
                  <span style={{ fontSize: '0.68rem', color: '#AAA' }}>180d+</span>
                </div>
              </div>

              {/* Stats grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <Stat label="Available" value={r.available?.toLocaleString() ?? '—'} />
                <Stat label="Inbound" value={r.inbound_quantity?.toLocaleString() ?? '—'} />
                <Stat label="Units/day (30d)" value={dailyVelocity} />
                <Stat label="Shipped (30d)" value={r.units_shipped_t30?.toLocaleString() ?? '—'} />
                <Stat label="Weeks cover (T30)" value={r.weeks_of_cover_t30 ? `${r.weeks_of_cover_t30.toFixed(1)}w` : '—'} />
                <Stat label="Sell-through" value={r.sell_through ? `${(r.sell_through * 100).toFixed(0)}%` : '—'} />
                {totalUnfulfillable > 0 && <Stat label="Unfulfillable" value={r.unfulfillable_quantity?.toLocaleString() ?? '0'} warn />}
                <Stat label="Storage Cost" value={r.estimated_storage_cost_next_month ? `$${r.estimated_storage_cost_next_month.toFixed(0)}` : '—'} />
              </div>

              {/* Amazon alert / action */}
              {r.alert && r.alert !== 'None' && r.alert !== '' && (
                <div style={{ marginTop: 12, background: '#FEF3E2', borderRadius: 6, padding: '6px 10px', fontSize: '0.75rem', color: '#B7720A', fontWeight: 500 }}>
                  Alert: {r.alert}
                </div>
              )}
              {restockRow?.recommended_action && restockRow.recommended_action !== 'No action required' && (
                <div style={{ marginTop: 6, background: '#FDECEA', borderRadius: 6, padding: '6px 10px', fontSize: '0.75rem', color: '#C0392B', fontWeight: 500 }}>
                  Amazon recommends: {restockRow.recommended_action}
                  {restockRow.recommended_replenishment_qty ? ` (${restockRow.recommended_replenishment_qty} units)` : ''}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Velocity Table */}
      <SectionHeader title="Sales Velocity by SKU" subtitle="Units shipped over 7/30/60/90 day windows" />
      <div className="dashboard-table-card" style={{ marginBottom: 20 }}>
        {coverageData.length === 0 ? (
          <DataState title="No velocity data available" />
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #EBEBEB' }}>
                {['SKU', 'Units T7', 'Units T30', 'Units T60', 'Units T90', 'Daily Rate (T30)', 'Weeks Cover (T30)', 'Weeks Cover (T90)'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: h === 'SKU' ? 'left' : 'right', color: '#666', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {coverageData.map(r => (
                <tr key={r.sku} style={{ borderBottom: '1px solid #F5F5F5' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 600 }}>{r.sku}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>{r.units_t7}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>{r.units_t30}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>{r.units_t60}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>{r.units_t90}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>{r.units_t30 ? (r.units_t30 / 30).toFixed(1) : '—'}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>{r.weeks_t30 ? `${r.weeks_t30.toFixed(1)}w` : '—'}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>{r.weeks_t90 ? `${r.weeks_t90.toFixed(1)}w` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Inventory Aging */}
      <SectionHeader title="Inventory Aging" subtitle="Units by age bucket — older inventory risks long-term storage fees" />
      <div className="dashboard-chart-card" style={{ background: 'white', borderRadius: 10, padding: 16, marginBottom: 20 }}>
        {agingData.length === 0 ? (
          <p style={{ color: '#888', textAlign: 'center' }}>No aging data</p>
        ) : (
          <>
            {/* Stacked bar chart */}
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={agingData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#EBEBEB" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="sku" type="category" width={120} tick={{ fontSize: 12, fontWeight: 600 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="0-30d" stackId="a" fill="#2D4A27" name="0-30 days" />
                <Bar dataKey="31-60d" stackId="a" fill="#5A8C4E" name="31-60 days" />
                <Bar dataKey="61-90d" stackId="a" fill="#8EBF83" name="61-90 days" />
                <Bar dataKey="91-180d" stackId="a" fill="#E67E22" name="91-180 days" />
                <Bar dataKey="181-330d" stackId="a" fill="#C0392B" name="181-330 days" />
                <Bar dataKey="331-365d" stackId="a" fill="#922B21" name="331-365 days" />
                <Bar dataKey="366d+" stackId="a" fill="#5B0000" name="366+ days" />
              </BarChart>
            </ResponsiveContainer>

            {/* Aging table */}
            <div className="dashboard-table-card" style={{ marginTop: 16 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #EBEBEB' }}>
                    {['SKU', '0-30d', '31-60d', '61-90d', '91-180d', '181-330d', '331-365d', '366d+', 'Total'].map(h => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: h === 'SKU' ? 'left' : 'right', color: '#666', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {agingData.map(r => {
                    const oldPct = r.total > 0 ? ((r['181-330d'] + r['331-365d'] + r['366d+']) / r.total * 100) : 0
                    return (
                      <tr key={r.sku} style={{ borderBottom: '1px solid #F5F5F5' }}>
                        <td style={{ padding: '8px 10px', fontWeight: 600 }}>{r.sku}</td>
                        {(['0-30d', '31-60d', '61-90d', '91-180d', '181-330d', '331-365d', '366d+'] as const).map(b => (
                          <td key={b} style={{ padding: '8px 10px', textAlign: 'right', color: ['181-330d', '331-365d', '366d+'].includes(b) && r[b] > 0 ? '#C0392B' : '#1A1A1A' }}>
                            {(r[b] as number).toLocaleString()}
                          </td>
                        ))}
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>
                          {r.total.toLocaleString()}
                          {oldPct > 10 && (
                            <span style={{ marginLeft: 6, fontSize: '0.7rem', color: '#C0392B' }}>
                              ({oldPct.toFixed(0)}% old)
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
      </ReportSlide>

      <ReportSlide
        title="Inventory Flow And Placement"
        message="This slide should explain where inventory is sitting and how it is moving through the network."
        watch="Ledger movement history, FC concentration, and recent receipt events."
        action="Use this slide when the discussion turns to operational execution instead of just stock level risk."
        order={3}
      >
      <SectionHeader title="Inventory Movement History" subtitle="Monthly balance changes by SKU (FBA sellable)" />
      <div className="dashboard-chart-card" style={{ background: 'white', borderRadius: 10, padding: 16, marginBottom: 20 }}>
        {ledgerTrend.length === 0 ? (
          <p style={{ color: '#888', textAlign: 'center' }}>No ledger data</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={ledgerTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EBEBEB" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                {skus.map(sku => (
                  <Line
                    key={sku}
                    type="monotone"
                    dataKey={`${sku}_ending`}
                    stroke={SKU_COLORS[sku] || '#888'}
                    strokeWidth={2.5}
                    dot
                    name={`${shortSku(sku)} ending balance`}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>

            {/* Monthly movement table */}
            <div className="dashboard-table-card" style={{ marginTop: 16 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #EBEBEB' }}>
                    {['Month', 'SKU', 'Opening', 'Receipts', 'Shipped', 'Returns', 'Lost', 'Damaged', 'Closing'].map(h => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: h === 'Month' || h === 'SKU' ? 'left' : 'right', color: '#666', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...ledgerMonthly]
                    .sort((a, b) => `${b.month}${b.msku}`.localeCompare(`${a.month}${a.msku}`))
                    .slice(0, 30)
                    .map((r, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #F5F5F5' }}>
                        <td style={{ padding: '8px 10px' }}>{r.month}</td>
                        <td style={{ padding: '8px 10px', fontWeight: 600 }}>{shortSku(r.msku)}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right' }}>{r.starting_warehouse_balance?.toLocaleString()}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', color: '#2D4A27', fontWeight: 500 }}>{r.receipts ? `+${r.receipts.toLocaleString()}` : '0'}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', color: '#444' }}>{r.customer_shipments ? Math.abs(r.customer_shipments).toLocaleString() : '0'}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', color: '#2D4A27' }}>{r.customer_returns ? `+${r.customer_returns.toLocaleString()}` : '0'}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', color: r.lost && r.lost < 0 ? '#C0392B' : '#444' }}>{r.lost || 0}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', color: r.damaged && r.damaged < 0 ? '#C0392B' : '#444' }}>{r.damaged || 0}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700 }}>{r.ending_warehouse_balance?.toLocaleString()}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* FC Distribution */}
      <SectionHeader title="Where Inventory Sits" subtitle="Units by Amazon fulfillment center (sellable disposition)" />
      <div className="dashboard-chart-card" style={{ background: 'white', borderRadius: 10, padding: 16, marginBottom: 20 }}>
        {fcChartData.length === 0 ? (
          <p style={{ color: '#888', textAlign: 'center' }}>No FC distribution data</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={Math.max(200, fcChartData.length * 28)}>
              <BarChart data={fcChartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#EBEBEB" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="fc" type="category" width={60} tick={{ fontSize: 11, fontFamily: 'monospace' }} />
                <Tooltip />
                <Legend />
                {skus.map(sku => (
                  <Bar key={sku} dataKey={shortSku(sku)} stackId="a" fill={SKU_COLORS[sku] || '#888'} name={shortSku(sku)} />
                ))}
              </BarChart>
            </ResponsiveContainer>

            {/* FC table */}
            <div className="dashboard-table-card" style={{ marginTop: 16 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #EBEBEB' }}>
                    <th style={{ padding: '8px 10px', textAlign: 'left', color: '#666', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase' }}>FC</th>
                    {skus.map(s => (
                      <th key={s} style={{ padding: '8px 10px', textAlign: 'right', color: '#666', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase' }}>{shortSku(s)}</th>
                    ))}
                    <th style={{ padding: '8px 10px', textAlign: 'right', color: '#666', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {fcList.map(f => (
                    <tr key={f.fc} style={{ borderBottom: '1px solid #F5F5F5' }}>
                      <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontWeight: 600 }}>{f.fc}</td>
                      {skus.map(s => (
                        <td key={s} style={{ padding: '8px 10px', textAlign: 'right' }}>{f.skus[s]?.toLocaleString() || '—'}</td>
                      ))}
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700 }}>{f.total.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Shipment Receipt History */}
      <SectionHeader title="Shipment / Receipt History" subtitle="Recent inbound inventory events at FBA" />
      <div className="dashboard-table-card" style={{ marginBottom: 20 }}>
        {recentReceipts.length === 0 ? (
          <p style={{ color: '#888', textAlign: 'center' }}>No shipment receipt data</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #EBEBEB' }}>
                {['Date', 'SKU', 'Event Type', 'FC', 'Reference ID', 'Qty'].map(h => (
                  <th key={h} style={{ padding: '8px 10px', textAlign: h === 'Qty' ? 'right' : 'left', color: '#666', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentReceipts.map((r, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #F5F5F5' }}>
                  <td style={{ padding: '8px 10px' }}>{r.date}</td>
                  <td style={{ padding: '8px 10px', fontWeight: 600 }}>{shortSku(r.msku)}</td>
                  <td style={{ padding: '8px 10px', color: '#555' }}>{r.event_type}</td>
                  <td style={{ padding: '8px 10px', fontFamily: 'monospace' }}>{r.fulfillment_center || '—'}</td>
                  <td style={{ padding: '8px 10px', color: '#888', fontSize: '0.75rem' }}>{r.reference_id || '—'}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, color: Number(r.quantity) > 0 ? '#2D4A27' : '#C0392B' }}>
                    {Number(r.quantity) > 0 ? `+${r.quantity}` : r.quantity}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      </ReportSlide>

      <div className="dashboard-chart-card" style={{ background: 'white', borderRadius: 12, padding: 16 }}>
        <SectionHeader
          title="Inventory Custom Modules"
          subtitle="Build reusable inventory modules from coverage, aging, FC concentration, and movement datasets."
        />
        <ChartStudio
          datasets={inventoryChartDatasets}
          storageKey="biohuez:inventory-custom-chart-modules"
          pagePath="/inventory"
          pageLabel="Inventory"
          description="Build reusable inventory chart cards from coverage, aging, FC distribution, risk, and movement datasets."
          titlePlaceholder="Coverage Story"
          seedSuffix="Module"
          reportSlidePrefix="Inventory Custom Module"
        />
      </div>
    </div>
  )
}

// ── Small stat helper ─────────────────────────────────────────────────────────
function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div style={{ background: '#FAFAFA', borderRadius: 6, padding: '8px 10px' }}>
      <div style={{ fontSize: '0.68rem', color: '#888', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: '0.88rem', fontWeight: 700, color: warn ? '#C0392B' : '#1A1A1A' }}>{value}</div>
    </div>
  )
}
