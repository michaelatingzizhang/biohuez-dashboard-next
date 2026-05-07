export function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, borderTop: '1px solid rgba(34, 44, 38, 0.1)', paddingTop: 18, marginTop: 10, marginBottom: 12 }}>
      <div>
        <div style={{ fontSize: '1rem', fontWeight: 820, color: '#111A14', letterSpacing: '-0.01em' }}>{title}</div>
        {subtitle && <div style={{ fontSize: '0.8rem', color: '#6F7A70', marginTop: 3, lineHeight: 1.4 }}>{subtitle}</div>}
      </div>
    </div>
  )
}
