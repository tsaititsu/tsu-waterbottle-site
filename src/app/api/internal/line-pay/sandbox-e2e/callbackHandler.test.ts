import assert from 'node:assert/strict'
import type { ProductOrderLinePayCapabilityDatabase } from '../../../product-orders/line-pay/capabilityHandler'
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
    recordConfirmationEvidence: async () => ({ resultCode: 'recorded' }),
    completeConfirmation: async () => ({
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

runTests().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
