'use client'

import { useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Presentation, GitMerge, Sliders } from 'lucide-react'

export interface DashboardFilterState {
  from: string
  to: string
  sku: string
  interval: string
  granularity: string
}

const SKU_OPTIONS = [
  { value: 'all', label: 'All SKUs' },
  { value: 'Black', label: 'Black' },
  { value: 'Chocolate', label: 'Brown' },
  { value: 'Cream Latte', label: 'Cream Latte' },
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
    interval: params.get('interval') || '30d',
    granularity: params.get('granularity') || 'daily',
  }
}

export function DashboardFilters({ toggleReportMode, toggleCompare }: { toggleReportMode?: () => void; toggleCompare?: () => void } = {}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [collapsed, setCollapsed] = useState(false)
  const [viewMenuOpen, setViewMenuOpen] = useState(false)

  const filters = useDashboardFilters()
  const comparisonActive = params.get('compare') === 'previous'
  const hasActiveFilters = Boolean(filters.from || filters.to || filters.sku !== 'all' || comparisonActive || filters.interval !== '30d' || filters.granularity !== 'daily')
  const dailyUnavailable = ['/demographics', '/cohorts', '/seasonality'].includes(pathname)
  const [filterSaved, setFilterSaved] = useState(false)

  function updateFilter(key: keyof DashboardFilterState, value: string) {
    const next = new URLSearchParams(params.toString())
    if (!value || value === 'all') next.delete(key)
    else next.set(key, value)
    router.replace(`${pathname}${next.toString() ? `?${next.toString()}` : ''}`)
  }

  function setPreset(value: string, days: number | 'all') {
    const next = new URLSearchParams(params.toString())
    next.set('interval', value)
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
    next.delete('interval')
    next.delete('granularity')
    next.delete('compare')
    router.replace(`${pathname}${next.toString() ? `?${next.toString()}` : ''}`)
  }

  function setGranularity(value: string) {
    const next = new URLSearchParams(params.toString())
    if (value === 'daily') next.delete('granularity')
    else next.set('granularity', value)
    router.replace(`${pathname}${next.toString() ? `?${next.toString()}` : ''}`)
  }

  function saveFilterView() {
    window.localStorage.setItem('biohuez-filter-view', JSON.stringify({
      from: filters.from,
      to: filters.to,
      sku: filters.sku,
      interval: filters.interval,
      granularity: filters.granularity,
      compare: comparisonActive,
    }))
    setFilterSaved(true)
  }

  const intervalGroups = [
    {
      label: 'Day Options',
      disabled: dailyUnavailable,
      options: [
        { label: '30D', value: '30d', days: 30 },
        { label: '90D', value: '90d', days: 90 },
        { label: '180D', value: '180d', days: 180 },
        { label: '365D', value: '365d', days: 365 },
      ],
    },
    {
      label: 'Week Options',
      disabled: false,
      options: [
        { label: '5W', value: '5w', days: 35 },
        { label: '12W', value: '12w', days: 84 },
        { label: '26W', value: '26w', days: 182 },
        { label: '52W', value: '52w', days: 364 },
      ],
    },
    {
      label: 'Month Options',
      disabled: false,
      options: [
        { label: '1M', value: '1m', days: 30 },
        { label: '3M', value: '3m', days: 90 },
        { label: '6M', value: '6m', days: 180 },
        { label: '12M', value: '12m', days: 365 },
      ],
    },
  ]

  if (collapsed) {
    return (
      <div className="dashboard-filter-collapsed">
        <span>{filters.interval.toUpperCase()}</span>
        <span>{filters.granularity === 'weekly' ? 'Weekly' : 'Daily'}</span>
        <span>{filters.sku === 'all' ? 'All SKUs' : SKU_OPTIONS.find(option => option.value === filters.sku)?.label || filters.sku}</span>
        {comparisonActive && <span>Compare previous period</span>}
        <button onClick={() => setCollapsed(false)}>Expand filters</button>
      </div>
    )
  }

  return (
    <div className="dashboard-filter-shell">
      <div className="dashboard-filter-grid">
      <div className="dashboard-filter-presets">
        <div className="dashboard-interval-groups">
          {intervalGroups.map(group => (
            <div key={group.label} className={`dashboard-interval-group ${group.disabled ? 'is-disabled' : ''}`}>
              <div className="dashboard-interval-label">{group.label}</div>
              <div className="dashboard-interval-options">
                {group.options.map(option => {
                  const active = filters.interval === option.value && !group.disabled
                  return (
                    <button
                      key={option.value}
                      onClick={() => setPreset(option.value, option.days)}
                      disabled={group.disabled}
                      className={`dashboard-interval-button ${active ? 'active' : ''}`}
                    >
                      {option.label}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="dashboard-custom-group">
        <div className="dashboard-interval-label">Custom</div>
        <div className="dashboard-custom-dates">
          <FilterInput label="From" type="date" value={filters.from} onChange={value => updateFilter('from', value)} compact />
          <FilterInput label="To" type="date" value={filters.to} onChange={value => updateFilter('to', value)} compact />
        </div>
      </div>

      <div className="dashboard-filter-controls">
        <div className="dashboard-filter-tools">
          <div className="dashboard-view-menu">
            <button
              className="commercial-report-toggle"
              type="button"
              aria-label="View options"
              title="View options"
              onClick={() => setViewMenuOpen(current => !current)}
            >
              <Sliders size={16} strokeWidth={2.2} />
            </button>
            {viewMenuOpen ? (
              <div className="dashboard-view-menu-popover">
                <button
                  type="button"
                  onClick={() => {
                    saveFilterView()
                    setViewMenuOpen(false)
                  }}
                  className="dashboard-filter-action-button"
                >
                  {filterSaved ? 'Saved' : 'Save view'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    resetFilters()
                    setViewMenuOpen(false)
                  }}
                  className="dashboard-filter-action-button"
                  disabled={!hasActiveFilters}
                >
                  Reset
                </button>
              </div>
            ) : null}
          </div>
          <button
            className="commercial-report-toggle"
            onClick={toggleReportMode || (() => {})}
            data-testid="report-mode-enter"
            title="Enter report mode (each container becomes one slide)"
          >
            <Presentation size={16} strokeWidth={2.2} />
            Report mode
          </button>
          <button
            className="commercial-report-toggle"
            onClick={toggleCompare || (() => {})}
            data-testid="compare-toggle"
            title="Toggle compare previous period"
            aria-pressed={comparisonActive}
          >
            <GitMerge size={16} strokeWidth={2.2} />
            Compare
          </button>
        </div>
        <div className="dashboard-filter-secondary">
          <select
            value={filters.sku}
            onChange={event => updateFilter('sku', event.target.value)}
            className="dashboard-sku-select"
            aria-label="SKU"
          >
            {SKU_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <div className="dashboard-granularity-toggle">
            {['daily', 'weekly'].map(value => (
              <button
                key={value}
                onClick={() => setGranularity(value)}
                className={filters.granularity === value ? 'active' : ''}
              >
                {value === 'daily' ? 'Daily' : 'Weekly'}
              </button>
            ))}
          </div>
        </div>
      </div>
      </div>
    </div>
  )
}

function FilterInput({ label, type, value, onChange, compact }: {
  label: string
  type: string
  value: string
  onChange: (value: string) => void
  compact?: boolean
}) {
  return (
    <div>
      {!compact && <label className="dashboard-filter-input-label">{label}</label>}
      <input
        aria-label={label}
        type={type}
        value={value}
        onChange={event => onChange(event.target.value)}
        className="dashboard-filter-input"
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
    'black (1b)': 'black',
    'chocolate (3c)': 'chocolate',
  }
  return aliases[raw] || raw
}

export function hasActiveDashboardFilters(filters: DashboardFilterState) {
  return Boolean(filters.from || filters.to || filters.sku !== 'all' || filters.interval !== '30d' || filters.granularity !== 'daily')
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
