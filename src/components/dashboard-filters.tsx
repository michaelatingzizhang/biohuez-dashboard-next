'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'

export interface DashboardFilterState {
  from: string
  to: string
  sku: string
}

const SKU_OPTIONS = [
  { value: 'all', label: 'All SKUs' },
  { value: 'Black', label: 'Black' },
  { value: 'Chocolate', label: 'Chocolate' },
  { value: 'Cream Latte', label: 'Cream Latte' },
  { value: 'Red', label: 'Red' },
  { value: 'ZH-FH-1B', label: 'ZH-FH-1B' },
  { value: 'ZH-FH-3C', label: 'ZH-FH-3C' },
  { value: 'ZH-FH-5CL', label: 'ZH-FH-5CL' },
  { value: 'ZH-FH-6R', label: 'ZH-FH-6R' },
]

function dateDaysAgo(days: number) {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString().slice(0, 10)
}

export function useDashboardFilters(): DashboardFilterState {
  const params = useSearchParams()
  return {
    from: params.get('from') || '',
    to: params.get('to') || '',
    sku: params.get('sku') || 'all',
  }
}

export function DashboardFilters() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const filters = useDashboardFilters()
  const hasActiveFilters = Boolean(filters.from || filters.to || filters.sku !== 'all')

  function updateFilter(key: keyof DashboardFilterState, value: string) {
    const next = new URLSearchParams(params.toString())
    if (!value || value === 'all') next.delete(key)
    else next.set(key, value)
    router.replace(`${pathname}${next.toString() ? `?${next.toString()}` : ''}`)
  }

  function setPreset(days: number | 'all') {
    const next = new URLSearchParams(params.toString())
    if (days === 'all') {
      next.delete('from')
      next.delete('to')
    } else {
      next.set('from', dateDaysAgo(days))
      next.delete('to')
    }
    router.replace(`${pathname}${next.toString() ? `?${next.toString()}` : ''}`)
  }

  function resetFilters() {
    const next = new URLSearchParams(params.toString())
    next.delete('from')
    next.delete('to')
    next.delete('sku')
    router.replace(`${pathname}${next.toString() ? `?${next.toString()}` : ''}`)
  }

  return (
    <div className="dashboard-filter-grid" style={{
      background: 'rgba(255, 255, 255, 0.92)',
      border: '1px solid rgba(34, 44, 38, 0.1)',
      borderRadius: 14,
      padding: 14,
      marginBottom: 22,
      display: 'grid',
      gridTemplateColumns: 'minmax(180px, 1.2fr) repeat(2, minmax(140px, 0.8fr)) minmax(170px, 0.9fr) auto',
      gap: 10,
      alignItems: 'end',
      boxShadow: '0 1px 2px rgba(20, 28, 22, 0.03), 0 12px 26px rgba(20, 28, 22, 0.04)',
    }}>
      <div>
        <div style={{ fontSize: '0.72rem', color: '#666', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>Quick Range</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            { label: '30D', value: 30 },
            { label: '90D', value: 90 },
            { label: '180D', value: 180 },
            { label: 'All', value: 'all' as const },
          ].map(item => (
            <button
              key={item.label}
              onClick={() => setPreset(item.value)}
              style={{
                border: '1px solid rgba(34, 44, 38, 0.12)',
                background: '#F7F9F6',
                color: '#344238',
                borderRadius: 9,
                padding: '7px 10px',
                fontSize: '0.78rem',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <FilterInput label="From" type="date" value={filters.from} onChange={value => updateFilter('from', value)} />
      <FilterInput label="To" type="date" value={filters.to} onChange={value => updateFilter('to', value)} />

      <div>
        <label style={{ display: 'block', fontSize: '0.72rem', color: '#666', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>SKU</label>
        <select
          value={filters.sku}
          onChange={event => updateFilter('sku', event.target.value)}
          style={{
            width: '100%',
            border: '1px solid rgba(34, 44, 38, 0.14)',
            borderRadius: 9,
            padding: '8px 10px',
            fontSize: '0.82rem',
            background: 'white',
            color: '#1A1A1A',
          }}
        >
          {SKU_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>

      <button
        onClick={resetFilters}
        disabled={!hasActiveFilters}
        style={{
          border: hasActiveFilters ? '1px solid #2D4A27' : '1px solid rgba(34, 44, 38, 0.1)',
          borderRadius: 9,
          padding: '9px 12px',
          fontSize: '0.78rem',
          fontWeight: 800,
          cursor: hasActiveFilters ? 'pointer' : 'default',
          color: hasActiveFilters ? 'white' : '#999',
          background: hasActiveFilters ? '#2D4A27' : '#F1F3F0',
        }}
      >
        Reset
      </button>
    </div>
  )
}

function FilterInput({ label, type, value, onChange }: {
  label: string
  type: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '0.72rem', color: '#666', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={event => onChange(event.target.value)}
        style={{
          width: '100%',
          border: '1px solid rgba(34, 44, 38, 0.14)',
          borderRadius: 9,
          padding: '8px 10px',
          fontSize: '0.82rem',
          color: '#1A1A1A',
        }}
      />
    </div>
  )
}

export function rowMatchesDate(value: unknown, filters: Pick<DashboardFilterState, 'from' | 'to'>) {
  const date = String(value || '').slice(0, 10)
  if (!date) return true
  if (filters.from && date < filters.from) return false
  if (filters.to && date > filters.to) return false
  return true
}

export function rowMatchesSku(value: unknown, filters: Pick<DashboardFilterState, 'sku'>) {
  if (!filters.sku || filters.sku === 'all') return true
  const selected = normalizeSku(filters.sku)
  return normalizeSku(value).includes(selected) || selected.includes(normalizeSku(value))
}

export function normalizeSku(value: unknown) {
  const raw = String(value || '').trim().toLowerCase()
  const aliases: Record<string, string> = {
    'zh-fh-1b': 'black',
    'zh-fh-3c': 'chocolate',
    'zh-fh-5cl': 'cream latte',
    'zh-fh-6r': 'red',
    'black (1b)': 'black',
    'chocolate (3c)': 'chocolate',
  }
  return aliases[raw] || raw
}

export function hasActiveDashboardFilters(filters: DashboardFilterState) {
  return Boolean(filters.from || filters.to || filters.sku !== 'all')
}

export function filterByDashboardState<T>(
  rows: T[],
  filters: DashboardFilterState,
  getDate?: (row: T) => unknown,
  getSku?: (row: T) => unknown,
) {
  return rows.filter(row => {
    const dateOk = getDate ? rowMatchesDate(getDate(row), filters) : true
    const skuOk = getSku ? rowMatchesSku(getSku(row), filters) : true
    return dateOk && skuOk
  })
}
