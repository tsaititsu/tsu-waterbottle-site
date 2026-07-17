import type {
  EarthlyBranch,
  HeavenlyStem,
} from '@/features/ziwei-chart/types/ziwei'
import { AI_CHART_BIRTH_INPUT_VERSION } from './birthInput'
import {
  AI_CHART_ENGINE_NAME,
  AI_CHART_ENGINE_VERSION,
  AI_CHART_SNAPSHOT_VERSION,
} from './chartSnapshot'
import {
  AI_CHART_D1_MAX_LIST_ITEMS,
  AI_CHART_D1_MAX_SHORT_TEXT_LENGTH,
  assertAiChartD1SafeGraph,
  parseAiChartD1Enum,
  parseAiChartD1Text,
  requireAiChartD1ExactObject,
} from './d1CommonContracts'
import {
  AI_CHART_D1_BORROW_BLOCKING_STAR_NAMES,
  AI_CHART_D1_EARTHLY_BRANCHES,
  AI_CHART_D1_F1_BLOCKED_STATUS,
  AI_CHART_D1_FOUR_HORSE_BRANCHES,
  AI_CHART_D1_MAJOR_STAR_NAMES,
  AI_CHART_D1_MALEFIC_SIGNAL_STAR_NAMES,
  AI_CHART_D1_MODELED_SUPPORTING_STARS,
  AI_CHART_D1_MUTAGEN_TYPES,
  AI_CHART_D1_N0_CONTRACT_VERSION,
  AI_CHART_D1_PALACE_IDENTITIES,
  createAiChartD1NatalMutagenId,
  createAiChartD1SignalId,
  getAiChartD1CanonicalDoubleMajorStarPair,
  getAiChartD1PalaceIdentity,
  type AiChartD1MajorStarName,
  type AiChartD1ModeledSupportingStarName,
  type AiChartD1MutagenType,
  type AiChartD1N0SignalType,
  type AiChartD1PalaceId,
} from './d1N0Constants'
import {
  AiChartD1N0Error,
  assertAiChartD1N0Id,
  parseAiChartD1N0,
  type AiChartD1N0,
  type AiChartD1N0BorrowStatus,
  type AiChartD1N0ExcludedStar,
  type AiChartD1N0NatalMutagen,
  type AiChartD1N0Palace,
  type AiChartD1N0Signal,
  type AiChartD1N0SourceCollection,
  type AiChartD1N0StarPlacement,
  type AiChartD1N0StarType,
  type AiChartD1N0Warning,
} from './d1N0Parser'
import { buildAiChartD1N0PalaceRelations } from './d1N0Relations'

export type AiChartD1N0BuildIdentity = Readonly<{
  chartId: string
}>

type ParsedSnapshotStar = Readonly<{
  name: string
  type: AiChartD1N0StarType
  mutagen: AiChartD1MutagenType | null
}>

type ParsedSnapshotPalace = Readonly<{
  index: number
  name: string
  isMingPalace: boolean
  isBodyPalace: boolean
  heavenlyStem: HeavenlyStem
  earthlyBranch: EarthlyBranch
  majorStars: readonly ParsedSnapshotStar[]
  minorStars: readonly ParsedSnapshotStar[]
  adjectiveStars: readonly ParsedSnapshotStar[]
}>

type ParsedSnapshot = Readonly<{
  palaces: readonly ParsedSnapshotPalace[]
}>

type BasePalace = Readonly<{
  palaceId: AiChartD1PalaceId
  index: number
  canonicalName: AiChartD1N0Palace['canonicalName']
  earthlyBranch: EarthlyBranch
  heavenlyStem: HeavenlyStem
  isMingPalace: boolean
  isBodyPalace: boolean
  sourceMajorStars: readonly AiChartD1N0StarPlacement[]
  canonicalMajorStars: readonly AiChartD1N0StarPlacement[]
  modeledSupportingStars: readonly AiChartD1N0StarPlacement[]
  excludedStarSummary: readonly AiChartD1N0ExcludedStar[]
}>

