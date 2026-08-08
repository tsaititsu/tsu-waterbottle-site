import assert from 'node:assert/strict'
import { test } from 'node:test'
import { LINE_PAY_PRODUCTION_ONE_DOLLAR_CONFIRMATION } from '../../internal/line-pay/production-one-dollar/start/handler'
import { handleLinePayProductionOneDollarTestStatus } from './handler'

const enabledEnv = {
  VERCEL_ENV: 'production',
  VERCEL_GIT_COMMIT_SHA: '8c1fba0a6eff0d0162039b0c73500c2147a67898',
  NEXT_PUBLIC_ENABLE_LINE_PAY: 'true',
  LINE_PAY_ENV: 'production',
  LINE_PAY_TRANSPORT: 'gateway',
  LINE_PAY_PRODUCTION_ONE_DOLLAR_TEST_ENABLED: 'true',
  LINE_PAY_PRODUCTION_ONE_DOLLAR_TEST_CONFIRMATION:
    LINE_PAY_PRODUCTION_ONE_DOLLAR_CONFIRMATION,
  LINE_PAY_PRODUCTION_ONE_DOLLAR_TEST_EXPIRES_AT:
    '2026-08-08T13:00:00.000Z',
}

test('authorized admin sees the active entry test window', async () => {
  const response = await handleLinePayProductionOneDollarTestStatus({
    request: new Request(
      'https://tsu-waterbottle.com/api/admin/line-pay-production-one-dollar-test',
    ),
    env: enabledEnv,
    authorizeAdmin: async () => null,
    now: () => new Date('2026-08-08T12:00:00.000Z'),
  })

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    ok: true,
    enabled: true,
    enabledUntil: '2026-08-08T12:55:00.000Z',
  })
  assert.equal(response.headers.get('cache-control'), 'no-store')
})
