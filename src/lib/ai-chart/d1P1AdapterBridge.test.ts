import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { AI_CHART_D1_MODEL_TARGET } from './d1Assets'
import {
  assertAiChartD1P1CandidateRuleAuthority,
  buildAiChartD1P1AdapterBridge,
  buildAiChartD1P1AdapterBridges,
  deriveAiChartD1P1CandidateRuleStatus,
  parseAiChartD1P1AdapterBridgeDescriptor,
  type AiChartD1P1AdapterBridge,
} from './d1P1AdapterBridge'
import {
  AI_CHART_D1_P1_ADAPTER_BRIDGE_DESCRIPTION,
  AI_CHART_D1_P1_ADAPTER_BRIDGE_INVALID,
  AI_CHART_D1_P1_ADAPTER_BRIDGE_NOT_READY,
  AI_CHART_D1_P1_ADAPTER_BRIDGE_RESULT_INVALID,
} from './d1P1AdapterBridgeContracts'
import {
  createAdapterBridgeFixture,
  createValidAiChartD1P1Candidate,
  createValidAiChartD1P1Result,
  type AdapterBridgeFixture,
  type Mutable,
} from './d1P1AdapterBridgeTestSupport'
import type { AiChartD1StructureBasis } from './d1CommonContracts'
import { buildAiChartD1K0P1KnowledgeBundles } from './d1K0Selection'
import {
  AI_CHART_D1_MAJOR_STAR_NAMES,
  AI_CHART_D1_MODELED_SUPPORTING_STARS,
  AI_CHART_D1_PALACE_IDENTITIES,
} from './d1N0Constants'
import {
  buildAiChartD1P1PromptPackages,
} from './d1P1PromptPackageBuilder'
import {
  AI_CHART_D1_P1_OUTPUT_SCHEMA_SHA256,
  AI_CHART_D1_P1_PROMPT_INSTRUCTIONS_SHA256,
  createAiChartD1P1CanonicalJson,
  type AiChartD1P1PromptPackage,
} from './d1P1PromptPackageContracts'
import {
  bundleIds,
  completeModelInputSnapshot,
  createModelInputFixture,
  createStructuralInputs,
  recalculateModelInputFingerprint,
  type MutableRecord,
} from './d1P1ModelInputTestSupport'
import {
  recalculatePromptPackageFingerprint,
  recalculatePromptPackageTextBindings,
} from './d1P1PromptPackageTestSupport'
import {
  AI_CHART_D1_P1_OUTPUT_SCHEMA,
  AI_CHART_D1_P1_SCHEMA_NAME,
  type AiChartD1P1Result,
} from './d1P1F1Contracts'
import {
  AI_CHART_OPENAI_DEFAULT_MAX_OUTPUT_TOKENS,
  AI_CHART_OPENAI_DEFAULT_REASONING_EFFORT,
  AI_CHART_OPENAI_DEFAULT_TIMEOUT_MS,
  buildAiChartOpenAiResponsesBody,
} from './openAiResponses'

const CANDIDATE_FIELDS = [
  'directCandidates',
  'oppositeInfluences',
  'hiddenCombinationInfluences',
  'trineInfluences',
  'combinedCandidates',
  'strengths',
  'imbalancePossibilities',
] as const

let checks = 0

function check(name: string, run: () => void) {
  run()
  checks += 1
  console.log(`✓ ${name}`)
}

function assertInvalid(run: () => unknown): void {
  assert.throws(run, { message: AI_CHART_D1_P1_ADAPTER_BRIDGE_INVALID })
}

function assertNotReady(run: () => unknown): void {
  assert.throws(run, { message: AI_CHART_D1_P1_ADAPTER_BRIDGE_NOT_READY })
}

function assertResultInvalid(run: () => unknown): void {
  assert.throws(run, {
    message: AI_CHART_D1_P1_ADAPTER_BRIDGE_RESULT_INVALID,
  })
}

function assertNoFetch(run: () => void): void {
  const originalFetch = globalThis.fetch
  let fetchCount = 0
  globalThis.fetch = (async () => {
    fetchCount += 1
    throw new Error('network_forbidden')
  }) as typeof fetch
  try {
    run()
  } finally {
    globalThis.fetch = originalFetch
  }
  assert.equal(fetchCount, 0)
}

function buildFrom(
  fixture: AdapterBridgeFixture,
  modelInputs: unknown = fixture.modelInputs,
  promptPackages: unknown = fixture.promptPackages,
) {
  return buildAiChartD1P1AdapterBridges(
    fixture.catalog,
    fixture.structuralInputs,
    fixture.bundles,
    modelInputs,
    promptPackages,
  )
}

function parseResult(
  bridge: AiChartD1P1AdapterBridge,
  result: unknown,
) {
  return bridge.request.parseResult(result)
}

function resultWithSingleCandidate(
  modelInput: AdapterBridgeFixture['modelInputs'][number],
  field: (typeof CANDIDATE_FIELDS)[number],
): Mutable<AiChartD1P1Result> {
  const result = createValidAiChartD1P1Result(modelInput)
  const record = result as unknown as Record<string, unknown>
  CANDIDATE_FIELDS.forEach((candidateField) => {
    record[candidateField] = []
  })
  record[field] = [
    createValidAiChartD1P1Candidate(
      modelInput,
      `candidate:${field}`,
      field,
    ),
  ]
  return result
}

function sourceFilesUnder(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? sourceFilesUnder(path) : [path]
  })
}

async function customFixture(identity: string, snapshot: MutableRecord) {
  const modelFixture = await createModelInputFixture(identity, snapshot)
  const promptPackages = buildAiChartD1P1PromptPackages(
    modelFixture.catalog,
    modelFixture.structuralInputs,
    modelFixture.bundles,
    modelFixture.modelInputs,
  )
  const bridges = buildAiChartD1P1AdapterBridges(
    modelFixture.catalog,
    modelFixture.structuralInputs,
    modelFixture.bundles,
    modelFixture.modelInputs,
    promptPackages,
  )
  return { ...modelFixture, promptPackages, bridges }
}

