export const DEFAULT_DIVINATION_OPENAI_MODEL = "gpt-5.5"

type DivinationOpenAIModelEnv = {
  [key: string]: string | null | undefined
}

export function getDivinationOpenAIModel(env: DivinationOpenAIModelEnv = {}) {
  const model = env.OPENAI_DIVINATION_MODEL?.trim()

  return model || DEFAULT_DIVINATION_OPENAI_MODEL
}
