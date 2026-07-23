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
const AI_CHART_OPENAI_ERROR_BODY_MAX_BYTES = 32 * 1024

type PlainRecord = Record<string, unknown>
type SafeAsyncResult<T> =
  | Readonly<{ status: 'SUCCESS'; value: T }>
  | Readonly<{ status: 'FAILED' }>
  | Readonly<{ status: 'TIMEOUT' }>

type HttpTransportDiagnosticResult =
  | Readonly<{
      status: 'DIAGNOSTIC'
      diagnostic: AiChartOpenAiTransportDiagnostic
    }>
  | Readonly<{ status: 'TIMEOUT' }>

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
  if (response !== undefined) {
    try {
      cancelResponseBody(response.body)
    } catch {
      // The abort signal remains authoritative if the body is inaccessible.
    }
  }
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

function isAiChartOpenAiError(value: unknown): value is AiChartOpenAiError {
  try {
    return value instanceof AiChartOpenAiError
  } catch {
    return false
  }
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

function getOwnEnumerableDataProperty(
  value: PlainRecord,
  key: string,
): unknown {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    return descriptor !== undefined &&
      descriptor.enumerable &&
      Object.hasOwn(descriptor, 'value')
      ? descriptor.value
      : undefined
  } catch {
    return undefined
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
  try {
    return Number.isInteger(response.status) &&
      response.status >= 100 &&
      response.status <= 599
      ? response.status
      : null
  } catch {
    return null
  }
}

function cancelResponseBody(body: ReadableStream<Uint8Array> | null) {
  if (body === null) return
  try {
    void body.cancel().catch(() => {})
  } catch {
    // Cancellation is best-effort and never diagnostic data.
  }
}

function cancelResponseReader(
  reader: ReadableStreamDefaultReader<Uint8Array>,
) {
  try {
    void reader.cancel().catch(() => {})
  } catch {
    // Cancellation is best-effort and never diagnostic data.
  }
}

function releaseResponseReader(
  reader: ReadableStreamDefaultReader<Uint8Array>,
) {
  try {
    reader.releaseLock()
  } catch {
    // A pending or cancelled reader may not be releasable.
  }
}

function responseContentLengthExceedsLimit(response: Response): boolean {
  try {
    const value = response.headers?.get('content-length')
    if (typeof value !== 'string' || !/^[0-9]+$/u.test(value)) {
      return false
    }
    const contentLength = Number(value)
    return (
      !Number.isSafeInteger(contentLength) ||
      contentLength > AI_CHART_OPENAI_ERROR_BODY_MAX_BYTES
    )
  } catch {
    return false
  }
}

function settleWithAbort<T>(
  operation: Promise<T>,
  signal: AbortSignal,
): Promise<SafeAsyncResult<T>> {
  if (signal.aborted) {
    void operation.catch(() => {})
    return Promise.resolve(Object.freeze({ status: 'TIMEOUT' }))
  }

  return new Promise((resolve) => {
    let settled = false
    const finish = (result: SafeAsyncResult<T>) => {
      if (settled) return
      settled = true
      signal.removeEventListener('abort', onAbort)
      resolve(Object.freeze(result))
    }
    const onAbort = () => {
      setTimeout(() => finish({ status: 'TIMEOUT' }), 0)
    }

    signal.addEventListener('abort', onAbort, { once: true })
    operation.then(
      (value) => finish({ status: 'SUCCESS', value }),
      () => finish({ status: 'FAILED' }),
    )
  })
}

async function readBoundedErrorBody(
  response: Response,
  signal: AbortSignal,
): Promise<SafeAsyncResult<string>> {
  let body: ReadableStream<Uint8Array> | null
  try {
    body = response.body
  } catch {
    return Object.freeze({ status: 'FAILED' })
  }

  if (body === null) {
    return Object.freeze({ status: 'FAILED' })
  }
  if (responseContentLengthExceedsLimit(response)) {
    cancelResponseBody(body)
    return Object.freeze({ status: 'FAILED' })
  }

  let reader: ReadableStreamDefaultReader<Uint8Array>
  try {
    reader = body.getReader()
  } catch {
    cancelResponseBody(body)
    return Object.freeze({ status: 'FAILED' })
  }

  const chunks: Uint8Array[] = []
  let byteLength = 0
  while (true) {
    if (signal.aborted) {
      cancelResponseReader(reader)
      releaseResponseReader(reader)
      return Object.freeze({ status: 'TIMEOUT' })
    }

    let readOperation: Promise<ReadableStreamReadResult<Uint8Array>>
    try {
      readOperation = reader.read()
    } catch {
      cancelResponseReader(reader)
      releaseResponseReader(reader)
      return Object.freeze({ status: 'FAILED' })
    }

    const readResult = await settleWithAbort(readOperation, signal)
    if (readResult.status === 'TIMEOUT') {
      cancelResponseReader(reader)
      releaseResponseReader(reader)
      return Object.freeze({ status: 'TIMEOUT' })
    }
    if (readResult.status === 'FAILED') {
      cancelResponseReader(reader)
      releaseResponseReader(reader)
      return Object.freeze({ status: 'FAILED' })
    }
    if (readResult.value.done) break

    const chunk = readResult.value.value
    if (!(chunk instanceof Uint8Array)) {
      cancelResponseReader(reader)
      releaseResponseReader(reader)
      return Object.freeze({ status: 'FAILED' })
    }
    byteLength += chunk.byteLength
    if (byteLength > AI_CHART_OPENAI_ERROR_BODY_MAX_BYTES) {
      cancelResponseReader(reader)
      releaseResponseReader(reader)
      return Object.freeze({ status: 'FAILED' })
    }
    chunks.push(chunk.slice())
  }
  releaseResponseReader(reader)

  const bytes = new Uint8Array(byteLength)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }

  try {
    return Object.freeze({
      status: 'SUCCESS',
      value: new TextDecoder('utf-8', { fatal: true }).decode(bytes),
    })
  } catch {
    return Object.freeze({ status: 'FAILED' })
  }
}

