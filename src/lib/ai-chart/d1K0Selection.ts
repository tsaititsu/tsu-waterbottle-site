import {
  AI_CHART_D1_ID_PATTERN,
  assertAiChartD1SafeGraph,
} from './d1CommonContracts'
import {
  AI_CHART_D1_K0_BUNDLE_VERSION,
  AI_CHART_D1_K0_CATALOG_ID,
  AI_CHART_D1_K0_MUTAGEN_SLUGS,
  getAiChartD1K0PairKey,
  getAiChartD1K0StarSlug,
} from './d1K0Registry'
import {
  AI_CHART_D1_K0_PALACE_ROLES,
  compareAiChartD1K0Rules,
  parseAiChartD1K0Catalog,
  parseAiChartD1K0P1Bundle,
  type AiChartD1K0Catalog,
  type AiChartD1K0MissingRequirement,
  type AiChartD1K0P1Bundle,
  type AiChartD1K0PalaceRole,
  type AiChartD1K0Rule,
  type AiChartD1K0RuleKind,
  type AiChartD1K0SelectedMeaning,
  type AiChartD1K0SelectionReason,
  type AiChartD1K0SelectionTrace,
  type AiChartD1K0MissingReasonCode,
} from './d1K0Contracts'
import {
  AI_CHART_D1_P1_STRUCTURAL_INPUT_CONTRACT_VERSION,
  AI_CHART_D1_PALACE_IDENTITIES,
  getAiChartD1CanonicalDoubleMajorStarPair,
  type AiChartD1MajorStarName,
  type AiChartD1MutagenType,
  type AiChartD1PalaceId,
} from './d1N0Constants'
import {
  parseAiChartD1P1StructuralInput,
  type AiChartD1P1StructuralInput,
  type AiChartD1P1StructuralPalace,
  type AiChartD1P1StructuralStar,
} from './d1P1InputContracts'
import type { AiChartD1N0BorrowedMajorStar } from './d1N0Parser'

export type AiChartD1K0P1BundleBuildIdentity = Readonly<{
  bundleIds: readonly string[]
}>

function invalid(): never {
  throw new Error('ai_chart_d1_k0_bundle_invalid')
}

type View = Readonly<{
  role: AiChartD1K0PalaceRole
  palace: AiChartD1P1StructuralPalace
}>

function viewsFor(input: AiChartD1P1StructuralInput): readonly View[] {
  return Object.freeze([
    Object.freeze({ role: 'target', palace: input.targetPalace }),
    Object.freeze({ role: 'opposite', palace: input.oppositePalace }),
    Object.freeze({
      role: 'hidden_combination',
      palace: input.hiddenCombinationPalace,
    }),
    Object.freeze({ role: 'trine_1', palace: input.otherTrinePalaces[0] }),
    Object.freeze({ role: 'trine_2', palace: input.otherTrinePalaces[1] }),
  ])
}

type TraceInput = Readonly<{
  reason: AiChartD1K0SelectionReason
  role: AiChartD1K0PalaceRole | null
  palaceId: AiChartD1PalaceId | null
  placementId: string | null
  starName: string | null
  mutagenType: AiChartD1MutagenType | null
  structuralReference: string
}>

