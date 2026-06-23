import { NextResponse } from 'next/server'
import { LINE_SESSION_COOKIE } from '@/lib/auth/line'

export const runtime = 'nodejs'

function clearLineSession() {
  const response = NextResponse.json({ ok: true })
  response.cookies.set(LINE_SESSION_COOKIE, '', { path: '/', maxAge: 0 })

  return response
}

export async function POST() {
  return clearLineSession()
}

export async function GET() {
  return clearLineSession()
}