async function run() {
  const fixture = await createAdapterBridgeFixture('bridge-builder')
  const { bridges, modelInputs, promptPackages } = fixture
  const bridge = bridges[0]
  const modelInput = modelInputs[0]

  check('fixed builder creates exactly twelve Runtime Bridges', () => {
    assert.equal(bridges.length, 12)
  })
  check('Runtime Bridge array is frozen', () => {
    assert.equal(Object.isFrozen(bridges), true)
  })
  check('fixed Bridges use canonical palace order', () => {
    assert.deepEqual(
      bridges.map((entry) => entry.descriptor.targetPalaceId),
      AI_CHART_D1_PALACE_IDENTITIES.map((identity) => identity.palaceId),
    )
  })
  check('Bridge target palace ids are complete and unique', () => {
    assert.equal(
      new Set(bridges.map((entry) => entry.descriptor.targetPalaceId)).size,
      12,
    )
  })
  check('Bridge call ids are unique', () => {
    assert.equal(
      new Set(bridges.map((entry) => entry.descriptor.callId)).size,
      12,
    )
  })
  check('Bridge package fingerprints are unique', () => {
    assert.equal(
      new Set(
        bridges.map((entry) => entry.descriptor.packageFingerprint),
      ).size,
      12,
    )
  })
  check('Bridge Model Input fingerprints are unique', () => {
    assert.equal(
      new Set(
        bridges.map((entry) => entry.descriptor.modelInputFingerprint),
      ).size,
      12,
    )
  })
  check('Bridge fingerprints are unique', () => {
    assert.equal(
      new Set(
        bridges.map((entry) => entry.descriptor.bridgeFingerprint),
      ).size,
      12,
    )
  })
  check('all Bridges share one chart identity', () => {
    assert.equal(
      new Set(bridges.map((entry) => entry.descriptor.chartId)).size,
      1,
    )
  })
  check('all Bridges share one run identity', () => {
    assert.equal(
      new Set(bridges.map((entry) => entry.descriptor.runId)).size,
      1,
    )
  })
  check('Bridge index maps to Package index', () => {
    bridges.forEach((entry, index) => {
      assert.equal(
        entry.descriptor.packageFingerprint,
        promptPackages[index].packageFingerprint,
      )
    })
  })
  check('Bridge index maps to Model Input index', () => {
    bridges.forEach((entry, index) => {
      assert.equal(entry.descriptor.callId, modelInputs[index].callId)
      assert.equal(
        entry.descriptor.modelInputFingerprint,
        modelInputs[index].inputFingerprint,
      )
    })
  })
  check('all request configurations are identical', () => {
    assert.equal(
      new Set(
        bridges.map(
          (entry) =>
            `${entry.request.reasoningEffort}:${entry.request.timeoutMs}:${entry.request.maxOutputTokens}`,
        ),
      ).size,
      1,
    )
  })
  check('all requests share the formal P1 schema name', () => {
    assert.deepEqual(
      [...new Set(bridges.map((entry) => entry.request.schemaName))],
      [AI_CHART_D1_P1_SCHEMA_NAME],
    )
  })
  check('all requests preserve their own authenticated userInput', () => {
    bridges.forEach((entry, index) => {
      assert.equal(entry.request.userInput, promptPackages[index].userInput)
    })
  })

  check('request instructions map exactly from the Prompt Package', () => {
    assert.equal(bridge.request.instructions, promptPackages[0].instructions)
  })
  check('request userInput maps exactly from the Prompt Package', () => {
    assert.equal(bridge.request.userInput, promptPackages[0].userInput)
  })
  check('request Schema name maps exactly from the Prompt Package', () => {
    assert.equal(bridge.request.schemaName, promptPackages[0].outputSchemaName)
  })
  check('request description is the locked Bridge description', () => {
    assert.equal(
      bridge.request.description,
      AI_CHART_D1_P1_ADAPTER_BRIDGE_DESCRIPTION,
    )
  })
  check('request uses the formal P1 Output Schema', () => {
    assert.deepEqual(bridge.request.schema, AI_CHART_D1_P1_OUTPUT_SCHEMA)
  })
  check('request parser is a function', () => {
    assert.equal(typeof bridge.request.parseResult, 'function')
  })
  check('request reasoning uses the Adapter default', () => {
    assert.equal(
      bridge.request.reasoningEffort,
      AI_CHART_OPENAI_DEFAULT_REASONING_EFFORT,
    )
  })
  check('request timeout uses the Adapter default', () => {
    assert.equal(bridge.request.timeoutMs, AI_CHART_OPENAI_DEFAULT_TIMEOUT_MS)
  })
  check('request token budget uses the Adapter default', () => {
    assert.equal(
      bridge.request.maxOutputTokens,
      AI_CHART_OPENAI_DEFAULT_MAX_OUTPUT_TOKENS,
    )
  })
  check('validated request is frozen', () => {
    assert.equal(Object.isFrozen(bridge.request), true)
  })
  check('validated request Schema is recursively frozen', () => {
    assert.equal(Object.isFrozen(bridge.request.schema), true)
    assert.equal(Object.isFrozen(bridge.request.schema.properties), true)
  })
  check('Runtime Bridge is frozen', () => {
    assert.equal(Object.isFrozen(bridge), true)
  })
  check('Runtime Bridge Descriptor is frozen', () => {
    assert.equal(Object.isFrozen(bridge.descriptor), true)
  })
  check('same authenticated sources rebuild equal Descriptor values', () => {
    const rebuilt = buildFrom(fixture)
    assert.deepEqual(
      rebuilt.map((entry) => entry.descriptor),
      bridges.map((entry) => entry.descriptor),
    )
  })
  check('same authenticated sources rebuild equal request projections', () => {
    const project = (entry: AiChartD1P1AdapterBridge) => ({
      instructions: entry.request.instructions,
      userInput: entry.request.userInput,
      schemaName: entry.request.schemaName,
      description: entry.request.description,
      schema: entry.request.schema,
      reasoningEffort: entry.request.reasoningEffort,
      timeoutMs: entry.request.timeoutMs,
      maxOutputTokens: entry.request.maxOutputTokens,
    })
    assert.deepEqual(buildFrom(fixture).map(project), bridges.map(project))
  })
  check('caller source mutation cannot change an existing Bridge', () => {
    const suppliedPackages = structuredClone(promptPackages) as Mutable<
      AiChartD1P1PromptPackage
    >[]
    const built = buildFrom(fixture, undefined, suppliedPackages)
    ;(suppliedPackages[0] as unknown as Record<string, unknown>).instructions =
      'mutated after build'
    assert.equal(built[0].request.instructions, promptPackages[0].instructions)
  })

  const body = buildAiChartOpenAiResponsesBody(bridge.request)
  check('Responses body model uses the existing target', () => {
    assert.equal(body.model, AI_CHART_D1_MODEL_TARGET)
  })
  check('Responses body disables store', () => {
    assert.equal(body.store, false)
  })
  check('Responses body disables stream', () => {
    assert.equal(body.stream, false)
  })
  check('Responses body disables background', () => {
    assert.equal(body.background, false)
  })
  check('Responses body disables truncation', () => {
    assert.equal(body.truncation, 'disabled')
  })
  check('Responses body reasoning is exact', () => {
    assert.equal(body.reasoning.effort, AI_CHART_OPENAI_DEFAULT_REASONING_EFFORT)
  })
  check('Responses body token budget is exact', () => {
    assert.equal(
      body.max_output_tokens,
      AI_CHART_OPENAI_DEFAULT_MAX_OUTPUT_TOKENS,
    )
  })
  check('Responses body instructions are exact', () => {
    assert.equal(body.instructions, promptPackages[0].instructions)
  })
  check('Responses body contains exactly one user input item', () => {
    assert.equal(body.input.length, 1)
    assert.equal(body.input[0].role, 'user')
  })
  check('Responses body user content is exact', () => {
    assert.equal(body.input[0].content, promptPackages[0].userInput)
  })
  check('Responses format uses json_schema', () => {
    assert.equal(body.text.format.type, 'json_schema')
  })
  check('Responses format name is exact', () => {
    assert.equal(body.text.format.name, AI_CHART_D1_P1_SCHEMA_NAME)
  })
  check('Responses format description is exact', () => {
    assert.equal(
      body.text.format.description,
      AI_CHART_D1_P1_ADAPTER_BRIDGE_DESCRIPTION,
    )
  })
  check('Responses format is strict', () => {
    assert.equal(body.text.format.strict, true)
  })
  check('Responses format uses the formal P1 Schema', () => {
    assert.deepEqual(body.text.format.schema, AI_CHART_D1_P1_OUTPUT_SCHEMA)
  })
  for (const key of [
    'temperature',
    'top_p',
    'tools',
    'tool_choice',
    'previous_response_id',
    'apiKey',
  ]) {
    check(`Responses body excludes ${key}`, () => {
      assert.equal(Object.hasOwn(body, key), false)
    })
  }

  check('individual builder authenticates one exact Prompt Package', () => {
    const individual = buildAiChartD1P1AdapterBridge(
      fixture.catalog,
      fixture.structuralInputs[0],
      fixture.bundles[0],
      fixture.modelInputs[0],
      fixture.promptPackages[0],
    )
    assert.deepEqual(individual.descriptor, bridge.descriptor)
  })
  check('individual builder rejects another palace Package', () => {
    assertInvalid(() =>
      buildAiChartD1P1AdapterBridge(
        fixture.catalog,
        fixture.structuralInputs[0],
        fixture.bundles[0],
        fixture.modelInputs[0],
        fixture.promptPackages[1],
      ),
    )
  })
  check('eleven supplied Prompt Packages are rejected atomically', () => {
    assertInvalid(() => buildFrom(fixture, undefined, promptPackages.slice(0, 11)))
  })
  check('thirteen supplied Prompt Packages are rejected atomically', () => {
    assertInvalid(() =>
      buildFrom(fixture, undefined, [...promptPackages, promptPackages[0]]),
    )
  })
  check('reordered Prompt Packages are rejected', () => {
    assertInvalid(() =>
      buildFrom(fixture, undefined, [promptPackages[1], promptPackages[0], ...promptPackages.slice(2)]),
    )
  })
  check('modified instructions with recomputed hashes are rejected', () => {
    const supplied = structuredClone(promptPackages) as Mutable<
      AiChartD1P1PromptPackage
    >[]
    ;(supplied[0] as unknown as Record<string, unknown>).instructions =
      `${supplied[0].instructions}\nattacker`
    recalculatePromptPackageTextBindings(supplied[0])
    assertInvalid(() => buildFrom(fixture, undefined, supplied))
  })
  check('modified userInput with recomputed hashes is rejected', () => {
    const supplied = structuredClone(promptPackages) as Mutable<
      AiChartD1P1PromptPackage
    >[]
    const input = JSON.parse(supplied[0].userInput) as Record<string, unknown>
    input.chartId = 'chart:attacker'
    supplied[0].userInput = createAiChartD1P1CanonicalJson(input)
    recalculatePromptPackageTextBindings(supplied[0])
    assertInvalid(() => buildFrom(fixture, undefined, supplied))
  })
  check('modified Package sourceTrace is rejected', () => {
    const supplied = structuredClone(promptPackages) as Mutable<
      AiChartD1P1PromptPackage
    >[]
    supplied[0].sourceTrace.ruleIds.reverse()
    recalculatePromptPackageFingerprint(supplied[0])
    assertInvalid(() => buildFrom(fixture, undefined, supplied))
  })
  check('modified Package budget is rejected', () => {
    const supplied = structuredClone(promptPackages) as Mutable<
      AiChartD1P1PromptPackage
    >[]
    supplied[0].budget.totalUtf8Bytes += 1
    recalculatePromptPackageFingerprint(supplied[0])
    assertInvalid(() => buildFrom(fixture, undefined, supplied))
  })
  check('modified Model Input with recomputed fingerprint is rejected', () => {
    const supplied = structuredClone(modelInputs) as Mutable<
      (typeof modelInputs)[number]
    >[]
    supplied[0].chartId = 'chart:attacker'
    recalculateModelInputFingerprint(supplied[0])
    assertInvalid(() => buildFrom(fixture, supplied))
  })
  const otherFixture = await createAdapterBridgeFixture('bridge-other')
  check('mixed chart sources are rejected', () => {
    const supplied = [...promptPackages]
    supplied[0] = otherFixture.promptPackages[0]
    assertInvalid(() => buildFrom(fixture, undefined, supplied))
  })
  check('mixed run Model Input is rejected', () => {
    const supplied = [...modelInputs]
    supplied[0] = otherFixture.modelInputs[0]
    assertInvalid(() => buildFrom(fixture, supplied))
  })
  check('caller cannot override request configuration with an extra argument', () => {
    const invoke = buildAiChartD1P1AdapterBridges as unknown as (
      ...args: unknown[]
    ) => readonly AiChartD1P1AdapterBridge[]
    const built = invoke(
      fixture.catalog,
      fixture.structuralInputs,
      fixture.bundles,
      fixture.modelInputs,
      fixture.promptPackages,
      {
        instructions: 'attacker',
        userInput: 'attacker',
        schema: {},
        parseResult: () => null,
        reasoningEffort: 'high',
        timeoutMs: 1_000,
        maxOutputTokens: 256,
      },
    )
    assert.equal(built[0].request.instructions, promptPackages[0].instructions)
    assert.equal(built[0].request.userInput, promptPackages[0].userInput)
    assert.equal(built[0].request.reasoningEffort, 'medium')
    assert.equal(built[0].request.timeoutMs, 120_000)
    assert.equal(built[0].request.maxOutputTokens, 8_192)
  })

  const validResult = createValidAiChartD1P1Result(modelInput)
  check('valid synthetic P1 Result passes the source-bound parser', () => {
    assert.deepEqual(parseResult(bridge, validResult), validResult)
  })
  check('parsed Result is recursively frozen', () => {
    const parsed = parseResult(bridge, validResult)
    assert.equal(Object.isFrozen(parsed), true)
    assert.equal(Object.isFrozen(parsed.primaryAxis), true)
    assert.equal(Object.isFrozen(parsed.directCandidates), true)
    assert.equal(Object.isFrozen(parsed.directCandidates[0]), true)
    assert.equal(Object.isFrozen(parsed.coverage), true)
  })
  check('caller mutation cannot change a parsed Result', () => {
    const supplied = createValidAiChartD1P1Result(modelInput)
    const parsed = parseResult(bridge, supplied)
    supplied.primaryAxis.statement = 'mutated'
    assert.equal(parsed.primaryAxis.statement, 'synthetic primary axis')
  })

  for (const [name, mutate] of [
    ['contractVersion', (value: Mutable<AiChartD1P1Result>) => {
      ;(value as unknown as Record<string, unknown>).contractVersion = 'output/v2'
    }],
    ['task', (value: Mutable<AiChartD1P1Result>) => {
      ;(value as unknown as Record<string, unknown>).task = 'F1'
    }],
    ['callId', (value: Mutable<AiChartD1P1Result>) => {
      value.callId = 'call:other'
    }],
    ['chartId', (value: Mutable<AiChartD1P1Result>) => {
      value.chartId = 'chart:other'
    }],
    ['palaceId', (value: Mutable<AiChartD1P1Result>) => {
      value.palaceId = modelInputs[1].targetPalaceId
    }],
    ['palace name', (value: Mutable<AiChartD1P1Result>) => {
      value.palace = modelInputs[1].structuralContext.targetPalace.canonicalName
    }],
  ] as const) {
    check(`wrong Result ${name} is rejected`, () => {
      const value = createValidAiChartD1P1Result(modelInput)
      mutate(value)
      assertResultInvalid(() => parseResult(bridge, value))
    })
  }
  check('another palace Result cannot enter this parser', () => {
    const otherResult = createValidAiChartD1P1Result(modelInputs[1])
    assertResultInvalid(() => parseResult(bridge, otherResult))
  })
  check('status invalid is rejected', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.status = 'invalid'
    assertResultInvalid(() => parseResult(bridge, value))
  })
  check('complete Result with omitted items is rejected', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.coverage.omittedItems.push({ item: 'missing', reason: 'missing' })
    assertResultInvalid(() => parseResult(bridge, value))
  })
  for (const field of [
    'oppositeProcessed',
    'hiddenCombinationProcessed',
    'trinesProcessed',
  ] as const) {
    check(`complete Result requires ${field}`, () => {
      const value = createValidAiChartD1P1Result(modelInput)
      value.coverage[field] = false
      assertResultInvalid(() => parseResult(bridge, value))
    })
  }
  check('complete Result with warnings is rejected', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.warnings.push('synthetic warning')
    assertResultInvalid(() => parseResult(bridge, value))
  })
  check('incomplete Result without omissions is rejected', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.status = 'incomplete'
    assertResultInvalid(() => parseResult(bridge, value))
  })
  check('incomplete Result with omissions passes', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.status = 'incomplete'
    value.coverage.omittedItems.push({ item: 'known gap', reason: 'not processed' })
    assert.equal(parseResult(bridge, value).status, 'incomplete')
  })
  check('partial Result without omissions is rejected', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.status = 'partial'
    assertResultInvalid(() => parseResult(bridge, value))
  })
  check('ready input may return partial with explicit omissions', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.status = 'partial'
    value.coverage.omittedItems.push({ item: 'known gap', reason: 'not processed' })
    assert.equal(parseResult(bridge, value).status, 'partial')
  })

  check('complete fixture carries exact authenticated coverage', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    assert.equal(value.coverage.directMeaningsConsidered.length > 0, true)
    assert.equal(value.coverage.majorStarsCovered.length > 0, true)
    assert.equal(value.coverage.minorStarsCovered.length > 0, true)
    assert.doesNotThrow(() => parseResult(bridge, value))
  })
  check('complete coverage is order-insensitive', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.coverage.directMeaningsConsidered.reverse()
    value.coverage.majorStarsCovered.reverse()
    value.coverage.minorStarsCovered.reverse()
    value.coverage.mutagensCovered.reverse()
    value.coverage.maleficsCovered.reverse()
    value.coverage.noblesCovered.reverse()
    assert.doesNotThrow(() => parseResult(bridge, value))
  })
  for (const [name, field] of [
    ['target meanings', 'directMeaningsConsidered'],
    ['target major stars', 'majorStarsCovered'],
    ['target supporting stars', 'minorStarsCovered'],
    ['target natal mutagens', 'mutagensCovered'],
    ['relevant malefic signals', 'maleficsCovered'],
  ] as const) {
    check(`complete Result rejects empty ${name}`, () => {
      const value = createValidAiChartD1P1Result(modelInput)
      assert.equal(value.coverage[field].length > 0, true)
      value.coverage[field] = []
      assertResultInvalid(() => parseResult(bridge, value))
    })
    check(`complete Result rejects one missing ${name} source`, () => {
      const value = createValidAiChartD1P1Result(modelInput)
      assert.equal(value.coverage[field].length > 0, true)
      value.coverage[field] = value.coverage[field].slice(1)
      assertResultInvalid(() => parseResult(bridge, value))
    })
    check(`${name} rejects duplicate entries`, () => {
      const value = createValidAiChartD1P1Result(modelInput)
      const first = value.coverage[field][0]
      assert.ok(first)
      value.coverage[field] = [...value.coverage[field], first]
      assertResultInvalid(() => parseResult(bridge, value))
    })
  }
  const oppositeMeaning = modelInput.knowledgeContext.meanings.find(
    (meaning) => meaning.palaceRole === 'opposite',
  )
  assert.ok(oppositeMeaning)
  check('invented meaningId is rejected from direct coverage', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.coverage.directMeaningsConsidered = ['meaning:invented']
    assertResultInvalid(() => parseResult(bridge, value))
  })
  check('opposite meaningId is rejected from direct coverage', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.coverage.directMeaningsConsidered = [oppositeMeaning.meaningId]
    assertResultInvalid(() => parseResult(bridge, value))
  })
  const otherMajorStar = modelInputs[1].structuralContext.targetPalace
    .canonicalMajorStars[0]
  assert.ok(otherMajorStar)
  check('another palace major star is rejected from coverage', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.coverage.majorStarsCovered = [otherMajorStar.name]
    assertResultInvalid(() => parseResult(bridge, value))
  })
  check('an unseen major star is rejected from coverage', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.coverage.majorStarsCovered = ['紫微']
    assertResultInvalid(() => parseResult(bridge, value))
  })
  const otherSupportingStar = modelInputs[1].structuralContext.targetPalace
    .modeledSupportingStars[0]
  assert.ok(otherSupportingStar)
  check('another palace supporting star is rejected from coverage', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.coverage.minorStarsCovered = [otherSupportingStar.name]
    assertResultInvalid(() => parseResult(bridge, value))
  })
  check('an unseen supporting star is rejected from coverage', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.coverage.minorStarsCovered = ['天刑']
    assertResultInvalid(() => parseResult(bridge, value))
  })
  check('an actual natal-mutagen pair may use descriptive wording', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    const targetStar = modelInput.structuralContext.targetPalace
      .canonicalMajorStars[0]
    assert.ok(targetStar?.natalMutagen)
    value.coverage.mutagensCovered = [
      `已覆蓋 ${targetStar.name} 的 ${targetStar.natalMutagen}`,
    ]
    assert.doesNotThrow(() => parseResult(bridge, value))
  })
  check('a mismatched star and natal-mutagen pair is rejected', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    const targetStar = modelInput.structuralContext.targetPalace
      .canonicalMajorStars[0]
    assert.ok(targetStar)
    value.coverage.mutagensCovered = [`${targetStar.name} 化權`]
    assertResultInvalid(() => parseResult(bridge, value))
  })
  check('another palace natal-mutagen pair is rejected', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    const otherStar = modelInputs[1].structuralContext.targetPalace
      .canonicalMajorStars[0]
    assert.ok(otherStar?.natalMutagen)
    value.coverage.mutagensCovered = [
      `${otherStar.name} ${otherStar.natalMutagen}`,
    ]
    assertResultInvalid(() => parseResult(bridge, value))
  })
  check('valid natal-mutagen wording cannot append another palace pair', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    const targetPair = value.coverage.mutagensCovered[0]
    const otherStar = modelInputs[1].structuralContext.targetPalace
      .canonicalMajorStars[0]
    assert.ok(targetPair)
    assert.ok(otherStar?.natalMutagen)
    value.coverage.mutagensCovered = [
      `${targetPair}；${otherStar.name} ${otherStar.natalMutagen}`,
    ]
    assertResultInvalid(() => parseResult(bridge, value))
  })
  check('two wordings cannot duplicate one natal-mutagen source', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    const pair = value.coverage.mutagensCovered[0]
    assert.ok(pair)
    value.coverage.mutagensCovered = [pair, `已覆蓋 ${pair}`]
    assertResultInvalid(() => parseResult(bridge, value))
  })
  check('actual malefic signal types may use descriptive wording', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.coverage.maleficsCovered = value.coverage.maleficsCovered.map(
      (signalType) => `已覆蓋 ${signalType} 訊號`,
    )
    assert.doesNotThrow(() => parseResult(bridge, value))
  })
  check('an unobserved malefic signal type is rejected', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    const observed = new Set(value.coverage.maleficsCovered)
    const unobserved = ['擎羊', '陀羅', '火星', '鈴星', '生年化忌'].find(
      (type) => !observed.has(type),
    )
    assert.ok(unobserved)
    value.coverage.maleficsCovered = [unobserved]
    assertResultInvalid(() => parseResult(bridge, value))
  })
  check('valid malefic wording cannot append an unobserved signal type', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    const observed = value.coverage.maleficsCovered[0]
    const observedSet = new Set(value.coverage.maleficsCovered)
    const unobserved = ['擎羊', '陀羅', '火星', '鈴星', '生年化忌'].find(
      (type) => !observedSet.has(type),
    )
    assert.ok(observed)
    assert.ok(unobserved)
    value.coverage.maleficsCovered = [
      `${observed} 並誤列 ${unobserved}`,
      ...value.coverage.maleficsCovered.slice(1),
    ]
    assertResultInvalid(() => parseResult(bridge, value))
  })
  check('two wordings cannot duplicate one malefic source', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    const first = value.coverage.maleficsCovered[0]
    assert.ok(first)
    value.coverage.maleficsCovered = [
      first,
      `已覆蓋 ${first}`,
      ...value.coverage.maleficsCovered.slice(1),
    ]
    assertResultInvalid(() => parseResult(bridge, value))
  })
  check('a signal placementId cannot replace malefic coverage semantics', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    const signal = [
      ...modelInput.structuralContext.targetGlobalScan.directSignals,
      ...modelInput.structuralContext.targetGlobalScan.oppositeSignals,
      ...modelInput.structuralContext.targetGlobalScan.hiddenCombinationSignals,
      ...modelInput.structuralContext.targetGlobalScan.trineSignals,
    ][0]
    assert.ok(signal)
    value.coverage.maleficsCovered = [signal.starPlacementId]
    assertResultInvalid(() => parseResult(bridge, value))
  })
  check('a signalId cannot replace malefic coverage semantics', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    const signal = [
      ...modelInput.structuralContext.targetGlobalScan.directSignals,
      ...modelInput.structuralContext.targetGlobalScan.oppositeSignals,
      ...modelInput.structuralContext.targetGlobalScan.hiddenCombinationSignals,
      ...modelInput.structuralContext.targetGlobalScan.trineSignals,
    ][0]
    assert.ok(signal)
    value.coverage.maleficsCovered = [signal.signalId]
    assertResultInvalid(() => parseResult(bridge, value))
  })

  const nobleIndex = modelInputs.findIndex(
    (input) => input.structuralContext.targetPalace.modeledSupportingStars
      .some((star) => ['左輔', '右弼', '天魁', '天鉞'].includes(star.name)),
  )
  assert.notEqual(nobleIndex, -1)
  const nobleInput = modelInputs[nobleIndex]
  const nobleBridge = bridges[nobleIndex]
  check('an actual target noble star passes coverage binding', () => {
    const value = createValidAiChartD1P1Result(nobleInput)
    assert.equal(value.coverage.noblesCovered.length > 0, true)
    assert.doesNotThrow(() => parseResult(nobleBridge, value))
  })
  check('complete Result rejects empty noble coverage when one exists', () => {
    const value = createValidAiChartD1P1Result(nobleInput)
    assert.equal(value.coverage.noblesCovered.length > 0, true)
    value.coverage.noblesCovered = []
    assertResultInvalid(() => parseResult(nobleBridge, value))
  })
  check('noble coverage rejects a noble absent from the target palace', () => {
    const value = createValidAiChartD1P1Result(nobleInput)
    const unexpected = ['左輔', '右弼', '天魁', '天鉞'].find(
      (name) => !value.coverage.noblesCovered.includes(name),
    )
    assert.ok(unexpected)
    value.coverage.noblesCovered = [unexpected]
    assertResultInvalid(() => parseResult(nobleBridge, value))
  })
  check('noble coverage rejects duplicate entries', () => {
    const value = createValidAiChartD1P1Result(nobleInput)
    const noble = value.coverage.noblesCovered[0]
    assert.ok(noble)
    value.coverage.noblesCovered = [noble, noble]
    assertResultInvalid(() => parseResult(nobleBridge, value))
  })

  const coverageInput = modelInputs[2]
  const coverageBridge = bridges[2]
  function createSubsetResult(status: 'partial' | 'incomplete') {
    const value = createValidAiChartD1P1Result(coverageInput)
    value.status = status
    const missingMeaning = value.coverage.directMeaningsConsidered.shift()
    const missingMajor = value.coverage.majorStarsCovered.shift()
    const missingMinor = value.coverage.minorStarsCovered.shift()
    const missingMutagen = value.coverage.mutagensCovered.shift()
    const missingMalefic = value.coverage.maleficsCovered.shift()
    const missingNoble = value.coverage.noblesCovered.shift()
    assert.ok(missingMeaning)
    assert.ok(missingMajor)
    assert.ok(missingMinor)
    assert.ok(missingMutagen)
    assert.ok(missingMalefic)
    assert.ok(missingNoble)
    value.coverage.omittedItems = [
      { item: missingMeaning, reason: 'target meaning omitted' },
      { item: missingMajor, reason: 'target major star omitted' },
      {
        item: missingMinor,
        reason: missingMinor === missingNoble
          ? 'target supporting star and target noble omitted'
          : 'target supporting star omitted',
      },
      { item: missingMutagen, reason: 'target natal mutagen omitted' },
      { item: missingMalefic, reason: 'relevant malefic omitted' },
      ...(missingNoble === missingMinor
        ? []
        : [{ item: missingNoble, reason: 'target noble omitted' }]),
    ]
    return value
  }
  check('partial authenticated subsets pass with exact omission traces', () => {
    assert.equal(
      parseResult(coverageBridge, createSubsetResult('partial')).status,
      'partial',
    )
  })
  check('incomplete authenticated subsets pass with exact omission traces', () => {
    assert.equal(
      parseResult(coverageBridge, createSubsetResult('incomplete')).status,
      'incomplete',
    )
  })
  for (const status of ['partial', 'incomplete'] as const) {
    check(`${status} subset rejects a missing meaning omission trace`, () => {
      const value = createSubsetResult(status)
      value.coverage.omittedItems = value.coverage.omittedItems.slice(1)
      assertResultInvalid(() => parseResult(coverageBridge, value))
    })
    check(`${status} subset rejects a missing mutagen omission trace`, () => {
      const value = createSubsetResult(status)
      value.coverage.omittedItems = value.coverage.omittedItems.filter(
        (item) => !item.reason.includes('natal mutagen'),
      )
      assertResultInvalid(() => parseResult(coverageBridge, value))
    })
    check(`${status} coverage rejects an extra unknown source`, () => {
      const value = createSubsetResult(status)
      value.coverage.majorStarsCovered.push('紫微')
      assertResultInvalid(() => parseResult(coverageBridge, value))
    })
  }
  check('partial coverage cannot omit a source without naming it', () => {
    const value = createValidAiChartD1P1Result(coverageInput)
    value.status = 'partial'
    value.coverage.directMeaningsConsidered.shift()
    value.coverage.omittedItems = [{ item: 'known gap', reason: 'not processed' }]
    assertResultInvalid(() => parseResult(coverageBridge, value))
  })
  check('complete Result cannot use empty coverage and empty omissions', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.coverage.directMeaningsConsidered = []
    value.coverage.majorStarsCovered = []
    value.coverage.minorStarsCovered = []
    value.coverage.mutagensCovered = []
    value.coverage.maleficsCovered = []
    value.coverage.noblesCovered = []
    value.coverage.omittedItems = []
    assertResultInvalid(() => parseResult(bridge, value))
  })

  const partialSnapshot = completeModelInputSnapshot()
  const partialPalaces = partialSnapshot.palaces as MutableRecord[]
  partialPalaces[3].majorStars = [
    { name: '太陽', type: 'major', scope: 'origin' },
  ]
  partialPalaces[0].minorStars = [
    ...(partialPalaces[0].minorStars as unknown[]),
    { name: '地空', type: 'tough', scope: 'origin' },
  ]
  const partialFixture = await customFixture('bridge-partial', partialSnapshot)
  const partialIndex = partialFixture.modelInputs.findIndex(
    (input) => input.structuralStatus === 'partial',
  )
  assert.notEqual(partialIndex, -1)
  const partialBridge = partialFixture.bridges[partialIndex]
  const partialInput = partialFixture.modelInputs[partialIndex]
  check('Structural partial Result remains partial and passes', () => {
    const value = createValidAiChartD1P1Result(partialInput)
    assert.equal(parseResult(partialBridge, value).status, 'partial')
  })
  check('Structural partial Result cannot claim complete', () => {
    const value = createValidAiChartD1P1Result(partialInput)
    value.status = 'complete'
    value.coverage.oppositeProcessed = true
    value.coverage.hiddenCombinationProcessed = true
    value.coverage.trinesProcessed = true
    value.coverage.omittedItems = []
    value.warnings = []
    assertResultInvalid(() => parseResult(partialBridge, value))
  })

  const borrowSnapshot = completeModelInputSnapshot()
  const borrowPalaces = borrowSnapshot.palaces as MutableRecord[]
  borrowPalaces[0].majorStars = []
  borrowPalaces[0].minorStars = []
  const borrowFixture = await customFixture('bridge-borrow', borrowSnapshot)
  const borrowBridge = borrowFixture.bridges[0]
  const borrowInput = borrowFixture.modelInputs[0]
  check('eligible borrowed source requires borrowed mode', () => {
    assert.equal(
      parseResult(
        borrowBridge,
        createValidAiChartD1P1Result(borrowInput),
      ).primaryAxis.borrowedStarMode,
      'borrowed',
    )
  })
  check('eligible borrowed source rejects none mode', () => {
    const value = createValidAiChartD1P1Result(borrowInput)
    value.primaryAxis.borrowedStarMode = 'none'
    assertResultInvalid(() => parseResult(borrowBridge, value))
  })
  check('non-empty source rejects borrowed mode', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.primaryAxis.borrowedStarMode = 'borrowed'
    assertResultInvalid(() => parseResult(bridge, value))
  })

  const blockedSnapshot = completeModelInputSnapshot()
  const blockedPalaces = blockedSnapshot.palaces as MutableRecord[]
  blockedPalaces[0].majorStars = []
  blockedPalaces[0].minorStars = [
    {
      name: '文昌',
      type: AI_CHART_D1_MODELED_SUPPORTING_STARS.文昌,
      scope: 'origin',
    },
  ]
  const blockedFixture = await customFixture('bridge-blocked', blockedSnapshot)
  check('blocked empty source cannot supply a nonempty effective major core', () => {
    const value = createValidAiChartD1P1Result(blockedFixture.modelInputs[0])
    assertResultInvalid(() => parseResult(blockedFixture.bridges[0], value))
  })
  check('blocked empty source rejects borrowed mode', () => {
    const value = createValidAiChartD1P1Result(blockedFixture.modelInputs[0])
    value.primaryAxis.borrowedStarMode = 'borrowed'
    assertResultInvalid(() => parseResult(blockedFixture.bridges[0], value))
  })

  check('primaryAxis accepts a selected Rule ID', () => {
    assert.doesNotThrow(() => parseResult(bridge, validResult))
  })
  check('primaryAxis rejects an unknown Rule ID', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.primaryAxis.usedRuleIds = ['rule:unknown']
    assertResultInvalid(() => parseResult(bridge, value))
  })
  check('primaryAxis rejects empty Rule IDs', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.primaryAxis.usedRuleIds = []
    assertResultInvalid(() => parseResult(bridge, value))
  })
  check('primaryAxis rejects duplicate Rule IDs', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    const ruleId = modelInput.knowledgeContext.rules[0].ruleId
    value.primaryAxis.usedRuleIds = [ruleId, ruleId]
    assertResultInvalid(() => parseResult(bridge, value))
  })
  check('primaryAxis majorStarCore is exact for canonical target stars', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    assert.deepEqual(
      parseResult(bridge, value).primaryAxis.majorStarCore,
      modelInput.structuralContext.targetPalace.canonicalMajorStars.map(
        (star) => star.name,
      ),
    )
  })
  check('primaryAxis rejects an empty majorStarCore', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.primaryAxis.majorStarCore = []
    assertResultInvalid(() => parseResult(bridge, value))
  })
  check('primaryAxis rejects an extra major star', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.primaryAxis.majorStarCore.push('紫微')
    assertResultInvalid(() => parseResult(bridge, value))
  })
  check('primaryAxis rejects duplicate major stars', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.primaryAxis.majorStarCore.push(value.primaryAxis.majorStarCore[0])
    assertResultInvalid(() => parseResult(bridge, value))
  })
  check('primaryAxis rejects another palace major star', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.primaryAxis.majorStarCore = [
      modelInput.structuralContext.oppositePalace.canonicalMajorStars[0].name,
    ]
    assertResultInvalid(() => parseResult(bridge, value))
  })
  check('primaryAxis rejects a supporting star', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.primaryAxis.majorStarCore = [
      modelInput.structuralContext.targetPalace.modeledSupportingStars[0].name,
    ]
    assertResultInvalid(() => parseResult(bridge, value))
  })
  check('borrowed primaryAxis uses the exact borrowed major stars', () => {
    const value = createValidAiChartD1P1Result(borrowInput)
    assert.deepEqual(
      parseResult(borrowBridge, value).primaryAxis.majorStarCore,
      borrowInput.structuralContext.targetPalace.borrowedMajorStars.map(
        (star) => star.name,
      ),
    )
  })
  check('borrowed primaryAxis rejects a nonexistent local major star', () => {
    const value = createValidAiChartD1P1Result(borrowInput)
    value.primaryAxis.majorStarCore = [
      modelInput.structuralContext.targetPalace.canonicalMajorStars[0].name,
    ]
    assertResultInvalid(() => parseResult(borrowBridge, value))
  })
  check('non-borrowed primaryAxis rejects an opposite borrowed star', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.primaryAxis.majorStarCore = [
      modelInput.structuralContext.oppositePalace.canonicalMajorStars[0].name,
    ]
    assertResultInvalid(() => parseResult(bridge, value))
  })
  check('target primary star Rule completeness passes', () => {
    assert.doesNotThrow(() =>
      parseResult(bridge, createValidAiChartD1P1Result(modelInput)),
    )
  })
  check('missing one target primary star Rule is rejected', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.primaryAxis.usedRuleIds = value.primaryAxis.usedRuleIds.slice(1)
    assertResultInvalid(() => parseResult(bridge, value))
  })
  for (const role of ['opposite', 'hidden_combination', 'trine_1'] as const) {
    check(`${role} Rule is rejected from primaryAxis`, () => {
      const trace = modelInput.knowledgeContext.selectionTrace.find(
        (entry) => entry.palaceRole === role,
      )
      assert.ok(trace)
      const value = createValidAiChartD1P1Result(modelInput)
      value.primaryAxis.usedRuleIds.push(trace.ruleId)
      assertResultInvalid(() => parseResult(bridge, value))
    })
  }
  check('common Rule may coexist with target primary Rules', () => {
    const trace = modelInput.knowledgeContext.selectionTrace.find(
      (entry) => entry.palaceRole === null,
    )
    assert.ok(trace)
    const value = createValidAiChartD1P1Result(modelInput)
    value.primaryAxis.usedRuleIds.push(trace.ruleId)
    assert.doesNotThrow(() => parseResult(bridge, value))
  })

  const doubleSnapshot = completeModelInputSnapshot()
  const doublePalaces = doubleSnapshot.palaces as MutableRecord[]
  doublePalaces[0].majorStars = [
    { name: '廉貞', type: 'major', scope: 'origin', mutagen: '化祿' },
    { name: '七殺', type: 'major', scope: 'origin' },
  ]
  const doubleFixture = await customFixture('bridge-double-axis', doubleSnapshot)
  const doubleInput = doubleFixture.modelInputs[0]
  const doubleBridge = doubleFixture.bridges[0]
  const doubleRuleTrace = doubleInput.knowledgeContext.selectionTrace.find(
    (trace) =>
      trace.palaceRole === 'target' && trace.reason === 'double_star_present',
  )
  assert.ok(doubleRuleTrace)
  const doubleRule = doubleInput.knowledgeContext.rules.find(
    (rule) => rule.ruleId === doubleRuleTrace.ruleId,
  )
  const doublePlacementId =
    doubleInput.structuralContext.targetPalace.canonicalMajorStars[0]
      .placementId
  const doublePromptPackage = doubleFixture.promptPackages[0]
  assert.ok(doubleRule)
  check('authenticated double-star core passes', () => {
    const value = createValidAiChartD1P1Result(doubleInput)
    assert.doesNotThrow(() => parseResult(doubleBridge, value))
  })
  for (const [name, metadata] of [
    ['package fingerprint', doublePromptPackage.packageFingerprint],
    ['Model Input fingerprint', doubleInput.inputFingerprint],
    ['Catalog fingerprint', doubleInput.catalogFingerprint],
    ['instructions SHA', doublePromptPackage.instructionsSha256],
    ['output Schema SHA', doublePromptPackage.outputSchemaSha256],
    ['Rule content SHA', doubleRule.contentSha256],
    ['placement id', doublePlacementId],
    ['call id', doubleInput.callId],
  ] as const) {
    check(`doubleStarCore rejects authenticated ${name}`, () => {
      const value = createValidAiChartD1P1Result(doubleInput)
      value.primaryAxis.doubleStarCore =
        `${value.primaryAxis.doubleStarCore} ${metadata}`
      assertResultInvalid(() => parseResult(doubleBridge, value))
    })
  }
  for (const [name, metadata] of [
    ['package fingerprint', doublePromptPackage.packageFingerprint],
    ['call id', doubleInput.callId],
  ] as const) {
    check(`primaryAxis statement rejects authenticated ${name}`, () => {
      const value = createValidAiChartD1P1Result(doubleInput)
      value.primaryAxis.statement = `${value.primaryAxis.statement} ${metadata}`
      assertResultInvalid(() => parseResult(doubleBridge, value))
    })
  }
  check('Primary Axis metadata error exposes only fixed result-invalid', () => {
    const value = createValidAiChartD1P1Result(doubleInput)
    value.primaryAxis.doubleStarCore =
      `${value.primaryAxis.doubleStarCore} ${doublePromptPackage.packageFingerprint}`
    assert.throws(
      () => parseResult(doubleBridge, value),
      (error) => {
        assert.equal(
          (error as Error).message,
          AI_CHART_D1_P1_ADAPTER_BRIDGE_RESULT_INVALID,
        )
        assert.doesNotMatch(
          String(error),
          new RegExp(doublePromptPackage.packageFingerprint, 'u'),
        )
        return true
      },
    )
  })
  check('metadata isolation preserves exact effective major-star binding', () => {
    const parsed = parseResult(
      doubleBridge,
      createValidAiChartD1P1Result(doubleInput),
    )
    assert.deepEqual(
      new Set(parsed.primaryAxis.majorStarCore),
      new Set(
        doubleInput.structuralContext.targetPalace.canonicalMajorStars.map(
          (star) => star.name,
        ),
      ),
    )
  })
  check('metadata isolation preserves authenticated double-star semantics', () => {
    const parsed = parseResult(
      doubleBridge,
      createValidAiChartD1P1Result(doubleInput),
    )
    assert.ok(parsed.primaryAxis.doubleStarCore)
    for (const star of parsed.primaryAxis.majorStarCore) {
      assert.match(parsed.primaryAxis.doubleStarCore, new RegExp(star, 'u'))
    }
  })
  check('primaryAxis rejects a missing effective major star', () => {
    const value = createValidAiChartD1P1Result(doubleInput)
    value.primaryAxis.majorStarCore = [value.primaryAxis.majorStarCore[0]]
    assertResultInvalid(() => parseResult(doubleBridge, value))
  })
  check('double-star majorStarCore order does not affect source equality', () => {
    const value = createValidAiChartD1P1Result(doubleInput)
    value.primaryAxis.majorStarCore.reverse()
    assert.doesNotThrow(() => parseResult(doubleBridge, value))
  })
  check('missing authenticated double-star Rule is rejected', () => {
    const value = createValidAiChartD1P1Result(doubleInput)
    value.primaryAxis.usedRuleIds = value.primaryAxis.usedRuleIds.filter(
      (ruleId) => ruleId !== doubleRuleTrace.ruleId,
    )
    assertResultInvalid(() => parseResult(doubleBridge, value))
  })
  check('null doubleStarCore with an authenticated double Rule is rejected', () => {
    const value = createValidAiChartD1P1Result(doubleInput)
    value.primaryAxis.doubleStarCore = null
    assertResultInvalid(() => parseResult(doubleBridge, value))
  })
  check('doubleStarCore missing one effective star name is rejected', () => {
    const value = createValidAiChartD1P1Result(doubleInput)
    value.primaryAxis.doubleStarCore = value.primaryAxis.majorStarCore[0]
    assertResultInvalid(() => parseResult(doubleBridge, value))
  })
  check('doubleStarCore containing a third major star is rejected', () => {
    const value = createValidAiChartD1P1Result(doubleInput)
    const third = AI_CHART_D1_MAJOR_STAR_NAMES.find(
      (starName) => !value.primaryAxis.majorStarCore.includes(starName),
    )
    assert.ok(third)
    value.primaryAxis.doubleStarCore = `${value.primaryAxis.doubleStarCore}${third}`
    assertResultInvalid(() => parseResult(doubleBridge, value))
  })
  check('doubleStarCore is rejected without an authenticated double Rule', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.primaryAxis.doubleStarCore = '廉貞與七殺'
    assertResultInvalid(() => parseResult(bridge, value))
  })
  check('primaryAxis metadata leakage is rejected', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.primaryAxis.statement =
      `leak ${modelInput.knowledgeContext.rules[0].ruleId}`
    assertResultInvalid(() => parseResult(bridge, value))
  })
  check('Catalog Rule not selected for this call is rejected', () => {
    const selected = new Set(
      modelInput.knowledgeContext.rules.map((rule) => rule.ruleId),
    )
    const unselected = fixture.catalog.rules.find(
      (rule) => !selected.has(rule.ruleId),
    )
    assert.ok(unselected)
    const value = createValidAiChartD1P1Result(modelInput)
    value.primaryAxis.usedRuleIds = [unselected.ruleId]
    assertResultInvalid(() => parseResult(bridge, value))
  })

  for (const field of CANDIDATE_FIELDS) {
    check(`${field} accepts selected Rule IDs`, () => {
      assert.doesNotThrow(() =>
        parseResult(bridge, resultWithSingleCandidate(modelInput, field)),
      )
    })
    check(`${field} rejects unknown Rule IDs`, () => {
      const value = resultWithSingleCandidate(modelInput, field)
      value[field][0].usedRuleIds = ['rule:unknown']
      assertResultInvalid(() => parseResult(bridge, value))
    })
    check(`${field} rejects duplicate Rule IDs`, () => {
      const value = resultWithSingleCandidate(modelInput, field)
      const ruleId = value[field][0].usedRuleIds[0]
      value[field][0].usedRuleIds = [ruleId, ruleId]
      assertResultInvalid(() => parseResult(bridge, value))
    })
    check(`${field} rejects empty Rule IDs`, () => {
      const value = resultWithSingleCandidate(modelInput, field)
      value[field][0].usedRuleIds = []
      assertResultInvalid(() => parseResult(bridge, value))
    })
  }

  const teacherRule = modelInput.knowledgeContext.rules.find(
    (rule) => rule.ruleStatus === 'teacher_confirmed',
  )
  const lectureRule = modelInput.knowledgeContext.rules.find(
    (rule) => rule.ruleStatus === 'lecture_backfill',
  )
  assert.ok(teacherRule)
  assert.ok(lectureRule)
  check('teacher-only Candidate with teacher status passes', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.directCandidates[0].usedRuleIds = [teacherRule.ruleId]
    value.directCandidates[0].ruleStatus = 'teacher_confirmed'
    assert.doesNotThrow(() => parseResult(bridge, value))
  })
  check('teacher-only Candidate cannot report working status', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.directCandidates[0].usedRuleIds = [teacherRule.ruleId]
    value.directCandidates[0].ruleStatus = 'working_inference'
    assertResultInvalid(() => parseResult(bridge, value))
  })
  check('lecture-only Candidate with lecture status passes', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.directCandidates[0].usedRuleIds = [lectureRule.ruleId]
    value.directCandidates[0].ruleStatus = 'lecture_backfill'
    assert.doesNotThrow(() => parseResult(bridge, value))
  })
  check('lecture-only Candidate cannot promote to teacher status', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.directCandidates[0].usedRuleIds = [lectureRule.ruleId]
    value.directCandidates[0].ruleStatus = 'teacher_confirmed'
    assertResultInvalid(() => parseResult(bridge, value))
  })
  check('teacher plus lecture derives lecture status', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.directCandidates[0].usedRuleIds = [
      teacherRule.ruleId,
      lectureRule.ruleId,
    ]
    value.directCandidates[0].ruleStatus = 'lecture_backfill'
    assert.doesNotThrow(() => parseResult(bridge, value))
  })
  check('teacher plus lecture cannot promote to teacher status', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.directCandidates[0].usedRuleIds = [
      teacherRule.ruleId,
      lectureRule.ruleId,
    ]
    value.directCandidates[0].ruleStatus = 'teacher_confirmed'
    assertResultInvalid(() => parseResult(bridge, value))
  })
  const syntheticAuthorityRules = [
    { ruleId: 'rule:teacher', ruleStatus: 'teacher_confirmed' },
    { ruleId: 'rule:lecture', ruleStatus: 'lecture_backfill' },
    { ruleId: 'rule:working', ruleStatus: 'working_inference' },
  ] as const
  for (const [name, ruleIds, expected] of [
    ['teacher-only', ['rule:teacher'], 'teacher_confirmed'],
    ['lecture-only', ['rule:lecture'], 'lecture_backfill'],
    ['working-only', ['rule:working'], 'working_inference'],
    ['teacher plus lecture', ['rule:teacher', 'rule:lecture'], 'lecture_backfill'],
    ['teacher plus working', ['rule:teacher', 'rule:working'], 'working_inference'],
    ['lecture plus working', ['rule:lecture', 'rule:working'], 'working_inference'],
  ] as const) {
    check(`${name} authority derives ${expected}`, () => {
      assert.equal(
        deriveAiChartD1P1CandidateRuleStatus(ruleIds, syntheticAuthorityRules),
        expected,
      )
    })
  }
  for (const [name, ruleIds, validStatus, promotedStatus] of [
    ['teacher-only', ['rule:teacher'], 'teacher_confirmed', 'working_inference'],
    ['lecture-only', ['rule:lecture'], 'lecture_backfill', 'teacher_confirmed'],
    ['working-only', ['rule:working'], 'working_inference', 'teacher_confirmed'],
    [
      'teacher plus lecture',
      ['rule:teacher', 'rule:lecture'],
      'lecture_backfill',
      'teacher_confirmed',
    ],
    [
      'teacher plus working',
      ['rule:teacher', 'rule:working'],
      'working_inference',
      'teacher_confirmed',
    ],
  ] as const) {
    check(`${name} Candidate authority accepts ${validStatus}`, () => {
      assert.doesNotThrow(() =>
        assertAiChartD1P1CandidateRuleAuthority(
          { usedRuleIds: ruleIds, ruleStatus: validStatus },
          syntheticAuthorityRules,
        ),
      )
    })
    check(`${name} Candidate authority rejects ${promotedStatus}`, () => {
      assertResultInvalid(() =>
        assertAiChartD1P1CandidateRuleAuthority(
          { usedRuleIds: ruleIds, ruleStatus: promotedStatus },
          syntheticAuthorityRules,
        ),
      )
    })
  }
  check('authority derivation rejects empty usedRuleIds', () => {
    assertResultInvalid(() =>
      deriveAiChartD1P1CandidateRuleStatus([], syntheticAuthorityRules),
    )
  })
  check('authority derivation rejects duplicate usedRuleIds', () => {
    assertResultInvalid(() =>
      deriveAiChartD1P1CandidateRuleStatus(
        ['rule:teacher', 'rule:teacher'],
        syntheticAuthorityRules,
      ),
    )
  })
  check('authority derivation rejects an unknown Rule ID', () => {
    assertResultInvalid(() =>
      deriveAiChartD1P1CandidateRuleStatus(
        ['rule:unknown'],
        syntheticAuthorityRules,
      ),
    )
  })
  for (const field of CANDIDATE_FIELDS) {
    check(`${field} rejects lecture-to-teacher authority promotion`, () => {
      const value = resultWithSingleCandidate(modelInput, field)
      value[field][0].usedRuleIds = [lectureRule.ruleId]
      value[field][0].ruleStatus = 'teacher_confirmed'
      assertResultInvalid(() => parseResult(bridge, value))
    })
  }

  const structuralPalaces = [
    modelInput.structuralContext.targetPalace,
    modelInput.structuralContext.oppositePalace,
    modelInput.structuralContext.hiddenCombinationPalace,
    ...modelInput.structuralContext.otherTrinePalaces,
  ]
  const targetPalace = modelInput.structuralContext.targetPalace
  const oppositePalace = modelInput.structuralContext.oppositePalace
  const hiddenPalace = modelInput.structuralContext.hiddenCombinationPalace
  const trinePalaces = modelInput.structuralContext.otherTrinePalaces
  const firstStarName = (
    palace: typeof targetPalace,
  ) => [
    ...palace.canonicalMajorStars,
    ...palace.borrowedMajorStars,
    ...palace.modeledSupportingStars,
  ][0]?.name

  for (const [role, palace] of [
    ['opposite', oppositePalace],
    ['hidden', hiddenPalace],
    ['trine one', trinePalaces[0]],
    ['trine two', trinePalaces[1]],
  ] as const) {
    check(`directCandidates rejects ${role} palaceId`, () => {
      const value = createValidAiChartD1P1Result(modelInput)
      value.directCandidates[0].palaceIds = [palace.palaceId]
      assertResultInvalid(() => parseResult(bridge, value))
    })
  }
  for (const [role, palace] of [
    ['opposite', oppositePalace],
    ['hidden', hiddenPalace],
    ['trine', trinePalaces[0]],
  ] as const) {
    const starName = firstStarName(palace)
    assert.ok(starName)
    check(`directCandidates rejects ${role} star`, () => {
      const value = createValidAiChartD1P1Result(modelInput)
      value.directCandidates[0].starBasis = [starName]
      assertResultInvalid(() => parseResult(bridge, value))
    })
  }
  for (const structure of ['對宮', '暗合', '三方'] as const) {
    check(`directCandidates rejects ${structure} basis`, () => {
      const value = createValidAiChartD1P1Result(modelInput)
      value.directCandidates[0].structureBasis = ['本宮', structure]
      assertResultInvalid(() => parseResult(bridge, value))
    })
  }
  check('directCandidates requires target palaceId', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.directCandidates[0].palaceIds = []
    assertResultInvalid(() => parseResult(bridge, value))
  })
  check('directCandidates requires 本宮 basis', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.directCandidates[0].structureBasis = ['輔星']
    assertResultInvalid(() => parseResult(bridge, value))
  })
  check('oppositeInfluences requires opposite palaceId', () => {
    const value = resultWithSingleCandidate(modelInput, 'oppositeInfluences')
    value.oppositeInfluences[0].palaceIds = [targetPalace.palaceId]
    assertResultInvalid(() => parseResult(bridge, value))
  })
  check('oppositeInfluences rejects hidden palaceId', () => {
    const value = resultWithSingleCandidate(modelInput, 'oppositeInfluences')
    value.oppositeInfluences[0].palaceIds = [hiddenPalace.palaceId]
    assertResultInvalid(() => parseResult(bridge, value))
  })
  check('oppositeInfluences rejects a hidden palace star', () => {
    const value = resultWithSingleCandidate(modelInput, 'oppositeInfluences')
    const starName = firstStarName(hiddenPalace)
    assert.ok(starName)
    value.oppositeInfluences[0].starBasis = [starName]
    assertResultInvalid(() => parseResult(bridge, value))
  })
  check('oppositeInfluences requires 對宮 basis', () => {
    const value = resultWithSingleCandidate(modelInput, 'oppositeInfluences')
    value.oppositeInfluences[0].structureBasis = ['本宮']
    assertResultInvalid(() => parseResult(bridge, value))
  })
  check('hiddenCombinationInfluences requires hidden palaceId', () => {
    const value = resultWithSingleCandidate(
      modelInput,
      'hiddenCombinationInfluences',
    )
    value.hiddenCombinationInfluences[0].palaceIds = [targetPalace.palaceId]
    assertResultInvalid(() => parseResult(bridge, value))
  })
  check('hiddenCombinationInfluences rejects trine palaceId', () => {
    const value = resultWithSingleCandidate(
      modelInput,
      'hiddenCombinationInfluences',
    )
    value.hiddenCombinationInfluences[0].palaceIds = [trinePalaces[0].palaceId]
    assertResultInvalid(() => parseResult(bridge, value))
  })
  check('hiddenCombinationInfluences rejects a trine palace star', () => {
    const value = resultWithSingleCandidate(
      modelInput,
      'hiddenCombinationInfluences',
    )
    const starName = firstStarName(trinePalaces[0])
    assert.ok(starName)
    value.hiddenCombinationInfluences[0].starBasis = [starName]
    assertResultInvalid(() => parseResult(bridge, value))
  })
  check('hiddenCombinationInfluences requires 暗合 basis', () => {
    const value = resultWithSingleCandidate(
      modelInput,
      'hiddenCombinationInfluences',
    )
    value.hiddenCombinationInfluences[0].structureBasis = ['本宮']
    assertResultInvalid(() => parseResult(bridge, value))
  })
  check('trineInfluences requires at least one other trine palaceId', () => {
    const value = resultWithSingleCandidate(modelInput, 'trineInfluences')
    value.trineInfluences[0].palaceIds = [targetPalace.palaceId]
    assertResultInvalid(() => parseResult(bridge, value))
  })
  check('trineInfluences rejects opposite palaceId', () => {
    const value = resultWithSingleCandidate(modelInput, 'trineInfluences')
    value.trineInfluences[0].palaceIds = [oppositePalace.palaceId]
    assertResultInvalid(() => parseResult(bridge, value))
  })
  check('trineInfluences rejects an opposite palace star', () => {
    const value = resultWithSingleCandidate(modelInput, 'trineInfluences')
    const starName = firstStarName(oppositePalace)
    assert.ok(starName)
    value.trineInfluences[0].starBasis = [starName]
    assertResultInvalid(() => parseResult(bridge, value))
  })
  check('trineInfluences requires 三方 basis', () => {
    const value = resultWithSingleCandidate(modelInput, 'trineInfluences')
    value.trineInfluences[0].structureBasis = ['本宮']
    assertResultInvalid(() => parseResult(bridge, value))
  })
  for (const field of [
    'combinedCandidates',
    'strengths',
    'imbalancePossibilities',
  ] as const) {
    check(`${field} accepts the legal five-palace union`, () => {
      const value = resultWithSingleCandidate(modelInput, field)
      value[field][0].palaceIds = structuralPalaces.map(
        (palace) => palace.palaceId,
      )
      value[field][0].starBasis = [
        ...new Set(structuralPalaces.flatMap((palace) => [
          ...palace.canonicalMajorStars.map((star) => star.name),
          ...palace.borrowedMajorStars.map((star) => star.name),
          ...palace.modeledSupportingStars.map((star) => star.name),
        ])),
      ]
      assert.doesNotThrow(() => parseResult(bridge, value))
    })
    for (const structure of ['飛化', '身宮'] as const) {
      check(`${field} rejects ${structure} basis`, () => {
        const value = resultWithSingleCandidate(modelInput, field)
        value[field][0].structureBasis = [structure]
        assertResultInvalid(() => parseResult(bridge, value))
      })
    }
  }
  check('another canonical palace outside the five views is rejected', () => {
    const allowed = new Set(structuralPalaces.map((palace) => palace.palaceId))
    const outside = AI_CHART_D1_PALACE_IDENTITIES.find(
      (identity) => !allowed.has(identity.palaceId),
    )
    assert.ok(outside)
    const value = createValidAiChartD1P1Result(modelInput)
    value.directCandidates[0].palaceIds = [outside.palaceId]
    assertResultInvalid(() => parseResult(bridge, value))
  })
  check('non-source chart palace identifier is rejected', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.directCandidates[0].palaceIds = ['palace:other-chart']
    assertResultInvalid(() => parseResult(bridge, value))
  })
  check('duplicate Candidate palace IDs are rejected', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    const palaceId = modelInput.targetPalaceId
    value.directCandidates[0].palaceIds = [palaceId, palaceId]
    assertResultInvalid(() => parseResult(bridge, value))
  })
  check('top-level opposite palace is rejected', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.palaceId = modelInput.structuralContext.oppositePalace.palaceId
    value.palace = modelInput.structuralContext.oppositePalace.canonicalName
    assertResultInvalid(() => parseResult(bridge, value))
  })
  for (const field of CANDIDATE_FIELDS) {
    check(`${field} rejects a palace outside the five views`, () => {
      const allowed = new Set(structuralPalaces.map((palace) => palace.palaceId))
      const outside = AI_CHART_D1_PALACE_IDENTITIES.find(
        (identity) => !allowed.has(identity.palaceId),
      )
      assert.ok(outside)
      const value = resultWithSingleCandidate(modelInput, field)
      value[field][0].palaceIds = [outside.palaceId]
      assertResultInvalid(() => parseResult(bridge, value))
    })
  }

  const canonicalStar = structuralPalaces
    .flatMap((palace) => palace.canonicalMajorStars)
    .at(0)
  const supportingStar = structuralPalaces
    .flatMap((palace) => palace.modeledSupportingStars)
    .at(0)
  assert.ok(canonicalStar)
  assert.ok(supportingStar)
  check('actual canonical major star is accepted', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.directCandidates[0].starBasis = [canonicalStar.name]
    assert.doesNotThrow(() => parseResult(bridge, value))
  })
  check('actual supporting star is accepted', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.directCandidates[0].starBasis = [supportingStar.name]
    assert.doesNotThrow(() => parseResult(bridge, value))
  })
  check('actual borrowed star is accepted', () => {
    const value = createValidAiChartD1P1Result(borrowInput)
    value.directCandidates[0].starBasis = [
      borrowInput.structuralContext.targetPalace.borrowedMajorStars[0].name,
    ]
    assert.doesNotThrow(() => parseResult(borrowBridge, value))
  })
  for (const [name, starName] of [
    ['unseen major star', '紫微'],
    ['unseen supporting star', '天刑'],
    ['placement id', modelInput.structuralContext.targetPalace.canonicalMajorStars[0].placementId],
  ] as const) {
    check(`${name} is rejected from starBasis`, () => {
      const value = createValidAiChartD1P1Result(modelInput)
      value.directCandidates[0].starBasis = [starName]
      assertResultInvalid(() => parseResult(bridge, value))
    })
  }
  check('duplicate starBasis values are rejected', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.directCandidates[0].starBasis = [canonicalStar.name, canonicalStar.name]
    assertResultInvalid(() => parseResult(bridge, value))
  })
  for (const field of CANDIDATE_FIELDS) {
    check(`${field} rejects an unseen star`, () => {
      const value = resultWithSingleCandidate(modelInput, field)
      value[field][0].starBasis = ['不存在星曜']
      assertResultInvalid(() => parseResult(bridge, value))
    })
  }

  for (const structure of [
    '空宮借星',
    '生年四化',
    '煞忌',
    '輔星',
  ] as const) {
    check(`directCandidates accepts optional P1 structure ${structure}`, () => {
      const value = createValidAiChartD1P1Result(modelInput)
      value.directCandidates[0].structureBasis = ['本宮', structure]
      assert.doesNotThrow(() => parseResult(bridge, value))
    })
  }
  for (const structure of ['飛化', '身宮'] as const) {
    check(`P1 structure ${structure} is rejected`, () => {
      const value = createValidAiChartD1P1Result(modelInput)
      value.directCandidates[0].structureBasis = [structure]
      assertResultInvalid(() => parseResult(bridge, value))
    })
  }
  check('duplicate P1 structureBasis values are rejected', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.directCandidates[0].structureBasis = [
      '本宮',
      '本宮',
    ] as AiChartD1StructureBasis[]
    assertResultInvalid(() => parseResult(bridge, value))
  })

  check('Result with no upstream warnings passes without warning text', () => {
    assert.equal(modelInput.warnings.length, 0)
    assert.doesNotThrow(() => parseResult(bridge, validResult))
  })
  check('upstream warning code may be traced in Result warnings', () => {
    const value = createValidAiChartD1P1Result(partialInput)
    value.coverage.omittedItems = [{ item: 'known gap', reason: 'known gap' }]
    value.warnings = partialInput.warnings.map(
      (warning) => `trace ${warning.code}`,
    )
    assert.doesNotThrow(() => parseResult(partialBridge, value))
  })
  check('upstream warning code may be traced in an omitted item', () => {
    const value = createValidAiChartD1P1Result(partialInput)
    value.warnings = []
    value.coverage.omittedItems = partialInput.warnings.map((warning) => ({
      item: warning.code,
      reason: `omitted because ${warning.code}`,
    }))
    assert.doesNotThrow(() => parseResult(partialBridge, value))
  })
  check('missing upstream warning trace is rejected', () => {
    const value = createValidAiChartD1P1Result(partialInput)
    value.warnings = []
    value.coverage.omittedItems = [{ item: 'known gap', reason: 'known gap' }]
    assertResultInvalid(() => parseResult(partialBridge, value))
  })
  check('missing one of multiple upstream warning codes is rejected', () => {
    assert.equal(partialInput.warnings.length >= 2, true)
    const value = createValidAiChartD1P1Result(partialInput)
    const first = partialInput.warnings[0].code
    value.warnings = [first]
    value.coverage.omittedItems = [{ item: first, reason: first }]
    assertResultInvalid(() => parseResult(partialBridge, value))
  })
  check('warning traceability failure exposes only the fixed safe error', () => {
    const value = createValidAiChartD1P1Result(partialInput)
    value.warnings = []
    value.coverage.omittedItems = [{ item: 'known gap', reason: 'known gap' }]
    try {
      parseResult(partialBridge, value)
      assert.fail('expected result invalid')
    } catch (error) {
      assert.equal(
        (error as Error).message,
        AI_CHART_D1_P1_ADAPTER_BRIDGE_RESULT_INVALID,
      )
      assert.doesNotMatch(String(error), /warning:|palace:|chart:|call:/u)
    }
  })

  for (const [name, auditValue, mutate] of [
    ['runId in primary statement', modelInput.runId, (value: Mutable<AiChartD1P1Result>, audit: string) => {
      value.primaryAxis.statement = `leak ${audit}`
    }],
    ['bundleId in lifeExamples', modelInput.bundleId, (value: Mutable<AiChartD1P1Result>, audit: string) => {
      value.directCandidates[0].lifeExamples = [`leak ${audit}`]
    }],
    ['catalogId in Candidate statement', modelInput.catalogId, (value: Mutable<AiChartD1P1Result>, audit: string) => {
      value.directCandidates[0].statement = `leak ${audit}`
    }],
    ['catalog fingerprint in tension', modelInput.catalogFingerprint, (value: Mutable<AiChartD1P1Result>, audit: string) => {
      value.tensions = [{
        tensionId: 'tension:leak',
        sideA: `leak ${audit}`,
        sideB: 'side b',
        coexistenceExplanation: 'coexistence',
        candidateIds: ['candidate:valid', 'candidate:second'],
      }]
      value.strengths = [
        createValidAiChartD1P1Candidate(modelInput, 'candidate:second'),
      ]
    }],
    ['source Manifest SHA in D2 reason', modelInput.sourceManifestSha256, (value: Mutable<AiChartD1P1Result>, audit: string) => {
      value.d2Boundaries = [{
        boundaryId: 'boundary:leak',
        topic: 'topic',
        prohibitedD1Conclusion: 'prohibited',
        allowedD1Wording: 'allowed',
        reason: `leak ${audit}`,
      }]
    }],
    ['Model Input fingerprint in omitted reason', modelInput.inputFingerprint, (value: Mutable<AiChartD1P1Result>, audit: string) => {
      value.status = 'partial'
      value.coverage.omittedItems = [{ item: 'gap', reason: `leak ${audit}` }]
    }],
    ['Package fingerprint in D2 topic', promptPackages[0].packageFingerprint, (value: Mutable<AiChartD1P1Result>, audit: string) => {
      value.d2Boundaries = [{
        boundaryId: 'boundary:leak',
        topic: `leak ${audit}`,
        prohibitedD1Conclusion: 'prohibited',
        allowedD1Wording: 'allowed',
        reason: 'reason',
      }]
    }],
    ['Instructions SHA in Candidate d2Boundary', AI_CHART_D1_P1_PROMPT_INSTRUCTIONS_SHA256, (value: Mutable<AiChartD1P1Result>, audit: string) => {
      value.directCandidates[0].d2Boundary = `leak ${audit}`
    }],
    ['userInput SHA in D2 allowed wording', promptPackages[0].userInputSha256, (value: Mutable<AiChartD1P1Result>, audit: string) => {
      value.d2Boundaries = [{
        boundaryId: 'boundary:leak',
        topic: 'topic',
        prohibitedD1Conclusion: 'prohibited',
        allowedD1Wording: `leak ${audit}`,
        reason: 'reason',
      }]
    }],
    ['Output Schema SHA in tension coexistence', AI_CHART_D1_P1_OUTPUT_SCHEMA_SHA256, (value: Mutable<AiChartD1P1Result>, audit: string) => {
      value.tensions = [{
        tensionId: 'tension:leak',
        sideA: 'side a',
        sideB: 'side b',
        coexistenceExplanation: `leak ${audit}`,
        candidateIds: ['candidate:valid', 'candidate:second'],
      }]
      value.strengths = [
        createValidAiChartD1P1Candidate(modelInput, 'candidate:second'),
      ]
    }],
  ] as const) {
    check(`${name} is rejected as semantic metadata leakage`, () => {
      const value = createValidAiChartD1P1Result(modelInput)
      mutate(value, auditValue)
      assertResultInvalid(() => parseResult(bridge, value))
    })
  }
  check('opaque identity fields remain valid in their Contract locations', () => {
    const parsed = parseResult(bridge, validResult)
    assert.equal(parsed.callId, modelInput.callId)
    assert.equal(parsed.chartId, modelInput.chartId)
  })

  const oppositeEmptySnapshot = completeModelInputSnapshot()
  const oppositeEmptyPalaces = oppositeEmptySnapshot.palaces as MutableRecord[]
  oppositeEmptyPalaces[0].majorStars = []
  oppositeEmptyPalaces[0].minorStars = []
  oppositeEmptyPalaces[6].majorStars = []
  const oppositeStructures = createStructuralInputs(
    oppositeEmptySnapshot,
    'bridge-opposite-empty',
  )
  const oppositeBundles = buildAiChartD1K0P1KnowledgeBundles(
    fixture.catalog,
    oppositeStructures,
    { bundleIds: bundleIds('bridge-opposite-empty') },
  )
  check('opposite_empty upstream is mapped to Bridge not-ready', () => {
    assert.equal(oppositeStructures[0].targetPalace.borrowStatus, 'opposite_empty')
    assertNotReady(() =>
      buildAiChartD1P1AdapterBridges(
        fixture.catalog,
        oppositeStructures,
        oppositeBundles,
        fixture.modelInputs,
        fixture.promptPackages,
      ),
    )
  })
  check('not-ready fixed-12 build returns no partial subset', () => {
    let returned: readonly AiChartD1P1AdapterBridge[] | undefined
    assertNotReady(() => {
      returned = buildAiChartD1P1AdapterBridges(
        fixture.catalog,
        oppositeStructures,
        oppositeBundles,
        fixture.modelInputs,
        fixture.promptPackages,
      )
    })
    assert.equal(returned, undefined)
  })
  check('not-ready error exposes no source identity or missing reason', () => {
    try {
      buildAiChartD1P1AdapterBridges(
        fixture.catalog,
        oppositeStructures,
        oppositeBundles,
        fixture.modelInputs,
        fixture.promptPackages,
      )
      assert.fail('expected not ready')
    } catch (error) {
      assert.equal((error as Error).message, AI_CHART_D1_P1_ADAPTER_BRIDGE_NOT_READY)
      assert.doesNotMatch(String(error), /chart:|run:|call:|palace:|bundle:/u)
    }
  })

  check('Bridge construction performs no fetch', () => {
    assertNoFetch(() => {
      buildFrom(fixture)
    })
  })
  check('Descriptor parsing performs no fetch', () => {
    assertNoFetch(() => {
      parseAiChartD1P1AdapterBridgeDescriptor(
        bridge.descriptor,
        fixture.catalog,
        fixture.structuralInputs[0],
        fixture.bundles[0],
        fixture.modelInputs[0],
        fixture.promptPackages[0],
      )
    })
  })
  check('Responses body compatibility build performs no fetch', () => {
    assertNoFetch(() => {
      buildAiChartOpenAiResponsesBody(bridge.request)
    })
  })

  const repositoryRoot = process.cwd()
  const sourceFiles = sourceFilesUnder(join(repositoryRoot, 'src'))
  const bridgeSource = readFileSync(
    join(repositoryRoot, 'src/lib/ai-chart/d1P1AdapterBridge.ts'),
    'utf8',
  )
  check('Adapter Bridge production consumer is only Preview Gate', () => {
    const consumers = sourceFiles
      .filter((path) => path.endsWith('.ts') || path.endsWith('.tsx'))
      .filter((path) =>
        readFileSync(path, 'utf8').includes('buildAiChartD1P1AdapterBridges'),
      )
      .map((path) => relative(repositoryRoot, path))
      .filter(
        (path) =>
          !path.endsWith('d1P1AdapterBridge.ts') &&
          !path.endsWith('d1P1AdapterBridge.test.ts') &&
          !path.endsWith('d1P1AdapterBridgeContracts.test.ts') &&
          !path.endsWith('d1P1AdapterBridgeTestSupport.ts') &&
          !path.endsWith('d1P1PreviewRequestGate.server.test.ts'),
      )
    assert.deepEqual(consumers, [
      'src/lib/ai-chart/d1P1PreviewRequestGate.server.ts',
    ])
  })
  check('Prompt Package builder production consumer is only the Bridge', () => {
    const consumers = sourceFiles
      .filter((path) => path.endsWith('.ts') || path.endsWith('.tsx'))
      .filter((path) =>
        readFileSync(path, 'utf8').includes('buildAiChartD1P1PromptPackages'),
      )
      .map((path) => relative(repositoryRoot, path))
      .filter(
        (path) =>
          !path.endsWith('d1P1PromptPackageBuilder.ts') &&
          !path.endsWith('d1P1PromptPackageBuilder.test.ts') &&
          !path.endsWith('d1P1PromptPackageTestSupport.ts') &&
          !path.endsWith('d1P1AdapterBridge.test.ts') &&
          !path.endsWith('d1P1AdapterBridgeTestSupport.ts') &&
          !path.endsWith('d1P1PreviewRequestGate.server.test.ts'),
      )
    assert.deepEqual(consumers, ['src/lib/ai-chart/d1P1AdapterBridge.ts'])
  })
  check('src/app imports no Adapter Bridge', () => {
    const appFiles = sourceFilesUnder(join(repositoryRoot, 'src', 'app'))
    assert.equal(
      appFiles.some((path) =>
        readFileSync(path, 'utf8').includes('d1P1AdapterBridge'),
      ),
      false,
    )
  })
  check('Report modules import no Adapter Bridge', () => {
    for (const path of [
      'src/lib/ai-chart/reportGenerator.ts',
      'src/lib/ai-chart/reportCompletion.ts',
    ]) {
      assert.doesNotMatch(
        readFileSync(join(repositoryRoot, path), 'utf8'),
        /d1P1AdapterBridge/u,
      )
    }
  })
  check('Payment modules import no Adapter Bridge', () => {
    const paymentFiles = sourceFiles.filter((path) => /payment/iu.test(path))
    assert.equal(
      paymentFiles.some((path) =>
        readFileSync(path, 'utf8').includes('d1P1AdapterBridge'),
      ),
      false,
    )
  })
  check('Supabase modules import no Adapter Bridge', () => {
    const supabaseFiles = sourceFiles.filter((path) => /supabase/iu.test(path))
    assert.equal(
      supabaseFiles.some((path) =>
        readFileSync(path, 'utf8').includes('d1P1AdapterBridge'),
      ),
      false,
    )
  })
  check('Server request imports no Adapter Bridge', () => {
    assert.doesNotMatch(
      readFileSync(
        join(repositoryRoot, 'src/lib/ai-chart/openAiResponses.server.ts'),
        'utf8',
      ),
      /d1P1AdapterBridge/u,
    )
  })
  check('Adapter Bridge imports no Server request module', () => {
    assert.doesNotMatch(bridgeSource, /openAiResponses\.server/u)
    assert.doesNotMatch(bridgeSource, /requestAiChartOpenAiStructuredResponse/u)
  })
  check('Adapter Bridge contains no fetch call', () => {
    assert.doesNotMatch(bridgeSource, /\bfetch\s*\(/u)
    assert.doesNotMatch(bridgeSource, /globalThis\.fetch/u)
  })
  check('Adapter Bridge contains no API key or environment read', () => {
    assert.doesNotMatch(bridgeSource, /OPENAI_API_KEY|process\.env|Authorization/u)
  })
  check('Adapter Bridge contains no timeout or abort implementation', () => {
    assert.doesNotMatch(bridgeSource, /AbortController|setTimeout/u)
  })
  check('Adapter Bridge contains no Responses body builder', () => {
    assert.doesNotMatch(bridgeSource, /buildAiChartOpenAiResponsesBody/u)
  })
  check('Repository contains no runtimeEnabled=true wiring', () => {
    assert.equal(
      sourceFiles
        .filter((path) => !path.endsWith('.test.ts'))
        .filter((path) => !path.endsWith('TestSupport.ts'))
        .some((path) =>
          /runtimeEnabled\s*[:=]\s*true/u.test(readFileSync(path, 'utf8')),
        ),
      false,
    )
  })
  check('F1 remains blocked in the D1 README', () => {
    const readme = readFileSync(
      join(repositoryRoot, 'content/ai-chart/d1-v1/README.md'),
      'utf8',
    )
    assert.match(readme, /F1_BLOCKED_BY_MISSING_FLYING_TRANSFORM_SOURCE/u)
  })
  check('no F1 Input module was created', () => {
    assert.equal(
      sourceFiles.some((path) => /d1F1Input/u.test(path)),
      false,
    )
  })

  console.log(`\n${checks} D1 P1 Adapter Bridge checks passed.`)
}

void run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
