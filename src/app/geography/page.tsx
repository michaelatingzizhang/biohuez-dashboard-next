'use client'
import { LoadingSkeleton } from '@/components/loading-skeleton'

import { useEffect, useState } from 'react'
import { MetricCard } from '@/components/metric-card'
import { SectionHeader } from '@/components/section-header'
import { SignalGrid } from '@/components/insight-card'
import { ReportSlide } from '@/components/report-slide'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts'

interface StateRow {
  state: string
  orders: number
  units: number
  revenue: number
  pct: number
  aov: number
  asp?: number
}

interface CityRow {
  state: string
  city: string
  label: string
  orders: number
  units: number
  revenue: number
  pct: number
  aov: number
  asp?: number
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

interface MonthlyGeoModule {
  month: string
  rows: Array<StateRow | CityRow | { state?: string; city?: string; label?: string; orders: number; units: number; revenue: number; pct: number; aov: number; asp?: number }>
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
  cities?: CityRow[]
  by_sku?: SkuRow[]
  latest_month?: string
  kpis?: {
    top_states?: StateRow[]
    states_reached?: number
    top5_units_share?: number
    top5_revenue_share?: number
  }
  monthly_states?: MonthlyGeoModule[]
  monthly_cities?: MonthlyGeoModule[]
  insights?: GeoInsights
  total_rows?: number
  geo_note?: string
  source?: string
  error?: string
}

function fmtMoney(n: number | null | undefined) {
  if (n == null) return '-'
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function fmtPct(n: number | null | undefined) {
  if (n == null) return '-'
  return Number(n).toFixed(1) + '%'
}

function fmtInt(n: number | null | undefined) {
  return Number(n || 0).toLocaleString('en-US')
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
  const cities = data?.cities || []
  const bySkuRaw = data?.by_sku || []
  const bySku = bySkuRaw.map(r => ({ ...r, sku_name: SKU_MAP[r.sku] || r.sku }))
  const insights = data?.insights
  const summary = insights?.summary
  const skuConcentration = insights?.sku_concentration || []
  const marketConcentration = insights?.market_concentration || []
  const totalRevenue = states.reduce((s, r) => s + r.revenue, 0)
  const totalUnits = states.reduce((s, r) => s + Number(r.units || 0), 0)
  const kpis = data?.kpis
  const topStates = kpis?.top_states || states.slice(0, 3)
  const monthlyStates = data?.monthly_states || []
  const monthlyCities = data?.monthly_cities || []
  const latestStateModule = monthlyStates[monthlyStates.length - 1]
  const latestCityModule = monthlyCities[monthlyCities.length - 1]
  const maxRev = states.length > 0 ? Math.max(...states.map(s => s.revenue)) : 1

  function barColor(rev: number) {
    const intensity = Math.max(0.1, rev / maxRev)
    const lightR = 184, lightG = 212, lightB = 174
    const darkR = 45, darkG = 74, darkB = 39
    return `rgb(${Math.round(lightR + (darkR - lightR) * intensity)},${Math.round(lightG + (darkG - lightG) * intensity)},${Math.round(lightB + (darkB - lightB) * intensity)})`
  }

  return (
    <div style={{ paddingBottom: 40 }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 4, color: '#1A1A1A' }}>Geography</h1>
      <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: 20 }}>Shipment geography, city concentration, and SKU distribution</p>

      <ReportSlide
        title="Geography Executive Summary"
        message="This slide should show where demand is concentrated and whether the business is overly dependent on a few products or regions."
        watch="Top states, state coverage, market concentration, and SKU concentration signals."
        action="Use this slide to frame the discussion around market concentration and regional demand quality."
        order={1}
      >
      {states.length > 0 && (
        <>
          <SectionHeader title="State Performance" subtitle={`Shipment-level view${data?.latest_month ? ` · Latest month ${data.latest_month}` : ''}`} />
          <div className="dashboard-kpi-grid">
            {topStates.slice(0, 3).map((row, index) => (
              <MetricCard
                key={`${row.state}-${index}`}
                label={`Top State #${index + 1}`}
                value={row.state}
                sublabel={`${fmtInt(row.units)} units · ${fmtMoney(row.revenue)} · ${fmtPct(row.pct)}`}
              />
            ))}
            <MetricCard label="States Reached" value={fmtInt(kpis?.states_reached || states.length)} sublabel={`${fmtInt(totalUnits)} units total`} />
            <MetricCard label="Top 5 States Units" value={fmtPct(kpis?.top5_units_share)} sublabel="Share of latest-month units" />
            <MetricCard label="Top 5 States Revenue" value={fmtPct(kpis?.top5_revenue_share)} sublabel="Share of latest-month revenue" />
          </div>
        </>
      )}

