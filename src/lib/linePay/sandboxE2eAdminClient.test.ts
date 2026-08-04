import assert from 'node:assert/strict'
import {
  createLinePayProductionOneDollarAdminController,
  createLinePaySandboxE2eAdminController,
  type LinePaySandboxE2eAdminSnapshot,
} from './sandboxE2eAdminClient'

const tests: Array<{ name: string; run: () => Promise<void> }> = []

function test(name: string, run: () => Promise<void>) {
  tests.push({ name, run })
}

function response(status: number, payload: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  }
}

test('authorized admin starts the exact NT$1 sandbox flow once', async () => {
  const sensitiveToken = 'synthetic-admin-session-token'
  const snapshots: LinePaySandboxE2eAdminSnapshot[] = []
  const calls: Array<{ input: string; init: RequestInit }> = []
  const navigations: string[] = []
  const controller = createLinePaySandboxE2eAdminController(
    {
      getAccessToken: async () => sensitiveToken,
      fetchStart: async (input, init) => {
        calls.push({ input, init })
        return response(200, {
          ok: true,
          environment: 'sandbox',
          amountTwd: 1,
          currency: 'TWD',
          paymentUrl: 'https://sandbox-web-pay.line.me/payment',
        })
      },
      navigate: (url) => navigations.push(url),
    },
    (snapshot) => snapshots.push(snapshot),
  )

  await Promise.all([controller.start(), controller.start()])

  assert.equal(calls.length, 1)
  assert.equal(calls[0]?.input, '/api/internal/line-pay/sandbox-e2e/start')
  assert.equal(calls[0]?.init.method, 'POST')
  assert.deepEqual(calls[0]?.init.headers, {
    authorization: `Bearer ${sensitiveToken}`,
    'content-type': 'application/json',
  })
  assert.deepEqual(JSON.parse(String(calls[0]?.init.body)), {
    confirmation: 'RUN_LINE_PAY_SANDBOX_E2E_NT1_ONCE',
  })
  assert.deepEqual(navigations, ['https://sandbox-web-pay.line.me/payment'])
  assert.equal(snapshots.at(-1)?.state, 'redirecting')
  assert.equal(JSON.stringify(snapshots).includes(sensitiveToken), false)
})

test('authorized admin starts the exact NT$1 Production flow once', async () => {
  const sensitiveToken = 'synthetic-production-admin-session-token'
  const snapshots: LinePaySandboxE2eAdminSnapshot[] = []
  const calls: Array<{ input: string; init: RequestInit }> = []
  const navigations: string[] = []
  const controller = createLinePayProductionOneDollarAdminController(
    {
      getAccessToken: async () => sensitiveToken,
      fetchStart: async (input, init) => {
        calls.push({ input, init })
        return response(200, {
          ok: true,
          environment: 'production',
          amountTwd: 1,
          currency: 'TWD',
          paymentUrl: 'https://web-pay.line.me/web/payment/wait',
        })
      },
      navigate: (url) => navigations.push(url),
    },
    (snapshot) => snapshots.push(snapshot),
  )

  await Promise.all([controller.start(), controller.start()])

  assert.equal(calls.length, 1)
  assert.equal(
    calls[0]?.input,
    '/api/internal/line-pay/production-one-dollar/start',
  )
  assert.deepEqual(JSON.parse(String(calls[0]?.init.body)), {
    confirmation: 'RUN_LINE_PAY_PRODUCTION_NT1_ONCE',
  })
  assert.deepEqual(navigations, ['https://web-pay.line.me/web/payment/wait'])
  assert.equal(snapshots.at(-1)?.state, 'redirecting')
  assert.equal(JSON.stringify(snapshots).includes(sensitiveToken), false)
})

test('Production controller rejects a Sandbox payment URL', async () => {
  const snapshots: LinePaySandboxE2eAdminSnapshot[] = []
  const controller = createLinePayProductionOneDollarAdminController(
    {
      getAccessToken: async () => 'synthetic-token',
      fetchStart: async () => response(200, {
        ok: true,
        environment: 'production',
        amountTwd: 1,
        currency: 'TWD',
        paymentUrl: 'https://sandbox-web-pay.line.me/payment',
      }),
      navigate: () => assert.fail('cross-environment URL must not navigate'),
    },
    (snapshot) => snapshots.push(snapshot),
  )

  await controller.start()

  assert.deepEqual(snapshots.at(-1), {
    state: 'failed',
    error: 'invalid_production_payment_url',
  })
})

