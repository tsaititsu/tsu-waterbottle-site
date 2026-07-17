import type {
  EarthlyBranch,
  HeavenlyStem,
} from '@/features/ziwei-chart/types/ziwei'
import {
  AI_CHART_D1_ID_PATTERN,
  AI_CHART_D1_MAX_LIST_ITEMS,
  AI_CHART_D1_MAX_SHORT_TEXT_LENGTH,
  AI_CHART_D1_PALACE_NAMES,
  assertAiChartD1SafeGraph,
  freezeAiChartD1Value,
  parseAiChartD1Boolean,
  parseAiChartD1Enum,
  parseAiChartD1Id,
  parseAiChartD1StringArray,
  parseAiChartD1Text,
  requireAiChartD1ExactObject,
  type AiChartD1PalaceName,
} from './d1CommonContracts'
import {
  AI_CHART_D1_BORROW_BLOCKING_STAR_NAMES,
  AI_CHART_D1_CANONICAL_PALACE_TO_ID,
  AI_CHART_D1_EARTHLY_BRANCHES,
  AI_CHART_D1_F1_BLOCKED_STATUS,
  AI_CHART_D1_FOUR_HORSE_BRANCHES,
  AI_CHART_D1_MAJOR_STAR_NAMES,
  AI_CHART_D1_MALEFIC_SIGNAL_STAR_NAMES,
  AI_CHART_D1_MODELED_SUPPORTING_STARS,
  AI_CHART_D1_MUTAGEN_TYPES,
  AI_CHART_D1_N0_CONTRACT_VERSION,
  AI_CHART_D1_N0_INVALID,
  AI_CHART_D1_PALACE_IDENTITIES,
  createAiChartD1NatalMutagenId,
  createAiChartD1SignalId,
  getAiChartD1CanonicalDoubleMajorStarPair,
  type AiChartD1MajorStarName,
  type AiChartD1ModeledSupportingStarName,
  type AiChartD1MutagenType,
  type AiChartD1N0SignalType,
  type AiChartD1PalaceId,
} from './d1N0Constants'
import {
  buildAiChartD1N0PalaceRelations,
  type AiChartD1N0PalaceRelations,
} from './d1N0Relations'

export const AI_CHART_D1_N0_WARNING_CODES = Object.freeze([
  'unmodeled_stars_present',
  'natal_mutagen_missing',
  'natal_mutagen_duplicate_type',
  'opposite_major_stars_empty',
] as const)

export type AiChartD1N0WarningCode =
  (typeof AI_CHART_D1_N0_WARNING_CODES)[number]
export type AiChartD1N0StructuralStatus = 'ready' | 'partial'
export type AiChartD1N0NatalMutagenStatus =
  | 'snapshot_origin_mutagen_trusted'
  | 'snapshot_origin_mutagen_partial'
export type AiChartD1N0BorrowStatus =
  | 'not_empty'
  | 'blocked_by_local_star'
  | 'eligible_and_borrowed'
  | 'opposite_empty'
export type AiChartD1N0SourceCollection =
  | 'majorStars'
  | 'minorStars'
  | 'adjectiveStars'
export type AiChartD1N0StarType =
  | 'major'
  | 'soft'
  | 'tough'
  | 'adjective'
  | 'flower'
  | 'helper'
  | 'lucun'
  | 'tianma'

export type AiChartD1N0StarPlacement = Readonly<{
  placementId: string
  name: string
  type: AiChartD1N0StarType
  sourceCollection: AiChartD1N0SourceCollection
  sourceIndex: number
  sourceOrder: number
  canonicalOrder: number | null
  natalMutagen: AiChartD1MutagenType | null
}>

export type AiChartD1N0ExcludedStar = Readonly<{
  placementId: string
  name: string
  type: AiChartD1N0StarType
  sourceCollection: 'minorStars' | 'adjectiveStars'
  sourceIndex: number
  natalMutagen: AiChartD1MutagenType | null
  reason: 'not_in_p1_allowlist'
}>

export type AiChartD1N0BorrowedMajorStar = Readonly<{
  borrowedPlacementId: string
  sourcePlacementId: string
  borrowedFromPalaceId: AiChartD1PalaceId
  name: AiChartD1MajorStarName
  canonicalOrder: number
  natalMutagen: AiChartD1MutagenType | null
}>

export type AiChartD1N0Palace = Readonly<{
  palaceId: AiChartD1PalaceId
  index: number
  canonicalName: AiChartD1PalaceName
  earthlyBranch: EarthlyBranch
  heavenlyStem: HeavenlyStem
  heavenlyStemAuthority: 'not_authoritative_flying_transform_source'
  isMingPalace: boolean
  isBodyPalace: boolean
  sourceMajorStars: readonly AiChartD1N0StarPlacement[]
  canonicalMajorStars: readonly AiChartD1N0StarPlacement[]
  modeledSupportingStars: readonly AiChartD1N0StarPlacement[]
  excludedStarSummary: readonly AiChartD1N0ExcludedStar[]
  isEmptyOfMajorStars: boolean
  canBorrowOppositeMajorStars: boolean
  borrowStatus: AiChartD1N0BorrowStatus
  borrowBlockerPlacementIds: readonly string[]
  borrowedMajorStars: readonly AiChartD1N0BorrowedMajorStar[]
  oppositePalaceId: AiChartD1PalaceId
  hiddenCombinationPalaceId: AiChartD1PalaceId
  trinePalaceIds: readonly AiChartD1PalaceId[]
  otherTrinePalaceIds: readonly AiChartD1PalaceId[]
  isFourHorsePalace: boolean
}>

