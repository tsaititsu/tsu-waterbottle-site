import assert from 'node:assert/strict'
import test from 'node:test'
import { getNewebPayConfig } from './config'
import {
  buildQueryString,
  createTradeSha,
  decryptTradeInfo,
  encryptTradeInfo,
  verifyTradeSha
} from './crypto'

const hashKey = '12345678901234567890123456789012'
const hashIv = '1234567890123456'

test('buildQueryString creates a stable encoded query string', () => {
  assert.equal(
    buildQueryString({
      MerchantOrderNo: 'ORDER 1',
      Amt: 50,
      NullValue: null,
      UndefValue: undefined,
      Enabled: true,
      Disabled: false
    }),
    'Amt=50&Disabled=0&Enabled=1&MerchantOrderNo=ORDER+1'
  )
})

test('encryptTradeInfo output can be decrypted back to the query string', () => {
  const params = {
    MerchantID: 'MS123456789',
    MerchantOrderNo: 'ORDER123',
    Amt: 50,
    RespondType: 'JSON',
    LoginType: 0
  }
  const plainTradeInfo = buildQueryString(params)
  const encrypted = encryptTradeInfo(params, hashKey, hashIv)

  assert.match(encrypted, /^[0-9a-f]+$/)
  assert.equal(decryptTradeInfo(encrypted, hashKey, hashIv), plainTradeInfo)
})

test('createTradeSha returns uppercase SHA256 and verifyTradeSha validates it', () => {
  const encrypted = encryptTradeInfo({ MerchantID: 'MS123456789', Amt: 50 }, hashKey, hashIv)
  const tradeSha = createTradeSha(encrypted, hashKey, hashIv)
  const invalidTradeSha = `${tradeSha.slice(0, -1)}${tradeSha.endsWith('0') ? '1' : '0'}`

  assert.match(tradeSha, /^[0-9A-F]{64}$/)
  assert.equal(verifyTradeSha(encrypted, tradeSha, hashKey, hashIv), true)
  assert.equal(verifyTradeSha(encrypted, invalidTradeSha, hashKey, hashIv), false)
})

test('getNewebPayConfig throws a clear error when required env is missing', () => {
  const originalEnv = { ...process.env }
  delete process.env.NEWEBPAY_MERCHANT_ID
  process.env.NEWEBPAY_HASH_KEY = hashKey
  process.env.NEWEBPAY_HASH_IV = hashIv
  process.env.NEWEBPAY_ENV = 'test'

  assert.throws(() => getNewebPayConfig(), /Missing required NewebPay environment variable: NEWEBPAY_MERCHANT_ID/)
  process.env = originalEnv
})
