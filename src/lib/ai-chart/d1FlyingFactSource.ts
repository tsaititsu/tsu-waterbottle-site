import type { HeavenlyStem } from '@/features/ziwei-chart/types/ziwei'
import { MUTAGEN_TABLE } from '../../features/ziwei-chart/lib/engine/constants'
import {
  assertAiChartD1SafeGraph,
  createAiChartD1ArraySchema,
  createAiChartD1StrictObjectSchema,
  createAiChartD1StringSchema,
  freezeAiChartD1Value,
  parseAiChartD1Boolean,
  parseAiChartD1Id,
  requireAiChartD1ExactObject,
  type AiChartD1JsonSchema,
} from './d1CommonContracts'
import { getAiChartD1K0StarSlug } from './d1K0Registry'
import {
  AI_CHART_D1_MAJOR_STAR_NAMES,
  AI_CHART_D1_N0_CONTRACT_VERSION,
  type AiChartD1MutagenType,
  type AiChartD1PalaceId,
} from './d1N0Constants'
import {
  parseAiChartD1N0,
  type AiChartD1N0,
  type AiChartD1N0StarPlacement,
} from './d1N0Parser'
import {
  AI_CHART_D1_ACTOR_FACET_POLICIES,
  type AiChartD1ActorBindingId,
} from './d1PalaceActorBindingRegistry'
import { AI_CHART_D1_PALACE_FACET_REGISTRY } from './d1PalaceFacetRegistry'
import {
  AI_CHART_D1_FLYING_FACT_CONTRACT_VERSION,
  AI_CHART_D1_FLYING_FACT_JSON_SCHEMA,
  AI_CHART_D1_FLYING_TRANSFORMATION_KINDS,
  parseAiChartD1FlyingFact,
  type AiChartD1FlyingFact,
  type AiChartD1FlyingTransformationKind,
} from './d1FlyingInfluenceContracts'

export const AI_CHART_D1_FLYING_FACT_SET_VERSION =
  'ai-chart-d1-flying-fact-set/v1' as const
export const AI_CHART_D1_FLYING_FACT_SET_SCHEMA_NAME =
  'ai_chart_d1_flying_fact_set_v1' as const
export const AI_CHART_D1_FLYING_TRANSFORMATION_TABLE_VERSION =
  'ai-chart-d1-flying-transformation-table/v1' as const
export const AI_CHART_D1_FLYING_TRANSFORMATION_TABLE_SOURCE_REF =
  'knowledge:d1:four-transformations:teacher-table:v1' as const
export const AI_CHART_D1_FLYING_SOURCE_AUTHORITY =
  'validated_snapshot_palace_stem_and_fixed_teacher_table' as const
export const AI_CHART_D1_FLYING_FACT_SOURCE_INVALID =
  'ai_chart_d1_flying_fact_source_invalid' as const

export const AI_CHART_D1_FLYING_FACT_SOURCE_VALIDATION_REASONS =
  Object.freeze([
    'SOURCE_N0_INVALID',
    'TRANSFORMATION_TABLE_INVALID',
    'TRANSFORMED_STAR_MISSING',
    'TRANSFORMED_STAR_DUPLICATE',
    'FACT_SET_INVALID',
    'FACT_SET_MISMATCH',
  ] as const)

export type AiChartD1FlyingFactSourceValidationReason =
  (typeof AI_CHART_D1_FLYING_FACT_SOURCE_VALIDATION_REASONS)[number]

type AiChartD1FlyingTransformedStarName =
  | (typeof AI_CHART_D1_MAJOR_STAR_NAMES)[number]
  | '文昌'
  | '文曲'
  | '左輔'
  | '右弼'

export type AiChartD1FlyingTransformationTableRow = Readonly<{
  heavenlyStem: HeavenlyStem
  LU: AiChartD1FlyingTransformedStarName
  QUAN: AiChartD1FlyingTransformedStarName
  KE: AiChartD1FlyingTransformedStarName
  JI: AiChartD1FlyingTransformedStarName
}>

