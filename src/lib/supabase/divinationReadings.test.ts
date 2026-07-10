import assert from 'node:assert/strict'
import {
  buildDivinationCompletedUpdatePayload,
  buildDivinationFailedUpdatePayload,
  buildDivinationInterpretingUpdatePayload,
  buildDivinationPaidUpdatePayload,
  buildDivinationPendingPaymentLinkPayload,
  buildDivinationDrawSelectionUpdatePayload,
  buildPendingDivinationReadingPayload,
  decideDivinationInterpretationStart,
  decideDivinationPendingPaymentLink,
  decideDivinationPaidUpdate,
  getDivinationReadingForInterpretation,
  getDivinationReadingResumeContextForUser,
  getDivinationReadingForUser,
  listDivinationReadingsForUser,
  mapAccountDivinationReadingDetail,
  mapAccountDivinationReadingListItem,
  mapDivinationReadingPaymentContext,
  markDivinationReadingCompleted,
  normalizeAccountDivinationListLimit,
  markDivinationReadingFailed,
  markDivinationReadingInterpreting,
  startDivinationReadingInterpretationIfPaid,
  updateDivinationReadingDrawSelection,
  validateDivinationReadingPayment,
  type DivinationReadingPaidSyncRow,
  type DivinationReadingStatus,
} from './divinationReadings'

type MockSupabaseClient = NonNullable<Parameters<typeof getDivinationReadingForInterpretation>[1]>
type MockSupabaseResponse = {
  data: unknown | null
  error: { message: string } | null
}
type MockSupabaseCalls = {
  tables: string[]
  selects: string[]
  updates: Record<string, unknown>[]
  eqs: Array<[string, unknown]>
  isCalls: Array<[string, unknown]>
}

function createMockSupabase(response: MockSupabaseResponse): {
  supabase: MockSupabaseClient
  calls: MockSupabaseCalls
} {
  const calls: MockSupabaseCalls = {
    tables: [],
    selects: [],
    updates: [],
    eqs: [],
    isCalls: [],
  }
  const chain = {
    select(columns: string) {
      calls.selects.push(columns)
      return chain
    },
    update(payload: Record<string, unknown>) {
      calls.updates.push(payload)
      return chain
    },
    eq(column: string, value: unknown) {
      calls.eqs.push([column, value])
      return chain
    },
    is(column: string, value: unknown) {
      calls.isCalls.push([column, value])
      return chain
    },
    async maybeSingle() {
      return response
    },
  }
  const supabase = {
    from(table: string) {
      calls.tables.push(table)
      return chain
    },
  }

  return {
    supabase: supabase as unknown as MockSupabaseClient,
    calls,
  }
}

function assertNoUnsafeSelect(calls: MockSupabaseCalls) {
  for (const columns of calls.selects) {
    assert.equal(columns.includes('question'), false)
    assert.equal(columns.includes('raw_payload'), false)
    assert.equal(columns.includes('payment_id'), false)
    assert.equal(columns.includes('merchant_order_no'), false)
    assert.equal(columns.includes('paid_at'), false)
  }
}

function assertNoUnsafeUpdatePayload(payload: Record<string, unknown>) {
  assert.equal('payment_id' in payload, false)
  assert.equal('merchant_order_no' in payload, false)
  assert.equal('paid_at' in payload, false)
  assert.equal('question' in payload, false)
  assert.equal('raw_payload' in payload, false)
  assert.equal('TradeInfo' in payload, false)
  assert.equal('TradeSha' in payload, false)
  assert.equal('HashKey' in payload, false)
  assert.equal('HashIV' in payload, false)
  assert.equal('booking_id' in payload, false)
  assert.equal('course_id' in payload, false)
  assert.equal('product_id' in payload, false)
}

const pendingPayload = buildPendingDivinationReadingPayload(
  {
    userId: 'user-1',
    externalReadingId: 'local-reading-1',
    question: '我這週工作要注意什麼？',
    drawMode: 'manual',
    source: 'ai_divination',
    rawPayload: {
      amount: 50,
      source: 'ai_divination',
    },
  },
  '2026-07-05T12:00:00.000Z',
)

assert.deepEqual(pendingPayload, {
  user_id: 'user-1',
  external_reading_id: 'local-reading-1',
  question: '我這週工作要注意什麼？',
  draw_mode: 'manual',
  card_id: null,
  card_name: null,
  position: null,
  status: 'pending_payment',
  source: 'ai_divination',
  raw_payload: {
    amount: 50,
    source: 'ai_divination',
  },
  updated_at: '2026-07-05T12:00:00.000Z',
})

const pendingPayloadWithDraw = buildPendingDivinationReadingPayload(
  {
    question: '感情下一步怎麼做？',
    drawMode: 'auto',
    cardId: 'ziwei',
    cardName: '紫微星',
    position: 'upright',
  },
  '2026-07-05T12:10:00.000Z',
)

