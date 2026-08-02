import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createAiChartD1FlyingPalaceIntegrationTestFixture } from './d1FlyingPalaceIntegrationTestSupport'
import {
  AI_CHART_D1_ACTOR_BINDING_REGISTRY,
  AI_CHART_D1_ACTOR_BINDING_REGISTRY_VERSION,
  AI_CHART_D1_ACTOR_FACET_POLICIES,
} from './d1PalaceActorBindingRegistry'
import {
  parseAiChartD1PalaceAxisResult,
  type AiChartD1PalaceAxisResult,
} from './d1PalaceAxisContracts'
import {
  buildAiChartD1PalaceContentGrid,
} from './d1PalaceContentGridContracts'
import {
  AI_CHART_D1_PALACE_FACET_REGISTRY_VERSION,
} from './d1PalaceFacetRegistry'
import {
  parseAiChartD1PalaceReasoningResult,
  type AiChartD1PalaceReasoningResult,
} from './d1PalaceIntegrationContracts'
import {
  AI_CHART_D1_PALACE_WRITING_PROMPT_PACKAGE_SET_JSON_SCHEMA,
  AI_CHART_D1_PALACE_WRITING_PROMPT_PACKAGE_SET_VERSION,
  AiChartD1PalaceWritingPromptPackageError,
  buildAiChartD1PalaceWritingPromptPackageSet,
  parseAiChartD1PalaceWritingPromptPackageSet,
  validateAiChartD1PalaceWritingPromptPackageSetAgainstSources,
} from './d1PalaceWritingPromptPackageContracts'
import {
  buildAiChartD1PalaceWritingSourceSet,
  type AiChartD1PalaceWritingSourceCell,
} from './d1PalaceWritingSourceContracts'
import {
  parseAiChartD1StructuralInfluenceResult,
  type AiChartD1StructuralInfluenceResult,
} from './d1StructuralInfluenceContracts'
import {
  validateAiChartD1WholeChartRelationResultAgainstSources,
  type AiChartD1WholeChartRelationResult,
} from './d1WholeChartRelationContracts'

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

function unique(values: readonly string[]): string[] {
  return [...new Set(values)]
}

function expectInvalid(run: () => unknown): void {
  assert.throws(run, AiChartD1PalaceWritingPromptPackageError)
}

function buildAxisResults(
  palaceResults: readonly AiChartD1PalaceReasoningResult[],
): readonly AiChartD1PalaceAxisResult[] {
  return palaceResults.map((palaceResult) => {
    const facetId = palaceResult.facetIndex[0].facetId
    const claimId = palaceResult.coverage.axisClaimRefs[0]
    const actorPolicy = AI_CHART_D1_ACTOR_FACET_POLICIES.find(
      (policy) => policy.facetId === facetId,
    )
    assert.notEqual(actorPolicy, undefined)
    const actorBindingRef =
      actorPolicy!.allowedClaimBindingIds.find(
        (bindingId) => bindingId !== 'actor:interaction',
      )
    assert.notEqual(actorBindingRef, undefined)
    const actorBinding = AI_CHART_D1_ACTOR_BINDING_REGISTRY.find(
      (binding) => binding.bindingId === actorBindingRef,
    )
    assert.notEqual(actorBinding, undefined)
    const sourceRefs = palaceResult.sourceGraph.find(
      (entry) => entry.nodeRef === claimId,
    )!.sourceRefs
    return parseAiChartD1PalaceAxisResult({
      contractVersion: 'ai-chart-d1-palace-axis-result/v1',
      axisResultId: palaceResult.axisResultRef,
      chartId: palaceResult.chartId,
      runId: palaceResult.runId,
      callId: palaceResult.callId,
      targetPalaceId: palaceResult.targetPalaceId,
      oppositePalaceId:
        palaceResult.targetPalaceId === 'palace:ming'
          ? 'palace:travel'
          : 'palace:ming',
      facetRegistryVersion:
        AI_CHART_D1_PALACE_FACET_REGISTRY_VERSION,
      actorBindingRegistryVersion:
        AI_CHART_D1_ACTOR_BINDING_REGISTRY_VERSION,
      targetCoreMode: 'DIRECT_MAIN_STARS',
      axisExpressionMode: 'OPPOSITE_CHANNEL',
      claims: [
        {
          claimId,
          facetId,
          actor: actorBinding!.actor,
          actorBindingRefs: [actorBindingRef!],
          doubleStarCoreRef: null,
          interactionRoleBindings: null,
          palaceMeaningRefs: sourceRefs,
          targetCoreRefs: [
            `placement:${palaceResult.targetPalaceId}:core`,
          ],
          targetLocalModifierRefs: [],
          oppositeExpressionRefs: [],
          natalModifierRefs: [],
          mechanismLink:
            'The authenticated target core supplies one D1 mechanism.',
          possibleExpressions: [
            'The mechanism may appear as one observable tendency.',
          ],
          constraints: [
            'This remains a D1 possibility rather than an event.',
          ],
        },
      ],
      coverage: {
        claimIds: [claimId],
        targetCoreRefsCovered: [
          `placement:${palaceResult.targetPalaceId}:core`,
        ],
        targetLocalModifierRefsCovered: [],
        oppositeExpressionRefsCovered: [],
        natalModifierRefsCovered: [],
      },
      validationStatus: 'validated',
    })
  })
}

