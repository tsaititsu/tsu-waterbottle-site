import assert from 'node:assert/strict'
import {
  AI_CHART_D1_PALACE_FACET_IDS,
  AI_CHART_D1_PALACE_FACET_REGISTRY,
  AI_CHART_D1_PALACE_FACET_REGISTRY_VERSION,
  assertAiChartD1PalaceFacetAllowed,
  isAiChartD1PalaceFacetAllowed,
} from './d1PalaceFacetRegistry'
import {
  AI_CHART_D1_ACTOR_BINDING_IDS,
  AI_CHART_D1_ACTOR_BINDING_REGISTRY,
  AI_CHART_D1_ACTOR_BINDING_REGISTRY_VERSION,
  AI_CHART_D1_ACTOR_BINDING_RULES,
  AI_CHART_D1_ACTOR_FACET_POLICIES,
  AI_CHART_D1_PALACE_AXIS_ACTORS,
  isAiChartD1ClaimActorBindingAllowed,
} from './d1PalaceActorBindingRegistry'
import {
  AI_CHART_D1_PALACE_AXIS_RESULT_CONTRACT_VERSION,
  AI_CHART_D1_PALACE_AXIS_RESULT_JSON_SCHEMA,
  AI_CHART_D1_PALACE_AXIS_RESULT_SCHEMA_NAME,
  AiChartD1PalaceAxisResultError,
  parseAiChartD1PalaceAxisResult,
  validateAiChartD1PalaceAxisResultAgainstStructuralInput,
  type AiChartD1PalaceAxisResult,
  type AiChartD1PalaceAxisValidationReason,
} from './d1PalaceAxisContracts'
import {
  AI_CHART_D1_STRUCTURAL_INFLUENCE_RESULT_CONTRACT_VERSION,
  AI_CHART_D1_STRUCTURAL_INFLUENCE_RESULT_JSON_SCHEMA,
  AI_CHART_D1_STRUCTURAL_INFLUENCE_RESULT_SCHEMA_NAME,
  AiChartD1StructuralInfluenceResultError,
  buildAiChartD1StructuralRelationViews,
  parseAiChartD1StructuralInfluenceResult,
  validateAiChartD1StructuralInfluenceResultAgainstSources,
  type AiChartD1StructuralInfluenceValidationReason,
} from './d1StructuralInfluenceContracts'
import {
  AI_CHART_D1_PALACE_REASONING_RESULT_CONTRACT_VERSION,
  AI_CHART_D1_PALACE_REASONING_RESULT_JSON_SCHEMA,
  AI_CHART_D1_PALACE_REASONING_RESULT_SCHEMA_NAME,
  AiChartD1PalaceReasoningResultError,
  buildAiChartD1PalaceReasoningResult,
  parseAiChartD1PalaceReasoningResult,
  validateAiChartD1PalaceReasoningResultAgainstSources,
  type AiChartD1PalaceReasoningValidationReason,
} from './d1PalaceIntegrationContracts'
import {
  completeModelInputSnapshot,
  createStructuralInputs,
} from './d1P1ModelInputTestSupport'
import type { AiChartD1P1StructuralInput } from './d1P1InputContracts'

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

function firstFacetForPalace(
  palaceId: AiChartD1P1StructuralInput['targetPalace']['palaceId'],
) {
  const facetId = AI_CHART_D1_PALACE_FACET_REGISTRY.find(
    (entry) => entry.palaceId === palaceId,
  )?.facetIds[0]
  assert.notEqual(facetId, undefined)
  if (!facetId) throw new Error('missing synthetic source facet')
  return facetId
}

function directAxisFixture(): MutableRecord {
  return {
    contractVersion: 'ai-chart-d1-palace-axis-result/v1',
    axisResultId: 'axis:synthetic:ming',
    chartId: 'chart:synthetic:axis',
    runId: 'run:synthetic:axis',
    callId: 'call:synthetic:axis:ming',
    targetPalaceId: 'palace:ming',
    oppositePalaceId: 'palace:travel',
    facetRegistryVersion: 'ai-chart-d1-palace-facet-registry/v1',
    actorBindingRegistryVersion: 'ai-chart-d1-actor-binding-registry/v1',
    targetCoreMode: 'DIRECT_MAIN_STARS',
    axisExpressionMode: 'OPPOSITE_CHANNEL',
    claims: [
      {
        claimId: 'claim:synthetic:ming:thinking',
        facetId: 'life.thinking_behavior',
        actor: 'NATIVE',
        actorBindingRefs: ['actor:native'],
        doubleStarCoreRef: null,
        interactionRoleBindings: null,
        palaceMeaningRefs: ['meaning:palace:ming:thinking'],
        targetCoreRefs: ['palace:ming:star:major:0'],
        targetLocalModifierRefs: [],
        oppositeExpressionRefs: ['palace:travel:star:major:0'],
        natalModifierRefs: [],
        mechanismLink:
          'Synthetic target core is expressed through the opposite channel.',
        possibleExpressions: ['Synthetic observable possibility.'],
        constraints: ['Synthetic D1 possibility boundary.'],
      },
    ],
    coverage: {
      claimIds: ['claim:synthetic:ming:thinking'],
      targetCoreRefsCovered: ['palace:ming:star:major:0'],
      targetLocalModifierRefsCovered: [],
      oppositeExpressionRefsCovered: ['palace:travel:star:major:0'],
      natalModifierRefsCovered: [],
    },
    validationStatus: 'validated',
  }
}

function axisFixtureForStructuralInput(
  structuralInput: AiChartD1P1StructuralInput,
): MutableRecord {
  const fixture = directAxisFixture()
  fixture.chartId = structuralInput.chartId
  fixture.runId = structuralInput.runId
  fixture.callId = structuralInput.callId
  fixture.targetPalaceId = structuralInput.targetPalace.palaceId
  fixture.oppositePalaceId = structuralInput.oppositePalace.palaceId
  const targetCoreRefs = structuralInput.targetPalace.canonicalMajorStars.map(
    (star) => star.placementId,
  )
  const oppositeExpressionRefs =
    structuralInput.oppositePalace.canonicalMajorStars.map(
      (star) => star.placementId,
    )
  const natalModifierRefs = [
    ...structuralInput.targetPalace.canonicalMajorStars,
    ...structuralInput.oppositePalace.canonicalMajorStars,
  ]
    .filter((star) => star.natalMutagen !== null)
    .map((star) => star.placementId)
  const claim = (fixture.claims as MutableRecord[])[0]
  claim.targetCoreRefs = targetCoreRefs
  claim.oppositeExpressionRefs = oppositeExpressionRefs
  claim.natalModifierRefs = natalModifierRefs
  const coverage = fixture.coverage as MutableRecord
  coverage.targetCoreRefsCovered = targetCoreRefs
  coverage.oppositeExpressionRefsCovered = oppositeExpressionRefs
  coverage.natalModifierRefsCovered = natalModifierRefs
  return fixture
}

function expectAxisInvalid(
  valueOrRun: unknown | (() => unknown),
  reasonCode: AiChartD1PalaceAxisValidationReason,
): void {
  try {
    if (typeof valueOrRun === 'function') {
      valueOrRun()
    } else {
      parseAiChartD1PalaceAxisResult(valueOrRun)
    }
    assert.fail('expected palace axis result rejection')
  } catch (error) {
    assert.equal(error instanceof AiChartD1PalaceAxisResultError, true)
    if (!(error instanceof AiChartD1PalaceAxisResultError)) {
      assert.fail('expected AiChartD1PalaceAxisResultError')
    }
    assert.equal(error.message, 'ai_chart_d1_palace_axis_result_invalid')
    assert.equal(error.reasonCode, reasonCode)
  }
}

