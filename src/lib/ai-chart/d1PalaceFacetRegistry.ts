import { freezeAiChartD1Value } from './d1CommonContracts'
import type { AiChartD1PalaceId } from './d1N0Constants'

export const AI_CHART_D1_PALACE_FACET_REGISTRY_VERSION =
  'ai-chart-d1-palace-facet-registry/v1' as const
export const AI_CHART_D1_PALACE_FACET_INVALID =
  'ai_chart_d1_palace_facet_invalid' as const

const FACETS_BY_PALACE = {
  'palace:ming': [
    'life.core_personality',
    'life.values_direction',
    'life.thinking_behavior',
    'life.capability_tendency',
    'life.strengths_blindspots',
    'life.appearance_optional',
  ],
  'palace:siblings': [
    'siblings.mother',
    'siblings.same_gender_siblings',
    'siblings.new_friends',
    'siblings.relationship_impact',
  ],
  'palace:spouse': [
    'relationship.attitude',
    'relationship.needs_expectations',
    'relationship.preferred_partner',
    'relationship.partner_possibility',
    'relationship.interaction',
  ],
  'palace:children': [
    'care.children',
    'care.pets',
    'pleasure.eating',
    'pleasure.play',
    'pleasure.travel',
    'possessions.owned_items',
  ],
  'palace:wealth': [
    'money.view',
    'money.earning',
    'money.spending',
    'money.management',
    'money.practical_use',
  ],
  'palace:health': [
    'body.care_direction',
    'body.use_consumption',
    'body.inherited_tendency',
    'body.stress_response',
    'body.appearance_optional',
  ],
  'palace:travel': [
    'outside.presentation',
    'outside.relationships',
    'outside.others_perception',
    'outside.inner_thought',
  ],
  'palace:friends': [
    'social.opposite_gender_siblings',
    'social.friends',
    'social.coworkers',
    'social.team_interaction',
  ],
  'palace:career': [
    'work.attitude_values',
    'work.direction',
    'work.method',
    'work.role_environment',
    'work.focus',
  ],
  'palace:property': [
    'home.living_environment',
    'home.nearby_environment',
    'home.family_interaction',
    'home.family_background',
    'reserve.saving_method',
    'reserve.accumulation_retention',
  ],
  'palace:fortune': [
    'inner.spiritual_enjoyment',
    'inner.social_values',
    'inner.blessing_luck',
    'inner.subconscious',
    'inner.taste',
    'inner.will_endurance',
    'inner.enjoyment_motivation',
  ],
  'palace:parents': [
    'authority.father_person',
    'authority.relationship_impact',
    'authority.elder_attitude',
    'authority.upbringing',
    'authority.hierarchy',
    'authority.institution',
  ],
} as const satisfies Readonly<Record<AiChartD1PalaceId, readonly string[]>>

export type AiChartD1PalaceFacetId =
  (typeof FACETS_BY_PALACE)[AiChartD1PalaceId][number]

export type AiChartD1PalaceFacetRegistryEntry = Readonly<{
  palaceId: AiChartD1PalaceId
  facetIds: readonly AiChartD1PalaceFacetId[]
}>

export const AI_CHART_D1_PALACE_FACET_REGISTRY =
  freezeAiChartD1Value<readonly AiChartD1PalaceFacetRegistryEntry[]>(
    Object.entries(FACETS_BY_PALACE).map(([palaceId, facetIds]) => ({
      palaceId: palaceId as AiChartD1PalaceId,
      facetIds: [...facetIds] as AiChartD1PalaceFacetId[],
    })),
  )

export const AI_CHART_D1_PALACE_FACET_IDS =
  freezeAiChartD1Value<readonly AiChartD1PalaceFacetId[]>(
    AI_CHART_D1_PALACE_FACET_REGISTRY.flatMap((entry) => [
      ...entry.facetIds,
    ]),
  )

const FACET_IDS_BY_PALACE: ReadonlyMap<
  AiChartD1PalaceId,
  ReadonlySet<AiChartD1PalaceFacetId>
> = new Map(
  AI_CHART_D1_PALACE_FACET_REGISTRY.map((entry) => [
    entry.palaceId,
    new Set(entry.facetIds),
  ]),
)

if (
  AI_CHART_D1_PALACE_FACET_REGISTRY.length !== 12 ||
  AI_CHART_D1_PALACE_FACET_IDS.length !== 63 ||
  new Set(AI_CHART_D1_PALACE_FACET_IDS).size !==
    AI_CHART_D1_PALACE_FACET_IDS.length
) {
  throw new Error(AI_CHART_D1_PALACE_FACET_INVALID)
}

export class AiChartD1PalaceFacetError extends Error {
  readonly code = AI_CHART_D1_PALACE_FACET_INVALID

  constructor() {
    super(AI_CHART_D1_PALACE_FACET_INVALID)
    this.name = 'AiChartD1PalaceFacetError'
    Object.freeze(this)
  }
}

export function isAiChartD1PalaceFacetAllowed(
  palaceId: AiChartD1PalaceId,
  facetId: unknown,
): facetId is AiChartD1PalaceFacetId {
  return (
    typeof facetId === 'string' &&
    FACET_IDS_BY_PALACE.get(palaceId)?.has(
      facetId as AiChartD1PalaceFacetId,
    ) === true
  )
}

export function assertAiChartD1PalaceFacetAllowed(
  palaceId: AiChartD1PalaceId,
  facetId: unknown,
): AiChartD1PalaceFacetId {
  if (!isAiChartD1PalaceFacetAllowed(palaceId, facetId)) {
    throw new AiChartD1PalaceFacetError()
  }
  return facetId
}
