import {
  freezeAiChartD1Value,
  requireAiChartD1ExactObject,
} from './d1CommonContracts'
import {
  AI_CHART_D1_MAJOR_STAR_NAMES,
  type AiChartD1MajorStarName,
  type AiChartD1PalaceId,
} from './d1N0Constants'
import {
  parseAiChartD1N0,
  type AiChartD1N0,
  type AiChartD1N0Palace,
  type AiChartD1N0StarPlacement,
} from './d1N0Parser'
import { AI_CHART_D1_HEALTH_REMINDER_CARD_REGISTRY } from './d1HealthReminderCards'

export const AI_CHART_D1_HEALTH_DIRECTION_SCAN_VERSION =
  'ai-chart-d1-health-direction-scan/v1' as const
export const AI_CHART_D1_HEALTH_DIRECTION_SCAN_INVALID =
  'ai_chart_d1_health_direction_scan_invalid' as const

export const AI_CHART_D1_HEALTH_DIRECTION_SCAN_PALACE_IDS = Object.freeze([
  'palace:ming',
  'palace:travel',
  'palace:health',
  'palace:parents',
] as const)

export const AI_CHART_D1_HEALTH_DIRECTION_SCAN_ERROR_REASONS = Object.freeze([
  'INPUT_INVALID',
  'N0_INVALID',
  'SUBJECT_GENDER_INVALID',
  'SCAN_PALACE_MISSING',
  'MAIN_STAR_RULE_MISSING',
] as const)

export type AiChartD1HealthDirectionScanErrorReason =
  (typeof AI_CHART_D1_HEALTH_DIRECTION_SCAN_ERROR_REASONS)[number]

export type AiChartD1HealthDirectionActivation =
  | 'DIRECT'
  | 'BRANCH_WU_WEI'
  | 'SUBJECT_FEMALE'
  | 'TIANJI_TIANLIANG_SAME_OR_OPPOSITE'

export type AiChartD1HealthMainStarRule = Readonly<{
  ruleId: string
  starName: AiChartD1MajorStarName
  directDirections: readonly string[]
}>

export type AiChartD1HealthDirectionFinding = Readonly<{
  ruleId: string
  sourcePalaceId: AiChartD1PalaceId
  sourceStarPlacementId: string
  sourceStarName: AiChartD1MajorStarName
  canonicalHealthDirection: string
  activation: AiChartD1HealthDirectionActivation
  relatedPalaceId: AiChartD1PalaceId | null
  relatedStarPlacementId: string | null
  relatedStarName: AiChartD1MajorStarName | null
}>

export type AiChartD1HealthDirectionScan = Readonly<{
  contractVersion: typeof AI_CHART_D1_HEALTH_DIRECTION_SCAN_VERSION
  sourceN0ContractVersion: AiChartD1N0['contractVersion']
  sourceSnapshotSha256: string
  scannedPalaceIds: typeof AI_CHART_D1_HEALTH_DIRECTION_SCAN_PALACE_IDS
  findings: readonly AiChartD1HealthDirectionFinding[]
  canonicalHealthDirections: readonly string[]
}>

export class AiChartD1HealthDirectionScanError extends Error {
  readonly code = AI_CHART_D1_HEALTH_DIRECTION_SCAN_INVALID
  declare readonly reasonCode: AiChartD1HealthDirectionScanErrorReason

  constructor(reasonCode: AiChartD1HealthDirectionScanErrorReason) {
    super(AI_CHART_D1_HEALTH_DIRECTION_SCAN_INVALID)
    this.name = 'AiChartD1HealthDirectionScanError'
    Object.defineProperty(this, 'reasonCode', {
      value: reasonCode,
      enumerable: true,
      writable: false,
      configurable: false,
    })
    Object.freeze(this)
  }
}

