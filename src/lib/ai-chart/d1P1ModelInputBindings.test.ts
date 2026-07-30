import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import {
  AI_CHART_D1_P1_MODEL_INPUT_INVALID,
  AI_CHART_D1_P1_MODEL_INPUT_NOT_READY,
  createAiChartD1P1ModelInputFingerprint,
  stableAiChartD1P1ModelInputEqual,
  type AiChartD1P1ModelInput,
  type AiChartD1P1ModelInputWithoutFingerprint,
} from './d1P1ModelInputContracts'
import {
  buildAiChartD1P1ModelInputs,
  parseAiChartD1P1ModelInput,
} from './d1P1ModelInputBindings'
import { buildAiChartD1K0P1KnowledgeBundles } from './d1K0Selection'
import {
  compareAiChartD1K0Rules,
  type AiChartD1K0P1Bundle,
} from './d1K0Contracts'
import {
  AI_CHART_D1_PALACE_IDENTITIES,
  AI_CHART_D1_MODELED_SUPPORTING_STARS,
} from './d1N0Constants'
import {
  type ModelInputFixture,
  type Mutable,
  type MutableRecord,
  allObjectKeys,
  bundleIds,
  completeModelInputSnapshot,
  createModelInputFixture,
  createStructuralInputs,
  parseFixtureModelInput,
  recalculateModelInputFingerprint,
} from './d1P1ModelInputTestSupport'

let checks = 0

function check(name: string, run: () => void) {
  run()
  checks += 1
  console.log(`✓ ${name}`)
}

function assertInvalid(run: () => unknown): void {
  assert.throws(run, { message: AI_CHART_D1_P1_MODEL_INPUT_INVALID })
}

function assertNotReady(run: () => unknown): void {
  assert.throws(run, { message: AI_CHART_D1_P1_MODEL_INPUT_NOT_READY })
}

function mutateModelAndReject(
  fixture: ModelInputFixture,
  name: string,
  mutate: (value: Mutable<AiChartD1P1ModelInput>) => void,
): void {
  check(name, () => {
    const value = structuredClone(
      fixture.modelInputs[0],
    ) as Mutable<AiChartD1P1ModelInput>
    mutate(value)
    recalculateModelInputFingerprint(value)
    assertInvalid(() => parseFixtureModelInput(fixture, 0, value))
  })
}

function buildWithSources(
  fixture: ModelInputFixture,
  structuralInputs: unknown = fixture.structuralInputs,
  bundles: unknown = fixture.bundles,
) {
  return buildAiChartD1P1ModelInputs(
    fixture.catalog,
    structuralInputs,
    bundles,
  )
}

function removeBundleRuleAndTrace(
  bundle: Mutable<AiChartD1K0P1Bundle>,
  ruleId: string,
): void {
  assert.equal(
    bundle.selectedRules.some((rule) => rule.ruleId === ruleId),
    true,
  )
  bundle.selectedRules = bundle.selectedRules.filter(
    (rule) => rule.ruleId !== ruleId,
  )
  bundle.selectionTrace = bundle.selectionTrace.filter(
    (trace) => trace.ruleId !== ruleId,
  )
}

function sourceFilesUnder(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? sourceFilesUnder(path) : [path]
  })
}

function withFingerprint(value: Mutable<AiChartD1P1ModelInput>): void {
  const payload = structuredClone(value) as unknown as Record<string, unknown>
  delete payload.inputFingerprint
  value.inputFingerprint = createAiChartD1P1ModelInputFingerprint(
    payload as AiChartD1P1ModelInputWithoutFingerprint,
  )
}

function parseWithMutatedBundleTrace(
  fixture: ModelInputFixture,
  mutate: (
    bundle: Mutable<AiChartD1K0P1Bundle>,
    model: Mutable<AiChartD1P1ModelInput>,
  ) => void,
  index = 0,
): void {
  const bundle = structuredClone(
    fixture.bundles[index],
  ) as Mutable<AiChartD1K0P1Bundle>
  const model = structuredClone(
    fixture.modelInputs[index],
  ) as Mutable<AiChartD1P1ModelInput>
  mutate(bundle, model)
  withFingerprint(model)
  assertInvalid(() =>
    parseAiChartD1P1ModelInput(
      model,
      fixture.catalog,
      fixture.structuralInputs[index],
      bundle,
    ),
  )
}

