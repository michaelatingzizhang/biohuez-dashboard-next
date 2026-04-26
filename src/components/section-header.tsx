export function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ borderTop: '1px solid #EBEBEB', paddingTop: 16, marginTop: 8, marginBottom: 12 }}>
      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1A1A1A' }}>{title}</div>
      {subtitle && <div style={{ fontSize: '0.8rem', color: '#888', marginTop: 2 }}>{subtitle}</div>}
    </div>
  )
}
