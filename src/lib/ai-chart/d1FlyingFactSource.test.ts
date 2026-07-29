import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { MUTAGEN_TABLE } from '../../features/ziwei-chart/lib/engine/constants'
import { normalizeAiChartD1N0 } from './d1N0'
import {
  AI_CHART_D1_F1_BLOCKED_STATUS,
  AI_CHART_D1_PALACE_IDENTITIES,
} from './d1N0Constants'
import {
  AI_CHART_D1_FLYING_FACT_SOURCE_STATUS,
  parseAiChartD1FlyingFact,
} from './d1FlyingInfluenceContracts'
import {
  AI_CHART_D1_FLYING_FACT_SET_JSON_SCHEMA,
  AI_CHART_D1_FLYING_FACT_SET_SCHEMA_NAME,
  AI_CHART_D1_FLYING_FACT_SET_VERSION,
  AI_CHART_D1_FLYING_SOURCE_AUTHORITY,
  AI_CHART_D1_FLYING_TRANSFORMATION_TABLE,
  AI_CHART_D1_FLYING_TRANSFORMATION_TABLE_SOURCE_REF,
  AI_CHART_D1_FLYING_TRANSFORMATION_TABLE_VERSION,
  AiChartD1FlyingFactSourceError,
  buildAiChartD1FlyingFacts,
  validateAiChartD1FlyingFactSetAgainstN0,
  type AiChartD1FlyingFactSourceValidationReason,
} from './d1FlyingFactSource'

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
const STEMS = [
  '甲',
  '乙',
  '丙',
  '丁',
  '戊',
  '己',
  '庚',
  '辛',
  '壬',
  '癸',
] as const

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

function star(
  name: string,
  type: string,
  mutagen?: string,
): MutableRecord {
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
    lunarDate: 'synthetic-flying-source',
    fiveElementsClass: 'synthetic-flying-source',
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
  palaces[0].majorStars = [
    star('紫微', 'major'),
    star('七殺', 'major'),
  ]
  palaces[1].majorStars = [
    star('武曲', 'major', '化科'),
    star('貪狼', 'major'),
  ]
  palaces[2].majorStars = [
    star('廉貞', 'major', '化祿'),
    star('破軍', 'major', '化權'),
  ]
  palaces[3].majorStars = [
    star('天同', 'major'),
    star('太陰', 'major'),
  ]
  palaces[4].majorStars = [
    star('天機', 'major'),
    star('巨門', 'major'),
  ]
  palaces[5].majorStars = [
    star('太陽', 'major', '化忌'),
    star('天梁', 'major'),
  ]
  palaces[6].majorStars = [star('天府', 'major')]
  palaces[7].majorStars = [star('天相', 'major')]
  palaces[8].minorStars = [star('文昌', 'soft')]
  palaces[9].minorStars = [star('文曲', 'soft')]
  palaces[10].minorStars = [star('左輔', 'soft')]
  palaces[11].minorStars = [star('右弼', 'soft')]
  return snapshot
}

function createN0(snapshot: unknown = syntheticSnapshot()) {
  return normalizeAiChartD1N0(snapshot, {
    chartId: 'chart:synthetic-flying-source',
  })
}

