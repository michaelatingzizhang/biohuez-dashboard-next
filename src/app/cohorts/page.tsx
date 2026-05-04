'use client'
import { LoadingSkeleton } from '@/components/loading-skeleton'
import { DataState } from '@/components/data-state'

import { useEffect, useState } from 'react'
import { MetricCard } from '@/components/metric-card'
import { SectionHeader } from '@/components/section-header'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface CohortRow {
  cohort_month: string
  m0: number
  m1: number | null
  m2: number | null
  m3: number | null
  m4: number | null
  m5: number | null
}

interface CohortSizeRow {
  cohort_month: string
  m0_count: number
}

interface CohortData {
  cohorts: CohortRow[]
  cohort_sizes: CohortSizeRow[]
  total_orders: number
  error?: string
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
  if (pct === null) return '#ccc'
  return pct > 50 ? '#fff' : '#1A1A1A'
}

export default function CohortsPage() {
  const [data, setData] = useState<CohortData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/cohorts')
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingSkeleton />
  if (!data || data.error) return (
    <DataState
      title="Cohort data could not load"
      description={data?.error || 'Check the sales data connection and try refreshing this page.'}
      variant="error"
    />
  )

  const { cohorts, cohort_sizes, total_orders } = data
  if (cohorts.length === 0 && cohort_sizes.length === 0) return (
    <DataState
      title="No cohort data yet"
      description="Cohort retention will appear once enough order history is available."
    />
  )

  // KPIs
  const validM1 = cohorts.filter(r => r.m1 !== null).map(r => r.m1 as number)
  const validM3 = cohorts.filter(r => r.m3 !== null).map(r => r.m3 as number)
  const avgM1 = validM1.length > 0 ? validM1.reduce((a, b) => a + b, 0) / validM1.length : null
  const avgM3 = validM3.length > 0 ? validM3.reduce((a, b) => a + b, 0) / validM3.length : null

  const sortedCohorts = [...cohorts].sort((a, b) => a.cohort_month.localeCompare(b.cohort_month))
  const sortedSizes = [...cohort_sizes].sort((a, b) => a.cohort_month.localeCompare(b.cohort_month))

  const offsets = ['m0', 'm1', 'm2', 'm3', 'm4', 'm5'] as const

  return (
    <div style={{ paddingBottom: 40 }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 4, color: '#1A1A1A' }}>Cohorts</h1>
      <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: 20 }}>Customer retention analysis by cohort month</p>

      {/* Note about proxy */}
      <div style={{ background: '#FFF8E1', border: '1px solid #E67E22', borderRadius: 8, padding: 12, marginBottom: 20, color: '#8B5E00', fontSize: '0.8rem' }}>
        Note: Amazon does not expose buyer email/ID in order exports. Cohorts are built from order counts by first-purchase month as a proxy for customer cohorts.
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        <MetricCard label="Total Orders" value={total_orders.toLocaleString()} sublabel="Proxy for unique customers" />
        <MetricCard
          label="Avg M1 Retention"
          value={avgM1 !== null ? avgM1.toFixed(1) + '%' : 'N/A'}
          sublabel="Orders returning month 2"
        />
        <MetricCard
          label="Avg M3 Retention"
          value={avgM3 !== null ? avgM3.toFixed(1) + '%' : 'N/A'}
          sublabel="Orders returning month 4"
        />
      </div>

      {/* Cohort heatmap */}
      {sortedCohorts.length > 0 && (
        <>
          <SectionHeader title="Cohort Retention Heatmap" subtitle="% of M0 orders remaining in each subsequent month" />
          <div style={{ background: 'white', borderRadius: 10, padding: 16, marginBottom: 16, overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr>
                  <th style={{ padding: '8px 12px', textAlign: 'left', color: '#666', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase', minWidth: 100 }}>Cohort</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', color: '#666', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase' }}>Size</th>
                  {(['M0', 'M1', 'M2', 'M3', 'M4', 'M5'] as const).map(m => (
                    <th key={m} style={{ padding: '8px 12px', textAlign: 'center', color: '#666', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase', minWidth: 65 }}>{m}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedCohorts.map(row => {
                  const size = sortedSizes.find(s => s.cohort_month === row.cohort_month)?.m0_count || row.m0
                  return (
                    <tr key={row.cohort_month} style={{ borderBottom: '1px solid #F5F5F5' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 600 }}>{row.cohort_month}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: '#888' }}>{size}</td>
                      {offsets.map(offset => {
                        const val = offset === 'm0' ? 100 : row[offset]
                        return (
                          <td key={offset} style={{
                            padding: '8px 12px',
                            textAlign: 'center',
                            background: retentionColor(val),
                            color: textColor(val),
                            borderRadius: 4,
                            fontWeight: val !== null ? 600 : 400,
                            fontSize: '0.8rem',
                          }}>
                            {val !== null ? (offset === 'm0' ? '100%' : val.toFixed(0) + '%') : '—'}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Cohort size chart */}
      <SectionHeader title="Cohort Size Over Time" subtitle="Number of orders in each cohort (M0)" />
      <div style={{ background: 'white', borderRadius: 10, padding: 16 }}>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={sortedSizes}>
            <CartesianGrid strokeDasharray="3 3" stroke="#EBEBEB" vertical={false} />
            <XAxis dataKey="cohort_month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="m0_count" fill="#2D4A27" name="Orders (M0)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
