import assert from 'node:assert/strict'
import { normalizeAiChartD1N0 } from './d1N0'
import {
  AI_CHART_D1_PALACE_IDENTITIES,
  type AiChartD1PalaceId,
} from './d1N0Constants'
import {
  buildAiChartD1FlyingFacts,
  type AiChartD1FlyingFactSet,
} from './d1FlyingFactSource'
import type { AiChartD1FlyingModelInputSet } from './d1FlyingModelInputContracts'
import { buildAiChartD1FlyingModelInputs } from './d1FlyingModelInputContracts'
import {
  AI_CHART_D1_PALACE_REASONING_RESULT_CONTRACT_VERSION,
  parseAiChartD1PalaceReasoningResult,
  type AiChartD1PalaceReasoningResult,
} from './d1PalaceIntegrationContracts'
import { AI_CHART_D1_PALACE_FACET_REGISTRY } from './d1PalaceFacetRegistry'
import type { AiChartD1N0 } from './d1N0Parser'

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

export function createAiChartD1FlyingModelInputTestSnapshot():
  MutableRecord {
  const snapshot: MutableRecord = {
    version: 'ai-chart-chart-snapshot/v1',
    source: 'waterbottle-ziwei-native',
    engineVersion: 'v1',
    birthInputVersion: 'ai-chart-birth-input/v1',
    lunarDate: 'synthetic-flying-model-input',
    fiveElementsClass: 'synthetic-flying-model-input',
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

function palaceResultFixture(
  chartId: string,
  palaceId: AiChartD1PalaceId,
): AiChartD1PalaceReasoningResult {
  const registryEntry = AI_CHART_D1_PALACE_FACET_REGISTRY.find(
    (entry) => entry.palaceId === palaceId,
  )
  assert.notEqual(registryEntry, undefined)
  const facetId = registryEntry!.facetIds[0]
  const claimRef = `claim:${palaceId}:axis`
  const meaningRef = `rule:${palaceId}:meaning`
  return parseAiChartD1PalaceReasoningResult({
    contractVersion:
      AI_CHART_D1_PALACE_REASONING_RESULT_CONTRACT_VERSION,
    palaceResultId: `palace-result:${palaceId}`,
    chartId,
    runId: 'run:synthetic-flying-model-input',
    callId: `call:${palaceId}`,
    targetPalaceId: palaceId,
    axisResultRef: `axis-result:${palaceId}`,
    structuralInfluenceResultRef: `structural-result:${palaceId}`,
    structuralInfluenceRefs: [],
    facetIndex: [
      {
        facetId,
        axisClaimRefs: [claimRef],
        structuralInfluenceRefs: [],
      },
    ],
    sourceGraph: [
      {
        nodeRef: claimRef,
        nodeKind: 'AXIS_CLAIM',
        sourceRefs: [meaningRef],
        targetRefs: [],
      },
    ],
    coverage: {
      facetIds: [facetId],
      axisClaimRefs: [claimRef],
      structuralInfluenceRefs: [],
      sourceRefs: [meaningRef],
    },
    validationStatus: 'validated',
  })
}

export type AiChartD1FlyingModelInputTestFixture = Readonly<{
  n0: AiChartD1N0
  factSet: AiChartD1FlyingFactSet
  palaceResults: readonly AiChartD1PalaceReasoningResult[]
  modelInputSet: AiChartD1FlyingModelInputSet
}>

export function createAiChartD1FlyingModelInputTestFixture():
  AiChartD1FlyingModelInputTestFixture {
  const n0 = normalizeAiChartD1N0(
    createAiChartD1FlyingModelInputTestSnapshot(),
    {
    chartId: 'chart:synthetic-flying-model-input',
    },
  )
  const factSet = buildAiChartD1FlyingFacts(n0)
  const palaceResults = AI_CHART_D1_PALACE_IDENTITIES.map(
    ({ palaceId }) => palaceResultFixture(n0.chartId, palaceId),
  )
  return Object.freeze({
    n0,
    factSet,
    palaceResults,
    modelInputSet: buildAiChartD1FlyingModelInputs(
      n0,
      factSet,
      palaceResults,
    ),
  })
}
