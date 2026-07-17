import 'server-only'

import { MUTAGEN_TABLE } from '../../features/ziwei-chart/lib/engine/constants'
import {
  AI_CHART_D1_ASSET_MANIFEST_VERSION,
  AI_CHART_D1_LOCKED_MANIFEST_SHA256,
} from './d1Assets'
import {
  readVerifiedAiChartD1CompilationAssets,
  type AiChartD1VerifiedCompilationAsset,
} from './d1Assets.server'
import {
  AI_CHART_D1_K0_D1_SAFETY,
  compareAiChartD1K0Rules,
  createAiChartD1K0CatalogFingerprint,
  hashAiChartD1K0Content,
  parseAiChartD1K0Catalog,
  type AiChartD1K0Catalog,
  type AiChartD1K0Rule,
  type AiChartD1K0RuleKind,
  type AiChartD1K0SourceAuthority,
  type AiChartD1K0SourceLocator,
} from './d1K0Contracts'
import {
  extractAiChartD1K0Markdown,
  hasAiChartD1K0ExactMarkdownHeading,
} from './d1K0Markdown'
import {
  AI_CHART_D1_K0_CATALOG_ID,
  AI_CHART_D1_K0_CATALOG_VERSION,
  AI_CHART_D1_K0_COMPILED_AT_POLICY,
  AI_CHART_D1_K0_DOUBLE_RULE_DEFINITIONS,
  AI_CHART_D1_K0_DOUBLE_STAR_INVENTORY,
  AI_CHART_D1_K0_MAJOR_STAR_NAMES,
  AI_CHART_D1_K0_MUTAGEN_SLUGS,
  AI_CHART_D1_K0_PALACE_MEANING_DEFINITIONS,
  AI_CHART_D1_K0_SOURCE_AUTHORITY_PRIORITIES,
  AI_CHART_D1_K0_SOURCE_FILES,
  AI_CHART_D1_K0_SOURCE_SHA256,
  AI_CHART_D1_K0_SOURCE_WHITELIST,
  AI_CHART_D1_K0_STAR_SLUGS,
  AI_CHART_D1_K0_STRUCTURE_RULE_DEFINITIONS,
  AI_CHART_D1_K0_SUPPORTING_RULE_DEFINITIONS,
  AI_CHART_D1_K0_SUPPORTING_STAR_NAMES,
  createAiChartD1K0DoubleLocator,
  createAiChartD1K0SupportingLocator,
  getAiChartD1K0StarSlug,
  type AiChartD1K0MarkdownLocatorDefinition,
} from './d1K0Registry'
import type {
  AiChartD1MajorStarName,
  AiChartD1MutagenType,
} from './d1N0Constants'

type CompileAiChartD1K0CatalogOptions = Readonly<{
  projectRoot?: string
}>

const SOURCE_STAR_FIELDS = Object.freeze([
  'name',
  'status',
  '定位',
  '化氣',
  '核心',
  '正常狀態',
  '狀態不好',
  '無煞忌時',
  '有煞忌時',
  '客戶白話',
  '不可只解成',
  '身體對應',
  '家裡對應',
  '老師補充',
  '待老師確認',
  '來源',
] as const)
const SELECTED_STAR_FIELDS = Object.freeze([
  '定位',
  '化氣',
  '核心',
  '正常狀態',
  '狀態不好',
  '無煞忌時',
  '有煞忌時',
  '客戶白話',
  '不可只解成',
] as const)

const PALACE_SOURCE_ORDER = Object.freeze([
  'palace:ming',
  'palace:parents',
  'palace:fortune',
  'palace:property',
  'palace:career',
  'palace:friends',
  'palace:travel',
  'palace:health',
  'palace:wealth',
  'palace:children',
  'palace:spouse',
  'palace:siblings',
] as const)

const FORBIDDEN_SELECTED_CONTENT = Object.freeze([
  '車禍',
  '官非',
  '一定破財',
  '一定離婚',
  '一定懷孕',
  '一定不孕',
  '癌症',
  '糖尿病',
  '中風',
  '不易懷孕',
] as const)

