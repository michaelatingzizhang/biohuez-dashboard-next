'use client'
import { LoadingSkeleton } from '@/components/loading-skeleton'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { MetricCard } from '@/components/metric-card'
import { SectionHeader } from '@/components/section-header'
import { DataState } from '@/components/data-state'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { SignalGrid } from '@/components/insight-card'
import { filterByDashboardState, useDashboardFilters } from '@/components/dashboard-filters'
import {
  ComposedChart, AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ReferenceLine, Cell
} from 'recharts'

const SKU_COLORS: Record<string, string> = {
  'Black': '#2D4A27',
  'Chocolate': '#6B8F61',
  'Cream Latte': '#B8D4AE',
  'Red': '#C0392B',
}
const AD_TYPE_COLORS: Record<string, string> = {
  'SP': '#2D4A27',
  'SB': '#6B8F61',
  'SD': '#B8D4AE',
}
const SALES_VIEW_STORAGE_KEY = 'biohuez:sales-view'

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

function formatChartDate(value: unknown) {
  const raw = String(value || '')
  const [, month, day] = raw.match(/^\d{4}-(\d{2})-(\d{2})/) || []
  return month && day ? `${month}/${day}` : raw
}

function skuLabel(sku: string) {
  if (sku === 'Chocolate') return 'Brown'
  return sku
}

function buildOverviewChart(sales: SalesRow[], ads: AdsRow[], bsr: BsrRow[], granularity = 'daily') {
  const dateSkuMap: Record<string, Record<string, number>> = {}
  const skuSet = new Set<string>()
  for (const row of sales) {
    const rawDate = row.date?.slice(0, 10) || ''
    const d = granularity === 'weekly' ? weekStart(rawDate) : rawDate
    if (!d) continue
    if (!dateSkuMap[d]) dateSkuMap[d] = {}
    dateSkuMap[d][row.sku] = (dateSkuMap[d][row.sku] || 0) + (row.revenue || 0)
    skuSet.add(row.sku)
  }

  const adSpendByDate: Record<string, number> = {}
  for (const row of ads) {
    const rawDate = row.date?.slice(0, 10) || ''
    const d = granularity === 'weekly' ? weekStart(rawDate) : rawDate
    if (!d) continue
    adSpendByDate[d] = (adSpendByDate[d] || 0) + (row.spend || 0)
  }

  const aspByDate: Record<string, { revenue: number; units: number }> = {}
  for (const row of sales) {
    const rawDate = row.date?.slice(0, 10) || ''
    const d = granularity === 'weekly' ? weekStart(rawDate) : rawDate
    if (!d) continue
    if (!aspByDate[d]) aspByDate[d] = { revenue: 0, units: 0 }
    aspByDate[d].revenue += row.revenue || 0
    aspByDate[d].units += row.units || 0
  }

  const bestBsrByDate: Record<string, number> = {}
  for (const row of bsr) {
    const rawDate = row.date?.slice(0, 10) || ''
    const d = granularity === 'weekly' ? weekStart(rawDate) : rawDate
    if (!d) continue
    bestBsrByDate[d] = bestBsrByDate[d] ? Math.min(bestBsrByDate[d], row.rank) : row.rank
  }

  const chartData = Object.entries(dateSkuMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, skuRevs]) => {
      const aspInput = aspByDate[date]
      const units = sales
        .filter(row => (granularity === 'weekly' ? weekStart(row.date?.slice(0, 10) || '') : row.date?.slice(0, 10)) === date)
        .reduce((sum, row) => sum + (row.units || 0), 0)
      return {
        date,
        ...skuRevs,
        adSpend: adSpendByDate[date] || 0,
        total: Object.values(skuRevs).reduce((s, v) => s + v, 0),
        units,
        asp: aspInput && aspInput.units > 0 ? aspInput.revenue / aspInput.units : null,
        bestBsr: bestBsrByDate[date] || null,
      }
    })

  return { chartData, skus: Array.from(skuSet).sort() }
}

