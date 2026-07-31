import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { LinePayCheckoutInitializationRpcClient } from './linePayCheckoutInitialization'
import {
  LinePaySandboxE2eInitializationError,
  initializeLinePaySandboxE2eCheckout,
} from './linePaySandboxE2eInitialization'

const userId = '41000000-0000-4000-8000-000000000001'
const result = {
  result_code: 'initialized',
  product_order_id: '51000000-0000-4000-8000-000000000001',
  payment_id: '71000000-0000-4000-8000-000000000001',
  attempt_id: '61000000-0000-4000-8000-000000000001',
  outbox_id: '81000000-0000-4000-8000-000000000001',
  confirm_capability_id: '91000000-0000-4000-8000-000000000001',
  cancel_capability_id: '91000000-0000-4000-8000-000000000002',
  merchant_order_no: 'LP_E2E_a1000000000040008000000000000001',
  request_state: 'queued',
}

function createClient(response: { data: unknown; error: unknown }) {
  const calls: Array<{ functionName: string; args: Record<string, unknown> }> = []
  const client: LinePayCheckoutInitializationRpcClient = {
    rpc(functionName, args) {
      return {
        single: async () => {
          calls.push({ functionName, args })
          return response
        },
      }
    },
  }
  return { calls, client }
}

function createInput(client: LinePayCheckoutInitializationRpcClient) {
  return {
    client,
    userId,
    environment: 'sandbox' as const,
    amountTwd: 50 as const,
    orderNo: 'LPE2E-a1000000000040008000000000000001',
    merchantOrderNo: result.merchant_order_no,
    idempotencyKey:
      'line-pay-sandbox-e2e:a1000000-0000-4000-8000-000000000001',
    requestBodySha256: 'a'.repeat(64),
    confirmTokenHash: 'b'.repeat(64),
    cancelTokenHash: 'c'.repeat(64),
    capabilityExpiresAt: '2026-07-31T12:30:00.000Z',
  }
}

test('calls only the atomic initializer with the fixed NT$50 Sandbox item', async () => {
  const rpc = createClient({ data: result, error: null })
  const initialized = await initializeLinePaySandboxE2eCheckout(
    createInput(rpc.client),
  )

  assert.deepEqual(rpc.calls, [
    {
      functionName: 'initialize_product_order_line_pay_checkout',
      args: {
        p_payload: {
          user_id: userId,
          environment: 'sandbox',
          order_no: 'LPE2E-a1000000000040008000000000000001',
          merchant_order_no: result.merchant_order_no,
          customer_name: 'LINE Pay Sandbox E2E',
          customer_email: null,
          customer_phone: null,
          note: 'Preview-only LINE Pay Sandbox NT$50 E2E',
          items: [
            {
              product_slug: 'line-pay-sandbox-e2e-nt50',
              product_name: 'LINE Pay Sandbox E2E 測試',
              unit_price_twd: 50,
              quantity: 1,
              product_snapshot: {
                slug: 'line-pay-sandbox-e2e-nt50',
                name: 'LINE Pay Sandbox E2E 測試',
                category: '符咒商品',
                priceTwd: 50,
              },
            },
          ],
          shipping_info: {
            recipient_name: null,
            recipient_phone: null,
            recipient_email: null,
            shipping_method: 'manual',
            postal_code: null,
            address: null,
            store_type: null,
            store_id: null,
            store_name: null,
            store_address: null,
            store_phone: null,
          },
          idempotency_key:
            'line-pay-sandbox-e2e:a1000000-0000-4000-8000-000000000001',
          request_body_sha256: 'a'.repeat(64),
          confirm_token_hash: 'b'.repeat(64),
          cancel_token_hash: 'c'.repeat(64),
          capability_expires_at: '2026-07-31T12:30:00.000Z',
        },
      },
    },
  ])
  assert.deepEqual(initialized, result)
  assert.equal(Object.isFrozen(initialized), true)
})

test('production or a non-50 amount fails before RPC', async () => {
  const rpc = createClient({ data: result, error: null })

  for (const override of [
    { environment: 'production' },
    { amountTwd: 51 },
  ]) {
    await assert.rejects(
      () =>
        initializeLinePaySandboxE2eCheckout({
          ...createInput(rpc.client),
          ...override,
        } as ReturnType<typeof createInput>),
      (error: unknown) =>
        error instanceof LinePaySandboxE2eInitializationError
        && error.code === 'invalid_input',
    )
  }

  assert.equal(rpc.calls.length, 0)
})

test('RPC and response contract errors are redacted', async () => {
  const secret = 'database-secret-detail'
  const rpcFailure = createClient({
    data: null,
    error: { message: secret },
  })
  await assert.rejects(
    () => initializeLinePaySandboxE2eCheckout(createInput(rpcFailure.client)),
    (error: unknown) =>
      error instanceof LinePaySandboxE2eInitializationError
      && error.code === 'rpc_failed'
      && !JSON.stringify(error).includes(secret),
  )

  const invalidResponse = createClient({
    data: { ...result, unexpected: secret },
    error: null,
  })
  await assert.rejects(
    () => initializeLinePaySandboxE2eCheckout(createInput(invalidResponse.client)),
    (error: unknown) =>
      error instanceof LinePaySandboxE2eInitializationError
      && error.code === 'contract_mismatch'
      && !JSON.stringify(error).includes(secret),
  )
})