async function buildHttpTransportDiagnostic(
  response: Response,
  clientRequestId: string,
  signal: AbortSignal,
): Promise<HttpTransportDiagnosticResult> {
  const httpStatus = getResponseHttpStatus(response)
  const requestId = getResponseRequestId(response)
  const bodyResult = await readBoundedErrorBody(response, signal)
  if (bodyResult.status === 'TIMEOUT') {
    return Object.freeze({ status: 'TIMEOUT' })
  }
  if (bodyResult.status === 'FAILED') {
    return Object.freeze({
      status: 'DIAGNOSTIC',
      diagnostic: buildTransportDiagnostic({
        failureKind: 'RESPONSE_BODY_INVALID',
        httpStatus,
        requestId,
        clientRequestId,
      }),
    })
  }

  let parsedBody: unknown
  try {
    parsedBody = JSON.parse(bodyResult.value) as unknown
  } catch {
    return Object.freeze({
      status: 'DIAGNOSTIC',
      diagnostic: buildTransportDiagnostic({
        failureKind: 'RESPONSE_BODY_INVALID',
        httpStatus,
        requestId,
        clientRequestId,
      }),
    })
  }

  const responseErrorValue = isPlainObject(parsedBody)
    ? getOwnEnumerableDataProperty(parsedBody, 'error')
    : undefined
  const responseError = isPlainObject(responseErrorValue)
    ? responseErrorValue
    : null
  return Object.freeze({
    status: 'DIAGNOSTIC',
    diagnostic: buildTransportDiagnostic({
      failureKind:
        responseError === null ? 'RESPONSE_BODY_INVALID' : 'HTTP_ERROR',
      httpStatus,
      requestId,
      clientRequestId,
      responseErrorType: sanitizeTransportIdentifier(
        responseError === null
          ? undefined
          : getOwnEnumerableDataProperty(responseError, 'type'),
      ),
      responseErrorCode: sanitizeTransportIdentifier(
        responseError === null
          ? undefined
          : getOwnEnumerableDataProperty(responseError, 'code'),
      ),
      responseErrorParam: sanitizeTransportIdentifier(
        responseError === null
          ? undefined
          : getOwnEnumerableDataProperty(responseError, 'param'),
      ),
    }),
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
  let responseObtained = false
  try {
    const fetchResult = await settleWithAbort(
      fetchImpl(AI_CHART_OPENAI_RESPONSES_URL, {
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
      }),
      controller.signal,
    )
    const fetchedResponse =
      fetchResult.status === 'SUCCESS' ? fetchResult.value : undefined
    if (timeoutTriggered || fetchResult.status === 'TIMEOUT') {
      timeoutFailed(clientRequestId, fetchedResponse)
    }
    if (fetchResult.status === 'FAILED') {
      requestFailed(
        true,
        buildTransportDiagnostic({
          failureKind: 'NETWORK_ERROR',
          clientRequestId,
        }),
      )
    }
    response = fetchResult.value
    responseObtained = true

    if (timeoutTriggered) {
      timeoutFailed(clientRequestId, response)
    }
    let responseOk: boolean
    try {
      if (typeof response.ok !== 'boolean') responseInvalid()
      responseOk = response.ok
    } catch (error) {
      if (isAiChartOpenAiError(error)) throw error
      responseInvalid()
    }

    if (!responseOk) {
      const transportResult = await buildHttpTransportDiagnostic(
        response,
        clientRequestId,
        controller.signal,
      )
      if (timeoutTriggered || transportResult.status === 'TIMEOUT') {
        timeoutFailed(clientRequestId, response)
      }
      requestFailed(
        isRetryableStatus(getResponseHttpStatus(response) ?? -1),
        transportResult.diagnostic,
      )
    }

    let responseBodyOperation: Promise<unknown>
    try {
      responseBodyOperation = response.json()
    } catch {
      if (timeoutTriggered) {
        timeoutFailed(clientRequestId, response)
      }
      responseInvalid()
    }
    const responseBodyResult = await settleWithAbort(
      responseBodyOperation,
      controller.signal,
    )
    if (
      timeoutTriggered ||
      responseBodyResult.status === 'TIMEOUT'
    ) {
      timeoutFailed(clientRequestId, response)
    }
    if (responseBodyResult.status === 'FAILED') responseInvalid()

    return parseAiChartOpenAiStructuredResponse(
      responseBodyResult.value,
      validated.parseResult,
    )
  } catch (error) {
    if (isAiChartOpenAiError(error)) throw error
    if (timeoutTriggered) {
      timeoutFailed(clientRequestId, response)
    }
    if (responseObtained) responseInvalid()
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
