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

const { createLinePayExecutorClient } = serverModule

function base64url(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

function executorJwt(overrides: Record<string, unknown> = {}) {
  const nowSeconds = Math.floor(Date.now() / 1000)
  return [
    base64url({ alg: 'HS256', typ: 'JWT' }),
    base64url({
      aud: 'authenticated',
      exp: nowSeconds + 300,
      role: 'line_pay_payment_executor',
      ...overrides,
    }),
    'test-signature',
  ].join('.')
}

test('creates a server-only Supabase client with the dedicated executor JWT', () => {
  const calls: unknown[][] = []
  const expectedClient = Object.freeze({
    rpc: () => ({ single: async () => ({ data: null, error: null }) }),
  })
  const token = executorJwt()
  const client = createLinePayExecutorClient(
    {
      NEXT_PUBLIC_SUPABASE_URL: 'https://sandbox-project.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sandbox-anon-key',
      SUPABASE_LINE_PAY_EXECUTOR_JWT: token,
    },
    (...args: unknown[]) => {
      calls.push(args)
      return expectedClient
    },
  )

  assert.equal(client, expectedClient)
  assert.equal(calls.length, 1)
  assert.equal(calls[0]?.[0], 'https://sandbox-project.supabase.co')
  assert.equal(calls[0]?.[1], 'sandbox-anon-key')
  assert.deepEqual(calls[0]?.[2], {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: { Authorization: `Bearer ${token}` },
    },
  })
})

test('rejects absent, expired, service-role, and unsigned executor credentials', () => {
  const baseEnv = {
    NEXT_PUBLIC_SUPABASE_URL: 'https://sandbox-project.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sandbox-anon-key',
  }
  const invalidTokens = [
    undefined,
    executorJwt({ exp: 1 }),
    executorJwt({ role: 'service_role' }),
    `${base64url({ alg: 'none', typ: 'JWT' })}.${base64url({
      aud: 'authenticated',
      exp: Math.floor(Date.now() / 1000) + 300,
      role: 'line_pay_payment_executor',
    })}.`,
  ]

  for (const token of invalidTokens) {
    assert.throws(
      () =>
        createLinePayExecutorClient(
          { ...baseEnv, SUPABASE_LINE_PAY_EXECUTOR_JWT: token },
          () => {
            throw new Error('must_not_create_client')
          },
        ),
      (error: unknown) =>
        error instanceof Error
        && error.message === 'line_pay_executor_config_invalid',
    )
  }
})