export type AiChartD1N0NatalMutagen = Readonly<{
  mutagenId: string
  type: AiChartD1MutagenType
  starPlacementId: string
  palaceId: AiChartD1PalaceId
  starName: string
}>

export type AiChartD1N0Warning = Readonly<{
  warningId: string
  code: AiChartD1N0WarningCode
  palaceId: AiChartD1PalaceId | null
  placementIds: readonly string[]
}>

export type AiChartD1N0Signal = Readonly<{
  signalId: string
  signalType: AiChartD1N0SignalType
  starPlacementId: string
  palaceId: AiChartD1PalaceId
  starName: string
}>

export type AiChartD1N0PalaceScan = Readonly<{
  palaceId: AiChartD1PalaceId
  directSignals: readonly string[]
  oppositeSignals: readonly string[]
  hiddenCombinationSignals: readonly string[]
  trineSignals: readonly string[]
  directCount: number
  oppositeCount: number
  hiddenCombinationCount: number
  trineCount: number
  totalRelevantCount: number
  completeness: 'natal_structure_only_flying_unavailable'
}>

export type AiChartD1N0GlobalScan = Readonly<{
  completeness: 'natal_structure_only_flying_unavailable'
  signals: readonly AiChartD1N0Signal[]
  tuoLuoPlacementIds: readonly string[]
  natalJiMutagenIds: readonly string[]
  palaceScans: readonly AiChartD1N0PalaceScan[]
}>

export type AiChartD1N0Readiness = Readonly<{
  structuralStatus: AiChartD1N0StructuralStatus
  natalMutagenStatus: AiChartD1N0NatalMutagenStatus
  knowledgeStatus: 'k0_required'
  promptStatus: 'prompt_builder_required'
  openAiCallable: false
}>

export type AiChartD1N0 = Readonly<{
  contractVersion: typeof AI_CHART_D1_N0_CONTRACT_VERSION
  chartId: string
  sourceSnapshotVersion: 'ai-chart-chart-snapshot/v1'
  sourceEngine: 'waterbottle-ziwei-native'
  sourceEngineVersion: 'v1'
  palaces: readonly AiChartD1N0Palace[]
  mingPalaceId: AiChartD1PalaceId
  bodyPalaceId: AiChartD1PalaceId
  sameAsMingPalace: boolean
  natalMutagens: readonly AiChartD1N0NatalMutagen[]
  tuoLuoPlacementIds: readonly string[]
  relationships: readonly AiChartD1N0PalaceRelations[]
  globalScan: AiChartD1N0GlobalScan
  dataWarnings: readonly AiChartD1N0Warning[]
  readiness: AiChartD1N0Readiness
  f1Readiness: typeof AI_CHART_D1_F1_BLOCKED_STATUS
}>

export class AiChartD1N0Error extends Error {
  readonly code = AI_CHART_D1_N0_INVALID

  constructor() {
    super(AI_CHART_D1_N0_INVALID)
    this.name = 'AiChartD1N0Error'
  }
}

const STAR_TYPES = Object.freeze([
  'major',
  'soft',
  'tough',
  'adjective',
  'flower',
  'helper',
  'lucun',
  'tianma',
] as const)
const SOURCE_COLLECTIONS = Object.freeze([
  'majorStars',
  'minorStars',
  'adjectiveStars',
] as const)
const HEAVENLY_STEMS = Object.freeze([
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
] as const)
const BORROW_STATUSES = Object.freeze([
  'not_empty',
  'blocked_by_local_star',
  'eligible_and_borrowed',
  'opposite_empty',
] as const)
const SIGNAL_TYPES = Object.freeze([
  '擎羊',
  '陀羅',
  '火星',
  '鈴星',
  '生年化忌',
] as const)

