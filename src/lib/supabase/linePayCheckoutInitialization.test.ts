import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import Module, { createRequire } from 'node:module'
import { test } from 'node:test'
import type {
  InitializeProductOrderLinePayCheckoutInput,
  LinePayCheckoutInitializationRpcClient,
  LinePayCheckoutInitializationTrustedServerContext,
} from './linePayCheckoutInitialization'

type NodeModuleInternals = {
  _resolveFilename: (
    request: string,
    parent: unknown,
    isMain: boolean,
    options?: unknown,
  ) => string
  _load: (
    request: string,
    parent: unknown,
    isMain: boolean,
  ) => unknown
}

const moduleInternals = Module as unknown as NodeModuleInternals
const originalResolveFilename = moduleInternals._resolveFilename
const originalLoad = moduleInternals._load
const testRequire = createRequire(import.meta.url)
const serverOnlyStubPath = testRequire.resolve('../spiritualProducts.ts')

let serverModule: typeof import('./linePayCheckoutInitialization')
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
    './linePayCheckoutInitialization.ts',
  ) as typeof import('./linePayCheckoutInitialization')
} finally {
  moduleInternals._resolveFilename = originalResolveFilename
  moduleInternals._load = originalLoad
}

const {
  LinePayCheckoutInitializationError,
  initializeProductOrderLinePayCheckout,
} = serverModule
const adapterSource = readFileSync(
  new URL('./linePayCheckoutInitialization.ts', import.meta.url),
  'utf8',
)

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

function createRejectingRpcClient(rejection: Error) {
  let calls = 0
  const client: LinePayCheckoutInitializationRpcClient = {
    rpc() {
      return {
        single: async () => {
          calls += 1
          throw rejection
        },
      }
    },
  }

  return {
    client,
    get calls() {
      return calls
    },
  }
}

