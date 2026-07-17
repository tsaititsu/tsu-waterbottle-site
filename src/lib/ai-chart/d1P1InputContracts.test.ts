import assert from 'node:assert/strict'
import {
  AI_CHART_D1_F1_BLOCKED_STATUS,
  AI_CHART_D1_P1_INPUT_INVALID,
  AI_CHART_D1_P1_STRUCTURAL_INPUT_CONTRACT_VERSION,
  AI_CHART_D1_PALACE_IDENTITIES,
} from './d1N0Constants'
import { normalizeAiChartD1N0 } from './d1N0'
import {
  AI_CHART_D1_P1_INPUT_SCHEMA_NAME,
  AI_CHART_D1_P1_STRUCTURAL_INPUT_JSON_SCHEMA,
  buildAiChartD1P1StructuralInputs,
  parseAiChartD1P1StructuralInput,
} from './d1P1InputContracts'
import { AI_CHART_D1_P1_F1_CONTRACT_VERSION } from './d1CommonContracts'

type MutableRecord = Record<string, unknown>

const BRANCHES = [
  '子',
  '丑',
  '寅',
  '卯',
  '辰',
  '巳',
  '午',
  '未',
  '申',
  '酉',
  '戌',
  '亥',
] as const
const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const

let checks = 0

function check(name: string, run: () => void) {
  try {
    run()
    checks += 1
    console.log(`✓ ${name}`)
  } catch (error) {
    console.error(`✗ ${name}`)
    throw error
  }
}

function star(name: string, type: string, mutagen?: string) {
  return {
    name,
    type,
    scope: 'origin',
    ...(mutagen === undefined ? {} : { mutagen }),
  }
}

function syntheticSnapshot(): MutableRecord {
  const snapshot: MutableRecord = {
    version: 'ai-chart-chart-snapshot/v1',
    source: 'waterbottle-ziwei-native',
    engineVersion: 'v1',
    birthInputVersion: 'ai-chart-birth-input/v1',
    lunarDate: 'synthetic-lunar-p1',
    fiveElementsClass: 'synthetic-elements-p1',
    palaces: AI_CHART_D1_PALACE_IDENTITIES.map((identity, index) => ({
      index,
      name: identity.engineName,
      isMingPalace: index === 0,
      isBodyPalace: index === 0,
      heavenlyStem: STEMS[index % STEMS.length],
      earthlyBranch: BRANCHES[index],
      majorStars: [] as MutableRecord[],
      minorStars: [] as MutableRecord[],
      adjectiveStars: [] as MutableRecord[],
      decadal: {
        range: [index * 10, index * 10 + 9],
        heavenlyStem: STEMS[(index + 1) % STEMS.length],
        earthlyBranch: BRANCHES[(index + 1) % BRANCHES.length],
      },
      ages: [index + 1],
    })),
  }
  const palaces = snapshot.palaces as MutableRecord[]
  palaces[0].majorStars = [star('天同', 'major', '化科'), star('太陰', 'major')]
  palaces[6].majorStars = [star('紫微', 'major'), star('天相', 'major', '化忌')]
  palaces[7].majorStars = [star('武曲', 'major', '化權')]
  palaces[8].majorStars = [star('太陽', 'major', '化祿')]
  palaces[9].majorStars = [star('天梁', 'major')]
  palaces[11].majorStars = [star('紫微', 'major'), star('天府', 'major')]
  palaces[2].minorStars = [star('擎羊', 'tough')]
  palaces[3].minorStars = [star('祿存', 'lucun')]
  palaces[5].minorStars = [star('地空', 'tough')]
  return snapshot
}

function createInputs() {
  const n0 = normalizeAiChartD1N0(syntheticSnapshot(), {
    chartId: 'chart:synthetic-p1',
  })
  const inputs = buildAiChartD1P1StructuralInputs(n0, {
    runId: 'run:synthetic-p1',
    callIds: Array.from({ length: 12 }, (_, index) => `call:synthetic-p1:${index}`),
  })
  return { n0, inputs }
}

function expectP1Invalid(value: unknown, marker?: string) {
  try {
    parseAiChartD1P1StructuralInput(value)
    assert.fail('expected P1 input validation failure')
  } catch (error) {
    assert.equal(error instanceof Error, true)
    if (!(error instanceof Error)) assert.fail('expected Error')
    assert.equal(error.message, AI_CHART_D1_P1_INPUT_INVALID)
    if (marker) assert.equal(error.message.includes(marker), false)
  }
}

