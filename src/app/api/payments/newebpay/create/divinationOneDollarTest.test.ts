import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { handleCreateNewebPayPaymentRequest } from './handler'
import {
  buildNewebPayPendingPaymentMetadata,
  createNewebPayMpgPaymentData,
  type NewebPayMpgPaymentData,
} from '../../../../../lib/newebpay/paymentForm'
import { validateDivinationReadingPayment } from '../../../../../lib/supabase/divinationReadings'
import { ONE_DOLLAR_TEST_CONFIRMATION_VALUE } from '../../../../../lib/newebpay/oneDollarTestMode'
import { decryptTradeInfo } from '../../../../../lib/newebpay/crypto'
import {
  PaymentRepositoryError,
  type CreatePendingPaymentInput,
  type ExistingPaymentTarget,
} from '../../../../../lib/supabase/payments'
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

function buildPaymentData(input: { itemKey: string; amount?: number; merchantOrderNo?: string }): NewebPayMpgPaymentData {
  return {
    action: 'https://example.test/mpg',
    method: 'POST',
    merchantOrderNo: input.merchantOrderNo ?? merchantOrderNo,
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
    cardId: 'ziwei',
    position: 'upright',
    ...overrides,
  }
}

function createDivinationDeps(
  input: {
    env?: Record<string, string | undefined>
    requester?: { id: string; email: string | null } | null
    useRealPaymentData?: boolean
    reading?: {
      status?: 'pending_payment' | 'paid' | 'interpreting' | 'completed' | 'failed' | 'canceled' | null
      userId?: string | null
      paymentId?: string | null
      merchantOrderNo?: string | null
      cardId?: string | null
      cardName?: string | null
      position?: string | null
    } | null
    drawSelectionResult?: 'updated' | 'not_found' | 'not_payable'
    paymentDataThrows?: boolean
    paymentInsertError?: unknown
    existingPayment?: ExistingPaymentTarget | null
    existingLookupError?: unknown
    linkResult?: 'linked' | 'already_linked' | 'not_found' | 'not_payable'
    linkError?: unknown
    metadataThrows?: boolean
  } = {},
) {
  const calls: {
    paymentDataInputs: Array<Record<string, unknown>>
    pendingPayments: CreatePendingPaymentInput[]
    divinationLinks: Array<Record<string, unknown>>
    drawSelectionUpdates: Array<Record<string, unknown>>
  } = {
    paymentDataInputs: [],
    pendingPayments: [],
    divinationLinks: [],
    drawSelectionUpdates: [],
  }

  return {
    calls,
    deps: {
      env: input.env ?? allFlagsEnv,
      generateMerchantOrderNo: () => merchantOrderNo,
      getRequesterWithEmail: async () => (input.requester === undefined ? adminUser : input.requester),
      getNewebPayConfig: () => fakeConfig,
      buildNewebPayPendingPaymentMetadata: (metadataInput: Parameters<typeof buildNewebPayPendingPaymentMetadata>[0]) => {
        if (input.metadataThrows) throw new Error('invalid metadata')
        return buildNewebPayPendingPaymentMetadata(metadataInput)
      },
      createNewebPayMpgPaymentData: (paymentInput: Parameters<typeof createNewebPayMpgPaymentData>[0]) => {
        calls.paymentDataInputs.push(paymentInput as unknown as Record<string, unknown>)
        if (input.paymentDataThrows) {
          throw new Error('payment_form_create_failed')
        }
        if (input.useRealPaymentData) {
          return createNewebPayMpgPaymentData(paymentInput)
        }
        return buildPaymentData(paymentInput as unknown as { itemKey: string; amount?: number; merchantOrderNo?: string })
      },
      getDivinationReadingPaymentContext: async (lookupReadingId: string) => ({
        id: lookupReadingId,
        userId: input.reading?.userId ?? adminUser.id,
        cardId: input.reading?.cardId ?? null,
        cardName: input.reading?.cardName ?? null,
        position: input.reading?.position ?? null,
        status: input.reading?.status === undefined ? ('pending_payment' as const) : input.reading.status,
        paymentId: input.reading?.paymentId ?? null,
        merchantOrderNo: input.reading?.merchantOrderNo ?? null,
      }),
      validateDivinationReadingPayment,
      getExistingPaymentByItemTarget: async () => {
        if (input.existingLookupError) throw input.existingLookupError
        return input.existingPayment ?? null
      },
      createPendingPayment: async (paymentInput: CreatePendingPaymentInput) => {
        calls.pendingPayments.push(paymentInput)
        if (input.paymentInsertError) throw input.paymentInsertError
        return { id: paymentId }
      },
      updateDivinationReadingDrawSelection: async (updateInput: {
        readingId: string
        cardId: string
        cardName: string
        position: string
      }) => {
        calls.drawSelectionUpdates.push(updateInput)
        return { result: input.drawSelectionResult ?? 'updated', readingId: updateInput.readingId }
      },
      linkDivinationReadingPendingPayment: async (linkInput: {
        readingId: string
        paymentId: string
        merchantOrderNo: string
      }) => {
        calls.divinationLinks.push(linkInput)
        if (input.linkError) throw input.linkError
        return { result: input.linkResult ?? ('linked' as const) }
      },
    },
  }
}

