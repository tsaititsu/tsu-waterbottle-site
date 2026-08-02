import assert from 'node:assert/strict'
import Module, { createRequire } from 'node:module'
import {
  AI_CHART_D1_K0_CATALOG_INTERNAL_JSON_SCHEMA,
  AI_CHART_D1_K0_CATALOG_INVALID,
  AI_CHART_D1_K0_P1_BUNDLE_INTERNAL_JSON_SCHEMA,
  AI_CHART_D1_K0_BUNDLE_INVALID,
  AI_CHART_D1_K0_PALACE_ROLES,
  compareAiChartD1K0Rules,
  createAiChartD1K0CatalogFingerprint,
  hashAiChartD1K0Content,
  parseAiChartD1K0Catalog,
  parseAiChartD1K0P1Bundle,
  type AiChartD1K0Catalog,
  type AiChartD1K0P1Bundle,
} from './d1K0Contracts'
import {
  AI_CHART_D1_K0_BUNDLE_VERSION,
} from './d1K0Registry'
import {
  AI_CHART_D1_P1_STRUCTURAL_INPUT_CONTRACT_VERSION,
  AI_CHART_D1_PALACE_IDENTITIES,
} from './d1N0Constants'

let checks = 0

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

type Mutable<T> = {
  -readonly [Key in keyof T]: T[Key] extends readonly (infer Item)[]
    ? Mutable<Item>[]
    : T[Key] extends object
      ? Mutable<T[Key]>
      : T[Key]
}

function check(name: string, run: () => void) {
  run()
  checks += 1
  console.log(`✓ ${name}`)
}

function bundleFixture(catalog: AiChartD1K0Catalog): AiChartD1K0P1Bundle {
  const selectedRules = [
    'rule:star:ziwei:core',
    'rule:mutagen:lianzhen:lu',
    'rule:structure:opposite',
    'rule:common:possibility-first',
  ]
    .map((ruleId) => {
      const rule = catalog.rules.find((entry) => entry.ruleId === ruleId)
      assert.ok(rule)
      return rule
    })
    .sort(compareAiChartD1K0Rules)
  const selectedMeanings = AI_CHART_D1_K0_PALACE_ROLES.flatMap(
    (palaceRole, index) => {
      const palaceId = AI_CHART_D1_PALACE_IDENTITIES[index].palaceId
      return catalog.palaceMeanings
        .filter((meaning) => meaning.palaceId === palaceId)
        .map((meaning) => ({
          palaceRole,
          palaceId,
          meaningId: meaning.meaningId,
          text: meaning.text,
          contentSha256: meaning.contentSha256,
          order: meaning.order,
        }))
    },
  )
  return {
    contractVersion: AI_CHART_D1_K0_BUNDLE_VERSION,
    bundleId: 'bundle:k0:test:0',
    catalogId: catalog.catalogId,
    catalogFingerprint: catalog.catalogFingerprint,
    sourceManifestSha256: catalog.sourceManifestSha256,
    task: 'D1_K0_P1',
    chartId: 'chart:test',
    runId: 'run:test',
    callId: 'call:test:0',
    targetPalaceId: 'palace:ming',
    p1StructuralInputContractVersion:
      AI_CHART_D1_P1_STRUCTURAL_INPUT_CONTRACT_VERSION,
    outputContractVersion: 'ai-chart-d1-p1-f1/v1',
    selectedRules,
    selectedMeanings,
    selectionTrace: selectedRules.map((entry) => {
      const isCommon = entry.ruleId === 'rule:common:possibility-first'
      const isSingle = entry.kind === 'single_star'
      const isMutagen = entry.kind === 'natal_mutagen'
      return {
        ruleId: entry.ruleId,
        reason: isCommon
          ? 'required_common_rule'
          : isSingle
            ? 'major_star_present'
            : isMutagen
              ? 'natal_mutagen_present'
              : 'relationship_rule',
        palaceRole: isCommon ? null : 'target',
        palaceId: isCommon ? null : 'palace:ming',
        placementId:
          isSingle || isMutagen ? 'palace:ming:star:major:0' : null,
        starName: isSingle ? '紫微' : isMutagen ? '廉貞' : null,
        mutagenType: isMutagen ? '化祿' : null,
        structuralReference: isCommon
          ? 'p1:required-common'
          : 'p1:view:target',
      }
    }),
    missingRequirements: [],
    knowledgeStatus: 'ready',
    promptStatus: 'prompt_builder_required',
    openAiCallable: false,
    warnings: [],
  }
}

