'use client'
import { LoadingSkeleton } from '@/components/loading-skeleton'

import { useEffect, useState } from 'react'
import { MetricCard } from '@/components/metric-card'
import { SectionHeader } from '@/components/section-header'
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
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

interface FinanceData {
  monthly: MonthlyRow[]
  settlement: Record<string, unknown>[]
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

export default function FinancePage() {
  const [data, setData] = useState<FinanceData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/finance')
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingSkeleton />
  if (!data || data.error) return <div style={{ padding: 40, color: '#C0392B' }}>Error: {data?.error}</div>

  const { monthly, settlement } = data

  if (!monthly || monthly.length === 0) {
    return (
      <div style={{ padding: 40 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 8, color: '#1A1A1A' }}>Finance</h1>
        <p style={{ color: '#888' }}>No monthly financial data available yet. Settlement data is required to generate P&L.</p>
      </div>
    )
  }

  const sorted = [...monthly].sort((a, b) => a.month.localeCompare(b.month))
  const last3 = sorted.slice(-3)

  const avg = (key: keyof MonthlyRow) => {
    const vals = last3.map(r => Number(r[key]) || 0)
    return vals.reduce((a, b) => a + b, 0) / (vals.length || 1)
  }

  const avgGrossSales = avg('gross_sales')
  const avgNetRevenue = avg('net_revenue')
  const avgGrossProfit = avg('gross_profit')
  const avgMargin = last3.reduce((s, r) => s + (r.gross_margin_pct || 0), 0) / (last3.length || 1)

  // Chart data: waterfall-style stacked bar
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
      <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: 20 }}>P&L, settlement data, and margin trends (3-month avg)</p>

      {/* KPI Ribbon */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 20 }}>
        <MetricCard label="Avg Gross Sales" value={fmtMoney(avgGrossSales)} sublabel="Last 3 months" />
        <MetricCard label="Avg Net Revenue" value={fmtMoney(avgNetRevenue)} sublabel="Last 3 months" />
        <MetricCard label="Avg Net Profit" value={fmtMoney(avgGrossProfit)} sublabel="After FBA & fees" />
        <MetricCard
          label="Avg Margin"
          value={fmtPct(avgMargin)}
          sublabel="Net profit / gross sales"
          status={avgMargin >= 20 ? 'normal' : avgMargin >= 10 ? 'warn' : 'alert'}
        />
      </div>

      {/* P&L Bar Chart */}
      <SectionHeader title="Monthly P&L Breakdown" subtitle="Gross sales vs fees vs net profit" />
      <div style={{ background: 'white', borderRadius: 10, padding: 16, marginBottom: 16 }}>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#EBEBEB" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => '$' + (v/1000).toFixed(0) + 'k'} />
            <Tooltip formatter={(value: unknown) => '$' + Number(value).toFixed(2)} />
            <Legend />
            <Bar dataKey="gross_sales" fill="#B8D4AE" name="Gross Sales" />
            <Bar dataKey="amazon_fees" fill="#E67E22" name="Amazon Fees" />
            <Bar dataKey="fba_fees" fill="#C0392B" name="FBA Fees" />
            <Bar dataKey="net_profit" fill="#2D4A27" name="Net Profit" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Margin Trend */}
      <SectionHeader title="Margin Trend" subtitle="Net margin % over time" />
      <div style={{ background: 'white', borderRadius: 10, padding: 16, marginBottom: 16 }}>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#EBEBEB" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => v + '%'} domain={['auto', 'auto']} />
            <Tooltip formatter={(value: unknown) => Number(value).toFixed(1) + '%'} />
            <Legend />
            <Line type="monotone" dataKey="margin_pct" stroke="#2D4A27" strokeWidth={2.5} dot name="Margin %" connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Monthly P&L Table */}
      <SectionHeader title="Monthly P&L Table" />
      <div style={{ background: 'white', borderRadius: 10, padding: 16, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #EBEBEB' }}>
              {['Month', 'Gross Sales', 'Amazon Fees', 'FBA Fees', 'Net Revenue', 'Net Profit', 'Margin%'].map(h => (
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

      {/* Settlement Summary */}
      <SectionHeader title="Settlement Summary" />
      {(!settlement || settlement.length === 0) ? (
        <div style={{ background: 'white', borderRadius: 10, padding: 24, color: '#888', textAlign: 'center' }}>
          Settlement data not available
        </div>
      ) : (
        <div style={{ background: 'white', borderRadius: 10, padding: 16, overflowX: 'auto' }}>
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