async function readJson(response: Response) {
  return (await response.json()) as Record<string, unknown>
}

// --- 正式價格保持不變（規格 8、9）---

test('一般使用者（未登入、無測試欄位）維持正式 NT$50', async () => {
  const { deps, calls } = createDivinationDeps({ requester: null, useRealPaymentData: true })
  const response = await handleCreateNewebPayPaymentRequest(divinationBody(), deps)

  assert.equal(response.status, 200)
  assert.equal(calls.pendingPayments[0].amountTwd, 50)
  assert.deepEqual(calls.drawSelectionUpdates[0], {
    readingId,
    cardId: 'ziwei',
    cardName: '紫微星',
    position: 'upright',
  })
  assert.equal(calls.paymentDataInputs[0].amount, undefined) // 由 item 預設 50 決定
  const serialized = JSON.stringify(calls.pendingPayments[0].rawPayload)
  assert.equal(serialized.includes('test_payment'), false)

  const fields = (await readJson(response)).fields as Record<string, unknown>
  const params = new URLSearchParams(
    decryptTradeInfo(String(fields.TradeInfo), fakeConfig.hashKey, fakeConfig.hashIv),
  )
  assert.equal(params.get('Amt'), '50')
  assert.equal(params.get('CREDIT'), '1')
  assert.equal(params.get('InstFlag'), '0')
  assert.equal(params.has('APPLEPAY'), false)
})

test('admin＋flags 全開但未選測試模式，仍為 NT$50 信用卡', async () => {
  const { deps, calls } = createDivinationDeps({ useRealPaymentData: true })
  const response = await handleCreateNewebPayPaymentRequest(divinationBody(), deps)

  assert.equal(response.status, 200)
  assert.equal(calls.pendingPayments[0].amountTwd, 50)
  assert.equal(JSON.stringify(calls.pendingPayments[0].rawPayload).includes('test_payment'), false)
  assert.equal(calls.paymentDataInputs[0].paymentMode, 'credit')

  const fields = (await readJson(response)).fields as Record<string, unknown>
  const params = new URLSearchParams(
    decryptTradeInfo(String(fields.TradeInfo), fakeConfig.hashKey, fakeConfig.hashIv),
  )
  assert.equal(params.get('Amt'), '50')
  assert.equal(params.get('CREDIT'), '1')
  assert.equal(params.get('InstFlag'), '0')
  assert.equal(params.has('APPLEPAY'), false)
})

// --- 測試模式授權（規格 5、6、24）---

test('未登入請求測試模式 → 401 且不建立 payment', async () => {
  const { deps, calls } = createDivinationDeps({ requester: null })
  const response = await handleCreateNewebPayPaymentRequest(
    divinationBody({ divinationOneDollarTest: true }),
    deps,
  )

  assert.equal(response.status, 401)
  assert.deepEqual(await readJson(response), { ok: false, error: 'unauthorized' })
  assert.equal(calls.pendingPayments.length, 0)
})