function buildStructuralResults(
  palaceResults: readonly AiChartD1PalaceReasoningResult[],
): readonly AiChartD1StructuralInfluenceResult[] {
  return palaceResults.map((palaceResult) => {
    const influenceRefs =
      palaceResult.coverage.structuralInfluenceRefs
    const facetId = palaceResult.facetIndex[0].facetId
    const targetClaimRef = palaceResult.coverage.axisClaimRefs[0]
    const influences = influenceRefs.map((influenceId) => ({
      influenceId,
      relationKind: 'TRINE_QUADRANT',
      visibility: 'EXPLICIT',
      sourcePalaceId: 'palace:wealth',
      sourceFacetId: 'money.view',
      sourceFactRefs: [
        `relation:${palaceResult.targetPalaceId}:trine`,
        `rule:${palaceResult.targetPalaceId}:trine`,
      ],
      targetPalaceId: palaceResult.targetPalaceId,
      targetFacetId: facetId,
      targetClaimRefs: [targetClaimRef],
      influenceMode: 'SUPPORT',
      mechanismLink:
        'One authenticated structural source may support this facet.',
      possibleEffects: [
        'The support may become visible in a related choice.',
      ],
      constraints: [
        'The structural source cannot replace the target core.',
      ],
    }))
    return parseAiChartD1StructuralInfluenceResult({
      contractVersion:
        'ai-chart-d1-structural-influence-result/v1',
      structuralInfluenceResultId:
        palaceResult.structuralInfluenceResultRef,
      axisResultRef: palaceResult.axisResultRef,
      chartId: palaceResult.chartId,
      runId: palaceResult.runId,
      callId: palaceResult.callId,
      targetPalaceId: palaceResult.targetPalaceId,
      influences,
      coverage: {
        influenceIds: influenceRefs,
        trineInfluenceIds: influenceRefs,
        hiddenCombinationInfluenceIds: [],
        sourcePalaceIdsCovered:
          influenceRefs.length === 0 ? [] : ['palace:wealth'],
        sourceFactRefsCovered:
          influenceRefs.length === 0
            ? []
            : [
                `relation:${palaceResult.targetPalaceId}:trine`,
                `rule:${palaceResult.targetPalaceId}:trine`,
              ],
        targetClaimRefsCovered:
          influenceRefs.length === 0 ? [] : [targetClaimRef],
      },
      validationStatus: 'validated',
    })
  })
}

