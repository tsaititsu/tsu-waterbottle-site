import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  parseAiChartD1PalaceReasoningResult,
  type AiChartD1PalaceReasoningResult,
} from './d1PalaceIntegrationContracts'
import {
  AI_CHART_D1_FLYING_FACT_CONTRACT_VERSION,
  AI_CHART_D1_FLYING_FACT_JSON_SCHEMA,
  AI_CHART_D1_FLYING_FACT_SCHEMA_NAME,
  AI_CHART_D1_FLYING_FACT_SOURCE_STATUS,
  AI_CHART_D1_FLYING_INFLUENCE_RESULT_CONTRACT_VERSION,
  AI_CHART_D1_FLYING_INFLUENCE_RESULT_JSON_SCHEMA,
  AI_CHART_D1_FLYING_INFLUENCE_RESULT_SCHEMA_NAME,
  AiChartD1FlyingInfluenceError,
  parseAiChartD1FlyingFact,
  parseAiChartD1FlyingInfluenceResult,
  validateAiChartD1FlyingInfluenceResultAgainstSources,
  type AiChartD1FlyingInfluenceValidationReason,
} from './d1FlyingInfluenceContracts'

type MutableRecord = Record<string, unknown>

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

function clone<T>(value: T): T {
  return structuredClone(value)
}

function sourcePalaceResultFixture(): MutableRecord {
  return {
    contractVersion: 'ai-chart-d1-palace-reasoning-result/v1',
    palaceResultId: 'palace-result:synthetic:parents',
    chartId: 'chart:synthetic:flying',
    runId: 'run:synthetic:flying',
    callId: 'call:synthetic:parents',
    targetPalaceId: 'palace:parents',
    axisResultRef: 'axis:synthetic:parents',
    structuralInfluenceResultRef:
      'structural-influence-result:synthetic:parents',
    structuralInfluenceRefs: [],
    facetIndex: [
      {
        facetId: 'authority.upbringing',
        axisClaimRefs: ['claim:synthetic:parents:upbringing'],
        structuralInfluenceRefs: [],
      },
    ],
    sourceGraph: [
      {
        nodeRef: 'claim:synthetic:parents:upbringing',
        nodeKind: 'AXIS_CLAIM',
        sourceRefs: [
          'actor:father-or-paternal-elder',
          'actor:concrete-authority-person',
          'meaning:palace:parents:upbringing',
        ],
        targetRefs: [],
      },
    ],
    coverage: {
      facetIds: ['authority.upbringing'],
      axisClaimRefs: ['claim:synthetic:parents:upbringing'],
      structuralInfluenceRefs: [],
      sourceRefs: [
        'actor:father-or-paternal-elder',
        'actor:concrete-authority-person',
        'meaning:palace:parents:upbringing',
      ],
    },
    validationStatus: 'validated',
  }
}

function targetPalaceResultFixture(): MutableRecord {
  return {
    contractVersion: 'ai-chart-d1-palace-reasoning-result/v1',
    palaceResultId: 'palace-result:synthetic:wealth',
    chartId: 'chart:synthetic:flying',
    runId: 'run:synthetic:flying',
    callId: 'call:synthetic:wealth',
    targetPalaceId: 'palace:wealth',
    axisResultRef: 'axis:synthetic:wealth',
    structuralInfluenceResultRef:
      'structural-influence-result:synthetic:wealth',
    structuralInfluenceRefs: [],
    facetIndex: [
      {
        facetId: 'money.management',
        axisClaimRefs: ['claim:synthetic:wealth:management'],
        structuralInfluenceRefs: [],
      },
    ],
    sourceGraph: [
      {
        nodeRef: 'claim:synthetic:wealth:management',
        nodeKind: 'AXIS_CLAIM',
        sourceRefs: [
          'palace:wealth:star:major:0',
          'meaning:palace:wealth:management',
        ],
        targetRefs: [],
      },
    ],
    coverage: {
      facetIds: ['money.management'],
      axisClaimRefs: ['claim:synthetic:wealth:management'],
      structuralInfluenceRefs: [],
      sourceRefs: [
        'palace:wealth:star:major:0',
        'meaning:palace:wealth:management',
      ],
    },
    validationStatus: 'validated',
  }
}

