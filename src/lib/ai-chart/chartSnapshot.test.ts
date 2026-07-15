import assert from 'node:assert/strict'
import { createZiweiChart } from '@/features/ziwei-chart/lib/astrolabe/createAstrolabe'
import type { StarInfo, ZiweiChart } from '@/features/ziwei-chart/types/ziwei'
import {
  AI_CHART_BIRTH_INPUT_VERSION,
  toZiweiChartEngineInput,
  type CanonicalAiChartBirthInput,
} from '@/lib/ai-chart/birthInput'
import {
  AI_CHART_ENGINE_NAME,
  AI_CHART_ENGINE_VERSION,
  AI_CHART_SNAPSHOT_VERSION,
  buildCanonicalAiChartSnapshot,
  copyCanonicalAiChartSnapshot,
} from '@/lib/ai-chart/chartSnapshot'
import { createCanonicalAiChartSnapshot } from '@/lib/ai-chart/chartSnapshot.server'

const canonicalInput: CanonicalAiChartBirthInput = {
  version: AI_CHART_BIRTH_INPUT_VERSION,
  solarDate: '1990-05-20',
  timeIndex: 6,
  gender: 'female',
  name: '人工測試姓名',
  fixLeap: false,
}

function cloneChart(chart: ZiweiChart): ZiweiChart {
  return {
    birthInfo: { ...chart.birthInfo },
    fiveElementsClass: chart.fiveElementsClass,
    palaces: chart.palaces.map((palace) => ({
      ...palace,
      majorStars: palace.majorStars.map((star) => ({ ...star })),
      minorStars: palace.minorStars.map((star) => ({ ...star })),
      adjectiveStars: palace.adjectiveStars.map((star) => ({ ...star })),
      decadal: {
        ...palace.decadal,
        range: [palace.decadal.range[0], palace.decadal.range[1]],
      },
      ages: [...palace.ages],
    })),
    horoscope: chart.horoscope,
  }
}

function firstStar(chart: ZiweiChart): StarInfo {
  for (const palace of chart.palaces) {
    const star = palace.majorStars[0] ?? palace.minorStars[0] ?? palace.adjectiveStars[0]
    if (star) return star
  }
  throw new Error('synthetic_chart_has_no_stars')
}

function assertInvariantFailure(mutate: (chart: ZiweiChart) => void) {
  const invalidChart = cloneChart(baseChart)
  mutate(invalidChart)
  assert.throws(
    () => buildCanonicalAiChartSnapshot(canonicalInput, invalidChart),
    { message: 'ai_chart_snapshot_invariant_failed' },
  )
}

const baseChart = createZiweiChart(toZiweiChartEngineInput(canonicalInput))
const originalPalaces = structuredClone(baseChart.palaces)
const snapshot = buildCanonicalAiChartSnapshot(canonicalInput, baseChart)
const serverSnapshot = createCanonicalAiChartSnapshot(canonicalInput)

