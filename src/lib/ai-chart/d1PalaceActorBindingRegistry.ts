import { freezeAiChartD1Value } from './d1CommonContracts'
import {
  AI_CHART_D1_PALACE_FACET_IDS,
  type AiChartD1PalaceFacetId,
} from './d1PalaceFacetRegistry'

export const AI_CHART_D1_ACTOR_BINDING_REGISTRY_VERSION =
  'ai-chart-d1-actor-binding-registry/v1' as const
export const AI_CHART_D1_ACTOR_BINDING_INVALID =
  'ai_chart_d1_actor_binding_invalid' as const

export const AI_CHART_D1_PALACE_AXIS_ACTORS = Object.freeze([
  'NATIVE',
  'OTHER_PERSON',
  'INTERACTION',
] as const)

export const AI_CHART_D1_ACTOR_BINDING_RULES = freezeAiChartD1Value(
  [
    {
      ruleId: 'actor-rule:native-primary',
      ruleKind: 'NATIVE_PRIMARY',
    },
    {
      ruleId: 'actor-rule:existing-person',
      ruleKind: 'EXISTING_PERSON',
    },
    {
      ruleId: 'actor-rule:relationship-object-possibility',
      ruleKind: 'RELATIONSHIP_OBJECT_POSSIBILITY',
    },
    {
      ruleId: 'actor-rule:double-star-interaction',
      ruleKind: 'DOUBLE_STAR_INTERACTION',
    },
    {
      ruleId: 'actor-rule:institution-not-person',
      ruleKind: 'INSTITUTION_NOT_PERSON',
    },
  ] as const,
)

export const AI_CHART_D1_ACTOR_BINDING_REGISTRY = freezeAiChartD1Value(
  [
    {
      bindingId: 'actor:native',
      actor: 'NATIVE',
      subjectKind: 'NATIVE',
      ruleSourceRefs: ['actor-rule:native-primary'],
    },
    {
      bindingId: 'actor:interaction',
      actor: 'INTERACTION',
      subjectKind: 'CONCRETE_INTERACTION',
      ruleSourceRefs: ['actor-rule:double-star-interaction'],
    },
    {
      bindingId: 'actor:mother',
      actor: 'OTHER_PERSON',
      subjectKind: 'EXISTING_PERSON',
      ruleSourceRefs: ['actor-rule:existing-person'],
    },
    {
      bindingId: 'actor:father-or-paternal-elder',
      actor: 'OTHER_PERSON',
      subjectKind: 'EXISTING_OR_SOURCE_PERSON',
      ruleSourceRefs: ['actor-rule:existing-person'],
    },
    {
      bindingId: 'actor:same-gender-sibling-possibility',
      actor: 'OTHER_PERSON',
      subjectKind: 'RELATIONSHIP_OBJECT_POSSIBILITY',
      ruleSourceRefs: ['actor-rule:relationship-object-possibility'],
    },
    {
      bindingId: 'actor:new-friend-possibility',
      actor: 'OTHER_PERSON',
      subjectKind: 'RELATIONSHIP_OBJECT_POSSIBILITY',
      ruleSourceRefs: ['actor-rule:relationship-object-possibility'],
    },
    {
      bindingId: 'actor:partner-possibility',
      actor: 'OTHER_PERSON',
      subjectKind: 'RELATIONSHIP_OBJECT_POSSIBILITY',
      ruleSourceRefs: ['actor-rule:relationship-object-possibility'],
    },
    {
      bindingId: 'actor:child-possibility',
      actor: 'OTHER_PERSON',
      subjectKind: 'RELATIONSHIP_OBJECT_POSSIBILITY',
      ruleSourceRefs: ['actor-rule:relationship-object-possibility'],
    },
    {
      bindingId: 'actor:pet-possibility',
      actor: 'OTHER_PERSON',
      subjectKind: 'RELATIONSHIP_OBJECT_POSSIBILITY',
      ruleSourceRefs: ['actor-rule:relationship-object-possibility'],
    },
    {
      bindingId: 'actor:outside-person-possibility',
      actor: 'OTHER_PERSON',
      subjectKind: 'RELATIONSHIP_OBJECT_POSSIBILITY',
      ruleSourceRefs: ['actor-rule:relationship-object-possibility'],
    },
    {
      bindingId: 'actor:opposite-gender-sibling-possibility',
      actor: 'OTHER_PERSON',
      subjectKind: 'RELATIONSHIP_OBJECT_POSSIBILITY',
      ruleSourceRefs: ['actor-rule:relationship-object-possibility'],
    },
    {
      bindingId: 'actor:friend-possibility',
      actor: 'OTHER_PERSON',
      subjectKind: 'RELATIONSHIP_OBJECT_POSSIBILITY',
      ruleSourceRefs: ['actor-rule:relationship-object-possibility'],
    },
    {
      bindingId: 'actor:coworker-possibility',
      actor: 'OTHER_PERSON',
      subjectKind: 'RELATIONSHIP_OBJECT_POSSIBILITY',
      ruleSourceRefs: ['actor-rule:relationship-object-possibility'],
    },
    {
      bindingId: 'actor:team-member-possibility',
      actor: 'OTHER_PERSON',
      subjectKind: 'RELATIONSHIP_OBJECT_POSSIBILITY',
      ruleSourceRefs: ['actor-rule:relationship-object-possibility'],
    },
    {
      bindingId: 'actor:family-member-possibility',
      actor: 'OTHER_PERSON',
      subjectKind: 'RELATIONSHIP_OBJECT_POSSIBILITY',
      ruleSourceRefs: ['actor-rule:relationship-object-possibility'],
    },
    {
      bindingId: 'actor:concrete-authority-person',
      actor: 'OTHER_PERSON',
      subjectKind: 'CONCRETE_AUTHORITY_PERSON',
      ruleSourceRefs: [
        'actor-rule:relationship-object-possibility',
        'actor-rule:institution-not-person',
      ],
    },
  ] as const,
)

