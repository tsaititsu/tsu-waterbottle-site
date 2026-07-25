import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '../supabase/admin'

export type AdminRequestUser = {
  id: string
  email: string | null
}

export type RequireAdminUserDeps = {
  verifyAccessToken?: (token: string) => Promise<AdminRequestUser | null>
  getSupabase?: () => ReturnType<typeof getSupabaseAdmin>
  adminEmailsRaw?: string | null
}

export type RequireAdminUserResult =
  | { error: NextResponse }
  | { supabase: ReturnType<typeof getSupabaseAdmin>; user: AdminRequestUser }

/**
 * 解析 server-only 的 ADMIN_EMAILS 環境變數（逗號分隔）。
 * 每個項目 trim + lowercase，非 email 格式的項目會被忽略。
 */
export function parseAdminEmails(rawValue: string | null | undefined): string[] {
  if (typeof rawValue !== 'string' || !rawValue.trim()) return []

  return rawValue
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.includes('@'))
}

/**
 * 判斷 email 是否在 admin allowlist 內。
 * allowlist 未設定或為空時一律 fail closed（回傳 false）。
 */
export function isAdminEmail(email: string | null | undefined, rawAllowlist: string | null | undefined): boolean {
  if (typeof email !== 'string' || !email.trim()) return false

  const allowlist = parseAdminEmails(rawAllowlist)
  if (allowlist.length === 0) return false

  return allowlist.includes(email.trim().toLowerCase())
}

function extractBearerToken(request: Request): string {
  const authHeader = request.headers.get('authorization')
  return authHeader?.replace(/^Bearer\s+/i, '').trim() ?? ''
}

async function verifyAccessTokenWithSupabase(token: string): Promise<AdminRequestUser | null> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.auth.getUser(token)

  if (error || !data.user) return null

  return { id: data.user.id, email: data.user.email ?? null }
}

/**
 * Admin API 守門：
 * - 未登入（無 token 或 token 無效）→ 401
 * - 已登入但 email 不在 ADMIN_EMAILS → 403
 * - ADMIN_EMAILS 未設定 → 一律 403（fail closed）
 */
export async function requireAdminUser(
  request: Request,
  deps: RequireAdminUserDeps = {},
): Promise<RequireAdminUserResult> {
  const token = extractBearerToken(request)

  if (!token) {
    return { error: NextResponse.json({ ok: false, error: '請先登入後再使用後台。' }, { status: 401 }) }
  }

  const verifyAccessToken = deps.verifyAccessToken ?? verifyAccessTokenWithSupabase

  let user: AdminRequestUser | null = null
  try {
    user = await verifyAccessToken(token)
  } catch {
    console.error('Admin access token verification failed')
    user = null
  }

  if (!user) {
    return { error: NextResponse.json({ ok: false, error: '登入狀態已失效，請重新登入。' }, { status: 401 }) }
  }

  const adminEmailsRaw = deps.adminEmailsRaw !== undefined ? deps.adminEmailsRaw : process.env.ADMIN_EMAILS

  if (!isAdminEmail(user.email, adminEmailsRaw)) {
    return { error: NextResponse.json({ ok: false, error: '沒有管理權限。' }, { status: 403 }) }
  }

  const getSupabase = deps.getSupabase ?? getSupabaseAdmin
  return { supabase: getSupabase(), user }
}
