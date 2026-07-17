import assert from 'node:assert/strict'
import Module, { createRequire } from 'node:module'
import { normalizeAiChartD1N0 } from './d1N0'
import {
  AI_CHART_D1_K0_PALACE_ROLES,
  createAiChartD1K0CatalogFingerprint,
  parseAiChartD1K0Catalog,
  type AiChartD1K0Catalog,
  type AiChartD1K0P1Bundle,
} from './d1K0Contracts'
import { getAiChartD1K0StarSlug } from './d1K0Registry'
import { buildAiChartD1K0P1KnowledgeBundles } from './d1K0Selection'
import {
  AI_CHART_D1_MODELED_SUPPORTING_STARS,
  AI_CHART_D1_PALACE_IDENTITIES,
} from './d1N0Constants'
import { buildAiChartD1P1StructuralInputs } from './d1P1InputContracts'

type MutableRecord = Record<string, unknown>
type Mutable<T> = {
  -readonly [Key in keyof T]: T[Key] extends readonly (infer Item)[]
    ? Mutable<Item>[]
    : T[Key] extends object
      ? Mutable<T[Key]>
      : T[Key]
}
type NodeModuleInternals = {
  _resolveFilename: (
    request: string,
    parent: unknown,
    isMain: boolean,
    options?: unknown,
  ) => string
  _load: (request: string, parent: unknown, isMain: boolean) => unknown
}

const moduleInternals = Module as unknown as NodeModuleInternals
const originalResolveFilename = moduleInternals._resolveFilename
const originalLoad = moduleInternals._load
const testRequire = createRequire(__filename)
const serverOnlyStubPath = testRequire.resolve('./d1Assets')

moduleInternals._resolveFilename = function resolveFilenameForTest(
  this: unknown,
  request: string,
  parent: unknown,
  isMain: boolean,
  options?: unknown,
) {
  if (request === 'server-only') return serverOnlyStubPath
  return originalResolveFilename.call(this, request, parent, isMain, options)
}
moduleInternals._load = function loadForTest(
  this: unknown,
  request: string,
  parent: unknown,
  isMain: boolean,
) {
  if (request === 'server-only') return {}
  return originalLoad.call(this, request, parent, isMain)
}
const { compileAiChartD1K0Catalog } = testRequire(
  './d1K0Catalog.server',
) as typeof import('./d1K0Catalog.server')
moduleInternals._resolveFilename = originalResolveFilename
moduleInternals._load = originalLoad

const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] as const
const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const
const MAJORS = [
  ['廉貞', '化祿'],
  ['破軍', '化權'],
  ['武曲', '化科'],
  ['太陽', '化忌'],
  ['天機', null],
  ['天同', null],
  ['天府', null],
  ['太陰', null],
  ['貪狼', null],
  ['巨門', null],
  ['天相', null],
  ['天梁', null],
] as const

let checks = 0

function check(name: string, run: () => void) {
  run()
  checks += 1
  console.log(`✓ ${name}`)
}

function star(name: string, type: string, mutagen?: string) {
  return {
    name,
    type,
    scope: 'origin',
    ...(mutagen === undefined ? {} : { mutagen }),
  }
}

function completeSnapshot(): MutableRecord {
  const supportingNames = Object.keys(AI_CHART_D1_MODELED_SUPPORTING_STARS)
  return {
    version: 'ai-chart-chart-snapshot/v1',
    source: 'waterbottle-ziwei-native',
    engineVersion: 'v1',
    birthInputVersion: 'ai-chart-birth-input/v1',
    lunarDate: 'synthetic-k0',
    fiveElementsClass: 'synthetic-k0',
    palaces: AI_CHART_D1_PALACE_IDENTITIES.map((identity, index) => ({
      index,
      name: identity.engineName,
      isMingPalace: index === 0,
      isBodyPalace: index === 0,
      heavenlyStem: STEMS[index % STEMS.length],
      earthlyBranch: BRANCHES[index],
      majorStars: [
        star(
          MAJORS[index][0],
          'major',
          MAJORS[index][1] ?? undefined,
        ),
      ],
      minorStars:
        index < supportingNames.length
          ? [
              star(
                supportingNames[index],
                AI_CHART_D1_MODELED_SUPPORTING_STARS[
                  supportingNames[index] as keyof typeof AI_CHART_D1_MODELED_SUPPORTING_STARS
                ],
              ),
            ]
          : [],
      adjectiveStars:
        index === 0 ? [star('天馬', 'tianma')] : [],
      decadal: {
        range: [index * 10, index * 10 + 9],
        heavenlyStem: STEMS[(index + 1) % STEMS.length],
        earthlyBranch: BRANCHES[(index + 1) % BRANCHES.length],
      },
      ages: [index + 1],
    })),
  }
}

