import assert from 'node:assert/strict'
import {
  AI_CHART_OPENAI_CONFIG_INVALID,
  AI_CHART_OPENAI_DEFAULT_MAX_OUTPUT_TOKENS,
  AI_CHART_OPENAI_DEFAULT_REASONING_EFFORT,
  AI_CHART_OPENAI_DEFAULT_TIMEOUT_MS,
  AI_CHART_OPENAI_MAX_OUTPUT_TOKENS,
  AI_CHART_OPENAI_MAX_TIMEOUT_MS,
  AI_CHART_OPENAI_MIN_OUTPUT_TOKENS,
  AI_CHART_OPENAI_MIN_TIMEOUT_MS,
  AI_CHART_OPENAI_OUTPUT_JSON_INVALID,
  AI_CHART_OPENAI_OUTPUT_MISSING,
  AI_CHART_OPENAI_OUTPUT_SCHEMA_INVALID,
  AI_CHART_OPENAI_REQUEST_FAILED,
  AI_CHART_OPENAI_RESPONSE_INCOMPLETE,
  AI_CHART_OPENAI_RESPONSE_INVALID,
  AI_CHART_OPENAI_RESPONSE_REFUSED,
  AiChartOpenAiError,
  buildAiChartOpenAiResponsesBody,
  getAiChartOpenAiModel,
  parseAiChartOpenAiStructuredResponse,
  validateAiChartOpenAiStructuredRequest,
  type AiChartOpenAiErrorCode,
  type AiChartOpenAiStructuredRequest,
} from './openAiResponses'
import {
  AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS,
  AiChartD1P1AdapterBridgeResultInvalidError,
} from './d1P1AdapterBridgeContracts'

type ParsedResult = {
  answer: string
  nested: {
    score: number
  }
}

type MutableRecord = Record<string, unknown>

const SYNTHETIC_API_KEY = 'synthetic-api-key-value'
const SYNTHETIC_PROMPT = 'synthetic-private-prompt-value'
const SYNTHETIC_RESPONSE_BODY = 'synthetic-raw-response-body-value'
const SYNTHETIC_SENSITIVE_OUTPUT_TEXT =
  'synthetic-sensitive-output-text-must-not-leak'
const SYNTHETIC_REASONING_SUMMARY = 'synthetic-private-reasoning-summary'
const SYNTHETIC_ENCRYPTED_REASONING =
  'synthetic-private-encrypted-reasoning-content'
const SYNTHETIC_SOURCE_BOUND_SENSITIVE_MESSAGE =
  'synthetic-output_text-prompt-model-input-starName-palaceId-ruleId-meaningId-omission-detail'

const COVERAGE_DETAIL_REASON_CODES = Object.freeze([
  AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_DIRECT_MEANINGS_MISMATCH,
  AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_DIRECT_MEANINGS_DUPLICATE,
  AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_DIRECT_MEANINGS_UNEXPECTED,
  AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_DIRECT_MEANINGS_COMPLETE_SET_MISSING,
  AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_DIRECT_MEANINGS_OMISSION_TRACE_MISSING,
  AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_MAJOR_STARS_MISMATCH,
  AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_MINOR_STARS_MISMATCH,
  AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_MUTAGENS_MISMATCH,
  AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_MALEFICS_MISMATCH,
  AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_NOBLES_MISMATCH,
  AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_PROCESSING_FLAGS_MISMATCH,
  AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_STATUS_OMISSIONS_MISMATCH,
] as const)

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

function schemaFixture(): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['answer', 'nested'],
    properties: {
      answer: {
        type: 'string',
      },
      nested: {
        type: 'object',
        additionalProperties: false,
        required: ['score'],
        properties: {
          score: {
            type: 'integer',
          },
        },
      },
    },
  }
}

function parseResult(value: unknown): ParsedResult {
  assert.equal(typeof value, 'object')
  assert.notEqual(value, null)
  assert.equal(Array.isArray(value), false)

  const record = value as MutableRecord
  assert.equal(typeof record.answer, 'string')
  assert.equal(typeof record.nested, 'object')
  assert.notEqual(record.nested, null)

  const nested = record.nested as MutableRecord
  assert.equal(Number.isInteger(nested.score), true)

  return {
    answer: record.answer as string,
    nested: {
      score: nested.score as number,
    },
  }
}

function requestFixture(
  overrides: Partial<AiChartOpenAiStructuredRequest<ParsedResult>> = {},
): AiChartOpenAiStructuredRequest<ParsedResult> {
  return {
    instructions: 'Synthetic system instructions',
    userInput: SYNTHETIC_PROMPT,
    schemaName: 'ai_chart_d1_result',
    description: 'Synthetic structured result',
    schema: schemaFixture(),
    parseResult,
    ...overrides,
  }
}

function responseFixture(overrides: MutableRecord = {}): MutableRecord {
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
              answer: 'synthetic-answer',
              nested: {
                score: 7,
              },
            }),
          },
        ],
      },
    ],
    usage: {
      input_tokens: 10,
      output_tokens: 20,
      output_tokens_details: {
        reasoning_tokens: 5,
      },
      total_tokens: 30,
    },
    ...overrides,
  }
}

function reasoningOutputFixture(overrides: MutableRecord = {}): MutableRecord {
  return {
    id: 'synthetic-reasoning-id',
    type: 'reasoning',
    status: 'completed',
    summary: [],
    encrypted_content: SYNTHETIC_ENCRYPTED_REASONING,
    ...overrides,
  }
}

function messageOutputFixture(): MutableRecord {
  return {
    id: 'synthetic-message-id',
    type: 'message',
    status: 'completed',
    role: 'assistant',
    content: [
      {
        type: 'output_text',
        text: JSON.stringify({
          answer: 'synthetic-answer',
          nested: {
            score: 7,
          },
        }),
      },
    ],
  }
}

