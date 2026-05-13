'use client'

import { useEffect, useState } from 'react'
import { MetricCard } from '@/components/metric-card'
import { LoadingSkeleton } from '@/components/loading-skeleton'
import { SectionHeader } from '@/components/section-header'
import { DataFootnote, DataState } from '@/components/data-state'
import { SignalGrid } from '@/components/insight-card'
import { Pill, StatusDot } from '@/components/ui/pill'
import {
  ArrowDownRight, ArrowUpRight, BarChart3, Boxes,
  DollarSign, ShoppingCart, Sparkles, TrendingUp,
} from 'lucide-react'
import { filterByDashboardState, normalizeSku, useDashboardFilters } from '@/components/dashboard-filters'
import {
  Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ComposedChart, Line,
  PieChart, Pie, Cell
} from 'recharts'
import { ReportSlide } from '@/components/report-slide';
import { ChartCard } from '@/components/ui/chart-card';
import {
  AXIS_TICK, ChartGradients, ChartLegend, ChartTooltip,
  GRID_PROPS, SKU_PALETTE, fmtCompactCurrency, fmtCurrency, slug,
} from '@/components/chart-theme'

const SKU_COLORS: Record<string, string> = {
  'Black': '#2D4A27',
  'Chocolate': '#6B8F61',
  'Cream Latte': '#B8D4AE',
}


const SKU_NAMES = ['Black', 'Chocolate', 'Cream Latte', ] as const

const SKU_LABELS: Record<string, string> = {
  black: 'Black',
  chocolate: 'Chocolate',
  'cream latte': 'Cream Latte',
}

function canonicalSkuName(value: unknown) {
  const raw = String(value || '').trim()
  if (!raw) return 'Unknown SKU'
  return SKU_LABELS[normalizeSku(raw)] || raw
}

type SalesRow = { date: string; sku_name: string; revenue: number; orders: number; units: number }
type InvRow = { sku_name: string; total_quantity: number }
type SummaryMeta = { last_updated?: string | null; sales_last_date?: string | null; inventory_last_fetched_at?: string | null }
type ExecutiveInsight = {
  section: string
  href: string
  severity: 'critical' | 'warning' | 'positive' | 'neutral' | string
  title: string
  detail: string
}
type ExecutiveInsights = {
  items: ExecutiveInsight[]
  counts: Record<string, number>
  sources: { section: string; href: string; error?: string; signal_count: number }[]
}

function inventoryStatus(qty: number) {
  if (qty < 100) return { tone: 'ruby' as const, label: 'Low stock' }
  if (qty < 300) return { tone: 'gold' as const, label: 'Monitor' }
  return { tone: 'sage' as const, label: 'Healthy' }
}

function fmtMoney(n: number | null | undefined) {
  if (n == null) return '—'
  return '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 })
}

function deltaPctTrend(arr: number[]) {
  if (arr.length < 14) return null
  const half = Math.floor(arr.length / 2)
  const prev = arr.slice(0, half).reduce((a, b) => a + b, 0)
  const curr = arr.slice(half).reduce((a, b) => a + b, 0)
  if (prev === 0) return null
  return ((curr - prev) / prev) * 100
}

