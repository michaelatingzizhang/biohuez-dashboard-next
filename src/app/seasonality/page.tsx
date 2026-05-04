'use client'
import { LoadingSkeleton } from '@/components/loading-skeleton'
import { DataState } from '@/components/data-state'

import { useEffect, useState } from 'react'
import { SectionHeader } from '@/components/section-header'
import { BarChart, Bar, ComposedChart, Area, Line, AreaChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface DowRow { day: string; orders: number; revenue: number }
interface MonthRow { month: string; orders: number; revenue: number }
interface WeekRow { week: string; orders: number; revenue: number }
interface HourRow { hour: number; orders: number }

interface SeasonalityData {
  day_of_week: DowRow[]
  month_orders: MonthRow[]
  week_orders: WeekRow[]
  hour_orders: HourRow[]
  monthly_revenue?: MonthRow[]
  error?: string
}

function fmtMoney(n: number | null | undefined) {
  if (n == null) return '—'
  return '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 })
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
