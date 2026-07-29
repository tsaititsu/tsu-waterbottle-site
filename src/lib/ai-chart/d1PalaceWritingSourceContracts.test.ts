import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  AI_CHART_D1_PALACE_IDENTITIES,
  type AiChartD1PalaceId,
} from './d1N0Constants'
import { createAiChartD1FlyingPalaceIntegrationTestFixture } from './d1FlyingPalaceIntegrationTestSupport'
import {
  AI_CHART_D1_PALACE_WRITING_SOURCE_JSON_SCHEMA,
  AI_CHART_D1_PALACE_WRITING_SOURCE_SET_VERSION,
  AiChartD1PalaceWritingSourceError,
  buildAiChartD1PalaceWritingSourceSet,
  parseAiChartD1PalaceWritingSourceSet,
} from './d1PalaceWritingSourceContracts'

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
  assert.throws(run, AiChartD1PalaceWritingSourceError)
}

function palace(
  value: ReturnType<typeof buildAiChartD1PalaceWritingSourceSet>,
  palaceId: AiChartD1PalaceId,
) {
  const entry = value.palaces.find(
    (candidate) => candidate.targetPalaceId === palaceId,
  )
  assert.notEqual(entry, undefined)
  return entry!
}

async function run() {
  const fixture =
    await createAiChartD1FlyingPalaceIntegrationTestFixture()
  const palaceResults = fixture.source.palaceResults
  const sourceSet = buildAiChartD1PalaceWritingSourceSet(
    [...palaceResults].reverse(),
    fixture.integration,
  )
  const allCells = sourceSet.palaces.flatMap(
    (entry) => entry.sourceCells,
  )

  check('builder creates twelve canonical immutable palace envelopes from validated upstream results', () => {
    assert.equal(
      sourceSet.contractVersion,
      AI_CHART_D1_PALACE_WRITING_SOURCE_SET_VERSION,
    )
    assert.deepEqual(
      sourceSet.palaces.map((entry) => entry.targetPalaceId),
      AI_CHART_D1_PALACE_IDENTITIES.map(
        (identity) => identity.palaceId,
      ),
    )
    assert.equal(sourceSet.palaces.length, 12)
    assert.equal(Object.isFrozen(sourceSet), true)
    assert.equal(Object.isFrozen(sourceSet.palaces), true)
    assert.equal(
      sourceSet.palaces.every(
        (entry) =>
          Object.isFrozen(entry) &&
          Object.isFrozen(entry.sourceCells),
      ),
      true,
    )
  })

  check('every Axis, Structural, and Flying source is preserved in exactly one unmerged source cell', () => {
    const expectedAxisRefs = palaceResults.flatMap(
      (result) => result.coverage.axisClaimRefs,
    )
    const expectedStructuralRefs = palaceResults.flatMap(
      (result) => result.coverage.structuralInfluenceRefs,
    )
    const expectedFlyingRefs =
      fixture.integration.coverage.flyingInfluenceRefs

    assert.equal(allCells.length, 60)
    assert.deepEqual(
      sourceSet.coverage.axisClaimRefs,
      expectedAxisRefs,
    )
    assert.deepEqual(
      sourceSet.coverage.structuralInfluenceRefs,
      expectedStructuralRefs,
    )
    assert.deepEqual(
      sourceSet.coverage.flyingInfluenceRefs,
      expectedFlyingRefs,
    )
    assert.deepEqual(
      allCells
        .filter((cell) => cell.sourceKind === 'AXIS_CLAIM')
        .map((cell) => cell.sourceRef),
      expectedAxisRefs,
    )
    assert.deepEqual(
      allCells
        .filter(
          (cell) => cell.sourceKind === 'STRUCTURAL_INFLUENCE',
        )
        .map((cell) => cell.sourceRef),
      expectedStructuralRefs,
    )
    assert.deepEqual(
      allCells
        .filter(
          (cell) => cell.sourceKind === 'FLYING_INFLUENCE',
        )
        .map((cell) => cell.sourceRef),
      expectedFlyingRefs,
    )
    assert.equal(
      new Set(allCells.map((cell) => cell.sourceCellId)).size,
      allCells.length,
    )
  })

  check('coexisting positive and difficult Tianji money sources remain separate rather than being netted', () => {
    const wealth = palace(sourceSet, 'palace:wealth')
    const parentLu = fixture.integration.palaces
      .find((entry) => entry.targetPalaceId === 'palace:wealth')!
      .influences.find(
        (influence) =>
          influence.sourcePalaceId === 'palace:parents' &&
          influence.transformationKind === 'LU',
      )!
    const wealthJi = fixture.integration.palaces
      .find((entry) => entry.targetPalaceId === 'palace:wealth')!
      .influences.find(
        (influence) =>
          influence.sourcePalaceId === 'palace:wealth' &&
          influence.transformationKind === 'JI',
      )!
    const parentLuCell = wealth.sourceCells.find(
      (cell) => cell.sourceRef === parentLu.flyingInfluenceId,
    )
    const wealthJiCell = wealth.sourceCells.find(
      (cell) => cell.sourceRef === wealthJi.flyingInfluenceId,
    )

    assert.notEqual(parentLuCell, undefined)
    assert.notEqual(wealthJiCell, undefined)
    assert.notEqual(
      parentLuCell!.sourceCellId,
      wealthJiCell!.sourceCellId,
    )
    assert.equal(parentLuCell!.facetId, 'money.earning')
    assert.equal(wealthJiCell!.facetId, 'money.management')
    assert.equal(
      JSON.stringify(sourceSet).includes('netScore'),
      false,
    )
    assert.equal(
      JSON.stringify(sourceSet).includes('dominantSource'),
      false,
    )
  })

  check('empty facets do not create synthetic content while an empty Flying palace keeps its Axis source', () => {
    const travel = palace(sourceSet, 'palace:travel')
    assert.equal(
      fixture.integration.palaces.find(
        (entry) => entry.targetPalaceId === 'palace:travel',
      )!.influences.length,
      0,
    )
    assert.equal(travel.sourceCells.length, 1)
    assert.equal(travel.sourceCells[0].sourceKind, 'AXIS_CLAIM')
    assert.equal(
      travel.sourceCells.some((cell) => cell.sourceRef.length === 0),
      false,
    )
  })

  check('handoff remains blocked from customer writing and OpenAI until whole-chart relations exist', () => {
    assert.deepEqual(sourceSet.handoffPolicy, {
      preserveEverySource: true,
      preserveContradictions: true,
      semanticMerging: 'NOT_PERFORMED',
      emptyCellCreation: 'FORBIDDEN',
      wholeChartRelations: 'REQUIRED_BEFORE_WRITING',
      customerWriting: 'BLOCKED',
    })
    assert.equal(sourceSet.openAiCallable, false)
    const serialized = JSON.stringify(sourceSet)
    for (const forbidden of [
      'majorStarsConsidered',
      'customerReport',
      'mergedConclusion',
      'summary',
      'paragraph',
    ]) {
      assert.equal(serialized.includes(forbidden), false, forbidden)
    }
  })

  check('missing, duplicate, or cross-identity palace results fail closed', () => {
    expectInvalid(() =>
      buildAiChartD1PalaceWritingSourceSet(
        palaceResults.slice(1),
        fixture.integration,
      ),
    )
    expectInvalid(() =>
      buildAiChartD1PalaceWritingSourceSet(
        [...palaceResults.slice(0, 11), palaceResults[0]],
        fixture.integration,
      ),
    )
    const wrongChart = structuredClone(
      palaceResults,
    ) as unknown as MutableRecord[]
    wrongChart[0].chartId = 'chart:wrong'
    expectInvalid(() =>
      buildAiChartD1PalaceWritingSourceSet(
        wrongChart,
        fixture.integration,
      ),
    )
  })

  check('a Flying influence bound to the wrong palace result fails before indexing', () => {
    const forged = structuredClone(
      fixture.integration,
    ) as unknown as MutableRecord
    const palaces = forged.palaces as MutableRecord[]
    const ming = palaces.find(
      (entry) => entry.targetPalaceId === 'palace:ming',
    )!
    const influences = ming.influences as MutableRecord[]
    assert.notEqual(influences[0], undefined)
    influences[0].targetPalaceResultRef =
      'palace-result:palace:parents'
    expectInvalid(() =>
      buildAiChartD1PalaceWritingSourceSet(
        palaceResults,
        forged,
      ),
    )
  })

  check('parser and JSON Schema reject prose or unowned merge metadata and remain strict', () => {
    expectInvalid(() =>
      parseAiChartD1PalaceWritingSourceSet({
        ...structuredClone(sourceSet),
        customerSummary: 'forbidden synthetic prose',
      }),
    )
    const schema = AI_CHART_D1_PALACE_WRITING_SOURCE_JSON_SCHEMA
    const serialized = JSON.stringify(schema)
    assert.equal(Object.isFrozen(schema), true)
    assert.deepEqual(JSON.parse(serialized), schema)
    assert.equal(serialized.includes('uniqueItems'), false)
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

  check('contract module contains no runtime, OpenAI request, or customer-writing implementation', () => {
    const source = readFileSync(
      fileURLToPath(
        new URL(
          './d1PalaceWritingSourceContracts.ts',
          import.meta.url,
        ),
      ),
      'utf8',
    )
    for (const forbidden of [
      'fetch(',
      'responses.create',
      'requestAiChartOpenAiStructuredResponse',
      'process.env',
      'OPENAI_API_KEY',
      'customerReport',
    ]) {
      assert.equal(source.includes(forbidden), false, forbidden)
    }
  })

  console.log(
    `d1PalaceWritingSourceContracts tests passed (${checks} checks)`,
  )
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
