import { NextResponse } from 'next/server'
import { classifyLinePayExecutorReadinessFailure } from '@/lib/supabase/linePayExecutorReadiness'
import type { LinePaySandboxE2eStartEnvironment } from '../start/handler'
import { isLinePaySandboxE2eRouteEnabled } from '../start/handler'

type AuthorizeReadinessRequest = (request: Request) => Promise<boolean>

type ExecutorReadinessResult = Readonly<{
  ok: true
  authenticated: true
  upstreamCalled: false
  databaseWrites: false
}>

function notFoundResponse() {
  return NextResponse.json(
    { ok: false, error: 'not_found' },
    { status: 404, headers: { 'Cache-Control': 'no-store' } },
  )
}

export async function handleLinePayExecutorReadiness(input: {
  request: Request
  env: LinePaySandboxE2eStartEnvironment
  authorize: AuthorizeReadinessRequest
  probe: () => Promise<ExecutorReadinessResult>
}) {
  if (!isLinePaySandboxE2eRouteEnabled(input.env)) {
    return notFoundResponse()
  }

  let authorized = false
  try {
    authorized = await input.authorize(input.request)
  } catch {
    authorized = false
  }
  if (!authorized) return notFoundResponse()

  try {
    const result = await input.probe()
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    const readinessReason = classifyLinePayExecutorReadinessFailure(error)
    return NextResponse.json(
      {
        ok: false,
        error: 'line_pay_executor_readiness_failed',
        ...(readinessReason ? { readinessReason } : {}),
      },
      { status: 502, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