export default function SummaryPage() {
  const [rawSales, setSales] = useState<SalesRow[]>([])
  const [rawInventory, setInventory] = useState<InvRow[]>([])
  const [meta, setMeta] = useState<SummaryMeta | null>(null)
  const [executiveInsights, setExecutiveInsights] = useState<ExecutiveInsights | null>(null)
  const [insightsLoading, setInsightsLoading] = useState(true)
  const [insightsError, setInsightsError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const filters = useDashboardFilters()

  useEffect(() => {
    fetch('/api/summary')
      .then(r => r.json())
      .then(d => {
        setSales(d.sales || [])
        setInventory(d.inventory || [])
        setMeta(d.meta || null)
        setLoading(false)
      })
      .catch(e => { setError(String(e)); setLoading(false) })
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 35_000)

    fetch('/api/executive-insights', { signal: controller.signal })
      .then(r => r.json())
      .then(d => {
        if (d.error) setInsightsError(d.error)
        setExecutiveInsights(d)
      })
      .catch(e => setInsightsError(e instanceof Error ? e.message : String(e)))
      .finally(() => {
        window.clearTimeout(timeout)
        setInsightsLoading(false)
      })

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [])

  const sales = filterByDashboardState(rawSales, filters, row => row.date, row => row.sku_name)
    .map(row => ({ ...row, sku_name: canonicalSkuName(row.sku_name) }))
  const inventoryTotals: Record<string, InvRow> = {}
  for (const row of filterByDashboardState(rawInventory, filters, undefined, row => row.sku_name)) {
    const skuName = canonicalSkuName(row.sku_name)
    inventoryTotals[skuName] ||= { sku_name: skuName, total_quantity: 0 }
    inventoryTotals[skuName].total_quantity += row.total_quantity || 0
  }
  const inventory = Object.values(inventoryTotals).sort((a, b) => a.sku_name.localeCompare(b.sku_name))



  
  // KPI calculations
  const totalRevenue = sales.reduce((s, r) => s + (r.revenue || 0), 0)
  const totalOrders = sales.reduce((s, r) => s + (r.orders || 0), 0)
  const totalUnits = sales.reduce((s, r) => s + (r.units || 0), 0)
  const aov = totalOrders > 0 ? totalRevenue / totalOrders : 0
  const asp = totalUnits > 0 ? totalRevenue / totalUnits : 0

  // Date range
  const dates = [...new Set(sales.map(r => r.date))].sort()
  const startDate = dates[0]?.slice(0, 10) || ''
  const endDate = dates[dates.length - 1]?.slice(0, 10) || ''
  const sublabel = startDate && endDate ? `${startDate} – ${endDate}` : 'All time'

  // Revenue chart data: aggregate by date across SKUs
  const revenueByDate: Record<string, Record<string, number>> = {}
  for (const row of sales) {
    const d = row.date?.slice(0, 10)
    if (!d) continue
    if (!revenueByDate[d]) revenueByDate[d] = {}
    revenueByDate[d][row.sku_name] = (revenueByDate[d][row.sku_name] || 0) + row.revenue
  }
  const revenueChartData = Object.entries(revenueByDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, skus]) => {
      const totalUnitsOnDate = sales.filter(r => r.date?.slice(0, 10) === date).reduce((s, r) => s + r.units, 0)
      const totalRevOnDate = Object.values(skus).reduce((s, v) => s + v, 0)
      return { date, ...skus, asp: totalUnitsOnDate > 0 ? +(totalRevOnDate / totalUnitsOnDate).toFixed(2) : 0 }
    })
    .slice(-90)

  // Orders by date grouped
  const ordersByDate: Record<string, Record<string, number>> = {}
  const unitsByDate: Record<string, Record<string, number>> = {}
  for (const row of sales) {
    const d = row.date?.slice(0, 10)
    if (!d) continue
    if (!ordersByDate[d]) ordersByDate[d] = {}
    if (!unitsByDate[d]) unitsByDate[d] = {}
    ordersByDate[d][row.sku_name] = (ordersByDate[d][row.sku_name] || 0) + row.orders
    unitsByDate[d][row.sku_name] = (unitsByDate[d][row.sku_name] || 0) + row.units
  }
  const ordersChartData = Object.entries(ordersByDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, skus]) => ({ date, ...skus }))
    .slice(-90)
  const unitsChartData = Object.entries(unitsByDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, skus]) => ({ date, ...skus }))
    .slice(-90)

  // SKU totals for table
  const skuTotals: Record<string, { revenue: number; orders: number; units: number }> = {}
  for (const row of sales) {
    if (!skuTotals[row.sku_name]) skuTotals[row.sku_name] = { revenue: 0, orders: 0, units: 0 }
    skuTotals[row.sku_name].revenue += row.revenue
    skuTotals[row.sku_name].orders += row.orders
    skuTotals[row.sku_name].units += row.units
  }
  const skuRows = Object.entries(skuTotals).sort((a, b) => b[1].revenue - a[1].revenue)
  const skuNames = Object.keys(SKU_COLORS)

   // ---- Series builders ----
  const dailyRevByDate: Record<string, number> = {}
  const dailyOrdersByDate: Record<string, number> = {}
  const dailyUnitsByDate: Record<string, number> = {}
  const revBySkuDate: Record<string, Record<string, number>> = {}
  const ordersBySkuDate: Record<string, Record<string, number>> = {}
  const unitsBySkuDate: Record<string, Record<string, number>> = {}

  for (const row of sales) {
    const d = row.date?.slice(0, 10)
    if (!d) continue
    dailyRevByDate[d] = (dailyRevByDate[d] || 0) + row.revenue
    dailyOrdersByDate[d] = (dailyOrdersByDate[d] || 0) + row.orders
    dailyUnitsByDate[d] = (dailyUnitsByDate[d] || 0) + row.units
    revBySkuDate[d] = revBySkuDate[d] || {}
    revBySkuDate[d][row.sku_name] = (revBySkuDate[d][row.sku_name] || 0) + row.revenue
    ordersBySkuDate[d] = ordersBySkuDate[d] || {}
    ordersBySkuDate[d][row.sku_name] = (ordersBySkuDate[d][row.sku_name] || 0) + row.orders
    unitsBySkuDate[d] = unitsBySkuDate[d] || {}
    unitsBySkuDate[d][row.sku_name] = (unitsBySkuDate[d][row.sku_name] || 0) + row.units
  }

  if (loading) return <LoadingSkeleton />
  if (error) return <DataState variant="error" title="Summary data could not load" description={error} />

 const sortedDates = Object.keys(revBySkuDate).sort()
  const trail = sortedDates.slice(-90)

    // Sparkline data (last 30 days)
  const recentDates = sortedDates.slice(-30)
  const revSparkSeries = recentDates.map(d => dailyRevByDate[d] || 0)
  const ordersSparkSeries = recentDates.map(d => dailyOrdersByDate[d] || 0)
  const unitsSparkSeries = recentDates.map(d => dailyUnitsByDate[d] || 0)

