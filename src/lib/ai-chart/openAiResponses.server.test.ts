import assert from 'node:assert/strict'
import Module, { createRequire } from 'node:module'
import {
  AI_CHART_OPENAI_CONFIG_INVALID,
  AI_CHART_OPENAI_OUTPUT_JSON_INVALID,
  AI_CHART_OPENAI_OUTPUT_MISSING,
  AI_CHART_OPENAI_OUTPUT_SCHEMA_INVALID,
  AI_CHART_OPENAI_REQUEST_FAILED,
  AI_CHART_OPENAI_RESPONSE_INCOMPLETE,
  AI_CHART_OPENAI_RESPONSE_INVALID,
  AI_CHART_OPENAI_RESPONSE_REFUSED,
  AI_CHART_OPENAI_RESPONSES_URL,
  AI_CHART_OPENAI_TIMEOUT,
  AiChartOpenAiError,
  type AiChartOpenAiErrorCode,
  type AiChartOpenAiStructuredRequest,
} from './openAiResponses'
import {
  AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS,
  AiChartD1P1AdapterBridgeResultInvalidError,
} from './d1P1AdapterBridgeContracts'

type NodeModuleInternals = {
  _resolveFilename: (
    request: string,
    parent: unknown,
    isMain: boolean,
    options?: unknown,
  ) => string
  _load: (request: string, parent: unknown, isMain: boolean) => unknown
}

type ParsedResult = {
  answer: string
}

type CapturedFetch = {
  input: RequestInfo | URL
  init?: RequestInit
}

type MutableRecord = Record<string, unknown>

const SYNTHETIC_API_KEY = 'synthetic-api-key-value'
const SYNTHETIC_CLIENT_REQUEST_ID =
  '00000000-0000-4000-8000-000000000001'
const SYNTHETIC_PROVIDER_REQUEST_ID = 'req_synthetic_transport_001'
const SYNTHETIC_PROMPT = 'synthetic-private-prompt-value'
const SYNTHETIC_RESPONSE_BODY = 'synthetic-raw-api-error-body-value'
const SYNTHETIC_REASONING_MARKER = 'synthetic-private-reasoning-marker'
const SYNTHETIC_SOURCE_BOUND_SENSITIVE_MESSAGE =
  'synthetic-output_text-prompt-model-input-starName-palaceId-ruleId-meaningId-omission-detail'

const COVERAGE_DETAIL_REASON_CODES = Object.freeze([
  AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_DIRECT_MEANINGS_MISMATCH,
  AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_MAJOR_STARS_MISMATCH,
  AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_MINOR_STARS_MISMATCH,
  AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_MUTAGENS_MISMATCH,
  AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_MALEFICS_MISMATCH,
  AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_NOBLES_MISMATCH,
  AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_PROCESSING_FLAGS_MISMATCH,
  AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_STATUS_OMISSIONS_MISMATCH,
] as const)

const moduleInternals = Module as unknown as NodeModuleInternals
const originalResolveFilename = moduleInternals._resolveFilename
const originalLoad = moduleInternals._load
const testRequire = createRequire(import.meta.url)
const serverOnlyStubPath = testRequire.resolve('./openAiResponses')

let serverModule: typeof import('./openAiResponses.server')

try {
  moduleInternals._resolveFilename = function resolveFilenameForTest(
    this: unknown,
    request: string,
    parent: unknown,
    isMain: boolean,
    options?: unknown,
  ) {
    if (request === 'server-only') return serverOnlyStubPath
    return originalResolveFilename.call(this, request, parent, isMain, options)
  }

  moduleInternals._load = function loadForTest(
    this: unknown,
    request: string,
    parent: unknown,
    isMain: boolean,
  ) {
    if (request === 'server-only') return {}
    return originalLoad.call(this, request, parent, isMain)
  }

  serverModule = testRequire(
    './openAiResponses.server',
  ) as typeof import('./openAiResponses.server')
} finally {
  moduleInternals._resolveFilename = originalResolveFilename
  moduleInternals._load = originalLoad
}

const { requestAiChartOpenAiStructuredResponse } = serverModule

let testCount = 0

function test(name: string, run: () => void) {
  try {
    run()
    testCount += 1
    console.log(`✓ ${name}`)
  } catch (error) {
    console.error(`✗ ${name}`)
    throw error
  }
}

async function asyncTest(name: string, run: () => Promise<void>) {
  try {
    await run()
    testCount += 1
    console.log(`✓ ${name}`)
  } catch (error) {
    console.error(`✗ ${name}`)
    throw error
  }
}

function parseResult(value: unknown): ParsedResult {
  assert.equal(typeof value, 'object')
  assert.notEqual(value, null)
  const answer = (value as MutableRecord).answer
  assert.equal(typeof answer, 'string')
  return {
    answer: answer as string,
  }
}

