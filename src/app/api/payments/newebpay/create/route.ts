import { getUserIdFromRequest, getUserWithEmailFromRequest } from '@/lib/supabase/auth'
import { getAiChartReportForUser } from '@/lib/supabase/aiChartReports'
import {
  handleCreateNewebPayPaymentRequest,
  type CreateNewebPayPaymentRequest,
} from './handler'

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as CreateNewebPayPaymentRequest | null
  return handleCreateNewebPayPaymentRequest(body, {
    // 只供管理員限定 NT$1 測試模式驗證使用；一般付款流程不依賴登入狀態（維持既有行為）。
    getRequesterWithEmail: () => getUserWithEmailFromRequest(request),
    authorizeAiChartReportPayment: async (reportId) => {
      const userId = await getUserIdFromRequest(request).catch(() => null)
      if (!userId) {
        return { ok: false, reason: 'unauthorized' }
      }

      const report = await getAiChartReportForUser(reportId, userId)
      if (!report) {
        return { ok: false, reason: 'not_found' }
      }

      return { ok: true, userId }
    },
  })
}