      {summary && (
        <>
          <SectionHeader title="Market Concentration" subtitle="Tier 2 signals based on available geography and SKU mix" />
          <div className="dashboard-kpi-grid">
            <MetricCard
              label="Top SKU Share"
              value={fmtPct(summary.top_sku_share_pct)}
              sublabel={summary.top_sku ? `${SKU_MAP[summary.top_sku] || summary.top_sku} · ${summary.sku_concentration_level}` : 'No SKU data'}
            />
            <MetricCard label="Top 2 SKU Share" value={fmtPct(summary.top2_sku_share_pct)} sublabel={`${summary.sku_count} tracked SKUs`} />
            <MetricCard
              label="State Coverage"
              value={summary.state_count > 0 ? `${summary.state_count}` : 'Unavailable'}
              sublabel={summary.state_count > 0 ? `${summary.market_concentration_level} concentration` : 'Using SKU proxy'}
            />
            <MetricCard label="Rows Analyzed" value={fmtInt(summary.total_rows || 0)} sublabel={`${fmtInt(summary.total_sku_orders || 0)} SKU order rows`} />
          </div>

          {insights?.signals && <SignalGrid signals={insights.signals} />}
        </>
      )}
      </ReportSlide>

      <ReportSlide
        title="Geography Performance Detail"
        message="This slide should show the actual revenue distribution across states or fallback SKU geography proxies."
        watch="Revenue by state, latest state and city modules, and the biggest city or state contributors."
        action="Use this slide to identify where demand is concentrated and where growth pockets might exist."
        order={2}
      >
      {states.length === 0 ? (
        <>
          <div style={{ background: '#FFF8E1', border: '1px solid #E67E22', borderRadius: 8, padding: 16, marginBottom: 20, color: '#8B5E00', fontSize: '0.85rem' }}>
            State and city shipment data is not available in the current extract. Showing SKU revenue breakdown instead.
            {data?.geo_note && <div style={{ marginTop: 4, opacity: 0.7 }}>{data.geo_note}</div>}
          </div>

          {bySku.length > 0 && (
            <>
              <div className="dashboard-kpi-grid">
                {bySku.map(r => (
                  <MetricCard key={r.sku} label={r.sku_name} value={fmtMoney(r.revenue)} sublabel={`${fmtInt(r.orders)} orders`} />
                ))}
              </div>

              <SectionHeader title="Revenue by SKU" />
              <div className="dashboard-chart-card" style={{ background: 'white', borderRadius: 10, padding: 16, marginBottom: 16 }}>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={bySku} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#EBEBEB" vertical horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => '$' + Number(v).toFixed(0)} />
                    <YAxis type="category" dataKey="sku_name" tick={{ fontSize: 11 }} width={90} />
                    <Tooltip formatter={(value: unknown) => fmtMoney(Number(value))} />
                    <Bar dataKey="revenue" name="Revenue" radius={[0, 4, 4, 0]}>
                      {bySku.map(entry => (
                        <Cell key={entry.sku} fill={SKU_COLORS[entry.sku] || '#6B8F61'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </>
      ) : (
        <>
          <SectionHeader title="Revenue by State" subtitle="Top states sorted by revenue" />
          <div className="dashboard-chart-card" style={{ background: 'white', borderRadius: 10, padding: 16, marginBottom: 16 }}>
            <ResponsiveContainer width="100%" height={Math.max(320, states.length * 22)}>
              <BarChart data={states} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#EBEBEB" vertical horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => '$' + Number(v).toFixed(0)} />
                <YAxis type="category" dataKey="state" tick={{ fontSize: 11 }} width={55} />
                <Tooltip formatter={(value: unknown) => fmtMoney(Number(value))} />
                <Bar dataKey="revenue" name="Revenue" radius={[0, 4, 4, 0]}>
                  {states.map(entry => (
                    <Cell key={entry.state} fill={barColor(entry.revenue)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="dashboard-chart-grid">
            {latestStateModule && (
              <div>
                <SectionHeader title={`Latest States · ${latestStateModule.month}`} subtitle="Units and revenue by state" />
                <div className="dashboard-chart-card" style={{ background: 'white', borderRadius: 10, padding: 16 }}>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={latestStateModule.rows}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#EBEBEB" vertical={false} />
                      <XAxis dataKey="state" tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={v => '$' + Number(v).toFixed(0)} />
                      <Tooltip formatter={(value: unknown, name: unknown) => name === 'Revenue' ? fmtMoney(Number(value)) : Number(value).toLocaleString()} />
                      <Legend />
                      <Bar yAxisId="left" dataKey="units" name="Units" fill="#6B8F61" />
                      <Bar yAxisId="right" dataKey="revenue" name="Revenue" fill="#2D4A27" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {latestCityModule && (
              <div>
                <SectionHeader title={`Latest Cities · ${latestCityModule.month}`} subtitle="Top shipment cities by units and revenue" />
                <div className="dashboard-chart-card" style={{ background: 'white', borderRadius: 10, padding: 16 }}>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={latestCityModule.rows.slice(0, 8)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#EBEBEB" vertical horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="label" tick={{ fontSize: 10 }} width={110} />
                      <Tooltip formatter={(value: unknown) => Number(value).toLocaleString()} />
                      <Bar dataKey="units" name="Units" fill="#2D4A27" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          <SectionHeader title="City Breakdown" subtitle="Top shipment cities sorted by revenue" />
          <div className="dashboard-table-card" style={{ marginBottom: 20 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #EBEBEB' }}>
                  {['City', 'State', 'Orders', 'Units', 'Revenue', 'ASP', '% Revenue'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: h === 'City' || h === 'State' ? 'left' : 'right', color: '#666', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cities.slice(0, 25).map(row => (
                  <tr key={`${row.state}-${row.city}`} style={{ borderBottom: '1px solid #F5F5F5' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600 }}>{row.city}</td>
                    <td style={{ padding: '8px 12px' }}>{row.state}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>{fmtInt(row.orders)}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>{fmtInt(row.units)}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>{fmtMoney(row.revenue)}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>{fmtMoney(row.asp || 0)}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700 }}>{fmtPct(row.pct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <SectionHeader title="State Breakdown" subtitle="Sorted by revenue" />
          <div className="dashboard-table-card" style={{ marginBottom: 20 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #EBEBEB' }}>
                  {['State', 'Orders', 'Units', 'Revenue', 'AOV', 'ASP', '% Revenue'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: h === 'State' ? 'left' : 'right', color: '#666', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {states.map(row => (
                  <tr key={row.state} style={{ borderBottom: '1px solid #F5F5F5' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600 }}>{row.state}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>{fmtInt(row.orders)}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>{fmtInt(row.units)}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>{fmtMoney(row.revenue)}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>{fmtMoney(row.aov)}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>{fmtMoney(row.asp || 0)}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700 }}>{fmtPct(row.pct)}</td>
                  </tr>
                ))}
                <tr style={{ borderTop: '2px solid #EBEBEB', fontWeight: 700 }}>
                  <td style={{ padding: '8px 12px' }}>Total</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>{fmtInt(states.reduce((s, r) => s + r.orders, 0))}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>{fmtInt(totalUnits)}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>{fmtMoney(totalRevenue)}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>-</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>-</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>100%</td>
                </tr>
              </tbody>
            </table>
          </div>

          {marketConcentration.length > 0 && (
            <>
              <SectionHeader title="Concentration Readout" subtitle="Top market dependency view" />
              <div className="dashboard-table-card" style={{ marginBottom: 20 }}>
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
                        <td style={{ padding: '8px 12px', textAlign: 'right' }}>{fmtInt(row.orders)}</td>
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
      </ReportSlide>

      <ReportSlide
        title="Geography Concentration Tables"
        message="This slide should act as the appendix for regional and SKU concentration details."
        watch="Market concentration rows and SKU dependence by revenue share."
        action="Use this slide when someone wants the exact breakdown behind the concentration story."
        order={3}
      >
      {skuConcentration.length > 0 && (
        <>
          <SectionHeader title="SKU Concentration" subtitle="Revenue dependency by product variant" />
          <div className="dashboard-table-card">
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
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>{fmtInt(row.orders)}</td>
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
      </ReportSlide>
    </div>
  )
}
