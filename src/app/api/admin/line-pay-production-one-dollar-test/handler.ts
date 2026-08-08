import { NextResponse } from 'next/server'
import {
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

    return NextResponse.json(
      {
        ok: true,
        enabled: isLinePayProductionOneDollarRouteEnabled(
          input.env,
          input.now?.() ?? new Date(),
        ),
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
