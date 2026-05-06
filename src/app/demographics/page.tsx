'use client'
import { LoadingSkeleton } from '@/components/loading-skeleton'

import { useEffect, useState } from 'react'
import { MetricCard } from '@/components/metric-card'
import { SectionHeader } from '@/components/section-header'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { SignalGrid } from '@/components/insight-card'
import { LineChart, Line, BarChart, Bar, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface RepeatWeeklyRow {
  period_start: string
  period_end: string
  asin: string
  orders: string
  unique_customers: string
  repeat_customers_pct_total: string
  repeat_purchase_revenue: string
  repeat_purchase_revenue_pct_total: string
}

interface RepeatMonthlyRow {
  period_start?: string
  asin?: string
  orders?: string
  unique_customers?: string
  repeat_customers_pct_total?: string
  repeat_purchase_revenue?: string
}

interface DemographicRow {
  date: string
  category_type: string
  segment_name: string
  customer_pct: number
  customer_count: number
  units_ordered: number
}

interface CustomerSignal {
  severity: 'normal' | 'warn' | 'alert'
  title: string
  detail: string
}

interface RepeatTrendRow {
  period_short: string
  orders: number
  unique_customers: number
  repeat_revenue: number
  repeat_rate_pct: number
  repeat_rate_delta: number | null
}

interface AsinRepeatHealthRow {
  asin: string
  periods: number
  orders: number
  unique_customers: number
  avg_repeat_rate_pct: number
  repeat_revenue: number
}

interface SegmentShiftRow {
  category_type: string
  segment_name: string
  latest_date: string
  previous_date: string
  customer_pct: number
  previous_customer_pct: number
  delta_pct: number
}

interface CustomerInsights {
  summary: {
    latest_period?: string
    latest_repeat_rate_pct?: number
    latest_unique_customers?: number
    latest_orders?: number
    latest_repeat_revenue?: number
    repeat_rate_delta?: number | null
    latest_demographic_date?: string
  }
  signals: CustomerSignal[]
  repeat_trend: RepeatTrendRow[]
  asin_repeat_health: AsinRepeatHealthRow[]
  segment_leaders: DemographicRow[]
  segment_shifts: SegmentShiftRow[]
  demographic_mix: DemographicRow[]
}

interface DemoData {
  repeat_weekly: RepeatWeeklyRow[]
  repeat_monthly: RepeatMonthlyRow[]
  demographics_weekly?: DemographicRow[]
  demographics_monthly?: DemographicRow[]
  insights?: CustomerInsights
  error?: string
}

function fmtPct(n: number | null | undefined) {
  if (n == null) return '—'
  return Number(n).toFixed(1) + '%'
}
function fmtMoney(n: number | null | undefined) {
  if (n == null) return '—'
  return '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 })
}
function fmtNum(n: number | null | undefined) {
  if (n == null) return '—'
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 })
}
function fmtSignedPct(n: number | null | undefined) {
  if (n == null) return '—'
  const sign = Number(n) > 0 ? '+' : ''
  return sign + Number(n).toFixed(1) + ' pts'
}
export default function DemographicsPage() {
  const [data, setData] = useState<DemoData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/demographics')
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingSkeleton />

  const weekly = data?.repeat_weekly || []
  const monthly = data?.repeat_monthly || []
  const insights = data?.insights || {
    summary: {},
    signals: [],
    repeat_trend: [],
    asin_repeat_health: [],
    segment_leaders: [],
    segment_shifts: [],
    demographic_mix: [],
  }
  const hasData = weekly.length > 0 || monthly.length > 0 || insights.demographic_mix.length > 0

  if (!hasData) {
    return (
      <div style={{ paddingBottom: 40 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 4, color: '#1A1A1A' }}>Demographics</h1>
        <div style={{ background: '#F0F4EE', border: '1px solid #B8D4AE', borderRadius: 8, padding: 20, color: '#2D4A27', marginTop: 20 }}>
          Brand Analytics data not yet available. Once Brand Analytics reports are available, repeat purchase rates, customer counts, and cohort data will appear here.
        </div>
      </div>
    )
  }

  // Aggregate weekly repeat rate over time (brand level)
  const weeklyAgg: Record<string, { period: string; orders: number; repeat_pct: number; revenue: number; count: number }> = {}
  for (const row of weekly) {
    const k = row.period_start
    if (!weeklyAgg[k]) weeklyAgg[k] = { period: k, orders: 0, repeat_pct: 0, revenue: 0, count: 0 }
    weeklyAgg[k].orders += Number(row.orders) || 0
    weeklyAgg[k].repeat_pct += Number(row.repeat_customers_pct_total) || 0
    weeklyAgg[k].revenue += Number(row.repeat_purchase_revenue) || 0
    weeklyAgg[k].count += 1
  }
  const weeklyChart = Object.values(weeklyAgg)
    .sort((a, b) => a.period.localeCompare(b.period))
    .map(r => ({
      ...r,
      repeat_pct: r.count > 0 ? r.repeat_pct / r.count : 0,
    }))

  // Latest week stats
  const latestWeek = weeklyChart.length > 0 ? weeklyChart[weeklyChart.length - 1] : null
  const latestMonthly = monthly.length > 0 ? monthly[monthly.length - 1] : null

  // Monthly aggregation
  const monthlyAgg: Record<string, { month: string; orders: number; repeat_pct: number; revenue: number; count: number }> = {}
  for (const row of monthly) {
    const k = (row.period_start || '').slice(0, 7)
    if (!k) continue
    if (!monthlyAgg[k]) monthlyAgg[k] = { month: k, orders: 0, repeat_pct: 0, revenue: 0, count: 0 }
    monthlyAgg[k].orders += Number(row.orders) || 0
    monthlyAgg[k].repeat_pct += Number(row.repeat_customers_pct_total) || 0
    monthlyAgg[k].revenue += Number(row.repeat_purchase_revenue) || 0
    monthlyAgg[k].count += 1
  }
  const monthlyChart = Object.values(monthlyAgg)
    .sort((a, b) => a.month.localeCompare(b.month))
    .map(r => ({
      ...r,
      repeat_pct: r.count > 0 ? r.repeat_pct / r.count : 0,
      new_orders: Math.max(0, r.orders - r.orders * (r.repeat_pct / r.count / 100 || 0)),
      repeat_orders: r.orders * (r.repeat_pct / r.count / 100 || 0),
    }))

  return (
    <div style={{ paddingBottom: 40 }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 4, color: '#1A1A1A' }}>Demographics</h1>
      <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: 20 }}>Brand Analytics repeat purchase data</p>

      <Tabs defaultValue="repeat">
        <TabsList style={{ marginBottom: 20, background: '#F0F0F0' }}>
          <TabsTrigger value="intelligence">Intelligence</TabsTrigger>
          <TabsTrigger value="repeat">Repeat Purchase</TabsTrigger>
          <TabsTrigger value="segments">Segments</TabsTrigger>
        </TabsList>

        <TabsContent value="intelligence">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
            <MetricCard
              label="Repeat Rate"
              value={fmtPct(insights.summary.latest_repeat_rate_pct)}
              sublabel={insights.summary.latest_period || 'Latest period'}
              status={(insights.summary.latest_repeat_rate_pct ?? 0) < 5 ? 'warn' : 'normal'}
            />
            <MetricCard
              label="Repeat Δ"
              value={fmtSignedPct(insights.summary.repeat_rate_delta)}
              sublabel="vs prior period"
              status={(insights.summary.repeat_rate_delta ?? 0) < -2 ? 'warn' : 'normal'}
            />
            <MetricCard
              label="Unique Customers"
              value={fmtNum(insights.summary.latest_unique_customers)}
              sublabel="Latest period"
            />
            <MetricCard
              label="Repeat Revenue"
              value={fmtMoney(insights.summary.latest_repeat_revenue)}
              sublabel="Latest period"
            />
          </div>

          <SignalGrid signals={insights.signals} />

          <SectionHeader title="Repeat Purchase Health" subtitle="Weekly customer retention and repeat revenue trend" />
          <div style={{ background: 'white', borderRadius: 10, padding: 16, marginBottom: 20 }}>
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={insights.repeat_trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EBEBEB" vertical={false} />
                <XAxis dataKey="period_short" tick={{ fontSize: 10 }} tickFormatter={v => v?.slice(5)} />
                <YAxis yAxisId="count" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="pct" orientation="right" tick={{ fontSize: 11 }} tickFormatter={v => v + '%'} />
                <Tooltip formatter={(value: unknown, name: unknown) => String(name).includes('%') ? Number(value).toFixed(1) + '%' : Number(value).toLocaleString()} />
                <Legend />
                <Bar yAxisId="count" dataKey="unique_customers" fill="#B8D4AE" name="Unique Customers" />
                <Bar yAxisId="count" dataKey="orders" fill="#E6D7A8" name="Orders" />
                <Line yAxisId="pct" type="monotone" dataKey="repeat_rate_pct" stroke="#2D4A27" strokeWidth={2.5} dot={false} name="Repeat Rate %" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16, marginBottom: 20 }}>
            <div>
              <SectionHeader title="ASIN Repeat Health" subtitle="Sorted by average repeat rate" />
              <div style={{ background: 'white', borderRadius: 10, padding: 16, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #EBEBEB' }}>
                      {['ASIN', 'Orders', 'Customers', 'Repeat %', 'Repeat Rev.'].map(h => (
                        <th key={h} style={{ padding: '8px 8px', textAlign: h === 'ASIN' ? 'left' : 'right', color: '#666', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {insights.asin_repeat_health.map(row => (
                      <tr key={row.asin} style={{ borderBottom: '1px solid #F5F5F5' }}>
                        <td style={{ padding: '8px 8px', fontFamily: 'monospace', fontSize: '0.72rem' }}>{row.asin}</td>
                        <td style={{ padding: '8px 8px', textAlign: 'right' }}>{fmtNum(row.orders)}</td>
                        <td style={{ padding: '8px 8px', textAlign: 'right' }}>{fmtNum(row.unique_customers)}</td>
                        <td style={{ padding: '8px 8px', textAlign: 'right', fontWeight: 700, color: row.avg_repeat_rate_pct < 5 ? '#E67E22' : '#2D4A27' }}>{fmtPct(row.avg_repeat_rate_pct)}</td>
                        <td style={{ padding: '8px 8px', textAlign: 'right' }}>{fmtMoney(row.repeat_revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <SectionHeader title="Segment Shifts" subtitle="Largest recent demographic mix changes" />
              <div style={{ background: 'white', borderRadius: 10, padding: 16, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #EBEBEB' }}>
                      {['Category', 'Segment', 'Share', 'Δ'].map(h => (
                        <th key={h} style={{ padding: '8px 8px', textAlign: h === 'Share' || h === 'Δ' ? 'right' : 'left', color: '#666', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {insights.segment_shifts.map((row, i) => (
                      <tr key={`${row.category_type}-${row.segment_name}-${i}`} style={{ borderBottom: '1px solid #F5F5F5' }}>
                        <td style={{ padding: '8px 8px' }}>{row.category_type}</td>
                        <td style={{ padding: '8px 8px', fontWeight: 600 }}>{row.segment_name}</td>
                        <td style={{ padding: '8px 8px', textAlign: 'right' }}>{fmtPct(row.customer_pct)}</td>
                        <td style={{ padding: '8px 8px', textAlign: 'right', color: row.delta_pct >= 0 ? '#2D4A27' : '#C0392B', fontWeight: 700 }}>{fmtSignedPct(row.delta_pct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="repeat">
          {/* KPI Ribbon */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
            <MetricCard
              label="Repeat Rate (Latest Week)"
              value={latestWeek ? fmtPct(latestWeek.repeat_pct) : '—'}
              sublabel={latestWeek ? latestWeek.period : ''}
            />
            <MetricCard
              label="Orders (Latest Week)"
              value={latestWeek ? String(latestWeek.orders) : '—'}
              sublabel="across all ASINs"
            />
            <MetricCard
              label="Repeat Revenue (Latest)"
              value={latestMonthly ? '$' + Number(latestMonthly.repeat_purchase_revenue || 0).toFixed(0) : '—'}
              sublabel="from repeat customers"
            />
          </div>

          {/* Weekly repeat rate chart */}
          {weeklyChart.length > 0 && (
            <>
              <SectionHeader title="Weekly Repeat Purchase Rate" subtitle="Brand Analytics — all ASINs averaged" />
              <div style={{ background: 'white', borderRadius: 10, padding: 16, marginBottom: 16 }}>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={weeklyChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EBEBEB" vertical={false} />
                    <XAxis dataKey="period" tick={{ fontSize: 10 }} tickFormatter={v => v?.slice(5)} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => v + '%'} domain={[0, 'auto']} />
                    <Tooltip formatter={(value: unknown) => Number(value).toFixed(1) + '%'} />
                    <Line type="monotone" dataKey="repeat_pct" stroke="#2D4A27" strokeWidth={2} dot name="Repeat Rate %" connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          )}

          {/* Monthly stacked bar */}
          {monthlyChart.length > 0 && (
            <>
              <SectionHeader title="Monthly Orders: New vs Repeat" />
              <div style={{ background: 'white', borderRadius: 10, padding: 16, marginBottom: 16 }}>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={monthlyChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EBEBEB" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value: unknown) => Number(value).toFixed(0)} />
                    <Legend />
                    <Bar dataKey="new_orders" stackId="a" fill="#B8D4AE" name="New Orders" />
                    <Bar dataKey="repeat_orders" stackId="a" fill="#2D4A27" name="Repeat Orders" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}

          {/* Table */}
          <SectionHeader title="Weekly Repeat Purchase Details" />
          <div style={{ background: 'white', borderRadius: 10, padding: 16, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #EBEBEB' }}>
                  {['Period', 'Orders', 'Repeat Rate%', 'Repeat Revenue'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: h === 'Period' ? 'left' : 'right', color: '#666', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weeklyChart.slice(-20).reverse().map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #F5F5F5' }}>
                    <td style={{ padding: '8px 12px' }}>{row.period}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>{row.orders}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>{fmtPct(row.repeat_pct)}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>${row.revenue.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="segments">
          <SectionHeader title="Latest Demographic Mix" subtitle={insights.summary.latest_demographic_date || 'Latest available manual Brand Analytics upload'} />
          <div style={{ background: 'white', borderRadius: 10, padding: 16, overflowX: 'auto', marginBottom: 20 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #EBEBEB' }}>
                  {['Category', 'Segment', 'Customer %', 'Customers', 'Units'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: h === 'Category' || h === 'Segment' ? 'left' : 'right', color: '#666', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {insights.demographic_mix.map((row, i) => (
                  <tr key={`${row.category_type}-${row.segment_name}-${i}`} style={{ borderBottom: '1px solid #F5F5F5' }}>
                    <td style={{ padding: '8px 12px' }}>{row.category_type}</td>
                    <td style={{ padding: '8px 12px', fontWeight: 600 }}>{row.segment_name}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>{fmtPct(row.customer_pct)}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>{fmtNum(row.customer_count)}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>{fmtNum(row.units_ordered)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <SectionHeader title="Top Segments by Category" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
            {insights.segment_leaders.map((row, i) => (
              <div key={`${row.category_type}-${row.segment_name}-${i}`} style={{ background: 'white', borderRadius: 10, padding: 14, borderLeft: '4px solid #2D4A27', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
                <div style={{ fontSize: '0.72rem', color: '#666', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>{row.category_type}</div>
                <div style={{ fontSize: '1rem', fontWeight: 800, color: '#1A1A1A' }}>{row.segment_name}</div>
                <div style={{ fontSize: '0.78rem', color: '#888', marginTop: 4 }}>
                  {fmtPct(row.customer_pct)} · {fmtNum(row.customer_count)} customers · {fmtNum(row.units_ordered)} units
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
