import type { LinePayServerEnv } from './serverConfig'

export const LINE_PAY_PRODUCTION_ONE_DOLLAR_CONFIRMATION =
  'RUN_LINE_PAY_PRODUCTION_NT1_ONCE'
export const LINE_PAY_PRODUCTION_ONE_DOLLAR_AMOUNT_TWD = 1

const LINE_PAY_PRODUCTION_ONE_DOLLAR_MIN_WINDOW_MS = 5 * 60 * 1000
const LINE_PAY_PRODUCTION_ONE_DOLLAR_MAX_WINDOW_MS = 24 * 60 * 60 * 1000

export type LinePayProductionOneDollarEnvironment = LinePayServerEnv & {
  VERCEL_ENV?: string
  VERCEL_GIT_COMMIT_SHA?: string
  LINE_PAY_TRANSPORT?: string
  LINE_PAY_PRODUCTION_ONE_DOLLAR_TEST_ENABLED?: string
  LINE_PAY_PRODUCTION_ONE_DOLLAR_TEST_CONFIRMATION?: string
  LINE_PAY_PRODUCTION_ONE_DOLLAR_TEST_EXPIRES_AT?: string
}

export function isLinePayProductionOneDollarRouteEnabled(
  env: LinePayProductionOneDollarEnvironment,
  now = new Date(),
) {
  const expiresAt = env.LINE_PAY_PRODUCTION_ONE_DOLLAR_TEST_EXPIRES_AT?.trim()
  const expiresAtMs = expiresAt ? Date.parse(expiresAt) : Number.NaN
  const remainingWindowMs = expiresAtMs - now.getTime()

  return (
    env.VERCEL_ENV?.trim().toLowerCase() === 'production'
    && env.NEXT_PUBLIC_ENABLE_LINE_PAY?.trim().toLowerCase() === 'true'
    && env.LINE_PAY_ENV?.trim().toLowerCase() === 'production'
    && env.LINE_PAY_TRANSPORT?.trim().toLowerCase() === 'gateway'
    && env.LINE_PAY_PRODUCTION_ONE_DOLLAR_TEST_ENABLED?.trim().toLowerCase()
      === 'true'
    && env.LINE_PAY_PRODUCTION_ONE_DOLLAR_TEST_CONFIRMATION?.trim()
      === LINE_PAY_PRODUCTION_ONE_DOLLAR_CONFIRMATION
    && Number.isFinite(expiresAtMs)
    && new Date(expiresAtMs).toISOString() === expiresAt
    && remainingWindowMs > LINE_PAY_PRODUCTION_ONE_DOLLAR_MIN_WINDOW_MS
    && remainingWindowMs <= LINE_PAY_PRODUCTION_ONE_DOLLAR_MAX_WINDOW_MS
    && /^[0-9a-f]{40}$/i.test(env.VERCEL_GIT_COMMIT_SHA?.trim() ?? '')
  )
}
