import assert from 'node:assert/strict'
import {
  buildLinePayConfirmPaymentMetadata,
  buildLinePayRequestPaymentMetadata,
  mergeLinePayPaymentMetadata,
} from './paymentMetadata'

const transactionId = '2026070700000000001'

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`✓ ${name}`)
  } catch (error) {
    console.error(`✗ ${name}`)
    throw error
  }
}

function createRequestMetadata() {
  return buildLinePayRequestPaymentMetadata({
    transactionId,
    paymentUrlWeb: 'https://line-pay.example.com/web',
    paymentUrlApp: 'linepay://pay',
    returnCode: '0000',
    returnMessage: 'Success',
  })
}

function createConfirmMetadata() {
  return buildLinePayConfirmPaymentMetadata({
    transactionId,
    orderId: 'LP20260707153000A1B2',
    returnCode: '0000',
    returnMessage: 'Success',
  })
}

function assertSafeMetadata(value: unknown) {
  const text = JSON.stringify(value)

  assert.equal(text.includes('channelSecret'), false)
  assert.equal(text.includes('signature'), false)
  assert.equal(text.includes('headers'), false)
  assert.equal(text.includes('phone'), false)
  assert.equal(text.includes('email'), false)
  assert.equal(text.includes('address'), false)
  assert.equal(text.includes('TradeInfo'), false)
  assert.equal(text.includes('TradeSha'), false)
}

test('request metadata is built', () => {
  assert.deepEqual(createRequestMetadata(), {
    linePay: {
      transactionId,
      paymentUrl: {
        web: 'https://line-pay.example.com/web',
        app: 'linepay://pay',
      },
      request: {
        returnCode: '0000',
        returnMessage: 'Success',
      },
    },
  })
})

test('request metadata transactionId is not converted to number', () => {
  const metadata = createRequestMetadata()

  assert.equal(typeof metadata.linePay.transactionId, 'string')
  assert.equal(metadata.linePay.transactionId, transactionId)
})

test('request metadata requires paymentUrl.web', () => {
  assert.throws(
    () =>
      buildLinePayRequestPaymentMetadata({
        transactionId,
        paymentUrlWeb: '',
        returnCode: '0000',
      }),
    /invalid_line_pay_metadata_payment_url/,
  )
})

test('request metadata paymentUrl.web must be http or https', () => {
  assert.throws(
    () =>
      buildLinePayRequestPaymentMetadata({
        transactionId,
        paymentUrlWeb: 'linepay://pay',
        returnCode: '0000',
      }),
    /invalid_line_pay_metadata_payment_url/,
  )
})

test('request metadata paymentUrl.app is optional', () => {
  const metadata = buildLinePayRequestPaymentMetadata({
    transactionId,
    paymentUrlWeb: 'https://line-pay.example.com/web',
    returnCode: '0000',
  })

  assert.deepEqual(metadata.linePay.paymentUrl, {
    web: 'https://line-pay.example.com/web',
  })
})

test('request metadata requires returnCode', () => {
  assert.throws(
    () =>
      buildLinePayRequestPaymentMetadata({
        transactionId,
        paymentUrlWeb: 'https://line-pay.example.com/web',
        returnCode: '',
      }),
    /invalid_line_pay_metadata_return_code/,
  )
})

test('confirm metadata is built', () => {
  assert.deepEqual(createConfirmMetadata(), {
    linePay: {
      transactionId,
      confirm: {
        returnCode: '0000',
        returnMessage: 'Success',
        orderId: 'LP20260707153000A1B2',
      },
    },
  })
})

test('confirm metadata transactionId is not converted to number', () => {
  const metadata = createConfirmMetadata()

  assert.equal(typeof metadata.linePay.transactionId, 'string')
  assert.equal(metadata.linePay.transactionId, transactionId)
})

