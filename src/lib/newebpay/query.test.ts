import assert from 'node:assert/strict'
import {
  buildNewebPayQueryTradeInfoBody,
  createQueryCheckValue,
  getNewebPayQueryTradeInfoUrl,
  queryNewebPayTrade,
} from './query'

const hashKey = '12345678901234567890123456789012'
const hashIv = '1234567890123456'
const merchantId = 'MS123456789'
const merchantOrderNo = 'WB20260703172530A1B2'

const checkValue = createQueryCheckValue({
  merchantId,
  merchantOrderNo,
  amount: 1,
  hashKey,
  hashIv,
})

assert.match(checkValue, /^[0-9A-F]{64}$/)
assert.equal(getNewebPayQueryTradeInfoUrl('test'), 'https://ccore.newebpay.com/API/QueryTradeInfo')
assert.equal(getNewebPayQueryTradeInfoUrl('production'), 'https://core.newebpay.com/API/QueryTradeInfo')

const queryBody = buildNewebPayQueryTradeInfoBody(
  {
    merchantId,
    merchantOrderNo,
    amount: 1,
    hashKey,
    hashIv,
    env: 'production',
  },
  new Date('2026-07-04T08:00:00.000Z'),
)

assert.equal(queryBody.get('MerchantID'), merchantId)
assert.equal(queryBody.get('Version'), '1.3')
assert.equal(queryBody.get('RespondType'), 'JSON')
assert.equal(queryBody.get('MerchantOrderNo'), merchantOrderNo)
assert.equal(queryBody.get('Amt'), '1')
assert.equal(queryBody.get('TimeStamp'), '1783152000')
assert.match(queryBody.get('CheckValue') || '', /^[0-9A-F]{64}$/)

const originalFetch = globalThis.fetch
let capturedUrl = ''
let capturedBody = ''

async function runQueryAssertions() {
  globalThis.fetch = (async (url, init) => {
    capturedUrl = String(url)
    capturedBody = String(init?.body)

    return new Response(
      JSON.stringify({
        Status: 'SUCCESS',
        Message: '查詢成功',
        Result: {
          MerchantOrderNo: merchantOrderNo,
          Amt: '1',
          TradeStatus: '1',
          TradeNo: '26070416000012345',
          PaymentType: 'CREDIT',
          PaymentMethod: 'CREDIT',
          PayTime: '2026-07-04 16:00:00',
        },
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
  }) as typeof fetch

  try {
    const result = await queryNewebPayTrade({
      merchantId,
      merchantOrderNo,
      amount: 1,
      hashKey,
      hashIv,
      env: 'production',
    })

    const sentBody = new URLSearchParams(capturedBody)

    assert.equal(capturedUrl, 'https://core.newebpay.com/API/QueryTradeInfo')
    assert.equal(sentBody.get('Version'), '1.3')
    assert.equal(sentBody.get('RespondType'), 'JSON')
    assert.equal(sentBody.get('MerchantOrderNo'), merchantOrderNo)
    assert.equal(sentBody.get('Amt'), '1')
    assert.match(sentBody.get('CheckValue') || '', /^[0-9A-F]{64}$/)

    assert.equal(result.status, 'SUCCESS')
    assert.equal(result.message, '查詢成功')
    assert.equal(result.merchantOrderNo, merchantOrderNo)
    assert.equal(result.amount, 1)
    assert.equal(result.tradeStatus, '1')
    assert.equal(result.tradeNo, '26070416000012345')
    assert.equal(result.paymentType, 'CREDIT')
    assert.equal(result.paymentMethod, 'CREDIT')
    assert.equal(result.payTime, '2026-07-04 16:00:00')
    assert.deepEqual(result.rawResult, {
      status: 'SUCCESS',
      message: '查詢成功',
      merchantOrderNo,
      amount: 1,
      tradeStatus: '1',
      tradeNo: '26070416000012345',
      paymentType: 'CREDIT',
      paymentMethod: 'CREDIT',
      payTime: '2026-07-04 16:00:00',
    })
    assert.equal(JSON.stringify(result.rawResult).includes(hashKey), false)
    assert.equal(JSON.stringify(result.rawResult).includes(hashIv), false)
  } finally {
    globalThis.fetch = originalFetch
  }
}

runQueryAssertions().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
