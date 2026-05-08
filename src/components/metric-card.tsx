export function MetricCard({ label, value, sublabel, status = 'normal' }: {
  label: string; value: string; sublabel?: string; status?: 'normal' | 'alert' | 'warn'
}) {
  const accent = status === 'alert' ? '#C0392B' : status === 'warn' ? 'var(--biohuez-gold)' : 'var(--biohuez-dark)'
  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.94)',
      borderRadius: 14,
      padding: '16px 16px 14px',
      border: '1px solid rgba(34, 44, 38, 0.1)',
      boxShadow: '0 1px 2px rgba(20, 28, 22, 0.03), 0 12px 26px rgba(20, 28, 22, 0.045)',
      minWidth: 0,
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', inset: '0 auto 0 0', width: 4, background: accent }} />
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '0.68rem', color: '#687268', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.075em' }}>{label}</div>
          <div style={{ fontSize: '1.52rem', fontWeight: 820, color: '#111A14', margin: '5px 0 3px', lineHeight: 1.15, overflowWrap: 'anywhere', letterSpacing: '-0.02em' }}>{value}</div>
          {sublabel && <div style={{ fontSize: '0.73rem', color: '#828B82', lineHeight: 1.35 }}>{sublabel}</div>}
        </div>
      </div>
    </div>
  )
}
