import 'server-only'

import {
  AI_CHART_OPENAI_CONFIG_INVALID,
  AI_CHART_OPENAI_REQUEST_FAILED,
  AI_CHART_OPENAI_RESPONSE_INVALID,
  AI_CHART_OPENAI_RESPONSES_URL,
  AI_CHART_OPENAI_TIMEOUT,
  AiChartOpenAiError,
  buildAiChartOpenAiResponsesBody,
  getAiChartOpenAiModel,
  parseAiChartOpenAiStructuredResponse,
  validateAiChartOpenAiStructuredRequest,
  type AiChartOpenAiStructuredRequest,
  type AiChartOpenAiStructuredResult,
} from './openAiResponses'

type AiChartOpenAiServerDependencies = {
  env?: Record<string, string | undefined>
  fetchImpl?: typeof fetch
}

function getServerConfig(env: Record<string, string | undefined>) {
  try {
    const apiKey = env.OPENAI_API_KEY
    if (typeof apiKey !== 'string' || apiKey.trim().length === 0) {
      throw new AiChartOpenAiError(AI_CHART_OPENAI_CONFIG_INVALID, false)
    }

    return Object.freeze({
      apiKey,
      model: getAiChartOpenAiModel(env),
    })
  } catch {
    throw new AiChartOpenAiError(AI_CHART_OPENAI_CONFIG_INVALID, false)
  }
}

function requestFailed(retryable: boolean): never {
  throw new AiChartOpenAiError(AI_CHART_OPENAI_REQUEST_FAILED, retryable)
}

function responseInvalid(): never {
  throw new AiChartOpenAiError(AI_CHART_OPENAI_RESPONSE_INVALID, false)
}

function isRetryableStatus(status: number): boolean {
  return (
    status === 408 ||
    status === 409 ||
    status === 425 ||
    status === 429 ||
    (status >= 500 && status <= 599)
  )
}

export async function requestAiChartOpenAiStructuredResponse<T>(
  input: AiChartOpenAiStructuredRequest<T>,
  deps: AiChartOpenAiServerDependencies = {},
): Promise<AiChartOpenAiStructuredResult<T>> {
  const env = deps.env ?? process.env
  const fetchImpl = deps.fetchImpl ?? globalThis.fetch
  const serverConfig = getServerConfig(env)
  const validated = validateAiChartOpenAiStructuredRequest(input)
  const requestBody = buildAiChartOpenAiResponsesBody(validated)

  if (requestBody.model !== serverConfig.model) {
    throw new AiChartOpenAiError(AI_CHART_OPENAI_CONFIG_INVALID, false)
  }

  const controller = new AbortController()
  let timeoutTriggered = false
  const timeout = setTimeout(() => {
    timeoutTriggered = true
    controller.abort()
  }, validated.timeoutMs)

  try {
    const response = await fetchImpl(AI_CHART_OPENAI_RESPONSES_URL, {
      method: 'POST',
      redirect: 'error',
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${serverConfig.apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    if (timeoutTriggered) {
      throw new AiChartOpenAiError(AI_CHART_OPENAI_TIMEOUT, true)
    }
    if (!response.ok) requestFailed(isRetryableStatus(response.status))

    let rawResponse: unknown
    try {
      rawResponse = await response.json()
    } catch {
      if (timeoutTriggered) {
        throw new AiChartOpenAiError(AI_CHART_OPENAI_TIMEOUT, true)
      }
      responseInvalid()
    }

    if (timeoutTriggered) {
      throw new AiChartOpenAiError(AI_CHART_OPENAI_TIMEOUT, true)
    }

    try {
      return parseAiChartOpenAiStructuredResponse(
        rawResponse,
        validated.parseResult,
      )
    } catch {
      responseInvalid()
    }
  } catch (error) {
    if (error instanceof AiChartOpenAiError) throw error
    if (timeoutTriggered) {
      throw new AiChartOpenAiError(AI_CHART_OPENAI_TIMEOUT, true)
    }
    requestFailed(true)
  } finally {
    clearTimeout(timeout)
  }
}
