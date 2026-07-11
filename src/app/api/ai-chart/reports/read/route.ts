import { handleReadAiChartReportRequest } from './handler'
import { getUserIdFromRequest } from '@/lib/supabase/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  return handleReadAiChartReportRequest(request, {
    getUserIdFromRequest,
  })
}
