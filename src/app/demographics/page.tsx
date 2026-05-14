'use client'
import { LoadingSkeleton } from '@/components/loading-skeleton'

import { useEffect, useState } from 'react'
import { MetricCard } from '@/components/metric-card'
import { SectionHeader } from '@/components/section-header'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { SignalGrid } from '@/components/insight-card'
import { ReportSlide } from '@/components/report-slide'
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
  total_customers?: number
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

interface ProfileKpis {
  label?: string
  female?: number
  age_35_44?: number
  core_age_45_plus?: number
  income_100_125?: number
  income_125_150?: number
  core_income_150_plus?: number
}

interface ProfilePeriod {
  date: string
  label: string
}

interface ProfileComparisonRow {
  category_type: string
  segment_name: string
  period_a_pct: number
  period_b_pct: number
  delta_pct: number
  period_a_customers: number
  period_b_customers: number
  delta_customers: number
}

interface DemographicProfile {
  available_periods?: ProfilePeriod[]
  latest_date?: string
  latest_label?: string
  previous_date?: string
  previous_label?: string
  latest_customers?: number
  previous_customers?: number
  customer_delta?: number
  customer_delta_pct?: number | null
  latest_kpis?: ProfileKpis
  alltime_kpis?: ProfileKpis
  comparison?: ProfileComparisonRow[]
  snapshot?: DemographicRow[]
  trend?: DemographicRow[]
  trend_periods?: ProfilePeriod[]
}

type ProfileGranularity = 'monthly' | 'weekly'

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
  profiles?: {
    monthly?: DemographicProfile
    weekly?: DemographicProfile
  }
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
    profiles: { monthly: {}, weekly: {} },
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

      <Tabs defaultValue="intelligence">
        <TabsList style={{ marginBottom: 20, background: '#F0F0F0' }}>
          <TabsTrigger value="intelligence">Intelligence</TabsTrigger>
          <TabsTrigger value="profiles">Streamlit Profiles</TabsTrigger>
          <TabsTrigger value="repeat">Repeat Purchase</TabsTrigger>
          <TabsTrigger value="segments">Segments</TabsTrigger>
        </TabsList>

        <TabsContent value="intelligence">
          <ReportSlide
            title="Demographics Executive Summary"
            message="This slide should show whether repeat behavior and customer mix are improving or weakening."
            watch="Repeat rate, repeat-rate delta, unique customers, repeat revenue, and signal-level retention health."
            action="Use this slide to frame whether customer quality is compounding or flattening."
            order={1}
          >
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
          </ReportSlide>

          <ReportSlide
            title="Demographics Segment Detail"
            message="This slide should explain which ASINs or segments are shifting and where the repeat-quality story is strongest or weakest."
            watch="ASIN repeat health and the largest recent demographic segment shifts."
            action="Use this slide to connect retention changes to actual customer or product mix movement."
            order={2}
          >
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
          </ReportSlide>
        </TabsContent>

        <TabsContent value="profiles">
          <div className="dashboard-chart-grid">
            <ProfilePanel title="Monthly Profile" granularity="monthly" rows={data?.demographics_monthly || []} fallbackProfile={insights.profiles?.monthly} />
            <ProfilePanel title="Weekly Profile" granularity="weekly" rows={data?.demographics_weekly || []} fallbackProfile={insights.profiles?.weekly} />
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
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>{fmtMoney(row.revenue)}</td>
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

const kpiLabels: [keyof ProfileKpis, string][] = [
  ['female', 'Female'],
  ['age_35_44', 'Age 35-44'],
  ['core_age_45_plus', 'Core Age 45+'],
  ['income_100_125', 'Inc. $100k+'],
  ['income_125_150', 'Inc. $125k+'],
  ['core_income_150_plus', 'Core Inc. $150k+'],
]

