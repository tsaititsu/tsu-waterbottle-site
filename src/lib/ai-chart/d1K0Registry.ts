import {
  AI_CHART_D1_DOUBLE_MAJOR_STAR_PAIRS,
  AI_CHART_D1_MAJOR_STAR_NAMES,
  AI_CHART_D1_MODELED_SUPPORTING_STARS,
  AI_CHART_D1_PALACE_IDENTITIES,
  type AiChartD1MajorStarName,
  type AiChartD1ModeledSupportingStarName,
  type AiChartD1PalaceId,
} from './d1N0Constants'

export const AI_CHART_D1_K0_CATALOG_VERSION =
  'ai-chart-d1-k0-catalog/v1' as const
export const AI_CHART_D1_K0_BUNDLE_VERSION =
  'ai-chart-d1-k0-p1-bundle/v1' as const
export const AI_CHART_D1_K0_CATALOG_ID = 'catalog:d1:k0:p1:v1' as const
export const AI_CHART_D1_K0_COMPILED_AT_POLICY =
  'source_controlled_no_runtime_timestamp' as const

export const AI_CHART_D1_K0_SOURCE_FILES = Object.freeze({
  stars:
    'content/ai-chart/d1-v1/knowledge/core/紫微斗數知識庫_v1.2_A_十四主星核心字典_正式定稿版.json',
  palaces:
    'content/ai-chart/d1-v1/knowledge/core/C_十二宮分面與身宮疾厄田宅.md',
  mutagens:
    'content/ai-chart/d1-v1/knowledge/reasoning/07_四化正式規格_工作版.md',
  doubles:
    'content/ai-chart/d1-v1/knowledge/reasoning/08_固定雙主星整理骨架.md',
  scanning:
    'content/ai-chart/d1-v1/knowledge/reasoning/10_D1_全盤掃描與煞忌權重.md',
  relationships:
    'content/ai-chart/d1-v1/knowledge/reasoning/12_D1_對宮暗合三方四正.md',
  emptyPalaces:
    'content/ai-chart/d1-v1/knowledge/reasoning/13_D1_空宮借星與身宮.md',
  supporting:
    'content/ai-chart/d1-v1/knowledge/reasoning/14_D1_輔星煞星貴人星祿存.md',
  fourHorse:
    'content/ai-chart/d1-v1/knowledge/reasoning/16_D1_地支四馬地規則.md',
} as const)

export const AI_CHART_D1_K0_SOURCE_WHITELIST = Object.freeze(
  Object.values(AI_CHART_D1_K0_SOURCE_FILES),
)

export const AI_CHART_D1_K0_SOURCE_SHA256 = Object.freeze({
  [AI_CHART_D1_K0_SOURCE_FILES.stars]:
    'e95df53e854aec966f0c3df4ec9239b09a3070104f99183c7261267ce09c6a3f',
  [AI_CHART_D1_K0_SOURCE_FILES.palaces]:
    '987ad55e32bdc7e51e9a220c2a18f2446b385c9a0b4c4b199086ad4d46932598',
  [AI_CHART_D1_K0_SOURCE_FILES.mutagens]:
    '5c67e03928e76f2da0a87c2f104aa65e17b2e183e1e0d1674af3119cc9f0b67a',
  [AI_CHART_D1_K0_SOURCE_FILES.doubles]:
    '9127acd261dd1c879a374cd0d45432dbfe8b65050494e5d99adfa505a87955c4',
  [AI_CHART_D1_K0_SOURCE_FILES.scanning]:
    '6b549caefc3066138d3083617ecf8a823a9a1c02d3792e534882402d90246135',
  [AI_CHART_D1_K0_SOURCE_FILES.relationships]:
    '00a02ec0884a8555a10f1f16b554edcf2562acbdfd09fed9c8eee0515a8a34a0',
  [AI_CHART_D1_K0_SOURCE_FILES.emptyPalaces]:
    'a2859483a99243d0e0fdcd0382d28e5ae9febfee7beffffcafae12a21e5f6eae',
  [AI_CHART_D1_K0_SOURCE_FILES.supporting]:
    '275adec2af4998853f7b0b8bf50f1f510e237ae397cd91d8a3a17373e6a953c3',
  [AI_CHART_D1_K0_SOURCE_FILES.fourHorse]:
    'f0c2f90c6c7ec2808be13cd005b8eaab982c9e9b57aa884642a7165e04a65866',
} as const)