function expectConfigInvalid(run: () => unknown, markers: string[] = []) {
  try {
    run()
    assert.fail('expected config invalid')
  } catch (error) {
    assert.equal(error instanceof AiChartOpenAiError, true)
    if (!(error instanceof AiChartOpenAiError)) {
      assert.fail('expected AiChartOpenAiError')
    }
    assert.equal(error.message, AI_CHART_OPENAI_CONFIG_INVALID)
    assert.equal(error.code, AI_CHART_OPENAI_CONFIG_INVALID)
    assert.equal(error.retryable, false)
    for (const marker of markers) {
      assert.equal(error.message.includes(marker), false)
    }
  }
}

function expectResponseError(
  run: () => unknown,
  code: AiChartOpenAiErrorCode,
  markers: string[] = [],
): AiChartOpenAiError {
  try {
    run()
    assert.fail(`expected ${code}`)
  } catch (error) {
    assert.equal(error instanceof AiChartOpenAiError, true)
    if (!(error instanceof AiChartOpenAiError)) {
      assert.fail('expected AiChartOpenAiError')
    }
    assert.equal(error.message, code)
    assert.equal(error.code, code)
    assert.equal(error.retryable, false)
    for (const marker of markers) {
      assert.equal(error.message.includes(marker), false)
      assert.equal(String(error).includes(marker), false)
      assert.equal(JSON.stringify(error).includes(marker), false)
    }
    return error
  }
}

function expectResponseInvalid(run: () => unknown, markers: string[] = []) {
  return expectResponseError(run, AI_CHART_OPENAI_RESPONSE_INVALID, markers)
}

test('unset model defaults to gpt-5.6-sol', () => {
  assert.equal(getAiChartOpenAiModel({}), 'gpt-5.6-sol')
})

test('exact gpt-5.6-sol model is accepted', () => {
  assert.equal(
    getAiChartOpenAiModel({
      OPENAI_AI_CHART_MODEL: 'gpt-5.6-sol',
    }),
    'gpt-5.6-sol',
  )
})

test('other AI chart models are rejected', () => {
  expectConfigInvalid(() =>
    getAiChartOpenAiModel({
      OPENAI_AI_CHART_MODEL: 'synthetic-unsafe-model',
    }),
  )
})

test('divination model setting is ignored', () => {
  assert.equal(
    getAiChartOpenAiModel({
      OPENAI_DIVINATION_MODEL: 'synthetic-unrelated-model',
    }),
    'gpt-5.6-sol',
  )
})

test('empty instructions are rejected', () => {
  expectConfigInvalid(() =>
    validateAiChartOpenAiStructuredRequest(
      requestFixture({ instructions: '   ' }),
    ),
  )
})

test('empty user input is rejected', () => {
  expectConfigInvalid(() =>
    validateAiChartOpenAiStructuredRequest(requestFixture({ userInput: '' })),
  )
})

test('prompt whitespace is preserved after non-empty validation', () => {
  const instructions = '  Synthetic instructions  '
  const userInput = '  Synthetic user input  '
  const validated = validateAiChartOpenAiStructuredRequest(
    requestFixture({ instructions, userInput }),
  )

  assert.equal(validated.instructions, instructions)
  assert.equal(validated.userInput, userInput)
})

test('invalid schema name is rejected', () => {
  expectConfigInvalid(() =>
    validateAiChartOpenAiStructuredRequest(
      requestFixture({ schemaName: 'invalid schema name' }),
    ),
  )
})

test('empty description is rejected', () => {
  expectConfigInvalid(() =>
    validateAiChartOpenAiStructuredRequest(
      requestFixture({ description: '  ' }),
    ),
  )
})

test('non-plain schema is rejected', () => {
  expectConfigInvalid(() =>
    validateAiChartOpenAiStructuredRequest(
      requestFixture({
        schema: new Date() as unknown as Record<string, unknown>,
      }),
    ),
  )
})

test('schema root type must be object', () => {
  const schema = schemaFixture()
  schema.type = 'array'
  expectConfigInvalid(() =>
    validateAiChartOpenAiStructuredRequest(requestFixture({ schema })),
  )
})

test('schema root additionalProperties must be false', () => {
  const schema = schemaFixture()
  schema.additionalProperties = true
  expectConfigInvalid(() =>
    validateAiChartOpenAiStructuredRequest(requestFixture({ schema })),
  )
})

test('schema required must exist', () => {
  const schema = schemaFixture()
  delete schema.required
  expectConfigInvalid(() =>
    validateAiChartOpenAiStructuredRequest(requestFixture({ schema })),
  )
})

test('schema required cannot contain duplicates', () => {
  const schema = schemaFixture()
  schema.required = ['answer', 'answer']
  expectConfigInvalid(() =>
    validateAiChartOpenAiStructuredRequest(requestFixture({ schema })),
  )
})

test('every property must be required', () => {
  const schema = schemaFixture()
  schema.required = ['answer']
  expectConfigInvalid(() =>
    validateAiChartOpenAiStructuredRequest(requestFixture({ schema })),
  )
})

test('every required field must be a property', () => {
  const schema = schemaFixture()
  schema.required = ['answer', 'nested', 'missing']
  expectConfigInvalid(() =>
    validateAiChartOpenAiStructuredRequest(requestFixture({ schema })),
  )
})

test('parseResult must be a function', () => {
  expectConfigInvalid(() =>
    validateAiChartOpenAiStructuredRequest(
      requestFixture({
        parseResult: 'not-a-function' as unknown as typeof parseResult,
      }),
    ),
  )
})