test('非 admin 即使傳 testMode 也拿不到 NT$1（403、不建立 payment）', async () => {
  const { deps, calls } = createDivinationDeps({ requester: memberUser })
  const response = await handleCreateNewebPayPaymentRequest(
    divinationBody({ divinationOneDollarTest: true }),
    deps,
  )

  assert.equal(response.status, 403)
  assert.deepEqual(await readJson(response), { ok: false, error: 'admin_required' })
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
  assert.deepEqual(await readJson(response), { ok: false, error: 'test_mode_disabled' })
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
  assert.deepEqual(await readJson(missingResponse), { ok: false, error: 'test_mode_disabled' })
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
  assert.equal(calls.pendingPayments[0].provider, 'newebpay')
  assert.notEqual(calls.pendingPayments[0].provider, 'line_pay')
  // 傳給 NewebPay MPG 的金額 = 1（Amt=1）
  assert.equal(calls.paymentDataInputs[0].amount, 1)
  // 兩者同源一致（Notify 端以 payments row 金額為對帳基準，同為 1）
  assert.equal(calls.pendingPayments[0].amountTwd, calls.paymentDataInputs[0].amount)
  assert.equal(calls.drawSelectionUpdates.length, 1)
  // 付款工具由 server 授權後派生，client 無法直接指定 Apple Pay。
  assert.equal(calls.paymentDataInputs[0].paymentMode, 'apple_pay_test')
  assert.equal(String(calls.paymentDataInputs[0].itemDesc).includes('管理員 Apple Pay 測試'), true)
  assert.equal(calls.pendingPayments[0].itemName, '紫微牌卡占卜單次')
  assert.equal(calls.pendingPayments[0].itemType, 'ai_divination')
  assert.equal(calls.pendingPayments[0].itemId, readingId)
  assert.equal(calls.pendingPayments[0].userId, adminUser.id)
})

test('占卜付款建立前必須帶完整牌卡資料，避免付款後紀錄尚未抽牌', async () => {
  const { deps, calls } = createDivinationDeps()
  const response = await handleCreateNewebPayPaymentRequest(
    divinationBody({ cardId: undefined, position: undefined }),
    deps,
  )
  const json = await readJson(response)

  assert.equal(response.status, 400)
  assert.deepEqual(json, { ok: false, error: 'reading_card_data_missing' })
  assert.equal(calls.drawSelectionUpdates.length, 0)
  assert.equal(calls.pendingPayments.length, 0)
})

test('舊前端未送 cardId / position 時，從 reading DB 安全恢復牌卡資料', async () => {
  const { deps, calls } = createDivinationDeps({
    reading: {
      cardId: 'ziwei',
      cardName: '紫微星',
      position: 'upright',
    },
  })
  const response = await handleCreateNewebPayPaymentRequest(
    divinationBody({ cardId: undefined, position: undefined, divinationOneDollarTest: true }),
    deps,
  )

  assert.equal(response.status, 200)
  assert.deepEqual(calls.drawSelectionUpdates[0], {
    readingId,
    cardId: 'ziwei',
    cardName: '紫微星',
    position: 'upright',
  })
  assert.equal(calls.pendingPayments.length, 1)
})

test('占卜付款不接受不合法牌卡或正反位資料', async () => {
  const { deps, calls } = createDivinationDeps()
  const response = await handleCreateNewebPayPaymentRequest(
    divinationBody({ cardId: 'not-a-card', position: 'sideways' }),
    deps,
  )
  const json = await readJson(response)

  assert.equal(response.status, 400)
  assert.deepEqual(json, { ok: false, error: 'invalid_divination_draw_selection' })
  assert.equal(calls.drawSelectionUpdates.length, 0)
  assert.equal(calls.pendingPayments.length, 0)
})

test('非本人 reading 不能建立管理員 NT$1 測試付款', async () => {
  const { deps, calls } = createDivinationDeps({ reading: { userId: 'other-user' } })
  const response = await handleCreateNewebPayPaymentRequest(
    divinationBody({ divinationOneDollarTest: true }),
    deps,
  )

  assert.equal(response.status, 404)
  assert.deepEqual(await readJson(response), { ok: false, error: 'reading_not_owned' })
  assert.equal(calls.drawSelectionUpdates.length, 0)
  assert.equal(calls.pendingPayments.length, 0)
})

test('已有 pending payment 時不重複建立付款資料', async () => {
  const { deps, calls } = createDivinationDeps({
    reading: { paymentId, merchantOrderNo },
  })
  const response = await handleCreateNewebPayPaymentRequest(
    divinationBody({ divinationOneDollarTest: true }),
    deps,
  )

  assert.equal(response.status, 409)
  assert.deepEqual(await readJson(response), { ok: false, error: 'payment_duplicate_conflict' })
  assert.equal(calls.drawSelectionUpdates.length, 0)
  assert.equal(calls.pendingPayments.length, 0)
})