const SNAPSHOT_FIELDS = Object.freeze([
  'version',
  'source',
  'engineVersion',
  'birthInputVersion',
  'lunarDate',
  'fiveElementsClass',
  'palaces',
] as const)
const PALACE_FIELDS = Object.freeze([
  'index',
  'name',
  'isMingPalace',
  'isBodyPalace',
  'heavenlyStem',
  'earthlyBranch',
  'majorStars',
  'minorStars',
  'adjectiveStars',
  'decadal',
  'ages',
] as const)
const DECADAL_FIELDS = Object.freeze([
  'range',
  'heavenlyStem',
  'earthlyBranch',
] as const)
const REQUIRED_STAR_FIELDS = Object.freeze(['name', 'type', 'scope'] as const)
const OPTIONAL_STAR_FIELDS = Object.freeze([
  'brightness',
  'mutagen',
  'group',
] as const)
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
const STAR_GROUPS = Object.freeze(['doctor', 'suiqian', 'nianzhi'] as const)
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

function parseBoolean(value: unknown): boolean {
  if (typeof value !== 'boolean') invalid()
  return value
}

function requireStarObject(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    invalid()
  }
  const record = value as Record<string, unknown>
  const allowed = new Set<string>([
    ...REQUIRED_STAR_FIELDS,
    ...OPTIONAL_STAR_FIELDS,
  ])
  const keys = Reflect.ownKeys(record)
  if (
    keys.some((key) => typeof key !== 'string' || !allowed.has(key)) ||
    REQUIRED_STAR_FIELDS.some(
      (field) => !Object.prototype.hasOwnProperty.call(record, field),
    )
  ) {
    invalid()
  }
  return record
}

function parseSnapshotStar(value: unknown): ParsedSnapshotStar {
  const record = requireStarObject(value)
  const name = parseAiChartD1Text(
    record.name,
    AI_CHART_D1_MAX_SHORT_TEXT_LENGTH,
  )
  const type = parseAiChartD1Enum(record.type, STAR_TYPES)
  if (record.scope !== 'origin') invalid()
  if (Object.prototype.hasOwnProperty.call(record, 'brightness')) {
    parseAiChartD1Text(
      record.brightness,
      AI_CHART_D1_MAX_SHORT_TEXT_LENGTH,
    )
  }
  const mutagen = Object.prototype.hasOwnProperty.call(record, 'mutagen')
    ? parseAiChartD1Enum(record.mutagen, AI_CHART_D1_MUTAGEN_TYPES)
    : null
  if (Object.prototype.hasOwnProperty.call(record, 'group')) {
    parseAiChartD1Enum(record.group, STAR_GROUPS)
  }
  return Object.freeze({ name, type, mutagen })
}

function parseSnapshotStarArray(value: unknown): readonly ParsedSnapshotStar[] {
  if (!Array.isArray(value) || value.length > AI_CHART_D1_MAX_LIST_ITEMS) {
    invalid()
  }
  return Object.freeze(value.map(parseSnapshotStar))
}