function expectSourceInvalid(
  run: () => unknown,
  reasonCode: AiChartD1FlyingFactSourceValidationReason,
): void {
  try {
    run()
    assert.fail('expected flying fact source rejection')
  } catch (error) {
    assert.equal(error instanceof AiChartD1FlyingFactSourceError, true)
    if (!(error instanceof AiChartD1FlyingFactSourceError)) {
      assert.fail('expected AiChartD1FlyingFactSourceError')
    }
    assert.equal(error.message, 'ai_chart_d1_flying_fact_source_invalid')
    assert.equal(error.reasonCode, reasonCode)
    assert.equal(Object.isFrozen(error), true)
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

check('fixed table exactly matches the engine learning-association table', () => {
  assert.equal(AI_CHART_D1_FLYING_TRANSFORMATION_TABLE.length, 10)
  assert.deepEqual(
    AI_CHART_D1_FLYING_TRANSFORMATION_TABLE.map((row) => [
      row.LU,
      row.QUAN,
      row.KE,
      row.JI,
    ]),
    MUTAGEN_TABLE,
  )
  assert.deepEqual(
    AI_CHART_D1_FLYING_TRANSFORMATION_TABLE.map((row) => row.heavenlyStem),
    STEMS,
  )
})

check('builder creates one immutable 48-fact set from twelve source palaces', () => {
  const result = buildAiChartD1FlyingFacts(createN0())
  assert.equal(result.contractVersion, AI_CHART_D1_FLYING_FACT_SET_VERSION)
  assert.equal(result.facts.length, 48)
  assert.equal(new Set(result.facts.map((fact) => fact.flyingFactId)).size, 48)
  assert.equal(
    new Set(result.facts.map((fact) => fact.authoritativeInfluenceId)).size,
    48,
  )
  assert.equal(Object.isFrozen(result), true)
  assert.equal(Object.isFrozen(result.facts), true)
  assert.equal(result.facts.every(Object.isFrozen), true)
})

check('fact set binds the exact composite authority and remains non-callable', () => {
  const result = buildAiChartD1FlyingFacts(createN0())
  assert.equal(result.sourceAuthority, AI_CHART_D1_FLYING_SOURCE_AUTHORITY)
  assert.equal(
    result.transformationTableVersion,
    AI_CHART_D1_FLYING_TRANSFORMATION_TABLE_VERSION,
  )
  assert.equal(
    result.transformationTableSourceRef,
    AI_CHART_D1_FLYING_TRANSFORMATION_TABLE_SOURCE_REF,
  )
  assert.equal(result.openAiCallable, false)
  assert.equal(result.validationStatus, 'validated')
  assert.equal(
    AI_CHART_D1_FLYING_FACT_SOURCE_STATUS,
    'FLYING_FACT_SOURCE_AVAILABLE',
  )
  assert.equal(createN0().f1Readiness, AI_CHART_D1_F1_BLOCKED_STATUS)
})

check('甲 palace stem deterministically emits 廉貞祿、破軍權、武曲科、太陽忌', () => {
  const facts = buildAiChartD1FlyingFacts(createN0()).facts.slice(0, 4)
  assert.deepEqual(
    facts.map((fact) => ({
      targetPalaceId: fact.targetPalaceId,
      transformedStarRef: fact.transformedStarRef,
      transformationKind: fact.transformationKind,
      transformationActionRef: fact.transformationActionRef,
    })),
    [
      {
        targetPalaceId: 'palace:spouse',
        transformedStarRef: 'palace:spouse:star:major:0',
        transformationKind: 'LU',
        transformationActionRef: 'rule:transformation-action:lu',
      },
      {
        targetPalaceId: 'palace:spouse',
        transformedStarRef: 'palace:spouse:star:major:1',
        transformationKind: 'QUAN',
        transformationActionRef: 'rule:transformation-action:quan',
      },
      {
        targetPalaceId: 'palace:siblings',
        transformedStarRef: 'palace:siblings:star:major:0',
        transformationKind: 'KE',
        transformationActionRef: 'rule:transformation-action:ke',
      },
      {
        targetPalaceId: 'palace:health',
        transformedStarRef: 'palace:health:star:major:0',
        transformationKind: 'JI',
        transformationActionRef: 'rule:transformation-action:ji',
      },
    ],
  )
})

check('source palace stem and all fixed identifiers are program-owned', () => {
  const fact = buildAiChartD1FlyingFacts(createN0()).facts[0]
  assert.deepEqual(
    {
      flyingFactId: fact.flyingFactId,
      influenceId: fact.authoritativeInfluenceId,
      stemRef: fact.sourcePalaceStemRef,
      sourcePalaceId: fact.sourcePalaceId,
    },
    {
      flyingFactId: 'flying-fact:palace:ming:lu',
      influenceId: 'flying-influence:palace:ming:lu',
      stemRef: 'fact:palace:ming:heavenly-stem:jia',
      sourcePalaceId: 'palace:ming',
    },
  )
  assert.doesNotThrow(() => parseAiChartD1FlyingFact(fact))
})

check('major and supporting transformed stars use their exact K0 core rules', () => {
  const result = buildAiChartD1FlyingFacts(createN0())
  const major = result.facts.find(
    (fact) => fact.transformedStarRef === 'palace:spouse:star:major:0',
  )
  const wenchang = result.facts.find(
    (fact) => fact.transformedStarRef === 'palace:career:star:minor:0',
  )
  const zuofu = result.facts.find(
    (fact) => fact.transformedStarRef === 'palace:fortune:star:minor:0',
  )
  assert.equal(major?.transformedStarCoreRuleRef, 'rule:star:lianzhen:core')
  assert.equal(major?.transformedStarName, '廉貞')
  assert.equal(
    wenchang?.transformedStarCoreRuleRef,
    'rule:supporting:wenchang:core',
  )
  assert.equal(wenchang?.transformedStarName, '文昌')
  assert.equal(
    zuofu?.transformedStarCoreRuleRef,
    'rule:supporting:zuofu:core',
  )
  assert.equal(zuofu?.transformedStarName, '左輔')
})

check('source actor candidates are deterministic palace semantics, not model choices', () => {
  const facts = buildAiChartD1FlyingFacts(createN0()).facts
  const native = facts.find(
    (fact) =>
      fact.sourcePalaceId === 'palace:wealth' &&
      fact.transformationKind === 'LU',
  )
  const parents = facts.find(
    (fact) =>
      fact.sourcePalaceId === 'palace:parents' &&
      fact.transformationKind === 'LU',
  )
  assert.deepEqual(native?.sourceActorBindingRefs, ['actor:native'])
  assert.deepEqual(parents?.sourceActorBindingRefs, [
    'actor:father-or-paternal-elder',
    'actor:native',
    'actor:concrete-authority-person',
    'actor:interaction',
  ])
})

check('same natal transformation is preserved as a background fact', () => {
  const facts = buildAiChartD1FlyingFacts(createN0()).facts.slice(0, 4)
  assert.equal(
    facts.every((fact) => fact.natalBackgroundKind === 'SAME_TRANSFORMATION'),
    true,
  )
  assert.deepEqual(
    facts.map((fact) => fact.natalBackgroundFactRef),
    [
      'palace:spouse:star:major:0:mutagen:lu',
      'palace:spouse:star:major:1:mutagen:quan',
      'palace:siblings:star:major:0:mutagen:ke',
      'palace:health:star:major:0:mutagen:ji',
    ],
  )
})

check('different natal transformation remains separate and is not merged', () => {
  const fact = buildAiChartD1FlyingFacts(createN0()).facts.find(
    (candidate) =>
      candidate.sourcePalaceId === 'palace:siblings' &&
      candidate.transformationKind === 'LU',
  )
  assert.equal(fact?.transformedStarRef, 'palace:wealth:star:major:0')
  assert.equal(fact?.natalBackgroundKind, 'NONE')
  assert.equal(fact?.natalBackgroundFactRef, null)
})

check('validator accepts only the exact recomputed fact set', () => {
  const n0 = createN0()
  const supplied = buildAiChartD1FlyingFacts(n0)
  const validated = validateAiChartD1FlyingFactSetAgainstN0(supplied, n0)
  assert.deepEqual(validated, supplied)
  assert.notEqual(validated, supplied)
  assert.equal(Object.isFrozen(validated), true)
})

check('validator rejects a forged target, source actor list, or fact order', () => {
  const n0 = createN0()
  const forgedTarget = structuredClone(buildAiChartD1FlyingFacts(n0))
  ;(forgedTarget.facts[0] as MutableRecord).targetPalaceId = 'palace:wealth'
  expectSourceInvalid(
    () => validateAiChartD1FlyingFactSetAgainstN0(forgedTarget, n0),
    'FACT_SET_MISMATCH',
  )

  const forgedActors = structuredClone(buildAiChartD1FlyingFacts(n0))
  ;(forgedActors.facts[0] as MutableRecord).sourceActorBindingRefs = [
    'actor:father-or-paternal-elder',
  ]
  expectSourceInvalid(
    () => validateAiChartD1FlyingFactSetAgainstN0(forgedActors, n0),
    'FACT_SET_MISMATCH',
  )

  const reordered = structuredClone(buildAiChartD1FlyingFacts(n0))
  const reorderedFacts = reordered.facts as unknown as MutableRecord[]
  ;[reorderedFacts[0], reorderedFacts[1]] = [
    reorderedFacts[1],
    reorderedFacts[0],
  ]
  expectSourceInvalid(
    () => validateAiChartD1FlyingFactSetAgainstN0(reordered, n0),
    'FACT_SET_MISMATCH',
  )
})

check('missing transformed star fails closed before facts are returned', () => {
  const snapshot = syntheticSnapshot()
  const palaces = snapshot.palaces as MutableRecord[]
  palaces[10].minorStars = []
  expectSourceInvalid(
    () => buildAiChartD1FlyingFacts(createN0(snapshot)),
    'TRANSFORMED_STAR_MISSING',
  )
})

check('duplicate transformed star fails closed before facts are returned', () => {
  const snapshot = syntheticSnapshot()
  const palaces = snapshot.palaces as MutableRecord[]
  palaces[6].majorStars = [star('廉貞', 'major')]
  expectSourceInvalid(
    () => buildAiChartD1FlyingFacts(createN0(snapshot)),
    'TRANSFORMED_STAR_DUPLICATE',
  )
})

check('invalid N0 source fails with a fixed safe error', () => {
  const marker = 'synthetic-sensitive-flying-source-marker'
  expectSourceInvalid(
    () => buildAiChartD1FlyingFacts({ marker }),
    'SOURCE_N0_INVALID',
  )
  try {
    buildAiChartD1FlyingFacts({ marker })
  } catch (error) {
    assert.equal(JSON.stringify(error).includes(marker), false)
  }
})

check('fact-set Schema is strict, frozen, serializable, and internal-only', () => {
  assert.equal(
    AI_CHART_D1_FLYING_FACT_SET_SCHEMA_NAME,
    'ai_chart_d1_flying_fact_set_v1',
  )
  const root = schemaProperties(AI_CHART_D1_FLYING_FACT_SET_JSON_SCHEMA)
  assert.deepEqual(Object.keys(root), [
    'contractVersion',
    'chartId',
    'sourceN0ContractVersion',
    'sourceAuthority',
    'transformationTableVersion',
    'transformationTableSourceRef',
    'facts',
    'openAiCallable',
    'validationStatus',
  ])
  const serialized = JSON.stringify(AI_CHART_D1_FLYING_FACT_SET_JSON_SCHEMA)
  assert.doesNotThrow(() => JSON.parse(serialized))
  assert.equal(Object.isFrozen(AI_CHART_D1_FLYING_FACT_SET_JSON_SCHEMA), true)
  assert.equal(serialized.includes('uniqueItems'), false)
  assert.equal(serialized.includes('response_format'), false)
})

check('source module has no OpenAI, fetch, environment, or inference runtime', () => {
  const source = readFileSync(
    fileURLToPath(new URL('./d1FlyingFactSource.ts', import.meta.url)),
    'utf8',
  )
  assert.doesNotMatch(
    source,
    /requestAiChartOpenAi|openAiResponses|responses\.create|chat\.completions/iu,
  )
  assert.doesNotMatch(source, /\bfetch\s*\(/u)
  assert.doesNotMatch(source, /process\.env|OPENAI_API_KEY/u)
  assert.doesNotMatch(source, /directPalaceCause|lifeBridge|possibleOutcome/u)
})

console.log(`${checks} D1 Flying Fact Source checks passed.`)