const mainStarRules: readonly AiChartD1HealthMainStarRule[] = [
  { ruleId: 'HEALTH_MAIN_ZIWEI', starName: '紫微', directDirections: ['脾胃相關'] },
  {
    ruleId: 'HEALTH_MAIN_TIANJI',
    starName: '天機',
    directDirections: ['肝臟相關', '肌肉筋脈與四肢相關'],
  },
  {
    ruleId: 'HEALTH_MAIN_TAIYANG',
    starName: '太陽',
    directDirections: ['心臟與心血管相關'],
  },
  {
    ruleId: 'HEALTH_MAIN_WUQU',
    starName: '武曲',
    directDirections: ['肺部與呼吸相關', '骨骼與脊椎相關'],
  },
  {
    ruleId: 'HEALTH_MAIN_TIANTONG',
    starName: '天同',
    directDirections: [
      '腎臟相關',
      '口腔與牙齒相關',
      '耳朵與聽力相關',
      '內分泌與代謝相關',
    ],
  },
  { ruleId: 'HEALTH_MAIN_LIANZHEN', starName: '廉貞', directDirections: ['血液相關'] },
  { ruleId: 'HEALTH_MAIN_TIANFU', starName: '天府', directDirections: ['脾胃相關'] },
  { ruleId: 'HEALTH_MAIN_TAIYIN', starName: '太陰', directDirections: ['腎臟相關'] },
  {
    ruleId: 'HEALTH_MAIN_TANLANG',
    starName: '貪狼',
    directDirections: ['肝臟相關', '肌肉筋脈與四肢相關'],
  },
  {
    ruleId: 'HEALTH_MAIN_JUMEN',
    starName: '巨門',
    directDirections: ['腎臟相關', '支氣管與呼吸道相關', '口腔與牙齒相關'],
  },
  {
    ruleId: 'HEALTH_MAIN_TIANXIANG',
    starName: '天相',
    directDirections: ['腎臟相關', '內分泌與代謝相關', '淋巴相關', '循環相關'],
  },
  {
    ruleId: 'HEALTH_MAIN_TIANLIANG',
    starName: '天梁',
    directDirections: ['骨骼與脊椎相關', '脾胃相關'],
  },
  {
    ruleId: 'HEALTH_MAIN_QISHA',
    starName: '七殺',
    directDirections: [
      '肺部與呼吸相關',
      '骨骼與脊椎相關',
      '頭部與神經急症相關',
      '皮膚相關',
    ],
  },
  {
    ruleId: 'HEALTH_MAIN_POJUN',
    starName: '破軍',
    directDirections: ['腎臟相關', '泌尿相關'],
  },
]

export const AI_CHART_D1_HEALTH_MAIN_STAR_RULES =
  freezeAiChartD1Value(mainStarRules)

export const AI_CHART_D1_HEALTH_TIANJI_TIANLIANG_RULE =
  freezeAiChartD1Value({
    ruleId: 'HEALTH_RELATION_TIANJI_TIANLIANG_SPINE',
    sourceStarName: '天機' as const,
    relatedStarName: '天梁' as const,
    canonicalHealthDirection: '骨骼與脊椎相關',
    allowedRelationships: ['SAME_PALACE', 'OPPOSITE_PALACE'] as const,
  })

const CONDITIONAL_RULES = freezeAiChartD1Value({
  taiyangEyes: {
    ruleId: 'HEALTH_CONDITION_TAIYANG_EYES_WU_WEI',
    starName: '太陽' as const,
    canonicalHealthDirection: '眼睛與視力相關',
  },
  taiyinEyes: {
    ruleId: 'HEALTH_CONDITION_TAIYIN_EYES_WU_WEI',
    starName: '太陰' as const,
    canonicalHealthDirection: '眼睛與視力相關',
  },
  taiyinFemale: {
    ruleId: 'HEALTH_CONDITION_TAIYIN_FEMALE',
    starName: '太陰' as const,
    canonicalHealthDirection: '婦科與生殖相關',
  },
  pojunFemale: {
    ruleId: 'HEALTH_CONDITION_POJUN_FEMALE',
    starName: '破軍' as const,
    canonicalHealthDirection: '婦科與生殖相關',
  },
})