function buildOneBundle(
  catalog: AiChartD1K0Catalog,
  input: AiChartD1P1StructuralInput,
  bundleId: string,
): AiChartD1K0P1Bundle {
  const rules = new Map(catalog.rules.map((rule) => [rule.ruleId, rule]))
  const selected = new Map<string, AiChartD1K0Rule>()
  const traces = new Map<string, AiChartD1K0SelectionTrace>()
  const meanings: AiChartD1K0SelectedMeaning[] = []
  const missing = new Map<string, AiChartD1K0MissingRequirement>()

  const addRule = (ruleId: string, trace: TraceInput): boolean => {
    const rule = rules.get(ruleId)
    if (!rule) return false
    if (!selected.has(ruleId)) {
      selected.set(ruleId, rule)
      traces.set(
        ruleId,
        Object.freeze({
          ruleId,
          reason: trace.reason,
          palaceRole: trace.role,
          palaceId: trace.palaceId,
          placementId: trace.placementId,
          starName: trace.starName,
          mutagenType: trace.mutagenType,
          structuralReference: trace.structuralReference,
        }),
      )
    }
    return true
  }

  const addMissing = (inputValue: Readonly<{
    requirementId: string
    kind: AiChartD1K0RuleKind
    role: AiChartD1K0PalaceRole | null
    palaceId: AiChartD1PalaceId | null
    starName: string | null
    mutagenType: AiChartD1MutagenType | null
    pairKey: string | null
    reasonCode: AiChartD1K0MissingReasonCode
  }>): void => {
    if (!missing.has(inputValue.requirementId)) {
      missing.set(
        inputValue.requirementId,
        Object.freeze({
          requirementId: inputValue.requirementId,
          kind: inputValue.kind,
          palaceRole: inputValue.role,
          palaceId: inputValue.palaceId,
          starName: inputValue.starName,
          mutagenType: inputValue.mutagenType,
          pairKey: inputValue.pairKey,
          reasonCode: inputValue.reasonCode,
        }),
      )
    }
  }

  const commonRuleIds = [
    'rule:common:possibility-first',
    'rule:common:malefic-preserve-all',
    'rule:common:natal-scan-completeness',
    'rule:common:d1-event-boundary',
  ] as const
  for (const ruleId of commonRuleIds) {
    if (!addRule(ruleId, {
      reason: 'required_common_rule', role: null, palaceId: null,
      placementId: null, starName: null, mutagenType: null,
      structuralReference: 'p1:required-common',
    })) {
      addMissing({
        requirementId: `missing:common:${ruleId.slice('rule:'.length)}`,
        kind: 'common', role: null, palaceId: null, starName: null,
        mutagenType: null, pairKey: null,
        reasonCode: 'missing_relationship_rule',
      })
    }
  }

  const relationshipRuleIds = [
    'rule:structure:opposite',
    'rule:structure:hidden-combination',
    'rule:structure:trine',
    'rule:structure:integration-order',
  ] as const
  for (const ruleId of relationshipRuleIds) {
    if (!addRule(ruleId, {
      reason: 'relationship_rule', role: 'target',
      palaceId: input.targetPalace.palaceId, placementId: null,
      starName: null, mutagenType: null,
      structuralReference: `p1:view:target`,
    })) {
      addMissing({
        requirementId: `missing:relationship:${ruleId.slice('rule:structure:'.length)}`,
        kind: 'relationship', role: 'target',
        palaceId: input.targetPalace.palaceId, starName: null,
        mutagenType: null, pairKey: null,
        reasonCode: 'missing_relationship_rule',
      })
    }
  }

  const selectMutagen = (
    starName: string,
    mutagenType: AiChartD1MutagenType,
    placementId: string,
    view: View,
  ): void => {
    const slug = getAiChartD1K0StarSlug(starName)
    if (!slug) return
    const mutagenSlug = AI_CHART_D1_K0_MUTAGEN_SLUGS[mutagenType]
    addRule(`rule:mutagen:common:${mutagenSlug}`, {
      reason: 'natal_mutagen_present', role: view.role,
      palaceId: view.palace.palaceId, placementId, starName, mutagenType,
      structuralReference: `p1:view:${view.role}`,
    })
    const inventory = catalog.mutagenInventory.find(
      (entry) =>
        entry.starName === starName && entry.mutagenType === mutagenType,
    )
    if (!inventory?.specificRuleId || !addRule(inventory.specificRuleId, {
      reason: 'natal_mutagen_present', role: view.role,
      palaceId: view.palace.palaceId, placementId, starName, mutagenType,
      structuralReference: `p1:view:${view.role}`,
    })) {
      addMissing({
        requirementId: `missing:${view.role}:mutagen:${slug}:${mutagenSlug}`,
        kind: 'natal_mutagen', role: view.role,
        palaceId: view.palace.palaceId, starName, mutagenType, pairKey: null,
        reasonCode: 'missing_specific_mutagen_rule',
      })
    }
  }

  const selectMajor = (
    star: AiChartD1P1StructuralStar | AiChartD1N0BorrowedMajorStar,
    placementId: string,
    view: View,
    borrowed: boolean,
  ): void => {
    const slug = getAiChartD1K0StarSlug(star.name)
    if (!slug || !addRule(`rule:star:${slug}:core`, {
      reason: borrowed ? 'borrowed_major_star_present' : 'major_star_present',
      role: view.role, palaceId: view.palace.palaceId, placementId,
      starName: star.name, mutagenType: star.natalMutagen,
      structuralReference: `p1:view:${view.role}`,
    })) {
      addMissing({
        requirementId: `missing:${view.role}:star:${slug ?? 'unknown'}`,
        kind: 'single_star', role: view.role,
        palaceId: view.palace.palaceId, starName: star.name,
        mutagenType: star.natalMutagen, pairKey: null,
        reasonCode: 'missing_single_star_rule',
      })
    }
    if (star.natalMutagen) {
      selectMutagen(star.name, star.natalMutagen, placementId, view)
    }
  }

  const selectDouble = (
    stars: readonly { name: string; placementId: string }[],
    view: View,
  ): void => {
    if (stars.length !== 2) return
    const pair = getAiChartD1CanonicalDoubleMajorStarPair(
      stars.map((star) => star.name) as AiChartD1MajorStarName[],
    )
    if (!pair) return
    const pairKey = getAiChartD1K0PairKey(pair[0], pair[1])
    const inventory = catalog.doubleStarInventory.find(
      (entry) => entry.pairKey === pairKey,
    )
    if (!inventory?.specificRuleId || !addRule(inventory.specificRuleId, {
      reason: 'double_star_present', role: view.role,
      palaceId: view.palace.palaceId, placementId: null,
      starName: null, mutagenType: null,
      structuralReference: `p1:view:${view.role}`,
    })) {
      addMissing({
        requirementId: `missing:${view.role}:double:${pairKey.slice('pair:'.length)}`,
        kind: 'double_star', role: view.role,
        palaceId: view.palace.palaceId, starName: null,
        mutagenType: null, pairKey,
        reasonCode: 'missing_confirmed_double_star_core',
      })
    }
  }

  for (const view of viewsFor(input)) {
    const palaceSlug = view.palace.palaceId.slice('palace:'.length)
    if (!addRule(`rule:palace:${palaceSlug}:meanings`, {
      reason: 'palace_meaning', role: view.role,
      palaceId: view.palace.palaceId, placementId: null,
      starName: null, mutagenType: null,
      structuralReference: `p1:view:${view.role}`,
    })) {
      addMissing({
        requirementId: `missing:${view.role}:palace-meaning:${palaceSlug}`,
        kind: 'palace_meaning', role: view.role,
        palaceId: view.palace.palaceId, starName: null,
        mutagenType: null, pairKey: null,
        reasonCode: 'missing_palace_meaning',
      })
    }
    const palaceMeanings = catalog.palaceMeanings.filter(
      (meaning) => meaning.palaceId === view.palace.palaceId,
    )
    if (palaceMeanings.length === 0) {
      addMissing({
        requirementId: `missing:${view.role}:meaning-items:${palaceSlug}`,
        kind: 'palace_meaning', role: view.role,
        palaceId: view.palace.palaceId, starName: null,
        mutagenType: null, pairKey: null,
        reasonCode: 'missing_palace_meaning',
      })
    }
    for (const meaning of palaceMeanings) {
      meanings.push(Object.freeze({
        palaceRole: view.role,
        palaceId: meaning.palaceId,
        meaningId: meaning.meaningId,
        text: meaning.text,
        contentSha256: meaning.contentSha256,
        order: meaning.order,
      }))
    }

    for (const star of view.palace.canonicalMajorStars) {
      selectMajor(star, star.placementId, view, false)
    }
    for (const star of view.palace.borrowedMajorStars) {
      selectMajor(star, star.borrowedPlacementId, view, true)
    }
    selectDouble(
      view.palace.canonicalMajorStars.map((star) => ({
        name: star.name,
        placementId: star.placementId,
      })),
      view,
    )
    selectDouble(
      view.palace.borrowedMajorStars.map((star) => ({
        name: star.name,
        placementId: star.borrowedPlacementId,
      })),
      view,
    )

    for (const star of view.palace.modeledSupportingStars) {
      const slug = getAiChartD1K0StarSlug(star.name)
      if (!slug || !addRule(`rule:supporting:${slug}:core`, {
        reason: 'supporting_star_present', role: view.role,
        palaceId: view.palace.palaceId, placementId: star.placementId,
        starName: star.name, mutagenType: star.natalMutagen,
        structuralReference: `p1:view:${view.role}`,
      })) {
        addMissing({
          requirementId: `missing:${view.role}:supporting:${slug ?? 'unknown'}`,
          kind: 'supporting_star', role: view.role,
          palaceId: view.palace.palaceId, starName: star.name,
          mutagenType: star.natalMutagen, pairKey: null,
          reasonCode: 'missing_supporting_star_rule',
        })
      }
      if (star.natalMutagen) {
        selectMutagen(
          star.name,
          star.natalMutagen,
          star.placementId,
          view,
        )
      }
    }

    if (view.palace.isEmptyOfMajorStars) {
      const emptyRuleIds: string[] = []
      if (view.palace.borrowStatus === 'blocked_by_local_star') {
        emptyRuleIds.push('rule:structure:empty-palace-blockers')
      } else if (view.palace.borrowStatus === 'eligible_and_borrowed') {
        emptyRuleIds.push('rule:structure:empty-palace-borrow')
        emptyRuleIds.push('rule:structure:empty-palace-opposite-only')
        if (
          view.palace.modeledSupportingStars.some(
            (star) => star.name === '祿存',
          )
        ) {
          emptyRuleIds.push('rule:structure:empty-palace-lucun')
        }
      } else if (view.palace.borrowStatus === 'opposite_empty') {
        addMissing({
          requirementId: `missing:${view.role}:empty:opposite-empty`,
          kind: 'empty_palace',
          role: view.role,
          palaceId: view.palace.palaceId,
          starName: null,
          mutagenType: null,
          pairKey: null,
          reasonCode: 'missing_empty_palace_rule',
        })
      }
      for (const ruleId of emptyRuleIds) {
        if (!addRule(ruleId, {
          reason: 'empty_palace_rule', role: view.role,
          palaceId: view.palace.palaceId, placementId: null,
          starName: null, mutagenType: null,
          structuralReference: `p1:view:${view.role}`,
        })) {
          addMissing({
            requirementId: `missing:${view.role}:empty:${ruleId.slice('rule:structure:'.length)}`,
            kind: 'empty_palace', role: view.role,
            palaceId: view.palace.palaceId, starName: null,
            mutagenType: null, pairKey: null,
            reasonCode: 'missing_empty_palace_rule',
          })
        }
      }
    }
  }

  if (input.targetPalace.isFourHorsePalace) {
    for (const ruleId of [
      'rule:structure:four-horse',
      'rule:structure:four-horse-d1-boundary',
    ]) {
      if (!addRule(ruleId, {
        reason: 'four_horse_target', role: 'target',
        palaceId: input.targetPalace.palaceId, placementId: null,
        starName: null, mutagenType: null,
        structuralReference: 'p1:view:target',
      })) {
        addMissing({
          requirementId: `missing:target:four-horse:${ruleId.slice('rule:structure:'.length)}`,
          kind: 'four_horse', role: 'target',
          palaceId: input.targetPalace.palaceId, starName: null,
          mutagenType: null, pairKey: null,
          reasonCode: 'missing_four_horse_rule',
        })
      }
    }
  }

  const selectedRules = Object.freeze([...selected.values()].sort(compareAiChartD1K0Rules))
  const selectionTrace = Object.freeze(
    selectedRules.map((rule) => {
      const trace = traces.get(rule.ruleId)
      if (!trace) invalid()
      return trace
    }),
  )
  const roleOrder = new Map(
    AI_CHART_D1_K0_PALACE_ROLES.map((role, index) => [role, index]),
  )
  const palaceOrder = new Map(
    AI_CHART_D1_PALACE_IDENTITIES.map((palace, index) => [palace.palaceId, index]),
  )
  meanings.sort(
    (left, right) =>
      (roleOrder.get(left.palaceRole) ?? 99) -
        (roleOrder.get(right.palaceRole) ?? 99) ||
      (palaceOrder.get(left.palaceId) ?? 99) -
        (palaceOrder.get(right.palaceId) ?? 99) ||
      left.order - right.order,
  )
  const missingRequirements = Object.freeze(
    [...missing.values()].sort((left, right) =>
      left.requirementId.localeCompare(right.requirementId, 'en'),
    ),
  )
  const knowledgeStatus = missingRequirements.length === 0 ? 'ready' : 'partial'

  return parseAiChartD1K0P1Bundle({
    contractVersion: AI_CHART_D1_K0_BUNDLE_VERSION,
    bundleId,
    catalogId: AI_CHART_D1_K0_CATALOG_ID,
    catalogFingerprint: catalog.catalogFingerprint,
    sourceManifestSha256: catalog.sourceManifestSha256,
    task: 'D1_K0_P1',
    chartId: input.chartId,
    runId: input.runId,
    callId: input.callId,
    targetPalaceId: input.targetPalace.palaceId,
    p1StructuralInputContractVersion: AI_CHART_D1_P1_STRUCTURAL_INPUT_CONTRACT_VERSION,
    outputContractVersion: 'ai-chart-d1-p1-f1/v1',
    selectedRules,
    selectedMeanings: Object.freeze(meanings),
    selectionTrace,
    missingRequirements,
    knowledgeStatus,
    promptStatus: 'prompt_builder_required',
    openAiCallable: false,
    warnings: knowledgeStatus === 'partial'
      ? Object.freeze(['warning:k0:bundle-partial'])
      : Object.freeze([]),
  }, catalog)
}

