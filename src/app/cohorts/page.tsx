'use client'

import { useEffect, useState } from 'react'
import { LoadingSkeleton } from '@/components/loading-skeleton'
import { DataState } from '@/components/data-state'
import { MetricCard } from '@/components/metric-card'
import { ReportSlide } from '@/components/report-slide'
import { SectionHeader } from '@/components/section-header'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

interface CohortRow {
  cohort_month: string
  m0: number
  m1: number | null
  m2: number | null
  m3: number | null
  m4: number | null
  m5: number | null
  m6?: number | null
}

interface CohortSizeRow {
  cohort_month: string
  m0_count: number
}

interface CohortSummaryRow {
  cohort_month: string
  acquired_customers: number
  acquisition_revenue: number | null
  repeat_revenue: number
  total_revenue: number | null
  avg_ltv: number | null
  repeat_rate_pct: number | null
  ad_spend?: number | null
  cac?: number | null
  ltv_cac?: number | null
  source?: string
}

interface RevenueMixRow {
  cohort_month: string
  acquisition_revenue: number | null
  repeat_revenue: number | null
  total_revenue: number | null
  avg_ltv: number | null
  ad_spend?: number | null
  cac?: number | null
  ltv_cac?: number | null
}

interface CohortSummary {
  avg_ltv_per_cohort: number | null
  avg_repeat_rate: number | null
  total_users_acquired: number
  best_cohort_ltv: number | null
  best_cohort_month: string | null
  latest_ltv_cac: number | null
  retention_source: string
}

interface CohortData {
  cohorts: CohortRow[]
  cohort_sizes: CohortSizeRow[]
  cohort_summary: CohortSummaryRow[]
  repeat_rate_trend: Array<{
    cohort_month: string
    repeat_rate_pct: number | null
    avg_ltv: number | null
    acquired_customers: number
  }>
  revenue_mix: RevenueMixRow[]
  summary: CohortSummary
  source_notes: string[]
  total_orders: number
  error?: string
}

function fmtPct(value: number | null | undefined) {
  if (value == null) return '—'
  return `${Number(value).toFixed(1)}%`
}

function fmtMoney(value: number | null | undefined) {
  if (value == null) return '—'
  return `$${Number(value).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

function fmtMoney2(value: number | null | undefined) {
  if (value == null) return '—'
  return `$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtNum(value: number | null | undefined) {
  if (value == null) return '—'
  return Number(value).toLocaleString('en-US', { maximumFractionDigits: 0 })
}

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return { r, g, b }
}

function retentionColor(pct: number | null): string {
  if (pct === null) return '#F8F8F8'
  const light = hexToRgb('#FFFFFF')
  const dark = hexToRgb('#2D4A27')
  const t = Math.min(1, Math.max(0, pct / 100))
  const r = Math.round(light.r + (dark.r - light.r) * t)
  const g = Math.round(light.g + (dark.g - light.g) * t)
  const b = Math.round(light.b + (dark.b - light.b) * t)
  return `rgb(${r},${g},${b})`
}

function textColor(pct: number | null): string {
  if (pct === null) return '#98A09A'
  return pct > 50 ? '#fff' : '#17201b'
}

