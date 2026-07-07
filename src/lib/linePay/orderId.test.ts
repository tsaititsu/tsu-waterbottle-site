import assert from 'node:assert/strict'
import {
  buildLinePayOrderId,
  extractSourceIdFromLinePayOrderId,
  normalizeLinePayOrderId,
} from './orderId'

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`✓ ${name}`)
  } catch (error) {
    console.error(`✗ ${name}`)
    throw error
  }
}

function assertSafeOrderId(value: string) {
  assert.equal(value.includes('email'), false)
  assert.equal(value.includes('phone'), false)
  assert.equal(value.includes('address'), false)
  assert.equal(value.includes('channelSecret'), false)
  assert.equal(value.includes('TradeInfo'), false)
  assert.equal(value.includes('TradeSha'), false)
}

test('normalize accepts alphanumeric order id', () => {
  assert.equal(normalizeLinePayOrderId('LP20260707153000'), 'LP20260707153000')
})

test('normalize accepts underscore', () => {
  assert.equal(normalizeLinePayOrderId('LP_product_order'), 'LP_product_order')
})

test('normalize accepts hyphen', () => {
  assert.equal(normalizeLinePayOrderId('LP-product-order'), 'LP-product-order')
})

test('normalize trims value', () => {
  assert.equal(normalizeLinePayOrderId('  LP_product_order_abc_123  '), 'LP_product_order_abc_123')
})

test('normalize empty value throws safe error', () => {
  assert.throws(() => normalizeLinePayOrderId(''), /invalid_line_pay_order_id/)
})

test('normalize whitespace inside value throws safe error', () => {
  assert.throws(() => normalizeLinePayOrderId('LP product'), /invalid_line_pay_order_id/)
})

test('normalize Chinese value throws safe error', () => {
  assert.throws(() => normalizeLinePayOrderId('LP_商品'), /invalid_line_pay_order_id/)
})

test('normalize slash value throws safe error', () => {
  assert.throws(() => normalizeLinePayOrderId('LP/product'), /invalid_line_pay_order_id/)
})

test('normalize over 100 chars throws safe error', () => {
  assert.throws(() => normalizeLinePayOrderId('A'.repeat(101)), /invalid_line_pay_order_id/)
})

test('build defaults prefix to LP', () => {
  const orderId = buildLinePayOrderId({
    sourceType: 'product_order',
    sourceId: '65e395bd-b7dd-4692-bf65-f817b1fd2caa',
    timestamp: '20260707153000',
  })

  assert.equal(orderId, 'LP_product_order_65e395bd-b7dd-4692-bf65-f817b1fd2caa_20260707153000')
})

test('build supports custom prefix', () => {
  const orderId = buildLinePayOrderId({
    prefix: 'LINEPAY',
    sourceType: 'course',
    sourceId: 'course-001',
    timestamp: '20260707153000',
  })

  assert.equal(orderId, 'LINEPAY_course_course-001_20260707153000')
})

test('build missing sourceType throws safe error', () => {
  assert.throws(
    () =>
      buildLinePayOrderId({
        sourceType: '',
        sourceId: 'source-001',
        timestamp: '20260707153000',
      }),
    /invalid_line_pay_order_source_type/,
  )
})

test('build missing sourceId throws safe error', () => {
  assert.throws(
    () =>
      buildLinePayOrderId({
        sourceType: 'product_order',
        sourceId: '',
        timestamp: '20260707153000',
      }),
    /invalid_line_pay_order_source_id/,
  )
})

test('build result passes normalize', () => {
  const orderId = buildLinePayOrderId({
    sourceType: 'booking',
    sourceId: 'booking-001',
    timestamp: '20260707153000',
  })

  assert.equal(normalizeLinePayOrderId(orderId), orderId)
})

test('build result does not contain contact fields', () => {
  const orderId = buildLinePayOrderId({
    sourceType: 'product_order',
    sourceId: 'order-001',
    timestamp: '20260707153000',
  })

  assertSafeOrderId(orderId)
})

test('build rejects secret-shaped source values', () => {
  assert.throws(
    () =>
      buildLinePayOrderId({
        sourceType: 'product_order',
        sourceId: 'channelSecret',
        timestamp: '20260707153000',
      }),
    /invalid_line_pay_order_id|invalid_line_pay_order_source_id/,
  )
})

test('build rejects NewebPay sensitive source values', () => {
  assert.throws(
    () =>
      buildLinePayOrderId({
        sourceType: 'product_order',
        sourceId: 'TradeInfo',
        timestamp: '20260707153000',
      }),
    /invalid_line_pay_order_id|invalid_line_pay_order_source_id/,
  )
})

test('extract parses prefix, sourceType, sourceId, and timestamp', () => {
  assert.deepEqual(
    extractSourceIdFromLinePayOrderId(
      'LP_product_order_65e395bd-b7dd-4692-bf65-f817b1fd2caa_20260707153000',
    ),
    {
      prefix: 'LP',
      sourceType: 'product_order',
      sourceId: '65e395bd-b7dd-4692-bf65-f817b1fd2caa',
      timestamp: '20260707153000',
    },
  )
})

test('extract timestamp is not converted to number', () => {
  const parsed = extractSourceIdFromLinePayOrderId('LP_ai_chart_report-001_2026070715300099999')

  assert.equal(typeof parsed.timestamp, 'string')
  assert.equal(parsed.timestamp, '2026070715300099999')
})

test('extract invalid format throws safe error', () => {
  assert.throws(() => extractSourceIdFromLinePayOrderId('LP_unknown'), /invalid_line_pay_order_id/)
})

test('order id helper does not call global fetch', () => {
  const originalFetch = globalThis.fetch
  let called = false

  globalThis.fetch = (async () => {
    called = true
    throw new Error('global fetch must not be called')
  }) as typeof fetch

  try {
    buildLinePayOrderId({
      sourceType: 'product_order',
      sourceId: 'order-001',
      timestamp: '20260707153000',
    })
    extractSourceIdFromLinePayOrderId('LP_product_order_order-001_20260707153000')
    assert.equal(called, false)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('order id helper does not expose DB update or mark paid behavior', () => {
  const source = [
    String(normalizeLinePayOrderId),
    String(buildLinePayOrderId),
    String(extractSourceIdFromLinePayOrderId),
  ].join('\n')

  assert.equal(source.includes('fetch'), false)
  assert.equal(source.includes('markPaid'), false)
  assert.equal(source.includes('payments'), false)
})