export type AiChartD1PalaceAxisActor =
  (typeof AI_CHART_D1_PALACE_AXIS_ACTORS)[number]
export type AiChartD1ActorBindingRule =
  (typeof AI_CHART_D1_ACTOR_BINDING_RULES)[number]
export type AiChartD1ActorBinding =
  (typeof AI_CHART_D1_ACTOR_BINDING_REGISTRY)[number]
export type AiChartD1ActorBindingId =
  AiChartD1ActorBinding['bindingId']

export const AI_CHART_D1_ACTOR_BINDING_IDS = freezeAiChartD1Value<
  readonly AiChartD1ActorBindingId[]
>(
  AI_CHART_D1_ACTOR_BINDING_REGISTRY.map(
    (binding) => binding.bindingId,
  ),
)

type ActorFacetPolicySeed = Readonly<{
  allowedClaimBindingIds: readonly AiChartD1ActorBindingId[]
  allowedInteractionFrontBindingIds: readonly AiChartD1ActorBindingId[]
}>

const NATIVE_ONLY = {
  allowedClaimBindingIds: ['actor:native'],
  allowedInteractionFrontBindingIds: [],
} as const satisfies ActorFacetPolicySeed

const ACTOR_POLICY_OVERRIDES = {
  'siblings.mother': {
    allowedClaimBindingIds: ['actor:mother'],
    allowedInteractionFrontBindingIds: [],
  },
  'siblings.same_gender_siblings': {
    allowedClaimBindingIds: [
      'actor:native',
      'actor:same-gender-sibling-possibility',
      'actor:interaction',
    ],
    allowedInteractionFrontBindingIds: [
      'actor:same-gender-sibling-possibility',
    ],
  },
  'siblings.new_friends': {
    allowedClaimBindingIds: [
      'actor:native',
      'actor:new-friend-possibility',
      'actor:interaction',
    ],
    allowedInteractionFrontBindingIds: ['actor:new-friend-possibility'],
  },
  'relationship.partner_possibility': {
    allowedClaimBindingIds: ['actor:partner-possibility'],
    allowedInteractionFrontBindingIds: [],
  },
  'relationship.interaction': {
    allowedClaimBindingIds: ['actor:native', 'actor:interaction'],
    allowedInteractionFrontBindingIds: ['actor:partner-possibility'],
  },
  'care.children': {
    allowedClaimBindingIds: [
      'actor:native',
      'actor:child-possibility',
      'actor:interaction',
    ],
    allowedInteractionFrontBindingIds: ['actor:child-possibility'],
  },
  'care.pets': {
    allowedClaimBindingIds: [
      'actor:native',
      'actor:pet-possibility',
      'actor:interaction',
    ],
    allowedInteractionFrontBindingIds: ['actor:pet-possibility'],
  },
  'outside.relationships': {
    allowedClaimBindingIds: [
      'actor:native',
      'actor:outside-person-possibility',
      'actor:interaction',
    ],
    allowedInteractionFrontBindingIds: ['actor:outside-person-possibility'],
  },
  'outside.others_perception': {
    allowedClaimBindingIds: ['actor:outside-person-possibility'],
    allowedInteractionFrontBindingIds: [],
  },
  'social.opposite_gender_siblings': {
    allowedClaimBindingIds: [
      'actor:native',
      'actor:opposite-gender-sibling-possibility',
      'actor:interaction',
    ],
    allowedInteractionFrontBindingIds: [
      'actor:opposite-gender-sibling-possibility',
    ],
  },
  'social.friends': {
    allowedClaimBindingIds: [
      'actor:native',
      'actor:friend-possibility',
      'actor:interaction',
    ],
    allowedInteractionFrontBindingIds: ['actor:friend-possibility'],
  },
  'social.coworkers': {
    allowedClaimBindingIds: [
      'actor:native',
      'actor:coworker-possibility',
      'actor:interaction',
    ],
    allowedInteractionFrontBindingIds: ['actor:coworker-possibility'],
  },
  'social.team_interaction': {
    allowedClaimBindingIds: [
      'actor:native',
      'actor:team-member-possibility',
      'actor:interaction',
    ],
    allowedInteractionFrontBindingIds: ['actor:team-member-possibility'],
  },
  'home.family_interaction': {
    allowedClaimBindingIds: [
      'actor:native',
      'actor:family-member-possibility',
      'actor:interaction',
    ],
    allowedInteractionFrontBindingIds: ['actor:family-member-possibility'],
  },
  'authority.father_person': {
    allowedClaimBindingIds: ['actor:father-or-paternal-elder'],
    allowedInteractionFrontBindingIds: [],
  },
  'authority.upbringing': {
    allowedClaimBindingIds: [
      'actor:native',
      'actor:father-or-paternal-elder',
    ],
    allowedInteractionFrontBindingIds: [],
  },
  'authority.hierarchy': {
    allowedClaimBindingIds: [
      'actor:native',
      'actor:concrete-authority-person',
      'actor:interaction',
    ],
    allowedInteractionFrontBindingIds: [
      'actor:concrete-authority-person',
    ],
  },
  'authority.institution': {
    allowedClaimBindingIds: ['actor:native', 'actor:interaction'],
    allowedInteractionFrontBindingIds: [
      'actor:concrete-authority-person',
    ],
  },
} as const satisfies Partial<
  Readonly<Record<AiChartD1PalaceFacetId, ActorFacetPolicySeed>>
