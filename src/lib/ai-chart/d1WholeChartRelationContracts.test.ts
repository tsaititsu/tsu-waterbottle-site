import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createAiChartD1FlyingPalaceIntegrationTestFixture } from './d1FlyingPalaceIntegrationTestSupport'
import {
  buildAiChartD1PalaceWritingSourceSet,
  type AiChartD1PalaceWritingSourceCell,
} from './d1PalaceWritingSourceContracts'
import {
  AI_CHART_D1_WHOLE_CHART_RELATION_JSON_SCHEMA,
  AI_CHART_D1_WHOLE_CHART_RELATION_RESULT_VERSION,
  AiChartD1WholeChartRelationError,
  parseAiChartD1WholeChartRelationResult,
  validateAiChartD1WholeChartRelationResultAgainstSources,
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
  assert.throws(run, AiChartD1WholeChartRelationError)
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
  const relations: MutableRecord[] = [
    {
      relationId: 'whole-chart-relation:overall-direction',
      relationKind: 'OVERALL_DIRECTION',
      focusPalaceId: 'palace:ming',
      sourceCellRefs: [mingCell.sourceCellId],
      scanSignalRefs: [],
      mechanismLink:
        'The Ming axis provides one source-bound overall direction.',
      possibleExpressions: [
        'The overall direction may appear across later choices.',
      ],
      constraints: [
        'This relation cannot replace any palace source.',
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
        'The pattern may recur in self-direction and money choices.',
      ],
      constraints: [
        'The shared pattern remains a D1 possibility.',
      ],
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
        'Two palace sources may pull long-term choices in different directions.',
      possibleExpressions: [
        'Relationship and work preferences may remain in tension.',
      ],
      constraints: [
        'Neither side may be deleted or declared the winner.',
      ],
    },
    {
      relationId: 'whole-chart-relation:deep-feeling',
      relationKind: 'DEEP_FEELING_THEME',
      focusPalaceId: signal.palaceId,
      sourceCellRefs: [deepCell.sourceCellId],
      scanSignalRefs: [signal.signalId],
      mechanismLink:
        'A program-confirmed scan signal supports one deeply felt palace theme.',
      possibleExpressions: [
        'The native may experience this area more repeatedly.',
      ],
      constraints: [
        'A deeply felt theme does not make its palace more important.',
      ],
    },
  ]
  const relationIds = relations.map(
    (relation) => relation.relationId as string,
  )
  const relationKinds = relations.map(
    (relation) => relation.relationKind as string,
  )
  const sourceCellRefs = unique(
    relations.flatMap(
      (relation) => relation.sourceCellRefs as string[],
    ),
  )
  const scanSignalRefs = unique(
    relations.flatMap(
      (relation) => relation.scanSignalRefs as string[],
    ),
  )
  const resultFixture: MutableRecord = {
    contractVersion:
      'ai-chart-d1-whole-chart-relation-result/v1',
    wholeChartResultId: 'whole-chart-result:synthetic',
    chartId: sourceSet.chartId,
    runId: sourceSet.runId,
    sourceWritingSetContractVersion: sourceSet.contractVersion,
    relations,
    coverage: {
      relationIds,
      relationKinds,
      sourceCellRefs,
      scanSignalRefs,
    },
    sourceBindingStatus: 'validated',
    semanticReviewStatus: 'required',
    customerWritingStatus: 'blocked',
  }
  const validate = (value: unknown = resultFixture) =>
    validateAiChartD1WholeChartRelationResultAgainstSources(
      value,
      sourceSet,
      palaceResults,
      fixture.integration,
      fixture.source.n0,
    )
  const result = validate()

  check('source-bound result preserves all four relation kinds as immutable internal reasoning', () => {
    assert.equal(
      result.contractVersion,
      AI_CHART_D1_WHOLE_CHART_RELATION_RESULT_VERSION,
    )
    assert.deepEqual(
      result.relations.map((relation) => relation.relationKind),
      [
        'OVERALL_DIRECTION',
        'REPEATED_PATTERN',
        'INNER_TENSION',
        'DEEP_FEELING_THEME',
      ],
    )
    assert.equal(Object.isFrozen(result), true)
    assert.equal(Object.isFrozen(result.relations), true)
    assert.equal(
      result.relations.every(
        (relation) =>
          Object.isFrozen(relation) &&
          Object.isFrozen(relation.sourceCellRefs) &&
          Object.isFrozen(relation.scanSignalRefs) &&
          Object.isFrozen(relation.possibleExpressions) &&
          Object.isFrozen(relation.constraints),
      ),
      true,
    )
  })

  check('overall direction requires a Ming Axis source and remains distinct from customer writing', () => {
    const forged = structuredClone(resultFixture)
    ;(forged.relations as MutableRecord[])[0].sourceCellRefs = [
      wealthCell.sourceCellId,
    ]
    ;(forged.coverage as MutableRecord).sourceCellRefs =
      sourceCellRefs.map((ref) =>
        ref === mingCell.sourceCellId
          ? wealthCell.sourceCellId
          : ref,
      )
    expectInvalid(() => validate(forged))
    assert.equal(result.sourceBindingStatus, 'validated')
    assert.equal(result.semanticReviewStatus, 'required')
    assert.equal(result.customerWritingStatus, 'blocked')
  })

  check('repeated pattern and inner tension each require sources from at least two different palaces', () => {
    for (const relationIndex of [1, 2]) {
      const forged = structuredClone(resultFixture)
      ;(forged.relations as MutableRecord[])[
        relationIndex
      ].sourceCellRefs = [mingCell.sourceCellId]
      ;(forged.coverage as MutableRecord).sourceCellRefs = unique(
        (forged.relations as MutableRecord[]).flatMap(
          (relation) => relation.sourceCellRefs as string[],
        ),
      )
      expectInvalid(() => validate(forged))
    }
  })

  check('deep feeling theme requires a relevant scan signal bound to an Axis source evidence chain', () => {
    const deepRelation = result.relations.find(
      (relation) =>
        relation.relationKind === 'DEEP_FEELING_THEME',
    )
    assert.notEqual(deepRelation, undefined)
    assert.equal(deepRelation!.focusPalaceId, signal.palaceId)
    assert.deepEqual(deepRelation!.scanSignalRefs, [signal.signalId])

    const wrongSource = structuredClone(resultFixture)
    ;(wrongSource.relations as MutableRecord[])[3].sourceCellRefs = [
      mingCell.sourceCellId,
    ]
    ;(wrongSource.coverage as MutableRecord).sourceCellRefs = unique(
      (wrongSource.relations as MutableRecord[]).flatMap(
        (relation) => relation.sourceCellRefs as string[],
      ),
    )
    expectInvalid(() => validate(wrongSource))

    const unknownSignal = structuredClone(resultFixture)
    ;(unknownSignal.relations as MutableRecord[])[3].scanSignalRefs = [
      'signal:synthetic:unknown',
    ]
    ;(unknownSignal.coverage as MutableRecord).scanSignalRefs = [
      'signal:synthetic:unknown',
    ]
    expectInvalid(() => validate(unknownSignal))
  })

  check('unknown, duplicate, or missing source cells fail closed without deleting valid relations', () => {
    const unknown = structuredClone(resultFixture)
    ;(unknown.relations as MutableRecord[])[1].sourceCellRefs = [
      mingCell.sourceCellId,
      'writing-source-cell:palace:unknown:1',
    ]
    ;(unknown.coverage as MutableRecord).sourceCellRefs = unique(
      (unknown.relations as MutableRecord[]).flatMap(
        (relation) => relation.sourceCellRefs as string[],
      ),
    )
    expectInvalid(() => validate(unknown))

    const duplicate = structuredClone(resultFixture)
    ;(duplicate.relations as MutableRecord[])[1].sourceCellRefs = [
      mingCell.sourceCellId,
      mingCell.sourceCellId,
    ]
    expectInvalid(() => validate(duplicate))

    const missingOverall = structuredClone(resultFixture)
    ;(missingOverall.relations as MutableRecord[]).splice(0, 1)
    ;(missingOverall.coverage as MutableRecord).relationIds =
      relationIds.slice(1)
    ;(missingOverall.coverage as MutableRecord).relationKinds =
      relationKinds.slice(1)
    ;(missingOverall.coverage as MutableRecord).sourceCellRefs =
      unique(
        (missingOverall.relations as MutableRecord[]).flatMap(
          (relation) => relation.sourceCellRefs as string[],
        ),
      )
    expectInvalid(() => validate(missingOverall))
  })

  check('coverage is derived from relation references and cannot hide a source or signal', () => {
    const missingSource = structuredClone(resultFixture)
    ;(missingSource.coverage as MutableRecord).sourceCellRefs =
      sourceCellRefs.slice(1)
    expectInvalid(() => validate(missingSource))

    const missingSignal = structuredClone(resultFixture)
    ;(missingSignal.coverage as MutableRecord).scanSignalRefs = []
    expectInvalid(() => validate(missingSignal))
  })

  check('a forged writing source set, palace identity, or N0 chart is rejected before source binding', () => {
    const forgedSet = structuredClone(sourceSet) as unknown as MutableRecord
    forgedSet.runId = 'run:forged'
    expectInvalid(() =>
      validateAiChartD1WholeChartRelationResultAgainstSources(
        resultFixture,
        forgedSet,
        palaceResults,
        fixture.integration,
        fixture.source.n0,
      ),
    )

    const wrongChart = structuredClone(resultFixture)
    wrongChart.chartId = 'chart:forged'
    expectInvalid(() => validate(wrongChart))

    const forgedN0 = structuredClone(
      fixture.source.n0,
    ) as unknown as MutableRecord
    forgedN0.chartId = 'chart:forged'
    expectInvalid(() =>
      validateAiChartD1WholeChartRelationResultAgainstSources(
        resultFixture,
        sourceSet,
        palaceResults,
        fixture.integration,
        forgedN0,
      ),
    )
  })

  check('parser and Strict Schema reject scores, dominant winners, prose fields, and unknown metadata', () => {
    expectInvalid(() =>
      parseAiChartD1WholeChartRelationResult({
        ...structuredClone(resultFixture),
        customerSummary: 'forbidden synthetic prose',
      }),
    )
    const schema = AI_CHART_D1_WHOLE_CHART_RELATION_JSON_SCHEMA
    const serialized = JSON.stringify(schema)
    assert.equal(Object.isFrozen(schema), true)
    assert.deepEqual(JSON.parse(serialized), schema)
    assert.equal(serialized.includes('uniqueItems'), false)
    for (const forbidden of [
      'netScore',
      'dominantRelation',
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

  check('contract module has no runtime, request, model policy, or customer-writing implementation', () => {
    const source = readFileSync(
      fileURLToPath(
        new URL(
          './d1WholeChartRelationContracts.ts',
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
    ]) {
      assert.equal(source.includes(forbidden), false, forbidden)
    }
  })

  console.log(
    `d1WholeChartRelationContracts tests passed (${checks} checks)`,
  )
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
