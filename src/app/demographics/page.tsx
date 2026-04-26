'use client'
import { LoadingSkeleton } from '@/components/loading-skeleton'

import { useEffect, useState } from 'react'
import { MetricCard } from '@/components/metric-card'
import { SectionHeader } from '@/components/section-header'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

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

interface DemoData {
  repeat_weekly: RepeatWeeklyRow[]
  repeat_monthly: RepeatMonthlyRow[]
  error?: string
}

function fmtPct(n: number | null | undefined) {
  if (n == null) return '—'
  return Number(n).toFixed(1) + '%'
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
  const hasData = weekly.length > 0 || monthly.length > 0

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
          <TabsTrigger value="repeat">Repeat Purchase</TabsTrigger>
        </TabsList>

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
      </Tabs>
    </div>
  )
}