export const AI_CHART_D1_FLYING_TRANSFORMATION_TABLE =
  freezeAiChartD1Value<readonly AiChartD1FlyingTransformationTableRow[]>([
    {
      heavenlyStem: '甲',
      LU: '廉貞',
      QUAN: '破軍',
      KE: '武曲',
      JI: '太陽',
    },
    {
      heavenlyStem: '乙',
      LU: '天機',
      QUAN: '天梁',
      KE: '紫微',
      JI: '太陰',
    },
    {
      heavenlyStem: '丙',
      LU: '天同',
      QUAN: '天機',
      KE: '文昌',
      JI: '廉貞',
    },
    {
      heavenlyStem: '丁',
      LU: '太陰',
      QUAN: '天同',
      KE: '天機',
      JI: '巨門',
    },
    {
      heavenlyStem: '戊',
      LU: '貪狼',
      QUAN: '太陰',
      KE: '右弼',
      JI: '天機',
    },
    {
      heavenlyStem: '己',
      LU: '武曲',
      QUAN: '貪狼',
      KE: '天梁',
      JI: '文曲',
    },
    {
      heavenlyStem: '庚',
      LU: '太陽',
      QUAN: '武曲',
      KE: '天同',
      JI: '天相',
    },
    {
      heavenlyStem: '辛',
      LU: '巨門',
      QUAN: '太陽',
      KE: '文曲',
      JI: '文昌',
    },
    {
      heavenlyStem: '壬',
      LU: '天梁',
      QUAN: '紫微',
      KE: '左輔',
      JI: '武曲',
    },
    {
      heavenlyStem: '癸',
      LU: '破軍',
      QUAN: '巨門',
      KE: '太陰',
      JI: '貪狼',
    },
  ])

export type AiChartD1FlyingFactSet = Readonly<{
  contractVersion: typeof AI_CHART_D1_FLYING_FACT_SET_VERSION
  chartId: string
  sourceN0ContractVersion: typeof AI_CHART_D1_N0_CONTRACT_VERSION
  sourceAuthority: typeof AI_CHART_D1_FLYING_SOURCE_AUTHORITY
  transformationTableVersion:
    typeof AI_CHART_D1_FLYING_TRANSFORMATION_TABLE_VERSION
  transformationTableSourceRef:
    typeof AI_CHART_D1_FLYING_TRANSFORMATION_TABLE_SOURCE_REF
  facts: readonly AiChartD1FlyingFact[]
  openAiCallable: false
  validationStatus: 'validated'
}>

export class AiChartD1FlyingFactSourceError extends Error {
  readonly code = AI_CHART_D1_FLYING_FACT_SOURCE_INVALID
  declare readonly reasonCode: AiChartD1FlyingFactSourceValidationReason

  constructor(reasonCode: AiChartD1FlyingFactSourceValidationReason) {
    super(AI_CHART_D1_FLYING_FACT_SOURCE_INVALID)
    this.name = 'AiChartD1FlyingFactSourceError'
    Object.defineProperty(this, 'reasonCode', {
      value: reasonCode,
      enumerable: true,
      writable: false,
      configurable: false,
    })
    Object.freeze(this)
  }
}

const FACT_SET_FIELDS = Object.freeze([
  'contractVersion',
  'chartId',
  'sourceN0ContractVersion',
  'sourceAuthority',
  'transformationTableVersion',
  'transformationTableSourceRef',
  'facts',
  'openAiCallable',
  'validationStatus',
] as const)

const STEM_SLUGS = freezeAiChartD1Value<
  Readonly<Record<HeavenlyStem, string>>
>({
  甲: 'jia',
  乙: 'yi',
  丙: 'bing',
  丁: 'ding',
  戊: 'wu',
  己: 'ji',
  庚: 'geng',
  辛: 'xin',
  壬: 'ren',
  癸: 'gui',
})

const TRANSFORMATION_ACTION_REFS = freezeAiChartD1Value<
  Readonly<Record<AiChartD1FlyingTransformationKind, string>>
>({
  LU: 'rule:transformation-action:lu',
  QUAN: 'rule:transformation-action:quan',
  KE: 'rule:transformation-action:ke',
  JI: 'rule:transformation-action:ji',
})

const TRANSFORMATION_TO_NATAL_MUTAGEN =
  freezeAiChartD1Value<
    Readonly<
      Record<AiChartD1FlyingTransformationKind, AiChartD1MutagenType>
    >
  >({
    LU: '化祿',
    QUAN: '化權',
    KE: '化科',
    JI: '化忌',
  })

