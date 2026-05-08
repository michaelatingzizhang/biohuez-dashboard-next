'use client'
import { LoadingSkeleton } from '@/components/loading-skeleton'
import { DataState } from '@/components/data-state'

import { useEffect, useState } from 'react'
import { MetricCard } from '@/components/metric-card'
import { SectionHeader } from '@/components/section-header'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { filterByDashboardState, useDashboardFilters } from '@/components/dashboard-filters'
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

interface CampaignActionRow {
  campaign_name: string
  action: 'scale' | 'reduce' | 'monitor'
  reason: string
  spend: number
  sales: number
  purchases: number
  roas: number
  acos: number | null
  ctr: number
  cvr: number
}

interface TierPerformanceRow {
  tier: string
  queries: number
  impressions: number
  clicks: number
  purchases: number
  ctr: number
  conversion_rate: number
}

interface WinningTermRow {
  search_query: string
  tier: string
  impressions: number
  clicks: number
  purchases: number
  cart_adds: number
  purchase_share: number
  ctr: number
  conversion_rate: number
}

interface ClusterOpportunityRow {
  shade_cluster?: string
  keyword_cluster?: string
  tier?: string
  queries: number
  impressions: number
  clicks: number
  purchases: number
  cart_adds: number
  ctr: number
  conversion_rate: number
}

interface WarRoomMetrics {
  total_spend?: number
  total_sales?: number
  total_orders?: number
  overall_proas?: number | null
  growth_search_volume?: number
  money_pit_spend?: number
  imp_to_click_us?: number
  imp_to_click_market?: number
  click_to_cart_us?: number
  click_to_cart_market?: number
  cart_to_buy_us?: number
  cart_to_buy_market?: number
}

interface StreamlitClusterScenarioRow {
  cluster: string
  tier: string
  scenario: 'A' | 'B' | 'C' | 'D' | 'Monitor'
  bucket: string
  spend: number
  sales: number
  orders: number
  search_volume: number
  purchase_share: number
  proas: number | null
  ad_cvr: number
}

interface StreamlitScenarioGroupRow {
  scenario: 'A' | 'B' | 'C' | 'D' | 'Monitor'
  clusters: number
  spend: number
  sales: number
  orders: number
  search_volume: number
  avg_purchase_share: number
  avg_ad_cvr: number
}

interface StreamlitTierSummaryRow {
  tier: string
  clusters: number
  spend: number
  sales: number
  orders: number
  search_volume: number
  purchase_share: number
  ad_clicks: number
  proas: number | null
  ad_cvr: number
}

interface StreamlitFunnelTierRow {
  tier: string
  clusters: number
  imp_to_click_market: number
  imp_to_click_us: number
  click_to_cart_market: number
  click_to_cart_us: number
  cart_to_buy_market: number
  cart_to_buy_us: number
  image_price_leaks: number
  cart_leaks: number
  content_leaks: number
}

interface StreamlitPriceBenchmarkRow {
  cluster: string
  search_volume: number
  purchase_share: number
  mkt_price: number
  our_price: number
  price_delta: number
}

interface StreamlitParity {
  war_room: WarRoomMetrics
  cluster_scenarios: StreamlitClusterScenarioRow[]
  scenario_groups: StreamlitScenarioGroupRow[]
  tier_summary: StreamlitTierSummaryRow[]
  funnel_tiers: StreamlitFunnelTierRow[]
  price_benchmark: StreamlitPriceBenchmarkRow[]
}

interface CampaignInsights {
  summary: {
    campaign_count?: number
    total_spend?: number
    total_sales?: number
    overall_roas?: number
    overall_acos?: number | null
    latest_search_period?: string | null
    search_terms_in_period?: number
  }
  campaign_actions: CampaignActionRow[]
  tier_performance: TierPerformanceRow[]
  winning_terms: WinningTermRow[]
  wasted_terms: WinningTermRow[]
  cluster_opportunities: ClusterOpportunityRow[]
  streamlit_parity: StreamlitParity
}

