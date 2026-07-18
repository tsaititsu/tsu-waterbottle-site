import {
  AI_CHART_D1_P1_F1_CONTRACT_VERSION,
  assertAiChartD1SafeGraph,
  freezeAiChartD1Value,
} from './d1CommonContracts'
import {
  AI_CHART_D1_K0_BUNDLE_VERSION,
  AI_CHART_D1_K0_CATALOG_ID,
  getAiChartD1K0PairKey,
} from './d1K0Registry'
import {
  parseAiChartD1K0Catalog,
  parseAiChartD1K0P1Bundle,
  type AiChartD1K0Catalog,
  type AiChartD1K0P1Bundle,
  type AiChartD1K0PalaceRole,
  type AiChartD1K0Rule,
  type AiChartD1K0SelectionTrace,
} from './d1K0Contracts'
import {
  assertAiChartD1K0P1KnowledgeBundleMatchesStructuralInput,
  buildAiChartD1K0P1KnowledgeBundles,
} from './d1K0Selection'
import {
  AI_CHART_D1_P1_STRUCTURAL_INPUT_CONTRACT_VERSION,
  AI_CHART_D1_PALACE_IDENTITIES,
  getAiChartD1CanonicalDoubleMajorStarPair,
  type AiChartD1MajorStarName,
} from './d1N0Constants'
import {
  parseAiChartD1P1StructuralInput,
  type AiChartD1P1StructuralInput,
  type AiChartD1P1StructuralPalace,
} from './d1P1InputContracts'
import { AI_CHART_D1_P1_SCHEMA_NAME } from './d1P1F1Contracts'
import {
  AI_CHART_D1_P1_MODEL_INPUT_CONTRACT_VERSION,
  AI_CHART_D1_P1_MODEL_INPUT_TASK,
  AiChartD1P1ModelInputError,
  AiChartD1P1ModelInputNotReadyError,
  createAiChartD1P1ModelInputFingerprint,
  parseAiChartD1P1ModelInputShape,
  stableAiChartD1P1ModelInputEqual,
  toAiChartD1P1ModelStructuralContext,
  type AiChartD1P1ModelInput,
  type AiChartD1P1ModelInputWithoutFingerprint,
  type AiChartD1P1ModelRule,
} from './d1P1ModelInputContracts'

function invalid(): never {
  throw new AiChartD1P1ModelInputError()
}

function notReady(): never {
  throw new AiChartD1P1ModelInputNotReadyError()
}

function rethrowSafe(error: unknown): never {
  if (error instanceof AiChartD1P1ModelInputNotReadyError) throw error
  if (error instanceof AiChartD1P1ModelInputError) throw error
  invalid()
}

function cloneValue<T>(value: T): T {
  return structuredClone(value)
}

function projectRule(rule: AiChartD1K0Rule): AiChartD1P1ModelRule {
  return Object.freeze({
    ruleId: rule.ruleId,
    kind: rule.kind,
    title: rule.title,
    content: rule.content,
    contentSha256: rule.contentSha256,
    ruleStatus: rule.ruleStatus,
    sourceAuthority: rule.sourceAuthority,
    priority: rule.priority,
    d1Safety: rule.d1Safety,
  })
}

export function projectAiChartD1P1ModelRules(
  bundle: AiChartD1K0P1Bundle,
): readonly AiChartD1P1ModelRule[] {
  return Object.freeze(bundle.selectedRules.map(projectRule))
}

function viewsFor(
  structuralInput: AiChartD1P1StructuralInput,
): ReadonlyMap<AiChartD1K0PalaceRole, AiChartD1P1StructuralPalace> {
  return new Map([
    ['target', structuralInput.targetPalace],
    ['opposite', structuralInput.oppositePalace],
    ['hidden_combination', structuralInput.hiddenCombinationPalace],
    ['trine_1', structuralInput.otherTrinePalaces[0]],
    ['trine_2', structuralInput.otherTrinePalaces[1]],
  ])
}

function starMatches(
  stars: readonly Readonly<{
    placementId?: string
    borrowedPlacementId?: string
    name: string
    natalMutagen: string | null
  }>[],
  trace: AiChartD1K0SelectionTrace,
): boolean {
  return stars.some(
    (star) =>
      (star.placementId ?? star.borrowedPlacementId) === trace.placementId &&
      star.name === trace.starName &&
      star.natalMutagen === trace.mutagenType,
  )
}