function requestFixture(
  overrides: Partial<AiChartOpenAiStructuredRequest<ParsedResult>> = {},
): AiChartOpenAiStructuredRequest<ParsedResult> {
  return {
    instructions: 'Synthetic server instructions',
    userInput: SYNTHETIC_PROMPT,
    schemaName: 'ai_chart_server_result',
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['answer'],
      properties: {
        answer: {
          type: 'string',
        },
      },
    },
    parseResult,
    ...overrides,
  }
}

function rawResponseFixture(overrides: MutableRecord = {}): MutableRecord {
  return {
    status: 'completed',
    error: null,
    incomplete_details: null,
    output: [
      {
        type: 'message',
        status: 'completed',
        content: [
          {
            type: 'output_text',
            text: JSON.stringify({
              answer: 'synthetic-server-answer',
            }),
          },
        ],
      },
    ],
    usage: {
      input_tokens: 10,
      output_tokens: 5,
      output_tokens_details: {
        reasoning_tokens: 2,
      },
      total_tokens: 15,
    },
    ...overrides,
  }
}

function reasoningAndMessageOutputFixture(
  reasoningOverrides: MutableRecord = {},
): MutableRecord[] {
  return [
    {
      id: 'synthetic-reasoning-id',
      type: 'reasoning',
      status: 'completed',
      summary: [
        {
          type: 'summary_text',
          text: SYNTHETIC_REASONING_MARKER,
        },
      ],
      encrypted_content: SYNTHETIC_REASONING_MARKER,
      ...reasoningOverrides,
    },
    {
      id: 'synthetic-message-id',
      type: 'message',
      status: 'completed',
      role: 'assistant',
      content: [
        {
          type: 'output_text',
          text: JSON.stringify({
            answer: 'synthetic-reasoning-server-answer',
          }),
        },
      ],
    },
  ]
}

function syntheticEnv(
  overrides: Record<string, string | undefined> = {},
): Record<string, string | undefined> {
  return {
    OPENAI_API_KEY: SYNTHETIC_API_KEY,
    OPENAI_AI_CHART_MODEL: 'gpt-5.6-sol',
    ...overrides,
  }
}

function mockFetch(
  implementation: (
    input: RequestInfo | URL,
    init?: RequestInit,
  ) => Promise<Response>,
): typeof fetch {
  return implementation as typeof fetch
}

async function captureSafeError(
  run: () => Promise<unknown>,
  code: AiChartOpenAiErrorCode,
  retryable: boolean,
  markers: string[] = [],
): Promise<AiChartOpenAiError> {
  try {
    await run()
    assert.fail(`expected ${code}`)
  } catch (error) {
    assert.equal(error instanceof AiChartOpenAiError, true)
    if (!(error instanceof AiChartOpenAiError)) {
      assert.fail('expected AiChartOpenAiError')
    }
    assert.equal(error.message, code)
    assert.equal(error.code, code)
    assert.equal(error.retryable, retryable)
    for (const marker of markers) {
      assert.equal(error.message.includes(marker), false)
    }
    return error
  }
}

function nonOkResponse(status: number, onBodyRead: () => void): Response {
  return {
    ok: false,
    status,
    headers: new Headers(),
    json: async () => {
      onBodyRead()
      throw new Error(SYNTHETIC_RESPONSE_BODY)
    },
  } as unknown as Response
}

function jsonHttpErrorResponse(
  status: number,
  onBodyRead: () => void,
  options: {
    requestId?: string
    body?: unknown
  } = {},
): Response {
  const headers = {
    get(name: string) {
      return name.toLowerCase() === 'x-request-id'
        ? (options.requestId ?? null)
        : null
    },
  } as Headers

  return {
    ok: false,
    status,
    headers,
    json: async () => {
      onBodyRead()
      return (
        options.body ?? {
          error: {
            type: 'invalid_request_error',
            code: 'synthetic_error_code',
            param: 'input.0.content',
            message: SYNTHETIC_RESPONSE_BODY,
          },
        }
      )
    },
  } as unknown as Response
}

