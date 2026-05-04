'use client'

import { useEffect, useState } from 'react'
import { MetricCard } from '@/components/metric-card'
import { LoadingSkeleton } from '@/components/loading-skeleton'
import { SectionHeader } from '@/components/section-header'
import { DataFootnote, DataState } from '@/components/data-state'
import {
  Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ComposedChart, Line,
  PieChart, Pie, Cell
} from 'recharts'

const SKU_COLORS: Record<string, string> = {
  'Black': '#2D4A27',
  'Chocolate': '#6B8F61',
  'Cream Latte': '#B8D4AE',
  'Red': '#C0392B',
}

type SalesRow = { date: string; sku_name: string; revenue: number; orders: number; units: number }
type InvRow = { sku_name: string; total_quantity: number }
type SummaryMeta = { last_updated?: string | null; sales_last_date?: string | null; inventory_last_fetched_at?: string | null }

export default function SummaryPage() {
  const [sales, setSales] = useState<SalesRow[]>([])
  const [inventory, setInventory] = useState<InvRow[]>([])
  const [meta, setMeta] = useState<SummaryMeta | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/summary')
      .then(r => r.json())
      .then(d => {
        setSales(d.sales || [])
        setInventory(d.inventory || [])
        setMeta(d.meta || null)
        setLoading(false)
      })
      .catch(e => { setError(String(e)); setLoading(false) })
  }, [])

  // KPI calculations
  const totalRevenue = sales.reduce((s, r) => s + (r.revenue || 0), 0)
  const totalOrders = sales.reduce((s, r) => s + (r.orders || 0), 0)
  const totalUnits = sales.reduce((s, r) => s + (r.units || 0), 0)
  const aov = totalOrders > 0 ? totalRevenue / totalOrders : 0
  const asp = totalUnits > 0 ? totalRevenue / totalUnits : 0

  // Date range
  const dates = [...new Set(sales.map(r => r.date))].sort()
  const startDate = dates[0]?.slice(0, 10) || ''
  const endDate = dates[dates.length - 1]?.slice(0, 10) || ''
  const sublabel = startDate && endDate ? `${startDate} – ${endDate}` : 'All time'

  // Revenue chart data: aggregate by date across SKUs
  const revenueByDate: Record<string, Record<string, number>> = {}
  for (const row of sales) {
    const d = row.date?.slice(0, 10)
    if (!d) continue
    if (!revenueByDate[d]) revenueByDate[d] = {}
    revenueByDate[d][row.sku_name] = (revenueByDate[d][row.sku_name] || 0) + row.revenue
  }
  const revenueChartData = Object.entries(revenueByDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, skus]) => {
      const totalUnitsOnDate = sales.filter(r => r.date?.slice(0, 10) === date).reduce((s, r) => s + r.units, 0)
      const totalRevOnDate = Object.values(skus).reduce((s, v) => s + v, 0)
      return { date, ...skus, asp: totalUnitsOnDate > 0 ? +(totalRevOnDate / totalUnitsOnDate).toFixed(2) : 0 }
    })
    .slice(-90)

  // Orders by date grouped
  const ordersByDate: Record<string, Record<string, number>> = {}
  const unitsByDate: Record<string, Record<string, number>> = {}
  for (const row of sales) {
    const d = row.date?.slice(0, 10)
    if (!d) continue
    if (!ordersByDate[d]) ordersByDate[d] = {}
    if (!unitsByDate[d]) unitsByDate[d] = {}
    ordersByDate[d][row.sku_name] = (ordersByDate[d][row.sku_name] || 0) + row.orders
    unitsByDate[d][row.sku_name] = (unitsByDate[d][row.sku_name] || 0) + row.units
  }
  const ordersChartData = Object.entries(ordersByDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, skus]) => ({ date, ...skus }))
    .slice(-90)
  const unitsChartData = Object.entries(unitsByDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, skus]) => ({ date, ...skus }))
    .slice(-90)

  // SKU totals for table
  const skuTotals: Record<string, { revenue: number; orders: number; units: number }> = {}
  for (const row of sales) {
    if (!skuTotals[row.sku_name]) skuTotals[row.sku_name] = { revenue: 0, orders: 0, units: 0 }
    skuTotals[row.sku_name].revenue += row.revenue
    skuTotals[row.sku_name].orders += row.orders
    skuTotals[row.sku_name].units += row.units
  }
  const skuRows = Object.entries(skuTotals).sort((a, b) => b[1].revenue - a[1].revenue)
  const skuNames = Object.keys(SKU_COLORS)

  if (loading) return <LoadingSkeleton />
  if (error) return <DataState variant="error" title="Summary data could not load" description={error} />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* KPI Ribbon */}
      <div className="dashboard-kpi-grid-tight">
        <MetricCard label="Total Revenue" value={`$${totalRevenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}`} sublabel={sublabel} />
        <MetricCard label="Total Orders" value={totalOrders.toLocaleString()} sublabel={sublabel} />
        <MetricCard label="Units Sold" value={totalUnits.toLocaleString()} sublabel={sublabel} />
        <MetricCard label="Avg Order Value" value={`$${aov.toFixed(2)}`} sublabel={sublabel} />
        <MetricCard label="Avg Selling Price" value={`$${asp.toFixed(2)}`} sublabel={sublabel} />
      </div>

      {/* Inventory Strip */}
      {inventory.length > 0 && (
        <>
          <SectionHeader title="FBA Inventory" />
          <div className="dashboard-kpi-grid-tight">
            {inventory.map((inv) => {
              const qty = inv.total_quantity || 0
              const invStatus: 'alert' | 'warn' | 'normal' = qty < 100 ? 'alert' : qty < 300 ? 'warn' : 'normal'
              const invSublabel = qty < 100 ? 'Low stock' : qty < 300 ? 'Monitor' : 'Healthy'
              return <MetricCard key={inv.sku_name} label={inv.sku_name} value={`${qty.toLocaleString()} units`} sublabel={invSublabel} status={invStatus} />
            })}
          </div>
        </>
      )}

      {/* Revenue & ASP */}
      <SectionHeader title="Revenue & ASP" />
      {revenueChartData.length > 0 ? (
        <div className="dashboard-chart-card" style={{ background: 'white', borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={revenueChartData} margin={{ top: 10, right: 60, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EBEBEB" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v: string) => v.slice(5)} />
              <YAxis yAxisId="left" tick={{ fontSize: 10 }} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} tickFormatter={(v: number) => `$${v.toFixed(2)}`} />
              <Tooltip formatter={(v: unknown, name: unknown) => {
                const num = typeof v === 'number' ? v : 0
                const label = typeof name === 'string' ? name : ''
                return label === 'asp' ? [`$${num.toFixed(2)}`, 'ASP'] : [`$${num.toLocaleString()}`, label]
              }} />
              <Legend />
              {skuNames.map(sku => (
                <Area key={sku} yAxisId="left" type="monotone" dataKey={sku} stackId="1"
                  stroke={SKU_COLORS[sku]} fill={SKU_COLORS[sku]} fillOpacity={0.85} />
              ))}
              <Line yAxisId="right" type="monotone" dataKey="asp" stroke="#8B4513" strokeWidth={2} dot={false} name="ASP" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : <DataState title="No sales data available" description="Sales rows are not available for the selected data source yet." />}

      {/* Orders & Units */}
      <SectionHeader title="Orders & Units" />
      <div className="dashboard-chart-grid">
        <div className="dashboard-chart-card" style={{ background: 'white', borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 8 }}>Orders</div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={unitsChartData} margin={{ top: 5, right: 10, left: 5, bottom: 20 }} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#EBEBEB" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={(v: string) => v.slice(5)} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend />
              {skuNames.map(sku => (
                <Bar key={sku} dataKey={sku} fill={SKU_COLORS[sku]} name={sku} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="dashboard-chart-card" style={{ background: 'white', borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 8 }}>Units Sold</div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={ordersChartData} margin={{ top: 5, right: 10, left: 5, bottom: 20 }} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#EBEBEB" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={(v: string) => v.slice(5)} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend />
              {skuNames.map(sku => (
                <Bar key={sku} dataKey={sku} fill={SKU_COLORS[sku]} name={sku} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* SKU Breakdown charts */}
      {(() => {
        const revPieData = skuRows.map(([sku, t]) => ({ name: sku, value: t.revenue }))
        const unitsPieData = skuRows.map(([sku, t]) => ({ name: sku, value: t.units }))
        const aspBarData = skuRows.map(([sku, t]) => ({ sku, asp: t.units > 0 ? t.revenue / t.units : 0 }))
        return (
          <div className="dashboard-mini-chart-grid">
            {/* Revenue Pie */}
            <div className="dashboard-chart-card" style={{ background: 'white', borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 8 }}>Revenue by SKU</div>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={revPieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value"
                    label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
                    {revPieData.map((entry, i) => <Cell key={i} fill={SKU_COLORS[entry.name] || '#ccc'} />)}
                  </Pie>
                  <Tooltip formatter={(v: unknown) => [`$${Number(v).toLocaleString()}`, 'Revenue']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Units Pie */}
            <div className="dashboard-chart-card" style={{ background: 'white', borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 8 }}>Units by SKU</div>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={unitsPieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value"
                    label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
                    {unitsPieData.map((entry, i) => <Cell key={i} fill={SKU_COLORS[entry.name] || '#ccc'} />)}
                  </Pie>
                  <Tooltip formatter={(v: unknown) => [Number(v).toLocaleString(), 'Units']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* ASP Bar */}
            <div className="dashboard-chart-card" style={{ background: 'white', borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 8 }}>ASP by SKU</div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={aspBarData} margin={{ top: 20, right: 10, left: 10, bottom: 5 }} barCategoryGap="40%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#EBEBEB" vertical={false} />
                  <XAxis dataKey="sku" tick={{ fontSize: 10 }} />
                  <YAxis tickFormatter={(v: number) => `$${v.toFixed(2)}`} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: unknown) => [`$${Number(v).toFixed(2)}`, 'ASP']} />
                  <Bar dataKey="asp" name="ASP" radius={[4, 4, 0, 0]}>
                    {aspBarData.map((entry, i) => (
                      <Cell key={i} fill={SKU_COLORS[entry.sku] || '#ccc'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )
      })()}

      {/* SKU Breakdown table */}
      <SectionHeader title="SKU Breakdown" />
      <div className="dashboard-table-card" style={{ marginBottom: 16 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #EBEBEB' }}>
              {['SKU', 'Revenue', 'Rev %', 'Orders', 'Order %', 'Units', 'Units %'].map(h => (
                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#666', fontSize: '0.72rem', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {skuRows.map(([sku, t]) => (
              <tr key={sku} style={{ borderBottom: '1px solid #F0F0F0' }}>
                <td style={{ padding: '8px 12px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: SKU_COLORS[sku] || '#ccc', flexShrink: 0 }} />
                  {sku}
                </td>
                <td style={{ padding: '8px 12px' }}>${t.revenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                <td style={{ padding: '8px 12px', color: '#888' }}>{totalRevenue > 0 ? (t.revenue / totalRevenue * 100).toFixed(1) : 0}%</td>
                <td style={{ padding: '8px 12px' }}>{t.orders.toLocaleString()}</td>
                <td style={{ padding: '8px 12px', color: '#888' }}>{totalOrders > 0 ? (t.orders / totalOrders * 100).toFixed(1) : 0}%</td>
                <td style={{ padding: '8px 12px' }}>{t.units.toLocaleString()}</td>
                <td style={{ padding: '8px 12px', color: '#888' }}>{totalUnits > 0 ? (t.units / totalUnits * 100).toFixed(1) : 0}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <DataFootnote>
        Data source: MotherDuck · Latest sales date {meta?.sales_last_date ?? "not available"} · Inventory snapshot {meta?.inventory_last_fetched_at?.slice(0, 10) ?? "not available"}
      </DataFootnote>
    </div>
  )
}