>

export type AiChartD1ActorFacetPolicy = Readonly<{
  facetId: AiChartD1PalaceFacetId
  allowedClaimBindingIds: readonly AiChartD1ActorBindingId[]
  allowedInteractionFrontBindingIds: readonly AiChartD1ActorBindingId[]
}>

export const AI_CHART_D1_ACTOR_FACET_POLICIES =
  freezeAiChartD1Value<readonly AiChartD1ActorFacetPolicy[]>(
    AI_CHART_D1_PALACE_FACET_IDS.map((facetId) => {
      const override =
        ACTOR_POLICY_OVERRIDES[
          facetId as keyof typeof ACTOR_POLICY_OVERRIDES
        ]
      const policy: ActorFacetPolicySeed = override ?? NATIVE_ONLY
      return {
        facetId,
        allowedClaimBindingIds: [...policy.allowedClaimBindingIds],
        allowedInteractionFrontBindingIds: [
          ...policy.allowedInteractionFrontBindingIds,
        ],
      }
    }),
  )

const BINDING_BY_ID = new Map<
  AiChartD1ActorBindingId,
  AiChartD1ActorBinding
>(
  AI_CHART_D1_ACTOR_BINDING_REGISTRY.map((binding) => [
    binding.bindingId,
    binding,
  ]),
)
const POLICY_BY_FACET = new Map<
  AiChartD1PalaceFacetId,
  AiChartD1ActorFacetPolicy
