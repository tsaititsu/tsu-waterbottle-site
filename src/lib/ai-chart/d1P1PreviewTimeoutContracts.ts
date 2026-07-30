import { AI_CHART_OPENAI_DEFAULT_TIMEOUT_MS } from './openAiResponses'

export const AI_CHART_D1_P1_PREVIEW_TIMEOUT_ENVIRONMENT_VARIABLE =
  'AI_CHART_D1_P1_PREVIEW_TIMEOUT_MS' as const
export const AI_CHART_D1_P1_LOCAL_PREVIEW_TIMEOUT_MS = 300_000 as const
export const AI_CHART_D1_P1_REPORT_OPENAI_RUNTIME_TIMEOUT_MS =
  AI_CHART_D1_P1_LOCAL_PREVIEW_TIMEOUT_MS

export const AI_CHART_D1_P1_PREVIEW_TIMEOUT_VALUES = Object.freeze([
  AI_CHART_OPENAI_DEFAULT_TIMEOUT_MS,
  AI_CHART_D1_P1_LOCAL_PREVIEW_TIMEOUT_MS,
] as const)

export type AiChartD1P1PreviewTimeoutMs =
  (typeof AI_CHART_D1_P1_PREVIEW_TIMEOUT_VALUES)[number]

const PREVIEW_TIMEOUT_VALUE_SET = new Set<unknown>(
  AI_CHART_D1_P1_PREVIEW_TIMEOUT_VALUES,
)

export function isAiChartD1P1PreviewTimeoutMs(
  value: unknown,
): value is AiChartD1P1PreviewTimeoutMs {
  return PREVIEW_TIMEOUT_VALUE_SET.has(value)
}