function flyingFactFixture(): MutableRecord {
  return {
    contractVersion: 'ai-chart-d1-flying-fact/v1',
    flyingFactId: 'flying-fact:synthetic:parents-to-wealth:ji',
    authoritativeInfluenceId:
      'flying-influence:synthetic:parents-to-wealth:ji',
    chartId: 'chart:synthetic:flying',
    sourcePalaceId: 'palace:parents',
    sourcePalaceStemRef: 'fact:palace:parents:heavenly-stem',
    sourceActorBindingRefs: [
      'actor:father-or-paternal-elder',
      'actor:concrete-authority-person',
    ],
    targetPalaceId: 'palace:wealth',
    transformedStarName: '天機',
    transformedStarRef: 'palace:wealth:star:major:0',
    transformedStarCoreRuleRef: 'rule:star:tianji:core',
    transformationKind: 'JI',
    transformationActionRef: 'rule:transformation-action:ji',
    natalBackgroundKind: 'NONE',
    natalBackgroundFactRef: null,
    optionalOppositeCauseRef: null,
    validationStatus: 'validated',
  }
}

function expectedSourceRefs(
  fact: MutableRecord = flyingFactFixture(),
): string[] {
  return [
    fact.flyingFactId as string,
    'palace-result:synthetic:parents',
    'palace-result:synthetic:wealth',
    fact.sourcePalaceStemRef as string,
    fact.transformedStarRef as string,
    fact.transformedStarCoreRuleRef as string,
    fact.transformationActionRef as string,
    ...(fact.natalBackgroundFactRef === null
      ? []
      : [fact.natalBackgroundFactRef as string]),
    ...(fact.optionalOppositeCauseRef === null
      ? []
      : [fact.optionalOppositeCauseRef as string]),
  ]
}

function flyingInfluenceFixture(
  fact: MutableRecord = flyingFactFixture(),
): MutableRecord {
  return {
    contractVersion: 'ai-chart-d1-flying-influence-result/v1',
    flyingInfluenceId: fact.authoritativeInfluenceId,
    flyingFactRef: fact.flyingFactId,
    chartId: 'chart:synthetic:flying',
    runId: 'run:synthetic:flying',
    sourcePalaceResultRef: 'palace-result:synthetic:parents',
    sourcePalaceId: 'palace:parents',
    sourceActorBindingRefs: fact.sourceActorBindingRefs,
    targetPalaceResultRef: 'palace-result:synthetic:wealth',
    targetPalaceId: 'palace:wealth',
    targetFacetId: 'money.management',
    transformationKind: fact.transformationKind,
    transformationActionRef: fact.transformationActionRef,
    transformedStarRef: fact.transformedStarRef,
    transformedStarCoreRuleRef: fact.transformedStarCoreRuleRef,
    transformationCommonRuleRef: 'rule:mutagen:common:ji',
    transformationSpecificRuleRef: 'rule:mutagen:tianji:ji',
    directPalaceCause:
      'A source upbringing pattern can shape how the native handles money.',
    oppositeCauseRef: null,
    natalBackgroundRelation: 'NONE',
    starSpecificMechanism:
      'The selected star repeatedly searches for a workable method.',
    lifeBridge: {
      sourceExperience:
        'The native may absorb a recurring family message about money.',
      innerEffect:
        'The native may feel that the available method is still insufficient.',
      repeatedBehavior:
        'The native may repeatedly compare and revise ways to earn or manage money.',
      possibleOutcome:
        'The native may still feel uncertain after trying several approaches.',
    },
    constraints: [
      'This is a D1 possibility and does not assert that an event occurred.',
      'The influence cannot replace either palace result.',
    ],
    coverage: {
      sourceRefs: expectedSourceRefs(fact),
      knowledgeRuleRefs: [
        fact.transformedStarCoreRuleRef,
        'rule:mutagen:common:ji',
        'rule:mutagen:tianji:ji',
      ],
      sourceActorBindingRefs: fact.sourceActorBindingRefs,
      targetFacetIds: ['money.management'],
    },
    validationStatus: 'validated',
  }
}

