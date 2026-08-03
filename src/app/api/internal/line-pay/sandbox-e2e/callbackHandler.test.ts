import assert from 'node:assert/strict'
import type { ProductOrderLinePayCapabilityDatabase } from '../../../product-orders/line-pay/capabilityHandler'
import { linePaySandboxE2eCapabilityCookieName } from './capabilityToken'
import { buildLinePaySandboxE2eCallbackDiagnostic } from './callbackDiagnostic'
import { handleLinePaySandboxE2eCapabilityCallback } from './callbackHandler'

const tests: Array<{
  name: string
  run: () => void | Promise<void>
}> = []

function test(name: string, run: () => void | Promise<void>) {
  tests.push({ name, run })
}

async function runTests() {
  for (const testCase of tests) {
    await testCase.run()
    console.log(`✓ ${testCase.name}`)
  }
}

const ids = {
  paymentId: '71000000-0000-4000-8000-000000000001',
  productOrderId: '51000000-0000-4000-8000-000000000001',
  attemptId: '61000000-0000-4000-8000-000000000001',
  capabilityId: '91000000-0000-4000-8000-000000000001',
  callbackEventId: '92000000-0000-4000-8000-000000000001',
  claimId: 'a1000000-0000-4000-8000-000000000001',
}
const merchantOrderNo = 'LP_E2E_a1000000000040008000000000000001'
const transactionId = '92233720368547758081234567890'

const enabledEnv = {
  VERCEL_ENV: 'preview',
  VERCEL_GIT_COMMIT_SHA: '5d2b264410656d59d5145e57b47709a9a7e95a3c',
  NEXT_PUBLIC_ENABLE_LINE_PAY: 'true',
  LINE_PAY_ENV: 'sandbox',
  LINE_PAY_TRANSPORT: 'gateway',
  LINE_PAY_SANDBOX_E2E_ENABLED: 'true',
  LINE_PAY_CHANNEL_ID: 'sandbox-channel-id',
  LINE_PAY_CHANNEL_SECRET: 'sandbox-channel-secret',
  LINE_PAY_CONFIRM_URL: 'https://preview.example.com/unused-confirm',
  LINE_PAY_CANCEL_URL: 'https://preview.example.com/unused-cancel',
}

function database(): ProductOrderLinePayCapabilityDatabase {
  return {
    claimCapability: async () => ({
      resultCode: 'claimed',
      capabilityId: ids.capabilityId,
      callbackEventId: ids.callbackEventId,
    }),
    claimConfirmation: async () => ({ resultCode: 'claimed' }),
    finalizeConfirmation: async () => ({
      resultCode: 'completed',
      transactionId,
    }),
    cancelPayment: async () => ({
      resultCode: 'canceled',
      requestState: 'canceled',
    }),
    markReconciliation: async () => ({
      resultCode: 'marked',
      requestState: 'reconciliation_required',
    }),
  }
}

test('Preview-only gate hides callback before database or provider access', async () => {
  for (const env of [
    { ...enabledEnv, VERCEL_ENV: 'production' },
    { ...enabledEnv, LINE_PAY_ENV: 'production' },
    { ...enabledEnv, LINE_PAY_TRANSPORT: 'direct' },
    { ...enabledEnv, LINE_PAY_SANDBOX_E2E_ENABLED: 'false' },
  ]) {
    let reads = 0
    let providerCalls = 0
    const response = await handleLinePaySandboxE2eCapabilityCallback({
      purpose: 'confirm',
      request: new Request(
        `https://preview.example.com/api/internal/line-pay/sandbox-e2e/confirm?orderId=${merchantOrderNo}&transactionId=${transactionId}&capability=token`,
      ),
      env,
      readContext: async () => {
        reads += 1
        return null
      },
      database: database(),
      confirmPayment: async () => {
        providerCalls += 1
        throw new Error('must_not_call')
      },
    })

    assert.equal(response.status, 404)
    assert.equal(reads, 0)
    assert.equal(providerCalls, 0)
  }
})

test('enabled Preview Sandbox delegates to capability completion contract', async () => {
  const response = await handleLinePaySandboxE2eCapabilityCallback({
    purpose: 'confirm',
    request: new Request(
      `https://preview.example.com/api/internal/line-pay/sandbox-e2e/confirm?orderId=${merchantOrderNo}&transactionId=${transactionId}&capability=token`,
    ),
    env: enabledEnv,
    readContext: async () => ({
      ...ids,
      environment: 'sandbox',
      status: 'pending',
      requestState: 'pending',
      amountTwd: 50,
      currency: 'TWD',
      merchantOrderNo,
      transactionId,
    }),
    database: database(),
    confirmPayment: async () => ({
      returnCode: '0000',
      returnMessage: 'Success',
      transactionId,
      orderId: merchantOrderNo,
    }),
    createUuid: () => ids.claimId,
  })

  assert.equal(response.status, 200)
  assert.equal((await response.json()).markedPaid, true)
})

