export type LinePayExecutorReadinessFailureReason =
  | 'config_invalid'
  | 'rpc_contract_missing'
  | 'rpc_failed'
  | 'rpc_forbidden'
  | 'rpc_insufficient_privilege'
  | 'rpc_timeout'
  | 'rpc_unauthorized'
  | 'rpc_unavailable'
  | 'rpc_unexpected_result'

const SAFE_FAILURE_REASONS: Readonly<
  Record<string, LinePayExecutorReadinessFailureReason>
> = Object.freeze({
  line_pay_executor_config_invalid: 'config_invalid',
  line_pay_executor_readiness_rpc_contract_missing: 'rpc_contract_missing',
  line_pay_executor_readiness_rpc_failed: 'rpc_failed',
  line_pay_executor_readiness_rpc_forbidden: 'rpc_forbidden',
  line_pay_executor_readiness_rpc_insufficient_privilege:
    'rpc_insufficient_privilege',
  line_pay_executor_readiness_rpc_timeout: 'rpc_timeout',
  line_pay_executor_readiness_rpc_unauthorized: 'rpc_unauthorized',
  line_pay_executor_readiness_rpc_unavailable: 'rpc_unavailable',
  line_pay_executor_readiness_rpc_unexpected_result: 'rpc_unexpected_result',
})

export function createLinePayExecutorReadinessFailure(
  reason: LinePayExecutorReadinessFailureReason,
) {
  return new Error(`line_pay_executor_readiness_${reason}`)
}

export function classifyLinePayExecutorReadinessFailure(error: unknown) {
  if (!(error instanceof Error)) return null
  if (!Object.hasOwn(SAFE_FAILURE_REASONS, error.message)) return null
  return SAFE_FAILURE_REASONS[error.message] ?? null
}
