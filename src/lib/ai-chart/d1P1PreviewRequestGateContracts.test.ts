import assert from 'node:assert/strict'
import { AI_CHART_D1_P1_F1_CONTRACT_VERSION } from './d1CommonContracts'
import { AI_CHART_D1_MODEL_TARGET } from './d1Assets'
import {
  AI_CHART_D1_P1_ADAPTER_BRIDGE_CONTRACT_VERSION,
  AI_CHART_D1_P1_MAX_OUTPUT_TOKENS,
} from './d1P1AdapterBridgeContracts'
import {
  AI_CHART_D1_P1_OUTPUT_SCHEMA_SHA256,
  AI_CHART_D1_P1_PROMPT_INSTRUCTIONS_SHA256,
  AI_CHART_D1_P1_PROMPT_VERSION,
} from './d1P1PromptPackageContracts'
import {
  AI_CHART_D1_P1_PREVIEW_AUTHORIZATION_ACKNOWLEDGEMENT,
  AI_CHART_D1_P1_PREVIEW_AUTHORIZATION_FIELDS,
  AI_CHART_D1_P1_PREVIEW_AUTHORIZATION_INTERNAL_JSON_SCHEMA,
  AI_CHART_D1_P1_PREVIEW_AUTHORIZATION_MODE,
  AI_CHART_D1_P1_PREVIEW_AUTHORIZATION_VERSION,
  AI_CHART_D1_P1_PREVIEW_GATE_CONTRACT_VERSION,
  AI_CHART_D1_P1_PREVIEW_GATE_DISABLED,
  AI_CHART_D1_P1_PREVIEW_GATE_FIELDS,
  AI_CHART_D1_P1_PREVIEW_GATE_INTERNAL_JSON_SCHEMA,
  AI_CHART_D1_P1_PREVIEW_GATE_INVALID,
  AI_CHART_D1_P1_PREVIEW_GATE_NOT_READY,
  AI_CHART_D1_P1_PREVIEW_GATE_PRODUCTION_FORBIDDEN,
  AI_CHART_D1_P1_PREVIEW_GATE_REQUEST_MODE,
  AI_CHART_D1_P1_PREVIEW_GATE_SCHEMA_NAME,
  AI_CHART_D1_P1_PREVIEW_GATE_TASK,
  AiChartD1P1PreviewGateError,
  createAiChartD1P1PreviewEvidenceContractSummary,
  createAiChartD1P1PreviewAuthorization,
  createAiChartD1P1PreviewRequestPlanFingerprint,
  parseAiChartD1P1PreviewAuthorization,
  parseAiChartD1P1PreviewRequestPlanShape,
  stableAiChartD1P1PreviewRequestPlanEqual,
  type AiChartD1P1PreviewRequestPlan,
  type AiChartD1P1PreviewRequestPlanWithoutFingerprint,
} from './d1P1PreviewRequestGateContracts'
import { AI_CHART_D1_P1_SCHEMA_NAME } from './d1P1F1Contracts'
import {
  AI_CHART_D1_P1_LOCAL_PREVIEW_TIMEOUT_MS,
  AI_CHART_D1_P1_PREVIEW_TIMEOUT_ENVIRONMENT_VARIABLE,
  AI_CHART_D1_P1_PREVIEW_TIMEOUT_VALUES,
  type AiChartD1P1PreviewTimeoutMs,
} from './d1P1PreviewTimeoutContracts'
import {
  AI_CHART_OPENAI_DEFAULT_MAX_OUTPUT_TOKENS,
  AI_CHART_OPENAI_DEFAULT_REASONING_EFFORT,
  AI_CHART_OPENAI_DEFAULT_TIMEOUT_MS,
  AI_CHART_OPENAI_MAX_OUTPUT_TOKENS,
} from './openAiResponses'

type Mutable<T> = {
  -readonly [Key in keyof T]: T[Key] extends readonly (infer Item)[]
    ? Mutable<Item>[]
    : T[Key] extends object
      ? Mutable<T[Key]>
      : T[Key]
}

let checks = 0

function check(name: string, run: () => void) {
  run()
  checks += 1
  console.log(`✓ ${name}`)
}