const RULE_BY_STAR = new Map(
  AI_CHART_D1_HEALTH_MAIN_STAR_RULES.map((rule) => [rule.starName, rule]),
)
const KNOWN_DIRECTIONS = new Set(
  AI_CHART_D1_HEALTH_REMINDER_CARD_REGISTRY.flatMap(
    (card) => card.canonicalHealthDirections,
  ),
)
const MAJOR_STAR_NAMES = new Set<string>(AI_CHART_D1_MAJOR_STAR_NAMES)
const WU_WEI_BRANCHES = new Set(['午', '未'])

if (
  AI_CHART_D1_HEALTH_MAIN_STAR_RULES.length !==
    AI_CHART_D1_MAJOR_STAR_NAMES.length ||
  new Set(
    AI_CHART_D1_HEALTH_MAIN_STAR_RULES.map((rule) => rule.starName),
  ).size !== AI_CHART_D1_MAJOR_STAR_NAMES.length ||
  AI_CHART_D1_MAJOR_STAR_NAMES.some((starName) => !RULE_BY_STAR.has(starName))
) {
  throw new Error(AI_CHART_D1_HEALTH_DIRECTION_SCAN_INVALID)
}

for (const rule of AI_CHART_D1_HEALTH_MAIN_STAR_RULES) {
  if (
    rule.directDirections.some((direction) => !KNOWN_DIRECTIONS.has(direction))
  ) {
    throw new Error(AI_CHART_D1_HEALTH_DIRECTION_SCAN_INVALID)
  }
}
for (const rule of Object.values(CONDITIONAL_RULES)) {
  if (!KNOWN_DIRECTIONS.has(rule.canonicalHealthDirection)) {
    throw new Error(AI_CHART_D1_HEALTH_DIRECTION_SCAN_INVALID)
  }
}
if (
  !KNOWN_DIRECTIONS.has(
    AI_CHART_D1_HEALTH_TIANJI_TIANLIANG_RULE.canonicalHealthDirection,
  )
) {
  throw new Error(AI_CHART_D1_HEALTH_DIRECTION_SCAN_INVALID)
}

function invalid(reasonCode: AiChartD1HealthDirectionScanErrorReason): never {
  throw new AiChartD1HealthDirectionScanError(reasonCode)
}

function parseInput(input: unknown): Readonly<{
  n0: AiChartD1N0
  gender: 'male' | 'female'
}> {
  let record: Record<string, unknown>
  try {
    record = requireAiChartD1ExactObject(input, ['n0', 'gender'])
  } catch {
    invalid('INPUT_INVALID')
  }
  if (record.gender !== 'male' && record.gender !== 'female') {
    invalid('SUBJECT_GENDER_INVALID')
  }
  try {
    return freezeAiChartD1Value({
      n0: parseAiChartD1N0(record.n0),
      gender: record.gender,
    })
  } catch {
    invalid('N0_INVALID')
  }
}

function getPalace(
  n0: AiChartD1N0,
  palaceId: AiChartD1PalaceId,
): AiChartD1N0Palace {
  const palace = n0.palaces.find((candidate) => candidate.palaceId === palaceId)
  if (palace === undefined) invalid('SCAN_PALACE_MISSING')
  return palace
}

function parseMainStarName(name: string): AiChartD1MajorStarName {
  if (!MAJOR_STAR_NAMES.has(name)) invalid('MAIN_STAR_RULE_MISSING')
  return name as AiChartD1MajorStarName
}

function findTianliangRelation(
  n0: AiChartD1N0,
  palace: AiChartD1N0Palace,
): Readonly<{
  palace: AiChartD1N0Palace
  star: AiChartD1N0StarPlacement
}> | null {
  const samePalaceStar = palace.sourceMajorStars.find(
    (star) => star.name === '天梁',
  )
  if (samePalaceStar !== undefined) {
    return { palace, star: samePalaceStar }
  }
  const oppositePalace = getPalace(n0, palace.oppositePalaceId)
  const oppositeStar = oppositePalace.sourceMajorStars.find(
    (star) => star.name === '天梁',
  )
  return oppositeStar === undefined
    ? null
    : { palace: oppositePalace, star: oppositeStar }
}

