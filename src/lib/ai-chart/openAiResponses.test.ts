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
  AI_CHART_OPENAI_RESPONSE_INVALID,
  AiChartOpenAiError,
  buildAiChartOpenAiResponsesBody,
  getAiChartOpenAiModel,
  parseAiChartOpenAiStructuredResponse,
  validateAiChartOpenAiStructuredRequest,
  type AiChartOpenAiStructuredRequest,
} from './openAiResponses'

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
const SYNTHETIC_REASONING_SUMMARY = 'synthetic-private-reasoning-summary'
const SYNTHETIC_ENCRYPTED_REASONING =
  'synthetic-private-encrypted-reasoning-content'

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

function expectResponseInvalid(run: () => unknown, markers: string[] = []) {
  try {
    run()
    assert.fail('expected response invalid')
  } catch (error) {
    assert.equal(error instanceof AiChartOpenAiError, true)
    if (!(error instanceof AiChartOpenAiError)) {
      assert.fail('expected AiChartOpenAiError')
    }
    assert.equal(error.message, AI_CHART_OPENAI_RESPONSE_INVALID)
    assert.equal(error.code, AI_CHART_OPENAI_RESPONSE_INVALID)
    assert.equal(error.retryable, false)
    for (const marker of markers) {
      assert.equal(error.message.includes(marker), false)
    }
  }
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
  expectResponseInvalid(() =>
    parseAiChartOpenAiStructuredResponse(
      responseFixture({
        output: [reasoningOutputFixture()],
      }),
      parseResult,
    ),
  )
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
  expectResponseInvalid(
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
    [SYNTHETIC_REASONING_SUMMARY],
  )
})

test('invalid reasoning error does not leak encrypted content', () => {
  expectResponseInvalid(
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
    [SYNTHETIC_ENCRYPTED_REASONING],
  )
})

test('top-level SDK-only output_text is rejected', () => {
  expectResponseInvalid(() =>
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
  )
})

test('refusal content is rejected', () => {
  expectResponseInvalid(() =>
    parseAiChartOpenAiStructuredResponse(
      responseFixture({
        output: [
          {
            type: 'message',
            content: [
              {
                type: 'refusal',
                refusal: 'synthetic refusal',
              },
            ],
          },
        ],
      }),
      parseResult,
    ),
  )
})

test('incomplete response is rejected', () => {
  expectResponseInvalid(() =>
    parseAiChartOpenAiStructuredResponse(
      responseFixture({
        status: 'incomplete',
        incomplete_details: {
          reason: 'max_output_tokens',
        },
      }),
      parseResult,
    ),
  )
})

test('response error is rejected without leaking its body', () => {
  expectResponseInvalid(
    () =>
      parseAiChartOpenAiStructuredResponse(
        responseFixture({
          error: {
            message: SYNTHETIC_RESPONSE_BODY,
          },
        }),
        parseResult,
      ),
    [SYNTHETIC_RESPONSE_BODY],
  )
})

test('unknown content type is rejected', () => {
  expectResponseInvalid(() =>
    parseAiChartOpenAiStructuredResponse(
      responseFixture({
        output: [
          {
            type: 'message',
            content: [
              {
                type: 'synthetic_unknown_content',
                text: '{}',
              },
            ],
          },
        ],
      }),
      parseResult,
    ),
  )
})

test('unknown output item type is rejected', () => {
  expectResponseInvalid(() =>
    parseAiChartOpenAiStructuredResponse(
      responseFixture({
        output: [
          {
            type: 'synthetic_unknown_output_item',
          },
        ],
      }),
      parseResult,
    ),
  )
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
  expectResponseInvalid(
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
    [SYNTHETIC_RESPONSE_BODY],
  )
})

test('parseResult failure becomes fixed response invalid', () => {
  expectResponseInvalid(
    () =>
      parseAiChartOpenAiStructuredResponse(responseFixture(), () => {
        throw new Error(SYNTHETIC_RESPONSE_BODY)
      }),
    [SYNTHETIC_RESPONSE_BODY],
  )
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

assert.equal(testCount >= 54, true)
console.log(`AI chart OpenAI Responses contract tests passed: ${testCount}`)