function parseSnapshotPalace(value: unknown): ParsedSnapshotPalace {
  const record = requireAiChartD1ExactObject(value, PALACE_FIELDS)
  const decadal = requireAiChartD1ExactObject(record.decadal, DECADAL_FIELDS)
  if (!Array.isArray(decadal.range) || decadal.range.length !== 2) invalid()
  const rangeStart = parseInteger(decadal.range[0], 0, 200)
  const rangeEnd = parseInteger(decadal.range[1], 0, 200)
  if (rangeStart > rangeEnd) invalid()
  parseAiChartD1Enum(decadal.heavenlyStem, HEAVENLY_STEMS)
  parseAiChartD1Enum(decadal.earthlyBranch, AI_CHART_D1_EARTHLY_BRANCHES)
  if (
    !Array.isArray(record.ages) ||
    record.ages.length > 128 ||
    record.ages.some(
      (age) => typeof age !== 'number' || !Number.isInteger(age) || age < 0,
    )
  ) {
    invalid()
  }

  const majorStars = parseSnapshotStarArray(record.majorStars)
  const minorStars = parseSnapshotStarArray(record.minorStars)
  const adjectiveStars = parseSnapshotStarArray(record.adjectiveStars)
  const allNames = [...majorStars, ...minorStars, ...adjectiveStars].map(
    (star) => star.name,
  )
  if (new Set(allNames).size !== allNames.length) invalid()

  return Object.freeze({
    index: parseInteger(record.index, 0, 11),
    name: parseAiChartD1Text(
      record.name,
      AI_CHART_D1_MAX_SHORT_TEXT_LENGTH,
    ),
    isMingPalace: parseBoolean(record.isMingPalace),
    isBodyPalace: parseBoolean(record.isBodyPalace),
    heavenlyStem: parseAiChartD1Enum(record.heavenlyStem, HEAVENLY_STEMS),
    earthlyBranch: parseAiChartD1Enum(
      record.earthlyBranch,
      AI_CHART_D1_EARTHLY_BRANCHES,
    ),
    majorStars,
    minorStars,
    adjectiveStars,
  })
}

function parseSnapshot(value: unknown): ParsedSnapshot {
  assertAiChartD1SafeGraph(value)
  const record = requireAiChartD1ExactObject(value, SNAPSHOT_FIELDS)
  if (
    record.version !== AI_CHART_SNAPSHOT_VERSION ||
    record.source !== AI_CHART_ENGINE_NAME ||
    record.engineVersion !== AI_CHART_ENGINE_VERSION ||
    record.birthInputVersion !== AI_CHART_BIRTH_INPUT_VERSION
  ) {
    invalid()
  }
  parseAiChartD1Text(record.lunarDate, AI_CHART_D1_MAX_SHORT_TEXT_LENGTH)
  parseAiChartD1Text(
    record.fiveElementsClass,
    AI_CHART_D1_MAX_SHORT_TEXT_LENGTH,
  )
  if (!Array.isArray(record.palaces) || record.palaces.length !== 12) {
    invalid()
  }
  const palaces = Object.freeze(
    record.palaces.map(parseSnapshotPalace).sort((left, right) => left.index - right.index),
  )
  if (
    palaces.some((palace, index) => palace.index !== index) ||
    new Set(palaces.map((palace) => palace.name)).size !== 12 ||
    new Set(palaces.map((palace) => palace.earthlyBranch)).size !== 12 ||
    palaces.filter((palace) => palace.isMingPalace).length !== 1 ||
    palaces.filter((palace) => palace.isBodyPalace).length !== 1
  ) {
    invalid()
  }
  for (const palace of palaces) {
    const identity = getAiChartD1PalaceIdentity(palace.name)
    const expectedIdentity = AI_CHART_D1_PALACE_IDENTITIES[palace.index]
    if (
      !identity ||
      !expectedIdentity ||
      identity.engineName !== expectedIdentity.engineName
    ) {
      invalid()
    }
  }
  return Object.freeze({ palaces })
}

function placementId(
  palaceId: AiChartD1PalaceId,
  collection: AiChartD1N0SourceCollection,
  index: number,
): string {
  const collectionId =
    collection === 'majorStars'
      ? 'major'
      : collection === 'minorStars'
        ? 'minor'
        : 'adjective'
  return `${palaceId}:star:${collectionId}:${index}`
}

