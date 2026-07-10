import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { handleCreateNewebPayPaymentRequest } from './handler'
import { createNewebPayMpgPaymentData, type NewebPayMpgPaymentData } from '../../../../../lib/newebpay/paymentForm'
import { validateDivinationReadingPayment } from '../../../../../lib/supabase/divinationReadings'
import { ONE_DOLLAR_TEST_CONFIRMATION_VALUE } from '../../../../../lib/newebpay/oneDollarTestMode'
import { decryptTradeInfo } from '../../../../../lib/newebpay/crypto'
import type { CreatePendingPaymentInput } from '../../../../../lib/supabase/payments'
import type { NewebPayConfig } from '../../../../../lib/newebpay/types'

const tests: Array<{ name: string; fn: () => Promise<void> }> = []

function test(name: string, fn: () => Promise<void>) {
  tests.push({ name, fn })
}

const readingId = 'ec34c86a-d6e2-424e-9a37-48cef981b3bc'
const paymentId = 'e7bd0667-9b8f-494a-9954-d889ef195f75'
const merchantOrderNo = 'WB20260710120000DIVT'

const adminUser = { id: 'admin-1', email: 'boss@example.com' }
const memberUser = { id: 'member-1', email: 'member@example.com' }

const allFlagsEnv = {
  ENABLE_NEWEBPAY_ONE_DOLLAR_TEST_MODE: 'true',
  ENABLE_DIVINATION_ONE_DOLLAR_TEST_MODE: 'true',
  ADMIN_EMAILS: 'boss@example.com',
}

const fakeConfig: NewebPayConfig = {
  env: 'test',
  merchantId: 'MS123456789',
  hashKey: '12345678901234567890123456789012',
  hashIv: '1234567890123456',
  version: '2.3',
  siteUrl: 'http://localhost:3000',
  mpgGatewayUrl: 'https://example.test/mpg',
  mpgEndpoint: 'https://example.test/mpg',
}

function buildPaymentData(input: { itemKey: string; amount?: number }): NewebPayMpgPaymentData {
  return {
    action: 'https://example.test/mpg',
    method: 'POST',
    merchantOrderNo,
    itemKey: input.itemKey as NewebPayMpgPaymentData['itemKey'],
    amount: input.amount ?? 0,
    fields: {
      MerchantID: 'MS123456789',
      TradeInfo: 'encrypted-trade-info',
      TradeSha: 'trade-sha',
      Version: '2.3',
    },
  }
}

function divinationBody(overrides: Record<string, unknown> = {}) {
  return {
    itemKey: 'ai_divination_single',
    source: 'ai_divination',
    paymentMode: 'credit',
    readingId,
    ...overrides,
  }
}

function createDivinationDeps(
  input: {
    env?: Record<string, string | undefined>
    requester?: { id: string; email: string | null } | null
    useRealPaymentData?: boolean
  } = {},
) {
  const calls: {
    paymentDataInputs: Array<Record<string, unknown>>
    pendingPayments: CreatePendingPaymentInput[]
    divinationLinks: Array<Record<string, unknown>>
  } = {
    paymentDataInputs: [],
    pendingPayments: [],
    divinationLinks: [],
  }

  return {
    calls,
    deps: {
      env: input.env ?? allFlagsEnv,
      getRequesterWithEmail: async () => (input.requester === undefined ? adminUser : input.requester),
      getNewebPayConfig: () => fakeConfig,
      createNewebPayMpgPaymentData: (paymentInput: Parameters<typeof createNewebPayMpgPaymentData>[0]) => {
        calls.paymentDataInputs.push(paymentInput as unknown as Record<string, unknown>)
        if (input.useRealPaymentData) {
          return createNewebPayMpgPaymentData(paymentInput)
        }
        return buildPaymentData(paymentInput as unknown as { itemKey: string; amount?: number })
      },
      getDivinationReadingPaymentContext: async (lookupReadingId: string) => ({
        id: lookupReadingId,
        status: 'pending_payment' as const,
        paymentId: null,
        merchantOrderNo: null,
      }),
      validateDivinationReadingPayment,
      createPendingPayment: async (paymentInput: CreatePendingPaymentInput) => {
        calls.pendingPayments.push(paymentInput)
        return { id: paymentId }
      },
      linkDivinationReadingPendingPayment: async (linkInput: {
        readingId: string
        paymentId: string
        merchantOrderNo: string
      }) => {
        calls.divinationLinks.push(linkInput)
        return { result: 'linked' as const }
      },
    },
  }
}