assert.equal(pendingPayloadWithDraw.status, 'pending_payment')
assert.equal(pendingPayloadWithDraw.card_id, 'ziwei')
assert.equal(pendingPayloadWithDraw.card_name, '紫微星')
assert.equal(pendingPayloadWithDraw.position, 'upright')
assert.equal(pendingPayloadWithDraw.user_id, null)
assert.equal(pendingPayloadWithDraw.external_reading_id, null)
assert.equal(pendingPayloadWithDraw.source, 'waterbottle-ai-divination')

const pendingPayloadForDbCreate = buildPendingDivinationReadingPayload(
  {
    externalReadingId: 'local-reading-2',
    question: '我今天適合怎麼面對工作？',
    drawMode: 'manual',
    rawPayload: {
      source: 'ai_divination',
      flow: 'readings_create',
      localReadingId: 'local-reading-2',
      amount: 50,
      TradeInfo: 'unsafe-trade-info',
      TradeSha: 'unsafe-trade-sha',
      HashKey: 'unsafe-hash-key',
      HashIV: 'unsafe-hash-iv',
      interpretation: 'unsafe-interpretation',
    },
  },
  '2026-07-05T12:20:00.000Z',
)

assert.equal(pendingPayloadForDbCreate.question, '我今天適合怎麼面對工作？')
assert.equal(pendingPayloadForDbCreate.status, 'pending_payment')
assert.equal(pendingPayloadForDbCreate.source, 'waterbottle-ai-divination')
assert.deepEqual(pendingPayloadForDbCreate.raw_payload, {
  source: 'ai_divination',
  flow: 'readings_create',
  localReadingId: 'local-reading-2',
  amount: 50,
})
assert.equal(pendingPayloadForDbCreate.card_id, null)
assert.equal(pendingPayloadForDbCreate.card_name, null)
assert.equal(pendingPayloadForDbCreate.position, null)
assert.equal('TradeInfo' in pendingPayloadForDbCreate.raw_payload, false)
assert.equal('TradeSha' in pendingPayloadForDbCreate.raw_payload, false)
assert.equal('HashKey' in pendingPayloadForDbCreate.raw_payload, false)
assert.equal('HashIV' in pendingPayloadForDbCreate.raw_payload, false)
assert.equal('interpretation' in pendingPayloadForDbCreate.raw_payload, false)

const drawSelectionPayload = buildDivinationDrawSelectionUpdatePayload(
  {
    cardId: 'ziwei',
    cardName: '紫微星',
    position: 'upright',
  },
  '2026-07-05T12:21:00.000Z',
)

assert.deepEqual(drawSelectionPayload, {
  card_id: 'ziwei',
  card_name: '紫微星',
  position: 'upright',
  updated_at: '2026-07-05T12:21:00.000Z',
})
assertNoUnsafeUpdatePayload(drawSelectionPayload)

const paidPayload = buildDivinationPaidUpdatePayload(
  {
    paymentId: 'payment-1',
    merchantOrderNo: 'WB20260705121212ABCD',
    paidAt: '2026-07-05T12:12:12.000Z',
  },
  '2026-07-05T12:13:00.000Z',
)

assert.deepEqual(paidPayload, {
  payment_id: 'payment-1',
  merchant_order_no: 'WB20260705121212ABCD',
  status: 'paid',
  paid_at: '2026-07-05T12:12:12.000Z',
  updated_at: '2026-07-05T12:13:00.000Z',
})

const pendingPaymentLinkPayload = buildDivinationPendingPaymentLinkPayload(
  {
    paymentId: 'payment-link-1',
    merchantOrderNo: 'WB20260705130000LINK',
  },
  '2026-07-05T13:00:00.000Z',
)

assert.deepEqual(pendingPaymentLinkPayload, {
  payment_id: 'payment-link-1',
  merchant_order_no: 'WB20260705130000LINK',
  updated_at: '2026-07-05T13:00:00.000Z',
})
assert.equal('status' in pendingPaymentLinkPayload, false)
assert.equal('question' in pendingPaymentLinkPayload, false)
assert.equal('interpretation' in pendingPaymentLinkPayload, false)
assert.equal('paid_at' in pendingPaymentLinkPayload, false)
assert.equal('interpreted_at' in pendingPaymentLinkPayload, false)
assert.equal('TradeInfo' in pendingPaymentLinkPayload, false)
assert.equal('TradeSha' in pendingPaymentLinkPayload, false)
assert.equal('HashKey' in pendingPaymentLinkPayload, false)
assert.equal('HashIV' in pendingPaymentLinkPayload, false)
assert.equal('booking_id' in pendingPaymentLinkPayload, false)
assert.equal('course_id' in pendingPaymentLinkPayload, false)
assert.equal('product_id' in pendingPaymentLinkPayload, false)

const interpretingPayload = buildDivinationInterpretingUpdatePayload('2026-07-05T13:10:00.000Z')

