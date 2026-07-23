import assert from 'node:assert/strict'
import {
  buildAiChartD1P1AdapterBridges,
  buildAiChartD1P1LocalPreviewAdapterBridges,
  parseAiChartD1P1AdapterBridgeDescriptor,
} from './d1P1AdapterBridge'
import {
  AI_CHART_D1_P1_ADAPTER_BRIDGE_CONTRACT_VERSION,
  AI_CHART_D1_P1_ADAPTER_BRIDGE_DESCRIPTION,
  AI_CHART_D1_P1_ADAPTER_BRIDGE_FIELDS,
  AI_CHART_D1_P1_ADAPTER_BRIDGE_INTERNAL_JSON_SCHEMA,
  AI_CHART_D1_P1_ADAPTER_BRIDGE_INVALID,
  AI_CHART_D1_P1_ADAPTER_BRIDGE_NOT_READY,
  AI_CHART_D1_P1_ADAPTER_BRIDGE_RESULT_INVALID,
  AI_CHART_D1_P1_ADAPTER_BRIDGE_SCHEMA_NAME,
  AI_CHART_D1_P1_ADAPTER_BRIDGE_TASK,
  AI_CHART_D1_P1_MAX_OUTPUT_TOKENS,
  AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS,
  AiChartD1P1AdapterBridgeError,
  AiChartD1P1AdapterBridgeNotReadyError,
  AiChartD1P1AdapterBridgeResultInvalidError,
  createAiChartD1P1AdapterBridgeFingerprint,
  parseAiChartD1P1AdapterBridgeDescriptorShape,
  stableAiChartD1P1AdapterBridgeDescriptorEqual,
  type AiChartD1P1SourceBoundValidationReasonCode,
  type AiChartD1P1AdapterBridgeDescriptor,
  type AiChartD1P1AdapterBridgeDescriptorWithoutFingerprint,
} from './d1P1AdapterBridgeContracts'
import { AI_CHART_D1_P1_F1_CONTRACT_VERSION } from './d1CommonContracts'
import {
  AI_CHART_D1_P1_OUTPUT_SCHEMA_SHA256,
  AI_CHART_D1_P1_PROMPT_INSTRUCTIONS_SHA256,
  AI_CHART_D1_P1_PROMPT_PACKAGE_CONTRACT_VERSION,
  AI_CHART_D1_P1_PROMPT_VERSION,
} from './d1P1PromptPackageContracts'
import { AI_CHART_D1_P1_SCHEMA_NAME } from './d1P1F1Contracts'
import {
  AI_CHART_D1_P1_LOCAL_PREVIEW_TIMEOUT_MS,
  AI_CHART_D1_P1_PREVIEW_TIMEOUT_VALUES,
} from './d1P1PreviewTimeoutContracts'
import {
  AI_CHART_OPENAI_DEFAULT_MAX_OUTPUT_TOKENS,
  AI_CHART_OPENAI_MAX_OUTPUT_TOKENS,
  AI_CHART_OPENAI_DEFAULT_REASONING_EFFORT,
  AI_CHART_OPENAI_DEFAULT_TIMEOUT_MS,
} from './openAiResponses'
import {
  createAdapterBridgeFixture,
  recalculateAdapterBridgeDescriptorFingerprint,
  type Mutable,
} from './d1P1AdapterBridgeTestSupport'

let checks = 0

function check(name: string, run: () => void) {
  run()
  checks += 1
  console.log(`✓ ${name}`)
}

function assertInvalid(run: () => unknown): void {
  assert.throws(run, { message: AI_CHART_D1_P1_ADAPTER_BRIDGE_INVALID })
}

function cloneDescriptor(
  value: AiChartD1P1AdapterBridgeDescriptor,
): Mutable<AiChartD1P1AdapterBridgeDescriptor> {
  return structuredClone(value) as Mutable<AiChartD1P1AdapterBridgeDescriptor>
}

