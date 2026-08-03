import assert from 'node:assert/strict'
import Module, { createRequire } from 'node:module'
import { test } from 'node:test'

type NodeModuleInternals = {
  _resolveFilename: (
    request: string,
    parent: unknown,
    isMain: boolean,
    options?: unknown,
  ) => string
  _load: (request: string, parent: unknown, isMain: boolean) => unknown
}

const moduleInternals = Module as unknown as NodeModuleInternals
const originalResolveFilename = moduleInternals._resolveFilename
const originalLoad = moduleInternals._load
const testRequire = createRequire(import.meta.url)
const serverOnlyStubPath = testRequire.resolve('../spiritualProducts.ts')

let serverModule: typeof import('./linePayExecutor')
try {
  moduleInternals._resolveFilename = function resolveFilenameForTest(
    this: unknown,
    request: string,
    parent: unknown,
    isMain: boolean,
    options?: unknown,
  ) {
    if (request === 'server-only') return serverOnlyStubPath
    return originalResolveFilename.call(this, request, parent, isMain, options)
  }
  moduleInternals._load = function loadForTest(
    this: unknown,
    request: string,
    parent: unknown,
    isMain: boolean,
  ) {
    if (request === 'server-only') return {}
    return originalLoad.call(this, request, parent, isMain)
  }
  serverModule = testRequire(
    './linePayExecutor.ts',
  ) as typeof import('./linePayExecutor')
} finally {
  moduleInternals._resolveFilename = originalResolveFilename
  moduleInternals._load = originalLoad
}

const {
  classifyLinePayExecutorReadinessFailure,
  createLinePayExecutorClient,
  probeLinePayExecutorCallbackReadiness,
} = serverModule

const baseEnv = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://sandbox-project.supabase.co',
  SUPABASE_LINE_PAY_EXECUTOR_API_KEY:
    'sb_secret_executor_test_1234567890_abcdefghijklmnopqrstuvwxyz',
}

