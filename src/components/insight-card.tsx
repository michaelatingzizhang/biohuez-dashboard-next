export type InsightSeverity = 'critical' | 'warning' | 'positive' | 'neutral' | 'alert' | 'warn' | 'normal' | string

export interface InsightSignal {
  severity: InsightSeverity
  title: string
  detail: string
  section?: string
  href?: string
}

export function getInsightStyle(severity: InsightSeverity) {
  const normalized = normalizeSeverity(severity)
  if (normalized === 'critical') return { bg: '#FDECEA', border: '#C0392B', accent: '#C0392B', label: 'Critical' }
  if (normalized === 'warning') return { bg: '#FFF8E1', border: '#E67E22', accent: '#E67E22', label: 'Watch' }
  if (normalized === 'positive') return { bg: '#EEF6EC', border: '#2D4A27', accent: '#2D4A27', label: 'Win' }
  return { bg: '#F8F8F8', border: '#DADADA', accent: '#666', label: 'Info' }
}

function normalizeSeverity(severity: InsightSeverity) {
  if (severity === 'alert' || severity === 'critical') return 'critical'
  if (severity === 'warn' || severity === 'warning') return 'warning'
  if (severity === 'normal' || severity === 'positive') return 'positive'
  return 'neutral'
}

export function SignalCard({ signal, href, section, compact = false }: {
  signal: InsightSignal
  href?: string
  section?: string
  compact?: boolean
}) {
  const colors = getInsightStyle(signal.severity)
  const card = (
    <div style={{
      background: colors.bg,
      border: `1px solid ${colors.border}33`,
      borderLeft: `4px solid ${colors.border}`,
      borderRadius: 8,
      padding: compact ? 12 : 14,
      minHeight: compact ? undefined : 132,
    }}>
      {(section || signal.section) && (
        <div style={{ color: '#555', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: 5 }}>
          {section || signal.section}
        </div>
      )}
      <div style={{ color: colors.accent, fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
        {colors.label}
      </div>
      <div style={{ color: '#1A1A1A', fontSize: '0.9rem', fontWeight: 700, marginBottom: 4, lineHeight: 1.3 }}>{signal.title}</div>
      <div style={{ color: '#666', fontSize: '0.78rem', lineHeight: 1.4 }}>{signal.detail}</div>
    </div>
  )

  const targetHref = href || signal.href
  if (!targetHref) return card

  return (
    <a href={targetHref} style={{ display: 'block', textDecoration: 'none' }}>
      {card}
    </a>
  )
}

export function SignalGrid({ signals, columns = 2, limit, compact = true }: {
  signals: InsightSignal[]
  columns?: number
  limit?: number
  compact?: boolean
}) {
  const visible = typeof limit === 'number' ? signals.slice(0, limit) : signals
  if (visible.length === 0) return null

  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: 12, marginBottom: 20 }}>
      {visible.map((signal, index) => (
        <SignalCard key={`${signal.title}-${index}`} signal={signal} compact={compact} />
      ))}
    </div>
  )
}