function ProfilePanel({
  title,
  granularity,
  rows,
  fallbackProfile,
}: {
  title: string
  granularity: ProfileGranularity
  rows: DemographicRow[]
  fallbackProfile?: DemographicProfile
}) {
  const computed = buildProfileFromRows(rows, granularity)
  const [periodA, setPeriodA] = useState<string>(computed?.previous_date || fallbackProfile?.previous_date || '')
  const [periodB, setPeriodB] = useState<string>(computed?.latest_date || fallbackProfile?.latest_date || '')

  useEffect(() => {
    if (!computed) return
    setPeriodA(computed.previous_date || computed.latest_date || '')
    setPeriodB(computed.latest_date || '')
  }, [granularity, rows.length])

  const profile = buildProfileFromRows(rows, granularity, periodA, periodB) || fallbackProfile
  const hasProfile = Boolean(profile?.latest_kpis && profile?.comparison?.length)
  if (!hasProfile) {
    return (
      <div className="dashboard-card">
        <SectionHeader title={title} subtitle="No matching profile data available yet" />
        <div style={{ color: '#888', fontSize: '0.85rem' }}>Upload demographic exports to populate this Streamlit-matched profile module.</div>
      </div>
    )
  }

  const customerDelta = profile?.customer_delta ?? 0
  const customerDeltaPct = profile?.customer_delta_pct ?? null
  const topComparison = (profile?.comparison || []).slice(0, 10)
  const snapshot = (profile?.snapshot || []).filter(row => row.segment_name !== 'N/A').slice(0, 14)
  const trendRows = buildTrendRows(profile?.trend || [], profile?.trend_periods || [])
  const availablePeriods = profile?.available_periods || []

  return (
    <div className="dashboard-card">
      <SectionHeader
        title={title}
        subtitle={`${profile?.previous_label || 'Previous'} vs ${profile?.latest_label || 'Latest'}`}
      />

      {availablePeriods.length > 1 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12, marginBottom: 16 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ color: '#667268', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase' }}>Period A</span>
            <select
              value={periodA}
              onChange={(event) => setPeriodA(event.target.value)}
              style={{ minHeight: 36, borderRadius: 10, border: '1px solid rgba(34, 44, 38, 0.12)', padding: '0 10px', background: 'white' }}
            >
              {availablePeriods.map((period) => (
                <option key={`${title}-a-${period.date}`} value={period.date}>
                  {period.label}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ color: '#667268', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase' }}>Period B</span>
            <select
              value={periodB}
              onChange={(event) => setPeriodB(event.target.value)}
              style={{ minHeight: 36, borderRadius: 10, border: '1px solid rgba(34, 44, 38, 0.12)', padding: '0 10px', background: 'white' }}
            >
              {availablePeriods.map((period) => (
                <option key={`${title}-b-${period.date}`} value={period.date}>
                  {period.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      <div className="dashboard-kpi-grid-tight">
        <MetricCard label="Latest Customers" value={fmtNum(profile?.latest_customers)} sublabel={profile?.latest_label || 'Latest'} />
        <MetricCard label="Previous Customers" value={fmtNum(profile?.previous_customers)} sublabel={profile?.previous_label || 'Previous'} />
        <MetricCard
          label="Customer Change"
          value={`${customerDelta >= 0 ? '+' : ''}${fmtNum(customerDelta)}`}
          sublabel={customerDeltaPct == null ? 'No prior period' : `${customerDeltaPct >= 0 ? '+' : ''}${customerDeltaPct.toFixed(1)}%`}
          status={customerDelta < 0 ? 'warn' : 'normal'}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <SectionHeader title="Latest Profile KPIs" subtitle={profile?.latest_kpis?.label || 'Latest period'} />
        <ProfileKpiGrid kpis={profile?.latest_kpis} />
      </div>

      <div style={{ marginBottom: 16 }}>
        <SectionHeader title="All-Time Weighted Profile" subtitle={profile?.alltime_kpis?.label || 'Available period range'} />
        <ProfileKpiGrid kpis={profile?.alltime_kpis} />
      </div>

      <SectionHeader title="Period Comparison" subtitle="Largest share shifts versus previous period" />
      <div style={{ overflowX: 'auto', marginBottom: 16 }}>
        <table className="dashboard-table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Segment</th>
              <th>Previous</th>
              <th>Latest</th>
              <th>Delta</th>
              <th>Customer Delta</th>
            </tr>
          </thead>
          <tbody>
            {topComparison.map((row, index) => (
              <tr key={`${title}-${row.category_type}-${row.segment_name}-${index}`}>
                <td>{formatCategory(row.category_type)}</td>
                <td>{row.segment_name}</td>
                <td>{fmtPct(row.period_a_pct)}</td>
                <td>{fmtPct(row.period_b_pct)}</td>
                <td style={{ color: row.delta_pct >= 0 ? '#2D4A27' : '#C0392B', fontWeight: 700 }}>{fmtSignedPct(row.delta_pct)}</td>
                <td style={{ color: row.delta_customers >= 0 ? '#2D4A27' : '#C0392B', fontWeight: 700 }}>
                  {row.delta_customers >= 0 ? '+' : ''}{fmtNum(row.delta_customers)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SectionHeader title="Latest Snapshot" subtitle="Top non-N/A demographic segments in latest period" />
      <div style={{ height: 280, marginBottom: 16 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={snapshot} layout="vertical" margin={{ left: 80, right: 16, top: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#EBEBEB" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} />
            <YAxis type="category" dataKey="segment_name" tick={{ fontSize: 10 }} width={82} />
            <Tooltip formatter={(value: unknown) => Number(value).toFixed(1) + '%'} />
            <Bar dataKey="customer_pct" fill="#6B8F61" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <SectionHeader title="3-Period Trend" subtitle="Streamlit-style recent profile movement" />
      <div style={{ overflowX: 'auto' }}>
        <table className="dashboard-table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Segment</th>
              {(profile?.trend_periods || []).map(period => <th key={period.date}>{period.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {trendRows.slice(0, 18).map(row => (
              <tr key={`${title}-${row.category}-${row.segment}`}>
                <td>{formatCategory(row.category)}</td>
                <td>{row.segment}</td>
                {(profile?.trend_periods || []).map(period => (
                  <td key={period.date}>{fmtPct(row.values[period.date])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function buildProfileFromRows(rows: DemographicRow[], granularity: ProfileGranularity, selectedA?: string, selectedB?: string): DemographicProfile | undefined {
  if (!rows.length) return undefined

  const normalized = rows
    .filter((row) => row?.date)
    .map((row) => ({
      ...row,
      customer_pct: Number(row.customer_pct || 0),
      customer_count: Number(row.customer_count || 0),
      units_ordered: Number(row.units_ordered || 0),
      total_customers: Number(row.total_customers || 0),
    }))

  const dates = Array.from(new Set(normalized.map((row) => row.date))).sort()
  if (!dates.length) return undefined

  const labels = Object.fromEntries(dates.map((date) => [date, formatProfileDate(date, granularity)]))
  const latestDate = selectedB && dates.includes(selectedB) ? selectedB : dates[dates.length - 1]
  const previousDate = selectedA && dates.includes(selectedA) ? selectedA : (dates.length >= 2 ? dates[dates.length - 2] : latestDate)
  const latest = normalized.filter((row) => row.date === latestDate)
  const previous = normalized.filter((row) => row.date === previousDate)
  const trendDates = dates.filter((date) => date <= latestDate).slice(-Math.min(3, dates.length))

  const latestCustomers = maxCustomersForDate(latest)
  const previousCustomers = maxCustomersForDate(previous)
  const comparison = buildProfileComparison(normalized, previousDate, latestDate)

  return {
    available_periods: dates.map((date) => ({ date, label: labels[date] })),
    latest_date: latestDate,
    latest_label: labels[latestDate],
    previous_date: previousDate,
    previous_label: labels[previousDate],
    latest_customers: latestCustomers,
    previous_customers: previousCustomers,
    customer_delta: latestCustomers - previousCustomers,
    customer_delta_pct: previousCustomers ? ((latestCustomers - previousCustomers) / previousCustomers) * 100 : null,
    latest_kpis: profileKpisForRows(latest, labels[latestDate]),
    alltime_kpis: allTimeProfileKpis(normalized, `${labels[dates[0]]} - ${labels[dates[dates.length - 1]]}`),
    comparison,
    snapshot: latest.sort((a, b) => a.category_type.localeCompare(b.category_type) || b.customer_pct - a.customer_pct),
    trend: normalized.filter((row) => trendDates.includes(row.date)).sort((a, b) => a.category_type.localeCompare(b.category_type) || a.segment_name.localeCompare(b.segment_name) || a.date.localeCompare(b.date)),
    trend_periods: trendDates.map((date) => ({ date, label: labels[date] })),
  }
}

function formatProfileDate(value: string, granularity: ProfileGranularity) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value.slice(0, 10)
  return granularity === 'monthly'
    ? date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function maxCustomersForDate(rows: DemographicRow[]) {
  return rows.reduce((max, row) => Math.max(max, Number(row.total_customers || 0), Number(row.customer_count || 0)), 0)
}

function segmentPct(rows: DemographicRow[], category: string, segment: string) {
  const filtered = rows.filter((row) => row.category_type === category && row.segment_name === segment)
  if (!filtered.length) return 0
  return filtered.reduce((sum, row) => sum + Number(row.customer_pct || 0), 0) / filtered.length
}

function combinedPct(rows: DemographicRow[], category: string, segments: string[]) {
  const filtered = rows.filter((row) => row.category_type === category && segments.includes(row.segment_name))
  if (!filtered.length) return 0
  return filtered.reduce((sum, row) => sum + Number(row.customer_pct || 0), 0)
}

function weightedSegmentPct(rows: DemographicRow[], category: string, segment: string) {
  const filtered = rows.filter((row) => row.category_type === category && row.segment_name === segment)
  if (!filtered.length) return 0
  const weighted = filtered.reduce((sum, row) => sum + Number(row.customer_pct || 0) * Number(row.total_customers || 0), 0)
  const totalWeight = filtered.reduce((sum, row) => sum + Number(row.total_customers || 0), 0)
  return totalWeight > 0 ? weighted / totalWeight : segmentPct(filtered, category, segment)
}

function weightedCombinedPct(rows: DemographicRow[], category: string, segments: string[]) {
  const dates = Array.from(new Set(rows.filter((row) => row.category_type === category).map((row) => row.date)))
  if (!dates.length) return 0
  const values = dates.map((date) => {
    const scoped = rows.filter((row) => row.date === date && row.category_type === category)
    return {
      value: scoped.filter((row) => segments.includes(row.segment_name)).reduce((sum, row) => sum + Number(row.customer_pct || 0), 0),
      weight: maxCustomersForDate(scoped),
    }
  })
  const totalWeight = values.reduce((sum, item) => sum + item.weight, 0)
  return totalWeight > 0
    ? values.reduce((sum, item) => sum + item.value * item.weight, 0) / totalWeight
    : values.reduce((sum, item) => sum + item.value, 0) / values.length
}

function profileKpisForRows(rows: DemographicRow[], label: string): ProfileKpis {
  return {
    label,
    female: segmentPct(rows, 'gender', 'Female'),
    age_35_44: segmentPct(rows, 'age_group', '35-44'),
    core_age_45_plus: combinedPct(rows, 'age_group', ['45-54', '55-64', '65+']),
    income_100_125: segmentPct(rows, 'household_income', '$100k+'),
    income_125_150: segmentPct(rows, 'household_income', '$125k+'),
    core_income_150_plus: combinedPct(rows, 'household_income', ['$150k+', '$175k+', '$200k+', '$250k+']),
  }
}

function allTimeProfileKpis(rows: DemographicRow[], label: string): ProfileKpis {
  return {
    label,
    female: weightedSegmentPct(rows, 'gender', 'Female'),
    age_35_44: weightedSegmentPct(rows, 'age_group', '35-44'),
    core_age_45_plus: weightedCombinedPct(rows, 'age_group', ['45-54', '55-64', '65+']),
    income_100_125: weightedSegmentPct(rows, 'household_income', '$100k+'),
    income_125_150: weightedSegmentPct(rows, 'household_income', '$125k+'),
    core_income_150_plus: weightedCombinedPct(rows, 'household_income', ['$150k+', '$175k+', '$200k+', '$250k+']),
  }
}

function buildProfileComparison(rows: DemographicRow[], dateA: string, dateB: string): ProfileComparisonRow[] {
  const aRows = rows.filter((row) => row.date === dateA)
  const bRows = rows.filter((row) => row.date === dateB)
  const keys = Array.from(new Set([...aRows, ...bRows].map((row) => `${row.category_type}||${row.segment_name}`)))
  return keys
    .map((key) => {
      const [category_type, segment_name] = key.split('||')
      const a = aRows.filter((row) => row.category_type === category_type && row.segment_name === segment_name)
      const b = bRows.filter((row) => row.category_type === category_type && row.segment_name === segment_name)
      const periodA_pct = a.length ? a.reduce((sum, row) => sum + Number(row.customer_pct || 0), 0) / a.length : 0
      const periodB_pct = b.length ? b.reduce((sum, row) => sum + Number(row.customer_pct || 0), 0) / b.length : 0
      const periodA_customers = a.reduce((sum, row) => sum + Number(row.customer_count || 0), 0)
      const periodB_customers = b.reduce((sum, row) => sum + Number(row.customer_count || 0), 0)
      return {
        category_type,
        segment_name,
        period_a_pct: periodA_pct,
        period_b_pct: periodB_pct,
        delta_pct: periodB_pct - periodA_pct,
        period_a_customers: periodA_customers,
        period_b_customers: periodB_customers,
        delta_customers: periodB_customers - periodA_customers,
      }
    })
    .sort((left, right) => Math.abs(right.delta_pct) - Math.abs(left.delta_pct))
}

function ProfileKpiGrid({ kpis }: { kpis?: ProfileKpis }) {
  return (
    <div className="dashboard-kpi-grid-tight">
      {kpiLabels.map(([key, label]) => (
        <MetricCard key={key} label={label} value={fmtPct(kpis?.[key] as number | undefined)} sublabel={kpis?.label || ''} />
      ))}
    </div>
  )
}

function formatCategory(category: string) {
  return category.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function buildTrendRows(rows: DemographicRow[], periods: ProfilePeriod[]) {
  const map = new Map<string, { category: string; segment: string; values: Record<string, number> }>()
  for (const row of rows) {
    if (row.segment_name === 'N/A') continue
    const key = `${row.category_type}:${row.segment_name}`
    const existing = map.get(key) || { category: row.category_type, segment: row.segment_name, values: {} }
    existing.values[row.date] = row.customer_pct
    map.set(key, existing)
  }
  return [...map.values()]
    .map(row => ({
      ...row,
      maxValue: Math.max(...periods.map(period => row.values[period.date] || 0)),
    }))
    .sort((a, b) => b.maxValue - a.maxValue)
}