function parseSourcePalaceResult(): AiChartD1PalaceReasoningResult {
  return parseAiChartD1PalaceReasoningResult(
    sourcePalaceResultFixture(),
  )
}

function parseTargetPalaceResult(): AiChartD1PalaceReasoningResult {
  return parseAiChartD1PalaceReasoningResult(
    targetPalaceResultFixture(),
  )
}

function expectFlyingInvalid(
  valueOrRun: unknown | (() => unknown),
  reasonCode: AiChartD1FlyingInfluenceValidationReason,
): void {
  try {
    if (typeof valueOrRun === 'function') {
      valueOrRun()
    } else {
      parseAiChartD1FlyingInfluenceResult(valueOrRun)
    }
    assert.fail('expected flying influence rejection')
  } catch (error) {
    assert.equal(error instanceof AiChartD1FlyingInfluenceError, true)
    if (!(error instanceof AiChartD1FlyingInfluenceError)) {
      assert.fail('expected AiChartD1FlyingInfluenceError')
    }
    assert.equal(
      error.message,
      'ai_chart_d1_flying_influence_invalid',
    )
    assert.equal(error.reasonCode, reasonCode)
  }
}

function schemaProperties(schema: unknown): MutableRecord {
  assert.equal(typeof schema, 'object')
  assert.notEqual(schema, null)
  const properties = (schema as MutableRecord).properties
  assert.equal(typeof properties, 'object')
  assert.notEqual(properties, null)
  return properties as MutableRecord
}

check('authoritative Flying Fact source is available outside this Contract', () => {
  assert.equal(
    AI_CHART_D1_FLYING_FACT_SOURCE_STATUS,
    'FLYING_FACT_SOURCE_AVAILABLE',
  )
})

check('strict Flying Fact parser preserves the fixed direction and action', () => {
  const fixture = flyingFactFixture()
  const parsed = parseAiChartD1FlyingFact(fixture)
  assert.equal(
    parsed.contractVersion,
    AI_CHART_D1_FLYING_FACT_CONTRACT_VERSION,
  )
  assert.equal(parsed.sourcePalaceId, 'palace:parents')
  assert.equal(parsed.targetPalaceId, 'palace:wealth')
  assert.deepEqual(parsed.sourceActorBindingRefs, [
    'actor:father-or-paternal-elder',
    'actor:concrete-authority-person',
  ])
  assert.equal(parsed.transformationKind, 'JI')
  assert.equal(
    parsed.transformationActionRef,
    'rule:transformation-action:ji',
  )
  fixture.sourcePalaceId = 'palace:ming'
  assert.equal(parsed.sourcePalaceId, 'palace:parents')
  assert.equal(Object.isFrozen(parsed), true)
})

check('Flying Fact rejects an action that does not match its transformation', () => {
  const fixture = flyingFactFixture()
  fixture.transformationActionRef = 'rule:transformation-action:lu'
  expectFlyingInvalid(
    () => parseAiChartD1FlyingFact(fixture),
    'FACT_SHAPE_INVALID',
  )
})

check('Flying Fact rejects an inconsistent natal background reference', () => {
  const missingReference = flyingFactFixture()
  missingReference.natalBackgroundKind = 'SAME_TRANSFORMATION'
  expectFlyingInvalid(
    () => parseAiChartD1FlyingFact(missingReference),
    'FACT_SHAPE_INVALID',
  )

  const unexpectedReference = flyingFactFixture()
  unexpectedReference.natalBackgroundFactRef =
    'fact:palace:wealth:natal:ji'
  expectFlyingInvalid(
    () => parseAiChartD1FlyingFact(unexpectedReference),
    'FACT_SHAPE_INVALID',
  )
})

