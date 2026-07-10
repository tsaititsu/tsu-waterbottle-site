import { isAdminEmail } from '../auth/admin'
import { AI_DIVINATION_AMOUNT_TWD } from './divinationPayment'
import {
  buildNewebPayOneDollarTestContext,
  isNewebPayOneDollarTestModeEnabled,
  type NewebPayOneDollarTestContext,
  type NewebPayOneDollarTestEnv,
} from './oneDollarTestMode'

/**
 * 紫微占卜「管理員限定 NT$1 實刷測試模式」（22J-45）。
 *
 * 安全條件（缺一即不開放 test mode；明確測試請求由 server 拒絕）：
 * 1. ENABLE_NEWEBPAY_ONE_DOLLAR_TEST_MODE=true（既有總開關）
 * 2. production 環境需既有 NEWEBPAY_ONE_DOLLAR_TEST_PRODUCTION_CONFIRMATION（由
 *    isNewebPayOneDollarTestModeEnabled 檢查）
 * 3. ENABLE_DIVINATION_ONE_DOLLAR_TEST_MODE=true（本包新增 server-only flag）
 * 4. 使用者已登入
 * 5. 使用者 email 在 ADMIN_EMAILS allowlist 內
 *
 * server 一律重新驗證，不信任前端傳來的 testMode 欄位。
 */

export const DIVINATION_ONE_DOLLAR_TEST_SOURCE = 'divination'
export const DIVINATION_ONE_DOLLAR_TEST_ITEM_DESC = '紫微占卜管理員測試'

export type DivinationOneDollarTestUser = {
  id: string
  email: string | null
}

export type DivinationOneDollarTestAccessDecision =
  | { allowed: true }
  | { allowed: false; status: 401 | 403; reason: 'unauthenticated' | 'not_admin' | 'test_mode_disabled' }

export function isDivinationOneDollarTestModeEnabled(env: NewebPayOneDollarTestEnv): boolean {
  if (env.ENABLE_DIVINATION_ONE_DOLLAR_TEST_MODE?.trim() !== 'true') {
    return false
  }

  return isNewebPayOneDollarTestModeEnabled(env)
}

export function resolveDivinationOneDollarTestAccess(input: {
  env: NewebPayOneDollarTestEnv
  user: DivinationOneDollarTestUser | null
}): DivinationOneDollarTestAccessDecision {
  if (!input.user) {
    return { allowed: false, status: 401, reason: 'unauthenticated' }
  }

  if (!isAdminEmail(input.user.email, input.env.ADMIN_EMAILS)) {
    return { allowed: false, status: 403, reason: 'not_admin' }
  }

  if (!isDivinationOneDollarTestModeEnabled(input.env)) {
    return { allowed: false, status: 403, reason: 'test_mode_disabled' }
  }

  return { allowed: true }
}

export function buildDivinationOneDollarTestContext(
  env: NewebPayOneDollarTestEnv,
): NewebPayOneDollarTestContext {
  const effectiveEnv = isDivinationOneDollarTestModeEnabled(env)
    ? env
    : { ...env, ENABLE_NEWEBPAY_ONE_DOLLAR_TEST_MODE: 'false' }

  return buildNewebPayOneDollarTestContext({
    env: effectiveEnv,
    source: DIVINATION_ONE_DOLLAR_TEST_SOURCE,
    originalAmount: AI_DIVINATION_AMOUNT_TWD,
    itemDesc: DIVINATION_ONE_DOLLAR_TEST_ITEM_DESC,
    metadata: {
      one_dollar_test_mode: true,
      divination_one_dollar_test: true,
      test_source: DIVINATION_ONE_DOLLAR_TEST_SOURCE,
      original_amount: AI_DIVINATION_AMOUNT_TWD,
    },
  })
}