function buildMajorStars(
  palaceId: AiChartD1PalaceId,
  stars: readonly ParsedSnapshotStar[],
): Readonly<{
  source: readonly AiChartD1N0StarPlacement[]
  canonical: readonly AiChartD1N0StarPlacement[]
}> {
  if (stars.length > 2) invalid()
  if (
    stars.some(
      (star) =>
        star.type !== 'major' ||
        !AI_CHART_D1_MAJOR_STAR_NAMES.includes(
          star.name as AiChartD1MajorStarName,
        ),
    ) ||
    new Set(stars.map((star) => star.name)).size !== stars.length
  ) {
    invalid()
  }
  const sourceNames = stars.map((star) => star.name as AiChartD1MajorStarName)
  const pair =
    sourceNames.length === 2
      ? getAiChartD1CanonicalDoubleMajorStarPair(sourceNames)
      : null
  if (sourceNames.length === 2 && pair === null) invalid()
  const canonicalNames = (pair ?? sourceNames) as readonly AiChartD1MajorStarName[]
  const source = Object.freeze(
    stars.map((star, index) =>
      Object.freeze({
        placementId: placementId(palaceId, 'majorStars', index),
        name: star.name,
        type: 'major' as const,
        sourceCollection: 'majorStars' as const,
        sourceIndex: index,
        sourceOrder: index,
        canonicalOrder: canonicalNames.indexOf(
          star.name as AiChartD1MajorStarName,
        ),
        natalMutagen: star.mutagen,
      }),
    ),
  )
  const canonical = Object.freeze(
    canonicalNames.map((name, index) => {
      const sourceStar = source.find((star) => star.name === name)
      if (!sourceStar) invalid()
      return Object.freeze({ ...sourceStar, canonicalOrder: index })
    }),
  )
  return Object.freeze({ source, canonical })
}

function buildOtherStars(
  palaceId: AiChartD1PalaceId,
  collection: 'minorStars' | 'adjectiveStars',
  stars: readonly ParsedSnapshotStar[],
): Readonly<{
  modeled: readonly AiChartD1N0StarPlacement[]
  excluded: readonly AiChartD1N0ExcludedStar[]
}> {
  const modeled: AiChartD1N0StarPlacement[] = []
  const excluded: AiChartD1N0ExcludedStar[] = []
  stars.forEach((star, index) => {
    if (star.type === 'major') invalid()
    if (
      AI_CHART_D1_MAJOR_STAR_NAMES.includes(star.name as AiChartD1MajorStarName)
    ) {
      invalid()
    }
    const expectedType =
      AI_CHART_D1_MODELED_SUPPORTING_STARS[
        star.name as AiChartD1ModeledSupportingStarName
      ]
    const id = placementId(palaceId, collection, index)
    if (expectedType !== undefined) {
      if (collection !== 'minorStars' || star.type !== expectedType) invalid()
      modeled.push(
        Object.freeze({
          placementId: id,
          name: star.name,
          type: star.type,
          sourceCollection: collection,
          sourceIndex: index,
          sourceOrder: index,
          canonicalOrder: null,
          natalMutagen: star.mutagen,
        }),
      )
    } else {
      excluded.push(
        Object.freeze({
          placementId: id,
          name: star.name,
          type: star.type,
          sourceCollection: collection,
          sourceIndex: index,
          natalMutagen: star.mutagen,
          reason: 'not_in_p1_allowlist',
        }),
      )
    }
  })
  return Object.freeze({
    modeled: Object.freeze(modeled),
    excluded: Object.freeze(excluded),
  })
}