assert.deepEqual(serverSnapshot, snapshot)
assert.equal(snapshot.version, AI_CHART_SNAPSHOT_VERSION)
assert.equal(snapshot.source, AI_CHART_ENGINE_NAME)
assert.equal(snapshot.engineVersion, AI_CHART_ENGINE_VERSION)
assert.equal(snapshot.birthInputVersion, AI_CHART_BIRTH_INPUT_VERSION)
assert.equal(snapshot.palaces.length, 12)
assert.deepEqual(snapshot.palaces.map((palace) => palace.index), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
assert.equal(snapshot.palaces.filter((palace) => palace.isMingPalace).length, 1)
assert.equal(snapshot.palaces.filter((palace) => palace.isBodyPalace).length, 1)

const originalMingPalace = baseChart.palaces.find((palace) => palace.isOriginalPalace)
const snapshotMingPalace = snapshot.palaces.find((palace) => palace.isMingPalace)
assert.ok(originalMingPalace)
assert.ok(snapshotMingPalace)
assert.equal(snapshotMingPalace.index, originalMingPalace.index)

assert.deepEqual(baseChart.palaces, originalPalaces)
assert.equal('name' in snapshot, false)
for (const field of ['solarDate', 'timeIndex', 'gender', 'fixLeap', 'horoscope']) {
  assert.equal(field in snapshot, false, field)
}

const serializedSnapshot = JSON.stringify(snapshot)
assert.equal(serializedSnapshot.includes('人工測試姓名'), false)
for (const forbiddenField of [
  'horoscope',
  'chartContext',
  'keyPalaces',
  'mutagenSummary',
  'sanFangSiZheng',
  'messages',
  'prompt',
  'responseSchema',
  'openAiRequest',
  'openAiResponse',
]) {
  assert.equal(serializedSnapshot.includes(`"${forbiddenField}"`), false, forbiddenField)
}
assert.deepEqual(JSON.parse(serializedSnapshot), snapshot)

const lateMidnightInput: CanonicalAiChartBirthInput = {
  version: AI_CHART_BIRTH_INPUT_VERSION,
  solarDate: '2001-09-09',
  timeIndex: 12,
  gender: 'female',
  fixLeap: false,
}
const lateMidnightSnapshot = buildCanonicalAiChartSnapshot(
  lateMidnightInput,
  createZiweiChart(toZiweiChartEngineInput(lateMidnightInput)),
)
assert.equal(lateMidnightSnapshot.palaces.length, 12)

const copiedSnapshot = copyCanonicalAiChartSnapshot(snapshot)
assert.deepEqual(copiedSnapshot, snapshot)
assert.notEqual(copiedSnapshot, snapshot)
assert.notEqual(copiedSnapshot.palaces, snapshot.palaces)
assert.notEqual(copiedSnapshot.palaces[0], snapshot.palaces[0])
assert.notEqual(copiedSnapshot.palaces[0].decadal, snapshot.palaces[0].decadal)
assert.notEqual(copiedSnapshot.palaces[0].decadal.range, snapshot.palaces[0].decadal.range)
assert.notEqual(copiedSnapshot.palaces[0].ages, snapshot.palaces[0].ages)

const palaceWithStarsIndex = snapshot.palaces.findIndex(
  (palace) => palace.majorStars.length + palace.minorStars.length + palace.adjectiveStars.length > 0,
)
assert.notEqual(palaceWithStarsIndex, -1)
const originalStar =
  snapshot.palaces[palaceWithStarsIndex].majorStars[0] ??
  snapshot.palaces[palaceWithStarsIndex].minorStars[0] ??
  snapshot.palaces[palaceWithStarsIndex].adjectiveStars[0]
const copiedStar =
  copiedSnapshot.palaces[palaceWithStarsIndex].majorStars[0] ??
  copiedSnapshot.palaces[palaceWithStarsIndex].minorStars[0] ??
  copiedSnapshot.palaces[palaceWithStarsIndex].adjectiveStars[0]
assert.ok(originalStar)
assert.ok(copiedStar)
assert.notEqual(copiedStar, originalStar)

const copiedFirstAge = copiedSnapshot.palaces[0].ages[0]
const copiedRangeStart = copiedSnapshot.palaces[0].decadal.range[0]
const copiedStarName = copiedStar.name
snapshot.palaces[0].ages[0] = 999
snapshot.palaces[0].decadal.range[0] = 999
originalStar.name = '修改後星曜'
assert.equal(copiedSnapshot.palaces[0].ages[0], copiedFirstAge)
assert.equal(copiedSnapshot.palaces[0].decadal.range[0], copiedRangeStart)
assert.equal(copiedStar.name, copiedStarName)

assertInvariantFailure((chart) => {
  chart.palaces.pop()
})
assertInvariantFailure((chart) => {
  chart.palaces[1].index = chart.palaces[0].index
})
assertInvariantFailure((chart) => {
  chart.palaces[1].earthlyBranch = chart.palaces[0].earthlyBranch
})
assertInvariantFailure((chart) => {
  chart.palaces[1].name = chart.palaces[0].name
})
assertInvariantFailure((chart) => {
  for (const palace of chart.palaces) palace.isOriginalPalace = false
})
assertInvariantFailure((chart) => {
  for (const palace of chart.palaces) palace.isBodyPalace = false
})
assertInvariantFailure((chart) => {
  chart.birthInfo.solarDate = '2000-01-01'
})
assertInvariantFailure((chart) => {
  firstStar(chart).scope = 'yearly'
})
assertInvariantFailure((chart) => {
  firstStar(chart).type = 'invalid' as StarInfo['type']
})
assertInvariantFailure((chart) => {
  firstStar(chart).mutagen = 'invalid' as NonNullable<StarInfo['mutagen']>
})
assertInvariantFailure((chart) => {
  firstStar(chart).group = 'invalid' as NonNullable<StarInfo['group']>
})
assertInvariantFailure((chart) => {
  firstStar(chart).brightness = (() => 'invalid') as unknown as string
})
assertInvariantFailure((chart) => {
  chart.fiveElementsClass = new Date() as unknown as string
})
assertInvariantFailure((chart) => {
  chart.palaces[0].ages[0] = undefined as unknown as number
})

console.log('✓ AI chart snapshot test source covers privacy, deep copying, and runtime invariants')
