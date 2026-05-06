'use client'
import { LoadingSkeleton } from '@/components/loading-skeleton'

import { useEffect, useState } from 'react'
import { MetricCard } from '@/components/metric-card'
import { SectionHeader } from '@/components/section-header'
import { SignalGrid } from '@/components/insight-card'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface StateRow {
  state: string
  orders: number
  revenue: number
  pct: number
  aov: number
}

interface SkuRow {
  sku: string
  orders: number
  revenue: number
}

interface GeoSignal {
  severity: 'positive' | 'warning' | 'critical' | string
  title: string
  detail: string
}

interface ConcentrationRow {
  sku?: string
  state?: string
  orders: number
  revenue: number
  aov: number
  pct: number
}

interface GeoInsights {
  summary: {
    total_rows: number
    sku_count: number
    state_count: number
    top_sku: string | null
    top_sku_share_pct: number
    top2_sku_share_pct: number
    sku_concentration_level: string
    top_state: string | null
    top_state_share_pct: number
    top3_state_share_pct: number
    market_concentration_level: string
    total_sku_revenue: number
    total_sku_orders: number
    total_state_revenue: number
    total_state_orders: number
  }
  signals: GeoSignal[]
  sku_concentration: ConcentrationRow[]
  market_concentration: ConcentrationRow[]
  data_coverage: {
    state_level_available: boolean
    rows_analyzed: number
    note?: string | null
  }
}