function buildBasePalaces(snapshot: ParsedSnapshot): readonly BasePalace[] {
  return Object.freeze(
    snapshot.palaces.map((palace) => {
      const identity = getAiChartD1PalaceIdentity(palace.name)
      if (!identity) invalid()
      const major = buildMajorStars(identity.palaceId, palace.majorStars)
      const minor = buildOtherStars(
        identity.palaceId,
        'minorStars',
        palace.minorStars,
      )
      const adjective = buildOtherStars(
        identity.palaceId,
        'adjectiveStars',
        palace.adjectiveStars,
      )
      return Object.freeze({
        palaceId: identity.palaceId,
        index: palace.index,
        canonicalName: identity.canonicalName,
        earthlyBranch: palace.earthlyBranch,
        heavenlyStem: palace.heavenlyStem,
        isMingPalace: palace.isMingPalace,
        isBodyPalace: palace.isBodyPalace,
        sourceMajorStars: major.source,
        canonicalMajorStars: major.canonical,
        modeledSupportingStars: Object.freeze([
          ...minor.modeled,
          ...adjective.modeled,
        ]),
        excludedStarSummary: Object.freeze([
          ...minor.excluded,
          ...adjective.excluded,
        ]),
      })
    }),
  )
}

function buildPalaces(basePalaces: readonly BasePalace[]): readonly AiChartD1N0Palace[] {
  const relations = buildAiChartD1N0PalaceRelations(basePalaces)
  const byId = new Map(basePalaces.map((palace) => [palace.palaceId, palace]))
  return Object.freeze(
    basePalaces.map((palace) => {
      const relation = relations.find((item) => item.palaceId === palace.palaceId)
      const opposite = relation ? byId.get(relation.oppositePalaceId) : undefined
      if (!relation || !opposite) invalid()
      const blockers = palace.modeledSupportingStars
        .filter((star) =>
          AI_CHART_D1_BORROW_BLOCKING_STAR_NAMES.includes(
            star.name as (typeof AI_CHART_D1_BORROW_BLOCKING_STAR_NAMES)[number],
          ),
        )
        .map((star) => star.placementId)
      const isEmpty = palace.sourceMajorStars.length === 0
      let borrowStatus: AiChartD1N0BorrowStatus = 'not_empty'
      if (isEmpty && blockers.length > 0) {
        borrowStatus = 'blocked_by_local_star'
      } else if (isEmpty && opposite.canonicalMajorStars.length === 0) {
        borrowStatus = 'opposite_empty'
      } else if (isEmpty) {
        borrowStatus = 'eligible_and_borrowed'
      }
      const canBorrow = borrowStatus === 'eligible_and_borrowed'
      const borrowed = canBorrow
        ? opposite.canonicalMajorStars.map((star, index) =>
            Object.freeze({
              borrowedPlacementId: `${palace.palaceId}:borrowed:major:${index}`,
              sourcePlacementId: star.placementId,
              borrowedFromPalaceId: opposite.palaceId,
              name: star.name as AiChartD1MajorStarName,
              canonicalOrder: index,
              natalMutagen: star.natalMutagen,
            }),
          )
        : []
      return Object.freeze({
        ...palace,
        heavenlyStemAuthority: 'not_authoritative_flying_transform_source' as const,
        isEmptyOfMajorStars: isEmpty,
        canBorrowOppositeMajorStars: canBorrow,
        borrowStatus,
        borrowBlockerPlacementIds: Object.freeze(blockers),
        borrowedMajorStars: Object.freeze(borrowed),
        oppositePalaceId: relation.oppositePalaceId,
        hiddenCombinationPalaceId: relation.hiddenCombinationPalaceId,
        trinePalaceIds: relation.trinePalaceIds,
        otherTrinePalaceIds: relation.otherTrinePalaceIds,
        isFourHorsePalace: (
          AI_CHART_D1_FOUR_HORSE_BRANCHES as readonly EarthlyBranch[]
        ).includes(palace.earthlyBranch),
      })
    }),
  )
}

function allSourcePlacements(palace: AiChartD1N0Palace) {
  return [
    ...palace.sourceMajorStars,
    ...palace.modeledSupportingStars,
    ...palace.excludedStarSummary,
  ]
}

