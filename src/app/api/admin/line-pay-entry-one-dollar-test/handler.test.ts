import assert from 'node:assert/strict'
import { test } from 'node:test'
import { handleLinePayEntryOneDollarTestStatus } from './handler'

const enabledEnv = {
  VERCEL_ENV: 'production',
  VERCEL_GIT_COMMIT_SHA: 'c'.repeat(40),
  NEXT_PUBLIC_ENABLE_LINE_PAY: 'true',
  LINE_PAY_ENV: 'production',
  LINE_PAY_TRANSPORT: 'gateway',
  LINE_PAY_PRODUCTION_ONE_DOLLAR_TEST_ENABLED: 'true',
  LINE_PAY_PRODUCTION_ONE_DOLLAR_TEST_CONFIRMATION:
    'RUN_LINE_PAY_PRODUCTION_NT1_ONCE',
  LINE_PAY_PRODUCTION_ONE_DOLLAR_TEST_EXPIRES_AT:
    '2026-08-05T02:00:00.000Z',
}

const request = new Request(
  'https://tsu-waterbottle.com/api/admin/line-pay-entry-one-dollar-test',
)

test('authorized admin sees only the safe enabled boolean', async () => {
  const response = await handleLinePayEntryOneDollarTestStatus({
    request,
    env: enabledEnv,
    authorizeAdmin: async () => null,
    now: () => new Date('2026-08-05T01:00:00.000Z'),
  })

  assert.equal(response.status, 200)
  const payload = await response.json()
  assert.deepEqual(payload, { ok: true, enabled: true })
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.equal(
    JSON.stringify(payload).includes(
      'RUN_LINE_PAY_PRODUCTION_NT1_ONCE',
    ),
    false,
  )
})

test('expired window returns enabled false without exposing configuration', async () => {
  const response = await handleLinePayEntryOneDollarTestStatus({
    request,
    env: enabledEnv,
    authorizeAdmin: async () => null,
    now: () => new Date('2026-08-05T02:00:00.000Z'),
  })

  assert.deepEqual(await response.json(), { ok: true, enabled: false })
})

test('admin authorization response passes through before status evaluation', async () => {
  const response = await handleLinePayEntryOneDollarTestStatus({
    request,
    env: enabledEnv,
    authorizeAdmin: async () => Response.json(
      { ok: false, error: '沒有管理權限。' },
      { status: 403 },
    ),
    now: () => new Date('2026-08-05T01:00:00.000Z'),
  })

  assert.equal(response.status, 403)
  assert.deepEqual(await response.json(), {
    ok: false,
    error: '沒有管理權限。',
  })
})