function createFinding(input: Readonly<{
  ruleId: string
  palace: AiChartD1N0Palace
  star: AiChartD1N0StarPlacement
  starName: AiChartD1MajorStarName
  canonicalHealthDirection: string
  activation: AiChartD1HealthDirectionActivation
  relatedPalace?: AiChartD1N0Palace
  relatedStar?: AiChartD1N0StarPlacement
}>): AiChartD1HealthDirectionFinding {
  return freezeAiChartD1Value({
    ruleId: input.ruleId,
    sourcePalaceId: input.palace.palaceId,
    sourceStarPlacementId: input.star.placementId,
    sourceStarName: input.starName,
    canonicalHealthDirection: input.canonicalHealthDirection,
    activation: input.activation,
    relatedPalaceId: input.relatedPalace?.palaceId ?? null,
    relatedStarPlacementId: input.relatedStar?.placementId ?? null,
    relatedStarName:
      input.relatedStar === undefined
        ? null
        : parseMainStarName(input.relatedStar.name),
  })
}

export function buildAiChartD1HealthDirectionScan(
  input: unknown,
): AiChartD1HealthDirectionScan {
  const { n0, gender } = parseInput(input)
  const findings: AiChartD1HealthDirectionFinding[] = []

  for (const palaceId of AI_CHART_D1_HEALTH_DIRECTION_SCAN_PALACE_IDS) {
    const palace = getPalace(n0, palaceId)
    for (const star of palace.sourceMajorStars) {
      const starName = parseMainStarName(star.name)
      const rule = RULE_BY_STAR.get(starName)
      if (rule === undefined) invalid('MAIN_STAR_RULE_MISSING')

      for (const direction of rule.directDirections) {
        findings.push(
          createFinding({
            ruleId: rule.ruleId,
            palace,
            star,
            starName,
            canonicalHealthDirection: direction,
            activation: 'DIRECT',
          }),
        )
      }

      if (starName === '天機') {
        const relation = findTianliangRelation(n0, palace)
        if (relation !== null) {
          findings.push(
            createFinding({
              ruleId: AI_CHART_D1_HEALTH_TIANJI_TIANLIANG_RULE.ruleId,
              palace,
              star,
              starName,
              canonicalHealthDirection:
                AI_CHART_D1_HEALTH_TIANJI_TIANLIANG_RULE.canonicalHealthDirection,
              activation: 'TIANJI_TIANLIANG_SAME_OR_OPPOSITE',
              relatedPalace: relation.palace,
              relatedStar: relation.star,
            }),
          )
        }
      }

      if (WU_WEI_BRANCHES.has(palace.earthlyBranch)) {
        const eyeRule =
          starName === '太陽'
            ? CONDITIONAL_RULES.taiyangEyes
            : starName === '太陰'
              ? CONDITIONAL_RULES.taiyinEyes
              : null
        if (eyeRule !== null) {
          findings.push(
            createFinding({
              ruleId: eyeRule.ruleId,
              palace,
              star,
              starName,
              canonicalHealthDirection: eyeRule.canonicalHealthDirection,
              activation: 'BRANCH_WU_WEI',
            }),
          )
        }
      }

      if (
        gender === 'female' &&
        (starName === '太陰' || starName === '破軍')
      ) {
        const femaleRule =
          starName === '太陰'
            ? CONDITIONAL_RULES.taiyinFemale
            : CONDITIONAL_RULES.pojunFemale
        findings.push(
          createFinding({
            ruleId: femaleRule.ruleId,
            palace,
            star,
            starName,
            canonicalHealthDirection: femaleRule.canonicalHealthDirection,
            activation: 'SUBJECT_FEMALE',
          }),
        )
      }
    }
  }

  const canonicalHealthDirections = [...new Set(
    findings.map((finding) => finding.canonicalHealthDirection),
  )]

  return freezeAiChartD1Value({
    contractVersion: AI_CHART_D1_HEALTH_DIRECTION_SCAN_VERSION,
    sourceN0ContractVersion: n0.contractVersion,
    sourceSnapshotSha256: n0.sourceSnapshotSha256,
    scannedPalaceIds: AI_CHART_D1_HEALTH_DIRECTION_SCAN_PALACE_IDS,
    findings,
    canonicalHealthDirections,
  })
}
