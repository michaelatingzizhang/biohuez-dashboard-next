import { dashboardApiResponse } from '@/lib/dashboard-api'

export const dynamic = 'force-dynamic'

export async function GET() {
  return dashboardApiResponse('get_finance.py')
}