export const AI_CHART_D1_K0_STAR_SLUGS = Object.freeze({
  紫微: 'ziwei',
  天機: 'tianji',
  太陽: 'taiyang',
  武曲: 'wuqu',
  天同: 'tiantong',
  廉貞: 'lianzhen',
  天府: 'tianfu',
  太陰: 'taiyin',
  貪狼: 'tanlang',
  巨門: 'jumen',
  天相: 'tianxiang',
  天梁: 'tianliang',
  七殺: 'qisha',
  破軍: 'pojun',
  文昌: 'wenchang',
  文曲: 'wenqu',
  左輔: 'zuofu',
  右弼: 'youbi',
  天魁: 'tiankui',
  天鉞: 'tianyue',
  擎羊: 'qingyang',
  陀羅: 'tuoluo',
  火星: 'huoxing',
  鈴星: 'lingxing',
  祿存: 'lucun',
} as const)

export function getAiChartD1K0StarSlug(name: string): string | null {
  return Object.prototype.hasOwnProperty.call(AI_CHART_D1_K0_STAR_SLUGS, name)
    ? AI_CHART_D1_K0_STAR_SLUGS[
        name as keyof typeof AI_CHART_D1_K0_STAR_SLUGS
      ]
    : null
}

export function getAiChartD1K0PairKey(
  leftStar: AiChartD1MajorStarName,
  rightStar: AiChartD1MajorStarName,
): string {
  return `pair:${AI_CHART_D1_K0_STAR_SLUGS[leftStar]}-${AI_CHART_D1_K0_STAR_SLUGS[rightStar]}`
}

export const AI_CHART_D1_K0_DOUBLE_STAR_INVENTORY = Object.freeze(
  AI_CHART_D1_DOUBLE_MAJOR_STAR_PAIRS.map(([leftStar, rightStar], index) =>
    Object.freeze({
      pairKey: getAiChartD1K0PairKey(leftStar, rightStar),
      leftStar,
      rightStar,
      canonicalOrder: index,
    }),
  ),
)

export type AiChartD1K0MarkdownLocatorDefinition = Readonly<{
  headingPath: readonly string[]
  headingLevel: 1 | 2 | 3 | 4
  exactHeading: string
  occurrenceIndex: number
  extractionMode:
    | 'exact_section'
    | 'exact_bullet'
    | 'exact_labeled_bullets'
    | 'exact_line'
  itemIndex: number | null
  exactLabel: string | null
  exactText: string | null
}>

function section(
  headingPath: readonly string[],
  headingLevel: 1 | 2 | 3 | 4,
  exactHeading: string,
): AiChartD1K0MarkdownLocatorDefinition {
  return Object.freeze({
    headingPath: Object.freeze([...headingPath]),
    headingLevel,
    exactHeading,
    occurrenceIndex: 0,
    extractionMode: 'exact_section',
    itemIndex: null,
    exactLabel: null,
    exactText: null,
  })
}

function bullet(
  headingPath: readonly string[],
  headingLevel: 1 | 2 | 3 | 4,
  exactHeading: string,
  itemIndex: number,
  exactText: string,
): AiChartD1K0MarkdownLocatorDefinition {
  return Object.freeze({
    headingPath: Object.freeze([...headingPath]),
    headingLevel,
    exactHeading,
    occurrenceIndex: 0,
    extractionMode: 'exact_bullet',
    itemIndex,
    exactLabel: null,
    exactText,
  })
}

function labeled(
  headingPath: readonly string[],
  headingLevel: 1 | 2 | 3 | 4,
  exactHeading: string,
  exactLabel: string,
): AiChartD1K0MarkdownLocatorDefinition {
  return Object.freeze({
    headingPath: Object.freeze([...headingPath]),
    headingLevel,
    exactHeading,
    occurrenceIndex: 0,
    extractionMode: 'exact_labeled_bullets',
    itemIndex: null,
    exactLabel,
    exactText: null,
  })
}

