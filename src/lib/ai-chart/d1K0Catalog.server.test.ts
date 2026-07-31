import assert from 'node:assert/strict'
import Module, { createRequire } from 'node:module'
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { AI_CHART_D1_LOCKED_MANIFEST_SHA256 } from './d1Assets'
import {
  AI_CHART_D1_K0_CATALOG_VERSION,
  AI_CHART_D1_K0_EVENT_BOUNDARY,
  AI_CHART_D1_K0_MUTAGEN_EXPECTED_BULLET_COUNTS,
  AI_CHART_D1_K0_SOURCE_WHITELIST,
  AI_CHART_D1_K0_SUPPORTING_RULE_DEFINITIONS,
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

async function asyncCheck(name: string, run: () => Promise<void>) {
  await run()
  checks += 1
  console.log(`✓ ${name}`)
}

function contentObject(content: string): Record<string, unknown> {
  const value = JSON.parse(content) as unknown
  assert.equal(typeof value, 'object')
  assert.notEqual(value, null)
  assert.equal(Array.isArray(value), false)
  return value as Record<string, unknown>
}

function bullets(content: string): readonly string[] {
  const value = contentObject(content)
  assert.deepEqual(Object.keys(value), ['bullets'])
  assert.equal(Array.isArray(value.bullets), true)
  return value.bullets as string[]
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
  check('teacher supplements include only source-controlled D1 segments', () => {
    assert.deepEqual(first.coverage.singleStarTeacherSupplementCoverage, {
      covered: 12,
      total: 14,
    })
    const ziwei = first.rules.find((rule) => rule.ruleId === 'rule:star:ziwei:core')
    assert.ok(ziwei)
    const ziweiContent = contentObject(ziwei.content)
    assert.equal(Array.isArray(ziweiContent.老師補充D1), true)
    assert.match(JSON.stringify(ziweiContent.老師補充D1), /紫微的班底/)
    assert.equal(
      (ziweiContent.老師補充D1 as Record<string, unknown>[]).every(
        (segment) => segment.starName === '紫微',
      ),
      true,
    )
    for (const ruleId of ['rule:star:tianxiang:core', 'rule:star:qisha:core']) {
      const rule = first.rules.find((entry) => entry.ruleId === ruleId)
      assert.ok(rule)
      assert.equal('老師補充D1' in contentObject(rule.content), false)
    }
    const singleStarContent = JSON.stringify(
      first.rules.filter((rule) => rule.kind === 'single_star'),
    )
    assert.doesNotMatch(
      singleStarContent,
      /高樓|好地段|漂亮大樓|身體對應|家裡對應|待老師確認|具體官非事件留待大限、流年/,
    )
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
  check('Lianzhen Tanlang uses the teacher-confirmed abundant-romance core', () => {
    const inventory = first.doubleStarInventory.find(
      (entry) => entry.pairKey === 'pair:lianzhen-tanlang',
    )
    assert.ok(inventory)
    assert.equal(inventory.specificRuleStatus, 'teacher_confirmed')
    assert.equal(inventory.missingReason, null)
    assert.equal(inventory.specificRuleId, 'rule:double:lianzhen-tanlang:core')

    const rule = first.rules.find(
      (entry) => entry.ruleId === inventory.specificRuleId,
    )
    assert.ok(rule)
    assert.equal(rule.kind, 'double_star')
    assert.equal(rule.sourceAuthority, 'reasoning_teacher_confirmed')
    assert.deepEqual(bullets(rule.content), [
      '桃花很旺。容易吸引別人注意，異性緣、感情機會與被追求的機會通常較多。',
      '前星廉貞為主：會觀察場合、在意界線與原則，也會先判斷對方是否符合自己的選擇標準。',
      '後星貪狼為輔：以魅力、好奇心、話題、熱情、興趣與社交接觸，把廉貞的選擇與吸引力表現出來。',
      '桃花旺代表吸引力與機會較多，不等於一定花心、出軌或同時發展多段關係。',
      '沒有煞忌時的一般低強度失衡：可能太在意是否被喜歡、不易拒絕邀約，或容易被新鮮感分散注意力。',
      '只有實際煞忌成立時，才延伸為界線失衡、高風險或打破世俗規則的可能性。',
      '在人際對待宮位，前星可描述宮位人物，後星可描述命主的回應；仍須保留廉貞貪狼完整組合互動。',
      '本命先解價值觀與傾向；具體事件留待大限、流年。',
    ])
  })
  check('Ziwei lecture-backfill double-star work versions are source-bound rules', () => {
    const ziweiLectureBackfillPairs = [
      'pair:ziwei-tianfu',
      'pair:ziwei-qisha',
      'pair:ziwei-pojun',
      'pair:ziwei-tianxiang',
      'pair:ziwei-tanlang',
    ] as const

    for (const pairKey of ziweiLectureBackfillPairs) {
      const inventory = first.doubleStarInventory.find(
        (entry) => entry.pairKey === pairKey,
      )
      assert.ok(inventory)
      assert.equal(inventory.specificRuleStatus, 'lecture_backfill')
      assert.equal(inventory.missingReason, null)
      assert.ok(inventory.specificRuleId)

      const rule = first.rules.find(
        (entry) => entry.ruleId === inventory.specificRuleId,
      )
      assert.ok(rule)
      assert.equal(rule.kind, 'double_star')
      assert.equal(rule.ruleStatus, 'lecture_backfill')
      assert.equal(rule.sourceAuthority, 'lecture_backfill')
      assert.equal(rule.selectionTags.includes('double:lecture-backfill-core'), true)
      assert.doesNotMatch(rule.content, /待老師補充|尚未完整定稿/u)
    }
  })
  check('mutagen inventory preserves every source bullet in all forty sections', () => {
    assert.equal(first.mutagenInventory.length, 40)
    assert.deepEqual(first.coverage.mutagenSpecificCoverage, {
      covered: 40,
      total: 40,
    })
    for (const item of first.mutagenInventory) {
      assert.ok(item.specificRuleId)
      const rule = first.rules.find((entry) => entry.ruleId === item.specificRuleId)
      assert.ok(rule)
      const heading = `${item.starName}${item.mutagenType}`
      assert.equal(
        bullets(rule.content).length,
        AI_CHART_D1_K0_MUTAGEN_EXPECTED_BULLET_COUNTS[
          heading as keyof typeof AI_CHART_D1_K0_MUTAGEN_EXPECTED_BULLET_COUNTS
        ],
      )
    }
    const expectedFragments = {
      'rule:mutagen:pojun:quan': '禁止延伸：化權只代表想掌握與主導，不代表改革一定成功。',
      'rule:mutagen:tianliang:quan': '風險：若煞忌集中，可能過度管教、說教或把自己的經驗當成唯一答案。',
      'rule:mutagen:tiantong:quan': '風險：化權不等於強硬；需配合宮位與煞忌判斷是否變成任性或只照自己舒服的方式。',
      'rule:mutagen:taiyang:quan': '風險：需配合煞忌判斷是否主導過強、要求別人照做或承擔過多。',
      'rule:mutagen:tianxiang:ji': '具體官非事件留待大限、流年。',
      'rule:mutagen:wenchang:ji': '明確排除：不固定解為「反覆修改」。',
      'rule:mutagen:wuqu:ji': '財帛宮：可能小氣，也會很認真賺錢；本命先解價值觀，不先斷賺大錢。',
    } as const
    for (const [ruleId, fragment] of Object.entries(expectedFragments)) {
      const rule = first.rules.find((entry) => entry.ruleId === ruleId)
      assert.ok(rule)
      assert.equal(bullets(rule.content).includes(fragment), true)
    }
  })
  check('eleven supporting rules preserve their full expected bullet blocks', () => {
    assert.deepEqual(first.coverage.supportingStarCoverage, {
      covered: 11,
      total: 11,
    })
    for (const definition of AI_CHART_D1_K0_SUPPORTING_RULE_DEFINITIONS) {
      const matchingRule = first.rules.find(
        (entry) =>
          entry.kind === 'supporting_star' &&
          entry.title === `${definition.starName}核心`,
      )
      assert.ok(matchingRule)
      assert.deepEqual(bullets(matchingRule.content), definition.expectedBullets)
    }
  })
  check('event boundary is complete negative context and structure gap is honest', () => {
    const rule = first.rules.find(
      (entry) => entry.ruleId === 'rule:common:d1-event-boundary',
    )
    assert.ok(rule)
    assert.deepEqual(contentObject(rule.content), AI_CHART_D1_K0_EVENT_BOUNDARY)
    assert.deepEqual(first.coverage.structureRuleCoverage, {
      covered: 14,
      total: 15,
    })
    assert.equal(
      first.rules.some(
        (entry) => entry.ruleId === 'rule:structure:opposite-empty',
      ),
      false,
    )
    assert.equal(first.warnings.includes('warning:k0:missing-opposite-empty-rule'), true)
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
  check('unsafe terms occur only in exact negative boundary contexts', () => {
    const ordinary = JSON.stringify(
      first.rules.filter(
        (rule) =>
          rule.ruleId !== 'rule:common:d1-event-boundary' &&
          rule.ruleId !== 'rule:mutagen:tianxiang:ji' &&
          rule.ruleId !== 'rule:double:ziwei-tianxiang:core',
      ),
    )
    assert.doesNotMatch(
      ordinary,
      /車禍|官非|一定破財|一定離婚|癌症|糖尿病|中風/,
    )
    const tianxiangJi = first.rules.find(
      (rule) => rule.ruleId === 'rule:mutagen:tianxiang:ji',
    )
    assert.ok(tianxiangJi)
    assert.equal(
      bullets(tianxiangJi.content).includes('具體官非事件留待大限、流年。'),
      true,
    )
    const ziweiTianxiang = first.rules.find(
      (rule) => rule.ruleId === 'rule:double:ziwei-tianxiang:core',
    )
    assert.ok(ziweiTianxiang)
    assert.equal(
      bullets(ziweiTianxiang.content).some((bullet) =>
        bullet.includes('不直接斷官非'),
      ),
      true,
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
        extractAiChartD1K0Markdown('## 唯一\n核心：\n', {
          ...base,
          extractionMode: 'exact_labeled_bullet_block',
          exactLabel: '核心',
        }),
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
  const mutationRoot = await mkdtemp(join(tmpdir(), 'ai-chart-d1-k0-semantic-'))
  try {
    const cases = [
      {
        name: 'supporting bullet deletion',
        path: 'content/ai-chart/d1-v1/knowledge/reasoning/14_D1_輔星煞星貴人星祿存.md',
        oldText: '- 讀書、考試、正途功名、制度認可。\n',
        newText: '',
      },
      {
        name: 'event boundary bullet deletion',
        path: 'content/ai-chart/d1-v1/knowledge/reasoning/10_D1_全盤掃描與煞忌權重.md',
        oldText: '- 一定破財、車禍、官非或疾病。\n',
        newText: '',
      },
      {
        name: 'mutagen bullet deletion',
        path: 'content/ai-chart/d1-v1/knowledge/reasoning/07_四化正式規格_工作版.md',
        oldText: '- 禁止延伸：化權只代表想掌握與主導，不代表改革一定成功。\n',
        newText: '',
      },
      {
        name: 'teacher supplement one-character mutation',
        path: 'content/ai-chart/d1-v1/knowledge/core/紫微斗數知識庫_v1.2_A_十四主星核心字典_正式定稿版.json',
        oldText: '紫微的班底可看',
        newText: '紫微之班底可看',
      },
    ] as const
    for (const [index, testCase] of cases.entries()) {
      await asyncCheck(`${testCase.name} fails closed`, async () => {
        const projectRoot = join(mutationRoot, String(index))
        const assetRoot = 'content/ai-chart/d1-v1'
        await mkdir(dirname(join(projectRoot, assetRoot)), { recursive: true })
        await cp(join(process.cwd(), assetRoot), join(projectRoot, assetRoot), {
          recursive: true,
        })
        const path = join(projectRoot, testCase.path)
        const source = await readFile(path, 'utf8')
        assert.equal(source.split(testCase.oldText).length, 2)
        await writeFile(path, source.replace(testCase.oldText, testCase.newText))
        await assert.rejects(
          () => compileAiChartD1K0Catalog({ projectRoot }),
          { message: 'ai_chart_d1_k0_asset_invalid' },
        )
      })
    }
  } finally {
    await rm(mutationRoot, { recursive: true, force: true })
  }
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
    `SINGLE_STAR_TEACHER_SUPPLEMENT_COVERAGE=${first.coverage.singleStarTeacherSupplementCoverage.covered}/${first.coverage.singleStarTeacherSupplementCoverage.total}`,
  )
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