const STAR_PLACEMENT_FIELDS = Object.freeze([
  'placementId',
  'name',
  'type',
  'sourceCollection',
  'sourceIndex',
  'sourceOrder',
  'canonicalOrder',
  'natalMutagen',
] as const)
const EXCLUDED_STAR_FIELDS = Object.freeze([
  'placementId',
  'name',
  'type',
  'sourceCollection',
  'sourceIndex',
  'natalMutagen',
  'reason',
] as const)
const BORROWED_STAR_FIELDS = Object.freeze([
  'borrowedPlacementId',
  'sourcePlacementId',
  'borrowedFromPalaceId',
  'name',
  'canonicalOrder',
  'natalMutagen',
] as const)
const PALACE_FIELDS = Object.freeze([
  'palaceId',
  'index',
  'canonicalName',
  'earthlyBranch',
  'heavenlyStem',
  'heavenlyStemAuthority',
  'isMingPalace',
  'isBodyPalace',
  'sourceMajorStars',
  'canonicalMajorStars',
  'modeledSupportingStars',
  'excludedStarSummary',
  'isEmptyOfMajorStars',
  'canBorrowOppositeMajorStars',
  'borrowStatus',
  'borrowBlockerPlacementIds',
  'borrowedMajorStars',
  'oppositePalaceId',
  'hiddenCombinationPalaceId',
  'trinePalaceIds',
  'otherTrinePalaceIds',
  'isFourHorsePalace',
] as const)
const MUTAGEN_FIELDS = Object.freeze([
  'mutagenId',
  'type',
  'starPlacementId',
  'palaceId',
  'starName',
] as const)
const WARNING_FIELDS = Object.freeze([
  'warningId',
  'code',
  'palaceId',
  'placementIds',
] as const)
const RELATION_FIELDS = Object.freeze([
  'palaceId',
  'oppositePalaceId',
  'hiddenCombinationPalaceId',
  'trinePalaceIds',
  'otherTrinePalaceIds',
] as const)
const SIGNAL_FIELDS = Object.freeze([
  'signalId',
  'signalType',
  'starPlacementId',
  'palaceId',
  'starName',
] as const)
const PALACE_SCAN_FIELDS = Object.freeze([
  'palaceId',
  'directSignals',
  'oppositeSignals',
  'hiddenCombinationSignals',
  'trineSignals',
  'directCount',
  'oppositeCount',
  'hiddenCombinationCount',
  'trineCount',
  'totalRelevantCount',
  'completeness',
] as const)
const GLOBAL_SCAN_FIELDS = Object.freeze([
  'completeness',
  'signals',
  'tuoLuoPlacementIds',
  'natalJiMutagenIds',
  'palaceScans',
] as const)
const READINESS_FIELDS = Object.freeze([
  'structuralStatus',
  'natalMutagenStatus',
  'knowledgeStatus',
  'promptStatus',
  'openAiCallable',
] as const)
const N0_FIELDS = Object.freeze([
  'contractVersion',
  'chartId',
  'sourceSnapshotVersion',
  'sourceEngine',
  'sourceEngineVersion',
  'palaces',
  'mingPalaceId',
  'bodyPalaceId',
  'sameAsMingPalace',
  'natalMutagens',
  'tuoLuoPlacementIds',
  'relationships',
  'globalScan',
  'dataWarnings',
  'readiness',
  'f1Readiness',
] as const)

function invalid(): never {
  throw new AiChartD1N0Error()
}

function parseInteger(value: unknown, minimum: number, maximum: number): number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < minimum ||
    value > maximum
  ) {
    invalid()
  }
  return value
}

function parseNullableInteger(
  value: unknown,
  minimum: number,
  maximum: number,
): number | null {
  return value === null ? null : parseInteger(value, minimum, maximum)
}

function parseArray<T>(
  value: unknown,
  maximumItems: number,
  parseItem: (item: unknown) => T,
): readonly T[] {
  if (!Array.isArray(value) || value.length > maximumItems) invalid()
  return Object.freeze(value.map(parseItem))
}

function parsePalaceId(value: unknown): AiChartD1PalaceId {
  const parsed = parseAiChartD1Id(value)
  if (!Object.values(AI_CHART_D1_CANONICAL_PALACE_TO_ID).includes(parsed as AiChartD1PalaceId)) {
    invalid()
  }
  return parsed as AiChartD1PalaceId
}

function parseNullableMutagen(value: unknown): AiChartD1MutagenType | null {
  return value === null
    ? null
    : parseAiChartD1Enum(value, AI_CHART_D1_MUTAGEN_TYPES)
}

function parseStarPlacement(value: unknown): AiChartD1N0StarPlacement {
  const record = requireAiChartD1ExactObject(value, STAR_PLACEMENT_FIELDS)
  return Object.freeze({
    placementId: parseAiChartD1Id(record.placementId),
    name: parseAiChartD1Text(record.name, AI_CHART_D1_MAX_SHORT_TEXT_LENGTH),
    type: parseAiChartD1Enum(record.type, STAR_TYPES),
    sourceCollection: parseAiChartD1Enum(
      record.sourceCollection,
      SOURCE_COLLECTIONS,
    ),
    sourceIndex: parseInteger(record.sourceIndex, 0, 127),
    sourceOrder: parseInteger(record.sourceOrder, 0, 127),
    canonicalOrder: parseNullableInteger(record.canonicalOrder, 0, 1),
    natalMutagen: parseNullableMutagen(record.natalMutagen),
  })
}

function parseExcludedStar(value: unknown): AiChartD1N0ExcludedStar {
  const record = requireAiChartD1ExactObject(value, EXCLUDED_STAR_FIELDS)
  const sourceCollection = parseAiChartD1Enum(record.sourceCollection, [
    'minorStars',
    'adjectiveStars',
  ] as const)
  if (record.reason !== 'not_in_p1_allowlist') invalid()
  return Object.freeze({
    placementId: parseAiChartD1Id(record.placementId),
    name: parseAiChartD1Text(record.name, AI_CHART_D1_MAX_SHORT_TEXT_LENGTH),
    type: parseAiChartD1Enum(record.type, STAR_TYPES),
    sourceCollection,
    sourceIndex: parseInteger(record.sourceIndex, 0, 127),
    natalMutagen: parseNullableMutagen(record.natalMutagen),
    reason: 'not_in_p1_allowlist',
  })
}