function mutagenMatches(
  palace: AiChartD1P1StructuralPalace,
  trace: AiChartD1K0SelectionTrace,
): boolean {
  const stars = [
    ...palace.canonicalMajorStars,
    ...palace.modeledSupportingStars,
    ...palace.borrowedMajorStars,
  ]
  return stars.some(
    (star) =>
      ('placementId' in star
        ? star.placementId
        : star.borrowedPlacementId) === trace.placementId &&
      star.name === trace.starName &&
      star.natalMutagen === trace.mutagenType,
  )
}

function matchingDoubleRuleIds(
  palace: AiChartD1P1StructuralPalace,
  catalog: AiChartD1K0Catalog,
): ReadonlySet<string> {
  const ids = new Set<string>()
  for (const stars of [
    palace.canonicalMajorStars,
    palace.borrowedMajorStars,
  ]) {
    if (stars.length !== 2) continue
    const pair = getAiChartD1CanonicalDoubleMajorStarPair(
      stars.map((star) => star.name) as AiChartD1MajorStarName[],
    )
    if (!pair) continue
    const pairKey = getAiChartD1K0PairKey(pair[0], pair[1])
    const inventory = catalog.doubleStarInventory.find(
      (entry) => entry.pairKey === pairKey,
    )
    if (inventory?.specificRuleId) ids.add(inventory.specificRuleId)
  }
  return ids
}

function assertTraceAgainstPalace(
  trace: AiChartD1K0SelectionTrace,
  palace: AiChartD1P1StructuralPalace,
  catalog: AiChartD1K0Catalog,
): void {
  switch (trace.reason) {
    case 'required_common_rule':
      if (
        trace.palaceRole !== null ||
        trace.palaceId !== null ||
        trace.placementId !== null ||
        trace.starName !== null ||
        trace.mutagenType !== null
      ) {
        invalid()
      }
      return
    case 'palace_meaning':
      if (
        trace.ruleId !==
        `rule:palace:${palace.palaceId.slice('palace:'.length)}:meanings`
      ) {
        invalid()
      }
      return
    case 'major_star_present':
      if (!starMatches(palace.canonicalMajorStars, trace)) invalid()
      return
    case 'borrowed_major_star_present':
      if (!starMatches(palace.borrowedMajorStars, trace)) invalid()
      return
    case 'supporting_star_present':
      if (!starMatches(palace.modeledSupportingStars, trace)) invalid()
      return
    case 'natal_mutagen_present':
      if (!mutagenMatches(palace, trace)) invalid()
      return
    case 'double_star_present':
      if (!matchingDoubleRuleIds(palace, catalog).has(trace.ruleId)) invalid()
      return
    case 'relationship_rule':
      if (
        trace.palaceRole !== 'target' ||
        ![
          'rule:structure:opposite',
          'rule:structure:hidden-combination',
          'rule:structure:trine',
          'rule:structure:integration-order',
        ].includes(trace.ruleId)
      ) {
        invalid()
      }
      return
    case 'four_horse_target':
      if (trace.palaceRole !== 'target' || !palace.isFourHorsePalace) invalid()
      return
    case 'empty_palace_rule':
      return
  }
}

function assertEmptyPalaceBinding(
  role: AiChartD1K0PalaceRole,
  palace: AiChartD1P1StructuralPalace,
  traces: readonly AiChartD1K0SelectionTrace[],
): void {
  const actual = new Set(
    traces
      .filter(
        (trace) =>
          trace.reason === 'empty_palace_rule' && trace.palaceRole === role,
      )
      .map((trace) => trace.ruleId),
  )
  const expected = new Set<string>()

  switch (palace.borrowStatus) {
    case 'not_empty':
      break
    case 'blocked_by_local_star':
      expected.add('rule:structure:empty-palace-blockers')
      break
    case 'eligible_and_borrowed':
      expected.add('rule:structure:empty-palace-borrow')
      expected.add('rule:structure:empty-palace-opposite-only')
      if (
        palace.modeledSupportingStars.some((star) => star.name === '祿存')
      ) {
        expected.add('rule:structure:empty-palace-lucun')
      }
      break
    case 'opposite_empty':
      invalid()
  }

  if (
    actual.size !== expected.size ||
    [...actual].some((ruleId) => !expected.has(ruleId))
  ) {
    invalid()
  }
}