test('牌卡資料更新被擋時回 payment_duplicate_conflict，避免泛用失敗', async () => {
  const { deps, calls } = createDivinationDeps({ drawSelectionResult: 'not_payable' })
  const response = await handleCreateNewebPayPaymentRequest(
    divinationBody({ divinationOneDollarTest: true }),
    deps,
  )

  assert.equal(response.status, 409)
  assert.deepEqual(await readJson(response), { ok: false, error: 'payment_duplicate_conflict' })
  assert.equal(calls.drawSelectionUpdates.length, 1)
  assert.equal(calls.pendingPayments.length, 0)
})

test('NewebPay form 建立失敗時回安全 payment_form_create_failed', async () => {
  const { deps, calls } = createDivinationDeps({ paymentDataThrows: true })
  const response = await handleCreateNewebPayPaymentRequest(
    divinationBody({ divinationOneDollarTest: true }),
    deps,
  )

  assert.equal(response.status, 500)
  assert.deepEqual(await readJson(response), { ok: false, error: 'payment_form_create_failed' })
  assert.equal(calls.pendingPayments.length, 1)
  assert.equal(calls.divinationLinks.length, 1)
})

test('payment metadata 無效時不 insert、不 link、不建立 form', async () => {
  const { deps, calls } = createDivinationDeps({ metadataThrows: true })
  const response = await handleCreateNewebPayPaymentRequest(
    divinationBody({ divinationOneDollarTest: true }),
    deps,
  )

  assert.equal(response.status, 400)
  assert.deepEqual(await readJson(response), { ok: false, error: 'payment_metadata_invalid' })
  assert.equal(calls.pendingPayments.length, 0)
  assert.equal(calls.divinationLinks.length, 0)
  assert.equal(calls.paymentDataInputs.length, 0)
})

test('payment insert 失敗時回 payment_insert_failed，且不 link、不建立 form', async () => {
  const { deps, calls } = createDivinationDeps({
    paymentInsertError: new PaymentRepositoryError('missing_required_field'),
  })
  const response = await handleCreateNewebPayPaymentRequest(
    divinationBody({ divinationOneDollarTest: true }),
    deps,
  )

  assert.equal(response.status, 500)
  assert.deepEqual(await readJson(response), { ok: false, error: 'payment_insert_failed' })
  assert.equal(calls.pendingPayments.length, 1)
  assert.equal(calls.divinationLinks.length, 0)
  assert.equal(calls.paymentDataInputs.length, 0)
})

test('merchant order duplicate 回 payment_duplicate_conflict，不 link、不建立 form', async () => {
  const { deps, calls } = createDivinationDeps({
    paymentInsertError: new PaymentRepositoryError('duplicate'),
  })
  const response = await handleCreateNewebPayPaymentRequest(
    divinationBody({ divinationOneDollarTest: true }),
    deps,
  )

  assert.equal(response.status, 409)
  assert.deepEqual(await readJson(response), { ok: false, error: 'payment_duplicate_conflict' })
  assert.equal(calls.divinationLinks.length, 0)
  assert.equal(calls.paymentDataInputs.length, 0)
})

test('同 reading 已有孤立 pending payment 時不再 insert', async () => {
  const { deps, calls } = createDivinationDeps({
    existingPayment: { id: paymentId, status: 'pending', merchantOrderNo },
  })
  const response = await handleCreateNewebPayPaymentRequest(
    divinationBody({ divinationOneDollarTest: true }),
    deps,
  )

  assert.equal(response.status, 409)
  assert.deepEqual(await readJson(response), { ok: false, error: 'payment_duplicate_conflict' })
  assert.equal(calls.pendingPayments.length, 0)
  assert.equal(calls.divinationLinks.length, 0)
  assert.equal(calls.paymentDataInputs.length, 0)
})

