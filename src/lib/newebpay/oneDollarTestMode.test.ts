import assert from 'node:assert/strict'
import {
  buildNewebPayOneDollarTestContext,
  isNewebPayOneDollarTestModeEnabled,
  NEWEBPAY_ONE_DOLLAR_TEST_AMOUNT,
  ONE_DOLLAR_TEST_CONFIRMATION_VALUE,
  type NewebPayOneDollarTestEnv,
} from './oneDollarTestMode'

const tests: Array<{ name: string; fn: () => void | Promise<void> }> = []

function test(name: string, fn: () => void | Promise<void>) {
  tests.push({ name, fn })
}

async function runTests() {
  for (const { name, fn } of tests) {
    try {
      await fn()
      console.log(`✓ ${name}`)
    } catch (error) {
      console.error(`✗ ${name}`)
      throw error
    }
  }
}

function enabledEnv(overrides: NewebPayOneDollarTestEnv = {}): NewebPayOneDollarTestEnv {
  return {
    ENABLE_NEWEBPAY_ONE_DOLLAR_TEST_MODE: 'true',
    NEWEBPAY_ENV: 'test',
    ...overrides,
  }
}

test('one dollar amount constant is 1', () => {
  assert.equal(NEWEBPAY_ONE_DOLLAR_TEST_AMOUNT, 1)
})

test('missing feature flag disables one dollar test mode', () => {
  assert.equal(isNewebPayOneDollarTestModeEnabled({}), false)
})

test('false feature flag disables one dollar test mode', () => {
  assert.equal(
    isNewebPayOneDollarTestModeEnabled({
      ENABLE_NEWEBPAY_ONE_DOLLAR_TEST_MODE: 'false',
      NEWEBPAY_ENV: 'test',
    }),
    false,
  )
})

test('enabled feature flag enables non-production one dollar test mode', () => {
  assert.equal(isNewebPayOneDollarTestModeEnabled(enabledEnv()), true)
})

test('production NewebPay env requires confirmation', () => {
  assert.equal(
    isNewebPayOneDollarTestModeEnabled(
      enabledEnv({
        NEWEBPAY_ENV: 'production',
      }),
    ),
    false,
  )
})

test('production Vercel env requires confirmation', () => {
  assert.equal(
    isNewebPayOneDollarTestModeEnabled(
      enabledEnv({
        VERCEL_ENV: 'production',
      }),
    ),
    false,
  )
})

test('wrong production confirmation keeps one dollar test mode disabled', () => {
  assert.equal(
    isNewebPayOneDollarTestModeEnabled(
      enabledEnv({
        NEWEBPAY_ENV: 'production',
        NEWEBPAY_ONE_DOLLAR_TEST_PRODUCTION_CONFIRMATION: 'WRONG',
      }),
    ),
    false,
  )
})

test('correct production confirmation enables one dollar test mode', () => {
  assert.equal(
    isNewebPayOneDollarTestModeEnabled(
      enabledEnv({
        NEWEBPAY_ENV: 'production',
        NEWEBPAY_ONE_DOLLAR_TEST_PRODUCTION_CONFIRMATION: ONE_DOLLAR_TEST_CONFIRMATION_VALUE,
      }),
    ),
    true,
  )
})

test('disabled context preserves original amount and item description', () => {
  const context = buildNewebPayOneDollarTestContext({
    env: {},
    source: 'product_order',
    originalAmount: 1500,
    itemDesc: '人緣符',
    metadata: {
      productSlug: 'ren-yuan-fu',
    },
  })

  assert.deepEqual(context, {
    enabled: false,
    amount: 1500,
    itemDesc: '人緣符',
    metadata: {
      productSlug: 'ren-yuan-fu',
    },
  })
  assert.equal('test_payment' in context.metadata, false)
})