assert.deepEqual(interpretingPayload, {
  status: 'interpreting',
  updated_at: '2026-07-05T13:10:00.000Z',
})
assert.equal('payment_id' in interpretingPayload, false)
assert.equal('merchant_order_no' in interpretingPayload, false)
assert.equal('paid_at' in interpretingPayload, false)
assert.equal('interpretation' in interpretingPayload, false)
assert.equal('interpreted_at' in interpretingPayload, false)
assert.equal('question' in interpretingPayload, false)

const completedPayload = buildDivinationCompletedUpdatePayload(
  {
    interpretation: {
      summary: '先穩住節奏，再做選擇。',
      cards: ['紫微星'],
    },
    resultSummary: '先穩住節奏，再做選擇。',
    interpretedAt: '2026-07-05T13:20:00.000Z',
  },
  '2026-07-05T13:21:00.000Z',
)

assert.deepEqual(completedPayload, {
  status: 'completed',
  interpretation: {
    summary: '先穩住節奏，再做選擇。',
    cards: ['紫微星'],
  },
  result_summary: '先穩住節奏，再做選擇。',
  interpreted_at: '2026-07-05T13:20:00.000Z',
  updated_at: '2026-07-05T13:21:00.000Z',
  error_message: null,
})
assert.equal('payment_id' in completedPayload, false)
assert.equal('merchant_order_no' in completedPayload, false)
assert.equal('paid_at' in completedPayload, false)
assert.equal('question' in completedPayload, false)
assert.equal('TradeInfo' in completedPayload, false)
assert.equal('TradeSha' in completedPayload, false)
assert.equal('HashKey' in completedPayload, false)
assert.equal('HashIV' in completedPayload, false)

const completedPayloadWithoutSummary = buildDivinationCompletedUpdatePayload(
  {
    interpretation: {
      summary: '完成解讀。',
    },
    resultSummary: '   ',
    interpretedAt: null,
  },
  '2026-07-05T13:22:00.000Z',
)

assert.equal(completedPayloadWithoutSummary.interpreted_at, '2026-07-05T13:22:00.000Z')
assert.equal('result_summary' in completedPayloadWithoutSummary, false)

const failedPayload = buildDivinationFailedUpdatePayload(
  {
    errorMessage: 'OpenAI 解讀暫時失敗',
  },
  '2026-07-05T13:30:00.000Z',
)

assert.deepEqual(failedPayload, {
  status: 'failed',
  error_message: 'OpenAI 解讀暫時失敗',
  updated_at: '2026-07-05T13:30:00.000Z',
})
assert.equal('payment_id' in failedPayload, false)
assert.equal('merchant_order_no' in failedPayload, false)
assert.equal('paid_at' in failedPayload, false)
assert.equal('interpretation' in failedPayload, false)
assert.equal('interpreted_at' in failedPayload, false)
assert.equal('TradeInfo' in failedPayload, false)
assert.equal('TradeSha' in failedPayload, false)
assert.equal('HashKey' in failedPayload, false)
assert.equal('HashIV' in failedPayload, false)

const paidPayloadWithDefaultDate = buildDivinationPaidUpdatePayload(
  {
    paymentId: 'payment-2',
    merchantOrderNo: 'WB20260705121300DCBA',
    paidAt: null,
  },
  '2026-07-05T12:13:00.000Z',
)

assert.equal(paidPayloadWithDefaultDate.paid_at, '2026-07-05T12:13:00.000Z')

const pendingReading: DivinationReadingPaidSyncRow = {
  id: 'reading-1',
  status: 'pending_payment',
  payment_id: null,
}

const nullStatusReading: DivinationReadingPaidSyncRow = {
  id: 'reading-2',
  status: null,
}

const paidReading: DivinationReadingPaidSyncRow = {
  id: 'reading-3',
  status: 'paid',
  payment_id: 'payment-1',
}

const interpretingReading: DivinationReadingPaidSyncRow = {
  id: 'reading-4',
  status: 'interpreting',
}

const completedReading: DivinationReadingPaidSyncRow = {
  id: 'reading-5',
  status: 'completed',
}

const failedReading: DivinationReadingPaidSyncRow = {
  id: 'reading-6',
  status: 'failed',
}

const canceledReading: DivinationReadingPaidSyncRow = {
  id: 'reading-7',
  status: 'canceled',
}

const completedInterpretation = {
  summary: '已完成的解讀',
}

assert.deepEqual(decideDivinationPaidUpdate(null), { result: 'not_found' })
assert.deepEqual(decideDivinationPaidUpdate(pendingReading), { result: 'should_update' })
assert.deepEqual(decideDivinationPaidUpdate(nullStatusReading), { result: 'should_update' })
assert.deepEqual(decideDivinationPaidUpdate(paidReading), { result: 'already_paid' })
assert.deepEqual(decideDivinationPaidUpdate(interpretingReading), { result: 'already_paid' })
assert.deepEqual(decideDivinationPaidUpdate(completedReading), { result: 'already_paid' })
assert.deepEqual(decideDivinationPaidUpdate(failedReading), { result: 'already_paid' })
assert.deepEqual(decideDivinationPaidUpdate(canceledReading), {
  result: 'invalid_state',
  status: 'canceled',
})