type IndexedPlacement = Readonly<{
  palaceId: AiChartD1PalaceId
  placement: AiChartD1N0StarPlacement
  coreRuleRef: string
}>

function invalid(
  reasonCode: AiChartD1FlyingFactSourceValidationReason,
): never {
  throw new AiChartD1FlyingFactSourceError(reasonCode)
}

function assertTransformationTable(): void {
  const fixedRows = AI_CHART_D1_FLYING_TRANSFORMATION_TABLE.map(
    (row) => [row.LU, row.QUAN, row.KE, row.JI],
  )
  if (
    fixedRows.length !== 10 ||
    JSON.stringify(fixedRows) !== JSON.stringify(MUTAGEN_TABLE) ||
    new Set(
      AI_CHART_D1_FLYING_TRANSFORMATION_TABLE.map(
        (row) => row.heavenlyStem,
      ),
    ).size !== 10
  ) {
    invalid('TRANSFORMATION_TABLE_INVALID')
  }
}

function parseN0(value: unknown): AiChartD1N0 {
  try {
    return parseAiChartD1N0(value)
  } catch {
    invalid('SOURCE_N0_INVALID')
  }
}

function collectSourceActorBindingRefs(
  sourcePalaceId: AiChartD1PalaceId,
): readonly AiChartD1ActorBindingId[] {
  const facetRegistry = AI_CHART_D1_PALACE_FACET_REGISTRY.find(
    (entry) => entry.palaceId === sourcePalaceId,
  )
  if (facetRegistry === undefined) invalid('SOURCE_N0_INVALID')

  const collected = new Set<AiChartD1ActorBindingId>()
  for (const facetId of facetRegistry.facetIds) {
    const policy = AI_CHART_D1_ACTOR_FACET_POLICIES.find(
      (entry) => entry.facetId === facetId,
    )
    if (policy === undefined) invalid('SOURCE_N0_INVALID')
    for (const bindingId of policy.allowedClaimBindingIds) {
      collected.add(bindingId)
    }
  }
  if (collected.size === 0) invalid('SOURCE_N0_INVALID')
  return Object.freeze([...collected])
}

function createCoreRuleRef(
  placement: AiChartD1N0StarPlacement,
): string {
  const slug = getAiChartD1K0StarSlug(placement.name)
  if (slug === null) invalid('TRANSFORMED_STAR_MISSING')
  return AI_CHART_D1_MAJOR_STAR_NAMES.includes(
    placement.name as (typeof AI_CHART_D1_MAJOR_STAR_NAMES)[number],
  )
    ? `rule:star:${slug}:core`
    : `rule:supporting:${slug}:core`
}

function indexTransformedStarPlacements(
  n0: AiChartD1N0,
): ReadonlyMap<AiChartD1FlyingTransformedStarName, IndexedPlacement> {
  const byName = new Map<
    AiChartD1FlyingTransformedStarName,
    IndexedPlacement[]
  >()
  const transformationStarNames = new Set(
    AI_CHART_D1_FLYING_TRANSFORMATION_TABLE.flatMap((row) => [
      row.LU,
      row.QUAN,
      row.KE,
      row.JI,
    ]),
  )

  for (const palace of n0.palaces) {
    for (const placement of [
      ...palace.sourceMajorStars,
      ...palace.modeledSupportingStars,
    ]) {
      if (
        !transformationStarNames.has(
          placement.name as AiChartD1FlyingTransformedStarName,
        )
      ) {
        continue
      }
      const starName =
        placement.name as AiChartD1FlyingTransformedStarName
      const current = byName.get(starName) ?? []
      current.push({
        palaceId: palace.palaceId,
        placement,
        coreRuleRef: createCoreRuleRef(placement),
      })
      byName.set(starName, current)
    }
  }

  const result = new Map<
    AiChartD1FlyingTransformedStarName,
    IndexedPlacement
  >()
  for (const starName of transformationStarNames) {
    const matches = byName.get(starName) ?? []
    if (matches.length === 0) invalid('TRANSFORMED_STAR_MISSING')
    if (matches.length !== 1) invalid('TRANSFORMED_STAR_DUPLICATE')
    result.set(starName, matches[0])
  }
  return result
}

