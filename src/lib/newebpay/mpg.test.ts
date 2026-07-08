import assert from 'node:assert/strict'
import Module from 'node:module'
import type { NewebPayConfig } from './types'

const originalResolveFilename = Module._resolveFilename
const originalLoad = Module._load
const serverOnlyStubPath = require.resolve('./types')

Module._resolveFilename = function resolveFilenameForTest(request, parent, isMain, options) {
  if (request === 'server-only') return serverOnlyStubPath
  return originalResolveFilename.call(this, request, parent, isMain, options)
}

Module._load = function loadForTest(request, parent, isMain) {
  if (request === 'server-only') return {}
  return originalLoad.call(this, request, parent, isMain)
}

const { buildCoursePaymentTradeInfoFields, createCoursePaymentMpgForm, decryptTradeInfo, verifyTradeSha } = require(
  './mpg',
) as typeof import('./mpg')

const config: NewebPayConfig = {
  env: 'test',
  merchantId: 'MS123456789',
  hashKey: '12345678901234567890123456789012',
  hashIv: '1234567890123456',
  version: '2.3',
  siteUrl: 'http://localhost:3000',
  mpgGatewayUrl: 'https://ccore.newebpay.com/MPG/mpg_gateway',
  mpgEndpoint: 'https://ccore.newebpay.com/MPG/mpg_gateway',
}

const coursePayload = {
  merchantOrderNo: 'COURSE202607080001',
  amount: 9800,
  itemDesc: '紫微斗數初級班',
  notifyUrl: 'https://example.com/api/payments/newebpay/notify?merchantOrderNo=COURSE202607080001',
  returnUrl: 'https://example.com/api/payments/newebpay/return?merchantOrderNo=COURSE202607080001',
  clientBackUrl: 'https://example.com/account/courses',
  instFlag: '3,6' as const,
}

const courseFields = buildCoursePaymentTradeInfoFields(coursePayload, config)
assert.equal(courseFields.CREDIT, '1')
assert.equal(courseFields.InstFlag, '3,6')

const courseForm = createCoursePaymentMpgForm(coursePayload, config)
const decryptedCourse = decryptTradeInfo(courseForm.TradeInfo, config) as Record<string, unknown>

assert.equal(courseForm.MerchantID, 'MS123456789')
assert.equal(courseForm.Version, '2.0')
assert.equal(verifyTradeSha(courseForm.TradeInfo, courseForm.TradeSha, config), true)
assert.equal(decryptedCourse.MerchantOrderNo, coursePayload.merchantOrderNo)
assert.equal(decryptedCourse.Amt, '9800')
assert.equal(decryptedCourse.ItemDesc, '紫微斗數初級班')
assert.equal(decryptedCourse.CREDIT, '1')
assert.equal(decryptedCourse.InstFlag, '3,6')
assert.equal('LINEPAY' in decryptedCourse, false)
assert.equal('WEBATM' in decryptedCourse, false)
assert.equal('VACC' in decryptedCourse, false)
assert.equal('CVS' in decryptedCourse, false)
assert.equal('BARCODE' in decryptedCourse, false)
assert.equal('TAIWANPAY' in decryptedCourse, false)

const testPaymentPayload = {
  merchantOrderNo: 'NPTEST202607080001',
  amount: 1,
  itemDesc: '藍新金流 1 元測試商品',
  notifyUrl: 'https://example.com/api/payments/newebpay/notify',
  returnUrl: 'https://example.com/api/payments/newebpay/return',
  clientBackUrl: 'https://example.com/payment/newebpay/test',
}

const testPaymentFields = buildCoursePaymentTradeInfoFields(testPaymentPayload, config)
assert.equal(testPaymentFields.CREDIT, '1')
assert.equal(testPaymentFields.InstFlag, '0')

const testPaymentForm = createCoursePaymentMpgForm(testPaymentPayload, config)
const decryptedTestPayment = decryptTradeInfo(testPaymentForm.TradeInfo, config) as Record<string, unknown>

assert.equal(decryptedTestPayment.CREDIT, '1')
assert.equal(decryptedTestPayment.InstFlag, '0')
assert.equal('LINEPAY' in decryptedTestPayment, false)
assert.equal('TradeInfo' in decryptedTestPayment, false)
assert.equal('TradeSha' in decryptedTestPayment, false)
assert.equal('HashKey' in decryptedTestPayment, false)
assert.equal('HashIV' in decryptedTestPayment, false)