test('documented LINE Pay callback uses HttpOnly capability instead of custom query', async () => {
  let claimCalls = 0
  const callbackDatabase = database()
  const capability = 'a'.repeat(43)
  const response = await handleLinePaySandboxE2eCapabilityCallback({
    purpose: 'confirm',
    request: new Request(
      `https://preview.example.com/api/internal/line-pay/sandbox-e2e/confirm?orderId=${merchantOrderNo}&transactionId=${transactionId}`,
      {
        headers: {
          cookie: `${linePaySandboxE2eCapabilityCookieName('confirm')}=${capability}`,
        },
      },
    ),
    env: enabledEnv,
    readContext: async () => ({
      ...ids,
      environment: 'sandbox',
      status: 'pending',
      requestState: 'pending',
      amountTwd: 50,
      currency: 'TWD',
      merchantOrderNo,
      transactionId,
    }),
    database: {
      ...callbackDatabase,
      claimCapability: async (input) => {
        claimCalls += 1
        assert.match(input.tokenHash, /^[0-9a-f]{64}$/)
        return callbackDatabase.claimCapability(input)
      },
    },
    confirmPayment: async () => ({
      returnCode: '0000',
      returnMessage: 'Success',
      transactionId,
      orderId: merchantOrderNo,
    }),
    createUuid: () => ids.claimId,
  })

  assert.equal(response.status, 200)
  assert.equal(claimCalls, 1)
  assert.equal((await response.json()).markedPaid, true)
})

test('callback without query capability or matching HttpOnly cookie fails closed', async () => {
  let reads = 0
  let claims = 0
  const callbackDatabase = database()
  const response = await handleLinePaySandboxE2eCapabilityCallback({
    purpose: 'confirm',
    request: new Request(
      `https://preview.example.com/api/internal/line-pay/sandbox-e2e/confirm?orderId=${merchantOrderNo}&transactionId=${transactionId}`,
    ),
    env: enabledEnv,
    readContext: async () => {
      reads += 1
      return null
    },
    database: {
      ...callbackDatabase,
      claimCapability: async (input) => {
        claims += 1
        return callbackDatabase.claimCapability(input)
      },
    },
    confirmPayment: async () => {
      throw new Error('must_not_call')
    },
  })

  assert.equal(response.status, 400)
  assert.equal(reads, 0)
  assert.equal(claims, 0)
})

test('confirm callback rejects the cancel capability cookie before database access', async () => {
  let reads = 0
  const cancelCapability = 'b'.repeat(43)
  const response = await handleLinePaySandboxE2eCapabilityCallback({
    purpose: 'confirm',
    request: new Request(
      `https://preview.example.com/api/internal/line-pay/sandbox-e2e/confirm?orderId=${merchantOrderNo}&transactionId=${transactionId}`,
      {
        headers: {
          cookie: `${linePaySandboxE2eCapabilityCookieName('cancel')}=${cancelCapability}`,
        },
      },
    ),
    env: enabledEnv,
    readContext: async () => {
      reads += 1
      return null
    },
    database: database(),
    confirmPayment: async () => {
      throw new Error('must_not_call')
    },
  })

  assert.equal(response.status, 400)
  assert.equal(reads, 0)
})

test('callback diagnostic logs only allowlisted stage metadata', async () => {
  const secret = 'must-never-appear-in-log'
  const diagnostic = await buildLinePaySandboxE2eCallbackDiagnostic(
    'confirm',
    Response.json(
      {
        ok: false,
        error: `unexpected-${secret}`,
        transactionId: secret,
        payload: secret,
      },
      { status: 502 },
    ),
    'capability_claim_failed',
  )

  assert.deepEqual(diagnostic, {
    purpose: 'confirm',
    httpStatus: 502,
    outcome: 'unknown_failure',
    stage: 'capability_claim_failed',
    database: null,
  })
  assert.equal(Object.isFrozen(diagnostic), true)
  assert.equal(JSON.stringify(diagnostic).includes(secret), false)

  const allowlisted = await buildLinePaySandboxE2eCallbackDiagnostic(
    'confirm',
    Response.json(
      { ok: false, error: 'invalid_line_pay_callback' },
      { status: 400 },
    ),
  )
  assert.equal(allowlisted.outcome, 'invalid_line_pay_callback')
  assert.equal(allowlisted.stage, 'not_observed')

  const untrustedStage = await buildLinePaySandboxE2eCallbackDiagnostic(
    'confirm',
    Response.json(
      { ok: false, error: 'invalid_line_pay_callback' },
      { status: 400 },
    ),
    secret as never,
  )
  assert.equal(untrustedStage.stage, 'not_observed')
  assert.equal(JSON.stringify(untrustedStage).includes(secret), false)

  const databaseFailure = await buildLinePaySandboxE2eCallbackDiagnostic(
    'confirm',
    Response.json(
      { ok: false, error: 'line_pay_confirmation_reconciliation_required' },
      { status: 502 },
    ),
    'confirmation_finalize_failed',
    {
      stage: 'finalize_confirmation',
      rpc: 'finalize_product_order_line_pay_confirmation',
      databaseRole: 'line_pay_payment_executor',
      sqlstate: '42501',
    },
  )
  assert.deepEqual(databaseFailure, {
    purpose: 'confirm',
    httpStatus: 502,
    outcome: 'line_pay_confirmation_reconciliation_required',
    stage: 'confirmation_finalize_failed',
    database: {
      stage: 'finalize_confirmation',
      rpc: 'finalize_product_order_line_pay_confirmation',
      databaseRole: 'line_pay_payment_executor',
      sqlstate: '42501',
    },
  })
  assert.equal(Object.isFrozen(databaseFailure), true)
  assert.equal(Object.isFrozen(databaseFailure.database), true)

  const rejectedDatabaseFailure = await buildLinePaySandboxE2eCallbackDiagnostic(
    'confirm',
    Response.json(
      { ok: false, error: 'line_pay_confirmation_reconciliation_required' },
      { status: 502 },
    ),
    'confirmation_finalize_failed',
    {
      stage: secret,
      rpc: secret,
      databaseRole: secret,
      sqlstate: `${secret}42501`,
    } as never,
  )
  assert.equal(rejectedDatabaseFailure.database, null)
  assert.equal(JSON.stringify(rejectedDatabaseFailure).includes(secret), false)
})

runTests().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
