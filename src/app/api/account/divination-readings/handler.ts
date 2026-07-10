import { NextResponse } from 'next/server'
import type {
  AccountDivinationReadingDetail,
  AccountDivinationReadingListItem,
} from '../../../../lib/supabase/divinationReadings'

// 我的占卜紀錄 API 安全原則：
// - 只以登入 token 推導 user id，完全不讀 query/body 的 userId、email 等會員識別欄位。
// - 非本人／不存在的紀錄一律 404，避免洩漏紀錄是否存在。
// - 列表不含 interpretation；單筆只在 completed 時含 interpretation（由 helper 保證）。
// - 錯誤回應固定文案，不含 key / env / stack。

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isValidDivinationReadingId(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value.trim())
}

export type ListAccountDivinationReadingsDeps = {
  getUserIdFromRequest: (request: Request) => Promise<string | null>
  listReadingsForUser: (
    userId: string,
    options: { limit?: unknown },
  ) => Promise<AccountDivinationReadingListItem[]>
}

export async function handleListAccountDivinationReadings(
  request: Request,
  deps: ListAccountDivinationReadingsDeps,
): Promise<NextResponse> {
  try {
    const userId = await deps.getUserIdFromRequest(request).catch(() => null)

    if (!userId) {
      return NextResponse.json({ ok: false, message: '請先登入後再查看占卜紀錄。' }, { status: 401 })
    }

    // 只接受 limit；userId / email 等參數一律忽略。
    const url = new URL(request.url)
    const limit = url.searchParams.get('limit')

    const readings = await deps.listReadingsForUser(userId, { limit })

    return NextResponse.json({ ok: true, readings })
  } catch (error) {
    console.error(
      'Failed to list account divination readings',
      error instanceof Error ? error.message : '未知錯誤',
    )
    return NextResponse.json({ ok: false, message: '讀取占卜紀錄失敗，請稍後再試。' }, { status: 500 })
  }
}

export type GetAccountDivinationReadingDeps = {
  getUserIdFromRequest: (request: Request) => Promise<string | null>
  getReadingForUser: (
    readingId: string,
    userId: string,
  ) => Promise<AccountDivinationReadingDetail | null>
}

export async function handleGetAccountDivinationReading(
  request: Request,
  readingId: unknown,
  deps: GetAccountDivinationReadingDeps,
): Promise<NextResponse> {
  try {
    const userId = await deps.getUserIdFromRequest(request).catch(() => null)

    if (!userId) {
      return NextResponse.json({ ok: false, message: '請先登入後再查看占卜紀錄。' }, { status: 401 })
    }

    if (!isValidDivinationReadingId(readingId)) {
      return NextResponse.json({ ok: false, message: '找不到這筆占卜紀錄。' }, { status: 404 })
    }

    // DB 查詢同時限制 id 與 user_id；非本人與不存在一律 404。
    const reading = await deps.getReadingForUser(readingId.trim(), userId)

    if (!reading) {
      return NextResponse.json({ ok: false, message: '找不到這筆占卜紀錄。' }, { status: 404 })
    }

    return NextResponse.json({ ok: true, reading })
  } catch (error) {
    console.error(
      'Failed to read account divination reading',
      error instanceof Error ? error.message : '未知錯誤',
    )
    return NextResponse.json({ ok: false, message: '讀取占卜紀錄失敗，請稍後再試。' }, { status: 500 })
  }
}