test('reading link 失敗時回 payment_reading_link_failed，且不建立 form', async () => {
  const { deps, calls } = createDivinationDeps({ linkError: new Error('raw link failure') })
  const response = await handleCreateNewebPayPaymentRequest(
    divinationBody({ divinationOneDollarTest: true }),
    deps,
  )

  assert.equal(response.status, 500)
  assert.deepEqual(await readJson(response), { ok: false, error: 'payment_reading_link_failed' })
  assert.equal(calls.pendingPayments.length, 1)
  assert.equal(calls.divinationLinks.length, 1)
  assert.equal(calls.paymentDataInputs.length, 0)
})

test('reading 已連結時回 duplicate conflict，且不建立第二份 form', async () => {
  const { deps, calls } = createDivinationDeps({ linkResult: 'already_linked' })
  const response = await handleCreateNewebPayPaymentRequest(
    divinationBody({ divinationOneDollarTest: true }),
    deps,
  )

  assert.equal(response.status, 409)
  assert.deepEqual(await readJson(response), { ok: false, error: 'payment_duplicate_conflict' })
  assert.equal(calls.pendingPayments.length, 1)
  assert.equal(calls.paymentDataInputs.length, 0)
})

test('測試 payment metadata 完整標記', async () => {
  const { deps, calls } = createDivinationDeps()
  await handleCreateNewebPayPaymentRequest(divinationBody({ divinationOneDollarTest: true }), deps)

  const rawPayload = calls.pendingPayments[0].rawPayload as Record<string, unknown>
  assert.equal(rawPayload.amount, 1)
  assert.equal(rawPayload.test_payment, true)
  assert.equal(rawPayload.one_dollar_test_mode, true)
  assert.equal(rawPayload.divination_one_dollar_test, true)
  assert.equal(rawPayload.divination_apple_pay_test, true)
  assert.equal(rawPayload.original_amount, 50)
  assert.equal(rawPayload.test_source, 'divination')
  assert.equal(rawPayload.payment_method, 'apple_pay')
  assert.equal(rawPayload.paymentMode, 'apple_pay_test')
  assert.equal('paymentMethod' in calls.pendingPayments[0], false)
  assert.equal('sourceType' in calls.pendingPayments[0], false)
  // reading 連結照常建立（paid gate 流程不變）
  assert.equal(calls.divinationLinks.length, 1)
  assert.equal((calls.divinationLinks[0] as { readingId?: string }).readingId, readingId)
})

test('admin 測試模式 MPG payload 只送 APPLEPAY=1、InstFlag=0 與 Amt=1', async () => {
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
  assert.equal(params.get('APPLEPAY'), '1')
  assert.equal(params.get('InstFlag'), '0')

  for (const forbidden of [
    'CREDIT',
    'LINEPAY',
    'VACC',
    'ANDROIDPAY',
    'SAMSUNGPAY',
    'WEBATM',
    'CVS',
    'BARCODE',
  ]) {
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

test('前端保留正式按鈕、測試按鈕受 admin 狀態 gate，Apple Pay 由 server 派生', async () => {
  const source = readFileSync(
    join(projectRoot, 'src/components/divination/DivinationDrawPreview.tsx'),
    'utf8',
  )
  // 正式按鈕與文案仍在
  assert.equal(source.includes('信用卡線上付款 NT$${paymentRequired.amountTwd}'), true)
  // 測試按鈕存在且受 isAdminOneDollarTestAvailable 控制
  assert.equal(source.includes('管理員 Apple Pay 測試付款 NT$1'), true)
  assert.equal(source.includes('isAdminOneDollarTestAvailable'), true)
  // Client 維持既有 request shape；server 通過管理員驗證後才派生 Apple Pay。
  assert.equal(source.includes('paymentMode: "credit"'), true)
  assert.equal(source.includes('LINEPAY'), false)
  assert.equal(source.includes('VACC'), false)
  assert.equal(source.includes('apple_pay_test'), false)
  // 測試欄位只在 admin 測試分支加入
  assert.equal(source.includes('divinationOneDollarTest: true'), true)
  assert.equal(source.includes('reading_card_data_missing'), true)
  assert.equal(source.includes('payment_already_exists'), true)
  assert.equal(source.includes('payment_duplicate_conflict'), true)
  assert.equal(source.includes('payment_insert_failed'), true)
  assert.equal(source.includes('payment_reading_link_failed'), true)
  assert.equal(source.includes('payment_metadata_invalid'), true)
  assert.equal(source.includes('test_mode_disabled'), true)
  assert.equal(source.includes('admin_required'), true)
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
