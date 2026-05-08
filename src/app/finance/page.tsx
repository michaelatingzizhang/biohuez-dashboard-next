'use client'
import { LoadingSkeleton } from '@/components/loading-skeleton'

import { useEffect, useState } from 'react'
import { MetricCard } from '@/components/metric-card'
import { SectionHeader } from '@/components/section-header'
import { DataState } from '@/components/data-state'
import { SignalGrid } from '@/components/insight-card'
import { filterByDashboardState, useDashboardFilters } from '@/components/dashboard-filters'
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell
} from 'recharts'

interface MonthlyRow {
  month: string
  gross_sales: number
  amazon_fees: number
  fba_total: number
  net_revenue: number
  gross_profit: number
  gross_margin_pct: number | null
  units_ordered: number
}

interface FinanceSignal {
  type: string
  severity: 'normal' | 'warn' | 'alert'
  title: string
  detail: string
}

interface FinanceDriver {
  metric: string
  current: number
  previous: number
  delta: number
  direction: 'higher' | 'lower'
}

interface FinanceBreakdownRow {
  metric: string
  amount: number
  abs_amount: number
  pct_of_sales: number | null
}

interface MonthlyIntelligenceRow {
  month: string
  gross_sales: number
  net_revenue: number
  gross_margin_pct: number | null
  fee_load_pct: number | null
  refund_rate_pct: number | null
  ad_load_pct: number | null
  ad_adjusted_margin_pct: number | null
  sales_mom_pct: number | null
}

interface FinanceInsights {
  summary: {
    latest_month?: string
    latest_margin_pct?: number | null
    latest_fee_load_pct?: number | null
    latest_refund_rate_pct?: number | null
    latest_ad_load_pct?: number | null
    latest_ad_adjusted_margin_pct?: number | null
    avg_3m_margin_pct?: number | null
    avg_3m_fee_load_pct?: number | null
    avg_3m_refund_rate_pct?: number | null
  }
  monthly_intelligence: MonthlyIntelligenceRow[]
  signals: FinanceSignal[]
  drivers: FinanceDriver[]
  latest_breakdown: FinanceBreakdownRow[]
}

interface FinanceData {
  monthly: MonthlyRow[]
  settlement: Record<string, unknown>[]
  calendar_pl?: Record<string, number | string | null>[]
  settlement_pl?: Record<string, number | string | null>[]
  per_unit?: { metric: string; amount: number }[]
  targets?: { asp?: number; cogs_per_unit?: number; gp_pct?: number; cm_pct?: number; ad_pct?: number }
  insights?: FinanceInsights
  error?: string
}

function fmtMoney(n: number | null | undefined) {
  if (n == null) return '—'
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}
function fmtPct(n: number | null | undefined) {
  if (n == null) return '—'
  return Number(n).toFixed(1) + '%'
}
function marginColor(pct: number | null | undefined) {
  if (pct == null) return '#888'
  if (pct >= 20) return '#2D4A27'
  if (pct >= 10) return '#E67E22'
  return '#C0392B'
}

function fmtSignedMoney(n: number | null | undefined) {
  if (n == null) return '—'
  const sign = Number(n) > 0 ? '+' : Number(n) < 0 ? '-' : ''
  return sign + fmtMoney(Math.abs(Number(n)))
}

function fmtSignedPct(n: number | null | undefined) {
  if (n == null) return '—'
  const sign = Number(n) > 0 ? '+' : ''
  return sign + Number(n).toFixed(1) + '%'
}

const plRows = [
  ['asp_per_unit', 'ASP / Unit', 'money2'],
  ['units', 'Units Sold', 'int'],
  ['units_per_day', 'Units / Day', 'one'],
  ['target_gross_sales', 'Target Gross Sales', 'money'],
  ['price_discount', 'Price Discount', 'signed'],
  ['actual_selling_price', 'Actual Selling Price', 'subtotal'],
  ['coupons_rebates', 'Promotions & Coupons', 'signed'],
  ['refunds', 'Refunds', 'signed'],
  ['net_sales', 'Net Sales', 'subtotal'],
  ['g2n_pct', 'G2N%', 'pct'],
  ['landed_cogs', 'Landed COGS', 'signed'],
  ['gross_profit', 'Gross Profit', 'subtotal'],
  ['gm_pct', 'GM%', 'pct'],
  ['ads_spend', 'Advertising', 'signed'],
  ['marketing_contribution', 'Marketing Contribution', 'subtotal'],
  ['mktc_pct', 'MCM%', 'pct'],
  ['referral_fees', 'Referral Fees', 'signed'],
  ['fba_fees', 'FBA Fulfillment', 'signed'],
  ['storage_fees', 'Storage & Other', 'signed'],
  ['contribution_margin', 'Contribution Margin', 'total'],
  ['cm_pct', 'CM%', 'pct'],
] as const