function structuralInfluenceFixture(
  axisResult: AiChartD1PalaceAxisResult,
  structuralInput: AiChartD1P1StructuralInput,
): MutableRecord {
  const relation = buildAiChartD1StructuralRelationViews(
    structuralInput,
  ).find((view) => {
    if (view.relationKind !== 'TRINE_QUADRANT') return false
    const palace = structuralInput.otherTrinePalaces.find(
      (candidate) => candidate.palaceId === view.sourcePalaceId,
    )
    return palace?.modeledSupportingStars.some(
      (star) => star.type === 'soft' || star.type === 'lucun',
    )
  })
  assert.notEqual(relation, undefined)
  if (!relation) throw new Error('missing synthetic positive trine relation')
  const sourcePalace = structuralInput.otherTrinePalaces.find(
    (palace) => palace.palaceId === relation.sourcePalaceId,
  )
  assert.notEqual(sourcePalace, undefined)
  if (!sourcePalace) throw new Error('missing synthetic source palace')
  const trigger = sourcePalace.modeledSupportingStars.find(
    (star) => star.type === 'soft' || star.type === 'lucun',
  )
  assert.notEqual(trigger, undefined)
  if (!trigger) throw new Error('missing synthetic positive trigger')
  const sourceFacetId = firstFacetForPalace(relation.sourcePalaceId)

  const influenceId = 'influence:synthetic:ming:trine:positive'
  return {
    contractVersion:
      'ai-chart-d1-structural-influence-result/v1',
    structuralInfluenceResultId:
      'structural-influence-result:synthetic:ming',
    axisResultRef: axisResult.axisResultId,
    chartId: axisResult.chartId,
    runId: axisResult.runId,
    callId: axisResult.callId,
    targetPalaceId: axisResult.targetPalaceId,
    influences: [
      {
        influenceId,
        relationKind: relation.relationKind,
        visibility: relation.visibility,
        sourcePalaceId: relation.sourcePalaceId,
        sourceFacetId,
        sourceFactRefs: [relation.relationFactRef, trigger.placementId],
        targetPalaceId: axisResult.targetPalaceId,
        targetFacetId: axisResult.claims[0].facetId,
        targetClaimRefs: [axisResult.claims[0].claimId],
        influenceMode: 'SUPPORT',
        mechanismLink:
          'Synthetic trine support is attached without replacing the target claim.',
        possibleEffects: ['Synthetic observable supporting possibility.'],
        constraints: [
          'Synthetic influence cannot replace the axis conclusion.',
        ],
      },
    ],
    coverage: {
      influenceIds: [influenceId],
      trineInfluenceIds: [influenceId],
      hiddenCombinationInfluenceIds: [],
      sourcePalaceIdsCovered: [relation.sourcePalaceId],
      sourceFactRefsCovered: [relation.relationFactRef, trigger.placementId],
      targetClaimRefsCovered: [axisResult.claims[0].claimId],
    },
    validationStatus: 'validated',
  }
}

function expectStructuralInfluenceInvalid(
  valueOrRun: unknown | (() => unknown),
  reasonCode: AiChartD1StructuralInfluenceValidationReason,
): void {
  try {
    if (typeof valueOrRun === 'function') {
      valueOrRun()
    } else {
      parseAiChartD1StructuralInfluenceResult(valueOrRun)
    }
    assert.fail('expected structural influence rejection')
  } catch (error) {
    assert.equal(
      error instanceof AiChartD1StructuralInfluenceResultError,
      true,
    )
    if (!(error instanceof AiChartD1StructuralInfluenceResultError)) {
      assert.fail('expected AiChartD1StructuralInfluenceResultError')
    }
    assert.equal(
      error.message,
      'ai_chart_d1_structural_influence_result_invalid',
    )
    assert.equal(error.reasonCode, reasonCode)
  }
}