assert.deepEqual(decideDivinationInterpretationStart(null), { result: 'not_found' })
assert.deepEqual(
  decideDivinationInterpretationStart({
    id: 'reading-interpret-1',
    status: 'paid',
  }),
  { result: 'should_interpret' },
)
assert.deepEqual(
  decideDivinationInterpretationStart({
    id: 'reading-interpret-2',
    status: 'pending_payment',
  }),
  { result: 'payment_required' },
)
assert.deepEqual(
  decideDivinationInterpretationStart({
    id: 'reading-interpret-3',
    status: null,
  }),
  { result: 'payment_required' },
)
assert.deepEqual(
  decideDivinationInterpretationStart({
    id: 'reading-interpret-4',
    status: 'interpreting',
  }),
  { result: 'already_interpreting' },
)
assert.deepEqual(
  decideDivinationInterpretationStart({
    id: 'reading-interpret-5',
    status: 'completed',
    interpretation: completedInterpretation,
  }),
  {
    result: 'already_completed',
    interpretation: completedInterpretation,
  },
)
assert.deepEqual(
  decideDivinationInterpretationStart({
    id: 'reading-interpret-6',
    status: 'completed',
  }),
  {
    result: 'already_completed',
    interpretation: null,
  },
)
assert.deepEqual(
  decideDivinationInterpretationStart({
    id: 'reading-interpret-7',
    status: 'failed',
  }),
  {
    result: 'invalid_state',
    status: 'failed',
  },
)
assert.deepEqual(
  decideDivinationInterpretationStart({
    id: 'reading-interpret-8',
    status: 'canceled',
  }),
  {
    result: 'invalid_state',
    status: 'canceled',
  },
)

assert.deepEqual(decideDivinationPendingPaymentLink(null), { result: 'not_found' })
assert.deepEqual(
  decideDivinationPendingPaymentLink({
    id: 'reading-link-1',
    status: 'pending_payment',
    payment_id: null,
    merchant_order_no: null,
  }),
  { result: 'should_link' },
)
assert.deepEqual(
  decideDivinationPendingPaymentLink({
    id: 'reading-link-2',
    status: null,
    payment_id: null,
    merchant_order_no: null,
  }),
  { result: 'should_link' },
)
assert.deepEqual(
  decideDivinationPendingPaymentLink({
    id: 'reading-link-3',
    status: 'pending_payment',
    payment_id: 'payment-link-3',
    merchant_order_no: null,
  }),
  { result: 'already_linked' },
)
assert.deepEqual(
  decideDivinationPendingPaymentLink({
    id: 'reading-link-4',
    status: 'pending_payment',
    payment_id: null,
    merchant_order_no: 'WB20260705130400LINK',
  }),
  { result: 'already_linked' },
)

const notPayableLinkStatuses: DivinationReadingStatus[] = [
  'paid',
  'interpreting',
  'completed',
  'failed',
  'canceled',
]

for (const status of notPayableLinkStatuses) {
  assert.deepEqual(
    decideDivinationPendingPaymentLink({
      id: `reading-link-${status}`,
      status,
      payment_id: null,
      merchant_order_no: null,
    }),
    {
      result: 'not_payable',
      status,
    },
  )
}

const paymentContext = mapDivinationReadingPaymentContext({
  id: '2df1a8da-3893-4b81-8d00-774a9cc0e472',
  status: 'pending_payment',
  payment_id: null,
  merchant_order_no: null,
})

assert.deepEqual(paymentContext, {
  id: '2df1a8da-3893-4b81-8d00-774a9cc0e472',
  status: 'pending_payment',
  paymentId: null,
  merchantOrderNo: null,
})
assert.deepEqual(validateDivinationReadingPayment(null), {
  ok: false,
  error: 'divination_reading_not_found',
})
assert.deepEqual(validateDivinationReadingPayment(paymentContext), { ok: true })
assert.deepEqual(
  validateDivinationReadingPayment({
    ...paymentContext,
    status: null,
  }),
  { ok: true },
)
assert.deepEqual(
  validateDivinationReadingPayment({
    ...paymentContext,
    status: 'paid',
  }),
  { ok: false, error: 'divination_reading_not_payable' },
)
assert.deepEqual(
  validateDivinationReadingPayment({
    ...paymentContext,
    status: 'completed',
  }),
  { ok: false, error: 'divination_reading_not_payable' },
)
assert.deepEqual(
  validateDivinationReadingPayment({
    ...paymentContext,
    paymentId: '4db88892-e602-40e3-9bcd-4595a0dcfb95',
  }),
  { ok: false, error: 'divination_reading_not_payable' },
)
assert.deepEqual(
  validateDivinationReadingPayment({
    ...paymentContext,
    merchantOrderNo: 'WB20260705143000ABCD',
  }),
  { ok: false, error: 'divination_reading_not_payable' },
)