function fingerprintPayload(
  value: AiChartD1P1AdapterBridgeDescriptor,
): AiChartD1P1AdapterBridgeDescriptorWithoutFingerprint {
  const payload = structuredClone(value) as unknown as Record<string, unknown>
  delete payload.bridgeFingerprint
  return payload as AiChartD1P1AdapterBridgeDescriptorWithoutFingerprint
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

async function run() {
  const fixture = await createAdapterBridgeFixture('bridge-contract')
  const descriptor = fixture.bridges[0].descriptor
  const localPreviewDescriptor = buildAiChartD1P1LocalPreviewAdapterBridges(
    fixture.catalog,
    fixture.structuralInputs,
    fixture.bundles,
    fixture.modelInputs,
    fixture.promptPackages,
  )[0].descriptor
  const secondDescriptor = fixture.bridges[1].descriptor
  const schema = AI_CHART_D1_P1_ADAPTER_BRIDGE_INTERNAL_JSON_SCHEMA as Record<
    string,
    unknown
  >
  const properties = schema.properties as Record<string, Record<string, unknown>>

  check('Bridge contract version is locked', () => {
    assert.equal(
      AI_CHART_D1_P1_ADAPTER_BRIDGE_CONTRACT_VERSION,
      'ai-chart-d1-p1-adapter-bridge/v1',
    )
  })
  check('Bridge schema name is locked', () => {
    assert.equal(
      AI_CHART_D1_P1_ADAPTER_BRIDGE_SCHEMA_NAME,
      'ai_chart_d1_p1_adapter_bridge_v1',
    )
  })
  check('Bridge task is locked', () => {
    assert.equal(AI_CHART_D1_P1_ADAPTER_BRIDGE_TASK, 'D1_P1_ADAPTER_BRIDGE')
  })
  check('Bridge description is locked', () => {
    assert.equal(
      AI_CHART_D1_P1_ADAPTER_BRIDGE_DESCRIPTION,
      'D1 P1 單宮本命人格結構化推理結果',
    )
  })
  check('invalid error code is locked', () => {
    assert.equal(
      AI_CHART_D1_P1_ADAPTER_BRIDGE_INVALID,
      'ai_chart_d1_p1_adapter_bridge_invalid',
    )
  })
  check('not-ready error code is locked', () => {
    assert.equal(
      AI_CHART_D1_P1_ADAPTER_BRIDGE_NOT_READY,
      'ai_chart_d1_p1_adapter_bridge_not_ready',
    )
  })
  check('result-invalid error code is locked', () => {
    assert.equal(
      AI_CHART_D1_P1_ADAPTER_BRIDGE_RESULT_INVALID,
      'ai_chart_d1_p1_adapter_bridge_result_invalid',
    )
  })
  check('three Bridge errors remain distinguishable', () => {
    assert.equal(
      new Set([
        AI_CHART_D1_P1_ADAPTER_BRIDGE_INVALID,
        AI_CHART_D1_P1_ADAPTER_BRIDGE_NOT_READY,
        AI_CHART_D1_P1_ADAPTER_BRIDGE_RESULT_INVALID,
      ]).size,
      3,
    )
  })
  check('Bridge error class exposes only the safe code', () => {
    const error = new AiChartD1P1AdapterBridgeError()
    assert.equal(error.name, 'AiChartD1P1AdapterBridgeError')
    assert.equal(error.message, AI_CHART_D1_P1_ADAPTER_BRIDGE_INVALID)
    assert.equal(error.code, AI_CHART_D1_P1_ADAPTER_BRIDGE_INVALID)
  })
  check('not-ready class exposes only the safe code', () => {
    const error = new AiChartD1P1AdapterBridgeNotReadyError()
    assert.equal(error.name, 'AiChartD1P1AdapterBridgeNotReadyError')
    assert.equal(error.message, AI_CHART_D1_P1_ADAPTER_BRIDGE_NOT_READY)
  })
  check('result-invalid class exposes only the safe code', () => {
    const error = new AiChartD1P1AdapterBridgeResultInvalidError(
      AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.RESULT_SHAPE_INVALID,
    )
    assert.equal(error.name, 'AiChartD1P1AdapterBridgeResultInvalidError')
    assert.equal(error.message, AI_CHART_D1_P1_ADAPTER_BRIDGE_RESULT_INVALID)
    assert.equal(error.code, AI_CHART_D1_P1_ADAPTER_BRIDGE_RESULT_INVALID)
    assert.equal(
      error.reasonCode,
      AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.RESULT_SHAPE_INVALID,
    )
    assert.equal(Object.isFrozen(error), true)
    assert.equal(
      Object.getOwnPropertyDescriptor(error, 'reasonCode')?.writable,
      false,
    )
    assert.equal(
      Object.getOwnPropertyDescriptor(error, 'reasonCode')?.configurable,
      false,
    )
  })
  check('source-bound validation reasons are a closed frozen allowlist', () => {
    assert.equal(
      Object.isFrozen(AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS),
      true,
    )
    assert.deepEqual(
      Object.values(AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS),
      [
        'RESULT_SHAPE_INVALID',
        'IDENTITY_OR_STATUS_MISMATCH',
        'BORROWED_STAR_BINDING_MISMATCH',
        'PRIMARY_AXIS_MAJOR_STAR_BINDING_MISMATCH',
        'PRIMARY_AXIS_RULE_BINDING_MISMATCH',
        'PRIMARY_AXIS_DOUBLE_STAR_BINDING_MISMATCH',
        'PRIMARY_AXIS_FORBIDDEN_METADATA',
        'CANDIDATE_SOURCE_BINDING_MISMATCH',
        'CANDIDATE_RULE_AUTHORITY_MISMATCH',
        'RULE_PALACE_STAR_BINDING_MISMATCH',
        'COVERAGE_BINDING_MISMATCH',
        'COVERAGE_DIRECT_MEANINGS_MISMATCH',
        'COVERAGE_MAJOR_STARS_MISMATCH',
        'COVERAGE_MINOR_STARS_MISMATCH',
        'COVERAGE_MUTAGENS_MISMATCH',
        'COVERAGE_MALEFICS_MISMATCH',
        'COVERAGE_NOBLES_MISMATCH',
        'COVERAGE_PROCESSING_FLAGS_MISMATCH',
        'COVERAGE_STATUS_OMISSIONS_MISMATCH',
        'OTHER_SOURCE_BOUND_BINDING_MISMATCH',
      ],
    )
  })
  for (const reasonCode of [
    AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_DIRECT_MEANINGS_MISMATCH,
    AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_MAJOR_STARS_MISMATCH,
    AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_MINOR_STARS_MISMATCH,
    AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_MUTAGENS_MISMATCH,
    AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_MALEFICS_MISMATCH,
    AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_NOBLES_MISMATCH,
    AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_PROCESSING_FLAGS_MISMATCH,
    AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_STATUS_OMISSIONS_MISMATCH,
  ] as const) {
    check(`${reasonCode} error metadata is fixed and immutable`, () => {
      const error = new AiChartD1P1AdapterBridgeResultInvalidError(reasonCode)
      const descriptor = Object.getOwnPropertyDescriptor(error, 'reasonCode')
      assert.equal(error.message, AI_CHART_D1_P1_ADAPTER_BRIDGE_RESULT_INVALID)
      assert.equal(error.reasonCode, reasonCode)
      assert.equal(Object.isFrozen(error), true)
      assert.equal(descriptor?.writable, false)
      assert.equal(descriptor?.configurable, false)
    })
  }
  check('result-invalid class rejects an injected reason value', () => {
    const sensitiveValue = 'synthetic-model-value-must-not-be-saved'
    assert.throws(
      () =>
        new AiChartD1P1AdapterBridgeResultInvalidError(
          sensitiveValue as AiChartD1P1SourceBoundValidationReasonCode,
        ),
      { message: AI_CHART_D1_P1_ADAPTER_BRIDGE_RESULT_INVALID },
    )
  })

  check('Descriptor has exactly the locked fields', () => {
    assert.deepEqual(Object.keys(descriptor), AI_CHART_D1_P1_ADAPTER_BRIDGE_FIELDS)
  })
  check('Descriptor contract reference is exact', () => {
    assert.equal(
      descriptor.contractVersion,
      AI_CHART_D1_P1_ADAPTER_BRIDGE_CONTRACT_VERSION,
    )
  })
  check('Descriptor task reference is exact', () => {
    assert.equal(descriptor.task, AI_CHART_D1_P1_ADAPTER_BRIDGE_TASK)
  })
  check('Prompt Package contract reference is exact', () => {
    assert.equal(
      descriptor.promptPackageContractVersion,
      AI_CHART_D1_P1_PROMPT_PACKAGE_CONTRACT_VERSION,
    )
  })
  check('Prompt version reference is exact', () => {
    assert.equal(descriptor.promptVersion, AI_CHART_D1_P1_PROMPT_VERSION)
  })
  check('Output contract reference is exact', () => {
    assert.equal(
      descriptor.outputContractVersion,
      AI_CHART_D1_P1_F1_CONTRACT_VERSION,
    )
  })
  check('Output schema name reference is exact', () => {
    assert.equal(descriptor.outputSchemaName, AI_CHART_D1_P1_SCHEMA_NAME)
  })
  check('Output schema SHA reference is exact', () => {
    assert.equal(
      descriptor.outputSchemaSha256,
      AI_CHART_D1_P1_OUTPUT_SCHEMA_SHA256,
    )
  })
  check('Instructions SHA reference is exact', () => {
    assert.equal(
      descriptor.instructionsSha256,
      AI_CHART_D1_P1_PROMPT_INSTRUCTIONS_SHA256,
    )
  })
  check('Descriptor description is exact', () => {
    assert.equal(
      descriptor.description,
      AI_CHART_D1_P1_ADAPTER_BRIDGE_DESCRIPTION,
    )
  })
  check('Descriptor reasoning uses the Adapter default', () => {
    assert.equal(
      descriptor.reasoningEffort,
      AI_CHART_OPENAI_DEFAULT_REASONING_EFFORT,
    )
  })
  check('Descriptor timeout uses the Adapter default', () => {
    assert.equal(descriptor.timeoutMs, AI_CHART_OPENAI_DEFAULT_TIMEOUT_MS)
  })
  check('Local Preview Descriptor uses the explicit 300 second timeout', () => {
    assert.equal(
      localPreviewDescriptor.timeoutMs,
      AI_CHART_D1_P1_LOCAL_PREVIEW_TIMEOUT_MS,
    )
    assert.equal(
      parseAiChartD1P1AdapterBridgeDescriptorShape(localPreviewDescriptor)
        .timeoutMs,
      AI_CHART_D1_P1_LOCAL_PREVIEW_TIMEOUT_MS,
    )
  })
  check('Local Preview timeout changes the Bridge fingerprint', () => {
    assert.notEqual(
      localPreviewDescriptor.bridgeFingerprint,
      descriptor.bridgeFingerprint,
    )
    const defaultPayload = fingerprintPayload(descriptor)
    const localPayload = fingerprintPayload(localPreviewDescriptor)
    assert.deepEqual(
      { ...localPayload, timeoutMs: defaultPayload.timeoutMs },
      defaultPayload,
    )
  })
  check('D1 P1 output budget is dedicated and within the generic range', () => {
    assert.equal(AI_CHART_D1_P1_MAX_OUTPUT_TOKENS, 16_384)
    assert.equal(AI_CHART_OPENAI_DEFAULT_MAX_OUTPUT_TOKENS, 8_192)
    assert.equal(AI_CHART_OPENAI_MAX_OUTPUT_TOKENS, 32_768)
  })
  check('Descriptor output budget uses the D1 P1 policy', () => {
    assert.equal(
      descriptor.maxOutputTokens,
      AI_CHART_D1_P1_MAX_OUTPUT_TOKENS,
    )
  })
  check('D1 P1 output budget participates in the Bridge fingerprint', () => {
    const currentPayload = fingerprintPayload(descriptor)
    const legacyPayload = {
      ...currentPayload,
      maxOutputTokens: AI_CHART_OPENAI_DEFAULT_MAX_OUTPUT_TOKENS,
    } as unknown as AiChartD1P1AdapterBridgeDescriptorWithoutFingerprint
    assert.equal(
      createAiChartD1P1AdapterBridgeFingerprint(currentPayload),
      descriptor.bridgeFingerprint,
    )
    assert.notEqual(
      createAiChartD1P1AdapterBridgeFingerprint(legacyPayload),
      descriptor.bridgeFingerprint,
    )
  })
  check('Descriptor request status is ready', () => {
    assert.equal(descriptor.requestStatus, 'ready')
  })
  check('Descriptor runtime status remains unwired', () => {
    assert.equal(descriptor.runtimeStatus, 'runtime_wiring_required')
  })
  check('Descriptor is not OpenAI-callable', () => {
    assert.equal(descriptor.openAiCallable, false)
  })
  check('Descriptor package fingerprint is source exact', () => {
    assert.equal(
      descriptor.packageFingerprint,
      fixture.promptPackages[0].packageFingerprint,
    )
  })
  check('Descriptor Model Input fingerprint is source exact', () => {
    assert.equal(
      descriptor.modelInputFingerprint,
      fixture.modelInputs[0].inputFingerprint,
    )
  })
  check('Descriptor userInput SHA is source exact', () => {
    assert.equal(
      descriptor.userInputSha256,
      fixture.promptPackages[0].userInputSha256,
    )
  })
  check('Descriptor excludes raw instructions', () => {
    assert.equal(Object.hasOwn(descriptor, 'instructions'), false)
  })
  check('Descriptor excludes raw userInput', () => {
    assert.equal(Object.hasOwn(descriptor, 'userInput'), false)
  })
  check('Descriptor excludes the P1 Schema object', () => {
    assert.equal(Object.hasOwn(descriptor, 'schema'), false)
  })
  check('Descriptor contains no function', () => {
    assert.equal(
      Object.values(descriptor).some((value) => typeof value === 'function'),
      false,
    )
  })
  check('Descriptor contains no model or API configuration', () => {
    for (const key of ['model', 'apiUrl', 'apiKey', 'headers', 'requestBody']) {
      assert.equal(Object.hasOwn(descriptor, key), false)
    }
  })

  check('Bridge fingerprint covers all Descriptor fields except itself', () => {
    assert.equal(
      descriptor.bridgeFingerprint,
      createAiChartD1P1AdapterBridgeFingerprint(
        fingerprintPayload(descriptor),
      ),
    )
  })
  check('Bridge fingerprint is deterministic for the same sources', () => {
    const rebuilt = buildAiChartD1P1AdapterBridges(
      fixture.catalog,
      fixture.structuralInputs,
      fixture.bundles,
      fixture.modelInputs,
      fixture.promptPackages,
    )
    assert.equal(
      rebuilt[0].descriptor.bridgeFingerprint,
      descriptor.bridgeFingerprint,
    )
  })
  check('different palaces have different package fingerprints', () => {
    assert.notEqual(
      descriptor.packageFingerprint,
      secondDescriptor.packageFingerprint,
    )
  })
  check('different palaces have different Model Input fingerprints', () => {
    assert.notEqual(
      descriptor.modelInputFingerprint,
      secondDescriptor.modelInputFingerprint,
    )
  })
  check('different palaces have different Bridge fingerprints', () => {
    assert.notEqual(
      descriptor.bridgeFingerprint,
      secondDescriptor.bridgeFingerprint,
    )
  })
  check('canonical fingerprint ignores object key insertion order', () => {
    const payload = fingerprintPayload(descriptor)
    const reversed = Object.fromEntries(
      Object.entries(payload).reverse(),
    ) as AiChartD1P1AdapterBridgeDescriptorWithoutFingerprint
    assert.equal(
      createAiChartD1P1AdapterBridgeFingerprint(reversed),
      descriptor.bridgeFingerprint,
    )
  })
  check('stable Descriptor equality ignores object key insertion order', () => {
    const reversed = Object.fromEntries(Object.entries(descriptor).reverse())
    assert.equal(
      stableAiChartD1P1AdapterBridgeDescriptorEqual(descriptor, reversed),
      true,
    )
  })

  const parseDescriptor = (value: unknown) =>
    parseAiChartD1P1AdapterBridgeDescriptor(
      value,
      fixture.catalog,
      fixture.structuralInputs[0],
      fixture.bundles[0],
      fixture.modelInputs[0],
      fixture.promptPackages[0],
    )

  check('strict shape parser accepts the valid Descriptor', () => {
    assert.deepEqual(
      parseAiChartD1P1AdapterBridgeDescriptorShape(descriptor),
      descriptor,
    )
  })
  check('source-aware parser accepts the exact Descriptor', () => {
    assert.deepEqual(parseDescriptor(descriptor), descriptor)
  })
  check('strict shape parser rejects the legacy 8192 Descriptor', () => {
    const legacyDescriptor = cloneDescriptor(descriptor) as unknown as Record<
      string,
      unknown
    >
    legacyDescriptor.maxOutputTokens =
      AI_CHART_OPENAI_DEFAULT_MAX_OUTPUT_TOKENS
    assertInvalid(() =>
      parseAiChartD1P1AdapterBridgeDescriptorShape(legacyDescriptor),
    )
  })
  check('source-aware parser rejects another palace Descriptor', () => {
    assertInvalid(() => parseDescriptor(secondDescriptor))
  })
  check('unknown Descriptor field is rejected', () => {
    assertInvalid(() => parseDescriptor({ ...descriptor, extra: true }))
  })
  check('missing Descriptor field is rejected', () => {
    const value = structuredClone(descriptor) as unknown as Record<string, unknown>
    delete value.description
    assertInvalid(() => parseDescriptor(value))
  })
  check('symbol Descriptor key is rejected', () => {
    const value = { ...descriptor } as Record<PropertyKey, unknown>
    value[Symbol('hidden')] = true
    assertInvalid(() => parseDescriptor(value))
  })
  check('cyclic Descriptor is rejected', () => {
    const value = { ...descriptor } as Record<string, unknown>
    value.extra = value
    assertInvalid(() => parseDescriptor(value))
  })
  check('Descriptor accessor is rejected without execution', () => {
    let executions = 0
    const value = { ...descriptor }
    Object.defineProperty(value, 'chartId', {
      enumerable: true,
      get() {
        executions += 1
        return descriptor.chartId
      },
    })
    assertInvalid(() => parseDescriptor(value))
    assert.equal(executions, 0)
  })
  check('wrong Bridge fingerprint is rejected', () => {
    const value = cloneDescriptor(descriptor)
    value.bridgeFingerprint = '0'.repeat(64)
    assertInvalid(() => parseDescriptor(value))
  })
  check('malformed Bridge fingerprint is rejected', () => {
    const value = cloneDescriptor(descriptor) as unknown as Record<string, unknown>
    value.bridgeFingerprint = 'not-a-sha'
    assertInvalid(() => parseDescriptor(value))
  })
  check('wrong package fingerprint is source-rejected after recomputation', () => {
    const value = cloneDescriptor(descriptor)
    value.packageFingerprint = '1'.repeat(64)
    recalculateAdapterBridgeDescriptorFingerprint(value)
    assertInvalid(() => parseDescriptor(value))
  })
  check('wrong Model Input fingerprint is source-rejected after recomputation', () => {
    const value = cloneDescriptor(descriptor)
    value.modelInputFingerprint = '2'.repeat(64)
    recalculateAdapterBridgeDescriptorFingerprint(value)
    assertInvalid(() => parseDescriptor(value))
  })
  check('wrong userInput SHA is source-rejected after recomputation', () => {
    const value = cloneDescriptor(descriptor)
    value.userInputSha256 = '3'.repeat(64)
    recalculateAdapterBridgeDescriptorFingerprint(value)
    assertInvalid(() => parseDescriptor(value))
  })
  check('wrong chart identity is source-rejected after recomputation', () => {
    const value = cloneDescriptor(descriptor)
    value.chartId = 'chart:other'
    recalculateAdapterBridgeDescriptorFingerprint(value)
    assertInvalid(() => parseDescriptor(value))
  })
  check('wrong run identity is source-rejected after recomputation', () => {
    const value = cloneDescriptor(descriptor)
    value.runId = 'run:other'
    recalculateAdapterBridgeDescriptorFingerprint(value)
    assertInvalid(() => parseDescriptor(value))
  })
  check('wrong call identity is source-rejected after recomputation', () => {
    const value = cloneDescriptor(descriptor)
    value.callId = 'call:other'
    recalculateAdapterBridgeDescriptorFingerprint(value)
    assertInvalid(() => parseDescriptor(value))
  })
  check('wrong target palace is source-rejected after recomputation', () => {
    const value = cloneDescriptor(descriptor)
    value.targetPalaceId = 'palace:career'
    recalculateAdapterBridgeDescriptorFingerprint(value)
    assertInvalid(() => parseDescriptor(value))
  })

  for (const [name, key, wrong] of [
    ['contract version', 'contractVersion', 'bridge/v2'],
    ['task', 'task', 'OTHER_TASK'],
    ['Prompt Package contract version', 'promptPackageContractVersion', 'package/v2'],
    ['Prompt version', 'promptVersion', 'prompt/v2'],
    ['Output contract version', 'outputContractVersion', 'output/v2'],
    ['Output Schema name', 'outputSchemaName', 'other_schema'],
    ['Output Schema SHA', 'outputSchemaSha256', '4'.repeat(64)],
    ['Instructions SHA', 'instructionsSha256', '5'.repeat(64)],
    ['description', 'description', 'other description'],
    ['reasoning default', 'reasoningEffort', 'high'],
    ['timeout default', 'timeoutMs', 1_000],
    ['token default', 'maxOutputTokens', 256],
    ['request status', 'requestStatus', 'pending'],
    ['runtime status', 'runtimeStatus', 'ready'],
    ['OpenAI callable flag', 'openAiCallable', true],
  ] as const) {
    check(`wrong ${name} is rejected`, () => {
      const value = cloneDescriptor(descriptor) as unknown as Record<string, unknown>
      value[key] = wrong
      assertInvalid(() => parseDescriptor(value))
    })
  }

  check('parsed Descriptor is recursively frozen', () => {
    const parsed = parseDescriptor(descriptor)
    assert.equal(Object.isFrozen(parsed), true)
  })
  check('caller mutation cannot change a parsed Descriptor', () => {
    const value = cloneDescriptor(descriptor)
    const parsed = parseDescriptor(value)
    value.chartId = 'chart:mutated'
    assert.equal(parsed.chartId, descriptor.chartId)
  })

  check('internal Schema is a strict object', () => {
    assert.equal(schema.type, 'object')
    assert.equal(schema.additionalProperties, false)
  })
  check('internal Schema required and properties are exact', () => {
    assert.deepEqual(schema.required, Object.keys(properties))
    assert.deepEqual(Object.keys(properties), AI_CHART_D1_P1_ADAPTER_BRIDGE_FIELDS)
  })
  check('internal Schema locks the Contract version', () => {
    assert.equal(
      properties.contractVersion.const,
      AI_CHART_D1_P1_ADAPTER_BRIDGE_CONTRACT_VERSION,
    )
  })
  check('internal Schema locks the task', () => {
    assert.equal(properties.task.const, AI_CHART_D1_P1_ADAPTER_BRIDGE_TASK)
  })
  check('internal Schema locks the Adapter defaults', () => {
    assert.equal(
      properties.reasoningEffort.const,
      AI_CHART_OPENAI_DEFAULT_REASONING_EFFORT,
    )
    assert.deepEqual(
      properties.timeoutMs.enum,
      AI_CHART_D1_P1_PREVIEW_TIMEOUT_VALUES,
    )
    assert.equal(
      properties.maxOutputTokens.const,
      AI_CHART_D1_P1_MAX_OUTPUT_TOKENS,
    )
  })
  check('internal Schema has no uniqueItems keyword', () => {
    assert.equal(collectKeys(schema).has('uniqueItems'), false)
  })
  check('internal Schema contains no function field', () => {
    assert.equal(collectKeys(schema).has('parseResult'), false)
  })
  check('internal Schema contains no raw prompt fields', () => {
    const keys = collectKeys(schema)
    assert.equal(keys.has('instructions'), false)
    assert.equal(keys.has('userInput'), false)
  })
  check('internal Schema contains no request body fields', () => {
    const keys = collectKeys(schema)
    for (const key of ['model', 'headers', 'input', 'text', 'store', 'stream']) {
      assert.equal(keys.has(key), false)
    }
  })
  check('internal Schema contains no response or usage fields', () => {
    const keys = collectKeys(schema)
    assert.equal(keys.has('response'), false)
    assert.equal(keys.has('usage'), false)
  })

  console.log(`\n${checks} D1 P1 Adapter Bridge Contract checks passed.`)
}

void run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