export default function SalesPage() {
  const [data, setData] = useState<SalesData | null>(null)
  const [demographics, setDemographics] = useState<DemographicsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [visibleKpis, setVisibleKpis] = useState<string[]>(['revenue', 'orders', 'units', 'aov', 'acos', 'roas', 'proas'])
  const [visibleSeries, setVisibleSeries] = useState<string[]>(['revenue', 'asp', 'adSpend', 'bestBsr'])
  const [viewSaved, setViewSaved] = useState(false)
  const [editingView, setEditingView] = useState(false)
  const filters = useDashboardFilters()
  const params = useSearchParams()
  const comparisonActive = params.get('compare') === 'previous'

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
  const skuPerf = Object.entries(skuMap).map(([sku, v]) => ({
    sku,
    ...v,
    revPerUnit: v.units > 0 ? v.revenue / v.units : 0,
  })).sort((a, b) => b.revenue - a.revenue)

  const overview = buildOverviewChart(sales, ads, bsr, filters.granularity)
  const overviewChartData = overview.chartData
  const skus = overview.skus
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
  const previousOverview = buildOverviewChart(previousSales, previousAds, previousBsr, filters.granularity)
  const chartSkus = Array.from(new Set([...skus, ...previousOverview.skus])).sort()
  const bsrAsinSet = new Set<string>()
  const bsrDateMap: Record<string, Record<string, number>> = {}
  for (const row of bsr) {
    const d = row.date?.slice(0, 10) || ''
    if (!bsrDateMap[d]) bsrDateMap[d] = {}
    const key = `${row.sku_name || row.asin}`
    bsrDateMap[d][key] = row.rank
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
    const d = row.date?.slice(0, 10) || ''
    if (!adTypeMap[d]) adTypeMap[d] = {}
    adTypeMap[d][row.ad_type] = (adTypeMap[d][row.ad_type] || 0) + (row.spend || 0)
    adTypes.add(row.ad_type)
  }
  const adTypeChartData = Object.entries(adTypeMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, types]) => ({ date, ...types }))
  const dailyAdMap: Record<string, { spend: number; sales: number }> = {}
  for (const row of ads) {
    const d = row.date?.slice(0, 10) || ''
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
    totalRevenue: number; totalUnits: number;
  }> = {}
  for (const row of ads) {
    const d = row.date?.slice(0, 10) || ''
    if (!unitEconByDate[d]) unitEconByDate[d] = { adSales: 0, adUnits: 0, adSpend: 0, adOrders: 0, totalRevenue: 0, totalUnits: 0 }
    unitEconByDate[d].adSales += row.sales_1d || 0
    unitEconByDate[d].adUnits += row.purchases_1d || 0
    unitEconByDate[d].adSpend += row.spend || 0
    unitEconByDate[d].adOrders += row.purchases_1d || 0
  }
  for (const row of sales) {
    const d = row.date?.slice(0, 10) || ''
    if (!unitEconByDate[d]) unitEconByDate[d] = { adSales: 0, adUnits: 0, adSpend: 0, adOrders: 0, totalRevenue: 0, totalUnits: 0 }
    unitEconByDate[d].totalRevenue += row.revenue || 0
    unitEconByDate[d].totalUnits += row.units || 0
  }

  const totalAdOrders = ads.reduce((s, r) => s + (r.purchases_1d || 0), 0)
  const proasChartData = Object.entries(unitEconByDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date,
      pROAS: v.adSpend > 0 ? parseFloat(((v.adSales - 4.93 * v.adUnits) / v.adSpend).toFixed(3)) : null,
      blendedPROAS: v.adSpend > 0 ? parseFloat(((v.totalRevenue - 4.93 * v.totalUnits) / v.adSpend).toFixed(3)) : null,
    }))

  const cacChartData = Object.entries(unitEconByDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date,
      CAC: v.adOrders > 0 ? parseFloat((v.adSpend / v.adOrders).toFixed(2)) : null,
      blendedCAC: v.adOrders > 0 ? parseFloat((v.adSpend / v.adOrders).toFixed(2)) : null,
    }))
  function buildOverviewKpis(periodSales: SalesRow[], periodAds: AdsRow[], sublabel?: string) {
    const revenue = periodSales.reduce((s, r) => s + (r.revenue || 0), 0)
    const orders = periodSales.reduce((s, r) => s + (r.orders || 0), 0)
    const units = periodSales.reduce((s, r) => s + (r.units || 0), 0)
    const adSpend = periodAds.reduce((s, r) => s + (r.spend || 0), 0)
    const adSales = periodAds.reduce((s, r) => s + (r.sales_1d || 0), 0)
    const adOrders = periodAds.reduce((s, r) => s + (r.purchases_1d || 0), 0)
    const periodAov = orders > 0 ? revenue / orders : 0
    const periodAcos = adSales > 0 ? adSpend / adSales * 100 : 0
    const periodRoas = adSpend > 0 ? adSales / adSpend : 0
    const periodProas = adSpend > 0 ? (adSales - 4.93 * units) / adSpend : 0
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

  function toggleSeries(key: string) {
    setViewSaved(false)
    setVisibleSeries(current => current.includes(key) ? current.filter(item => item !== key) : [...current, key])
  }

  function saveSalesView() {
    window.localStorage.setItem(SALES_VIEW_STORAGE_KEY, JSON.stringify({ visibleKpis, visibleSeries }))
    setViewSaved(true)
  }

  function renderKpiGrid(items: typeof overviewKpis, title?: string, editable = false) {
    const selectedItems = items.filter(item => visibleKpis.includes(item.key))
    return (
      <div className="sales-kpi-panel">
        {title && <div className="sales-kpi-panel-title">{title}</div>}
        <div className="sales-overview-kpi-grid">
          {selectedItems.map(item => (
            <div key={item.key} className={`sales-widget-card ${editable && editingView ? 'is-editing' : ''}`}>
              {editable && editingView && <button className="sales-widget-remove" onClick={() => toggleKpi(item.key)}>×</button>}
              <MetricCard
                label={item.label}
                value={item.value}
                sublabel={item.sublabel}
                status={item.status}
              />
            </div>
          ))}
        </div>
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

  function renderOverviewChart(chartData: Array<Record<string, unknown>>, title?: string) {
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
    return (
      <div className="sales-chart-panel">
        {title && <div className="sales-chart-card-title">{title}</div>}
        <div className="sales-stacked-chart">
          {visibleSeries.includes('revenue') && (
            <div className="sales-band sales-band-large">
              <div className="sales-band-label">Sales</div>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} syncId="sales-overview" margin={{ top: 10, right: 18, left: 18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="1 5" stroke="#D8DDD7" vertical />
                  <XAxis dataKey="date" hide />
                  <YAxis orientation="right" width={70} tick={{ fontSize: 11, fill: '#6B746C' }} tickFormatter={v => '$' + Number(v).toLocaleString()} axisLine={false} tickLine={false} />
                  <Tooltip cursor={cursor} contentStyle={tooltipStyle} formatter={(value: unknown) => [fmtMoney(Number(value)), 'Sales']} />
                  <Line type="monotone" dataKey="total" stroke="var(--biohuez-dark)" strokeWidth={2.5} dot={false} connectNulls name="Sales" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          {visibleSeries.includes('asp') && (
            <div className="sales-band">
              <div className="sales-band-label">ASP</div>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} syncId="sales-overview" margin={{ top: 4, right: 18, left: 18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="1 5" stroke="#D8DDD7" vertical />
                  <XAxis dataKey="date" hide />
                  <YAxis orientation="right" width={70} tick={{ fontSize: 11, fill: '#6B746C' }} tickFormatter={v => '$' + Number(v).toLocaleString()} axisLine={false} tickLine={false} />
                  <Tooltip cursor={cursor} contentStyle={compactTooltip} formatter={(value: unknown) => [fmtMoney2(Number(value)), 'ASP']} />
                  <Line type="monotone" dataKey="asp" stroke="var(--biohuez-sage)" strokeWidth={1.9} dot={false} connectNulls name="ASP" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          {visibleSeries.includes('adSpend') && (
            <div className="sales-band sales-band-bars">
              <div className="sales-band-label">Ad Spend</div>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} syncId="sales-overview" margin={{ top: 2, right: 18, left: 18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="1 5" stroke="#D8DDD7" vertical />
                  <XAxis dataKey="date" hide />
                  <YAxis orientation="right" width={70} tick={{ fontSize: 11, fill: '#6B746C' }} tickFormatter={v => '$' + Number(v).toLocaleString()} axisLine={false} tickLine={false} />
                  <Tooltip cursor={cursor} contentStyle={compactTooltip} formatter={(value: unknown) => [fmtMoney(Number(value)), 'Ad Spend']} />
                  <Bar dataKey="adSpend" fill="var(--biohuez-gold)" opacity={0.48} radius={[2, 2, 0, 0]} name="Ad Spend" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          {visibleSeries.includes('bestBsr') && (
            <div className="sales-band">
              <div className="sales-band-label">BSR</div>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} syncId="sales-overview" margin={{ top: 4, right: 18, left: 18, bottom: 18 }}>
                  <CartesianGrid strokeDasharray="1 5" stroke="#D8DDD7" vertical />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#7B837C' }} tickFormatter={formatChartDate} axisLine={false} tickLine={false} />
                  <YAxis orientation="right" reversed width={70} tick={{ fontSize: 11, fill: '#6B746C' }} tickFormatter={v => Number(v).toLocaleString()} domain={['dataMin', 'dataMax']} axisLine={false} tickLine={false} />
                  <Tooltip cursor={cursor} position={{ y: 8 }} contentStyle={compactTooltip} formatter={(value: unknown) => ['#' + Number(value).toLocaleString(), 'Best BSR']} />
                  <Area type="monotone" dataKey="bestBsr" stroke="var(--biohuez-gold)" strokeWidth={1.8} fill="var(--biohuez-gold)" fillOpacity={0.14} dot={false} connectNulls name="Best BSR" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '0 0 40px' }}>
      <Tabs defaultValue="overview">
        <div className="dashboard-tabs-scroll">
          <TabsList style={{ marginBottom: 20, background: '#F0F0F0' }}>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="intelligence">Sales Mix</TabsTrigger>
            <TabsTrigger value="traffic">Traffic</TabsTrigger>
            <TabsTrigger value="bsr">BSR</TabsTrigger>
            <TabsTrigger value="unit-economics">Unit Economics</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview">
          <div className="sales-overview-page">
            <section className="sales-overview-kpis">
              <div className="sales-kpi-picker">
                <div className="sales-view-actions">
                  <button className="sales-save-view-button secondary" onClick={() => setEditingView(!editingView)}>
                    {editingView ? 'Done editing' : 'Edit view'}
                  </button>
                  <button className="sales-save-view-button" onClick={saveSalesView}>
                    {viewSaved ? 'Saved' : 'Save view'}
                  </button>
                </div>
              </div>

              {editingView && (
                <div className="sales-kpi-options edit-mode">
                  {overviewKpis.map(item => {
                    const active = visibleKpis.includes(item.key)
                    return (
                      <button key={item.key} className={`sales-widget-toggle ${active ? 'active' : ''}`} onClick={() => toggleKpi(item.key)}>
                        {active ? '×' : '+'} {item.label}
                      </button>
                    )
                  })}
                </div>
              )}

              {comparisonActive ? (
                <div className="sales-compare-grid sales-compare-kpis">
                  {renderKpiGrid(overviewKpis, 'Current period', true)}
                  {renderKpiGrid(previousOverviewKpis, 'Previous period')}
                </div>
              ) : (
                renderKpiGrid(overviewKpis, undefined, true)
              )}
            </section>

            <section>
            <div>
              <div className="sales-chart-toolbar">
                <SectionHeader title={intervalTitle(filters.interval)} subtitle="Choose the chart layers and compare period view." />
                <div className="sales-chart-picker">
                  {[
                    { key: 'revenue', label: 'Sales' },
                    { key: 'asp', label: 'ASP' },
                    { key: 'adSpend', label: 'Ad Spend' },
                    { key: 'bestBsr', label: 'BSR' },
                  ].map(item => (
                    <label key={item.key} className="sales-kpi-option">
                      <input
                        type="checkbox"
                        checked={visibleSeries.includes(item.key)}
                        onChange={() => toggleSeries(item.key)}
                      />
                      <span>{item.label}</span>
                    </label>
                  ))}
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
          </div>

          <SectionHeader title="SKU Performance" />
          <div className="dashboard-table-card">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #EBEBEB' }}>
                  {['SKU', 'Revenue', 'Orders', 'Units', 'Rev/Unit'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: h === 'SKU' ? 'left' : 'right', color: '#666', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {skuPerf.map(row => (
                  <tr key={row.sku} style={{ borderBottom: '1px solid #F5F5F5' }}>
                    <td style={{ padding: '8px 12px' }}>
                      <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: SKU_COLORS[row.sku] || '#ccc', marginRight: 8 }} />
                      {skuLabel(row.sku)}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>{fmtMoney(row.revenue)}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>{fmt(row.orders)}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>{fmt(row.units)}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>{fmtMoney2(row.revPerUnit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="intelligence">
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
        </TabsContent>
        <TabsContent value="traffic">
          <SectionHeader title="Revenue by SKU Over Time" />
          <div className="dashboard-chart-card" style={{ background: 'white', borderRadius: 10, padding: 16, marginBottom: 16 }}>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={overviewChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EBEBEB" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={v => v?.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => '$' + v} />
                <Tooltip formatter={(value: unknown) => fmtMoney(Number(value))} />
                <Legend formatter={value => skuLabel(String(value))} />
                {skus.map(sku => (
                  <Area key={sku} type="monotone" dataKey={sku} stackId="a"
                    fill={SKU_COLORS[sku] || '#ccc'} stroke={SKU_COLORS[sku] || '#ccc'} fillOpacity={0.8} name={skuLabel(sku)} />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <SectionHeader title="Daily Orders by SKU" />
          <div className="dashboard-chart-card" style={{ background: 'white', borderRadius: 10, padding: 16, marginBottom: 16 }}>
            {(() => {
              const orderData = Object.entries(
                sales.reduce<Record<string, Record<string, number>>>((acc, row) => {
                  const d = row.date?.slice(0, 10) || ''
                  if (!acc[d]) acc[d] = {}
                  acc[d][row.sku] = (acc[d][row.sku] || 0) + (row.orders || 0)
                  return acc
                }, {})
              ).sort(([a], [b]) => a.localeCompare(b)).map(([date, skuOrders]) => ({ date, ...skuOrders }))
              return (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={orderData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EBEBEB" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={v => v?.slice(5)} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend formatter={value => skuLabel(String(value))} />
                    {skus.map(sku => (
                      <Bar key={sku} dataKey={sku} stackId="o" fill={SKU_COLORS[sku] || '#ccc'} name={skuLabel(sku)} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              )
            })()}
          </div>
        </TabsContent>
        <TabsContent value="bsr">
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
        </TabsContent>
        <TabsContent value="ads">
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
        </TabsContent>
        <TabsContent value="unit-economics">
          <div className="dashboard-kpi-grid">
            <MetricCard label="pROAS (All)" value={totalAdSpend > 0 ? ((totalAdSales - 4.93 * totalUnits) / totalAdSpend).toFixed(2) + 'x' : '—'} />
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
        </TabsContent>
        <TabsContent value="customer-journey">
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
        </TabsContent>
      </Tabs>
    </div>
  )
}