test('invalid reasoning effort is rejected', () => {
  expectConfigInvalid(() =>
    validateAiChartOpenAiStructuredRequest(
      requestFixture({
        reasoningEffort:
          'synthetic-invalid' as unknown as AiChartOpenAiStructuredRequest<ParsedResult>['reasoningEffort'],
      }),
    ),
  )
})

test('timeout values outside both boundaries are rejected', () => {
  for (const timeoutMs of [
    AI_CHART_OPENAI_MIN_TIMEOUT_MS - 1,
    AI_CHART_OPENAI_MAX_TIMEOUT_MS + 1,
    AI_CHART_OPENAI_MIN_TIMEOUT_MS + 0.5,
  ]) {
    expectConfigInvalid(() =>
      validateAiChartOpenAiStructuredRequest(requestFixture({ timeoutMs })),
    )
  }
})

test('output token values outside both boundaries are rejected', () => {
  for (const maxOutputTokens of [
    AI_CHART_OPENAI_MIN_OUTPUT_TOKENS - 1,
    AI_CHART_OPENAI_MAX_OUTPUT_TOKENS + 1,
    AI_CHART_OPENAI_MIN_OUTPUT_TOKENS + 0.5,
  ]) {
    expectConfigInvalid(() =>
      validateAiChartOpenAiStructuredRequest(
        requestFixture({ maxOutputTokens }),
      ),
    )
  }
})

test('request defaults are fixed', () => {
  const validated = validateAiChartOpenAiStructuredRequest(requestFixture())

  assert.equal(
    validated.reasoningEffort,
    AI_CHART_OPENAI_DEFAULT_REASONING_EFFORT,
  )
  assert.equal(validated.timeoutMs, AI_CHART_OPENAI_DEFAULT_TIMEOUT_MS)
  assert.equal(
    validated.maxOutputTokens,
    AI_CHART_OPENAI_DEFAULT_MAX_OUTPUT_TOKENS,
  )
})

test('request range endpoints are accepted', () => {
  for (const [timeoutMs, maxOutputTokens] of [
    [AI_CHART_OPENAI_MIN_TIMEOUT_MS, AI_CHART_OPENAI_MIN_OUTPUT_TOKENS],
    [AI_CHART_OPENAI_MAX_TIMEOUT_MS, AI_CHART_OPENAI_MAX_OUTPUT_TOKENS],
  ] as const) {
    const validated = validateAiChartOpenAiStructuredRequest(
      requestFixture({ timeoutMs, maxOutputTokens }),
    )
    assert.equal(validated.timeoutMs, timeoutMs)
    assert.equal(validated.maxOutputTokens, maxOutputTokens)
  }
})

test('validated schema is deeply copied and frozen', () => {
  const schema = schemaFixture()
  const validated = validateAiChartOpenAiStructuredRequest(
    requestFixture({ schema }),
  )
  const originalType = (
    (validated.schema.properties as MutableRecord).answer as MutableRecord
  ).type

  ;(
    (schema.properties as MutableRecord).answer as MutableRecord
  ).type = 'number'

  assert.equal(
    ((validated.schema.properties as MutableRecord).answer as MutableRecord)
      .type,
    originalType,
  )
  assert.equal(Object.isFrozen(validated), true)
  assert.equal(Object.isFrozen(validated.schema), true)
  assert.equal(Object.isFrozen(validated.schema.properties), true)
})

test('body locks the model and persistence controls', () => {
  const body = buildAiChartOpenAiResponsesBody(requestFixture())

  assert.equal(body.model, 'gpt-5.6-sol')
  assert.equal(body.store, false)
  assert.equal(body.stream, false)
  assert.equal(body.background, false)
  assert.equal(body.truncation, 'disabled')
})

test('body uses strict json_schema format', () => {
  const body = buildAiChartOpenAiResponsesBody(requestFixture())

  assert.equal(body.text.format.type, 'json_schema')
  assert.equal(body.text.format.strict, true)
  assert.equal(body.text.format.name, 'ai_chart_d1_result')
  assert.equal(body.text.format.description, 'Synthetic structured result')
})

test('body uses the configured reasoning and token limit', () => {
  const body = buildAiChartOpenAiResponsesBody(
    requestFixture({
      reasoningEffort: 'high',
      maxOutputTokens: 4_096,
    }),
  )

  assert.equal(body.reasoning.effort, 'high')
  assert.equal(body.max_output_tokens, 4_096)
})

test('body contains exactly the intended top-level fields', () => {
  const body = buildAiChartOpenAiResponsesBody(requestFixture())

  assert.deepEqual(Object.keys(body).sort(), [
    'background',
    'input',
    'instructions',
    'max_output_tokens',
    'model',
    'reasoning',
    'store',
    'stream',
    'text',
    'truncation',
  ])
})

test('body excludes sampling, tools, identity, and API key fields', () => {
  const body = buildAiChartOpenAiResponsesBody(requestFixture())
  const bodyRecord = body as unknown as MutableRecord

  for (const forbidden of [
    'temperature',
    'top_p',
    'tools',
    'tool_choice',
    'previous_response_id',
    'conversation',
    'metadata',
    'user',
    'safety_identifier',
    'apiKey',
    'OPENAI_API_KEY',
  ]) {
    assert.equal(Object.hasOwn(bodyRecord, forbidden), false, forbidden)
  }
  assert.equal(JSON.stringify(body).includes(SYNTHETIC_API_KEY), false)
})