assert.equal('TradeInfo' in pendingPayload, false)
assert.equal('TradeSha' in pendingPayload, false)
assert.equal('HashKey' in pendingPayload, false)
assert.equal('HashIV' in pendingPayload, false)
assert.equal('card_number' in pendingPayload, false)
assert.equal('booking_id' in pendingPayload, false)
assert.equal('course_id' in pendingPayload, false)
assert.equal('product_id' in pendingPayload, false)
assert.equal('booking_status' in paidPayload, false)
assert.equal('course_purchase_id' in paidPayload, false)
assert.equal('spiritual_product' in paidPayload, false)
assert.equal('booking_status' in pendingPaymentLinkPayload, false)
assert.equal('course_purchase_id' in pendingPaymentLinkPayload, false)
assert.equal('spiritual_product' in pendingPaymentLinkPayload, false)
assert.equal('booking_status' in interpretingPayload, false)
assert.equal('course_purchase_id' in interpretingPayload, false)
assert.equal('spiritual_product' in interpretingPayload, false)
assert.equal('booking_status' in completedPayload, false)
assert.equal('course_purchase_id' in completedPayload, false)
assert.equal('spiritual_product' in completedPayload, false)
assert.equal('booking_status' in failedPayload, false)
assert.equal('course_purchase_id' in failedPayload, false)
assert.equal('spiritual_product' in failedPayload, false)

assert.throws(
  () =>
    buildPendingDivinationReadingPayload({
      question: '',
    }),
  /question/,
)

assert.throws(
  () =>
    buildDivinationPaidUpdatePayload({
      paymentId: '',
      merchantOrderNo: 'WB20260705121212ABCD',
    }),
  /paymentId/,
)

assert.throws(
  () =>
    buildDivinationPaidUpdatePayload({
      paymentId: 'payment-1',
      merchantOrderNo: '',
    }),
  /merchantOrderNo/,
)

assert.throws(
  () =>
    buildDivinationPendingPaymentLinkPayload({
      paymentId: '',
      merchantOrderNo: 'WB20260705121212ABCD',
    }),
  /paymentId/,
)

assert.throws(
  () =>
    buildDivinationPendingPaymentLinkPayload({
      paymentId: 'payment-1',
      merchantOrderNo: '',
    }),
  /merchantOrderNo/,
)

assert.throws(
  () =>
    buildDivinationFailedUpdatePayload({
      errorMessage: '',
    }),
  /errorMessage/,
)

// --- 會員歸戶保留（22J-39）：任何 update payload 都不可觸碰 user_id ---
// paid sync / pending link / interpreting / completed / failed 皆為 partial update，
// 不包含 user_id 欄位，因此付款與解讀流程不會清掉 create 時寫入的會員歸戶。

{
  const ownershipNow = '2026-07-09T12:00:00.000Z'
  const updatePayloadsThatMustNotTouchUserId: Array<Record<string, unknown>> = [
    buildDivinationPaidUpdatePayload(
      { paymentId: 'payment-1', merchantOrderNo: 'WB20260709120000TEST' },
      ownershipNow,
    ),
    buildDivinationPendingPaymentLinkPayload(
      { paymentId: 'payment-1', merchantOrderNo: 'WB20260709120000TEST' },
      ownershipNow,
    ),
    buildDivinationInterpretingUpdatePayload(ownershipNow),
    buildDivinationCompletedUpdatePayload(
      { interpretation: { summary: '完成' }, resultSummary: '完成' },
      ownershipNow,
    ),
    buildDivinationFailedUpdatePayload({ errorMessage: 'OpenAI 失敗' }, ownershipNow),
  ]

  for (const payload of updatePayloadsThatMustNotTouchUserId) {
    assert.equal('user_id' in payload, false)
    assert.equal('userId' in payload, false)
  }

  // 未登入（匿名）仍可建立 reading：user_id 為 null，localUserId 流程不受影響。
  const anonymousPayload = buildPendingDivinationReadingPayload(
    { question: '匿名使用者的問題', drawMode: 'manual' },
    ownershipNow,
  )
  assert.equal(anonymousPayload.user_id, null)

  // 已登入：user_id 寫入 Supabase auth user id；空白字串視為未登入。
  const ownedPayload = buildPendingDivinationReadingPayload(
    { userId: '5f0b8f2e-1234-4c56-9abc-def012345678', question: '登入使用者的問題', drawMode: 'auto' },
    ownershipNow,
  )
  assert.equal(ownedPayload.user_id, '5f0b8f2e-1234-4c56-9abc-def012345678')

  const blankUserPayload = buildPendingDivinationReadingPayload(
    { userId: '   ', question: '空白 userId 的問題', drawMode: 'manual' },
    ownershipNow,
  )
  assert.equal(blankUserPayload.user_id, null)
}