async function run() {
  const fixture = await createModelInputFixture('binding')
  const { modelInputs, structuralInputs, bundles, catalog } = fixture

  check('fixed builder creates exactly twelve Model Inputs', () => {
    assert.equal(modelInputs.length, 12)
  })
  check('target indices remain canonical zero through eleven', () => {
    modelInputs.forEach((input, index) => {
      assert.equal(structuralInputs[index].targetPalace.index, index)
    })
  })
  check('all twelve palace ids are complete and unique', () => {
    assert.deepEqual(
      modelInputs.map((input) => input.targetPalaceId),
      AI_CHART_D1_PALACE_IDENTITIES.map((identity) => identity.palaceId),
    )
    assert.equal(new Set(modelInputs.map((input) => input.targetPalaceId)).size, 12)
  })
  check('all call ids are unique', () => {
    assert.equal(new Set(modelInputs.map((input) => input.callId)).size, 12)
  })
  check('all chart ids are identical', () => {
    assert.equal(new Set(modelInputs.map((input) => input.chartId)).size, 1)
  })
  check('all run ids are identical', () => {
    assert.equal(new Set(modelInputs.map((input) => input.runId)).size, 1)
  })
  check('all bundle ids are unique', () => {
    assert.equal(new Set(modelInputs.map((input) => input.bundleId)).size, 12)
  })
  check('structural and bundle indices map one-to-one', () => {
    modelInputs.forEach((input, index) => {
      assert.equal(input.callId, structuralInputs[index].callId)
      assert.equal(input.bundleId, bundles[index].bundleId)
      assert.equal(input.targetPalaceId, bundles[index].targetPalaceId)
    })
  })
  check('fixed-12 deterministic rebuild preserves supplied bundle ids by index', () => {
    const rebuilt = buildWithSources(fixture)
    assert.deepEqual(
      rebuilt.map((input) => input.bundleId),
      bundles.map((bundle) => bundle.bundleId),
    )
  })
  check('individual parser accepts the exact deterministic bundle', () => {
    assert.deepEqual(
      parseFixtureModelInput(fixture, 0, modelInputs[0]),
      modelInputs[0],
    )
  })
  check('Catalog may remain partial when all current bundles are ready', () => {
    assert.equal(catalog.readiness, 'partial')
    assert.equal(bundles.every((bundle) => bundle.knowledgeStatus === 'ready'), true)
    assert.equal(modelInputs.length, 12)
  })
  check('each Model Input is ready but remains non-callable', () => {
    for (const input of modelInputs) {
      assert.equal(input.knowledgeStatus, 'ready')
      assert.equal(input.openAiCallable, false)
      assert.equal(input.promptStatus, 'prompt_builder_required')
      assert.equal(input.promptVersion, null)
    }
  })

  check('Structural Context is exact stable equal to its source fields', () => {
    modelInputs.forEach((input, index) => {
      assert.equal(
        stableAiChartD1P1ModelInputEqual(input.structuralContext, {
          targetPalace: structuralInputs[index].targetPalace,
          oppositePalace: structuralInputs[index].oppositePalace,
          hiddenCombinationPalace:
            structuralInputs[index].hiddenCombinationPalace,
          otherTrinePalaces: structuralInputs[index].otherTrinePalaces,
          targetGlobalScan: structuralInputs[index].targetGlobalScan,
        }),
        true,
      )
    })
  })
  check('Structural Context is a deep copy rather than source aliasing', () => {
    assert.notEqual(modelInputs[0].structuralContext.targetPalace, structuralInputs[0].targetPalace)
    assert.notEqual(
      modelInputs[0].structuralContext.targetPalace.canonicalMajorStars,
      structuralInputs[0].targetPalace.canonicalMajorStars,
    )
    assert.notEqual(modelInputs[0].warnings, structuralInputs[0].warnings)
  })
  check('Structural Context keeps exact star names instead of starName projection', () => {
    const star = modelInputs[0].structuralContext.targetPalace.canonicalMajorStars[0]
    assert.equal(Object.prototype.hasOwnProperty.call(star, 'name'), true)
    assert.equal(Object.prototype.hasOwnProperty.call(star, 'starName'), false)
    assert.equal(star.name, structuralInputs[0].targetPalace.canonicalMajorStars[0].name)
  })
  check('other trine order is preserved exactly', () => {
    assert.deepEqual(
      modelInputs[0].structuralContext.otherTrinePalaces.map(
        (palace) => palace.palaceId,
      ),
      structuralInputs[0].otherTrinePalaces.map((palace) => palace.palaceId),
    )
  })
  check('global scan and signals are exact copies', () => {
    assert.deepEqual(
      modelInputs[0].structuralContext.targetGlobalScan,
      structuralInputs[0].targetGlobalScan,
    )
    assert.notEqual(
      modelInputs[0].structuralContext.targetGlobalScan,
      structuralInputs[0].targetGlobalScan,
    )
  })
  check('structural status and warnings remain source exact', () => {
    modelInputs.forEach((input, index) => {
      assert.equal(input.structuralStatus, structuralInputs[index].structuralStatus)
      assert.deepEqual(input.warnings, structuralInputs[index].warnings)
    })
  })

  check('every selected rule is projected without omission', () => {
    modelInputs.forEach((input, index) => {
      assert.deepEqual(
        input.knowledgeContext.rules.map((rule) => rule.ruleId),
        bundles[index].selectedRules.map((rule) => rule.ruleId),
      )
    })
  })
  check('Model Rule projection preserves exact inference fields', () => {
    const projected = modelInputs[0].knowledgeContext.rules[0]
    const source = bundles[0].selectedRules[0]
    assert.deepEqual(projected, {
      ruleId: source.ruleId,
      kind: source.kind,
      title: source.title,
      content: source.content,
      contentSha256: source.contentSha256,
      ruleStatus: source.ruleStatus,
      sourceAuthority: source.sourceAuthority,
      priority: source.priority,
      d1Safety: source.d1Safety,
    })
  })
  check('Model Rule projection excludes source metadata', () => {
    const keys = allObjectKeys(modelInputs[0].knowledgeContext.rules)
    for (const key of [
      'sourceFile',
      'sourceFileSha256',
      'sourceLocator',
      'appliesTo',
      'selectionTags',
    ]) {
      assert.equal(keys.has(key), false)
    }
  })
  check('meanings are exact deep copies in source order', () => {
    assert.deepEqual(modelInputs[0].knowledgeContext.meanings, bundles[0].selectedMeanings)
    assert.notEqual(modelInputs[0].knowledgeContext.meanings, bundles[0].selectedMeanings)
  })
  check('selection trace is an exact deep copy in source order', () => {
    assert.deepEqual(modelInputs[0].knowledgeContext.selectionTrace, bundles[0].selectionTrace)
    assert.notEqual(modelInputs[0].knowledgeContext.selectionTrace, bundles[0].selectionTrace)
  })
  check('Model Input excludes complete wrappers and missing knowledge', () => {
    const keys = allObjectKeys(modelInputs)
    for (const key of [
      'missingRequirements',
      'readiness',
      'doubleStarInventory',
      'mutagenInventory',
      'palaces',
      'knowledgeBundleId',
    ]) {
      assert.equal(keys.has(key), false)
    }
  })

  check('repeated build is deterministic including fingerprints', () => {
    assert.deepEqual(buildWithSources(fixture), modelInputs)
  })
  check('caller mutations cannot change a built Model Input', () => {
    const mutableStructures = structuredClone(
      structuralInputs,
    ) as Mutable<typeof structuralInputs>
    const mutableBundles = structuredClone(bundles) as Mutable<typeof bundles>
    const isolated = buildWithSources(fixture, mutableStructures, mutableBundles)
    mutableStructures[0].callId = 'call:changed'
    mutableBundles[0].bundleId = 'bundle:changed'
    assert.equal(isolated[0].callId, modelInputs[0].callId)
    assert.equal(isolated[0].bundleId, modelInputs[0].bundleId)
  })
  check('authenticated Model Inputs share no mutable supplied bundle references', () => {
    const suppliedBundles = structuredClone(
      bundles,
    ) as Mutable<AiChartD1K0P1Bundle>[]
    const authenticated = buildWithSources(
      fixture,
      structuralInputs,
      suppliedBundles,
    )
    const originalTitle = authenticated[0].knowledgeContext.rules[0].title
    suppliedBundles[0].selectedRules[0].title = 'changed-after-build'
    suppliedBundles[0].selectionTrace[0].structuralReference =
      'p1:view:changed-after-build'
    assert.equal(authenticated[0].knowledgeContext.rules[0].title, originalTitle)
    assert.notEqual(
      authenticated[0].knowledgeContext.selectionTrace[0].structuralReference,
      'p1:view:changed-after-build',
    )
  })
  check('output graph is recursively frozen', () => {
    assert.equal(Object.isFrozen(modelInputs), true)
    assert.equal(Object.isFrozen(modelInputs[0]), true)
    assert.equal(Object.isFrozen(modelInputs[0].structuralContext.targetPalace), true)
    assert.equal(Object.isFrozen(modelInputs[0].knowledgeContext.selectionTrace[0]), true)
  })

  check('wrong Structural Input count is invalid', () => {
    assertInvalid(() => buildWithSources(fixture, structuralInputs.slice(0, 11)))
  })
  check('wrong Knowledge Bundle count is invalid', () => {
    assertInvalid(() => buildWithSources(fixture, structuralInputs, bundles.slice(0, 11)))
  })
  check('reordered Structural Inputs are invalid', () => {
    const reordered = [...structuralInputs]
    ;[reordered[0], reordered[1]] = [reordered[1], reordered[0]]
    assertInvalid(() => buildWithSources(fixture, reordered))
  })
  check('reordered Knowledge Bundles are invalid', () => {
    const reordered = [...bundles]
    ;[reordered[0], reordered[1]] = [reordered[1], reordered[0]]
    assertInvalid(() => buildWithSources(fixture, structuralInputs, reordered))
  })
  check('mixed Structural chart identity is invalid', () => {
    const mixed = structuredClone(structuralInputs) as Mutable<typeof structuralInputs>
    mixed[1].chartId = 'chart:other'
    assertInvalid(() => buildWithSources(fixture, mixed))
  })
  check('mixed Structural run identity is invalid', () => {
    const mixed = structuredClone(structuralInputs) as Mutable<typeof structuralInputs>
    mixed[1].runId = 'run:other'
    assertInvalid(() => buildWithSources(fixture, mixed))
  })
  check('mixed Bundle chart identity is invalid', () => {
    const mixed = structuredClone(bundles) as Mutable<typeof bundles>
    mixed[1].chartId = 'chart:other'
    assertInvalid(() => buildWithSources(fixture, structuralInputs, mixed))
  })
  check('mixed Bundle run identity is invalid', () => {
    const mixed = structuredClone(bundles) as Mutable<typeof bundles>
    mixed[1].runId = 'run:other'
    assertInvalid(() => buildWithSources(fixture, structuralInputs, mixed))
  })
  check('call id mismatch is invalid', () => {
    const mixed = structuredClone(bundles) as Mutable<typeof bundles>
    mixed[0].callId = 'call:mismatch'
    assertInvalid(() => buildWithSources(fixture, structuralInputs, mixed))
  })
  check('target palace mismatch is invalid', () => {
    const mixed = structuredClone(bundles) as Mutable<typeof bundles>
    mixed[0].targetPalaceId = bundles[1].targetPalaceId
    assertInvalid(() => buildWithSources(fixture, structuralInputs, mixed))
  })
  check('Catalog fingerprint mismatch is invalid', () => {
    const mixed = structuredClone(bundles) as Mutable<typeof bundles>
    mixed[0].catalogFingerprint = 'a'.repeat(64)
    assertInvalid(() => buildWithSources(fixture, structuralInputs, mixed))
  })
  check('Manifest SHA mismatch is invalid', () => {
    const mixed = structuredClone(bundles) as Mutable<typeof bundles>
    mixed[0].sourceManifestSha256 = 'a'.repeat(64)
    assertInvalid(() => buildWithSources(fixture, structuralInputs, mixed))
  })
  check('duplicate call ids are invalid', () => {
    const mixed = structuredClone(structuralInputs) as Mutable<typeof structuralInputs>
    mixed[1].callId = mixed[0].callId
    assertInvalid(() => buildWithSources(fixture, mixed))
  })
  check('duplicate bundle ids are invalid', () => {
    const mixed = structuredClone(bundles) as Mutable<typeof bundles>
    mixed[1].bundleId = mixed[0].bundleId
    assertInvalid(() => buildWithSources(fixture, structuralInputs, mixed))
  })

  mutateModelAndReject(fixture, 'modified target palace is source-rejected', (value) => {
    value.structuralContext.targetPalace.isBodyPalace =
      !value.structuralContext.targetPalace.isBodyPalace
  })
  mutateModelAndReject(fixture, 'modified opposite palace is source-rejected', (value) => {
    value.structuralContext.oppositePalace.isBodyPalace =
      !value.structuralContext.oppositePalace.isBodyPalace
  })
  mutateModelAndReject(fixture, 'modified hidden palace is source-rejected', (value) => {
    value.structuralContext.hiddenCombinationPalace.isBodyPalace =
      !value.structuralContext.hiddenCombinationPalace.isBodyPalace
  })
  mutateModelAndReject(fixture, 'modified trine order is source-rejected', (value) => {
    value.structuralContext.otherTrinePalaces.reverse()
  })
  mutateModelAndReject(fixture, 'modified scan count is source-rejected', (value) => {
    value.structuralContext.targetGlobalScan.totalRelevantCount += 1
  })
  mutateModelAndReject(fixture, 'modified signal is source-rejected', (value) => {
    const scan = value.structuralContext.targetGlobalScan
    const signal = [
      ...scan.directSignals,
      ...scan.oppositeSignals,
      ...scan.hiddenCombinationSignals,
      ...scan.trineSignals,
    ][0]
    assert.ok(signal)
    signal.starName = 'changed'
  })
  mutateModelAndReject(fixture, 'modified borrow status is source-rejected', (value) => {
    value.structuralContext.targetPalace.borrowStatus = 'blocked_by_local_star'
  })
  mutateModelAndReject(fixture, 'missing selected rule is source-rejected', (value) => {
    value.knowledgeContext.rules.splice(0, 1)
  })
  check('individual parser rejects synchronized major-rule omission attack', () => {
    const bundle = structuredClone(
      bundles[0],
    ) as Mutable<AiChartD1K0P1Bundle>
    const model = structuredClone(
      modelInputs[0],
    ) as Mutable<AiChartD1P1ModelInput>
    const majorTrace = bundle.selectionTrace.find(
      (trace) => trace.reason === 'major_star_present',
    )
    assert.ok(majorTrace)
    removeBundleRuleAndTrace(bundle, majorTrace.ruleId)
    model.knowledgeContext.rules = model.knowledgeContext.rules.filter(
      (rule) => rule.ruleId !== majorTrace.ruleId,
    )
    model.knowledgeContext.selectionTrace =
      model.knowledgeContext.selectionTrace.filter(
        (trace) => trace.ruleId !== majorTrace.ruleId,
      )
    recalculateModelInputFingerprint(model)
    try {
      parseAiChartD1P1ModelInput(
        model,
        catalog,
        structuralInputs[0],
        bundle,
      )
      assert.fail('expected deterministic K0 completeness rejection')
    } catch (error) {
      assert.equal(
        (error as Error).message,
        AI_CHART_D1_P1_MODEL_INPUT_INVALID,
      )
      assert.doesNotMatch(
        String(error),
        /rule:|紫微|palace:|call:|index/u,
      )
    }
  })
  check('fixed-12 builder rejects a synchronized omitted rule and trace', () => {
    const suppliedBundles = structuredClone(
      bundles,
    ) as Mutable<AiChartD1K0P1Bundle>[]
    const majorTrace = suppliedBundles[0].selectionTrace.find(
      (trace) => trace.reason === 'major_star_present',
    )
    assert.ok(majorTrace)
    removeBundleRuleAndTrace(suppliedBundles[0], majorTrace.ruleId)
    assertInvalid(() =>
      buildWithSources(fixture, structuralInputs, suppliedBundles),
    )
  })
  mutateModelAndReject(fixture, 'unselected Catalog rule addition is source-rejected', (value) => {
    const selectedRuleIds = new Set(
      value.knowledgeContext.rules.map((rule) => rule.ruleId),
    )
    const unselectedRule = catalog.rules.find(
      (rule) => !selectedRuleIds.has(rule.ruleId),
    )
    assert.ok(unselectedRule)
    value.knowledgeContext.rules.push({
      ruleId: unselectedRule.ruleId,
      kind: unselectedRule.kind,
      title: unselectedRule.title,
      content: unselectedRule.content,
      contentSha256: unselectedRule.contentSha256,
      ruleStatus: unselectedRule.ruleStatus,
      sourceAuthority: unselectedRule.sourceAuthority,
      priority: unselectedRule.priority,
      d1Safety: unselectedRule.d1Safety,
    })
    value.knowledgeContext.rules.sort(
      (left, right) =>
        left.priority - right.priority ||
        (left.ruleId < right.ruleId ? -1 : left.ruleId > right.ruleId ? 1 : 0),
    )
  })
  mutateModelAndReject(fixture, 'duplicate rule ID is rejected', (value) => {
    value.knowledgeContext.rules.push(
      structuredClone(value.knowledgeContext.rules[0]),
    )
    value.knowledgeContext.rules.sort(
      (left, right) =>
        left.priority - right.priority ||
        (left.ruleId < right.ruleId ? -1 : left.ruleId > right.ruleId ? 1 : 0),
    )
  })
  mutateModelAndReject(fixture, 'reordered selected rules are source-rejected', (value) => {
    ;[value.knowledgeContext.rules[0], value.knowledgeContext.rules[1]] = [
      value.knowledgeContext.rules[1],
      value.knowledgeContext.rules[0],
    ]
  })
  mutateModelAndReject(fixture, 'modified rule authority is source-rejected', (value) => {
    value.knowledgeContext.rules[0].sourceAuthority = 'working_inference'
  })
  mutateModelAndReject(fixture, 'modified rule priority is source-rejected', (value) => {
    value.knowledgeContext.rules[0].priority += 1
  })
  mutateModelAndReject(fixture, 'missing meaning is source-rejected', (value) => {
    value.knowledgeContext.meanings.splice(0, 1)
  })
  mutateModelAndReject(fixture, 'duplicate meaning reference is rejected', (value) => {
    value.knowledgeContext.meanings.push(
      structuredClone(value.knowledgeContext.meanings[0]),
    )
  })
  mutateModelAndReject(fixture, 'reordered meanings are source-rejected', (value) => {
    ;[value.knowledgeContext.meanings[0], value.knowledgeContext.meanings[1]] = [
      value.knowledgeContext.meanings[1],
      value.knowledgeContext.meanings[0],
    ]
  })
  mutateModelAndReject(fixture, 'reordered trace is source-rejected', (value) => {
    ;[
      value.knowledgeContext.selectionTrace[0],
      value.knowledgeContext.selectionTrace[1],
    ] = [
      value.knowledgeContext.selectionTrace[1],
      value.knowledgeContext.selectionTrace[0],
    ]
  })
  mutateModelAndReject(fixture, 'duplicate selection trace is rejected', (value) => {
    value.knowledgeContext.selectionTrace.push(
      structuredClone(value.knowledgeContext.selectionTrace[0]),
    )
  })
  mutateModelAndReject(fixture, 'structural status cannot be upgraded', (value) => {
    value.structuralStatus = value.structuralStatus === 'ready' ? 'partial' : 'ready'
  })
  mutateModelAndReject(fixture, 'structural warnings cannot be deleted', (value) => {
    value.warnings.splice(0)
    value.warnings.push({
      warningId: 'warning:fake',
      code: 'natal_mutagen_missing',
      palaceId: null,
      placementIds: [],
    })
  })

  check('trace placement must bind to the Structural Context', () => {
    parseWithMutatedBundleTrace(fixture, (bundle, model) => {
      const index = bundle.selectionTrace.findIndex(
        (trace) => trace.reason === 'major_star_present',
      )
      assert.notEqual(index, -1)
      bundle.selectionTrace[index].placementId = 'placement:other'
      model.knowledgeContext.selectionTrace[index].placementId = 'placement:other'
    })
  })
  check('major trace mutagen metadata must bind to the same placement', () => {
    parseWithMutatedBundleTrace(fixture, (bundle, model) => {
      const index = bundle.selectionTrace.findIndex(
        (trace) =>
          trace.reason === 'major_star_present' &&
          trace.mutagenType !== null,
      )
      assert.notEqual(index, -1)
      bundle.selectionTrace[index].mutagenType = '化權'
      model.knowledgeContext.selectionTrace[index].mutagenType = '化權'
    })
  })
  check('supporting trace cannot fabricate mutagen metadata', () => {
    parseWithMutatedBundleTrace(fixture, (bundle, model) => {
      const index = bundle.selectionTrace.findIndex(
        (trace) => trace.reason === 'supporting_star_present',
      )
      assert.notEqual(index, -1)
      bundle.selectionTrace[index].mutagenType = '化祿'
      model.knowledgeContext.selectionTrace[index].mutagenType = '化祿'
    })
  })
  check('supporting trace placement must exist in modeled supporting stars', () => {
    parseWithMutatedBundleTrace(fixture, (bundle, model) => {
      const index = bundle.selectionTrace.findIndex(
        (trace) => trace.reason === 'supporting_star_present',
      )
      assert.notEqual(index, -1)
      bundle.selectionTrace[index].placementId = 'placement:supporting:other'
      model.knowledgeContext.selectionTrace[index].placementId =
        'placement:supporting:other'
    })
  })
  check('mutagen trace placement must bind star and mutagen together', () => {
    parseWithMutatedBundleTrace(fixture, (bundle, model) => {
      const index = bundle.selectionTrace.findIndex(
        (trace) => trace.reason === 'natal_mutagen_present',
      )
      assert.notEqual(index, -1)
      bundle.selectionTrace[index].placementId = 'placement:mutagen:other'
      model.knowledgeContext.selectionTrace[index].placementId =
        'placement:mutagen:other'
    })
  })
  check('trace palace role must bind to its Structural Context palace', () => {
    parseWithMutatedBundleTrace(fixture, (bundle, model) => {
      const index = bundle.selectionTrace.findIndex(
        (trace) => trace.reason === 'major_star_present',
      )
      assert.notEqual(index, -1)
      bundle.selectionTrace[index].palaceRole = 'opposite'
      bundle.selectionTrace[index].palaceId = structuralInputs[0].oppositePalace.palaceId
      bundle.selectionTrace[index].structuralReference = 'p1:view:opposite'
      model.knowledgeContext.selectionTrace[index] = structuredClone(
        bundle.selectionTrace[index],
      )
    })
  })
  check('relationship trace is restricted to the target relationship context', () => {
    parseWithMutatedBundleTrace(fixture, (bundle, model) => {
      const index = bundle.selectionTrace.findIndex(
        (trace) => trace.reason === 'relationship_rule',
      )
      assert.notEqual(index, -1)
      bundle.selectionTrace[index].palaceRole = 'opposite'
      bundle.selectionTrace[index].palaceId = structuralInputs[0].oppositePalace.palaceId
      bundle.selectionTrace[index].structuralReference = 'p1:view:opposite'
      model.knowledgeContext.selectionTrace[index] = structuredClone(
        bundle.selectionTrace[index],
      )
    })
  })
  check('palace meaning rule must bind to the role palace id', () => {
    parseWithMutatedBundleTrace(fixture, (bundle, model) => {
      const index = bundle.selectionTrace.findIndex(
        (trace) => trace.reason === 'palace_meaning',
      )
      assert.notEqual(index, -1)
      bundle.selectionTrace[index].palaceRole = 'opposite'
      bundle.selectionTrace[index].palaceId = structuralInputs[0].oppositePalace.palaceId
      bundle.selectionTrace[index].structuralReference = 'p1:view:opposite'
      model.knowledgeContext.selectionTrace[index] = structuredClone(
        bundle.selectionTrace[index],
      )
    })
  })
  check('four-horse trace is target-only and requires a four-horse palace', () => {
    const fourHorseIndex = structuralInputs.findIndex(
      (input) => input.targetPalace.isFourHorsePalace,
    )
    assert.notEqual(fourHorseIndex, -1)
    parseWithMutatedBundleTrace(
      fixture,
      (bundle, model) => {
        const traceIndex = bundle.selectionTrace.findIndex(
          (trace) => trace.reason === 'four_horse_target',
        )
        assert.notEqual(traceIndex, -1)
        bundle.selectionTrace[traceIndex].palaceRole = 'opposite'
        bundle.selectionTrace[traceIndex].palaceId =
          structuralInputs[fourHorseIndex].oppositePalace.palaceId
        bundle.selectionTrace[traceIndex].structuralReference =
          'p1:view:opposite'
        model.knowledgeContext.selectionTrace[traceIndex] = structuredClone(
          bundle.selectionTrace[traceIndex],
        )
      },
      fourHorseIndex,
    )
  })
  check('required common trace cannot claim palace or placement fields', () => {
    parseWithMutatedBundleTrace(fixture, (bundle, model) => {
      const index = bundle.selectionTrace.findIndex(
        (trace) => trace.reason === 'required_common_rule',
      )
      assert.notEqual(index, -1)
      bundle.selectionTrace[index].palaceRole = 'target'
      bundle.selectionTrace[index].palaceId = structuralInputs[0].targetPalace.palaceId
      bundle.selectionTrace[index].structuralReference = 'p1:view:target'
      model.knowledgeContext.selectionTrace[index] = structuredClone(
        bundle.selectionTrace[index],
      )
    })
  })
  mutateModelAndReject(
    fixture,
    'meaning role must bind to the corresponding Structural Palace',
    (value) => {
      value.knowledgeContext.meanings[0].palaceId =
        structuralInputs[0].oppositePalace.palaceId
    },
  )

  const partialSnapshot = completeModelInputSnapshot()
  const partialPalaces = partialSnapshot.palaces as MutableRecord[]
  partialPalaces[0].majorStars = [
    { name: '巨門', type: 'major', scope: 'origin' },
    { name: '太陽', type: 'major', scope: 'origin' },
  ]
  const partialStructures = createStructuralInputs(partialSnapshot, 'partial-bundle')
  const partialBundles = buildAiChartD1K0P1KnowledgeBundles(
    catalog,
    partialStructures,
    { bundleIds: bundleIds('partial-bundle') },
  )
  check('first partial bundle atomically blocks the whole batch', () => {
    assert.equal(partialBundles[0].knowledgeStatus, 'partial')
    assertNotReady(() =>
      buildAiChartD1P1ModelInputs(catalog, partialStructures, partialBundles),
    )
  })
  check('a later partial bundle atomically blocks the whole batch', () => {
    const lastPartialIndex = partialBundles.findLastIndex(
      (bundle) => bundle.knowledgeStatus === 'partial',
    )
    assert.notEqual(lastPartialIndex, -1)
    assertNotReady(() =>
      buildAiChartD1P1ModelInputs(catalog, partialStructures, partialBundles),
    )
  })
  check('multiple partial bundles never return a ready subset', () => {
    assert.equal(
      partialBundles.filter((bundle) => bundle.knowledgeStatus === 'partial').length > 1,
      true,
    )
    let returned: readonly AiChartD1P1ModelInput[] | undefined
    assertNotReady(() => {
      returned = buildAiChartD1P1ModelInputs(
        catalog,
        partialStructures,
        partialBundles,
      )
    })
    assert.equal(returned, undefined)
  })
  check('partial bundle cannot be replaced by empty knowledge context', () => {
    assertNotReady(() =>
      parseAiChartD1P1ModelInput(
        modelInputs[0],
        catalog,
        partialStructures[0],
        partialBundles[0],
      ),
    )
  })
  check('ready spoof over deterministic partial is invalid before readiness', () => {
    const spoofedBundles = structuredClone(
      partialBundles,
    ) as Mutable<AiChartD1K0P1Bundle>[]
    const partialIndex = spoofedBundles.findIndex(
      (bundle) => bundle.knowledgeStatus === 'partial',
    )
    assert.notEqual(partialIndex, -1)
    spoofedBundles[partialIndex].missingRequirements = []
    spoofedBundles[partialIndex].knowledgeStatus = 'ready'
    spoofedBundles[partialIndex].warnings = []
    assertInvalid(() =>
      buildAiChartD1P1ModelInputs(
        catalog,
        partialStructures,
        spoofedBundles,
      ),
    )
    assertInvalid(() =>
      parseAiChartD1P1ModelInput(
        modelInputs[0],
        catalog,
        partialStructures[partialIndex],
        spoofedBundles[partialIndex],
      ),
    )
  })
  check('exact deterministic partial remains not-ready after authenticity', () => {
    const partialIndex = partialBundles.findIndex(
      (bundle) => bundle.knowledgeStatus === 'partial',
    )
    assert.notEqual(partialIndex, -1)
    assertNotReady(() =>
      parseAiChartD1P1ModelInput(
        modelInputs[0],
        catalog,
        partialStructures[partialIndex],
        partialBundles[partialIndex],
      ),
    )
  })
  check('not-ready error contains no id or missing reason', () => {
    try {
      buildAiChartD1P1ModelInputs(catalog, partialStructures, partialBundles)
      assert.fail('expected not ready')
    } catch (error) {
      assert.equal((error as Error).message, AI_CHART_D1_P1_MODEL_INPUT_NOT_READY)
      assert.doesNotMatch(
        String(error),
        /chart:|call:|palace:|missing_|double|紫微|七殺/u,
      )
    }
  })
  check('invalid and not-ready failures remain distinguishable', () => {
    assertInvalid(() =>
      buildAiChartD1P1ModelInputs(catalog, structuralInputs.slice(0, 11), bundles),
    )
    assertNotReady(() =>
      buildAiChartD1P1ModelInputs(catalog, partialStructures, partialBundles),
    )
  })

  const structuralPartialSnapshot = completeModelInputSnapshot()
  const structuralPartialPalaces = structuralPartialSnapshot.palaces as MutableRecord[]
  structuralPartialPalaces[3].majorStars = [
    { name: '太陽', type: 'major', scope: 'origin' },
  ]
  const structuralPartialFixture = await createModelInputFixture(
    'structural-partial',
    structuralPartialSnapshot,
  )
  check('Structural partial with ready bundles may build Model Inputs', () => {
    assert.equal(
      structuralPartialFixture.structuralInputs.some(
        (input) => input.structuralStatus === 'partial',
      ),
      true,
    )
    assert.equal(
      structuralPartialFixture.bundles.every(
        (bundle) => bundle.knowledgeStatus === 'ready',
      ),
      true,
    )
    assert.equal(structuralPartialFixture.modelInputs.length, 12)
  })
  check('Structural partial status and warnings are preserved unchanged', () => {
    structuralPartialFixture.modelInputs.forEach((input, index) => {
      assert.equal(
        input.structuralStatus,
        structuralPartialFixture.structuralInputs[index].structuralStatus,
      )
      assert.deepEqual(
        input.warnings,
        structuralPartialFixture.structuralInputs[index].warnings,
      )
    })
  })

  const borrowSnapshot = completeModelInputSnapshot()
  const borrowPalaces = borrowSnapshot.palaces as MutableRecord[]
  borrowPalaces[0].majorStars = []
  borrowPalaces[0].minorStars = []
  const borrowFixture = await createModelInputFixture('borrowed-name', borrowSnapshot)
  check('borrowed star name remains exact and source-bound', () => {
    const source = borrowFixture.structuralInputs[0].targetPalace.borrowedMajorStars[0]
    const model = borrowFixture.modelInputs[0].structuralContext.targetPalace
      .borrowedMajorStars[0]
    assert.ok(source)
    assert.equal(model.name, source.name)
    assert.equal(Object.prototype.hasOwnProperty.call(model, 'starName'), false)
  })
  mutateModelAndReject(
    borrowFixture,
    'borrowed placement mutation is source-rejected',
    (value) => {
      value.structuralContext.targetPalace.borrowedMajorStars[0].borrowedPlacementId =
        'placement:borrowed:changed'
    },
  )

  const doubleSnapshot = completeModelInputSnapshot()
  const doublePalaces = doubleSnapshot.palaces as MutableRecord[]
  doublePalaces[0].majorStars = [
    { name: '廉貞', type: 'major', scope: 'origin', mutagen: '化祿' },
    { name: '七殺', type: 'major', scope: 'origin' },
  ]
  const doubleFixture = await createModelInputFixture(
    'double-binding',
    doubleSnapshot,
  )
  check('double-star trace must bind to a canonical pair in the role palace', () => {
    parseWithMutatedBundleTrace(doubleFixture, (bundle, model) => {
      const index = bundle.selectionTrace.findIndex(
        (trace) => trace.reason === 'double_star_present',
      )
      assert.notEqual(index, -1)
      bundle.selectionTrace[index].palaceRole = 'opposite'
      bundle.selectionTrace[index].palaceId =
        doubleFixture.structuralInputs[0].oppositePalace.palaceId
      bundle.selectionTrace[index].structuralReference = 'p1:view:opposite'
      model.knowledgeContext.selectionTrace[index] = structuredClone(
        bundle.selectionTrace[index],
      )
    })
  })

  const blockedSnapshot = completeModelInputSnapshot()
  const blockedPalaces = blockedSnapshot.palaces as MutableRecord[]
  blockedPalaces[0].majorStars = []
  blockedPalaces[0].minorStars = [
    { name: '文昌', type: AI_CHART_D1_MODELED_SUPPORTING_STARS.文昌, scope: 'origin' },
  ]
  const blockedFixture = await createModelInputFixture('blocked-empty', blockedSnapshot)
  check('blocked empty palace binds only the blocker rule', () => {
    const traces = blockedFixture.modelInputs[0].knowledgeContext.selectionTrace.filter(
      (trace) => trace.reason === 'empty_palace_rule' && trace.palaceRole === 'target',
    )
    assert.deepEqual(traces.map((trace) => trace.ruleId), [
      'rule:structure:empty-palace-blockers',
    ])
  })

  const lucunSnapshot = completeModelInputSnapshot()
  const lucunPalaces = lucunSnapshot.palaces as MutableRecord[]
  lucunPalaces[0].majorStars = []
  lucunPalaces[0].minorStars = [
    { name: '祿存', type: AI_CHART_D1_MODELED_SUPPORTING_STARS.祿存, scope: 'origin' },
  ]
  const lucunFixture = await createModelInputFixture('lucun-empty', lucunSnapshot)
  check('eligible empty palace includes lucun rule only with actual lucun', () => {
    const ids = new Set(
      lucunFixture.modelInputs[0].knowledgeContext.selectionTrace
        .filter((trace) => trace.reason === 'empty_palace_rule')
        .map((trace) => trace.ruleId),
    )
    assert.equal(ids.has('rule:structure:empty-palace-borrow'), true)
    assert.equal(ids.has('rule:structure:empty-palace-opposite-only'), true)
    assert.equal(ids.has('rule:structure:empty-palace-lucun'), true)
  })

  const oppositeEmptySnapshot = completeModelInputSnapshot()
  const oppositeEmptyPalaces = oppositeEmptySnapshot.palaces as MutableRecord[]
  oppositeEmptyPalaces[0].majorStars = []
  oppositeEmptyPalaces[0].minorStars = []
  oppositeEmptyPalaces[6].majorStars = []
  const oppositeStructures = createStructuralInputs(
    oppositeEmptySnapshot,
    'opposite-empty-model',
  )
  const oppositeBundles = buildAiChartD1K0P1KnowledgeBundles(
    catalog,
    oppositeStructures,
    { bundleIds: bundleIds('opposite-empty-model') },
  )
  check('opposite_empty cannot create any Model Input', () => {
    assert.equal(oppositeStructures[0].targetPalace.borrowStatus, 'opposite_empty')
    assert.equal(oppositeBundles[0].knowledgeStatus, 'partial')
    assertNotReady(() =>
      buildAiChartD1P1ModelInputs(catalog, oppositeStructures, oppositeBundles),
    )
  })

  check('Prompt Package builder, Report pipeline, and Report OpenAI runtime are the production Model Input consumers', () => {
    const repositoryRoot = process.cwd()
    const sourceFiles = sourceFilesUnder(join(repositoryRoot, 'src'))
    const consumers = sourceFiles
      .filter((path) => path.endsWith('.ts') || path.endsWith('.tsx'))
      .filter((path) =>
        readFileSync(path, 'utf8').includes('buildAiChartD1P1ModelInputs'),
      )
      .map((path) => relative(repositoryRoot, path))
      .filter(
        (path) =>
          !path.endsWith('d1P1ModelInputBindings.ts') &&
          !path.endsWith('d1P1ModelInputBindings.test.ts') &&
          !path.endsWith('d1P1ModelInputTestSupport.ts'),
      )
    assert.deepEqual(consumers, [
      'src/lib/ai-chart/d1P1PromptPackageBuilder.ts',
      'src/lib/ai-chart/d1P1ReportOpenAiRuntime.server.ts',
      'src/lib/ai-chart/reportGenerationPipeline.ts',
    ])
  })
  check('src/app does not import P1 Model Input modules', () => {
    const appFiles = sourceFilesUnder(join(process.cwd(), 'src', 'app'))
    assert.equal(
      appFiles.some((path) =>
        /d1P1ModelInput(?:Bindings|Contracts)/u.test(readFileSync(path, 'utf8')),
      ),
      false,
    )
  })
  check('OpenAI Adapter does not import P1 Model Input modules', () => {
    for (const path of [
      'src/lib/ai-chart/openAiResponses.ts',
      'src/lib/ai-chart/openAiResponses.server.ts',
    ]) {
      assert.doesNotMatch(
        readFileSync(join(process.cwd(), path), 'utf8'),
        /d1P1ModelInput/u,
      )
    }
  })
  check('Model Input contains no Prompt or OpenAI request key', () => {
    const keys = allObjectKeys(modelInputs)
    for (const key of [
      'messages',
      'input',
      'instructions',
      'system',
      'developer',
      'user',
      'model',
      'response_format',
      'temperature',
      'max_output_tokens',
      'tools',
      'tool_choice',
      'store',
      'metadata',
    ]) {
      assert.equal(keys.has(key), false)
    }
  })
  check('Model Input contains no forbidden user or report PII key', () => {
    const keys = allObjectKeys(modelInputs)
    for (const key of [
      'solarDate',
      'lunarDate',
      'gender',
      'birthInput',
      'userId',
      'user_id',
      'reportId',
      'report_id',
      'payment',
      'merchantOrderNo',
      'email',
      'phone',
      'cookie',
      'token',
    ]) {
      assert.equal(keys.has(key), false)
    }
  })
  check('selected rules remain in deterministic priority and ASCII order', () => {
    for (const input of modelInputs) {
      assert.equal(
        input.knowledgeContext.rules.some(
          (rule, index) =>
            index > 0 &&
            compareAiChartD1K0Rules(
              input.knowledgeContext.rules[index - 1],
              rule,
            ) > 0,
        ),
        false,
      )
    }
  })

  console.log(`\n${checks} P1 Model Input binding checks passed.`)
}

void run()