test('body is deeply frozen', () => {
  const body = buildAiChartOpenAiResponsesBody(requestFixture())

  assert.equal(Object.isFrozen(body), true)
  assert.equal(Object.isFrozen(body.reasoning), true)
  assert.equal(Object.isFrozen(body.input), true)
  assert.equal(Object.isFrozen(body.input[0]), true)
  assert.equal(Object.isFrozen(body.text), true)
  assert.equal(Object.isFrozen(body.text.format), true)
  assert.throws(() => {
    ;(body as unknown as { store: boolean }).store = true
  }, TypeError)
})

test('raw output array JSON is parsed successfully', () => {
  const result = parseAiChartOpenAiStructuredResponse(
    responseFixture(),
    parseResult,
  )

  assert.deepEqual(result.data, {
    answer: 'synthetic-answer',
    nested: {
      score: 7,
    },
  })
  assert.equal(Object.hasOwn(result, 'diagnostic'), false)
})

test('completed reasoning item before message is safely ignored', () => {
  const result = parseAiChartOpenAiStructuredResponse(
    responseFixture({
      output: [reasoningOutputFixture(), messageOutputFixture()],
    }),
    parseResult,
  )

  assert.equal(result.data.answer, 'synthetic-answer')
  assert.equal(JSON.stringify(result).includes(SYNTHETIC_REASONING_SUMMARY), false)
  assert.equal(
    JSON.stringify(result).includes(SYNTHETIC_ENCRYPTED_REASONING),
    false,
  )
})

test('completed reasoning item after message is safely ignored', () => {
  const result = parseAiChartOpenAiStructuredResponse(
    responseFixture({
      output: [messageOutputFixture(), reasoningOutputFixture()],
    }),
    parseResult,
  )

  assert.equal(result.data.answer, 'synthetic-answer')
})

test('multiple completed reasoning items and one message are accepted', () => {
  const result = parseAiChartOpenAiStructuredResponse(
    responseFixture({
      output: [
        reasoningOutputFixture({ id: 'synthetic-reasoning-id-1' }),
        reasoningOutputFixture({ id: 'synthetic-reasoning-id-2' }),
        messageOutputFixture(),
      ],
    }),
    parseResult,
  )

  assert.equal(result.data.nested.score, 7)
})

test('reasoning item without status is accepted', () => {
  const reasoningItem = reasoningOutputFixture()
  delete reasoningItem.status

  const result = parseAiChartOpenAiStructuredResponse(
    responseFixture({
      output: [reasoningItem, messageOutputFixture()],
    }),
    parseResult,
  )

  assert.equal(result.data.answer, 'synthetic-answer')
})

test('reasoning summary is not returned', () => {
  const result = parseAiChartOpenAiStructuredResponse(
    responseFixture({
      output: [
        reasoningOutputFixture({
          summary: [
            {
              type: 'summary_text',
              text: SYNTHETIC_REASONING_SUMMARY,
            },
          ],
        }),
        messageOutputFixture(),
      ],
    }),
    parseResult,
  )

  assert.equal(JSON.stringify(result).includes(SYNTHETIC_REASONING_SUMMARY), false)
})

test('encrypted reasoning content is not returned', () => {
  const result = parseAiChartOpenAiStructuredResponse(
    responseFixture({
      output: [
        reasoningOutputFixture({
          encrypted_content: SYNTHETIC_ENCRYPTED_REASONING,
        }),
        messageOutputFixture(),
      ],
    }),
    parseResult,
  )

  assert.equal(
    JSON.stringify(result).includes(SYNTHETIC_ENCRYPTED_REASONING),
    false,
  )
})

test('reasoning item with in_progress status is rejected', () => {
  expectResponseInvalid(() =>
    parseAiChartOpenAiStructuredResponse(
      responseFixture({
        output: [
          reasoningOutputFixture({ status: 'in_progress' }),
          messageOutputFixture(),
        ],
      }),
      parseResult,
    ),
  )
})

test('reasoning item with incomplete status is rejected', () => {
  expectResponseInvalid(() =>
    parseAiChartOpenAiStructuredResponse(
      responseFixture({
        output: [
          reasoningOutputFixture({ status: 'incomplete' }),
          messageOutputFixture(),
        ],
      }),
      parseResult,
    ),
  )
})

test('reasoning-only output without output_text is rejected', () => {
  expectResponseError(
    () =>
      parseAiChartOpenAiStructuredResponse(
        responseFixture({
          output: [reasoningOutputFixture()],
        }),
        parseResult,
      ),
    AI_CHART_OPENAI_OUTPUT_MISSING,
  )
})

test('message without output_text is classified as output missing', () => {
  const error = expectResponseError(
    () =>
      parseAiChartOpenAiStructuredResponse(
        responseFixture({
          output: [
            {
              type: 'message',
              status: 'completed',
              content: [],
            },
          ],
        }),
        parseResult,
      ),
    AI_CHART_OPENAI_OUTPUT_MISSING,
  )
  assert.equal(error.diagnostic?.responseStatus, 'completed')
  assert.deepEqual(error.diagnostic?.outputItemTypes, ['message'])
  assert.deepEqual(error.diagnostic?.contentItemTypes, [])
  assert.equal(error.diagnostic?.outputTextCount, 0)
})

test('reasoning item does not affect usage parsing', () => {
  const result = parseAiChartOpenAiStructuredResponse(
    responseFixture({
      output: [reasoningOutputFixture(), messageOutputFixture()],
    }),
    parseResult,
  )

  assert.deepEqual(result.usage, {
    inputTokens: 10,
    outputTokens: 20,
    reasoningTokens: 5,
    totalTokens: 30,
  })
})

