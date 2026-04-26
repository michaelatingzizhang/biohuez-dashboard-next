'use client'
import { LoadingSkeleton } from '@/components/loading-skeleton'

import { useEffect, useState } from 'react'
import { MetricCard } from '@/components/metric-card'
import { SectionHeader } from '@/components/section-header'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
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

interface SalesRow {
  date: string
  sku: string
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

interface SalesData {
  sales: SalesRow[]
  ads: AdsRow[]
  ads_by_type: AdsByTypeRow[]
  bsr: BsrRow[]
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
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function filterByDays(sales: SalesRow[], ads: AdsRow[], days: number) {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffStr = cutoff.toISOString().slice(0, 10)
  return {
    sales: sales.filter(r => r.date >= cutoffStr),
    ads: ads.filter(r => r.date >= cutoffStr),
  }
}

function computeKPIs(sales: SalesRow[], ads: AdsRow[]) {
  const totalRevenue = sales.reduce((s, r) => s + (r.revenue || 0), 0)
  const totalOrders = sales.reduce((s, r) => s + (r.orders || 0), 0)
  const totalUnits = sales.reduce((s, r) => s + (r.units || 0), 0)
  const totalSessions = sales.reduce((s, r) => s + (r.sessions || 0), 0)
  const totalAdSpend = ads.reduce((s, r) => s + (r.spend || 0), 0)
  const totalAdSales = ads.reduce((s, r) => s + (r.sales_1d || 0), 0)
  const totalAdOrders = ads.reduce((s, r) => s + (r.purchases_1d || 0), 0)
  const asp = totalUnits > 0 ? totalRevenue / totalUnits : 0
  const pROAS = totalAdSpend > 0 ? (totalAdSales - 4.93 * totalUnits) / totalAdSpend : 0
  const cvr = totalSessions > 0 ? (totalUnits / totalSessions) * 100 : 0
  const organicSalesPct = totalRevenue > 0 ? (totalRevenue - totalAdSales) / totalRevenue * 100 : 0
  const cac = totalAdOrders > 0 ? totalAdSpend / totalAdOrders : 0
  const aov = totalOrders > 0 ? totalRevenue / totalOrders : 0
  return { asp, pROAS, cvr, organicSalesPct, cac, aov }
}

export default function SalesPage() {
  const [data, setData] = useState<SalesData | null>(null)
  const [demographics, setDemographics] = useState<DemographicsData | null>(null)
  const [loading, setLoading] = useState(true)

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

  if (loading) return <LoadingSkeleton />
  if (!data || data.error) return <div style={{ padding: 40, color: '#C0392B' }}>Error loading data: {data?.error}</div>

  const { sales, ads, ads_by_type, bsr } = data

  // Aggregate totals
  const totalRevenue = sales.reduce((s, r) => s + (r.revenue || 0), 0)
  const totalOrders = sales.reduce((s, r) => s + (r.orders || 0), 0)
  const totalUnits = sales.reduce((s, r) => s + (r.units || 0), 0)

  // Total ad spend
  const totalAdSpend = ads.reduce((s, r) => s + (r.spend || 0), 0)
  const totalAdSales = ads.reduce((s, r) => s + (r.sales_1d || 0), 0)
  const acos = totalAdSales > 0 ? (totalAdSpend / totalAdSales * 100) : 0
  const roas = totalAdSpend > 0 ? (totalAdSales / totalAdSpend) : 0
  const aov = totalOrders > 0 ? totalRevenue / totalOrders : 0

  // SKU performance table
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

  // Revenue over time by SKU
  const dateSkuMap: Record<string, Record<string, number>> = {}
  const skuSet = new Set<string>()
  for (const row of sales) {
    const d = row.date?.slice(0, 10) || ''
    if (!dateSkuMap[d]) dateSkuMap[d] = {}
    dateSkuMap[d][row.sku] = (dateSkuMap[d][row.sku] || 0) + (row.revenue || 0)
    skuSet.add(row.sku)
  }
  const skus = Array.from(skuSet).sort()

  // Ad spend aggregated by date
  const adSpendByDate: Record<string, number> = {}
  for (const row of ads) {
    const d = row.date?.slice(0, 10) || ''
    adSpendByDate[d] = (adSpendByDate[d] || 0) + (row.spend || 0)
  }

  const revenueChartData = Object.entries(dateSkuMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, skuRevs]) => ({
      date,
      ...skuRevs,
      adSpend: adSpendByDate[date] || 0,
      total: Object.values(skuRevs).reduce((s, v) => s + v, 0),
    }))

  // BSR chart data
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

  // Current BSR
  const latestBsrDate = bsr.length > 0 ? bsr.map(r => r.date?.slice(0, 10)).sort().reverse()[0] : null
  const currentBsr = latestBsrDate ? bsr.filter(r => r.date?.slice(0, 10) === latestBsrDate) : []

  // Ad spend by type over time
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

  // Daily ACOS chart
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

  // Unit Economics chart data
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
  const totalSpend = totalAdSpend  // same as ad spend for now

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