function assertTraceAndMeaningBindings(
  modelInput: AiChartD1P1ModelInput,
  catalog: AiChartD1K0Catalog,
  structuralInput: AiChartD1P1StructuralInput,
): void {
  const views = viewsFor(structuralInput)
  for (const trace of modelInput.knowledgeContext.selectionTrace) {
    if (trace.reason === 'required_common_rule') {
      assertTraceAgainstPalace(trace, structuralInput.targetPalace, catalog)
      continue
    }
    if (trace.palaceRole === null || trace.palaceId === null) invalid()
    const palace = views.get(trace.palaceRole)
    if (!palace || palace.palaceId !== trace.palaceId) invalid()
    assertTraceAgainstPalace(trace, palace, catalog)
  }

  for (const meaning of modelInput.knowledgeContext.meanings) {
    const palace = views.get(meaning.palaceRole)
    if (!palace || palace.palaceId !== meaning.palaceId) invalid()
  }

  for (const [role, palace] of views) {
    assertEmptyPalaceBinding(
      role,
      palace,
      modelInput.knowledgeContext.selectionTrace,
    )
  }
}

function expectedStructuralContext(structuralInput: AiChartD1P1StructuralInput) {
  return {
    targetPalace: structuralInput.targetPalace,
    oppositePalace: structuralInput.oppositePalace,
    hiddenCombinationPalace: structuralInput.hiddenCombinationPalace,
    otherTrinePalaces: structuralInput.otherTrinePalaces,
    targetGlobalScan: structuralInput.targetGlobalScan,
  }
}

function fingerprintPayload(
  modelInput: AiChartD1P1ModelInput,
): AiChartD1P1ModelInputWithoutFingerprint {
  const payload = cloneValue(modelInput) as unknown as Record<string, unknown>
  delete payload.inputFingerprint
  return payload as AiChartD1P1ModelInputWithoutFingerprint
}

export function validateAiChartD1P1ModelInputAgainstSources(
  modelInput: AiChartD1P1ModelInput,
  catalog: AiChartD1K0Catalog,
  structuralInput: AiChartD1P1StructuralInput,
  knowledgeBundle: AiChartD1K0P1Bundle,
): void {
  try {
    if (
      modelInput.chartId !== structuralInput.chartId ||
      modelInput.chartId !== knowledgeBundle.chartId ||
      modelInput.runId !== structuralInput.runId ||
      modelInput.runId !== knowledgeBundle.runId ||
      modelInput.callId !== structuralInput.callId ||
      modelInput.callId !== knowledgeBundle.callId ||
      modelInput.targetPalaceId !== structuralInput.targetPalace.palaceId ||
      modelInput.targetPalaceId !== knowledgeBundle.targetPalaceId ||
      modelInput.bundleId !== knowledgeBundle.bundleId ||
      modelInput.catalogId !== catalog.catalogId ||
      modelInput.catalogId !== knowledgeBundle.catalogId ||
      modelInput.catalogFingerprint !== catalog.catalogFingerprint ||
      modelInput.catalogFingerprint !== knowledgeBundle.catalogFingerprint ||
      modelInput.sourceManifestSha256 !== catalog.sourceManifestSha256 ||
      modelInput.sourceManifestSha256 !==
        knowledgeBundle.sourceManifestSha256 ||
      modelInput.structuralInputContractVersion !==
        structuralInput.contractVersion ||
      modelInput.structuralInputContractVersion !==
        knowledgeBundle.p1StructuralInputContractVersion ||
      modelInput.knowledgeBundleContractVersion !==
        knowledgeBundle.contractVersion ||
      modelInput.outputContractVersion !== structuralInput.outputContractVersion ||
      modelInput.outputContractVersion !== knowledgeBundle.outputContractVersion ||
      modelInput.outputSchemaName !== AI_CHART_D1_P1_SCHEMA_NAME ||
      modelInput.structuralStatus !== structuralInput.structuralStatus ||
      knowledgeBundle.knowledgeStatus !== 'ready' ||
      knowledgeBundle.missingRequirements.length !== 0 ||
      knowledgeBundle.warnings.length !== 0
    ) {
      invalid()
    }

    if (
      !stableAiChartD1P1ModelInputEqual(
        modelInput.structuralContext,
        expectedStructuralContext(structuralInput),
      ) ||
      !stableAiChartD1P1ModelInputEqual(
        modelInput.warnings,
        structuralInput.warnings,
      ) ||
      !stableAiChartD1P1ModelInputEqual(
        modelInput.knowledgeContext.rules,
        projectAiChartD1P1ModelRules(knowledgeBundle),
      ) ||
      !stableAiChartD1P1ModelInputEqual(
        modelInput.knowledgeContext.meanings,
        knowledgeBundle.selectedMeanings,
      ) ||
      !stableAiChartD1P1ModelInputEqual(
        modelInput.knowledgeContext.selectionTrace,
        knowledgeBundle.selectionTrace,
      )
    ) {
      invalid()
    }

    assertTraceAndMeaningBindings(modelInput, catalog, structuralInput)
  } catch (error) {
    if (error instanceof AiChartD1P1ModelInputError) throw error
    invalid()
  }
}

