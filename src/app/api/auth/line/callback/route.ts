import { NextRequest, NextResponse } from 'next/server'
import {
  createLineSessionCookieValue,
  exchangeLineCode,
  fetchLineProfile,
  LINE_NEXT_COOKIE,
  LINE_NONCE_COOKIE,
  LINE_SESSION_COOKIE,
  LINE_STATE_COOKIE,
  sanitizeNextPath,
  upsertLineSupabaseUser,
  verifyLineIdToken,
} from '@/lib/auth/line'

export const runtime = 'nodejs'

function siteOrigin(request: NextRequest) {
  return (process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin).replace(/\/$/g, '')
}

function secureCookie(request: NextRequest) {
  return request.nextUrl.protocol === 'https:' || process.env.NODE_ENV === 'production'
}

function clearTransientCookies(response: NextResponse) {
  const options = { path: '/', maxAge: 0 }
  response.cookies.set(LINE_STATE_COOKIE, '', options)
  response.cookies.set(LINE_NONCE_COOKIE, '', options)
  response.cookies.set(LINE_NEXT_COOKIE, '', options)
}

export async function GET(request: NextRequest) {
  const nextPath = sanitizeNextPath(request.cookies.get(LINE_NEXT_COOKIE)?.value || '/account')
  const redirectUri = `${siteOrigin(request)}/api/auth/line/callback`

  try {
    const providerError = request.nextUrl.searchParams.get('error')
    if (providerError) {
      throw new Error(request.nextUrl.searchParams.get('error_description') || providerError)
    }

    const code = request.nextUrl.searchParams.get('code')
    const state = request.nextUrl.searchParams.get('state')
    const expectedState = request.cookies.get(LINE_STATE_COOKIE)?.value
    const expectedNonce = request.cookies.get(LINE_NONCE_COOKIE)?.value

    if (!code) throw new Error('LINE 沒有回傳登入授權碼')
    if (!state || !expectedState || state !== expectedState) {
      throw new Error('LINE 登入狀態驗證失敗，請重新登入')
    }

    const tokens = await exchangeLineCode({ code, redirectUri })
    const verified = tokens.id_token ? await verifyLineIdToken(tokens.id_token) : null

    if (expectedNonce && verified?.nonce && verified.nonce !== expectedNonce) {
      throw new Error('LINE 登入安全驗證失敗，請重新登入')
    }

    let apiProfile: Awaited<ReturnType<typeof fetchLineProfile>> | null = null
    try {
      apiProfile = await fetchLineProfile(tokens.access_token)
    } catch (error) {
      if (!verified) throw error
    }

    const lineUserId = verified?.sub || apiProfile?.userId
    if (!lineUserId) throw new Error('LINE 沒有回傳會員 ID')

    const user = await upsertLineSupabaseUser({
      lineUserId,
      displayName: apiProfile?.displayName || verified?.name,
      avatarUrl: apiProfile?.pictureUrl || verified?.picture || '',
    })

    const response = NextResponse.redirect(new URL(nextPath, request.nextUrl.origin))
    response.cookies.set(LINE_SESSION_COOKIE, createLineSessionCookieValue(user), {
      httpOnly: true,
      sameSite: 'lax',
      secure: secureCookie(request),
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    })
    clearTransientCookies(response)

    return response
  } catch (error) {
    const message = error instanceof Error ? error.message : 'LINE 登入失敗'
    const response = NextResponse.redirect(
      new URL(`/auth/callback?error=${encodeURIComponent(message)}`, request.nextUrl.origin),
    )
    clearTransientCookies(response)

    return response
  }
}
