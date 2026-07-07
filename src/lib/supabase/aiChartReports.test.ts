import assert from 'node:assert/strict'
import {
  buildAiChartReportCompletedPayload,
  buildAiChartReportFailedPayload,
  buildAiChartReportPaidUpdatePayload,
  buildAiChartReportPendingPaymentLinkPayload,
  buildPendingAiChartReportPayload,
  createPendingAiChartReport,
  decideAiChartReportContentUpdate,
  decideAiChartReportResultAccess,
  decideAiChartReportPaidUpdate,
  decideAiChartReportPendingPaymentLink,
  getAiChartReportResultById,
  getAiChartReportPaymentContext,
  linkAiChartReportPendingPayment,
  markAiChartReportCompleted,
  markAiChartReportFailed,
  markAiChartReportPaidByPayment,
  type AiChartReportResultContext,
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
  inserts: Record<string, unknown>[]
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
    inserts: [],
    updates: [],
    eqs: [],
  }

  const chain = {
    error: null,
    select(columns: string) {
      calls.selects.push(columns)
      return chain
    },
    insert(payload: Record<string, unknown>) {
      calls.inserts.push(payload)
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
    async single() {
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
  assert.equal('birthDate' in payload, false)
  assert.equal('birthTime' in payload, false)
  assert.equal('birthPlace' in payload, false)
  assert.equal('ziwei_payload' in payload, false)
  assert.equal('ziweiPayload' in payload, false)
  assert.equal('chartPayload' in payload, false)
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

function assertResultSelectIsSafe(columns: string) {
  assert.equal(columns.includes('user_id'), false)
  assert.equal(columns.includes('chart_profile_id'), false)
  assert.equal(columns.includes('birth'), false)
  assert.equal(columns.includes('ziwei_payload'), false)
  assert.equal(columns.includes('chart_payload'), false)
  assert.equal(columns.includes('raw_payload'), false)
  assert.equal(columns.includes('TradeInfo'), false)
  assert.equal(columns.includes('TradeSha'), false)
  assert.equal(columns.includes('HashKey'), false)
  assert.equal(columns.includes('HashIV'), false)
}

function createResultReport(
  paymentStatus: AiChartReportPaymentStatus | null,
  reportContent: string | null,
): AiChartReportResultContext {
  return {
    id: 'report-result-1',
    title: 'AI 命盤分析',
    productName: 'AI 命盤分析',
    amountTwd: 100,
    status: 'pending',
    paymentStatus,
    reportContent,
    paidAt: null,
    completedAt: null,
    errorMessage: null,
  }
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

const completedPayload = buildAiChartReportCompletedPayload(
  {
    reportContent: '短測試報告內容',
    completedAt: '2026-07-06T10:30:00.000Z',
  },
  '2026-07-06T10:31:00.000Z',
)

assert.deepEqual(completedPayload, {
  status: 'completed',
  report_content: '短測試報告內容',
  completed_at: '2026-07-06T10:30:00.000Z',
  updated_at: '2026-07-06T10:31:00.000Z',
  error_message: null,
})
assert.equal('payment_status' in completedPayload, false)
assert.equal('payment_id' in completedPayload, false)
assert.equal('merchant_order_no' in completedPayload, false)
assert.equal('paid_at' in completedPayload, false)
assert.equal('user_id' in completedPayload, false)
assert.equal('chart_profile_id' in completedPayload, false)
assertNoUnsafePaymentKeys(completedPayload)
assertNoOtherProductKeys(completedPayload)

const completedPayloadWithDefaultDate = buildAiChartReportCompletedPayload(
  {
    reportContent: '另一段短測試內容',
    completedAt: null,
  },
  '2026-07-06T10:32:00.000Z',
)

assert.equal(completedPayloadWithDefaultDate.completed_at, '2026-07-06T10:32:00.000Z')

const failedPayload = buildAiChartReportFailedPayload(
  {
    errorMessage: 'AI_CHART_REPORT_GENERATION_FAILED',
  },
  '2026-07-06T10:33:00.000Z',
)

assert.deepEqual(failedPayload, {
  status: 'failed',
  error_message: 'AI_CHART_REPORT_GENERATION_FAILED',
  updated_at: '2026-07-06T10:33:00.000Z',
})
assert.equal('payment_status' in failedPayload, false)
assert.equal('payment_id' in failedPayload, false)
assert.equal('merchant_order_no' in failedPayload, false)
assert.equal('paid_at' in failedPayload, false)
assert.equal('completed_at' in failedPayload, false)
assert.equal('report_content' in failedPayload, false)
assertNoUnsafePaymentKeys(failedPayload)
assertNoOtherProductKeys(failedPayload)

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

assert.deepEqual(decideAiChartReportResultAccess(null), { result: 'not_found' })
assert.deepEqual(decideAiChartReportResultAccess(createResultReport('pending', null)), {
  result: 'payment_required',
})
assert.deepEqual(decideAiChartReportResultAccess(createResultReport(null, null)), {
  result: 'payment_required',
})
assert.deepEqual(decideAiChartReportResultAccess(createResultReport('paid', '短測試報告內容')), {
  result: 'ready',
  reportContent: '短測試報告內容',
})
assert.deepEqual(decideAiChartReportResultAccess(createResultReport('paid', null)), {
  result: 'paid_missing_content',
})
assert.deepEqual(decideAiChartReportResultAccess(createResultReport('paid', '')), {
  result: 'paid_missing_content',
})
assert.deepEqual(decideAiChartReportResultAccess(createResultReport('paid', '   ')), {
  result: 'paid_missing_content',
})

for (const paymentStatus of ['failed', 'canceled', 'refunded'] satisfies AiChartReportPaymentStatus[]) {
  assert.deepEqual(decideAiChartReportResultAccess(createResultReport(paymentStatus, '短測試報告內容')), {
    result: 'invalid_state',
    paymentStatus,
  })
}

assert.deepEqual(decideAiChartReportContentUpdate(null), { result: 'not_found' })
assert.deepEqual(
  decideAiChartReportContentUpdate({
    id: 'report-content-decision-1',
    payment_status: 'pending',
    status: 'pending',
    report_content: null,
  }),
  { result: 'payment_required' },
)
assert.deepEqual(
  decideAiChartReportContentUpdate({
    id: 'report-content-decision-2',
    payment_status: null,
    status: 'pending',
    report_content: null,
  }),
  { result: 'payment_required' },
)
assert.deepEqual(
  decideAiChartReportContentUpdate({
    id: 'report-content-decision-3',
    payment_status: 'paid',
    status: 'paid',
    report_content: null,
  }),
  { result: 'should_update' },
)
assert.deepEqual(
  decideAiChartReportContentUpdate({
    id: 'report-content-decision-4',
    payment_status: 'paid',
    status: 'paid',
    report_content: '   ',
  }),
  { result: 'should_update' },
)
assert.deepEqual(
  decideAiChartReportContentUpdate({
    id: 'report-content-decision-5',
    payment_status: 'paid',
    status: 'completed',
    report_content: '短測試報告內容',
  }),
  { result: 'already_completed' },
)

for (const status of ['failed', 'canceled']) {
  assert.deepEqual(
    decideAiChartReportContentUpdate({
      id: `report-content-decision-${status}`,
      payment_status: 'paid',
      status,
      report_content: null,
    }),
    {
      result: 'invalid_state',
      status,
      paymentStatus: 'paid',
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
assert.throws(
  () =>
    buildAiChartReportCompletedPayload({
      reportContent: '',
    }),
  /reportContent/,
)
assert.throws(
  () =>
    buildAiChartReportFailedPayload({
      errorMessage: '',
    }),
  /errorMessage/,
)

async function runAsyncHelperTests() {
  const createMock = createMockSupabase({
    data: {
      id: 'report-created-1',
      payment_status: 'pending',
    },
    error: null,
  })
  const createResult = await createPendingAiChartReport(
    {
      title: '紫微命盤完整分析',
      productName: 'AI 命盤分析',
    },
    createMock.supabase,
  )

  assert.deepEqual(createResult, {
    id: 'report-created-1',
    paymentStatus: 'pending',
  })
  assert.deepEqual(createMock.calls.tables, ['ai_chart_reports'])
  assert.deepEqual(createMock.calls.selects, ['id,payment_status'])
  assert.equal(createMock.calls.inserts.length, 1)
  assert.equal(createMock.calls.inserts[0].user_id, null)
  assert.equal(createMock.calls.inserts[0].chart_profile_id, null)
  assert.equal(createMock.calls.inserts[0].title, '紫微命盤完整分析')
  assert.equal(createMock.calls.inserts[0].product_name, 'AI 命盤分析')
  assert.equal(createMock.calls.inserts[0].amount_twd, 100)
  assert.equal(createMock.calls.inserts[0].status, 'pending')
  assert.equal(createMock.calls.inserts[0].payment_status, 'pending')
  assert.equal(createMock.calls.inserts[0].report_content, null)
  assert.equal(typeof createMock.calls.inserts[0].updated_at, 'string')
  assert.equal('payment_id' in createMock.calls.inserts[0], false)
  assert.equal('merchant_order_no' in createMock.calls.inserts[0], false)
  assert.equal('paid_at' in createMock.calls.inserts[0], false)
  assert.equal('completed_at' in createMock.calls.inserts[0], false)
  assertNoUnsafePaymentKeys(createMock.calls.inserts[0])
  assertNoOtherProductKeys(createMock.calls.inserts[0])

  const createWithNullableInputsMock = createMockSupabase({
    data: {
      id: 'report-created-2',
      payment_status: 'pending',
    },
    error: null,
  })
  await createPendingAiChartReport(
    {
      userId: null,
      chartProfileId: null,
      title: 'AI 命盤分析',
      productName: '紫微命盤完整分析',
      amountTwd: 100,
      reportContent: null,
    },
    createWithNullableInputsMock.supabase,
  )

  assert.equal(createWithNullableInputsMock.calls.inserts[0].user_id, null)
  assert.equal(createWithNullableInputsMock.calls.inserts[0].chart_profile_id, null)
  assert.equal(createWithNullableInputsMock.calls.inserts[0].report_content, null)
  assert.deepEqual(createWithNullableInputsMock.calls.tables, ['ai_chart_reports'])

  const createWithSummaryMock = createMockSupabase({
    data: {
      id: 'report-created-3',
      payment_status: 'pending',
    },
    error: null,
  })
  await createPendingAiChartReport(
    {
      userId: 'user-1',
      chartProfileId: null,
      title: 'AI 命盤分析',
      productName: '紫微命盤完整分析',
      reportContent: '付款前安全摘要',
    },
    createWithSummaryMock.supabase,
  )

  assert.equal(createWithSummaryMock.calls.inserts[0].user_id, 'user-1')
  assert.equal(createWithSummaryMock.calls.inserts[0].chart_profile_id, null)
  assert.equal(createWithSummaryMock.calls.inserts[0].report_content, '付款前安全摘要')
  assert.equal(createWithSummaryMock.calls.inserts[0].amount_twd, 100)
  assertNoUnsafePaymentKeys(createWithSummaryMock.calls.inserts[0])

  const createFailureMock = createMockSupabase({
    data: null,
    error: { message: 'insert_failed' },
  })

  await assert.rejects(
    () =>
      createPendingAiChartReport(
        {
          title: 'AI 命盤分析',
          productName: '紫微命盤完整分析',
        },
        createFailureMock.supabase,
      ),
    /insert_failed/,
  )
  assert.equal(createFailureMock.calls.inserts.length, 1)

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

  const resultContextMock = createMockSupabase({
    data: {
      id: 'report-result-1',
      title: 'AI 命盤分析',
      product_name: 'AI 命盤分析',
      amount_twd: 100,
      status: 'pending',
      payment_status: 'paid',
      report_content: '短測試報告內容',
      paid_at: '2026-07-06T17:00:00.000Z',
      completed_at: null,
      error_message: null,
    },
    error: null,
  })
  const resultContext = await getAiChartReportResultById('report-result-1', resultContextMock.supabase)

  assert.deepEqual(resultContext, {
    id: 'report-result-1',
    title: 'AI 命盤分析',
    productName: 'AI 命盤分析',
    amountTwd: 100,
    status: 'pending',
    paymentStatus: 'paid',
    reportContent: '短測試報告內容',
    paidAt: '2026-07-06T17:00:00.000Z',
    completedAt: null,
    errorMessage: null,
  })
  assert.deepEqual(resultContextMock.calls.tables, ['ai_chart_reports'])
  assert.deepEqual(resultContextMock.calls.selects, [
    'id,title,product_name,amount_twd,status,payment_status,report_content,paid_at,completed_at,error_message',
  ])
  assert.deepEqual(resultContextMock.calls.eqs, [['id', 'report-result-1']])
  assertResultSelectIsSafe(resultContextMock.calls.selects[0])
  assertNoUnsafePaymentKeys(resultContext as unknown as Record<string, unknown>)
  assertNoOtherProductKeys(resultContext as unknown as Record<string, unknown>)

  const missingResultContextMock = createMockSupabase({
    data: null,
    error: null,
  })
  const missingResultContext = await getAiChartReportResultById('report-result-missing', missingResultContextMock.supabase)

  assert.equal(missingResultContext, null)
  assert.deepEqual(missingResultContextMock.calls.selects, [
    'id,title,product_name,amount_twd,status,payment_status,report_content,paid_at,completed_at,error_message',
  ])
  assertResultSelectIsSafe(missingResultContextMock.calls.selects[0])

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

  const completedMock = createMockSupabase({
    data: {
      id: 'report-content-1',
      payment_status: 'paid',
      status: 'paid',
      report_content: null,
    },
    error: null,
  })
  const completedResult = await markAiChartReportCompleted(
    {
      reportId: 'report-content-1',
      reportContent: '短測試報告內容',
      completedAt: '2026-07-06T17:10:00.000Z',
    },
    completedMock.supabase,
  )

  assert.deepEqual(completedResult, {
    result: 'updated',
    reportId: 'report-content-1',
  })
  assert.deepEqual(completedMock.calls.tables, ['ai_chart_reports', 'ai_chart_reports'])
  assert.deepEqual(completedMock.calls.selects, ['id,payment_status,status,report_content'])
  assert.deepEqual(completedMock.calls.eqs, [
    ['id', 'report-content-1'],
    ['id', 'report-content-1'],
  ])
  assert.equal(completedMock.calls.updates.length, 1)
  assert.equal(completedMock.calls.updates[0].status, 'completed')
  assert.equal(completedMock.calls.updates[0].report_content, '短測試報告內容')
  assert.equal(completedMock.calls.updates[0].completed_at, '2026-07-06T17:10:00.000Z')
  assert.equal(typeof completedMock.calls.updates[0].updated_at, 'string')
  assert.equal(completedMock.calls.updates[0].error_message, null)
  assert.equal('payment_status' in completedMock.calls.updates[0], false)
  assert.equal('payment_id' in completedMock.calls.updates[0], false)
  assert.equal('merchant_order_no' in completedMock.calls.updates[0], false)
  assert.equal('paid_at' in completedMock.calls.updates[0], false)
  assert.equal('user_id' in completedMock.calls.updates[0], false)
  assert.equal('chart_profile_id' in completedMock.calls.updates[0], false)
  assertNoUnsafePaymentKeys(completedMock.calls.updates[0])
  assertNoOtherProductKeys(completedMock.calls.updates[0])

  const alreadyCompletedMock = createMockSupabase({
    data: {
      id: 'report-content-2',
      payment_status: 'paid',
      status: 'completed',
      report_content: '既有短測試內容',
    },
    error: null,
  })
  const alreadyCompletedResult = await markAiChartReportCompleted(
    {
      reportId: 'report-content-2',
      reportContent: '新的短測試內容',
    },
    alreadyCompletedMock.supabase,
  )

  assert.deepEqual(alreadyCompletedResult, {
    result: 'already_completed',
    reportId: 'report-content-2',
  })
  assert.equal(alreadyCompletedMock.calls.updates.length, 0)

  const notFoundCompletedMock = createMockSupabase({
    data: null,
    error: null,
  })
  const notFoundCompletedResult = await markAiChartReportCompleted(
    {
      reportId: 'report-content-missing',
      reportContent: '短測試報告內容',
    },
    notFoundCompletedMock.supabase,
  )

  assert.deepEqual(notFoundCompletedResult, {
    result: 'not_found',
    reportId: 'report-content-missing',
  })
  assert.equal(notFoundCompletedMock.calls.updates.length, 0)

  const paymentRequiredMock = createMockSupabase({
    data: {
      id: 'report-content-pending',
      payment_status: 'pending',
      status: 'pending',
      report_content: null,
    },
    error: null,
  })
  const paymentRequiredResult = await markAiChartReportCompleted(
    {
      reportId: 'report-content-pending',
      reportContent: '短測試報告內容',
    },
    paymentRequiredMock.supabase,
  )

  assert.deepEqual(paymentRequiredResult, {
    result: 'payment_required',
    reportId: 'report-content-pending',
  })
  assert.equal(paymentRequiredMock.calls.updates.length, 0)

  const invalidContentStateMock = createMockSupabase({
    data: {
      id: 'report-content-failed',
      payment_status: 'paid',
      status: 'failed',
      report_content: null,
    },
    error: null,
  })
  const invalidContentStateResult = await markAiChartReportCompleted(
    {
      reportId: 'report-content-failed',
      reportContent: '短測試報告內容',
    },
    invalidContentStateMock.supabase,
  )

  assert.deepEqual(invalidContentStateResult, {
    result: 'invalid_state',
    reportId: 'report-content-failed',
    status: 'failed',
    paymentStatus: 'paid',
  })
  assert.equal(invalidContentStateMock.calls.updates.length, 0)

  const failedMarkMock = createMockSupabase({
    data: {
      id: 'report-failed-1',
    },
    error: null,
  })
  const failedMarkResult = await markAiChartReportFailed(
    {
      reportId: 'report-failed-1',
      errorMessage: 'AI_CHART_REPORT_GENERATION_FAILED',
    },
    failedMarkMock.supabase,
  )

  assert.deepEqual(failedMarkResult, {
    result: 'updated',
    reportId: 'report-failed-1',
  })
  assert.deepEqual(failedMarkMock.calls.tables, ['ai_chart_reports', 'ai_chart_reports'])
  assert.deepEqual(failedMarkMock.calls.selects, ['id'])
  assert.deepEqual(failedMarkMock.calls.eqs, [
    ['id', 'report-failed-1'],
    ['id', 'report-failed-1'],
  ])
  assert.equal(failedMarkMock.calls.updates.length, 1)
  assert.equal(failedMarkMock.calls.updates[0].status, 'failed')
  assert.equal(failedMarkMock.calls.updates[0].error_message, 'AI_CHART_REPORT_GENERATION_FAILED')
  assert.equal(typeof failedMarkMock.calls.updates[0].updated_at, 'string')
  assert.equal('payment_status' in failedMarkMock.calls.updates[0], false)
  assert.equal('payment_id' in failedMarkMock.calls.updates[0], false)
  assert.equal('merchant_order_no' in failedMarkMock.calls.updates[0], false)
  assert.equal('paid_at' in failedMarkMock.calls.updates[0], false)
  assert.equal('completed_at' in failedMarkMock.calls.updates[0], false)
  assert.equal('report_content' in failedMarkMock.calls.updates[0], false)
  assertNoUnsafePaymentKeys(failedMarkMock.calls.updates[0])
  assertNoOtherProductKeys(failedMarkMock.calls.updates[0])

  const failedNotFoundMock = createMockSupabase({
    data: null,
    error: null,
  })
  const failedNotFoundResult = await markAiChartReportFailed(
    {
      reportId: 'report-failed-missing',
      errorMessage: 'AI_CHART_REPORT_GENERATION_FAILED',
    },
    failedNotFoundMock.supabase,
  )

  assert.deepEqual(failedNotFoundResult, {
    result: 'not_found',
    reportId: 'report-failed-missing',
  })
  assert.equal(failedNotFoundMock.calls.updates.length, 0)
}

runAsyncHelperTests().catch((error) => {
  console.error(error)
  process.exit(1)
})
