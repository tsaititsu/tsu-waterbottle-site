export const DEFAULT_DIVINATION_OPENAI_MODEL = "gpt-5.6-terra"
export const DEFAULT_DIVINATION_REASONING_EFFORT = "max" as const

type DivinationOpenAIModelEnv = {
  [key: string]: string | null | undefined
}

export function getDivinationOpenAIModel(_env?: DivinationOpenAIModelEnv) {
  void _env
  return DEFAULT_DIVINATION_OPENAI_MODEL
}

/**
 * 占卜屬於品質優先工作，固定使用 GPT-5.6 的最高 reasoning effort。
 * 不開放環境變數降級，避免 Preview／Production 行為漂移。
 */
export function getDivinationReasoningEffort(_env?: DivinationOpenAIModelEnv) {
  void _env
  return DEFAULT_DIVINATION_REASONING_EFFORT
}