function expectPalaceReasoningInvalid(
  valueOrRun: unknown | (() => unknown),
  reasonCode: AiChartD1PalaceReasoningValidationReason,
): void {
  try {
    if (typeof valueOrRun === 'function') {
      valueOrRun()
    } else {
      parseAiChartD1PalaceReasoningResult(valueOrRun)
    }
    assert.fail('expected palace reasoning result rejection')
  } catch (error) {
    assert.equal(error instanceof AiChartD1PalaceReasoningResultError, true)
    if (!(error instanceof AiChartD1PalaceReasoningResultError)) {
      assert.fail('expected AiChartD1PalaceReasoningResultError')
    }
    assert.equal(
      error.message,
      'ai_chart_d1_palace_reasoning_result_invalid',
    )
    assert.equal(error.reasonCode, reasonCode)
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

check('palace facet Registry v1 is versioned and covers twelve palaces', () => {
  assert.equal(
    AI_CHART_D1_PALACE_FACET_REGISTRY_VERSION,
    'ai-chart-d1-palace-facet-registry/v1',
  )
  assert.equal(AI_CHART_D1_PALACE_FACET_REGISTRY.length, 12)
  assert.deepEqual(
    AI_CHART_D1_PALACE_FACET_REGISTRY.map((entry) => entry.palaceId),
    [
      'palace:ming',
      'palace:siblings',
      'palace:spouse',
      'palace:children',
      'palace:wealth',
      'palace:health',
      'palace:travel',
      'palace:friends',
      'palace:career',
      'palace:property',
      'palace:fortune',
      'palace:parents',
    ],
  )
})

check('the approved Registry has exactly 60 unique canonical facet IDs', () => {
  assert.equal(AI_CHART_D1_PALACE_FACET_IDS.length, 60)
  assert.equal(new Set(AI_CHART_D1_PALACE_FACET_IDS).size, 60)
  for (const retiredFacetId of [
    'life.appearance_optional',
    'possessions.owned_items',
    'body.appearance_optional',
  ]) {
    assert.ok(!AI_CHART_D1_PALACE_FACET_IDS.includes(retiredFacetId as never))
  }
})

check('confirmed palace boundaries are represented by exact facet ownership', () => {
  assert.equal(
    isAiChartD1PalaceFacetAllowed('palace:children', 'care.pets'),
    true,
  )
  assert.equal(
    isAiChartD1PalaceFacetAllowed(
      'palace:children',
      'reserve.saving_method',
    ),
    false,
  )
  assert.equal(
    isAiChartD1PalaceFacetAllowed(
      'palace:property',
      'reserve.saving_method',
    ),
    true,
  )
  assert.equal(
    isAiChartD1PalaceFacetAllowed('palace:friends', 'social.coworkers'),
    true,
  )
  assert.equal(
    isAiChartD1PalaceFacetAllowed(
      'palace:career',
      'social.coworkers',
    ),
    false,
  )
  assert.equal(
    AI_CHART_D1_PALACE_FACET_IDS.some(
      (facetId) =>
        facetId.includes('sexual') ||
        facetId.includes('fengshui') ||
        facetId.includes('supervisor_communication'),
    ),
    false,
  )
})

check('facet assertion rejects a cross-palace or unknown facet', () => {
  assert.equal(
    assertAiChartD1PalaceFacetAllowed(
      'palace:parents',
      'authority.elder_attitude',
    ),
    'authority.elder_attitude',
  )
  assert.throws(
    () =>
      assertAiChartD1PalaceFacetAllowed(
        'palace:parents',
        'body.inherited_tendency',
      ),
    { message: 'ai_chart_d1_palace_facet_invalid' },
  )
  assert.throws(
    () =>
      assertAiChartD1PalaceFacetAllowed(
        'palace:parents',
        'synthetic.unknown',
      ),
    { message: 'ai_chart_d1_palace_facet_invalid' },
  )
})

check('Registry values are recursively immutable', () => {
  assert.equal(Object.isFrozen(AI_CHART_D1_PALACE_FACET_REGISTRY), true)
  assert.equal(Object.isFrozen(AI_CHART_D1_PALACE_FACET_IDS), true)
  for (const entry of AI_CHART_D1_PALACE_FACET_REGISTRY) {
    assert.equal(Object.isFrozen(entry), true)
    assert.equal(Object.isFrozen(entry.facetIds), true)
  }
})

check('Actor Binding Registry is versioned and closes the actor vocabulary', () => {
  assert.equal(
    AI_CHART_D1_ACTOR_BINDING_REGISTRY_VERSION,
    'ai-chart-d1-actor-binding-registry/v1',
  )
  assert.deepEqual(AI_CHART_D1_PALACE_AXIS_ACTORS, [
    'NATIVE',
    'OTHER_PERSON',
    'INTERACTION',
  ])
  assert.equal(
    AI_CHART_D1_ACTOR_BINDING_IDS.includes(
      'actor:abstract-institution' as never,
    ),
    false,
  )
  assert.equal(
    new Set(AI_CHART_D1_ACTOR_BINDING_IDS).size,
    AI_CHART_D1_ACTOR_BINDING_IDS.length,
  )
})

check('every approved facet has one frozen Actor policy', () => {
  assert.equal(
    AI_CHART_D1_ACTOR_FACET_POLICIES.length,
    AI_CHART_D1_PALACE_FACET_IDS.length,
  )
  assert.deepEqual(
    AI_CHART_D1_ACTOR_FACET_POLICIES.map((policy) => policy.facetId),
    AI_CHART_D1_PALACE_FACET_IDS,
  )
  assert.equal(Object.isFrozen(AI_CHART_D1_ACTOR_FACET_POLICIES), true)
  for (const policy of AI_CHART_D1_ACTOR_FACET_POLICIES) {
    assert.equal(Object.isFrozen(policy), true)
    assert.equal(Object.isFrozen(policy.allowedClaimBindingIds), true)
    assert.equal(
      Object.isFrozen(policy.allowedInteractionFrontBindingIds),
      true,
    )
  }
})

check('existing parent actors and native relationship effects stay separate', () => {
  assert.equal(
    isAiChartD1ClaimActorBindingAllowed({
      facetId: 'authority.father_person',
      actor: 'OTHER_PERSON',
      actorBindingRefs: ['actor:father-or-paternal-elder'],
      interactionRoleBindings: null,
    }),
    true,
  )
  assert.equal(
    isAiChartD1ClaimActorBindingAllowed({
      facetId: 'authority.father_person',
      actor: 'NATIVE',
      actorBindingRefs: ['actor:native'],
      interactionRoleBindings: null,
    }),
    false,
  )
  assert.equal(
    isAiChartD1ClaimActorBindingAllowed({
      facetId: 'authority.relationship_impact',
      actor: 'NATIVE',
      actorBindingRefs: ['actor:native'],
      interactionRoleBindings: null,
    }),
    true,
  )
})

check('relationship-object possibilities cannot cross facet ownership', () => {
  assert.equal(
    isAiChartD1ClaimActorBindingAllowed({
      facetId: 'relationship.partner_possibility',
      actor: 'OTHER_PERSON',
      actorBindingRefs: ['actor:partner-possibility'],
      interactionRoleBindings: null,
    }),
    true,
  )
  assert.equal(
    isAiChartD1ClaimActorBindingAllowed({
      facetId: 'relationship.attitude',
      actor: 'OTHER_PERSON',
      actorBindingRefs: ['actor:partner-possibility'],
      interactionRoleBindings: null,
    }),
    false,
  )
  assert.equal(
    isAiChartD1ClaimActorBindingAllowed({
      facetId: 'care.pets',
      actor: 'OTHER_PERSON',
      actorBindingRefs: ['actor:partner-possibility'],
      interactionRoleBindings: null,
    }),
    false,
  )
})

check('concrete double-star interaction fixes front other and rear native', () => {
  assert.equal(
    isAiChartD1ClaimActorBindingAllowed({
      facetId: 'relationship.interaction',
      actor: 'INTERACTION',
      actorBindingRefs: ['actor:interaction'],
      interactionRoleBindings: {
        frontStarActorBindingRef: 'actor:partner-possibility',
        rearStarActorBindingRef: 'actor:native',
      },
    }),
    true,
  )
  assert.equal(
    isAiChartD1ClaimActorBindingAllowed({
      facetId: 'relationship.interaction',
      actor: 'INTERACTION',
      actorBindingRefs: ['actor:interaction'],
      interactionRoleBindings: {
        frontStarActorBindingRef: 'actor:native',
        rearStarActorBindingRef: 'actor:partner-possibility',
      },
    }),
    false,
  )
  assert.equal(
    isAiChartD1ClaimActorBindingAllowed({
      facetId: 'authority.institution',
      actor: 'INTERACTION',
      actorBindingRefs: ['actor:interaction'],
      interactionRoleBindings: {
        frontStarActorBindingRef: 'actor:abstract-institution',
        rearStarActorBindingRef: 'actor:native',
      },
    }),
    false,
  )
})

check('institution facet describes native stance or a concrete official interaction', () => {
  assert.equal(
    isAiChartD1ClaimActorBindingAllowed({
      facetId: 'authority.institution',
      actor: 'NATIVE',
      actorBindingRefs: ['actor:native'],
      interactionRoleBindings: null,
    }),
    true,
  )
  assert.equal(
    isAiChartD1ClaimActorBindingAllowed({
      facetId: 'authority.institution',
      actor: 'INTERACTION',
      actorBindingRefs: ['actor:interaction'],
      interactionRoleBindings: {
        frontStarActorBindingRef: 'actor:concrete-authority-person',
        rearStarActorBindingRef: 'actor:native',
      },
    }),
    true,
  )
})

check('Actor bindings cite only fixed module-owned rule sources', () => {
  const ruleIds = new Set(AI_CHART_D1_ACTOR_BINDING_RULES.map((rule) => rule.ruleId))
  assert.equal(ruleIds.size, AI_CHART_D1_ACTOR_BINDING_RULES.length)
  for (const binding of AI_CHART_D1_ACTOR_BINDING_REGISTRY) {
    assert.equal(binding.ruleSourceRefs.length > 0, true)
    assert.equal(
      binding.ruleSourceRefs.every((ruleId) => ruleIds.has(ruleId)),
      true,
    )
  }
  assert.equal(Object.isFrozen(AI_CHART_D1_ACTOR_BINDING_RULES), true)
  assert.equal(Object.isFrozen(AI_CHART_D1_ACTOR_BINDING_REGISTRY), true)
})

check('direct main-star axis result preserves target core and opposite channel', () => {
  const parsed = parseAiChartD1PalaceAxisResult(directAxisFixture())
  assert.equal(
    parsed.contractVersion,
    AI_CHART_D1_PALACE_AXIS_RESULT_CONTRACT_VERSION,
  )
  assert.equal(parsed.targetCoreMode, 'DIRECT_MAIN_STARS')
  assert.equal(parsed.axisExpressionMode, 'OPPOSITE_CHANNEL')
  assert.deepEqual(parsed.coverage.targetCoreRefsCovered, [
    'palace:ming:star:major:0',
  ])
  assert.deepEqual(parsed.coverage.oppositeExpressionRefsCovered, [
    'palace:travel:star:major:0',
  ])
})

check('borrowed core is mirrored and cannot be repeated as an opposite channel', () => {
  const fixture = directAxisFixture()
  fixture.targetCoreMode = 'BORROWED_MAIN_STARS'
  fixture.axisExpressionMode = 'MIRRORED_SAME_CORE'
  const claim = (fixture.claims as MutableRecord[])[0]
  claim.targetCoreRefs = ['palace:ming:borrowed:major:0']
  claim.oppositeExpressionRefs = []
  const coverage = fixture.coverage as MutableRecord
  coverage.targetCoreRefsCovered = ['palace:ming:borrowed:major:0']
  coverage.oppositeExpressionRefsCovered = []

  const parsed = parseAiChartD1PalaceAxisResult(fixture)
  assert.equal(parsed.axisExpressionMode, 'MIRRORED_SAME_CORE')
  assert.deepEqual(parsed.claims[0].oppositeExpressionRefs, [])

  const duplicated = clone(fixture)
  ;((duplicated.claims as MutableRecord[])[0].oppositeExpressionRefs as string[]).push(
    'palace:travel:star:major:0',
  )
  ;(
    (duplicated.coverage as MutableRecord)
      .oppositeExpressionRefsCovered as string[]
  ).push('palace:travel:star:major:0')
  expectAxisInvalid(
    duplicated,
    'BORROWED_STAR_DUPLICATED_AS_OPPOSITE',
  )
})

check('no-main-star axis cannot promote target or opposite stars into its core', () => {
  const fixture = directAxisFixture()
  fixture.targetCoreMode = 'NO_MAIN_STAR'
  fixture.axisExpressionMode = 'OPPOSITE_NOT_BORROWED'
  const claim = (fixture.claims as MutableRecord[])[0]
  claim.targetCoreRefs = []
  claim.targetLocalModifierRefs = ['palace:ming:star:minor:0']
  const coverage = fixture.coverage as MutableRecord
  coverage.targetCoreRefsCovered = []
  coverage.targetLocalModifierRefsCovered = [
    'palace:ming:star:minor:0',
  ]

  const parsed = parseAiChartD1PalaceAxisResult(fixture)
  assert.equal(parsed.axisExpressionMode, 'OPPOSITE_NOT_BORROWED')
  assert.deepEqual(parsed.claims[0].targetCoreRefs, [])

  const invalid = clone(fixture)
  ;((invalid.claims as MutableRecord[])[0].targetCoreRefs as string[]).push(
    'palace:travel:star:major:0',
  )
  ;(
    (invalid.coverage as MutableRecord).targetCoreRefsCovered as string[]
  ).push('palace:travel:star:major:0')
  expectAxisInvalid(invalid, 'TARGET_CORE_SCOPE_INVALID')
})

check('axis mode combinations are fixed by the target core mode', () => {
  const fixture = directAxisFixture()
  fixture.axisExpressionMode = 'MIRRORED_SAME_CORE'
  expectAxisInvalid(fixture, 'AXIS_MODE_MISMATCH')
})

check('claim facet must belong to the target palace Registry entry', () => {
  const fixture = directAxisFixture()
  ;(fixture.claims as MutableRecord[])[0].facetId = 'money.view'
  expectAxisInvalid(fixture, 'FACET_NOT_ALLOWED')
})

check('coverage is recomputed from claims and cannot be self-declared', () => {
  const fixture = directAxisFixture()
  ;(
    (fixture.coverage as MutableRecord).targetCoreRefsCovered as string[]
  ).push('palace:ming:star:major:99')
  expectAxisInvalid(fixture, 'COVERAGE_MISMATCH')
})

check('specific interaction role bindings require a complete double-star core', () => {
  const fixture = directAxisFixture()
  fixture.targetPalaceId = 'palace:spouse'
  fixture.oppositePalaceId = 'palace:career'
  const claim = (fixture.claims as MutableRecord[])[0]
  claim.facetId = 'relationship.interaction'
  claim.actor = 'INTERACTION'
  claim.actorBindingRefs = ['actor:interaction']
  claim.interactionRoleBindings = {
    frontStarActorBindingRef: 'actor:partner-possibility',
    rearStarActorBindingRef: 'actor:native',
  }
  expectAxisInvalid(fixture, 'ACTOR_BINDING_INVALID')

  claim.doubleStarCoreRef = 'rule:double-star:synthetic'
  const parsed = parseAiChartD1PalaceAxisResult(fixture)
  assert.equal(parsed.claims[0].actor, 'INTERACTION')
})

check('Axis parser source-binds Actor Registry and rejects cross-facet actors', () => {
  const parsed = parseAiChartD1PalaceAxisResult(directAxisFixture())
  assert.equal(
    parsed.actorBindingRegistryVersion,
    AI_CHART_D1_ACTOR_BINDING_REGISTRY_VERSION,
  )

  const wrongVersion = directAxisFixture()
  wrongVersion.actorBindingRegistryVersion =
    'ai-chart-d1-actor-binding-registry/v0'
  expectAxisInvalid(wrongVersion, 'RESULT_SHAPE_INVALID')

  const wrongActor = directAxisFixture()
  const claim = (wrongActor.claims as MutableRecord[])[0]
  claim.actor = 'OTHER_PERSON'
  claim.actorBindingRefs = ['actor:father-or-paternal-elder']
  expectAxisInvalid(wrongActor, 'ACTOR_BINDING_INVALID')
})

check('axis result parser isolates and deeply freezes untrusted input', () => {
  const fixture = directAxisFixture()
  const parsed = parseAiChartD1PalaceAxisResult(fixture)
  ;(fixture.claims as MutableRecord[])[0].mechanismLink = 'mutated'
  assert.notEqual(parsed.claims[0].mechanismLink, 'mutated')
  assert.equal(Object.isFrozen(parsed), true)
  assert.equal(Object.isFrozen(parsed.claims), true)
  assert.equal(Object.isFrozen(parsed.claims[0]), true)
  assert.equal(Object.isFrozen(parsed.coverage), true)
})

check('axis result uses a strict serializable JSON Schema without cross-module fields', () => {
  assert.equal(
    AI_CHART_D1_PALACE_AXIS_RESULT_SCHEMA_NAME,
    'ai_chart_d1_palace_axis_result_v1',
  )
  const root = schemaProperties(AI_CHART_D1_PALACE_AXIS_RESULT_JSON_SCHEMA)
  assert.equal(Object.hasOwn(root, 'hiddenCombinationInfluences'), false)
  assert.equal(Object.hasOwn(root, 'trineInfluences'), false)
  assert.equal(Object.hasOwn(root, 'flyingInfluences'), false)
  const serialized = JSON.stringify(
    AI_CHART_D1_PALACE_AXIS_RESULT_JSON_SCHEMA,
  )
  assert.equal(serialized.includes('additionalProperties'), true)
  assert.equal(serialized.includes('uniqueItems'), false)
  assert.equal(
    Object.isFrozen(AI_CHART_D1_PALACE_AXIS_RESULT_JSON_SCHEMA),
    true,
  )
  assert.deepEqual(
    JSON.parse(serialized),
    AI_CHART_D1_PALACE_AXIS_RESULT_JSON_SCHEMA,
  )

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
  visit(AI_CHART_D1_PALACE_AXIS_RESULT_JSON_SCHEMA)
})

check('unknown fields and sensitive markers fail with a fixed safe error', () => {
  const fixture = directAxisFixture()
  const marker = 'synthetic-sensitive-axis-marker'
  fixture.unknown = marker
  try {
    parseAiChartD1PalaceAxisResult(fixture)
    assert.fail('expected safe rejection')
  } catch (error) {
    assert.equal(error instanceof AiChartD1PalaceAxisResultError, true)
    assert.equal((error as Error).message.includes(marker), false)
    assert.equal(JSON.stringify(error).includes(marker), false)
  }
})

check('axis result identity and star references bind to trusted structural input', () => {
  const input = createStructuralInputs(
    completeModelInputSnapshot(),
    'axis-binding',
  )[0]
  const fixture = axisFixtureForStructuralInput(input)
  const parsed = validateAiChartD1PalaceAxisResultAgainstStructuralInput(
    fixture,
    input,
  )
  assert.equal(parsed.chartId, input.chartId)
  assert.equal(parsed.oppositePalaceId, input.oppositePalace.palaceId)
})

check('axis result rejects a forged chart identity or opposite relation', () => {
  const input = createStructuralInputs(
    completeModelInputSnapshot(),
    'axis-identity',
  )[0]
  const forgedChart = axisFixtureForStructuralInput(input)
  forgedChart.chartId = 'chart:forged'
  expectAxisInvalid(
    () =>
      validateAiChartD1PalaceAxisResultAgainstStructuralInput(
        forgedChart,
        input,
      ),
    'IDENTITY_OR_RELATION_MISMATCH',
  )

  const forgedOpposite = axisFixtureForStructuralInput(input)
  forgedOpposite.oppositePalaceId = 'palace:parents'
  expectAxisInvalid(
    () =>
      validateAiChartD1PalaceAxisResultAgainstStructuralInput(
        forgedOpposite,
        input,
      ),
    'IDENTITY_OR_RELATION_MISMATCH',
  )
})

check('axis result rejects a source reference absent from trusted structure', () => {
  const input = createStructuralInputs(
    completeModelInputSnapshot(),
    'axis-source',
  )[0]
  const fixture = axisFixtureForStructuralInput(input)
  const claim = (fixture.claims as MutableRecord[])[0]
  claim.targetCoreRefs = ['palace:ming:star:major:99']
  ;(fixture.coverage as MutableRecord).targetCoreRefsCovered = [
    'palace:ming:star:major:99',
  ]
  expectAxisInvalid(
    () =>
      validateAiChartD1PalaceAxisResultAgainstStructuralInput(
        fixture,
        input,
      ),
    'SOURCE_REFERENCE_INVALID',
  )
})

check('observation-only 地空 and 地劫 cannot become D1 claim modifiers', () => {
  const snapshot = completeModelInputSnapshot()
  const palaces = snapshot.palaces as MutableRecord[]
  ;(palaces[0].minorStars as MutableRecord[]).push({
    name: '地空',
    type: 'tough',
    scope: 'origin',
  })
  const input = createStructuralInputs(snapshot, 'axis-observation')[0]
  assert.deepEqual(
    input.targetPalace.observationOnlyStars.map((star) => star.name),
    ['地空'],
  )

  const fixture = axisFixtureForStructuralInput(input)
  const claim = (fixture.claims as MutableRecord[])[0]
  claim.targetLocalModifierRefs = ['palace:ming:star:minor:1']
  ;(fixture.coverage as MutableRecord).targetLocalModifierRefsCovered = [
    'palace:ming:star:minor:1',
  ]
  expectAxisInvalid(
    () =>
      validateAiChartD1PalaceAxisResultAgainstStructuralInput(
        fixture,
        input,
      ),
    'SOURCE_REFERENCE_INVALID',
  )
})

check('Structural Relation views expose only two trines and one latent hidden source', () => {
  const input = createStructuralInputs(
    completeModelInputSnapshot(),
    'structural-relations',
  )[0]
  const views = buildAiChartD1StructuralRelationViews(input)
  assert.equal(views.length, 3)
  assert.deepEqual(
    views
      .filter((view) => view.relationKind === 'TRINE_QUADRANT')
      .map((view) => view.sourcePalaceId),
    input.otherTrinePalaces.map((palace) => palace.palaceId),
  )
  assert.deepEqual(
    views
      .filter((view) => view.relationKind === 'HIDDEN_COMBINATION')
      .map((view) => view.sourcePalaceId),
    [input.hiddenCombinationPalace.palaceId],
  )
  assert.equal(
    views.some(
      (view) => view.sourcePalaceId === input.oppositePalace.palaceId,
    ),
    false,
  )
  assert.equal(
    views
      .filter((view) => view.relationKind === 'TRINE_QUADRANT')
      .every((view) => view.visibility === 'EXPLICIT'),
    true,
  )
  assert.equal(
    views.find(
      (view) => view.relationKind === 'HIDDEN_COMBINATION',
    )?.visibility,
    'LATENT',
  )
  assert.equal(Object.isFrozen(views), true)
  assert.equal(views.every((view) => Object.isFrozen(view)), true)
})

check('positive trine influence is source-bound without replacing the Axis result', () => {
  const input = createStructuralInputs(
    completeModelInputSnapshot(),
    'structural-positive',
  )[0]
  const axis = validateAiChartD1PalaceAxisResultAgainstStructuralInput(
    axisFixtureForStructuralInput(input),
    input,
  )
  const axisBefore = JSON.stringify(axis)
  const parsed = validateAiChartD1StructuralInfluenceResultAgainstSources(
    structuralInfluenceFixture(axis, input),
    axis,
    input,
  )
  assert.equal(parsed.influences[0].influenceMode, 'SUPPORT')
  assert.equal(parsed.influences[0].visibility, 'EXPLICIT')
  assert.equal(
    isAiChartD1PalaceFacetAllowed(
      parsed.influences[0].sourcePalaceId,
      parsed.influences[0].sourceFacetId,
    ),
    true,
  )
  assert.equal(JSON.stringify(axis), axisBefore)
  assert.equal(Object.hasOwn(parsed, 'claims'), false)
})

check('structural source facet must belong to the authenticated source palace', () => {
  const input = createStructuralInputs(
    completeModelInputSnapshot(),
    'structural-source-facet',
  )[0]
  const axis = validateAiChartD1PalaceAxisResultAgainstStructuralInput(
    axisFixtureForStructuralInput(input),
    input,
  )

  const wrongPalaceFacet = structuralInfluenceFixture(axis, input)
  ;(wrongPalaceFacet.influences as MutableRecord[])[0].sourceFacetId =
    'life.core_personality'
  expectStructuralInfluenceInvalid(
    wrongPalaceFacet,
    'SOURCE_FACET_INVALID',
  )

  const inventedFacet = structuralInfluenceFixture(axis, input)
  ;(inventedFacet.influences as MutableRecord[])[0].sourceFacetId =
    'children.generic_execution_domain'
  expectStructuralInfluenceInvalid(
    inventedFacet,
    'SOURCE_FACET_INVALID',
  )
})

check('hidden combination influence must remain latent and source-bound', () => {
  const input = createStructuralInputs(
    completeModelInputSnapshot(),
    'structural-hidden',
  )[0]
  const axis = validateAiChartD1PalaceAxisResultAgainstStructuralInput(
    axisFixtureForStructuralInput(input),
    input,
  )
  const fixture = structuralInfluenceFixture(axis, input)
  const relation = buildAiChartD1StructuralRelationViews(input).find(
    (view) => view.relationKind === 'HIDDEN_COMBINATION',
  )
  assert.notEqual(relation, undefined)
  if (!relation) throw new Error('missing synthetic hidden relation')
  const sourcePalace = input.hiddenCombinationPalace
  const positiveTrigger = [
    ...sourcePalace.canonicalMajorStars,
    ...sourcePalace.modeledSupportingStars,
  ].find(
    (star) =>
      star.natalMutagen === '化祿' ||
      star.natalMutagen === '化權' ||
      star.natalMutagen === '化科' ||
      star.type === 'soft' ||
      star.type === 'lucun',
  )
  assert.notEqual(positiveTrigger, undefined)
  if (!positiveTrigger) throw new Error('missing hidden positive trigger')
  const influence = (fixture.influences as MutableRecord[])[0]
  influence.relationKind = 'HIDDEN_COMBINATION'
  influence.visibility = 'LATENT'
  influence.sourcePalaceId = relation.sourcePalaceId
  influence.sourceFacetId = firstFacetForPalace(relation.sourcePalaceId)
  influence.sourceFactRefs = [
    relation.relationFactRef,
    positiveTrigger.placementId,
  ]
  const coverage = fixture.coverage as MutableRecord
  coverage.trineInfluenceIds = []
  coverage.hiddenCombinationInfluenceIds = [influence.influenceId]
  coverage.sourcePalaceIdsCovered = [relation.sourcePalaceId]
  coverage.sourceFactRefsCovered = [
    relation.relationFactRef,
    positiveTrigger.placementId,
  ]

  const parsed = validateAiChartD1StructuralInfluenceResultAgainstSources(
    fixture,
    axis,
    input,
  )
  assert.equal(parsed.influences[0].visibility, 'LATENT')

  const tooVisible = clone(fixture)
  ;(tooVisible.influences as MutableRecord[])[0].visibility = 'EXPLICIT'
  expectStructuralInfluenceInvalid(
    tooVisible,
    'VISIBILITY_MISMATCH',
  )
})

check('opposite palace cannot be reintroduced as a structural influence source', () => {
  const input = createStructuralInputs(
    completeModelInputSnapshot(),
    'structural-opposite',
  )[0]
  const axis = validateAiChartD1PalaceAxisResultAgainstStructuralInput(
    axisFixtureForStructuralInput(input),
    input,
  )
  const fixture = structuralInfluenceFixture(axis, input)
  const influence = (fixture.influences as MutableRecord[])[0]
  influence.sourcePalaceId = input.oppositePalace.palaceId
  influence.sourceFacetId = firstFacetForPalace(
    input.oppositePalace.palaceId,
  )
  influence.sourceFactRefs = [
    `relation:trine:${input.targetPalace.palaceId}:${input.oppositePalace.palaceId}`,
    input.oppositePalace.canonicalMajorStars[0].placementId,
  ]
  const coverage = fixture.coverage as MutableRecord
  coverage.sourcePalaceIdsCovered = [input.oppositePalace.palaceId]
  coverage.sourceFactRefsCovered = influence.sourceFactRefs
  expectStructuralInfluenceInvalid(
    () =>
      validateAiChartD1StructuralInfluenceResultAgainstSources(
        fixture,
        axis,
        input,
      ),
    'STRUCTURAL_RELATION_UNVERIFIED',
  )
})

check('positive and negative structural triggers cannot be mislabeled or mixed', () => {
  const input = createStructuralInputs(
    completeModelInputSnapshot(),
    'structural-mode',
  )[0]
  const axis = validateAiChartD1PalaceAxisResultAgainstStructuralInput(
    axisFixtureForStructuralInput(input),
    input,
  )
  const positive = structuralInfluenceFixture(axis, input)
  ;(positive.influences as MutableRecord[])[0].influenceMode =
    'INTERFERE'
  expectStructuralInfluenceInvalid(
    () =>
      validateAiChartD1StructuralInfluenceResultAgainstSources(
        positive,
        axis,
        input,
      ),
    'SOURCE_MODE_MISMATCH',
  )

  const negativeRelation = buildAiChartD1StructuralRelationViews(
    input,
  ).find((view) => {
    if (view.relationKind !== 'TRINE_QUADRANT') return false
    const palace = input.otherTrinePalaces.find(
      (candidate) => candidate.palaceId === view.sourcePalaceId,
    )
    return palace?.modeledSupportingStars.some(
      (star) => star.type === 'tough',
    )
  })
  assert.notEqual(negativeRelation, undefined)
  if (!negativeRelation) throw new Error('missing negative trine relation')
  const negativePalace = input.otherTrinePalaces.find(
    (palace) => palace.palaceId === negativeRelation.sourcePalaceId,
  )
  assert.notEqual(negativePalace, undefined)
  if (!negativePalace) throw new Error('missing negative source palace')
  const negativeTrigger = negativePalace.modeledSupportingStars.find(
    (star) => star.type === 'tough',
  )
  assert.notEqual(negativeTrigger, undefined)
  if (!negativeTrigger) throw new Error('missing negative trigger')

  const negative = structuralInfluenceFixture(axis, input)
  const influence = (negative.influences as MutableRecord[])[0]
  influence.sourcePalaceId = negativeRelation.sourcePalaceId
  influence.sourceFacetId = firstFacetForPalace(
    negativeRelation.sourcePalaceId,
  )
  influence.sourceFactRefs = [
    negativeRelation.relationFactRef,
    negativeTrigger.placementId,
  ]
  influence.influenceMode = 'PRESSURE'
  const coverage = negative.coverage as MutableRecord
  coverage.sourcePalaceIdsCovered = [negativeRelation.sourcePalaceId]
  coverage.sourceFactRefsCovered = influence.sourceFactRefs
  const parsed = validateAiChartD1StructuralInfluenceResultAgainstSources(
    negative,
    axis,
    input,
  )
  assert.equal(parsed.influences[0].influenceMode, 'PRESSURE')

  const mixedSnapshot = completeModelInputSnapshot()
  const mixedPalaces = mixedSnapshot.palaces as MutableRecord[]
  const positiveTrine = mixedPalaces[4]
  const negativeTrine = mixedPalaces[8]
  ;(positiveTrine.minorStars as MutableRecord[]).push(
    ...(negativeTrine.minorStars as MutableRecord[]),
  )
  negativeTrine.minorStars = []
  const mixedInput = createStructuralInputs(
    mixedSnapshot,
    'structural-mixed-mode',
  )[0]
  const mixedAxis =
    validateAiChartD1PalaceAxisResultAgainstStructuralInput(
      axisFixtureForStructuralInput(mixedInput),
      mixedInput,
    )
  const mixed = structuralInfluenceFixture(mixedAxis, mixedInput)
  const mixedSourcePalace = mixedInput.otherTrinePalaces.find(
    (palace) =>
      palace.palaceId ===
      (mixed.influences as MutableRecord[])[0].sourcePalaceId,
  )
  const mixedNegativeTrigger =
    mixedSourcePalace?.modeledSupportingStars.find(
      (star) => star.type === 'tough',
    )
  assert.notEqual(mixedNegativeTrigger, undefined)
  if (!mixedNegativeTrigger) {
    throw new Error('missing synthetic mixed negative trigger')
  }
  ;(
    (mixed.influences as MutableRecord[])[0].sourceFactRefs as string[]
  ).push(mixedNegativeTrigger.placementId)
  ;(
    (mixed.coverage as MutableRecord).sourceFactRefsCovered as string[]
  ).push(mixedNegativeTrigger.placementId)
  expectStructuralInfluenceInvalid(
    () =>
      validateAiChartD1StructuralInfluenceResultAgainstSources(
        mixed,
        mixedAxis,
        mixedInput,
      ),
    'SOURCE_MODE_MISMATCH',
  )
})

check('observation-only 地空 and 地劫 cannot trigger D1 structural influences', () => {
  const snapshot = completeModelInputSnapshot()
  const palaces = snapshot.palaces as MutableRecord[]
  ;(palaces[4].minorStars as MutableRecord[]).push({
    name: '地空',
    type: 'tough',
    scope: 'origin',
  })
  const input = createStructuralInputs(
    snapshot,
    'structural-observation-only',
  )[0]
  const axis = validateAiChartD1PalaceAxisResultAgainstStructuralInput(
    axisFixtureForStructuralInput(input),
    input,
  )
  const fixture = structuralInfluenceFixture(axis, input)
  const influence = (fixture.influences as MutableRecord[])[0]
  const sourcePalace = input.otherTrinePalaces.find(
    (palace) => palace.palaceId === influence.sourcePalaceId,
  )
  const observation = sourcePalace?.observationOnlyStars.find(
    (star) => star.name === '地空',
  )
  assert.notEqual(observation, undefined)
  if (!observation) {
    throw new Error('missing synthetic observation-only source')
  }
  const relationFactRef = (influence.sourceFactRefs as string[])[0]
  influence.sourceFactRefs = [
    relationFactRef,
    observation.placementId,
  ]
  const coverage = fixture.coverage as MutableRecord
  coverage.sourceFactRefsCovered = influence.sourceFactRefs
  expectStructuralInfluenceInvalid(
    () =>
      validateAiChartD1StructuralInfluenceResultAgainstSources(
        fixture,
        axis,
        input,
      ),
    'SOURCE_FACT_REFERENCE_INVALID',
  )
})

check('target claim references must exist and stay within the selected facet', () => {
  const input = createStructuralInputs(
    completeModelInputSnapshot(),
    'structural-target',
  )[0]
  const axis = validateAiChartD1PalaceAxisResultAgainstStructuralInput(
    axisFixtureForStructuralInput(input),
    input,
  )
  const fixture = structuralInfluenceFixture(axis, input)
  const emptyTarget = clone(fixture)
  ;(emptyTarget.influences as MutableRecord[])[0].targetClaimRefs = []
  ;(emptyTarget.coverage as MutableRecord).targetClaimRefsCovered = []
  const parsed = validateAiChartD1StructuralInfluenceResultAgainstSources(
    emptyTarget,
    axis,
    input,
  )
  assert.deepEqual(parsed.influences[0].targetClaimRefs, [])

  const unknownClaim = clone(fixture)
  ;(unknownClaim.influences as MutableRecord[])[0].targetClaimRefs = [
    'claim:synthetic:unknown',
  ]
  ;(unknownClaim.coverage as MutableRecord).targetClaimRefsCovered = [
    'claim:synthetic:unknown',
  ]
  expectStructuralInfluenceInvalid(
    () =>
      validateAiChartD1StructuralInfluenceResultAgainstSources(
        unknownClaim,
        axis,
        input,
      ),
    'TARGET_CLAIM_REFERENCE_INVALID',
  )
})

check('coverage is derived from influences and cannot omit a source', () => {
  const input = createStructuralInputs(
    completeModelInputSnapshot(),
    'structural-coverage',
  )[0]
  const axis = validateAiChartD1PalaceAxisResultAgainstStructuralInput(
    axisFixtureForStructuralInput(input),
    input,
  )
  const fixture = structuralInfluenceFixture(axis, input)
  ;(fixture.coverage as MutableRecord).sourceFactRefsCovered = []
  expectStructuralInfluenceInvalid(fixture, 'COVERAGE_MISMATCH')
})

check('Structural Influence Schema is strict and excludes Axis overrides and flying data', () => {
  assert.equal(
    AI_CHART_D1_STRUCTURAL_INFLUENCE_RESULT_CONTRACT_VERSION,
    'ai-chart-d1-structural-influence-result/v1',
  )
  assert.equal(
    AI_CHART_D1_STRUCTURAL_INFLUENCE_RESULT_SCHEMA_NAME,
    'ai_chart_d1_structural_influence_result_v1',
  )
  const root = schemaProperties(
    AI_CHART_D1_STRUCTURAL_INFLUENCE_RESULT_JSON_SCHEMA,
  )
  assert.equal(Object.hasOwn(root, 'claims'), false)
  assert.equal(Object.hasOwn(root, 'axisResult'), false)
  assert.equal(Object.hasOwn(root, 'flyingInfluences'), false)
  const serialized = JSON.stringify(
    AI_CHART_D1_STRUCTURAL_INFLUENCE_RESULT_JSON_SCHEMA,
  )
  assert.equal(serialized.includes('uniqueItems'), false)
  assert.equal(serialized.includes('flying'), false)
  assert.equal(
    Object.isFrozen(
      AI_CHART_D1_STRUCTURAL_INFLUENCE_RESULT_JSON_SCHEMA,
    ),
    true,
  )
})

check('Structural Influence errors are safe and parsed results are immutable', () => {
  const input = createStructuralInputs(
    completeModelInputSnapshot(),
    'structural-safety',
  )[0]
  const axis = validateAiChartD1PalaceAxisResultAgainstStructuralInput(
    axisFixtureForStructuralInput(input),
    input,
  )
  const fixture = structuralInfluenceFixture(axis, input)
  const parsed = validateAiChartD1StructuralInfluenceResultAgainstSources(
    fixture,
    axis,
    input,
  )
  assert.equal(Object.isFrozen(parsed), true)
  assert.equal(Object.isFrozen(parsed.influences), true)
  assert.equal(Object.isFrozen(parsed.influences[0]), true)
  assert.equal(Object.isFrozen(parsed.coverage), true)

  const marker = 'synthetic-sensitive-structural-marker'
  const hostile = clone(fixture)
  hostile.flyingOutput = marker
  try {
    parseAiChartD1StructuralInfluenceResult(hostile)
    assert.fail('expected structural influence safe rejection')
  } catch (error) {
    assert.equal(
      error instanceof AiChartD1StructuralInfluenceResultError,
      true,
    )
    assert.equal((error as Error).message.includes(marker), false)
    assert.equal(JSON.stringify(error).includes(marker), false)
  }
})

check('Palace Integration deterministically indexes Axis and Structural results without rewriting them', () => {
  const input = createStructuralInputs(
    completeModelInputSnapshot(),
    'palace-integration',
  )[0]
  const axis = validateAiChartD1PalaceAxisResultAgainstStructuralInput(
    axisFixtureForStructuralInput(input),
    input,
  )
  const structural =
    validateAiChartD1StructuralInfluenceResultAgainstSources(
      structuralInfluenceFixture(axis, input),
      axis,
      input,
    )
  const axisBefore = JSON.stringify(axis)
  const structuralBefore = JSON.stringify(structural)

  const result = buildAiChartD1PalaceReasoningResult({
    palaceResultId: 'palace-reasoning-result:synthetic:ming',
    axisResult: axis,
    structuralInfluenceResult: structural,
    structuralInput: input,
  })

  assert.equal(
    result.contractVersion,
    'ai-chart-d1-palace-reasoning-result/v1',
  )
  assert.equal(result.axisResultRef, axis.axisResultId)
  assert.equal(
    result.structuralInfluenceResultRef,
    structural.structuralInfluenceResultId,
  )
  assert.deepEqual(
    result.structuralInfluenceRefs,
    structural.influences.map((influence) => influence.influenceId),
  )
  assert.deepEqual(result.coverage.axisClaimRefs, [
    axis.claims[0].claimId,
  ])
  assert.deepEqual(result.coverage.structuralInfluenceRefs, [
    structural.influences[0].influenceId,
  ])
  assert.equal(
    result.sourceGraph.some(
      (entry) =>
        entry.nodeRef === axis.claims[0].claimId &&
        entry.nodeKind === 'AXIS_CLAIM',
    ),
    true,
  )
  assert.equal(
    result.sourceGraph.some(
      (entry) =>
        entry.nodeRef === structural.influences[0].influenceId &&
        entry.nodeKind === 'STRUCTURAL_INFLUENCE',
    ),
    true,
  )
  assert.equal(Object.hasOwn(result, 'summary'), false)
  assert.equal(Object.hasOwn(result, 'claims'), false)
  assert.equal(Object.hasOwn(result, 'influences'), false)
  assert.equal(Object.hasOwn(result, 'score'), false)
  assert.equal(JSON.stringify(axis), axisBefore)
  assert.equal(JSON.stringify(structural), structuralBefore)
  assert.equal(Object.isFrozen(result), true)
  assert.equal(Object.isFrozen(result.facetIndex), true)
  assert.equal(Object.isFrozen(result.sourceGraph), true)
})

check('Palace Integration keeps an influence-only facet without inventing an Axis claim', () => {
  const input = createStructuralInputs(
    completeModelInputSnapshot(),
    'palace-integration-influence-facet',
  )[0]
  const axis = validateAiChartD1PalaceAxisResultAgainstStructuralInput(
    axisFixtureForStructuralInput(input),
    input,
  )
  const fixture = structuralInfluenceFixture(axis, input)
  const influence = (fixture.influences as MutableRecord[])[0]
  influence.targetFacetId = 'life.values_direction'
  influence.targetClaimRefs = []
  ;(fixture.coverage as MutableRecord).targetClaimRefsCovered = []
  const structural =
    validateAiChartD1StructuralInfluenceResultAgainstSources(
      fixture,
      axis,
      input,
    )

  const result = buildAiChartD1PalaceReasoningResult({
    palaceResultId: 'palace-reasoning-result:synthetic:influence-facet',
    axisResult: axis,
    structuralInfluenceResult: structural,
    structuralInput: input,
  })
  assert.deepEqual(result.facetIndex, [
    {
      facetId: axis.claims[0].facetId,
      axisClaimRefs: [axis.claims[0].claimId],
      structuralInfluenceRefs: [],
    },
    {
      facetId: 'life.values_direction',
      axisClaimRefs: [],
      structuralInfluenceRefs: [structural.influences[0].influenceId],
    },
  ])
})

check('Palace Integration rejects altered facet indexes and source graphs', () => {
  const input = createStructuralInputs(
    completeModelInputSnapshot(),
    'palace-integration-index',
  )[0]
  const axis = validateAiChartD1PalaceAxisResultAgainstStructuralInput(
    axisFixtureForStructuralInput(input),
    input,
  )
  const structural =
    validateAiChartD1StructuralInfluenceResultAgainstSources(
      structuralInfluenceFixture(axis, input),
      axis,
      input,
    )
  const result = buildAiChartD1PalaceReasoningResult({
    palaceResultId: 'palace-reasoning-result:synthetic:index',
    axisResult: axis,
    structuralInfluenceResult: structural,
    structuralInput: input,
  })

  const missingFacetClaim = clone(result) as unknown as MutableRecord
  ;(
    (missingFacetClaim.facetIndex as MutableRecord[])[0]
      .axisClaimRefs as string[]
  ).splice(0, 1)
  expectPalaceReasoningInvalid(
    missingFacetClaim,
    'FACET_INDEX_MISMATCH',
  )

  const missingSource = clone(result) as unknown as MutableRecord
  ;(
    (missingSource.sourceGraph as MutableRecord[])[0]
      .sourceRefs as string[]
  ).splice(0, 1)
  expectPalaceReasoningInvalid(
    missingSource,
    'SOURCE_GRAPH_MISMATCH',
  )
})

check('Palace Integration coverage is exact and cannot omit a preserved reference', () => {
  const input = createStructuralInputs(
    completeModelInputSnapshot(),
    'palace-integration-coverage',
  )[0]
  const axis = validateAiChartD1PalaceAxisResultAgainstStructuralInput(
    axisFixtureForStructuralInput(input),
    input,
  )
  const structural =
    validateAiChartD1StructuralInfluenceResultAgainstSources(
      structuralInfluenceFixture(axis, input),
      axis,
      input,
    )
  const result = buildAiChartD1PalaceReasoningResult({
    palaceResultId: 'palace-reasoning-result:synthetic:coverage',
    axisResult: axis,
    structuralInfluenceResult: structural,
    structuralInput: input,
  })
  const incomplete = clone(result) as unknown as MutableRecord
  ;(incomplete.coverage as MutableRecord).structuralInfluenceRefs = []
  expectPalaceReasoningInvalid(incomplete, 'COVERAGE_MISMATCH')
})

check('Palace Integration source validation rejects a result bound to different upstream identities', () => {
  const input = createStructuralInputs(
    completeModelInputSnapshot(),
    'palace-integration-binding',
  )[0]
  const axis = validateAiChartD1PalaceAxisResultAgainstStructuralInput(
    axisFixtureForStructuralInput(input),
    input,
  )
  const structural =
    validateAiChartD1StructuralInfluenceResultAgainstSources(
      structuralInfluenceFixture(axis, input),
      axis,
      input,
    )
  const result = buildAiChartD1PalaceReasoningResult({
    palaceResultId: 'palace-reasoning-result:synthetic:binding',
    axisResult: axis,
    structuralInfluenceResult: structural,
    structuralInput: input,
  })
  const hostile = clone(result) as unknown as MutableRecord
  hostile.axisResultRef = 'axis:synthetic:other'
  expectPalaceReasoningInvalid(
    () =>
      validateAiChartD1PalaceReasoningResultAgainstSources(
        hostile,
        axis,
        structural,
        input,
    ),
    'IDENTITY_OR_AXIS_MISMATCH',
  )

  const forgedSource = clone(result) as unknown as MutableRecord
  const graphEntry = (forgedSource.sourceGraph as MutableRecord[])[0]
  const originalRef = (graphEntry.sourceRefs as string[])[0]
  const forgedRef = 'source:synthetic:forged'
  ;(graphEntry.sourceRefs as string[])[0] = forgedRef
  const coverage = forgedSource.coverage as MutableRecord
  coverage.sourceRefs = (coverage.sourceRefs as string[]).map((ref) =>
    ref === originalRef ? forgedRef : ref,
  )
  expectPalaceReasoningInvalid(
    () =>
      validateAiChartD1PalaceReasoningResultAgainstSources(
        forgedSource,
        axis,
        structural,
        input,
      ),
    'SOURCE_GRAPH_MISMATCH',
  )
})

check('Palace Integration preserves separate positive and negative influence references without netting', () => {
  const input = createStructuralInputs(
    completeModelInputSnapshot(),
    'palace-integration-opposing-influences',
  )[0]
  const axis = validateAiChartD1PalaceAxisResultAgainstStructuralInput(
    axisFixtureForStructuralInput(input),
    input,
  )
  const fixture = structuralInfluenceFixture(axis, input)
  const negativeRelation = buildAiChartD1StructuralRelationViews(
    input,
  ).find((view) => {
    if (view.relationKind !== 'TRINE_QUADRANT') return false
    const palace = input.otherTrinePalaces.find(
      (candidate) => candidate.palaceId === view.sourcePalaceId,
    )
    return palace?.modeledSupportingStars.some(
      (star) => star.type === 'tough',
    )
  })
  assert.notEqual(negativeRelation, undefined)
  if (!negativeRelation) throw new Error('missing negative relation')
  const negativePalace = input.otherTrinePalaces.find(
    (palace) => palace.palaceId === negativeRelation.sourcePalaceId,
  )
  const negativeTrigger = negativePalace?.modeledSupportingStars.find(
    (star) => star.type === 'tough',
  )
  assert.notEqual(negativeTrigger, undefined)
  if (!negativeTrigger) throw new Error('missing negative trigger')

  const positiveInfluence = (fixture.influences as MutableRecord[])[0]
  const negativeInfluence = clone(positiveInfluence)
  negativeInfluence.influenceId =
    'influence:synthetic:ming:trine:negative'
  negativeInfluence.sourcePalaceId = negativeRelation.sourcePalaceId
  negativeInfluence.sourceFacetId = firstFacetForPalace(
    negativeRelation.sourcePalaceId,
  )
  negativeInfluence.sourceFactRefs = [
    negativeRelation.relationFactRef,
    negativeTrigger.placementId,
  ]
  negativeInfluence.influenceMode = 'PRESSURE'
  ;(fixture.influences as MutableRecord[]).push(negativeInfluence)
  const coverage = fixture.coverage as MutableRecord
  const influenceIds = (fixture.influences as MutableRecord[]).map(
    (influence) => influence.influenceId as string,
  )
  coverage.influenceIds = influenceIds
  coverage.trineInfluenceIds = influenceIds
  coverage.sourcePalaceIdsCovered = [
    ...new Set(
      (fixture.influences as MutableRecord[]).map(
        (influence) => influence.sourcePalaceId as string,
      ),
    ),
  ]
  coverage.sourceFactRefsCovered = [
    ...new Set(
      (fixture.influences as MutableRecord[]).flatMap(
        (influence) => influence.sourceFactRefs as string[],
      ),
    ),
  ]

  const structural =
    validateAiChartD1StructuralInfluenceResultAgainstSources(
      fixture,
      axis,
      input,
    )
  const result = buildAiChartD1PalaceReasoningResult({
    palaceResultId:
      'palace-reasoning-result:synthetic:opposing-influences',
    axisResult: axis,
    structuralInfluenceResult: structural,
    structuralInput: input,
  })

  assert.deepEqual(
    structural.influences.map((influence) => influence.influenceMode),
    ['SUPPORT', 'PRESSURE'],
  )
  assert.deepEqual(result.structuralInfluenceRefs, influenceIds)
  assert.equal(result.structuralInfluenceRefs.length, 2)
})

check('Palace Integration Schema is strict and excludes generated prose, scores, and flying data', () => {
  assert.equal(
    AI_CHART_D1_PALACE_REASONING_RESULT_CONTRACT_VERSION,
    'ai-chart-d1-palace-reasoning-result/v1',
  )
  assert.equal(
    AI_CHART_D1_PALACE_REASONING_RESULT_SCHEMA_NAME,
    'ai_chart_d1_palace_reasoning_result_v1',
  )
  const root = schemaProperties(
    AI_CHART_D1_PALACE_REASONING_RESULT_JSON_SCHEMA,
  )
  assert.equal(Object.hasOwn(root, 'summary'), false)
  assert.equal(Object.hasOwn(root, 'claims'), false)
  assert.equal(Object.hasOwn(root, 'influences'), false)
  assert.equal(Object.hasOwn(root, 'score'), false)
  assert.equal(Object.hasOwn(root, 'flyingInfluences'), false)
  const serialized = JSON.stringify(
    AI_CHART_D1_PALACE_REASONING_RESULT_JSON_SCHEMA,
  )
  assert.equal(serialized.includes('uniqueItems'), false)
  assert.equal(serialized.includes('mechanismLink'), false)
  assert.equal(serialized.includes('possibleExpressions'), false)
  assert.equal(
    Object.isFrozen(
      AI_CHART_D1_PALACE_REASONING_RESULT_JSON_SCHEMA,
    ),
    true,
  )
})

check('Palace Integration errors are safe and all nested result data is immutable', () => {
  const input = createStructuralInputs(
    completeModelInputSnapshot(),
    'palace-integration-safety',
  )[0]
  const axis = validateAiChartD1PalaceAxisResultAgainstStructuralInput(
    axisFixtureForStructuralInput(input),
    input,
  )
  const structural =
    validateAiChartD1StructuralInfluenceResultAgainstSources(
      structuralInfluenceFixture(axis, input),
      axis,
      input,
    )
  const result = buildAiChartD1PalaceReasoningResult({
    palaceResultId: 'palace-reasoning-result:synthetic:safety',
    axisResult: axis,
    structuralInfluenceResult: structural,
    structuralInput: input,
  })
  assert.equal(Object.isFrozen(result), true)
  assert.equal(Object.isFrozen(result.facetIndex[0]), true)
  assert.equal(Object.isFrozen(result.facetIndex[0].axisClaimRefs), true)
  assert.equal(Object.isFrozen(result.sourceGraph[0]), true)
  assert.equal(Object.isFrozen(result.sourceGraph[0].sourceRefs), true)
  assert.equal(Object.isFrozen(result.coverage), true)

  const marker = 'synthetic-sensitive-palace-reasoning-marker'
  const hostile = clone(result) as unknown as MutableRecord
  hostile.summary = marker
  try {
    parseAiChartD1PalaceReasoningResult(hostile)
    assert.fail('expected palace reasoning safe rejection')
  } catch (error) {
    assert.equal(error instanceof AiChartD1PalaceReasoningResultError, true)
    assert.equal((error as Error).message.includes(marker), false)
    assert.equal(JSON.stringify(error).includes(marker), false)
  }
})

assert.equal(checks, 46)
console.log(`AI chart D1 Palace Reasoning Contract tests passed (${checks} checks)`)