function expectCatalogInvalid(value: unknown) {
  assert.throws(() => parseAiChartD1K0Catalog(value), {
    message: AI_CHART_D1_K0_CATALOG_INVALID,
  })
}

function expectBundleInvalid(value: unknown, catalog: unknown) {
  assert.throws(() => parseAiChartD1K0P1Bundle(value, catalog), {
    message: AI_CHART_D1_K0_BUNDLE_INVALID,
  })
}

function recalculateCatalogFingerprintForTest(
  catalog: Mutable<AiChartD1K0Catalog>,
): Mutable<AiChartD1K0Catalog> {
  const withoutFingerprint = { ...catalog } as Partial<
    Mutable<AiChartD1K0Catalog>
  >
  delete withoutFingerprint.catalogFingerprint
  catalog.catalogFingerprint = createAiChartD1K0CatalogFingerprint(
    withoutFingerprint as Omit<AiChartD1K0Catalog, 'catalogFingerprint'>,
  )
  return catalog
}

function mutateCatalog(
  catalog: AiChartD1K0Catalog,
  mutate: (value: Mutable<AiChartD1K0Catalog>) => void,
): Mutable<AiChartD1K0Catalog> {
  const value = structuredClone(catalog) as Mutable<AiChartD1K0Catalog>
  mutate(value)
  return recalculateCatalogFingerprintForTest(value)
}

function partialBundleFixture(
  bundle: ReturnType<typeof bundleFixture>,
): Mutable<ReturnType<typeof bundleFixture>> {
  const value = structuredClone(bundle) as Mutable<
    ReturnType<typeof bundleFixture>
  >
  value.missingRequirements = [
    {
      requirementId: 'missing:opposite:double:ziwei-qisha',
      kind: 'double_star',
      palaceRole: 'opposite',
      palaceId: 'palace:parents',
      starName: null,
      mutagenType: null,
      pairKey: 'pair:ziwei-qisha',
      reasonCode: 'missing_confirmed_double_star_core',
    },
    {
      requirementId: 'missing:target:empty:opposite-empty',
      kind: 'empty_palace',
      palaceRole: 'target',
      palaceId: 'palace:ming',
      starName: null,
      mutagenType: null,
      pairKey: null,
      reasonCode: 'missing_empty_palace_rule',
    },
  ].sort((left, right) =>
    left.requirementId.localeCompare(right.requirementId, 'en'),
  ) as Mutable<ReturnType<typeof bundleFixture>>['missingRequirements']
  value.knowledgeStatus = 'partial'
  value.warnings = ['warning:k0:bundle-partial']
  return value
}

function containsUniqueItems(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsUniqueItems)
  if (typeof value !== 'object' || value === null) return false
  return Object.entries(value).some(
    ([key, entry]) => key === 'uniqueItems' || containsUniqueItems(entry),
  )
}

function assertStrictObjectSchema(value: unknown): void {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return
  const record = value as Record<string, unknown>
  if (record.type === 'object') {
    assert.equal(record.additionalProperties, false)
    const propertyKeys = Object.keys(record.properties as Record<string, unknown>)
    assert.deepEqual(record.required, propertyKeys)
  }
  Object.values(record).forEach(assertStrictObjectSchema)
}

