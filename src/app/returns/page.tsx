'use client'
import { LoadingSkeleton } from '@/components/loading-skeleton'
import { DataState } from '@/components/data-state'

import { useEffect, useState } from 'react'
import { MetricCard } from '@/components/metric-card'
import { SectionHeader } from '@/components/section-header'
import { SignalGrid } from '@/components/insight-card'
import { filterByDashboardState, hasActiveDashboardFilters, useDashboardFilters } from '@/components/dashboard-filters'
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

interface ReturnRow { date: string; return_date?: string; sku_name: string; quantity: number; reason: string; customer_comments?: string | null }
interface ReasonRow { reason: string; count: number }
interface BySkuRow { sku_name: string; total_returns: number; top_reason?: string }
interface UnitsRow { sku_name: string; units_sold: number; revenue_sold?: number }
interface TimeSeriesRow { date: string; sku_name: string; returns: number }
interface ReturnSignal { severity: 'normal' | 'warn' | 'alert'; title: string; detail: string }
interface SkuRiskRow {
  sku_name: string
  total_returns: number
  units_sold: number
  return_rate_pct: number | null
  estimated_refund_impact: number
  top_reason: string | null
  risk_score: number
  status: 'Critical' | 'Watch' | 'Healthy'
}
interface ReasonClusterRow { category: string; returns: number; share_pct: number }
interface MonthlyTrendRow { month: string; returns: number }
interface ReturnsInsights {
  summary: {
    total_returns: number
    total_units_sold: number
    overall_return_rate_pct: number | null
    estimated_refund_impact: number
    avg_refund_value: number
    top_reason: string | null
    top_reason_share_pct: number
    latest_30_returns: number
    previous_30_returns: number
    latest_vs_previous_30_pct: number | null
  }
  signals: ReturnSignal[]
  sku_risks: SkuRiskRow[]
  reason_clusters: ReasonClusterRow[]
  monthly_trend: MonthlyTrendRow[]
  recommendations: string[]
}

interface ReturnsData {
  returns: ReturnRow[]
  reasons: ReasonRow[]
  by_sku: BySkuRow[]
  units_by_sku: UnitsRow[]
  time_series: TimeSeriesRow[]
  insights?: ReturnsInsights
  error?: string
}

function fmtPct(n: number | null | undefined) {
  if (n == null) return '—'
  return Number(n).toFixed(1) + '%'
}
function fmtMoney(n: number | null | undefined) {
  if (n == null) return '—'
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}
function fmtNum(n: number | null | undefined) {
  if (n == null) return '—'
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 })
}
function fmtSignedPct(n: number | null | undefined) {
  if (n == null) return '—'
  const sign = Number(n) > 0 ? '+' : ''
  return sign + Number(n).toFixed(1) + '%'
}
function riskColor(status: SkuRiskRow['status']) {
  if (status === 'Critical') return '#C0392B'
  if (status === 'Watch') return '#E67E22'
  return '#2D4A27'
}
function riskBg(status: SkuRiskRow['status']) {
  if (status === 'Critical') return '#FDECEA'
  if (status === 'Watch') return '#FFF8E1'
  return '#EEF6EC'
}

