'use client'
import { LoadingSkeleton } from '@/components/loading-skeleton'
import { DataState } from '@/components/data-state'

import { useEffect, useState } from 'react'
import { SectionHeader } from '@/components/section-header'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { MetricCard } from '@/components/metric-card'
import { SignalGrid } from '@/components/insight-card'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface CompetitorRow {
  captured_date: string
  asin: string
  name: string
  price: number
  rating: number | null
  review_count: number | null
  bsr: number
  bsr_category: string
}

interface BsrRow {
  date: string
  asin: string
  sku_name: string
  category: string
  rank: number
}

interface ReviewRow {
  captured_date: string
  asin: string
  asin_type: string
  name: string
  rating: number | null
  review_count: number | null
  price: number | null
}

interface CompetitorSignal {
  severity: 'normal' | 'warn' | 'alert'
  title: string
  detail: string
}

interface RankGapRow {
  type: 'BioHuez' | 'Competitor'
  label: string
  asin: string
  rank: number
  price: number | null
  gap_vs_best_competitor: number
}

interface CompetitorThreatRow {
  asin: string
  name: string
  price: number | null
  rating: number | null
  review_count: number | null
  bsr: number
  bsr_category: string
}

interface PricePositionRow {
  asin: string
  name: string
  price: number
  price_gap_vs_comp_avg: number
  bsr: number
}

interface CompetitorBsrMoverRow {
  sku: string
  latest_week: string
  previous_week: string
  rank: number
  previous_rank: number
  rank_delta: number
  status: 'improved' | 'worse' | 'flat'
}

interface CompetitorInsights {
  summary: {
    latest_competitor_date?: string
    competitor_count?: number
    best_competitor_bsr?: number | null
    avg_competitor_price?: number | null
    latest_biohuez_bsr_date?: string
    best_biohuez_bsr?: number | null
    avg_biohuez_bsr?: number | null
    best_rank_gap_vs_competitor?: number | null
  }
  signals: CompetitorSignal[]
  rank_gap: RankGapRow[]
  price_positioning: PricePositionRow[]
  competitor_threats: CompetitorThreatRow[]
  biohuez_bsr_movers: CompetitorBsrMoverRow[]
  review_positioning: ReviewRow[]
}

interface CompetitorData {
  competitor: CompetitorRow[]
  bsr: BsrRow[]
  item_comparison: unknown[]
  alt_purchase: unknown[]
  competitor_reviews: ReviewRow[]
  insights?: CompetitorInsights
  error?: string
}

const BIOHUEZ_ASINS = new Set(['B0F4QYD1TX', 'B0F4QZ6VKP', 'B0F4QX99CJ', 'B0F4QYD2RJ'])
const BIOHUEZ_COLOR = '#2D4A27'
const COMPETITOR_COLORS = ['#C0392B', '#E67E22', '#2980B9', '#8B6914']

const ASIN_LABELS: Record<string, string> = {
  'B0001TQCSO': 'Naturtint 5N',
  'B09Q9D9F8S': 'Competitor 2',
  'B004INIW1Y': 'Competitor 3',
  'B00016X0AA': 'Herbatint 5N',
}

function fmtMoney(n: number | null | undefined) {
  if (n == null) return '—'
  return '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 })
}

function fmtRank(n: number | null | undefined) {
  if (n == null) return '—'
  return '#' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 })
}

