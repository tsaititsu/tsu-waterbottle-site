import {
  handleCreateAiChartReportRequest,
  type CreateAiChartReportRequest,
} from './handler'
import { getUserIdFromRequest } from '@/lib/supabase/auth'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as CreateAiChartReportRequest | null
  return handleCreateAiChartReportRequest(request, body, {
    getUserIdFromRequest,
  })
}
