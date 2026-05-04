'use client'

import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { SectionHeader } from '@/components/section-header'
import { DataState } from '@/components/data-state'

interface TableStatus {
  table: string
  actual_table?: string
  display_name: string
  status: 'ok' | 'error' | 'missing' | 'unavailable'
  rows: number
  last_updated: string | null
  error?: string
}

interface SystemData {
  tables: TableStatus[]
  total: number
  error?: string
}

const TABLE_LABELS: Record<string, string> = {
  'sp_sales_traffic_weekly': 'Sales & Traffic',
  'sp_orders': 'Orders',
  'sp_inventory_snapshots': 'Inventory',
  'sp_ads_performance': 'Ads Performance',
  'sp_ads_by_type': 'Ads by Type',
  'sp_bsr': 'BSR Rankings',
  'sp_finances': 'Finances / Settlement',
  'fin_monthly': 'Monthly P&L',
  'ba_repeat_purchase_weekly': 'Repeat Purchase (BA)',
  'ba_search_query_performance_weekly': 'Search Query (BA)',
}

export default function SystemStatusPage() {
  const [data, setData] = useState<SystemData | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState(new Date())

  const fetchData = () => {
    setLoading(true)
    fetch('/api/system-status')
      .then(r => r.json())
      .then(d => { setData(d); setLastRefresh(new Date()) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchData() }, [])

  const tables = data?.tables || []
  const okCount = tables.filter(t => t.status === 'ok' && t.rows > 0).length
  const total = tables.length
  const healthPct = total > 0 ? okCount / total : 0
  const healthColor = healthPct >= 0.8 ? '#2D4A27' : healthPct >= 0.5 ? '#E67E22' : '#C0392B'

  // Last sync date
  const lastSync = tables
    .filter(t => t.last_updated)
    .map(t => t.last_updated || '')
    .sort()
    .reverse()[0]

  return (
    <div style={{ paddingBottom: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1A1A1A' }}>System Status</h1>
        <button
          onClick={fetchData}
          style={{ background: '#2D4A27', color: 'white', border: 'none', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}
        >
          Refresh
        </button>
      </div>
      <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: 20 }}>
        Database table health · Last checked {lastRefresh.toLocaleTimeString()}
      </p>

      {/* Overall health */}
      <div style={{ background: 'white', borderRadius: 10, padding: 20, marginBottom: 20, borderLeft: `4px solid ${healthColor}`, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 14, height: 14, borderRadius: '50%', background: healthColor }} />
          <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1A1A1A' }}>
            {loading ? 'Checking...' : `${okCount} / ${total} tables healthy`}
          </span>
          {lastSync && (
            <span style={{ fontSize: '0.8rem', color: '#888', marginLeft: 'auto' }}>
              Last sync: {lastSync.slice(0, 10)}
            </span>
          )}
        </div>
        {!loading && total > 0 && (
          <div style={{ marginTop: 10, background: '#F5F5F5', borderRadius: 4, height: 8, overflow: 'hidden' }}>
            <div style={{ width: `${healthPct * 100}%`, height: '100%', background: healthColor, borderRadius: 4, transition: 'width 0.5s' }} />
          </div>
        )}
      </div>

      {loading && <div style={{ padding: 20, color: '#888', textAlign: 'center' }}>Checking database tables...</div>}
      {!loading && data?.error ? (
        <div style={{ marginBottom: 16 }}>
          <DataState variant="error" title="Database connection unavailable" description={data.error} />
        </div>
      ) : null}

      {/* Table cards */}
      {!loading && (
        <>
          <SectionHeader title="Table Details" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            {tables.map(t => {
              const label = TABLE_LABELS[t.table] || t.display_name
              const isOk = t.status === 'ok' && t.rows > 0
              const isEmpty = t.status === 'ok' && t.rows === 0
              const badgeStyle = isOk
                ? { background: '#E8F5E2', color: '#2D4A27', border: '1px solid #B8D4AE' }
                : isEmpty
                ? { background: '#FFF8E1', color: '#8B5E00', border: '1px solid #F0D080' }
                : t.status === 'missing'
                ? { background: '#F5F5F5', color: '#888', border: '1px solid #ccc' }
                : { background: '#FDEAEA', color: '#C0392B', border: '1px solid #F0B0B0' }
              const borderColor = isOk ? '#2D4A27' : isEmpty ? '#E67E22' : t.status === 'missing' ? '#ccc' : '#C0392B'

              return (
                <div key={t.table} style={{
                  background: 'white',
                  borderRadius: 10,
                  padding: 16,
                  borderLeft: `4px solid ${borderColor}`,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1A1A1A' }}>{label}</div>
                    <Badge style={badgeStyle}>
                      {isOk ? 'OK' : isEmpty ? 'Empty' : t.status === 'missing' ? 'Missing' : 'Error'}
                    </Badge>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#888', fontFamily: 'monospace', marginBottom: 8 }}>
                    {t.actual_table || t.table}
                  </div>
                  <div style={{ display: 'flex', gap: 20 }}>
                    <div>
                      <div style={{ fontSize: '0.68rem', color: '#aaa', textTransform: 'uppercase', fontWeight: 600 }}>Rows</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1A1A1A' }}>{t.rows.toLocaleString()}</div>
                    </div>
                    {t.last_updated && (
                      <div>
                        <div style={{ fontSize: '0.68rem', color: '#aaa', textTransform: 'uppercase', fontWeight: 600 }}>Last Updated</div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#444' }}>{t.last_updated?.slice(0, 10)}</div>
                      </div>
                    )}
                  </div>
                  {t.error && (
                    <div style={{ marginTop: 8, fontSize: '0.72rem', color: '#C0392B', background: '#FDEAEA', borderRadius: 4, padding: '4px 8px' }}>
                      {t.error.slice(0, 100)}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