export const AI_CHART_D1_K0_PALACE_MEANING_DEFINITIONS = Object.freeze([
  ['palace:ming', '命宮', '命宮：個性、價值觀、能力、長相、遷移宮的內心、影響 12 宮', ['個性', '價值觀', '能力', '長相', '遷移宮的內心', '影響 12 宮']],
  ['palace:siblings', '兄弟宮', '兄弟宮：媽媽、同性別兄弟姐妹、新認識的朋友', ['媽媽', '同性別兄弟姐妹', '新認識的朋友']],
  ['palace:spouse', '夫妻宮', '夫妻宮：感情的態度／對待方式、喜歡怎樣的人、工作在外的狀況', ['感情的態度／對待方式', '喜歡怎樣的人', '工作在外的狀況']],
  ['palace:children', '子女宮', '子女宮：對子女／寵物的教養方式、性生活、吃喝享樂的方式、所有物、家的外面、財庫', ['對子女／寵物的教養方式', '性生活', '吃喝享樂的方式', '所有物', '家的外面', '財庫']],
  ['palace:wealth', '財帛宮', '財帛宮：對錢的看法、理財方式、賺錢的方式、用錢的方式', ['對錢的看法', '理財方式', '賺錢的方式', '用錢的方式']],
  ['palace:health', '疾厄宮', '疾厄宮：長相、健康、身體的使用方式', ['長相', '健康', '身體的使用方式']],
  ['palace:travel', '遷移宮', '遷移宮：在外人際關係、內心想法、外界對我的看法', ['在外人際關係', '內心想法', '外界對我的看法']],
  ['palace:friends', '僕役宮', '僕役宮：異性別兄弟姐妹、同事、朋友、平輩關係', ['異性別兄弟姐妹', '同事', '朋友', '平輩關係']],
  ['palace:career', '官祿宮', '官祿宮：工作態度／方向／同事相處方式、感情對象類型、生活重心、感情內心', ['工作態度／方向／同事相處方式', '感情對象類型', '生活重心', '感情內心']],
  ['palace:property', '田宅宮', '田宅宮：居住環境、家人相處方式、財庫、家世背景、風水', ['居住環境', '家人相處方式', '財庫', '家世背景', '風水']],
  ['palace:fortune', '福德宮', '福德宮：靈魂、來財方式、老年生活、社會價值觀、花錢方式、潛意識、福份、運氣', ['靈魂', '來財方式', '老年生活', '社會價值觀', '花錢方式', '潛意識', '福份', '運氣']],
  ['palace:parents', '父母宮', '父母宮：父親、身體遺傳、身體的使用方式', ['父親', '身體遺傳', '身體的使用方式']],
] as const satisfies readonly (readonly [AiChartD1PalaceId, string, string, readonly string[]])[])

export const AI_CHART_D1_K0_PALACE_SECTION_LOCATOR = section(
  [],
  2,
  '一、十二宮分面（每宮看什麼）',
)

type DoubleRuleDefinition = Readonly<{
  pairKey: string
  heading: string
  label: string
  sourceAuthority: 'reasoning_teacher_confirmed' | 'reasoning_confirmed'
}>

export const AI_CHART_D1_K0_DOUBLE_RULE_DEFINITIONS = Object.freeze([
  ['pair:wuqu-tianfu', '1. 武曲天府（同宮）', '已確認核心', 'reasoning_confirmed'],
  ['pair:wuqu-tanlang', '2. 武曲貪狼（同宮／對拱）', '同宮核心（老師確認）', 'reasoning_teacher_confirmed'],
  ['pair:wuqu-qisha', '3. 武曲七殺（同宮）／天府對拱', '同宮核心（老師確認）', 'reasoning_teacher_confirmed'],
  ['pair:wuqu-pojun', '4. 武曲破軍／天相', '一般人格核心（老師確認）', 'reasoning_teacher_confirmed'],
  ['pair:wuqu-tianxiang', '5. 武曲天相／破軍', '同宮核心（老師確認）', 'reasoning_teacher_confirmed'],
  ['pair:tianji-tianliang', '6. 天機天梁（同宮）', '已確認核心', 'reasoning_confirmed'],
  ['pair:taiyang-tianliang', '8. 太陽天梁（同宮）', '已確認', 'reasoning_confirmed'],
  ['pair:tiantong-tianliang', '10. 天同天梁（同宮）', '已確認人格', 'reasoning_confirmed'],
  ['pair:taiyang-taiyin', '14. 太陽太陰（同宮／對拱）', '同宮核心（老師確認）', 'reasoning_teacher_confirmed'],
  ['pair:lianzhen-qisha', '15. 廉貞七殺／天府', '同宮核心（老師確認）', 'reasoning_teacher_confirmed'],
  ['pair:lianzhen-tianfu', '16. 廉貞天府／七殺', '同宮可用工作版（老師確認）', 'reasoning_teacher_confirmed'],
  ['pair:lianzhen-pojun', '17. 廉貞破軍／天相', '同宮核心（老師確認）', 'reasoning_teacher_confirmed'],
  ['pair:lianzhen-tianxiang', '18. 廉貞天相／破軍', '同宮無煞忌核心（老師確認）', 'reasoning_teacher_confirmed'],
  ['pair:tianji-taiyin', '27. 天機太陰（同宮）', '已確認核心', 'reasoning_confirmed'],
].map(([pairKey, heading, label, sourceAuthority]) =>
  Object.freeze({ pairKey, heading, label, sourceAuthority }),
) as readonly DoubleRuleDefinition[])