test('invalid reasoning error does not leak summary', () => {
  expectResponseError(
    () =>
      parseAiChartOpenAiStructuredResponse(
        responseFixture({
          output: [
            reasoningOutputFixture({
              status: 'incomplete',
              summary: [
                {
                  type: 'summary_text',
                  text: SYNTHETIC_REASONING_SUMMARY,
                },
              ],
            }),
          ],
        }),
        parseResult,
      ),
    AI_CHART_OPENAI_OUTPUT_MISSING,
    [SYNTHETIC_REASONING_SUMMARY],
  )
})

test('invalid reasoning error does not leak encrypted content', () => {
  expectResponseError(
    () =>
      parseAiChartOpenAiStructuredResponse(
        responseFixture({
          output: [
            reasoningOutputFixture({
              status: 'in_progress',
              encrypted_content: SYNTHETIC_ENCRYPTED_REASONING,
            }),
          ],
        }),
        parseResult,
      ),
    AI_CHART_OPENAI_OUTPUT_MISSING,
    [SYNTHETIC_ENCRYPTED_REASONING],
  )
})

test('top-level SDK-only output_text is rejected', () => {
  expectResponseError(
    () =>
      parseAiChartOpenAiStructuredResponse(
        {
          status: 'completed',
          output_text: JSON.stringify({
            answer: 'must-not-be-used',
            nested: { score: 1 },
          }),
        },
        parseResult,
      ),
    AI_CHART_OPENAI_OUTPUT_MISSING,
  )
})

test('refusal content is rejected', () => {
  const refusalText = 'synthetic refusal must not leak'
  const error = expectResponseError(
    () =>
      parseAiChartOpenAiStructuredResponse(
        responseFixture({
          output: [
            {
              type: 'message',
              content: [
                {
                  type: 'refusal',
                  refusal: refusalText,
                },
              ],
            },
          ],
        }),
        parseResult,
      ),
    AI_CHART_OPENAI_RESPONSE_REFUSED,
    [refusalText],
  )
  assert.deepEqual(error.diagnostic?.contentItemTypes, ['refusal'])
  assert.equal(error.diagnostic?.outputTextCount, 0)
})

for (const incompleteReason of ['max_output_tokens', 'content_filter']) {
  test(`incomplete response preserves safe ${incompleteReason} metadata`, () => {
    const error = expectResponseError(
      () =>
        parseAiChartOpenAiStructuredResponse(
          responseFixture({
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
                    text: SYNTHETIC_SENSITIVE_OUTPUT_TEXT,
                  },
                ],
              },
            ],
          }),
          parseResult,
        ),
      AI_CHART_OPENAI_RESPONSE_INCOMPLETE,
      [SYNTHETIC_SENSITIVE_OUTPUT_TEXT],
    )

    assert.equal(error.diagnostic?.responseStatus, 'incomplete')
    assert.equal(error.diagnostic?.incompleteReason, incompleteReason)
    assert.deepEqual(error.diagnostic?.outputItemTypes, ['message'])
    assert.deepEqual(error.diagnostic?.contentItemTypes, ['output_text'])
    assert.equal(error.diagnostic?.outputTextCount, 1)
    assert.deepEqual(error.diagnostic?.usage, {
      inputTokens: 10,
      outputTokens: 20,
      reasoningTokens: 5,
      totalTokens: 30,
    })
    assert.deepEqual(Object.keys(error.diagnostic ?? {}).sort(), [
      'contentItemTypes',
      'incompleteReason',
      'outputItemTypes',
      'outputSchemaValidationCode',
      'outputTextCount',
      'responseErrorCode',
      'responseStatus',
      'usage',
    ])
    assert.deepEqual(Object.keys(error).sort(), [
      'code',
      'diagnostic',
      'retryable',
    ])
    assert.equal(Object.isFrozen(error.diagnostic), true)
    assert.equal(Object.isFrozen(error.diagnostic?.outputItemTypes), true)
    assert.equal(Object.isFrozen(error.diagnostic?.contentItemTypes), true)
    assert.equal(Object.isFrozen(error.diagnostic?.usage), true)
  })
}

test('response error is rejected without leaking its body', () => {
  const error = expectResponseInvalid(
    () =>
      parseAiChartOpenAiStructuredResponse(
        responseFixture({
          error: {
            code: 'server_error',
            message: SYNTHETIC_RESPONSE_BODY,
          },
        }),
        parseResult,
      ),
    [SYNTHETIC_RESPONSE_BODY],
  )
  assert.equal(error.diagnostic?.responseErrorCode, 'server_error')
})

test('unknown content type is rejected', () => {
  const unknownContentType = 'synthetic_sensitive_content_type'
  const error = expectResponseError(
    () =>
      parseAiChartOpenAiStructuredResponse(
        responseFixture({
          output: [
            {
              type: 'message',
              content: [
                {
                  type: unknownContentType,
                  text: '{}',
                },
              ],
            },
          ],
        }),
        parseResult,
      ),
    AI_CHART_OPENAI_OUTPUT_MISSING,
    [unknownContentType],
  )
  assert.deepEqual(error.diagnostic?.contentItemTypes, ['invalid'])
})

test('unknown output item type is rejected', () => {
  const unknownOutputType = 'synthetic_sensitive_output_type'
  const error = expectResponseError(
    () =>
      parseAiChartOpenAiStructuredResponse(
        responseFixture({
          output: [
            {
              type: unknownOutputType,
            },
          ],
        }),
        parseResult,
      ),
    AI_CHART_OPENAI_OUTPUT_MISSING,
    [unknownOutputType],
  )
  assert.deepEqual(error.diagnostic?.outputItemTypes, ['invalid'])
})

