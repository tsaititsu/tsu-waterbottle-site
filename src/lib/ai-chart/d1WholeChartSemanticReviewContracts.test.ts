import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createAiChartD1FlyingPalaceIntegrationTestFixture } from './d1FlyingPalaceIntegrationTestSupport'
import {
  buildAiChartD1PalaceWritingSourceSet,
  type AiChartD1PalaceWritingSourceCell,
} from './d1PalaceWritingSourceContracts'
import {
  validateAiChartD1WholeChartRelationResultAgainstSources,
  type AiChartD1WholeChartRelationResult,
} from './d1WholeChartRelationContracts'
import {
  AI_CHART_D1_WHOLE_CHART_SEMANTIC_REVIEW_JSON_SCHEMA,
  AI_CHART_D1_WHOLE_CHART_SEMANTIC_REVIEW_VERSION,
  AiChartD1WholeChartSemanticReviewError,
  parseAiChartD1WholeChartSemanticReview,
  validateAiChartD1WholeChartSemanticReviewAgainstSources,
} from './d1WholeChartSemanticReviewContracts'

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
  assert.throws(run, AiChartD1WholeChartSemanticReviewError)
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)]
}

async function run() {
  const fixture =
    await createAiChartD1FlyingPalaceIntegrationTestFixture()
  const signal =
    fixture.source.n0.globalScan.signals.find(
      (candidate) =>
        ![
          'palace:ming',
          'palace:wealth',
          'palace:spouse',
          'palace:career',
        ].includes(candidate.palaceId),
    ) ?? fixture.source.n0.globalScan.signals[0]
  assert.notEqual(signal, undefined)
  if (!signal) throw new Error('missing synthetic N0 signal')

  const palaceResults = structuredClone(
    fixture.source.palaceResults,
  ) as unknown as MutableRecord[]
  const deepPalaceResult = palaceResults.find(
    (candidate) => candidate.targetPalaceId === signal.palaceId,
  )
  assert.notEqual(deepPalaceResult, undefined)
  if (!deepPalaceResult) {
    throw new Error('missing synthetic deep-feeling palace result')
  }
  const deepGraph = (
    deepPalaceResult.sourceGraph as MutableRecord[]
  )[0]
  ;(deepGraph.sourceRefs as string[]).push(signal.starPlacementId)
  ;(
    (deepPalaceResult.coverage as MutableRecord)
      .sourceRefs as string[]
  ).push(signal.starPlacementId)

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
  const deepCell = axisCell(signal.palaceId)
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
    {
      relationId: 'whole-chart-relation:deep-feeling',
      relationKind: 'DEEP_FEELING_THEME',
      focusPalaceId: signal.palaceId,
      sourceCellRefs: [deepCell.sourceCellId],
      scanSignalRefs: [signal.signalId],
      mechanismLink:
        'A confirmed scan signal supports one deeply felt theme.',
      possibleExpressions: [
        'The native may experience this area more repeatedly.',
      ],
      constraints: [
        'Deep feeling does not make the palace more important.',
      ],
    },
  ]
  const relationResultValue: MutableRecord = {
    contractVersion:
      'ai-chart-d1-whole-chart-relation-result/v1',
    wholeChartResultId: 'whole-chart-result:synthetic',
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
      scanSignalRefs: unique(
        relationValues.flatMap(
          (relation) => relation.scanSignalRefs as string[],
        ),
      ),
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
  const approvedReviews = relationRefs.map((relationRef) => ({
    relationRef,
    decision: 'APPROVED',
    issueCodes: [],
    repairScope: 'NONE',
  }))
  const approvedReviewValue: MutableRecord = {
    contractVersion:
      'ai-chart-d1-whole-chart-semantic-review/v1',
    semanticReviewId: 'whole-chart-semantic-review:synthetic',
    chartId: relationResult.chartId,
    runId: relationResult.runId,
    sourceWholeChartResultVersion: relationResult.contractVersion,
    sourceWholeChartResultRef:
      relationResult.wholeChartResultId,
    relationReviews: approvedReviews,
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
  const validate = (value: unknown = approvedReviewValue) =>
    validateAiChartD1WholeChartSemanticReviewAgainstSources(
      value,
      relationResult,
      sourceSet,
      palaceResults,
      fixture.integration,
      fixture.source.n0,
    )
  const approved = validate()

  check('all approved relations produce one immutable content-grid handoff without customer prose', () => {
    assert.equal(
      approved.contractVersion,
      AI_CHART_D1_WHOLE_CHART_SEMANTIC_REVIEW_VERSION,
    )
    assert.equal(approved.semanticReviewStatus, 'approved')
    assert.equal(approved.contentGridHandoffStatus, 'ready')
    assert.equal(approved.customerWritingStatus, 'blocked')
    assert.equal(Object.isFrozen(approved), true)
    assert.equal(Object.isFrozen(approved.relationReviews), true)
    assert.equal(Object.isFrozen(approved.coverage), true)
    assert.equal(
      approved.relationReviews.every(
        (review) =>
          Object.isFrozen(review) &&
          Object.isFrozen(review.issueCodes),
      ),
      true,
    )
  })

  check('one repair-required relation preserves approved siblings and blocks the entire content-grid handoff', () => {
    const repair = structuredClone(approvedReviewValue)
    ;(repair.relationReviews as MutableRecord[])[1] = {
      relationRef: relationRefs[1],
      decision: 'REPAIR_REQUIRED',
      issueCodes: ['REPEATED_PATTERN_NOT_EQUIVALENT'],
      repairScope: 'RELATION_ONLY',
    }
    repair.coverage = {
      relationRefs,
      approvedRelationRefs: [
        relationRefs[0],
        relationRefs[2],
        relationRefs[3],
      ],
      repairRelationRefs: [relationRefs[1]],
      issueCodes: ['REPEATED_PATTERN_NOT_EQUIVALENT'],
    }
    repair.semanticReviewStatus = 'repair_required'
    repair.contentGridHandoffStatus = 'blocked'
    const result = validate(repair)
    assert.equal(result.semanticReviewStatus, 'repair_required')
    assert.equal(result.contentGridHandoffStatus, 'blocked')
    assert.deepEqual(result.coverage.repairRelationRefs, [
      relationRefs[1],
    ])
    assert.deepEqual(result.coverage.approvedRelationRefs, [
      relationRefs[0],
      relationRefs[2],
      relationRefs[3],
    ])
  })

  check('review coverage is exact, ordered, and one-to-one with every source relation', () => {
    for (const mutate of [
      (value: MutableRecord) =>
        (value.relationReviews as MutableRecord[]).pop(),
      (value: MutableRecord) =>
        (value.relationReviews as MutableRecord[]).push(
          structuredClone(
            (value.relationReviews as MutableRecord[])[0],
          ),
        ),
      (value: MutableRecord) =>
        ((value.relationReviews as MutableRecord[])[0].relationRef =
          'whole-chart-relation:unknown'),
      (value: MutableRecord) =>
        ((
          value.relationReviews as MutableRecord[]
        ).reverse()),
    ]) {
      const forged = structuredClone(approvedReviewValue)
      mutate(forged)
      expectInvalid(() => validate(forged))
    }
  })

  check('decision, fixed issue codes, and repair scope must agree', () => {
    const approvedWithIssue = structuredClone(approvedReviewValue)
    ;(
      approvedWithIssue.relationReviews as MutableRecord[]
    )[0].issueCodes = ['OVERALL_DIRECTION_UNSUPPORTED']
    expectInvalid(() => validate(approvedWithIssue))

    const repairWithoutIssue = structuredClone(approvedReviewValue)
    ;(repairWithoutIssue.relationReviews as MutableRecord[])[0] = {
      relationRef: relationRefs[0],
      decision: 'REPAIR_REQUIRED',
      issueCodes: [],
      repairScope: 'RELATION_ONLY',
    }
    expectInvalid(() => validate(repairWithoutIssue))

    const repairWithNone = structuredClone(approvedReviewValue)
    ;(repairWithNone.relationReviews as MutableRecord[])[0] = {
      relationRef: relationRefs[0],
      decision: 'REPAIR_REQUIRED',
      issueCodes: ['OVERALL_DIRECTION_UNSUPPORTED'],
      repairScope: 'NONE',
    }
    expectInvalid(() => validate(repairWithNone))
  })

  check('relation-specific semantic issues cannot be attached to the wrong relation kind', () => {
    const cases = [
      [0, 'REPEATED_PATTERN_NOT_EQUIVALENT'],
      [1, 'INNER_TENSION_NOT_GENUINE'],
      [2, 'DEEP_FEELING_OVERSTATED'],
      [3, 'OVERALL_DIRECTION_UNSUPPORTED'],
    ] as const
    for (const [index, issueCode] of cases) {
      const forged = structuredClone(approvedReviewValue)
      ;(forged.relationReviews as MutableRecord[])[index] = {
        relationRef: relationRefs[index],
        decision: 'REPAIR_REQUIRED',
        issueCodes: [issueCode],
        repairScope: 'RELATION_ONLY',
      }
      forged.coverage = {
        relationRefs,
        approvedRelationRefs: relationRefs.filter(
          (_, relationIndex) => relationIndex !== index,
        ),
        repairRelationRefs: [relationRefs[index]],
        issueCodes: [issueCode],
      }
      forged.semanticReviewStatus = 'repair_required'
      forged.contentGridHandoffStatus = 'blocked'
      expectInvalid(() => validate(forged))
    }
  })

  check('source result identity and full source binding are revalidated before review acceptance', () => {
    const wrongIdentity = structuredClone(approvedReviewValue)
    wrongIdentity.sourceWholeChartResultRef =
      'whole-chart-result:forged'
    expectInvalid(() => validate(wrongIdentity))

    const forgedSourceSet =
      structuredClone(sourceSet) as unknown as MutableRecord
    forgedSourceSet.runId = 'run:forged'
    expectInvalid(() =>
      validateAiChartD1WholeChartSemanticReviewAgainstSources(
        approvedReviewValue,
        relationResult,
        forgedSourceSet,
        palaceResults,
        fixture.integration,
        fixture.source.n0,
      ),
    )
  })

  check('coverage is derived from review decisions and cannot hide a repair or issue', () => {
    const forged = structuredClone(approvedReviewValue)
    ;(forged.relationReviews as MutableRecord[])[2] = {
      relationRef: relationRefs[2],
      decision: 'REPAIR_REQUIRED',
      issueCodes: ['INNER_TENSION_NOT_GENUINE'],
      repairScope: 'RELATION_ONLY',
    }
    expectInvalid(() => validate(forged))
  })

  check('Strict Schema and parser exclude free-form reasons, scores, rewrites, and customer prose', () => {
    expectInvalid(() =>
      parseAiChartD1WholeChartSemanticReview({
        ...structuredClone(approvedReviewValue),
        reviewSummary: 'forbidden synthetic summary',
      }),
    )
    const schema =
      AI_CHART_D1_WHOLE_CHART_SEMANTIC_REVIEW_JSON_SCHEMA
    const serialized = JSON.stringify(schema)
    assert.equal(Object.isFrozen(schema), true)
    assert.deepEqual(JSON.parse(serialized), schema)
    assert.equal(serialized.includes('uniqueItems'), false)
    for (const forbidden of [
      'reason',
      'score',
      'rewrittenRelation',
      'customerSummary',
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

  check('semantic review module has no runtime, request, repair writer, or customer-writing implementation', () => {
    const source = readFileSync(
      fileURLToPath(
        new URL(
          './d1WholeChartSemanticReviewContracts.ts',
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
      'rewrite',
      'customerReport',
    ]) {
      assert.equal(source.includes(forbidden), false, forbidden)
    }
  })

  console.log(
    `d1WholeChartSemanticReviewContracts tests passed (${checks} checks)`,
  )
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
