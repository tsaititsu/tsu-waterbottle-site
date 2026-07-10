import { getUserIdFromRequest } from '@/lib/supabase/auth'
import { getDivinationReadingForUser } from '@/lib/supabase/divinationReadings'
import { handleGetAccountDivinationReading } from '../handler'

export const dynamic = 'force-dynamic'

// GET /api/account/divination-readings/[id]
// 讀取登入會員自己的單筆占卜紀錄；completed 才含完整 interpretation。
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params

  return handleGetAccountDivinationReading(request, id, {
    getUserIdFromRequest,
    getReadingForUser: (readingId, userId) => getDivinationReadingForUser(readingId, userId),
  })
}