test('output item diagnostics are capped while a later refusal is still found', () => {
  const unknownOutputType = 'synthetic-sensitive-output-type-before-limit'
  const refusalText = 'synthetic-sensitive-refusal-after-output-limit'
  const output = Array.from({ length: 32 }, (_, index) =>
    index % 2 === 0
      ? reasoningOutputFixture({ id: `synthetic-reasoning-${index}` })
      : { type: unknownOutputType },
  )
  output.push(
    { type: 'message', status: 'completed', content: [] },
    {
      type: 'message',
      status: 'completed',
      content: [{ type: 'refusal', refusal: refusalText }],
    },
  )

  const error = expectResponseError(
    () =>
      parseAiChartOpenAiStructuredResponse(
        responseFixture({ output }),
        parseResult,
      ),
    AI_CHART_OPENAI_RESPONSE_REFUSED,
    [unknownOutputType, refusalText],
  )

  assert.equal(error.diagnostic?.outputItemTypes.length, 32)
  assert.equal(error.diagnostic?.outputItemTypes.includes('message'), false)
  assert.equal(
    error.diagnostic?.outputItemTypes.every(
      (itemType) => itemType === 'reasoning' || itemType === 'invalid',
    ),
    true,
  )
  assert.deepEqual(error.diagnostic?.contentItemTypes, ['refusal'])
  assert.equal(Object.isFrozen(error.diagnostic), true)
  assert.equal(Object.isFrozen(error.diagnostic?.outputItemTypes), true)
  assert.equal(Object.isFrozen(error.diagnostic?.contentItemTypes), true)
})

test('content item diagnostics are capped while later output text is still counted', () => {
  const unknownContentType = 'synthetic-sensitive-content-type-before-limit'
  const firstOutputText = 'synthetic-sensitive-first-output-after-limit'
  const secondOutputText = 'synthetic-sensitive-second-output-after-limit'
  const content = Array.from({ length: 32 }, () => ({
    type: unknownContentType,
    text: '{}',
  }))
  content.push(
    { type: 'output_text', text: firstOutputText },
    { type: 'output_text', text: secondOutputText },
  )

  const error = expectResponseInvalid(
    () =>
      parseAiChartOpenAiStructuredResponse(
        responseFixture({
          output: [{ type: 'message', status: 'completed', content }],
        }),
        parseResult,
      ),
    [unknownContentType, firstOutputText, secondOutputText],
  )

  assert.equal(error.diagnostic?.contentItemTypes.length, 32)
  assert.equal(
    error.diagnostic?.contentItemTypes.every(
      (itemType) => itemType === 'invalid',
    ),
    true,
  )
  assert.equal(error.diagnostic?.outputTextCount, 2)
  assert.deepEqual(error.diagnostic?.outputItemTypes, ['message'])
  assert.equal(Object.isFrozen(error.diagnostic), true)
  assert.equal(Object.isFrozen(error.diagnostic?.outputItemTypes), true)
  assert.equal(Object.isFrozen(error.diagnostic?.contentItemTypes), true)
})

test('multiple output_text items are rejected', () => {
  expectResponseInvalid(() =>
    parseAiChartOpenAiStructuredResponse(
      responseFixture({
        output: [
          {
            type: 'message',
            content: [
              {
                type: 'output_text',
                text: '{"answer":"one","nested":{"score":1}}',
              },
              {
                type: 'output_text',
                text: '{"answer":"two","nested":{"score":2}}',
              },
            ],
          },
        ],
      }),
      parseResult,
    ),
  )
})

test('invalid output JSON is rejected', () => {
  expectResponseError(
    () =>
      parseAiChartOpenAiStructuredResponse(
        responseFixture({
          output: [
            {
              type: 'message',
              content: [
                {
                  type: 'output_text',
                  text: SYNTHETIC_RESPONSE_BODY,
                },
              ],
            },
          ],
        }),
        parseResult,
      ),
    AI_CHART_OPENAI_OUTPUT_JSON_INVALID,
    [SYNTHETIC_RESPONSE_BODY],
  )
})

test('valid JSON rejected by the source-bound parser is schema invalid', () => {
  const error = expectResponseError(
    () =>
      parseAiChartOpenAiStructuredResponse(
        responseFixture(),
        () => {
          throw new AiChartD1P1AdapterBridgeResultInvalidError(
            AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.CANDIDATE_SOURCE_BINDING_MISMATCH,
          )
        },
      ),
    AI_CHART_OPENAI_OUTPUT_SCHEMA_INVALID,
  )
  assert.equal(
    error.diagnostic?.outputSchemaValidationCode,
    AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.CANDIDATE_SOURCE_BINDING_MISMATCH,
  )
  assert.equal(Object.isFrozen(error.diagnostic), true)
  assert.equal(
    JSON.stringify(error).includes('CANDIDATE_SOURCE_BINDING_MISMATCH'),
    true,
  )
})

test('coverage detail reason codes propagate as frozen safe diagnostics', () => {
  for (const reasonCode of COVERAGE_DETAIL_REASON_CODES) {
    const error = expectResponseError(
      () =>
        parseAiChartOpenAiStructuredResponse(
          responseFixture(),
          () => {
            throw new AiChartD1P1AdapterBridgeResultInvalidError(reasonCode)
          },
        ),
      AI_CHART_OPENAI_OUTPUT_SCHEMA_INVALID,
      [
        SYNTHETIC_SOURCE_BOUND_SENSITIVE_MESSAGE,
        SYNTHETIC_RESPONSE_BODY,
      ],
    )
    assert.equal(error.diagnostic?.outputSchemaValidationCode, reasonCode)
    assert.equal(Object.isFrozen(error.diagnostic), true)
    assert.equal(
      JSON.stringify(error).includes(SYNTHETIC_SOURCE_BOUND_SENSITIVE_MESSAGE),
      false,
    )
  }
})

