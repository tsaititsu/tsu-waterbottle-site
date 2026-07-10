import assert from 'node:assert/strict'
import {
  buildDivinationOneDollarTestContext,
  DIVINATION_ONE_DOLLAR_TEST_SOURCE,
  isDivinationOneDollarTestModeEnabled,
  resolveDivinationOneDollarTestAccess,
} from './divinationOneDollarTest'
import { AI_DIVINATION_AMOUNT_TWD } from './divinationPayment'
import { NEWEBPAY_ONE_DOLLAR_TEST_AMOUNT, ONE_DOLLAR_TEST_CONFIRMATION_VALUE } from './oneDollarTestMode'

const adminUser = { id: 'admin-1', email: 'boss@example.com' }
const memberUser = { id: 'member-1', email: 'member@example.com' }

const allFlagsEnv = {
  ENABLE_NEWEBPAY_ONE_DOLLAR_TEST_MODE: 'true',
  ENABLE_DIVINATION_ONE_DOLLAR_TEST_MODE: 'true',
  ADMIN_EMAILS: 'boss@example.com',
}

// --- flag 組合（規格 1-4）---

// 1. 全關 → 不可用
assert.equal(isDivinationOneDollarTestModeEnabled({}), false)

// 2. 只開一般 1 元模式 → 不可用
assert.equal(
  isDivinationOneDollarTestModeEnabled({ ENABLE_NEWEBPAY_ONE_DOLLAR_TEST_MODE: 'true' }),
  false,
)

// 3. 只開 divination flag → 不可用
assert.equal(
  isDivinationOneDollarTestModeEnabled({ ENABLE_DIVINATION_ONE_DOLLAR_TEST_MODE: 'true' }),
  false,
)

// 兩個 flag 都開（非 production）→ 可用
assert.equal(isDivinationOneDollarTestModeEnabled(allFlagsEnv), true)

// 4. production 缺 confirmation → 不可用；有正確 confirmation → 可用
const productionEnv = { ...allFlagsEnv, NEWEBPAY_ENV: 'production' }
assert.equal(isDivinationOneDollarTestModeEnabled(productionEnv), false)
assert.equal(
  isDivinationOneDollarTestModeEnabled({
    ...productionEnv,
    NEWEBPAY_ONE_DOLLAR_TEST_PRODUCTION_CONFIRMATION: ONE_DOLLAR_TEST_CONFIRMATION_VALUE,
  }),
  true,
)
assert.equal(
  isDivinationOneDollarTestModeEnabled({
    ...productionEnv,
    NEWEBPAY_ONE_DOLLAR_TEST_PRODUCTION_CONFIRMATION: 'WRONG_VALUE',
  }),
  false,
)

// --- 存取判斷（規格 5-7）---

// 5. 未登入 → 401
assert.deepEqual(resolveDivinationOneDollarTestAccess({ env: allFlagsEnv, user: null }), {
  allowed: false,
  status: 401,
  reason: 'unauthenticated',
})

// 6. 已登入但非 admin → 403（含 ADMIN_EMAILS 空值 fail closed）
assert.deepEqual(resolveDivinationOneDollarTestAccess({ env: allFlagsEnv, user: memberUser }), {
  allowed: false,
  status: 403,
  reason: 'not_admin',
})
assert.deepEqual(
  resolveDivinationOneDollarTestAccess({ env: { ...allFlagsEnv, ADMIN_EMAILS: '' }, user: adminUser }),
  { allowed: false, status: 403, reason: 'not_admin' },
)
assert.deepEqual(
  resolveDivinationOneDollarTestAccess({ env: allFlagsEnv, user: { id: 'x', email: null } }),
  { allowed: false, status: 403, reason: 'not_admin' },
)

// admin 但 flag 未全開 → 403 test_mode_disabled
assert.deepEqual(
  resolveDivinationOneDollarTestAccess({
    env: { ENABLE_NEWEBPAY_ONE_DOLLAR_TEST_MODE: 'true', ADMIN_EMAILS: 'boss@example.com' },
    user: adminUser,
  }),
  { allowed: false, status: 403, reason: 'test_mode_disabled' },
)

// 7. admin＋所有 flags 正確 → 可用
assert.deepEqual(resolveDivinationOneDollarTestAccess({ env: allFlagsEnv, user: adminUser }), {
  allowed: true,
})

// --- context 內容（規格 10、18、19）---

const context = buildDivinationOneDollarTestContext(allFlagsEnv)
assert.equal(context.enabled, true)
assert.equal(context.amount, NEWEBPAY_ONE_DOLLAR_TEST_AMOUNT)
assert.equal(context.amount, 1)
assert.equal(context.itemDesc.includes('管理員 Apple Pay 測試'), true)
assert.equal(context.metadata.test_payment, true)
assert.equal(context.metadata.one_dollar_test_mode, true)
assert.equal(context.metadata.divination_one_dollar_test, true)
assert.equal(context.metadata.divination_apple_pay_test, true)
assert.equal(context.metadata.test_source, DIVINATION_ONE_DOLLAR_TEST_SOURCE)
assert.equal(context.metadata.original_amount, AI_DIVINATION_AMOUNT_TWD)
assert.equal(context.metadata.original_amount, 50)
assert.equal(context.metadata.payment_method, 'apple_pay')

const oneDollarDetails = context.metadata.newebpay_one_dollar_test as Record<string, unknown>
assert.equal(oneDollarDetails.originalAmount, 50)
assert.equal(oneDollarDetails.testAmount, 1)

// flags 未全開時 context 不啟用、維持原價
const disabledContext = buildDivinationOneDollarTestContext({
  ENABLE_NEWEBPAY_ONE_DOLLAR_TEST_MODE: 'true',
})
assert.equal(disabledContext.enabled, false)
assert.equal(disabledContext.amount, AI_DIVINATION_AMOUNT_TWD)

// metadata 不含任何 key / secret 欄位
const serializedContext = JSON.stringify(context)
assert.equal(serializedContext.includes('HashKey'), false)
assert.equal(serializedContext.includes('ADMIN_EMAILS'), false)
assert.equal(serializedContext.includes('boss@example.com'), false)

console.log('✓ divinationOneDollarTest helper 全部通過')