async function readJson(response: Response) {
  return (await response.json()) as Record<string, unknown>
}

// --- 正式價格保持不變（規格 8、9）---

test('一般使用者（未登入、無測試欄位）維持正式 NT$50', async () => {
  const { deps, calls } = createDivinationDeps({ requester: null })
  const response = await handleCreateNewebPayPaymentRequest(divinationBody(), deps)

  assert.equal(response.status, 200)
  assert.equal(calls.pendingPayments[0].amountTwd, 50)
  assert.equal(calls.paymentDataInputs[0].amount, undefined) // 由 item 預設 50 決定
  const serialized = JSON.stringify(calls.pendingPayments[0].rawPayload)
  assert.equal(serialized.includes('test_payment'), false)
})

test('admin＋flags 全開但未選測試模式，仍為 NT$50', async () => {
  const { deps, calls } = createDivinationDeps()
  const response = await handleCreateNewebPayPaymentRequest(divinationBody(), deps)

  assert.equal(response.status, 200)
  assert.equal(calls.pendingPayments[0].amountTwd, 50)
  assert.equal(JSON.stringify(calls.pendingPayments[0].rawPayload).includes('test_payment'), false)
})

// --- 測試模式授權（規格 5、6、24）---

test('未登入請求測試模式 → 401 且不建立 payment', async () => {
  const { deps, calls } = createDivinationDeps({ requester: null })
  const response = await handleCreateNewebPayPaymentRequest(
    divinationBody({ divinationOneDollarTest: true }),
    deps,
  )

  assert.equal(response.status, 401)
  assert.equal(calls.pendingPayments.length, 0)
})

test('非 admin 即使傳 testMode 也拿不到 NT$1（403、不建立 payment）', async () => {
  const { deps, calls } = createDivinationDeps({ requester: memberUser })
  const response = await handleCreateNewebPayPaymentRequest(
    divinationBody({ divinationOneDollarTest: true }),
    deps,
  )

  assert.equal(response.status, 403)
  assert.equal(calls.pendingPayments.length, 0)
})

// --- flags 不全時拒絕（規格 1-4 的 handler 端行為）---

test('flags 全關 → admin 也拿不到測試模式', async () => {
  const { deps, calls } = createDivinationDeps({ env: { ADMIN_EMAILS: 'boss@example.com' } })
  const response = await handleCreateNewebPayPaymentRequest(
    divinationBody({ divinationOneDollarTest: true }),
    deps,
  )

  assert.equal(response.status, 403)
  assert.equal(calls.pendingPayments.length, 0)
})

test('只開一般 1 元模式（缺 divination flag）→ 403', async () => {
  const { deps, calls } = createDivinationDeps({
    env: { ENABLE_NEWEBPAY_ONE_DOLLAR_TEST_MODE: 'true', ADMIN_EMAILS: 'boss@example.com' },
  })
  const response = await handleCreateNewebPayPaymentRequest(
    divinationBody({ divinationOneDollarTest: true }),
    deps,
  )

  assert.equal(response.status, 403)
  assert.equal(calls.pendingPayments.length, 0)
})