function parseBorrowedStar(value: unknown): AiChartD1N0BorrowedMajorStar {
  const record = requireAiChartD1ExactObject(value, BORROWED_STAR_FIELDS)
  return Object.freeze({
    borrowedPlacementId: parseAiChartD1Id(record.borrowedPlacementId),
    sourcePlacementId: parseAiChartD1Id(record.sourcePlacementId),
    borrowedFromPalaceId: parsePalaceId(record.borrowedFromPalaceId),
    name: parseAiChartD1Enum(record.name, AI_CHART_D1_MAJOR_STAR_NAMES),
    canonicalOrder: parseInteger(record.canonicalOrder, 0, 1),
    natalMutagen: parseNullableMutagen(record.natalMutagen),
  })
}

function parsePalace(value: unknown): AiChartD1N0Palace {
  const record = requireAiChartD1ExactObject(value, PALACE_FIELDS)
  if (record.heavenlyStemAuthority !== 'not_authoritative_flying_transform_source') {
    invalid()
  }
  return Object.freeze({
    palaceId: parsePalaceId(record.palaceId),
    index: parseInteger(record.index, 0, 11),
    canonicalName: parseAiChartD1Enum(
      record.canonicalName,
      AI_CHART_D1_PALACE_NAMES,
    ),
    earthlyBranch: parseAiChartD1Enum(
      record.earthlyBranch,
      AI_CHART_D1_EARTHLY_BRANCHES,
    ),
    heavenlyStem: parseAiChartD1Enum(record.heavenlyStem, HEAVENLY_STEMS),
    heavenlyStemAuthority: 'not_authoritative_flying_transform_source',
    isMingPalace: parseAiChartD1Boolean(record.isMingPalace),
    isBodyPalace: parseAiChartD1Boolean(record.isBodyPalace),
    sourceMajorStars: parseArray(record.sourceMajorStars, 2, parseStarPlacement),
    canonicalMajorStars: parseArray(
      record.canonicalMajorStars,
      2,
      parseStarPlacement,
    ),
    modeledSupportingStars: parseArray(
      record.modeledSupportingStars,
      32,
      parseStarPlacement,
    ),
    excludedStarSummary: parseArray(
      record.excludedStarSummary,
      AI_CHART_D1_MAX_LIST_ITEMS,
      parseExcludedStar,
    ),
    isEmptyOfMajorStars: parseAiChartD1Boolean(record.isEmptyOfMajorStars),
    canBorrowOppositeMajorStars: parseAiChartD1Boolean(
      record.canBorrowOppositeMajorStars,
    ),
    borrowStatus: parseAiChartD1Enum(record.borrowStatus, BORROW_STATUSES),
    borrowBlockerPlacementIds: parseAiChartD1StringArray(
      record.borrowBlockerPlacementIds,
      { parseItem: parseAiChartD1Id },
    ),
    borrowedMajorStars: parseArray(
      record.borrowedMajorStars,
      2,
      parseBorrowedStar,
    ),
    oppositePalaceId: parsePalaceId(record.oppositePalaceId),
    hiddenCombinationPalaceId: parsePalaceId(
      record.hiddenCombinationPalaceId,
    ),
    trinePalaceIds: parseAiChartD1StringArray(record.trinePalaceIds, {
      minimumItems: 3,
      maximumItems: 3,
      parseItem: parsePalaceId,
    }) as readonly AiChartD1PalaceId[],
    otherTrinePalaceIds: parseAiChartD1StringArray(
      record.otherTrinePalaceIds,
      {
        minimumItems: 2,
        maximumItems: 2,
        parseItem: parsePalaceId,
      },
    ) as readonly AiChartD1PalaceId[],
    isFourHorsePalace: parseAiChartD1Boolean(record.isFourHorsePalace),
  })
}

function parseMutagen(value: unknown): AiChartD1N0NatalMutagen {
  const record = requireAiChartD1ExactObject(value, MUTAGEN_FIELDS)
  return Object.freeze({
    mutagenId: parseAiChartD1Id(record.mutagenId),
    type: parseAiChartD1Enum(record.type, AI_CHART_D1_MUTAGEN_TYPES),
    starPlacementId: parseAiChartD1Id(record.starPlacementId),
    palaceId: parsePalaceId(record.palaceId),
    starName: parseAiChartD1Text(
      record.starName,
      AI_CHART_D1_MAX_SHORT_TEXT_LENGTH,
    ),
  })
}

function parseWarning(value: unknown): AiChartD1N0Warning {
  const record = requireAiChartD1ExactObject(value, WARNING_FIELDS)
  return Object.freeze({
    warningId: parseAiChartD1Id(record.warningId),
    code: parseAiChartD1Enum(record.code, AI_CHART_D1_N0_WARNING_CODES),
    palaceId:
      record.palaceId === null ? null : parsePalaceId(record.palaceId),
    placementIds: parseAiChartD1StringArray(record.placementIds, {
      parseItem: parseAiChartD1Id,
    }),
  })
}

