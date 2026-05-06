import { dashboardApiResponse } from '@/lib/dashboard-api'

export const dynamic = 'force-dynamic'

export async function GET() {
  return dashboardApiResponse('get_executive_insights.py', {
    items: [],
    counts: { critical: 0, warning: 0, positive: 0, neutral: 0 },
    sources: [],
  })
}
