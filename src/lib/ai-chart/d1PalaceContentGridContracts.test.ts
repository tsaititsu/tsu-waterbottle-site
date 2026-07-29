import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createAiChartD1FlyingPalaceIntegrationTestFixture } from './d1FlyingPalaceIntegrationTestSupport'
import {
  AI_CHART_D1_PALACE_IDENTITIES,
  type AiChartD1PalaceId,
} from './d1N0Constants'
import {
  AI_CHART_D1_PALACE_CONTENT_GRID_JSON_SCHEMA,
  AI_CHART_D1_PALACE_CONTENT_GRID_VERSION,
  AiChartD1PalaceContentGridError,
  buildAiChartD1PalaceContentGrid,
  parseAiChartD1PalaceContentGrid,
  validateAiChartD1PalaceContentGridAgainstSources,
} from './d1PalaceContentGridContracts'
import { AI_CHART_D1_PALACE_FACET_REGISTRY } from './d1PalaceFacetRegistry'
import {
  buildAiChartD1PalaceWritingSourceSet,
  type AiChartD1PalaceWritingSourceCell,
} from './d1PalaceWritingSourceContracts'
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

function expectInvalid(run: () => unknown): void {
  assert.throws(run, AiChartD1PalaceContentGridError)
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)]
}

async function run() {
  const fixture =
    await createAiChartD1FlyingPalaceIntegrationTestFixture()
  const palaceResults = fixture.source.palaceResults
  const sourceSet = buildAiChartD1PalaceWritingSourceSet(
    palaceResults,
    fixture.integration,
  )
  const sourceCells = sourceSet.palaces.flatMap(
    (entry) => entry.sourceCells,
  )
  const axisCell = (
    palaceId: AiChartD1PalaceId,
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
    wholeChartResultId: 'whole-chart-result:content-grid',
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
  const approvedReviewValue: MutableRecord = {
    contractVersion:
      'ai-chart-d1-whole-chart-semantic-review/v1',
    semanticReviewId:
      'whole-chart-semantic-review:content-grid',
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
  const build = (reviewValue: unknown = approvedReviewValue) =>
    buildAiChartD1PalaceContentGrid(
      sourceSet,
      relationResult,
      reviewValue,
      palaceResults,
      fixture.integration,
      fixture.source.n0,
    )
  const grid = build()
  const contentCells = grid.palaces.flatMap((palace) =>
    palace.facetSections.flatMap(
      (section) => section.contentCells,
    ),
  )

  check('approved sources build one immutable canonical twelve-palace content grid', () => {
    assert.equal(
      grid.contractVersion,
      AI_CHART_D1_PALACE_CONTENT_GRID_VERSION,
    )
    assert.equal(
      grid.sourceSnapshotSha256,
      fixture.source.n0.sourceSnapshotSha256,
    )
    assert.deepEqual(
      grid.palaces.map((palace) => palace.targetPalaceId),
      AI_CHART_D1_PALACE_IDENTITIES.map(
        (identity) => identity.palaceId,
      ),
    )
    assert.equal(grid.writingPackageHandoffStatus, 'ready')
    assert.equal(grid.customerWritingStatus, 'blocked')
    assert.equal(grid.openAiCallable, false)
    assert.equal(Object.isFrozen(grid), true)
    assert.equal(Object.isFrozen(grid.palaces), true)
    assert.equal(
      grid.palaces.every(
        (palace) =>
          Object.isFrozen(palace) &&
          Object.isFrozen(palace.facetSections) &&
          palace.facetSections.every(
            (section) =>
              Object.isFrozen(section) &&
              Object.isFrozen(section.contentCells),
          ),
      ),
      true,
    )
  })

  check('every source becomes exactly one content cell and no empty facet is invented', () => {
    assert.equal(contentCells.length, sourceCells.length)
    assert.deepEqual(
      unique(
        contentCells.flatMap((cell) => cell.sourceCellRefs),
      ).sort(),
      sourceCells.map((cell) => cell.sourceCellId).sort(),
    )
    assert.equal(
      contentCells.every(
        (cell) =>
          cell.sourceCellRefs.length === 1 &&
          cell.writingStatus === 'required',
      ),
      true,
    )
    assert.equal(
      grid.palaces.every((palace) =>
        palace.facetSections.every(
          (section) => section.contentCells.length > 0,
        ),
      ),
      true,
    )
  })

  check('palace facets use Registry order rather than inference-engine chapters', () => {
    for (const palace of grid.palaces) {
      const registry = AI_CHART_D1_PALACE_FACET_REGISTRY.find(
        (entry) => entry.palaceId === palace.targetPalaceId,
      )
      assert.notEqual(registry, undefined)
      assert.deepEqual(
        palace.facetSections.map((section) => section.facetId),
        registry!.facetIds.filter((facetId) =>
          palace.facetSections.some(
            (section) => section.facetId === facetId,
          ),
        ),
      )
    }
    const serialized = JSON.stringify(grid)
    for (const forbidden of [
      'axisChapter',
      'structuralChapter',
      'flyingChapter',
    ]) {
      assert.equal(serialized.includes(forbidden), false)
    }
  })

  check('approved whole-chart relations are attached to every cited source without deleting tensions', () => {
    const refsFor = (sourceCellRef: string) =>
      contentCells.find(
        (cell) => cell.sourceCellRefs[0] === sourceCellRef,
      )!.relationRefs
    assert.deepEqual(refsFor(mingCell.sourceCellId), [
      relationRefs[0],
      relationRefs[1],
    ])
    assert.deepEqual(refsFor(wealthCell.sourceCellId), [
      relationRefs[1],
    ])
    assert.deepEqual(refsFor(spouseCell.sourceCellId), [
      relationRefs[2],
    ])
    assert.deepEqual(refsFor(careerCell.sourceCellId), [
      relationRefs[2],
    ])
    assert.equal(
      contentCells.filter((cell) =>
        cell.relationRefs.includes(relationRefs[2]),
      ).length,
      2,
    )
  })

  check('a repair-required semantic review blocks the entire content grid', () => {
    const repair = structuredClone(approvedReviewValue)
    ;(repair.relationReviews as MutableRecord[])[1] = {
      relationRef: relationRefs[1],
      decision: 'REPAIR_REQUIRED',
      issueCodes: ['REPEATED_PATTERN_NOT_EQUIVALENT'],
      repairScope: 'RELATION_ONLY',
    }
    repair.coverage = {
      relationRefs,
      approvedRelationRefs: [relationRefs[0], relationRefs[2]],
      repairRelationRefs: [relationRefs[1]],
      issueCodes: ['REPEATED_PATTERN_NOT_EQUIVALENT'],
    }
    repair.semanticReviewStatus = 'repair_required'
    repair.contentGridHandoffStatus = 'blocked'
    expectInvalid(() => build(repair))
  })

  check('source-aware validation rejects missing cells, forged relations, and changed identities', () => {
    const missingCell = structuredClone(grid)
    ;(
      (
        (
          (missingCell as unknown as MutableRecord)
            .palaces as MutableRecord[]
        )[0]
          .facetSections as MutableRecord[]
      )[0].contentCells as MutableRecord[]
    ).pop()
    expectInvalid(() =>
      validateAiChartD1PalaceContentGridAgainstSources(
        missingCell,
        sourceSet,
        relationResult,
        approvedReviewValue,
        palaceResults,
        fixture.integration,
        fixture.source.n0,
      ),
    )

    const forgedRelation = structuredClone(grid)
    ;(
      (
        (
          (
            (forgedRelation as unknown as MutableRecord)
              .palaces as MutableRecord[]
          )[0]
            .facetSections as MutableRecord[]
        )[0].contentCells as MutableRecord[]
      )[0].relationRefs as string[]
    ).push('whole-chart-relation:unknown')
    expectInvalid(() =>
      validateAiChartD1PalaceContentGridAgainstSources(
        forgedRelation,
        sourceSet,
        relationResult,
        approvedReviewValue,
        palaceResults,
        fixture.integration,
        fixture.source.n0,
      ),
    )

    const wrongIdentity = structuredClone(grid)
    ;(wrongIdentity as unknown as MutableRecord).chartId =
      'chart:forged'
    expectInvalid(() =>
      validateAiChartD1PalaceContentGridAgainstSources(
        wrongIdentity,
        sourceSet,
        relationResult,
        approvedReviewValue,
        palaceResults,
        fixture.integration,
        fixture.source.n0,
      ),
    )
  })

  check('coverage is derived from actual content cells and relation context', () => {
    const forged = structuredClone(grid)
    ;(forged.coverage as MutableRecord).relationRefs = relationRefs.slice(
      0,
      2,
    )
    expectInvalid(() => parseAiChartD1PalaceContentGrid(forged))
  })

  check('Strict Schema excludes customer prose, model controls, and self-declared star coverage', () => {
    expectInvalid(() =>
      parseAiChartD1PalaceContentGrid({
        ...structuredClone(grid),
        customerSummary: 'forbidden synthetic prose',
      }),
    )
    const schema = AI_CHART_D1_PALACE_CONTENT_GRID_JSON_SCHEMA
    const serialized = JSON.stringify(schema)
    assert.equal(Object.isFrozen(schema), true)
    assert.deepEqual(JSON.parse(serialized), schema)
    assert.equal(serialized.includes('uniqueItems'), false)
    for (const forbidden of [
      'customerSummary',
      'customerText',
      'majorStarsConsidered',
      'instructions',
      'model',
      'maxOutputTokens',
      'netScore',
      'dominantSource',
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

  check('Content Grid module has no runtime, request, semantic rewrite, or customer-writing implementation', () => {
    const source = readFileSync(
      fileURLToPath(
        new URL(
          './d1PalaceContentGridContracts.ts',
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
      'customerReport',
      'rewrite',
    ]) {
      assert.equal(source.includes(forbidden), false, forbidden)
    }
  })

  console.log(
    `d1PalaceContentGridContracts tests passed (${checks} checks)`,
  )
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
