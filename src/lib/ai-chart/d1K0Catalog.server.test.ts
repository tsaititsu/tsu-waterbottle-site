import assert from 'node:assert/strict'
import Module, { createRequire } from 'node:module'
import { AI_CHART_D1_LOCKED_MANIFEST_SHA256 } from './d1Assets'
import {
  AI_CHART_D1_K0_CATALOG_VERSION,
  AI_CHART_D1_K0_SOURCE_WHITELIST,
} from './d1K0Registry'
import {
  AI_CHART_D1_K0_RULE_KINDS,
  AI_CHART_D1_K0_SOURCE_AUTHORITIES,
} from './d1K0Contracts'
import {
  extractAiChartD1K0Markdown,
  AiChartD1K0AssetError,
} from './d1K0Markdown'

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

let checks = 0

function check(name: string, run: () => void) {
  run()
  checks += 1
  console.log(`✓ ${name}`)
}

async function run() {
  const first = await compileAiChartD1K0Catalog()
  const second = await compileAiChartD1K0Catalog()

  check('catalog version and manifest lock', () => {
    assert.equal(first.contractVersion, AI_CHART_D1_K0_CATALOG_VERSION)
    assert.equal(first.sourceManifestSha256, AI_CHART_D1_LOCKED_MANIFEST_SHA256)
    assert.equal(AI_CHART_D1_K0_SOURCE_WHITELIST.length, 9)
  })
  check('catalog output and fingerprint are deterministic', () => {
    assert.deepEqual(first, second)
    assert.equal(first.catalogFingerprint, second.catalogFingerprint)
  })
  check('twelve palace catalogs and unique meaning ids', () => {
    assert.equal(first.coverage.palaceMeaningCoverage.covered, 12)
    assert.equal(new Set(first.palaceMeanings.map((entry) => entry.palaceId)).size, 12)
    assert.equal(
      new Set(first.palaceMeanings.map((entry) => entry.meaningId)).size,
      first.palaceMeanings.length,
    )
  })
  check('fourteen canonical stars contain only approved fields', () => {
    const rules = first.rules.filter((rule) => rule.kind === 'single_star')
    assert.equal(rules.length, 14)
    for (const rule of rules) {
      assert.doesNotMatch(rule.content, /身體對應|家裡對應|待老師確認/)
      assert.equal(rule.sourceAuthority, 'formal_teacher_confirmed')
    }
  })
  check('double-star inventory remains complete without inference fill', () => {
    assert.equal(first.doubleStarInventory.length, 24)
    assert.equal(first.coverage.doubleStarSpecificCoverage.total, 24)
    assert.equal(
      first.doubleStarInventory.some(
        (entry) =>
          entry.specificRuleId === null &&
          entry.missingReason === 'missing_confirmed_double_star_core',
      ),
      true,
    )
    assert.equal(
      first.rules.some(
        (rule) => rule.kind === 'double_star' && rule.ruleStatus === 'working_inference',
      ),
      false,
    )
  })
  check('mutagen inventory and eleven supporting rules are complete', () => {
    assert.equal(first.mutagenInventory.length, 40)
    assert.equal(first.coverage.supportingStarCoverage.covered, 11)
    assert.equal(first.coverage.structureRuleCoverage.covered, 15)
  })
  check('rule integrity hashes and deterministic priority ordering', () => {
    assert.equal(new Set(first.rules.map((rule) => rule.ruleId)).size, first.rules.length)
    for (let index = 1; index < first.rules.length; index += 1) {
      const previous = first.rules[index - 1]
      const current = first.rules[index]
      assert.equal(
        previous.priority > current.priority ||
          (previous.priority === current.priority &&
            previous.ruleId.localeCompare(current.ruleId, 'en') <= 0),
        true,
      )
    }
  })
  check('unsafe D2 and health conclusions are absent', () => {
    const serialized = JSON.stringify(first.rules)
    assert.doesNotMatch(
      serialized,
      /車禍|官非|一定破財|一定離婚|癌症|糖尿病|中風/,
    )
  })
  check('locator fails closed for missing and ambiguous headings', () => {
    const base = {
      headingPath: [] as string[],
      headingLevel: 2 as const,
      exactHeading: '唯一',
      occurrenceIndex: 0,
      extractionMode: 'exact_section' as const,
      itemIndex: null,
      exactLabel: null,
      exactText: null,
    }
    assert.throws(
      () => extractAiChartD1K0Markdown('## 其他\n內容', base),
      AiChartD1K0AssetError,
    )
    assert.throws(
      () =>
        extractAiChartD1K0Markdown(
          '## 唯一\n第一\n## 唯一\n第二',
          { ...base, occurrenceIndex: 2 },
        ),
      AiChartD1K0AssetError,
    )
  })
  check('catalog is recursively frozen', () => {
    assert.equal(Object.isFrozen(first), true)
    assert.equal(Object.isFrozen(first.rules), true)
    assert.equal(Object.isFrozen(first.rules[0]), true)
  })
  console.log(`CATALOG_FINGERPRINT=${first.catalogFingerprint}`)
  console.log(`CATALOG_RULE_COUNT=${first.rules.length}`)
  for (const kind of AI_CHART_D1_K0_RULE_KINDS) {
    console.log(
      `RULE_KIND_${kind.toUpperCase()}=${first.rules.filter((rule) => rule.kind === kind).length}`,
    )
  }
  for (const authority of AI_CHART_D1_K0_SOURCE_AUTHORITIES) {
    console.log(
      `RULE_AUTHORITY_${authority.toUpperCase()}=${first.rules.filter((rule) => rule.sourceAuthority === authority).length}`,
    )
  }
  console.log(`PALACE_MEANING_COUNT=${first.palaceMeanings.length}`)
  console.log(`DOUBLE_STAR_INVENTORY=${first.doubleStarInventory.length}`)
  console.log(`MUTAGEN_INVENTORY=${first.mutagenInventory.length}`)
  console.log(`CATALOG_READINESS=${first.readiness}`)
  console.log(
    `PALACE_MEANING_COVERAGE=${first.coverage.palaceMeaningCoverage.covered}/${first.coverage.palaceMeaningCoverage.total}`,
  )
  console.log(
    `DOUBLE_STAR_SPECIFIC_COVERAGE=${first.coverage.doubleStarSpecificCoverage.covered}/${first.coverage.doubleStarSpecificCoverage.total}`,
  )
  console.log(
    `MUTAGEN_SPECIFIC_COVERAGE=${first.coverage.mutagenSpecificCoverage.covered}/${first.coverage.mutagenSpecificCoverage.total}`,
  )
  console.log(
    `SUPPORTING_STAR_COVERAGE=${first.coverage.supportingStarCoverage.covered}/${first.coverage.supportingStarCoverage.total}`,
  )
  console.log(
    `STRUCTURE_RULE_COVERAGE=${first.coverage.structureRuleCoverage.covered}/${first.coverage.structureRuleCoverage.total}`,
  )
  console.log(`\n${checks} K0 catalog checks passed.`)
}

void run()
