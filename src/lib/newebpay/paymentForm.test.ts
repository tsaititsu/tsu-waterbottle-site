import assert from 'node:assert/strict'
import { decryptTradeInfo, verifyTradeSha } from './crypto'
import { generateNewebPayMerchantOrderNo } from './orderNo'
import { createNewebPayMpgPaymentData, isNewebPayPaymentMode, isNewebPayPaymentSource } from './paymentForm'
import { getNewebPayPaymentItem } from './paymentItems'
import type { NewebPayConfig } from './types'

const hashKey = '12345678901234567890123456789012'
const hashIv = '1234567890123456'
const config: NewebPayConfig = {
  env: 'test',
  merchantId: 'MS123456789',
  hashKey,
  hashIv,
  version: '2.3',
  siteUrl: 'http://localhost:3000',
  mpgGatewayUrl: 'https://ccore.newebpay.com/MPG/mpg_gateway',
  mpgEndpoint: 'https://ccore.newebpay.com/MPG/mpg_gateway',
}

assert.deepEqual(getNewebPayPaymentItem('booking_consultation_60'), {
  itemKey: 'booking_consultation_60',
  itemDesc: '水瓶先生論命',
  amount: 3600,
})
assert.deepEqual(getNewebPayPaymentItem('newebpay_live_smoke_test_1'), {
  itemKey: 'newebpay_live_smoke_test_1',
  itemDesc: '藍新正式環境測試付款',
  amount: 1,
})
assert.equal(getNewebPayPaymentItem('unknown_item'), null)

const orderNo = generateNewebPayMerchantOrderNo(new Date(2026, 6, 3, 17, 25, 30), 'A1B2')

assert.equal(orderNo, 'WB20260703172530A1B2')
assert.match(orderNo, /^[A-Z0-9_]{1,30}$/)

assert.equal(isNewebPayPaymentSource('booking'), true)
assert.equal(isNewebPayPaymentSource('manual_test'), true)
assert.equal(isNewebPayPaymentSource('external'), false)
assert.equal(isNewebPayPaymentMode('credit'), true)
assert.equal(isNewebPayPaymentMode('merchant_default'), true)
assert.equal(isNewebPayPaymentMode('linepay'), false)

const data = createNewebPayMpgPaymentData({
  itemKey: 'booking_consultation_60',
  config,
  now: new Date(2026, 6, 3, 17, 25, 30),
  merchantOrderNo: 'WB20260703172530A1B2',
})
const decrypted = new URLSearchParams(decryptTradeInfo(data.fields.TradeInfo, hashKey, hashIv))

assert.equal(data.action, 'https://ccore.newebpay.com/MPG/mpg_gateway')
assert.equal(data.method, 'POST')
assert.equal(data.itemKey, 'booking_consultation_60')
assert.equal(data.amount, 3600)
assert.equal(data.fields.MerchantID, 'MS123456789')
assert.equal(data.fields.Version, '2.3')
assert.match(data.fields.TradeSha, /^[0-9A-F]{64}$/)
assert.equal(verifyTradeSha(data.fields.TradeInfo, data.fields.TradeSha, hashKey, hashIv), true)
assert.equal(decrypted.get('Amt'), '3600')
assert.equal(decrypted.get('ItemDesc'), '水瓶先生論命')
assert.equal(decrypted.get('CREDIT'), '1')
assert.equal(decrypted.has('LINEPAY'), false)
assert.equal(decrypted.get('NotifyURL'), 'http://localhost:3000/api/payments/newebpay/notify')
assert.equal(decrypted.get('ReturnURL'), 'http://localhost:3000/payment/newebpay/return')
assert.equal(decrypted.get('ClientBackURL'), 'http://localhost:3000/booking')

const smokeData = createNewebPayMpgPaymentData({
  itemKey: 'newebpay_live_smoke_test_1',
  config,
  now: new Date(2026, 6, 3, 17, 25, 30),
  merchantOrderNo: 'WB20260703172530C3D4',
})
const decryptedSmoke = new URLSearchParams(decryptTradeInfo(smokeData.fields.TradeInfo, hashKey, hashIv))

assert.equal(smokeData.itemKey, 'newebpay_live_smoke_test_1')
assert.equal(smokeData.amount, 1)
assert.equal(decryptedSmoke.get('Amt'), '1')
assert.equal(decryptedSmoke.get('ItemDesc'), '藍新正式環境測試付款')
assert.equal(decryptedSmoke.get('CREDIT'), '1')
assert.equal(decryptedSmoke.has('LINEPAY'), false)

const merchantDefaultData = createNewebPayMpgPaymentData({
  itemKey: 'newebpay_live_smoke_test_1',
  config,
  paymentMode: 'merchant_default',
  now: new Date(2026, 6, 3, 17, 25, 30),
  merchantOrderNo: 'WB20260703172530E5F6',
})
const decryptedMerchantDefault = new URLSearchParams(
  decryptTradeInfo(merchantDefaultData.fields.TradeInfo, hashKey, hashIv),
)

for (const paymentTool of [
  'CREDIT',
  'LINEPAY',
  'VACC',
  'WEBATM',
  'CVS',
  'BARCODE',
  'APPLEPAY',
  'ANDROIDPAY',
  'SAMSUNGPAY',
  'TAIWANPAY',
  'ESUNWALLET',
  'TWQR',
  'AFTEE',
]) {
  assert.equal(decryptedMerchantDefault.has(paymentTool), false)
}