const MEANING_SLUGS: Readonly<Record<string, string>> = Object.freeze({
  個性: 'personality', 價值觀: 'values', 能力: 'ability', 長相: 'appearance', 遷移宮的內心: 'travel-inner-state', '影響 12 宮': 'twelve-palace-influence',
  父親: 'father', 身體遺傳: 'physical-inheritance', 身體的使用方式: 'body-use-pattern',
  靈魂: 'inner-spirit', 來財方式: 'wealth-arrival', 老年生活: 'later-life', 社會價值觀: 'social-values', 花錢方式: 'spending-style', 潛意識: 'subconscious', 福份: 'fortune-capacity', 運氣: 'luck',
  居住環境: 'living-environment', 家人相處方式: 'family-interaction', 財庫: 'wealth-storage', 家世背景: 'family-background', 風水: 'fengshui-domain',
  '工作態度／方向／同事相處方式': 'work-attitude-direction-colleagues', 感情對象類型: 'partner-type', 生活重心: 'life-focus', 感情內心: 'relationship-inner-state',
  異性別兄弟姐妹: 'opposite-gender-siblings', 同事: 'colleagues', 朋友: 'friends', 平輩關係: 'peer-relations',
  在外人際關係: 'external-relations', 內心想法: 'inner-thoughts', 外界對我的看法: 'public-perception',
  健康: 'health-domain',
  對錢的看法: 'money-view', 理財方式: 'financial-management', 賺錢的方式: 'earning-style', 用錢的方式: 'money-use',
  '對子女／寵物的教養方式': 'children-pets-parenting', 性生活: 'sexual-life-domain', 吃喝享樂的方式: 'enjoyment-style', 所有物: 'possessions', 家的外面: 'outside-home',
  '感情的態度／對待方式': 'relationship-attitude', 喜歡怎樣的人: 'preferred-partner', 工作在外的狀況: 'work-external-state',
  媽媽: 'mother', 同性別兄弟姐妹: 'same-gender-siblings', 新認識的朋友: 'new-friends',
})

function invalid(): never {
  throw new Error('ai_chart_d1_k0_asset_invalid')
}

function exactObject(
  value: unknown,
  fields: readonly string[],
): Record<string, unknown> {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    invalid()
  }
  const record = value as Record<string, unknown>
  const keys = Object.keys(record)
  if (
    keys.length !== fields.length ||
    keys.some((key) => !fields.includes(key)) ||
    fields.some((field) => !Object.prototype.hasOwnProperty.call(record, field))
  ) {
    invalid()
  }
  return record
}

function assetMap(
  assets: readonly AiChartD1VerifiedCompilationAsset[],
): ReadonlyMap<string, AiChartD1VerifiedCompilationAsset> {
  if (assets.length !== AI_CHART_D1_K0_SOURCE_WHITELIST.length) invalid()
  const map = new Map(assets.map((asset) => [asset.path, asset] as const))
  for (const path of AI_CHART_D1_K0_SOURCE_WHITELIST) {
    const asset = map.get(path)
    if (
      !asset ||
      asset.sha256 !==
        AI_CHART_D1_K0_SOURCE_SHA256[
          path as keyof typeof AI_CHART_D1_K0_SOURCE_SHA256
        ]
    ) {
      invalid()
    }
  }
  return map
}

function markdownLocator(
  locator: AiChartD1K0MarkdownLocatorDefinition,
): AiChartD1K0SourceLocator {
  return Object.freeze({
    sourceType: 'markdown',
    headingPath: Object.freeze([...locator.headingPath]),
    headingLevel: locator.headingLevel,
    exactHeading: locator.exactHeading,
    occurrenceIndex: locator.occurrenceIndex,
    extractionMode: locator.extractionMode,
    itemIndex: locator.itemIndex,
    exactLabel: locator.exactLabel,
    exactText: locator.exactText,
    jsonPath: null,
    jsonMatchField: null,
    jsonMatchValue: null,
  })
}

function jsonStarLocator(starName: string): AiChartD1K0SourceLocator {
  return Object.freeze({
    sourceType: 'json',
    headingPath: Object.freeze([]),
    headingLevel: 0,
    exactHeading: null,
    occurrenceIndex: 0,
    extractionMode: 'exact_line',
    itemIndex: null,
    exactLabel: null,
    exactText: null,
    jsonPath: 'stars',
    jsonMatchField: 'name',
    jsonMatchValue: starName,
  })
}

