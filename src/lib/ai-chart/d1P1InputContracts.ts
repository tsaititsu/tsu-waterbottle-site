import type { EarthlyBranch } from '@/features/ziwei-chart/types/ziwei'
import {
  AI_CHART_D1_ID_PATTERN,
  AI_CHART_D1_MAX_LIST_ITEMS,
  AI_CHART_D1_MAX_SHORT_TEXT_LENGTH,
  AI_CHART_D1_P1_F1_CONTRACT_VERSION,
  AI_CHART_D1_PALACE_NAMES,
  assertAiChartD1SafeGraph,
  createAiChartD1ArraySchema,
  createAiChartD1StrictObjectSchema,
  createAiChartD1StringSchema,
  freezeAiChartD1Value,
  parseAiChartD1Boolean,
  parseAiChartD1Enum,
  parseAiChartD1Id,
  parseAiChartD1StringArray,
  parseAiChartD1Text,
  requireAiChartD1ExactObject,
  type AiChartD1JsonSchema,
  type AiChartD1PalaceName,
} from './d1CommonContracts'
import {
  AI_CHART_D1_BORROW_BLOCKING_STAR_NAMES,
  AI_CHART_D1_EARTHLY_BRANCHES,
  AI_CHART_D1_FOUR_HORSE_BRANCHES,
  AI_CHART_D1_HIDDEN_COMBINATION_PAIRS,
  AI_CHART_D1_MAJOR_STAR_NAMES,
  AI_CHART_D1_MODELED_SUPPORTING_STARS,
  AI_CHART_D1_MUTAGEN_TYPES,
  AI_CHART_D1_PALACE_IDENTITIES,
  AI_CHART_D1_P1_STRUCTURAL_INPUT_CONTRACT_VERSION,
  AI_CHART_D1_P1_INPUT_INVALID,
  AI_CHART_D1_TRINE_GROUPS,
  createAiChartD1BorrowedMajorPlacementId,
  createAiChartD1SignalId,
  createAiChartD1StarPlacementId,
  getAiChartD1CanonicalDoubleMajorStarPair,
  type AiChartD1ModeledSupportingStarName,
  type AiChartD1MutagenType,
  type AiChartD1PalaceId,
} from './d1N0Constants'
import {
  AI_CHART_D1_N0_WARNING_CODES,
  parseAiChartD1N0,
  type AiChartD1N0,
  type AiChartD1N0BorrowStatus,
  type AiChartD1N0BorrowedMajorStar,
  type AiChartD1N0Palace,
  type AiChartD1N0PalaceScan,
  type AiChartD1N0Signal,
  type AiChartD1N0SourceCollection,
  type AiChartD1N0StarPlacement,
  type AiChartD1N0StarType,
  type AiChartD1N0StructuralStatus,
  type AiChartD1N0Warning,
} from './d1N0Parser'

export const AI_CHART_D1_P1_INPUT_SCHEMA_NAME =
  'ai_chart_d1_p1_structural_input_v1' as const

export type AiChartD1P1StructuralStar = Readonly<{
  placementId: string
  name: string
  type: AiChartD1N0StarType
  sourceCollection: AiChartD1N0SourceCollection
  sourceIndex: number
  canonicalOrder: number | null
  natalMutagen: AiChartD1MutagenType | null
}>

export type AiChartD1P1StructuralPalace = Readonly<{
  palaceId: AiChartD1PalaceId
  index: number
  canonicalName: AiChartD1PalaceName
  earthlyBranch: EarthlyBranch
  isMingPalace: boolean
  isBodyPalace: boolean
  canonicalMajorStars: readonly AiChartD1P1StructuralStar[]
  modeledSupportingStars: readonly AiChartD1P1StructuralStar[]
  isEmptyOfMajorStars: boolean
  borrowStatus: AiChartD1N0BorrowStatus
  borrowBlockerPlacementIds: readonly string[]
  borrowedMajorStars: readonly AiChartD1N0BorrowedMajorStar[]
  oppositePalaceId: AiChartD1PalaceId
  hiddenCombinationPalaceId: AiChartD1PalaceId
  otherTrinePalaceIds: readonly AiChartD1PalaceId[]
  isFourHorsePalace: boolean
}>

export type AiChartD1P1TargetGlobalScan = Readonly<{
  palaceId: AiChartD1PalaceId
  completeness: 'natal_structure_only_flying_unavailable'
  directSignals: readonly AiChartD1N0Signal[]
  oppositeSignals: readonly AiChartD1N0Signal[]
  hiddenCombinationSignals: readonly AiChartD1N0Signal[]
  trineSignals: readonly AiChartD1N0Signal[]
  directCount: number
  oppositeCount: number
  hiddenCombinationCount: number
  trineCount: number
  totalRelevantCount: number
}>

export type AiChartD1P1StructuralInput = Readonly<{
  contractVersion: typeof AI_CHART_D1_P1_STRUCTURAL_INPUT_CONTRACT_VERSION
  task: 'D1_P1_STRUCTURAL'
  callId: string
  runId: string
  chartId: string
  targetPalace: AiChartD1P1StructuralPalace
  oppositePalace: AiChartD1P1StructuralPalace
  hiddenCombinationPalace: AiChartD1P1StructuralPalace
  otherTrinePalaces: readonly AiChartD1P1StructuralPalace[]
  targetGlobalScan: AiChartD1P1TargetGlobalScan
  outputContractVersion: typeof AI_CHART_D1_P1_F1_CONTRACT_VERSION
  structuralStatus: AiChartD1N0StructuralStatus
  knowledgeStatus: 'k0_required'
  promptStatus: 'prompt_builder_required'
  knowledgeBundleId: null
  promptVersion: null
  openAiCallable: false
  warnings: readonly AiChartD1N0Warning[]
}>