check('Flying Influence parser preserves the causal order and immutable life bridge', () => {
  const parsed = parseAiChartD1FlyingInfluenceResult(
    flyingInfluenceFixture(),
  )
  assert.equal(
    parsed.contractVersion,
    AI_CHART_D1_FLYING_INFLUENCE_RESULT_CONTRACT_VERSION,
  )
  assert.equal(parsed.directPalaceCause.length > 0, true)
  assert.equal(parsed.starSpecificMechanism.length > 0, true)
  assert.equal(Object.isFrozen(parsed), true)
  assert.equal(Object.isFrozen(parsed.sourceActorBindingRefs), true)
  assert.equal(Object.isFrozen(parsed.lifeBridge), true)
  assert.equal(Object.isFrozen(parsed.constraints), true)
  assert.equal(Object.isFrozen(parsed.coverage), true)
})

check('Flying Influence rejects unknown fields with a fixed safe error', () => {
  const marker = 'synthetic-sensitive-flying-marker'
  const fixture = flyingInfluenceFixture()
  fixture.unknown = marker
  try {
    parseAiChartD1FlyingInfluenceResult(fixture)
    assert.fail('expected safe rejection')
  } catch (error) {
    assert.equal(error instanceof AiChartD1FlyingInfluenceError, true)
    assert.equal((error as Error).message.includes(marker), false)
    assert.equal(JSON.stringify(error).includes(marker), false)
  }
})

check('source validator accepts one authoritative directed influence chain', () => {
  const fact = parseAiChartD1FlyingFact(flyingFactFixture())
  const sourceResult = parseSourcePalaceResult()
  const targetResult = parseTargetPalaceResult()
  const sourceBefore = JSON.stringify(sourceResult)
  const targetBefore = JSON.stringify(targetResult)
  const parsed =
    validateAiChartD1FlyingInfluenceResultAgainstSources(
      flyingInfluenceFixture(),
      fact,
      sourceResult,
      targetResult,
    )
  assert.equal(parsed.flyingFactRef, fact.flyingFactId)
  assert.equal(
    parsed.flyingInfluenceId,
    fact.authoritativeInfluenceId,
  )
  assert.equal(
    parsed.sourcePalaceResultRef,
    sourceResult.palaceResultId,
  )
  assert.equal(
    parsed.targetPalaceResultRef,
    targetResult.palaceResultId,
  )
  assert.equal(JSON.stringify(sourceResult), sourceBefore)
  assert.equal(JSON.stringify(targetResult), targetBefore)
})

check('one Flying Fact cannot produce a second authoritative result identity', () => {
  const fact = parseAiChartD1FlyingFact(flyingFactFixture())
  const fixture = flyingInfluenceFixture()
  fixture.flyingInfluenceId =
    'flying-influence:synthetic:parents-to-wealth:duplicate'
  expectFlyingInvalid(
    () =>
      validateAiChartD1FlyingInfluenceResultAgainstSources(
        fixture,
        fact,
        parseSourcePalaceResult(),
        parseTargetPalaceResult(),
      ),
    'IDENTITY_OR_DIRECTION_MISMATCH',
  )
})

check('source validator rejects forged chart or flying direction', () => {
  const fact = parseAiChartD1FlyingFact(flyingFactFixture())
  const sourceResult = parseSourcePalaceResult()
  const targetResult = parseTargetPalaceResult()

  const forgedChart = flyingInfluenceFixture()
  forgedChart.chartId = 'chart:forged'
  expectFlyingInvalid(
    () =>
      validateAiChartD1FlyingInfluenceResultAgainstSources(
        forgedChart,
        fact,
        sourceResult,
        targetResult,
      ),
    'IDENTITY_OR_DIRECTION_MISMATCH',
  )

  const reversed = flyingInfluenceFixture()
  reversed.sourcePalaceId = 'palace:wealth'
  expectFlyingInvalid(
    () =>
      validateAiChartD1FlyingInfluenceResultAgainstSources(
        reversed,
        fact,
        sourceResult,
        targetResult,
      ),
    'IDENTITY_OR_DIRECTION_MISMATCH',
  )
})