function parseRelation(value: unknown): AiChartD1N0PalaceRelations {
  const record = requireAiChartD1ExactObject(value, RELATION_FIELDS)
  return Object.freeze({
    palaceId: parsePalaceId(record.palaceId),
    oppositePalaceId: parsePalaceId(record.oppositePalaceId),
    hiddenCombinationPalaceId: parsePalaceId(
      record.hiddenCombinationPalaceId,
    ),
    trinePalaceIds: parseAiChartD1StringArray(record.trinePalaceIds, {
      minimumItems: 3,
      maximumItems: 3,
      parseItem: parsePalaceId,
    }) as readonly AiChartD1PalaceId[],
    otherTrinePalaceIds: parseAiChartD1StringArray(
      record.otherTrinePalaceIds,
      {
        minimumItems: 2,
        maximumItems: 2,
        parseItem: parsePalaceId,
      },
    ) as readonly AiChartD1PalaceId[],
  })
}

function parseSignal(value: unknown): AiChartD1N0Signal {
  const record = requireAiChartD1ExactObject(value, SIGNAL_FIELDS)
  return Object.freeze({
    signalId: parseAiChartD1Id(record.signalId),
    signalType: parseAiChartD1Enum(record.signalType, SIGNAL_TYPES),
    starPlacementId: parseAiChartD1Id(record.starPlacementId),
    palaceId: parsePalaceId(record.palaceId),
    starName: parseAiChartD1Text(
      record.starName,
      AI_CHART_D1_MAX_SHORT_TEXT_LENGTH,
    ),
  })
}

function parsePalaceScan(value: unknown): AiChartD1N0PalaceScan {
  const record = requireAiChartD1ExactObject(value, PALACE_SCAN_FIELDS)
  if (record.completeness !== 'natal_structure_only_flying_unavailable') {
    invalid()
  }
  return Object.freeze({
    palaceId: parsePalaceId(record.palaceId),
    directSignals: parseAiChartD1StringArray(record.directSignals, {
      parseItem: parseAiChartD1Id,
    }),
    oppositeSignals: parseAiChartD1StringArray(record.oppositeSignals, {
      parseItem: parseAiChartD1Id,
    }),
    hiddenCombinationSignals: parseAiChartD1StringArray(
      record.hiddenCombinationSignals,
      { parseItem: parseAiChartD1Id },
    ),
    trineSignals: parseAiChartD1StringArray(record.trineSignals, {
      parseItem: parseAiChartD1Id,
    }),
    directCount: parseInteger(record.directCount, 0, 128),
    oppositeCount: parseInteger(record.oppositeCount, 0, 128),
    hiddenCombinationCount: parseInteger(
      record.hiddenCombinationCount,
      0,
      128,
    ),
    trineCount: parseInteger(record.trineCount, 0, 128),
    totalRelevantCount: parseInteger(record.totalRelevantCount, 0, 512),
    completeness: 'natal_structure_only_flying_unavailable',
  })
}

function parseGlobalScan(value: unknown): AiChartD1N0GlobalScan {
  const record = requireAiChartD1ExactObject(value, GLOBAL_SCAN_FIELDS)
  if (record.completeness !== 'natal_structure_only_flying_unavailable') {
    invalid()
  }
  return Object.freeze({
    completeness: 'natal_structure_only_flying_unavailable',
    signals: parseArray(record.signals, 128, parseSignal),
    tuoLuoPlacementIds: parseAiChartD1StringArray(
      record.tuoLuoPlacementIds,
      { parseItem: parseAiChartD1Id },
    ),
    natalJiMutagenIds: parseAiChartD1StringArray(record.natalJiMutagenIds, {
      parseItem: parseAiChartD1Id,
    }),
    palaceScans: parseArray(record.palaceScans, 12, parsePalaceScan),
  })
}

