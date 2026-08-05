import assert from 'node:assert/strict'
import Module, { createRequire } from 'node:module'
import { test } from 'node:test'
import type { LinePayCheckoutInitializationRpcClient } from './linePayCheckoutInitialization'

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

let serverModule: typeof import('./linePayServiceCheckoutInitialization')
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
    './linePayServiceCheckoutInitialization.ts',
  ) as typeof import('./linePayServiceCheckoutInitialization')
} finally {
  moduleInternals._resolveFilename = originalResolveFilename
  moduleInternals._load = originalLoad
}

const {
  LinePayServiceCheckoutInitializationError,
  initializeServiceLinePayCheckout,
} = serverModule

const result = {
  result_code: 'initialized',
  product_order_id: '51000000-0000-4000-8000-000000000001',
  payment_id: '61000000-0000-4000-8000-000000000001',
  attempt_id: '71000000-0000-4000-8000-000000000001',
  outbox_id: '81000000-0000-4000-8000-000000000001',
  confirm_capability_id: '91000000-0000-4000-8000-000000000001',
  cancel_capability_id: 'a1000000-0000-4000-8000-000000000001',
  merchant_order_no: 'LP_SVC_ATOMIC_1',
  request_state: 'queued',
}

function client(response: { data: unknown; error: unknown }) {
  const calls: Array<{ functionName: string; args: Record<string, unknown> }> = []
  const rpcClient: LinePayCheckoutInitializationRpcClient = {
    rpc(functionName, args) {
      return {
        single: async () => {
          calls.push({ functionName, args })
          return response
        },
      }
    },
  }
  return { calls, rpcClient }
}

const input = {
  orderNo: 'PO_LPSVC_ATOMIC_1',
  merchantOrderNo: 'LP_SVC_ATOMIC_1',
  target: {
    source: 'ai_chart_report' as const,
    sourceId: '41000000-0000-4000-8000-000000000001',
    itemType: 'ai_chart_report' as const,
    itemName: 'AI 命盤分析',
    amountTwd: 100,
    bookingId: null,
    returnPath: '/ai-chart/result/41000000-0000-4000-8000-000000000001',
  },
  idempotencyKey: 'ai-chart-line-pay:41000000-0000-4000-8000-000000000001',
  requestBodySha256: 'a'.repeat(64),
  confirmTokenHash: 'b'.repeat(64),
  cancelTokenHash: 'c'.repeat(64),
  capabilityExpiresAt: '2026-08-05T02:00:00.000Z',
}

test('sends only the exact trusted service checkout contract to one RPC', async () => {
  const rpc = client({ data: result, error: null })
  const initialized = await initializeServiceLinePayCheckout(
    input,
    {
      authenticatedUserId: '31000000-0000-4000-8000-000000000001',
      environment: 'production',
    },
    rpc.rpcClient,
  )

  assert.equal(initialized.payment_id, result.payment_id)
  assert.deepEqual(rpc.calls, [
    {
      functionName: 'initialize_service_line_pay_checkout',
      args: {
        p_payload: {
          user_id: '31000000-0000-4000-8000-000000000001',
          environment: 'production',
          order_no: input.orderNo,
          merchant_order_no: input.merchantOrderNo,
          source_type: 'ai_chart_report',
          source_id: input.target.sourceId,
          item_name: 'AI 命盤分析',
          amount_twd: 100,
          booking_id: null,
          return_path: input.target.returnPath,
          idempotency_key: input.idempotencyKey,
          request_body_sha256: input.requestBodySha256,
          confirm_token_hash: input.confirmTokenHash,
          cancel_token_hash: input.cancelTokenHash,
          capability_expires_at: input.capabilityExpiresAt,
        },
      },
    },
  ])
  assert.equal(JSON.stringify(rpc.calls).includes('channelSecret'), false)
})

test('rejects an invalid trusted user before calling RPC', async () => {
  const rpc = client({ data: result, error: null })
  await assert.rejects(
    initializeServiceLinePayCheckout(
      input,
      { authenticatedUserId: 'not-a-user', environment: 'production' },
      rpc.rpcClient,
    ),
    (error: unknown) =>
      error instanceof LinePayServiceCheckoutInitializationError
      && error.code === 'invalid_input',
  )
  assert.equal(rpc.calls.length, 0)
})

test('rejects additional or malformed RPC result fields', async () => {
  const rpc = client({
    data: { ...result, channel_secret: 'must-not-cross-contract' },
    error: null,
  })
  await assert.rejects(
    initializeServiceLinePayCheckout(
      input,
      {
        authenticatedUserId: '31000000-0000-4000-8000-000000000001',
        environment: 'production',
      },
      rpc.rpcClient,
    ),
    (error: unknown) =>
      error instanceof LinePayServiceCheckoutInitializationError
      && error.code === 'contract_mismatch',
  )
})