check('source Actor candidates must remain the exact authoritative Fact set', () => {
  const fact = parseAiChartD1FlyingFact(flyingFactFixture())
  const fixture = flyingInfluenceFixture()
  fixture.sourceActorBindingRefs = ['actor:mother']
  ;(fixture.coverage as MutableRecord).sourceActorBindingRefs = [
    'actor:mother',
  ]
  expectFlyingInvalid(
    () =>
      validateAiChartD1FlyingInfluenceResultAgainstSources(
        fixture,
        fact,
        parseSourcePalaceResult(),
        parseTargetPalaceResult(),
      ),
    'SOURCE_ACTOR_SCOPE_INVALID',
  )
})

check('model output cannot narrow program-confirmed source Actor candidates', () => {
  const fact = parseAiChartD1FlyingFact(flyingFactFixture())
  const fixture = flyingInfluenceFixture()
  fixture.sourceActorBindingRefs = ['actor:father-or-paternal-elder']
  ;(fixture.coverage as MutableRecord).sourceActorBindingRefs = [
    'actor:father-or-paternal-elder',
  ]
  expectFlyingInvalid(
    () =>
      validateAiChartD1FlyingInfluenceResultAgainstSources(
        fixture,
        fact,
        parseSourcePalaceResult(),
        parseTargetPalaceResult(),
      ),
    'SOURCE_ACTOR_SCOPE_INVALID',
  )
})

check('a Registry-legal influence-only target facet need not already exist in the target Palace Result', () => {
  const fact = parseAiChartD1FlyingFact(flyingFactFixture())
  const fixture = flyingInfluenceFixture()
  fixture.targetFacetId = 'money.spending'
  ;(fixture.coverage as MutableRecord).targetFacetIds = [
    'money.spending',
  ]
  assert.equal(
    validateAiChartD1FlyingInfluenceResultAgainstSources(
      fixture,
      fact,
      parseSourcePalaceResult(),
      parseTargetPalaceResult(),
    ).targetFacetId,
    'money.spending',
  )
})

check('a facet outside the target Palace Registry remains invalid', () => {
  const fact = parseAiChartD1FlyingFact(flyingFactFixture())
  const fixture = flyingInfluenceFixture()
  fixture.targetFacetId = 'work.focus'
  ;(fixture.coverage as MutableRecord).targetFacetIds = ['work.focus']
  expectFlyingInvalid(
    () =>
      validateAiChartD1FlyingInfluenceResultAgainstSources(
        fixture,
        fact,
        parseSourcePalaceResult(),
        parseTargetPalaceResult(),
      ),
    'TARGET_FACET_INVALID',
  )
})

check('authoritative Fact bindings need not be repeated by prior Palace Result coverage', () => {
  const sourceFixture = sourcePalaceResultFixture()
  ;(
    (sourceFixture.sourceGraph as MutableRecord[])[0]
      .sourceRefs as string[]
  ) = ['meaning:palace:parents:upbringing']
  ;(sourceFixture.coverage as MutableRecord).sourceRefs = [
    'meaning:palace:parents:upbringing',
  ]

  const targetFixture = targetPalaceResultFixture()
  ;(
    (targetFixture.sourceGraph as MutableRecord[])[0]
      .sourceRefs as string[]
  ) = ['meaning:palace:wealth:management']
  ;(targetFixture.coverage as MutableRecord).sourceRefs = [
    'meaning:palace:wealth:management',
  ]

  const accepted =
    validateAiChartD1FlyingInfluenceResultAgainstSources(
      flyingInfluenceFixture(),
      parseAiChartD1FlyingFact(flyingFactFixture()),
      parseAiChartD1PalaceReasoningResult(sourceFixture),
      parseAiChartD1PalaceReasoningResult(targetFixture),
    )
  assert.deepEqual(accepted.sourceActorBindingRefs, [
    'actor:father-or-paternal-elder',
    'actor:concrete-authority-person',
  ])
  assert.equal(
    accepted.transformedStarRef,
    'palace:wealth:star:major:0',
  )
})