test('production 缺 confirmation → 403；補上正確 confirmation → 可用', async () => {
  const productionEnv = { ...allFlagsEnv, NEWEBPAY_ENV: 'production' }

  const missing = createDivinationDeps({ env: productionEnv })
  const missingResponse = await handleCreateNewebPayPaymentRequest(
    divinationBody({ divinationOneDollarTest: true }),
    missing.deps,
  )
  assert.equal(missingResponse.status, 403)
  assert.equal(missing.calls.pendingPayments.length, 0)

  const confirmed = createDivinationDeps({
    env: {
      ...productionEnv,
      NEWEBPAY_ONE_DOLLAR_TEST_PRODUCTION_CONFIRMATION: ONE_DOLLAR_TEST_CONFIRMATION_VALUE,
    },
  })
  const confirmedResponse = await handleCreateNewebPayPaymentRequest(
    divinationBody({ divinationOneDollarTest: true }),
    confirmed.deps,
  )
  assert.equal(confirmedResponse.status, 200)
  assert.equal(confirmed.calls.pendingPayments[0].amountTwd, 1)
})

// --- 測試模式金額與 metadata（規格 10-14、18、19）---

test('admin 測試模式：payment=1、NewebPay Amt=1、金額同源一致', async () => {
  const { deps, calls } = createDivinationDeps()
  const response = await handleCreateNewebPayPaymentRequest(
    divinationBody({ divinationOneDollarTest: true }),
    deps,
  )

  assert.equal(response.status, 200)
  // 本地 payment 記錄金額 = 1
  assert.equal(calls.pendingPayments[0].amountTwd, 1)
  // 傳給 NewebPay MPG 的金額 = 1（Amt=1）
  assert.equal(calls.paymentDataInputs[0].amount, 1)
  // 兩者同源一致（Notify 端以 payments row 金額為對帳基準，同為 1）
  assert.equal(calls.pendingPayments[0].amountTwd, calls.paymentDataInputs[0].amount)
  // 仍走 credit（CREDIT=1、InstFlag=0 由既有 credit 模式 TradeInfo 邏輯決定）
  assert.equal(calls.paymentDataInputs[0].paymentMode, 'credit')
  // itemDesc 標示管理員測試
  assert.equal(String(calls.paymentDataInputs[0].itemDesc).includes('管理員測試'), true)
  assert.equal(String(calls.pendingPayments[0].itemName).includes('管理員測試'), true)
})

test('測試 payment metadata 完整標記', async () => {
  const { deps, calls } = createDivinationDeps()
  await handleCreateNewebPayPaymentRequest(divinationBody({ divinationOneDollarTest: true }), deps)

  const rawPayload = calls.pendingPayments[0].rawPayload as Record<string, unknown>
  assert.equal(rawPayload.amount, 1)
  assert.equal(rawPayload.test_payment, true)
  assert.equal(rawPayload.one_dollar_test_mode, true)
  assert.equal(rawPayload.divination_one_dollar_test, true)
  assert.equal(rawPayload.original_amount, 50)
  assert.equal(rawPayload.test_source, 'divination')
  // reading 連結照常建立（paid gate 流程不變）
  assert.equal(calls.divinationLinks.length, 1)
  assert.equal((calls.divinationLinks[0] as { readingId?: string }).readingId, readingId)
})

test('admin 測試模式 MPG payload 只送 CREDIT=1、InstFlag=0 與 Amt=1', async () => {
  const { deps } = createDivinationDeps({ useRealPaymentData: true })
  const response = await handleCreateNewebPayPaymentRequest(
    divinationBody({ divinationOneDollarTest: true }),
    deps,
  )
  const json = await readJson(response)
  const fields = json.fields as Record<string, unknown>
  const tradeInfo = decryptTradeInfo(
    String(fields.TradeInfo),
    fakeConfig.hashKey,
    fakeConfig.hashIv,
  )
  const params = new URLSearchParams(tradeInfo)

  assert.equal(response.status, 200)
  assert.equal(params.get('Amt'), '1')
  assert.equal(params.get('CREDIT'), '1')
  assert.equal(params.get('InstFlag'), '0')

  for (const forbidden of ['LINEPAY', 'VACC', 'APPLEPAY', 'ANDROIDPAY', 'SAMSUNGPAY']) {
    assert.equal(params.has(forbidden), false, forbidden)
  }
})

// --- 無效請求（防繞過）---