function createFlyingFact(
  n0: AiChartD1N0,
  sourcePalaceId: AiChartD1PalaceId,
  sourcePalaceStem: HeavenlyStem,
  sourceActorBindingRefs: readonly AiChartD1ActorBindingId[],
  transformationKind: AiChartD1FlyingTransformationKind,
  transformedStarName: AiChartD1FlyingTransformedStarName,
  transformedStars: ReadonlyMap<
    AiChartD1FlyingTransformedStarName,
    IndexedPlacement
  >,
): AiChartD1FlyingFact {
  const target = transformedStars.get(transformedStarName)
  if (target === undefined) invalid('TRANSFORMED_STAR_MISSING')
  const transformationSlug = transformationKind.toLowerCase()
  const natalMutagen = TRANSFORMATION_TO_NATAL_MUTAGEN[transformationKind]
  const natalBackground = n0.natalMutagens.find(
    (candidate) =>
      candidate.starPlacementId === target.placement.placementId &&
      candidate.type === natalMutagen,
  )

  try {
    return parseAiChartD1FlyingFact({
      contractVersion: AI_CHART_D1_FLYING_FACT_CONTRACT_VERSION,
      flyingFactId: `flying-fact:${sourcePalaceId}:${transformationSlug}`,
      authoritativeInfluenceId:
        `flying-influence:${sourcePalaceId}:${transformationSlug}`,
      chartId: n0.chartId,
      sourcePalaceId,
      sourcePalaceStemRef:
        `fact:${sourcePalaceId}:heavenly-stem:${STEM_SLUGS[sourcePalaceStem]}`,
      sourceActorBindingRefs,
      targetPalaceId: target.palaceId,
      transformedStarName,
      transformedStarRef: target.placement.placementId,
      transformedStarCoreRuleRef: target.coreRuleRef,
      transformationKind,
      transformationActionRef:
        TRANSFORMATION_ACTION_REFS[transformationKind],
      natalBackgroundKind:
        natalBackground === undefined ? 'NONE' : 'SAME_TRANSFORMATION',
      natalBackgroundFactRef:
        natalBackground === undefined ? null : natalBackground.mutagenId,
      optionalOppositeCauseRef: null,
      validationStatus: 'validated',
    })
  } catch {
    invalid('FACT_SET_INVALID')
  }
}

function parseFactSet(value: unknown): AiChartD1FlyingFactSet {
  try {
    assertAiChartD1SafeGraph(value)
    const record = requireAiChartD1ExactObject(value, FACT_SET_FIELDS)
    if (
      record.contractVersion !== AI_CHART_D1_FLYING_FACT_SET_VERSION ||
      record.sourceN0ContractVersion !==
        AI_CHART_D1_N0_CONTRACT_VERSION ||
      record.sourceAuthority !== AI_CHART_D1_FLYING_SOURCE_AUTHORITY ||
      record.transformationTableVersion !==
        AI_CHART_D1_FLYING_TRANSFORMATION_TABLE_VERSION ||
      record.transformationTableSourceRef !==
        AI_CHART_D1_FLYING_TRANSFORMATION_TABLE_SOURCE_REF ||
      parseAiChartD1Boolean(record.openAiCallable) !== false ||
      record.validationStatus !== 'validated' ||
      !Array.isArray(record.facts) ||
      record.facts.length !== 48
    ) {
      invalid('FACT_SET_INVALID')
    }
    const facts = Object.freeze(
      record.facts.map(parseAiChartD1FlyingFact),
    )
    if (
      new Set(facts.map((fact) => fact.flyingFactId)).size !== 48 ||
      new Set(facts.map((fact) => fact.authoritativeInfluenceId)).size !==
        48
    ) {
      invalid('FACT_SET_INVALID')
    }
    return freezeAiChartD1Value({
      contractVersion: AI_CHART_D1_FLYING_FACT_SET_VERSION,
      chartId: parseAiChartD1Id(record.chartId),
      sourceN0ContractVersion: AI_CHART_D1_N0_CONTRACT_VERSION,
      sourceAuthority: AI_CHART_D1_FLYING_SOURCE_AUTHORITY,
      transformationTableVersion:
        AI_CHART_D1_FLYING_TRANSFORMATION_TABLE_VERSION,
      transformationTableSourceRef:
        AI_CHART_D1_FLYING_TRANSFORMATION_TABLE_SOURCE_REF,
      facts,
      openAiCallable: false as const,
      validationStatus: 'validated' as const,
    })
  } catch (error) {
    if (error instanceof AiChartD1FlyingFactSourceError) throw error
    invalid('FACT_SET_INVALID')
  }
}

