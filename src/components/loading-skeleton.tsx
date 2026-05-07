'use client'

import { useEffect, useState } from 'react'

export function LoadingSkeleton() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null

  const barHeights = [45, 62, 38, 70, 55, 48, 65, 42, 58, 72, 44, 60, 35, 68, 50, 55, 40, 63, 47, 56]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="dashboard-kpi-grid-tight">
        {[...Array(5)].map((_, i) => (
          <div key={i} style={{
            background: 'white', borderRadius: 10, padding: '14px 16px',
            borderLeft: '4px solid #E5E7EB', boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
          }}>
            <div style={{ height: 10, width: '60%', background: '#F0F0F0', borderRadius: 4, marginBottom: 10 }} />
            <div style={{ height: 28, width: '80%', background: '#EBEBEB', borderRadius: 4, marginBottom: 8 }} />
            <div style={{ height: 8, width: '50%', background: '#F5F5F5', borderRadius: 4 }} />
          </div>
        ))}
      </div>

      <div style={{ background: 'white', borderRadius: 10, padding: 16, height: 320, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ height: 14, width: '20%', background: '#F0F0F0', borderRadius: 4 }} />
        <div style={{ flex: 1, background: '#FAFAFA', borderRadius: 8, display: 'flex', alignItems: 'flex-end', gap: 4, padding: 16 }}>
          {barHeights.map((h, i) => (
            <div key={i} style={{
              flex: 1, height: `${h}%`,
              background: '#EBEBEB', borderRadius: '3px 3px 0 0',
            }} />
          ))}
        </div>
      </div>

      <div className="dashboard-chart-grid">
        {[0, 1].map(j => (
          <div key={j} style={{ background: 'white', borderRadius: 10, padding: 16, height: 240 }}>
            <div style={{ height: 12, width: '30%', background: '#F0F0F0', borderRadius: 4, marginBottom: 16 }} />
            <div style={{ height: '80%', background: '#FAFAFA', borderRadius: 8 }} />
          </div>
        ))}
      </div>

      <div style={{ background: 'white', borderRadius: 10, padding: 16 }}>
        <div style={{ height: 12, width: '20%', background: '#F0F0F0', borderRadius: 4, marginBottom: 16 }} />
        {[...Array(5)].map((_, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'center' }}>
            <div style={{ height: 10, flex: 2, background: '#F5F5F5', borderRadius: 4 }} />
            <div style={{ height: 10, flex: 1, background: '#F5F5F5', borderRadius: 4 }} />
            <div style={{ height: 10, flex: 1, background: '#F5F5F5', borderRadius: 4 }} />
            <div style={{ height: 10, flex: 1, background: '#F5F5F5', borderRadius: 4 }} />
            <div style={{ height: 10, flex: 1, background: '#F5F5F5', borderRadius: 4 }} />
          </div>
        ))}
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>

      <div style={{ fontSize: '0.75rem', color: '#aaa', textAlign: 'center', marginTop: 4 }}>
        Loading latest dashboard data...
      </div>
    </div>
  )
}
