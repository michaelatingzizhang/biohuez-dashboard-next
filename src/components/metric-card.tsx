export function MetricCard({ label, value, sublabel, status = 'normal' }: {
  label: string; value: string; sublabel?: string; status?: 'normal' | 'alert' | 'warn'
}) {
  const borderColor = status === 'alert' ? '#C0392B' : status === 'warn' ? '#E67E22' : '#2D4A27'
  return (
    <div style={{
      background: 'white', borderRadius: 10, padding: '14px 16px',
      borderLeft: `4px solid ${borderColor}`, boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
      minWidth: 0,
    }}>
      <div style={{ fontSize: '0.72rem', color: '#666', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1A1A1A', margin: '4px 0', lineHeight: 1.3, overflowWrap: 'anywhere' }}>{value}</div>
      {sublabel && <div style={{ fontSize: '0.7rem', color: '#aaa' }}>{sublabel}</div>}
    </div>
  )
}
