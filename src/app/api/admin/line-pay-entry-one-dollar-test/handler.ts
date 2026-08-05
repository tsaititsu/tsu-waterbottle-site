import { NextResponse } from 'next/server'
import {
  isLinePayProductionOneDollarRouteEnabled,
  type LinePayProductionOneDollarEnvironment,
} from '@/lib/linePay/productionOneDollarTest'

type AuthorizeAdmin = (request: Request) => Promise<Response | null>

export async function handleLinePayEntryOneDollarTestStatus(input: {
  request: Request
  env: LinePayProductionOneDollarEnvironment
  authorizeAdmin: AuthorizeAdmin
  now?: () => Date
}) {
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
}