// --- 會員本人查詢（22J-42：我的占卜紀錄）---

{
  // limit 正規化：預設 20、上限 50、不合法值回預設
  assert.equal(normalizeAccountDivinationListLimit(undefined), 20)
  assert.equal(normalizeAccountDivinationListLimit(null), 20)
  assert.equal(normalizeAccountDivinationListLimit(''), 20)
  assert.equal(normalizeAccountDivinationListLimit('abc'), 20)
  assert.equal(normalizeAccountDivinationListLimit(0), 20)
  assert.equal(normalizeAccountDivinationListLimit(-5), 20)
  assert.equal(normalizeAccountDivinationListLimit('10'), 10)
  assert.equal(normalizeAccountDivinationListLimit(10.9), 10)
  assert.equal(normalizeAccountDivinationListLimit(50), 50)
  assert.equal(normalizeAccountDivinationListLimit('999'), 50)
  assert.equal(normalizeAccountDivinationListLimit(Number.POSITIVE_INFINITY), 20)

  const completedRow = {
    id: 'reading-1',
    question: '工作方向？',
    card_name: '紫微星',
    position: 'upright',
    draw_mode: 'manual',
    status: 'completed' as const,
    created_at: '2026-07-09T16:08:00.000Z',
    interpreted_at: '2026-07-09T16:10:00.000Z',
    result_summary: '整體穩定',
  }

  const listItem = mapAccountDivinationReadingListItem(completedRow)
  assert.equal(listItem.id, 'reading-1')
  assert.equal(listItem.cardName, '紫微星')
  assert.equal(listItem.hasInterpretation, true)
  assert.equal(listItem.resultSummary, '整體穩定')
  // 列表項不得含 interpretation / user_id / raw_payload / payment 欄位
  const listItemKeys = JSON.stringify(listItem)
  assert.equal(listItemKeys.includes('interpretation'), false)
  assert.equal(listItemKeys.includes('user_id'), false)
  assert.equal(listItemKeys.includes('raw_payload'), false)
  assert.equal(listItemKeys.includes('payment'), false)

  const pendingItem = mapAccountDivinationReadingListItem({
    ...completedRow,
    status: 'pending_payment' as const,
    interpreted_at: null,
    result_summary: null,
  })
  assert.equal(pendingItem.hasInterpretation, false)

  // detail：completed 才輸出 interpretation
  const interpretation = { summary: '解讀內容' }
  const completedDetail = mapAccountDivinationReadingDetail({ ...completedRow, interpretation })
  assert.deepEqual(completedDetail.interpretation, interpretation)

  const pendingDetail = mapAccountDivinationReadingDetail({
    ...completedRow,
    status: 'pending_payment' as const,
    interpretation,
  })
  assert.equal(pendingDetail.interpretation, null)

  const failedDetail = mapAccountDivinationReadingDetail({
    ...completedRow,
    status: 'failed' as const,
    interpretation,
  })
  assert.equal(failedDetail.interpretation, null)
}

type AccountQueryCalls = {
  tables: string[]
  selects: string[]
  eqs: Array<[string, unknown]>
  orders: Array<[string, unknown]>
  limits: number[]
}

function createAccountReadingsMockSupabase(response: { data: unknown; error: { message: string } | null }) {
  const calls: AccountQueryCalls = { tables: [], selects: [], eqs: [], orders: [], limits: [] }
  const chain = {
    select(columns: string) {
      calls.selects.push(columns)
      return chain
    },
    eq(column: string, value: unknown) {
      calls.eqs.push([column, value])
      return chain
    },
    order(column: string, options: unknown) {
      calls.orders.push([column, options])
      return chain
    },
    limit(count: number) {
      calls.limits.push(count)
      return Promise.resolve(response)
    },
    maybeSingle() {
      return Promise.resolve(response)
    },
  }
  const supabase = {
    from(table: string) {
      calls.tables.push(table)
      return chain
    },
  }

  return { supabase: supabase as unknown as MockSupabaseClient, calls }
}

