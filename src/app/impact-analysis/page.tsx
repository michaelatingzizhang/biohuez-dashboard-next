'use client'

import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { DataState } from '@/components/data-state'
import { LoadingSkeleton } from '@/components/loading-skeleton'
import { MetricCard } from '@/components/metric-card'
import { SectionHeader } from '@/components/section-header'
import { SignalGrid } from '@/components/insight-card'

interface ActionRow {
  phase: string
  label: string
  start: string
  end: string
}

interface WeeklyPerformanceRow {
  date: string
  revenue?: number
  orders?: number
  units?: number
  sessions?: number
  cvr?: number
  buybox?: number
}

interface PhaseRow {
  phase: string
  label: string
  start: string
  end: string
  avg_daily_revenue?: number | null
  avg_daily_orders?: number | null
  avg_daily_sessions?: number | null
  avg_cvr?: number | null
  revenue_delta_pct?: number | null
  orders_delta_pct?: number | null
  sessions_delta_pct?: number | null
  cvr_delta_pp?: number | null
}

interface AdsPhaseRow {
  phase: string
  label: string
  avg_sp_spend?: number | null
  avg_sp_sales?: number | null
  roas?: number | null
  ctr?: number | null
  spend_delta_pct?: number | null
  roas_delta_pct?: number | null
}

interface AdsWeeklyRow {
  date: string
  spend?: number
  sales?: number
  roas?: number | null
  ctr?: number | null
  sd_spend?: number
}

interface BsrRow {
  date: string
  bsr?: number
}

interface SearchClusterRow {
  period_start: string
  keyword_cluster: string
  impressions: number
  clicks: number
  purchases: number
}

interface SearchTermRow {
  search_query: string
  cluster: string
  purchases: number
  impressions: number
}

interface Takeaway {
  title: string
  detail: string
  severity: 'normal' | 'warn' | 'alert'
}

interface ImpactData {
  actions: ActionRow[]
  weekly_performance: WeeklyPerformanceRow[]
  phase_comparison: PhaseRow[]
  ads: {
    weekly: AdsWeeklyRow[]
    phase_comparison: AdsPhaseRow[]
  }
  bsr_weekly: BsrRow[]
  search: {
    cluster_weekly: SearchClusterRow[]
    top_before: SearchTermRow[]
    top_after: SearchTermRow[]
  }
  demographics: {
    highlights: Record<string, { latest?: number; delta_pp?: number; latest_date?: string }>
  }
  takeaways: Takeaway[]
  error?: string
}

const phaseColors: Record<string, string> = {
  baseline: '#9E9E9E',
  ads_budget: '#D99223',
  search_words: '#2D6F9F',
  new_artwork: '#6B8F61',
}

function fmtMoney(n: number | null | undefined) {
  if (n == null) return '-'
  return '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 })
}

function fmtNum(n: number | null | undefined) {
  if (n == null) return '-'
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 })
}

function fmtPct(n: number | null | undefined, suffix = '%') {
  if (n == null) return '-'
  const sign = Number(n) > 0 ? '+' : ''
  return sign + Number(n).toFixed(1) + suffix
}

function shortDate(value: string | undefined) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function tooltipDate(value: unknown) {
  return typeof value === 'string' ? shortDate(value) : '-'
}