function replaceStringDeep(value: unknown, from: string, to: string): void {
  if (value === null || typeof value !== 'object') return
  for (const [key, child] of Object.entries(value)) {
    if (typeof child === 'string') {
      ;(value as MutableRecord)[key] = child.replaceAll(from, to)
    } else {
      replaceStringDeep(child, from, to)
    }
  }
}

function schemaProperties(value: unknown): MutableRecord {
  assert.equal(typeof value, 'object')
  assert.notEqual(value, null)
  const properties = (value as MutableRecord).properties
  assert.equal(typeof properties, 'object')
  assert.notEqual(properties, null)
  return properties as MutableRecord
}

function recursivelyAssertForbiddenKeysAbsent(value: unknown) {
  const forbidden = new Set([
    'solarDate',
    'lunarDate',
    'timeIndex',
    'gender',
    'fixLeap',
    'birthInput',
    'userId',
    'user_id',
    'reportId',
    'orderId',
    'paymentId',
    'fiveElementsClass',
    'decadal',
    'ages',
    'heavenlyStem',
    'knowledge',
    'flyingTransformations',
    'prompt',
    'openAiRequest',
    'openAiResponse',
    'palaces',
    'relationships',
    'globalScan',
    'natalMutagens',
  ])
  const visit = (current: unknown): void => {
    if (current === null || typeof current !== 'object') return
    if (Array.isArray(current)) {
      current.forEach(visit)
      return
    }
    for (const [key, child] of Object.entries(current)) {
      assert.equal(forbidden.has(key), false, key)
      visit(child)
    }
  }
  visit(value)
}

check('P1 Structural Input version is locked and distinct from output', () => {
  const input = createInputs().inputs[0]
  assert.equal(input.contractVersion, AI_CHART_D1_P1_STRUCTURAL_INPUT_CONTRACT_VERSION)
  assert.notEqual(input.contractVersion, input.outputContractVersion)
})

check('P1 output contract version reference remains unchanged', () => {
  assert.equal(createInputs().inputs[0].outputContractVersion, AI_CHART_D1_P1_F1_CONTRACT_VERSION)
})

check('internal schema has a stable independent name', () => {
  assert.equal(AI_CHART_D1_P1_INPUT_SCHEMA_NAME, 'ai_chart_d1_p1_structural_input_v1')
})

check('unknown P1 input version is rejected', () => {
  const input = structuredClone(createInputs().inputs[0]) as MutableRecord
  input.contractVersion = 'ai-chart-d1-p1-structural-input/unknown'
  expectP1Invalid(input)
})

check('exactly twelve P1 Structural Inputs are built', () => {
  assert.equal(createInputs().inputs.length, 12)
})

check('all twelve target palaces are covered once', () => {
  const { inputs } = createInputs()
  assert.deepEqual(
    inputs.map((input) => input.targetPalace.palaceId),
    AI_CHART_D1_PALACE_IDENTITIES.map((identity) => identity.palaceId),
  )
  assert.equal(new Set(inputs.map((input) => input.targetPalace.palaceId)).size, 12)
})

check('P1 input order is fixed to target indices zero through eleven', () => {
  assert.deepEqual(
    createInputs().inputs.map((input) => input.targetPalace.index),
    [...Array(12).keys()],
  )
})

for (let index = 0; index < 12; index += 1) {
  check(`P1 input ${index} has correct target relations`, () => {
    const { inputs } = createInputs()
    const input = inputs[index]
    assert.equal(input.oppositePalace.palaceId, input.targetPalace.oppositePalaceId)
    assert.equal(
      input.hiddenCombinationPalace.palaceId,
      input.targetPalace.hiddenCombinationPalaceId,
    )
    assert.deepEqual(
      input.otherTrinePalaces.map((palace) => palace.palaceId),
      input.targetPalace.otherTrinePalaceIds,
    )
    assert.equal(input.otherTrinePalaces.length, 2)
    assert.equal(input.targetGlobalScan.palaceId, input.targetPalace.palaceId)
  })
}

check('call IDs are unique and trusted IDs are consistent', () => {
  const { inputs } = createInputs()
  assert.equal(new Set(inputs.map((input) => input.callId)).size, 12)
  assert.equal(new Set(inputs.map((input) => input.chartId)).size, 1)
  assert.equal(new Set(inputs.map((input) => input.runId)).size, 1)
  assert.equal(inputs[0].chartId, 'chart:synthetic-p1')
  assert.equal(inputs[0].runId, 'run:synthetic-p1')
  assert.deepEqual(
    inputs.map((input) => input.callId),
    Array.from({ length: 12 }, (_, index) => `call:synthetic-p1:${index}`),
  )
  assert.equal(
    inputs.every(
      (input, index) =>
        input.callId === `call:synthetic-p1:${input.targetPalace.index}` &&
        input.targetPalace.index === index,
    ),
    true,
  )
})

