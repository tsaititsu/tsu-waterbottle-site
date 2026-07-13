import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { handleCreateAiChartReportRequest, type CreateAiChartReportRequest } from './handler'

const tests: Array<{ name: string; fn: () => Promise<void> }> = []
const OWNER_ID = 'session-owner-id'

function test(name: string, fn: () => Promise<void>) {
  tests.push({ name, fn })
}

function request(token: string | null = 'owner-token') {
  return new Request('https://example.test/api/ai-chart/reports/create', {
    method: 'POST',
    headers: token ? { authorization: `Bearer ${token}` } : {},
  })
}

function deps(input: {
  userId?: string | null
  onCreate?: (payload: Record<string, unknown>) => void
  failCreate?: boolean
} = {}) {
  return {
    getUserIdFromRequest: async (receivedRequest: Request) => {
      assert.equal(receivedRequest.headers.get('authorization')?.startsWith('Bearer ') ?? false, input.userId !== null)
      return input.userId === undefined ? OWNER_ID : input.userId
    },
    createPendingAiChartReport: async (payload: Record<string, unknown>) => {
      input.onCreate?.(payload)
      if (input.failCreate) throw new Error('supabase insert failed with internal detail')
      return {
        id: '2df1a8da-3893-4b81-8d00-774a9cc0e472',
        paymentStatus: 'pending' as const,
      }
    },
  }
}

async function call(body: CreateAiChartReportRequest | null, input: Parameters<typeof deps>[0] = {}) {
  return handleCreateAiChartReportRequest(request(input.userId === null ? null : 'owner-token'), body, deps(input))
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

test('actual route uses the shared Bearer session helper', async () => {
  const routeSource = readFileSync(join(process.cwd(), 'src/app/api/ai-chart/reports/create/route.ts'), 'utf8')
  assert.match(routeSource, /getUserIdFromRequest/)
  assert.match(routeSource, /handleCreateAiChartReportRequest\(request, body/)
  assert.match(routeSource, /dynamic = 'force-dynamic'/)
})

test('unauthenticated request returns 401 before insert', async () => {
  let inserted = false
  const response = await call({}, {
    userId: null,
    onCreate: () => {
      inserted = true
    },
  })

  assert.equal(response.status, 401)
  assert.deepEqual(await readJson(response), { ok: false, error: 'unauthorized' })
  assert.equal(inserted, false)
})

test('authenticated default body creates a pending report owned by the session user', async () => {
  const calls: Record<string, unknown>[] = []
  const response = await call({}, { onCreate: (input) => calls.push(input) })
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
      userId: OWNER_ID,
      chartProfileId: null,
      title: 'AI 命盤分析',
      productName: 'AI 命盤分析',
      amountTwd: 100,
      reportContent: null,
    },
  ])
  assertNoUnsafeResponseKeys(json)
})

test('client ownership fields are rejected and never reach insert', async () => {
  for (const field of ['userId', 'user_id', 'localUserId', 'ownerId', 'memberId'] as const) {
    let inserted = false
    const response = await call({ [field]: 'attacker-selected-owner' }, {
      onCreate: () => {
        inserted = true
      },
    })

    assert.equal(response.status, 400, field)
    assert.deepEqual(await readJson(response), { ok: false, error: 'invalid_ai_chart_report_input' }, field)
    assert.equal(inserted, false, field)
  }
})

test('explicit valid title and productName are trimmed before creating the report', async () => {
  const calls: Record<string, unknown>[] = []
  const response = await call(
    {
      title: '  紫微命盤完整分析  ',
      productName: '  AI 命盤分析  ',
      amountTwd: 100,
    },
    { onCreate: (input) => calls.push(input) },
  )

  assert.equal(response.status, 200)
  assert.equal(calls[0].title, '紫微命盤完整分析')
  assert.equal(calls[0].productName, 'AI 命盤分析')
  assert.equal(calls[0].userId, OWNER_ID)
})

test('invalid input and amount are rejected without insert', async () => {
  for (const body of [null, { amountTwd: 99 }, { title: 'A'.repeat(121) }, { productName: 'A'.repeat(121) }]) {
    let inserted = false
    const response = await call(body, { onCreate: () => { inserted = true } })

    assert.equal(response.status, 400)
    assert.equal(inserted, false)
  }
})

test('helper failure returns a safe error response', async () => {
  const response = await call({}, { failCreate: true })
  const json = await readJson(response)

  assert.equal(response.status, 500)
  assert.deepEqual(json, { ok: false, error: 'ai_chart_report_create_failed' })
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
