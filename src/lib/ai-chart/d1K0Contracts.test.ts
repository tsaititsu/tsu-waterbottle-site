import assert from 'node:assert/strict'
import {
  AI_CHART_D1_ASSET_MANIFEST_VERSION,
  AI_CHART_D1_LOCKED_MANIFEST_SHA256,
} from './d1Assets'
import {
  AI_CHART_D1_K0_CATALOG_INTERNAL_JSON_SCHEMA,
  AI_CHART_D1_K0_CATALOG_INVALID,
  AI_CHART_D1_K0_D1_SAFETY,
  AI_CHART_D1_K0_P1_BUNDLE_INTERNAL_JSON_SCHEMA,
  AI_CHART_D1_K0_BUNDLE_INVALID,
  createAiChartD1K0CatalogFingerprint,
  hashAiChartD1K0Content,
  parseAiChartD1K0Catalog,
  parseAiChartD1K0P1Bundle,
  type AiChartD1K0Catalog,
  type AiChartD1K0Rule,
} from './d1K0Contracts'
import {
  AI_CHART_D1_K0_BUNDLE_VERSION,
  AI_CHART_D1_K0_CATALOG_ID,
  AI_CHART_D1_K0_CATALOG_VERSION,
  AI_CHART_D1_K0_COMPILED_AT_POLICY,
  AI_CHART_D1_K0_DOUBLE_STAR_INVENTORY,
  AI_CHART_D1_K0_SOURCE_FILES,
  AI_CHART_D1_K0_SOURCE_SHA256,
} from './d1K0Registry'
import { AI_CHART_D1_P1_STRUCTURAL_INPUT_CONTRACT_VERSION } from './d1N0Constants'

let checks = 0

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

function jsonLocator(starName: string) {
  return {
    sourceType: 'json' as const,
    headingPath: [],
    headingLevel: 0 as const,
    exactHeading: null,
    occurrenceIndex: 0,
    extractionMode: 'exact_line' as const,
    itemIndex: null,
    exactLabel: null,
    exactText: null,
    jsonPath: 'stars',
    jsonMatchField: 'name',
    jsonMatchValue: starName,
  }
}

function markdownLocator() {
  return {
    sourceType: 'markdown' as const,
    headingPath: [],
    headingLevel: 2 as const,
    exactHeading: '二、對宮',
    occurrenceIndex: 0,
    extractionMode: 'exact_section' as const,
    itemIndex: null,
    exactLabel: null,
    exactText: null,
    jsonPath: null,
    jsonMatchField: null,
    jsonMatchValue: null,
  }
}

function rule(
  ruleId: string,
  content: string,
  sourceAuthority: 'formal_teacher_confirmed' | 'reasoning_confirmed',
): AiChartD1K0Rule {
  const formal = sourceAuthority === 'formal_teacher_confirmed'
  const sourceFile = formal
    ? AI_CHART_D1_K0_SOURCE_FILES.stars
    : AI_CHART_D1_K0_SOURCE_FILES.relationships
  return {
    ruleId,
    kind: formal ? 'single_star' : 'relationship',
    title: formal ? '紫微核心' : '對宮規則',
    content,
    contentSha256: hashAiChartD1K0Content(content),
    ruleStatus: 'teacher_confirmed',
    sourceAuthority,
    sourceFile,
    sourceFileSha256: AI_CHART_D1_K0_SOURCE_SHA256[sourceFile],
    sourceLocator: formal ? jsonLocator('紫微') : markdownLocator(),
    appliesTo: formal ? ['star:ziwei'] : ['relationship:opposite'],
    priority: formal ? 400 : 300,
    d1Safety: AI_CHART_D1_K0_D1_SAFETY,
    selectionTags: formal ? ['star:ziwei'] : ['relationship:opposite'],
  }
}

function catalogFixture(): AiChartD1K0Catalog {
  const rules = [
    rule('rule:star:ziwei:core', '{"核心":"尊重"}', 'formal_teacher_confirmed'),
    rule('rule:structure:opposite', '先分析本宮，再整合對宮。', 'reasoning_confirmed'),
  ]
  const meaningText = '個性'
  const withoutFingerprint: Omit<AiChartD1K0Catalog, 'catalogFingerprint'> = {
    contractVersion: AI_CHART_D1_K0_CATALOG_VERSION,
    catalogId: AI_CHART_D1_K0_CATALOG_ID,
    sourceManifestVersion: AI_CHART_D1_ASSET_MANIFEST_VERSION,
    sourceManifestSha256: AI_CHART_D1_LOCKED_MANIFEST_SHA256,
    compiledAtPolicy: AI_CHART_D1_K0_COMPILED_AT_POLICY,
    rules,
    palaceMeanings: [
      {
        meaningId: 'meaning:palace:ming:personality',
        palaceId: 'palace:ming',
        text: meaningText,
        contentSha256: hashAiChartD1K0Content(meaningText),
        order: 0,
        sourceFile: AI_CHART_D1_K0_SOURCE_FILES.palaces,
        sourceFileSha256:
          AI_CHART_D1_K0_SOURCE_SHA256[AI_CHART_D1_K0_SOURCE_FILES.palaces],
        sourceLocator: {
          ...markdownLocator(),
          exactHeading: '一、十二宮分面（每宮看什麼）',
          extractionMode: 'exact_bullet',
          itemIndex: 0,
          exactText: '命宮：個性、價值觀、能力、長相、遷移宮的內心、影響 12 宮',
        },
      },
    ],
    doubleStarInventory: AI_CHART_D1_K0_DOUBLE_STAR_INVENTORY.map((entry) => ({
      ...entry,
      specificRuleStatus: null,
      specificRuleId: null,
      missingReason: 'missing_confirmed_double_star_core',
    })),
    mutagenInventory: [],
    coverage: {
      palaceMeaningCoverage: { covered: 1, total: 12 },
      singleStarCoverage: { covered: 1, total: 14 },
      singleStarTeacherSupplementCoverage: { covered: 0, total: 14 },
      doubleStarSpecificCoverage: { covered: 0, total: 24 },
      mutagenSpecificCoverage: { covered: 0, total: 0 },
      supportingStarCoverage: { covered: 0, total: 11 },
      structureRuleCoverage: { covered: 1, total: 15 },
    },
    warnings: ['warning:k0:fixture-partial'],
    readiness: 'partial',
  }
  return {
    ...withoutFingerprint,
    catalogFingerprint: createAiChartD1K0CatalogFingerprint(withoutFingerprint),
  }
}

function bundleFixture(catalog: AiChartD1K0Catalog) {
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
    selectedRules: catalog.rules,
    selectedMeanings: [
      {
        palaceRole: 'target',
        palaceId: 'palace:ming',
        meaningId: catalog.palaceMeanings[0].meaningId,
        text: catalog.palaceMeanings[0].text,
        contentSha256: catalog.palaceMeanings[0].contentSha256,
        order: 0,
      },
    ],
    selectionTrace: catalog.rules.map((entry) => ({
      ruleId: entry.ruleId,
      reason:
        entry.kind === 'single_star'
          ? 'major_star_present'
          : 'relationship_rule',
      palaceRole: 'target',
      palaceId: 'palace:ming',
      placementId:
        entry.kind === 'single_star' ? 'palace:ming:star:major:0' : null,
      starName: entry.kind === 'single_star' ? '紫微' : null,
      mutagenType: null,
      structuralReference: 'p1:view:target',
    })),
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

function run() {
  const catalog = catalogFixture()
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

run()