export function createAiChartD1K0DoubleLocator(
  definition: DoubleRuleDefinition,
): AiChartD1K0MarkdownLocatorDefinition {
  return labeled(
    ['三、講義已有專屬說明、可直接進入工作版的組合'],
    3,
    definition.heading,
    definition.label,
  )
}

type SupportingDefinition = Readonly<{
  starName: AiChartD1ModeledSupportingStarName
  headingPath: readonly string[]
  level: 2 | 3
  heading: string
  exactText: string
}>

export const AI_CHART_D1_K0_SUPPORTING_RULE_DEFINITIONS = Object.freeze([
  ['文昌', [], 2, '一、文昌', '理性、邏輯、條理、規則、文字、說明。'],
  ['文曲', [], 2, '二、文曲', '感性、感受、表達、美感、創作、表演。'],
  ['擎羊', ['四、四煞'], 3, '擎羊', '知道有衝突仍正面處理。'],
  ['陀羅', ['四、四煞'], 3, '陀羅', '反覆、糾結、拖延、繞圈。'],
  ['火星', ['四、四煞'], 3, '火星', '情緒來得快、當下立即反應。'],
  ['鈴星', ['四、四煞'], 3, '鈴星', '冷靜計算、衡量利弊、策略與自保。'],
  ['左輔', ['五、左輔右弼'], 3, '左輔', '一起喊話、表態支持、增加聲量。'],
  ['右弼', ['五、左輔右弼'], 3, '右弼', '細膩說話、安慰、提醒、圓場與協調。'],
  ['天魁', ['六、天魁天鉞天梁'], 3, '天魁', '檯面上的有能力貴人。'],
  ['天鉞', ['六、天魁天鉞天梁'], 3, '天鉞', '檯面下的有能力貴人。'],
  ['祿存', [], 2, '八、祿存', '與化祿相似，是存在的助力。'],
].map(([starName, headingPath, level, heading, exactText]) =>
  Object.freeze({ starName, headingPath, level, heading, exactText }),
) as readonly SupportingDefinition[])

export function createAiChartD1K0SupportingLocator(
  definition: SupportingDefinition,
): AiChartD1K0MarkdownLocatorDefinition {
  return bullet(
    definition.headingPath,
    definition.level,
    definition.heading,
    0,
    definition.exactText,
  )
}

type StructureDefinition = Readonly<{
  ruleId: string
  kind: 'common' | 'relationship' | 'empty_palace' | 'four_horse' | 'd2_boundary'
  title: string
  sourceFile: string
  locator: AiChartD1K0MarkdownLocatorDefinition
  selectionTag: string
}>