test('divinationOneDollarTest 非 true、非占卜 item、非 credit 一律 400', async () => {
  const stringValue = createDivinationDeps()
  const stringResponse = await handleCreateNewebPayPaymentRequest(
    divinationBody({ divinationOneDollarTest: 'true' }),
    stringValue.deps,
  )
  assert.equal(stringResponse.status, 400)

  const wrongItem = createDivinationDeps()
  const wrongItemResponse = await handleCreateNewebPayPaymentRequest(
    {
      itemKey: 'booking_consultation_60',
      source: 'booking',
      paymentMode: 'credit',
      bookingId: readingId,
      divinationOneDollarTest: true,
    },
    wrongItem.deps,
  )
  assert.equal(wrongItemResponse.status, 400)

  const wrongMode = createDivinationDeps()
  const wrongModeResponse = await handleCreateNewebPayPaymentRequest(
    divinationBody({ divinationOneDollarTest: true, paymentMode: 'merchant_default' }),
    wrongMode.deps,
  )
  assert.equal(wrongModeResponse.status, 400)

  assert.equal(stringValue.calls.pendingPayments.length, 0)
  assert.equal(wrongItem.calls.pendingPayments.length, 0)
  assert.equal(wrongMode.calls.pendingPayments.length, 0)
})

test('錯誤與成功回應皆不洩漏 ADMIN_EMAILS / key / env', async () => {
  const forbidden = createDivinationDeps({ requester: memberUser })
  const forbiddenResponse = await handleCreateNewebPayPaymentRequest(
    divinationBody({ divinationOneDollarTest: true }),
    forbidden.deps,
  )
  const forbiddenBody = JSON.stringify(await readJson(forbiddenResponse))
  assert.equal(forbiddenBody.includes('ADMIN_EMAILS'), false)
  assert.equal(forbiddenBody.includes('boss@example.com'), false)
  assert.equal(forbiddenBody.includes('CONFIRM_NEWEBPAY'), false)

  const success = createDivinationDeps()
  const successResponse = await handleCreateNewebPayPaymentRequest(
    divinationBody({ divinationOneDollarTest: true }),
    success.deps,
  )
  const successBody = JSON.stringify(await readJson(successResponse))
  assert.equal(successBody.includes('HashKey'), false)
  assert.equal(successBody.includes('hashKey'), false)
  assert.equal(successBody.includes('ADMIN_EMAILS'), false)
})

// --- source-level：前端與 status API（規格 15-17 相關防護）---

const projectRoot = process.cwd()

test('status API route 由 requireAdminUser 守門並交給獨立 handler', async () => {
  const source = readFileSync(
    join(projectRoot, 'src/app/api/admin/divination-one-dollar-test/route.ts'),
    'utf8',
  )
  assert.equal(source.includes('requireAdminUser'), true)
  assert.equal(source.includes('handleDivinationOneDollarTestStatus'), true)
})

test('前端保留正式按鈕、測試按鈕受 admin 狀態 gate、不送 LINEPAY/VACC/APPLEPAY 模式', async () => {
  const source = readFileSync(
    join(projectRoot, 'src/components/divination/DivinationDrawPreview.tsx'),
    'utf8',
  )
  // 正式按鈕與文案仍在
  assert.equal(source.includes('信用卡線上付款 NT$${paymentRequired.amountTwd}'), true)
  // 測試按鈕存在且受 isAdminOneDollarTestAvailable 控制
  assert.equal(source.includes('管理員測試付款 NT$1'), true)
  assert.equal(source.includes('isAdminOneDollarTestAvailable'), true)
  // 測試請求仍為 credit 模式，不使用其他付款模式
  assert.equal(source.includes('paymentMode: "credit"'), true)
  assert.equal(source.includes('LINEPAY'), false)
  assert.equal(source.includes('VACC'), false)
  assert.equal(source.includes('apple_pay_test'), false)
  // 測試欄位只在 admin 測試分支加入
  assert.equal(source.includes('divinationOneDollarTest: true'), true)
})

async function runTests() {
  for (const { name, fn } of tests) {
    try {
      await fn()
      console.log(`✓ ${name}`)
    } catch (error) {
      console.error(`✗ ${name}`)
      throw error
    }
  }
}

void runTests()