check('readiness is explicit and OpenAI cannot be called', () => {
  const inputs = createInputs().inputs
  for (const input of inputs) {
    assert.equal(['ready', 'partial'].includes(input.structuralStatus), true)
    assert.equal(input.knowledgeStatus, 'k0_required')
    assert.equal(input.promptStatus, 'prompt_builder_required')
    assert.equal(input.knowledgeBundleId, null)
    assert.equal(input.promptVersion, null)
    assert.equal(input.openAiCallable, false)
  }
  assert.equal(inputs.some((input) => input.structuralStatus === 'partial'), true)
  assert.equal(inputs.some((input) => input.structuralStatus === 'ready'), true)
})

check('P1 input has no fake knowledge or flying arrays', () => {
  const serialized = JSON.stringify(createInputs().inputs)
  assert.equal(serialized.includes('"knowledge"'), false)
  assert.equal(serialized.includes('flyingTransformations'), false)
})

check('P1 input does not embed complete N0 or PII', () => {
  const inputs = createInputs().inputs
  recursivelyAssertForbiddenKeysAbsent(inputs)
  const serialized = JSON.stringify(inputs)
  assert.equal(serialized.includes('synthetic-lunar-p1'), false)
  assert.equal(serialized.includes('synthetic-elements-p1'), false)
})

check('P1 star lists use canonical double-star order', () => {
  assert.deepEqual(
    createInputs().inputs[0].targetPalace.canonicalMajorStars.map((star) => star.name),
    ['太陰', '天同'],
  )
})

check('excluded stars do not enter P1 structural palace views', () => {
  const serialized = JSON.stringify(createInputs().inputs)
  assert.equal(serialized.includes('地空'), false)
  assert.equal(serialized.includes('excludedStarSummary'), false)
})

check('target scan resolves signal IDs into strict signal records', () => {
  const { n0, inputs } = createInputs()
  const signalIds = new Set(n0.globalScan.signals.map((signal) => signal.signalId))
  for (const input of inputs) {
    const scanSignals = [
      ...input.targetGlobalScan.directSignals,
      ...input.targetGlobalScan.oppositeSignals,
      ...input.targetGlobalScan.hiddenCombinationSignals,
      ...input.targetGlobalScan.trineSignals,
    ]
    assert.equal(scanSignals.every((signal) => signalIds.has(signal.signalId)), true)
    assert.equal(
      input.targetGlobalScan.totalRelevantCount,
      new Set(scanSignals.map((signal) => signal.signalId)).size,
    )
  }
})

check('P1 inputs share no mutable object references', () => {
  const { inputs } = createInputs()
  for (let left = 0; left < inputs.length; left += 1) {
    for (let right = left + 1; right < inputs.length; right += 1) {
      assert.notEqual(inputs[left].targetPalace, inputs[right].targetPalace)
      assert.notEqual(inputs[left].warnings, inputs[right].warnings)
      assert.notEqual(inputs[left].targetGlobalScan, inputs[right].targetGlobalScan)
    }
  }
})

check('P1 inputs are recursively deeply frozen', () => {
  const { inputs } = createInputs()
  for (const input of inputs) {
    assert.equal(Object.isFrozen(input), true)
    assert.equal(Object.isFrozen(input.targetPalace), true)
    assert.equal(Object.isFrozen(input.targetPalace.canonicalMajorStars), true)
    assert.equal(Object.isFrozen(input.otherTrinePalaces), true)
    assert.equal(Object.isFrozen(input.targetGlobalScan), true)
    assert.equal(Object.isFrozen(input.warnings), true)
  }
})

check('P1 parser creates an isolated deep copy', () => {
  const mutable = structuredClone(createInputs().inputs[0]) as MutableRecord
  const parsed = parseAiChartD1P1StructuralInput(mutable)
  const target = mutable.targetPalace as MutableRecord
  target.canonicalName = 'synthetic-mutated'
  assert.notEqual(parsed.targetPalace.canonicalName, target.canonicalName)
})

check('unknown P1 field is rejected', () => {
  const input = structuredClone(createInputs().inputs[0]) as MutableRecord
  input.unknown = true
  expectP1Invalid(input)
})

check('P1 standalone parser rejects a non-deterministic major placement ID', () => {
  const input = structuredClone(createInputs().inputs[0]) as MutableRecord
  replaceStringDeep(
    input,
    'palace:ming:star:major:1',
    'palace:ming:star:major:99',
  )
  expectP1Invalid(input)
})