function createInputs(snapshot: MutableRecord, identity: string) {
  const n0 = normalizeAiChartD1N0(snapshot, { chartId: `chart:${identity}` })
  return buildAiChartD1P1StructuralInputs(n0, {
    runId: `run:${identity}`,
    callIds: Array.from({ length: 12 }, (_, index) => `call:${identity}:${index}`),
  })
}

function bundleIds(identity: string) {
  return Array.from({ length: 12 }, (_, index) => `bundle:${identity}:${index}`)
}

function allKeys(value: unknown, output = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    value.forEach((entry) => allKeys(entry, output))
  } else if (typeof value === 'object' && value !== null) {
    for (const [key, entry] of Object.entries(value)) {
      output.add(key)
      allKeys(entry, output)
    }
  }
  return output
}

function viewStarNames(input: ReturnType<typeof createInputs>[number]): Set<string> {
  const palaces = [
    input.targetPalace,
    input.oppositePalace,
    input.hiddenCombinationPalace,
    ...input.otherTrinePalaces,
  ]
  return new Set(
    palaces.flatMap((palace) => [
      ...palace.canonicalMajorStars.map((entry) => entry.name),
      ...palace.borrowedMajorStars.map((entry) => entry.name),
      ...palace.modeledSupportingStars.map((entry) => entry.name),
    ]),
  )
}

function assertRuleOrdering(bundle: AiChartD1K0P1Bundle) {
  for (let index = 1; index < bundle.selectedRules.length; index += 1) {
    const previous = bundle.selectedRules[index - 1]
    const current = bundle.selectedRules[index]
    assert.equal(
      previous.priority > current.priority ||
        (previous.priority === current.priority &&
          previous.ruleId.localeCompare(current.ruleId, 'en') <= 0),
      true,
    )
  }
}

function withoutMutagenSpecificRule(
  catalog: AiChartD1K0Catalog,
  starName: string,
  mutagenType: string,
): AiChartD1K0Catalog {
  const mutable = structuredClone(catalog) as Mutable<AiChartD1K0Catalog>
  const inventory = mutable.mutagenInventory.find(
    (entry) =>
      entry.starName === starName && entry.mutagenType === mutagenType,
  )
  assert.ok(inventory?.specificRuleId)
  const removedRuleId = inventory.specificRuleId
  inventory.specificRuleId = null
  inventory.sourceAuthority = null
  inventory.missingReason = 'missing_specific_mutagen_rule'
  mutable.rules = mutable.rules.filter((rule) => rule.ruleId !== removedRuleId)
  mutable.coverage.mutagenSpecificCoverage.covered -= 1
  mutable.readiness = 'partial'
  mutable.warnings.push('warning:k0:missing-mutagen-specific')
  const withoutFingerprint: Partial<Mutable<AiChartD1K0Catalog>> = {
    ...mutable,
  }
  delete withoutFingerprint.catalogFingerprint
  mutable.catalogFingerprint = createAiChartD1K0CatalogFingerprint(
    withoutFingerprint as Omit<AiChartD1K0Catalog, 'catalogFingerprint'>,
  )
  return parseAiChartD1K0Catalog(mutable)
}