function createRule(input: Readonly<{
  ruleId: string
  kind: AiChartD1K0RuleKind
  title: string
  content: string
  ruleStatus: 'teacher_confirmed' | 'lecture_backfill' | 'working_inference'
  sourceAuthority: AiChartD1K0SourceAuthority
  sourceFile: string
  sourceFileSha256: string
  sourceLocator: AiChartD1K0SourceLocator
  appliesTo: readonly string[]
  selectionTags: readonly string[]
}>): AiChartD1K0Rule {
  return Object.freeze({
    ...input,
    contentSha256: hashAiChartD1K0Content(input.content),
    priority: AI_CHART_D1_K0_SOURCE_AUTHORITY_PRIORITIES[input.sourceAuthority],
    d1Safety: AI_CHART_D1_K0_D1_SAFETY,
    appliesTo: Object.freeze([...input.appliesTo]),
    selectionTags: Object.freeze([...input.selectionTags]),
  })
}

function compileSingleStarRules(
  asset: AiChartD1VerifiedCompilationAsset,
): readonly AiChartD1K0Rule[] {
  const parsed = JSON.parse(asset.text) as unknown
  const root = exactObject(parsed, [
    'schema_version', 'version', 'updated_at', 'status', 'scope',
    'source_priority', 'source_coverage', 'stars', 'global_questions',
    'deferred_rules', 'codex_rules',
  ])
  if (
    root.schema_version !== 'ziwei_A_core_v1.2_final' ||
    root.version !== '1.2' ||
    root.status !== '十四主星老師確認正式定稿版' ||
    root.scope !== 'single_star_core_only' ||
    !Array.isArray(root.stars) ||
    root.stars.length !== AI_CHART_D1_K0_MAJOR_STAR_NAMES.length
  ) {
    invalid()
  }
  const seen = new Set<string>()
  const rules = root.stars.map((value) => {
    const star = exactObject(value, SOURCE_STAR_FIELDS)
    if (
      typeof star.name !== 'string' ||
      !AI_CHART_D1_K0_MAJOR_STAR_NAMES.includes(
        star.name as AiChartD1MajorStarName,
      ) ||
      seen.has(star.name) ||
      (star.status !== '老師已確認' &&
        star.status !== '老師確認正式定稿')
    ) {
      invalid()
    }
    seen.add(star.name)
    const content: Record<string, string> = {}
    for (const field of SELECTED_STAR_FIELDS) {
      if (typeof star[field] !== 'string' || star[field].length === 0) invalid()
      const fieldValue = star[field] as string
      if (
        !FORBIDDEN_SELECTED_CONTENT.some((term) => fieldValue.includes(term))
      ) {
        content[field] = fieldValue
      }
    }
    const slug = getAiChartD1K0StarSlug(star.name)
    if (!slug) invalid()
    return createRule({
      ruleId: `rule:star:${slug}:core`,
      kind: 'single_star',
      title: `${star.name}核心`,
      content: JSON.stringify(content),
      ruleStatus: 'teacher_confirmed',
      sourceAuthority: 'formal_teacher_confirmed',
      sourceFile: asset.path,
      sourceFileSha256: asset.sha256,
      sourceLocator: jsonStarLocator(star.name),
      appliesTo: [`star:${slug}`],
      selectionTags: [`star:${slug}`, 'scope:d1-personality'],
    })
  })
  if (seen.size !== AI_CHART_D1_K0_MAJOR_STAR_NAMES.length) invalid()
  return Object.freeze(rules)
}