check('P1 standalone parser rejects a synchronized signal placement mutation', () => {
  const input = structuredClone(createInputs().inputs[2]) as MutableRecord
  replaceStringDeep(
    input,
    'palace:spouse:star:minor:0',
    'palace:spouse:star:minor:99',
  )
  expectP1Invalid(input)
})

check('P1 standalone parser rejects a synchronized borrowed source mutation', () => {
  const input = structuredClone(createInputs().inputs[1]) as MutableRecord
  replaceStringDeep(
    input,
    'palace:friends:star:major:0',
    'palace:friends:star:major:99',
  )
  expectP1Invalid(input)
})

check('sourceIndex 128 is rejected by the P1 runtime parser', () => {
  const input = structuredClone(createInputs().inputs[0]) as MutableRecord
  const target = input.targetPalace as MutableRecord
  const stars = target.canonicalMajorStars as MutableRecord[]
  stars[0].sourceIndex = 128
  expectP1Invalid(input)
})

check('a major star with flower type is rejected', () => {
  const input = structuredClone(createInputs().inputs[0]) as MutableRecord
  const target = input.targetPalace as MutableRecord
  const stars = target.canonicalMajorStars as MutableRecord[]
  stars[0].type = 'flower'
  expectP1Invalid(input)
})

check('a major star with adjectiveStars collection is rejected', () => {
  const input = structuredClone(createInputs().inputs[0]) as MutableRecord
  const target = input.targetPalace as MutableRecord
  const stars = target.canonicalMajorStars as MutableRecord[]
  stars[0].sourceCollection = 'adjectiveStars'
  expectP1Invalid(input)
})

for (const type of ['adjective', 'helper', 'tianma']) {
  check(`a supporting star with ${type} type is rejected`, () => {
    const input = structuredClone(createInputs().inputs[2]) as MutableRecord
    const target = input.targetPalace as MutableRecord
    const stars = target.modeledSupportingStars as MutableRecord[]
    stars[0].type = type
    expectP1Invalid(input)
  })
}

check('a supporting star with adjectiveStars collection is rejected', () => {
  const input = structuredClone(createInputs().inputs[2]) as MutableRecord
  const target = input.targetPalace as MutableRecord
  const stars = target.modeledSupportingStars as MutableRecord[]
  stars[0].sourceCollection = 'adjectiveStars'
  expectP1Invalid(input)
})

check('duplicate call IDs are rejected before building inputs', () => {
  const { n0 } = createInputs()
  assert.throws(
    () =>
      buildAiChartD1P1StructuralInputs(n0, {
        runId: 'run:duplicate-call',
        callIds: Array.from({ length: 12 }, () => 'call:duplicate'),
      }),
    { message: AI_CHART_D1_P1_INPUT_INVALID },
  )
})

check('invalid run ID is rejected without echo', () => {
  const { n0 } = createInputs()
  const marker = 'invalid run id with spaces'
  try {
    buildAiChartD1P1StructuralInputs(n0, {
      runId: marker,
      callIds: Array.from({ length: 12 }, (_, index) => `call:invalid:${index}`),
    })
    assert.fail('expected invalid run ID')
  } catch (error) {
    assert.equal(error instanceof Error, true)
    if (!(error instanceof Error)) assert.fail('expected Error')
    assert.equal(error.message, AI_CHART_D1_P1_INPUT_INVALID)
    assert.equal(error.message.includes(marker), false)
  }
})

check('invalid target relation is rejected', () => {
  const input = structuredClone(createInputs().inputs[0]) as MutableRecord
  const opposite = input.oppositePalace as MutableRecord
  opposite.palaceId = 'palace:parents'
  expectP1Invalid(input)
})

check('invalid scan count is rejected', () => {
  const input = structuredClone(createInputs().inputs[0]) as MutableRecord
  const scan = input.targetGlobalScan as MutableRecord
  scan.totalRelevantCount = 512
  expectP1Invalid(input)
})

check('symbol keys are rejected by P1 parser', () => {
  const input = structuredClone(createInputs().inputs[0]) as MutableRecord
  Object.defineProperty(input, Symbol('synthetic'), {
    enumerable: true,
    value: true,
  })
  expectP1Invalid(input)
})

check('accessors are rejected without invocation by P1 parser', () => {
  const input = structuredClone(createInputs().inputs[0]) as MutableRecord
  let invoked = false
  Object.defineProperty(input, 'unknownAccessor', {
    enumerable: true,
    get() {
      invoked = true
      return 'synthetic'
    },
  })
  expectP1Invalid(input)
  assert.equal(invoked, false)
})