export const AI_CHART_D1_K0_STRUCTURE_RULE_DEFINITIONS = Object.freeze([
  ['rule:common:possibility-first', 'common', '可能性優先', AI_CHART_D1_K0_SOURCE_FILES.scanning, Object.freeze({ headingPath: Object.freeze([]), headingLevel: 2, exactHeading: '二、可能性優先', occurrenceIndex: 0, extractionMode: 'exact_line', itemIndex: 1, exactLabel: null, exactText: '2. 所有命理上成立、生活上合理的可能先保留。' }), 'common:possibility-first'],
  ['rule:common:malefic-preserve-all', 'common', '多顆煞星反應全部保留', AI_CHART_D1_K0_SOURCE_FILES.scanning, section([], 2, '五、多顆煞星同時存在'), 'common:malefic-preserve-all'],
  ['rule:common:natal-scan-completeness', 'common', '本命結構掃描範圍', AI_CHART_D1_K0_SOURCE_FILES.scanning, section([], 2, '三、掃描順序'), 'common:natal-scan-completeness'],
  ['rule:common:d1-event-boundary', 'd2_boundary', 'D1 只保留長期可能', AI_CHART_D1_K0_SOURCE_FILES.scanning, bullet([], 2, '六、本命與事件邊界', 1, '命主可能形成哪些長期行為與價值觀。'), 'common:d1-event-boundary'],
  ['rule:structure:opposite', 'relationship', '對宮', AI_CHART_D1_K0_SOURCE_FILES.relationships, section([], 2, '二、對宮'), 'relationship:opposite'],
  ['rule:structure:hidden-combination', 'relationship', '暗合', AI_CHART_D1_K0_SOURCE_FILES.relationships, section([], 2, '四、暗合'), 'relationship:hidden-combination'],
  ['rule:structure:trine', 'relationship', '三方四正', AI_CHART_D1_K0_SOURCE_FILES.relationships, section([], 2, '五、三方四正'), 'relationship:trine'],
  ['rule:structure:integration-order', 'relationship', '結構整合順序', AI_CHART_D1_K0_SOURCE_FILES.relationships, section([], 2, '一、整合前提'), 'relationship:integration-order'],
  ['rule:structure:empty-palace-blockers', 'empty_palace', '空宮借星阻擋條件', AI_CHART_D1_K0_SOURCE_FILES.emptyPalaces, section([], 2, '一、空宮不可借星條件'), 'empty:blockers'],
  ['rule:structure:empty-palace-borrow', 'empty_palace', '空宮可借星', AI_CHART_D1_K0_SOURCE_FILES.emptyPalaces, section([], 2, '二、空宮可借星'), 'empty:eligible-borrow'],
  ['rule:structure:empty-palace-opposite-only', 'empty_palace', '只借對宮主星與其生年四化', AI_CHART_D1_K0_SOURCE_FILES.emptyPalaces, section([], 2, '二、空宮可借星'), 'empty:opposite-major-only'],
  ['rule:structure:empty-palace-lucun', 'empty_palace', '祿存不阻擋借星', AI_CHART_D1_K0_SOURCE_FILES.emptyPalaces, section([], 2, '四、空宮有祿存'), 'empty:lucun-does-not-block'],
  ['rule:structure:opposite-empty', 'empty_palace', '對宮無主星時沒有可借入主星', AI_CHART_D1_K0_SOURCE_FILES.emptyPalaces, section([], 2, '二、空宮可借星'), 'empty:opposite-empty'],
  ['rule:structure:four-horse', 'four_horse', '四馬地結構背景', AI_CHART_D1_K0_SOURCE_FILES.fourHorse, section([], 2, '二、底層原則'), 'four-horse:background'],
  ['rule:structure:four-horse-d1-boundary', 'd2_boundary', '四馬地不得直接下事件結論', AI_CHART_D1_K0_SOURCE_FILES.fourHorse, bullet([], 2, '七、禁止誤用', 3, '不可在本命階段把「變動傾向」直接寫成已發生事件。'), 'four-horse:d1-boundary'],
].map(([ruleId, kind, title, sourceFile, locator, selectionTag]) =>
  Object.freeze({ ruleId, kind, title, sourceFile, locator, selectionTag }),
) as readonly StructureDefinition[])

export const AI_CHART_D1_K0_MAJOR_STAR_NAMES = AI_CHART_D1_MAJOR_STAR_NAMES
export const AI_CHART_D1_K0_SUPPORTING_STAR_NAMES = Object.freeze(
  Object.keys(AI_CHART_D1_MODELED_SUPPORTING_STARS) as AiChartD1ModeledSupportingStarName[],
)
export const AI_CHART_D1_K0_PALACE_IDS = Object.freeze(
  AI_CHART_D1_PALACE_IDENTITIES.map((identity) => identity.palaceId),
)

export const AI_CHART_D1_K0_MUTAGEN_SLUGS = Object.freeze({
  化祿: 'lu',
  化權: 'quan',
  化科: 'ke',
  化忌: 'ji',
} as const)

export const AI_CHART_D1_K0_SOURCE_AUTHORITY_PRIORITIES = Object.freeze({
  formal_teacher_confirmed: 400,
  reasoning_teacher_confirmed: 350,
  reasoning_confirmed: 300,
  lecture_backfill: 200,
  working_inference: 100,
} as const)

export { bullet, labeled, section }