test('executor RPC uses the dedicated secret key only as apikey with a fixed endpoint', async () => {
  const calls: Array<{ input: string; init?: RequestInit }> = []
  const client = createLinePayExecutorClient(baseEnv, async (input, init) => {
    calls.push({ input: String(input), init })
    return new Response(JSON.stringify({ finalized: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  })

  const result = await client.rpc(
    'finalize_product_order_line_pay_confirmation',
    { p_environment: 'sandbox' },
  ).single()

  assert.deepEqual(result, { data: { finalized: true }, error: null })
  assert.equal(calls.length, 1)
  assert.equal(
    calls[0]?.input,
    'https://sandbox-project.supabase.co/rest/v1/rpc/finalize_product_order_line_pay_confirmation',
  )
  assert.equal(calls[0]?.init?.method, 'POST')
  assert.equal(calls[0]?.init?.redirect, 'error')
  assert.equal(calls[0]?.init?.cache, 'no-store')
  const headers = new Headers(calls[0]?.init?.headers)
  assert.equal(headers.get('apikey'), baseEnv.SUPABASE_LINE_PAY_EXECUTOR_API_KEY)
  assert.equal(headers.get('authorization'), null)
  assert.equal(headers.get('content-type'), 'application/json')
  assert.equal(headers.get('accept'), 'application/vnd.pgrst.object+json')
  assert.equal(calls[0]?.init?.body, JSON.stringify({ p_environment: 'sandbox' }))
})

test('rejects missing and non-secret executor API keys before network access', () => {
  for (const value of [
    undefined,
    '',
    'sb_publishable_not_allowed',
    'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.signature',
    'legacy-service-role-key',
  ]) {
    let fetchCalls = 0
    assert.throws(
      () => createLinePayExecutorClient(
        { ...baseEnv, SUPABASE_LINE_PAY_EXECUTOR_API_KEY: value },
        async () => {
          fetchCalls += 1
          throw new Error('must_not_fetch')
        },
      ),
      (error: unknown) =>
        error instanceof Error
        && error.message === 'line_pay_executor_config_invalid',
    )
    assert.equal(fetchCalls, 0)
  }
})

test('rejects every RPC except the atomic confirmation finalizer', () => {
  const client = createLinePayExecutorClient(baseEnv, async () => {
    throw new Error('must_not_fetch')
  })

  assert.throws(
    () => client.rpc('arbitrary_function', {}),
    (error: unknown) =>
      error instanceof Error
      && error.message === 'line_pay_executor_rpc_not_allowed',
  )
})

test('returns a redacted stable error and never retries failed RPC requests', async () => {
  let calls = 0
  const secretMarker = baseEnv.SUPABASE_LINE_PAY_EXECUTOR_API_KEY
  const client = createLinePayExecutorClient(baseEnv, async () => {
    calls += 1
    return new Response(JSON.stringify({
      code: 'P0002',
      message: 'line_pay_confirmation_context_not_found',
      details: `must-not-escape-${secretMarker}`,
      hint: '<html>internal</html>',
    }), {
      status: 404,
      headers: { 'content-type': 'application/json' },
    })
  })

  const result = await client.rpc(
    'finalize_product_order_line_pay_confirmation',
    {},
  ).single()
  const serialized = JSON.stringify(result)

  assert.equal(calls, 1)
  assert.deepEqual(result, {
    data: null,
    error: {
      code: 'P0002',
      message: 'line_pay_confirmation_context_not_found',
    },
  })
  assert.equal(serialized.includes(secretMarker), false)
  assert.equal(serialized.includes('details'), false)
  assert.equal(serialized.includes('hint'), false)
  assert.equal(serialized.includes('html'), false)
})

test('readiness probe accepts only the exact no-write sentinel result', async () => {
  let receivedName = ''
  let receivedArgs: Record<string, unknown> | undefined
  const readiness = await probeLinePayExecutorCallbackReadiness({
    rpc: (functionName, args) => {
      receivedName = functionName
      receivedArgs = args
      return {
        single: async () => ({
          data: null,
          error: {
            code: 'P0002',
            message: 'line_pay_confirmation_context_not_found',
          },
        }),
      }
    },
  })

  assert.equal(receivedName, 'finalize_product_order_line_pay_confirmation')
  assert.equal(receivedArgs?.p_environment, 'sandbox')
  assert.deepEqual(readiness, {
    ok: true,
    authenticated: true,
    upstreamCalled: false,
    databaseWrites: false,
  })
  assert.equal(Object.isFrozen(readiness), true)
})

test('readiness probe fails closed for success and unrelated database errors', async () => {
  for (const [result, expectedReason] of [
    [
      { data: { finalized: true }, error: null },
      'rpc_unexpected_result',
    ],
    [
      { data: null, error: { code: '42501', message: 'permission denied' } },
      'rpc_insufficient_privilege',
    ],
    [
      { data: null, error: { code: 'P0002', message: 'different_error' } },
      'rpc_unexpected_result',
    ],
  ] as const) {
    await assert.rejects(
      probeLinePayExecutorCallbackReadiness({
        rpc: () => ({ single: async () => result }),
      }),
      (error: unknown) =>
        classifyLinePayExecutorReadinessFailure(error) === expectedReason,
    )
  }
})

test('readiness probe classifies insufficient privilege without exposing upstream details', async () => {
  const secretMarker = baseEnv.SUPABASE_LINE_PAY_EXECUTOR_API_KEY
  const client = createLinePayExecutorClient(baseEnv, async () =>
    new Response(JSON.stringify({
      code: '42501',
      message: `permission denied ${secretMarker}`,
      details: '<html>internal database detail</html>',
    }), {
      status: 403,
      headers: { 'content-type': 'application/json' },
    }))

  let caught: unknown
  try {
    await probeLinePayExecutorCallbackReadiness(client)
  } catch (error) {
    caught = error
  }

  assert.equal(
    classifyLinePayExecutorReadinessFailure(caught),
    'rpc_insufficient_privilege',
  )
  const serialized = JSON.stringify(caught)
  assert.equal(serialized.includes(secretMarker), false)
  assert.equal(serialized.includes('permission denied'), false)
  assert.equal(serialized.includes('html'), false)
})
