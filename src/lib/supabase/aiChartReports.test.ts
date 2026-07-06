import assert from 'node:assert/strict'
import {
  buildAiChartReportPaidUpdatePayload,
  buildAiChartReportPendingPaymentLinkPayload,
  buildPendingAiChartReportPayload,
  decideAiChartReportPaidUpdate,
  decideAiChartReportPendingPaymentLink,
  getAiChartReportPaymentContext,
  linkAiChartReportPendingPayment,
  markAiChartReportPaidByPayment,
  type AiChartReportPaymentStatus,
} from './aiChartReports'

type MockSupabaseClient = NonNullable<Parameters<typeof getAiChartReportPaymentContext>[1]>
type MockSupabaseResponse = {
  data: unknown | null
  error: { message: string } | null
}
type MockSupabaseCalls = {
  tables: string[]
  selects: string[]
  updates: Record<string, unknown>[]
  eqs: Array<[string, unknown]>
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
  }

  const chain = {
    error: null,
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

function assertNoUnsafePaymentKeys(payload: Record<string, unknown>) {
  assert.equal('TradeInfo' in payload, false)
  assert.equal('TradeSha' in payload, false)
  assert.equal('HashKey' in payload, false)
  assert.equal('HashIV' in payload, false)
  assert.equal('creditCard' in payload, false)
  assert.equal('cardNumber' in payload, false)
  assert.equal('birthData' in payload, false)
  assert.equal('raw_payload' in payload, false)
  assert.equal('payment_form' in payload, false)
}

function assertNoOtherProductKeys(payload: Record<string, unknown>) {
  assert.equal('booking_id' in payload, false)
  assert.equal('course_id' in payload, false)
  assert.equal('divination_reading_id' in payload, false)
  assert.equal('spiritual_product_id' in payload, false)
  assert.equal('product_id' in payload, false)
}

const pendingReportPayload = buildPendingAiChartReportPayload(
  {
    userId: 'user-1',
    chartProfileId: 'chart-profile-1',
    title: '紫微命盤完整分析',
    productName: 'AI 命盤分析',
    amountTwd: 100,
    reportContent: null,
  },
  '2026-07-06T10:00:00.000Z',
)

assert.deepEqual(pendingReportPayload, {
  user_id: 'user-1',
  chart_profile_id: 'chart-profile-1',
  title: '紫微命盤完整分析',
  product_name: 'AI 命盤分析',
  amount_twd: 100,
  status: 'pending',
  payment_status: 'pending',
  report_content: null,
  updated_at: '2026-07-06T10:00:00.000Z',
})
assertNoUnsafePaymentKeys(pendingReportPayload)
assertNoOtherProductKeys(pendingReportPayload)

const pendingReportPayloadWithTrimmedText = buildPendingAiChartReportPayload(
  {
    userId: '  ',
    chartProfileId: null,
    title: '  AI 命盤分析  ',
    productName: '  紫微命盤完整分析  ',
    amountTwd: 100,
    reportContent: '  付款前安全摘要  ',
  },
  '2026-07-06T10:05:00.000Z',
)

assert.equal(pendingReportPayloadWithTrimmedText.user_id, null)
assert.equal(pendingReportPayloadWithTrimmedText.chart_profile_id, null)
assert.equal(pendingReportPayloadWithTrimmedText.title, 'AI 命盤分析')
assert.equal(pendingReportPayloadWithTrimmedText.product_name, '紫微命盤完整分析')
assert.equal(pendingReportPayloadWithTrimmedText.report_content, '付款前安全摘要')

const pendingPaymentLinkPayload = buildAiChartReportPendingPaymentLinkPayload(
  {
    paymentId: 'payment-1',
    merchantOrderNo: 'WB20260706101010AICH',
  },
  '2026-07-06T10:10:00.000Z',
)

assert.deepEqual(pendingPaymentLinkPayload, {
  payment_id: 'payment-1',
  merchant_order_no: 'WB20260706101010AICH',
  updated_at: '2026-07-06T10:10:00.000Z',
})
assert.equal('payment_status' in pendingPaymentLinkPayload, false)
assert.equal('paid_at' in pendingPaymentLinkPayload, false)
assert.equal('completed_at' in pendingPaymentLinkPayload, false)
assert.equal('report_content' in pendingPaymentLinkPayload, false)
assertNoUnsafePaymentKeys(pendingPaymentLinkPayload)
assertNoOtherProductKeys(pendingPaymentLinkPayload)

const paidUpdatePayload = buildAiChartReportPaidUpdatePayload(
  {
    paymentId: 'payment-2',
    merchantOrderNo: 'WB20260706102020AICH',
    paidAt: '2026-07-06T10:20:00.000Z',
  },
  '2026-07-06T10:21:00.000Z',
)

assert.deepEqual(paidUpdatePayload, {
  payment_id: 'payment-2',
  merchant_order_no: 'WB20260706102020AICH',
  payment_status: 'paid',
  paid_at: '2026-07-06T10:20:00.000Z',
  updated_at: '2026-07-06T10:21:00.000Z',
  error_message: null,
})
assert.equal('report_content' in paidUpdatePayload, false)
assert.equal('completed_at' in paidUpdatePayload, false)
assertNoUnsafePaymentKeys(paidUpdatePayload)
assertNoOtherProductKeys(paidUpdatePayload)

const paidUpdatePayloadWithDefaultDate = buildAiChartReportPaidUpdatePayload(
  {
    paymentId: 'payment-3',
    merchantOrderNo: 'WB20260706102220AICH',
    paidAt: null,
  },
  '2026-07-06T10:22:00.000Z',
)

assert.equal(paidUpdatePayloadWithDefaultDate.paid_at, '2026-07-06T10:22:00.000Z')

assert.deepEqual(decideAiChartReportPendingPaymentLink(null), { result: 'not_found' })
assert.deepEqual(
  decideAiChartReportPendingPaymentLink({
    id: 'report-1',
    payment_status: 'pending',
    payment_id: null,
    merchant_order_no: null,
  }),
  { result: 'should_link' },
)
assert.deepEqual(
  decideAiChartReportPendingPaymentLink({
    id: 'report-2',
    payment_status: null,
    payment_id: null,
    merchant_order_no: null,
  }),
  { result: 'should_link' },
)
assert.deepEqual(
  decideAiChartReportPendingPaymentLink({
    id: 'report-3',
    payment_status: 'pending',
    payment_id: 'payment-1',
    merchant_order_no: null,
  }),
  { result: 'already_linked' },
)
assert.deepEqual(
  decideAiChartReportPendingPaymentLink({
    id: 'report-4',
    payment_status: 'pending',
    payment_id: null,
    merchant_order_no: 'WB20260706103000AICH',
  }),
  { result: 'already_linked' },
)

for (const paymentStatus of ['paid', 'failed', 'canceled', 'refunded'] satisfies AiChartReportPaymentStatus[]) {
  assert.deepEqual(
    decideAiChartReportPendingPaymentLink({
      id: `report-${paymentStatus}`,
      payment_status: paymentStatus,
      payment_id: null,
      merchant_order_no: null,
    }),
    {
      result: 'not_payable',
      paymentStatus,
    },
  )
}

assert.deepEqual(decideAiChartReportPaidUpdate(null), { result: 'not_found' })
assert.deepEqual(
  decideAiChartReportPaidUpdate({
    id: 'report-paid-1',
    payment_status: 'pending',
  }),
  { result: 'should_update' },
)
assert.deepEqual(
  decideAiChartReportPaidUpdate({
    id: 'report-paid-2',
    payment_status: null,
  }),
  { result: 'should_update' },
)
assert.deepEqual(
  decideAiChartReportPaidUpdate({
    id: 'report-paid-3',
    payment_status: 'paid',
  }),
  { result: 'already_paid' },
)

for (const paymentStatus of ['failed', 'canceled', 'refunded'] satisfies AiChartReportPaymentStatus[]) {
  assert.deepEqual(
    decideAiChartReportPaidUpdate({
      id: `report-paid-${paymentStatus}`,
      payment_status: paymentStatus,
    }),
    {
      result: 'invalid_state',
      paymentStatus,
    },
  )
}

assert.throws(
  () =>
    buildPendingAiChartReportPayload({
      title: '',
      productName: 'AI 命盤分析',
      amountTwd: 100,
    }),
  /title/,
)
assert.throws(
  () =>
    buildPendingAiChartReportPayload({
      title: '紫微命盤完整分析',
      productName: 'AI 命盤分析',
      amountTwd: 0,
    }),
  /amountTwd/,
)
assert.throws(
  () =>
    buildAiChartReportPendingPaymentLinkPayload({
      paymentId: '',
      merchantOrderNo: 'WB20260706104000AICH',
    }),
  /paymentId/,
)
assert.throws(
  () =>
    buildAiChartReportPaidUpdatePayload({
      paymentId: 'payment-4',
      merchantOrderNo: '',
    }),
  /merchantOrderNo/,
)

async function runAsyncHelperTests() {
  const contextMock = createMockSupabase({
    data: {
      id: 'report-context-1',
      payment_status: 'pending',
      payment_id: null,
      merchant_order_no: null,
      amount_twd: 100,
    },
    error: null,
  })
  const context = await getAiChartReportPaymentContext('report-context-1', contextMock.supabase)

  assert.deepEqual(context, {
    id: 'report-context-1',
    paymentStatus: 'pending',
    paymentId: null,
    merchantOrderNo: null,
    amountTwd: 100,
  })
  assert.deepEqual(contextMock.calls.tables, ['ai_chart_reports'])
  assert.deepEqual(contextMock.calls.selects, ['id,payment_status,payment_id,merchant_order_no,amount_twd'])
  assert.deepEqual(contextMock.calls.eqs, [['id', 'report-context-1']])
  assert.equal(contextMock.calls.selects[0].includes('report_content'), false)
  assert.equal(contextMock.calls.selects[0].includes('chart_profile_id'), false)
  assert.equal(contextMock.calls.selects[0].includes('birth'), false)
  assert.equal(contextMock.calls.selects[0].includes('ziwei_payload'), false)
  assert.equal(contextMock.calls.selects[0].includes('raw_payload'), false)

  const linkedMock = createMockSupabase({
    data: {
      id: 'report-link-1',
      payment_status: 'pending',
      payment_id: null,
      merchant_order_no: null,
      amount_twd: 100,
    },
    error: null,
  })
  const linkedResult = await linkAiChartReportPendingPayment(
    {
      reportId: 'report-link-1',
      paymentId: 'payment-link-1',
      merchantOrderNo: 'WB20260706164000AICH',
    },
    linkedMock.supabase,
  )

  assert.deepEqual(linkedResult, {
    result: 'linked',
    reportId: 'report-link-1',
  })
  assert.deepEqual(linkedMock.calls.tables, ['ai_chart_reports', 'ai_chart_reports'])
  assert.deepEqual(linkedMock.calls.selects, ['id,payment_status,payment_id,merchant_order_no,amount_twd'])
  assert.deepEqual(linkedMock.calls.eqs, [
    ['id', 'report-link-1'],
    ['id', 'report-link-1'],
  ])
  assert.equal(linkedMock.calls.updates.length, 1)
  assert.equal(linkedMock.calls.updates[0].payment_id, 'payment-link-1')
  assert.equal(linkedMock.calls.updates[0].merchant_order_no, 'WB20260706164000AICH')
  assert.equal(typeof linkedMock.calls.updates[0].updated_at, 'string')
  assert.equal('payment_status' in linkedMock.calls.updates[0], false)
  assert.equal('paid_at' in linkedMock.calls.updates[0], false)
  assert.equal('completed_at' in linkedMock.calls.updates[0], false)
  assert.equal('report_content' in linkedMock.calls.updates[0], false)
  assert.equal('status' in linkedMock.calls.updates[0], false)
  assert.equal('chart_profile_id' in linkedMock.calls.updates[0], false)
  assert.equal('user_id' in linkedMock.calls.updates[0], false)
  assertNoUnsafePaymentKeys(linkedMock.calls.updates[0])
  assertNoOtherProductKeys(linkedMock.calls.updates[0])

  const alreadyLinkedMock = createMockSupabase({
    data: {
      id: 'report-link-2',
      payment_status: 'pending',
      payment_id: 'payment-existing',
      merchant_order_no: null,
      amount_twd: 100,
    },
    error: null,
  })
  const alreadyLinkedResult = await linkAiChartReportPendingPayment(
    {
      reportId: 'report-link-2',
      paymentId: 'payment-link-2',
      merchantOrderNo: 'WB20260706164100AICH',
    },
    alreadyLinkedMock.supabase,
  )

  assert.deepEqual(alreadyLinkedResult, {
    result: 'already_linked',
    reportId: 'report-link-2',
  })
  assert.equal(alreadyLinkedMock.calls.updates.length, 0)

  const notFoundLinkMock = createMockSupabase({
    data: null,
    error: null,
  })
  const notFoundLinkResult = await linkAiChartReportPendingPayment(
    {
      reportId: 'report-link-missing',
      paymentId: 'payment-link-3',
      merchantOrderNo: 'WB20260706164200AICH',
    },
    notFoundLinkMock.supabase,
  )

  assert.deepEqual(notFoundLinkResult, {
    result: 'not_found',
    reportId: 'report-link-missing',
  })
  assert.equal(notFoundLinkMock.calls.updates.length, 0)

  for (const paymentStatus of ['paid', 'failed', 'canceled', 'refunded'] satisfies AiChartReportPaymentStatus[]) {
    const notPayableMock = createMockSupabase({
      data: {
        id: `report-link-${paymentStatus}`,
        payment_status: paymentStatus,
        payment_id: null,
        merchant_order_no: null,
        amount_twd: 100,
      },
      error: null,
    })
    const notPayableResult = await linkAiChartReportPendingPayment(
      {
        reportId: `report-link-${paymentStatus}`,
        paymentId: 'payment-link-4',
        merchantOrderNo: 'WB20260706164300AICH',
      },
      notPayableMock.supabase,
    )

    assert.deepEqual(notPayableResult, {
      result: 'not_payable',
      reportId: `report-link-${paymentStatus}`,
      paymentStatus,
    })
    assert.equal(notPayableMock.calls.updates.length, 0)
  }

  const updatedMock = createMockSupabase({
    data: {
      id: 'report-async-1',
      payment_status: 'pending',
    },
    error: null,
  })
  const updatedResult = await markAiChartReportPaidByPayment(
    {
      reportId: 'report-async-1',
      paymentId: 'payment-async-1',
      merchantOrderNo: 'WB20260706165000AICH',
      paidAt: '2026-07-06T16:50:00.000Z',
    },
    updatedMock.supabase,
  )

  assert.deepEqual(updatedResult, {
    result: 'updated',
    reportId: 'report-async-1',
  })
  assert.deepEqual(updatedMock.calls.tables, ['ai_chart_reports', 'ai_chart_reports'])
  assert.deepEqual(updatedMock.calls.selects, ['id,payment_status'])
  assert.deepEqual(updatedMock.calls.eqs, [
    ['id', 'report-async-1'],
    ['id', 'report-async-1'],
  ])
  assert.equal(updatedMock.calls.updates.length, 1)
  assert.equal(updatedMock.calls.updates[0].payment_id, 'payment-async-1')
  assert.equal(updatedMock.calls.updates[0].merchant_order_no, 'WB20260706165000AICH')
  assert.equal(updatedMock.calls.updates[0].payment_status, 'paid')
  assert.equal(updatedMock.calls.updates[0].paid_at, '2026-07-06T16:50:00.000Z')
  assert.equal(updatedMock.calls.updates[0].error_message, null)
  assert.equal('report_content' in updatedMock.calls.updates[0], false)
  assert.equal('completed_at' in updatedMock.calls.updates[0], false)
  assert.equal('status' in updatedMock.calls.updates[0], false)
  assert.equal('chart_profile_id' in updatedMock.calls.updates[0], false)
  assert.equal('user_id' in updatedMock.calls.updates[0], false)
  assertNoUnsafePaymentKeys(updatedMock.calls.updates[0])

  const alreadyPaidMock = createMockSupabase({
    data: {
      id: 'report-async-2',
      payment_status: 'paid',
    },
    error: null,
  })
  const alreadyPaidResult = await markAiChartReportPaidByPayment(
    {
      reportId: 'report-async-2',
      paymentId: 'payment-async-2',
      merchantOrderNo: 'WB20260706165100AICH',
    },
    alreadyPaidMock.supabase,
  )

  assert.deepEqual(alreadyPaidResult, {
    result: 'already_paid',
    reportId: 'report-async-2',
  })
  assert.equal(alreadyPaidMock.calls.updates.length, 0)

  const notFoundMock = createMockSupabase({
    data: null,
    error: null,
  })
  const notFoundResult = await markAiChartReportPaidByPayment(
    {
      reportId: 'report-missing',
      paymentId: 'payment-async-3',
      merchantOrderNo: 'WB20260706165200AICH',
    },
    notFoundMock.supabase,
  )

  assert.deepEqual(notFoundResult, {
    result: 'not_found',
    reportId: 'report-missing',
  })
  assert.equal(notFoundMock.calls.updates.length, 0)

  for (const paymentStatus of ['failed', 'canceled', 'refunded'] satisfies AiChartReportPaymentStatus[]) {
    const invalidStateMock = createMockSupabase({
      data: {
        id: `report-async-${paymentStatus}`,
        payment_status: paymentStatus,
      },
      error: null,
    })
    const invalidStateResult = await markAiChartReportPaidByPayment(
      {
        reportId: `report-async-${paymentStatus}`,
        paymentId: 'payment-async-4',
        merchantOrderNo: 'WB20260706165300AICH',
      },
      invalidStateMock.supabase,
    )

    assert.deepEqual(invalidStateResult, {
      result: 'invalid_state',
      reportId: `report-async-${paymentStatus}`,
      paymentStatus,
    })
    assert.equal(invalidStateMock.calls.updates.length, 0)
  }
}

runAsyncHelperTests().catch((error) => {
  console.error(error)
  process.exit(1)
})