async function accountQueriesMain() {
  const completedRow = {
    id: 'reading-1',
    question: '工作方向？',
    card_name: '紫微星',
    position: 'upright',
    draw_mode: 'manual',
    status: 'completed',
    created_at: '2026-07-09T16:08:00.000Z',
    interpreted_at: '2026-07-09T16:10:00.000Z',
    result_summary: null,
  }

  // list：以 user_id 過濾＋新到舊＋預設 20 筆，select 不含敏感欄位
  const listMock = createAccountReadingsMockSupabase({ data: [completedRow], error: null })
  const items = await listDivinationReadingsForUser('user-a', {}, listMock.supabase)

  assert.equal(items.length, 1)
  assert.equal(items[0].id, 'reading-1')
  assert.deepEqual(listMock.calls.tables, ['divination_readings'])
  assert.deepEqual(listMock.calls.eqs, [['user_id', 'user-a']])
  assert.deepEqual(listMock.calls.orders, [['created_at', { ascending: false }]])
  assert.deepEqual(listMock.calls.limits, [20])

  const listColumns = listMock.calls.selects[0]
  assert.equal(listColumns.includes('interpretation'), false)
  assert.equal(listColumns.includes('raw_payload'), false)
  assert.equal(listColumns.includes('payment_id'), false)
  assert.equal(listColumns.includes('merchant_order_no'), false)
  assert.equal(listColumns.includes('user_id'), false)

  // limit 上限 50
  const cappedMock = createAccountReadingsMockSupabase({ data: [], error: null })
  await listDivinationReadingsForUser('user-a', { limit: '999' }, cappedMock.supabase)
  assert.deepEqual(cappedMock.calls.limits, [50])

  // 空 userId 直接拒絕（不可能列出匿名 user_id=null 紀錄）
  await assert.rejects(() => listDivinationReadingsForUser('   ', {}, listMock.supabase), /userId/)

  // detail：同時以 id 與 user_id 過濾；查無 → null
  const detailMock = createAccountReadingsMockSupabase({
    data: { ...completedRow, interpretation: { summary: '內容' } },
    error: null,
  })
  const detail = await getDivinationReadingForUser('reading-1', 'user-a', detailMock.supabase)

  assert.equal(detail?.id, 'reading-1')
  assert.deepEqual(detail?.interpretation, { summary: '內容' })
  assert.deepEqual(detailMock.calls.eqs, [
    ['id', 'reading-1'],
    ['user_id', 'user-a'],
  ])
  assert.equal(detailMock.calls.selects[0].includes('interpretation'), true)
  assert.equal(detailMock.calls.selects[0].includes('raw_payload'), false)

  const missingMock = createAccountReadingsMockSupabase({ data: null, error: null })
  const missing = await getDivinationReadingForUser('reading-x', 'user-a', missingMock.supabase)
  assert.equal(missing, null)
}