test('enabled context uses one dollar amount and test metadata', () => {
  const context = buildNewebPayOneDollarTestContext({
    env: enabledEnv(),
    source: 'product_order',
    originalAmount: 1500,
    itemDesc: '人緣符',
    metadata: {
      productSlug: 'ren-yuan-fu',
    },
  })

  assert.equal(context.enabled, true)
  assert.equal(context.amount, 1)
  assert.equal(context.itemDesc, '人緣符｜1元測試付款')
  assert.equal(context.metadata.test_payment, true)
  assert.deepEqual(context.metadata.newebpay_one_dollar_test, {
    source: 'product_order',
    originalAmount: 1500,
    testAmount: 1,
    originalItemDesc: '人緣符',
  })
  assert.equal(context.metadata.productSlug, 'ren-yuan-fu')
})

test('enabled context does not duplicate test item description suffix', () => {
  const context = buildNewebPayOneDollarTestContext({
    env: enabledEnv(),
    source: 'ai_divination',
    originalAmount: 50,
    itemDesc: '紫微占卜｜1元測試付款',
  })

  assert.equal(context.itemDesc, '紫微占卜｜1元測試付款')
})

test('context does not mutate input metadata', () => {
  const metadata = {
    productSlug: 'ren-yuan-fu',
    nested: {
      originalAmount: 1500,
    },
  }

  const context = buildNewebPayOneDollarTestContext({
    env: enabledEnv(),
    source: 'product_order',
    originalAmount: 1500,
    itemDesc: '人緣符',
    metadata,
  })

  assert.equal('test_payment' in metadata, false)
  assert.equal('newebpay_one_dollar_test' in metadata, false)
  assert.notEqual(context.metadata, metadata)
  assert.notEqual(context.metadata.nested, metadata.nested)
})

test('invalid original amount throws', () => {
  assert.throws(
    () =>
      buildNewebPayOneDollarTestContext({
        env: enabledEnv(),
        source: 'product_order',
        originalAmount: 0,
        itemDesc: '人緣符',
      }),
    /invalid_newebpay_one_dollar_test_amount/,
  )

  assert.throws(
    () =>
      buildNewebPayOneDollarTestContext({
        env: enabledEnv(),
        source: 'product_order',
        originalAmount: 1.5,
        itemDesc: '人緣符',
      }),
    /invalid_newebpay_one_dollar_test_amount/,
  )
})

test('blank source throws', () => {
  assert.throws(
    () =>
      buildNewebPayOneDollarTestContext({
        env: enabledEnv(),
        source: '   ',
        originalAmount: 1500,
        itemDesc: '人緣符',
      }),
    /invalid_newebpay_one_dollar_test_source/,
  )
})

test('blank item description throws', () => {
  assert.throws(
    () =>
      buildNewebPayOneDollarTestContext({
        env: enabledEnv(),
        source: 'product_order',
        originalAmount: 1500,
        itemDesc: '   ',
      }),
    /invalid_newebpay_one_dollar_test_item_desc/,
  )
})

test('unsafe metadata keys throw', () => {
  assert.throws(
    () =>
      buildNewebPayOneDollarTestContext({
        env: enabledEnv(),
        source: 'product_order',
        originalAmount: 1500,
        itemDesc: '人緣符',
        metadata: {
          TradeInfo: 'do-not-store',
        },
      }),
    /invalid_newebpay_one_dollar_test_metadata/,
  )

  assert.throws(
    () =>
      buildNewebPayOneDollarTestContext({
        env: enabledEnv(),
        source: 'product_order',
        originalAmount: 1500,
        itemDesc: '人緣符',
        metadata: {
          nested: {
            HashKey: 'do-not-store',
          },
        },
      }),
    /invalid_newebpay_one_dollar_test_metadata/,
  )
})

test('context does not include payment secrets or NewebPay encrypted fields', () => {
  const context = buildNewebPayOneDollarTestContext({
    env: enabledEnv(),
    source: 'course',
    originalAmount: 9800,
    itemDesc: '初級班',
    metadata: {
      courseId: 'basic',
    },
  })
  const text = JSON.stringify(context)

  assert.equal(text.includes('HashKey'), false)
  assert.equal(text.includes('HashIV'), false)
  assert.equal(text.includes('MerchantID'), false)
  assert.equal(text.includes('TradeInfo'), false)
  assert.equal(text.includes('TradeSha'), false)
  assert.equal(text.includes('OPENAI_API_KEY'), false)
  assert.equal(text.includes('LINE_PAY_CHANNEL_SECRET'), false)
})

runTests()