function buildNatalMutagens(
  palaces: readonly AiChartD1N0Palace[],
): readonly AiChartD1N0NatalMutagen[] {
  return Object.freeze(
    palaces
      .flatMap((palace) =>
        allSourcePlacements(palace)
          .filter((star) => star.natalMutagen !== null)
          .map((star) => {
            if (star.natalMutagen === null) invalid()
            return Object.freeze({
              mutagenId: createAiChartD1NatalMutagenId(
                star.placementId,
                star.natalMutagen,
              ),
              type: star.natalMutagen,
              starPlacementId: star.placementId,
              palaceId: palace.palaceId,
              starName: star.name,
            })
          }),
      )
      .sort((left, right) => left.mutagenId.localeCompare(right.mutagenId)),
  )
}

function buildWarnings(
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
  if (AI_CHART_D1_MUTAGEN_TYPES.some((type) => counts.get(type) === 0)) {
    warnings.push({
      warningId: 'warning:natal-mutagen-missing',
      code: 'natal_mutagen_missing',
      palaceId: null,
      placementIds: [],
    })
  }
  const duplicateTypes = AI_CHART_D1_MUTAGEN_TYPES.filter(
    (type) => (counts.get(type) ?? 0) > 1,
  )
  if (duplicateTypes.length > 0) {
    warnings.push({
      warningId: 'warning:natal-mutagen-duplicate',
      code: 'natal_mutagen_duplicate_type',
      palaceId: null,
      placementIds: mutagens
        .filter((mutagen) => duplicateTypes.includes(mutagen.type))
        .map((mutagen) => mutagen.starPlacementId)
        .sort(),
    })
  }
  return Object.freeze(warnings.map((warning) => Object.freeze({
    ...warning,
    placementIds: Object.freeze([...warning.placementIds]),
  })))
}

function buildSignals(
  palaces: readonly AiChartD1N0Palace[],
): readonly AiChartD1N0Signal[] {
  const signals = new Map<string, AiChartD1N0Signal>()
  for (const palace of palaces) {
    for (const star of palace.modeledSupportingStars) {
      if (
        AI_CHART_D1_MALEFIC_SIGNAL_STAR_NAMES.includes(
          star.name as (typeof AI_CHART_D1_MALEFIC_SIGNAL_STAR_NAMES)[number],
        )
      ) {
        const signalType = star.name as AiChartD1N0SignalType
        const signalId = createAiChartD1SignalId(star.placementId, signalType)
        signals.set(
          signalId,
          Object.freeze({
            signalId,
            signalType,
            starPlacementId: star.placementId,
            palaceId: palace.palaceId,
            starName: star.name,
          }),
        )
      }
    }
    for (const star of allSourcePlacements(palace)) {
      if (star.natalMutagen === '化忌') {
        const signalId = createAiChartD1SignalId(
          star.placementId,
          '生年化忌',
        )
        signals.set(
          signalId,
          Object.freeze({
            signalId,
            signalType: '生年化忌',
            starPlacementId: star.placementId,
            palaceId: palace.palaceId,
            starName: star.name,
          }),
        )
      }
    }
  }
  return Object.freeze(
    [...signals.values()].sort((left, right) =>
      left.signalId.localeCompare(right.signalId),
    ),
  )
}