function addOneStructuralSource(
  palaceResults: readonly AiChartD1PalaceReasoningResult[],
): readonly AiChartD1PalaceReasoningResult[] {
  return palaceResults.map((palaceResult) => {
    if (palaceResult.targetPalaceId !== 'palace:ming') {
      return palaceResult
    }
    const value = structuredClone(palaceResult)
    const mutable = value as unknown as MutableRecord
    const facetIndex = mutable.facetIndex as MutableRecord[]
    const sourceGraph = mutable.sourceGraph as MutableRecord[]
    const coverage = mutable.coverage as MutableRecord
    const influenceId = 'influence:palace:ming:trine'
    mutable.structuralInfluenceRefs = [influenceId]
    facetIndex[0].structuralInfluenceRefs = [influenceId]
    sourceGraph.push({
      nodeRef: influenceId,
      nodeKind: 'STRUCTURAL_INFLUENCE',
      sourceRefs: [
        'relation:palace:ming:trine',
        'rule:palace:ming:trine',
      ],
      targetRefs: [
        (coverage.axisClaimRefs as readonly string[])[0],
      ],
    })
    coverage.structuralInfluenceRefs = [influenceId]
    coverage.sourceRefs = [
      ...(coverage.sourceRefs as readonly string[]),
      'relation:palace:ming:trine',
      'rule:palace:ming:trine',
    ]
    return parseAiChartD1PalaceReasoningResult(value)
  })
}