export function parseAiChartD1P1ModelInput(
  value: unknown,
  catalogValue: unknown,
  structuralInputValue: unknown,
  knowledgeBundleValue: unknown,
): AiChartD1P1ModelInput {
  try {
    const catalog = parseAiChartD1K0Catalog(catalogValue)
    const structuralInput = parseAiChartD1P1StructuralInput(
      structuralInputValue,
    )
    const knowledgeBundle = parseAiChartD1K0P1Bundle(
      knowledgeBundleValue,
      catalog,
    )
    assertAiChartD1K0P1KnowledgeBundleMatchesStructuralInput(
      catalog,
      structuralInput,
      knowledgeBundle,
    )
    if (
      knowledgeBundle.knowledgeStatus !== 'ready' ||
      knowledgeBundle.missingRequirements.length !== 0 ||
      knowledgeBundle.warnings.length !== 0
    ) {
      notReady()
    }
    const modelInput = parseAiChartD1P1ModelInputShape(value)
    validateAiChartD1P1ModelInputAgainstSources(
      modelInput,
      catalog,
      structuralInput,
      knowledgeBundle,
    )
    if (
      modelInput.inputFingerprint !==
      createAiChartD1P1ModelInputFingerprint(fingerprintPayload(modelInput))
    ) {
      invalid()
    }
    return freezeAiChartD1Value(modelInput)
  } catch (error) {
    rethrowSafe(error)
  }
}

function assertAtomicSources(
  catalog: AiChartD1K0Catalog,
  structuralInputs: readonly AiChartD1P1StructuralInput[],
  knowledgeBundles: readonly AiChartD1K0P1Bundle[],
): void {
  if (
    structuralInputs.length !== 12 ||
    knowledgeBundles.length !== 12 ||
    new Set(structuralInputs.map((input) => input.callId)).size !== 12 ||
    new Set(structuralInputs.map((input) => input.chartId)).size !== 1 ||
    new Set(structuralInputs.map((input) => input.runId)).size !== 1 ||
    new Set(knowledgeBundles.map((bundle) => bundle.bundleId)).size !== 12 ||
    new Set(knowledgeBundles.map((bundle) => bundle.callId)).size !== 12 ||
    new Set(knowledgeBundles.map((bundle) => bundle.chartId)).size !== 1 ||
    new Set(knowledgeBundles.map((bundle) => bundle.runId)).size !== 1 ||
    new Set(knowledgeBundles.map((bundle) => bundle.targetPalaceId)).size !==
      12 ||
    new Set(knowledgeBundles.map((bundle) => bundle.catalogId)).size !== 1 ||
    new Set(
      knowledgeBundles.map((bundle) => bundle.catalogFingerprint),
    ).size !== 1 ||
    new Set(
      knowledgeBundles.map((bundle) => bundle.sourceManifestSha256),
    ).size !== 1
  ) {
    invalid()
  }

  structuralInputs.forEach((structuralInput, index) => {
    const bundle = knowledgeBundles[index]
    if (
      structuralInput.targetPalace.index !== index ||
      structuralInput.targetPalace.palaceId !==
        AI_CHART_D1_PALACE_IDENTITIES[index].palaceId ||
      bundle.chartId !== structuralInput.chartId ||
      bundle.runId !== structuralInput.runId ||
      bundle.callId !== structuralInput.callId ||
      bundle.targetPalaceId !== structuralInput.targetPalace.palaceId ||
      bundle.p1StructuralInputContractVersion !==
        structuralInput.contractVersion ||
      bundle.outputContractVersion !== structuralInput.outputContractVersion ||
      bundle.catalogId !== catalog.catalogId ||
      bundle.catalogFingerprint !== catalog.catalogFingerprint ||
      bundle.sourceManifestSha256 !== catalog.sourceManifestSha256
    ) {
      invalid()
    }
  })
}

