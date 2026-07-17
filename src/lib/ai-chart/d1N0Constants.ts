import type { EarthlyBranch } from '@/features/ziwei-chart/types/ziwei'
import { MUTAGEN_TABLE } from '../../features/ziwei-chart/lib/engine/constants'
import type { AiChartD1PalaceName } from './d1CommonContracts'

export const AI_CHART_D1_N0_CONTRACT_VERSION = 'ai-chart-d1-n0/v1' as const
export const AI_CHART_D1_P1_STRUCTURAL_INPUT_CONTRACT_VERSION =
  'ai-chart-d1-p1-structural-input/v1' as const
export const AI_CHART_D1_F1_BLOCKED_STATUS =
  'F1_BLOCKED_BY_MISSING_FLYING_TRANSFORM_SOURCE' as const

export const AI_CHART_D1_N0_INVALID = 'ai_chart_d1_n0_invalid' as const
export const AI_CHART_D1_P1_INPUT_INVALID =
  'ai_chart_d1_p1_input_invalid' as const

export const AI_CHART_D1_MAJOR_STAR_NAMES = Object.freeze([
  '紫微',
  '天機',
  '太陽',
  '武曲',
  '天同',
  '廉貞',
  '天府',
  '太陰',
  '貪狼',
  '巨門',
  '天相',
  '天梁',
  '七殺',
  '破軍',
] as const)

export type AiChartD1MajorStarName =
  (typeof AI_CHART_D1_MAJOR_STAR_NAMES)[number]

export const AI_CHART_D1_MUTAGEN_TYPES = Object.freeze([
  '化祿',
  '化權',
  '化科',
  '化忌',
] as const)

export type AiChartD1MutagenType =
  (typeof AI_CHART_D1_MUTAGEN_TYPES)[number]

export const AI_CHART_D1_MODELED_SUPPORTING_STARS = Object.freeze({
  文昌: 'soft',
  文曲: 'soft',
  左輔: 'soft',
  右弼: 'soft',
  天魁: 'soft',
  天鉞: 'soft',
  擎羊: 'tough',
  陀羅: 'tough',
  火星: 'tough',
  鈴星: 'tough',
  祿存: 'lucun',
} as const)

export type AiChartD1ModeledSupportingStarName =
  keyof typeof AI_CHART_D1_MODELED_SUPPORTING_STARS

export const AI_CHART_D1_BORROW_BLOCKING_STAR_NAMES = Object.freeze([
  '擎羊',
  '陀羅',
  '火星',
  '鈴星',
  '文昌',
  '文曲',
] as const)

export const AI_CHART_D1_MALEFIC_SIGNAL_STAR_NAMES = Object.freeze([
  '擎羊',
  '陀羅',
  '火星',
  '鈴星',
] as const)

export const AI_CHART_D1_DOUBLE_MAJOR_STAR_PAIRS = Object.freeze([
  Object.freeze(['紫微', '七殺'] as const),
  Object.freeze(['紫微', '破軍'] as const),
  Object.freeze(['紫微', '天府'] as const),
  Object.freeze(['紫微', '天相'] as const),
  Object.freeze(['紫微', '貪狼'] as const),
  Object.freeze(['廉貞', '七殺'] as const),
  Object.freeze(['廉貞', '天府'] as const),
  Object.freeze(['武曲', '七殺'] as const),
  Object.freeze(['武曲', '天府'] as const),
  Object.freeze(['廉貞', '天相'] as const),
  Object.freeze(['廉貞', '破軍'] as const),
  Object.freeze(['武曲', '天相'] as const),
  Object.freeze(['武曲', '破軍'] as const),
  Object.freeze(['廉貞', '貪狼'] as const),
  Object.freeze(['武曲', '貪狼'] as const),
  Object.freeze(['太陽', '太陰'] as const),
  Object.freeze(['太陽', '天梁'] as const),
  Object.freeze(['巨門', '太陽'] as const),
  Object.freeze(['天機', '太陰'] as const),
  Object.freeze(['太陰', '天同'] as const),
  Object.freeze(['天機', '天梁'] as const),
  Object.freeze(['天機', '巨門'] as const),
  Object.freeze(['天同', '天梁'] as const),
  Object.freeze(['天同', '巨門'] as const),
] as const)

