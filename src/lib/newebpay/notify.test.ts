import assert from 'node:assert/strict'
import { createCipheriv } from 'node:crypto'
import { createTradeSha, encryptTradeInfo } from './crypto'
import { parseNewebPayNotifyPayload } from './notify'

const hashKey = '12345678901234567890123456789012'
const hashIv = '1234567890123456'
const merchantId = 'MS123456789'

function encryptText(text: string) {
  const cipher = createCipheriv('aes-256-cbc', Buffer.from(hashKey, 'utf8'), Buffer.from(hashIv, 'utf8'))
  return cipher.update(text, 'utf8', 'hex') + cipher.final('hex')
}

function createPayload(tradeInfo: string, overrides: Partial<Parameters<typeof parseNewebPayNotifyPayload>[0]> = {}) {
  return {
    status: 'SUCCESS',
    merchantId,
    version: '2.3',
    tradeInfo,
    tradeSha: createTradeSha(tradeInfo, hashKey, hashIv),
    expectedMerchantId: merchantId,
    hashKey,
    hashIv,
    ...overrides,
  }
}

const queryTradeInfo = encryptTradeInfo(
  {
    Status: 'SUCCESS',
    MerchantID: merchantId,
    MerchantOrderNo: 'WB20260703172530A1B2',
    TradeNo: '25070317253012345',
    Amt: 3600,
    PaymentType: 'CREDIT',
    PaymentMethod: 'CREDIT',
    PayTime: '2026-07-03 17:30:00',
  },
  hashKey,
  hashIv,
)
const parsedQuery = parseNewebPayNotifyPayload(createPayload(queryTradeInfo))

assert.equal(parsedQuery.status, 'SUCCESS')
assert.equal(parsedQuery.merchantId, merchantId)
assert.equal(parsedQuery.merchantOrderNo, 'WB20260703172530A1B2')
assert.equal(parsedQuery.tradeNo, '25070317253012345')
assert.equal(parsedQuery.amount, 3600)
assert.equal(parsedQuery.paymentType, 'CREDIT')
assert.equal(parsedQuery.paymentMethod, 'CREDIT')
assert.equal(parsedQuery.payTime, '2026-07-03 17:30:00')

assert.throws(
  () => parseNewebPayNotifyPayload(createPayload(queryTradeInfo, { merchantId: 'WRONG_MERCHANT' })),
  /Invalid MerchantID/,
)

assert.throws(
  () => parseNewebPayNotifyPayload(createPayload(queryTradeInfo, { tradeSha: '0'.repeat(64) })),
  /Invalid TradeSha/,
)

const jsonTradeInfo = encryptText(JSON.stringify({
  Status: 'SUCCESS',
  Message: '付款成功',
  Result: {
    MerchantID: merchantId,
    MerchantOrderNo: 'WB20260703172530C3D4',
    TradeNo: '25070317253067890',
    Amt: '3600',
    PaymentType: 'LINEPAY',
    PaymentMethod: 'LINEPAY',
    PayTime: '2026-07-03 17:35:00',
  },
}))
const parsedJson = parseNewebPayNotifyPayload(createPayload(jsonTradeInfo))

assert.equal(parsedJson.status, 'SUCCESS')
assert.equal(parsedJson.merchantOrderNo, 'WB20260703172530C3D4')
assert.equal(parsedJson.tradeNo, '25070317253067890')
assert.equal(parsedJson.amount, 3600)
assert.equal(parsedJson.paymentType, 'LINEPAY')
assert.equal(parsedJson.paymentMethod, 'LINEPAY')