>(
  AI_CHART_D1_ACTOR_FACET_POLICIES.map((policy) => [
    policy.facetId,
    policy,
  ]),
)
const RULE_IDS = new Set(
  AI_CHART_D1_ACTOR_BINDING_RULES.map((rule) => rule.ruleId),
)

if (
  AI_CHART_D1_ACTOR_FACET_POLICIES.length !==
    AI_CHART_D1_PALACE_FACET_IDS.length ||
  new Set(AI_CHART_D1_ACTOR_FACET_POLICIES.map((policy) => policy.facetId))
    .size !== AI_CHART_D1_PALACE_FACET_IDS.length ||
  BINDING_BY_ID.size !== AI_CHART_D1_ACTOR_BINDING_REGISTRY.length ||
  AI_CHART_D1_ACTOR_BINDING_REGISTRY.some(
    (binding) =>
      (binding.ruleSourceRefs as readonly string[]).length === 0 ||
      binding.ruleSourceRefs.some((ruleId) => !RULE_IDS.has(ruleId)),
  ) ||
  AI_CHART_D1_ACTOR_FACET_POLICIES.some(
    (policy) =>
      policy.allowedClaimBindingIds.some(
        (bindingId) => !BINDING_BY_ID.has(bindingId),
      ) ||
      policy.allowedInteractionFrontBindingIds.some(
        (bindingId) =>
          BINDING_BY_ID.get(bindingId)?.actor !== 'OTHER_PERSON',
      ),
  )
) {
  throw new Error(AI_CHART_D1_ACTOR_BINDING_INVALID)
}

export type AiChartD1ActorInteractionRoleBindings = Readonly<{
  frontStarActorBindingRef: string
  rearStarActorBindingRef: string
}>

export type AiChartD1ClaimActorBindingCandidate = Readonly<{
  facetId: AiChartD1PalaceFacetId
  actor: unknown
  actorBindingRefs: readonly unknown[]
  interactionRoleBindings: AiChartD1ActorInteractionRoleBindings | null
}>

export class AiChartD1ActorBindingError extends Error {
  readonly code = AI_CHART_D1_ACTOR_BINDING_INVALID

  constructor() {
    super(AI_CHART_D1_ACTOR_BINDING_INVALID)
    this.name = 'AiChartD1ActorBindingError'
    Object.freeze(this)
  }
}

export function isAiChartD1ClaimActorBindingAllowed(
  candidate: AiChartD1ClaimActorBindingCandidate,
): boolean {
  const policy = POLICY_BY_FACET.get(candidate.facetId)
  if (
    policy === undefined ||
    !AI_CHART_D1_PALACE_AXIS_ACTORS.includes(
      candidate.actor as AiChartD1PalaceAxisActor,
    ) ||
    candidate.actorBindingRefs.length !== 1
  ) {
    return false
  }

  const bindingId = candidate.actorBindingRefs[0]
  if (
    typeof bindingId !== 'string' ||
    !policy.allowedClaimBindingIds.includes(
      bindingId as AiChartD1ActorBindingId,
    )
  ) {
    return false
  }
  const binding = BINDING_BY_ID.get(bindingId as AiChartD1ActorBindingId)
  if (binding?.actor !== candidate.actor) return false

  if (candidate.actor !== 'INTERACTION') {
    return candidate.interactionRoleBindings === null
  }
  if (
    bindingId !== 'actor:interaction' ||
    candidate.interactionRoleBindings === null ||
    candidate.interactionRoleBindings.rearStarActorBindingRef !==
      'actor:native'
  ) {
    return false
  }
  const frontBindingId =
    candidate.interactionRoleBindings.frontStarActorBindingRef
  if (
    !policy.allowedInteractionFrontBindingIds.includes(
      frontBindingId as AiChartD1ActorBindingId,
    )
  ) {
    return false
  }
  return (
    BINDING_BY_ID.get(frontBindingId as AiChartD1ActorBindingId)?.actor ===
    'OTHER_PERSON'
  )
}

export function assertAiChartD1ClaimActorBindingAllowed(
  candidate: AiChartD1ClaimActorBindingCandidate,
): void {
  if (!isAiChartD1ClaimActorBindingAllowed(candidate)) {
    throw new AiChartD1ActorBindingError()
  }
}
