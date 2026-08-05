import assert from 'node:assert/strict'
import { handleCourseStartRequest } from './handler'
import type { CoursePaymentPayload, NewebPayConfig, NewebPayMpgForm } from '../../../../../../lib/newebpay/types'

const fakeConfig: NewebPayConfig = {
  merchantId: 'MS_TEST',
  hashKey: 'test-only-key',
  hashIv: 'test-only-iv',
  env: 'test',
  version: '2.3',
  siteUrl: 'https://example.test',
  mpgGatewayUrl: 'https://example.test/mpg',
  mpgEndpoint: 'https://example.test/mpg',
}

const fakeForm: NewebPayMpgForm = {
  MerchantID: 'MS_TEST',
  TradeInfo: 'test-trade-info',
  TradeSha: 'test-trade-sha',
  Version: '2.0',
  actionUrl: 'https://example.test/mpg',
}

function createRequest(body: Record<string, unknown> = { courseId: 'basic', paymentMode: 'credit' }) {
  return new Request('https://example.test/api/payments/newebpay/course/start', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function createDependencies(salesOpen: boolean) {
  const calls = {
    adminConfig: 0,
    auth: 0,
    purchaseLookups: 0,
    config: 0,
    merchantOrderNumbers: 0,
    paymentInserts: [] as Array<Record<string, unknown>>,
    mpgPayloads: [] as CoursePaymentPayload[],
  }

  return {
    calls,
    dependencies: {
      isCourseSalesOpen: () => salesOpen,
      hasSupabaseAdminConfig: () => {
        calls.adminConfig += 1
        return true
      },
      getUserIdFromRequest: async () => {
        calls.auth += 1
        return 'user-course-1'
      },
      getPurchasedCourseIds: async () => {
        calls.purchaseLookups += 1
        return []
      },
      getNewebPayConfig: () => {
        calls.config += 1
        return fakeConfig
      },
      generateMerchantOrderNo: () => {
        calls.merchantOrderNumbers += 1
        return 'COURSE_TEST_1'
      },
      insertPayment: async (payload: Record<string, unknown>) => {
        calls.paymentInserts.push(payload)
        return { id: 'payment-course-1' }
      },
      createCoursePaymentMpgForm: (payload: CoursePaymentPayload) => {
        calls.mpgPayloads.push(payload)
        return fakeForm
      },
    },
  }
}

async function runTests() {
  {
    const { calls, dependencies } = createDependencies(false)
    const response = await handleCourseStartRequest(
      createRequest({ courseId: 'basic', salesOpen: true, paymentStatus: 'paid' }),
      dependencies,
    )
    const json = (await response.json()) as Record<string, unknown>

    assert.equal(response.status, 403)
    assert.deepEqual(json, {
      ok: false,
      error: 'course_sales_disabled',
      message: '課程即將開課，目前尚未開放購買',
    })
    assert.equal(calls.adminConfig, 0)
    assert.equal(calls.auth, 0)
    assert.equal(calls.purchaseLookups, 0)
    assert.equal(calls.config, 0)
    assert.equal(calls.merchantOrderNumbers, 0)
    assert.equal(calls.paymentInserts.length, 0)
    assert.equal(calls.mpgPayloads.length, 0)
  }

  {
    const { calls, dependencies } = createDependencies(true)
    const response = await handleCourseStartRequest(createRequest(), dependencies)
    const json = (await response.json()) as Record<string, unknown>

    assert.equal(response.status, 200)
    assert.equal(json.ok, true)
    assert.equal(json.paymentId, 'payment-course-1')
    assert.equal(calls.adminConfig, 1)
    assert.equal(calls.auth, 1)
    assert.equal(calls.purchaseLookups, 1)
    assert.equal(calls.config, 1)
    assert.equal(calls.merchantOrderNumbers, 1)
    assert.equal(calls.paymentInserts.length, 1)
    assert.equal(calls.paymentInserts[0]?.amount_twd, 9800)
    assert.equal(calls.paymentInserts[0]?.status, 'pending')
    assert.equal(calls.mpgPayloads.length, 1)
    assert.equal(calls.mpgPayloads[0]?.amount, 9800)
    assert.equal(calls.mpgPayloads[0]?.paymentMode, 'credit')
  }

  {
    const { calls, dependencies } = createDependencies(true)
    const response = await handleCourseStartRequest(
      createRequest({ courseId: 'basic', paymentMode: 'installment_6' }),
      dependencies,
    )

    assert.equal(response.status, 200)
    assert.equal(calls.mpgPayloads[0]?.paymentMode, 'installment_6')
    assert.equal(
      (calls.paymentInserts[0]?.raw_payload as Record<string, unknown>)?.paymentMode,
      'installment_6',
    )
  }

  {
    const { calls, dependencies } = createDependencies(true)
    const response = await handleCourseStartRequest(
      createRequest({ courseId: 'basic', paymentMode: 'webatm' }),
      dependencies,
    )

    assert.equal(response.status, 400)
    assert.equal(calls.paymentInserts.length, 0)
    assert.equal(calls.mpgPayloads.length, 0)
  }
}

void runTests()
