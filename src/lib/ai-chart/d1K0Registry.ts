import {
  AI_CHART_D1_DOUBLE_MAJOR_STAR_PAIRS,
  AI_CHART_D1_MAJOR_STAR_NAMES,
  AI_CHART_D1_MODELED_SUPPORTING_STARS,
  AI_CHART_D1_MUTAGEN_TYPES,
  AI_CHART_D1_PALACE_IDENTITIES,
  type AiChartD1MajorStarName,
  type AiChartD1ModeledSupportingStarName,
  type AiChartD1MutagenType,
  type AiChartD1PalaceId,
} from './d1N0Constants'
import { MUTAGEN_TABLE } from '../../features/ziwei-chart/lib/engine/constants'

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
    '134612bf5a35497128e8402a4a540456a6a9bf827aea5869dd81a4c63ca6db47',
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
    | 'exact_bullet_block'
    | 'exact_labeled_bullet_block'
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

function bulletBlock(
  headingPath: readonly string[],
  headingLevel: 1 | 2 | 3 | 4,
  exactHeading: string,
): AiChartD1K0MarkdownLocatorDefinition {
  return Object.freeze({
    headingPath: Object.freeze([...headingPath]),
    headingLevel,
    exactHeading,
    occurrenceIndex: 0,
    extractionMode: 'exact_bullet_block',
    itemIndex: null,
    exactLabel: null,
    exactText: null,
  })
}