const perUnitLabels: Record<string, string> = {
  target_gross_sales: 'Gross Sales',
  price_discount: 'Price Discount',
  actual_selling_price: 'Principal ASP',
  coupons_rebates: 'Promos',
  refunds: 'Refunds',
  net_sales: 'Net Sales',
  landed_cogs: 'COGS',
  gross_profit: 'Gross Profit',
  ads_spend: 'Advertising',
  marketing_contribution: 'Marketing Contribution',
  referral_fees: 'Referral',
  fba_fees: 'FBA',
  storage_fees: 'Storage',
  contribution_margin: 'Contribution Margin',
}

function fmtPL(value: unknown, kind: string) {
  const n = Number(value || 0)
  if (kind === 'int') return n ? Math.round(n).toLocaleString() : '—'
  if (kind === 'one') return n ? n.toFixed(1) : '—'
  if (kind === 'pct') return n ? `${n.toFixed(1)}%` : '—'
  if (kind === 'money2') return n ? `$${n.toFixed(2)}` : '—'
  if (kind === 'signed') return n < 0 ? `(${fmtMoney(Math.abs(n)).replace('$', '')})` : n > 0 ? fmtMoney(n) : '—'
  return fmtMoney(n)
}

export default function FinancePage() {
  const [data, setData] = useState<FinanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const filters = useDashboardFilters()

  useEffect(() => {
    fetch('/api/finance')
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingSkeleton />
  if (!data || data.error) return <DataState variant="error" title="Finance data could not load" description={data?.error || "The finance endpoint returned no response."} />

  const monthly = filterByDashboardState(data.monthly || [], filters, row => `${String(row.month).slice(0, 7)}-01`)
  const { settlement } = data

  if (!monthly || monthly.length === 0) {
    return (
      <div style={{ padding: 40 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 8, color: '#1A1A1A' }}>Finance</h1>
        <DataState title="No monthly financial data available yet" description="Settlement data is required to generate the finance view." />
      </div>
    )
  }

  const sorted = [...monthly].sort((a, b) => a.month.localeCompare(b.month))
  const last3 = sorted.slice(-3)
  const calendarPL = data.calendar_pl || []
  const displayPL = calendarPL.slice(-7)
  const settlementPL = data.settlement_pl || []
  const perUnit = data.per_unit || []

  const avg = (key: keyof MonthlyRow) => {
    const vals = last3.map(r => Number(r[key]) || 0)
    return vals.reduce((a, b) => a + b, 0) / (vals.length || 1)
  }

  const avgGrossSales = avg('gross_sales')
  const avgNetRevenue = avg('net_revenue')
  const avgGrossProfit = avg('gross_profit')
  const avgMargin = last3.reduce((s, r) => s + (r.gross_margin_pct || 0), 0) / (last3.length || 1)
  const insights = data.insights || {
    summary: {},
    monthly_intelligence: [],
    signals: [],
    drivers: [],
    latest_breakdown: [],
  }

  const chartData = sorted.map(r => ({
    month: r.month?.slice(0, 7),
    gross_sales: r.gross_sales,
    amazon_fees: Math.abs(r.amazon_fees || 0),
    fba_fees: Math.abs(r.fba_total || 0),
    net_profit: r.gross_profit,
    margin_pct: r.gross_margin_pct,
  }))

  return (
    <div style={{ paddingBottom: 40 }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 4, color: '#1A1A1A' }}>Finance</h1>
      <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: 20 }}>Settlement P&L, fee load, and net revenue trends (3-month avg)</p>

      <div className="dashboard-kpi-grid">
        <MetricCard label="Avg Gross Sales" value={fmtMoney(avgGrossSales)} sublabel="Last 3 months" />
        <MetricCard label="Avg Net Revenue" value={fmtMoney(avgNetRevenue)} sublabel="Last 3 months" />
        <MetricCard label="Avg Net After Fees" value={fmtMoney(avgGrossProfit)} sublabel="COGS not included" />
        <MetricCard
          label="Avg Fee-Adjusted Margin"
          value={fmtPct(avgMargin)}
          sublabel="Before COGS"
          status={avgMargin >= 20 ? 'normal' : avgMargin >= 10 ? 'warn' : 'alert'}
        />
      </div>

      <SectionHeader title="Monthly P&L Breakdown" subtitle="Gross sales vs Amazon fees, FBA fees, and net after fees" />
      <div className="dashboard-chart-card" style={{ background: 'white', borderRadius: 10, padding: 16, marginBottom: 16 }}>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#EBEBEB" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => '$' + (v/1000).toFixed(0) + 'k'} />
            <Tooltip formatter={(value: unknown) => fmtMoney(Number(value))} />
            <Legend />
            <Bar dataKey="gross_sales" fill="#B8D4AE" name="Gross Sales" />
            <Bar dataKey="amazon_fees" fill="#E67E22" name="Amazon Fees" />
            <Bar dataKey="fba_fees" fill="#C0392B" name="FBA Fees" />
            <Bar dataKey="net_profit" fill="#2D4A27" name="Net After Fees" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <SectionHeader title="Fee-Adjusted Margin Trend" subtitle="Net after fees as a percentage of gross sales" />
      <div className="dashboard-chart-card" style={{ background: 'white', borderRadius: 10, padding: 16, marginBottom: 16 }}>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#EBEBEB" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => v + '%'} domain={['auto', 'auto']} />
            <Tooltip formatter={(value: unknown) => Number(value).toFixed(1) + '%'} />
            <Legend />
            <Line type="monotone" dataKey="margin_pct" stroke="#2D4A27" strokeWidth={2.5} dot name="Fee-Adjusted Margin %" connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <SectionHeader title="Finance Intelligence" subtitle="Margin pressure, fee drag, refund impact, and month-over-month changes" />
      <div className="dashboard-kpi-grid">
        <MetricCard
          label="Latest Margin"
          value={fmtPct(insights.summary.latest_margin_pct)}
          sublabel={insights.summary.latest_month || 'Latest month'}
          status={(insights.summary.latest_margin_pct ?? 0) < 35 ? 'alert' : (insights.summary.latest_margin_pct ?? 0) < 50 ? 'warn' : 'normal'}
        />
        <MetricCard
          label="Fee Load"
          value={fmtPct(insights.summary.latest_fee_load_pct)}
          sublabel="Amazon + FBA / sales"
          status={(insights.summary.latest_fee_load_pct ?? 0) > 45 ? 'alert' : (insights.summary.latest_fee_load_pct ?? 0) > 35 ? 'warn' : 'normal'}
        />
        <MetricCard
          label="Refund Rate"
          value={fmtPct(insights.summary.latest_refund_rate_pct)}
          sublabel="Refunds / sales"
          status={(insights.summary.latest_refund_rate_pct ?? 0) > 10 ? 'alert' : (insights.summary.latest_refund_rate_pct ?? 0) > 5 ? 'warn' : 'normal'}
        />
        <MetricCard
          label="Ad-Adjusted Margin"
          value={fmtPct(insights.summary.latest_ad_adjusted_margin_pct)}
          sublabel="Before COGS"
          status={(insights.summary.latest_ad_adjusted_margin_pct ?? 0) < 20 ? 'alert' : (insights.summary.latest_ad_adjusted_margin_pct ?? 0) < 35 ? 'warn' : 'normal'}
        />
      </div>

      <SignalGrid signals={insights.signals} limit={6} />

      {displayPL.length > 0 && (
        <>
          <SectionHeader title="Calendar P&L" subtitle="Streamlit-matched monthly bridge from target gross sales to contribution margin" />
          <div className="dashboard-table-card" style={{ marginBottom: 20 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
              <thead>
                <tr>
                  <th style={{ padding: '8px 10px', textAlign: 'left', color: '#fff', background: '#1B4D2E', width: '30%' }}>P&L Line</th>
                  {displayPL.map(row => (
                    <th key={String(row.month)} style={{ padding: '8px 10px', textAlign: 'right', color: '#fff', background: '#1B4D2E' }}>
                      {String(row.label || row.month)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {plRows.map(([key, label, kind]) => {
                  const subtotal = kind === 'subtotal' || kind === 'total'
                  const muted = kind === 'pct' || kind === 'one'
                  return (
                    <tr key={key}>
                      <td style={{
                        padding: muted ? '4px 10px 4px 20px' : '7px 10px',
                        color: subtotal ? '#fff' : muted ? '#999' : '#333',
                        background: kind === 'total' ? '#1B4D2E' : subtotal ? '#444' : 'transparent',
                        fontWeight: subtotal ? 700 : 500,
                        borderBottom: '1px solid #F2F2F2',
                      }}>
                        {label}
                      </td>
                      {displayPL.map(row => (
                        <td key={`${String(row.month)}-${key}`} style={{
                          padding: muted ? '4px 10px' : '7px 10px',
                          textAlign: 'right',
                          color: subtotal ? '#fff' : muted ? '#999' : Number(row[key]) < 0 ? '#C0392B' : '#333',
                          background: kind === 'total' ? '#1B4D2E' : subtotal ? '#444' : 'transparent',
                          fontWeight: subtotal ? 700 : 500,
                          borderBottom: '1px solid #F2F2F2',
                          whiteSpace: 'nowrap',
                        }}>
                          {fmtPL(row[key], kind)}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {perUnit.length > 0 && (
        <>
          <SectionHeader title="Per-Unit Economics" subtitle="Every major P&L line divided by units sold, matching the old Streamlit unit economics module" />
          <div className="dashboard-chart-card" style={{ background: 'white', borderRadius: 10, padding: 16, marginBottom: 16 }}>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={perUnit.map(row => ({ ...row, label: perUnitLabels[row.metric] || row.metric, value: row.amount }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EBEBEB" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} angle={-30} textAnchor="end" height={90} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => '$' + Number(v).toFixed(0)} />
                <Tooltip formatter={(value: unknown) => fmtMoney(Number(value))} />
                <Bar dataKey="value" name="Per Unit">
                  {perUnit.map(row => (
                    <Cell key={row.metric} fill={row.amount < 0 ? '#C0392B' : row.metric.includes('contribution') ? '#1B4D2E' : '#6B8F61'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16, marginBottom: 20 }}>
        <div>
          <SectionHeader title="Latest Month Drivers" subtitle="Largest changes versus the previous month" />
          <div className="dashboard-table-card">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #EBEBEB' }}>
                  {['Metric', 'Current', 'Change', 'Read'].map(h => (
                    <th key={h} style={{ padding: '8px 8px', textAlign: h === 'Metric' || h === 'Read' ? 'left' : 'right', color: '#666', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {insights.drivers.slice(0, 8).map(row => {
                  const favorable = row.direction === 'higher' ? row.delta >= 0 : row.delta <= 0
                  const color = favorable ? '#2D4A27' : '#C0392B'
                  return (
                    <tr key={row.metric} style={{ borderBottom: '1px solid #F5F5F5' }}>
                      <td style={{ padding: '8px 8px', fontWeight: 600 }}>{row.metric}</td>
                      <td style={{ padding: '8px 8px', textAlign: 'right' }}>{row.metric.includes('Units') ? Number(row.current).toLocaleString() : fmtMoney(row.current)}</td>
                      <td style={{ padding: '8px 8px', textAlign: 'right', color, fontWeight: 700 }}>{row.metric.includes('Units') ? Number(row.delta).toLocaleString() : fmtSignedMoney(row.delta)}</td>
                      <td style={{ padding: '8px 8px', color, fontSize: '0.74rem', fontWeight: 600 }}>{favorable ? 'Favorable' : 'Pressure'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <SectionHeader title="Latest Cost Drag" subtitle="Largest deductions as share of gross sales" />
          <div className="dashboard-table-card">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #EBEBEB' }}>
                  {['Metric', 'Amount', '% Sales'].map(h => (
                    <th key={h} style={{ padding: '8px 8px', textAlign: h === 'Metric' ? 'left' : 'right', color: '#666', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {insights.latest_breakdown.map(row => (
                  <tr key={row.metric} style={{ borderBottom: '1px solid #F5F5F5' }}>
                    <td style={{ padding: '8px 8px', fontWeight: 600 }}>{row.metric}</td>
                    <td style={{ padding: '8px 8px', textAlign: 'right', color: row.amount < 0 ? '#C0392B' : '#2D4A27' }}>{fmtSignedMoney(row.amount)}</td>
                    <td style={{ padding: '8px 8px', textAlign: 'right' }}>{fmtPct(row.pct_of_sales)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {insights.monthly_intelligence.length > 0 && (
        <>
          <SectionHeader title="Margin Pressure Trend" subtitle="Fee load, refund rate, ad load, and ad-adjusted margin" />
          <div className="dashboard-chart-card" style={{ background: 'white', borderRadius: 10, padding: 16, marginBottom: 16 }}>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={insights.monthly_intelligence}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EBEBEB" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => v + '%'} />
                <Tooltip formatter={(value: unknown) => Number(value).toFixed(1) + '%'} />
                <Legend />
                <Line type="monotone" dataKey="fee_load_pct" stroke="#E67E22" strokeWidth={2} dot name="Fee Load %" connectNulls />
                <Line type="monotone" dataKey="refund_rate_pct" stroke="#C0392B" strokeWidth={2} dot name="Refund Rate %" connectNulls />
                <Line type="monotone" dataKey="ad_load_pct" stroke="#2980B9" strokeWidth={2} dot name="Ad Load %" connectNulls />
                <Line type="monotone" dataKey="ad_adjusted_margin_pct" stroke="#2D4A27" strokeWidth={2.5} dot name="Ad-Adjusted Margin %" connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {calendarPL.length > 0 && (
        <>
          <SectionHeader title="Streamlit Trend Modules" subtitle="ASP, net sales per unit, GP%, CM%, A&P%, and contribution margin trends" />
          <div className="dashboard-chart-grid">
            <div className="dashboard-chart-card" style={{ background: 'white', borderRadius: 10, padding: 16 }}>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={calendarPL}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EBEBEB" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => '$' + Number(v).toFixed(0)} />
                  <Tooltip formatter={(value: unknown) => fmtMoney(Number(value))} />
                  <Legend />
                  <Line type="monotone" dataKey="asp_per_unit" stroke="#2D4A27" strokeWidth={2} dot name="ASP / Unit" connectNulls />
                  <Line type="monotone" dataKey="net_sales" stroke="#2980B9" strokeWidth={2} dot name="Net Sales" connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="dashboard-chart-card" style={{ background: 'white', borderRadius: 10, padding: 16 }}>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={calendarPL}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EBEBEB" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => Number(v).toFixed(0) + '%'} />
                  <Tooltip formatter={(value: unknown) => Number(value).toFixed(1) + '%'} />
                  <Legend />
                  <Line type="monotone" dataKey="gm_pct" stroke="#2D4A27" strokeWidth={2} dot name="GP%" connectNulls />
                  <Line type="monotone" dataKey="cm_pct" stroke="#E67E22" strokeWidth={2} dot name="CM%" connectNulls />
                  <Line type="monotone" dataKey="ap_pct" stroke="#C0392B" strokeWidth={2} dot name="A&P%" connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      <SectionHeader title="Monthly P&L Table" />
      <div className="dashboard-table-card">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #EBEBEB' }}>
              {['Month', 'Gross Sales', 'Amazon Fees', 'FBA Fees', 'Net Revenue', 'Net After Fees', 'Margin%'].map(h => (
                <th key={h} style={{ padding: '8px 10px', textAlign: h === 'Month' ? 'left' : 'right', color: '#666', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map(row => (
              <tr key={row.month} style={{ borderBottom: '1px solid #F5F5F5' }}>
                <td style={{ padding: '8px 10px', fontWeight: 600 }}>{row.month?.slice(0, 7)}</td>
                <td style={{ padding: '8px 10px', textAlign: 'right' }}>{fmtMoney(row.gross_sales)}</td>
                <td style={{ padding: '8px 10px', textAlign: 'right', color: '#E67E22' }}>{fmtMoney(row.amazon_fees)}</td>
                <td style={{ padding: '8px 10px', textAlign: 'right', color: '#C0392B' }}>{fmtMoney(row.fba_total)}</td>
                <td style={{ padding: '8px 10px', textAlign: 'right' }}>{fmtMoney(row.net_revenue)}</td>
                <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>{fmtMoney(row.gross_profit)}</td>
                <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                  <span style={{
                    background: marginColor(row.gross_margin_pct) + '20',
                    color: marginColor(row.gross_margin_pct),
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontWeight: 600,
                    fontSize: '0.75rem',
                  }}>
                    {fmtPct(row.gross_margin_pct)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SectionHeader title="Settlement Summary" />
      {settlementPL.length > 0 ? (
        <div className="dashboard-table-card">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #EBEBEB' }}>
                {['Period', 'Units', 'Product Charges', 'Promos', 'Refunds', 'Net Revenue', 'Fees', 'Net Proceeds', 'Disbursed'].map(h => (
                  <th key={h} style={{ padding: '8px 8px', textAlign: h === 'Period' ? 'left' : 'right', color: '#666', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {settlementPL.map(row => (
                <tr key={String(row.group_id)} style={{ borderBottom: '1px solid #F5F5F5' }}>
                  <td style={{ padding: '8px 8px', fontWeight: 700 }}>{String(row.period || '—')}</td>
                  <td style={{ padding: '8px 8px', textAlign: 'right' }}>{Number(row.units || 0).toLocaleString()}</td>
                  <td style={{ padding: '8px 8px', textAlign: 'right' }}>{fmtMoney(Number(row.product_charges || 0))}</td>
                  <td style={{ padding: '8px 8px', textAlign: 'right', color: '#C0392B' }}>{fmtSignedMoney(Number(row.promo_rebates || 0))}</td>
                  <td style={{ padding: '8px 8px', textAlign: 'right', color: '#C0392B' }}>{fmtSignedMoney(Number(row.refunds || 0))}</td>
                  <td style={{ padding: '8px 8px', textAlign: 'right', fontWeight: 700 }}>{fmtMoney(Number(row.net_revenue || 0))}</td>
                  <td style={{ padding: '8px 8px', textAlign: 'right', color: '#C0392B' }}>{fmtSignedMoney(Number(row.total_fees || 0))}</td>
                  <td style={{ padding: '8px 8px', textAlign: 'right', fontWeight: 700 }}>{fmtMoney(Number(row.net_proceeds || 0))}</td>
                  <td style={{ padding: '8px 8px', textAlign: 'right' }}>{fmtMoney(Number(row.disbursed || 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (!settlement || settlement.length === 0) ? (
        <DataState title="Settlement data not available" description="Monthly rollups are visible, but settlement-level records are not available yet." />
      ) : (
        <div className="dashboard-table-card">
          {(() => {
            const allKeys = Array.from(new Set(settlement.flatMap(r => Object.keys(r))))
            const priorityKeys = ['settlement_id', 'start_date', 'end_date', 'currency', 'total_amount', 'net_proceeds', 'deposit_date', 'marketplace']
            const displayKeys = [
              ...priorityKeys.filter(k => allKeys.includes(k)),
              ...allKeys.filter(k => !priorityKeys.includes(k))
            ].slice(0, 8)
            const totalNet = settlement.reduce((s, r) => {
              const val = r['net_proceeds'] ?? r['total_amount'] ?? r['net_amount'] ?? 0
              return s + Number(val)
            }, 0)
            return (
              <>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #EBEBEB' }}>
                      {displayKeys.map(k => (
                        <th key={k} style={{ padding: '8px 10px', textAlign: 'left', color: '#666', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                          {k.replace(/_/g, ' ')}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {settlement.map((row, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #F5F5F5' }}>
                        {displayKeys.map(k => (
                          <td key={k} style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                            {String(row[k] ?? '—')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {totalNet !== 0 && (
                  <div style={{ marginTop: 12, fontWeight: 600, fontSize: '0.85rem', color: '#2D4A27', textAlign: 'right' }}>
                    Total Net Transferred: {fmtMoney(totalNet)}
                  </div>
                )}
              </>
            )
          })()}
        </div>
      )}
    </div>
  )
}