export function buildAiChartD1K0P1KnowledgeBundles(
  catalogValue: unknown,
  p1InputValues: unknown,
  identityValue: unknown,
): readonly AiChartD1K0P1Bundle[] {
  try {
    const catalog = parseAiChartD1K0Catalog(catalogValue)
    assertAiChartD1SafeGraph(p1InputValues)
    assertAiChartD1SafeGraph(identityValue)
    if (!Array.isArray(p1InputValues) || p1InputValues.length !== 12) invalid()
    if (
      typeof identityValue !== 'object' ||
      identityValue === null ||
      Array.isArray(identityValue) ||
      Reflect.ownKeys(identityValue).length !== 1 ||
      !Object.prototype.hasOwnProperty.call(identityValue, 'bundleIds')
    ) {
      invalid()
    }
    const bundleIds = (identityValue as { bundleIds: unknown }).bundleIds
    if (
      !Array.isArray(bundleIds) ||
      bundleIds.length !== 12 ||
      bundleIds.some(
        (bundleId) =>
          typeof bundleId !== 'string' || !AI_CHART_D1_ID_PATTERN.test(bundleId),
      ) ||
      new Set(bundleIds).size !== 12
    ) {
      invalid()
    }
    const inputs = p1InputValues.map(parseAiChartD1P1StructuralInput)
    if (
      new Set(inputs.map((input) => input.callId)).size !== 12 ||
      inputs.some(
        (input, index) =>
          input.targetPalace.index !== index ||
          input.targetPalace.palaceId !==
            AI_CHART_D1_PALACE_IDENTITIES[index].palaceId,
      )
    ) {
      invalid()
    }
    return Object.freeze(
      inputs.map((input, index) => buildOneBundle(catalog, input, bundleIds[index])),
    )
  } catch {
    invalid()
  }
}
