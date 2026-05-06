'use client'
import { LoadingSkeleton } from '@/components/loading-skeleton'
import { DataState } from '@/components/data-state'

import { useEffect, useState } from 'react'
import { SectionHeader } from '@/components/section-header'
import { MetricCard } from '@/components/metric-card'
import { SignalGrid } from '@/components/insight-card'
import { BarChart, Bar, ComposedChart, Area, Line, AreaChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface DowRow { day: string; orders: number; revenue: number }
interface MonthRow { month: string; orders: number; revenue: number }
interface WeekRow { week: string; orders: number; revenue: number }
interface HourRow { hour: number; orders: number }

interface SeasonalitySignal {
  severity: 'normal' | 'warn' | 'alert'
  title: string
  detail: string
}

interface ForecastRow {
  week: string
  forecast_orders: number
  forecast_revenue: number
  confidence: 'low' | 'medium' | 'high'
}

interface WeeklyMomentumRow {
  week: string
  orders: number
  revenue: number
  orders_4w_avg: number
  revenue_4w_avg: number
  orders_wow_pct: number | null
  revenue_wow_pct: number | null
}

interface PeriodRow {
  period_type: string
  period: string
  orders: number
  revenue: number
}

interface SeasonalityInsights {
  summary: {
    latest_week?: string
    latest_orders?: number
    latest_revenue?: number
    latest_orders_wow_pct?: number | null
    latest_revenue_wow_pct?: number | null
    last4_avg_orders?: number
    prior4_avg_orders?: number
    last4_vs_prior4_pct?: number | null
    last4_order_volatility_pct?: number
    peak_day?: string
    peak_day_index?: number
    slow_day?: string
    slow_day_index?: number
    peak_month?: string
    peak_month_index?: number
    slow_month?: string
    slow_month_index?: number
  }
  signals: SeasonalitySignal[]
  forecast: ForecastRow[]
  weekly_momentum: WeeklyMomentumRow[]
  peak_periods: PeriodRow[]
  slow_periods: PeriodRow[]
}

interface SeasonalityData {
  day_of_week: DowRow[]
  month_orders: MonthRow[]
  week_orders: WeekRow[]
  hour_orders: HourRow[]
  monthly_revenue?: MonthRow[]
  insights?: SeasonalityInsights
  error?: string
}

function fmtMoney(n: number | null | undefined) {
  if (n == null) return '—'
  return '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 })
}
function fmtNum(n: number | null | undefined) {
  if (n == null) return '—'
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 })
}
function fmtPct(n: number | null | undefined) {
  if (n == null) return '—'
  const sign = Number(n) > 0 ? '+' : ''
  return sign + Number(n).toFixed(1) + '%'
}
export default function SeasonalityPage() {
  const [data, setData] = useState<SeasonalityData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/seasonality')
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingSkeleton />
  if (!data || data.error) return (
    <DataState
      title="Seasonality data could not load"
      description={data?.error || 'Check the sales data connection and try refreshing this page.'}
      variant="error"
    />
  )

  const { day_of_week, month_orders, week_orders, hour_orders } = data
  const insights = data.insights || {
    summary: {},
    signals: [],
    forecast: [],
    weekly_momentum: [],
    peak_periods: [],
    slow_periods: [],
  }
  if (day_of_week.length === 0 && month_orders.length === 0 && week_orders.length === 0 && hour_orders.length === 0) return (
    <DataState
      title="No seasonality data yet"
      description="Order patterns by day, week, and month will appear once sales history is available."
    />
  )
  const hasHours = hour_orders && hour_orders.some(r => r.orders > 0)

  // Find peak day
  const peakDay = day_of_week.length > 0 ? day_of_week.reduce((a, b) => a.orders > b.orders ? a : b) : null
  const peakMonth = month_orders.length > 0 ? month_orders.reduce((a, b) => a.orders > b.orders ? a : b) : null

  return (
    <div style={{ paddingBottom: 40 }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 4, color: '#1A1A1A' }}>Seasonality</h1>
      <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: 20 }}>Order patterns by day, week, and month</p>

      {/* Quick stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        <div style={{ background: 'white', borderRadius: 10, padding: '14px 16px', borderLeft: '4px solid #2D4A27', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
          <div style={{ fontSize: '0.72rem', color: '#666', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Peak Day</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1A1A1A', margin: '4px 0' }}>{peakDay?.day || '—'}</div>
          <div style={{ fontSize: '0.7rem', color: '#aaa' }}>{peakDay ? peakDay.orders + ' orders avg' : ''}</div>
        </div>
        <div style={{ background: 'white', borderRadius: 10, padding: '14px 16px', borderLeft: '4px solid #2D4A27', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
          <div style={{ fontSize: '0.72rem', color: '#666', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Peak Month</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1A1A1A', margin: '4px 0' }}>{peakMonth?.month || '—'}</div>
          <div style={{ fontSize: '0.7rem', color: '#aaa' }}>{peakMonth ? peakMonth.orders + ' orders' : ''}</div>
        </div>
        <div style={{ background: 'white', borderRadius: 10, padding: '14px 16px', borderLeft: '4px solid #2D4A27', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
          <div style={{ fontSize: '0.72rem', color: '#666', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Orders</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1A1A1A', margin: '4px 0' }}>
            {month_orders.reduce((s, r) => s + r.orders, 0).toLocaleString()}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#aaa' }}>across all periods</div>
        </div>
      </div>

      <SectionHeader title="Forecast Signals" subtitle="Near-term demand outlook from weekly order history" />
      <div className="dashboard-kpi-grid">
        <MetricCard
          label="Latest Week"
          value={fmtNum(insights.summary.latest_orders)}
          sublabel={insights.summary.latest_week || 'Orders'}
        />
        <MetricCard
          label="Orders WoW"
          value={fmtPct(insights.summary.latest_orders_wow_pct)}
          sublabel="Latest week"
          status={(insights.summary.latest_orders_wow_pct ?? 0) < -20 ? 'warn' : 'normal'}
        />
        <MetricCard
          label="4W Demand"
          value={fmtPct(insights.summary.last4_vs_prior4_pct)}
          sublabel="vs prior 4 weeks"
          status={(insights.summary.last4_vs_prior4_pct ?? 0) < -20 ? 'warn' : 'normal'}
        />
        <MetricCard
          label="Volatility"
          value={fmtPct(insights.summary.last4_order_volatility_pct)}
          sublabel="Last 4 weeks"
          status={(insights.summary.last4_order_volatility_pct ?? 0) > 35 ? 'warn' : 'normal'}
        />
      </div>

      <SignalGrid signals={insights.signals} />

      {insights.forecast.length > 0 && (
        <>
          <SectionHeader title="4-Week Order Forecast" subtitle="Simple momentum-adjusted forecast from recent demand" />
          <div style={{ background: 'white', borderRadius: 10, padding: 16, marginBottom: 20 }}>
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={insights.forecast}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EBEBEB" vertical={false} />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} tickFormatter={v => v?.slice(5)} />
                <YAxis yAxisId="orders" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="revenue" orientation="right" tick={{ fontSize: 11 }} tickFormatter={v => '$' + (v / 1000).toFixed(0) + 'k'} />
                <Tooltip formatter={(value: unknown, name: unknown) => String(name).includes('Revenue') ? fmtMoney(Number(value)) : Number(value).toFixed(1)} />
                <Legend />
                <Bar yAxisId="orders" dataKey="forecast_orders" fill="#B8D4AE" name="Forecast Orders" />
                <Line yAxisId="revenue" type="monotone" dataKey="forecast_revenue" stroke="#2D4A27" strokeWidth={2} name="Forecast Revenue" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16, marginBottom: 20 }}>
        <div>
          <SectionHeader title="Peak Periods" subtitle="Strongest observed demand periods" />
          <div style={{ background: 'white', borderRadius: 10, padding: 16, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #EBEBEB' }}>
                  {['Type', 'Period', 'Orders', 'Revenue'].map(h => (
                    <th key={h} style={{ padding: '8px 8px', textAlign: h === 'Orders' || h === 'Revenue' ? 'right' : 'left', color: '#666', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {insights.peak_periods.slice(0, 8).map((row, index) => (
                  <tr key={`${row.period_type}-${row.period}-${index}`} style={{ borderBottom: '1px solid #F5F5F5' }}>
                    <td style={{ padding: '8px 8px', fontWeight: 700 }}>{row.period_type}</td>
                    <td style={{ padding: '8px 8px' }}>{row.period}</td>
                    <td style={{ padding: '8px 8px', textAlign: 'right' }}>{fmtNum(row.orders)}</td>
                    <td style={{ padding: '8px 8px', textAlign: 'right' }}>{fmtMoney(row.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <SectionHeader title="Slow Periods" subtitle="Weakest observed demand periods" />
          <div style={{ background: 'white', borderRadius: 10, padding: 16, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #EBEBEB' }}>
                  {['Type', 'Period', 'Orders', 'Revenue'].map(h => (
                    <th key={h} style={{ padding: '8px 8px', textAlign: h === 'Orders' || h === 'Revenue' ? 'right' : 'left', color: '#666', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {insights.slow_periods.slice(0, 8).map((row, index) => (
                  <tr key={`${row.period_type}-${row.period}-${index}`} style={{ borderBottom: '1px solid #F5F5F5' }}>
                    <td style={{ padding: '8px 8px', fontWeight: 700 }}>{row.period_type}</td>
                    <td style={{ padding: '8px 8px' }}>{row.period}</td>
                    <td style={{ padding: '8px 8px', textAlign: 'right' }}>{fmtNum(row.orders)}</td>
                    <td style={{ padding: '8px 8px', textAlign: 'right' }}>{fmtMoney(row.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {insights.weekly_momentum.length > 0 && (
        <>
          <SectionHeader title="Weekly Momentum" subtitle="Orders with rolling 4-week average" />
          <div style={{ background: 'white', borderRadius: 10, padding: 16, marginBottom: 20 }}>
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={insights.weekly_momentum}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EBEBEB" vertical={false} />
                <XAxis dataKey="week" tick={{ fontSize: 10 }} tickFormatter={v => v?.slice(5)} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="orders" fill="#B8D4AE" name="Orders" />
                <Line type="monotone" dataKey="orders_4w_avg" stroke="#2D4A27" strokeWidth={2.5} dot={false} name="4W Avg Orders" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {/* Day of week */}
      {day_of_week.length > 0 && (
        <>
          <SectionHeader title="Orders by Day of Week" subtitle="Total orders per day across all history" />
          <div style={{ background: 'white', borderRadius: 10, padding: 16, marginBottom: 16 }}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={day_of_week}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EBEBEB" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} tickFormatter={v => v?.slice(0, 3)} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="orders" fill="#2D4A27" name="Orders" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ background: 'white', borderRadius: 10, padding: 16, marginBottom: 16 }}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={day_of_week}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EBEBEB" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} tickFormatter={v => v?.slice(0, 3)} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => '$' + v} />
                <Tooltip formatter={(value: unknown) => fmtMoney(Number(value))} />
                <Bar dataKey="revenue" fill="#6B8F61" name="Revenue" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {/* Monthly chart */}
      {month_orders.length > 0 && (
        <>
          <SectionHeader title="Monthly Orders & Revenue" />
          <div style={{ background: 'white', borderRadius: 10, padding: 16, marginBottom: 16 }}>
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={month_orders}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EBEBEB" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="orders" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="revenue" orientation="right" tick={{ fontSize: 11 }} tickFormatter={v => '$' + (v/1000).toFixed(0) + 'k'} />
                <Tooltip formatter={(value: unknown, name: unknown) => name === 'Revenue' ? fmtMoney(Number(value)) : String(value)} />
                <Legend />
                <Bar yAxisId="orders" dataKey="orders" fill="#B8D4AE" name="Orders" />
                <Line yAxisId="revenue" type="monotone" dataKey="revenue" stroke="#2D4A27" strokeWidth={2} dot name="Revenue" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {/* Weekly trend */}
      {week_orders.length > 0 && (
        <>
          <SectionHeader title="Weekly Order Trend" />
          <div style={{ background: 'white', borderRadius: 10, padding: 16, marginBottom: 16 }}>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={week_orders}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EBEBEB" vertical={false} />
                <XAxis dataKey="week" tick={{ fontSize: 10 }} tickFormatter={v => v?.slice(5)} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Area type="monotone" dataKey="orders" fill="#B8D4AE" stroke="#2D4A27" strokeWidth={2} fillOpacity={0.6} name="Orders" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {/* Hour of day */}
      {hasHours && (
        <>
          <SectionHeader title="Orders by Hour of Day" subtitle="UTC timezone from order data" />
          <div style={{ background: 'white', borderRadius: 10, padding: 16 }}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={hour_orders}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EBEBEB" vertical={false} />
                <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="orders" fill="#2980B9" name="Orders" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  )
}
