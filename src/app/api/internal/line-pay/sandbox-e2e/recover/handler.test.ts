import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import {
  handleLinePaySandboxPaidRecovery,
  LINE_PAY_SANDBOX_PAID_RECOVERY_CONFIRMATION,
} from './handler'
import { linePaySandboxE2eMerchantOrderNoForCommit } from '../start/handler'

const sourceCommitSha = 'b'.repeat(40)
const merchantOrderNo = linePaySandboxE2eMerchantOrderNoForCommit(sourceCommitSha)
const enabledEnv = {
  VERCEL_ENV: 'preview',
  VERCEL_GIT_COMMIT_SHA: 'a'.repeat(40),
  NEXT_PUBLIC_ENABLE_LINE_PAY: 'true',
  LINE_PAY_ENV: 'sandbox',
  LINE_PAY_TRANSPORT: 'gateway',
  LINE_PAY_SANDBOX_E2E_ENABLED: 'true',
}
const context = Object.freeze({
  paymentId: '71000000-0000-4000-8000-000000000001',
  productOrderId: '51000000-0000-4000-8000-000000000001',
  attemptId: '61000000-0000-4000-8000-000000000001',
  environment: 'sandbox' as const,
  status: 'pending',
  requestState: 'reconciliation_required',
  amountTwd: 50,
  currency: 'TWD' as const,
  merchantOrderNo,
  transactionId: '92233720368547758081234567890',
})

function request() {
  return new Request('https://preview.example.com/api/internal/line-pay/sandbox-e2e/recover', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      confirmation: LINE_PAY_SANDBOX_PAID_RECOVERY_CONFIRMATION,
      sourceCommitSha,
    }),
  })
}

function dependencies(overrides: Partial<Parameters<typeof handleLinePaySandboxPaidRecovery>[0]> = {}) {
  return {
    request: request(),
    env: enabledEnv,
    authorize: async () => true,
    readContext: async () => context,
    readAssociations: async () => ({
      capabilityId: '91000000-0000-4000-8000-000000000001',
      callbackEventId: '92000000-0000-4000-8000-000000000001',
    }),
    verifyProviderPaid: async () => ({
      paid: true,
      evidenceSha256: 'd'.repeat(64),
    }),
    recover: async () => ({
      resultCode: 'completed' as const,
      transactionId: context.transactionId,
    }),
    createRequestId: () => 'line-pay-paid-recovery:request-1',
    ...overrides,
  }
}

test('verifies provider details before one atomic local recovery without a second charge', async () => {
  const events: string[] = []
  let providerCalls = 0
  const response = await handleLinePaySandboxPaidRecovery(dependencies({
    readContext: async (receivedMerchantOrderNo) => {
      assert.equal(receivedMerchantOrderNo, merchantOrderNo)
      events.push('read_context')
      return context
    },
    verifyProviderPaid: async () => {
      providerCalls += 1
      events.push('provider_details')
      return { paid: true, evidenceSha256: 'd'.repeat(64) }
    },
    readAssociations: async () => {
      events.push('read_associations')
      return {
        capabilityId: '91000000-0000-4000-8000-000000000001',
        callbackEventId: '92000000-0000-4000-8000-000000000001',
      }
    },
    recover: async (input) => {
      events.push('atomic_recovery')
      assert.equal(input.environment, 'sandbox')
      assert.equal(input.transactionId, context.transactionId)
      assert.equal(input.merchantOrderNo, merchantOrderNo)
      assert.equal(input.amountTwd, 50)
      assert.equal(input.confirmResultSha256, 'd'.repeat(64))
      assert.equal('callbackClaimId' in input, false)
      return { resultCode: 'completed', transactionId: context.transactionId }
    },
  }))

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    ok: true,
    providerPaid: true,
    localCompletion: 'completed',
    secondCharge: false,
  })
  assert.deepEqual(events, [
    'read_context',
    'provider_details',
    'read_associations',
    'atomic_recovery',
  ])
  assert.equal(providerCalls, 1)
})

test('recovery route can query payment details but cannot request or confirm a charge', () => {
  const routeSource = readFileSync(
    new URL('./route.ts', import.meta.url),
    'utf8',
  )

  assert.equal(routeSource.includes('getLinePayPaymentDetails'), true)
  assert.equal(routeSource.includes('requestLinePayPayment'), false)
  assert.equal(routeSource.includes('confirmLinePayPayment'), false)
  assert.equal(routeSource.includes('requestLinePay'), false)
})

test('provider not proven fails closed before any database recovery', async () => {
  let recoveryCalls = 0
  const response = await handleLinePaySandboxPaidRecovery(dependencies({
    verifyProviderPaid: async () => ({ paid: false, evidenceSha256: null }),
    recover: async () => {
      recoveryCalls += 1
      throw new Error('must_not_recover')
    },
  }))

  assert.equal(response.status, 409)
  assert.deepEqual(await response.json(), {
    ok: false,
    error: 'line_pay_sandbox_provider_paid_not_verified',
  })
  assert.equal(recoveryCalls, 0)
})

test('non-reconciliation or non-NT$50 state fails closed before provider lookup', async () => {
  let providerCalls = 0
  const response = await handleLinePaySandboxPaidRecovery(dependencies({
    readContext: async () => ({ ...context, requestState: 'pending' }),
    verifyProviderPaid: async () => {
      providerCalls += 1
      throw new Error('must_not_query_provider')
    },
  }))

  assert.equal(response.status, 409)
  assert.equal(providerCalls, 0)
})

test('unexpected failures return no transaction, payload, token, or database detail', async () => {
  const secret = 'sb_secret_must_not_escape_1234567890'
  const response = await handleLinePaySandboxPaidRecovery(dependencies({
    readAssociations: async () => {
      throw new Error(`${secret}:${context.transactionId}:raw-provider-payload`)
    },
  }))
  const serialized = JSON.stringify(await response.json())

  assert.equal(response.status, 502)
  assert.deepEqual(JSON.parse(serialized), {
    ok: false,
    error: 'line_pay_sandbox_paid_recovery_failed',
  })
  assert.equal(serialized.includes(secret), false)
  assert.equal(serialized.includes(context.transactionId), false)
  assert.equal(serialized.includes('payload'), false)
})