function assertInvalid(run: () => unknown): void {
  assert.throws(run, { message: AI_CHART_D1_P1_PREVIEW_GATE_INVALID })
}

function withoutFingerprint(
  plan: AiChartD1P1PreviewRequestPlan,
): AiChartD1P1PreviewRequestPlanWithoutFingerprint {
  const payload = structuredClone(plan) as unknown as Record<string, unknown>
  delete payload.planFingerprint
  return payload as AiChartD1P1PreviewRequestPlanWithoutFingerprint
}

function planFixture(
  targetPalaceId: 'palace:ming' | 'palace:siblings' = 'palace:ming',
  timeoutMs: AiChartD1P1PreviewTimeoutMs = AI_CHART_OPENAI_DEFAULT_TIMEOUT_MS,
): AiChartD1P1PreviewRequestPlan {
  const suffix = targetPalaceId === 'palace:ming' ? 'a' : 'b'
  const value: AiChartD1P1PreviewRequestPlanWithoutFingerprint = {
    contractVersion: AI_CHART_D1_P1_PREVIEW_GATE_CONTRACT_VERSION,
    task: AI_CHART_D1_P1_PREVIEW_GATE_TASK,
    requestMode: AI_CHART_D1_P1_PREVIEW_GATE_REQUEST_MODE,
    chartId: 'chart:synthetic-preview-contract',
    runId: 'run:synthetic-preview-contract',
    callId: `call:synthetic-preview-contract:${suffix}`,
    targetPalaceId,
    adapterBridgeContractVersion:
      AI_CHART_D1_P1_ADAPTER_BRIDGE_CONTRACT_VERSION,
    bridgeFingerprint: suffix.repeat(64),
    packageFingerprint: (suffix === 'a' ? 'b' : 'c').repeat(64),
    modelInputFingerprint: (suffix === 'a' ? 'c' : 'd').repeat(64),
    promptVersion: AI_CHART_D1_P1_PROMPT_VERSION,
    instructionsSha256: AI_CHART_D1_P1_PROMPT_INSTRUCTIONS_SHA256,
    outputContractVersion: AI_CHART_D1_P1_F1_CONTRACT_VERSION,
    outputSchemaName: AI_CHART_D1_P1_SCHEMA_NAME,
    outputSchemaSha256: AI_CHART_D1_P1_OUTPUT_SCHEMA_SHA256,
    modelTarget: AI_CHART_D1_MODEL_TARGET,
    reasoningEffort: AI_CHART_OPENAI_DEFAULT_REASONING_EFFORT,
    timeoutMs,
    maxOutputTokens: AI_CHART_D1_P1_MAX_OUTPUT_TOKENS,
    maxRequests: 1,
    serverOnly: true,
    environmentPolicy: 'local_development_only',
    authorizationStatus: 'authorization_required',
    routeStatus: 'route_forbidden',
    persistenceStatus: 'persistence_forbidden',
    runtimeStatus: 'preview_gate_only',
    productionCallable: false,
  }
  return {
    ...value,
    planFingerprint: createAiChartD1P1PreviewRequestPlanFingerprint(value),
  }
}

function collectKeys(value: unknown, output = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    value.forEach((entry) => collectKeys(entry, output))
  } else if (value !== null && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) {
      output.add(key)
      collectKeys(entry, output)
    }
  }
  return output
}

