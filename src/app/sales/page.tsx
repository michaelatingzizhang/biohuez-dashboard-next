'use client'
import { LoadingSkeleton } from '@/components/loading-skeleton'

import { type DragEvent, type ReactNode, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { MetricCard } from '@/components/metric-card'
import { SectionHeader } from '@/components/section-header'
import { DataState } from '@/components/data-state'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { SignalGrid } from '@/components/insight-card'
import { filterByDashboardState, useDashboardFilters } from '@/components/dashboard-filters'
import { ReportSlide } from '@/components/report-slide'
import { SalesChartStudio, type ChartStudioDataset, type ChartStudioMetricDef } from '@/components/sales-chart-studio'
import { buildReportSlideKey, isCustomModuleSlideKey } from '@/lib/report-library'
import { cn } from '@/lib/utils'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ComposedChart, AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ReferenceLine, Cell
} from 'recharts'
import { Settings2, X, Plus, Check, GripVertical } from 'lucide-react'

const SKU_COLORS: Record<string, string> = {
  'Black': '#2D4A27',
  'Chocolate': '#6B8F61',
  'Cream Latte': '#B8D4AE',
  'Red': '#C0392B',
}
const AD_TYPE_COLORS: Record<string, string> = {
  SP: '#275719',
  SB: '#5A774C',
  SD: '#AEA33C',
}
const AD_TYPE_LABELS: Record<string, string> = {
  SP: 'Sponsored Products',
  SB: 'Sponsored Brands',
  SD: 'Sponsored Display',
}
const SALES_VIEW_STORAGE_KEY = 'biohuez:sales-view'
const ARTWORK_CHANGE_DATE = '2026-04-15'
const SALES_REPORT_TAB_BY_SLIDE_KEY: Record<string, string> = {
  [buildReportSlideKey('Sales KPI Widgets')]: 'overview',
  [buildReportSlideKey('Sales Performance Trend')]: 'overview',
  [buildReportSlideKey('SKU Performance')]: 'overview',
  [buildReportSlideKey('SKU Time Series')]: 'time-series',
  [buildReportSlideKey('Sales Mix Intelligence')]: 'intelligence',
  [buildReportSlideKey('Traffic And Session Quality')]: 'traffic',
  [buildReportSlideKey('BSR Rank')]: 'bsr',
  [buildReportSlideKey('Advertising Efficiency')]: 'ads',
  [buildReportSlideKey('Unit Economics')]: 'unit-economics',
  [buildReportSlideKey('Customer Journey')]: 'customer-journey',
}

function studioMetric(
  key: string,
  label: string,
  format: ChartStudioMetricDef['format'],
  color: string,
): ChartStudioMetricDef {
  return { key, label, format, color }
}

interface SalesRow {
  date: string
  sku: string
  sku_name?: string
  revenue: number
  orders: number
  units: number
  sessions?: number
  cvr?: number
}

interface AdsRow {
  date: string
  campaign_name: string
  impressions: number
  clicks: number
  spend: number
  sales_1d: number
  purchases_1d: number
}

interface AdsByTypeRow {
  date: string
  ad_type: string
  spend: number
  sales: number
  orders: number
  impressions: number
  clicks: number
}

interface BsrRow {
  date: string
  asin: string
  sku_name: string
  category: string
  rank: number
}

interface SalesSignal {
  severity: 'normal' | 'warn' | 'alert'
  title: string
  detail: string
}

interface WeeklyTrendRow {
  week: string
  revenue: number
  orders: number
  units: number
  aov: number
  asp: number
  revenue_wow_pct: number | null
  units_wow_pct: number | null
  ad_spend: number
  ad_sales: number
  ad_orders: number
  impressions: number
  clicks: number
  acos: number | null
  roas: number | null
  ad_sales_share_pct: number
  ctr: number
}

interface SkuMoverRow {
  sku: string
  latest_week: string
  previous_week: string
  revenue: number
  previous_revenue: number
  revenue_delta: number
  revenue_delta_pct: number | null
  units: number
  previous_units: number
  units_delta: number
  status: 'up' | 'down' | 'flat'
}

interface BsrMoverRow {
  sku: string
  latest_week: string
  previous_week: string
  rank: number
  previous_rank: number
  rank_delta: number
  status: 'improved' | 'worse' | 'flat'
}

interface SalesDiagnosticRow {
  metric: string
  current: number
  previous: number
  delta: number
  delta_pct: number | null
  direction: 'higher' | 'lower'
}

interface SalesInsights {
  summary: {
    latest_week?: string
    latest_revenue?: number
    latest_units?: number
    latest_orders?: number
    latest_revenue_wow_pct?: number | null
    latest_units_wow_pct?: number | null
    latest_acos?: number | null
    latest_roas?: number | null
    latest_ad_sales_share_pct?: number | null
    last4_revenue?: number
    prior4_revenue?: number
  }
  signals: SalesSignal[]
  weekly_trend: WeeklyTrendRow[]
  sku_movers: SkuMoverRow[]
  ad_dependency: { sku: string; revenue: number; units: number; revenue_share_pct: number }[]
  bsr_movers: BsrMoverRow[]
  diagnostics: SalesDiagnosticRow[]
}

interface SalesData {
  sales: SalesRow[]
  ads: AdsRow[]
  ads_by_type: AdsByTypeRow[]
  bsr: BsrRow[]
  insights?: SalesInsights
  error?: string
}

interface RepeatRecord {
  period: string
  new_customers: number
  repeat_customers: number
  repeat_rate: number
  new_revenue: number
  repeat_revenue: number
}

interface DemographicsData {
  repeat_weekly?: RepeatRecord[]
  repeat_monthly?: RepeatRecord[]
}

interface SalesKpiItem {
  key: string
  label: string
  value: string
  sublabel?: string
  status?: 'normal' | 'warn' | 'alert'
}

