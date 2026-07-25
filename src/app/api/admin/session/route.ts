import { NextResponse } from 'next/server'
import { requireAdminUser } from '@/lib/auth/admin'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const auth = await requireAdminUser(request)
    if ('error' in auth) return auth.error

    return NextResponse.json({ ok: true, isAdmin: true })
  } catch {
    console.error('Unexpected admin session check error')
    return NextResponse.json({ ok: false, error: '確認管理權限失敗。' }, { status: 500 })
  }
}