async function main() {
  const readingId = 'ec34c86a-d6e2-424e-9a37-48cef981b3bc'
  const existingInterpretation = {
    summary: '已完成的解讀',
  }
  const getMock = createMockSupabase({
    data: {
      id: readingId,
      status: 'completed',
      interpretation: existingInterpretation,
    },
    error: null,
  })
  const interpretationContext = await getDivinationReadingForInterpretation(readingId, getMock.supabase)

  assert.deepEqual(interpretationContext, {
    id: readingId,
    status: 'completed',
    interpretation: existingInterpretation,
  })
  assert.deepEqual(getMock.calls.tables, ['divination_readings'])
  assert.deepEqual(getMock.calls.selects, ['id,status,interpretation'])
  assert.deepEqual(getMock.calls.eqs, [['id', readingId]])
  assert.equal(getMock.calls.updates.length, 0)
  assertNoUnsafeSelect(getMock.calls)

  const missingGetMock = createMockSupabase({
    data: null,
    error: null,
  })

  assert.equal(await getDivinationReadingForInterpretation(readingId, missingGetMock.supabase), null)

  const resumeMock = createMockSupabase({
    data: {
      id: readingId,
      user_id: 'user-a',
      question: '工作方向？',
      draw_mode: 'manual',
      card_id: 'ziwei',
      card_name: '紫微星',
      position: 'upright',
      status: 'paid',
      interpretation: null,
      payment_id: 'payment-1',
      merchant_order_no: 'WB20260710181818DIV',
    },
    error: null,
  })
  const resumeContext = await getDivinationReadingResumeContextForUser(readingId, 'user-a', resumeMock.supabase)

  assert.deepEqual(resumeContext, {
    id: readingId,
    userId: 'user-a',
    question: '工作方向？',
    drawMode: 'manual',
    cardId: 'ziwei',
    cardName: '紫微星',
    position: 'upright',
    status: 'paid',
    interpretation: null,
    paymentId: 'payment-1',
    merchantOrderNo: 'WB20260710181818DIV',
  })
  assert.deepEqual(resumeMock.calls.eqs, [
    ['id', readingId],
    ['user_id', 'user-a'],
  ])
  assert.equal(resumeMock.calls.selects[0].includes('raw_payload'), false)
  assert.equal(resumeMock.calls.selects[0].includes('TradeInfo'), false)
  assert.equal(resumeMock.calls.selects[0].includes('HashKey'), false)

  const interpretingMock = createMockSupabase({
    data: { id: readingId },
    error: null,
  })
  const interpretingResult = await markDivinationReadingInterpreting(readingId, interpretingMock.supabase)

  assert.deepEqual(interpretingResult, { result: 'updated', readingId })
  assert.deepEqual(interpretingMock.calls.tables, ['divination_readings'])
  assert.deepEqual(interpretingMock.calls.eqs, [['id', readingId]])
  assert.deepEqual(interpretingMock.calls.selects, ['id'])
  assert.equal(interpretingMock.calls.updates.length, 1)
  assert.equal(interpretingMock.calls.updates[0].status, 'interpreting')
  assert.equal(typeof interpretingMock.calls.updates[0].updated_at, 'string')
  assertNoUnsafeSelect(interpretingMock.calls)
  assertNoUnsafeUpdatePayload(interpretingMock.calls.updates[0])

  const paidStartMock = createMockSupabase({
    data: { id: readingId },
    error: null,
  })
  const paidStartResult = await startDivinationReadingInterpretationIfPaid(readingId, paidStartMock.supabase)

  assert.deepEqual(paidStartResult, { result: 'updated', readingId })
  assert.deepEqual(paidStartMock.calls.eqs, [
    ['id', readingId],
    ['status', 'paid'],
  ])
  assert.equal(paidStartMock.calls.updates[0].status, 'interpreting')
  assertNoUnsafeUpdatePayload(paidStartMock.calls.updates[0])

  const drawUpdateMock = createMockSupabase({
    data: { id: readingId },
    error: null,
  })
  const drawUpdateResult = await updateDivinationReadingDrawSelection(
    {
      readingId,
      cardId: 'ziwei',
      cardName: '紫微星',
      position: 'upright',
    },
    drawUpdateMock.supabase,
  )

  assert.deepEqual(drawUpdateResult, { result: 'updated', readingId })
  assert.deepEqual(drawUpdateMock.calls.eqs, [
    ['id', readingId],
    ['status', 'pending_payment'],
  ])
  assert.deepEqual(drawUpdateMock.calls.isCalls, [['payment_id', null]])
  assert.equal(drawUpdateMock.calls.updates[0].card_id, 'ziwei')
  assert.equal(drawUpdateMock.calls.updates[0].card_name, '紫微星')
  assert.equal(drawUpdateMock.calls.updates[0].position, 'upright')
  assertNoUnsafeUpdatePayload(drawUpdateMock.calls.updates[0])

  const completedMock = createMockSupabase({
    data: { id: readingId },
    error: null,
  })
  const completedResult = await markDivinationReadingCompleted(
    {
      readingId,
      interpretation: {
        summary: '完成解讀',
      },
      resultSummary: '完成解讀',
      interpretedAt: '2026-07-05T14:00:00.000Z',
    },
    completedMock.supabase,
  )

  assert.deepEqual(completedResult, { result: 'updated', readingId })
  assert.equal(completedMock.calls.updates.length, 1)
  assert.deepEqual(completedMock.calls.updates[0], {
    status: 'completed',
    interpretation: {
      summary: '完成解讀',
    },
    result_summary: '完成解讀',
    interpreted_at: '2026-07-05T14:00:00.000Z',
    updated_at: completedMock.calls.updates[0].updated_at,
    error_message: null,
  })
  assert.equal(typeof completedMock.calls.updates[0].updated_at, 'string')
  assertNoUnsafeSelect(completedMock.calls)
  assertNoUnsafeUpdatePayload(completedMock.calls.updates[0])

  const failedMock = createMockSupabase({
    data: { id: readingId },
    error: null,
  })
  const failedResult = await markDivinationReadingFailed(
    {
      readingId,
      errorMessage: '解讀暫時失敗',
    },
    failedMock.supabase,
  )

  assert.deepEqual(failedResult, { result: 'updated', readingId })
  assert.equal(failedMock.calls.updates.length, 1)
  assert.equal(failedMock.calls.updates[0].status, 'failed')
  assert.equal(failedMock.calls.updates[0].error_message, '解讀暫時失敗')
  assert.equal(typeof failedMock.calls.updates[0].updated_at, 'string')
  assertNoUnsafeSelect(failedMock.calls)
  assertNoUnsafeUpdatePayload(failedMock.calls.updates[0])

  const notFoundMock = createMockSupabase({
    data: null,
    error: null,
  })
  const notFoundResult = await markDivinationReadingFailed(
    {
      readingId,
      errorMessage: '找不到資料',
    },
    notFoundMock.supabase,
  )

  assert.deepEqual(notFoundResult, { result: 'not_found', readingId })
  assert.equal(notFoundMock.calls.updates.length, 1)
  assertNoUnsafeUpdatePayload(notFoundMock.calls.updates[0])

  const errorMock = createMockSupabase({
    data: null,
    error: { message: 'select failed' },
  })

  await assert.rejects(() => getDivinationReadingForInterpretation(readingId, errorMock.supabase), /select failed/)
}

main()
  .then(() => accountQueriesMain())
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