test('unknown parser errors remain schema invalid without leaking messages', () => {
  const sensitiveParserMessage = SYNTHETIC_SOURCE_BOUND_SENSITIVE_MESSAGE
  const error = expectResponseError(
    () =>
      parseAiChartOpenAiStructuredResponse(responseFixture(), () => {
        throw new Error(sensitiveParserMessage)
      }),
    AI_CHART_OPENAI_OUTPUT_SCHEMA_INVALID,
    [sensitiveParserMessage],
  )

  assert.equal(error.diagnostic?.outputSchemaValidationCode, null)
  assert.equal(JSON.stringify(error).includes(sensitiveParserMessage), false)
})

test('usage is normalized to safe non-negative integers', () => {
  const result = parseAiChartOpenAiStructuredResponse(
    responseFixture({
      usage: {
        input_tokens: 11,
        output_tokens: -1,
        output_tokens_details: {
          reasoning_tokens: 3,
        },
        total_tokens: 14.5,
      },
    }),
    parseResult,
  )

  assert.deepEqual(result.usage, {
    inputTokens: 11,
    outputTokens: 0,
    reasoningTokens: 3,
    totalTokens: 0,
  })
  assert.equal(Object.isFrozen(result.usage), true)
})

test('missing usage returns null', () => {
  const response = responseFixture()
  delete response.usage

  const result = parseAiChartOpenAiStructuredResponse(response, parseResult)
  assert.equal(result.usage, null)
})

test('invalid usage container is rejected', () => {
  expectResponseInvalid(() =>
    parseAiChartOpenAiStructuredResponse(
      responseFixture({ usage: 'invalid-usage' }),
      parseResult,
    ),
  )
})

test('structured result data is deeply copied and frozen', () => {
  let parserResultReference: ParsedResult | undefined
  const result = parseAiChartOpenAiStructuredResponse(
    responseFixture(),
    (value) => {
      parserResultReference = parseResult(value)
      return parserResultReference
    },
  )

  assert.ok(parserResultReference)
  parserResultReference.answer = 'mutated-after-parse'
  parserResultReference.nested.score = 999

  assert.equal(result.data.answer, 'synthetic-answer')
  assert.equal(result.data.nested.score, 7)
  assert.equal(Object.isFrozen(result), true)
  assert.equal(Object.isFrozen(result.data), true)
  assert.equal(Object.isFrozen(result.data.nested), true)
  assert.throws(() => {
    ;(result.data as { answer: string }).answer = 'external-mutation'
  }, TypeError)
})

test('safe errors expose only fixed enumerable fields', () => {
  const error = new AiChartOpenAiError(AI_CHART_OPENAI_CONFIG_INVALID, false)

  assert.deepEqual(Object.keys(error).sort(), ['code', 'retryable'])
  assert.equal(error.message, error.code)
  assert.equal(error.message.includes(SYNTHETIC_API_KEY), false)
  assert.equal(error.message.includes(SYNTHETIC_PROMPT), false)
  assert.equal(error.message.includes(SYNTHETIC_RESPONSE_BODY), false)
})

test('transport diagnostics are copied, frozen, and non-writable', () => {
  const sourceDiagnostic = {
    failureKind: 'HTTP_ERROR' as const,
    httpStatus: 429,
    requestId: 'req_contract_001',
    clientRequestId: '00000000-0000-4000-8000-000000000002',
    responseErrorType: 'rate_limit_error',
    responseErrorCode: 'rate_limit_exceeded',
    responseErrorParam: null,
  }
  const error = new AiChartOpenAiError(
    AI_CHART_OPENAI_REQUEST_FAILED,
    true,
    undefined,
    sourceDiagnostic,
  )

  sourceDiagnostic.requestId = 'mutated-after-construction'

  assert.deepEqual(error.transportDiagnostic, {
    failureKind: 'HTTP_ERROR',
    httpStatus: 429,
    requestId: 'req_contract_001',
    clientRequestId: '00000000-0000-4000-8000-000000000002',
    responseErrorType: 'rate_limit_error',
    responseErrorCode: 'rate_limit_exceeded',
    responseErrorParam: null,
  })
  assert.equal(Object.isFrozen(error.transportDiagnostic), true)
  assert.deepEqual(Object.keys(error).sort(), [
    'code',
    'retryable',
    'transportDiagnostic',
  ])

  const descriptor = Object.getOwnPropertyDescriptor(
    error,
    'transportDiagnostic',
  )
  assert.equal(descriptor?.writable, false)
  assert.equal(descriptor?.configurable, false)
  assert.deepEqual(Reflect.ownKeys(error.transportDiagnostic ?? {}), [
    'failureKind',
    'httpStatus',
    'requestId',
    'clientRequestId',
    'responseErrorType',
    'responseErrorCode',
    'responseErrorParam',
  ])
  assert.throws(() => {
    ;(
      error as unknown as {
        transportDiagnostic: unknown
      }
    ).transportDiagnostic = null
  }, TypeError)
})

