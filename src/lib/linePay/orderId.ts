export type BuildLinePayOrderIdInput = {
  prefix?: unknown
  sourceType: unknown
  sourceId: unknown
  timestamp?: unknown
}

export type ExtractedLinePayOrderId = {
  prefix: string
  sourceType: string
  sourceId: string
  timestamp: string
}

const linePayOrderIdPattern = /^[A-Za-z0-9_-]{1,100}$/
const knownLinePaySourceTypes = ['product_order', 'ai_chart', 'divination', 'booking', 'course']
const blockedOrderIdTermsPattern =
  /email|phone|address|channelSecret|TradeInfo|TradeSha|HashKey|HashIV|secret/i

function getTrimmedString(value: unknown) {
  return String(value ?? '').trim()
}

function assertNoBlockedTerms(value: string) {
  if (blockedOrderIdTermsPattern.test(value)) {
    throw new Error('invalid_line_pay_order_id')
  }
}

function normalizeLinePayOrderIdPart(value: unknown, errorCode: string) {
  const text = getTrimmedString(value)

  if (!text || !linePayOrderIdPattern.test(text)) {
    throw new Error(errorCode)
  }

  assertNoBlockedTerms(text)
  return text
}

export function normalizeLinePayOrderId(orderId: unknown) {
  return normalizeLinePayOrderIdPart(orderId, 'invalid_line_pay_order_id')
}

export function buildLinePayOrderId(input: BuildLinePayOrderIdInput) {
  const prefix = normalizeLinePayOrderIdPart(input.prefix ?? 'LP', 'invalid_line_pay_order_id')
  const sourceType = normalizeLinePayOrderIdPart(input.sourceType, 'invalid_line_pay_order_source_type')
  const sourceId = normalizeLinePayOrderIdPart(input.sourceId, 'invalid_line_pay_order_source_id')
  const timestamp = normalizeLinePayOrderIdPart(input.timestamp ?? Date.now(), 'invalid_line_pay_order_id')

  return normalizeLinePayOrderId(`${prefix}_${sourceType}_${sourceId}_${timestamp}`)
}

export function extractSourceIdFromLinePayOrderId(orderId: unknown): ExtractedLinePayOrderId {
  const normalized = normalizeLinePayOrderId(orderId)
  const parts = normalized.split('_')

  if (parts.length < 4) {
    throw new Error('invalid_line_pay_order_id')
  }

  const prefix = parts[0]
  const timestamp = parts.at(-1)
  const middle = parts.slice(1, -1).join('_')

  if (!prefix || !timestamp || !middle) {
    throw new Error('invalid_line_pay_order_id')
  }

  const sourceType = [...knownLinePaySourceTypes]
    .sort((a, b) => b.length - a.length)
    .find((type) => middle === type || middle.startsWith(`${type}_`))

  if (!sourceType || middle === sourceType) {
    throw new Error('invalid_line_pay_order_id')
  }

  const sourceId = middle.slice(sourceType.length + 1)

  if (!sourceId) {
    throw new Error('invalid_line_pay_order_id')
  }

  return {
    prefix,
    sourceType,
    sourceId,
    timestamp,
  }
}
