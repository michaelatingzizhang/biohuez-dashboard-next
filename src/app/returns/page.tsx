'use client'
import { LoadingSkeleton } from '@/components/loading-skeleton'
import { DataState } from '@/components/data-state'

import { useEffect, useState } from 'react'
import { MetricCard } from '@/components/metric-card'
import { SectionHeader } from '@/components/section-header'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const SKU_COLORS: Record<string, string> = {
  'Black': '#2D4A27',
  'Chocolate': '#6B8F61',
  'Cream Latte': '#B8D4AE',
  'Red': '#C0392B',
  'ZH-FH-1B': '#2D4A27',
  'ZH-FH-3C': '#6B8F61',
  'ZH-FH-5CL': '#B8D4AE',
  'ZH-FH-6R': '#C0392B',
}

interface ReturnRow { date: string; sku_name: string; quantity: number; reason: string }
interface ReasonRow { reason: string; count: number }
interface BySkuRow { sku_name: string; total_returns: number; top_reason?: string }
interface UnitsRow { sku_name: string; units_sold: number }
interface TimeSeriesRow { date: string; sku_name: string; returns: number }

interface ReturnsData {
  returns: ReturnRow[]
  reasons: ReasonRow[]
  by_sku: BySkuRow[]
  units_by_sku: UnitsRow[]
  time_series: TimeSeriesRow[]
  error?: string
}

function fmtPct(n: number | null | undefined) {
  if (n == null) return '—'
  return Number(n).toFixed(1) + '%'
}

