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
  type AiChartOpenAiTransportDiagnostic,
  type AiChartOpenAiTransportFailureKind,
} from './openAiResponses'

type AiChartOpenAiServerDependencies = {
  env?: Record<string, string | undefined>
  fetchImpl?: typeof fetch
  clientRequestIdFactory?: () => string
}

const SAFE_TRANSPORT_IDENTIFIER = /^[A-Za-z0-9_.:-]{1,80}$/u

type PlainRecord = Record<string, unknown>

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

function buildTransportDiagnostic(input: {
  failureKind: AiChartOpenAiTransportFailureKind
  clientRequestId: string
  httpStatus?: number | null
  requestId?: string | null
  responseErrorType?: string | null
  responseErrorCode?: string | null
  responseErrorParam?: string | null
}): AiChartOpenAiTransportDiagnostic {
  return Object.freeze({
    failureKind: input.failureKind,
    httpStatus: input.httpStatus ?? null,
    requestId: input.requestId ?? null,
    clientRequestId: input.clientRequestId,
    responseErrorType: input.responseErrorType ?? null,
    responseErrorCode: input.responseErrorCode ?? null,
    responseErrorParam: input.responseErrorParam ?? null,
  })
}

function requestFailed(
  retryable: boolean,
  transportDiagnostic?: AiChartOpenAiTransportDiagnostic,
): never {
  throw new AiChartOpenAiError(
    AI_CHART_OPENAI_REQUEST_FAILED,
    retryable,
    undefined,
    transportDiagnostic,
  )
}

function timeoutFailed(
  clientRequestId: string,
  response?: Response,
): never {
  throw new AiChartOpenAiError(
    AI_CHART_OPENAI_TIMEOUT,
    true,
    undefined,
    buildTransportDiagnostic({
      failureKind: 'TIMEOUT',
      httpStatus:
        response === undefined ? null : getResponseHttpStatus(response),
      requestId:
        response === undefined ? null : getResponseRequestId(response),
      clientRequestId,
    }),
  )
}

function responseInvalid(): never {
  throw new AiChartOpenAiError(AI_CHART_OPENAI_RESPONSE_INVALID, false)
}

function createClientRequestId(factory: () => string): string {
  try {
    const clientRequestId = factory()
    if (
      typeof clientRequestId === 'string' &&
      SAFE_TRANSPORT_IDENTIFIER.test(clientRequestId)
    ) {
      return clientRequestId
    }
  } catch {
    // Fall through to the fixed configuration error below.
  }

  throw new AiChartOpenAiError(AI_CHART_OPENAI_CONFIG_INVALID, false)
}

function isPlainObject(value: unknown): value is PlainRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }

  try {
    const prototype = Object.getPrototypeOf(value)
    return prototype === Object.prototype || prototype === null
  } catch {
    return false
  }
}

function sanitizeTransportIdentifier(value: unknown): string | null {
  return typeof value === 'string' && SAFE_TRANSPORT_IDENTIFIER.test(value)
    ? value
    : null
}

function getResponseRequestId(response: Response): string | null {
  try {
    return sanitizeTransportIdentifier(response.headers?.get('x-request-id'))
  } catch {
    return null
  }
}

function getResponseHttpStatus(response: Response): number | null {
  return Number.isInteger(response.status) &&
    response.status >= 100 &&
    response.status <= 599
    ? response.status
    : null
}

async function buildHttpTransportDiagnostic(
  response: Response,
  clientRequestId: string,
): Promise<AiChartOpenAiTransportDiagnostic> {
  let body: unknown
  try {
    body = await response.json()
  } catch {
    return buildTransportDiagnostic({
      failureKind: 'RESPONSE_BODY_INVALID',
      httpStatus: getResponseHttpStatus(response),
      requestId: getResponseRequestId(response),
      clientRequestId,
    })
  }

  const responseError = isPlainObject(body) && isPlainObject(body.error)
    ? body.error
    : null
  return buildTransportDiagnostic({
    failureKind: responseError === null ? 'RESPONSE_BODY_INVALID' : 'HTTP_ERROR',
    httpStatus: getResponseHttpStatus(response),
    requestId: getResponseRequestId(response),
    clientRequestId,
    responseErrorType: sanitizeTransportIdentifier(responseError?.type),
    responseErrorCode: sanitizeTransportIdentifier(responseError?.code),
    responseErrorParam: sanitizeTransportIdentifier(responseError?.param),
  })
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

  const clientRequestId = createClientRequestId(
    deps.clientRequestIdFactory ?? (() => globalThis.crypto.randomUUID()),
  )
  const controller = new AbortController()
  let timeoutTriggered = false
  const timeout = setTimeout(() => {
    timeoutTriggered = true
    controller.abort()
  }, validated.timeoutMs)

  let response: Response | undefined
  try {
    response = await fetchImpl(AI_CHART_OPENAI_RESPONSES_URL, {
      method: 'POST',
      redirect: 'error',
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${serverConfig.apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Client-Request-Id': clientRequestId,
      },
      body: JSON.stringify(requestBody),
    })

    if (timeoutTriggered) {
      timeoutFailed(clientRequestId, response)
    }
    if (!response.ok) {
      const transportDiagnostic = await buildHttpTransportDiagnostic(
        response,
        clientRequestId,
      )
      if (timeoutTriggered) {
        timeoutFailed(clientRequestId, response)
      }
      requestFailed(
        isRetryableStatus(response.status),
        transportDiagnostic,
      )
    }

    let rawResponse: unknown
    try {
      rawResponse = await response.json()
    } catch {
      if (timeoutTriggered) {
        timeoutFailed(clientRequestId, response)
      }
      responseInvalid()
    }

    if (timeoutTriggered) {
      timeoutFailed(clientRequestId, response)
    }

    return parseAiChartOpenAiStructuredResponse(
      rawResponse,
      validated.parseResult,
    )
  } catch (error) {
    if (error instanceof AiChartOpenAiError) throw error
    if (timeoutTriggered) {
      timeoutFailed(clientRequestId, response)
    }
    requestFailed(
      true,
      buildTransportDiagnostic({
        failureKind: 'NETWORK_ERROR',
        clientRequestId,
      }),
    )
  } finally {
    clearTimeout(timeout)
  }
}