export default function CohortsPage() {
  const [data, setData] = useState<CohortData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/cohorts')
      .then((response) => response.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingSkeleton />
  if (!data || data.error) {
    return (
      <DataState
        title="Cohort data could not load"
        description={data?.error || 'Check the cohort, repeat purchase, and ads data sources, then refresh this page.'}
        variant="error"
      />
    )
  }

  const { cohorts, cohort_sizes, cohort_summary, revenue_mix, repeat_rate_trend, summary, source_notes, total_orders } = data
  const sortedCohorts = [...cohorts].sort((a, b) => a.cohort_month.localeCompare(b.cohort_month))
  const sortedSizes = [...cohort_sizes].sort((a, b) => a.cohort_month.localeCompare(b.cohort_month))
  const sortedSummary = [...cohort_summary].sort((a, b) => a.cohort_month.localeCompare(b.cohort_month))
  const sortedRevenueMix = [...revenue_mix].sort((a, b) => a.cohort_month.localeCompare(b.cohort_month))
  const sortedRepeatTrend = [...repeat_rate_trend].sort((a, b) => a.cohort_month.localeCompare(b.cohort_month))
  const latestLtvCacRow = [...sortedSummary].reverse().find((row) => row.ltv_cac != null)
  const latestLtvCac = latestLtvCacRow?.ltv_cac ?? summary.latest_ltv_cac

  if (sortedCohorts.length === 0 && sortedSummary.length === 0) {
    return (
      <DataState
        title="No cohort data yet"
        description="Cohort retention and repeat-purchase economics will appear once customer or Brand Analytics history is available."
      />
    )
  }

  const offsets = ['m0', 'm1', 'm2', 'm3', 'm4', 'm5', 'm6'] as const

  return (
    <div style={{ paddingBottom: 40 }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 4, color: '#1A1A1A' }}>Cohorts</h1>
      <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: 20 }}>Retention, LTV, acquisition mix, and LTV/CAC by cohort month</p>

      <ReportSlide
        title="Cohort Retention"
        order={1}
        message="This slide shows whether newly acquired customers come back in later months and how large each cohort is."
        watch="Average repeat rate, best cohort LTV, and the shape of the retention heatmap."
        action="Use this slide to separate customer-quality improvement from pure acquisition volume."
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
          <MetricCard label="Avg LTV / Cohort" value={fmtMoney2(summary.avg_ltv_per_cohort)} sublabel={summary.best_cohort_month ? `Best cohort ${summary.best_cohort_month}` : 'Cohort economics'} />
          <MetricCard label="Avg Repeat Rate" value={fmtPct(summary.avg_repeat_rate)} sublabel={summary.retention_source === 'shipment_customer_email' ? 'Repeat buyers / cohort' : 'Brand Analytics repeat proxy'} />
          <MetricCard label="Users Acquired" value={fmtNum(summary.total_users_acquired)} sublabel="Across available cohort months" />
          <MetricCard label="Best Cohort LTV" value={fmtMoney2(summary.best_cohort_ltv)} sublabel={summary.best_cohort_month || 'Best cohort'} />
        </div>

        {source_notes.length ? (
          <div style={{ background: '#F7FAF5', border: '1px solid #DCE7D7', borderRadius: 10, padding: 12, marginBottom: 16 }}>
            {source_notes.map((note, index) => (
              <div key={index} style={{ color: '#526051', fontSize: '0.78rem', lineHeight: 1.45 }}>
                {note}
              </div>
            ))}
          </div>
        ) : null}

        <SectionHeader title="Cohort Retention Heatmap" subtitle="Month-0 cohort size with retained share by later month" />
        <div style={{ background: 'white', borderRadius: 10, padding: 16, marginBottom: 18, overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'separate', borderSpacing: '0 6px', fontSize: '0.82rem', minWidth: 820 }}>
            <thead>
              <tr>
                <th style={{ padding: '8px 12px', textAlign: 'left', color: '#667268', fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase' }}>Cohort</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', color: '#667268', fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase' }}>Size</th>
                {offsets.map((offset) => (
                  <th key={offset} style={{ padding: '8px 12px', textAlign: 'center', color: '#667268', fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase' }}>
                    {offset.toUpperCase()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedCohorts.map((row) => {
                const size = sortedSizes.find((entry) => entry.cohort_month === row.cohort_month)?.m0_count || row.m0
                return (
                  <tr key={row.cohort_month}>
                    <td style={{ padding: '8px 12px', fontWeight: 700 }}>{row.cohort_month}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: '#677368', fontWeight: 700 }}>{fmtNum(size)}</td>
                    {offsets.map((offset) => {
                      const value = offset === 'm0' ? 100 : (row[offset] ?? null)
                      return (
                        <td
                          key={offset}
                          style={{
                            padding: '8px 12px',
                            textAlign: 'center',
                            background: retentionColor(value),
                            color: textColor(value),
                            borderRadius: 6,
                            fontWeight: value != null ? 700 : 500,
                          }}
                        >
                          {value != null ? fmtPct(value) : '—'}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </ReportSlide>

      <ReportSlide
        title="Cohort Economics"
        order={2}
        message="This slide connects acquisition cohorts to repeat revenue, total revenue, and LTV/CAC."
        watch="Repeat revenue should build over time while LTV/CAC stays above 1.0x."
        action="Use this slide when discussing growth quality, not just order volume."
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
          <MetricCard label="Latest LTV/CAC" value={latestLtvCac == null ? '—' : `${latestLtvCac.toFixed(2)}x`} sublabel={latestLtvCacRow ? latestLtvCacRow.cohort_month : 'Latest cohort with ads spend'} status={(latestLtvCac ?? 0) < 1 ? 'alert' : (latestLtvCac ?? 0) < 2 ? 'warn' : 'normal'} />
          <MetricCard label="Total Orders" value={fmtNum(total_orders)} sublabel="Available order history" />
          <MetricCard label="Repeat Revenue" value={fmtMoney(sortedRevenueMix.reduce((sum, row) => sum + Number(row.repeat_revenue || 0), 0))} sublabel="Across cohort months" />
          <MetricCard label="Acquisition Revenue" value={fmtMoney(sortedRevenueMix.reduce((sum, row) => sum + Number(row.acquisition_revenue || 0), 0))} sublabel="Estimated from BA revenue split" />
        </div>

        <SectionHeader title="Acquisition vs Repeat Revenue" subtitle="Monthly cohort economics with LTV/CAC overlay" />
        <div style={{ background: 'white', borderRadius: 10, padding: 16, marginBottom: 18 }}>
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={sortedRevenueMix}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EBEBEB" vertical={false} />
              <XAxis dataKey="cohort_month" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="money" tick={{ fontSize: 11 }} tickFormatter={(value) => `$${Number(value).toLocaleString()}`} />
              <YAxis yAxisId="ratio" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(value) => `${Number(value).toFixed(1)}x`} />
              <Tooltip
                formatter={(value: unknown, name: unknown) => {
                  const label = String(name)
                  if (label.includes('LTV/CAC')) return [`${Number(value).toFixed(2)}x`, label]
                  return [fmtMoney(Number(value)), label]
                }}
              />
              <Legend />
              <Bar yAxisId="money" dataKey="acquisition_revenue" stackId="rev" fill="#B8D4AE" name="Acquisition Revenue" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="money" dataKey="repeat_revenue" stackId="rev" fill="#2D4A27" name="Repeat Revenue" radius={[4, 4, 0, 0]} />
              <Line yAxisId="ratio" type="monotone" dataKey="ltv_cac" stroke="#E67E22" strokeWidth={2.4} dot={false} name="LTV/CAC" connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <SectionHeader title="Repeat Rate and LTV Trend" subtitle="Monthly cohort quality trend" />
        <div style={{ background: 'white', borderRadius: 10, padding: 16 }}>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={sortedRepeatTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EBEBEB" vertical={false} />
              <XAxis dataKey="cohort_month" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="pct" tick={{ fontSize: 11 }} tickFormatter={(value) => `${Number(value).toFixed(0)}%`} />
              <YAxis yAxisId="money" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(value) => `$${Number(value).toFixed(0)}`} />
              <Tooltip
                formatter={(value: unknown, name: unknown) => {
                  const label = String(name)
                  if (label.includes('Rate')) return [fmtPct(Number(value)), label]
                  return [fmtMoney2(Number(value)), label]
                }}
              />
              <Legend />
              <Bar yAxisId="pct" dataKey="repeat_rate_pct" fill="#AEC49D" name="Repeat Rate %" radius={[4, 4, 0, 0]} />
              <Line yAxisId="money" type="monotone" dataKey="avg_ltv" stroke="#2D4A27" strokeWidth={2.3} dot={false} name="Avg LTV" connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </ReportSlide>

      <ReportSlide
        title="Cohort Summary Table"
        order={3}
        message="This slide gives the appendix-style cohort summary table that was missing from the old parity gap list."
        watch="Compare customer count, repeat rate, LTV, CAC, and LTV/CAC across cohorts."
        action="Use this as the reference slide for finance and growth discussions."
      >
        <SectionHeader title="Cohort Summary" subtitle="Customer count, repeat rate, revenue mix, LTV, CAC, and LTV/CAC by cohort" />
        <div style={{ background: 'white', borderRadius: 10, padding: 16, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', minWidth: 1040 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #EBEBEB' }}>
                {['Cohort', 'Users', 'Repeat %', 'Acq. Rev.', 'Repeat Rev.', 'Total Rev.', 'Avg LTV', 'CAC', 'LTV/CAC'].map((heading) => (
                  <th
                    key={heading}
                    style={{
                      padding: '8px 10px',
                      textAlign: heading === 'Cohort' ? 'left' : 'right',
                      color: '#667268',
                      fontWeight: 700,
                      fontSize: '0.7rem',
                      textTransform: 'uppercase',
                    }}
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedSummary.map((row) => (
                <tr key={row.cohort_month} style={{ borderBottom: '1px solid #F3F5F2' }}>
                  <td style={{ padding: '8px 10px', fontWeight: 700 }}>{row.cohort_month}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right' }}>{fmtNum(row.acquired_customers)}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700 }}>{fmtPct(row.repeat_rate_pct)}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right' }}>{fmtMoney(row.acquisition_revenue)}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right' }}>{fmtMoney(row.repeat_revenue)}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right' }}>{fmtMoney(row.total_revenue)}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700 }}>{fmtMoney2(row.avg_ltv)}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right' }}>{fmtMoney2(row.cac)}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: (row.ltv_cac ?? 0) < 1 ? '#C0392B' : '#2D4A27' }}>
                    {row.ltv_cac == null ? '—' : `${row.ltv_cac.toFixed(2)}x`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ReportSlide>
    </div>
  )
}