function SortableSalesWidgetCard({
  item,
  active,
  editing,
  onToggle,
}: {
  item: SalesKpiItem
  active: boolean
  editing: boolean
  onToggle: (key: string) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.key, disabled: !editing || !active })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'sales-widget-card',
        editing && 'is-editing',
        editing && active && 'is-draggable-widget',
        editing && isDragging && 'is-dragging-widget',
      )}
    >
      {editing && active ? (
        <button
          type="button"
          className="sales-widget-drag-handle"
          aria-label={`Reorder ${item.label}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={13} strokeWidth={2.4} />
        </button>
      ) : null}
      {editing ? (
        <button
          type="button"
          className={`sales-widget-toggle ${active ? 'is-remove' : 'is-add'}`}
          onClick={() => onToggle(item.key)}
          aria-label={active ? `Remove ${item.label}` : `Add ${item.label}`}
        >
          {active ? <X size={12} strokeWidth={2.5} /> : <Plus size={12} strokeWidth={2.5} />}
        </button>
      ) : null}
      <MetricCard
        label={item.label}
        value={item.value}
        sublabel={item.sublabel}
        status={active ? item.status : undefined}
      />
    </div>
  )
}

function fmt(n: number | null | undefined, prefix = '') {
  if (n == null) return '—'
  return prefix + n.toLocaleString('en-US', { maximumFractionDigits: 0 })
}
function fmtPct(n: number | null | undefined) {
  if (n == null) return '—'
  return n.toFixed(1) + '%'
}
function fmtMoney(n: number | null | undefined) {
  if (n == null) return '—'
  return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 })
}
function fmtMoney2(n: number | null | undefined) {
  if (n == null) return '—'
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtSignedMoney(n: number | null | undefined) {
  if (n == null) return '—'
  const sign = n > 0 ? '+' : n < 0 ? '-' : ''
  return sign + fmtMoney(Math.abs(n))
}
function fmtSignedPct(n: number | null | undefined) {
  if (n == null) return '—'
  const sign = n > 0 ? '+' : ''
  return sign + n.toFixed(1) + '%'
}
function parseDate(value: string | null | undefined) {
  if (!value) return null
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function intervalDays(interval: string) {
  const map: Record<string, number> = {
    '30d': 30,
    '90d': 90,
    '180d': 180,
    '365d': 365,
    '5w': 35,
    '12w': 84,
    '26w': 182,
    '52w': 364,
    '1m': 30,
    '3m': 90,
    '6m': 180,
    '12m': 365,
  }
  return map[interval] || 30
}

function intervalTitle(interval: string) {
  if (interval === 'all') return 'All-Time Performance'
  return `L${interval.toUpperCase()} Performance`
}

function weekStart(dateValue: string) {
  const date = parseDate(dateValue)
  if (!date) return dateValue
  const day = date.getDay()
  const offset = day === 0 ? -6 : 1 - day
  return isoDate(addDays(date, offset))
}

function bucketDate(dateValue: string, granularity: string) {
  if (!dateValue) return dateValue
  return granularity === 'weekly' ? weekStart(dateValue) : dateValue
}

function formatChartDate(value: unknown) {
  const raw = String(value || '')
  const [, month, day] = raw.match(/^\d{4}-(\d{2})-(\d{2})/) || []
  return month && day ? `${month}/${day}` : raw
}

function skuLabel(sku: string) {
  if (sku === 'Chocolate') return 'Brown'
  return sku
}

function normalizeAdType(value: string) {
  const text = String(value || '').toLowerCase()
  if (text.includes('display') || text === 'sd') return 'SD'
  if (text.includes('brand') || text === 'sb') return 'SB'
  return 'SP'
}

function inferAdSku(row: AdsRow, skuNames: string[]) {
  const source = row as AdsRow & Record<string, unknown>
  const directSku = String(source.sku || source.sku_name || source.advertised_sku || source.advertisedSku || '').trim()
  if (directSku) return directSku
  const campaign = String(row.campaign_name || '').toLowerCase()
  return skuNames.find(sku => campaign.includes(sku.toLowerCase())) || 'Unknown'
}

function buildOverviewChart(sales: SalesRow[], ads: AdsRow[], bsr: BsrRow[], adsByType: AdsByTypeRow[] = [], granularity = 'daily') {
  const dateSkuMap: Record<string, Record<string, number>> = {}
  const skuSet = new Set<string>()
  for (const row of sales) {
    const rawDate = row.date?.slice(0, 10) || ''
    const d = bucketDate(rawDate, granularity)
    if (!d) continue
    if (!dateSkuMap[d]) dateSkuMap[d] = {}
    dateSkuMap[d][row.sku] = (dateSkuMap[d][row.sku] || 0) + (row.revenue || 0)
    skuSet.add(row.sku)
  }

  const adSpendByDate: Record<string, number> = {}
  for (const row of ads) {
    const rawDate = row.date?.slice(0, 10) || ''
    const d = bucketDate(rawDate, granularity)
    if (!d) continue
    adSpendByDate[d] = (adSpendByDate[d] || 0) + (row.spend || 0)
  }

  const adSpendTypeByDate: Record<string, Record<string, number>> = {}
  for (const row of adsByType) {
    const rawDate = row.date?.slice(0, 10) || ''
    const d = bucketDate(rawDate, granularity)
    if (!d) continue
    const type = normalizeAdType(row.ad_type)
    if (!adSpendTypeByDate[d]) adSpendTypeByDate[d] = {}
    adSpendTypeByDate[d][type] = (adSpendTypeByDate[d][type] || 0) + (row.spend || 0)
  }

  const aspByDate: Record<string, { revenue: number; units: number }> = {}
  for (const row of sales) {
    const rawDate = row.date?.slice(0, 10) || ''
    const d = bucketDate(rawDate, granularity)
    if (!d) continue
    if (!aspByDate[d]) aspByDate[d] = { revenue: 0, units: 0 }
    aspByDate[d].revenue += row.revenue || 0
    aspByDate[d].units += row.units || 0
  }

  const bestBsrByDate: Record<string, number> = {}
  for (const row of bsr) {
    const rawDate = row.date?.slice(0, 10) || ''
    const d = bucketDate(rawDate, granularity)
    if (!d) continue
    bestBsrByDate[d] = bestBsrByDate[d] ? Math.min(bestBsrByDate[d], row.rank) : row.rank
  }

  const chartData = Object.entries(dateSkuMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, skuRevs]) => {
      const aspInput = aspByDate[date]
      const units = sales
        .filter(row => bucketDate(row.date?.slice(0, 10) || '', granularity) === date)
        .reduce((sum, row) => sum + (row.units || 0), 0)
      return {
        date,
        ...skuRevs,
        ...Object.fromEntries(Object.entries(adSpendTypeByDate[date] || {}).map(([type, spend]) => [`adSpend_${type}`, spend])),
        adSpend: adSpendByDate[date] || 0,
        total: Object.values(skuRevs).reduce((s, v) => s + v, 0),
        units,
        asp: aspInput && aspInput.units > 0 ? aspInput.revenue / aspInput.units : null,
        bestBsr: bestBsrByDate[date] || null,
      }
    })

  return { chartData, skus: Array.from(skuSet).sort() }
}

function buildSkuTimeSeries(sales: SalesRow[], granularity = 'daily') {
  const bucketMap: Record<string, Record<string, { revenue: number; units: number }>> = {}
  const skuSet = new Set<string>()
  for (const row of sales) {
    const rawDate = row.date?.slice(0, 10) || ''
    const date = bucketDate(rawDate, granularity)
    const sku = row.sku || 'Unknown'
    if (!date) continue
    if (!bucketMap[date]) bucketMap[date] = {}
    if (!bucketMap[date][sku]) bucketMap[date][sku] = { revenue: 0, units: 0 }
    bucketMap[date][sku].revenue += row.revenue || 0
    bucketMap[date][sku].units += row.units || 0
    skuSet.add(sku)
  }

  const skus = Array.from(skuSet).sort()
  const dates = Object.keys(bucketMap).sort()
  return {
    skus,
    sales: dates.map(date => ({
      date,
      ...Object.fromEntries(skus.map(sku => [sku, bucketMap[date][sku]?.revenue || 0])),
    })),
    units: dates.map(date => ({
      date,
      ...Object.fromEntries(skus.map(sku => [sku, bucketMap[date][sku]?.units || 0])),
    })),
    asp: dates.map(date => ({
      date,
      ...Object.fromEntries(skus.map(sku => {
        const bucket = bucketMap[date][sku]
        return [sku, bucket && bucket.units > 0 ? bucket.revenue / bucket.units : null]
      })),
    })),
  }
}

function buildTrafficSeries(sales: SalesRow[], ads: AdsRow[], granularity = 'daily') {
  const buckets: Record<string, { sessions: number; units: number; revenue: number; adSpend: number; clicks: number }> = {}
  for (const row of sales) {
    const rawDate = row.date?.slice(0, 10) || ''
    const date = bucketDate(rawDate, granularity)
    if (!date) continue
    if (!buckets[date]) buckets[date] = { sessions: 0, units: 0, revenue: 0, adSpend: 0, clicks: 0 }
    buckets[date].sessions += row.sessions || 0
    buckets[date].units += row.units || 0
    buckets[date].revenue += row.revenue || 0
  }
  for (const row of ads) {
    const rawDate = row.date?.slice(0, 10) || ''
    const date = bucketDate(rawDate, granularity)
    if (!date) continue
    if (!buckets[date]) buckets[date] = { sessions: 0, units: 0, revenue: 0, adSpend: 0, clicks: 0 }
    buckets[date].adSpend += row.spend || 0
    buckets[date].clicks += row.clicks || 0
  }
  return Object.entries(buckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({
      date,
      ...value,
      cvr: value.sessions > 0 ? value.units / value.sessions * 100 : null,
      sessionsPerAdDollar: value.adSpend > 0 ? value.sessions / value.adSpend : null,
      sessionsPerClick: value.clicks > 0 ? value.sessions / value.clicks : null,
    }))
}

function average(values: number[]) {
  const valid = values.filter(value => Number.isFinite(value))
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null
}

function downloadTable(filename: string, rows: Array<Record<string, string | number>>) {
  const headers = Object.keys(rows[0] || {})
  if (headers.length === 0) return
  const escapeCell = (value: unknown) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const html = `
    <html>
      <head><meta charset="utf-8" /></head>
      <body>
        <table>
          <thead><tr>${headers.map(header => `<th>${escapeCell(header)}</th>`).join('')}</tr></thead>
          <tbody>
            ${rows.map(row => `<tr>${headers.map(header => `<td>${escapeCell(row[header])}</td>`).join('')}</tr>`).join('')}
          </tbody>
        </table>
      </body>
    </html>
  `
  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export default function SalesPage() {
  const [data, setData] = useState<SalesData | null>(null)
  const [demographics, setDemographics] = useState<DemographicsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [visibleKpis, setVisibleKpis] = useState<string[]>(['revenue', 'orders', 'units', 'aov', 'acos', 'roas', 'proas'])
  const [visibleSeries, setVisibleSeries] = useState<string[]>(['revenue', 'asp', 'adSpend', 'bestBsr'])
  const [chartStyle, setChartStyle] = useState<'line' | 'area'>('line')
  const [viewSaved, setViewSaved] = useState(false)
  const [editingWidgets, setEditingWidgets] = useState(false)
  const [editingCharts, setEditingCharts] = useState(false)
  const [draggedSeries, setDraggedSeries] = useState<string | null>(null)
  const widgetSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )
  const filters = useDashboardFilters()
  const params = useSearchParams()
  const comparisonActive = params.get('compare') === 'previous'
  const requestedReportSlide = params.get('reportSlide')
  const [activeTab, setActiveTab] = useState(() => {
    if (isCustomModuleSlideKey(requestedReportSlide)) return 'custom-studio'
    return SALES_REPORT_TAB_BY_SLIDE_KEY[requestedReportSlide || ''] || 'overview'
  })

  useEffect(() => {
    if (!requestedReportSlide) return
    if (isCustomModuleSlideKey(requestedReportSlide)) {
      setActiveTab('custom-studio')
      return
    }
    const mappedTab = SALES_REPORT_TAB_BY_SLIDE_KEY[requestedReportSlide]
    if (mappedTab) setActiveTab(mappedTab)
  }, [requestedReportSlide])

  useEffect(() => {
    fetch('/api/sales')
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetch('/api/demographics')
      .then(r => r.json())
      .then(d => setDemographics(d))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const saved = window.localStorage.getItem(SALES_VIEW_STORAGE_KEY)
    if (!saved) return
    try {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed.visibleKpis)) setVisibleKpis(parsed.visibleKpis)
      if (Array.isArray(parsed.visibleSeries)) setVisibleSeries(parsed.visibleSeries.map((key: string) => key === 'units' ? 'asp' : key))
      if (parsed.chartStyle === 'line' || parsed.chartStyle === 'area') setChartStyle(parsed.chartStyle)
    } catch {}
  }, [])

  if (loading) return <LoadingSkeleton />
  if (!data || data.error) return <DataState variant="error" title="Sales data could not load" description={data?.error || "The sales endpoint returned no response."} />

  const allSales = (data.sales || []).map((row) => ({
    ...row,
    sku: row.sku || row.sku_name || 'Unknown',
  }))
  const allAds = data.ads || []
  const allAdsByType = data.ads_by_type || []
  const allBsr = data.bsr || []
  const sales = filterByDashboardState(allSales, filters, row => row.date, row => row.sku)
  const ads = filterByDashboardState(allAds, filters, row => row.date)
  const ads_by_type = filterByDashboardState(allAdsByType, filters, row => row.date)
  const bsr = filterByDashboardState(allBsr, filters, row => row.date, row => row.sku_name)
  if (sales.length === 0) {
    return <DataState title="No sales rows available" description="MotherDuck is connected, but the sales table has no rows for this dashboard yet." />
  }
  const totalRevenue = sales.reduce((s, r) => s + (r.revenue || 0), 0)
  const totalOrders = sales.reduce((s, r) => s + (r.orders || 0), 0)
  const totalUnits = sales.reduce((s, r) => s + (r.units || 0), 0)
  const totalAdSpend = ads.reduce((s, r) => s + (r.spend || 0), 0)
  const totalAdSales = ads.reduce((s, r) => s + (r.sales_1d || 0), 0)
  const acos = totalAdSales > 0 ? (totalAdSpend / totalAdSales * 100) : 0
  const roas = totalAdSpend > 0 ? (totalAdSales / totalAdSpend) : 0
  const aov = totalOrders > 0 ? totalRevenue / totalOrders : 0
  const insights = data.insights || {
    summary: {},
    signals: [],
    weekly_trend: [],
    sku_movers: [],
    ad_dependency: [],
    bsr_movers: [],
    diagnostics: [],
  }
  const skuMap: Record<string, { revenue: number; orders: number; units: number }> = {}
  for (const row of sales) {
    const k = row.sku || 'Unknown'
    if (!skuMap[k]) skuMap[k] = { revenue: 0, orders: 0, units: 0 }
    skuMap[k].revenue += row.revenue || 0
    skuMap[k].orders += row.orders || 0
    skuMap[k].units += row.units || 0
  }
  const adSkuMap: Record<string, { adSales: number; adUnits: number }> = {}
  const knownSkus = Object.keys(skuMap)
  for (const row of ads) {
    const k = inferAdSku(row, knownSkus)
    if (!adSkuMap[k]) adSkuMap[k] = { adSales: 0, adUnits: 0 }
    adSkuMap[k].adSales += row.sales_1d || 0
    adSkuMap[k].adUnits += row.purchases_1d || 0
  }
  const skuPerf = Object.entries(skuMap).map(([sku, v]) => ({
    sku,
    ...v,
    asp: v.units > 0 ? v.revenue / v.units : 0,
    aov: v.orders > 0 ? v.revenue / v.orders : 0,
    adSales: adSkuMap[sku]?.adSales || 0,
    adUnits: adSkuMap[sku]?.adUnits || 0,
    adSalesPct: v.revenue > 0 ? ((adSkuMap[sku]?.adSales || 0) / v.revenue) * 100 : 0,
    adUnitsPct: v.units > 0 ? ((adSkuMap[sku]?.adUnits || 0) / v.units) * 100 : 0,
  })).sort((a, b) => b.revenue - a.revenue)

  const overview = buildOverviewChart(sales, ads, bsr, ads_by_type, filters.granularity)
  const overviewChartData = overview.chartData
  const skus = overview.skus
  const skuTimeSeries = buildSkuTimeSeries(sales, filters.granularity)
  const trafficSeries = buildTrafficSeries(sales, ads, filters.granularity)
  const totalSessions = trafficSeries.reduce((sum, row) => sum + row.sessions, 0)
  const totalClicks = trafficSeries.reduce((sum, row) => sum + row.clicks, 0)
  const trafficAdSpend = trafficSeries.reduce((sum, row) => sum + row.adSpend, 0)
  const trafficUnits = trafficSeries.reduce((sum, row) => sum + row.units, 0)
  const trafficCvr = totalSessions > 0 ? trafficUnits / totalSessions * 100 : null
  const sessionsPerAdDollar = trafficAdSpend > 0 ? totalSessions / trafficAdSpend : null
  const sessionsPerClick = totalClicks > 0 ? totalSessions / totalClicks : null
  const preArtworkRows = trafficSeries.filter(row => row.date < ARTWORK_CHANGE_DATE)
  const postArtworkRows = trafficSeries.filter(row => row.date >= ARTWORK_CHANGE_DATE)
  const preArtworkSessions = average(preArtworkRows.map(row => row.sessions))
  const postArtworkSessions = average(postArtworkRows.map(row => row.sessions))
  const preArtworkSessionClick = average(preArtworkRows.map(row => row.sessionsPerClick || 0))
  const postArtworkSessionClick = average(postArtworkRows.map(row => row.sessionsPerClick || 0))
  const currentDateValues = sales.map(row => row.date?.slice(0, 10)).filter(Boolean).sort() as string[]
  const latestDate = currentDateValues[currentDateValues.length - 1] || allSales.map(row => row.date?.slice(0, 10)).filter(Boolean).sort().pop()
  const currentEndDate = parseDate(filters.to || latestDate)
  const currentStartDate = parseDate(filters.from) || (currentEndDate ? addDays(currentEndDate, -intervalDays(filters.interval) + 1) : null)
  const currentSpanDays = currentStartDate && currentEndDate
    ? Math.max(1, Math.round((currentEndDate.getTime() - currentStartDate.getTime()) / 86400000) + 1)
    : intervalDays(filters.interval)
  const previousEndDate = currentStartDate ? addDays(currentStartDate, -1) : null
  const previousStartDate = previousEndDate ? addDays(previousEndDate, -currentSpanDays + 1) : null
  const previousFilters = {
    from: previousStartDate ? isoDate(previousStartDate) : '',
    to: previousEndDate ? isoDate(previousEndDate) : '',
    sku: filters.sku,
    interval: filters.interval,
    granularity: filters.granularity,
  }
  const previousSales = filterByDashboardState(allSales, previousFilters, row => row.date, row => row.sku)
  const previousAds = filterByDashboardState(allAds, previousFilters, row => row.date)
  const previousBsr = filterByDashboardState(allBsr, previousFilters, row => row.date, row => row.sku_name)
  const previousAdsByType = filterByDashboardState(allAdsByType, previousFilters, row => row.date)
  const previousOverview = buildOverviewChart(previousSales, previousAds, previousBsr, previousAdsByType, filters.granularity)
  const chartSkus = Array.from(new Set([...skus, ...previousOverview.skus])).sort()
  const bsrAsinSet = new Set<string>()
  const bsrDateMap: Record<string, Record<string, number>> = {}
  for (const row of bsr) {
    const d = bucketDate(row.date?.slice(0, 10) || '', filters.granularity)
    if (!bsrDateMap[d]) bsrDateMap[d] = {}
    const key = `${row.sku_name || row.asin}`
    bsrDateMap[d][key] = bsrDateMap[d][key] ? Math.min(bsrDateMap[d][key], row.rank) : row.rank
    bsrAsinSet.add(key)
  }
  const bsrAsins = Array.from(bsrAsinSet)
  const bsrChartData = Object.entries(bsrDateMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, ranks]) => ({ date, ...ranks }))
  const latestBsrDate = bsr.length > 0 ? bsr.map(r => r.date?.slice(0, 10)).sort().reverse()[0] : null
  const currentBsr = latestBsrDate ? bsr.filter(r => r.date?.slice(0, 10) === latestBsrDate) : []
  const adTypeMap: Record<string, Record<string, number>> = {}
  const adTypes = new Set<string>()
  for (const row of ads_by_type) {
    const d = bucketDate(row.date?.slice(0, 10) || '', filters.granularity)
    if (!adTypeMap[d]) adTypeMap[d] = {}
    adTypeMap[d][row.ad_type] = (adTypeMap[d][row.ad_type] || 0) + (row.spend || 0)
    adTypes.add(row.ad_type)
  }
  const adTypeChartData = Object.entries(adTypeMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, types]) => ({ date, ...types }))
  const dailyAdMap: Record<string, { spend: number; sales: number }> = {}
  for (const row of ads) {
    const d = bucketDate(row.date?.slice(0, 10) || '', filters.granularity)
    if (!dailyAdMap[d]) dailyAdMap[d] = { spend: 0, sales: 0 }
    dailyAdMap[d].spend += row.spend || 0
    dailyAdMap[d].sales += row.sales_1d || 0
  }
  const acosChartData = Object.entries(dailyAdMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date,
      acos: v.sales > 0 ? parseFloat((v.spend / v.sales * 100).toFixed(1)) : null,
      spend: v.spend,
      sales: v.sales,
    }))
  const unitEconByDate: Record<string, {
    adSales: number; adUnits: number; adSpend: number; adOrders: number;
    totalRevenue: number; totalUnits: number; totalOrders: number;
  }> = {}
  for (const row of ads) {
    const d = bucketDate(row.date?.slice(0, 10) || '', filters.granularity)
    if (!unitEconByDate[d]) unitEconByDate[d] = { adSales: 0, adUnits: 0, adSpend: 0, adOrders: 0, totalRevenue: 0, totalUnits: 0, totalOrders: 0 }
    unitEconByDate[d].adSales += row.sales_1d || 0
    unitEconByDate[d].adUnits += row.purchases_1d || 0
    unitEconByDate[d].adSpend += row.spend || 0
    unitEconByDate[d].adOrders += row.purchases_1d || 0
  }
  for (const row of sales) {
    const d = bucketDate(row.date?.slice(0, 10) || '', filters.granularity)
    if (!unitEconByDate[d]) unitEconByDate[d] = { adSales: 0, adUnits: 0, adSpend: 0, adOrders: 0, totalRevenue: 0, totalUnits: 0, totalOrders: 0 }
    unitEconByDate[d].totalRevenue += row.revenue || 0
    unitEconByDate[d].totalUnits += row.units || 0
    unitEconByDate[d].totalOrders += row.orders || 0
  }

  const totalAdOrders = ads.reduce((s, r) => s + (r.purchases_1d || 0), 0)
  const proasChartData = Object.entries(unitEconByDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date,
      pROAS: v.adSpend > 0 ? parseFloat(((v.adSales - 4.93 * v.adOrders) / v.adSpend).toFixed(3)) : null,
      blendedPROAS: v.adSpend > 0 ? parseFloat(((v.totalRevenue - 4.93 * v.totalOrders) / v.adSpend).toFixed(3)) : null,
    }))

  const cacChartData = Object.entries(unitEconByDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date,
      CAC: v.adOrders > 0 ? parseFloat((v.adSpend / v.adOrders).toFixed(2)) : null,
      blendedCAC: v.totalOrders > 0 ? parseFloat((v.adSpend / v.totalOrders).toFixed(2)) : null,
    }))
  const unitEconomicsStudioData = proasChartData.map((row) => {
    const matchingCac = cacChartData.find((item) => item.date === row.date)
    return {
      ...row,
      CAC: matchingCac?.CAC ?? null,
      blendedCAC: matchingCac?.blendedCAC ?? null,
    }
  })
  function buildOverviewKpis(periodSales: SalesRow[], periodAds: AdsRow[], sublabel?: string): SalesKpiItem[] {
    const revenue = periodSales.reduce((s, r) => s + (r.revenue || 0), 0)
    const orders = periodSales.reduce((s, r) => s + (r.orders || 0), 0)
    const units = periodSales.reduce((s, r) => s + (r.units || 0), 0)
    const adSpend = periodAds.reduce((s, r) => s + (r.spend || 0), 0)
    const adSales = periodAds.reduce((s, r) => s + (r.sales_1d || 0), 0)
    const adOrders = periodAds.reduce((s, r) => s + (r.purchases_1d || 0), 0)
    const periodAov = orders > 0 ? revenue / orders : 0
    const periodAcos = adSales > 0 ? adSpend / adSales * 100 : 0
    const periodRoas = adSpend > 0 ? adSales / adSpend : 0
    const periodProas = adSpend > 0 ? (adSales - 4.93 * adOrders) / adSpend : 0
    const periodAsp = units > 0 ? revenue / units : 0
    const periodCac = adOrders > 0 ? adSpend / adOrders : 0
    const periodOrganicSalesPct = revenue > 0 ? (revenue - adSales) / revenue * 100 : 0
    return [
      { key: 'revenue', label: 'Total Revenue', value: fmtMoney(revenue), sublabel },
      { key: 'orders', label: 'Total Orders', value: fmt(orders), sublabel },
      { key: 'units', label: 'Total Units', value: fmt(units), sublabel },
      { key: 'aov', label: 'AOV', value: fmtMoney2(periodAov), sublabel },
      { key: 'acos', label: 'ACOS', value: fmtPct(periodAcos), sublabel, status: periodAcos > 40 ? 'alert' as const : periodAcos > 25 ? 'warn' as const : 'normal' as const },
      { key: 'roas', label: 'ROAS', value: periodRoas.toFixed(2) + 'x', sublabel },
      { key: 'proas', label: 'pROAS', value: periodProas.toFixed(2) + 'x', sublabel, status: periodProas < 1 ? 'alert' as const : periodProas < 2 ? 'warn' as const : 'normal' as const },
      { key: 'asp', label: 'ASP', value: fmtMoney2(periodAsp), sublabel },
      { key: 'cac', label: 'CAC', value: fmtMoney2(periodCac), sublabel },
      { key: 'organic', label: 'Organic Sales %', value: fmtPct(periodOrganicSalesPct), sublabel },
    ]
  }
  const overviewKpis = buildOverviewKpis(sales, ads)
  const previousOverviewKpis = buildOverviewKpis(previousSales, previousAds)

  function toggleKpi(key: string) {
    setViewSaved(false)
    setVisibleKpis(current => current.includes(key) ? current.filter(item => item !== key) : [...current, key])
  }

  function handleWidgetDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setViewSaved(false)
    setVisibleKpis(current => {
      const oldIndex = current.indexOf(String(active.id))
      const newIndex = current.indexOf(String(over.id))
      if (oldIndex === -1 || newIndex === -1) return current
      return arrayMove(current, oldIndex, newIndex)
    })
  }

  function toggleSeries(key: string) {
    setViewSaved(false)
    setVisibleSeries(current => current.includes(key) ? current.filter(item => item !== key) : [...current, key])
  }

  function reorderSeries(targetKey: string) {
    if (!draggedSeries || draggedSeries === targetKey) return
    setViewSaved(false)
    setVisibleSeries(current => {
      if (!current.includes(draggedSeries) || !current.includes(targetKey)) return current
      const next = current.filter(key => key !== draggedSeries)
      const targetIndex = next.indexOf(targetKey)
      next.splice(targetIndex, 0, draggedSeries)
      return next
    })
  }

  function handleSeriesDragStart(event: DragEvent<HTMLDivElement>, key: string) {
    if (!editingCharts) return
    setDraggedSeries(key)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', key)
  }

  function handleSeriesDragOver(event: DragEvent<HTMLDivElement>) {
    if (!editingCharts || !draggedSeries) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }

  function handleSeriesDrop(event: DragEvent<HTMLDivElement>, key: string) {
    if (!editingCharts) return
    event.preventDefault()
    reorderSeries(key)
    setDraggedSeries(null)
  }

  function updateChartStyle(value: 'line' | 'area') {
    setViewSaved(false)
    setChartStyle(value)
  }

  function saveSalesView() {
    window.localStorage.setItem(SALES_VIEW_STORAGE_KEY, JSON.stringify({ visibleKpis, visibleSeries, chartStyle }))
    setViewSaved(true)
  }

  function exportSkuPerformance() {
    downloadTable(`biohuez-sales-sku-performance-${filters.interval}.xls`, skuPerf.map(row => ({
      SKU: skuLabel(row.sku),
      Sales: Number(row.revenue.toFixed(2)),
      Orders: row.orders,
      Units: row.units,
      ASP: Number(row.asp.toFixed(2)),
      AOV: Number(row.aov.toFixed(2)),
      'Ad Sales': Number(row.adSales.toFixed(2)),
      '% of Ad Sales': Number(row.adSalesPct.toFixed(2)),
      'Ad Units': row.adUnits,
      '% of Ad Units': Number(row.adUnitsPct.toFixed(2)),
    })))
  }

  function renderKpiGrid(items: typeof overviewKpis, title?: string, editable = false) {
    const selectedItems = visibleKpis
      .map(key => items.find(item => item.key === key))
      .filter((item): item is typeof items[number] => Boolean(item))
    const hiddenItems = items.filter(item => !visibleKpis.includes(item.key))
    const displayItems = editable && editingWidgets ? [...selectedItems, ...hiddenItems] : selectedItems
    const activeItemKeys = selectedItems.map(item => item.key)
    const grid = (
      <div className="sales-overview-kpi-grid">
        {displayItems.map(item => (
          <SortableSalesWidgetCard
            key={item.key}
            item={item}
            active={visibleKpis.includes(item.key)}
            editing={editable && editingWidgets}
            onToggle={toggleKpi}
          />
        ))}
      </div>
    )
    return (
      <div className="sales-kpi-panel">
        {title && <div className="sales-kpi-panel-title">{title}</div>}
        {editable && editingWidgets ? (
          <DndContext sensors={widgetSensors} collisionDetection={closestCenter} onDragEnd={handleWidgetDragEnd}>
            <SortableContext items={activeItemKeys} strategy={rectSortingStrategy}>
              {grid}
            </SortableContext>
          </DndContext>
        ) : grid}
      </div>
    )
  }

  const repeatMonthly = demographics?.repeat_monthly || []
  const sortedMonthly = [...repeatMonthly]
    .filter(r => r.period != null)
    .sort((a, b) => (a.period || '').localeCompare(b.period || ''))
  const latestMonth = sortedMonthly[sortedMonthly.length - 1]

  const customerChartData = sortedMonthly.map(r => ({
    period: r.period?.slice(0, 7),
    new_customers: r.new_customers || 0,
    repeat_customers: r.repeat_customers || 0,
    new_revenue: r.new_revenue || 0,
    repeat_revenue: r.repeat_revenue || 0,
    repeat_pct: r.repeat_rate || 0,
  }))

  const customChartDatasets: ChartStudioDataset[] = [
    {
      key: 'sales-overview',
      label: 'Sales Overview',
      subtitle: 'Revenue, ASP, ad spend, and BSR over time.',
      xKey: 'date',
      xTickFormatter: formatChartDate,
      data: overviewChartData,
      metrics: [
        studioMetric('total', 'Sales', 'money', '#2D4A27'),
        studioMetric('asp', 'ASP', 'money2', '#6B8F61'),
        studioMetric('adSpend', 'Ad Spend', 'money', '#AEA33C'),
        studioMetric('bestBsr', 'Best BSR', 'rank', '#C0392B'),
      ],
    },
    {
      key: 'traffic-quality',
      label: 'Traffic Quality',
      subtitle: 'Sessions, clicks, CVR, and ad spend over time.',
      xKey: 'date',
      xTickFormatter: formatChartDate,
      data: trafficSeries,
      metrics: [
        studioMetric('sessions', 'Sessions', 'number', '#2D4A27'),
        studioMetric('clicks', 'Clicks', 'number', '#5A774C'),
        studioMetric('cvr', 'CVR', 'percent', '#E67E22'),
        studioMetric('adSpend', 'Ad Spend', 'money', '#AEA33C'),
        studioMetric('sessionsPerClick', 'Sessions / Click', 'ratio', '#2980B9'),
      ],
    },
    {
      key: 'weekly-momentum',
      label: 'Weekly Momentum',
      subtitle: 'Weekly revenue, units, ad spend, ACOS, and ad sales share.',
      xKey: 'week',
      xTickFormatter: (value: unknown) => String(value || '').slice(5),
      data: insights.weekly_trend.map((row) => ({ ...row })),
      metrics: [
        studioMetric('revenue', 'Revenue', 'money', '#2D4A27'),
        studioMetric('units', 'Units', 'number', '#6B8F61'),
        studioMetric('ad_spend', 'Ad Spend', 'money', '#E67E22'),
        studioMetric('acos', 'ACOS', 'percent', '#C0392B'),
        studioMetric('ad_sales_share_pct', 'Ad Sales Share', 'percent', '#2980B9'),
      ],
    },
    {
      key: 'unit-economics',
      label: 'Unit Economics',
      subtitle: 'pROAS, blended pROAS, CAC, and blended CAC over time.',
      xKey: 'date',
      xTickFormatter: (value: unknown) => String(value || '').slice(5),
      data: unitEconomicsStudioData,
      metrics: [
        studioMetric('pROAS', 'pROAS', 'ratio', '#6B8F61'),
        studioMetric('blendedPROAS', 'Blended pROAS', 'ratio', '#2D4A27'),
        studioMetric('CAC', 'CAC', 'money2', '#E67E22'),
        studioMetric('blendedCAC', 'Blended CAC', 'money2', '#2980B9'),
      ],
    },
    {
      key: 'customer-journey',
      label: 'Customer Journey',
      subtitle: 'New versus repeat customer and revenue mix over time.',
      xKey: 'period',
      data: customerChartData,
      metrics: [
        studioMetric('new_revenue', 'New Revenue', 'money', '#E67E22'),
        studioMetric('repeat_revenue', 'Repeat Revenue', 'money', '#2D4A27'),
        studioMetric('new_customers', 'New Customers', 'number', '#B8D4AE'),
        studioMetric('repeat_customers', 'Repeat Customers', 'number', '#5A774C'),
        studioMetric('repeat_pct', 'Repeat Rate', 'percent', '#AEA33C'),
      ],
    },
    {
      key: 'sku-performance',
      label: 'SKU Performance',
      subtitle: 'Revenue, orders, units, and ASP by SKU.',
      xKey: 'sku',
      data: skuPerf.map((row) => ({
        sku: skuLabel(row.sku),
        revenue: row.revenue,
        orders: row.orders,
        units: row.units,
        asp: row.asp,
        aov: row.aov,
        adSalesPct: row.adSalesPct,
      })),
      metrics: [
        studioMetric('revenue', 'Revenue', 'money', '#2D4A27'),
        studioMetric('orders', 'Orders', 'number', '#6B8F61'),
        studioMetric('units', 'Units', 'number', '#B8D4AE'),
        studioMetric('asp', 'ASP', 'money2', '#E67E22'),
        studioMetric('adSalesPct', 'Ad Sales %', 'percent', '#2980B9'),
      ],
    },
  ].filter((dataset) => dataset.data.length > 0)

  function chartSubtitle(chartData: Array<Record<string, unknown>>) {
    const points = chartData.filter(row => Number(row.total || 0) > 0)
    if (points.length < 2) return 'Sales, ASP, ad spend, and BSR trend by selected period.'
    const first = points[0]
    const last = points[points.length - 1]
    const firstAsp = Number(first.asp || 0)
    const lastAsp = Number(last.asp || 0)
    const firstRevenue = Number(first.total || 0)
    const lastRevenue = Number(last.total || 0)
    const aspTrend = firstAsp && lastAsp >= firstAsp ? 'ASP improved' : 'ASP softened'
    const salesTrend = firstRevenue && lastRevenue >= firstRevenue ? 'sales increased' : 'sales declined'
    return `${aspTrend} from ${fmtMoney2(firstAsp)} to ${fmtMoney2(lastAsp)} while ${salesTrend} from ${fmtMoney(firstRevenue)} to ${fmtMoney(lastRevenue)}.`
  }

  function renderOverviewChart(chartData: Array<Record<string, unknown>>, title?: string) {
    const adSpendTypes = ['SP', 'SB', 'SD'].filter(type => chartData.some(row => Number(row[`adSpend_${type}`] || 0) > 0))
    const cursor = { stroke: '#111111', strokeDasharray: '4 4', strokeWidth: 1 }
    const tooltipStyle = {
      border: '1px solid rgba(34, 44, 38, 0.12)',
      borderRadius: 8,
      padding: '7px 9px',
      boxShadow: '0 10px 24px rgba(20, 28, 22, 0.12)',
      fontSize: '0.78rem',
    }
    const compactTooltip = {
      border: '1px solid rgba(34, 44, 38, 0.12)',
      borderRadius: 8,
      padding: '5px 8px',
      boxShadow: '0 8px 18px rgba(20, 28, 22, 0.1)',
      fontSize: '0.74rem',
    }

    function renderSeriesBand(key: string) {
      const bandClass = [
        'sales-band',
        key === 'revenue' ? 'sales-band-large' : '',
        key === 'adSpend' ? 'sales-band-bars' : '',
        editingCharts ? 'is-editing-chart' : '',
        editingCharts && draggedSeries === key ? 'is-dragging-chart' : '',
      ].filter(Boolean).join(' ')

      const label = key === 'revenue' ? 'Sales' : key === 'asp' ? 'ASP' : key === 'adSpend' ? 'Ads' : 'BSR'
      let chart: ReactNode = null
      let extra: ReactNode = null

      if (key === 'revenue') {
        chart = (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} syncId="sales-overview" margin={{ top: 12, right: 18, left: 72, bottom: 0 }}>
              <CartesianGrid strokeDasharray="1 5" stroke="#D8DDD7" vertical />
              <XAxis dataKey="date" hide />
              <YAxis orientation="right" width={70} tickCount={4} tick={{ fontSize: 11, fill: '#6B746C' }} tickFormatter={v => '$' + Number(v).toLocaleString()} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
              <Tooltip cursor={cursor} contentStyle={tooltipStyle} formatter={(value: unknown) => [fmtMoney(Number(value)), 'Sales']} />
              {chartStyle === 'area' ? (
                <Area type="monotone" dataKey="total" stroke="var(--biohuez-dark)" strokeWidth={2.5} fill="var(--biohuez-dark)" fillOpacity={0.11} dot={false} connectNulls name="Sales" />
              ) : (
                <Line type="monotone" dataKey="total" stroke="var(--biohuez-dark)" strokeWidth={2.5} dot={false} connectNulls name="Sales" />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )
      } else if (key === 'asp') {
        chart = (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} syncId="sales-overview" margin={{ top: 6, right: 18, left: 72, bottom: 0 }}>
              <CartesianGrid strokeDasharray="1 5" stroke="#D8DDD7" vertical />
              <XAxis dataKey="date" hide />
              <YAxis orientation="right" width={70} tickCount={4} tick={{ fontSize: 11, fill: '#6B746C' }} tickFormatter={v => '$' + Number(v).toFixed(2)} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
              <Tooltip cursor={cursor} contentStyle={compactTooltip} formatter={(value: unknown) => [fmtMoney2(Number(value)), 'ASP']} />
              {chartStyle === 'area' ? (
                <Area type="monotone" dataKey="asp" stroke="var(--biohuez-sage)" strokeWidth={2} fill="var(--biohuez-sage)" fillOpacity={0.09} dot={false} connectNulls name="ASP" />
              ) : (
                <Line type="monotone" dataKey="asp" stroke="var(--biohuez-sage)" strokeWidth={2} dot={false} connectNulls name="ASP" />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )
      } else if (key === 'adSpend') {
        chart = (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} syncId="sales-overview" margin={{ top: 6, right: 18, left: 72, bottom: 0 }}>
              <CartesianGrid strokeDasharray="1 5" stroke="#D8DDD7" vertical />
              <XAxis dataKey="date" hide />
              <YAxis orientation="right" width={70} tickCount={4} tick={{ fontSize: 11, fill: '#6B746C' }} tickFormatter={v => '$' + Number(v).toLocaleString()} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
              <Tooltip cursor={cursor} contentStyle={compactTooltip} formatter={(value: unknown) => [fmtMoney(Number(value)), 'Ad Spend']} />
              {adSpendTypes.length > 0 ? adSpendTypes.map(type => (
                <Bar key={type} dataKey={`adSpend_${type}`} stackId="adSpend" fill={AD_TYPE_COLORS[type]} opacity={0.58} radius={[2, 2, 0, 0]} name={AD_TYPE_LABELS[type]} />
              )) : (
                <Bar dataKey="adSpend" fill="var(--biohuez-gold)" opacity={0.5} radius={[2, 2, 0, 0]} name="Ad Spend" />
              )}
            </BarChart>
          </ResponsiveContainer>
        )
        extra = adSpendTypes.length > 0 ? (
          <div className="sales-ad-type-legend">
            {adSpendTypes.map(type => (
              <span key={type}><i style={{ background: AD_TYPE_COLORS[type] }} />{type}</span>
            ))}
          </div>
        ) : null
      } else if (key === 'bestBsr') {
        chart = (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} syncId="sales-overview" margin={{ top: 6, right: 18, left: 72, bottom: 18 }}>
              <CartesianGrid strokeDasharray="1 5" stroke="#D8DDD7" vertical />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#7B837C' }} tickFormatter={formatChartDate} axisLine={false} tickLine={false} />
              <YAxis orientation="right" reversed width={70} tickCount={4} tick={{ fontSize: 11, fill: '#6B746C' }} tickFormatter={v => Number(v).toLocaleString()} domain={['dataMin', 'dataMax']} axisLine={false} tickLine={false} />
              <Tooltip cursor={cursor} position={{ y: 8 }} contentStyle={compactTooltip} formatter={(value: unknown) => ['#' + Number(value).toLocaleString(), 'Best BSR']} />
              {chartStyle === 'area' ? (
                <Area type="monotone" dataKey="bestBsr" stroke="var(--biohuez-gold)" strokeWidth={1.9} fill="var(--biohuez-gold)" fillOpacity={0.12} dot={false} connectNulls name="Best BSR" />
              ) : (
                <Line type="monotone" dataKey="bestBsr" stroke="var(--biohuez-gold)" strokeWidth={1.9} dot={false} connectNulls name="Best BSR" />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )
      }

      return (
        <div
          key={key}
          className={bandClass}
          draggable={editingCharts}
          onDragStart={event => handleSeriesDragStart(event, key)}
          onDragOver={handleSeriesDragOver}
          onDrop={event => handleSeriesDrop(event, key)}
          onDragEnd={() => setDraggedSeries(null)}
        >
          <div className="sales-band-label">
            <span className="sales-band-label-title">{label}</span>
          </div>
          {editingCharts ? (
            <span className="sales-chart-drag-handle" aria-hidden>
              <GripVertical size={13} strokeWidth={2.4} />
            </span>
          ) : null}
          {chart}
          {extra}
        </div>
      )
    }

    return (
      <div className="sales-chart-panel">
        {title && <div className="sales-chart-card-title">{title}</div>}
        <div className="sales-stacked-chart">
          {visibleSeries.map(key => renderSeriesBand(key))}
        </div>
      </div>
    )
  }

  function renderSkuTimeSeriesChart(
    title: string,
    subtitle: string,
    chartData: Array<Record<string, unknown>>,
    formatter: (value: number) => string,
  ) {
    return (
      <div className="dashboard-chart-card sales-time-series-card">
        <SectionHeader title={title} subtitle={subtitle} />
        <ResponsiveContainer width="100%" height={290}>
          <LineChart data={chartData} syncId="sales-sku-time-series" margin={{ top: 8, right: 22, left: 4, bottom: 8 }}>
            <CartesianGrid strokeDasharray="2 5" stroke="#D8DDD7" vertical />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6B746C' }} tickFormatter={formatChartDate} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#6B746C' }} tickFormatter={value => formatter(Number(value))} axisLine={false} tickLine={false} />
            <Tooltip
              cursor={{ stroke: '#111111', strokeDasharray: '4 4', strokeWidth: 1 }}
              contentStyle={{
                border: '1px solid rgba(34, 44, 38, 0.12)',
                borderRadius: 8,
                padding: '7px 9px',
                boxShadow: '0 10px 24px rgba(20, 28, 22, 0.12)',
                fontSize: '0.78rem',
              }}
              formatter={(value: unknown, name: unknown) => [formatter(Number(value)), skuLabel(String(name))]}
              labelFormatter={value => formatChartDate(value)}
            />
            <Legend formatter={value => skuLabel(String(value))} />
            {skuTimeSeries.skus.map(sku => (
              <Line
                key={sku}
                type="monotone"
                dataKey={sku}
                stroke={SKU_COLORS[sku] || '#AEA33C'}
                strokeWidth={2.2}
                dot={false}
                connectNulls
                name={skuLabel(sku)}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    )
  }

  return (
    <div style={{ padding: '0 0 40px' }}>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="dashboard-tabs-scroll">
          <TabsList style={{ marginBottom: 20, background: '#F0F0F0' }}>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="time-series">Time Series</TabsTrigger>
            <TabsTrigger value="intelligence">Sales Mix</TabsTrigger>
            <TabsTrigger value="traffic">Traffic</TabsTrigger>
            <TabsTrigger value="bsr">BSR</TabsTrigger>
            <TabsTrigger value="ads">Ads</TabsTrigger>
            <TabsTrigger value="unit-economics">Unit Economics</TabsTrigger>
            <TabsTrigger value="customer-journey">Customer Journey</TabsTrigger>
            <TabsTrigger value="custom-studio">Custom Studio</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview">
          <div className="sales-overview-page">
            <ReportSlide
              title="Sales KPI Widgets"
              order={1}
              message="Top-line sales, order, unit, and paid efficiency metrics for the selected period."
              watch="Revenue, ACOS, ROAS, and pROAS together show whether scale is profitable."
              action="Use Edit Widgets to tailor the KPI set before presenting."
            >
            <section className="sales-overview-kpis">
              <div className="sales-kpi-picker">
                <div className="sales-view-actions">
                  <button 
                    className={`sales-edit-pill ${editingWidgets ? 'is-active' : ''}`} 
                    onClick={() => setEditingWidgets(current => !current)}
                    type="button"
                    title="Edit dashboard widgets"
                  >
                    {editingWidgets ? (
                      <>
                        <Check size={14} strokeWidth={2.5} />
                        <span>Done</span>
                      </>
                    ) : (
                      <>
                        <Settings2 size={14} />
                        <span>Edit Widgets</span>
                      </>
                    )}
                  </button>
                  {!editingWidgets && (
                    <button className="sales-save-pill" onClick={saveSalesView}>
                      {viewSaved ? 'Saved' : 'Save Widgets'}
                    </button>
                  )}
                </div>
              </div>

              {comparisonActive ? (
                <div className="sales-compare-grid sales-compare-kpis">
                  {renderKpiGrid(overviewKpis, 'Current period', true)}
                  {renderKpiGrid(previousOverviewKpis, 'Previous period')}
                </div>
              ) : (
                renderKpiGrid(overviewKpis, undefined, true)
              )}
            </section>
            </ReportSlide>

            <ReportSlide
              title="Sales Performance Trend"
              order={2}
              message="Sales is the primary chart, with ASP, ads, and BSR shown as supporting bands."
              watch="Look for revenue moves that do not match ASP, paid spend, or rank direction."
              action="Use Edit Charts to choose and reorder the chart bands for the report."
            >
            <section>
            <div>
              <div className="sales-chart-toolbar">
                <SectionHeader title={intervalTitle(filters.interval)} subtitle={chartSubtitle(overviewChartData)} />
                <div className="sales-chart-controls">
                  <button 
                    className={`sales-edit-pill ${editingCharts ? 'is-active' : ''}`}
                    onClick={() => setEditingCharts(current => !current)}
                    type="button"
                    title="Edit chart series"
                  >
                    {editingCharts ? (
                      <>
                        <Check size={14} strokeWidth={2.5} />
                        <span>Done</span>
                      </>
                    ) : (
                      <>
                        <Settings2 size={14} />
                        <span>Edit Charts</span>
                      </>
                    )}
                  </button>
                  {editingCharts && (
                    <div className="sales-chart-picker">
                      {[
                        { key: 'revenue', label: 'Sales' },
                        { key: 'asp', label: 'ASP' },
                        { key: 'adSpend', label: 'Ad Spend' },
                        { key: 'bestBsr', label: 'BSR' },
                      ].map(item => {
                        const active = visibleSeries.includes(item.key)
                        return (
                          <button
                            key={item.key}
                            className={`sales-series-pill ${active ? 'is-active' : 'is-inactive'}`}
                            onClick={() => toggleSeries(item.key)}
                          >
                            {active ? <Check size={12} strokeWidth={2.5} /> : <Plus size={12} strokeWidth={2.5} />}
                            <span>{item.label}</span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                  {!editingCharts && (
                    <button className="sales-save-pill" onClick={saveSalesView}>
                      {viewSaved ? 'Saved' : 'Save Charts'}
                    </button>
                  )}
                </div>
              </div>
              <div className="dashboard-chart-card sales-overview-chart">
                <div className={comparisonActive ? 'sales-compare-grid' : ''}>
                  {renderOverviewChart(overviewChartData, comparisonActive ? 'Current period' : undefined)}
                  {comparisonActive && renderOverviewChart(previousOverview.chartData, 'Previous period')}
                </div>
              </div>
            </div>
            </section>
            </ReportSlide>
          </div>

          <ReportSlide
            title="SKU Performance"
            order={3}
            message="SKU-level table showing sales, order volume, ASP, AOV, and ad-attributed mix."
            watch="Check whether sales concentration or ad-attributed share is clustered in one SKU."
            action="Export the table for appendix or weekly follow-up."
          >
          <div className="sales-table-heading">
            <SectionHeader title="SKU Performance" subtitle="Sales, ASP, AOV, ad-attributed sales, and ad-attributed unit mix." />
            <button className="sales-export-button" onClick={exportSkuPerformance}>Download Excel</button>
          </div>
          <div className="dashboard-table-card">
            <table className="sales-export-table">
              <thead>
                <tr>
                  {['SKU', 'Sales', 'Orders', 'Units', 'ASP', 'AOV', 'Ad Sales', '% of Ad Sales', 'Ad Units', '% of Ad Units'].map(h => (
                    <th key={h} className={h === 'SKU' ? 'left' : ''}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {skuPerf.map(row => (
                  <tr key={row.sku}>
                    <td className="left">
                      <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: SKU_COLORS[row.sku] || '#ccc', marginRight: 8 }} />
                      {skuLabel(row.sku)}
                    </td>
                    <td>{fmtMoney(row.revenue)}</td>
                    <td>{fmt(row.orders)}</td>
                    <td>{fmt(row.units)}</td>
                    <td>{fmtMoney2(row.asp)}</td>
                    <td>{fmtMoney2(row.aov)}</td>
                    <td>{fmtMoney(row.adSales)}</td>
                    <td>{fmtPct(row.adSalesPct)}</td>
                    <td>{fmt(row.adUnits)}</td>
                    <td>{fmtPct(row.adUnitsPct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </ReportSlide>
        </TabsContent>

        <TabsContent value="time-series">
          <ReportSlide
            title="SKU Time Series"
            order={4}
            message="Sales, units, and ASP over time by SKU."
            watch="SKU lines reveal whether demand, price, or mix is driving total sales movement."
            action="Use the top filters to switch aggregation and selected SKU before report mode."
          >
          <div className="sales-time-series-page">
            <div className="sales-time-series-intro">
              <SectionHeader
                title="SKU Time Series"
                subtitle={`${filters.granularity === 'weekly' ? 'Weekly' : 'Daily'} view for Sales, Units, and ASP. Use the top filter bar to switch period, SKU, and aggregation.`}
              />
            </div>
            {renderSkuTimeSeriesChart(
              'Sales by SKU',
              'Revenue trend by SKU over the selected period.',
              skuTimeSeries.sales,
              value => fmtMoney(value),
            )}
            {renderSkuTimeSeriesChart(
              'Units by SKU',
              'Unit volume trend by SKU over the selected period.',
              skuTimeSeries.units,
              value => fmt(value),
            )}
            {renderSkuTimeSeriesChart(
              'ASP by SKU',
              'Average selling price trend by SKU over the selected period.',
              skuTimeSeries.asp,
              value => fmtMoney2(value),
            )}
          </div>
          </ReportSlide>
        </TabsContent>

        <TabsContent value="intelligence">
          <ReportSlide
            title="Sales Mix Intelligence"
            order={5}
            message="Weekly sales momentum, SKU movers, BSR movers, and diagnostic drivers."
            watch="Focus on negative revenue movement, high ACOS, and rank deterioration."
            action="Use this slide to align commercial actions for the next review period."
          >
          <div className="dashboard-kpi-grid">
            <MetricCard
              label="Latest Week Revenue"
              value={fmtMoney(insights.summary.latest_revenue)}
              sublabel={insights.summary.latest_week || 'Latest week'}
            />
            <MetricCard
              label="Revenue WoW"
              value={fmtSignedPct(insights.summary.latest_revenue_wow_pct)}
              sublabel="Week over week"
              status={(insights.summary.latest_revenue_wow_pct ?? 0) < -20 ? 'alert' : (insights.summary.latest_revenue_wow_pct ?? 0) < 0 ? 'warn' : 'normal'}
            />
            <MetricCard
              label="Latest ACOS"
              value={fmtPct(insights.summary.latest_acos)}
              sublabel="Weekly ad efficiency"
              status={(insights.summary.latest_acos ?? 0) > 40 ? 'alert' : (insights.summary.latest_acos ?? 0) > 25 ? 'warn' : 'normal'}
            />
            <MetricCard
              label="Ad Sales Share"
              value={fmtPct(insights.summary.latest_ad_sales_share_pct)}
              sublabel="Ad-attributed / revenue"
              status={(insights.summary.latest_ad_sales_share_pct ?? 0) > 70 ? 'warn' : 'normal'}
            />
          </div>

          <SignalGrid signals={insights.signals} />

          <SectionHeader title="Weekly Momentum" subtitle="Revenue, ad spend, ACOS, and ad-attributed share" />
          <div className="dashboard-chart-card" style={{ background: 'white', borderRadius: 10, padding: 16, marginBottom: 20 }}>
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={insights.weekly_trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EBEBEB" vertical={false} />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} tickFormatter={v => v?.slice(5)} />
                <YAxis yAxisId="money" tick={{ fontSize: 11 }} tickFormatter={v => '$' + (v / 1000).toFixed(0) + 'k'} />
                <YAxis yAxisId="rate" orientation="right" tick={{ fontSize: 11 }} tickFormatter={v => v + '%'} />
                <Tooltip formatter={(value: unknown, name: unknown) => String(name).includes('%') || String(name).includes('ACOS') ? Number(value).toFixed(1) + '%' : fmtMoney(Number(value))} />
                <Legend />
                <Bar yAxisId="money" dataKey="revenue" fill="#B8D4AE" name="Revenue" />
                <Line yAxisId="money" type="monotone" dataKey="ad_spend" stroke="#E67E22" strokeWidth={2} dot={false} name="Ad Spend" />
                <Line yAxisId="rate" type="monotone" dataKey="acos" stroke="#C0392B" strokeWidth={2} dot={false} name="ACOS %" connectNulls />
                <Line yAxisId="rate" type="monotone" dataKey="ad_sales_share_pct" stroke="#2980B9" strokeWidth={2} dot={false} name="Ad Sales Share %" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16, marginBottom: 20 }}>
            <div>
              <SectionHeader title="SKU Movers" subtitle="Latest week versus previous week" />
              <div className="dashboard-table-card">
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #EBEBEB' }}>
                      {['SKU', 'Revenue', 'Δ Revenue', 'Δ Units'].map(h => (
                        <th key={h} style={{ padding: '8px 8px', textAlign: h === 'SKU' ? 'left' : 'right', color: '#666', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {insights.sku_movers.map(row => {
                      const color = row.revenue_delta >= 0 ? '#2D4A27' : '#C0392B'
                      return (
                        <tr key={row.sku} style={{ borderBottom: '1px solid #F5F5F5' }}>
                          <td style={{ padding: '8px 8px', fontWeight: 700 }}>{skuLabel(row.sku)}</td>
                          <td style={{ padding: '8px 8px', textAlign: 'right' }}>{fmtMoney(row.revenue)}</td>
                          <td style={{ padding: '8px 8px', textAlign: 'right', color, fontWeight: 700 }}>
                            {fmtSignedMoney(row.revenue_delta)}
                            <span style={{ color: '#888', marginLeft: 4, fontWeight: 500 }}>({fmtSignedPct(row.revenue_delta_pct)})</span>
                          </td>
                          <td style={{ padding: '8px 8px', textAlign: 'right', color: row.units_delta >= 0 ? '#2D4A27' : '#C0392B', fontWeight: 700 }}>
                            {row.units_delta > 0 ? '+' : ''}{row.units_delta.toLocaleString()}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <SectionHeader title="BSR Movers" subtitle="Lower rank is better" />
              <div className="dashboard-table-card">
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #EBEBEB' }}>
                      {['SKU', 'Rank', 'Δ Rank', 'Status'].map(h => (
                        <th key={h} style={{ padding: '8px 8px', textAlign: h === 'SKU' || h === 'Status' ? 'left' : 'right', color: '#666', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {insights.bsr_movers.map(row => {
                      const improved = row.rank_delta < 0
                      const color = improved ? '#2D4A27' : row.rank_delta > 0 ? '#C0392B' : '#888'
                      return (
                        <tr key={row.sku} style={{ borderBottom: '1px solid #F5F5F5' }}>
                          <td style={{ padding: '8px 8px', fontWeight: 700 }}>{skuLabel(row.sku)}</td>
                          <td style={{ padding: '8px 8px', textAlign: 'right' }}>#{row.rank}</td>
                          <td style={{ padding: '8px 8px', textAlign: 'right', color, fontWeight: 700 }}>{row.rank_delta > 0 ? '+' : ''}{row.rank_delta}</td>
                          <td style={{ padding: '8px 8px', color, fontWeight: 700 }}>{row.status}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <SectionHeader title="Weekly Diagnostic Drivers" subtitle="Largest latest-week changes" />
          <div className="dashboard-table-card">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #EBEBEB' }}>
                  {['Metric', 'Current', 'Previous', 'Change', 'Read'].map(h => (
                    <th key={h} style={{ padding: '8px 8px', textAlign: h === 'Metric' || h === 'Read' ? 'left' : 'right', color: '#666', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {insights.diagnostics.map(row => {
                  const favorable = row.direction === 'higher' ? row.delta >= 0 : row.delta <= 0
                  const color = favorable ? '#2D4A27' : '#C0392B'
                  const isMoney = ['Revenue', 'Ad spend', 'Ad sales'].includes(row.metric)
                  return (
                    <tr key={row.metric} style={{ borderBottom: '1px solid #F5F5F5' }}>
                      <td style={{ padding: '8px 8px', fontWeight: 700 }}>{row.metric}</td>
                      <td style={{ padding: '8px 8px', textAlign: 'right' }}>{isMoney ? fmtMoney(row.current) : fmt(row.current)}</td>
                      <td style={{ padding: '8px 8px', textAlign: 'right' }}>{isMoney ? fmtMoney(row.previous) : fmt(row.previous)}</td>
                      <td style={{ padding: '8px 8px', textAlign: 'right', color, fontWeight: 700 }}>
                        {isMoney ? fmtSignedMoney(row.delta) : `${row.delta > 0 ? '+' : ''}${fmt(row.delta)}`}
                        <span style={{ color: '#888', marginLeft: 4, fontWeight: 500 }}>({fmtSignedPct(row.delta_pct)})</span>
                      </td>
                      <td style={{ padding: '8px 8px', color, fontWeight: 700 }}>{favorable ? 'Favorable' : 'Pressure'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          </ReportSlide>
        </TabsContent>
        <TabsContent value="traffic">
          <ReportSlide
            title="Traffic And Session Quality"
            order={6}
            message="Sessions, clicks, conversion, and artwork-change impact for the selected period."
            watch="Paid traffic should translate into sessions and conversion, not only clicks."
            action="Use this slide when reviewing listing artwork and traffic quality."
          >
          <div className="sales-traffic-page">
            <div className="sales-traffic-intro">
              <SectionHeader
                title="Traffic / Session Analysis"
                subtitle="Sessions, clicks, ad spend, conversion, and artwork-change impact using the selected dashboard period."
              />
            </div>

            <div className="dashboard-kpi-grid">
              <MetricCard label="Sessions" value={fmt(totalSessions)} sublabel={filters.granularity === 'weekly' ? 'Weekly aggregation' : 'Daily aggregation'} />
              <MetricCard label="Clicks" value={fmt(totalClicks)} sublabel="Amazon Ads clicks" />
              <MetricCard label="CVR" value={fmtPct(trafficCvr)} sublabel="Units / sessions" />
              <MetricCard label="Sessions / Ad $" value={sessionsPerAdDollar == null ? '—' : sessionsPerAdDollar.toFixed(2)} sublabel="Traffic efficiency" />
              <MetricCard label="Sessions / Click" value={sessionsPerClick == null ? '—' : sessionsPerClick.toFixed(2)} sublabel="Click-to-session leverage" />
              <MetricCard
                label="Post Artwork Sessions"
                value={postArtworkSessions == null ? '—' : fmt(postArtworkSessions)}
                sublabel={preArtworkSessions == null || postArtworkSessions == null ? 'Needs date coverage' : `${fmtSignedPct(((postArtworkSessions - preArtworkSessions) / preArtworkSessions) * 100)} vs pre-change`}
                status={preArtworkSessions != null && postArtworkSessions != null && postArtworkSessions < preArtworkSessions ? 'warn' : 'normal'}
              />
            </div>

            <div className="dashboard-chart-card sales-traffic-chart">
              <SectionHeader title="Sessions vs Ad Spend" subtitle="Shows whether paid spend is translating into more sessions over time." />
              <ResponsiveContainer width="100%" height={340}>
                <ComposedChart data={trafficSeries} margin={{ top: 12, right: 24, left: 4, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="2 5" stroke="#D8DDD7" vertical />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6B746C' }} tickFormatter={formatChartDate} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="sessions" tick={{ fontSize: 11, fill: '#6B746C' }} tickFormatter={value => Number(value).toLocaleString()} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="money" orientation="right" tick={{ fontSize: 11, fill: '#6B746C' }} tickFormatter={value => fmtMoney(Number(value))} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ stroke: '#111111', strokeDasharray: '4 4', strokeWidth: 1 }}
                    contentStyle={{ border: '1px solid rgba(34, 44, 38, 0.12)', borderRadius: 8, padding: '7px 9px', boxShadow: '0 10px 24px rgba(20, 28, 22, 0.12)', fontSize: '0.78rem' }}
                    formatter={(value: unknown, name: unknown) => {
                      const label = String(name)
                      if (label.includes('Spend')) return [fmtMoney(Number(value)), label]
                      if (label.includes('CVR')) return [fmtPct(Number(value)), label]
                      return [fmt(Number(value)), label]
                    }}
                    labelFormatter={value => formatChartDate(value)}
                  />
                  <Legend />
                  <Bar yAxisId="money" dataKey="adSpend" fill="var(--biohuez-gold)" opacity={0.42} radius={[2, 2, 0, 0]} name="Ad Spend" />
                  <Line yAxisId="sessions" type="monotone" dataKey="sessions" stroke="var(--biohuez-dark)" strokeWidth={2.6} dot={false} name="Sessions" connectNulls />
                  <Line yAxisId="sessions" type="monotone" dataKey="clicks" stroke="var(--biohuez-sage)" strokeWidth={2} dot={false} name="Clicks" connectNulls />
                  <ReferenceLine x={ARTWORK_CHANGE_DATE} stroke="#AEA33C" strokeDasharray="4 4" label={{ value: 'Artwork change', position: 'insideTopRight', fill: '#5A774C', fontSize: 11 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div className="dashboard-chart-card sales-traffic-chart">
              <SectionHeader title="Session Quality" subtitle="Conversion rate and sessions per click before and after the artwork update." />
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={trafficSeries} margin={{ top: 12, right: 24, left: 4, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="2 5" stroke="#D8DDD7" vertical />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6B746C' }} tickFormatter={formatChartDate} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="rate" tick={{ fontSize: 11, fill: '#6B746C' }} tickFormatter={value => `${Number(value).toFixed(0)}%`} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="ratio" orientation="right" tick={{ fontSize: 11, fill: '#6B746C' }} tickFormatter={value => Number(value).toFixed(1)} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ stroke: '#111111', strokeDasharray: '4 4', strokeWidth: 1 }}
                    contentStyle={{ border: '1px solid rgba(34, 44, 38, 0.12)', borderRadius: 8, padding: '7px 9px', boxShadow: '0 10px 24px rgba(20, 28, 22, 0.12)', fontSize: '0.78rem' }}
                    formatter={(value: unknown, name: unknown) => {
                      const label = String(name)
                      return label.includes('CVR') ? [fmtPct(Number(value)), label] : [Number(value).toFixed(2), label]
                    }}
                    labelFormatter={value => formatChartDate(value)}
                  />
                  <Legend />
                  <Line yAxisId="rate" type="monotone" dataKey="cvr" stroke="var(--biohuez-dark)" strokeWidth={2.4} dot={false} name="CVR %" connectNulls />
                  <Line yAxisId="ratio" type="monotone" dataKey="sessionsPerClick" stroke="var(--biohuez-gold)" strokeWidth={2.2} dot={false} name="Sessions / Click" connectNulls />
                  <ReferenceLine x={ARTWORK_CHANGE_DATE} stroke="#AEA33C" strokeDasharray="4 4" label={{ value: 'Artwork change', position: 'insideTopRight', fill: '#5A774C', fontSize: 11 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div className="sales-traffic-note">
              <strong>Add-to-cart availability</strong>
              <span>Brand-level add-to-cart data is not present in the current Sales endpoint, so this view uses sessions, clicks, units, and conversion rate as the traffic quality proxy.</span>
            </div>
          </div>
          </ReportSlide>
        </TabsContent>
        <TabsContent value="bsr">
          <ReportSlide
            title="BSR Rank"
            order={7}
            message="Best Seller Rank movement over time plus the latest rank snapshot."
            watch="Lower rank is better; compare direction against sales and ad spend."
            action="Use rank movement to explain market visibility changes."
          >
          <SectionHeader title="BSR Rank Over Time" subtitle="Lower rank = better position" />
          <div className="dashboard-chart-card" style={{ background: 'white', borderRadius: 10, padding: 16, marginBottom: 16 }}>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={bsrChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EBEBEB" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={v => v?.slice(5)} />
                <YAxis reversed tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                {bsrAsins.map((asin, i) => (
                  <Line key={asin} type="monotone" dataKey={asin}
                    stroke={Object.values(SKU_COLORS)[i % 4]} strokeWidth={2} dot={false} name={asin} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <SectionHeader title="Current BSR" subtitle={`As of ${latestBsrDate || 'N/A'}`} />
          <div className="dashboard-table-card">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #EBEBEB' }}>
                  {['SKU', 'ASIN', 'Category', 'Rank'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: h === 'Rank' ? 'right' : 'left', color: '#666', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {currentBsr.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #F5F5F5' }}>
                    <td style={{ padding: '8px 12px' }}>{skuLabel(row.sku_name)}</td>
                    <td style={{ padding: '8px 12px', color: '#888', fontFamily: 'monospace', fontSize: '0.75rem' }}>{row.asin}</td>
                    <td style={{ padding: '8px 12px' }}>{row.category}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700 }}>#{row.rank}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </ReportSlide>
        </TabsContent>
        <TabsContent value="ads">
          <ReportSlide
            title="Advertising Efficiency"
            order={8}
            message="Ad spend, ad sales, ACOS, ROAS, ad type mix, and daily ACOS."
            watch="High ACOS or weak ROAS shows paid efficiency pressure."
            action="Use this slide to decide campaign budget and optimization actions."
          >
          <div className="dashboard-kpi-grid">
            <MetricCard label="Total Ad Spend" value={fmtMoney(totalAdSpend)} />
            <MetricCard label="Total Ad Sales" value={fmtMoney(totalAdSales)} />
            <MetricCard label="ACOS" value={fmtPct(acos)} status={acos > 40 ? 'alert' : acos > 25 ? 'warn' : 'normal'} />
            <MetricCard label="ROAS" value={roas.toFixed(2) + 'x'} />
          </div>

          <SectionHeader title="Ad Spend by Type" subtitle="SP / SB / SD over time" />
          <div className="dashboard-chart-card" style={{ background: 'white', borderRadius: 10, padding: 16, marginBottom: 16 }}>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={adTypeChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EBEBEB" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={v => v?.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => '$' + v} />
                <Tooltip formatter={(value: unknown) => fmtMoney(Number(value))} />
                <Legend />
                {Array.from(adTypes).map(t => (
                  <Bar key={t} dataKey={t} stackId="a" fill={AD_TYPE_COLORS[t] || '#ccc'} name={t} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>

          <SectionHeader title="Daily ACOS%" />
          <div className="dashboard-chart-card" style={{ background: 'white', borderRadius: 10, padding: 16 }}>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={acosChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EBEBEB" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={v => v?.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => v + '%'} />
                <Tooltip formatter={(value: unknown) => Number(value).toFixed(1) + '%'} />
                <Legend />
                <Line type="monotone" dataKey="acos" stroke="#E67E22" strokeWidth={2} dot={false} name="ACOS%" connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
          </ReportSlide>
        </TabsContent>
        <TabsContent value="unit-economics">
          <ReportSlide
            title="Unit Economics"
            order={9}
            message="pROAS and CAC over time with break-even reference."
            watch="pROAS below 1.0 means paid acquisition is below break-even."
            action="Use this slide to connect sales growth to contribution economics."
          >
          <div className="dashboard-kpi-grid">
            <MetricCard label="pROAS (All)" value={totalAdSpend > 0 ? ((totalAdSales - 4.93 * totalAdOrders) / totalAdSpend).toFixed(2) + 'x' : '—'} />
            <MetricCard label="CAC (Ad)" value={totalAdOrders > 0 ? fmtMoney2(totalAdSpend / totalAdOrders) : '—'} />
            <MetricCard label="Ad Units" value={fmt(totalAdOrders)} />
          </div>

          <SectionHeader title="pROAS Over Time" subtitle="Break-even at 1.0x" />
          <div className="dashboard-chart-card" style={{ background: 'white', borderRadius: 10, padding: 16, marginBottom: 16 }}>
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={proasChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EBEBEB" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={v => v?.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => v + 'x'} />
                <Tooltip formatter={(value: unknown) => Number(value).toFixed(2) + 'x'} />
                <Legend />
                <ReferenceLine y={1} stroke="#E67E22" strokeDasharray="4 4" label={{ value: 'Break-even', position: 'right', fontSize: 10 }} />
                <Line type="monotone" dataKey="pROAS" stroke="#6B8F61" strokeWidth={2} dot={false} name="pROAS" connectNulls />
                <Line type="monotone" dataKey="blendedPROAS" stroke="#2D4A27" strokeWidth={2} dot={false} name="Blended pROAS" connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <SectionHeader title="CAC Over Time" subtitle="Customer acquisition cost" />
          <div className="dashboard-chart-card" style={{ background: 'white', borderRadius: 10, padding: 16 }}>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={cacChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EBEBEB" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={v => v?.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => '$' + v} />
                <Tooltip formatter={(value: unknown) => fmtMoney(Number(value))} />
                <Legend />
                <Bar dataKey="CAC" fill="#E67E22" name="Ad CAC" />
                <Bar dataKey="blendedCAC" fill="#2D4A27" name="Blended CAC" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          </ReportSlide>
        </TabsContent>
        <TabsContent value="customer-journey">
          <ReportSlide
            title="Customer Journey"
            order={10}
            message="New versus repeat customer and revenue behavior over time."
            watch="Repeat rate and repeat revenue indicate whether acquisition is compounding."
            action="Use this slide for retention and lifecycle follow-up."
          >
          <div className="dashboard-kpi-grid">
            <MetricCard
              label="Repeat Rate (Latest Month)"
              value={latestMonth ? fmtPct(latestMonth.repeat_rate) : '—'}
            />
            <MetricCard
              label="New Customers"
              value={latestMonth ? fmt(latestMonth.new_customers) : '—'}
            />
            <MetricCard
              label="Repeat Customers"
              value={latestMonth ? fmt(latestMonth.repeat_customers) : '—'}
            />
          </div>

          {sortedMonthly.length === 0 ? (
            <DataState title="No customer journey data available" description="Repeat purchase and cohort inputs are not available yet." />
          ) : (
            <>
              <SectionHeader title="Revenue: New vs Repeat" subtitle="Monthly stacked revenue with repeat rate" />
              <div className="dashboard-chart-card" style={{ background: 'white', borderRadius: 10, padding: 16, marginBottom: 16 }}>
                <ResponsiveContainer width="100%" height={260}>
                  <ComposedChart data={customerChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EBEBEB" vertical={false} />
                    <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="rev" tick={{ fontSize: 11 }} tickFormatter={v => '$' + (v/1000).toFixed(0) + 'k'} />
                    <YAxis yAxisId="pct" orientation="right" tick={{ fontSize: 11 }} tickFormatter={v => v + '%'} domain={[0, 100]} />
                    <Tooltip formatter={(value: unknown, name: unknown) => {
                      const label = typeof name === 'string' ? name : ''
                      if (label === 'Repeat %') return [Number(value).toFixed(1) + '%', label]
                      return ['$' + Number(value).toLocaleString(), label]
                    }} />
                    <Legend />
                    <Bar yAxisId="rev" dataKey="new_revenue" stackId="rev" fill="#E67E22" name="New Revenue" />
                    <Bar yAxisId="rev" dataKey="repeat_revenue" stackId="rev" fill="#2D4A27" name="Repeat Revenue" />
                    <Line yAxisId="pct" type="monotone" dataKey="repeat_pct" stroke="#C0392B" strokeWidth={2} dot name="Repeat %" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              <SectionHeader title="Customers: New vs Repeat" subtitle="Monthly customer count breakdown" />
              <div className="dashboard-chart-card" style={{ background: 'white', borderRadius: 10, padding: 16, marginBottom: 16 }}>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={customerChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EBEBEB" vertical={false} />
                    <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="new_customers" stackId="c" fill="#E67E22" name="New Customers" />
                    <Bar dataKey="repeat_customers" stackId="c" fill="#2D4A27" name="Repeat Customers" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <SectionHeader title="Customer Journey Detail" />
              <div className="dashboard-table-card">
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #EBEBEB' }}>
                      {['Period', 'New Customers', 'Repeat Customers', 'Repeat %', 'Repeat Revenue', 'New Revenue'].map(h => (
                        <th key={h} style={{ padding: '8px 10px', textAlign: h === 'Period' ? 'left' : 'right', color: '#666', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedMonthly.map((row, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #F5F5F5' }}>
                        <td style={{ padding: '8px 10px', fontWeight: 600 }}>{row.period?.slice(0, 7)}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right' }}>{fmt(row.new_customers)}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right' }}>{fmt(row.repeat_customers)}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right' }}>{fmtPct(row.repeat_rate)}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right' }}>{fmtMoney(row.repeat_revenue)}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right' }}>{fmtMoney(row.new_revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          </ReportSlide>
        </TabsContent>
        <TabsContent value="custom-studio">
          <div className="dashboard-chart-card" style={{ background: 'white', borderRadius: 12, padding: 16 }}>
            <SectionHeader
              title="Custom Chart Modules"
              subtitle="Build reusable sales modules from overview, traffic, momentum, unit economics, customer, and SKU datasets."
            />
            <SalesChartStudio datasets={customChartDatasets} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
