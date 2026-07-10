import { getUserIdFromRequest } from '@/lib/supabase/auth'
import { listDivinationReadingsForUser } from '@/lib/supabase/divinationReadings'
import { handleListAccountDivinationReadings } from './handler'

export const dynamic = 'force-dynamic'

// GET /api/account/divination-readings
// 列出登入會員自己的占卜紀錄（read-only，不含 interpretation）。
export async function GET(request: Request) {
  return handleListAccountDivinationReadings(request, {
    getUserIdFromRequest,
    listReadingsForUser: (userId, options) => listDivinationReadingsForUser(userId, options),
  })
}
