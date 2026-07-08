export const NEWEBPAY_ONE_DOLLAR_TEST_AMOUNT = 1
export const ONE_DOLLAR_TEST_CONFIRMATION_VALUE = 'CONFIRM_NEWEBPAY_ONE_DOLLAR_TEST'

export type NewebPayOneDollarTestEnv = Record<string, string | undefined>

export type NewebPayOneDollarTestContextInput = {
  env: NewebPayOneDollarTestEnv
  source: string
  originalAmount: number
  itemDesc: string
  metadata?: Record<string, unknown>
}

export type NewebPayOneDollarTestContext = {
  enabled: boolean
  amount: number
  itemDesc: string
  metadata: Record<string, unknown>
}

const testItemDescSuffix = '1元測試付款'
const unsafeMetadataKeyPattern =
  /^(HashKey|HashIV|MerchantID|TradeInfo|TradeSha|NEWEBPAY_HASH_KEY|NEWEBPAY_HASH_IV|NEWEBPAY_MERCHANT_ID|OPENAI_API_KEY|LINE_PAY_CHANNEL_SECRET|channelSecret|apiSecret|secret|creditCard|cardNumber|cardCvv|cardExpiry|paymentForm)$/i

function normalizeText(value: string) {
  return value.trim()
}

function isEnabledFlag(value: string | undefined) {
  return value?.trim() === 'true'
}

function isProductionLikeEnvironment(env: NewebPayOneDollarTestEnv) {
  return env.NEWEBPAY_ENV?.trim() === 'production' || env.VERCEL_ENV?.trim() === 'production'
}

function assertValidOriginalAmount(originalAmount: number) {
  if (!Number.isInteger(originalAmount) || originalAmount <= 0) {
    throw new Error('invalid_newebpay_one_dollar_test_amount')
  }
}

function assertValidText(value: string, errorCode: string) {
  const trimmed = normalizeText(value)

  if (!trimmed) {
    throw new Error(errorCode)
  }

  return trimmed
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function sanitizeMetadataValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeMetadataValue)
  }

  if (!isRecord(value)) {
    return value
  }

  return sanitizeMetadata(value)
}

function sanitizeMetadata(metadata: Record<string, unknown> | undefined) {
  if (!metadata) return {}

  if (!isRecord(metadata)) {
    throw new Error('invalid_newebpay_one_dollar_test_metadata')
  }

  const safeMetadata: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(metadata)) {
    if (unsafeMetadataKeyPattern.test(key)) {
      throw new Error('invalid_newebpay_one_dollar_test_metadata')
    }

    safeMetadata[key] = sanitizeMetadataValue(value)
  }

  return safeMetadata
}

function buildOneDollarItemDesc(itemDesc: string) {
  return itemDesc.includes(testItemDescSuffix) ? itemDesc : `${itemDesc}｜${testItemDescSuffix}`
}

export function isNewebPayOneDollarTestModeEnabled(env: NewebPayOneDollarTestEnv): boolean {
  if (!isEnabledFlag(env.ENABLE_NEWEBPAY_ONE_DOLLAR_TEST_MODE)) {
    return false
  }

  if (!isProductionLikeEnvironment(env)) {
    return true
  }

  return env.NEWEBPAY_ONE_DOLLAR_TEST_PRODUCTION_CONFIRMATION?.trim() === ONE_DOLLAR_TEST_CONFIRMATION_VALUE
}

export function buildNewebPayOneDollarTestContext(
  input: NewebPayOneDollarTestContextInput,
): NewebPayOneDollarTestContext {
  const source = assertValidText(input.source, 'invalid_newebpay_one_dollar_test_source')
  const itemDesc = assertValidText(input.itemDesc, 'invalid_newebpay_one_dollar_test_item_desc')
  assertValidOriginalAmount(input.originalAmount)

  const metadata = sanitizeMetadata(input.metadata)
  const enabled = isNewebPayOneDollarTestModeEnabled(input.env)

  if (!enabled) {
    return {
      enabled: false,
      amount: input.originalAmount,
      itemDesc,
      metadata,
    }
  }

  return {
    enabled: true,
    amount: NEWEBPAY_ONE_DOLLAR_TEST_AMOUNT,
    itemDesc: buildOneDollarItemDesc(itemDesc),
    metadata: {
      ...metadata,
      test_payment: true,
      newebpay_one_dollar_test: {
        source,
        originalAmount: input.originalAmount,
        testAmount: NEWEBPAY_ONE_DOLLAR_TEST_AMOUNT,
        originalItemDesc: itemDesc,
      },
    },
  }
}