export type AiChartD1P1StructuralBuildIdentity = Readonly<{
  runId: string
  callIds: readonly string[]
}>

export class AiChartD1P1InputError extends Error {
  readonly code = AI_CHART_D1_P1_INPUT_INVALID

  constructor() {
    super(AI_CHART_D1_P1_INPUT_INVALID)
    this.name = 'AiChartD1P1InputError'
  }
}

const P1_SUPPORTING_STAR_NAMES = Object.freeze(
  Object.keys(
    AI_CHART_D1_MODELED_SUPPORTING_STARS,
  ) as AiChartD1ModeledSupportingStarName[],
)
const P1_SUPPORTING_STAR_TYPES = Object.freeze([
  'soft',
  'tough',
  'lucun',
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

const STAR_FIELDS = Object.freeze([
  'placementId',
  'name',
  'type',
  'sourceCollection',
  'sourceIndex',
  'canonicalOrder',
  'natalMutagen',
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
  'isMingPalace',
  'isBodyPalace',
  'canonicalMajorStars',
  'modeledSupportingStars',
  'isEmptyOfMajorStars',
  'borrowStatus',
  'borrowBlockerPlacementIds',
  'borrowedMajorStars',
  'oppositePalaceId',
  'hiddenCombinationPalaceId',
  'otherTrinePalaceIds',
  'isFourHorsePalace',
] as const)
const SIGNAL_FIELDS = Object.freeze([
  'signalId',
  'signalType',
  'starPlacementId',
  'palaceId',
  'starName',
] as const)
const SCAN_FIELDS = Object.freeze([
  'palaceId',
  'completeness',
  'directSignals',
  'oppositeSignals',
  'hiddenCombinationSignals',
  'trineSignals',
  'directCount',
  'oppositeCount',
  'hiddenCombinationCount',
  'trineCount',
  'totalRelevantCount',
] as const)
const WARNING_FIELDS = Object.freeze([
  'warningId',
  'code',
  'palaceId',
  'placementIds',
] as const)
const INPUT_FIELDS = Object.freeze([
  'contractVersion',
  'task',
  'callId',
  'runId',
  'chartId',
  'targetPalace',
  'oppositePalace',
  'hiddenCombinationPalace',
  'otherTrinePalaces',
  'targetGlobalScan',
  'outputContractVersion',
  'structuralStatus',
  'knowledgeStatus',
  'promptStatus',
  'knowledgeBundleId',
  'promptVersion',
  'openAiCallable',
  'warnings',
] as const)

function invalid(): never {
  throw new AiChartD1P1InputError()
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

function parsePalaceId(value: unknown): AiChartD1PalaceId {
  const id = parseAiChartD1Id(value)
  if (!/^palace:(ming|parents|fortune|property|career|friends|travel|health|wealth|children|spouse|siblings)$/.test(id)) {
    invalid()
  }
  return id as AiChartD1PalaceId
}

function parseNullableMutagen(value: unknown): AiChartD1MutagenType | null {
  return value === null
    ? null
    : parseAiChartD1Enum(value, AI_CHART_D1_MUTAGEN_TYPES)
}

function parseStar(value: unknown): AiChartD1P1StructuralStar {
  const record = requireAiChartD1ExactObject(value, STAR_FIELDS)
  return Object.freeze({
    placementId: parseAiChartD1Id(record.placementId),
    name: parseAiChartD1Text(record.name, AI_CHART_D1_MAX_SHORT_TEXT_LENGTH),
    type: parseAiChartD1Enum(record.type, [
      'major',
      ...P1_SUPPORTING_STAR_TYPES,
    ] as const),
    sourceCollection: parseAiChartD1Enum(record.sourceCollection, [
      'majorStars',
      'minorStars',
    ] as const),
    sourceIndex: parseInteger(record.sourceIndex, 0, 127),
    canonicalOrder:
      record.canonicalOrder === null
        ? null
        : parseInteger(record.canonicalOrder, 0, 1),
    natalMutagen: parseNullableMutagen(record.natalMutagen),
  })
}

function parseMajorStar(value: unknown): AiChartD1P1StructuralStar {
  const star = parseStar(value)
  if (
    star.type !== 'major' ||
    star.sourceCollection !== 'majorStars' ||
    !AI_CHART_D1_MAJOR_STAR_NAMES.includes(
      star.name as (typeof AI_CHART_D1_MAJOR_STAR_NAMES)[number],
    )
  ) {
    invalid()
  }
  return star
}

function parseSupportingStar(value: unknown): AiChartD1P1StructuralStar {
  const star = parseStar(value)
  const expectedType =
    AI_CHART_D1_MODELED_SUPPORTING_STARS[
      star.name as AiChartD1ModeledSupportingStarName
    ]
  if (
    expectedType === undefined ||
    star.type !== expectedType ||
    star.sourceCollection !== 'minorStars' ||
    star.canonicalOrder !== null
  ) {
    invalid()
  }
  return star
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

function parseArray<T>(
  value: unknown,
  minimumItems: number,
  maximumItems: number,
  parseItem: (item: unknown) => T,
): readonly T[] {
  if (
    !Array.isArray(value) ||
    value.length < minimumItems ||
    value.length > maximumItems
  ) {
    invalid()
  }
  return Object.freeze(value.map(parseItem))
}

function parsePalace(value: unknown): AiChartD1P1StructuralPalace {
  const record = requireAiChartD1ExactObject(value, PALACE_FIELDS)
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
    isMingPalace: parseAiChartD1Boolean(record.isMingPalace),
    isBodyPalace: parseAiChartD1Boolean(record.isBodyPalace),
    canonicalMajorStars: parseArray(
      record.canonicalMajorStars,
      0,
      2,
      parseMajorStar,
    ),
    modeledSupportingStars: parseArray(
      record.modeledSupportingStars,
      0,
      32,
      parseSupportingStar,
    ),
    isEmptyOfMajorStars: parseAiChartD1Boolean(record.isEmptyOfMajorStars),
    borrowStatus: parseAiChartD1Enum(record.borrowStatus, BORROW_STATUSES),
    borrowBlockerPlacementIds: parseAiChartD1StringArray(
      record.borrowBlockerPlacementIds,
      { parseItem: parseAiChartD1Id },
    ),
    borrowedMajorStars: parseArray(
      record.borrowedMajorStars,
      0,
      2,
      parseBorrowedStar,
    ),
    oppositePalaceId: parsePalaceId(record.oppositePalaceId),
    hiddenCombinationPalaceId: parsePalaceId(
      record.hiddenCombinationPalaceId,
    ),
    otherTrinePalaceIds: parseAiChartD1StringArray(
      record.otherTrinePalaceIds,
      { minimumItems: 2, maximumItems: 2, parseItem: parsePalaceId },
    ) as readonly AiChartD1PalaceId[],
    isFourHorsePalace: parseAiChartD1Boolean(record.isFourHorsePalace),
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

function parseSignalArray(value: unknown): readonly AiChartD1N0Signal[] {
  const signals = parseArray(value, 0, AI_CHART_D1_MAX_LIST_ITEMS, parseSignal)
  if (new Set(signals.map((signal) => signal.signalId)).size !== signals.length) {
    invalid()
  }
  return signals
}

function parseTargetScan(value: unknown): AiChartD1P1TargetGlobalScan {
  const record = requireAiChartD1ExactObject(value, SCAN_FIELDS)
  if (record.completeness !== 'natal_structure_only_flying_unavailable') {
    invalid()
  }
  const directSignals = parseSignalArray(record.directSignals)
  const oppositeSignals = parseSignalArray(record.oppositeSignals)
  const hiddenCombinationSignals = parseSignalArray(
    record.hiddenCombinationSignals,
  )
  const trineSignals = parseSignalArray(record.trineSignals)
  const directCount = parseInteger(record.directCount, 0, 128)
  const oppositeCount = parseInteger(record.oppositeCount, 0, 128)
  const hiddenCombinationCount = parseInteger(
    record.hiddenCombinationCount,
    0,
    128,
  )
  const trineCount = parseInteger(record.trineCount, 0, 128)
  const totalRelevantCount = parseInteger(record.totalRelevantCount, 0, 512)
  if (
    directCount !== directSignals.length ||
    oppositeCount !== oppositeSignals.length ||
    hiddenCombinationCount !== hiddenCombinationSignals.length ||
    trineCount !== trineSignals.length ||
    totalRelevantCount !==
      directCount + oppositeCount + hiddenCombinationCount + trineCount
  ) {
    invalid()
  }
  return Object.freeze({
    palaceId: parsePalaceId(record.palaceId),
    completeness: 'natal_structure_only_flying_unavailable',
    directSignals,
    oppositeSignals,
    hiddenCombinationSignals,
    trineSignals,
    directCount,
    oppositeCount,
    hiddenCombinationCount,
    trineCount,
    totalRelevantCount,
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

function sameIds(left: readonly string[], right: readonly string[]): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function validatePalaceSemantics(palace: AiChartD1P1StructuralPalace): void {
  const identity = AI_CHART_D1_PALACE_IDENTITIES[palace.index]
  const oppositeIdentity = AI_CHART_D1_PALACE_IDENTITIES[(palace.index + 6) % 12]
  if (
    !identity ||
    !oppositeIdentity ||
    palace.palaceId !== identity.palaceId ||
    palace.canonicalName !== identity.canonicalName ||
    palace.isMingPalace !== (palace.index === 0) ||
    palace.oppositePalaceId !== oppositeIdentity.palaceId ||
    palace.isFourHorsePalace !==
      (
        AI_CHART_D1_FOUR_HORSE_BRANCHES as readonly EarthlyBranch[]
      ).includes(palace.earthlyBranch) ||
    palace.otherTrinePalaceIds.includes(palace.palaceId) ||
    palace.otherTrinePalaceIds.includes(palace.oppositePalaceId)
  ) {
    invalid()
  }

  const majorNames = palace.canonicalMajorStars.map((star) => star.name)
  const canonicalPair =
    majorNames.length === 2
      ? getAiChartD1CanonicalDoubleMajorStarPair(
          majorNames as (typeof AI_CHART_D1_MAJOR_STAR_NAMES)[number][],
        )
      : null
  if (
    new Set(majorNames).size !== majorNames.length ||
    (majorNames.length === 2 &&
      (!canonicalPair || !sameIds(majorNames, canonicalPair))) ||
    palace.canonicalMajorStars.some(
      (star, index) =>
        star.type !== 'major' ||
        star.sourceCollection !== 'majorStars' ||
        star.placementId !==
          createAiChartD1StarPlacementId(
            palace.palaceId,
            'majorStars',
            star.sourceIndex,
          ) ||
        star.canonicalOrder !== index ||
        !AI_CHART_D1_MAJOR_STAR_NAMES.includes(
          star.name as (typeof AI_CHART_D1_MAJOR_STAR_NAMES)[number],
        ),
    )
  ) {
    invalid()
  }

  if (
    palace.modeledSupportingStars.some((star) => {
      const expectedType =
        AI_CHART_D1_MODELED_SUPPORTING_STARS[
          star.name as keyof typeof AI_CHART_D1_MODELED_SUPPORTING_STARS
        ]
      return (
        expectedType === undefined ||
        star.type !== expectedType ||
        star.sourceCollection !== 'minorStars' ||
        star.placementId !==
          createAiChartD1StarPlacementId(
            palace.palaceId,
            'minorStars',
            star.sourceIndex,
          ) ||
        star.canonicalOrder !== null
      )
    })
  ) {
    invalid()
  }

  const allPlacements = [
    ...palace.canonicalMajorStars,
    ...palace.modeledSupportingStars,
  ]
  if (
    new Set(allPlacements.map((star) => star.placementId)).size !==
    allPlacements.length
  ) {
    invalid()
  }
  const blockers = palace.modeledSupportingStars
    .filter((star) =>
      AI_CHART_D1_BORROW_BLOCKING_STAR_NAMES.includes(
        star.name as (typeof AI_CHART_D1_BORROW_BLOCKING_STAR_NAMES)[number],
      ),
    )
    .map((star) => star.placementId)
  if (
    !sameIds(blockers, palace.borrowBlockerPlacementIds) ||
    palace.isEmptyOfMajorStars !== (palace.canonicalMajorStars.length === 0)
  ) {
    invalid()
  }

  if (!palace.isEmptyOfMajorStars) {
    if (
      palace.borrowStatus !== 'not_empty' ||
      palace.borrowedMajorStars.length !== 0
    ) {
      invalid()
    }
  } else if (blockers.length > 0) {
    if (
      palace.borrowStatus !== 'blocked_by_local_star' ||
      palace.borrowedMajorStars.length !== 0
    ) {
      invalid()
    }
  } else if (palace.borrowStatus === 'eligible_and_borrowed') {
    if (
      palace.borrowedMajorStars.length === 0 ||
      palace.borrowedMajorStars.some(
        (star, index) =>
          star.borrowedPlacementId !==
            createAiChartD1BorrowedMajorPlacementId(
              palace.palaceId,
              index,
            ) ||
          ![0, 1].some(
            (sourceIndex) =>
              star.sourcePlacementId ===
              createAiChartD1StarPlacementId(
                star.borrowedFromPalaceId,
                'majorStars',
                sourceIndex,
              ),
          ) ||
          star.borrowedFromPalaceId !== palace.oppositePalaceId ||
          star.canonicalOrder !== index,
      )
    ) {
      invalid()
    }
  } else if (
    palace.borrowStatus !== 'opposite_empty' ||
    palace.borrowedMajorStars.length !== 0
  ) {
    invalid()
  }
}

function validateTargetRelations(
  target: AiChartD1P1StructuralPalace,
  opposite: AiChartD1P1StructuralPalace,
  hidden: AiChartD1P1StructuralPalace,
  trines: readonly AiChartD1P1StructuralPalace[],
): void {
  const branchIndex = AI_CHART_D1_EARTHLY_BRANCHES.indexOf(
    target.earthlyBranch,
  )
  const hiddenPair = AI_CHART_D1_HIDDEN_COMBINATION_PAIRS.find((pair) =>
    (pair as readonly EarthlyBranch[]).includes(target.earthlyBranch),
  )
  const expectedHiddenBranch = hiddenPair?.find(
    (branch) => branch !== target.earthlyBranch,
  )
  const trineGroup = AI_CHART_D1_TRINE_GROUPS.find((group) =>
    (group as readonly EarthlyBranch[]).includes(target.earthlyBranch),
  )
  const expectedTrineBranches = trineGroup?.filter(
    (branch) => branch !== target.earthlyBranch,
  )
  if (
    branchIndex < 0 ||
    opposite.earthlyBranch !==
      AI_CHART_D1_EARTHLY_BRANCHES[(branchIndex + 6) % 12] ||
    hidden.earthlyBranch !== expectedHiddenBranch ||
    !expectedTrineBranches ||
    trines.some(
      (palace) => !expectedTrineBranches.includes(palace.earthlyBranch),
    ) ||
    trines[0].index >= trines[1].index
  ) {
    invalid()
  }

  let expectedBorrowStatus: AiChartD1N0BorrowStatus = 'not_empty'
  if (target.isEmptyOfMajorStars && target.borrowBlockerPlacementIds.length > 0) {
    expectedBorrowStatus = 'blocked_by_local_star'
  } else if (
    target.isEmptyOfMajorStars &&
    opposite.canonicalMajorStars.length === 0
  ) {
    expectedBorrowStatus = 'opposite_empty'
  } else if (target.isEmptyOfMajorStars) {
    expectedBorrowStatus = 'eligible_and_borrowed'
  }
  const expectedBorrowed =
    expectedBorrowStatus === 'eligible_and_borrowed'
      ? opposite.canonicalMajorStars.map((star, index) => ({
          borrowedPlacementId: createAiChartD1BorrowedMajorPlacementId(
            target.palaceId,
            index,
          ),
          sourcePlacementId: star.placementId,
          borrowedFromPalaceId: opposite.palaceId,
          name: star.name,
          canonicalOrder: index,
          natalMutagen: star.natalMutagen,
        }))
      : []
  if (
    target.borrowStatus !== expectedBorrowStatus ||
    JSON.stringify(target.borrowedMajorStars) !== JSON.stringify(expectedBorrowed)
  ) {
    invalid()
  }
}

function parseInput(value: unknown): AiChartD1P1StructuralInput {
  assertAiChartD1SafeGraph(value)
  const record = requireAiChartD1ExactObject(value, INPUT_FIELDS)
  if (
    record.contractVersion !==
      AI_CHART_D1_P1_STRUCTURAL_INPUT_CONTRACT_VERSION ||
    record.task !== 'D1_P1_STRUCTURAL' ||
    record.outputContractVersion !== AI_CHART_D1_P1_F1_CONTRACT_VERSION ||
    record.knowledgeStatus !== 'k0_required' ||
    record.promptStatus !== 'prompt_builder_required' ||
    record.knowledgeBundleId !== null ||
    record.promptVersion !== null ||
    record.openAiCallable !== false
  ) {
    invalid()
  }

  const targetPalace = parsePalace(record.targetPalace)
  const oppositePalace = parsePalace(record.oppositePalace)
  const hiddenCombinationPalace = parsePalace(
    record.hiddenCombinationPalace,
  )
  const otherTrinePalaces = parseArray(
    record.otherTrinePalaces,
    2,
    2,
    parsePalace,
  )
  const targetGlobalScan = parseTargetScan(record.targetGlobalScan)
  const warnings = parseArray(
    record.warnings,
    0,
    AI_CHART_D1_MAX_LIST_ITEMS,
    parseWarning,
  )

  for (const palace of [
    targetPalace,
    oppositePalace,
    hiddenCombinationPalace,
    ...otherTrinePalaces,
  ]) {
    validatePalaceSemantics(palace)
  }
  validateTargetRelations(
    targetPalace,
    oppositePalace,
    hiddenCombinationPalace,
    otherTrinePalaces,
  )
  const allScanSignals = [
    ...targetGlobalScan.directSignals,
    ...targetGlobalScan.oppositeSignals,
    ...targetGlobalScan.hiddenCombinationSignals,
    ...targetGlobalScan.trineSignals,
  ]
  const relevantPalaceIds = new Set([
    targetPalace.palaceId,
    oppositePalace.palaceId,
    hiddenCombinationPalace.palaceId,
    ...otherTrinePalaces.map((palace) => palace.palaceId),
  ])
  const relevantPalaces = [
    targetPalace,
    oppositePalace,
    hiddenCombinationPalace,
    ...otherTrinePalaces,
  ]
  const placementOwners = new Map<
    string,
    Readonly<{
      palaceId: AiChartD1PalaceId
      star: AiChartD1P1StructuralStar
    }>
  >()
  for (const palace of relevantPalaces) {
    for (const star of [
      ...palace.canonicalMajorStars,
      ...palace.modeledSupportingStars,
    ]) {
      if (placementOwners.has(star.placementId)) invalid()
      placementOwners.set(star.placementId, {
        palaceId: palace.palaceId,
        star,
      })
    }
  }
  const signalsAreDeterministic = allScanSignals.every((signal) => {
    const source = placementOwners.get(signal.starPlacementId)
    return (
      source !== undefined &&
      source.palaceId === signal.palaceId &&
      source.star.name === signal.starName &&
      signal.signalId ===
        createAiChartD1SignalId(signal.starPlacementId, signal.signalType) &&
      (signal.signalType === '生年化忌'
        ? source.star.natalMutagen === '化忌'
        : source.star.name === signal.signalType)
    )
  })
  const structuralStatus = parseAiChartD1Enum(record.structuralStatus, [
    'ready',
    'partial',
  ] as const)
  const shouldBePartial = warnings.some((warning) =>
    [
      'natal_mutagen_missing',
      'natal_mutagen_duplicate_type',
      'opposite_major_stars_empty',
    ].includes(warning.code),
  )

  if (
    oppositePalace.palaceId !== targetPalace.oppositePalaceId ||
    hiddenCombinationPalace.palaceId !==
      targetPalace.hiddenCombinationPalaceId ||
    !sameIds(
      otherTrinePalaces.map((palace) => palace.palaceId),
      targetPalace.otherTrinePalaceIds,
    ) ||
    targetGlobalScan.palaceId !== targetPalace.palaceId ||
    new Set([
      targetPalace.palaceId,
      oppositePalace.palaceId,
      hiddenCombinationPalace.palaceId,
      ...otherTrinePalaces.map((palace) => palace.palaceId),
    ]).size !== 5 ||
    new Set(warnings.map((warning) => warning.warningId)).size !==
      warnings.length ||
    warnings.some(
      (warning) =>
        warning.palaceId !== null &&
        !relevantPalaceIds.has(warning.palaceId),
    ) ||
    targetGlobalScan.directSignals.some(
      (signal) => signal.palaceId !== targetPalace.palaceId,
    ) ||
    targetGlobalScan.oppositeSignals.some(
      (signal) => signal.palaceId !== oppositePalace.palaceId,
    ) ||
    targetGlobalScan.hiddenCombinationSignals.some(
      (signal) => signal.palaceId !== hiddenCombinationPalace.palaceId,
    ) ||
    targetGlobalScan.trineSignals.some(
      (signal) =>
        !otherTrinePalaces.some(
          (palace) => palace.palaceId === signal.palaceId,
        ),
    ) ||
    new Set(allScanSignals.map((signal) => signal.signalId)).size !==
      allScanSignals.length ||
    !signalsAreDeterministic ||
    structuralStatus !== (shouldBePartial ? 'partial' : 'ready')
  ) {
    invalid()
  }

  return Object.freeze({
    contractVersion: AI_CHART_D1_P1_STRUCTURAL_INPUT_CONTRACT_VERSION,
    task: 'D1_P1_STRUCTURAL',
    callId: parseAiChartD1Id(record.callId),
    runId: parseAiChartD1Id(record.runId),
    chartId: parseAiChartD1Id(record.chartId),
    targetPalace,
    oppositePalace,
    hiddenCombinationPalace,
    otherTrinePalaces,
    targetGlobalScan,
    outputContractVersion: AI_CHART_D1_P1_F1_CONTRACT_VERSION,
    structuralStatus,
    knowledgeStatus: 'k0_required',
    promptStatus: 'prompt_builder_required',
    knowledgeBundleId: null,
    promptVersion: null,
    openAiCallable: false,
    warnings,
  })
}

export function parseAiChartD1P1StructuralInput(
  value: unknown,
): AiChartD1P1StructuralInput {
  try {
    return freezeAiChartD1Value(parseInput(value))
  } catch {
    invalid()
  }
}

function toStar(star: AiChartD1N0StarPlacement): AiChartD1P1StructuralStar {
  return Object.freeze({
    placementId: star.placementId,
    name: star.name,
    type: star.type,
    sourceCollection: star.sourceCollection,
    sourceIndex: star.sourceIndex,
    canonicalOrder: star.canonicalOrder,
    natalMutagen: star.natalMutagen,
  })
}

function toBorrowedStar(
  star: AiChartD1N0BorrowedMajorStar,
): AiChartD1N0BorrowedMajorStar {
  return Object.freeze({ ...star })
}

function toPalace(palace: AiChartD1N0Palace): AiChartD1P1StructuralPalace {
  return Object.freeze({
    palaceId: palace.palaceId,
    index: palace.index,
    canonicalName: palace.canonicalName,
    earthlyBranch: palace.earthlyBranch,
    isMingPalace: palace.isMingPalace,
    isBodyPalace: palace.isBodyPalace,
    canonicalMajorStars: Object.freeze(palace.canonicalMajorStars.map(toStar)),
    modeledSupportingStars: Object.freeze(
      palace.modeledSupportingStars.map(toStar),
    ),
    isEmptyOfMajorStars: palace.isEmptyOfMajorStars,
    borrowStatus: palace.borrowStatus,
    borrowBlockerPlacementIds: Object.freeze([
      ...palace.borrowBlockerPlacementIds,
    ]),
    borrowedMajorStars: Object.freeze(
      palace.borrowedMajorStars.map(toBorrowedStar),
    ),
    oppositePalaceId: palace.oppositePalaceId,
    hiddenCombinationPalaceId: palace.hiddenCombinationPalaceId,
    otherTrinePalaceIds: Object.freeze([...palace.otherTrinePalaceIds]),
    isFourHorsePalace: palace.isFourHorsePalace,
  })
}

function toSignal(signal: AiChartD1N0Signal): AiChartD1N0Signal {
  return Object.freeze({ ...signal })
}

function signalMap(n0: AiChartD1N0): ReadonlyMap<string, AiChartD1N0Signal> {
  return new Map(
    n0.globalScan.signals.map((signal) => [signal.signalId, signal]),
  )
}

function resolveSignals(
  ids: readonly string[],
  signals: ReadonlyMap<string, AiChartD1N0Signal>,
): readonly AiChartD1N0Signal[] {
  return Object.freeze(
    ids.map((id) => {
      const signal = signals.get(id)
      if (!signal) invalid()
      return toSignal(signal)
    }),
  )
}

function toTargetScan(
  scan: AiChartD1N0PalaceScan,
  signals: ReadonlyMap<string, AiChartD1N0Signal>,
): AiChartD1P1TargetGlobalScan {
  return Object.freeze({
    palaceId: scan.palaceId,
    completeness: scan.completeness,
    directSignals: resolveSignals(scan.directSignals, signals),
    oppositeSignals: resolveSignals(scan.oppositeSignals, signals),
    hiddenCombinationSignals: resolveSignals(
      scan.hiddenCombinationSignals,
      signals,
    ),
    trineSignals: resolveSignals(scan.trineSignals, signals),
    directCount: scan.directCount,
    oppositeCount: scan.oppositeCount,
    hiddenCombinationCount: scan.hiddenCombinationCount,
    trineCount: scan.trineCount,
    totalRelevantCount: scan.totalRelevantCount,
  })
}

function toWarning(warning: AiChartD1N0Warning): AiChartD1N0Warning {
  return Object.freeze({
    ...warning,
    placementIds: Object.freeze([...warning.placementIds]),
  })
}

function parseIdentity(value: unknown): AiChartD1P1StructuralBuildIdentity {
  assertAiChartD1SafeGraph(value)
  const record = requireAiChartD1ExactObject(value, ['runId', 'callIds'])
  const callIds = parseAiChartD1StringArray(record.callIds, {
    minimumItems: 12,
    maximumItems: 12,
    parseItem: parseAiChartD1Id,
  })
  return Object.freeze({
    runId: parseAiChartD1Id(record.runId),
    callIds,
  })
}

export function buildAiChartD1P1StructuralInputs(
  n0Value: unknown,
  identityValue: unknown,
): readonly AiChartD1P1StructuralInput[] {
  try {
    const n0 = parseAiChartD1N0(n0Value)
    const identity = parseIdentity(identityValue)
    const byId = new Map(n0.palaces.map((palace) => [palace.palaceId, palace]))
    const scans = new Map(
      n0.globalScan.palaceScans.map((scan) => [scan.palaceId, scan]),
    )
    const signals = signalMap(n0)

    const inputs = n0.palaces.map((target, index) => {
      const opposite = byId.get(target.oppositePalaceId)
      const hidden = byId.get(target.hiddenCombinationPalaceId)
      const trines = target.otherTrinePalaceIds.map((id) => byId.get(id))
      const scan = scans.get(target.palaceId)
      if (!opposite || !hidden || !scan || trines.some((palace) => !palace)) {
        invalid()
      }
      const relevantPalaceIds = new Set([
        target.palaceId,
        target.oppositePalaceId,
        target.hiddenCombinationPalaceId,
        ...target.otherTrinePalaceIds,
      ])
      const relevantWarnings = n0.dataWarnings
        .filter(
          (warning) =>
            warning.palaceId === null ||
            relevantPalaceIds.has(warning.palaceId),
        )
        .map(toWarning)
      const structuralStatus = relevantWarnings.some((warning) =>
        [
          'natal_mutagen_missing',
          'natal_mutagen_duplicate_type',
          'opposite_major_stars_empty',
        ].includes(warning.code),
      )
        ? 'partial'
        : 'ready'

      return parseAiChartD1P1StructuralInput({
        contractVersion: AI_CHART_D1_P1_STRUCTURAL_INPUT_CONTRACT_VERSION,
        task: 'D1_P1_STRUCTURAL',
        callId: identity.callIds[index],
        runId: identity.runId,
        chartId: n0.chartId,
        targetPalace: toPalace(target),
        oppositePalace: toPalace(opposite),
        hiddenCombinationPalace: toPalace(hidden),
        otherTrinePalaces: trines.map((palace) => toPalace(palace!)),
        targetGlobalScan: toTargetScan(scan, signals),
        outputContractVersion: AI_CHART_D1_P1_F1_CONTRACT_VERSION,
        structuralStatus,
        knowledgeStatus: 'k0_required',
        promptStatus: 'prompt_builder_required',
        knowledgeBundleId: null,
        promptVersion: null,
        openAiCallable: false,
        warnings: relevantWarnings,
      })
    })

    if (
      inputs.length !== 12 ||
      new Set(inputs.map((input) => input.callId)).size !== 12 ||
      new Set(inputs.map((input) => input.targetPalace.palaceId)).size !== 12 ||
      inputs.some(
        (input, index) =>
          input.targetPalace.index !== index ||
          input.callId !== identity.callIds[index],
      )
    ) {
      invalid()
    }
    return Object.freeze(inputs)
  } catch {
    invalid()
  }
}

const ID_SCHEMA = createAiChartD1StringSchema({
  maximumLength: 128,
  pattern: AI_CHART_D1_ID_PATTERN.source,
})
const PALACE_ID_SCHEMA = createAiChartD1StringSchema({
  maximumLength: 128,
  pattern:
    '^palace:(ming|parents|fortune|property|career|friends|travel|health|wealth|children|spouse|siblings)$',
})
const NULLABLE_MUTAGEN_SCHEMA = freezeAiChartD1Value({
  type: ['string', 'null'],
  enum: [...AI_CHART_D1_MUTAGEN_TYPES, null],
})
const NULL_SCHEMA = freezeAiChartD1Value({ type: 'null' })
const SOURCE_INDEX_SCHEMA = freezeAiChartD1Value({
  type: 'integer',
  minimum: 0,
  maximum: 127,
})
const MAJOR_STAR_SCHEMA = createAiChartD1StrictObjectSchema({
  placementId: ID_SCHEMA,
  name: createAiChartD1StringSchema({
    enumValues: AI_CHART_D1_MAJOR_STAR_NAMES,
  }),
  type: createAiChartD1StringSchema({ enumValues: ['major'] }),
  sourceCollection: createAiChartD1StringSchema({
    enumValues: ['majorStars'],
  }),
  sourceIndex: SOURCE_INDEX_SCHEMA,
  canonicalOrder: freezeAiChartD1Value({
    type: ['integer', 'null'],
    minimum: 0,
    maximum: 1,
  }),
  natalMutagen: NULLABLE_MUTAGEN_SCHEMA,
})
const SUPPORTING_STAR_SCHEMA = createAiChartD1StrictObjectSchema({
  placementId: ID_SCHEMA,
  name: createAiChartD1StringSchema({
    enumValues: P1_SUPPORTING_STAR_NAMES,
  }),
  type: createAiChartD1StringSchema({
    enumValues: P1_SUPPORTING_STAR_TYPES,
  }),
  sourceCollection: createAiChartD1StringSchema({
    enumValues: ['minorStars'],
  }),
  sourceIndex: SOURCE_INDEX_SCHEMA,
  canonicalOrder: NULL_SCHEMA,
  natalMutagen: NULLABLE_MUTAGEN_SCHEMA,
})
const BORROWED_STAR_SCHEMA = createAiChartD1StrictObjectSchema({
  borrowedPlacementId: ID_SCHEMA,
  sourcePlacementId: ID_SCHEMA,
  borrowedFromPalaceId: PALACE_ID_SCHEMA,
  name: createAiChartD1StringSchema({ enumValues: AI_CHART_D1_MAJOR_STAR_NAMES }),
  canonicalOrder: freezeAiChartD1Value({
    type: 'integer',
    minimum: 0,
    maximum: 1,
  }),
  natalMutagen: NULLABLE_MUTAGEN_SCHEMA,
})
const PALACE_SCHEMA = createAiChartD1StrictObjectSchema({
  palaceId: PALACE_ID_SCHEMA,
  index: freezeAiChartD1Value({ type: 'integer', minimum: 0, maximum: 11 }),
  canonicalName: createAiChartD1StringSchema({
    enumValues: AI_CHART_D1_PALACE_NAMES,
  }),
  earthlyBranch: createAiChartD1StringSchema({
    enumValues: AI_CHART_D1_EARTHLY_BRANCHES,
  }),
  isMingPalace: freezeAiChartD1Value({ type: 'boolean' }),
  isBodyPalace: freezeAiChartD1Value({ type: 'boolean' }),
  canonicalMajorStars: createAiChartD1ArraySchema(MAJOR_STAR_SCHEMA, {
    maximumItems: 2,
  }),
  modeledSupportingStars: createAiChartD1ArraySchema(
    SUPPORTING_STAR_SCHEMA,
    {
      maximumItems: 32,
    },
  ),
  isEmptyOfMajorStars: freezeAiChartD1Value({ type: 'boolean' }),
  borrowStatus: createAiChartD1StringSchema({ enumValues: BORROW_STATUSES }),
  borrowBlockerPlacementIds: createAiChartD1ArraySchema(ID_SCHEMA),
  borrowedMajorStars: createAiChartD1ArraySchema(BORROWED_STAR_SCHEMA, {
    maximumItems: 2,
  }),
  oppositePalaceId: PALACE_ID_SCHEMA,
  hiddenCombinationPalaceId: PALACE_ID_SCHEMA,
  otherTrinePalaceIds: createAiChartD1ArraySchema(PALACE_ID_SCHEMA, {
    minimumItems: 2,
    maximumItems: 2,
  }),
  isFourHorsePalace: freezeAiChartD1Value({ type: 'boolean' }),
})
const SIGNAL_SCHEMA = createAiChartD1StrictObjectSchema({
  signalId: ID_SCHEMA,
  signalType: createAiChartD1StringSchema({ enumValues: SIGNAL_TYPES }),
  starPlacementId: ID_SCHEMA,
  palaceId: PALACE_ID_SCHEMA,
  starName: createAiChartD1StringSchema({
    maximumLength: AI_CHART_D1_MAX_SHORT_TEXT_LENGTH,
  }),
})
const SIGNAL_ARRAY_SCHEMA = createAiChartD1ArraySchema(SIGNAL_SCHEMA)
const SIGNAL_COUNT_SCHEMA = freezeAiChartD1Value({
  type: 'integer',
  minimum: 0,
  maximum: 128,
})
const TOTAL_RELEVANT_COUNT_SCHEMA = freezeAiChartD1Value({
  type: 'integer',
  minimum: 0,
  maximum: 512,
})
const SCAN_SCHEMA = createAiChartD1StrictObjectSchema({
  palaceId: PALACE_ID_SCHEMA,
  completeness: createAiChartD1StringSchema({
    enumValues: ['natal_structure_only_flying_unavailable'],
  }),
  directSignals: SIGNAL_ARRAY_SCHEMA,
  oppositeSignals: SIGNAL_ARRAY_SCHEMA,
  hiddenCombinationSignals: SIGNAL_ARRAY_SCHEMA,
  trineSignals: SIGNAL_ARRAY_SCHEMA,
  directCount: SIGNAL_COUNT_SCHEMA,
  oppositeCount: SIGNAL_COUNT_SCHEMA,
  hiddenCombinationCount: SIGNAL_COUNT_SCHEMA,
  trineCount: SIGNAL_COUNT_SCHEMA,
  totalRelevantCount: TOTAL_RELEVANT_COUNT_SCHEMA,
})
const WARNING_SCHEMA = createAiChartD1StrictObjectSchema({
  warningId: ID_SCHEMA,
  code: createAiChartD1StringSchema({
    enumValues: AI_CHART_D1_N0_WARNING_CODES,
  }),
  palaceId: freezeAiChartD1Value({
    type: ['string', 'null'],
    pattern:
      '^palace:(ming|parents|fortune|property|career|friends|travel|health|wealth|children|spouse|siblings)$',
  }),
  placementIds: createAiChartD1ArraySchema(ID_SCHEMA),
})

export const AI_CHART_D1_P1_STRUCTURAL_INPUT_JSON_SCHEMA: AiChartD1JsonSchema =
  createAiChartD1StrictObjectSchema({
    contractVersion: createAiChartD1StringSchema({
      enumValues: [AI_CHART_D1_P1_STRUCTURAL_INPUT_CONTRACT_VERSION],
    }),
    task: createAiChartD1StringSchema({ enumValues: ['D1_P1_STRUCTURAL'] }),
    callId: ID_SCHEMA,
    runId: ID_SCHEMA,
    chartId: ID_SCHEMA,
    targetPalace: PALACE_SCHEMA,
    oppositePalace: PALACE_SCHEMA,
    hiddenCombinationPalace: PALACE_SCHEMA,
    otherTrinePalaces: createAiChartD1ArraySchema(PALACE_SCHEMA, {
      minimumItems: 2,
      maximumItems: 2,
    }),
    targetGlobalScan: SCAN_SCHEMA,
    outputContractVersion: createAiChartD1StringSchema({
      enumValues: [AI_CHART_D1_P1_F1_CONTRACT_VERSION],
    }),
    structuralStatus: createAiChartD1StringSchema({
      enumValues: ['ready', 'partial'],
    }),
    knowledgeStatus: createAiChartD1StringSchema({
      enumValues: ['k0_required'],
    }),
    promptStatus: createAiChartD1StringSchema({
      enumValues: ['prompt_builder_required'],
    }),
    knowledgeBundleId: NULL_SCHEMA,
    promptVersion: NULL_SCHEMA,
    openAiCallable: freezeAiChartD1Value({
      type: 'boolean',
      enum: [false],
    }),
    warnings: createAiChartD1ArraySchema(WARNING_SCHEMA),
  })
