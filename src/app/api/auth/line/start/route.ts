import { NextRequest, NextResponse } from 'next/server'
import {
  buildLineAuthorizeUrl,
  LINE_NEXT_COOKIE,
  LINE_NONCE_COOKIE,
  LINE_STATE_COOKIE,
} from '@/lib/auth/line'

export const runtime = 'nodejs'

function siteOrigin(request: NextRequest) {
  return (process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin).replace(/\/$/g, '')
}

function secureCookie(request: NextRequest) {
  return request.nextUrl.protocol === 'https:' || process.env.NODE_ENV === 'production'
}

export async function GET(request: NextRequest) {
  const redirectUri = `${siteOrigin(request)}/api/auth/line/callback`
  const auth = buildLineAuthorizeUrl({
    redirectUri,
    next: request.nextUrl.searchParams.get('next'),
  })
  const response = NextResponse.redirect(auth.url)
  const options = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: secureCookie(request),
    path: '/',
    maxAge: 60 * 10,
  }

  response.cookies.set(LINE_STATE_COOKIE, auth.state, options)
  response.cookies.set(LINE_NONCE_COOKIE, auth.nonce, options)
  response.cookies.set(LINE_NEXT_COOKIE, auth.next, options)

  return response
}
