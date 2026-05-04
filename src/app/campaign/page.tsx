'use client'
import { LoadingSkeleton } from '@/components/loading-skeleton'
import { DataState } from '@/components/data-state'

import { useEffect, useState } from 'react'
import { MetricCard } from '@/components/metric-card'
import { SectionHeader } from '@/components/section-header'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface AdsRow {
  date: string
  campaign_id: number
  campaign_name: string
  impressions: number
  clicks: number
  spend: number
  sales_1d: number
  purchases_1d: number
}

interface SearchTermRow {
  search_query: string
  tier: string
  impression_total: number
  click_total: number
  click_rate: number
  purchase_total: number
  purchase_share: number
  period_start: string
}

interface CampaignData {
  ads: AdsRow[]
  search_terms: SearchTermRow[]
  ads_by_type: unknown[]
  error?: string
}

function latestPeriod(rows: SearchTermRow[]) {
  return rows.reduce((latest, row) => {
    if (!row.period_start) return latest
    return row.period_start > latest ? row.period_start : latest
  }, '')
}

function fmtMoney(n: number | null | undefined) {
  if (n == null) return '—'
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtPct(n: number | null | undefined) {
  if (n == null) return '—'
  return Number(n).toFixed(1) + '%'
}

const TIER_COLORS: Record<string, string> = {
  Competitor: '#C0392B',
  Niche: '#2D4A27',
  Specific: '#2980B9',
  Broad: '#888',
}

function acosStatus(acos: number): 'normal' | 'warn' | 'alert' {
  if (acos < 25) return 'normal'
  if (acos <= 40) return 'warn'
  return 'alert'
}

function acosColor(acos: number) {
  if (acos < 25) return '#2D4A27'
  if (acos <= 40) return '#E67E22'
  return '#C0392B'
}

export default function CampaignPage() {
  const [data, setData] = useState<CampaignData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/campaign')
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingSkeleton />
  if (!data || data.error) return (
    <DataState
      title="Campaign data could not load"
      description={data?.error || 'Check the data bridge connection and try refreshing this page.'}
      variant="error"
    />
  )

  const { ads, search_terms } = data
  if (ads.length === 0 && search_terms.length === 0) return (
    <DataState
      title="No campaign data yet"
      description="Advertising and search term data will appear here after the campaign exports are available."
    />
  )

  // Campaign aggregation
  const campaignMap: Record<string, { spend: number; sales: number; orders: number; impressions: number; clicks: number }> = {}
  for (const row of ads) {
    const k = row.campaign_name || 'Unknown'
    if (!campaignMap[k]) campaignMap[k] = { spend: 0, sales: 0, orders: 0, impressions: 0, clicks: 0 }
    campaignMap[k].spend += row.spend || 0
    campaignMap[k].sales += row.sales_1d || 0
    campaignMap[k].orders += row.purchases_1d || 0
    campaignMap[k].impressions += row.impressions || 0
    campaignMap[k].clicks += row.clicks || 0
  }
  const campaigns = Object.entries(campaignMap).map(([name, v]) => ({
    name,
    ...v,
    acos: v.sales > 0 ? v.spend / v.sales * 100 : 0,
    roas: v.spend > 0 ? v.sales / v.spend : 0,
    ctr: v.impressions > 0 ? v.clicks / v.impressions * 100 : 0,
  })).sort((a, b) => b.spend - a.spend)

  const totalSpend = campaigns.reduce((s, r) => s + r.spend, 0)
  const totalAdSales = campaigns.reduce((s, r) => s + r.sales, 0)
  const totalImpressions = campaigns.reduce((s, r) => s + r.impressions, 0)
  const overallAcos = totalAdSales > 0 ? totalSpend / totalAdSales * 100 : 0
  const overallRoas = totalSpend > 0 ? totalAdSales / totalSpend : 0

  // Daily chart
  const dailyMap: Record<string, { spend: number; sales: number }> = {}
  for (const row of ads) {
    const d = row.date?.slice(0, 10) || ''
    if (!dailyMap[d]) dailyMap[d] = { spend: 0, sales: 0 }
    dailyMap[d].spend += row.spend || 0
    dailyMap[d].sales += row.sales_1d || 0
  }
  const dailyChart = Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }))

  const currentSearchPeriod = latestPeriod(search_terms)
  const currentSearchTerms = currentSearchPeriod
    ? search_terms.filter(row => row.period_start === currentSearchPeriod)
    : search_terms

  // Search terms — aggregate by query for the latest reporting period.
  const stMap: Record<string, { impressions: number; clicks: number; purchases: number; tier: string; period: string }> = {}
  for (const row of currentSearchTerms) {
    const k = row.search_query
    if (!stMap[k]) stMap[k] = { impressions: 0, clicks: 0, purchases: 0, tier: row.tier || 'Broad', period: row.period_start }
    stMap[k].impressions += Number(row.impression_total) || 0
    stMap[k].clicks += Number(row.click_total) || 0
    stMap[k].purchases += Number(row.purchase_total) || 0
    if (row.period_start > stMap[k].period) stMap[k].period = row.period_start
  }
  const terms = Object.entries(stMap).map(([query, v]) => ({
    query,
    ...v,
    ctr: v.impressions > 0 ? v.clicks / v.impressions * 100 : 0,
  })).sort((a, b) => b.impressions - a.impressions).slice(0, 100)

  // Tier breakdown
  const tierMap: Record<string, { impressions: number; clicks: number; queries: number }> = {}
  for (const t of terms) {
    const tier = t.tier || 'Broad'
    if (!tierMap[tier]) tierMap[tier] = { impressions: 0, clicks: 0, queries: 0 }
    tierMap[tier].impressions += t.impressions
    tierMap[tier].clicks += t.clicks
    tierMap[tier].queries += 1
  }

  return (
    <div style={{ paddingBottom: 40 }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 4, color: '#1A1A1A' }}>Campaigns</h1>
      <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: 20 }}>Advertising performance and search term analysis</p>

      <Tabs defaultValue="overview">
        <div className="dashboard-tabs-scroll">
          <TabsList style={{ marginBottom: 20, background: '#F0F0F0' }}>
            <TabsTrigger value="overview">Campaign Overview</TabsTrigger>
            <TabsTrigger value="terms">Search Terms</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview">
          <div className="dashboard-kpi-grid">
            <MetricCard label="Total Spend" value={fmtMoney(totalSpend)} />
            <MetricCard label="Ad Sales" value={fmtMoney(totalAdSales)} />
            <MetricCard label="ACOS" value={fmtPct(overallAcos)} status={acosStatus(overallAcos)} />
            <MetricCard label="ROAS" value={overallRoas.toFixed(2) + 'x'} />
            <MetricCard label="Total Impressions" value={totalImpressions.toLocaleString()} />
            <MetricCard label="Campaigns" value={String(campaigns.length)} />
          </div>

          {/* Daily spend + sales chart */}
          <SectionHeader title="Daily Spend vs Sales" />
          <div className="dashboard-chart-card" style={{ background: 'white', borderRadius: 10, padding: 16, marginBottom: 16 }}>
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={dailyChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EBEBEB" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={v => v?.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => '$' + v} />
                <Tooltip formatter={(value: unknown) => '$' + Number(value).toFixed(2)} />
                <Legend />
                <Bar dataKey="sales" fill="#B8D4AE" name="Ad Sales" />
                <Line type="monotone" dataKey="spend" stroke="#E67E22" strokeWidth={2} dot={false} name="Spend" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Campaign table */}
          <SectionHeader title="Campaign Performance" subtitle="Sorted by spend" />
          <div className="dashboard-table-card">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #EBEBEB' }}>
                  {['Campaign', 'Spend', 'Sales', 'Orders', 'ACOS', 'ROAS', 'Impr', 'Clicks', 'CTR'].map(h => (
                    <th key={h} style={{ padding: '8px 8px', textAlign: h === 'Campaign' ? 'left' : 'right', color: '#666', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {campaigns.map((row) => (
                  <tr key={row.name} style={{ borderBottom: '1px solid #F5F5F5' }}>
                    <td style={{ padding: '8px 8px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.name}>{row.name}</td>
                    <td style={{ padding: '8px 8px', textAlign: 'right' }}>{fmtMoney(row.spend)}</td>
                    <td style={{ padding: '8px 8px', textAlign: 'right' }}>{fmtMoney(row.sales)}</td>
                    <td style={{ padding: '8px 8px', textAlign: 'right' }}>{row.orders}</td>
                    <td style={{ padding: '8px 8px', textAlign: 'right' }}>
                      <span style={{ color: acosColor(row.acos), fontWeight: 600 }}>{fmtPct(row.acos)}</span>
                    </td>
                    <td style={{ padding: '8px 8px', textAlign: 'right' }}>{row.roas.toFixed(2)}x</td>
                    <td style={{ padding: '8px 8px', textAlign: 'right' }}>{row.impressions.toLocaleString()}</td>
                    <td style={{ padding: '8px 8px', textAlign: 'right' }}>{row.clicks.toLocaleString()}</td>
                    <td style={{ padding: '8px 8px', textAlign: 'right' }}>{fmtPct(row.ctr)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="terms">
          {/* Tier KPIs */}
          <div className="dashboard-kpi-grid">
            {['Competitor', 'Niche', 'Specific', 'Broad'].map(tier => {
              const t = tierMap[tier] || { impressions: 0, clicks: 0, queries: 0 }
              return (
                <MetricCard
                  key={tier}
                  label={tier}
                  value={String(t.queries) + ' terms'}
                  sublabel={`${t.impressions.toLocaleString()} impr · ${t.clicks.toLocaleString()} clicks`}
                />
              )
            })}
          </div>

          <SectionHeader
            title="Search Terms"
            subtitle={currentSearchPeriod ? `Top ${terms.length} by impressions for week of ${currentSearchPeriod}` : `Top ${terms.length} by impressions`}
          />
          <div className="dashboard-table-card">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #EBEBEB' }}>
                  {['Search Term', 'Tier', 'Impressions', 'Clicks', 'CTR%', 'Purchases'].map(h => (
                    <th key={h} style={{ padding: '8px 8px', textAlign: h === 'Search Term' || h === 'Tier' ? 'left' : 'right', color: '#666', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {terms.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #F5F5F5' }}>
                    <td style={{ padding: '8px 8px', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.query}>{row.query}</td>
                    <td style={{ padding: '8px 8px' }}>
                      <Badge
                        style={{
                          background: TIER_COLORS[row.tier] + '22',
                          color: TIER_COLORS[row.tier],
                          border: '1px solid ' + TIER_COLORS[row.tier] + '44',
                          fontWeight: 600,
                        }}
                      >
                        {row.tier}
                      </Badge>
                    </td>
                    <td style={{ padding: '8px 8px', textAlign: 'right' }}>{row.impressions.toLocaleString()}</td>
                    <td style={{ padding: '8px 8px', textAlign: 'right' }}>{row.clicks.toLocaleString()}</td>
                    <td style={{ padding: '8px 8px', textAlign: 'right' }}>{fmtPct(row.ctr)}</td>
                    <td style={{ padding: '8px 8px', textAlign: 'right' }}>{row.purchases}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
