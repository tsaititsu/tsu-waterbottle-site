export const AI_CHART_D1_P1_ADAPTER_BRIDGE_RESULT_INVALID =
  'ai_chart_d1_p1_adapter_bridge_result_invalid' as const

export const AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS = Object.freeze({
  RESULT_SHAPE_INVALID: 'RESULT_SHAPE_INVALID',
  IDENTITY_OR_STATUS_MISMATCH: 'IDENTITY_OR_STATUS_MISMATCH',
  BORROWED_STAR_BINDING_MISMATCH: 'BORROWED_STAR_BINDING_MISMATCH',
  PRIMARY_AXIS_MAJOR_STAR_BINDING_MISMATCH:
    'PRIMARY_AXIS_MAJOR_STAR_BINDING_MISMATCH',
  PRIMARY_AXIS_RULE_BINDING_MISMATCH:
    'PRIMARY_AXIS_RULE_BINDING_MISMATCH',
  PRIMARY_AXIS_DOUBLE_STAR_BINDING_MISMATCH:
    'PRIMARY_AXIS_DOUBLE_STAR_BINDING_MISMATCH',
  PRIMARY_AXIS_FORBIDDEN_METADATA: 'PRIMARY_AXIS_FORBIDDEN_METADATA',
  CANDIDATE_SOURCE_BINDING_MISMATCH:
    'CANDIDATE_SOURCE_BINDING_MISMATCH',
  CANDIDATE_RULE_AUTHORITY_MISMATCH:
    'CANDIDATE_RULE_AUTHORITY_MISMATCH',
  RULE_PALACE_STAR_BINDING_MISMATCH:
    'RULE_PALACE_STAR_BINDING_MISMATCH',
  COVERAGE_BINDING_MISMATCH: 'COVERAGE_BINDING_MISMATCH',
  OTHER_SOURCE_BOUND_BINDING_MISMATCH:
    'OTHER_SOURCE_BOUND_BINDING_MISMATCH',
} as const)

export type AiChartD1P1SourceBoundValidationReasonCode =
  (typeof AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS)[keyof typeof AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS]

const AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASON_SET = new Set<unknown>(
  Object.values(AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS),
)

export function isAiChartD1P1SourceBoundValidationReasonCode(
  value: unknown,
): value is AiChartD1P1SourceBoundValidationReasonCode {
  return AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASON_SET.has(value)
}

export class AiChartD1P1AdapterBridgeResultInvalidError extends Error {
  readonly code = AI_CHART_D1_P1_ADAPTER_BRIDGE_RESULT_INVALID
  declare readonly reasonCode: AiChartD1P1SourceBoundValidationReasonCode

  constructor(reasonCode: AiChartD1P1SourceBoundValidationReasonCode) {
    if (!isAiChartD1P1SourceBoundValidationReasonCode(reasonCode)) {
      throw new TypeError(AI_CHART_D1_P1_ADAPTER_BRIDGE_RESULT_INVALID)
    }

    super(AI_CHART_D1_P1_ADAPTER_BRIDGE_RESULT_INVALID)
    this.name = 'AiChartD1P1AdapterBridgeResultInvalidError'
    Object.defineProperty(this, 'reasonCode', {
      value: reasonCode,
      enumerable: true,
      configurable: false,
      writable: false,
    })
    Object.freeze(this)
  }
}

export function getAiChartD1P1SourceBoundValidationReasonCode(
  error: unknown,
): AiChartD1P1SourceBoundValidationReasonCode | null {
  if (!(error instanceof AiChartD1P1AdapterBridgeResultInvalidError)) {
    return null
  }
  return isAiChartD1P1SourceBoundValidationReasonCode(error.reasonCode)
    ? error.reasonCode
    : null
}