export type AiChartD1DoubleMajorStarPair =
  (typeof AI_CHART_D1_DOUBLE_MAJOR_STAR_PAIRS)[number]

export const AI_CHART_D1_PALACE_IDENTITIES = Object.freeze([
  Object.freeze({
    engineName: '命宮',
    canonicalName: '命宮',
    palaceId: 'palace:ming',
  }),
  Object.freeze({
    engineName: '兄弟',
    canonicalName: '兄弟宮',
    palaceId: 'palace:siblings',
  }),
  Object.freeze({
    engineName: '夫妻',
    canonicalName: '夫妻宮',
    palaceId: 'palace:spouse',
  }),
  Object.freeze({
    engineName: '子女',
    canonicalName: '子女宮',
    palaceId: 'palace:children',
  }),
  Object.freeze({
    engineName: '財帛',
    canonicalName: '財帛宮',
    palaceId: 'palace:wealth',
  }),
  Object.freeze({
    engineName: '疾厄',
    canonicalName: '疾厄宮',
    palaceId: 'palace:health',
  }),
  Object.freeze({
    engineName: '遷移',
    canonicalName: '遷移宮',
    palaceId: 'palace:travel',
  }),
  Object.freeze({
    engineName: '僕役',
    canonicalName: '僕役宮',
    palaceId: 'palace:friends',
  }),
  Object.freeze({
    engineName: '官祿',
    canonicalName: '官祿宮',
    palaceId: 'palace:career',
  }),
  Object.freeze({
    engineName: '田宅',
    canonicalName: '田宅宮',
    palaceId: 'palace:property',
  }),
  Object.freeze({
    engineName: '福德',
    canonicalName: '福德宮',
    palaceId: 'palace:fortune',
  }),
  Object.freeze({
    engineName: '父母',
    canonicalName: '父母宮',
    palaceId: 'palace:parents',
  }),
] as const)

export type AiChartD1PalaceId =
  (typeof AI_CHART_D1_PALACE_IDENTITIES)[number]['palaceId']

export const AI_CHART_D1_EARTHLY_BRANCHES = Object.freeze([
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
] as const satisfies readonly EarthlyBranch[])

export const AI_CHART_D1_FOUR_HORSE_BRANCHES = Object.freeze([
  '寅',
  '巳',
  '申',
  '亥',
] as const satisfies readonly EarthlyBranch[])

export const AI_CHART_D1_HIDDEN_COMBINATION_PAIRS = Object.freeze([
  Object.freeze(['子', '丑'] as const),
  Object.freeze(['寅', '亥'] as const),
  Object.freeze(['卯', '戌'] as const),
  Object.freeze(['辰', '酉'] as const),
  Object.freeze(['巳', '申'] as const),
  Object.freeze(['午', '未'] as const),
] as const)

export const AI_CHART_D1_TRINE_GROUPS = Object.freeze([
  Object.freeze(['申', '子', '辰'] as const),
  Object.freeze(['亥', '卯', '未'] as const),
  Object.freeze(['寅', '午', '戌'] as const),
  Object.freeze(['巳', '酉', '丑'] as const),
] as const)

export const AI_CHART_D1_ENGINE_PALACE_TO_CANONICAL = Object.freeze(
  Object.fromEntries(
    AI_CHART_D1_PALACE_IDENTITIES.map((identity) => [
      identity.engineName,
      identity.canonicalName,
    ]),
  ) as Readonly<Record<string, AiChartD1PalaceName>>,
)

export const AI_CHART_D1_CANONICAL_PALACE_TO_ID = Object.freeze(
  Object.fromEntries(
    AI_CHART_D1_PALACE_IDENTITIES.map((identity) => [
      identity.canonicalName,
      identity.palaceId,
    ]),
  ) as Readonly<Record<AiChartD1PalaceName, AiChartD1PalaceId>>,
)

const MUTAGEN_ID_SUFFIX: Readonly<Record<AiChartD1MutagenType, string>> =
  Object.freeze({
    化祿: 'lu',
    化權: 'quan',
    化科: 'ke',
    化忌: 'ji',
  })