check('transformed star must be the exact existing target-palace star', () => {
  const fact = parseAiChartD1FlyingFact(flyingFactFixture())
  const fixture = flyingInfluenceFixture()
  fixture.transformedStarRef = 'palace:wealth:star:major:99'
  ;(fixture.coverage as MutableRecord).sourceRefs = expectedSourceRefs().map(
    (ref) =>
      ref === 'palace:wealth:star:major:0'
        ? 'palace:wealth:star:major:99'
        : ref,
  )
  expectFlyingInvalid(
    () =>
      validateAiChartD1FlyingInfluenceResultAgainstSources(
        fixture,
        fact,
        parseSourcePalaceResult(),
        parseTargetPalaceResult(),
      ),
    'FLYING_STAR_BINDING_INVALID',
  )
})

check('transformation and star-core rule must remain bound to the Flying Fact', () => {
  const fact = parseAiChartD1FlyingFact(flyingFactFixture())
  const wrongKind = flyingInfluenceFixture()
  wrongKind.transformationKind = 'LU'
  wrongKind.transformationActionRef =
    'rule:transformation-action:lu'
  ;(wrongKind.coverage as MutableRecord).sourceRefs =
    expectedSourceRefs().map((ref) =>
      ref === 'rule:transformation-action:ji'
        ? 'rule:transformation-action:lu'
        : ref,
    )
  expectFlyingInvalid(
    () =>
      validateAiChartD1FlyingInfluenceResultAgainstSources(
        wrongKind,
        fact,
        parseSourcePalaceResult(),
        parseTargetPalaceResult(),
      ),
    'TRANSFORMATION_BINDING_INVALID',
  )

  const wrongCore = flyingInfluenceFixture()
  wrongCore.transformedStarCoreRuleRef = 'rule:star:taiyin:core'
  ;(wrongCore.coverage as MutableRecord).sourceRefs =
    expectedSourceRefs().map((ref) =>
      ref === 'rule:star:tianji:core'
        ? 'rule:star:taiyin:core'
        : ref,
    )
  ;(wrongCore.coverage as MutableRecord).knowledgeRuleRefs = [
    'rule:star:taiyin:core',
    'rule:mutagen:common:ji',
    'rule:mutagen:tianji:ji',
  ]
  expectFlyingInvalid(
    () =>
      validateAiChartD1FlyingInfluenceResultAgainstSources(
        wrongCore,
        fact,
        parseSourcePalaceResult(),
        parseTargetPalaceResult(),
      ),
    'TRANSFORMATION_BINDING_INVALID',
  )
})

check('opposite cause can only use the exact optional Fact reference', () => {
  const factFixture = flyingFactFixture()
  factFixture.optionalOppositeCauseRef =
    'claim:synthetic:wealth:opposite-cause'
  const fact = parseAiChartD1FlyingFact(factFixture)
  const accepted = flyingInfluenceFixture(factFixture)
  accepted.oppositeCauseRef =
    'claim:synthetic:wealth:opposite-cause'
  assert.equal(
    validateAiChartD1FlyingInfluenceResultAgainstSources(
      accepted,
      fact,
      parseSourcePalaceResult(),
      parseTargetPalaceResult(),
    ).oppositeCauseRef,
    'claim:synthetic:wealth:opposite-cause',
  )

  const invented = clone(accepted)
  invented.oppositeCauseRef = 'claim:invented:opposite-cause'
  expectFlyingInvalid(
    () =>
      validateAiChartD1FlyingInfluenceResultAgainstSources(
        invented,
        fact,
        parseSourcePalaceResult(),
        parseTargetPalaceResult(),
      ),
    'OPPOSITE_CAUSE_INVALID',
  )
})

check('same natal transformation only permits trigger-style background relations', () => {
  const factFixture = flyingFactFixture()
  factFixture.natalBackgroundKind = 'SAME_TRANSFORMATION'
  factFixture.natalBackgroundFactRef =
    'fact:palace:wealth:natal:ji'
  const fact = parseAiChartD1FlyingFact(factFixture)

  const trigger = flyingInfluenceFixture(factFixture)
  trigger.natalBackgroundRelation = 'TRIGGER'
  assert.equal(
    validateAiChartD1FlyingInfluenceResultAgainstSources(
      trigger,
      fact,
      parseSourcePalaceResult(),
      parseTargetPalaceResult(),
    ).natalBackgroundRelation,
    'TRIGGER',
  )

  const newlyCaused = clone(trigger)
  newlyCaused.natalBackgroundRelation = 'NONE'
  expectFlyingInvalid(
    () =>
      validateAiChartD1FlyingInfluenceResultAgainstSources(
        newlyCaused,
        fact,
        parseSourcePalaceResult(),
        parseTargetPalaceResult(),
      ),
    'NATAL_BACKGROUND_INVALID',
  )
})