export default function ReturnsPage() {
  const [data, setData] = useState<ReturnsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/returns')
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingSkeleton />
  if (!data || data.error) return (
    <DataState
      title="Returns data could not load"
      description={data?.error || 'Check the returns export connection and try refreshing this page.'}
      variant="error"
    />
  )

  const { returns, reasons, by_sku, units_by_sku, time_series } = data
  if (returns.length === 0 && reasons.length === 0 && by_sku.length === 0) return (
    <DataState
      title="No returns data yet"
      description="Return rates, reasons, and SKU-level return analysis will appear once FBA returns data is available."
    />
  )

  const totalReturns = returns.reduce((s, r) => s + (r.quantity || 1), 0)
  const totalUnitsSold = units_by_sku.reduce((s, r) => s + (r.units_sold || 0), 0)
  const returnRate = totalUnitsSold > 0 ? (totalReturns / totalUnitsSold * 100) : 0
  const topReason = reasons.length > 0 ? reasons[0].reason : 'N/A'
  // Refund impact — approximate at $15.59/unit
  const refundImpact = totalReturns * 15.59

  // Time series: pivot by sku
  const skus = Array.from(new Set(time_series.map(r => r.sku_name))).sort()
  const tsMap: Record<string, Record<string, number>> = {}
  for (const row of time_series) {
    if (!tsMap[row.date]) tsMap[row.date] = {}
    tsMap[row.date][row.sku_name] = (tsMap[row.date][row.sku_name] || 0) + row.returns
  }
  const tsChartData = Object.entries(tsMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, skuReturns]) => ({ date, ...skuReturns }))

  // Augment by_sku with units sold and return rate
  const unitsMap: Record<string, number> = {}
  for (const u of units_by_sku) unitsMap[u.sku_name] = u.units_sold

  return (
    <div style={{ paddingBottom: 40 }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 4, color: '#1A1A1A' }}>Returns</h1>
      <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: 20 }}>FBA customer returns analysis</p>

      {/* KPI Ribbon */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 20 }}>
        <MetricCard label="Total Returns" value={String(totalReturns)} sublabel={`${returns.length} return events`} />
        <MetricCard label="Return Rate" value={fmtPct(returnRate)} sublabel={`vs ${totalUnitsSold} units sold`} status={returnRate > 5 ? 'alert' : returnRate > 2 ? 'warn' : 'normal'} />
        <MetricCard label="Top Return Reason" value={topReason.replace(/_/g, ' ')} />
        <MetricCard label="Est. Refund Impact" value={'~$' + refundImpact.toFixed(0)} sublabel="At avg $15.59/unit" status="warn" />
      </div>

      {/* Returns over time */}
      {tsChartData.length > 0 && (
        <>
          <SectionHeader title="Returns Over Time" subtitle="By SKU" />
          <div style={{ background: 'white', borderRadius: 10, padding: 16, marginBottom: 16 }}>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={tsChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EBEBEB" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={v => v?.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                {skus.map(sku => (
                  <Line key={sku} type="monotone" dataKey={sku} stroke={SKU_COLORS[sku] || '#ccc'} strokeWidth={2} dot name={sku} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {/* Return reasons */}
      {reasons.length > 0 && (
        <>
          <SectionHeader title="Return Reasons" subtitle="Top 10 reasons" />
          <div style={{ background: 'white', borderRadius: 10, padding: 16, marginBottom: 16 }}>
            <ResponsiveContainer width="100%" height={Math.max(200, reasons.length * 32)}>
              <BarChart data={reasons} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#EBEBEB" vertical={true} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="reason" tick={{ fontSize: 10 }} width={160} tickFormatter={v => v?.replace(/_/g, ' ')} />
                <Tooltip />
                <Bar dataKey="count" fill="#2D4A27" name="Returns" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {/* SKU Return Table */}
      <SectionHeader title="Returns by SKU" />
      <div style={{ background: 'white', borderRadius: 10, padding: 16 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #EBEBEB' }}>
              {['SKU', 'Returns', 'Units Sold', 'Return Rate%', 'Top Reason'].map(h => (
                <th key={h} style={{ padding: '8px 12px', textAlign: h === 'SKU' || h === 'Top Reason' ? 'left' : 'right', color: '#666', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {by_sku.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: 16 }}>
                  <DataState title="No per-SKU return data available" />
                </td>
              </tr>
            ) : (
              by_sku.sort((a, b) => b.total_returns - a.total_returns).map(row => {
                const unitsSold = unitsMap[row.sku_name] || 0
                const rate = unitsSold > 0 ? (row.total_returns / unitsSold * 100) : null
                return (
                  <tr key={row.sku_name} style={{ borderBottom: '1px solid #F5F5F5' }}>
                    <td style={{ padding: '8px 12px' }}>
                      <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: SKU_COLORS[row.sku_name] || '#ccc', marginRight: 8 }} />
                      {row.sku_name}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>{row.total_returns}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>{unitsSold || '—'}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: rate && rate > 5 ? '#C0392B' : rate && rate > 2 ? '#E67E22' : '#2D4A27' }}>
                      {fmtPct(rate)}
                    </td>
                    <td style={{ padding: '8px 12px', color: '#666' }}>{row.top_reason?.replace(/_/g, ' ') || '—'}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Raw returns table */}
      <SectionHeader title="Return Log" subtitle="Last 20 returns" />
      <div style={{ background: 'white', borderRadius: 10, padding: 16, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #EBEBEB' }}>
              {['Date', 'SKU', 'Qty', 'Reason', 'Comment'].map(h => (
                <th key={h} style={{ padding: '6px 10px', textAlign: 'left', color: '#666', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {returns.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: 16 }}>
                  <DataState title="No return log entries available" />
                </td>
              </tr>
            ) : (
              returns.slice(-20).reverse().map((row, i) => (
                <tr key={`${row.date}-${row.sku_name}-${row.reason}-${i}`} style={{ borderBottom: '1px solid #F5F5F5' }}>
                  <td style={{ padding: '6px 10px', color: '#888' }}>{row.date}</td>
                  <td style={{ padding: '6px 10px' }}>{row.sku_name}</td>
                  <td style={{ padding: '6px 10px' }}>{row.quantity}</td>
                  <td style={{ padding: '6px 10px' }}>{row.reason?.replace(/_/g, ' ')}</td>
                  <td style={{ padding: '6px 10px', color: '#888', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {(row as unknown as Record<string, string>)['customer_comments'] || '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