function compilePalaces(asset: AiChartD1VerifiedCompilationAsset): Readonly<{
  rules: readonly AiChartD1K0Rule[]
  meanings: readonly AiChartD1K0Catalog['palaceMeanings'][number][]
}> {
  const rules: AiChartD1K0Rule[] = []
  const meanings: AiChartD1K0Catalog['palaceMeanings'][number][] = []
  for (const [palaceId, palaceName, sourceLine, meaningTexts] of
    AI_CHART_D1_K0_PALACE_MEANING_DEFINITIONS) {
    const sourceIndex = PALACE_SOURCE_ORDER.indexOf(palaceId)
    if (sourceIndex < 0) invalid()
    const definition: AiChartD1K0MarkdownLocatorDefinition = Object.freeze({
      headingPath: Object.freeze([]),
      headingLevel: 2,
      exactHeading: '一、十二宮分面（每宮看什麼）',
      occurrenceIndex: 0,
      extractionMode: 'exact_bullet',
      itemIndex: sourceIndex,
      exactLabel: null,
      exactText: sourceLine,
    })
    const extracted = extractAiChartD1K0Markdown(asset.text, definition)
    if (extracted !== sourceLine) invalid()
    const palaceSlug = palaceId.slice('palace:'.length)
    rules.push(createRule({
      ruleId: `rule:palace:${palaceSlug}:meanings`,
      kind: 'palace_meaning',
      title: `${palaceName}基本分面`,
      content: sourceLine,
      ruleStatus: 'teacher_confirmed',
      sourceAuthority: 'reasoning_confirmed',
      sourceFile: asset.path,
      sourceFileSha256: asset.sha256,
      sourceLocator: markdownLocator(definition),
      appliesTo: [palaceId],
      selectionTags: [`palace:${palaceSlug}`, 'palace:meanings'],
    }))
    meaningTexts.forEach((text, order) => {
      const slug = MEANING_SLUGS[text]
      if (!slug || !sourceLine.includes(text)) invalid()
      meanings.push(Object.freeze({
        meaningId: `meaning:palace:${palaceSlug}:${slug}`,
        palaceId,
        text,
        contentSha256: hashAiChartD1K0Content(text),
        order,
        sourceFile: asset.path,
        sourceFileSha256: asset.sha256,
        sourceLocator: markdownLocator(definition),
      }))
    })
  }
  return Object.freeze({ rules: Object.freeze(rules), meanings: Object.freeze(meanings) })
}

function compileDoubleStars(asset: AiChartD1VerifiedCompilationAsset): Readonly<{
  rules: readonly AiChartD1K0Rule[]
  inventory: AiChartD1K0Catalog['doubleStarInventory']
}> {
  const definitions = new Map(
    AI_CHART_D1_K0_DOUBLE_RULE_DEFINITIONS.map((definition) => [definition.pairKey, definition]),
  )
  const rules: AiChartD1K0Rule[] = []
  const inventory = AI_CHART_D1_K0_DOUBLE_STAR_INVENTORY.map((item) => {
    const definition = definitions.get(item.pairKey)
    if (!definition) {
      return Object.freeze({
        ...item,
        specificRuleStatus: null,
        specificRuleId: null,
        missingReason: 'missing_confirmed_double_star_core' as const,
      })
    }
    const locator = createAiChartD1K0DoubleLocator(definition)
    const content = extractAiChartD1K0Markdown(asset.text, locator)
    const pairSlug = item.pairKey.slice('pair:'.length)
    const ruleId = `rule:double:${pairSlug}:core`
    rules.push(createRule({
      ruleId,
      kind: 'double_star',
      title: `${item.leftStar}${item.rightStar}固定核心`,
      content,
      ruleStatus: 'teacher_confirmed',
      sourceAuthority: definition.sourceAuthority,
      sourceFile: asset.path,
      sourceFileSha256: asset.sha256,
      sourceLocator: markdownLocator(locator),
      appliesTo: [`pair:${pairSlug}`],
      selectionTags: [`pair:${pairSlug}`, 'double:confirmed-core'],
    }))
    return Object.freeze({
      ...item,
      specificRuleStatus: 'teacher_confirmed' as const,
      specificRuleId: ruleId,
      missingReason: null,
    })
  })
  return Object.freeze({ rules: Object.freeze(rules), inventory: Object.freeze(inventory) })
}