function buildRawN0(snapshot: ParsedSnapshot, chartId: string): AiChartD1N0 {
  const basePalaces = buildBasePalaces(snapshot)
  const palaces = buildPalaces(basePalaces)
  const relationships = buildAiChartD1N0PalaceRelations(palaces)
  const natalMutagens = buildNatalMutagens(palaces)
  const dataWarnings = buildWarnings(palaces, natalMutagens)
  const signals = buildSignals(palaces)
  const signalIdsFor = (palaceIds: readonly string[]) =>
    signals
      .filter((signal) => palaceIds.includes(signal.palaceId))
      .map((signal) => signal.signalId)
      .sort()
  const palaceScans = palaces.map((palace) => {
    const relation = relationships.find(
      (item) => item.palaceId === palace.palaceId,
    )
    if (!relation) invalid()
    const directSignals = signalIdsFor([palace.palaceId])
    const oppositeSignals = signalIdsFor([relation.oppositePalaceId])
    const hiddenCombinationSignals = signalIdsFor([
      relation.hiddenCombinationPalaceId,
    ])
    const trineSignals = signalIdsFor(relation.otherTrinePalaceIds)
    return Object.freeze({
      palaceId: palace.palaceId,
      directSignals: Object.freeze(directSignals),
      oppositeSignals: Object.freeze(oppositeSignals),
      hiddenCombinationSignals: Object.freeze(hiddenCombinationSignals),
      trineSignals: Object.freeze(trineSignals),
      directCount: directSignals.length,
      oppositeCount: oppositeSignals.length,
      hiddenCombinationCount: hiddenCombinationSignals.length,
      trineCount: trineSignals.length,
      totalRelevantCount: new Set([
        ...directSignals,
        ...oppositeSignals,
        ...hiddenCombinationSignals,
        ...trineSignals,
      ]).size,
      completeness: 'natal_structure_only_flying_unavailable' as const,
    })
  })
  const tuoLuoPlacementIds = signals
    .filter((signal) => signal.signalType === '陀羅')
    .map((signal) => signal.starPlacementId)
    .sort()
  const natalJiMutagenIds = natalMutagens
    .filter((mutagen) => mutagen.type === '化忌')
    .map((mutagen) => mutagen.mutagenId)
    .sort()
  const quartetComplete = AI_CHART_D1_MUTAGEN_TYPES.every(
    (type) => natalMutagens.filter((mutagen) => mutagen.type === type).length === 1,
  )
  const structuralPartial =
    !quartetComplete ||
    palaces.some((palace) => palace.borrowStatus === 'opposite_empty')
  const ming = palaces.find((palace) => palace.isMingPalace)
  const body = palaces.find((palace) => palace.isBodyPalace)
  if (!ming || !body) invalid()

  return {
    contractVersion: AI_CHART_D1_N0_CONTRACT_VERSION,
    chartId,
    sourceSnapshotVersion: AI_CHART_SNAPSHOT_VERSION,
    sourceEngine: AI_CHART_ENGINE_NAME,
    sourceEngineVersion: AI_CHART_ENGINE_VERSION,
    palaces,
    mingPalaceId: ming.palaceId,
    bodyPalaceId: body.palaceId,
    sameAsMingPalace: ming.palaceId === body.palaceId,
    natalMutagens,
    tuoLuoPlacementIds: Object.freeze(tuoLuoPlacementIds),
    relationships,
    globalScan: Object.freeze({
      completeness: 'natal_structure_only_flying_unavailable' as const,
      signals,
      tuoLuoPlacementIds: Object.freeze([...tuoLuoPlacementIds]),
      natalJiMutagenIds: Object.freeze(natalJiMutagenIds),
      palaceScans: Object.freeze(palaceScans),
    }),
    dataWarnings,
    readiness: Object.freeze({
      structuralStatus: structuralPartial ? 'partial' : 'ready',
      natalMutagenStatus: quartetComplete
        ? 'snapshot_origin_mutagen_trusted'
        : 'snapshot_origin_mutagen_partial',
      knowledgeStatus: 'k0_required',
      promptStatus: 'prompt_builder_required',
      openAiCallable: false,
    }),
    f1Readiness: AI_CHART_D1_F1_BLOCKED_STATUS,
  }
}

export function normalizeAiChartD1N0(
  snapshot: unknown,
  identity: AiChartD1N0BuildIdentity,
): AiChartD1N0 {
  try {
    assertAiChartD1SafeGraph(identity)
    const identityRecord = requireAiChartD1ExactObject(identity, ['chartId'])
    const chartId = assertAiChartD1N0Id(identityRecord.chartId)
    return parseAiChartD1N0(buildRawN0(parseSnapshot(snapshot), chartId))
  } catch {
    invalid()
  }
}
