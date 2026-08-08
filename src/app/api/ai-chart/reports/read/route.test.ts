import assert from 'node:assert/strict'
import { handleReadAiChartReportRequest } from './handler'
import type {
  AiChartReportPaymentStatus,
  AiChartReportResultContext,
} from '../../../../../lib/supabase/aiChartReports'
import { AI_CHART_REPORT_PRICE_TWD } from '@/lib/ai-chart/pricing'

const tests: Array<{ name: string; fn: () => Promise<void> }> = []
const VALID_REPORT_ID = '2df1a8da-3893-4b81-8d00-774a9cc0e472'
const OWNER_ID = 'owner-user-id'

function test(name: string, fn: () => Promise<void>) {
  tests.push({ name, fn })
}

async function readJson(response: Response) {
  return (await response.json()) as Record<string, unknown>
}

function request(input: {
  reportId?: string
  token?: string | null
  clientUserId?: string
} = {}) {
  const url = new URL('https://example.test/api/ai-chart/reports/read')
  if (input.reportId !== undefined) url.searchParams.set('reportId', input.reportId)
  if (input.clientUserId !== undefined) url.searchParams.set('userId', input.clientUserId)

  return new Request(url, {
    headers: input.token === null ? {} : { authorization: `Bearer ${input.token ?? 'owner-token'}` },
  })
}

function createReport(
  paymentStatus: AiChartReportPaymentStatus | null,
  reportContent: string | null,
): AiChartReportResultContext {
  return {
    id: VALID_REPORT_ID,
    title: 'AI 命盤分析',
    productName: 'AI 命盤分析',
    amountTwd: AI_CHART_REPORT_PRICE_TWD,
    status: reportContent ? 'completed' : 'pending',
    paymentStatus,
    reportContent,
    paidAt: paymentStatus === 'paid' ? '2026-07-07T10:00:00.000Z' : null,
    completedAt: reportContent ? '2026-07-07T10:05:00.000Z' : null,
    errorMessage: null,
  }
}

function deps(input: {
  requesterId?: string | null
  report?: AiChartReportResultContext | null
  onLookup?: (reportId: string, userId: string) => void
} = {}) {
  return {
    getUserIdFromRequest: async (receivedRequest: Request) => {
      assert.equal(receivedRequest.headers.get('authorization')?.startsWith('Bearer ') ?? false, input.requesterId !== null)
      return input.requesterId === undefined ? OWNER_ID : input.requesterId
    },
    getAiChartReportForUser: async (reportId: string, userId: string) => {
      input.onLookup?.(reportId, userId)
      return input.report === undefined ? createReport('paid', '正式完成報告') : input.report
    },
  }
}

function assertNoReportContent(json: Record<string, unknown>) {
  assert.equal('report' in json, false)
  assert.equal('reportContent' in json, false)
  assert.equal(JSON.stringify(json).includes('正式完成報告'), false)
}

test('unauthenticated request returns 401 before report lookup', async () => {
  let lookupCalled = false
  const response = await handleReadAiChartReportRequest(request({ reportId: VALID_REPORT_ID, token: null }), deps({
    requesterId: null,
    onLookup: () => {
      lookupCalled = true
    },
  }))

  assert.equal(response.status, 401)
  assert.deepEqual(await readJson(response), { ok: false, error: 'unauthorized' })
  assert.equal(lookupCalled, false)
})

test('missing and invalid report IDs are rejected after authentication', async () => {
  const missing = await handleReadAiChartReportRequest(request(), deps())
  assert.equal(missing.status, 400)
  assert.deepEqual(await readJson(missing), { ok: false, error: 'ai_chart_report_id_required' })

  const invalid = await handleReadAiChartReportRequest(request({ reportId: 'not-a-uuid' }), deps())
  assert.equal(invalid.status, 400)
  assert.deepEqual(await readJson(invalid), { ok: false, error: 'invalid_ai_chart_report_id' })
})

test('owner ready report returns 200 through ownership-aware lookup', async () => {
  const lookups: Array<[string, string]> = []
  const response = await handleReadAiChartReportRequest(request({ reportId: VALID_REPORT_ID }), deps({
    onLookup: (reportId, userId) => lookups.push([reportId, userId]),
  }))
  const json = await readJson(response)

  assert.equal(response.status, 200)
  assert.deepEqual(lookups, [[VALID_REPORT_ID, OWNER_ID]])
  assert.equal(json.ok, true)
  assert.equal(json.status, 'ready')
  assert.equal((json.report as Record<string, unknown>).reportContent, '正式完成報告')
})

test('pending owner report returns payment required without paid content', async () => {
  const response = await handleReadAiChartReportRequest(request({ reportId: VALID_REPORT_ID }), deps({
    report: createReport('pending', null),
  }))
  const json = await readJson(response)

  assert.equal(response.status, 402)
  assert.deepEqual(json, {
    ok: false,
    error: 'PAYMENT_REQUIRED',
    requiresPayment: true,
    amountTwd: AI_CHART_REPORT_PRICE_TWD,
  })
  assertNoReportContent(json)
})

test('non-owner and missing reports both return 404 without content', async () => {
  for (const requesterId of ['different-user-id', OWNER_ID]) {
    const response = await handleReadAiChartReportRequest(request({ reportId: VALID_REPORT_ID }), deps({
      requesterId,
      report: null,
    }))
    const json = await readJson(response)

    assert.equal(response.status, 404)
    assert.deepEqual(json, { ok: false, error: 'ai_chart_report_not_found' })
    assertNoReportContent(json)
  }
})

test('client userId query is ignored and session user id controls lookup', async () => {
  const lookups: Array<[string, string]> = []
  const response = await handleReadAiChartReportRequest(
    request({ reportId: VALID_REPORT_ID, clientUserId: 'attacker-selected-user' }),
    deps({ onLookup: (reportId, userId) => lookups.push([reportId, userId]) }),
  )

  assert.equal(response.status, 200)
  assert.deepEqual(lookups, [[VALID_REPORT_ID, OWNER_ID]])
})

test('paid report without content remains safe and does not invent content', async () => {
  const response = await handleReadAiChartReportRequest(request({ reportId: VALID_REPORT_ID }), deps({
    report: createReport('paid', null),
  }))
  const json = await readJson(response)

  assert.equal(response.status, 200)
  assert.equal(json.status, 'paid_missing_content')
  assert.equal((json.report as Record<string, unknown>).paymentStatus, 'paid')
  assert.equal('reportContent' in (json.report as Record<string, unknown>), false)
})

for (const paymentStatus of ['failed', 'canceled', 'refunded'] satisfies AiChartReportPaymentStatus[]) {
  test(`${paymentStatus} owner report returns invalid state without content`, async () => {
    const response = await handleReadAiChartReportRequest(request({ reportId: VALID_REPORT_ID }), deps({
      report: createReport(paymentStatus, null),
    }))
    const json = await readJson(response)

    assert.equal(response.status, 409)
    assert.equal(json.error, 'AI_CHART_REPORT_INVALID_STATE')
    assertNoReportContent(json)
  })
}

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
