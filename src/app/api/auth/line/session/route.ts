import { NextRequest, NextResponse } from 'next/server'
import { LINE_SESSION_COOKIE, readLineSessionCookieValue } from '@/lib/auth/line'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const user = readLineSessionCookieValue(request.cookies.get(LINE_SESSION_COOKIE)?.value)
  return NextResponse.json({ user })
}
