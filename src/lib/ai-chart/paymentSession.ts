import { AI_CHART_REPORT_PRICE_TWD } from './pricing'

export const AI_CHART_PAYMENT_SESSION_KEY = 'waterbottle_ai_chart_payment_session'
export const AI_CHART_PAYMENT_SESSION_SOURCE = 'ai_chart_report'
export const AI_CHART_PAYMENT_SESSION_DEFAULT_AMOUNT_TWD = AI_CHART_REPORT_PRICE_TWD

export type AiChartPaymentSession = {
  reportId: string
  merchantOrderNo?: string | null
  amountTwd: number
  source: typeof AI_CHART_PAYMENT_SESSION_SOURCE
  returnPath?: string | null
  createdAt: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim(),
  )
}

function normalizeOptionalText(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function isValidCreatedAt(value: string) {
  return value.trim().length > 0 && !Number.isNaN(Date.parse(value))
}

export function isAiChartPaymentSession(value: unknown): value is AiChartPaymentSession {
  if (!isRecord(value)) {
    return false
  }

  const merchantOrderNo = value.merchantOrderNo
  const returnPath = value.returnPath

  return (
    typeof value.reportId === 'string' &&
    isUuid(value.reportId) &&
    typeof value.amountTwd === 'number' &&
    Number.isFinite(value.amountTwd) &&
    value.amountTwd > 0 &&
    value.source === AI_CHART_PAYMENT_SESSION_SOURCE &&
    typeof value.createdAt === 'string' &&
    isValidCreatedAt(value.createdAt) &&
    (merchantOrderNo === undefined ||
      merchantOrderNo === null ||
      typeof merchantOrderNo === 'string') &&
    (returnPath === undefined || returnPath === null || typeof returnPath === 'string')
  )
}

let currentPaymentSession: AiChartPaymentSession | null = null

export function saveAiChartPaymentSession(input: {
  reportId: string
  merchantOrderNo?: string | null
  amountTwd?: number
  returnPath?: string | null
}): AiChartPaymentSession {
  const reportId = input.reportId.trim()
  if (!isUuid(reportId)) {
    throw new Error('invalid_ai_chart_report_id')
  }

  const amountTwd = input.amountTwd ?? AI_CHART_PAYMENT_SESSION_DEFAULT_AMOUNT_TWD
  if (!Number.isFinite(amountTwd) || amountTwd <= 0) {
    throw new Error('invalid_ai_chart_amount')
  }

  const session: AiChartPaymentSession = {
    reportId,
    merchantOrderNo: normalizeOptionalText(input.merchantOrderNo),
    amountTwd,
    source: AI_CHART_PAYMENT_SESSION_SOURCE,
    returnPath: normalizeOptionalText(input.returnPath),
    createdAt: new Date().toISOString(),
  }

  currentPaymentSession = { ...session }
  return { ...session }
}

export function getAiChartPaymentSession(): AiChartPaymentSession | null {
  return currentPaymentSession && isAiChartPaymentSession(currentPaymentSession)
    ? { ...currentPaymentSession }
    : null
}

export function clearAiChartPaymentSession(): void {
  currentPaymentSession = null
}
