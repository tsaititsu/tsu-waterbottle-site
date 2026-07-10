import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ONE_DOLLAR_TEST_CONFIRMATION_VALUE } from '../../../../lib/newebpay/oneDollarTestMode'
import { handleDivinationOneDollarTestStatus } from './handler'

const request = new Request('https://example.com/api/admin/divination-one-dollar-test')

async function readJson(response: Response) {
  return (await response.json()) as Record<string, unknown>
}

async function main() {
  const unauthorized = await handleDivinationOneDollarTestStatus({
    request,
    env: {},
    authorizeAdmin: async () =>
      new Response(JSON.stringify({ ok: false, error: '請先登入後再使用後台。' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      }),
  })
  assert.equal(unauthorized.status, 401)

  const forbidden = await handleDivinationOneDollarTestStatus({
    request,
    env: {},
    authorizeAdmin: async () =>
      new Response(JSON.stringify({ ok: false, error: '沒有管理權限。' }), {
        status: 403,
        headers: { 'content-type': 'application/json' },
      }),
  })
  assert.equal(forbidden.status, 403)

  const disabled = await handleDivinationOneDollarTestStatus({
    request,
    env: {},
    authorizeAdmin: async () => null,
  })
  assert.deepEqual(await readJson(disabled), { ok: true, enabled: false })

  const enabled = await handleDivinationOneDollarTestStatus({
    request,
    env: {
      ENABLE_NEWEBPAY_ONE_DOLLAR_TEST_MODE: 'true',
      ENABLE_DIVINATION_ONE_DOLLAR_TEST_MODE: 'true',
    },
    authorizeAdmin: async () => null,
  })
  assert.deepEqual(await readJson(enabled), { ok: true, enabled: true })

  const productionMissingConfirmation = await handleDivinationOneDollarTestStatus({
    request,
    env: {
      VERCEL_ENV: 'production',
      ENABLE_NEWEBPAY_ONE_DOLLAR_TEST_MODE: 'true',
      ENABLE_DIVINATION_ONE_DOLLAR_TEST_MODE: 'true',
    },
    authorizeAdmin: async () => null,
  })
  assert.deepEqual(await readJson(productionMissingConfirmation), { ok: true, enabled: false })

  const productionEnabled = await handleDivinationOneDollarTestStatus({
    request,
    env: {
      VERCEL_ENV: 'production',
      ENABLE_NEWEBPAY_ONE_DOLLAR_TEST_MODE: 'true',
      ENABLE_DIVINATION_ONE_DOLLAR_TEST_MODE: 'true',
      NEWEBPAY_ONE_DOLLAR_TEST_PRODUCTION_CONFIRMATION: ONE_DOLLAR_TEST_CONFIRMATION_VALUE,
    },
    authorizeAdmin: async () => null,
  })
  const productionBody = await readJson(productionEnabled)
  assert.deepEqual(productionBody, { ok: true, enabled: true })
  assert.deepEqual(Object.keys(productionBody).sort(), ['enabled', 'ok'])

  const serialized = JSON.stringify(productionBody)
  assert.equal(serialized.includes('ADMIN_EMAILS'), false)
  assert.equal(serialized.includes(ONE_DOLLAR_TEST_CONFIRMATION_VALUE), false)
  assert.equal(serialized.includes('ENABLE_'), false)

  const routeSource = readFileSync(
    join(process.cwd(), 'src/app/api/admin/divination-one-dollar-test/route.ts'),
    'utf8',
  )
  assert.equal(routeSource.includes('requireAdminUser'), true)
  assert.equal(routeSource.includes('handleDivinationOneDollarTestStatus'), true)

  console.log('✓ divination one dollar admin status API 全部通過')
}

void main()
