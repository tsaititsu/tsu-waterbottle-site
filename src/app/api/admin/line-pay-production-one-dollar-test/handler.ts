import { NextResponse } from 'next/server'
import {
  LINE_PAY_PRODUCTION_ONE_DOLLAR_MIN_WINDOW_MS,
  isLinePayProductionOneDollarRouteEnabled,
  type LinePayProductionOneDollarEnvironment,
} from '../../internal/line-pay/production-one-dollar/start/handler'

type AuthorizeAdmin = (request: Request) => Promise<Response | null>

export async function handleLinePayProductionOneDollarTestStatus(input: {
  request: Request
  env: LinePayProductionOneDollarEnvironment
  authorizeAdmin: AuthorizeAdmin
  now?: () => Date
}) {
  try {
    const authError = await input.authorizeAdmin(input.request)
    if (authError) return authError

    const now = input.now?.() ?? new Date()
    const enabled = isLinePayProductionOneDollarRouteEnabled(
      input.env,
      now,
    )
    const expiresAt = input.env
      .LINE_PAY_PRODUCTION_ONE_DOLLAR_TEST_EXPIRES_AT?.trim()
    const enabledUntil = enabled && expiresAt
      ? new Date(
          Date.parse(expiresAt)
          - LINE_PAY_PRODUCTION_ONE_DOLLAR_MIN_WINDOW_MS,
        ).toISOString()
      : null

    return NextResponse.json(
      {
        ok: true,
        enabled,
        ...(enabledUntil ? { enabledUntil } : {}),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch {
    return NextResponse.json(
      { ok: false, error: 'line_pay_entry_test_status_failed' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