check('no natal background cannot claim trigger or amplification', () => {
  const fact = parseAiChartD1FlyingFact(flyingFactFixture())
  const fixture = flyingInfluenceFixture()
  fixture.natalBackgroundRelation = 'AMPLIFY'
  expectFlyingInvalid(
    () =>
      validateAiChartD1FlyingInfluenceResultAgainstSources(
        fixture,
        fact,
        parseSourcePalaceResult(),
        parseTargetPalaceResult(),
      ),
    'NATAL_BACKGROUND_INVALID',
  )
})

check('coverage is recomputed from trusted sources and cannot be self-declared', () => {
  const fact = parseAiChartD1FlyingFact(flyingFactFixture())
  const fixture = flyingInfluenceFixture()
  ;(fixture.coverage as MutableRecord).sourceRefs = [
    ...expectedSourceRefs(),
    'rule:invented:flying',
  ]
  expectFlyingInvalid(
    () =>
      validateAiChartD1FlyingInfluenceResultAgainstSources(
        fixture,
        fact,
        parseSourcePalaceResult(),
        parseTargetPalaceResult(),
      ),
    'COVERAGE_MISMATCH',
  )
})

check('Flying schemas are strict, serializable, frozen, and contain no OpenAI controls', () => {
  assert.equal(
    AI_CHART_D1_FLYING_FACT_SCHEMA_NAME,
    'ai_chart_d1_flying_fact_v1',
  )
  assert.equal(
    AI_CHART_D1_FLYING_INFLUENCE_RESULT_SCHEMA_NAME,
    'ai_chart_d1_flying_influence_result_v1',
  )
  const resultRoot = schemaProperties(
    AI_CHART_D1_FLYING_INFLUENCE_RESULT_JSON_SCHEMA,
  )
  for (const forbidden of [
    'model',
    'prompt',
    'instructions',
    'temperature',
    'reasoning',
    'maxOutputTokens',
    'retry',
  ]) {
    assert.equal(Object.hasOwn(resultRoot, forbidden), false)
  }
  for (const schema of [
    AI_CHART_D1_FLYING_FACT_JSON_SCHEMA,
    AI_CHART_D1_FLYING_INFLUENCE_RESULT_JSON_SCHEMA,
  ]) {
    const serialized = JSON.stringify(schema)
    assert.equal(serialized.includes('uniqueItems'), false)
    assert.equal(Object.isFrozen(schema), true)
    assert.deepEqual(JSON.parse(serialized), schema)
    const visit = (candidate: unknown): void => {
      if (candidate === null || typeof candidate !== 'object') return
      if (Array.isArray(candidate)) {
        candidate.forEach(visit)
        return
      }
      const record = candidate as MutableRecord
      if (record.type === 'object') {
        assert.equal(record.additionalProperties, false)
        const properties = record.properties as MutableRecord
        assert.deepEqual(record.required, Object.keys(properties))
      }
      Object.values(record).forEach(visit)
    }
    visit(schema)
  }
})

check('Flying Contract has no runtime, fetch, OpenAI, or authoritative formula implementation', () => {
  const source = readFileSync(
    fileURLToPath(
      new URL('./d1FlyingInfluenceContracts.ts', import.meta.url),
    ),
    'utf8',
  )
  assert.doesNotMatch(source, /\bfetch\s*\(/u)
  assert.doesNotMatch(source, /responses\.create|chat\.completions/u)
  assert.doesNotMatch(source, /OPENAI_API_KEY/u)
  assert.doesNotMatch(source, /MUTAGEN_TABLE/u)
  assert.doesNotMatch(source, /productionCallable\s*:\s*true/u)
})

console.log(
  `d1FlyingInfluenceContracts tests passed: ${checks} checks`,
)