const revDelta = deltaPctTrend(revSparkSeries)
  const ordersDelta = deltaPctTrend(ordersSparkSeries)
  const unitsDelta = deltaPctTrend(unitsSparkSeries)

  const insightItems = executiveInsights?.items || []
  const insightCounts = executiveInsights?.counts || {}
  const sourceErrors = executiveInsights?.sources?.filter(s => s.error) || []

    const formatTickDate = (v: string) => v?.slice(5)


  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <SectionHeader title="Executive Insights" subtitle="Highest-priority Tier 2 signals across the dashboard" />
      {insightsLoading ? (
        <div style={{ background: 'white', borderRadius: 10, padding: 16, marginBottom: 20, color: '#888', fontSize: '0.85rem' }}>
          Loading executive insights...
        </div>
      ) : insightItems.length > 0 ? (
        <>
          <div className="dashboard-kpi-grid-tight">
            <MetricCard label="Critical" value={(insightCounts.critical || 0).toLocaleString()} sublabel="Needs action" status={(insightCounts.critical || 0) > 0 ? 'alert' : 'normal'} />
            <MetricCard label="Watch Items" value={(insightCounts.warning || 0).toLocaleString()} sublabel="Monitor closely" status={(insightCounts.warning || 0) > 0 ? 'warn' : 'normal'} />
            <MetricCard label="Wins" value={(insightCounts.positive || 0).toLocaleString()} sublabel="Positive signals" />
            <MetricCard label="Sections Scanned" value={(executiveInsights?.sources?.length || 0).toLocaleString()} sublabel="Sales, finance, ops, market" />
          </div>

          <SignalGrid signals={insightItems} columns={3} compact={false} />
        </>
      ) : (
        <DataState title="No executive insights available" description={insightsError || "Detailed page signals have not returned any summary items yet."} />
      )}

      {sourceErrors.length > 0 && (
        <div style={{ background: '#FFF8E1', border: '1px solid #E67E22', borderRadius: 8, padding: 12, marginBottom: 20, color: '#8B5E00', fontSize: '0.78rem' }}>
          Some insight sources could not be scanned: {sourceErrors.map(s => s.section).join(', ')}.
        </div>
      )}

      {/* Top KPIs */}
      <ReportSlide
        title="Topline Performance"
        order={2}
        message="Revenue, orders, units, AOV and ASP — the topline pulse of the brand."
        watch="Trend direction (14-day delta) on Revenue, Orders, Units."
        action="Drill into Sales when growth or pricing changes."
      >
      <SectionHeader
        eyebrow="Topline Performance"
        title="Revenue, orders, units & price"
        subtitle={sublabel}
      />
      <div className="dashboard-kpi-grid-tight" data-testid="topline-kpis">
        <MetricCard label="Total Revenue" value={fmtCurrency(totalRevenue)} sublabel={sublabel} delta={revDelta} deltaLabel="14-day change" trend={revSparkSeries} status="normal" icon={DollarSign} testId="kpi-revenue" />
        <MetricCard label="Total Orders" value={totalOrders.toLocaleString()} sublabel={sublabel} delta={ordersDelta} deltaLabel="14-day change" trend={ordersSparkSeries} status="info" icon={ShoppingCart} testId="kpi-orders" />
        <MetricCard label="Units Sold" value={totalUnits.toLocaleString()} sublabel={sublabel} delta={unitsDelta} deltaLabel="14-day change" trend={unitsSparkSeries} status="info" icon={BarChart3} testId="kpi-units" />
        <MetricCard label="Avg Order Value" value={fmtCurrency(aov)} sublabel="Revenue ÷ orders" status="normal" testId="kpi-aov" />
        <MetricCard label="Avg Selling Price" value={fmtCurrency(asp)} sublabel="Revenue ÷ units" status="gold" testId="kpi-asp" />
      </div>
      </ReportSlide>

      {/* Inventory tiles */}
      {inventory.length > 0 && (
        <ReportSlide
          title="FBA Inventory Health"
          order={3}
          message="Stock health by SKU at the latest fulfillment-center snapshot."
          watch="Anything tagged Low (&lt;100 units) or Monitor (&lt;300)."
          action="Trigger a restock for any Low SKU before it stocks-out."
        >
          <SectionHeader eyebrow="FBA Inventory" title="Stock health by SKU" subtitle="Auto-tagged thresholds: low (&lt;100), monitor (&lt;300), healthy" />
          <div className="dashboard-kpi-grid-tight" data-testid="inventory-tiles">
            {inventory.map((inv, index) => {
              const qty = inv.total_quantity || 0
              const status = inventoryStatus(qty)
              return (
                <MetricCard
                  key={`${inv.sku_name}-${index}`}
                  label={inv.sku_name}
                  value={`${qty.toLocaleString()}`}
                  sublabel={
                    <span className="inline-flex items-center gap-1.5">
                      units
                      <Pill tone={status.tone} size="sm">{status.label}</Pill>
                    </span>
                  }
                  status={status.tone === 'ruby' ? 'alert' : status.tone === 'gold' ? 'warn' : 'normal'}
                  icon={Boxes}
                  testId={`inv-${slug(inv.sku_name)}`}
                />
              )
            })}
          </div>
        </ReportSlide>
      )}


     {/* Revenue & ASP Composed Chart */}
      <ReportSlide
        title="Revenue & ASP"
        order={4}
        message="Daily revenue stacked by SKU with ASP overlay — does revenue movement match price movement?"
        watch="Stack composition shifts and ASP-line divergence from revenue."
        action="If ASP rises while revenue falls, investigate volume/elasticity in Sales."
      >
        <SectionHeader title="Daily revenue stack with price overlay" subtitle="Stacked by SKU · ASP shown on right axis" />
        {revenueChartData.length > 0 ? (
          <ChartCard testId="chart-revenue-asp">
            <ResponsiveContainer width="100%" height={340}>
              <ComposedChart data={revenueChartData} margin={{ top: 6, right: 18, left: 6, bottom: 12 }}>
                <ChartGradients />
                <CartesianGrid {...GRID_PROPS} />
                <XAxis dataKey="date" tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={formatTickDate} tickMargin={8} />
                <YAxis yAxisId="left" tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={fmtCompactCurrency} tickMargin={6} tickCount={5} />
                <YAxis yAxisId="right" orientation="right" tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={(v: number) => fmtCurrency(v)} tickMargin={6} tickCount={5} />
                <Tooltip
                  cursor={{ stroke: '#275719', strokeOpacity: 0.18, strokeWidth: 1 }}
                  content={({ active, payload, label }) => (
                    <ChartTooltip
                      active={active}
                      payload={payload as never}
                      label={label as string}
                      valueFormatter={(v) => fmtCurrency(v)}
                    />
                  )}
                />
                <Legend content={(props) => <ChartLegend payload={props.payload as never} />} />
                {SKU_NAMES.map(sku => (
                  <Area
                    key={sku}
                    yAxisId="left"
                    type="monotone"
                    dataKey={sku}
                    stackId="rev"
                    stroke={SKU_PALETTE[sku]}
                    fill={`url(#sku-${slug(sku)})`}
                    strokeWidth={1.5}
                    fillOpacity={1}
                    isAnimationActive
                    animationDuration={650}
                    animationEasing="ease-out"
                  />
                ))}
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="asp"
                  stroke="#AEA33C"
                  strokeWidth={2.2}
                  strokeDasharray="3 3"
                  dot={false}
                  name="ASP"
                  isAnimationActive
                  animationDuration={900}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>
        ) : <DataState title="No sales data available" description="Sales rows are not available for the selected data source yet." />}
      </ReportSlide>

      {/* Orders & Units */}
      <SectionHeader title="Orders & Units" />
      <div className="dashboard-chart-grid">
        <div className="dashboard-chart-card" style={{ background: 'white', borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 8 }}>Orders</div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={unitsChartData} margin={{ top: 5, right: 10, left: 5, bottom: 20 }} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#EBEBEB" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={(v: string) => v.slice(5)} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend />
              {skuNames.map(sku => (
                <Bar key={sku} dataKey={sku} fill={SKU_COLORS[sku]} name={sku} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="dashboard-chart-card" style={{ background: 'white', borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 8 }}>Units Sold</div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={ordersChartData} margin={{ top: 5, right: 10, left: 5, bottom: 20 }} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#EBEBEB" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={(v: string) => v.slice(5)} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend />
              {skuNames.map(sku => (
                <Bar key={sku} dataKey={sku} fill={SKU_COLORS[sku]} name={sku} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* SKU Mix */}
      <ReportSlide
        title="SKU Mix"
        order={6}
        message="Revenue, units and ASP composition by SKU — which SKU is carrying the brand?"
        watch="Concentration risk if one SKU exceeds 60% of revenue."
        action="Use Demographics + Returns to validate the leading SKU's quality."
      >
        <SectionHeader  title="Revenue, units & ASP by SKU" />
        <div className="dashboard-mini-chart-grid" data-testid="sku-mix-grid">
          {(() => {
            const revPieData = skuRows.map(([sku, t]) => ({ name: sku, value: t.revenue }))
            const unitsPieData = skuRows.map(([sku, t]) => ({ name: sku, value: t.units }))
            const aspBarData = skuRows.map(([sku, t]) => ({ sku, asp: t.units > 0 ? t.revenue / t.units : 0 }))
            return (
              <>
                <ChartCard title="Revenue by SKU"  testId="chart-sku-revenue">
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie
                        data={revPieData}
                        cx="50%" cy="50%"
                        innerRadius={62} outerRadius={96}
                        dataKey="value" stroke="#FFFFFF" strokeWidth={2.5}
                        paddingAngle={2}
                        isAnimationActive animationDuration={650}
                        label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ''} · ${((percent ?? 0) * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {revPieData.map((entry, i) => <Cell key={i} fill={SKU_PALETTE[entry.name] || '#5A774C'} />)}
                      </Pie>
                      <Tooltip content={({ active, payload }) => <ChartTooltip active={active} payload={payload as never} valueFormatter={(v) => fmtCurrency(v)} />} />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Units by SKU"  testId="chart-sku-units">
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie
                        data={unitsPieData}
                        cx="50%" cy="50%"
                        innerRadius={62} outerRadius={96}
                        dataKey="value" stroke="#FFFFFF" strokeWidth={2.5}
                        paddingAngle={2}
                        isAnimationActive animationDuration={650}
                        label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ''} · ${((percent ?? 0) * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {unitsPieData.map((entry, i) => <Cell key={i} fill={SKU_PALETTE[entry.name] || '#5A774C'} />)}
                      </Pie>
                      <Tooltip content={({ active, payload }) => <ChartTooltip active={active} payload={payload as never} valueFormatter={(v) => v.toLocaleString()} />} />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="ASP by SKU" eyebrow="Bar" testId="chart-sku-asp">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={aspBarData} margin={{ top: 16, right: 6, left: 0, bottom: 4 }} barCategoryGap="40%">
                      <ChartGradients />
                      <CartesianGrid {...GRID_PROPS} />
                      <XAxis dataKey="sku" tick={AXIS_TICK} axisLine={false} tickLine={false} tickMargin={6} />
                      <YAxis tickFormatter={(v: number) => fmtCurrency(v)} tick={AXIS_TICK} axisLine={false} tickLine={false} tickMargin={6} tickCount={5} />
                      <Tooltip cursor={{ fill: 'rgba(39, 87, 25, 0.05)' }} content={({ active, payload, label }) => <ChartTooltip active={active} payload={payload as never} label={label as string} valueFormatter={(v) => fmtCurrency(v)} />} />
                      <Bar dataKey="asp" name="ASP" radius={[8, 8, 0, 0]} isAnimationActive animationDuration={650}>
                        {aspBarData.map((entry, i) => (
                          <Cell key={i} fill={SKU_PALETTE[entry.sku] || '#5A774C'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </>
            )
          })()}
        </div>
      </ReportSlide>

      {/* SKU Breakdown table */}
      <ReportSlide
        title="SKU Breakdown"
        order={7}
        message="Tabular SKU performance with revenue, orders, units and share — exportable to a slide."
        watch="Top-line SKU's revenue share and ASP gap to the rest."
        action="Use this view as the appendix slide in any monthly review."
      >
        <SectionHeader eyebrow="Breakdown" title="SKU performance table" subtitle="Sorted by revenue · share columns reflect period totals" />
        <ChartCard className="!p-0" testId="sku-table-card">
          <div className="overflow-x-auto -mx-px rounded-2xl">
            <table className="dashboard-table">
              <thead>
                <tr>
                  {['SKU', 'Revenue', 'Rev %', 'Orders', 'Order %', 'Units', 'Units %', 'ASP'].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {skuRows.map(([sku, t], index) => {
                  const skuAsp = t.units > 0 ? t.revenue / t.units : 0
                  return (
                    <tr key={`${sku}-${index}`}>
                      <td>
                        <span className="inline-flex items-center gap-2.5 font-sans font-semibold text-sage-900">
                          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: SKU_PALETTE[sku] || '#5A774C' }} aria-hidden />
                          {sku}
                        </span>
                      </td>
                      <td className="font-semibold text-sage-900">{fmtCurrency(t.revenue)}</td>
                      <td className="text-sage-500">{totalRevenue > 0 ? (t.revenue / totalRevenue * 100).toFixed(1) : 0}%</td>
                      <td>{t.orders.toLocaleString()}</td>
                      <td className="text-sage-500">{totalOrders > 0 ? (t.orders / totalOrders * 100).toFixed(1) : 0}%</td>
                      <td>{t.units.toLocaleString()}</td>
                      <td className="text-sage-500">{totalUnits > 0 ? (t.units / totalUnits * 100).toFixed(1) : 0}%</td>
                      <td className="text-sage-700 font-semibold">{fmtCurrency(skuAsp)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </ChartCard>

        <DataFootnote>
          Data source: MotherDuck · Latest sales date {meta?.sales_last_date ?? 'not available'} · Inventory snapshot {meta?.inventory_last_fetched_at?.slice(0, 10) ?? 'not available'}
        </DataFootnote>
      </ReportSlide>
    </div>
  )
}
