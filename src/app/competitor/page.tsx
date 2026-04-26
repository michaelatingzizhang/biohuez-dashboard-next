'use client'
import { LoadingSkeleton } from '@/components/loading-skeleton'

import { useEffect, useState } from 'react'
import { SectionHeader } from '@/components/section-header'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
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

interface CompetitorData {
  competitor: CompetitorRow[]
  bsr: BsrRow[]
  item_comparison: unknown[]
  alt_purchase: unknown[]
  competitor_reviews: ReviewRow[]
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
  if (!data || data.error) return <div style={{ padding: 40, color: '#C0392B' }}>Error: {data?.error}</div>

  const { competitor, bsr, competitor_reviews = [] } = data

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
          <TabsTrigger value="bsr">BSR Comparison</TabsTrigger>
          <TabsTrigger value="reviews">Ratings &amp; Reviews</TabsTrigger>
          <TabsTrigger value="item">Item Comparison</TabsTrigger>
          <TabsTrigger value="alt">Alternate Purchase</TabsTrigger>
        </TabsList>

        <TabsContent value="bsr">
          {/* Competitor snapshot cards */}
          {competitor.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 20 }}>
              {competitor.map(row => (
                <div key={row.asin} style={{ background: 'white', borderRadius: 10, padding: 14, borderLeft: '4px solid #C0392B', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
                  <div style={{ fontSize: '0.72rem', color: '#666', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                    {ASIN_LABELS[row.asin] || row.asin}
                  </div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#1A1A1A' }}>BSR #{row.bsr}</div>
                  <div style={{ fontSize: '0.75rem', color: '#888', marginTop: 2 }}>{row.bsr_category} · ${row.price?.toFixed(2)}</div>
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
                    {competitor.sort((a, b) => a.bsr - b.bsr).map((row) => (
                      <tr key={row.asin} style={{ borderBottom: '1px solid #F5F5F5' }}>
                        <td style={{ padding: '8px 12px', color: '#888', fontSize: '0.75rem' }}>{ASIN_LABELS[row.asin] || row.asin}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right' }}>${row.price?.toFixed(2)}</td>
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
            <div style={{ background: '#F0F4EE', border: '1px solid #B8D4AE', borderRadius: 8, padding: 20, color: '#2D4A27' }}>
              No scraped review data yet. The scraper runs daily at 8:30 AM.
            </div>
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
                        {row.price != null ? ` · $${row.price.toFixed(2)}` : ''}
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
          <div style={{ background: '#F0F4EE', border: '1px solid #B8D4AE', borderRadius: 8, padding: 20, color: '#2D4A27' }}>
            {data.item_comparison.length === 0
              ? 'Brand Analytics item comparison data not yet available. This data shows which competitor ASINs customers viewed before purchasing BioHuez.'
              : JSON.stringify(data.item_comparison.slice(0, 5))}
          </div>
        </TabsContent>

        <TabsContent value="alt">
          <div style={{ background: '#F0F4EE', border: '1px solid #B8D4AE', borderRadius: 8, padding: 20, color: '#2D4A27' }}>
            {data.alt_purchase.length === 0
              ? 'Brand Analytics alternate purchase data not yet available. This data shows products customers bought instead of BioHuez.'
              : JSON.stringify(data.alt_purchase.slice(0, 5))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