export function buildAiChartD1FlyingFacts(
  n0Value: unknown,
): AiChartD1FlyingFactSet {
  assertTransformationTable()
  const n0 = parseN0(n0Value)
  const transformedStars = indexTransformedStarPlacements(n0)
  const facts: AiChartD1FlyingFact[] = []

  for (const sourcePalace of n0.palaces) {
    const tableRow = AI_CHART_D1_FLYING_TRANSFORMATION_TABLE.find(
      (row) => row.heavenlyStem === sourcePalace.heavenlyStem,
    )
    if (tableRow === undefined) invalid('TRANSFORMATION_TABLE_INVALID')
    const sourceActorBindingRefs = collectSourceActorBindingRefs(
      sourcePalace.palaceId,
    )
    for (const transformationKind of AI_CHART_D1_FLYING_TRANSFORMATION_KINDS) {
      facts.push(
        createFlyingFact(
          n0,
          sourcePalace.palaceId,
          sourcePalace.heavenlyStem,
          sourceActorBindingRefs,
          transformationKind,
          tableRow[transformationKind],
          transformedStars,
        ),
      )
    }
  }

  return parseFactSet({
    contractVersion: AI_CHART_D1_FLYING_FACT_SET_VERSION,
    chartId: n0.chartId,
    sourceN0ContractVersion: AI_CHART_D1_N0_CONTRACT_VERSION,
    sourceAuthority: AI_CHART_D1_FLYING_SOURCE_AUTHORITY,
    transformationTableVersion:
      AI_CHART_D1_FLYING_TRANSFORMATION_TABLE_VERSION,
    transformationTableSourceRef:
      AI_CHART_D1_FLYING_TRANSFORMATION_TABLE_SOURCE_REF,
    facts,
    openAiCallable: false,
    validationStatus: 'validated',
  })
}

export function validateAiChartD1FlyingFactSetAgainstN0(
  factSetValue: unknown,
  n0Value: unknown,
): AiChartD1FlyingFactSet {
  const supplied = parseFactSet(factSetValue)
  const expected = buildAiChartD1FlyingFacts(n0Value)
  if (JSON.stringify(supplied) !== JSON.stringify(expected)) {
    invalid('FACT_SET_MISMATCH')
  }
  return supplied
}

const ID_SCHEMA = createAiChartD1StringSchema({
  maximumLength: 128,
  pattern: '^[A-Za-z0-9._:-]{1,128}$',
})

export const AI_CHART_D1_FLYING_FACT_SET_JSON_SCHEMA: AiChartD1JsonSchema =
  createAiChartD1StrictObjectSchema({
    contractVersion: freezeAiChartD1Value({
      const: AI_CHART_D1_FLYING_FACT_SET_VERSION,
    }),
    chartId: ID_SCHEMA,
    sourceN0ContractVersion: freezeAiChartD1Value({
      const: AI_CHART_D1_N0_CONTRACT_VERSION,
    }),
    sourceAuthority: freezeAiChartD1Value({
      const: AI_CHART_D1_FLYING_SOURCE_AUTHORITY,
    }),
    transformationTableVersion: freezeAiChartD1Value({
      const: AI_CHART_D1_FLYING_TRANSFORMATION_TABLE_VERSION,
    }),
    transformationTableSourceRef: freezeAiChartD1Value({
      const: AI_CHART_D1_FLYING_TRANSFORMATION_TABLE_SOURCE_REF,
    }),
    facts: createAiChartD1ArraySchema(
      AI_CHART_D1_FLYING_FACT_JSON_SCHEMA,
      {
        minimumItems: 48,
        maximumItems: 48,
      },
    ),
    openAiCallable: freezeAiChartD1Value({
      const: false,
    }),
    validationStatus: freezeAiChartD1Value({
      const: 'validated',
    }),
  })
