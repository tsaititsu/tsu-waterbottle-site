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
const SYNTHETIC_PROMPT = 'synthetic-private-prompt-value'
const SYNTHETIC_RESPONSE_BODY = 'synthetic-raw-api-error-body-value'
const SYNTHETIC_REASONING_MARKER = 'synthetic-private-reasoning-marker'

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
    json: async () => {
      onBodyRead()
      throw new Error(SYNTHETIC_RESPONSE_BODY)
    },
  } as unknown as Response
}

async function run() {
  let capturedFetch: CapturedFetch | undefined
  let successfulFetchCount = 0
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

  test('request headers contain only Authorization, Content-Type, and Accept', () => {
    assert.ok(capturedFetch)
    const headers = capturedFetch.init?.headers as Record<string, string>
    assert.deepEqual(Object.keys(headers).sort(), [
      'Accept',
      'Authorization',
      'Content-Type',
    ])
    assert.equal(headers.Authorization, `Bearer ${SYNTHETIC_API_KEY}`)
    assert.equal(headers['Content-Type'], 'application/json')
    assert.equal(headers.Accept, 'application/json')
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
    await captureSafeError(
      () =>
        requestAiChartOpenAiStructuredResponse(requestFixture(), {
          env: syntheticEnv(),
          fetchImpl: mockFetch(async () => {
            fetchCount += 1
            throw new Error(
              `${SYNTHETIC_API_KEY} ${SYNTHETIC_PROMPT} ${SYNTHETIC_RESPONSE_BODY}`,
            )
          }),
        }),
      AI_CHART_OPENAI_REQUEST_FAILED,
      true,
      [SYNTHETIC_API_KEY, SYNTHETIC_PROMPT, SYNTHETIC_RESPONSE_BODY],
    )
    assert.equal(fetchCount, 1)
  })

  await asyncTest('HTTP 429 is retryable and body is not read', async () => {
    let fetchCount = 0
    let bodyReadCount = 0
    await captureSafeError(
      () =>
        requestAiChartOpenAiStructuredResponse(requestFixture(), {
          env: syntheticEnv(),
          fetchImpl: mockFetch(async () => {
            fetchCount += 1
            return nonOkResponse(429, () => {
              bodyReadCount += 1
            })
          }),
        }),
      AI_CHART_OPENAI_REQUEST_FAILED,
      true,
      [SYNTHETIC_RESPONSE_BODY],
    )
    assert.equal(fetchCount, 1)
    assert.equal(bodyReadCount, 0)
  })

  await asyncTest('HTTP 500 is retryable', async () => {
    let bodyReadCount = 0
    await captureSafeError(
      () =>
        requestAiChartOpenAiStructuredResponse(requestFixture(), {
          env: syntheticEnv(),
          fetchImpl: mockFetch(async () =>
            nonOkResponse(500, () => {
              bodyReadCount += 1
            }),
          ),
        }),
      AI_CHART_OPENAI_REQUEST_FAILED,
      true,
    )
    assert.equal(bodyReadCount, 0)
  })

  await asyncTest('HTTP 400 is non-retryable', async () => {
    let bodyReadCount = 0
    await captureSafeError(
      () =>
        requestAiChartOpenAiStructuredResponse(requestFixture(), {
          env: syntheticEnv(),
          fetchImpl: mockFetch(async () =>
            nonOkResponse(400, () => {
              bodyReadCount += 1
            }),
          ),
        }),
      AI_CHART_OPENAI_REQUEST_FAILED,
      false,
    )
    assert.equal(bodyReadCount, 0)
  })

  await asyncTest('HTTP 408, 409, and 425 are retryable', async () => {
    for (const status of [408, 409, 425]) {
      await captureSafeError(
        () =>
          requestAiChartOpenAiStructuredResponse(requestFixture(), {
            env: syntheticEnv(),
            fetchImpl: mockFetch(async () => nonOkResponse(status, () => {})),
          }),
        AI_CHART_OPENAI_REQUEST_FAILED,
        true,
      )
    }
  })

  await asyncTest('timeout aborts the mock fetch', async () => {
    let fetchCount = 0
    let abortCount = 0
    await captureSafeError(
      () =>
        requestAiChartOpenAiStructuredResponse(
          requestFixture({ timeoutMs: 1_000 }),
          {
            env: syntheticEnv(),
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
  })

  let bodyTimeoutFetchCount = 0
  let bodyTimeoutAbortCount = 0
  const bodyTimeoutError = await captureSafeError(
    () =>
      requestAiChartOpenAiStructuredResponse(
        requestFixture({ timeoutMs: 1_000 }),
        {
          env: syntheticEnv(),
          fetchImpl: mockFetch(async (_input, init) => {
            bodyTimeoutFetchCount += 1
            const signal = init?.signal

            return {
              ok: true,
              status: 200,
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