function mutagenLocator(
  starName: string,
  mutagenType: AiChartD1MutagenType,
): AiChartD1K0MarkdownLocatorDefinition {
  const exactHeading = `${starName}${mutagenType}`
  if (mutagenType === '化忌') {
    return Object.freeze({ headingPath: Object.freeze(['二、化忌專屬規則（已確認）']), headingLevel: 3, exactHeading, occurrenceIndex: 0, extractionMode: 'exact_labeled_bullets', itemIndex: null, exactLabel: '專屬表現', exactText: null })
  }
  if (mutagenType === '化祿') {
    return Object.freeze({ headingPath: Object.freeze(['三、化祿專屬規則（已確認工作版）']), headingLevel: 3, exactHeading, occurrenceIndex: 0, extractionMode: 'exact_section', itemIndex: null, exactLabel: null, exactText: null })
  }
  const parent = mutagenType === '化權'
    ? '四、化權專屬規則（講義核心回填工作版）'
    : '五、化科專屬規則（講義核心回填工作版）'
  const exactLabel =
    (starName === '天機' && mutagenType === '化權') ||
    (starName === '文昌' && mutagenType === '化科')
      ? '已確認推導'
      : '工作版推導'
  return Object.freeze({ headingPath: Object.freeze([parent]), headingLevel: 3, exactHeading, occurrenceIndex: 0, extractionMode: 'exact_labeled_bullets', itemIndex: null, exactLabel, exactText: null })
}

function compileMutagens(asset: AiChartD1VerifiedCompilationAsset): Readonly<{
  rules: readonly AiChartD1K0Rule[]
  inventory: AiChartD1K0Catalog['mutagenInventory']
}> {
  const rules: AiChartD1K0Rule[] = []
  const commonTypes = ['化祿', '化權', '化科', '化忌'] as const
  commonTypes.forEach((mutagenType, itemIndex) => {
    const locator: AiChartD1K0MarkdownLocatorDefinition = Object.freeze({
      headingPath: Object.freeze([]), headingLevel: 2,
      exactHeading: '一、共通推理公式', occurrenceIndex: 0,
      extractionMode: 'exact_bullet', itemIndex, exactLabel: null,
      exactText: [
        '化祿：命主因使用主星核心，在該宮位領域得到多出的機會、資源或好處。',
        '化權：命主因使用主星核心，在該宮位領域掌握權力、主導權或責任。',
        '化科：命主因使用主星核心，在該宮位領域得到彰顯、名聲。',
        '化忌：主星核心與宮位領域存在空缺，因此命主持續追求與補足。',
      ][itemIndex],
    })
    rules.push(createRule({
      ruleId: `rule:mutagen:common:${AI_CHART_D1_K0_MUTAGEN_SLUGS[mutagenType]}`,
      kind: 'natal_mutagen',
      title: `${mutagenType}共通公式`,
      content: extractAiChartD1K0Markdown(asset.text, locator),
      ruleStatus: 'teacher_confirmed', sourceAuthority: 'reasoning_confirmed',
      sourceFile: asset.path, sourceFileSha256: asset.sha256,
      sourceLocator: markdownLocator(locator),
      appliesTo: [`mutagen:${AI_CHART_D1_K0_MUTAGEN_SLUGS[mutagenType]}`],
      selectionTags: [`mutagen:${AI_CHART_D1_K0_MUTAGEN_SLUGS[mutagenType]}`, 'mutagen:common'],
    }))
  })

  const assignments = new Map<string, { starName: string; mutagenType: AiChartD1MutagenType }>()
  for (const row of MUTAGEN_TABLE) {
    row.forEach((starName, index) => {
      const mutagenType = commonTypes[index]
      assignments.set(`${starName}\u0000${mutagenType}`, { starName, mutagenType })
    })
  }
  const inventory = [...assignments.values()]
    .sort((left, right) => {
      const leftSlug = getAiChartD1K0StarSlug(left.starName)
      const rightSlug = getAiChartD1K0StarSlug(right.starName)
      if (!leftSlug || !rightSlug) invalid()
      return (
        leftSlug.localeCompare(rightSlug, 'en') ||
        commonTypes.indexOf(left.mutagenType) -
          commonTypes.indexOf(right.mutagenType)
      )
    })
    .map(({ starName, mutagenType }) => {
      const locator = mutagenLocator(starName, mutagenType)
      if (!hasAiChartD1K0ExactMarkdownHeading(asset.text, 3, locator.exactHeading)) {
        return Object.freeze({
          starName, mutagenType, specificRuleId: null,
          sourceAuthority: null, missingReason: 'missing_specific_mutagen_rule' as const,
        })
      }
      const slug = getAiChartD1K0StarSlug(starName)
      if (!slug) invalid()
      const mutagenSlug = AI_CHART_D1_K0_MUTAGEN_SLUGS[mutagenType]
      const ruleId = `rule:mutagen:${slug}:${mutagenSlug}`
      const sourceAuthority: AiChartD1K0SourceAuthority =
        mutagenType === '化忌' ||
        mutagenType === '化祿' ||
        (starName === '天機' && mutagenType === '化權') ||
        (starName === '文昌' && mutagenType === '化科')
          ? 'reasoning_confirmed'
          : 'lecture_backfill'
      rules.push(createRule({
        ruleId, kind: 'natal_mutagen', title: `${starName}${mutagenType}`,
        content: extractAiChartD1K0Markdown(asset.text, locator),
        ruleStatus: sourceAuthority === 'lecture_backfill' ? 'lecture_backfill' : 'teacher_confirmed',
        sourceAuthority, sourceFile: asset.path, sourceFileSha256: asset.sha256,
        sourceLocator: markdownLocator(locator),
        appliesTo: [`star:${slug}`, `mutagen:${mutagenSlug}`],
        selectionTags: [`star:${slug}`, `mutagen:${mutagenSlug}`, 'mutagen:specific'],
      }))
      return Object.freeze({
        starName, mutagenType, specificRuleId: ruleId,
        sourceAuthority, missingReason: null,
      })
    })
  return Object.freeze({ rules: Object.freeze(rules), inventory: Object.freeze(inventory) })
}