async function run() {
  const catalog = await compileAiChartD1K0Catalog()
  const parsedCatalog = parseAiChartD1K0Catalog(catalog)
  const bundle = bundleFixture(parsedCatalog)
  const parsedBundle = parseAiChartD1K0P1Bundle(bundle, parsedCatalog)

  check('catalog parses and recursively freezes', () => {
    assert.equal(Object.isFrozen(parsedCatalog), true)
    assert.equal(Object.isFrozen(parsedCatalog.rules), true)
    assert.equal(Object.isFrozen(parsedCatalog.rules[0]), true)
  })
  check('bundle parses and recursively freezes', () => {
    assert.equal(Object.isFrozen(parsedBundle), true)
    assert.equal(Object.isFrozen(parsedBundle.selectedRules), true)
  })
  check('catalog version is locked', () => {
    const value = structuredClone(catalog) as Mutable<AiChartD1K0Catalog>
    value.contractVersion = 'other' as typeof value.contractVersion
    expectCatalogInvalid(value)
  })
  check('catalog manifest sha is locked', () => {
    const value = structuredClone(catalog) as Mutable<AiChartD1K0Catalog>
    value.sourceManifestSha256 = '0'.repeat(64)
    expectCatalogInvalid(value)
  })
  check('catalog unknown field is rejected', () => {
    expectCatalogInvalid({ ...catalog, extra: true })
  })
  check('catalog invalid id is rejected', () => {
    const value = structuredClone(catalog) as Mutable<AiChartD1K0Catalog>
    value.rules[0].ruleId = '含中文'
    expectCatalogInvalid(value)
  })
  check('catalog duplicate rule id is rejected', () => {
    const value = structuredClone(catalog) as Mutable<AiChartD1K0Catalog>
    value.rules[1].ruleId = value.rules[0].ruleId
    expectCatalogInvalid(value)
  })
  check('catalog duplicate meaning id is rejected', () => {
    const value = structuredClone(catalog) as Mutable<AiChartD1K0Catalog>
    value.palaceMeanings.push(structuredClone(value.palaceMeanings[0]))
    expectCatalogInvalid(value)
  })
  check('catalog wrong content hash is rejected', () => {
    const value = structuredClone(catalog) as Mutable<AiChartD1K0Catalog>
    value.rules[0].contentSha256 = '0'.repeat(64)
    expectCatalogInvalid(value)
  })
  check('catalog wrong source hash is rejected', () => {
    const value = structuredClone(catalog) as Mutable<AiChartD1K0Catalog>
    value.rules[0].sourceFileSha256 = '0'.repeat(64)
    expectCatalogInvalid(value)
  })
  check('catalog wrong fingerprint is rejected', () => {
    expectCatalogInvalid({ ...catalog, catalogFingerprint: '0'.repeat(64) })
  })
  check('false 14/14 coverage with recomputed fingerprint is rejected', () => {
    expectCatalogInvalid(
      mutateCatalog(catalog, (value) => {
        value.coverage.doubleStarSpecificCoverage = {
          covered: 14,
          total: 14,
        }
      }),
    )
  })
  check('false teacher 14/14 with recomputed fingerprint is rejected', () => {
    expectCatalogInvalid(
      mutateCatalog(catalog, (value) => {
        value.coverage.singleStarTeacherSupplementCoverage.covered = 14
      }),
    )
  })
  check('false structure 15/15 with recomputed fingerprint is rejected', () => {
    expectCatalogInvalid(
      mutateCatalog(catalog, (value) => {
        value.coverage.structureRuleCoverage.total = 15
      }),
    )
  })
  check('missing opposite warning with recomputed fingerprint is rejected', () => {
    expectCatalogInvalid(
      mutateCatalog(catalog, (value) => {
        value.warnings = value.warnings.filter(
          (warning) => warning !== 'warning:k0:missing-opposite-empty-rule',
        )
      }),
    )
  })
  check('false ready state with recomputed fingerprint is rejected', () => {
    expectCatalogInvalid(
      mutateCatalog(catalog, (value) => {
        value.readiness = 'ready'
      }),
    )
  })
  check('mutated double pair key with recomputed fingerprint is rejected', () => {
    expectCatalogInvalid(
      mutateCatalog(catalog, (value) => {
        value.doubleStarInventory[0].pairKey = 'pair:mutated'
      }),
    )
  })
  check('swapped double stars with recomputed fingerprint are rejected', () => {
    expectCatalogInvalid(
      mutateCatalog(catalog, (value) => {
        const first = value.doubleStarInventory[0]
        const left = first.leftStar
        first.leftStar = first.rightStar
        first.rightStar = left
      }),
    )
  })
  check('deleted mutagen assignment with recomputed fingerprint is rejected', () => {
    expectCatalogInvalid(
      mutateCatalog(catalog, (value) => {
        value.mutagenInventory.splice(0, 1)
        value.coverage.mutagenSpecificCoverage.covered -= 1
        value.coverage.mutagenSpecificCoverage.total -= 1
      }),
    )
  })
  check('fake mutagen assignment with recomputed fingerprint is rejected', () => {
    expectCatalogInvalid(
      mutateCatalog(catalog, (value) => {
        const fake = structuredClone(
          value.mutagenInventory[value.mutagenInventory.length - 1],
        )
        fake.starName = '假星'
        fake.specificRuleId = null
        fake.sourceAuthority = null
        fake.missingReason = 'missing_specific_mutagen_rule'
        value.mutagenInventory.push(fake)
        value.coverage.mutagenSpecificCoverage.total += 1
      }),
    )
  })
  check('missing supporting rule cannot be hidden by coverage and fingerprint', () => {
    expectCatalogInvalid(
      mutateCatalog(catalog, (value) => {
        value.rules = value.rules.filter(
          (rule) => rule.ruleId !== 'rule:supporting:wenchang:core',
        )
        value.coverage.supportingStarCoverage.covered = 10
      }),
    )
  })
  check('missing palace meaning cannot be hidden by coverage and fingerprint', () => {
    expectCatalogInvalid(
      mutateCatalog(catalog, (value) => {
        value.palaceMeanings.splice(0, 1)
        value.coverage.palaceMeaningCoverage.covered = 11
      }),
    )
  })
  check('forged teacher supplement with recomputed fingerprint is rejected', () => {
    expectCatalogInvalid(
      mutateCatalog(catalog, (value) => {
        const rule = value.rules.find(
          (entry) => entry.ruleId === 'rule:star:tianxiang:core',
        )
        assert.ok(rule)
        const content = JSON.parse(rule.content) as Record<string, unknown>
        content.老師補充D1 = [
          {
            starName: '天相',
            segmentId: 'teacher:tianxiang:forged',
            text: '偽造老師補充',
          },
        ]
        rule.content = JSON.stringify(content)
        rule.contentSha256 = hashAiChartD1K0Content(rule.content)
      }),
    )
  })
  check('catalog wrong priority ordering is rejected', () => {
    const value = structuredClone(catalog) as Mutable<AiChartD1K0Catalog>
    value.rules.reverse()
    expectCatalogInvalid(value)
  })
  check('catalog accessor is rejected', () => {
    const value = structuredClone(catalog) as Record<string, unknown>
    Object.defineProperty(value, 'readiness', { enumerable: true, get: () => 'partial' })
    expectCatalogInvalid(value)
  })
  check('catalog symbol key is rejected', () => {
    const value = structuredClone(catalog) as Record<PropertyKey, unknown>
    value[Symbol('unsafe')] = true
    expectCatalogInvalid(value)
  })
  check('catalog cycle is rejected', () => {
    const value = structuredClone(catalog) as Record<string, unknown>
    value.cycle = value
    expectCatalogInvalid(value)
  })
  check('bundle version is locked', () => {
    expectBundleInvalid({ ...bundle, contractVersion: 'other' }, catalog)
  })
  check('bundle unknown field is rejected', () => {
    expectBundleInvalid({ ...bundle, userId: 'forbidden' }, catalog)
  })
  check('bundle invalid id is rejected', () => {
    expectBundleInvalid({ ...bundle, bundleId: '含中文' }, catalog)
  })
  check('bundle duplicate trace is rejected', () => {
    const value = structuredClone(bundle) as Mutable<ReturnType<typeof bundleFixture>>
    value.selectionTrace[1].ruleId = value.selectionTrace[0].ruleId
    expectBundleInvalid(value, catalog)
  })
  check('bundle broken rule reference is rejected', () => {
    const value = structuredClone(bundle) as Mutable<ReturnType<typeof bundleFixture>>
    value.selectionTrace[0].ruleId = 'rule:missing'
    expectBundleInvalid(value, catalog)
  })
  check('bundle broken meaning reference is rejected', () => {
    const value = structuredClone(bundle) as Mutable<ReturnType<typeof bundleFixture>>
    value.selectedMeanings[0].meaningId = 'meaning:missing'
    expectBundleInvalid(value, catalog)
  })
  check('bundle wrong catalog fingerprint is rejected', () => {
    expectBundleInvalid({ ...bundle, catalogFingerprint: '0'.repeat(64) }, catalog)
  })
  check('bundle wrong selected rule hash is rejected', () => {
    const value = structuredClone(bundle) as Mutable<ReturnType<typeof bundleFixture>>
    value.selectedRules[0].contentSha256 = '0'.repeat(64)
    expectBundleInvalid(value, catalog)
  })
  check('bundle wrong selected rule order is rejected', () => {
    const value = structuredClone(bundle) as Mutable<ReturnType<typeof bundleFixture>>
    value.selectedRules.reverse()
    expectBundleInvalid(value, catalog)
  })
  check('bundle selection trace reordering is rejected', () => {
    const value = structuredClone(bundle) as Mutable<ReturnType<typeof bundleFixture>>
    const first = value.selectionTrace[0]
    value.selectionTrace[0] = value.selectionTrace[1]
    value.selectionTrace[1] = first
    expectBundleInvalid(value, catalog)
  })
  check('bundle trace reason incompatible with rule kind is rejected', () => {
    const value = structuredClone(bundle) as Mutable<ReturnType<typeof bundleFixture>>
    const trace = value.selectionTrace.find(
      (entry) => entry.reason === 'major_star_present',
    )
    assert.ok(trace)
    trace.reason = 'required_common_rule'
    expectBundleInvalid(value, catalog)
  })
  check('major-star trace without placement id is rejected', () => {
    const value = structuredClone(bundle) as Mutable<ReturnType<typeof bundleFixture>>
    const trace = value.selectionTrace.find(
      (entry) => entry.reason === 'major_star_present',
    )
    assert.ok(trace)
    trace.placementId = null
    expectBundleInvalid(value, catalog)
  })
  check('mutagen trace without mutagen type is rejected', () => {
    const value = structuredClone(bundle) as Mutable<ReturnType<typeof bundleFixture>>
    const trace = value.selectionTrace.find(
      (entry) => entry.reason === 'natal_mutagen_present',
    )
    assert.ok(trace)
    trace.mutagenType = null
    expectBundleInvalid(value, catalog)
  })
  check('duplicate selected meaning is rejected', () => {
    const value = structuredClone(bundle) as Mutable<ReturnType<typeof bundleFixture>>
    value.selectedMeanings.splice(1, 0, structuredClone(value.selectedMeanings[0]))
    expectBundleInvalid(value, catalog)
  })
  check('missing target role meanings are rejected', () => {
    const value = structuredClone(bundle) as Mutable<ReturnType<typeof bundleFixture>>
    value.selectedMeanings = value.selectedMeanings.filter(
      (meaning) => meaning.palaceRole !== 'target',
    )
    expectBundleInvalid(value, catalog)
  })
  check('missing trine role meanings are rejected', () => {
    const value = structuredClone(bundle) as Mutable<ReturnType<typeof bundleFixture>>
    value.selectedMeanings = value.selectedMeanings.filter(
      (meaning) => meaning.palaceRole !== 'trine_2',
    )
    expectBundleInvalid(value, catalog)
  })
  check('one role mixing two palace ids is rejected', () => {
    const value = structuredClone(bundle) as Mutable<ReturnType<typeof bundleFixture>>
    const targetEnd = value.selectedMeanings.findIndex(
      (meaning) => meaning.palaceRole !== 'target',
    )
    const extra = catalog.palaceMeanings
      .filter(
        (meaning) =>
          meaning.palaceId === AI_CHART_D1_PALACE_IDENTITIES[5].palaceId,
      )
      .map((meaning) => ({
        palaceRole: 'target' as const,
        palaceId: meaning.palaceId,
        meaningId: meaning.meaningId,
        text: meaning.text,
        contentSha256: meaning.contentSha256,
        order: meaning.order,
      }))
    value.selectedMeanings.splice(targetEnd, 0, ...extra)
    expectBundleInvalid(value, catalog)
  })
  check('target meanings for a different palace are rejected', () => {
    const value = structuredClone(bundle) as Mutable<ReturnType<typeof bundleFixture>>
    const replacement = catalog.palaceMeanings
      .filter(
        (meaning) =>
          meaning.palaceId === AI_CHART_D1_PALACE_IDENTITIES[5].palaceId,
      )
      .map((meaning) => ({
        palaceRole: 'target' as const,
        palaceId: meaning.palaceId,
        meaningId: meaning.meaningId,
        text: meaning.text,
        contentSha256: meaning.contentSha256,
        order: meaning.order,
      }))
    value.selectedMeanings = [
      ...replacement,
      ...value.selectedMeanings.filter(
        (meaning) => meaning.palaceRole !== 'target',
      ),
    ]
    expectBundleInvalid(value, catalog)
  })
  check('missing one catalog meaning is rejected', () => {
    const value = structuredClone(bundle) as Mutable<ReturnType<typeof bundleFixture>>
    value.selectedMeanings.splice(0, 1)
    expectBundleInvalid(value, catalog)
  })
  check('reordered missing requirements are rejected', () => {
    const value = partialBundleFixture(bundle)
    value.missingRequirements.reverse()
    expectBundleInvalid(value, catalog)
  })
  check('missing reason code incompatible with kind is rejected', () => {
    const value = partialBundleFixture(bundle)
    value.missingRequirements[0].kind = 'palace_meaning'
    expectBundleInvalid(value, catalog)
  })
  check('partial bundle without warning is rejected', () => {
    const value = partialBundleFixture(bundle)
    value.warnings = []
    expectBundleInvalid(value, catalog)
  })
  check('ready bundle with partial warning is rejected', () => {
    const value = structuredClone(bundle) as Mutable<ReturnType<typeof bundleFixture>>
    value.warnings = ['warning:k0:bundle-partial']
    expectBundleInvalid(value, catalog)
  })
  check('partial bundle with extra warning is rejected', () => {
    const value = partialBundleFixture(bundle)
    value.warnings.push('warning:k0:extra')
    expectBundleInvalid(value, catalog)
  })
  check('bundle partial status requires missing requirement', () => {
    expectBundleInvalid({ ...bundle, knowledgeStatus: 'partial' }, catalog)
  })
  check('bundle openAiCallable is fixed false', () => {
    expectBundleInvalid({ ...bundle, openAiCallable: true }, catalog)
  })
  check('bundle accessor, symbol and cycle graphs are rejected', () => {
    const accessor = structuredClone(bundle) as Record<string, unknown>
    Object.defineProperty(accessor, 'task', { enumerable: true, get: () => 'D1_K0_P1' })
    expectBundleInvalid(accessor, catalog)
    const symbol = structuredClone(bundle) as Record<PropertyKey, unknown>
    symbol[Symbol('unsafe')] = true
    expectBundleInvalid(symbol, catalog)
    const cycle = structuredClone(bundle) as Record<string, unknown>
    cycle.cycle = cycle
    expectBundleInvalid(cycle, catalog)
  })
  check('internal schemas are strict and have no uniqueItems', () => {
    assertStrictObjectSchema(AI_CHART_D1_K0_CATALOG_INTERNAL_JSON_SCHEMA)
    assertStrictObjectSchema(AI_CHART_D1_K0_P1_BUNDLE_INTERNAL_JSON_SCHEMA)
    assert.equal(containsUniqueItems(AI_CHART_D1_K0_CATALOG_INTERNAL_JSON_SCHEMA), false)
    assert.equal(containsUniqueItems(AI_CHART_D1_K0_P1_BUNDLE_INTERNAL_JSON_SCHEMA), false)
  })
  check('schemas remain internal and contain no OpenAI response format', () => {
    const schemaKeys = allSchemaKeys([
      AI_CHART_D1_K0_CATALOG_INTERNAL_JSON_SCHEMA,
      AI_CHART_D1_K0_P1_BUNDLE_INTERNAL_JSON_SCHEMA,
    ])
    assert.equal(schemaKeys.has('response_format'), false)
    assert.equal(schemaKeys.has('model'), false)
  })
  console.log(`\n${checks} K0 contract checks passed.`)
}

function allSchemaKeys(value: unknown, output = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    value.forEach((entry) => allSchemaKeys(entry, output))
  } else if (typeof value === 'object' && value !== null) {
    for (const [key, entry] of Object.entries(value)) {
      output.add(key)
      allSchemaKeys(entry, output)
    }
  }
  return output
}

void run()