interface CampaignData {
  ads: AdsRow[]
  search_terms: SearchTermRow[]
  ads_by_type: unknown[]
  insights?: CampaignInsights
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
  return '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 })
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

function tierColor(tier: string | undefined) {
  return tier ? TIER_COLORS[tier] || '#666' : '#666'
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

function actionMeta(action: CampaignActionRow['action']) {
  if (action === 'scale') return { label: 'Scale', color: '#2D4A27', bg: '#EEF6EC' }
  if (action === 'reduce') return { label: 'Reduce', color: '#C0392B', bg: '#FDECEA' }
  return { label: 'Monitor', color: '#8B6914', bg: '#FFF8E1' }
}

function scenarioMeta(scenario: StreamlitClusterScenarioRow['scenario']) {
  if (scenario === 'A') return { label: 'Scale Budget', color: '#2D4A27', bg: '#EEF6EC' }
  if (scenario === 'B') return { label: 'Reduce Bids', color: '#8B6914', bg: '#FFF8E1' }
  if (scenario === 'C') return { label: 'Defend & Expand', color: '#2980B9', bg: '#EAF3FB' }
  if (scenario === 'D') return { label: 'Review/Pause', color: '#C0392B', bg: '#FDECEA' }
  return { label: 'Monitor', color: '#666', bg: '#F4F4F4' }
}

function fmtInt(n: number | null | undefined) {
  if (n == null) return '—'
  return Number(n).toLocaleString()
}

export default function CampaignPage() {
  const [data, setData] = useState<CampaignData | null>(null)
  const [loading, setLoading] = useState(true)
  const filters = useDashboardFilters()

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

  const ads = filterByDashboardState(data.ads || [], filters, row => row.date)
  const search_terms = filterByDashboardState(data.search_terms || [], filters, row => row.period_start)
  if (ads.length === 0 && search_terms.length === 0) return (
    <DataState
      title="No campaign data yet"
      description="Advertising and search term data will appear here after the campaign exports are available."
    />
  )

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
  const insights = data.insights || {
    summary: {},
    campaign_actions: [],
    tier_performance: [],
    winning_terms: [],
    wasted_terms: [],
    cluster_opportunities: [],
    streamlit_parity: {
      war_room: {},
      cluster_scenarios: [],
      scenario_groups: [],
      tier_summary: [],
      funnel_tiers: [],
      price_benchmark: [],
    },
  }
  const parity = insights.streamlit_parity || {
    war_room: {},
    cluster_scenarios: [],
    scenario_groups: [],
    tier_summary: [],
    funnel_tiers: [],
    price_benchmark: [],
  }

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
            <TabsTrigger value="signals">Optimization Signals</TabsTrigger>
            <TabsTrigger value="streamlit">Streamlit Parity</TabsTrigger>
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

          <SectionHeader title="Daily Spend vs Sales" />
          <div className="dashboard-chart-card" style={{ background: 'white', borderRadius: 10, padding: 16, marginBottom: 16 }}>
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={dailyChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EBEBEB" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={v => v?.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => '$' + v} />
                <Tooltip formatter={(value: unknown) => fmtMoney(Number(value))} />
                <Legend />
                <Bar dataKey="sales" fill="#B8D4AE" name="Ad Sales" />
                <Line type="monotone" dataKey="spend" stroke="#E67E22" strokeWidth={2} dot={false} name="Spend" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

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
                          background: tierColor(row.tier) + '22',
                          color: tierColor(row.tier),
                          border: '1px solid ' + tierColor(row.tier) + '44',
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

        <TabsContent value="signals">
          <div className="dashboard-kpi-grid">
            <MetricCard
              label="Overall ROAS"
              value={(insights.summary.overall_roas ?? overallRoas).toFixed(2) + 'x'}
              sublabel="Campaign efficiency"
              status={(insights.summary.overall_roas ?? overallRoas) < 2 ? 'warn' : 'normal'}
            />
            <MetricCard
              label="Overall ACOS"
              value={fmtPct(insights.summary.overall_acos ?? overallAcos)}
              sublabel="Spend / ad sales"
              status={acosStatus(insights.summary.overall_acos ?? overallAcos)}
            />
            <MetricCard
              label="Latest Search Period"
              value={insights.summary.latest_search_period?.slice(0, 10) || '—'}
              sublabel={`${fmtInt(insights.summary.search_terms_in_period)} terms analyzed`}
            />
            <MetricCard
              label="Action Candidates"
              value={String(insights.campaign_actions.length)}
              sublabel="Scale, reduce, or monitor"
            />
          </div>

          <SectionHeader title="Campaign Action Candidates" subtitle="Heuristic recommendations from ROAS, ACOS, spend, and conversions" />
          {insights.campaign_actions.length === 0 ? (
            <DataState title="No campaign action candidates yet" description="More campaign performance history is needed before recommendations can be generated." variant="info" />
          ) : (
            <div className="dashboard-table-card" style={{ marginBottom: 20 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #EBEBEB' }}>
                    {['Action', 'Campaign', 'Spend', 'Sales', 'ROAS', 'ACOS', 'CVR', 'Reason'].map(h => (
                      <th key={h} style={{ padding: '8px 8px', textAlign: ['Spend', 'Sales', 'ROAS', 'ACOS', 'CVR'].includes(h) ? 'right' : 'left', color: '#666', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {insights.campaign_actions.map((row) => {
                    const meta = actionMeta(row.action)
                    return (
                      <tr key={`${row.action}-${row.campaign_name}`} style={{ borderBottom: '1px solid #F5F5F5' }}>
                        <td style={{ padding: '8px 8px' }}>
                          <span style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.color}33`, borderRadius: 4, padding: '2px 8px', fontWeight: 700, fontSize: '0.72rem' }}>
                            {meta.label}
                          </span>
                        </td>
                        <td style={{ padding: '8px 8px', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.campaign_name}>{row.campaign_name}</td>
                        <td style={{ padding: '8px 8px', textAlign: 'right' }}>{fmtMoney(row.spend)}</td>
                        <td style={{ padding: '8px 8px', textAlign: 'right' }}>{fmtMoney(row.sales)}</td>
                        <td style={{ padding: '8px 8px', textAlign: 'right' }}>{row.roas.toFixed(2)}x</td>
                        <td style={{ padding: '8px 8px', textAlign: 'right', color: acosColor(row.acos ?? 0), fontWeight: 600 }}>{fmtPct(row.acos)}</td>
                        <td style={{ padding: '8px 8px', textAlign: 'right' }}>{fmtPct(row.cvr)}</td>
                        <td style={{ padding: '8px 8px', color: '#666' }}>{row.reason}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="dashboard-chart-grid" style={{ marginBottom: 20 }}>
            <div>
              <SectionHeader title="Winning Search Terms" subtitle="Purchasing or high-intent terms from latest period" />
              <div className="dashboard-table-card">
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.76rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #EBEBEB' }}>
                      {['Term', 'Tier', 'Clicks', 'Purch.', 'CVR'].map(h => (
                        <th key={h} style={{ padding: '8px 8px', textAlign: h === 'Term' || h === 'Tier' ? 'left' : 'right', color: '#666', fontWeight: 600, fontSize: '0.68rem', textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {insights.winning_terms.slice(0, 8).map((row) => (
                      <tr key={`${row.search_query}-${row.tier}`} style={{ borderBottom: '1px solid #F5F5F5' }}>
                        <td style={{ padding: '8px 8px', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.search_query}>{row.search_query}</td>
                        <td style={{ padding: '8px 8px', color: tierColor(row.tier), fontWeight: 600 }}>{row.tier || '—'}</td>
                        <td style={{ padding: '8px 8px', textAlign: 'right' }}>{fmtInt(row.clicks)}</td>
                        <td style={{ padding: '8px 8px', textAlign: 'right' }}>{fmtInt(row.purchases)}</td>
                        <td style={{ padding: '8px 8px', textAlign: 'right' }}>{fmtPct(row.conversion_rate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <SectionHeader title="Wasted Search Terms" subtitle="Clicks with no purchases or cart adds" />
              <div className="dashboard-table-card">
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.76rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #EBEBEB' }}>
                      {['Term', 'Tier', 'Impr.', 'Clicks', 'CTR'].map(h => (
                        <th key={h} style={{ padding: '8px 8px', textAlign: h === 'Term' || h === 'Tier' ? 'left' : 'right', color: '#666', fontWeight: 600, fontSize: '0.68rem', textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {insights.wasted_terms.slice(0, 8).map((row) => (
                      <tr key={`${row.search_query}-${row.tier}`} style={{ borderBottom: '1px solid #F5F5F5' }}>
                        <td style={{ padding: '8px 8px', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.search_query}>{row.search_query}</td>
                        <td style={{ padding: '8px 8px', color: tierColor(row.tier), fontWeight: 600 }}>{row.tier || '—'}</td>
                        <td style={{ padding: '8px 8px', textAlign: 'right' }}>{fmtInt(row.impressions)}</td>
                        <td style={{ padding: '8px 8px', textAlign: 'right' }}>{fmtInt(row.clicks)}</td>
                        <td style={{ padding: '8px 8px', textAlign: 'right' }}>{fmtPct(row.ctr)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <SectionHeader title="Tier Performance" subtitle="Latest search period by query intent tier" />
          <div className="dashboard-chart-card" style={{ background: 'white', borderRadius: 10, padding: 16, marginBottom: 20 }}>
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={insights.tier_performance}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EBEBEB" vertical={false} />
                <XAxis dataKey="tier" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="volume" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="rate" orientation="right" tick={{ fontSize: 11 }} tickFormatter={v => v + '%'} />
                <Tooltip formatter={(value: unknown, name: unknown) => String(name).includes('Rate') || String(name).includes('CTR') ? Number(value).toFixed(1) + '%' : fmtInt(Number(value))} />
                <Legend />
                <Bar yAxisId="volume" dataKey="purchases" fill="#2D4A27" name="Purchases" />
                <Bar yAxisId="volume" dataKey="clicks" fill="#B8D4AE" name="Clicks" />
                <Line yAxisId="rate" type="monotone" dataKey="conversion_rate" stroke="#C0392B" strokeWidth={2} name="Conversion Rate %" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {insights.cluster_opportunities.length > 0 && (
            <>
              <SectionHeader title="Cluster Opportunities" subtitle="Shade and keyword clusters with the strongest current demand signals" />
              <div className="dashboard-table-card">
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #EBEBEB' }}>
                      {['Shade', 'Keyword Cluster', 'Tier', 'Queries', 'Clicks', 'Purchases', 'CVR'].map(h => (
                        <th key={h} style={{ padding: '8px 8px', textAlign: ['Queries', 'Clicks', 'Purchases', 'CVR'].includes(h) ? 'right' : 'left', color: '#666', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {insights.cluster_opportunities.map((row, index) => (
                      <tr key={`${row.shade_cluster}-${row.keyword_cluster}-${row.tier}-${index}`} style={{ borderBottom: '1px solid #F5F5F5' }}>
                        <td style={{ padding: '8px 8px' }}>{row.shade_cluster || '—'}</td>
                        <td style={{ padding: '8px 8px' }}>{row.keyword_cluster || '—'}</td>
                        <td style={{ padding: '8px 8px', color: tierColor(row.tier), fontWeight: 600 }}>{row.tier || '—'}</td>
                        <td style={{ padding: '8px 8px', textAlign: 'right' }}>{fmtInt(row.queries)}</td>
                        <td style={{ padding: '8px 8px', textAlign: 'right' }}>{fmtInt(row.clicks)}</td>
                        <td style={{ padding: '8px 8px', textAlign: 'right' }}>{fmtInt(row.purchases)}</td>
                        <td style={{ padding: '8px 8px', textAlign: 'right' }}>{fmtPct(row.conversion_rate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="streamlit">
          <div className="dashboard-kpi-grid">
            <MetricCard label="pROAS" value={parity.war_room.overall_proas == null ? '—' : parity.war_room.overall_proas.toFixed(2) + 'x'} sublabel="Profit ROAS after COGS" />
            <MetricCard label="Growth Volume" value={fmtInt(parity.war_room.growth_search_volume)} sublabel="Search volume in growth clusters" />
            <MetricCard label="Money Pit Spend" value={fmtMoney(parity.war_room.money_pit_spend)} sublabel="Spend with weak profit efficiency" status={(parity.war_room.money_pit_spend || 0) > 0 ? 'warn' : 'normal'} />
            <MetricCard label="Imp to Click" value={`${fmtPct(parity.war_room.imp_to_click_us)} / ${fmtPct(parity.war_room.imp_to_click_market)}`} sublabel="BioHuez vs market" />
            <MetricCard label="Click to Cart" value={`${fmtPct(parity.war_room.click_to_cart_us)} / ${fmtPct(parity.war_room.click_to_cart_market)}`} sublabel="BioHuez vs market" />
            <MetricCard label="Cart to Buy" value={`${fmtPct(parity.war_room.cart_to_buy_us)} / ${fmtPct(parity.war_room.cart_to_buy_market)}`} sublabel="BioHuez vs market" />
          </div>

          <SectionHeader title="Scenario Summary" subtitle="Old Streamlit A/B/C/D campaign action logic grouped by cluster outcome" />
          <div className="dashboard-table-card" style={{ marginBottom: 20 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #EBEBEB' }}>
                  {['Scenario', 'Clusters', 'Spend', 'Sales', 'Orders', 'Search Volume', 'Purch. Share', 'Ad CVR'].map(h => (
                    <th key={h} style={{ padding: '8px 8px', textAlign: h === 'Scenario' ? 'left' : 'right', color: '#666', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parity.scenario_groups.map(row => {
                  const meta = scenarioMeta(row.scenario)
                  return (
                    <tr key={row.scenario} style={{ borderBottom: '1px solid #F5F5F5' }}>
                      <td style={{ padding: '8px 8px' }}>
                        <span style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.color}33`, borderRadius: 4, padding: '2px 8px', fontWeight: 700, fontSize: '0.72rem' }}>
                          {row.scenario}: {meta.label}
                        </span>
                      </td>
                      <td style={{ padding: '8px 8px', textAlign: 'right' }}>{fmtInt(row.clusters)}</td>
                      <td style={{ padding: '8px 8px', textAlign: 'right' }}>{fmtMoney(row.spend)}</td>
                      <td style={{ padding: '8px 8px', textAlign: 'right' }}>{fmtMoney(row.sales)}</td>
                      <td style={{ padding: '8px 8px', textAlign: 'right' }}>{fmtInt(row.orders)}</td>
                      <td style={{ padding: '8px 8px', textAlign: 'right' }}>{fmtInt(row.search_volume)}</td>
                      <td style={{ padding: '8px 8px', textAlign: 'right' }}>{fmtPct(row.avg_purchase_share)}</td>
                      <td style={{ padding: '8px 8px', textAlign: 'right' }}>{fmtPct(row.avg_ad_cvr)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <SectionHeader title="Cluster Action Map" subtitle="Budget, bid, defense, and review recommendations by keyword cluster" />
          <div className="dashboard-table-card" style={{ marginBottom: 20 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.76rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #EBEBEB' }}>
                  {['Cluster', 'Tier', 'Scenario', 'Bucket', 'Spend', 'Sales', 'pROAS', 'Ad CVR', 'Purch. Share', 'Volume'].map(h => (
                    <th key={h} style={{ padding: '8px 8px', textAlign: ['Spend', 'Sales', 'pROAS', 'Ad CVR', 'Purch. Share', 'Volume'].includes(h) ? 'right' : 'left', color: '#666', fontWeight: 600, fontSize: '0.68rem', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parity.cluster_scenarios.slice(0, 30).map((row, index) => {
                  const meta = scenarioMeta(row.scenario)
                  return (
                    <tr key={`${row.cluster}-${row.scenario}-${index}`} style={{ borderBottom: '1px solid #F5F5F5' }}>
                      <td style={{ padding: '8px 8px', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.cluster}>{row.cluster || '—'}</td>
                      <td style={{ padding: '8px 8px', color: tierColor(row.tier), fontWeight: 600 }}>{row.tier || '—'}</td>
                      <td style={{ padding: '8px 8px' }}>
                        <span style={{ background: meta.bg, color: meta.color, borderRadius: 4, padding: '2px 8px', fontWeight: 700, fontSize: '0.72rem' }}>{row.scenario}</span>
                      </td>
                      <td style={{ padding: '8px 8px' }}>{row.bucket || '—'}</td>
                      <td style={{ padding: '8px 8px', textAlign: 'right' }}>{fmtMoney(row.spend)}</td>
                      <td style={{ padding: '8px 8px', textAlign: 'right' }}>{fmtMoney(row.sales)}</td>
                      <td style={{ padding: '8px 8px', textAlign: 'right' }}>{row.proas == null ? '—' : row.proas.toFixed(2) + 'x'}</td>
                      <td style={{ padding: '8px 8px', textAlign: 'right' }}>{fmtPct(row.ad_cvr)}</td>
                      <td style={{ padding: '8px 8px', textAlign: 'right' }}>{fmtPct(row.purchase_share)}</td>
                      <td style={{ padding: '8px 8px', textAlign: 'right' }}>{fmtInt(row.search_volume)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16, marginBottom: 20 }}>
            <div>
              <SectionHeader title="Tier Profitability" subtitle="Streamlit tier rollup with pROAS and CVR" />
              <div className="dashboard-table-card">
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.76rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #EBEBEB' }}>
                      {['Tier', 'Clusters', 'Spend', 'Sales', 'pROAS', 'CVR'].map(h => (
                        <th key={h} style={{ padding: '8px 8px', textAlign: h === 'Tier' ? 'left' : 'right', color: '#666', fontWeight: 600, fontSize: '0.68rem', textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parity.tier_summary.map(row => (
                      <tr key={row.tier} style={{ borderBottom: '1px solid #F5F5F5' }}>
                        <td style={{ padding: '8px 8px', color: tierColor(row.tier), fontWeight: 700 }}>{row.tier || '—'}</td>
                        <td style={{ padding: '8px 8px', textAlign: 'right' }}>{fmtInt(row.clusters)}</td>
                        <td style={{ padding: '8px 8px', textAlign: 'right' }}>{fmtMoney(row.spend)}</td>
                        <td style={{ padding: '8px 8px', textAlign: 'right' }}>{fmtMoney(row.sales)}</td>
                        <td style={{ padding: '8px 8px', textAlign: 'right' }}>{row.proas == null ? '—' : row.proas.toFixed(2) + 'x'}</td>
                        <td style={{ padding: '8px 8px', textAlign: 'right' }}>{fmtPct(row.ad_cvr)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <SectionHeader title="Funnel Diagnostic" subtitle="BioHuez rates compared with market rates" />
              <div className="dashboard-table-card">
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.76rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #EBEBEB' }}>
                      {['Tier', 'Imp Click', 'Click Cart', 'Cart Buy', 'Leaks'].map(h => (
                        <th key={h} style={{ padding: '8px 8px', textAlign: h === 'Tier' ? 'left' : 'right', color: '#666', fontWeight: 600, fontSize: '0.68rem', textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parity.funnel_tiers.map(row => (
                      <tr key={row.tier} style={{ borderBottom: '1px solid #F5F5F5' }}>
                        <td style={{ padding: '8px 8px', color: tierColor(row.tier), fontWeight: 700 }}>{row.tier || '—'}</td>
                        <td style={{ padding: '8px 8px', textAlign: 'right' }}>{fmtPct(row.imp_to_click_us)} / {fmtPct(row.imp_to_click_market)}</td>
                        <td style={{ padding: '8px 8px', textAlign: 'right' }}>{fmtPct(row.click_to_cart_us)} / {fmtPct(row.click_to_cart_market)}</td>
                        <td style={{ padding: '8px 8px', textAlign: 'right' }}>{fmtPct(row.cart_to_buy_us)} / {fmtPct(row.cart_to_buy_market)}</td>
                        <td style={{ padding: '8px 8px', textAlign: 'right' }}>{fmtInt(row.image_price_leaks + row.cart_leaks + row.content_leaks)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {parity.price_benchmark.length > 0 && (
            <>
              <SectionHeader title="Price Benchmark" subtitle="Market median click price vs BioHuez click price by cluster" />
              <div className="dashboard-table-card">
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #EBEBEB' }}>
                      {['Cluster', 'Market Median', 'BioHuez Price', 'Delta', 'Purch. Share', 'Volume'].map(h => (
                        <th key={h} style={{ padding: '8px 8px', textAlign: h === 'Cluster' ? 'left' : 'right', color: '#666', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parity.price_benchmark.map(row => (
                      <tr key={row.cluster} style={{ borderBottom: '1px solid #F5F5F5' }}>
                        <td style={{ padding: '8px 8px' }}>{row.cluster || '—'}</td>
                        <td style={{ padding: '8px 8px', textAlign: 'right' }}>{fmtMoney(row.mkt_price)}</td>
                        <td style={{ padding: '8px 8px', textAlign: 'right' }}>{fmtMoney(row.our_price)}</td>
                        <td style={{ padding: '8px 8px', textAlign: 'right', color: row.price_delta > 0 ? '#C0392B' : '#2D4A27', fontWeight: 700 }}>{fmtMoney(row.price_delta)}</td>
                        <td style={{ padding: '8px 8px', textAlign: 'right' }}>{fmtPct(row.purchase_share)}</td>
                        <td style={{ padding: '8px 8px', textAlign: 'right' }}>{fmtInt(row.search_volume)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