function compileSupporting(asset: AiChartD1VerifiedCompilationAsset): readonly AiChartD1K0Rule[] {
  return Object.freeze(AI_CHART_D1_K0_SUPPORTING_RULE_DEFINITIONS.map((definition) => {
    const locator = createAiChartD1K0SupportingLocator(definition)
    const slug = AI_CHART_D1_K0_STAR_SLUGS[definition.starName]
    return createRule({
      ruleId: `rule:supporting:${slug}:core`, kind: 'supporting_star',
      title: `${definition.starName}核心`,
      content: extractAiChartD1K0Markdown(asset.text, locator),
      ruleStatus: 'teacher_confirmed',
      sourceAuthority: 'reasoning_confirmed', sourceFile: asset.path,
      sourceFileSha256: asset.sha256, sourceLocator: markdownLocator(locator),
      appliesTo: [`star:${slug}`], selectionTags: [`star:${slug}`, 'supporting:core'],
    })
  }))
}

function compileStructure(
  assets: ReadonlyMap<string, AiChartD1VerifiedCompilationAsset>,
): readonly AiChartD1K0Rule[] {
  return Object.freeze(AI_CHART_D1_K0_STRUCTURE_RULE_DEFINITIONS.map((definition) => {
    const asset = assets.get(definition.sourceFile)
    if (!asset) invalid()
    return createRule({
      ruleId: definition.ruleId, kind: definition.kind, title: definition.title,
      content: extractAiChartD1K0Markdown(asset.text, definition.locator),
      ruleStatus: 'teacher_confirmed', sourceAuthority: 'reasoning_confirmed',
      sourceFile: asset.path, sourceFileSha256: asset.sha256,
      sourceLocator: markdownLocator(definition.locator),
      appliesTo: [definition.selectionTag], selectionTags: [definition.selectionTag],
    })
  }))
}

function assertSafeSelectedContent(rules: readonly AiChartD1K0Rule[]): void {
  if (
    rules.some((rule) =>
      FORBIDDEN_SELECTED_CONTENT.some((term) => rule.content.includes(term)),
    )
  ) {
    invalid()
  }
}