test('confirm metadata orderId is optional', () => {
  const metadata = buildLinePayConfirmPaymentMetadata({
    transactionId,
    returnCode: '0000',
  })

  assert.equal(metadata.linePay.confirm?.orderId, undefined)
})

test('confirm metadata requires returnCode', () => {
  assert.throws(
    () =>
      buildLinePayConfirmPaymentMetadata({
        transactionId,
        returnCode: '',
      }),
    /invalid_line_pay_metadata_return_code/,
  )
})

test('merge preserves existing metadata fields', () => {
  const merged = mergeLinePayPaymentMetadata(
    {
      source: 'product_order',
      amount: 1500,
    },
    createRequestMetadata(),
  )

  assert.equal((merged as Record<string, unknown>).source, 'product_order')
  assert.equal((merged as Record<string, unknown>).amount, 1500)
})

test('merge request then confirm preserves request metadata', () => {
  const withRequest = mergeLinePayPaymentMetadata({}, createRequestMetadata())
  const merged = mergeLinePayPaymentMetadata(withRequest, createConfirmMetadata())

  assert.deepEqual(merged.linePay.request, {
    returnCode: '0000',
    returnMessage: 'Success',
  })
  assert.deepEqual(merged.linePay.confirm, {
    returnCode: '0000',
    returnMessage: 'Success',
    orderId: 'LP20260707153000A1B2',
  })
})

test('merge does not mutate original object', () => {
  const existing = {
    source: 'product_order',
    linePay: {
      request: {
        returnCode: '0000',
      },
    },
  }
  const original = JSON.stringify(existing)

  mergeLinePayPaymentMetadata(existing, createConfirmMetadata())

  assert.equal(JSON.stringify(existing), original)
})

test('request metadata is safe', () => {
  assertSafeMetadata(createRequestMetadata())
})

test('confirm metadata is safe', () => {
  assertSafeMetadata(createConfirmMetadata())
})

test('merge strips blocked root metadata keys', () => {
  const merged = mergeLinePayPaymentMetadata(
    {
      channelSecret: 'secret',
      TradeInfo: 'trade-info',
      TradeSha: 'trade-sha',
      keep: true,
    },
    createRequestMetadata(),
  )

  assert.equal('channelSecret' in merged, false)
  assert.equal('TradeInfo' in merged, false)
  assert.equal('TradeSha' in merged, false)
  assert.equal((merged as Record<string, unknown>).keep, true)
})

test('merge strips blocked nested metadata keys', () => {
  const merged = mergeLinePayPaymentMetadata(
    {
      source: 'product_order',
      linePay: {
        headers: {
          authorization: 'signature',
        },
        request: {
          returnCode: '0000',
          TradeInfo: 'trade-info',
        },
        confirm: {
          returnCode: '0000',
          TradeSha: 'trade-sha',
        },
      },
    },
    createConfirmMetadata(),
  )

  assert.equal(JSON.stringify(merged).includes('headers'), false)
  assert.equal(JSON.stringify(merged).includes('TradeInfo'), false)
  assert.equal(JSON.stringify(merged).includes('TradeSha'), false)
  assert.equal((merged as Record<string, unknown>).source, 'product_order')
})

test('metadata helper does not call global fetch', () => {
  const originalFetch = globalThis.fetch
  let called = false

  globalThis.fetch = (async () => {
    called = true
    throw new Error('global fetch must not be called')
  }) as typeof fetch

  try {
    createRequestMetadata()
    createConfirmMetadata()
    mergeLinePayPaymentMetadata({}, createRequestMetadata())
    assert.equal(called, false)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('metadata helper does not expose DB update or mark paid behavior', () => {
  const source = [
    String(buildLinePayRequestPaymentMetadata),
    String(buildLinePayConfirmPaymentMetadata),
    String(mergeLinePayPaymentMetadata),
  ].join('\n')

  assert.equal(source.includes('markPaid'), false)
  assert.equal(source.includes('payments'), false)
})