check('cycles are rejected by P1 parser', () => {
  const input = structuredClone(createInputs().inputs[0]) as MutableRecord
  input.cycle = input
  expectP1Invalid(input)
})

check('fixed safe P1 error never leaks malformed content', () => {
  const marker = 'synthetic-sensitive-p1-marker'
  const input = structuredClone(createInputs().inputs[0]) as MutableRecord
  input.task = marker
  expectP1Invalid(input, marker)
})

check('internal star schemas match the runtime parser boundaries', () => {
  const root = schemaProperties(AI_CHART_D1_P1_STRUCTURAL_INPUT_JSON_SCHEMA)
  const palace = schemaProperties(root.targetPalace)
  const majorArray = palace.canonicalMajorStars as MutableRecord
  const supportingArray = palace.modeledSupportingStars as MutableRecord
  const major = schemaProperties(majorArray.items)
  const supporting = schemaProperties(supportingArray.items)

  assert.equal((major.sourceIndex as MutableRecord).minimum, 0)
  assert.equal((major.sourceIndex as MutableRecord).maximum, 127)
  assert.deepEqual((major.name as MutableRecord).enum, [
    '紫微',
    '天機',
    '太陽',
    '武曲',
    '天同',
    '廉貞',
    '天府',
    '太陰',
    '貪狼',
    '巨門',
    '天相',
    '天梁',
    '七殺',
    '破軍',
  ])
  assert.deepEqual((major.type as MutableRecord).enum, ['major'])
  assert.deepEqual((major.sourceCollection as MutableRecord).enum, [
    'majorStars',
  ])
  assert.deepEqual((major.canonicalOrder as MutableRecord).type, [
    'integer',
    'null',
  ])

  assert.equal((supporting.sourceIndex as MutableRecord).minimum, 0)
  assert.equal((supporting.sourceIndex as MutableRecord).maximum, 127)
  assert.deepEqual((supporting.type as MutableRecord).enum, [
    'soft',
    'tough',
    'lucun',
  ])
  assert.deepEqual((supporting.sourceCollection as MutableRecord).enum, [
    'minorStars',
  ])
  assert.equal((supporting.canonicalOrder as MutableRecord).type, 'null')
})

check('internal count schemas match runtime maxima', () => {
  const root = schemaProperties(AI_CHART_D1_P1_STRUCTURAL_INPUT_JSON_SCHEMA)
  const scan = schemaProperties(root.targetGlobalScan)
  for (const field of [
    'directCount',
    'oppositeCount',
    'hiddenCombinationCount',
    'trineCount',
  ]) {
    assert.equal((scan[field] as MutableRecord).minimum, 0)
    assert.equal((scan[field] as MutableRecord).maximum, 128)
  }
  assert.equal((scan.totalRelevantCount as MutableRecord).minimum, 0)
  assert.equal((scan.totalRelevantCount as MutableRecord).maximum, 512)
})

check('internal schema is strict, serializable, frozen, and has no uniqueItems', () => {
  const serialized = JSON.stringify(AI_CHART_D1_P1_STRUCTURAL_INPUT_JSON_SCHEMA)
  assert.equal(serialized.includes('uniqueItems'), false)
  assert.equal(serialized.includes('additionalProperties'), true)
  assert.equal(Object.isFrozen(AI_CHART_D1_P1_STRUCTURAL_INPUT_JSON_SCHEMA), true)
  assert.deepEqual(JSON.parse(serialized), AI_CHART_D1_P1_STRUCTURAL_INPUT_JSON_SCHEMA)

  const visit = (schema: unknown): void => {
    if (schema === null || typeof schema !== 'object') return
    if (Array.isArray(schema)) {
      schema.forEach(visit)
      return
    }
    const record = schema as MutableRecord
    if (record.type === 'object') {
      assert.equal(record.additionalProperties, false)
      const properties = record.properties as MutableRecord
      assert.deepEqual(record.required, Object.keys(properties))
    }
    Object.values(record).forEach(visit)
  }
  visit(AI_CHART_D1_P1_STRUCTURAL_INPUT_JSON_SCHEMA)
})

check('F1 remains blocked and this module exposes no F1 input builder', () => {
  const { n0 } = createInputs()
  assert.equal(n0.f1Readiness, AI_CHART_D1_F1_BLOCKED_STATUS)
  assert.equal(JSON.stringify(createInputs().inputs).includes('flyingTransformations'), false)
})

assert.equal(checks >= 35, true, `expected at least 35 P1 checks, got ${checks}`)
console.log(`AI chart D1 P1 Structural Input tests passed (${checks} checks)`)
