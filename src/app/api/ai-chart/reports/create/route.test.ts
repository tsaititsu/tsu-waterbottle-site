import assert from 'node:assert/strict'
import { handleCreateAiChartReportRequest } from './handler'

const tests: Array<{ name: string; fn: () => Promise<void> }> = []

function test(name: string, fn: () => Promise<void>) {
  tests.push({ name, fn })
}

async function readJson(response: Response) {
  return (await response.json()) as Record<string, unknown>
}

function assertNoUnsafeResponseKeys(payload: Record<string, unknown>) {
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
  assert.equal('ziweiPayload' in payload, false)
  assert.equal('chartPayload' in payload, false)
  assert.equal('report_content' in payload, false)
  assert.equal('reportContent' in payload, false)
  assert.equal('prompt' in payload, false)
  assert.equal('openAiRequest' in payload, false)
  assert.equal('openAiResponse' in payload, false)
}

test('default body creates a pending AI chart report', async () => {
  const calls: Record<string, unknown>[] = []
  const response = await handleCreateAiChartReportRequest(
    {},
    {
      createPendingAiChartReport: async (input) => {
        calls.push(input)
        return {
          id: '2df1a8da-3893-4b81-8d00-774a9cc0e472',
          paymentStatus: 'pending',
        }
      },
    },
  )
  const json = await readJson(response)

  assert.equal(response.status, 200)
  assert.deepEqual(json, {
    ok: true,
    reportId: '2df1a8da-3893-4b81-8d00-774a9cc0e472',
    paymentStatus: 'pending',
    amountTwd: 100,
  })
  assert.deepEqual(calls, [
    {
      userId: null,
      chartProfileId: null,
      title: 'AI 命盤分析',
      productName: 'AI 命盤分析',
      amountTwd: 100,
      reportContent: null,
    },
  ])
  assertNoUnsafeResponseKeys(json)
})

test('explicit valid title and productName are trimmed before creating the report', async () => {
  const calls: Record<string, unknown>[] = []
  const response = await handleCreateAiChartReportRequest(
    {
      title: '  紫微命盤完整分析  ',
      productName: '  AI 命盤分析  ',
      amountTwd: 100,
    },
    {
      createPendingAiChartReport: async (input) => {
        calls.push(input)
        return {
          id: '2df1a8da-3893-4b81-8d00-774a9cc0e472',
          paymentStatus: 'pending',
        }
      },
    },
  )

  assert.equal(response.status, 200)
  assert.equal(calls[0].title, '紫微命盤完整分析')
  assert.equal(calls[0].productName, 'AI 命盤分析')
})

test('amountTwd other than 100 is rejected', async () => {
  let called = false
  const response = await handleCreateAiChartReportRequest(
    { amountTwd: 99 },
    {
      createPendingAiChartReport: async () => {
        called = true
        return { id: 'unused', paymentStatus: 'pending' }
      },
    },
  )
  const json = await readJson(response)

  assert.equal(response.status, 400)
  assert.deepEqual(json, {
    ok: false,
    error: 'invalid_ai_chart_amount',
  })
  assert.equal(called, false)
})

test('overlong title is rejected', async () => {
  const response = await handleCreateAiChartReportRequest({
    title: 'A'.repeat(121),
  })
  const json = await readJson(response)

  assert.equal(response.status, 400)
  assert.deepEqual(json, {
    ok: false,
    error: 'invalid_ai_chart_report_input',
  })
})

test('overlong productName is rejected', async () => {
  const response = await handleCreateAiChartReportRequest({
    productName: 'A'.repeat(121),
  })
  const json = await readJson(response)

  assert.equal(response.status, 400)
  assert.deepEqual(json, {
    ok: false,
    error: 'invalid_ai_chart_report_input',
  })
})

test('helper failure returns a safe error response', async () => {
  const response = await handleCreateAiChartReportRequest(
    {},
    {
      createPendingAiChartReport: async () => {
        throw new Error('supabase insert failed with internal detail')
      },
    },
  )
  const json = await readJson(response)

  assert.equal(response.status, 500)
  assert.deepEqual(json, {
    ok: false,
    error: 'ai_chart_report_create_failed',
  })
  assertNoUnsafeResponseKeys(json)
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