test('missing admin session fails closed before the request', async () => {
  const snapshots: LinePaySandboxE2eAdminSnapshot[] = []
  let fetchCalls = 0
  const controller = createLinePaySandboxE2eAdminController(
    {
      getAccessToken: async () => null,
      fetchStart: async () => {
        fetchCalls += 1
        return response(200, null)
      },
      navigate: () => assert.fail('missing session must not navigate'),
    },
    (snapshot) => snapshots.push(snapshot),
  )

  await controller.start()

  assert.equal(fetchCalls, 0)
  assert.deepEqual(snapshots.at(-1), {
    state: 'failed',
    error: 'admin_session_unavailable',
  })
})

test('non-sandbox payment URL fails closed without navigation', async () => {
  const snapshots: LinePaySandboxE2eAdminSnapshot[] = []
  let navigations = 0
  const controller = createLinePaySandboxE2eAdminController(
    {
      getAccessToken: async () => 'synthetic-token',
      fetchStart: async () => response(200, {
        ok: true,
        environment: 'sandbox',
        amountTwd: 1,
        currency: 'TWD',
        paymentUrl: 'https://example.com/not-line-pay',
      }),
      navigate: () => {
        navigations += 1
      },
    },
    (snapshot) => snapshots.push(snapshot),
  )

  await controller.start()

  assert.equal(navigations, 0)
  assert.deepEqual(snapshots.at(-1), {
    state: 'failed',
    error: 'invalid_sandbox_payment_url',
  })
})

test('upstream failure preserves only the allowlisted execution stage', async () => {
  const sensitiveText = 'synthetic-upstream-secret-payload'
  const snapshots: LinePaySandboxE2eAdminSnapshot[] = []
  const controller = createLinePaySandboxE2eAdminController(
    {
      getAccessToken: async () => 'synthetic-token',
      fetchStart: async () => response(502, {
        ok: false,
        error: 'line_pay_sandbox_e2e_execution_failed',
        internal: sensitiveText,
      }),
      navigate: () => assert.fail('failed response must not navigate'),
    },
    (snapshot) => snapshots.push(snapshot),
  )

  await controller.start()

  assert.deepEqual(snapshots.at(-1), {
    state: 'failed',
    error: 'sandbox_request_failed',
    diagnostic: {
      stage: 'execution',
    },
  })
  assert.equal(JSON.stringify(snapshots).includes(sensitiveText), false)
})

test('Gateway execution failure preserves only an allowlisted reason', async () => {
  const snapshots: LinePaySandboxE2eAdminSnapshot[] = []
  const controller = createLinePaySandboxE2eAdminController(
    {
      getAccessToken: async () => 'synthetic-token',
      fetchStart: async () => response(502, {
        ok: false,
        error: 'line_pay_sandbox_e2e_execution_failed',
        executionReason: 'gateway_request_failed',
      }),
      navigate: () => assert.fail('failed response must not navigate'),
    },
    (snapshot) => snapshots.push(snapshot),
  )

  await controller.start()

  assert.deepEqual(snapshots.at(-1), {
    state: 'failed',
    error: 'sandbox_request_failed',
    diagnostic: {
      stage: 'execution',
      reason: 'gateway_request_failed',
    },
  })
})

test('initializer failure preserves only an allowlisted reason', async () => {
  const sensitiveText = 'synthetic-database-detail'
  const snapshots: LinePaySandboxE2eAdminSnapshot[] = []
  const controller = createLinePaySandboxE2eAdminController(
    {
      getAccessToken: async () => 'synthetic-token',
      fetchStart: async () => response(502, {
        ok: false,
        error: 'line_pay_sandbox_e2e_initialization_failed',
        initializationReason: 'rpc_insufficient_privilege',
        internal: sensitiveText,
      }),
      navigate: () => assert.fail('failed response must not navigate'),
    },
    (snapshot) => snapshots.push(snapshot),
  )

  await controller.start()

  assert.deepEqual(snapshots.at(-1), {
    state: 'failed',
    error: 'sandbox_request_failed',
    diagnostic: {
      stage: 'initialization',
      reason: 'rpc_insufficient_privilege',
    },
  })
  assert.equal(JSON.stringify(snapshots).includes(sensitiveText), false)
})

test('unknown failure details remain redacted', async () => {
  const snapshots: LinePaySandboxE2eAdminSnapshot[] = []
  const controller = createLinePaySandboxE2eAdminController(
    {
      getAccessToken: async () => 'synthetic-token',
      fetchStart: async () => response(502, {
        ok: false,
        error: 'unexpected_provider_failure',
        initializationReason: 'unexpected_database_detail',
      }),
      navigate: () => assert.fail('failed response must not navigate'),
    },
    (snapshot) => snapshots.push(snapshot),
  )

  await controller.start()

  assert.deepEqual(snapshots.at(-1), {
    state: 'failed',
    error: 'sandbox_request_failed',
  })
})

async function main() {
  for (const current of tests) {
    await current.run()
    console.log(`✓ ${current.name}`)
  }
  console.log(`LINE Pay Sandbox E2E admin client tests passed (${tests.length} cases)`)
}

void main()