export default function ReturnsPage() {
  const [data, setData] = useState<ReturnsData | null>(null)
  const [loading, setLoading] = useState(true)
  const filters = useDashboardFilters()

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

  const returns = filterByDashboardState(data.returns || [], filters, row => row.date || row.return_date, row => row.sku_name)
  const time_series = filterByDashboardState(data.time_series || [], filters, row => row.date, row => row.sku_name)
  const units_by_sku = filterByDashboardState(data.units_by_sku || [], filters, undefined, row => row.sku_name)
  const activeFilters = hasActiveDashboardFilters(filters)
  const reasons = buildReasonRows(returns, activeFilters ? [] : data.reasons || [])
  const by_sku = buildSkuRows(returns, activeFilters ? [] : data.by_sku || [])
  const insights = data.insights || {
    summary: {
      total_returns: 0,
      total_units_sold: 0,
      overall_return_rate_pct: null,
      estimated_refund_impact: 0,
      avg_refund_value: 15.59,
      top_reason: null,
      top_reason_share_pct: 0,
      latest_30_returns: 0,
      previous_30_returns: 0,
      latest_vs_previous_30_pct: null,
    },
    signals: [],
    sku_risks: [],
    reason_clusters: [],
    monthly_trend: [],
    recommendations: [],
  }
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
  const refundImpact = insights.summary.estimated_refund_impact || totalReturns * 15.59

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
        <MetricCard label="Total Returns" value={fmtNum(insights.summary.total_returns || totalReturns)} sublabel={`${returns.length} return events`} />
        <MetricCard label="Return Rate" value={fmtPct(insights.summary.overall_return_rate_pct ?? returnRate)} sublabel={`vs ${fmtNum(insights.summary.total_units_sold || totalUnitsSold)} units sold`} status={(insights.summary.overall_return_rate_pct ?? returnRate) > 5 ? 'alert' : (insights.summary.overall_return_rate_pct ?? returnRate) > 2 ? 'warn' : 'normal'} />
        <MetricCard label="Top Return Reason" value={(insights.summary.top_reason || topReason).replace(/_/g, ' ')} sublabel={fmtPct(insights.summary.top_reason_share_pct) + ' of returns'} />
        <MetricCard label="Est. Refund Impact" value={fmtMoney(refundImpact)} sublabel={`At avg ${fmtMoney(insights.summary.avg_refund_value)}/unit`} status="warn" />
      </div>

      <SectionHeader title="Returns Intelligence" subtitle="Return rate, SKU risk, reason concentration, and recommended next actions" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        <MetricCard
          label="Latest 30d Returns"
          value={fmtNum(insights.summary.latest_30_returns)}
          sublabel={`Prior 30d: ${fmtNum(insights.summary.previous_30_returns)}`}
          status={(insights.summary.latest_vs_previous_30_pct ?? 0) > 25 ? 'warn' : 'normal'}
        />
        <MetricCard
          label="30d Change"
          value={fmtSignedPct(insights.summary.latest_vs_previous_30_pct)}
          sublabel="Latest vs previous 30d"
          status={(insights.summary.latest_vs_previous_30_pct ?? 0) > 25 ? 'warn' : 'normal'}
        />
        <MetricCard
          label="Reason Concentration"
          value={fmtPct(insights.summary.top_reason_share_pct)}
          sublabel={(insights.summary.top_reason || 'Top reason').replace(/_/g, ' ')}
          status={(insights.summary.top_reason_share_pct ?? 0) > 30 ? 'warn' : 'normal'}
        />
        <MetricCard
          label="High-Risk SKUs"
          value={String(insights.sku_risks.filter(row => row.status === 'Critical').length)}
          sublabel="Critical return risk"
          status={insights.sku_risks.some(row => row.status === 'Critical') ? 'alert' : insights.sku_risks.some(row => row.status === 'Watch') ? 'warn' : 'normal'}
        />
      </div>

      <SignalGrid signals={insights.signals} />

      {insights.recommendations.length > 0 && (
        <div style={{ background: 'white', borderRadius: 10, padding: 16, marginBottom: 20 }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 10, color: '#1A1A1A' }}>Recommended Actions</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {insights.recommendations.map((item, index) => (
              <div key={index} style={{ borderLeft: '4px solid #2D4A27', background: '#F8FBF7', padding: '10px 12px', borderRadius: 6, color: '#555', fontSize: '0.82rem', lineHeight: 1.45 }}>
                {item}
              </div>
            ))}
          </div>
        </div>
      )}

      {insights.sku_risks.length > 0 && (
        <>
          <SectionHeader title="SKU Return Risk" subtitle="Return rate, refund impact, reason pattern, and risk score" />
          <div className="dashboard-table-card" style={{ marginBottom: 20 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #EBEBEB' }}>
                  {['Status', 'SKU', 'Returns', 'Units Sold', 'Return Rate', 'Refund Impact', 'Top Reason', 'Risk'].map(h => (
                    <th key={h} style={{ padding: '8px 8px', textAlign: ['Status', 'SKU', 'Top Reason'].includes(h) ? 'left' : 'right', color: '#666', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {insights.sku_risks.map(row => (
                  <tr key={row.sku_name} style={{ borderBottom: '1px solid #F5F5F5' }}>
                    <td style={{ padding: '8px 8px' }}>
                      <span style={{ background: riskBg(row.status), color: riskColor(row.status), border: `1px solid ${riskColor(row.status)}33`, borderRadius: 4, padding: '2px 8px', fontWeight: 700, fontSize: '0.72rem' }}>{row.status}</span>
                    </td>
                    <td style={{ padding: '8px 8px', fontWeight: 600 }}>{row.sku_name}</td>
                    <td style={{ padding: '8px 8px', textAlign: 'right' }}>{fmtNum(row.total_returns)}</td>
                    <td style={{ padding: '8px 8px', textAlign: 'right' }}>{fmtNum(row.units_sold)}</td>
                    <td style={{ padding: '8px 8px', textAlign: 'right', color: riskColor(row.status), fontWeight: 700 }}>{fmtPct(row.return_rate_pct)}</td>
                    <td style={{ padding: '8px 8px', textAlign: 'right' }}>{fmtMoney(row.estimated_refund_impact)}</td>
                    <td style={{ padding: '8px 8px', color: '#666' }}>{row.top_reason?.replace(/_/g, ' ') || '—'}</td>
                    <td style={{ padding: '8px 8px', textAlign: 'right' }}>{row.risk_score.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {insights.reason_clusters.length > 0 && (
        <>
          <SectionHeader title="Reason Clusters" subtitle="Grouped into business-actionable issue types" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16, marginBottom: 20 }}>
            <div className="dashboard-table-card">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #EBEBEB' }}>
                    {['Cluster', 'Returns', 'Share'].map(h => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: h === 'Cluster' ? 'left' : 'right', color: '#666', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {insights.reason_clusters.map(row => (
                    <tr key={row.category} style={{ borderBottom: '1px solid #F5F5F5' }}>
                      <td style={{ padding: '8px 10px', fontWeight: 600 }}>{row.category}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>{fmtNum(row.returns)}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>{fmtPct(row.share_pct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ background: 'white', borderRadius: 10, padding: 16 }}>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={insights.reason_clusters} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#EBEBEB" vertical={true} horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="category" tick={{ fontSize: 10 }} width={110} />
                  <Tooltip formatter={(value: unknown) => fmtNum(Number(value))} />
                  <Bar dataKey="returns" fill="#6B8F61" name="Returns" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      {insights.monthly_trend.length > 0 && (
        <>
          <SectionHeader title="Monthly Return Trend" subtitle="Return volume by month" />
          <div style={{ background: 'white', borderRadius: 10, padding: 16, marginBottom: 16 }}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={insights.monthly_trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EBEBEB" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="returns" fill="#2D4A27" name="Returns" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

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

function buildReasonRows(returns: ReturnRow[], fallback: ReasonRow[]) {
  if (returns.length === 0) return fallback
  const reasonMap: Record<string, number> = {}
  for (const row of returns) {
    const reason = row.reason || 'Unknown'
    reasonMap[reason] = (reasonMap[reason] || 0) + (row.quantity || 1)
  }
  return Object.entries(reasonMap)
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
}

function buildSkuRows(returns: ReturnRow[], fallback: BySkuRow[]) {
  if (returns.length === 0) return fallback
  const skuMap: Record<string, { total_returns: number; reasons: Record<string, number> }> = {}
  for (const row of returns) {
    const sku = row.sku_name || 'Unknown'
    if (!skuMap[sku]) skuMap[sku] = { total_returns: 0, reasons: {} }
    skuMap[sku].total_returns += row.quantity || 1
    const reason = row.reason || 'Unknown'
    skuMap[sku].reasons[reason] = (skuMap[sku].reasons[reason] || 0) + (row.quantity || 1)
  }
  return Object.entries(skuMap).map(([sku_name, value]) => ({
    sku_name,
    total_returns: value.total_returns,
    top_reason: Object.entries(value.reasons).sort((a, b) => b[1] - a[1])[0]?.[0],
  }))
}
