import { NextResponse } from 'next/server'

export type LinePayCartRedirectStatus =
  | 'success'
  | 'canceled'
  | 'pending'
  | 'reconciliation'
  | 'failed'
  | 'error'

const allowedLinePayCartRedirectStatuses = new Set<LinePayCartRedirectStatus>([
  'success',
  'canceled',
  'pending',
  'reconciliation',
  'failed',
  'error',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeLinePayCartRedirectStatus(status: unknown): LinePayCartRedirectStatus {
  return typeof status === 'string' && allowedLinePayCartRedirectStatuses.has(status as LinePayCartRedirectStatus)
    ? (status as LinePayCartRedirectStatus)
    : 'error'
}

async function readSafeJson(response: Response): Promise<unknown> {
  try {
    return await response.clone().json()
  } catch {
    return null
  }
}

export function buildLinePayCartRedirectUrl({
  baseUrl,
  status,
}: {
  baseUrl: string | URL
  status: unknown
}) {
  const url = new URL('/cart', baseUrl)
  url.searchParams.set('linePay', normalizeLinePayCartRedirectStatus(status))
  return url
}

export function buildLinePayReturnRedirectUrl({
  baseUrl,
  returnPath,
  status,
}: {
  baseUrl: string | URL
  returnPath: string
  status: unknown
}) {
  const normalizedStatus = normalizeLinePayCartRedirectStatus(status)
  const url = new URL(returnPath, baseUrl)
  url.searchParams.set('linePay', normalizedStatus)
  if (url.pathname.startsWith('/ai-chart/result/') || url.pathname.startsWith('/ai-divination/result/')) {
    url.searchParams.set(
      'payment',
      normalizedStatus === 'success' ? 'success' : normalizedStatus,
    )
  }
  return url
}

export function resolveLinePayConfirmCartRedirectStatus(payload: unknown): LinePayCartRedirectStatus {
  if (!isRecord(payload)) return 'error'

  if (payload.error === 'product_order_already_paid') return 'success'

  if (payload.error === 'line_pay_confirmation_reconciliation_required') {
    return 'reconciliation'
  }

  if (payload.ok === true && payload.confirmed === true && payload.markedPaid === true) {
    return 'success'
  }

  if (payload.confirmed === false || payload.markedPaid === false) {
    return 'pending'
  }

  return 'error'
}

export function resolveLinePayCancelCartRedirectStatus(payload: unknown): LinePayCartRedirectStatus {
  if (!isRecord(payload)) return 'error'
  if (payload.canceled === true) return 'canceled'
  return 'error'
}

export async function redirectLinePayHandlerResponseToCart({
  request,
  response,
  resolveStatus,
}: {
  request: Request
  response: Response
  resolveStatus: (payload: unknown) => LinePayCartRedirectStatus
}) {
  const payload = await readSafeJson(response)
  const redirectUrl = buildLinePayCartRedirectUrl({
    baseUrl: request.url,
    status: resolveStatus(payload),
  })

  return NextResponse.redirect(redirectUrl, { status: 303 })
}

export async function redirectLinePayHandlerResponse({
  request,
  response,
  resolveStatus,
  returnPath,
}: {
  request: Request
  response: Response
  resolveStatus: (payload: unknown) => LinePayCartRedirectStatus
  returnPath: string
}) {
  const payload = await readSafeJson(response)
  return NextResponse.redirect(
    buildLinePayReturnRedirectUrl({
      baseUrl: request.url,
      returnPath,
      status: resolveStatus(payload),
    }),
    { status: 303 },
  )
}