test('transport diagnostic constructor boundary rejects hostile runtime values', () => {
  const sensitiveMarker =
    'synthetic API Key Authorization Prompt request body marker'
  const safeClientRequestId = '00000000-0000-4000-8000-000000000003'
  let accessorExecuted = false
  const accessorDiagnostic = {
    failureKind: 'HTTP_ERROR',
    httpStatus: 400,
    requestId: 'req_safe',
    clientRequestId: safeClientRequestId,
    responseErrorCode: 'safe_code',
    responseErrorParam: 'safe_param',
  }
  Object.defineProperty(accessorDiagnostic, 'responseErrorType', {
    enumerable: true,
    get() {
      accessorExecuted = true
      return sensitiveMarker
    },
  })

  const cyclicDiagnostic: Record<string, unknown> = {
    failureKind: 'HTTP_ERROR',
    httpStatus: 400,
    requestId: 'req_safe',
    clientRequestId: safeClientRequestId,
    responseErrorType: 'safe_type',
    responseErrorCode: 'safe_code',
    responseErrorParam: null,
  }
  cyclicDiagnostic.responseErrorParam = cyclicDiagnostic

  const proxyDiagnostic = new Proxy(
    {},
    {
      ownKeys() {
        throw new Error(sensitiveMarker)
      },
    },
  )
  const revocableDiagnostic = Proxy.revocable({}, {})
  revocableDiagnostic.revoke()

  const hostileDiagnostics: unknown[] = [
    {
      failureKind: 'HOSTILE_KIND',
      httpStatus: 400,
      requestId: 'req_safe',
      clientRequestId: safeClientRequestId,
      responseErrorType: 'safe_type',
      responseErrorCode: 'safe_code',
      responseErrorParam: null,
    },
    {
      failureKind: 'HTTP_ERROR',
      httpStatus: '400',
      requestId: 'req_safe',
      clientRequestId: safeClientRequestId,
      responseErrorType: 'safe_type',
      responseErrorCode: 'safe_code',
      responseErrorParam: null,
    },
    {
      failureKind: 'HTTP_ERROR',
      httpStatus: Number.NaN,
      requestId: 'req_safe',
      clientRequestId: safeClientRequestId,
      responseErrorType: 'safe_type',
      responseErrorCode: 'safe_code',
      responseErrorParam: null,
    },
    {
      failureKind: 'HTTP_ERROR',
      httpStatus: Number.POSITIVE_INFINITY,
      requestId: 'req_safe',
      clientRequestId: safeClientRequestId,
      responseErrorType: 'safe_type',
      responseErrorCode: 'safe_code',
      responseErrorParam: null,
    },
    {
      failureKind: 'HTTP_ERROR',
      httpStatus: -1,
      requestId: 'req_safe',
      clientRequestId: safeClientRequestId,
      responseErrorType: 'safe_type',
      responseErrorCode: 'safe_code',
      responseErrorParam: null,
    },
    {
      failureKind: 'HTTP_ERROR',
      httpStatus: 600,
      requestId: 'req_safe',
      clientRequestId: safeClientRequestId,
      responseErrorType: 'safe_type',
      responseErrorCode: 'safe_code',
      responseErrorParam: null,
    },
    {
      failureKind: 'HTTP_ERROR',
      httpStatus: 400,
      requestId: `unsafe\n${sensitiveMarker}`,
      clientRequestId: safeClientRequestId,
      responseErrorType: 'safe_type',
      responseErrorCode: 'safe_code',
      responseErrorParam: null,
    },
    {
      failureKind: 'HTTP_ERROR',
      httpStatus: 400,
      requestId: 'req_safe',
      clientRequestId: sensitiveMarker,
      responseErrorType: 'safe_type',
      responseErrorCode: 'safe_code',
      responseErrorParam: null,
    },
    {
      failureKind: 'HTTP_ERROR',
      httpStatus: 400,
      requestId: 'req_safe',
      clientRequestId: safeClientRequestId,
      responseErrorType: sensitiveMarker,
      responseErrorCode: 'safe_code',
      responseErrorParam: null,
    },
    {
      failureKind: 'HTTP_ERROR',
      httpStatus: 400,
      requestId: 'req_safe',
      clientRequestId: safeClientRequestId,
      responseErrorType: 'safe_type',
      responseErrorCode: 'x'.repeat(81),
      responseErrorParam: null,
    },
    {
      failureKind: 'HTTP_ERROR',
      httpStatus: 400,
      requestId: 'req_safe',
      clientRequestId: safeClientRequestId,
      responseErrorType: 'safe_type',
      responseErrorCode: 'safe_code',
      responseErrorParam: 'unsafe param',
    },
    {
      failureKind: 'HTTP_ERROR',
      httpStatus: 400,
      requestId: 'req_safe',
      clientRequestId: safeClientRequestId,
      responseErrorType: 'safe_type',
      responseErrorCode: 'safe_code',
      responseErrorParam: 'unsafe\tparam',
    },
    {
      failureKind: 'HTTP_ERROR',
      httpStatus: 400,
      requestId: 'req_safe',
      clientRequestId: safeClientRequestId,
      responseErrorType: 'safe_type',
      responseErrorCode: 'safe_code',
      responseErrorParam: null,
      arbitraryExtraKey: sensitiveMarker,
    },
    Object.assign(
      {
        failureKind: 'HTTP_ERROR',
        httpStatus: 400,
        requestId: 'req_safe',
        clientRequestId: safeClientRequestId,
        responseErrorType: 'safe_type',
        responseErrorCode: 'safe_code',
        responseErrorParam: null,
      },
      { [Symbol('hostile')]: sensitiveMarker },
    ),
    accessorDiagnostic,
    cyclicDiagnostic,
    [],
    new Date(),
    proxyDiagnostic,
    revocableDiagnostic.proxy,
  ]

  for (const hostileDiagnostic of hostileDiagnostics) {
    const error = new AiChartOpenAiError(
      AI_CHART_OPENAI_REQUEST_FAILED,
      true,
      undefined,
      hostileDiagnostic as never,
    )

    assert.equal(error.transportDiagnostic, undefined)
    assert.deepEqual(Object.keys(error).sort(), ['code', 'retryable'])
    assert.equal(String(error).includes(sensitiveMarker), false)
    assert.equal(JSON.stringify(error).includes(sensitiveMarker), false)
  }
  assert.equal(accessorExecuted, false)
})

assert.equal(testCount >= 54, true)
console.log(`AI chart OpenAI Responses contract tests passed: ${testCount}`)