function buildOne(
  catalog: AiChartD1K0Catalog,
  structuralInput: AiChartD1P1StructuralInput,
  knowledgeBundle: AiChartD1K0P1Bundle,
): AiChartD1P1ModelInput {
  const withoutFingerprint: AiChartD1P1ModelInputWithoutFingerprint = {
    contractVersion: AI_CHART_D1_P1_MODEL_INPUT_CONTRACT_VERSION,
    task: AI_CHART_D1_P1_MODEL_INPUT_TASK,
    chartId: structuralInput.chartId,
    runId: structuralInput.runId,
    callId: structuralInput.callId,
    targetPalaceId: structuralInput.targetPalace.palaceId,
    structuralInputContractVersion:
      AI_CHART_D1_P1_STRUCTURAL_INPUT_CONTRACT_VERSION,
    knowledgeBundleContractVersion: AI_CHART_D1_K0_BUNDLE_VERSION,
    outputContractVersion: AI_CHART_D1_P1_F1_CONTRACT_VERSION,
    outputSchemaName: AI_CHART_D1_P1_SCHEMA_NAME,
    catalogId: AI_CHART_D1_K0_CATALOG_ID,
    catalogFingerprint: catalog.catalogFingerprint,
    sourceManifestSha256: catalog.sourceManifestSha256,
    bundleId: knowledgeBundle.bundleId,
    structuralContext: toAiChartD1P1ModelStructuralContext(structuralInput),
    knowledgeContext: freezeAiChartD1Value({
      rules: projectAiChartD1P1ModelRules(knowledgeBundle),
      meanings: cloneValue(knowledgeBundle.selectedMeanings),
      selectionTrace: cloneValue(knowledgeBundle.selectionTrace),
    }),
    structuralStatus: structuralInput.structuralStatus,
    knowledgeStatus: 'ready',
    promptStatus: 'prompt_builder_required',
    promptVersion: null,
    openAiCallable: false,
    warnings: freezeAiChartD1Value(cloneValue(structuralInput.warnings)),
  }
  return parseAiChartD1P1ModelInput(
    {
      ...withoutFingerprint,
      inputFingerprint:
        createAiChartD1P1ModelInputFingerprint(withoutFingerprint),
    },
    catalog,
    structuralInput,
    knowledgeBundle,
  )
}

export function buildAiChartD1P1ModelInputs(
  catalogValue: unknown,
  structuralInputValues: unknown,
  knowledgeBundleValues: unknown,
): readonly AiChartD1P1ModelInput[] {
  try {
    assertAiChartD1SafeGraph(catalogValue)
    assertAiChartD1SafeGraph(structuralInputValues)
    assertAiChartD1SafeGraph(knowledgeBundleValues)
    if (
      !Array.isArray(structuralInputValues) ||
      structuralInputValues.length !== 12 ||
      !Array.isArray(knowledgeBundleValues) ||
      knowledgeBundleValues.length !== 12
    ) {
      invalid()
    }
    const catalog = parseAiChartD1K0Catalog(catalogValue)
    const structuralInputs = structuralInputValues.map(
      parseAiChartD1P1StructuralInput,
    )
    const suppliedKnowledgeBundles = knowledgeBundleValues.map((bundle) =>
      parseAiChartD1K0P1Bundle(bundle, catalog),
    )
    assertAtomicSources(catalog, structuralInputs, suppliedKnowledgeBundles)

    const knowledgeBundles = buildAiChartD1K0P1KnowledgeBundles(
      catalog,
      structuralInputs,
      {
        bundleIds: suppliedKnowledgeBundles.map((bundle) => bundle.bundleId),
      },
    )
    if (
      knowledgeBundles.some(
        (bundle, index) =>
          !stableAiChartD1P1ModelInputEqual(
            bundle,
            suppliedKnowledgeBundles[index],
          ),
      )
    ) {
      invalid()
    }

    if (
      knowledgeBundles.some(
        (bundle) =>
          bundle.knowledgeStatus !== 'ready' ||
          bundle.missingRequirements.length !== 0 ||
          bundle.warnings.length !== 0,
      )
    ) {
      notReady()
    }

    const modelInputs = Object.freeze(
      structuralInputs.map((structuralInput, index) =>
        buildOne(catalog, structuralInput, knowledgeBundles[index]),
      ),
    )
    if (
      modelInputs.length !== 12 ||
      new Set(modelInputs.map((input) => input.callId)).size !== 12 ||
      new Set(modelInputs.map((input) => input.bundleId)).size !== 12 ||
      new Set(modelInputs.map((input) => input.chartId)).size !== 1 ||
      new Set(modelInputs.map((input) => input.runId)).size !== 1 ||
      modelInputs.some(
        (input, index) =>
          input.callId !== structuralInputs[index].callId ||
          input.bundleId !== knowledgeBundles[index].bundleId ||
          input.targetPalaceId !==
            AI_CHART_D1_PALACE_IDENTITIES[index].palaceId,
      )
    ) {
      invalid()
    }
    return modelInputs
  } catch (error) {
    rethrowSafe(error)
  }
}