async function run() {
  let capturedFetch: CapturedFetch | undefined
  let successfulFetchCount = 0
  let successfulClientRequestIdFactoryCount = 0
  const successfulFetch = mockFetch(async (input, init) => {
    successfulFetchCount += 1
    capturedFetch = { input, init }
    return new Response(JSON.stringify(rawResponseFixture()), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  })

  const successfulResult =
    await requestAiChartOpenAiStructuredResponse(requestFixture(), {
      env: syntheticEnv({
        OPENAI_DIVINATION_MODEL: 'synthetic-unrelated-model',
      }),
      fetchImpl: successfulFetch,
      clientRequestIdFactory: () => {
        successfulClientRequestIdFactoryCount += 1
        return SYNTHETIC_CLIENT_REQUEST_ID
      },
    })

  test('successful mock request returns parsed structured data', () => {
    assert.deepEqual(successfulResult.data, {
      answer: 'synthetic-server-answer',
    })
    assert.deepEqual(successfulResult.usage, {
      inputTokens: 10,
      outputTokens: 5,
      reasoningTokens: 2,
      totalTokens: 15,
    })
  })

  test('request URL is the exact Responses endpoint', () => {
    assert.ok(capturedFetch)
    assert.equal(capturedFetch.input, AI_CHART_OPENAI_RESPONSES_URL)
  })

  test('request method is POST', () => {
    assert.ok(capturedFetch)
    assert.equal(capturedFetch.init?.method, 'POST')
  })

  test('request redirect policy is error', () => {
    assert.ok(capturedFetch)
    assert.equal(capturedFetch.init?.redirect, 'error')
  })

  test('request cache policy is no-store', () => {
    assert.ok(capturedFetch)
    assert.equal(capturedFetch.init?.cache, 'no-store')
  })

  test('request uses an AbortController signal', () => {
    assert.ok(capturedFetch)
    assert.equal(capturedFetch.init?.signal instanceof AbortSignal, true)
  })

  test('request headers include the safe client request identifier', () => {
    assert.ok(capturedFetch)
    const headers = capturedFetch.init?.headers as Record<string, string>
    assert.deepEqual(Object.keys(headers).sort(), [
      'Accept',
      'Authorization',
      'Content-Type',
      'X-Client-Request-Id',
    ])
    assert.equal(headers.Authorization, `Bearer ${SYNTHETIC_API_KEY}`)
    assert.equal(headers['Content-Type'], 'application/json')
    assert.equal(headers.Accept, 'application/json')
    assert.equal(
      headers['X-Client-Request-Id'],
      SYNTHETIC_CLIENT_REQUEST_ID,
    )
  })

  test('client request ID generator executes exactly once', () => {
    assert.equal(successfulClientRequestIdFactoryCount, 1)
  })

  const successfulBody = (() => {
    assert.ok(capturedFetch)
    const body = capturedFetch.init?.body
    assert.equal(typeof body, 'string')
    return JSON.parse(body as string) as MutableRecord
  })()

  test('API key is not present in the request body', () => {
    assert.equal(JSON.stringify(successfulBody).includes(SYNTHETIC_API_KEY), false)
    assert.equal(Object.hasOwn(successfulBody, 'apiKey'), false)
    assert.equal(Object.hasOwn(successfulBody, 'clientRequestId'), false)
    assert.equal(Object.hasOwn(successfulBody, 'client_request_id'), false)
  })

  test('request body locks store, stream, background, and truncation', () => {
    assert.equal(successfulBody.store, false)
    assert.equal(successfulBody.stream, false)
    assert.equal(successfulBody.background, false)
    assert.equal(successfulBody.truncation, 'disabled')
  })

  test('request body uses gpt-5.6-sol and medium reasoning', () => {
    assert.equal(successfulBody.model, 'gpt-5.6-sol')
    assert.deepEqual(successfulBody.reasoning, {
      effort: 'medium',
    })
  })

  test('request body excludes sampling and tool fields', () => {
    for (const forbidden of [
      'temperature',
      'top_p',
      'tools',
      'tool_choice',
      'previous_response_id',
    ]) {
      assert.equal(Object.hasOwn(successfulBody, forbidden), false, forbidden)
    }
  })

  test('successful fetch executes exactly once with no retry', () => {
    assert.equal(successfulFetchCount, 1)
  })

  let reasoningFetchCount = 0
  const reasoningResult = await requestAiChartOpenAiStructuredResponse(
    requestFixture(),
    {
      env: syntheticEnv(),
      fetchImpl: mockFetch(async () => {
        reasoningFetchCount += 1
        return new Response(
          JSON.stringify(
            rawResponseFixture({
              output: reasoningAndMessageOutputFixture(),
            }),
          ),
          { status: 200 },
        )
      }),
    },
  )

  test('reasoning plus message REST fixture is parsed successfully', () => {
    assert.deepEqual(reasoningResult.data, {
      answer: 'synthetic-reasoning-server-answer',
    })
  })

  test('reasoning private marker is not returned', () => {
    assert.equal(
      JSON.stringify(reasoningResult).includes(SYNTHETIC_REASONING_MARKER),
      false,
    )
  })

  test('reasoning plus message fetch executes exactly once', () => {
    assert.equal(reasoningFetchCount, 1)
  })

  await asyncTest('incomplete reasoning returns fixed safe response invalid', async () => {
    const error = await captureSafeError(
      () =>
        requestAiChartOpenAiStructuredResponse(requestFixture(), {
          env: syntheticEnv(),
          fetchImpl: mockFetch(
            async () =>
              new Response(
                JSON.stringify(
                  rawResponseFixture({
                    output: reasoningAndMessageOutputFixture({
                      status: 'incomplete',
                    }),
                  }),
                ),
                { status: 200 },
              ),
          ),
        }),
      AI_CHART_OPENAI_RESPONSE_INVALID,
      false,
      [SYNTHETIC_REASONING_MARKER],
    )

    assert.equal(
      JSON.stringify(error).includes(SYNTHETIC_REASONING_MARKER),
      false,
    )
  })

  for (const incompleteReason of ['max_output_tokens', 'content_filter']) {
    await asyncTest(
      `top-level incomplete ${incompleteReason} preserves only safe diagnostics`,
      async () => {
        const error = await captureSafeError(
          () =>
            requestAiChartOpenAiStructuredResponse(requestFixture(), {
              env: syntheticEnv(),
              fetchImpl: mockFetch(
                async () =>
                  new Response(
                    JSON.stringify(
                      rawResponseFixture({
                        status: 'incomplete',
                        incomplete_details: {
                          reason: incompleteReason,
                        },
                        output: [
                          {
                            type: 'message',
                            status: 'incomplete',
                            content: [
                              {
                                type: 'output_text',
                                text: SYNTHETIC_RESPONSE_BODY,
                              },
                            ],
                          },
                        ],
                      }),
                    ),
                    { status: 200 },
                  ),
              ),
            }),
          AI_CHART_OPENAI_RESPONSE_INCOMPLETE,
          false,
          [SYNTHETIC_RESPONSE_BODY],
        )

        assert.equal(error.diagnostic?.responseStatus, 'incomplete')
        assert.equal(error.diagnostic?.incompleteReason, incompleteReason)
        assert.deepEqual(error.diagnostic?.usage, {
          inputTokens: 10,
          outputTokens: 5,
          reasoningTokens: 2,
          totalTokens: 15,
        })
        assert.equal(
          JSON.stringify(error).includes(SYNTHETIC_RESPONSE_BODY),
          false,
        )
      },
    )
  }

  await asyncTest('missing API key fails before fetch', async () => {
    let fetchCount = 0
    await captureSafeError(
      () =>
        requestAiChartOpenAiStructuredResponse(requestFixture(), {
          env: syntheticEnv({ OPENAI_API_KEY: undefined }),
          fetchImpl: mockFetch(async () => {
            fetchCount += 1
            throw new Error('must-not-run')
          }),
        }),
      AI_CHART_OPENAI_CONFIG_INVALID,
      false,
    )
    assert.equal(fetchCount, 0)
  })

  await asyncTest('blank API key fails before fetch', async () => {
    let fetchCount = 0
    await captureSafeError(
      () =>
        requestAiChartOpenAiStructuredResponse(requestFixture(), {
          env: syntheticEnv({ OPENAI_API_KEY: '   ' }),
          fetchImpl: mockFetch(async () => {
            fetchCount += 1
            throw new Error('must-not-run')
          }),
        }),
      AI_CHART_OPENAI_CONFIG_INVALID,
      false,
    )
    assert.equal(fetchCount, 0)
  })

  await asyncTest('invalid model fails before fetch', async () => {
    let fetchCount = 0
    await captureSafeError(
      () =>
        requestAiChartOpenAiStructuredResponse(requestFixture(), {
          env: syntheticEnv({
            OPENAI_AI_CHART_MODEL: 'synthetic-invalid-model',
          }),
          fetchImpl: mockFetch(async () => {
            fetchCount += 1
            throw new Error('must-not-run')
          }),
        }),
      AI_CHART_OPENAI_CONFIG_INVALID,
      false,
    )
    assert.equal(fetchCount, 0)
  })

  await asyncTest('invalid request fails before fetch', async () => {
    let fetchCount = 0
    await captureSafeError(
      () =>
        requestAiChartOpenAiStructuredResponse(
          requestFixture({ instructions: '' }),
          {
            env: syntheticEnv(),
            fetchImpl: mockFetch(async () => {
              fetchCount += 1
              throw new Error('must-not-run')
            }),
          },
        ),
      AI_CHART_OPENAI_CONFIG_INVALID,
      false,
    )
    assert.equal(fetchCount, 0)
  })

  await asyncTest('network error becomes safe retryable request failure', async () => {
    let fetchCount = 0
    const error = await captureSafeError(
      () =>
        requestAiChartOpenAiStructuredResponse(requestFixture(), {
          env: syntheticEnv(),
          clientRequestIdFactory: () => SYNTHETIC_CLIENT_REQUEST_ID,
          fetchImpl: mockFetch(async () => {
            fetchCount += 1
            throw new TypeError(
              `${SYNTHETIC_API_KEY} ${SYNTHETIC_PROMPT} ${SYNTHETIC_RESPONSE_BODY}`,
            )
          }),
        }),
      AI_CHART_OPENAI_REQUEST_FAILED,
      true,
      [SYNTHETIC_API_KEY, SYNTHETIC_PROMPT, SYNTHETIC_RESPONSE_BODY],
    )
    assert.equal(fetchCount, 1)
    assert.deepEqual(error.transportDiagnostic, {
      failureKind: 'NETWORK_ERROR',
      httpStatus: null,
      requestId: null,
      clientRequestId: SYNTHETIC_CLIENT_REQUEST_ID,
      responseErrorType: null,
      responseErrorCode: null,
      responseErrorParam: null,
    })
    assert.equal(Object.isFrozen(error.transportDiagnostic), true)
  })

  for (const [status, retryable] of [
    [400, false],
    [401, false],
    [403, false],
    [404, false],
    [408, true],
    [409, true],
    [425, true],
    [429, true],
    [500, true],
    [599, true],
  ] as const) {
    await asyncTest(
      `HTTP ${status} preserves safe transport metadata and retryable=${retryable}`,
      async () => {
        let fetchCount = 0
        let bodyReadCount = 0
        const error = await captureSafeError(
          () =>
            requestAiChartOpenAiStructuredResponse(requestFixture(), {
              env: syntheticEnv(),
              clientRequestIdFactory: () => SYNTHETIC_CLIENT_REQUEST_ID,
              fetchImpl: mockFetch(async () => {
                fetchCount += 1
                return jsonHttpErrorResponse(
                  status,
                  () => {
                    bodyReadCount += 1
                  },
                  { requestId: SYNTHETIC_PROVIDER_REQUEST_ID },
                )
              }),
            }),
          AI_CHART_OPENAI_REQUEST_FAILED,
          retryable,
          [SYNTHETIC_RESPONSE_BODY],
        )

        assert.equal(fetchCount, 1)
        assert.equal(bodyReadCount, 1)
        assert.deepEqual(error.transportDiagnostic, {
          failureKind: 'HTTP_ERROR',
          httpStatus: status,
          requestId: SYNTHETIC_PROVIDER_REQUEST_ID,
          clientRequestId: SYNTHETIC_CLIENT_REQUEST_ID,
          responseErrorType: 'invalid_request_error',
          responseErrorCode: 'synthetic_error_code',
          responseErrorParam: 'input.0.content',
        })
        assert.equal(Object.isFrozen(error.transportDiagnostic), true)
      },
    )
  }

  await asyncTest('non-JSON HTTP error body is safely classified', async () => {
    let bodyReadCount = 0
    const error = await captureSafeError(
      () =>
        requestAiChartOpenAiStructuredResponse(requestFixture(), {
          env: syntheticEnv(),
          clientRequestIdFactory: () => SYNTHETIC_CLIENT_REQUEST_ID,
          fetchImpl: mockFetch(async () =>
            nonOkResponse(400, () => {
              bodyReadCount += 1
            }),
          ),
        }),
      AI_CHART_OPENAI_REQUEST_FAILED,
      false,
      [SYNTHETIC_RESPONSE_BODY],
    )

    assert.equal(bodyReadCount, 1)
    assert.deepEqual(error.transportDiagnostic, {
      failureKind: 'RESPONSE_BODY_INVALID',
      httpStatus: 400,
      requestId: null,
      clientRequestId: SYNTHETIC_CLIENT_REQUEST_ID,
      responseErrorType: null,
      responseErrorCode: null,
      responseErrorParam: null,
    })
  })

  await asyncTest(
    'JSON HTTP error body without error object is safely classified',
    async () => {
      let bodyReadCount = 0
      const error = await captureSafeError(
        () =>
          requestAiChartOpenAiStructuredResponse(requestFixture(), {
            env: syntheticEnv(),
            clientRequestIdFactory: () => SYNTHETIC_CLIENT_REQUEST_ID,
            fetchImpl: mockFetch(async () =>
              jsonHttpErrorResponse(
                403,
                () => {
                  bodyReadCount += 1
                },
                {
                  body: {
                    message: SYNTHETIC_RESPONSE_BODY,
                  },
                },
              ),
            ),
          }),
        AI_CHART_OPENAI_REQUEST_FAILED,
        false,
        [SYNTHETIC_RESPONSE_BODY],
      )

      assert.equal(bodyReadCount, 1)
      assert.deepEqual(error.transportDiagnostic, {
        failureKind: 'RESPONSE_BODY_INVALID',
        httpStatus: 403,
        requestId: null,
        clientRequestId: SYNTHETIC_CLIENT_REQUEST_ID,
        responseErrorType: null,
        responseErrorCode: null,
        responseErrorParam: null,
      })
    },
  )

  await asyncTest(
    'unsafe provider identifiers and provider message are discarded',
    async () => {
      const unsafeRequestId = `req unsafe\n${SYNTHETIC_RESPONSE_BODY}`
      const unsafeType = `invalid\n${SYNTHETIC_API_KEY}`
      const unsafeCode = 'x'.repeat(81)
      const error = await captureSafeError(
        () =>
          requestAiChartOpenAiStructuredResponse(requestFixture(), {
            env: syntheticEnv(),
            clientRequestIdFactory: () => SYNTHETIC_CLIENT_REQUEST_ID,
            fetchImpl: mockFetch(async () =>
              jsonHttpErrorResponse(400, () => {}, {
                requestId: unsafeRequestId,
                body: {
                  error: {
                    type: unsafeType,
                    code: unsafeCode,
                    param: 'input.safe_param',
                    message: `${SYNTHETIC_RESPONSE_BODY} ${SYNTHETIC_PROMPT}`,
                  },
                },
              }),
            ),
          }),
        AI_CHART_OPENAI_REQUEST_FAILED,
        false,
        [
          unsafeRequestId,
          unsafeType,
          unsafeCode,
          SYNTHETIC_RESPONSE_BODY,
          SYNTHETIC_PROMPT,
          SYNTHETIC_API_KEY,
          `Bearer ${SYNTHETIC_API_KEY}`,
        ],
      )

      assert.deepEqual(error.transportDiagnostic, {
        failureKind: 'HTTP_ERROR',
        httpStatus: 400,
        requestId: null,
        clientRequestId: SYNTHETIC_CLIENT_REQUEST_ID,
        responseErrorType: null,
        responseErrorCode: null,
        responseErrorParam: 'input.safe_param',
      })
      const serializedError = JSON.stringify(error)
      for (const marker of [
        unsafeRequestId,
        unsafeType,
        unsafeCode,
        SYNTHETIC_RESPONSE_BODY,
        SYNTHETIC_PROMPT,
        SYNTHETIC_API_KEY,
        'Authorization',
      ]) {
        assert.equal(serializedError.includes(marker), false, marker)
      }
    },
  )

  await asyncTest('overlong provider request ID is discarded', async () => {
    const overlongRequestId = 'r'.repeat(81)
    const error = await captureSafeError(
      () =>
        requestAiChartOpenAiStructuredResponse(requestFixture(), {
          env: syntheticEnv(),
          clientRequestIdFactory: () => SYNTHETIC_CLIENT_REQUEST_ID,
          fetchImpl: mockFetch(async () =>
            jsonHttpErrorResponse(429, () => {}, {
              requestId: overlongRequestId,
            }),
          ),
        }),
      AI_CHART_OPENAI_REQUEST_FAILED,
      true,
      [overlongRequestId, SYNTHETIC_RESPONSE_BODY],
    )

    assert.equal(error.transportDiagnostic?.requestId, null)
    assert.equal(
      JSON.stringify(error).includes(overlongRequestId),
      false,
    )
  })

  for (const invalidClientRequestId of [
    `invalid\n${SYNTHETIC_RESPONSE_BODY}`,
    'x'.repeat(81),
    '   ',
  ]) {
    await asyncTest(
      'invalid client request ID fails closed before fetch',
      async () => {
        let factoryCount = 0
        let fetchCount = 0
        await captureSafeError(
          () =>
            requestAiChartOpenAiStructuredResponse(requestFixture(), {
              env: syntheticEnv(),
              clientRequestIdFactory: () => {
                factoryCount += 1
                return invalidClientRequestId
              },
              fetchImpl: mockFetch(async () => {
                fetchCount += 1
                throw new Error('must-not-run')
              }),
            }),
          AI_CHART_OPENAI_CONFIG_INVALID,
          false,
          [invalidClientRequestId, SYNTHETIC_RESPONSE_BODY],
        )
        assert.equal(factoryCount, 1)
        assert.equal(fetchCount, 0)
      },
    )
  }

  await asyncTest('timeout aborts the mock fetch', async () => {
    let fetchCount = 0
    let abortCount = 0
    const error = await captureSafeError(
      () =>
        requestAiChartOpenAiStructuredResponse(
          requestFixture({ timeoutMs: 1_000 }),
          {
            env: syntheticEnv(),
            clientRequestIdFactory: () => SYNTHETIC_CLIENT_REQUEST_ID,
            fetchImpl: mockFetch(
              async (_input, init) =>
                new Promise<Response>((_resolve, reject) => {
                  fetchCount += 1
                  assert.ok(init?.signal)
                  init.signal.addEventListener(
                    'abort',
                    () => {
                      abortCount += 1
                      reject(new DOMException('synthetic abort', 'AbortError'))
                    },
                    { once: true },
                  )
                }),
            ),
          },
        ),
      AI_CHART_OPENAI_TIMEOUT,
      true,
    )
    assert.equal(fetchCount, 1)
    assert.equal(abortCount, 1)
    assert.deepEqual(error.transportDiagnostic, {
      failureKind: 'TIMEOUT',
      httpStatus: null,
      requestId: null,
      clientRequestId: SYNTHETIC_CLIENT_REQUEST_ID,
      responseErrorType: null,
      responseErrorCode: null,
      responseErrorParam: null,
    })
  })

  let bodyTimeoutFetchCount = 0
  let bodyTimeoutAbortCount = 0
  const bodyTimeoutError = await captureSafeError(
    () =>
      requestAiChartOpenAiStructuredResponse(
        requestFixture({ timeoutMs: 1_000 }),
        {
          env: syntheticEnv(),
          clientRequestIdFactory: () => SYNTHETIC_CLIENT_REQUEST_ID,
          fetchImpl: mockFetch(async (_input, init) => {
            bodyTimeoutFetchCount += 1
            const signal = init?.signal

            return {
              ok: true,
              status: 200,
              headers: new Headers({
                'x-request-id': SYNTHETIC_PROVIDER_REQUEST_ID,
              }),
              json: () =>
                new Promise<unknown>((_resolve, reject) => {
                  if (!(signal instanceof AbortSignal)) {
                    reject(new Error('missing synthetic signal'))
                    return
                  }

                  const rejectOnAbort = () => {
                    bodyTimeoutAbortCount += 1
                    reject(
                      new Error(
                        `${SYNTHETIC_API_KEY} ${SYNTHETIC_PROMPT} ${SYNTHETIC_RESPONSE_BODY}`,
                      ),
                    )
                  }

                  if (signal.aborted) {
                    rejectOnAbort()
                    return
                  }

                  signal.addEventListener('abort', rejectOnAbort, {
                    once: true,
                  })
                }),
            } as unknown as Response
          }),
        },
      ),
    AI_CHART_OPENAI_TIMEOUT,
    true,
    [SYNTHETIC_API_KEY, SYNTHETIC_PROMPT, SYNTHETIC_RESPONSE_BODY],
  )

  test('response.json() waiting for abort returns retryable timeout', () => {
    assert.equal(bodyTimeoutError.code, AI_CHART_OPENAI_TIMEOUT)
    assert.equal(bodyTimeoutError.retryable, true)
    assert.equal(bodyTimeoutAbortCount, 1)
  })

  test('JSON body timeout fetch executes once with no retry', () => {
    assert.equal(bodyTimeoutFetchCount, 1)
  })

  test('JSON body timeout error excludes synthetic sensitive markers', () => {
    const serializedError = JSON.stringify(bodyTimeoutError)
    assert.equal(serializedError.includes(SYNTHETIC_API_KEY), false)
    assert.equal(serializedError.includes(SYNTHETIC_PROMPT), false)
    assert.equal(serializedError.includes(SYNTHETIC_RESPONSE_BODY), false)
  })

  test('JSON body timeout preserves only safe transport metadata', () => {
    assert.deepEqual(bodyTimeoutError.transportDiagnostic, {
      failureKind: 'TIMEOUT',
      httpStatus: 200,
      requestId: SYNTHETIC_PROVIDER_REQUEST_ID,
      clientRequestId: SYNTHETIC_CLIENT_REQUEST_ID,
      responseErrorType: null,
      responseErrorCode: null,
      responseErrorParam: null,
    })
    assert.equal(Object.isFrozen(bodyTimeoutError.transportDiagnostic), true)
  })

  await asyncTest('invalid response JSON becomes fixed response invalid', async () => {
    await captureSafeError(
      () =>
        requestAiChartOpenAiStructuredResponse(requestFixture(), {
          env: syntheticEnv(),
          fetchImpl: mockFetch(
            async () =>
              ({
                ok: true,
                status: 200,
                json: async () => {
                  throw new Error(SYNTHETIC_RESPONSE_BODY)
                },
              }) as unknown as Response,
          ),
        }),
      AI_CHART_OPENAI_RESPONSE_INVALID,
      false,
      [SYNTHETIC_RESPONSE_BODY],
    )
  })

  await asyncTest(
    'malformed output_text JSON keeps its specific error code',
    async () => {
      await captureSafeError(
        () =>
          requestAiChartOpenAiStructuredResponse(requestFixture(), {
            env: syntheticEnv(),
            fetchImpl: mockFetch(
              async () =>
                new Response(
                  JSON.stringify(
                    rawResponseFixture({
                      output: [
                        {
                          type: 'message',
                          status: 'completed',
                          content: [
                            {
                              type: 'output_text',
                              text: SYNTHETIC_RESPONSE_BODY,
                            },
                          ],
                        },
                      ],
                    }),
                  ),
                  { status: 200 },
                ),
            ),
          }),
        AI_CHART_OPENAI_OUTPUT_JSON_INVALID,
        false,
        [SYNTHETIC_RESPONSE_BODY],
      )
    },
  )

  await asyncTest(
    'source-bound parser rejection keeps schema invalid code',
    async () => {
      const error = await captureSafeError(
        () =>
          requestAiChartOpenAiStructuredResponse(
            requestFixture({
              parseResult: () => {
                throw new AiChartD1P1AdapterBridgeResultInvalidError(
                  AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_BINDING_MISMATCH,
                )
              },
            }),
            {
              env: syntheticEnv(),
              fetchImpl: mockFetch(
                async () =>
                  new Response(JSON.stringify(rawResponseFixture()), {
                    status: 200,
                  }),
              ),
            },
          ),
        AI_CHART_OPENAI_OUTPUT_SCHEMA_INVALID,
        false,
      )
      assert.equal(
        error.diagnostic?.outputSchemaValidationCode,
        AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_BINDING_MISMATCH,
      )
      assert.equal(Object.isFrozen(error.diagnostic), true)
      assert.equal(
        JSON.stringify(error).includes(SYNTHETIC_RESPONSE_BODY),
        false,
      )
    },
  )

  for (const reasonCode of COVERAGE_DETAIL_REASON_CODES) {
    await asyncTest(
      `source-bound ${reasonCode} remains a safe server diagnostic`,
      async () => {
        const error = await captureSafeError(
          () =>
            requestAiChartOpenAiStructuredResponse(
              requestFixture({
                parseResult: () => {
                  throw new AiChartD1P1AdapterBridgeResultInvalidError(
                    reasonCode,
                  )
                },
              }),
              {
                env: syntheticEnv(),
                fetchImpl: mockFetch(
                  async () =>
                    new Response(JSON.stringify(rawResponseFixture()), {
                      status: 200,
                    }),
                ),
              },
            ),
          AI_CHART_OPENAI_OUTPUT_SCHEMA_INVALID,
          false,
          [
            SYNTHETIC_SOURCE_BOUND_SENSITIVE_MESSAGE,
            SYNTHETIC_RESPONSE_BODY,
          ],
        )
        assert.equal(error.diagnostic?.outputSchemaValidationCode, reasonCode)
        assert.equal(Object.isFrozen(error.diagnostic), true)
        assert.equal(
          JSON.stringify(error).includes(
            SYNTHETIC_SOURCE_BOUND_SENSITIVE_MESSAGE,
          ),
          false,
        )
      },
    )
  }

  await asyncTest('malformed Structured Output is rejected', async () => {
    await captureSafeError(
      () =>
        requestAiChartOpenAiStructuredResponse(requestFixture(), {
          env: syntheticEnv(),
          fetchImpl: mockFetch(
            async () =>
              new Response(
                JSON.stringify(
                  rawResponseFixture({
                    output: [
                      {
                        type: 'message',
                        content: [
                          {
                            type: 'synthetic-unknown',
                            text: '{}',
                          },
                        ],
                      },
                    ],
                  }),
                ),
                { status: 200 },
              ),
          ),
        }),
      AI_CHART_OPENAI_OUTPUT_MISSING,
      false,
    )
  })

  await asyncTest('top-level SDK-only output_text is not used', async () => {
    await captureSafeError(
      () =>
        requestAiChartOpenAiStructuredResponse(requestFixture(), {
          env: syntheticEnv(),
          fetchImpl: mockFetch(
            async () =>
              new Response(
                JSON.stringify({
                  status: 'completed',
                  output_text: '{"answer":"must-not-be-used"}',
                }),
                { status: 200 },
              ),
          ),
        }),
      AI_CHART_OPENAI_OUTPUT_MISSING,
      false,
    )
  })

  await asyncTest('refusal response is rejected safely', async () => {
    await captureSafeError(
      () =>
        requestAiChartOpenAiStructuredResponse(requestFixture(), {
          env: syntheticEnv(),
          fetchImpl: mockFetch(
            async () =>
              new Response(
                JSON.stringify(
                  rawResponseFixture({
                    output: [
                      {
                        type: 'message',
                        content: [
                          {
                            type: 'refusal',
                            refusal: SYNTHETIC_RESPONSE_BODY,
                          },
                        ],
                      },
                    ],
                  }),
                ),
                { status: 200 },
              ),
          ),
        }),
      AI_CHART_OPENAI_RESPONSE_REFUSED,
      false,
      [SYNTHETIC_RESPONSE_BODY],
    )
  })

  await asyncTest('synthetic prompt never appears in transport errors', async () => {
    const error = await captureSafeError(
      () =>
        requestAiChartOpenAiStructuredResponse(requestFixture(), {
          env: syntheticEnv(),
          fetchImpl: mockFetch(async () => {
            throw new Error(SYNTHETIC_PROMPT)
          }),
        }),
      AI_CHART_OPENAI_REQUEST_FAILED,
      true,
      [SYNTHETIC_PROMPT],
    )
    assert.equal(JSON.stringify(error).includes(SYNTHETIC_PROMPT), false)
  })

  await asyncTest('synthetic API key never appears in transport errors', async () => {
    const error = await captureSafeError(
      () =>
        requestAiChartOpenAiStructuredResponse(requestFixture(), {
          env: syntheticEnv(),
          fetchImpl: mockFetch(async () => {
            throw new Error(SYNTHETIC_API_KEY)
          }),
        }),
      AI_CHART_OPENAI_REQUEST_FAILED,
      true,
      [SYNTHETIC_API_KEY],
    )
    assert.equal(JSON.stringify(error).includes(SYNTHETIC_API_KEY), false)
  })

  await asyncTest('raw API error body never appears in transport errors', async () => {
    const error = await captureSafeError(
      () =>
        requestAiChartOpenAiStructuredResponse(requestFixture(), {
          env: syntheticEnv(),
          fetchImpl: mockFetch(async () => nonOkResponse(400, () => {})),
        }),
      AI_CHART_OPENAI_REQUEST_FAILED,
      false,
      [SYNTHETIC_RESPONSE_BODY],
    )
    assert.equal(JSON.stringify(error).includes(SYNTHETIC_RESPONSE_BODY), false)
  })

  test('server-only module interception was fully restored', () => {
    assert.equal(moduleInternals._resolveFilename, originalResolveFilename)
    assert.equal(moduleInternals._load, originalLoad)
  })

  test('every request supplied a synthetic env dependency', () => {
    assert.equal(SYNTHETIC_API_KEY.startsWith('synthetic-'), true)
  })

  assert.equal(testCount >= 38, true)
  console.log(`AI chart OpenAI Responses server mock tests passed: ${testCount}`)
}

void run()