async function run() {
  const fixture =
    await createAiChartD1FlyingPalaceIntegrationTestFixture()
  const palaceResults = addOneStructuralSource(
    fixture.source.palaceResults,
  )
  const axisResults = buildAxisResults(palaceResults)
  const structuralResults = buildStructuralResults(palaceResults)
  const sourceSet = buildAiChartD1PalaceWritingSourceSet(
    palaceResults,
    fixture.integration,
  )
  const sourceCells = sourceSet.palaces.flatMap(
    (entry) => entry.sourceCells,
  )
  const axisCell = (
    palaceId: string,
  ): AiChartD1PalaceWritingSourceCell => {
    const cell = sourceCells.find(
      (candidate) =>
        candidate.targetPalaceId === palaceId &&
        candidate.sourceKind === 'AXIS_CLAIM',
    )
    assert.notEqual(cell, undefined)
    return cell!
  }
  const mingCell = axisCell('palace:ming')
  const wealthCell = axisCell('palace:wealth')
  const spouseCell = axisCell('palace:spouse')
  const careerCell = axisCell('palace:career')
  const relationValues: MutableRecord[] = [
    {
      relationId: 'whole-chart-relation:overall-direction',
      relationKind: 'OVERALL_DIRECTION',
      focusPalaceId: 'palace:ming',
      sourceCellRefs: [mingCell.sourceCellId],
      scanSignalRefs: [],
      mechanismLink:
        'The Ming axis provides one source-bound overall direction.',
      possibleExpressions: [
        'The direction may appear across later choices.',
      ],
      constraints: [
        'The relation cannot replace any palace source.',
      ],
    },
    {
      relationId: 'whole-chart-relation:repeated-pattern',
      relationKind: 'REPEATED_PATTERN',
      focusPalaceId: null,
      sourceCellRefs: [
        mingCell.sourceCellId,
        wealthCell.sourceCellId,
      ],
      scanSignalRefs: [],
      mechanismLink:
        'Two palace sources may express one repeated pattern.',
      possibleExpressions: [
        'The pattern may recur in direction and money choices.',
      ],
      constraints: ['The pattern remains a D1 possibility.'],
    },
    {
      relationId: 'whole-chart-relation:inner-tension',
      relationKind: 'INNER_TENSION',
      focusPalaceId: null,
      sourceCellRefs: [
        spouseCell.sourceCellId,
        careerCell.sourceCellId,
      ],
      scanSignalRefs: [],
      mechanismLink:
        'Two palace sources may pull choices in different directions.',
      possibleExpressions: [
        'Relationship and work preferences may remain in tension.',
      ],
      constraints: ['Neither side may be deleted.'],
    },
  ]
  const relationResultValue: MutableRecord = {
    contractVersion:
      'ai-chart-d1-whole-chart-relation-result/v1',
    wholeChartResultId:
      'whole-chart-result:palace-writing-prompt',
    chartId: sourceSet.chartId,
    runId: sourceSet.runId,
    sourceWritingSetContractVersion: sourceSet.contractVersion,
    relations: relationValues,
    coverage: {
      relationIds: relationValues.map(
        (relation) => relation.relationId as string,
      ),
      relationKinds: relationValues.map(
        (relation) => relation.relationKind as string,
      ),
      sourceCellRefs: unique(
        relationValues.flatMap(
          (relation) => relation.sourceCellRefs as string[],
        ),
      ),
      scanSignalRefs: [],
    },
    sourceBindingStatus: 'validated',
    semanticReviewStatus: 'required',
    customerWritingStatus: 'blocked',
  }
  const relationResult: AiChartD1WholeChartRelationResult =
    validateAiChartD1WholeChartRelationResultAgainstSources(
      relationResultValue,
      sourceSet,
      palaceResults,
      fixture.integration,
      fixture.source.n0,
    )
  const relationRefs = relationResult.relations.map(
    (relation) => relation.relationId,
  )
  const semanticReview: MutableRecord = {
    contractVersion:
      'ai-chart-d1-whole-chart-semantic-review/v1',
    semanticReviewId:
      'whole-chart-semantic-review:palace-writing-prompt',
    chartId: relationResult.chartId,
    runId: relationResult.runId,
    sourceWholeChartResultVersion: relationResult.contractVersion,
    sourceWholeChartResultRef:
      relationResult.wholeChartResultId,
    relationReviews: relationRefs.map((relationRef) => ({
      relationRef,
      decision: 'APPROVED',
      issueCodes: [],
      repairScope: 'NONE',
    })),
    coverage: {
      relationRefs,
      approvedRelationRefs: relationRefs,
      repairRelationRefs: [],
      issueCodes: [],
    },
    semanticReviewStatus: 'approved',
    contentGridHandoffStatus: 'ready',
    customerWritingStatus: 'blocked',
  }
  const grid = buildAiChartD1PalaceContentGrid(
    sourceSet,
    relationResult,
    semanticReview,
    palaceResults,
    fixture.integration,
    fixture.source.n0,
  )
  const reportContext = {
    primaryLifeRegion: 'TW',
    reportLanguage: 'zh-Hant-TW',
  }
  const sources = {
    contentGrid: grid,
    sourceSet,
    relationResult,
    semanticReview,
    palaceResults,
    axisResults,
    structuralResults,
    flyingIntegration: fixture.integration,
    n0: fixture.source.n0,
    reportContext,
  }
  const packageSet =
    buildAiChartD1PalaceWritingPromptPackageSet(sources)
  const mingPackage = packageSet.packages[0]
  const mingInput = JSON.parse(mingPackage.userInput) as MutableRecord

  check('builder creates twelve immutable canonical palace-writing Prompt Packages', () => {
    assert.equal(
      packageSet.contractVersion,
      AI_CHART_D1_PALACE_WRITING_PROMPT_PACKAGE_SET_VERSION,
    )
    assert.equal(packageSet.packages.length, 12)
    assert.deepEqual(
      packageSet.packages.map(
        (promptPackage) => promptPackage.targetPalaceId,
      ),
      grid.palaces.map((palace) => palace.targetPalaceId),
    )
    assert.equal(packageSet.openAiCallable, false)
    assert.equal(packageSet.customerWritingStatus, 'not_generated')
    assert.equal(
      mingPackage.sourceSnapshotSha256,
      fixture.source.n0.sourceSnapshotSha256,
    )
    assert.equal(
      mingPackage.sourceTrace.sourceSnapshotSha256,
      fixture.source.n0.sourceSnapshotSha256,
    )
    assert.equal(Object.isFrozen(packageSet), true)
    assert.equal(Object.isFrozen(packageSet.packages), true)
  })

  check('each canonical userInput contains the target palace grid and every resolved source material exactly once', () => {
    const mingGrid = grid.palaces[0]
    const contentCells = mingGrid.facetSections.flatMap(
      (section) => section.contentCells,
    )
    assert.deepEqual(mingInput.contentGrid, mingGrid)
    const sourceMaterials =
      mingInput.sourceMaterials as MutableRecord[]
    assert.equal(sourceMaterials.length, contentCells.length)
    assert.deepEqual(
      sourceMaterials.map(
        (material) => material.contentCellId,
      ),
      contentCells.map((cell) => cell.contentCellId),
    )
    assert.deepEqual(
      unique(
        sourceMaterials.map(
          (material) => material.sourceCellRef as string,
        ),
      ),
      contentCells.map((cell) => cell.sourceCellRefs[0]),
    )
    assert.equal(
      sourceMaterials.some(
        (material) => material.sourceKind === 'AXIS_CLAIM',
      ),
      true,
    )
    assert.equal(
      sourceMaterials.some(
        (material) =>
          material.sourceKind === 'STRUCTURAL_INFLUENCE',
      ),
      true,
    )
    assert.equal(
      sourceMaterials.some(
        (material) =>
          material.sourceKind === 'FLYING_INFLUENCE',
      ),
      true,
    )
  })

  check('only approved relations touching the target package are projected without importing other palace reports', () => {
    const relations = mingInput.relationContext as MutableRecord[]
    assert.deepEqual(
      relations.map((relation) => relation.relationId),
      relationRefs.slice(0, 2),
    )
    const serialized = mingPackage.userInput
    assert.equal(
      serialized.includes('whole-chart-relation:inner-tension'),
      false,
    )
    assert.equal(serialized.includes('"palaces"'), false)
    assert.equal(serialized.includes('"globalScan"'), false)
  })

  check('report language and primary life region stay separate and affect package identity only as writing context', () => {
    assert.deepEqual(mingInput.reportContext, reportContext)
    const otherRegion =
      buildAiChartD1PalaceWritingPromptPackageSet({
        ...sources,
        reportContext: {
          primaryLifeRegion: 'SG',
          reportLanguage: 'zh-Hant-TW',
        },
      })
    assert.notEqual(
      otherRegion.packages[0].packageFingerprint,
      mingPackage.packageFingerprint,
    )
    assert.equal(
      JSON.parse(
        otherRegion.packages[0].userInput,
      ).reportContext.reportLanguage,
      'zh-Hant-TW',
    )
    expectInvalid(() =>
      buildAiChartD1PalaceWritingPromptPackageSet({
        ...sources,
        reportContext: {
          primaryLifeRegion: 'Taiwan',
          reportLanguage: 'zh-Hant-TW',
        },
      }),
    )
  })

  check('canonical JSON, hashes, budgets, and fingerprints are deterministic', () => {
    const rebuilt =
      buildAiChartD1PalaceWritingPromptPackageSet(sources)
    assert.deepEqual(rebuilt, packageSet)
    assert.match(mingPackage.instructionsSha256, /^[a-f0-9]{64}$/)
    assert.match(mingPackage.userInputSha256, /^[a-f0-9]{64}$/)
    assert.match(mingPackage.packageFingerprint, /^[a-f0-9]{64}$/)
    assert.equal(mingPackage.budget.measurement, 'utf8_bytes')
    assert.equal(mingPackage.budget.status, 'within_budget')
    assert.equal(mingPackage.promptStatus, 'prepared')
    assert.equal(
      mingPackage.adapterStatus,
      'bridge_required',
    )
    assert.equal(
      mingPackage.writingOutputContractStatus,
      'available',
    )
  })

  check('source-aware validation rejects changed material, relation, identity, or report context', () => {
    const changed = structuredClone(packageSet)
    const changedPackage = changed.packages[0] as unknown as MutableRecord
    changedPackage.userInput =
      (changedPackage.userInput as string).replace(
        'one observable tendency',
        'forged customer certainty',
      )
    expectInvalid(() =>
      validateAiChartD1PalaceWritingPromptPackageSetAgainstSources(
        changed,
        sources,
      ),
    )

    const changedMaterial = structuredClone(sources)
    const axisResult = (
      changedMaterial.axisResults as unknown as MutableRecord[]
    )[0]
    const claim = (axisResult.claims as MutableRecord[])[0]
    claim.possibleExpressions = [
      'A different but structurally valid source expression.',
    ]
    expectInvalid(() =>
      validateAiChartD1PalaceWritingPromptPackageSetAgainstSources(
        packageSet,
        changedMaterial,
      ),
    )

    const changedRelation = structuredClone(sources)
    const relationResult =
      changedRelation.relationResult as unknown as MutableRecord
    const relation = (
      relationResult.relations as MutableRecord[]
    )[0]
    relation.possibleExpressions = [
      'A changed relation expression must alter the package.',
    ]
    expectInvalid(() =>
      validateAiChartD1PalaceWritingPromptPackageSetAgainstSources(
        packageSet,
        changedRelation,
      ),
    )

    expectInvalid(() =>
      validateAiChartD1PalaceWritingPromptPackageSetAgainstSources(
        packageSet,
        {
          ...sources,
          reportContext: {
            primaryLifeRegion: 'TW',
            reportLanguage: 'en',
          },
        },
      ),
    )
  })

  check('source trace and coverage are derived instead of model self-declared star coverage', () => {
    const contentCells = grid.palaces.flatMap((palace) =>
      palace.facetSections.flatMap(
        (section) => section.contentCells,
      ),
    )
    assert.deepEqual(
      packageSet.coverage.contentCellIds,
      contentCells.map((cell) => cell.contentCellId),
    )
    assert.deepEqual(
      packageSet.coverage.sourceCellRefs,
      contentCells.map((cell) => cell.sourceCellRefs[0]),
    )
    assert.equal(
      JSON.stringify(packageSet).includes(
        'majorStarsConsidered',
      ),
      false,
    )
  })

  check('Strict Schema is internal-only and excludes model policy, request controls, and customer output', () => {
    const schema =
      AI_CHART_D1_PALACE_WRITING_PROMPT_PACKAGE_SET_JSON_SCHEMA
    const serialized = JSON.stringify(schema)
    assert.equal(Object.isFrozen(schema), true)
    assert.deepEqual(JSON.parse(serialized), schema)
    assert.equal(serialized.includes('uniqueItems'), false)
    for (const forbidden of [
      'model',
      'reasoning',
      'maxOutputTokens',
      'temperature',
      'response_format',
      'Authorization',
      'OPENAI_API_KEY',
      'customerText',
      'output_text',
      'majorStarsConsidered',
    ]) {
      assert.equal(serialized.includes(forbidden), false, forbidden)
    }
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
  })

  check('Prompt Package module has no runtime, fetch, adapter, output writer, or environment access', () => {
    const source = readFileSync(
      fileURLToPath(
        new URL(
          './d1PalaceWritingPromptPackageContracts.ts',
          import.meta.url,
        ),
      ),
      'utf8',
    )
    for (const forbidden of [
      'fetch(',
      'responses.create',
      'requestAiChartOpenAiStructuredResponse',
      'OPENAI_API_KEY',
      'process.env',
      'maxOutputTokens',
      'customerText',
      'output_text',
      'retry',
    ]) {
      assert.equal(source.includes(forbidden), false, forbidden)
    }
  })

  check('parser returns a frozen isolated package set', () => {
    const source = structuredClone(packageSet)
    const parsed =
      parseAiChartD1PalaceWritingPromptPackageSet(source)
    ;(source.packages[0] as unknown as MutableRecord).callId =
      'call:mutated'
    assert.notEqual(parsed.packages[0].callId, source.packages[0].callId)
    assert.equal(Object.isFrozen(parsed), true)
    assert.equal(Object.isFrozen(parsed.packages[0]), true)
    assert.equal(Object.isFrozen(parsed.packages[0].sourceTrace), true)
  })

  console.log(
    `d1PalaceWritingPromptPackageContracts tests passed (${checks} checks)`,
  )
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