  // KPI periods
  const kpi5w = computeKPIs(...Object.values(filterByDays(sales, ads, 35)) as [SalesRow[], AdsRow[]])
  const kpi10w = computeKPIs(...Object.values(filterByDays(sales, ads, 70)) as [SalesRow[], AdsRow[]])

  // Demographics / Customer Journey
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

  return (
    <div style={{ padding: '0 0 40px' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 4, color: '#1A1A1A' }}>Sales</h1>
      <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: 20 }}>Revenue, traffic, BSR, and ad performance</p>

      <Tabs defaultValue="overview">
        <TabsList style={{ marginBottom: 20, background: '#F0F0F0' }}>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="traffic">Traffic</TabsTrigger>
          <TabsTrigger value="bsr">BSR</TabsTrigger>
          <TabsTrigger value="ads">Ads</TabsTrigger>
          <TabsTrigger value="unit-economics">Unit Economics</TabsTrigger>
          <TabsTrigger value="customer-journey">Customer Journey</TabsTrigger>
        </TabsList>

        {/* TAB 1: OVERVIEW */}
        <TabsContent value="overview">
          {/* KPI Row 1: Last Full Month */}
          <SectionHeader title="Last Full Month" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
            <MetricCard label="Total Revenue" value={fmtMoney(totalRevenue)} />
            <MetricCard label="Total Orders" value={fmt(totalOrders)} />
            <MetricCard label="Total Units" value={fmt(totalUnits)} />
            <MetricCard label="AOV" value={fmtMoney(aov)} />
            <MetricCard label="ACOS" value={fmtPct(acos)} status={acos > 40 ? 'alert' : acos > 25 ? 'warn' : 'normal'} />
            <MetricCard label="ROAS" value={roas.toFixed(2) + 'x'} />
          </div>

          {/* KPI Row 2: Last 5 Weeks */}
          <SectionHeader title="Last 5 Weeks" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
            <MetricCard label="ASP" value={fmtMoney(kpi5w.asp)} />
            <MetricCard label="pROAS" value={kpi5w.pROAS.toFixed(2) + 'x'} status={kpi5w.pROAS < 1 ? 'alert' : kpi5w.pROAS < 2 ? 'warn' : 'normal'} />
            <MetricCard label="CVR%" value={fmtPct(kpi5w.cvr)} />
            <MetricCard label="Organic Sales%" value={fmtPct(kpi5w.organicSalesPct)} />
            <MetricCard label="CAC" value={fmtMoney(kpi5w.cac)} />
            <MetricCard label="AOV" value={fmtMoney(kpi5w.aov)} />
          </div>

          {/* KPI Row 3: Last 10 Weeks */}
          <SectionHeader title="Last 10 Weeks" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
            <MetricCard label="ASP" value={fmtMoney(kpi10w.asp)} />
            <MetricCard label="pROAS" value={kpi10w.pROAS.toFixed(2) + 'x'} status={kpi10w.pROAS < 1 ? 'alert' : kpi10w.pROAS < 2 ? 'warn' : 'normal'} />
            <MetricCard label="CVR%" value={fmtPct(kpi10w.cvr)} />
            <MetricCard label="Organic Sales%" value={fmtPct(kpi10w.organicSalesPct)} />
            <MetricCard label="CAC" value={fmtMoney(kpi10w.cac)} />
            <MetricCard label="AOV" value={fmtMoney(kpi10w.aov)} />
          </div>

          {/* Revenue vs Ad Spend Chart */}
          <SectionHeader title="Revenue vs Ad Spend" subtitle="Daily revenue by SKU with total ad spend overlay" />
          <div style={{ background: 'white', borderRadius: 10, padding: 16, marginBottom: 16 }}>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={revenueChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EBEBEB" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={v => v?.slice(5)} />
                <YAxis yAxisId="rev" tick={{ fontSize: 11 }} tickFormatter={v => '$' + (v/1000).toFixed(0) + 'k'} />
                <YAxis yAxisId="spend" orientation="right" tick={{ fontSize: 11 }} tickFormatter={v => '$' + v.toFixed(0)} />
                <Tooltip formatter={(value: unknown) => '$' + Number(value).toFixed(2)} />
                <Legend />
                {skus.map(sku => (
                  <Area key={sku} yAxisId="rev" type="monotone" dataKey={sku} stackId="rev"
                    fill={SKU_COLORS[sku] || '#ccc'} stroke={SKU_COLORS[sku] || '#ccc'} fillOpacity={0.8} name={sku} />
                ))}
                <Line yAxisId="spend" type="monotone" dataKey="adSpend" stroke="#E67E22" strokeWidth={2}
                  dot={false} name="Ad Spend" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* SKU Performance Table */}
          <SectionHeader title="SKU Performance" />
          <div style={{ background: 'white', borderRadius: 10, padding: 16, overflowX: 'auto' }}>
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
                      {row.sku}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>{fmtMoney(row.revenue)}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>{fmt(row.orders)}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>{fmt(row.units)}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>{fmtMoney(row.revPerUnit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* TAB 2: TRAFFIC */}
        <TabsContent value="traffic">
          <SectionHeader title="Revenue by SKU Over Time" />
          <div style={{ background: 'white', borderRadius: 10, padding: 16, marginBottom: 16 }}>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={revenueChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EBEBEB" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={v => v?.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => '$' + v} />
                <Tooltip formatter={(value: unknown) => '$' + Number(value).toFixed(2)} />
                <Legend />
                {skus.map(sku => (
                  <Area key={sku} type="monotone" dataKey={sku} stackId="a"
                    fill={SKU_COLORS[sku] || '#ccc'} stroke={SKU_COLORS[sku] || '#ccc'} fillOpacity={0.8} name={sku} />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <SectionHeader title="Daily Orders by SKU" />
          <div style={{ background: 'white', borderRadius: 10, padding: 16, marginBottom: 16 }}>
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
                    <Legend />
                    {skus.map(sku => (
                      <Bar key={sku} dataKey={sku} stackId="o" fill={SKU_COLORS[sku] || '#ccc'} name={sku} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              )
            })()}
          </div>
        </TabsContent>

        {/* TAB 3: BSR */}
        <TabsContent value="bsr">
          <SectionHeader title="BSR Rank Over Time" subtitle="Lower rank = better position" />
          <div style={{ background: 'white', borderRadius: 10, padding: 16, marginBottom: 16 }}>
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
          <div style={{ background: 'white', borderRadius: 10, padding: 16 }}>
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
                    <td style={{ padding: '8px 12px' }}>{row.sku_name}</td>
                    <td style={{ padding: '8px 12px', color: '#888', fontFamily: 'monospace', fontSize: '0.75rem' }}>{row.asin}</td>
                    <td style={{ padding: '8px 12px' }}>{row.category}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700 }}>#{row.rank}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* TAB 4: ADS */}
        <TabsContent value="ads">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 20 }}>
            <MetricCard label="Total Ad Spend" value={fmtMoney(totalAdSpend)} />
            <MetricCard label="Total Ad Sales" value={fmtMoney(totalAdSales)} />
            <MetricCard label="ACOS" value={fmtPct(acos)} status={acos > 40 ? 'alert' : acos > 25 ? 'warn' : 'normal'} />
            <MetricCard label="ROAS" value={roas.toFixed(2) + 'x'} />
          </div>

          <SectionHeader title="Ad Spend by Type" subtitle="SP / SB / SD over time" />
          <div style={{ background: 'white', borderRadius: 10, padding: 16, marginBottom: 16 }}>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={adTypeChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EBEBEB" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={v => v?.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => '$' + v} />
                <Tooltip formatter={(value: unknown) => '$' + Number(value).toFixed(2)} />
                <Legend />
                {Array.from(adTypes).map(t => (
                  <Bar key={t} dataKey={t} stackId="a" fill={AD_TYPE_COLORS[t] || '#ccc'} name={t} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>

          <SectionHeader title="Daily ACOS%" />
          <div style={{ background: 'white', borderRadius: 10, padding: 16 }}>
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

        {/* TAB 5: UNIT ECONOMICS */}
        <TabsContent value="unit-economics">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
            <MetricCard label="pROAS (All)" value={totalAdSpend > 0 ? ((totalAdSales - 4.93 * totalUnits) / totalAdSpend).toFixed(2) + 'x' : '—'} />
            <MetricCard label="CAC (Ad)" value={totalAdOrders > 0 ? fmtMoney(totalAdSpend / totalAdOrders) : '—'} />
            <MetricCard label="Ad Units" value={fmt(totalAdOrders)} />
          </div>

          <SectionHeader title="pROAS Over Time" subtitle="Break-even at 1.0x" />
          <div style={{ background: 'white', borderRadius: 10, padding: 16, marginBottom: 16 }}>
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
          <div style={{ background: 'white', borderRadius: 10, padding: 16 }}>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={cacChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EBEBEB" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={v => v?.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => '$' + v} />
                <Tooltip formatter={(value: unknown) => '$' + Number(value).toFixed(2)} />
                <Legend />
                <Bar dataKey="CAC" fill="#E67E22" name="Ad CAC" />
                <Bar dataKey="blendedCAC" fill="#2D4A27" name="Blended CAC" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </TabsContent>

        {/* TAB 6: CUSTOMER JOURNEY */}
        <TabsContent value="customer-journey">
          {/* KPI Ribbon */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
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
            <div style={{ padding: 40, color: '#888', textAlign: 'center' }}>No customer journey data available</div>
          ) : (
            <>
              <SectionHeader title="Revenue: New vs Repeat" subtitle="Monthly stacked revenue with repeat rate" />
              <div style={{ background: 'white', borderRadius: 10, padding: 16, marginBottom: 16 }}>
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
              <div style={{ background: 'white', borderRadius: 10, padding: 16, marginBottom: 16 }}>
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
              <div style={{ background: 'white', borderRadius: 10, padding: 16, overflowX: 'auto' }}>
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