function run() {
  const plan = planFixture()
  const localPreviewPlan = planFixture(
    'palace:ming',
    AI_CHART_D1_P1_LOCAL_PREVIEW_TIMEOUT_MS,
  )
  const otherPlan = planFixture('palace:siblings')
  const parsed = parseAiChartD1P1PreviewRequestPlanShape(plan)
  const authorization = createAiChartD1P1PreviewAuthorization(plan)
  const planSchema = AI_CHART_D1_P1_PREVIEW_GATE_INTERNAL_JSON_SCHEMA as Record<
    string,
    unknown
  >
  const authSchema =
    AI_CHART_D1_P1_PREVIEW_AUTHORIZATION_INTERNAL_JSON_SCHEMA as Record<
      string,
      unknown
    >

  for (const [name, actual, expected] of [
    ['Gate contract version', AI_CHART_D1_P1_PREVIEW_GATE_CONTRACT_VERSION, 'ai-chart-d1-p1-preview-request-gate/v1'],
    ['Gate schema name', AI_CHART_D1_P1_PREVIEW_GATE_SCHEMA_NAME, 'ai_chart_d1_p1_preview_request_gate_v1'],
    ['Gate task', AI_CHART_D1_P1_PREVIEW_GATE_TASK, 'D1_P1_PREVIEW_REQUEST'],
    ['Gate request mode', AI_CHART_D1_P1_PREVIEW_GATE_REQUEST_MODE, 'single_palace_single_request'],
    ['Gate invalid code', AI_CHART_D1_P1_PREVIEW_GATE_INVALID, 'ai_chart_d1_p1_preview_gate_invalid'],
    ['Gate not-ready code', AI_CHART_D1_P1_PREVIEW_GATE_NOT_READY, 'ai_chart_d1_p1_preview_gate_not_ready'],
    ['Gate disabled code', AI_CHART_D1_P1_PREVIEW_GATE_DISABLED, 'ai_chart_d1_p1_preview_gate_disabled'],
    ['Gate production code', AI_CHART_D1_P1_PREVIEW_GATE_PRODUCTION_FORBIDDEN, 'ai_chart_d1_p1_preview_gate_production_forbidden'],
    ['Authorization version', AI_CHART_D1_P1_PREVIEW_AUTHORIZATION_VERSION, 'ai-chart-d1-p1-preview-authorization/v1'],
    ['Authorization mode', AI_CHART_D1_P1_PREVIEW_AUTHORIZATION_MODE, 'execute_once'],
    ['Authorization acknowledgement', AI_CHART_D1_P1_PREVIEW_AUTHORIZATION_ACKNOWLEDGEMENT, 'EXECUTE_ONE_PAID_OPENAI_PREVIEW_REQUEST'],
    ['Local Preview timeout environment variable', AI_CHART_D1_P1_PREVIEW_TIMEOUT_ENVIRONMENT_VARIABLE, 'AI_CHART_D1_P1_PREVIEW_TIMEOUT_MS'],
    ['Local Preview timeout', AI_CHART_D1_P1_LOCAL_PREVIEW_TIMEOUT_MS, 300_000],
  ] as const) {
    check(`${name} is locked`, () => assert.equal(actual, expected))
  }

  for (const code of [
    AI_CHART_D1_P1_PREVIEW_GATE_INVALID,
    AI_CHART_D1_P1_PREVIEW_GATE_NOT_READY,
    AI_CHART_D1_P1_PREVIEW_GATE_DISABLED,
    AI_CHART_D1_P1_PREVIEW_GATE_PRODUCTION_FORBIDDEN,
  ] as const) {
    check(`${code} error exposes only its fixed safe code`, () => {
      const error = new AiChartD1P1PreviewGateError(code)
      assert.equal(error.message, code)
      assert.equal(error.code, code)
      assert.doesNotMatch(String(error), /chart:|run:|call:|palace:|[a-f0-9]{64}/u)
    })
  }

  check('Plan has exactly the locked fields', () => {
    assert.deepEqual(Object.keys(plan), AI_CHART_D1_P1_PREVIEW_GATE_FIELDS)
  })
  for (const [field, expected] of [
    ['maxRequests', 1],
    ['serverOnly', true],
    ['environmentPolicy', 'local_development_only'],
    ['authorizationStatus', 'authorization_required'],
    ['routeStatus', 'route_forbidden'],
    ['persistenceStatus', 'persistence_forbidden'],
    ['runtimeStatus', 'preview_gate_only'],
    ['productionCallable', false],
  ] as const) {
    check(`Plan ${field} is locked`, () => {
      assert.equal(plan[field], expected)
    })
  }
  check('Plan uses the locked model, reasoning and D1 P1 token policy', () => {
    assert.equal(plan.modelTarget, AI_CHART_D1_MODEL_TARGET)
    assert.equal(plan.reasoningEffort, AI_CHART_OPENAI_DEFAULT_REASONING_EFFORT)
    assert.equal(plan.timeoutMs, AI_CHART_OPENAI_DEFAULT_TIMEOUT_MS)
    assert.equal(plan.maxOutputTokens, AI_CHART_D1_P1_MAX_OUTPUT_TOKENS)
    assert.equal(AI_CHART_D1_P1_MAX_OUTPUT_TOKENS, 16_384)
    assert.equal(AI_CHART_OPENAI_DEFAULT_MAX_OUTPUT_TOKENS, 8_192)
    assert.equal(AI_CHART_OPENAI_MAX_OUTPUT_TOKENS, 32_768)
  })
  check('Plan timeout contract allows only default and Local Preview values', () => {
    assert.deepEqual(AI_CHART_D1_P1_PREVIEW_TIMEOUT_VALUES, [
      AI_CHART_OPENAI_DEFAULT_TIMEOUT_MS,
      AI_CHART_D1_P1_LOCAL_PREVIEW_TIMEOUT_MS,
    ])
    assert.equal(localPreviewPlan.timeoutMs, AI_CHART_D1_P1_LOCAL_PREVIEW_TIMEOUT_MS)
    assert.equal(
      parseAiChartD1P1PreviewRequestPlanShape(localPreviewPlan).timeoutMs,
      AI_CHART_D1_P1_LOCAL_PREVIEW_TIMEOUT_MS,
    )
  })
  check('Effective timeout changes the Plan fingerprint', () => {
    assert.notEqual(localPreviewPlan.planFingerprint, plan.planFingerprint)
    const defaultPayload = withoutFingerprint(plan)
    const localPayload = withoutFingerprint(localPreviewPlan)
    assert.deepEqual(
      { ...localPayload, timeoutMs: defaultPayload.timeoutMs },
      defaultPayload,
    )
  })
  check('Evidence contract summary includes the effective timeout', () => {
    assert.deepEqual(
      createAiChartD1P1PreviewEvidenceContractSummary(localPreviewPlan),
      {
        planFingerprint: localPreviewPlan.planFingerprint,
        timeoutMs: AI_CHART_D1_P1_LOCAL_PREVIEW_TIMEOUT_MS,
        maxRequests: 1,
        productionCallable: false,
      },
    )
  })
  check('Plan excludes raw request and private content fields', () => {
    const keys = collectKeys(plan)
    for (const forbidden of [
      'instructions', 'userInput', 'schema', 'parseResult', 'apiKey',
      'headers', 'bridge', 'request', 'response', 'usage', 'rules', 'stars',
      'sourcePath', 'birthInput', 'userId', 'reportId', 'paymentId',
    ]) {
      assert.equal(keys.has(forbidden), false)
    }
  })
  check('Plan fingerprint is deterministic', () => {
    assert.equal(
      createAiChartD1P1PreviewRequestPlanFingerprint(withoutFingerprint(plan)),
      plan.planFingerprint,
    )
    assert.equal(planFixture().planFingerprint, plan.planFingerprint)
  })
  check('Shape parser accepts the 16384 Plan', () => {
    assert.deepEqual(parseAiChartD1P1PreviewRequestPlanShape(plan), plan)
  })
  check('Shape parser rejects a legacy 8192 Plan after fingerprint recomputation', () => {
    const legacyPlan = structuredClone(plan) as unknown as Record<
      string,
      unknown
    >
    legacyPlan.maxOutputTokens = AI_CHART_OPENAI_DEFAULT_MAX_OUTPUT_TOKENS
    const legacyPayload = structuredClone(legacyPlan)
    delete legacyPayload.planFingerprint
    legacyPlan.planFingerprint = createAiChartD1P1PreviewRequestPlanFingerprint(
      legacyPayload as unknown as AiChartD1P1PreviewRequestPlanWithoutFingerprint,
    )
    assert.notEqual(legacyPlan.planFingerprint, plan.planFingerprint)
    assert.equal(
      legacyPlan.planFingerprint,
      createAiChartD1P1PreviewRequestPlanFingerprint(
        legacyPayload as unknown as AiChartD1P1PreviewRequestPlanWithoutFingerprint,
      ),
    )
    assertInvalid(() => parseAiChartD1P1PreviewRequestPlanShape(legacyPlan))
  })
  check('Different target palace has a different call id', () => {
    assert.notEqual(otherPlan.callId, plan.callId)
  })
  check('Different target palace has a different Bridge fingerprint', () => {
    assert.notEqual(otherPlan.bridgeFingerprint, plan.bridgeFingerprint)
  })
  check('Different target palace has a different Plan fingerprint', () => {
    assert.notEqual(otherPlan.planFingerprint, plan.planFingerprint)
  })
  check('Stable Plan equality is key-order independent', () => {
    const reversed = Object.fromEntries(Object.entries(plan).reverse())
    assert.equal(stableAiChartD1P1PreviewRequestPlanEqual(plan, reversed), true)
  })
  check('Shape parser returns a recursively frozen Plan', () => {
    assert.equal(Object.isFrozen(parsed), true)
  })
  check('Shape parser isolates later caller mutation', () => {
    const supplied = structuredClone(plan) as Mutable<AiChartD1P1PreviewRequestPlan>
    const isolated = parseAiChartD1P1PreviewRequestPlanShape(supplied)
    supplied.callId = 'call:mutated'
    assert.equal(isolated.callId, plan.callId)
  })
  check('Shape parser rejects an extra field', () => {
    assertInvalid(() => parseAiChartD1P1PreviewRequestPlanShape({ ...plan, prompt: 'forbidden' }))
  })
  check('Shape parser rejects a missing field', () => {
    const supplied = structuredClone(plan) as unknown as Record<string, unknown>
    delete supplied.callId
    assertInvalid(() => parseAiChartD1P1PreviewRequestPlanShape(supplied))
  })
  check('Shape parser rejects a wrong fixed constant', () => {
    assertInvalid(() => parseAiChartD1P1PreviewRequestPlanShape({ ...plan, maxRequests: 2 }))
  })
  for (const timeoutMs of [
    0,
    -1,
    120_001,
    299_999,
    300_001,
    Number.NaN,
    '300000',
  ]) {
    check(`Shape parser rejects timeout ${String(timeoutMs)}`, () => {
      assertInvalid(() =>
        parseAiChartD1P1PreviewRequestPlanShape({ ...plan, timeoutMs }),
      )
    })
  }
  check('Shape parser rejects an invalid target palace', () => {
    assertInvalid(() => parseAiChartD1P1PreviewRequestPlanShape({ ...plan, targetPalaceId: 'palace:unknown' }))
  })
  check('Shape parser rejects an invalid SHA', () => {
    assertInvalid(() => parseAiChartD1P1PreviewRequestPlanShape({ ...plan, bridgeFingerprint: 'invalid' }))
  })
  check('Shape parser rejects symbol keys', () => {
    const supplied = structuredClone(plan) as Record<PropertyKey, unknown>
    supplied[Symbol('forbidden')] = true
    assertInvalid(() => parseAiChartD1P1PreviewRequestPlanShape(supplied))
  })
  check('Shape parser rejects cycles', () => {
    const supplied = structuredClone(plan) as Record<string, unknown>
    supplied.loop = supplied
    assertInvalid(() => parseAiChartD1P1PreviewRequestPlanShape(supplied))
  })
  check('Shape parser rejects accessors without executing them', () => {
    const supplied = structuredClone(plan) as Record<string, unknown>
    let getterCalls = 0
    Object.defineProperty(supplied, 'chartId', {
      enumerable: true,
      get() {
        getterCalls += 1
        return plan.chartId
      },
    })
    assertInvalid(() => parseAiChartD1P1PreviewRequestPlanShape(supplied))
    assert.equal(getterCalls, 0)
  })

  check('Plan Schema is strict and exact', () => {
    assert.equal(planSchema.type, 'object')
    assert.equal(planSchema.additionalProperties, false)
    assert.deepEqual(planSchema.required, AI_CHART_D1_P1_PREVIEW_GATE_FIELDS)
    assert.deepEqual(
      Object.keys(planSchema.properties as Record<string, unknown>),
      AI_CHART_D1_P1_PREVIEW_GATE_FIELDS,
    )
  })
  check('Plan Schema exposes only the two timeout contract values', () => {
    const properties = planSchema.properties as Record<
      string,
      Record<string, unknown>
    >
    assert.deepEqual(
      properties.timeoutMs.enum,
      AI_CHART_D1_P1_PREVIEW_TIMEOUT_VALUES,
    )
  })
  check('Plan Schema locks the D1 P1 token budget to 16384', () => {
    const properties = planSchema.properties as Record<
      string,
      Record<string, unknown>
    >
    assert.equal(
      properties.maxOutputTokens.const,
      AI_CHART_D1_P1_MAX_OUTPUT_TOKENS,
    )
  })
  check('Authorization Schema is strict and exact', () => {
    assert.equal(authSchema.type, 'object')
    assert.equal(authSchema.additionalProperties, false)
    assert.deepEqual(authSchema.required, AI_CHART_D1_P1_PREVIEW_AUTHORIZATION_FIELDS)
    assert.deepEqual(
      Object.keys(authSchema.properties as Record<string, unknown>),
      AI_CHART_D1_P1_PREVIEW_AUTHORIZATION_FIELDS,
    )
  })
  check('Internal Schemas do not use uniqueItems', () => {
    assert.doesNotMatch(JSON.stringify([planSchema, authSchema]), /uniqueItems/u)
  })
  check('Internal Schemas exclude raw request and private fields', () => {
    const keys = collectKeys([planSchema, authSchema])
    for (const forbidden of [
      'instructions', 'userInput', 'schema', 'apiKey', 'headers',
      'requestBody', 'response', 'usage',
    ]) {
      assert.equal(keys.has(forbidden), false)
    }
  })

  check('Authorization has exactly the locked fields', () => {
    assert.deepEqual(
      Object.keys(authorization),
      AI_CHART_D1_P1_PREVIEW_AUTHORIZATION_FIELDS,
    )
  })
  check('Authorization binds the exact Plan fingerprint', () => {
    assert.equal(authorization.planFingerprint, plan.planFingerprint)
  })
  check('Authorization binds the exact target palace', () => {
    assert.equal(authorization.targetPalaceId, plan.targetPalaceId)
  })
  check('Authorization parser returns a frozen value', () => {
    assert.equal(
      Object.isFrozen(parseAiChartD1P1PreviewAuthorization(authorization, plan)),
      true,
    )
  })
  check('Authorization excludes key, Prompt, timestamp and expiry', () => {
    const keys = collectKeys(authorization)
    for (const forbidden of ['apiKey', 'prompt', 'timestamp', 'expiresAt', 'token']) {
      assert.equal(keys.has(forbidden), false)
    }
  })
  check('Boolean acknowledgement is rejected', () => {
    assertInvalid(() => parseAiChartD1P1PreviewAuthorization({ ...authorization, acknowledgement: true }, plan))
  })
  check('Authorization extra field is rejected', () => {
    assertInvalid(() => parseAiChartD1P1PreviewAuthorization({ ...authorization, expiry: 1 }, plan))
  })
  check('Authorization wrong Plan fingerprint is rejected', () => {
    assertInvalid(() => parseAiChartD1P1PreviewAuthorization({ ...authorization, planFingerprint: 'f'.repeat(64) }, plan))
  })
  check('Default timeout Authorization is rejected for Local Preview Plan', () => {
    assertInvalid(() =>
      parseAiChartD1P1PreviewAuthorization(authorization, localPreviewPlan),
    )
  })
  check('Authorization wrong target palace is rejected', () => {
    assertInvalid(() => parseAiChartD1P1PreviewAuthorization({ ...authorization, targetPalaceId: 'palace:siblings' }, plan))
  })
  check('Authorization accessor is rejected without execution', () => {
    const supplied = structuredClone(authorization) as Record<string, unknown>
    let getterCalls = 0
    Object.defineProperty(supplied, 'acknowledgement', {
      enumerable: true,
      get() {
        getterCalls += 1
        return AI_CHART_D1_P1_PREVIEW_AUTHORIZATION_ACKNOWLEDGEMENT
      },
    })
    assertInvalid(() => parseAiChartD1P1PreviewAuthorization(supplied, plan))
    assert.equal(getterCalls, 0)
  })

  console.log(`\n${checks} D1 P1 Preview Gate Contract checks passed.`)
}

run()