export default function CompetitorPage() {
  const [data, setData] = useState<CompetitorData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/competitor')
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingSkeleton />
  if (!data || data.error) return (
    <DataState
      title="Competitor data could not load"
      description={data?.error || 'Check the scraper and Brand Analytics data connection, then refresh this page.'}
      variant="error"
    />
  )

  const { competitor, bsr, competitor_reviews = [] } = data
  const insights = data.insights || {
    summary: {},
    signals: [],
    rank_gap: [],
    price_positioning: [],
    competitor_threats: [],
    biohuez_bsr_movers: [],
    review_positioning: [],
  }
  if (competitor.length === 0 && bsr.length === 0 && competitor_reviews.length === 0) return (
    <DataState
      title="No competitor data yet"
      description="BSR, review, and competitor snapshots will appear here after the scraper or Brand Analytics exports are available."
    />
  )

  // Build latest review row per ASIN
  const latestReviewByAsin: Record<string, ReviewRow> = {}
  for (const row of competitor_reviews) {
    const existing = latestReviewByAsin[row.asin]
    if (!existing || row.captured_date > existing.captured_date) {
      latestReviewByAsin[row.asin] = row
    }
  }
  // Build review trend data grouped by date
  const reviewDateMap: Record<string, Record<string, number>> = {}
  const reviewAsinSet = new Set<string>()
  for (const row of competitor_reviews) {
    const d = row.captured_date?.slice(0, 10) || ''
    const label = ASIN_LABELS[row.asin] || (row.asin_type === 'own' ? `BioHuez ${row.asin.slice(-4)}` : row.asin)
    if (!reviewDateMap[d]) reviewDateMap[d] = {}
    if (row.review_count != null) reviewDateMap[d][label] = row.review_count
    reviewAsinSet.add(label)
  }
  const reviewChartData = Object.entries(reviewDateMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, counts]) => ({ date, ...counts }))
  const reviewLines = Array.from(reviewAsinSet)
  const latestRevDate = competitor_reviews.length > 0
    ? competitor_reviews.reduce((max, r) => r.captured_date > max ? r.captured_date : max, '')
    : null

  // BSR chart: BioHuez lines
  const bsrAsinSet = new Set<string>()
  const bsrDateMap: Record<string, Record<string, number>> = {}
  for (const row of bsr) {
    const d = row.date?.slice(0, 10) || ''
    const key = row.sku_name || row.asin
    if (!bsrDateMap[d]) bsrDateMap[d] = {}
    bsrDateMap[d][key] = row.rank
    bsrAsinSet.add(key)
  }

  // Add competitor snapshot BSR to chart (single point at captured_date)
  const compColorMap: Record<string, string> = {}
  let compColorIdx = 0
  for (const row of competitor) {
    const d = row.captured_date?.slice(0, 10) || ''
    const key = ASIN_LABELS[row.asin] || row.asin
    if (!bsrDateMap[d]) bsrDateMap[d] = {}
    bsrDateMap[d][key] = row.bsr
    bsrAsinSet.add(key)
    if (!compColorMap[key]) {
      compColorMap[key] = COMPETITOR_COLORS[compColorIdx % COMPETITOR_COLORS.length]
      compColorIdx++
    }
  }

  const bsrChartData = Object.entries(bsrDateMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, ranks]) => ({ date, ...ranks }))

  const biohuezLines = Array.from(bsrAsinSet).filter(k =>
    bsr.some(r => (r.sku_name || r.asin) === k)
  )
  const compLines = Array.from(bsrAsinSet).filter(k =>
    !biohuezLines.includes(k)
  )

  // Current BSR table
  const latestBiohuezByAsin: Record<string, BsrRow> = {}
  for (const row of bsr) {
    const existing = latestBiohuezByAsin[row.asin]
    if (!existing || row.date > existing.date) {
      latestBiohuezByAsin[row.asin] = row
    }
  }

  return (
    <div style={{ paddingBottom: 40 }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 4, color: '#1A1A1A' }}>Competitor</h1>
      <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: 20 }}>BSR comparison and Brand Analytics competitive data</p>

      <Tabs defaultValue="bsr">
        <TabsList style={{ marginBottom: 20, background: '#F0F0F0' }}>
          <TabsTrigger value="intelligence">Intelligence</TabsTrigger>
          <TabsTrigger value="bsr">BSR Comparison</TabsTrigger>
          <TabsTrigger value="reviews">Ratings &amp; Reviews</TabsTrigger>
          <TabsTrigger value="item">Item Comparison</TabsTrigger>
          <TabsTrigger value="alt">Alternate Purchase</TabsTrigger>
        </TabsList>

        <TabsContent value="intelligence">
          <div className="dashboard-kpi-grid">
            <MetricCard
              label="Best BioHuez BSR"
              value={fmtRank(insights.summary.best_biohuez_bsr)}
              sublabel={insights.summary.latest_biohuez_bsr_date || 'Latest'}
              status={(insights.summary.best_rank_gap_vs_competitor ?? 0) > 100 ? 'alert' : (insights.summary.best_rank_gap_vs_competitor ?? 0) > 25 ? 'warn' : 'normal'}
            />
            <MetricCard
              label="Best Competitor BSR"
              value={fmtRank(insights.summary.best_competitor_bsr)}
              sublabel={`${insights.summary.competitor_count ?? 0} competitors`}
            />
            <MetricCard
              label="Rank Gap"
              value={insights.summary.best_rank_gap_vs_competitor == null ? '—' : String(Math.round(insights.summary.best_rank_gap_vs_competitor))}
              sublabel="BioHuez best vs competitor best"
              status={(insights.summary.best_rank_gap_vs_competitor ?? 0) > 100 ? 'alert' : (insights.summary.best_rank_gap_vs_competitor ?? 0) > 25 ? 'warn' : 'normal'}
            />
            <MetricCard
              label="Avg Comp Price"
              value={fmtMoney(insights.summary.avg_competitor_price)}
              sublabel={insights.summary.latest_competitor_date || 'Latest scrape'}
            />
          </div>

          <SignalGrid signals={insights.signals} />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16, marginBottom: 20 }}>
            <div>
              <SectionHeader title="Rank Gap Table" subtitle="Current BioHuez and competitor rank positioning" />
              <div style={{ background: 'white', borderRadius: 10, padding: 16, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #EBEBEB' }}>
                      {['Type', 'Label', 'Rank', 'Gap', 'Price'].map(h => (
                        <th key={h} style={{ padding: '8px 8px', textAlign: h === 'Rank' || h === 'Gap' || h === 'Price' ? 'right' : 'left', color: '#666', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {insights.rank_gap.slice(0, 12).map((row, index) => {
                      const isOwn = row.type === 'BioHuez'
                      return (
                        <tr key={`${row.type}-${row.asin}-${index}`} style={{ borderBottom: '1px solid #F5F5F5' }}>
                          <td style={{ padding: '8px 8px', color: isOwn ? BIOHUEZ_COLOR : '#C0392B', fontWeight: 800 }}>{row.type}</td>
                          <td style={{ padding: '8px 8px', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ASIN_LABELS[row.asin] || row.label}</td>
                          <td style={{ padding: '8px 8px', textAlign: 'right', fontWeight: 800 }}>{fmtRank(row.rank)}</td>
                          <td style={{ padding: '8px 8px', textAlign: 'right', color: row.gap_vs_best_competitor > 100 ? '#C0392B' : '#666' }}>{Math.round(row.gap_vs_best_competitor)}</td>
                          <td style={{ padding: '8px 8px', textAlign: 'right' }}>{fmtMoney(row.price)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <SectionHeader title="BioHuez BSR Movement" subtitle="Weekly movement; lower rank is better" />
              <div style={{ background: 'white', borderRadius: 10, padding: 16, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #EBEBEB' }}>
                      {['SKU', 'Rank', 'Δ Rank', 'Status'].map(h => (
                        <th key={h} style={{ padding: '8px 8px', textAlign: h === 'SKU' || h === 'Status' ? 'left' : 'right', color: '#666', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {insights.biohuez_bsr_movers.map(row => {
                      const improved = row.rank_delta < 0
                      const color = improved ? '#2D4A27' : row.rank_delta > 0 ? '#C0392B' : '#888'
                      return (
                        <tr key={row.sku} style={{ borderBottom: '1px solid #F5F5F5' }}>
                          <td style={{ padding: '8px 8px', fontWeight: 800 }}>{row.sku}</td>
                          <td style={{ padding: '8px 8px', textAlign: 'right' }}>{fmtRank(row.rank)}</td>
                          <td style={{ padding: '8px 8px', textAlign: 'right', color, fontWeight: 800 }}>{row.rank_delta > 0 ? '+' : ''}{row.rank_delta}</td>
                          <td style={{ padding: '8px 8px', color, fontWeight: 800 }}>{row.status}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <SectionHeader title="Top Competitor Threats" subtitle="Best current competitor BSR snapshots" />
          <div style={{ background: 'white', borderRadius: 10, padding: 16, overflowX: 'auto', marginBottom: 20 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #EBEBEB' }}>
                  {['ASIN', 'Price', 'BSR', 'Rating', 'Reviews', 'Product'].map(h => (
                    <th key={h} style={{ padding: '8px 8px', textAlign: ['Price', 'BSR', 'Rating', 'Reviews'].includes(h) ? 'right' : 'left', color: '#666', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {insights.competitor_threats.slice(0, 8).map(row => (
                  <tr key={row.asin} style={{ borderBottom: '1px solid #F5F5F5' }}>
                    <td style={{ padding: '8px 8px', fontFamily: 'monospace', fontSize: '0.72rem', fontWeight: 700 }}>{ASIN_LABELS[row.asin] || row.asin}</td>
                    <td style={{ padding: '8px 8px', textAlign: 'right' }}>{fmtMoney(row.price)}</td>
                    <td style={{ padding: '8px 8px', textAlign: 'right', fontWeight: 800 }}>{fmtRank(row.bsr)}</td>
                    <td style={{ padding: '8px 8px', textAlign: 'right' }}>{row.rating ?? '—'}</td>
                    <td style={{ padding: '8px 8px', textAlign: 'right' }}>{row.review_count?.toLocaleString() ?? '—'}</td>
                    <td style={{ padding: '8px 8px', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.name}>{row.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <SectionHeader title="Price Positioning" subtitle="Competitor price band and BSR position" />
          <div style={{ background: 'white', borderRadius: 10, padding: 16, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #EBEBEB' }}>
                  {['ASIN', 'Price', 'Vs Avg', 'BSR', 'Product'].map(h => (
                    <th key={h} style={{ padding: '8px 8px', textAlign: ['Price', 'Vs Avg', 'BSR'].includes(h) ? 'right' : 'left', color: '#666', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {insights.price_positioning.slice(0, 10).map(row => (
                  <tr key={row.asin} style={{ borderBottom: '1px solid #F5F5F5' }}>
                    <td style={{ padding: '8px 8px', fontFamily: 'monospace', fontSize: '0.72rem', fontWeight: 700 }}>{ASIN_LABELS[row.asin] || row.asin}</td>
                    <td style={{ padding: '8px 8px', textAlign: 'right' }}>{fmtMoney(row.price)}</td>
                    <td style={{ padding: '8px 8px', textAlign: 'right', color: row.price_gap_vs_comp_avg > 0 ? '#2D4A27' : '#C0392B', fontWeight: 700 }}>
                      {row.price_gap_vs_comp_avg > 0 ? '+' : ''}{fmtMoney(row.price_gap_vs_comp_avg)}
                    </td>
                    <td style={{ padding: '8px 8px', textAlign: 'right' }}>{fmtRank(row.bsr)}</td>
                    <td style={{ padding: '8px 8px', maxWidth: 340, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.name}>{row.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="bsr">
          {/* Competitor snapshot cards */}
          {competitor.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 20 }}>
              {competitor.map((row, index) => (
                <div key={`${row.asin}-${row.captured_date}-${row.bsr_category}-${index}`} style={{ background: 'white', borderRadius: 10, padding: 14, borderLeft: '4px solid #C0392B', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
                  <div style={{ fontSize: '0.72rem', color: '#666', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                    {ASIN_LABELS[row.asin] || row.asin}
                  </div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#1A1A1A' }}>BSR #{row.bsr}</div>
                  <div style={{ fontSize: '0.75rem', color: '#888', marginTop: 2 }}>{row.bsr_category} · {fmtMoney(row.price)}</div>
                  <div style={{ fontSize: '0.7rem', color: '#aaa', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.name}</div>
                </div>
              ))}
            </div>
          )}

          {/* BSR chart */}
          <SectionHeader title="BSR Rank Over Time" subtitle="Lower = better. BioHuez SKUs + competitor snapshots" />
          <div style={{ background: 'white', borderRadius: 10, padding: 16, marginBottom: 16 }}>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={bsrChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EBEBEB" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={v => v?.slice(5)} />
                <YAxis reversed tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                {biohuezLines.map((key, i) => (
                  <Line key={key} type="monotone" dataKey={key} stroke={[BIOHUEZ_COLOR, '#6B8F61', '#B8D4AE', '#C0392B'][i % 4]} strokeWidth={2} dot={false} name={key} connectNulls />
                ))}
                {compLines.map((key) => (
                  <Line key={key} type="monotone" dataKey={key} stroke={compColorMap[key] || '#ccc'} strokeWidth={1.5} strokeDasharray="4 4" dot name={key} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Current BSR table */}
          <SectionHeader title="Current BSR — BioHuez" />
          <div style={{ background: 'white', borderRadius: 10, padding: 16, marginBottom: 16 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #EBEBEB' }}>
                  {['SKU', 'ASIN', 'Category', 'Rank'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: h === 'Rank' ? 'right' : 'left', color: '#666', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.values(latestBiohuezByAsin).sort((a, b) => a.rank - b.rank).map(row => (
                  <tr key={row.asin} style={{ borderBottom: '1px solid #F5F5F5' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600 }}>{row.sku_name}</td>
                    <td style={{ padding: '8px 12px', color: '#888', fontFamily: 'monospace', fontSize: '0.75rem' }}>{row.asin}</td>
                    <td style={{ padding: '8px 12px' }}>{row.category}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: BIOHUEZ_COLOR }}>#{row.rank}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Competitor BSR table */}
          {competitor.length > 0 && (
            <>
              <SectionHeader title="Competitor BSR Snapshot" />
              <div style={{ background: 'white', borderRadius: 10, padding: 16 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #EBEBEB' }}>
                      {['Brand/ASIN', 'Price', 'BSR', 'Category', 'Date'].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: h === 'BSR' || h === 'Price' ? 'right' : 'left', color: '#666', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...competitor].sort((a, b) => a.bsr - b.bsr).map((row, index) => (
                      <tr key={`${row.asin}-${row.captured_date}-${row.bsr_category}-${index}`} style={{ borderBottom: '1px solid #F5F5F5' }}>
                        <td style={{ padding: '8px 12px', color: '#888', fontSize: '0.75rem' }}>{ASIN_LABELS[row.asin] || row.asin}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right' }}>{fmtMoney(row.price)}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700 }}>#{row.bsr}</td>
                        <td style={{ padding: '8px 12px' }}>{row.bsr_category}</td>
                        <td style={{ padding: '8px 12px', color: '#888', fontSize: '0.75rem' }}>{row.captured_date?.slice(0, 10)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="reviews">
          {competitor_reviews.length === 0 ? (
            <DataState
              title="No scraped review data yet"
              description="Ratings and review trends will appear after the next scraper run."
              variant="info"
            />
          ) : (
            <>
              {latestRevDate && (
                <p style={{ color: '#888', fontSize: '0.78rem', marginBottom: 12 }}>
                  Latest scrape: {latestRevDate.slice(0, 10)}
                </p>
              )}

              {/* Latest snapshot cards */}
              <SectionHeader title="Current Ratings &amp; Reviews" />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 20 }}>
                {Object.values(latestReviewByAsin).map(row => {
                  const isOwn = row.asin_type === 'own'
                  const label = ASIN_LABELS[row.asin] || (isOwn ? `BioHuez ${row.asin.slice(-4)}` : row.asin)
                  return (
                    <div key={row.asin} style={{
                      background: 'white', borderRadius: 10, padding: 14,
                      borderLeft: `4px solid ${isOwn ? BIOHUEZ_COLOR : '#C0392B'}`,
                      boxShadow: '0 1px 4px rgba(0,0,0,0.07)'
                    }}>
                      <div style={{ fontSize: '0.72rem', color: '#666', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                        {label}
                      </div>
                      <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#1A1A1A' }}>
                        {row.rating != null ? `${row.rating.toFixed(1)}★` : '—'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#888', marginTop: 2 }}>
                        {row.review_count != null ? `${row.review_count.toLocaleString()} reviews` : '—'}
                        {row.price != null ? ` · ${fmtMoney(row.price)}` : ''}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#aaa', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.name}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Review count trend chart */}
              <SectionHeader title="Review Count Over Time" />
              <div style={{ background: 'white', borderRadius: 10, padding: 16, marginBottom: 16 }}>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={reviewChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EBEBEB" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={v => v?.slice(5)} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    {reviewLines.map((key, i) => {
                      const isOwn = Object.values(latestReviewByAsin).find(r =>
                        (ASIN_LABELS[r.asin] || `BioHuez ${r.asin.slice(-4)}`) === key
                      )?.asin_type === 'own'
                      const colors = [BIOHUEZ_COLOR, '#6B8F61', '#C0392B', '#E67E22', '#2980B9', '#8B6914']
                      return (
                        <Line
                          key={key}
                          type="monotone"
                          dataKey={key}
                          stroke={isOwn ? BIOHUEZ_COLOR : colors[(i + 2) % colors.length]}
                          strokeWidth={isOwn ? 2.5 : 1.5}
                          strokeDasharray={isOwn ? undefined : '4 4'}
                          dot={false}
                          connectNulls
                        />
                      )
                    })}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="item">
          {data.item_comparison.length === 0 ? (
            <DataState
              title="Item comparison data is not available yet"
              description="This section will show which competitor ASINs customers viewed before purchasing BioHuez."
              variant="info"
            />
          ) : (
            <div style={{ background: 'white', borderRadius: 10, padding: 16, color: '#2D4A27' }}>
              {JSON.stringify(data.item_comparison.slice(0, 5))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="alt">
          {data.alt_purchase.length === 0 ? (
            <DataState
              title="Alternate purchase data is not available yet"
              description="This section will show products customers bought instead of BioHuez."
              variant="info"
            />
          ) : (
            <div style={{ background: 'white', borderRadius: 10, padding: 16, color: '#2D4A27' }}>
              {JSON.stringify(data.alt_purchase.slice(0, 5))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