function parseReadiness(value: unknown): AiChartD1N0Readiness {
  const record = requireAiChartD1ExactObject(value, READINESS_FIELDS)
  if (
    record.knowledgeStatus !== 'k0_required' ||
    record.promptStatus !== 'prompt_builder_required' ||
    record.openAiCallable !== false
  ) {
    invalid()
  }
  return Object.freeze({
    structuralStatus: parseAiChartD1Enum(record.structuralStatus, [
      'ready',
      'partial',
    ] as const),
    natalMutagenStatus: parseAiChartD1Enum(record.natalMutagenStatus, [
      'snapshot_origin_mutagen_trusted',
      'snapshot_origin_mutagen_partial',
    ] as const),
    knowledgeStatus: 'k0_required',
    promptStatus: 'prompt_builder_required',
    openAiCallable: false,
  })
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function unique<T>(values: readonly T[]): boolean {
  return new Set(values).size === values.length
}

function sourcePlacements(palace: AiChartD1N0Palace) {
  return [
    ...palace.sourceMajorStars,
    ...palace.modeledSupportingStars,
    ...palace.excludedStarSummary,
  ]
}

function expectedWarnings(
  palaces: readonly AiChartD1N0Palace[],
  mutagens: readonly AiChartD1N0NatalMutagen[],
): readonly AiChartD1N0Warning[] {
  const warnings: AiChartD1N0Warning[] = []
  for (const palace of palaces) {
    if (palace.excludedStarSummary.length > 0) {
      warnings.push({
        warningId: `warning:unmodeled:${palace.palaceId}`,
        code: 'unmodeled_stars_present',
        palaceId: palace.palaceId,
        placementIds: palace.excludedStarSummary.map((star) => star.placementId),
      })
    }
    if (palace.borrowStatus === 'opposite_empty') {
      warnings.push({
        warningId: `warning:opposite-empty:${palace.palaceId}`,
        code: 'opposite_major_stars_empty',
        palaceId: palace.palaceId,
        placementIds: [],
      })
    }
  }

  const counts = new Map<AiChartD1MutagenType, number>(
    AI_CHART_D1_MUTAGEN_TYPES.map((type) => [type, 0]),
  )
  for (const mutagen of mutagens) {
    counts.set(mutagen.type, (counts.get(mutagen.type) ?? 0) + 1)
  }
  const missing = AI_CHART_D1_MUTAGEN_TYPES.filter(
    (type) => counts.get(type) === 0,
  )
  const duplicate = AI_CHART_D1_MUTAGEN_TYPES.filter(
    (type) => (counts.get(type) ?? 0) > 1,
  )
  if (missing.length > 0) {
    warnings.push({
      warningId: 'warning:natal-mutagen-missing',
      code: 'natal_mutagen_missing',
      palaceId: null,
      placementIds: [],
    })
  }
  if (duplicate.length > 0) {
    warnings.push({
      warningId: 'warning:natal-mutagen-duplicate',
      code: 'natal_mutagen_duplicate_type',
      palaceId: null,
      placementIds: mutagens
        .filter((mutagen) => duplicate.includes(mutagen.type))
        .map((mutagen) => mutagen.starPlacementId)
        .sort(),
    })
  }
  return warnings
}

function validatePalaceSemantics(
  palaces: readonly AiChartD1N0Palace[],
  relations: readonly AiChartD1N0PalaceRelations[],
): Map<string, AiChartD1N0StarPlacement | AiChartD1N0ExcludedStar> {
  if (palaces.length !== 12 || relations.length !== 12) invalid()
  if (
    !unique(palaces.map((palace) => palace.palaceId)) ||
    !unique(palaces.map((palace) => palace.index)) ||
    !unique(palaces.map((palace) => palace.canonicalName)) ||
    !unique(palaces.map((palace) => palace.earthlyBranch)) ||
    palaces.filter((palace) => palace.isMingPalace).length !== 1 ||
    palaces.filter((palace) => palace.isBodyPalace).length !== 1
  ) {
    invalid()
  }

  const expectedRelations = buildAiChartD1N0PalaceRelations(palaces)
  if (!sameJson(relations, expectedRelations)) invalid()
  const byId = new Map(palaces.map((palace) => [palace.palaceId, palace]))
  const placements = new Map<
    string,
    AiChartD1N0StarPlacement | AiChartD1N0ExcludedStar
  >()

  for (const palace of palaces) {
    const identity = AI_CHART_D1_PALACE_IDENTITIES[palace.index]
    const relation = relations.find((item) => item.palaceId === palace.palaceId)
    if (
      !identity ||
      palace.canonicalName !== identity.canonicalName ||
      palace.palaceId !== identity.palaceId ||
      palace.isMingPalace !== (palace.index === 0) ||
      !relation ||
      palace.oppositePalaceId !== relation.oppositePalaceId ||
      palace.hiddenCombinationPalaceId !==
        relation.hiddenCombinationPalaceId ||
      !sameJson(palace.trinePalaceIds, relation.trinePalaceIds) ||
      !sameJson(palace.otherTrinePalaceIds, relation.otherTrinePalaceIds) ||
      palace.isFourHorsePalace !==
        (
          AI_CHART_D1_FOUR_HORSE_BRANCHES as readonly EarthlyBranch[]
        ).includes(palace.earthlyBranch)
    ) {
      invalid()
    }

    if (
      palace.isEmptyOfMajorStars !== (palace.sourceMajorStars.length === 0) ||
      palace.sourceMajorStars.length !== palace.canonicalMajorStars.length
    ) {
      invalid()
    }

    const sourceNames = palace.sourceMajorStars.map((star) => star.name)
    if (
      !unique(sourceNames) ||
      palace.sourceMajorStars.some(
        (star, index) =>
          star.type !== 'major' ||
          star.sourceCollection !== 'majorStars' ||
          star.sourceIndex !== index ||
          star.sourceOrder !== index ||
          !AI_CHART_D1_MAJOR_STAR_NAMES.includes(star.name as AiChartD1MajorStarName),
      )
    ) {
      invalid()
    }

    const canonicalPair =
      sourceNames.length === 2
        ? getAiChartD1CanonicalDoubleMajorStarPair(
            sourceNames as AiChartD1MajorStarName[],
          )
        : null
    if (sourceNames.length === 2 && canonicalPair === null) invalid()
    const expectedCanonicalNames =
      canonicalPair ?? (sourceNames as AiChartD1MajorStarName[])
    if (
      palace.canonicalMajorStars.some((star, index) => {
        const source = palace.sourceMajorStars.find(
          (item) => item.placementId === star.placementId,
        )
        return (
          !source ||
          star.name !== expectedCanonicalNames[index] ||
          star.canonicalOrder !== index ||
          star.sourceOrder !== source.sourceOrder ||
          star.natalMutagen !== source.natalMutagen
        )
      })
    ) {
      invalid()
    }

    for (const star of palace.modeledSupportingStars) {
      const expectedType =
        AI_CHART_D1_MODELED_SUPPORTING_STARS[
          star.name as AiChartD1ModeledSupportingStarName
        ]
      if (
        expectedType === undefined ||
        star.type !== expectedType ||
        star.sourceCollection !== 'minorStars' ||
        star.sourceIndex !== star.sourceOrder ||
        star.canonicalOrder !== null
      ) {
        invalid()
      }
    }

    const allSource = sourcePlacements(palace)
    if (!unique(allSource.map((star) => star.placementId))) invalid()
    for (const star of allSource) {
      if (placements.has(star.placementId)) invalid()
      placements.set(star.placementId, star)
    }

    const blockers = palace.modeledSupportingStars
      .filter((star) =>
        AI_CHART_D1_BORROW_BLOCKING_STAR_NAMES.includes(
          star.name as (typeof AI_CHART_D1_BORROW_BLOCKING_STAR_NAMES)[number],
        ),
      )
      .map((star) => star.placementId)
    const opposite = byId.get(palace.oppositePalaceId)
    if (!opposite || !sameJson(blockers, palace.borrowBlockerPlacementIds)) {
      invalid()
    }

    let expectedStatus: AiChartD1N0BorrowStatus = 'not_empty'
    if (palace.isEmptyOfMajorStars && blockers.length > 0) {
      expectedStatus = 'blocked_by_local_star'
    } else if (
      palace.isEmptyOfMajorStars &&
      opposite.canonicalMajorStars.length === 0
    ) {
      expectedStatus = 'opposite_empty'
    } else if (palace.isEmptyOfMajorStars) {
      expectedStatus = 'eligible_and_borrowed'
    }
    const expectedCanBorrow = expectedStatus === 'eligible_and_borrowed'
    const expectedBorrowed = expectedCanBorrow
      ? opposite.canonicalMajorStars.map((star, index) => ({
          borrowedPlacementId: `${palace.palaceId}:borrowed:major:${index}`,
          sourcePlacementId: star.placementId,
          borrowedFromPalaceId: opposite.palaceId,
          name: star.name,
          canonicalOrder: index,
          natalMutagen: star.natalMutagen,
        }))
      : []
    if (
      palace.borrowStatus !== expectedStatus ||
      palace.canBorrowOppositeMajorStars !== expectedCanBorrow ||
      !sameJson(palace.borrowedMajorStars, expectedBorrowed)
    ) {
      invalid()
    }
  }
  return placements
}

function validateN0Semantics(value: AiChartD1N0): void {
  const placements = validatePalaceSemantics(value.palaces, value.relationships)
  const ming = value.palaces.find((palace) => palace.isMingPalace)
  const body = value.palaces.find((palace) => palace.isBodyPalace)
  if (
    !ming ||
    !body ||
    value.mingPalaceId !== ming.palaceId ||
    value.bodyPalaceId !== body.palaceId ||
    value.sameAsMingPalace !== (ming.palaceId === body.palaceId)
  ) {
    invalid()
  }

  const expectedMutagens = [...placements.entries()]
    .filter(([, placement]) => placement.natalMutagen !== null)
    .map(([placementId, placement]) => {
      const palace = value.palaces.find((item) =>
        sourcePlacements(item).some((star) => star.placementId === placementId),
      )
      if (!palace || placement.natalMutagen === null) invalid()
      return {
        mutagenId: createAiChartD1NatalMutagenId(
          placementId,
          placement.natalMutagen,
        ),
        type: placement.natalMutagen,
        starPlacementId: placementId,
        palaceId: palace.palaceId,
        starName: placement.name,
      }
    })
    .sort((left, right) => left.mutagenId.localeCompare(right.mutagenId))
  if (
    !unique(value.natalMutagens.map((item) => item.mutagenId)) ||
    !sameJson(value.natalMutagens, expectedMutagens)
  ) {
    invalid()
  }

  const expectedSignals = new Map<string, AiChartD1N0Signal>()
  for (const palace of value.palaces) {
    for (const star of palace.modeledSupportingStars) {
      if (
        AI_CHART_D1_MALEFIC_SIGNAL_STAR_NAMES.includes(
          star.name as (typeof AI_CHART_D1_MALEFIC_SIGNAL_STAR_NAMES)[number],
        )
      ) {
        const signalType = star.name as AiChartD1N0SignalType
        const signalId = createAiChartD1SignalId(star.placementId, signalType)
        expectedSignals.set(signalId, {
          signalId,
          signalType,
          starPlacementId: star.placementId,
          palaceId: palace.palaceId,
          starName: star.name,
        })
      }
    }
    for (const star of sourcePlacements(palace)) {
      if (star.natalMutagen === '化忌') {
        const signalId = createAiChartD1SignalId(
          star.placementId,
          '生年化忌',
        )
        expectedSignals.set(signalId, {
          signalId,
          signalType: '生年化忌',
          starPlacementId: star.placementId,
          palaceId: palace.palaceId,
          starName: star.name,
        })
      }
    }
  }
  const expectedSignalList = [...expectedSignals.values()].sort((left, right) =>
    left.signalId.localeCompare(right.signalId),
  )
  if (!sameJson(value.globalScan.signals, expectedSignalList)) invalid()

  const expectedTuoLuo = expectedSignalList
    .filter((signal) => signal.signalType === '陀羅')
    .map((signal) => signal.starPlacementId)
    .sort()
  const expectedNatalJi = expectedMutagens
    .filter((mutagen) => mutagen.type === '化忌')
    .map((mutagen) => mutagen.mutagenId)
    .sort()
  if (
    !sameJson(value.tuoLuoPlacementIds, expectedTuoLuo) ||
    !sameJson(value.globalScan.tuoLuoPlacementIds, expectedTuoLuo) ||
    !sameJson(value.globalScan.natalJiMutagenIds, expectedNatalJi)
  ) {
    invalid()
  }

  const relationMap = new Map(
    value.relationships.map((relation) => [relation.palaceId, relation]),
  )
  const signalsFor = (palaceIds: readonly string[]) =>
    expectedSignalList
      .filter((signal) => palaceIds.includes(signal.palaceId))
      .map((signal) => signal.signalId)
      .sort()
  const expectedScans = value.palaces.map((palace) => {
    const relation = relationMap.get(palace.palaceId)
    if (!relation) invalid()
    const directSignals = signalsFor([palace.palaceId])
    const oppositeSignals = signalsFor([relation.oppositePalaceId])
    const hiddenCombinationSignals = signalsFor([
      relation.hiddenCombinationPalaceId,
    ])
    const trineSignals = signalsFor(relation.otherTrinePalaceIds)
    const totalRelevantCount = new Set([
      ...directSignals,
      ...oppositeSignals,
      ...hiddenCombinationSignals,
      ...trineSignals,
    ]).size
    return {
      palaceId: palace.palaceId,
      directSignals,
      oppositeSignals,
      hiddenCombinationSignals,
      trineSignals,
      directCount: directSignals.length,
      oppositeCount: oppositeSignals.length,
      hiddenCombinationCount: hiddenCombinationSignals.length,
      trineCount: trineSignals.length,
      totalRelevantCount,
      completeness: 'natal_structure_only_flying_unavailable',
    }
  })
  if (!sameJson(value.globalScan.palaceScans, expectedScans)) invalid()

  const warnings = expectedWarnings(value.palaces, value.natalMutagens)
  if (
    !unique(value.dataWarnings.map((warning) => warning.warningId)) ||
    !sameJson(value.dataWarnings, warnings)
  ) {
    invalid()
  }
  const quartetComplete = AI_CHART_D1_MUTAGEN_TYPES.every(
    (type) => value.natalMutagens.filter((item) => item.type === type).length === 1,
  )
  const structuralPartial =
    !quartetComplete ||
    value.palaces.some((palace) => palace.borrowStatus === 'opposite_empty')
  if (
    value.readiness.natalMutagenStatus !==
      (quartetComplete
        ? 'snapshot_origin_mutagen_trusted'
        : 'snapshot_origin_mutagen_partial') ||
    value.readiness.structuralStatus !==
      (structuralPartial ? 'partial' : 'ready')
  ) {
    invalid()
  }
}

function parseN0(value: unknown): AiChartD1N0 {
  assertAiChartD1SafeGraph(value)
  const record = requireAiChartD1ExactObject(value, N0_FIELDS)
  if (
    record.contractVersion !== AI_CHART_D1_N0_CONTRACT_VERSION ||
    record.sourceSnapshotVersion !== 'ai-chart-chart-snapshot/v1' ||
    record.sourceEngine !== 'waterbottle-ziwei-native' ||
    record.sourceEngineVersion !== 'v1' ||
    record.f1Readiness !== AI_CHART_D1_F1_BLOCKED_STATUS
  ) {
    invalid()
  }
  const palaces = parseArray(record.palaces, 12, parsePalace)
  const parsed: AiChartD1N0 = Object.freeze({
    contractVersion: AI_CHART_D1_N0_CONTRACT_VERSION,
    chartId: parseAiChartD1Id(record.chartId),
    sourceSnapshotVersion: 'ai-chart-chart-snapshot/v1',
    sourceEngine: 'waterbottle-ziwei-native',
    sourceEngineVersion: 'v1',
    palaces,
    mingPalaceId: parsePalaceId(record.mingPalaceId),
    bodyPalaceId: parsePalaceId(record.bodyPalaceId),
    sameAsMingPalace: parseAiChartD1Boolean(record.sameAsMingPalace),
    natalMutagens: parseArray(record.natalMutagens, 32, parseMutagen),
    tuoLuoPlacementIds: parseAiChartD1StringArray(
      record.tuoLuoPlacementIds,
      { parseItem: parseAiChartD1Id },
    ),
    relationships: parseArray(record.relationships, 12, parseRelation),
    globalScan: parseGlobalScan(record.globalScan),
    dataWarnings: parseArray(
      record.dataWarnings,
      AI_CHART_D1_MAX_LIST_ITEMS,
      parseWarning,
    ),
    readiness: parseReadiness(record.readiness),
    f1Readiness: AI_CHART_D1_F1_BLOCKED_STATUS,
  })
  validateN0Semantics(parsed)
  return freezeAiChartD1Value(parsed)
}

export function parseAiChartD1N0(value: unknown): AiChartD1N0 {
  try {
    return parseN0(value)
  } catch {
    invalid()
  }
}

export function assertAiChartD1N0Id(value: unknown): string {
  if (typeof value !== 'string' || !AI_CHART_D1_ID_PATTERN.test(value)) {
    invalid()
  }
  return value
}
