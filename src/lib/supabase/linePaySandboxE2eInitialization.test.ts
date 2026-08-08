import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { LinePayCheckoutInitializationRpcClient } from './linePayCheckoutInitialization'
import {
  LinePaySandboxE2eInitializationError,
  initializeLinePayOneDollarTestCheckout,
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
    amountTwd: 1 as const,
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

test('calls only the atomic initializer with the fixed NT$1 Sandbox item', async () => {
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
          note: 'Preview-only LINE Pay Sandbox NT$1 E2E',
          items: [
            {
              product_slug: 'line-pay-sandbox-e2e-nt1',
              product_name: 'LINE Pay Sandbox E2E 測試',
              unit_price_twd: 1,
              quantity: 1,
              product_snapshot: {
                slug: 'line-pay-sandbox-e2e-nt1',
                name: 'LINE Pay Sandbox E2E 測試',
                category: '符咒商品',
                priceTwd: 1,
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

test('Production NT$1 test uses a fixed non-fulfillment snapshot and complete synthetic shipping data', async () => {
  const rpc = createClient({ data: result, error: null })
  const initialized = await initializeLinePayOneDollarTestCheckout({
    ...createInput(rpc.client),
    environment: 'production',
    entrySource: 'booking',
    orderNo: 'LPONE-a1000000000040008000000000000001',
    idempotencyKey:
      'line-pay-production-one-dollar:a1000000-0000-4000-8000-000000000001',
  })

  assert.deepEqual(rpc.calls, [
    {
      functionName: 'initialize_product_order_line_pay_checkout',
      args: {
        p_payload: {
          user_id: userId,
          environment: 'production',
          order_no: 'LPONE-a1000000000040008000000000000001',
          merchant_order_no: result.merchant_order_no,
          customer_name: 'LINE Pay NT$1 入口測試｜水瓶先生論命',
          customer_email: null,
          customer_phone: '0900000000',
          note: 'Production 管理員 NT$1 入口測試｜水瓶先生論命；不出貨、不提供服務',
          items: [
            {
              product_slug: 'line-pay-production-one-dollar-test-booking',
              product_name: 'LINE Pay NT$1 入口測試｜水瓶先生論命（不出貨／不提供服務）',
              unit_price_twd: 1,
              quantity: 1,
              product_snapshot: {
                slug: 'line-pay-production-one-dollar-test-booking',
                name: 'LINE Pay NT$1 入口測試｜水瓶先生論命（不出貨／不提供服務）',
                category: '符咒商品',
                priceTwd: 1,
              },
            },
          ],
          shipping_info: {
            recipient_name: 'LINE Pay NT$1 測試（請勿出貨）',
            recipient_phone: '0900000000',
            recipient_email: null,
            shipping_method: 'manual',
            postal_code: null,
            address: '內部金流測試訂單，請勿出貨',
            store_type: null,
            store_id: null,
            store_name: null,
            store_address: null,
            store_phone: null,
          },
          idempotency_key:
            'line-pay-production-one-dollar:a1000000-0000-4000-8000-000000000001',
          request_body_sha256: 'a'.repeat(64),
          confirm_token_hash: 'b'.repeat(64),
          cancel_token_hash: 'c'.repeat(64),
          capability_expires_at: '2026-07-31T12:30:00.000Z',
        },
      },
    },
  ])
  assert.deepEqual(initialized, result)
})

test('production or a non-1 amount fails before RPC', async () => {
  const rpc = createClient({ data: result, error: null })

  for (const override of [
    { environment: 'production' },
    { amountTwd: 2 },
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

test('RPC failures expose only fixed diagnostic reasons', async () => {
  const secret = 'sensitive-database-detail'
  const cases = [
    {
      error: {
        code: '42501',
        message: `permission denied ${secret}`,
        details: secret,
      },
      reason: 'rpc_insufficient_privilege',
    },
    {
      error: {
        code: '23503',
        message: `foreign key detail ${secret}`,
        details: secret,
      },
      reason: 'rpc_foreign_key_violation',
    },
    {
      error: {
        code: '23514',
        message: `check detail ${secret}`,
        details: secret,
      },
      reason: 'rpc_check_violation',
    },
    {
      error: {
        code: '22023',
        message: 'line_pay_initialization_invalid_input',
        details: secret,
      },
      reason: 'database_invalid_input',
    },
    {
      error: {
        code: 'P0001',
        message: `unreviewed application detail ${secret}`,
        details: secret,
      },
      reason: 'rpc_application_exception',
    },
  ] as const

  for (const testCase of cases) {
    const rpc = createClient({ data: null, error: testCase.error })
    await assert.rejects(
      () => initializeLinePaySandboxE2eCheckout(createInput(rpc.client)),
      (error: unknown) =>
        error instanceof LinePaySandboxE2eInitializationError
        && error.code === 'rpc_failed'
        && error.reason === testCase.reason
        && !JSON.stringify(error).includes(secret),
    )
  }
})
