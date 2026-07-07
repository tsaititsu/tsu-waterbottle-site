import { normalizeLinePayEnvironment, type LinePayEnvironment } from './config'

export type LinePayServerEnv = Record<string, string | undefined>

export type LinePayServerConfig = {
  enabled: boolean
  environment: LinePayEnvironment
  channelId: string
  channelSecret: string
  confirmUrl: string
  cancelUrl: string
}

function getEnvValue(env: LinePayServerEnv, key: string) {
  return env[key]?.trim() ?? ''
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export function getLinePayServerConfig(env: LinePayServerEnv): LinePayServerConfig {
  const enabled = getEnvValue(env, 'NEXT_PUBLIC_ENABLE_LINE_PAY') === 'true'
  const environment = normalizeLinePayEnvironment(getEnvValue(env, 'LINE_PAY_ENV'))
  const channelId = getEnvValue(env, 'LINE_PAY_CHANNEL_ID')
  const channelSecret = getEnvValue(env, 'LINE_PAY_CHANNEL_SECRET')
  const confirmUrl = getEnvValue(env, 'LINE_PAY_CONFIRM_URL')
  const cancelUrl = getEnvValue(env, 'LINE_PAY_CANCEL_URL')

  if (!enabled) {
    return {
      enabled,
      environment,
      channelId,
      channelSecret,
      confirmUrl,
      cancelUrl,
    }
  }

  if (!channelId) {
    throw new Error('missing_line_pay_channel_id')
  }

  if (!channelSecret) {
    throw new Error('missing_line_pay_channel_secret')
  }

  if (!confirmUrl || !isHttpUrl(confirmUrl)) {
    throw new Error('invalid_line_pay_confirm_url')
  }

  if (!cancelUrl || !isHttpUrl(cancelUrl)) {
    throw new Error('invalid_line_pay_cancel_url')
  }

  return {
    enabled,
    environment,
    channelId,
    channelSecret,
    confirmUrl,
    cancelUrl,
  }
}
