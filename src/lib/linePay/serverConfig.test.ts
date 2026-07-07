import assert from 'node:assert/strict'
import { getLinePayServerConfig, type LinePayServerEnv } from './serverConfig'

const fakeSecret = 'fake_channel_secret_for_tests'

const fullEnv: LinePayServerEnv = {
  NEXT_PUBLIC_ENABLE_LINE_PAY: 'true',
  LINE_PAY_ENV: 'sandbox',
  LINE_PAY_CHANNEL_ID: 'fake_channel_id',
  LINE_PAY_CHANNEL_SECRET: fakeSecret,
  LINE_PAY_CONFIRM_URL: 'https://example.com/api/payments/line-pay/confirm',
  LINE_PAY_CANCEL_URL: 'https://example.com/payment/cancel',
}

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`✓ ${name}`)
  } catch (error) {
    console.error(`✗ ${name}`)
    throw error
  }
}

test('missing NEXT_PUBLIC_ENABLE_LINE_PAY disables LINE Pay', () => {
  const config = getLinePayServerConfig({})

  assert.equal(config.enabled, false)
})

test('NEXT_PUBLIC_ENABLE_LINE_PAY=false disables LINE Pay', () => {
  const config = getLinePayServerConfig({ NEXT_PUBLIC_ENABLE_LINE_PAY: 'false' })

  assert.equal(config.enabled, false)
})

test('NEXT_PUBLIC_ENABLE_LINE_PAY=true enables LINE Pay', () => {
  const config = getLinePayServerConfig(fullEnv)

  assert.equal(config.enabled, true)
})

test('missing LINE_PAY_ENV defaults to sandbox', () => {
  const config = getLinePayServerConfig({ NEXT_PUBLIC_ENABLE_LINE_PAY: 'false' })

  assert.equal(config.environment, 'sandbox')
})

test('LINE_PAY_ENV=sandbox normalizes to sandbox', () => {
  const config = getLinePayServerConfig({ ...fullEnv, LINE_PAY_ENV: 'sandbox' })

  assert.equal(config.environment, 'sandbox')
})

test('LINE_PAY_ENV=production normalizes to production', () => {
  const config = getLinePayServerConfig({ ...fullEnv, LINE_PAY_ENV: 'production' })

  assert.equal(config.environment, 'production')
})

test('disabled LINE Pay does not require credentials or redirect URLs', () => {
  const config = getLinePayServerConfig({
    NEXT_PUBLIC_ENABLE_LINE_PAY: 'false',
  })

  assert.deepEqual(config, {
    enabled: false,
    environment: 'sandbox',
    channelId: '',
    channelSecret: '',
    confirmUrl: '',
    cancelUrl: '',
  })
})

test('enabled LINE Pay without channelId throws safe error', () => {
  assert.throws(
    () =>
      getLinePayServerConfig({
        ...fullEnv,
        LINE_PAY_CHANNEL_ID: '',
      }),
    /missing_line_pay_channel_id/,
  )
})

test('enabled LINE Pay without channelSecret throws safe error', () => {
  assert.throws(
    () =>
      getLinePayServerConfig({
        ...fullEnv,
        LINE_PAY_CHANNEL_SECRET: '',
      }),
    /missing_line_pay_channel_secret/,
  )
})

test('enabled LINE Pay with invalid confirmUrl throws safe error', () => {
  assert.throws(
    () =>
      getLinePayServerConfig({
        ...fullEnv,
        LINE_PAY_CONFIRM_URL: 'not-a-url',
      }),
    /invalid_line_pay_confirm_url/,
  )
})

test('enabled LINE Pay with invalid cancelUrl throws safe error', () => {
  assert.throws(
    () =>
      getLinePayServerConfig({
        ...fullEnv,
        LINE_PAY_CANCEL_URL: 'ftp://example.com/cancel',
      }),
    /invalid_line_pay_cancel_url/,
  )
})

test('enabled LINE Pay returns full config', () => {
  const config = getLinePayServerConfig(fullEnv)

  assert.deepEqual(config, {
    enabled: true,
    environment: 'sandbox',
    channelId: 'fake_channel_id',
    channelSecret: fakeSecret,
    confirmUrl: 'https://example.com/api/payments/line-pay/confirm',
    cancelUrl: 'https://example.com/payment/cancel',
  })
})

test('config does not include NewebPay sensitive keys', () => {
  const configText = JSON.stringify(getLinePayServerConfig(fullEnv))

  assert.equal(configText.includes('TradeInfo'), false)
  assert.equal(configText.includes('TradeSha'), false)
})

test('config does not include phone, email, or address keys', () => {
  const configText = JSON.stringify(getLinePayServerConfig(fullEnv))

  assert.equal(configText.includes('phone'), false)
  assert.equal(configText.includes('email'), false)
  assert.equal(configText.includes('address'), false)
})

test('test output does not print channelSecret value', () => {
  const exportedKeys = Object.keys(getLinePayServerConfig(fullEnv)).join(',')

  assert.equal(exportedKeys.includes(fakeSecret), false)
})

test('server config helper does not call global fetch', () => {
  const originalFetch = globalThis.fetch
  let called = false

  globalThis.fetch = (async () => {
    called = true
    throw new Error('global fetch must not be called')
  }) as typeof fetch

  try {
    getLinePayServerConfig(fullEnv)
    assert.equal(called, false)
  } finally {
    globalThis.fetch = originalFetch
  }
})