export default function ImpactAnalysisPage() {
  const [data, setData] = useState<ImpactData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/impact-analysis')
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  const clusterChart = useMemo(() => {
    if (!data?.search.cluster_weekly.length) return { rows: [], clusters: [] as string[] }
    const clusters = [...new Set(data.search.cluster_weekly.map(row => row.keyword_cluster))].slice(0, 8)
    const byDate = new Map<string, Record<string, string | number>>()
    data.search.cluster_weekly.forEach(row => {
      const key = row.period_start.slice(0, 10)
      const existing = byDate.get(key) || { period_start: key }
      existing[row.keyword_cluster] = row.impressions
      byDate.set(key, existing)
    })
    return { rows: [...byDate.values()], clusters }
  }, [data])

  if (loading) return <LoadingSkeleton />
  if (!data || data.error) return (
    <DataState
      variant="error"
      title="Impact analysis could not load"
      description={data?.error || 'Check the sales, traffic, ads, BSR, and Brand Analytics data connection.'}
    />
  )

  const latestPhase = data.phase_comparison[data.phase_comparison.length - 1]
  const latestAdsPhase = data.ads.phase_comparison[data.ads.phase_comparison.length - 1]
  const femaleShare = data.demographics.highlights.female_share

  return (
    <div style={{ paddingBottom: 40 }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 4, color: '#1A1A1A' }}>Impact Analysis</h1>
      <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: 20 }}>Marketing action timeline, before/after deltas, ads impact, BSR movement, and audience shifts</p>

      <SectionHeader title="Marketing Timeline" subtitle="Legacy Streamlit action windows migrated into the new dashboard" />
      <div className="dashboard-chart-grid" style={{ marginBottom: 18 }}>
        {data.actions.map(action => (
          <div key={action.phase} className="dashboard-card" style={{ borderTop: `4px solid ${phaseColors[action.phase] || '#6B8F61'}` }}>
            <div style={{ fontSize: '0.72rem', color: '#6B7280', textTransform: 'uppercase', fontWeight: 700 }}>{shortDate(action.start)} - {shortDate(action.end)}</div>
            <div style={{ fontWeight: 800, color: '#111827', marginTop: 6 }}>{action.label}</div>
            <div style={{ marginTop: 10, height: 6, borderRadius: 999, background: phaseColors[action.phase] || '#6B8F61' }} />
          </div>
        ))}
      </div>

      <div className="dashboard-kpi-grid">
        <MetricCard label="Latest Revenue Delta" value={fmtPct(latestPhase?.revenue_delta_pct)} sublabel={latestPhase?.label || 'Latest phase'} status={(latestPhase?.revenue_delta_pct ?? 0) < 0 ? 'warn' : 'normal'} />
        <MetricCard label="Latest Orders Delta" value={fmtPct(latestPhase?.orders_delta_pct)} sublabel="vs prior phase" status={(latestPhase?.orders_delta_pct ?? 0) < 0 ? 'warn' : 'normal'} />
        <MetricCard label="CVR Delta" value={fmtPct(latestPhase?.cvr_delta_pp, ' pp')} sublabel="percentage-point movement" status={(latestPhase?.cvr_delta_pp ?? 0) < 0 ? 'warn' : 'normal'} />
        <MetricCard label="SP ROAS" value={latestAdsPhase?.roas == null ? '-' : latestAdsPhase.roas.toFixed(2) + 'x'} sublabel={latestAdsPhase?.label || 'Latest phase'} status={(latestAdsPhase?.roas ?? 0) < 1 ? 'warn' : 'normal'} />
        <MetricCard label="Female Share" value={femaleShare?.latest == null ? '-' : femaleShare.latest.toFixed(1) + '%'} sublabel={femaleShare?.delta_pp == null ? 'Audience mix' : `${fmtPct(femaleShare.delta_pp, ' pp')} over period`} />
      </div>

      {data.takeaways.length > 0 && (
        <>
          <SectionHeader title="Key Takeaways" subtitle="Auto-generated readout from action windows and latest available data" />
          <SignalGrid signals={data.takeaways} />
        </>
      )}

      <SectionHeader title="Revenue & Traffic Trends" subtitle="Weekly revenue, sessions, conversion, and buy box view with action dates above" />
      <div className="dashboard-card" style={{ height: 360, marginBottom: 18 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data.weekly_performance}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis dataKey="date" tickFormatter={shortDate} fontSize={11} />
            <YAxis yAxisId="money" fontSize={11} tickFormatter={v => `$${Number(v) / 1000}k`} />
            <YAxis yAxisId="rate" orientation="right" fontSize={11} tickFormatter={v => `${v}%`} />
            <Tooltip formatter={(value, name) => name === 'revenue' ? fmtMoney(Number(value)) : name === 'cvr' || name === 'buybox' ? Number(value).toFixed(1) + '%' : fmtNum(Number(value))} labelFormatter={tooltipDate} />
            <Legend />
            <Bar yAxisId="money" dataKey="revenue" name="Revenue" fill="#6B8F61" radius={[4, 4, 0, 0]} />
            <Line yAxisId="rate" dataKey="cvr" name="CVR" stroke="#D99223" strokeWidth={2} dot={false} />
            <Line yAxisId="rate" dataKey="buybox" name="Buy Box" stroke="#2D6F9F" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <SectionHeader title="Before / After Comparison" subtitle="Daily averages by action window, matching the old Streamlit logic" />
      <div className="dashboard-card" style={{ overflowX: 'auto', marginBottom: 18 }}>
        <table className="dashboard-table">
          <thead>
            <tr>
              <th>Phase</th>
              <th>Period</th>
              <th>Avg Revenue</th>
              <th>Avg Orders</th>
              <th>Avg Sessions</th>
              <th>Avg CVR</th>
              <th>Revenue Delta</th>
              <th>Orders Delta</th>
              <th>CVR Delta</th>
            </tr>
          </thead>
          <tbody>
            {data.phase_comparison.map(row => (
              <tr key={row.phase}>
                <td><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 999, background: phaseColors[row.phase] || '#6B8F61', marginRight: 8 }} />{row.label}</td>
                <td>{shortDate(row.start)} - {shortDate(row.end)}</td>
                <td>{fmtMoney(row.avg_daily_revenue)}</td>
                <td>{fmtNum(row.avg_daily_orders)}</td>
                <td>{fmtNum(row.avg_daily_sessions)}</td>
                <td>{row.avg_cvr == null ? '-' : row.avg_cvr.toFixed(1) + '%'}</td>
                <td>{fmtPct(row.revenue_delta_pct)}</td>
                <td>{fmtPct(row.orders_delta_pct)}</td>
                <td>{fmtPct(row.cvr_delta_pp, ' pp')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="dashboard-chart-grid">
        <div className="dashboard-card" style={{ height: 330 }}>
          <SectionHeader title="SP Spend & ROAS" subtitle="Weekly sponsored products spend with ROAS overlay" />
          <ResponsiveContainer width="100%" height="78%">
            <ComposedChart data={data.ads.weekly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="date" tickFormatter={shortDate} fontSize={11} />
              <YAxis yAxisId="money" fontSize={11} tickFormatter={v => `$${Number(v)}`} />
              <YAxis yAxisId="rate" orientation="right" fontSize={11} />
              <Tooltip formatter={(value, name) => name === 'roas' ? Number(value).toFixed(2) + 'x' : fmtMoney(Number(value))} labelFormatter={tooltipDate} />
              <Bar yAxisId="money" dataKey="spend" fill="#6B8F61" radius={[4, 4, 0, 0]} name="SP Spend" />
              <Line yAxisId="rate" dataKey="roas" stroke="#D99223" strokeWidth={2} name="ROAS" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="dashboard-card" style={{ height: 330 }}>
          <SectionHeader title="BSR Movement" subtitle="Lower rank is better" />
          <ResponsiveContainer width="100%" height="78%">
            <LineChart data={data.bsr_weekly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="date" tickFormatter={shortDate} fontSize={11} />
              <YAxis reversed fontSize={11} />
              <Tooltip formatter={value => fmtNum(Number(value))} labelFormatter={tooltipDate} />
              <Line dataKey="bsr" stroke="#2D4A27" strokeWidth={2} dot={false} name="Avg BSR" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <SectionHeader title="Ads Phase Comparison" subtitle="SP spend, sales, ROAS, CTR, and deltas by action window" />
      <div className="dashboard-card" style={{ overflowX: 'auto', marginBottom: 18 }}>
        <table className="dashboard-table">
          <thead>
            <tr>
              <th>Phase</th>
              <th>Avg SP Spend</th>
              <th>Avg SP Sales</th>
              <th>ROAS</th>
              <th>CTR</th>
              <th>Spend Delta</th>
              <th>ROAS Delta</th>
            </tr>
          </thead>
          <tbody>
            {data.ads.phase_comparison.map(row => (
              <tr key={row.phase}>
                <td>{row.label}</td>
                <td>{fmtMoney(row.avg_sp_spend)}</td>
                <td>{fmtMoney(row.avg_sp_sales)}</td>
                <td>{row.roas == null ? '-' : row.roas.toFixed(2) + 'x'}</td>
                <td>{row.ctr == null ? '-' : row.ctr.toFixed(2) + '%'}</td>
                <td>{fmtPct(row.spend_delta_pct)}</td>
                <td>{fmtPct(row.roas_delta_pct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SectionHeader title="Search Query Cluster Shifts" subtitle="Brand Analytics cluster visibility and purchase-driving terms before/after search updates" />
      <div className="dashboard-card" style={{ height: 360, marginBottom: 18 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={clusterChart.rows}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis dataKey="period_start" tickFormatter={shortDate} fontSize={11} />
            <YAxis fontSize={11} />
            <Tooltip labelFormatter={tooltipDate} />
            <Legend />
            {clusterChart.clusters.map((cluster, index) => (
              <Bar key={cluster} dataKey={cluster} stackId="clusters" fill={['#2D4A27', '#6B8F61', '#A7C7A0', '#D99223', '#2D6F9F', '#81A969', '#B65F3A', '#8E44AD'][index % 8]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="dashboard-chart-grid">
        <SearchTermsTable title="Before Search Change" rows={data.search.top_before} />
        <SearchTermsTable title="After Search Change" rows={data.search.top_after} />
      </div>
    </div>
  )
}

function SearchTermsTable({ title, rows }: { title: string; rows: SearchTermRow[] }) {
  return (
    <div className="dashboard-card" style={{ overflowX: 'auto' }}>
      <SectionHeader title={title} subtitle="Top purchase-driving terms" />
      <table className="dashboard-table">
        <thead>
          <tr>
            <th>Query</th>
            <th>Cluster</th>
            <th>Purchases</th>
            <th>Impressions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={`${title}-${row.search_query}`}>
              <td style={{ maxWidth: 220, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.search_query}</td>
              <td>{row.cluster || '-'}</td>
              <td>{fmtNum(row.purchases)}</td>
              <td>{fmtNum(row.impressions)}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} style={{ color: '#9CA3AF' }}>No search terms available.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