async function compileCatalog(
  options: CompileAiChartD1K0CatalogOptions,
): Promise<AiChartD1K0Catalog> {
  const verifiedAssets = await readVerifiedAiChartD1CompilationAssets(
    AI_CHART_D1_K0_SOURCE_WHITELIST,
    { projectRoot: options.projectRoot, allowedPaths: AI_CHART_D1_K0_SOURCE_WHITELIST },
  )
  const assets = assetMap(verifiedAssets)
  const starsAsset = assets.get(AI_CHART_D1_K0_SOURCE_FILES.stars)
  const palacesAsset = assets.get(AI_CHART_D1_K0_SOURCE_FILES.palaces)
  const doublesAsset = assets.get(AI_CHART_D1_K0_SOURCE_FILES.doubles)
  const mutagensAsset = assets.get(AI_CHART_D1_K0_SOURCE_FILES.mutagens)
  const supportingAsset = assets.get(AI_CHART_D1_K0_SOURCE_FILES.supporting)
  if (!starsAsset || !palacesAsset || !doublesAsset || !mutagensAsset || !supportingAsset) invalid()

  const stars = compileSingleStarRules(starsAsset)
  const palaces = compilePalaces(palacesAsset)
  const doubles = compileDoubleStars(doublesAsset)
  const mutagens = compileMutagens(mutagensAsset)
  const supporting = compileSupporting(supportingAsset)
  const structure = compileStructure(assets)
  const rules = Object.freeze([
    ...stars, ...palaces.rules, ...doubles.rules, ...mutagens.rules,
    ...supporting, ...structure,
  ].sort(compareAiChartD1K0Rules))
  if (new Set(rules.map((rule) => rule.ruleId)).size !== rules.length) invalid()
  assertSafeSelectedContent(rules)

  const coverage = Object.freeze({
    palaceMeaningCoverage: Object.freeze({ covered: 12, total: 12 }),
    singleStarCoverage: Object.freeze({ covered: stars.length, total: 14 }),
    doubleStarSpecificCoverage: Object.freeze({ covered: doubles.rules.length, total: 24 }),
    mutagenSpecificCoverage: Object.freeze({
      covered: mutagens.inventory.filter((entry) => entry.specificRuleId !== null).length,
      total: mutagens.inventory.length,
    }),
    supportingStarCoverage: Object.freeze({ covered: supporting.length, total: 11 }),
    structureRuleCoverage: Object.freeze({
      covered: structure.length,
      total: AI_CHART_D1_K0_STRUCTURE_RULE_DEFINITIONS.length,
    }),
  })
  if (
    stars.length !== 14 ||
    supporting.length !== AI_CHART_D1_K0_SUPPORTING_STAR_NAMES.length ||
    palaces.rules.length !== 12 ||
    doubles.inventory.length !== 24
  ) {
    invalid()
  }
  const partial =
    coverage.doubleStarSpecificCoverage.covered < coverage.doubleStarSpecificCoverage.total ||
    coverage.mutagenSpecificCoverage.covered < coverage.mutagenSpecificCoverage.total
  const warnings = Object.freeze([
    ...(coverage.doubleStarSpecificCoverage.covered < coverage.doubleStarSpecificCoverage.total
      ? ['warning:k0:missing-double-star-specific']
      : []),
    ...(coverage.mutagenSpecificCoverage.covered < coverage.mutagenSpecificCoverage.total
      ? ['warning:k0:missing-mutagen-specific']
      : []),
  ])
  const withoutFingerprint: Omit<AiChartD1K0Catalog, 'catalogFingerprint'> = {
    contractVersion: AI_CHART_D1_K0_CATALOG_VERSION,
    catalogId: AI_CHART_D1_K0_CATALOG_ID,
    sourceManifestVersion: AI_CHART_D1_ASSET_MANIFEST_VERSION,
    sourceManifestSha256: AI_CHART_D1_LOCKED_MANIFEST_SHA256,
    compiledAtPolicy: AI_CHART_D1_K0_COMPILED_AT_POLICY,
    rules,
    palaceMeanings: palaces.meanings,
    doubleStarInventory: doubles.inventory,
    mutagenInventory: mutagens.inventory,
    coverage,
    warnings,
    readiness: partial ? 'partial' : 'ready',
  }
  const catalogValue = {
    ...withoutFingerprint,
    catalogFingerprint: createAiChartD1K0CatalogFingerprint(withoutFingerprint),
  }
  return parseAiChartD1K0Catalog(catalogValue)
}

export async function compileAiChartD1K0Catalog(
  options: CompileAiChartD1K0CatalogOptions = {},
): Promise<AiChartD1K0Catalog> {
  try {
    return await compileCatalog(options)
  } catch {
    invalid()
  }
}