interface GeoData {
  states: StateRow[]
  by_sku?: SkuRow[]
  insights?: GeoInsights
  total_rows?: number
  geo_note?: string
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

const SKU_MAP: Record<string, string> = {
  'ZH-FH-1B': 'Black',
  'ZH-FH-3C': 'Chocolate',
  'ZH-FH-5CL': 'Cream Latte',
  'ZH-FH-6R': 'Red',
}

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

export default function GeographyPage() {
  const [data, setData] = useState<GeoData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/geography')
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingSkeleton />

  const states = data?.states || []
  const bySkuRaw = data?.by_sku || []
  const bySku = bySkuRaw.map(r => ({ ...r, sku_name: SKU_MAP[r.sku] || r.sku }))
  const insights = data?.insights
  const summary = insights?.summary
  const skuConcentration = insights?.sku_concentration || []
  const marketConcentration = insights?.market_concentration || []
  const totalRevenue = states.reduce((s, r) => s + r.revenue, 0)

  // Generate intensity color for bars
  const maxRev = states.length > 0 ? Math.max(...states.map(s => s.revenue)) : 1
  function barColor(rev: number) {
    const intensity = rev / maxRev
    const r = Math.round(45 + (45 - 45) * (1 - intensity))
    const g = Math.round(74 + (74 - 74) * (1 - intensity))
    const b = Math.round(39 + (39 - 39) * (1 - intensity))
    // Blend between light green and dark green
    const lightR = 184, lightG = 212, lightB = 174
    const darkR = 45, darkG = 74, darkB = 39
    return `rgb(${Math.round(lightR + (darkR - lightR) * intensity)},${Math.round(lightG + (darkG - lightG) * intensity)},${Math.round(lightB + (darkB - lightB) * intensity)})`
  }

  return (
    <div style={{ paddingBottom: 40 }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 4, color: '#1A1A1A' }}>Geography</h1>
      <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: 20 }}>Order distribution by SKU and region</p>

      {summary && (
        <>
          <SectionHeader title="Market Concentration" subtitle="Tier 2 signals based on the available order geography and SKU mix" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
            <MetricCard
              label="Top SKU Share"
              value={fmtPct(summary.top_sku_share_pct)}
              sublabel={summary.top_sku ? `${SKU_MAP[summary.top_sku] || summary.top_sku} · ${summary.sku_concentration_level}` : 'No SKU data'}
            />
            <MetricCard
              label="Top 2 SKU Share"
              value={fmtPct(summary.top2_sku_share_pct)}
              sublabel={`${summary.sku_count} tracked SKUs`}
            />
            <MetricCard
              label="State Coverage"
              value={summary.state_count > 0 ? `${summary.state_count}` : 'Unavailable'}
              sublabel={summary.state_count > 0 ? `${summary.market_concentration_level} concentration` : 'Using SKU proxy'}
            />
            <MetricCard
              label="Rows Analyzed"
              value={Number(summary.total_rows || 0).toLocaleString()}
              sublabel={`${summary.total_sku_orders || 0} SKU order rows`}
            />
          </div>

          {insights?.signals && <SignalGrid signals={insights.signals} />}

          {skuConcentration.length > 0 && (
            <>
              <SectionHeader title="SKU Concentration" subtitle="Revenue dependency by product variant" />
              <div style={{ background: 'white', borderRadius: 10, padding: 16, overflowX: 'auto', marginBottom: 20 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #EBEBEB' }}>
                      {['SKU', 'Orders', 'Revenue', 'AOV', 'Share'].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: h === 'SKU' ? 'left' : 'right', color: '#666', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {skuConcentration.map(row => (
                      <tr key={row.sku} style={{ borderBottom: '1px solid #F5F5F5' }}>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: SKU_COLORS[row.sku || ''] || '#ccc', marginRight: 8 }} />
                          {SKU_MAP[row.sku || ''] || row.sku}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right' }}>{row.orders}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right' }}>{fmtMoney(row.revenue)}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right' }}>{fmtMoney(row.aov)}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700 }}>{fmtPct(row.pct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {marketConcentration.length > 0 && (
            <>
              <SectionHeader title="State Concentration" subtitle="Market dependency by available region data" />
              <div style={{ background: 'white', borderRadius: 10, padding: 16, overflowX: 'auto', marginBottom: 20 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #EBEBEB' }}>
                      {['State', 'Orders', 'Revenue', 'AOV', 'Share'].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: h === 'State' ? 'left' : 'right', color: '#666', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {marketConcentration.map(row => (
                      <tr key={row.state} style={{ borderBottom: '1px solid #F5F5F5' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 600 }}>{row.state}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right' }}>{row.orders}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right' }}>{fmtMoney(row.revenue)}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right' }}>{fmtMoney(row.aov)}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700 }}>{fmtPct(row.pct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      {states.length === 0 ? (
        <>
          {/* No state data — show SKU breakdown instead */}
          <div style={{ background: '#FFF8E1', border: '1px solid #E67E22', borderRadius: 8, padding: 16, marginBottom: 20, color: '#8B5E00', fontSize: '0.85rem' }}>
            State-level geographic data is not available in the current order export (Amazon does not expose buyer state in SP-API orders). Showing SKU revenue breakdown instead.
            {data?.geo_note && <div style={{ marginTop: 4, opacity: 0.7 }}>{data.geo_note}</div>}
          </div>

          {bySku.length > 0 && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 20 }}>
                {bySku.map(r => (
                  <MetricCard
                    key={r.sku}
                    label={r.sku_name}
                    value={fmtMoney(r.revenue)}
                    sublabel={`${r.orders} orders`}
                  />
                ))}
              </div>

              <SectionHeader title="Revenue by SKU" />
              <div style={{ background: 'white', borderRadius: 10, padding: 16, marginBottom: 16 }}>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={bySku} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#EBEBEB" vertical={true} horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => '$' + v.toFixed(0)} />
                    <YAxis type="category" dataKey="sku_name" tick={{ fontSize: 11 }} width={90} />
                    <Tooltip formatter={(value: unknown) => '$' + Number(value).toFixed(2)} />
                    <Bar dataKey="revenue" name="Revenue" radius={[0, 4, 4, 0]}>
                      {bySku.map((entry) => (
                        <Cell key={entry.sku} fill={SKU_COLORS[entry.sku] || '#6B8F61'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <SectionHeader title="SKU Breakdown" />
              <div style={{ background: 'white', borderRadius: 10, padding: 16 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #EBEBEB' }}>
                      {['SKU', 'Orders', 'Revenue', 'AOV', '% of Total'].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: h === 'SKU' ? 'left' : 'right', color: '#666', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {bySku.sort((a, b) => b.revenue - a.revenue).map(row => {
                      const totalRev = bySku.reduce((s, r) => s + r.revenue, 0)
                      const pct = totalRev > 0 ? (row.revenue / totalRev * 100).toFixed(1) : '0'
                      const aov = row.orders > 0 ? row.revenue / row.orders : 0
                      return (
                        <tr key={row.sku} style={{ borderBottom: '1px solid #F5F5F5' }}>
                          <td style={{ padding: '8px 12px' }}>
                            <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: SKU_COLORS[row.sku] || '#ccc', marginRight: 8 }} />
                            {row.sku_name}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right' }}>{row.orders}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right' }}>{fmtMoney(row.revenue)}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right' }}>{fmtMoney(aov)}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right' }}>{pct}%</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      ) : (
        <>
          {/* Top 5 KPI cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
            {states.slice(0, 5).map(s => (
              <MetricCard
                key={s.state}
                label={s.state}
                value={fmtMoney(s.revenue)}
                sublabel={`${s.orders} orders · AOV ${fmtMoney(s.aov)}`}
              />
            ))}
          </div>

          <SectionHeader title="Revenue by State" subtitle="Top 20 states — sorted by revenue" />
          <div style={{ background: 'white', borderRadius: 10, padding: 16, marginBottom: 16 }}>
            <ResponsiveContainer width="100%" height={Math.max(300, states.length * 22)}>
              <BarChart data={states} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#EBEBEB" vertical={true} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => '$' + v.toFixed(0)} />
                <YAxis type="category" dataKey="state" tick={{ fontSize: 11 }} width={50} />
                <Tooltip formatter={(value: unknown) => '$' + Number(value).toFixed(2)} />
                <Bar dataKey="revenue" name="Revenue" radius={[0, 4, 4, 0]}>
                  {states.map(entry => (
                    <Cell key={entry.state} fill={barColor(entry.revenue)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <SectionHeader title="State Breakdown" subtitle="Sorted by revenue" />
          <div style={{ background: 'white', borderRadius: 10, padding: 16, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #EBEBEB' }}>
                  {['State', 'Orders', 'Revenue', 'AOV', '% of Total'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: h === 'State' ? 'left' : 'right', color: '#666', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {states.map(row => (
                  <tr key={row.state} style={{ borderBottom: '1px solid #F5F5F5' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600 }}>{row.state}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>{row.orders}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>{fmtMoney(row.revenue)}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>{fmtMoney(row.aov)}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>{row.pct}%</td>
                  </tr>
                ))}
                <tr style={{ borderTop: '2px solid #EBEBEB', fontWeight: 700 }}>
                  <td style={{ padding: '8px 12px' }}>Total</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>{states.reduce((s, r) => s + r.orders, 0)}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>{fmtMoney(totalRevenue)}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>—</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>100%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