async function run() {
  const catalog = await compileAiChartD1K0Catalog()
  const inputs = createInputs(completeSnapshot(), 'complete')
  const ids = bundleIds('complete')
  const bundles = buildAiChartD1K0P1KnowledgeBundles(catalog, inputs, {
    bundleIds: ids,
  })

  check('exactly twelve bundles are created', () => {
    assert.equal(bundles.length, 12)
  })
  check('bundle ids, call ids and target indices map one-to-one', () => {
    bundles.forEach((bundle, index) => {
      assert.equal(bundle.bundleId, ids[index])
      assert.equal(bundle.callId, inputs[index].callId)
      assert.equal(bundle.targetPalaceId, inputs[index].targetPalace.palaceId)
    })
  })
  check('complete fixture produces ready bundles', () => {
    assert.equal(bundles.every((bundle) => bundle.knowledgeStatus === 'ready'), true)
    assert.equal(bundles.every((bundle) => bundle.missingRequirements.length === 0), true)
  })
  check('every bundle remains non-callable and prompt-blocked', () => {
    assert.equal(bundles.every((bundle) => bundle.openAiCallable === false), true)
    assert.equal(
      bundles.every((bundle) => bundle.promptStatus === 'prompt_builder_required'),
      true,
    )
  })
  check('five palace roles receive meanings in fixed order', () => {
    for (const bundle of bundles) {
      const roles = [...new Set(bundle.selectedMeanings.map((entry) => entry.palaceRole))]
      assert.deepEqual(roles, AI_CHART_D1_K0_PALACE_ROLES)
    }
  })
  check('only stars visible in five palace views are selected', () => {
    bundles.forEach((bundle, index) => {
      const visible = viewStarNames(inputs[index])
      for (const rule of bundle.selectedRules) {
        const trace = bundle.selectionTrace.find((entry) => entry.ruleId === rule.ruleId)
        if (trace?.starName !== null && trace?.starName !== undefined) {
          assert.equal(visible.has(trace.starName), true)
        }
      }
    })
  })
  check('excluded stars never create selected rules', () => {
    assert.equal(
      bundles.some((bundle) =>
        bundle.selectedRules.some((rule) => rule.ruleId.includes('tianma')),
      ),
      false,
    )
  })
  check('supporting stars are selected only when present', () => {
    bundles.forEach((bundle, index) => {
      const visible = viewStarNames(inputs[index])
      for (const rule of bundle.selectedRules.filter(
        (entry) => entry.kind === 'supporting_star',
      )) {
        const trace = bundle.selectionTrace.find((entry) => entry.ruleId === rule.ruleId)
        assert.ok(trace?.starName)
        assert.equal(visible.has(trace.starName), true)
      }
    })
  })
  check('mutagen specific rules are conditional on placements', () => {
    bundles.forEach((bundle, index) => {
      const placementIds = new Set(
        [
          inputs[index].targetPalace,
          inputs[index].oppositePalace,
          inputs[index].hiddenCombinationPalace,
          ...inputs[index].otherTrinePalaces,
        ].flatMap((palace) => [
          ...palace.canonicalMajorStars.map((star) => star.placementId),
          ...palace.modeledSupportingStars.map((star) => star.placementId),
          ...palace.borrowedMajorStars.map((star) => star.borrowedPlacementId),
        ]),
      )
      for (const trace of bundle.selectionTrace.filter(
        (entry) => entry.reason === 'natal_mutagen_present',
      )) {
        assert.ok(trace.placementId)
        assert.equal(placementIds.has(trace.placementId), true)
      }
    })
  })
  check('relationship rules are always selected', () => {
    for (const bundle of bundles) {
      for (const ruleId of [
        'rule:structure:opposite',
        'rule:structure:hidden-combination',
        'rule:structure:trine',
        'rule:structure:integration-order',
      ]) {
        assert.equal(bundle.selectedRules.some((rule) => rule.ruleId === ruleId), true)
      }
    }
  })
  check('four-horse rules are target-only', () => {
    bundles.forEach((bundle, index) => {
      const selected = bundle.selectedRules.some(
        (rule) => rule.ruleId === 'rule:structure:four-horse',
      )
      assert.equal(selected, inputs[index].targetPalace.isFourHorsePalace)
    })
  })
  check('selected rules are deduplicated and deterministically sorted', () => {
    for (const bundle of bundles) {
      assert.equal(
        new Set(bundle.selectedRules.map((rule) => rule.ruleId)).size,
        bundle.selectedRules.length,
      )
      assertRuleOrdering(bundle)
    }
  })
  check('every selected rule has exactly one valid trace', () => {
    for (const bundle of bundles) {
      assert.equal(bundle.selectionTrace.length, bundle.selectedRules.length)
      assert.deepEqual(
        bundle.selectionTrace.map((trace) => trace.ruleId),
        bundle.selectedRules.map((rule) => rule.ruleId),
      )
    }
  })
  check('bundle omits full catalog, N0 and structural input', () => {
    const keys = allKeys(bundles)
    for (const key of [
      'doubleStarInventory',
      'mutagenInventory',
      'palaces',
      'targetPalace',
      'targetGlobalScan',
      'flyingTransformations',
    ]) {
      assert.equal(keys.has(key), false)
    }
  })
  check('recursive PII denylist is absent', () => {
    const keys = allKeys(bundles)
    for (const key of [
      'name', 'solarDate', 'lunarDate', 'timeIndex', 'gender', 'fixLeap',
      'fiveElementsClass', 'decadal', 'ages', 'userId', 'reportId',
      'payment', 'merchantOrderNo', 'email', 'phone', 'cookie', 'token',
    ]) {
      assert.equal(keys.has(key), false)
    }
  })
  check('bundle graph is recursively frozen', () => {
    assert.equal(Object.isFrozen(bundles), true)
    assert.equal(Object.isFrozen(bundles[0]), true)
    assert.equal(Object.isFrozen(bundles[0].selectedRules), true)
    assert.equal(Object.isFrozen(bundles[0].selectedRules[0]), true)
  })
  check('selection is deterministic across repeated builds', () => {
    const repeated = buildAiChartD1K0P1KnowledgeBundles(catalog, inputs, {
      bundleIds: ids,
    })
    assert.deepEqual(repeated, bundles)
  })
  check('duplicate bundle ids are rejected', () => {
    assert.throws(() =>
      buildAiChartD1K0P1KnowledgeBundles(catalog, inputs, {
        bundleIds: Array(12).fill('bundle:duplicate'),
      }),
    )
  })
  check('wrong input count is rejected', () => {
    assert.throws(() =>
      buildAiChartD1K0P1KnowledgeBundles(catalog, inputs.slice(0, 11), {
        bundleIds: ids,
      }),
    )
  })
  check('caller mutations cannot alter built bundles', () => {
    const mutableInputs = structuredClone(inputs) as Mutable<typeof inputs>
    const isolated = buildAiChartD1K0P1KnowledgeBundles(catalog, mutableInputs, {
      bundleIds: ids,
    })
    mutableInputs[0].callId = 'call:changed'
    assert.equal(isolated[0].callId, 'call:complete:0')
  })

  const partialSnapshot = completeSnapshot()
  const partialPalaces = partialSnapshot.palaces as MutableRecord[]
  partialPalaces[0].majorStars = [star('紫微', 'major'), star('七殺', 'major')]
  partialPalaces[1].majorStars = [
    star('廉貞', 'major', '化祿'),
    star('破軍', 'major', '化權'),
  ]
  const partialInputs = createInputs(partialSnapshot, 'partial')
  const partialBundles = buildAiChartD1K0P1KnowledgeBundles(
    catalog,
    partialInputs,
    { bundleIds: bundleIds('partial') },
  )
  check('missing double-star core makes the bundle partial', () => {
    assert.equal(partialBundles[0].knowledgeStatus, 'partial')
    assert.equal(
      partialBundles[0].missingRequirements.some(
        (entry) => entry.reasonCode === 'missing_confirmed_double_star_core',
      ),
      true,
    )
  })
  check('missing double-star core never generates working inference', () => {
    assert.equal(
      partialBundles[0].selectedRules.some(
        (rule) => rule.kind === 'double_star' && rule.ruleStatus === 'working_inference',
      ),
      false,
    )
  })

  const missingMutagenCatalog = withoutMutagenSpecificRule(
    catalog,
    '廉貞',
    '化祿',
  )
  const missingMutagenBundles = buildAiChartD1K0P1KnowledgeBundles(
    missingMutagenCatalog,
    inputs,
    { bundleIds: bundleIds('missing-mutagen') },
  )
  check('missing mutagen specific rule makes affected bundles partial', () => {
    const affected = missingMutagenBundles.filter((bundle) =>
      bundle.missingRequirements.some(
        (entry) =>
          entry.reasonCode === 'missing_specific_mutagen_rule' &&
          entry.starName === '廉貞' &&
          entry.mutagenType === '化祿',
      ),
    )
    assert.equal(affected.length > 0, true)
    assert.equal(
      affected.every((bundle) => bundle.knowledgeStatus === 'partial'),
      true,
    )
  })

  const borrowSnapshot = completeSnapshot()
  const borrowPalaces = borrowSnapshot.palaces as MutableRecord[]
  borrowPalaces[0].majorStars = []
  borrowPalaces[0].minorStars = []
  borrowPalaces[4].majorStars = [star('廉貞', 'major', '化祿')]
  const borrowInputs = createInputs(borrowSnapshot, 'borrow')
  const borrowBundles = buildAiChartD1K0P1KnowledgeBundles(
    catalog,
    borrowInputs,
    { bundleIds: bundleIds('borrow') },
  )
  check('eligible empty palace selects borrowed major rules', () => {
    assert.equal(borrowInputs[0].targetPalace.borrowStatus, 'eligible_and_borrowed')
    const borrowedName = borrowInputs[0].targetPalace.borrowedMajorStars[0].name
    const slug = getAiChartD1K0StarSlug(borrowedName)
    assert.equal(
      borrowBundles[0].selectedRules.some(
        (rule) => rule.ruleId === `rule:star:${slug}:core`,
      ),
      true,
    )
    assert.equal(
      borrowBundles[0].selectionTrace.some(
        (trace) => trace.reason === 'borrowed_major_star_present',
      ),
      true,
    )
  })
  check('eligible empty palace selects only the required borrow rules', () => {
    assert.equal(
      borrowBundles[0].selectedRules.some(
        (rule) => rule.ruleId === 'rule:structure:empty-palace-borrow',
      ),
      true,
    )
    assert.equal(
      borrowBundles[0].selectedRules.some(
        (rule) => rule.ruleId === 'rule:structure:empty-palace-opposite-only',
      ),
      true,
    )
  })
  check('no F1 or flying rule is selected', () => {
    const serialized = JSON.stringify([
      ...bundles,
      ...partialBundles,
      ...borrowBundles,
    ])
    assert.doesNotMatch(serialized, /flying|飛化|F1_KNOWLEDGE/iu)
  })
  console.log(`\n${checks} K0 selection checks passed.`)
}

void run()