const SIGNAL_ID_SUFFIX = Object.freeze({
  擎羊: 'qingyang',
  陀羅: 'tuoluo',
  火星: 'huoxing',
  鈴星: 'lingxing',
  生年化忌: 'natal-ji',
} as const)

export type AiChartD1N0SignalType = keyof typeof SIGNAL_ID_SUFFIX

export type AiChartD1NatalMutagenTableAssignment = Readonly<{
  type: AiChartD1MutagenType
  starName: string
}>

export type AiChartD1NatalMutagenTableCompatibility =
  | 'complete_table_validated'
  | 'partial_table_compatible'

export function getAiChartD1PalaceIdentity(engineName: string) {
  return AI_CHART_D1_PALACE_IDENTITIES.find(
    (identity) => identity.engineName === engineName,
  )
}

export function getAiChartD1CanonicalDoubleMajorStarPair(
  names: readonly AiChartD1MajorStarName[],
): AiChartD1DoubleMajorStarPair | null {
  if (names.length !== 2 || names[0] === names[1]) return null
  return (
    AI_CHART_D1_DOUBLE_MAJOR_STAR_PAIRS.find(
      ([left, right]) =>
        (left === names[0] && right === names[1]) ||
        (left === names[1] && right === names[0]),
    ) ?? null
  )
}

export function createAiChartD1StarPlacementId(
  palaceId: AiChartD1PalaceId,
  sourceCollection: 'majorStars' | 'minorStars' | 'adjectiveStars',
  sourceIndex: number,
): string {
  const collectionId =
    sourceCollection === 'majorStars'
      ? 'major'
      : sourceCollection === 'minorStars'
        ? 'minor'
        : 'adjective'
  return `${palaceId}:star:${collectionId}:${sourceIndex}`
}

export function createAiChartD1BorrowedMajorPlacementId(
  palaceId: AiChartD1PalaceId,
  canonicalIndex: number,
): string {
  return `${palaceId}:borrowed:major:${canonicalIndex}`
}

export function getAiChartD1NatalMutagenTableCompatibility(
  assignments: readonly AiChartD1NatalMutagenTableAssignment[],
): AiChartD1NatalMutagenTableCompatibility | null {
  const byType = new Map<AiChartD1MutagenType, string[]>(
    AI_CHART_D1_MUTAGEN_TYPES.map((type) => [type, []]),
  )
  for (const assignment of assignments) {
    byType.get(assignment.type)?.push(assignment.starName)
  }

  const everyAssignmentIsCandidate = assignments.every((assignment) => {
    const typeIndex = AI_CHART_D1_MUTAGEN_TYPES.indexOf(assignment.type)
    return MUTAGEN_TABLE.some((row) => row[typeIndex] === assignment.starName)
  })
  if (!everyAssignmentIsCandidate) return null

  const quartetComplete = AI_CHART_D1_MUTAGEN_TYPES.every(
    (type) => byType.get(type)?.length === 1,
  )
  if (quartetComplete) {
    return MUTAGEN_TABLE.some((row) =>
      AI_CHART_D1_MUTAGEN_TYPES.every(
        (type, index) => byType.get(type)?.[0] === row[index],
      ),
    )
      ? 'complete_table_validated'
      : null
  }

  const hasCompatibleRow = MUTAGEN_TABLE.some((row) =>
    AI_CHART_D1_MUTAGEN_TYPES.every((type, index) => {
      const candidates = byType.get(type) ?? []
      return candidates.length === 0 || candidates.includes(row[index])
    }),
  )
  return hasCompatibleRow ? 'partial_table_compatible' : null
}

export function createAiChartD1NatalMutagenId(
  placementId: string,
  type: AiChartD1MutagenType,
): string {
  return `${placementId}:mutagen:${MUTAGEN_ID_SUFFIX[type]}`
}

export function createAiChartD1SignalId(
  placementId: string,
  type: AiChartD1N0SignalType,
): string {
  return `${placementId}:signal:${SIGNAL_ID_SUFFIX[type]}`
}