const input: InitializeProductOrderLinePayCheckoutInput = {
  orderNo: 'PO-SANDBOX-ATOMIC-1',
  merchantOrderNo: 'LP_SANDBOX_ATOMIC_1',
  customerName: 'Sandbox Tester',
  customerEmail: 'sandbox@example.test',
  customerPhone: null,
  note: 'synthetic sandbox contract',
  items: [
    {
      productSlug: 'ren-yuan-fu',
      quantity: 1,
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

const trustedContext: LinePayCheckoutInitializationTrustedServerContext = {
  authenticatedUserId: '41000000-0000-4000-8000-000000000001',
  environment: 'sandbox',
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

test('keeps the trusted initialization adapter on the server boundary', () => {
  assert.equal(adapterSource.split('\n')[0], "import 'server-only'")
  assert.match(adapterSource, /spiritualProducts/)
  assert.doesNotMatch(
    adapterSource,
    /NEXT_PUBLIC_(?:SUPABASE_SERVICE_ROLE_KEY|LINE_PAY_CHANNEL_SECRET)/,
  )
})

test('calls the single atomic initializer with an exact normalized payload', async () => {
  const rpc = createRpcClient([{ data: result, error: null }])
  const initialized = await initializeProductOrderLinePayCheckout(
    {
      ...input,
      ignoredSecret: 'must-not-cross-rpc-contract',
      userId: '42000000-0000-4000-8000-000000000002',
      environment: 'production',
      items: [
        {
          productSlug: 'ren-yuan-fu',
          quantity: 1,
          unitPriceTwd: 1,
          productName: 'client-spoofed-name',
          productSnapshot: {
            channelSecret: 'must-not-cross-rpc-contract',
          },
        },
      ],
    } as InitializeProductOrderLinePayCheckoutInput & {
      ignoredSecret: string
      userId: string
      environment: string
      items: Array<InitializeProductOrderLinePayCheckoutInput['items'][number] & {
        unitPriceTwd: number
        productName: string
        productSnapshot: Record<string, unknown>
      }>
    },
    trustedContext,
    rpc.client,
  )

  assert.deepEqual(rpc.calls, [
    {
      functionName: 'initialize_product_order_line_pay_checkout',
      args: {
        p_payload: {
          user_id: trustedContext.authenticatedUserId,
          environment: 'sandbox',
          order_no: input.orderNo,
          merchant_order_no: input.merchantOrderNo,
          customer_name: input.customerName,
          customer_email: input.customerEmail,
          customer_phone: null,
          note: input.note,
          items: [
            {
              product_slug: 'ren-yuan-fu',
              product_name: '人緣符',
              unit_price_twd: 1500,
              quantity: 1,
              product_snapshot: {
                slug: 'ren-yuan-fu',
                name: '人緣符',
                category: '符咒商品',
                priceTwd: 1500,
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
    trustedContext,
    rpc.client,
  )

  assert.equal(initialized.result_code, 'already_initialized')
  assert.equal(initialized.product_order_id, result.product_order_id)
})

test('accepts a replay after the request state has advanced', async () => {
  for (const requestState of [
    'claimed',
    'requesting',
    'pending',
    'succeeded',
    'failed',
    'unknown',
    'reconciliation_required',
    'confirmation_processing',
    'paid',
    'canceled',
  ] as const) {
    const rpc = createRpcClient([
      {
        data: {
          ...result,
          result_code: 'already_initialized',
          request_state: requestState,
        },
        error: null,
      },
    ])

    const initialized = await initializeProductOrderLinePayCheckout(
      input,
      trustedContext,
      rpc.client,
    )

    assert.equal(initialized.result_code, 'already_initialized')
    assert.equal(initialized.request_state, requestState)
  }
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
          productSlug: 'not-a-server-catalog-product',
        },
      ],
    },
  ]

  for (const invalidInput of invalidInputs) {
    const rpc = createRpcClient([])
    await assert.rejects(
      () => initializeProductOrderLinePayCheckout(
        invalidInput,
        trustedContext,
        rpc.client,
      ),
      (error: unknown) =>
        error instanceof LinePayCheckoutInitializationError
        && error.code === 'invalid_input'
        && error.message === 'line_pay_checkout_initialization_error'
        && !JSON.stringify(error).includes('synthetic-sensitive-value'),
    )
    assert.equal(rpc.calls.length, 0)
  }

  for (const invalidContext of [
    {
      ...trustedContext,
      authenticatedUserId: 'not-a-user-id',
    },
    {
      ...trustedContext,
      environment: 'preview',
    },
  ]) {
    const rpc = createRpcClient([])
    await assert.rejects(
      () => initializeProductOrderLinePayCheckout(
        input,
        invalidContext as LinePayCheckoutInitializationTrustedServerContext,
        rpc.client,
      ),
      (error: unknown) =>
        error instanceof LinePayCheckoutInitializationError
        && error.code === 'invalid_input'
        && error.message === 'line_pay_checkout_initialization_error',
    )
    assert.equal(rpc.calls.length, 0)
  }
})

test('rejects malformed contact fields before calling RPC', async () => {
  const invalidInputs: InitializeProductOrderLinePayCheckoutInput[] = [
    {
      ...input,
      customerEmail: 'not-an-email',
    },
    {
      ...input,
      customerPhone: 'call-me-maybe',
    },
    {
      ...input,
      shippingInfo: {
        ...input.shippingInfo,
        recipientEmail: 'missing-domain@example',
      },
    },
    {
      ...input,
      shippingInfo: {
        ...input.shippingInfo,
        recipientPhone: 'private-phone-value',
      },
    },
    {
      ...input,
      shippingInfo: {
        ...input.shippingInfo,
        postalCode: '100<script>',
      },
    },
    {
      ...input,
      shippingInfo: {
        ...input.shippingInfo,
        storePhone: 'store-phone-value',
      },
    },
  ]

  for (const invalidInput of invalidInputs) {
    const rpc = createRpcClient([])
    await assert.rejects(
      () => initializeProductOrderLinePayCheckout(
        invalidInput,
        trustedContext,
        rpc.client,
      ),
      (error: unknown) =>
        error instanceof LinePayCheckoutInitializationError
        && error.code === 'invalid_input'
        && error.message === 'line_pay_checkout_initialization_error',
    )
    assert.equal(rpc.calls.length, 0)
  }
})

test('rejects incomplete production shipping before calling RPC', async () => {
  const rpc = createRpcClient([])

  await assert.rejects(
    () => initializeProductOrderLinePayCheckout(
      input,
      {
        ...trustedContext,
        environment: 'production',
      },
      rpc.client,
    ),
    (error: unknown) =>
      error instanceof LinePayCheckoutInitializationError
      && error.code === 'invalid_input'
      && error.message === 'line_pay_checkout_initialization_error',
  )

  assert.equal(rpc.calls.length, 0)
})

test('rejects every omitted production shipping field for every method', async () => {
  const shippingCases = [
    {
      method: 'manual',
      requiredFields: ['recipientName', 'recipientPhone', 'address'],
    },
    {
      method: 'home_delivery',
      requiredFields: ['recipientName', 'recipientPhone', 'address'],
    },
    {
      method: 'convenience_store_c2c',
      requiredFields: [
        'recipientName',
        'recipientPhone',
        'storeType',
        'storeId',
        'storeName',
        'storeAddress',
      ],
    },
    {
      method: 'convenience_store_b2c',
      requiredFields: [
        'recipientName',
        'recipientPhone',
        'storeType',
        'storeId',
        'storeName',
        'storeAddress',
      ],
    },
  ] as const

  for (const shippingCase of shippingCases) {
    const completeShipping = {
      ...input.shippingInfo,
      recipientName: 'Production Recipient',
      recipientPhone: '0900000000',
      shippingMethod: shippingCase.method,
      address: 'Synthetic production address',
      storeType: 'synthetic_store',
      storeId: 'SYNTHETIC-STORE-001',
      storeName: 'Synthetic Store',
      storeAddress: 'Synthetic store address',
    }

    for (const field of shippingCase.requiredFields) {
      const rpc = createRpcClient([])
      const incompleteShipping = { ...completeShipping }
      delete (incompleteShipping as Record<string, unknown>)[field]
      await assert.rejects(
        () => initializeProductOrderLinePayCheckout(
          {
            ...input,
            shippingInfo: incompleteShipping,
          },
          {
            ...trustedContext,
            environment: 'production',
          },
          rpc.client,
        ),
        (error: unknown) =>
          error instanceof LinePayCheckoutInitializationError
          && error.code === 'invalid_input'
          && error.message === 'line_pay_checkout_initialization_error',
      )
      assert.equal(
        rpc.calls.length,
        0,
        `${shippingCase.method}.${field} reached RPC`,
      )
    }
  }
})

test('accepts complete production shipping for every supported method', async () => {
  for (const shippingMethod of [
    'manual',
    'home_delivery',
    'convenience_store_c2c',
    'convenience_store_b2c',
  ] as const) {
    const rpc = createRpcClient([{ data: result, error: null }])
    await initializeProductOrderLinePayCheckout(
      {
        ...input,
        shippingInfo: {
          ...input.shippingInfo,
          recipientName: 'Production Recipient',
          recipientPhone: '0900000000',
          shippingMethod,
          address: 'Synthetic production address',
          storeType: 'synthetic_store',
          storeId: 'SYNTHETIC-STORE-001',
          storeName: 'Synthetic Store',
          storeAddress: 'Synthetic store address',
        },
      },
      {
        ...trustedContext,
        environment: 'production',
      },
      rpc.client,
    )

    assert.equal(rpc.calls.length, 1)
    const payload = rpc.calls[0].args.p_payload as {
      shipping_info: { shipping_method: string }
    }
    assert.equal(payload.shipping_info.shipping_method, shippingMethod)
  }
})

test('accepts complete production manual shipping', async () => {
  const rpc = createRpcClient([{ data: result, error: null }])

  await initializeProductOrderLinePayCheckout(
    {
      ...input,
      shippingInfo: {
        ...input.shippingInfo,
        recipientName: 'Production Recipient',
        recipientPhone: '0900000000',
        address: 'Synthetic production address',
      },
    },
    {
      ...trustedContext,
      environment: 'production',
    },
    rpc.client,
  )

  assert.equal(rpc.calls.length, 1)
  const payload = rpc.calls[0].args.p_payload as {
    environment: string
    shipping_info: Record<string, unknown>
  }
  assert.equal(payload.environment, 'production')
  assert.deepEqual(payload.shipping_info, {
    recipient_name: 'Production Recipient',
    recipient_phone: '0900000000',
    recipient_email: null,
    shipping_method: 'manual',
    postal_code: null,
    address: 'Synthetic production address',
    store_type: null,
    store_id: null,
    store_name: null,
    store_address: null,
    store_phone: null,
  })
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
    () => initializeProductOrderLinePayCheckout(
      input,
      trustedContext,
      rpc.client,
    ),
    (error: unknown) =>
      error instanceof LinePayCheckoutInitializationError
      && error.code === 'rpc_failed'
      && error.message === 'line_pay_checkout_initialization_error'
      && !JSON.stringify(error).includes('raw database payload'),
  )
})

test('maps an RPC promise rejection to a stable non-sensitive error', async () => {
  const rpc = createRejectingRpcClient(
    new Error('raw network failure with private connection details'),
  )

  await assert.rejects(
    () => initializeProductOrderLinePayCheckout(
      input,
      trustedContext,
      rpc.client,
    ),
    (error: unknown) =>
      error instanceof LinePayCheckoutInitializationError
      && error.code === 'rpc_failed'
      && error.message === 'line_pay_checkout_initialization_error'
      && !JSON.stringify(error).includes('raw network failure')
      && !JSON.stringify(error).includes('private connection details'),
  )
  assert.equal(rpc.calls, 1)
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
      request_state: 'not-a-request-state',
    },
    {
      ...result,
      result_code: 'initialized',
      request_state: 'claimed',
    },
  ]) {
    const rpc = createRpcClient([{ data: invalidResult, error: null }])
    await assert.rejects(
      () => initializeProductOrderLinePayCheckout(
        input,
        trustedContext,
        rpc.client,
      ),
      (error: unknown) =>
        error instanceof LinePayCheckoutInitializationError
        && error.code === 'contract_mismatch'
        && error.message === 'line_pay_checkout_initialization_error',
    )
  }
})
