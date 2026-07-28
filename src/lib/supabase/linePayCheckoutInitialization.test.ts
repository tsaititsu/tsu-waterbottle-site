import assert from 'node:assert/strict'
import { test } from 'node:test'
import type {
  InitializeProductOrderLinePayCheckoutInput,
  LinePayCheckoutInitializationRpcClient,
} from './linePayCheckoutInitialization'

const {
  LinePayCheckoutInitializationError,
  initializeProductOrderLinePayCheckout,
} = (await import(
  new URL('./linePayCheckoutInitialization.ts', import.meta.url).href
)) as typeof import('./linePayCheckoutInitialization')

type RpcResponse = {
  data: unknown
  error: unknown
}

function createRpcClient(responses: RpcResponse[]) {
  const calls: Array<{
    functionName: string
    args: Record<string, unknown>
  }> = []
  let responseIndex = 0

  const client: LinePayCheckoutInitializationRpcClient = {
    rpc(functionName, args) {
      return {
        single: async () => {
          calls.push({ functionName, args })
          const response = responses[responseIndex]
          responseIndex += 1

          if (!response) throw new Error('unexpected_rpc_call')
          return response
        },
      }
    },
  }

  return { calls, client }
}

const input: InitializeProductOrderLinePayCheckoutInput = {
  userId: '41000000-0000-4000-8000-000000000001',
  environment: 'sandbox',
  orderNo: 'PO-SANDBOX-ATOMIC-1',
  merchantOrderNo: 'LP_SANDBOX_ATOMIC_1',
  customerName: 'Sandbox Tester',
  customerEmail: 'sandbox@example.test',
  customerPhone: null,
  note: 'synthetic sandbox contract',
  items: [
    {
      productSlug: 'sandbox-contract-item',
      productName: 'Sandbox contract item',
      unitPriceTwd: 100,
      quantity: 1,
      productSnapshot: {
        source: 'synthetic_contract',
      },
    },
  ],
  shippingInfo: {
    recipientName: null,
    recipientPhone: null,
    recipientEmail: null,
    shippingMethod: 'manual',
    postalCode: null,
    address: null,
    storeType: null,
    storeId: null,
    storeName: null,
    storeAddress: null,
    storePhone: null,
  },
  idempotencyKey: 'sandbox-atomic-idempotency-0001',
  requestBodySha256: 'a'.repeat(64),
  confirmTokenHash: 'b'.repeat(64),
  cancelTokenHash: 'c'.repeat(64),
  capabilityExpiresAt: '2026-07-28T06:00:00.000Z',
}

const result = {
  result_code: 'initialized',
  product_order_id: '51000000-0000-4000-8000-000000000001',
  payment_id: '71000000-0000-4000-8000-000000000001',
  attempt_id: '61000000-0000-4000-8000-000000000001',
  outbox_id: '81000000-0000-4000-8000-000000000001',
  confirm_capability_id: '91000000-0000-4000-8000-000000000001',
  cancel_capability_id: '91000000-0000-4000-8000-000000000002',
  merchant_order_no: 'LP_SANDBOX_ATOMIC_1',
  request_state: 'queued',
}

test('calls the single atomic initializer with an exact normalized payload', async () => {
  const rpc = createRpcClient([{ data: result, error: null }])
  const initialized = await initializeProductOrderLinePayCheckout(
    {
      ...input,
      ignoredSecret: 'must-not-cross-rpc-contract',
    } as InitializeProductOrderLinePayCheckoutInput & {
      ignoredSecret: string
    },
    rpc.client,
  )

  assert.deepEqual(rpc.calls, [
    {
      functionName: 'initialize_product_order_line_pay_checkout',
      args: {
        p_payload: {
          user_id: input.userId,
          environment: 'sandbox',
          order_no: input.orderNo,
          merchant_order_no: input.merchantOrderNo,
          customer_name: input.customerName,
          customer_email: input.customerEmail,
          customer_phone: null,
          note: input.note,
          items: [
            {
              product_slug: 'sandbox-contract-item',
              product_name: 'Sandbox contract item',
              unit_price_twd: 100,
              quantity: 1,
              product_snapshot: {
                source: 'synthetic_contract',
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
          idempotency_key: input.idempotencyKey,
          request_body_sha256: input.requestBodySha256,
          confirm_token_hash: input.confirmTokenHash,
          cancel_token_hash: input.cancelTokenHash,
          capability_expires_at: input.capabilityExpiresAt,
        },
      },
    },
  ])
  assert.deepEqual(initialized, result)
  assert.equal(Object.isFrozen(initialized), true)
})

test('accepts an exact already_initialized replay result', async () => {
  const rpc = createRpcClient([
    {
      data: {
        ...result,
        result_code: 'already_initialized',
      },
      error: null,
    },
  ])

  const initialized = await initializeProductOrderLinePayCheckout(
    input,
    rpc.client,
  )

  assert.equal(initialized.result_code, 'already_initialized')
  assert.equal(initialized.product_order_id, result.product_order_id)
})

test('rejects unsafe or malformed input before calling RPC', async () => {
  const invalidInputs: InitializeProductOrderLinePayCheckoutInput[] = [
    {
      ...input,
      requestBodySha256: 'not-a-sha',
    },
    {
      ...input,
      confirmTokenHash: input.cancelTokenHash,
    },
    {
      ...input,
      items: [],
    },
    {
      ...input,
      items: [
        {
          ...input.items[0],
          productSnapshot: {
            nested: {
              channelSecret: 'synthetic-sensitive-value',
            },
          },
        },
      ],
    },
  ]

  for (const invalidInput of invalidInputs) {
    const rpc = createRpcClient([])
    await assert.rejects(
      () => initializeProductOrderLinePayCheckout(invalidInput, rpc.client),
      (error: unknown) =>
        error instanceof LinePayCheckoutInitializationError
        && error.code === 'invalid_input'
        && error.message === 'line_pay_checkout_initialization_error'
        && !JSON.stringify(error).includes('synthetic-sensitive-value'),
    )
    assert.equal(rpc.calls.length, 0)
  }
})

test('maps database failures to a stable non-sensitive error', async () => {
  const rpc = createRpcClient([
    {
      data: null,
      error: {
        code: '23505',
        message: 'raw database payload with private details',
      },
    },
  ])

  await assert.rejects(
    () => initializeProductOrderLinePayCheckout(input, rpc.client),
    (error: unknown) =>
      error instanceof LinePayCheckoutInitializationError
      && error.code === 'rpc_failed'
      && error.message === 'line_pay_checkout_initialization_error'
      && !JSON.stringify(error).includes('raw database payload'),
  )
})

test('fails closed on extra fields or inconsistent RPC results', async () => {
  for (const invalidResult of [
    {
      ...result,
      unexpected: 'must-fail-closed',
    },
    {
      ...result,
      merchant_order_no: 'DIFFERENT_ORDER',
    },
    {
      ...result,
      request_state: 'initialized',
    },
  ]) {
    const rpc = createRpcClient([{ data: invalidResult, error: null }])
    await assert.rejects(
      () => initializeProductOrderLinePayCheckout(input, rpc.client),
      (error: unknown) =>
        error instanceof LinePayCheckoutInitializationError
        && error.code === 'contract_mismatch'
        && error.message === 'line_pay_checkout_initialization_error',
    )
  }
})