function labeledBulletBlock(
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
    extractionMode: 'exact_labeled_bullet_block',
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

export const AI_CHART_D1_K0_MEANING_SLUGS: Readonly<
  Record<string, string>
> = Object.freeze({
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

export const AI_CHART_D1_K0_PALACE_SECTION_LOCATOR = section(
  [],
  2,
  '一、十二宮分面（每宮看什麼）',
)

type DoubleRuleDefinition = Readonly<{
  pairKey: string
  headingPath: readonly string[]
  heading: string
  label: string | null
  includeLabeledBulletBlock: boolean
  sourceAuthority:
    | 'reasoning_teacher_confirmed'
    | 'reasoning_confirmed'
    | 'lecture_backfill'
}>

type DoubleRuleDefinitionEntry = readonly [
  pairKey: string,
  headingPath: readonly string[],
  heading: string,
  label: string | null,
  sourceAuthority: DoubleRuleDefinition['sourceAuthority'],
  includeLabeledBulletBlock?: boolean,
]

const AI_CHART_D1_K0_DOUBLE_RULE_DEFINITION_ENTRIES = [
  ['pair:wuqu-tianfu', ['三、講義已有專屬說明、可直接進入工作版的組合'], '1. 武曲天府（同宮）', '已確認核心', 'reasoning_confirmed'],
  ['pair:wuqu-tanlang', ['三、講義已有專屬說明、可直接進入工作版的組合'], '2. 武曲貪狼（同宮／對拱）', '同宮核心（老師確認）', 'reasoning_teacher_confirmed'],
  ['pair:wuqu-qisha', ['三、講義已有專屬說明、可直接進入工作版的組合'], '3. 武曲七殺（同宮）／天府對拱', '同宮核心（老師確認）', 'reasoning_teacher_confirmed'],
  ['pair:wuqu-pojun', ['三、講義已有專屬說明、可直接進入工作版的組合'], '4. 武曲破軍／天相', '一般人格核心（老師確認）', 'reasoning_teacher_confirmed'],
  ['pair:wuqu-tianxiang', ['三、講義已有專屬說明、可直接進入工作版的組合'], '5. 武曲天相／破軍', '同宮核心（老師確認）', 'reasoning_teacher_confirmed'],
  ['pair:tianji-tianliang', ['三、講義已有專屬說明、可直接進入工作版的組合'], '6. 天機天梁（同宮）', '已確認核心', 'reasoning_confirmed'],
  ['pair:taiyang-tianliang', ['三、講義已有專屬說明、可直接進入工作版的組合'], '8. 太陽天梁（同宮）', '已確認', 'reasoning_confirmed'],
  ['pair:tiantong-tianliang', ['三、講義已有專屬說明、可直接進入工作版的組合'], '10. 天同天梁（同宮）', '已確認人格', 'reasoning_confirmed'],
  ['pair:taiyang-taiyin', ['三、講義已有專屬說明、可直接進入工作版的組合'], '14. 太陽太陰（同宮／對拱）', '同宮核心（老師確認）', 'reasoning_teacher_confirmed'],
  ['pair:lianzhen-qisha', ['三、講義已有專屬說明、可直接進入工作版的組合'], '15. 廉貞七殺／天府', '同宮核心（老師確認）', 'reasoning_teacher_confirmed'],
  ['pair:lianzhen-tianfu', ['三、講義已有專屬說明、可直接進入工作版的組合'], '16. 廉貞天府／七殺', '同宮可用工作版（老師確認）', 'reasoning_teacher_confirmed'],
  ['pair:lianzhen-pojun', ['三、講義已有專屬說明、可直接進入工作版的組合'], '17. 廉貞破軍／天相', '同宮核心（老師確認）', 'reasoning_teacher_confirmed'],
  ['pair:lianzhen-tianxiang', ['三、講義已有專屬說明、可直接進入工作版的組合'], '18. 廉貞天相／破軍', '同宮無煞忌核心（老師確認）', 'reasoning_teacher_confirmed'],
  ['pair:lianzhen-tanlang', ['三、講義已有專屬說明、可直接進入工作版的組合'], '19. 廉貞貪狼（同宮）', '同宮固定核心（老師確認）', 'reasoning_teacher_confirmed', true],
  ['pair:tianji-taiyin', ['三、講義已有專屬說明、可直接進入工作版的組合'], '27. 天機太陰（同宮）', '已確認核心', 'reasoning_confirmed'],
  ['pair:ziwei-tianfu', ['四、紫微系五組｜講義＋CTA 回填工作版'], '1. 紫微天府（同宮）', null, 'lecture_backfill'],
  ['pair:ziwei-qisha', ['四、紫微系五組｜講義＋CTA 回填工作版'], '2. 紫微七殺（同宮）', null, 'lecture_backfill'],
  ['pair:ziwei-pojun', ['四、紫微系五組｜講義＋CTA 回填工作版'], '3. 紫微破軍（同宮）', null, 'lecture_backfill'],
  ['pair:ziwei-tianxiang', ['四、紫微系五組｜講義＋CTA 回填工作版'], '4. 紫微天相（同宮）', null, 'lecture_backfill'],
  ['pair:ziwei-tanlang', ['四、紫微系五組｜講義＋CTA 回填工作版'], '5. 紫微貪狼（同宮／對拱）', null, 'lecture_backfill'],
] as const satisfies readonly DoubleRuleDefinitionEntry[]

export const AI_CHART_D1_K0_DOUBLE_RULE_DEFINITIONS = Object.freeze(AI_CHART_D1_K0_DOUBLE_RULE_DEFINITION_ENTRIES.map(([pairKey, headingPath, heading, label, sourceAuthority, includeLabeledBulletBlock = false]) =>
  Object.freeze({
    pairKey,
    headingPath: Object.freeze([...headingPath]),
    heading,
    label,
    includeLabeledBulletBlock,
    sourceAuthority,
  }),
) as readonly DoubleRuleDefinition[])

export function createAiChartD1K0DoubleLocator(
  definition: DoubleRuleDefinition,
): AiChartD1K0MarkdownLocatorDefinition {
  return definition.label === null
    ? bulletBlock(definition.headingPath, 3, definition.heading)
    : definition.includeLabeledBulletBlock
      ? labeledBulletBlock(
          definition.headingPath,
          3,
          definition.heading,
          definition.label,
        )
    : labeled(
        definition.headingPath,
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
  exactLabel: string | null
  expectedBullets: readonly string[]
}>

export const AI_CHART_D1_K0_SUPPORTING_RULE_DEFINITIONS = Object.freeze(([
  ['文昌', [], 2, '一、文昌', '核心', ['理性、邏輯、條理、規則、文字、說明。', '讀書、考試、正途功名、制度認可。', '命宮／官祿宮通常讀書理解能力不差。']],
  ['文曲', [], 2, '二、文曲', '核心', ['感性、感受、表達、美感、創作、表演。', '異途功名與非傳統成就。']],
  ['擎羊', ['四、四煞'], 3, '擎羊', null, ['知道有衝突仍正面處理。', '單顆可成敢面對、敢承擔。', '煞忌集中時硬碰硬、不願退讓。']],
  ['陀羅', ['四、四煞'], 3, '陀羅', null, ['反覆、糾結、拖延、繞圈。', '想很久仍可能選錯。', '沒有單顆正向轉換。']],
  ['火星', ['四、四煞'], 3, '火星', null, ['情緒來得快、當下立即反應。', '單顆可成行動快、敢把握機會。', '問題是情緒過去後，當下反應已造成影響。']],
  ['鈴星', ['四、四煞'], 3, '鈴星', null, ['冷靜計算、衡量利弊、策略與自保。', '必須配合主星判斷在計算什麼。', '煞忌集中時太會算計，容易讓人反感。']],
  ['左輔', ['五、左輔右弼'], 3, '左輔', null, ['一起喊話、表態支持、增加聲量。', '偏口頭與態度支持。', '好壞都可能幫。']],
  ['右弼', ['五、左輔右弼'], 3, '右弼', null, ['細膩說話、安慰、提醒、圓場與協調。', '偏口頭與人情支持。', '好壞都可能幫。']],
  ['天魁', ['六、天魁天鉞天梁'], 3, '天魁', null, ['檯面上的有能力貴人。', '正式給意見、能力與資源。']],
  ['天鉞', ['六、天魁天鉞天梁'], 3, '天鉞', null, ['檯面下的有能力貴人。', '私下提醒、幕後安排與暗中協助。']],
  ['祿存', [], 2, '八、祿存', null, ['與化祿相似，是存在的助力。', '有主星時，幫助主星核心產生更多效果。', '財帛宮可理解為幫助主星產生更多賺錢機會。', '獨坐時，只代表該宮位較有不安全感。', '祿存可納入祿隨忌走，補償其他宮位化忌空缺。']],
] as const).map(([starName, headingPath, level, heading, exactLabel, expectedBullets]) =>
  Object.freeze({
    starName,
    headingPath: Object.freeze([...headingPath]),
    level,
    heading,
    exactLabel,
    expectedBullets: Object.freeze([...expectedBullets]),
  }),
)) as readonly SupportingDefinition[]

export function createAiChartD1K0SupportingLocator(
  definition: SupportingDefinition,
): AiChartD1K0MarkdownLocatorDefinition {
  return definition.exactLabel === null
    ? bulletBlock(definition.headingPath, definition.level, definition.heading)
    : labeledBulletBlock(
        definition.headingPath,
        definition.level,
        definition.heading,
        definition.exactLabel,
      )
}

export const AI_CHART_D1_K0_EVENT_BOUNDARY = Object.freeze({
  allowed: Object.freeze([
    '哪個領域容易有壓力、空缺、反覆或失衡。',
    '命主可能形成哪些長期行為與價值觀。',
  ]),
  prohibited: Object.freeze([
    '何時發生。',
    '具體事件形式。',
    '一定成功或失敗。',
    '一定破財、車禍、官非或疾病。',
  ]),
})

export const AI_CHART_D1_K0_MUTAGEN_EXPECTED_BULLET_COUNTS = Object.freeze({
  '太陽化忌': 3, '太陰化忌': 3, '廉貞化忌': 2, '巨門化忌': 2,
  '天機化忌': 3, '文曲化忌': 3, '天相化忌': 3, '文昌化忌': 3,
  '武曲化忌': 5, '貪狼化忌': 3,
  '天機化祿': 1, '太陽化祿': 2, '廉貞化祿': 2, '天同化祿': 2,
  '太陰化祿': 3, '貪狼化祿': 2, '破軍化祿': 3, '天梁化祿': 4,
  '武曲化祿': 3, '巨門化祿': 1,
  '破軍化權': 4, '天梁化權': 4, '天機化權': 3, '天同化權': 4,
  '太陰化權': 3, '貪狼化權': 3, '武曲化權': 4, '太陽化權': 4,
  '紫微化權': 4, '巨門化權': 4,
  '武曲化科': 4, '紫微化科': 4, '文昌化科': 4, '天機化科': 3,
  '右弼化科': 4, '天梁化科': 4, '天同化科': 4, '文曲化科': 3,
  '左輔化科': 4, '太陰化科': 3,
} as const)

function teacherSupplementSegment(
  starName: AiChartD1MajorStarName,
  segmentId: string,
  text: string,
) {
  return Object.freeze({ starName, segmentId, text })
}

export const AI_CHART_D1_K0_TEACHER_SUPPLEMENT_SEGMENTS = Object.freeze({
  紫微: Object.freeze([
    teacherSupplementSegment(
      '紫微',
      'teacher:ziwei:team',
      '紫微的班底可看左輔、右弼、天魁、天鉞、天府、天相。團隊完整時，紫微的領導、資源與名聲較容易做出來；若輔佐不足，容易只剩面子和孤單感。',
    ),
    teacherSupplementSegment(
      '紫微',
      'teacher:ziwei:career-lord',
      '保留「官祿主」。',
    ),
    teacherSupplementSegment(
      '紫微',
      'teacher:ziwei:team-scope',
      '紫微團隊以三方四正為主要範圍，鄰宮也可納入。',
    ),
  ]),
  天機: Object.freeze([
    teacherSupplementSegment(
      '天機',
      'teacher:tianji:change',
      '天機的「善」不能只寫善良，也要保留善變、轉機與調整。',
    ),
  ]),
  太陽: Object.freeze([
    teacherSupplementSegment(
      '太陽',
      'teacher:taiyang:illuminate',
      '太陽「喜照不喜坐」：它適合照亮、帶動，而不是把所有事情都壓在自己身上。跟太陽溝通時，讓它參與制定規則或做決定，它會更願意努力完成自己說出口的承諾。',
    ),
  ]),
  武曲: Object.freeze([
    teacherSupplementSegment(
      '武曲',
      'teacher:wuqu:earned-reward',
      '武曲的正財不是法律或行業分類，而是「花時間、持續投入、運用能力換來相對報酬」。武曲的務實偏向金錢與實際利益；天府的務實則偏向掌握與對自己有利。',
    ),
  ]),
  天同: Object.freeze([
    teacherSupplementSegment(
      '天同',
      'teacher:tiantong:malefic-response',
      '天同「不怕四煞」不是煞星不存在，而是它比較能用寬容與隨遇而安去消化。天同也不是完全沒脾氣；很多不滿會先記在心裡，久了才用孩子氣的方式表達。',
    ),
  ]),
  廉貞: Object.freeze([
    teacherSupplementSegment(
      '廉貞',
      'teacher:lianzhen:self-restraint',
      '廉貞化祿或與祿存同宮，講義稱為廉貞清白格，重點是因自我約束、做事有分寸而得到好處。',
    ),
  ]),
  天府: Object.freeze([
    teacherSupplementSegment(
      '天府',
      'teacher:tianfu:treasury',
      '天府是庫星，但財庫要有祿才比較成立。天府可化煞為用，仍須看煞星數量與祿的落點。',
    ),
  ]),
  太陰: Object.freeze([
    teacherSupplementSegment(
      '太陰',
      'teacher:taiyin:care-and-saving',
      '老師歷次修正強調「生活上的照顧多屬太陰」。太陰的財不是快速放大，而是節流、慢慢存、積沙成塔。',
    ),
  ]),
  貪狼: Object.freeze([
    teacherSupplementSegment(
      '貪狼',
      'teacher:tanlang:resourcefulness',
      '貪狼的人際手腕不是單純虛偽，而是為了滿足需求，能示好、示弱、撒嬌、關懷、找話題。它之所以是解厄星，也與博學、會找資源、較懂得處理問題有關。',
    ),
  ]),
  巨門: Object.freeze([
    teacherSupplementSegment(
      '巨門',
      'teacher:jumen:insecurity-first',
      '巨門的口舌不是第一層，而是不安衍生的結果。',
    ),
  ]),
  天梁: Object.freeze([
    teacherSupplementSegment(
      '天梁',
      'teacher:tianliang:mitigation',
      '天梁確實有制煞與逢凶化吉的力量，但不是保證沒事。',
    ),
  ]),
  破軍: Object.freeze([
    teacherSupplementSegment(
      '破軍',
      'teacher:pojun:dream-resources',
      '破軍的夢想如何呈現，要看對宮天相；能不能大立，要看能力和資源。它看似不計後果，內在常有「我辦得到」的天相式信念。',
    ),
  ]),
} as const)

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
  ['rule:common:d1-event-boundary', 'd2_boundary', 'D1 本命與事件邊界', AI_CHART_D1_K0_SOURCE_FILES.scanning, section([], 2, '六、本命與事件邊界'), 'common:d1-event-boundary'],
  ['rule:structure:opposite', 'relationship', '對宮', AI_CHART_D1_K0_SOURCE_FILES.relationships, section([], 2, '二、對宮'), 'relationship:opposite'],
  ['rule:structure:hidden-combination', 'relationship', '暗合', AI_CHART_D1_K0_SOURCE_FILES.relationships, section([], 2, '四、暗合'), 'relationship:hidden-combination'],
  ['rule:structure:trine', 'relationship', '三方四正', AI_CHART_D1_K0_SOURCE_FILES.relationships, section([], 2, '五、三方四正'), 'relationship:trine'],
  ['rule:structure:integration-order', 'relationship', '結構整合順序', AI_CHART_D1_K0_SOURCE_FILES.relationships, section([], 2, '一、整合前提'), 'relationship:integration-order'],
  ['rule:structure:empty-palace-blockers', 'empty_palace', '空宮借星阻擋條件', AI_CHART_D1_K0_SOURCE_FILES.emptyPalaces, section([], 2, '一、空宮不可借星條件'), 'empty:blockers'],
  ['rule:structure:empty-palace-borrow', 'empty_palace', '空宮可借星', AI_CHART_D1_K0_SOURCE_FILES.emptyPalaces, section([], 2, '二、空宮可借星'), 'empty:eligible-borrow'],
  ['rule:structure:empty-palace-opposite-only', 'empty_palace', '只借對宮主星與其生年四化', AI_CHART_D1_K0_SOURCE_FILES.emptyPalaces, section([], 2, '二、空宮可借星'), 'empty:opposite-major-only'],
  ['rule:structure:empty-palace-lucun', 'empty_palace', '祿存不阻擋借星', AI_CHART_D1_K0_SOURCE_FILES.emptyPalaces, section([], 2, '四、空宮有祿存'), 'empty:lucun-does-not-block'],
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

export function getAiChartD1K0MutagenAssignmentUniverse(): readonly Readonly<{
  starName: string
  mutagenType: AiChartD1MutagenType
}>[] {
  const assignments = new Map<
    string,
    Readonly<{ starName: string; mutagenType: AiChartD1MutagenType }>
  >()
  for (const row of MUTAGEN_TABLE) {
    row.forEach((starName, index) => {
      const mutagenType = AI_CHART_D1_MUTAGEN_TYPES[index]
      assignments.set(
        `${starName}\u0000${mutagenType}`,
        Object.freeze({ starName, mutagenType }),
      )
    })
  }
  return Object.freeze(
    [...assignments.values()].sort((left, right) => {
      const leftSlug = getAiChartD1K0StarSlug(left.starName)
      const rightSlug = getAiChartD1K0StarSlug(right.starName)
      if (!leftSlug || !rightSlug) {
        throw new Error('ai_chart_d1_k0_registry_invalid')
      }
      return (
        leftSlug.localeCompare(rightSlug, 'en') ||
        AI_CHART_D1_MUTAGEN_TYPES.indexOf(left.mutagenType) -
          AI_CHART_D1_MUTAGEN_TYPES.indexOf(right.mutagenType)
      )
    }),
  )
}

export const AI_CHART_D1_K0_SOURCE_AUTHORITY_PRIORITIES = Object.freeze({
  formal_teacher_confirmed: 400,
  reasoning_teacher_confirmed: 350,
  reasoning_confirmed: 300,
  lecture_backfill: 200,
  working_inference: 100,
} as const)

export { bullet, bulletBlock, labeled, labeledBulletBlock, section }
