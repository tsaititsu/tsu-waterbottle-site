import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeAiChartD1N0 } from './d1N0'
import { AI_CHART_D1_PALACE_IDENTITIES } from './d1N0Constants'
import {
  AI_CHART_D1_HEALTH_REMINDER_CARD_REGISTRY,
  buildAiChartD1HealthReminderSection,
} from './d1HealthReminderCards'
import {
  AI_CHART_D1_HEALTH_DIRECTION_SCAN_PALACE_IDS,
  AI_CHART_D1_HEALTH_MAIN_STAR_RULES,
  AI_CHART_D1_HEALTH_TIANJI_TIANLIANG_RULE,
  AiChartD1HealthDirectionScanError,
  buildAiChartD1HealthDirectionScan,
} from './d1HealthDirectionScan'

type MutableRecord = Record<string, unknown>

const BRANCHES = [
  '子',
  '丑',
  '寅',
  '卯',
  '辰',
  '巳',
  '午',
  '未',
  '申',
  '酉',
  '戌',
  '亥',
] as const
const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const

function star(name: string, type = 'major'): MutableRecord {
  return { name, type, scope: 'origin' }
}

function createSnapshot(): MutableRecord {
  return {
    version: 'ai-chart-chart-snapshot/v1',
    source: 'waterbottle-ziwei-native',
    engineVersion: 'v1',
    birthInputVersion: 'ai-chart-birth-input/v1',
    lunarDate: 'synthetic-health-scan',
    fiveElementsClass: 'synthetic-health-scan',
    palaces: AI_CHART_D1_PALACE_IDENTITIES.map((identity, index) => ({
      index,
      name: identity.engineName,
      isMingPalace: index === 0,
      isBodyPalace: index === 0,
      heavenlyStem: STEMS[index % STEMS.length],
      earthlyBranch: BRANCHES[index],
      majorStars: [] as MutableRecord[],
      minorStars: [] as MutableRecord[],
      adjectiveStars: [] as MutableRecord[],
      decadal: {
        range: [index * 10, index * 10 + 9],
        heavenlyStem: STEMS[(index + 1) % STEMS.length],
        earthlyBranch: BRANCHES[(index + 1) % BRANCHES.length],
      },
      ages: [index + 1],
    })),
  }
}

function snapshotPalaces(snapshot: MutableRecord): MutableRecord[] {
  assert.equal(Array.isArray(snapshot.palaces), true)
  return snapshot.palaces as MutableRecord[]
}

function createN0(
  assignments: readonly Readonly<{
    palaceIndex: number
    stars: readonly string[]
  }>[],
) {
  const snapshot = createSnapshot()
  const palaces = snapshotPalaces(snapshot)
  for (const assignment of assignments) {
    palaces[assignment.palaceIndex].majorStars = assignment.stars.map((name) =>
      star(name),
    )
  }
  return normalizeAiChartD1N0(snapshot, {
    chartId: 'chart:synthetic-health-scan',
  })
}

test('four-palace scan maps every actual main star through the fixed authority table', () => {
  const scan = buildAiChartD1HealthDirectionScan({
    n0: createN0([
      { palaceIndex: 0, stars: ['紫微', '七殺'] },
      { palaceIndex: 5, stars: ['天同', '太陰'] },
      { palaceIndex: 6, stars: ['天機', '天梁'] },
      { palaceIndex: 11, stars: ['廉貞', '貪狼'] },
    ]),
    gender: 'female',
  })

  assert.deepEqual(scan.scannedPalaceIds, [
    'palace:ming',
    'palace:travel',
    'palace:health',
    'palace:parents',
  ])
  assert.deepEqual(
    scan.findings.map((finding) => [
      finding.sourcePalaceId,
      finding.sourceStarName,
      finding.canonicalHealthDirection,
      finding.activation,
    ]),
    [
      ['palace:ming', '紫微', '脾胃相關', 'DIRECT'],
      ['palace:ming', '七殺', '肺部與呼吸相關', 'DIRECT'],
      ['palace:ming', '七殺', '骨骼與脊椎相關', 'DIRECT'],
      ['palace:ming', '七殺', '頭部與神經急症相關', 'DIRECT'],
      ['palace:ming', '七殺', '皮膚相關', 'DIRECT'],
      ['palace:travel', '天機', '肝臟相關', 'DIRECT'],
      ['palace:travel', '天機', '肌肉筋脈與四肢相關', 'DIRECT'],
      [
        'palace:travel',
        '天機',
        '骨骼與脊椎相關',
        'TIANJI_TIANLIANG_SAME_OR_OPPOSITE',
      ],
      ['palace:travel', '天梁', '骨骼與脊椎相關', 'DIRECT'],
      ['palace:travel', '天梁', '脾胃相關', 'DIRECT'],
      ['palace:health', '天同', '腎臟相關', 'DIRECT'],
      ['palace:health', '天同', '口腔與牙齒相關', 'DIRECT'],
      ['palace:health', '天同', '耳朵與聽力相關', 'DIRECT'],
      ['palace:health', '天同', '內分泌與代謝相關', 'DIRECT'],
      ['palace:health', '太陰', '腎臟相關', 'DIRECT'],
      ['palace:health', '太陰', '婦科與生殖相關', 'SUBJECT_FEMALE'],
      ['palace:parents', '廉貞', '血液相關', 'DIRECT'],
      ['palace:parents', '貪狼', '肝臟相關', 'DIRECT'],
      ['palace:parents', '貪狼', '肌肉筋脈與四肢相關', 'DIRECT'],
    ],
  )
  assert.deepEqual(scan.canonicalHealthDirections, [
    '脾胃相關',
    '肺部與呼吸相關',
    '骨骼與脊椎相關',
    '頭部與神經急症相關',
    '皮膚相關',
    '肝臟相關',
    '肌肉筋脈與四肢相關',
    '腎臟相關',
    '口腔與牙齒相關',
    '耳朵與聽力相關',
    '內分泌與代謝相關',
    '婦科與生殖相關',
    '血液相關',
  ])
})

test('fixed fourteen-star rules match the approved lecture mappings', () => {
  assert.deepEqual(
    AI_CHART_D1_HEALTH_MAIN_STAR_RULES.map((rule) => ({
      starName: rule.starName,
      directions: rule.directDirections,
    })),
    [
      { starName: '紫微', directions: ['脾胃相關'] },
      { starName: '天機', directions: ['肝臟相關', '肌肉筋脈與四肢相關'] },
      { starName: '太陽', directions: ['心臟與心血管相關'] },
      { starName: '武曲', directions: ['肺部與呼吸相關', '骨骼與脊椎相關'] },
      { starName: '天同', directions: ['腎臟相關', '口腔與牙齒相關', '耳朵與聽力相關', '內分泌與代謝相關'] },
      { starName: '廉貞', directions: ['血液相關'] },
      { starName: '天府', directions: ['脾胃相關'] },
      { starName: '太陰', directions: ['腎臟相關'] },
      { starName: '貪狼', directions: ['肝臟相關', '肌肉筋脈與四肢相關'] },
      { starName: '巨門', directions: ['腎臟相關', '支氣管與呼吸道相關', '口腔與牙齒相關'] },
      { starName: '天相', directions: ['腎臟相關', '內分泌與代謝相關', '淋巴相關', '循環相關'] },
      { starName: '天梁', directions: ['骨骼與脊椎相關', '脾胃相關'] },
      { starName: '七殺', directions: ['肺部與呼吸相關', '骨骼與脊椎相關', '頭部與神經急症相關', '皮膚相關'] },
      { starName: '破軍', directions: ['腎臟相關', '泌尿相關'] },
    ],
  )
  assert.equal(AI_CHART_D1_HEALTH_MAIN_STAR_RULES.length, 14)
  assert.equal(Object.isFrozen(AI_CHART_D1_HEALTH_MAIN_STAR_RULES), true)

  const knownDirections = new Set(
    AI_CHART_D1_HEALTH_REMINDER_CARD_REGISTRY.flatMap(
      (card) => card.canonicalHealthDirections,
    ),
  )
  for (const rule of AI_CHART_D1_HEALTH_MAIN_STAR_RULES) {
    assert.equal(Object.isFrozen(rule), true)
    assert.equal(Object.isFrozen(rule.directDirections), true)
    assert.equal(
      rule.directDirections.every((direction) => knownDirections.has(direction)),
      true,
    )
  }
})

test('all fourteen main stars produce their approved direct directions through the scanner', () => {
  const cases = [
    ['紫微', ['脾胃相關']],
    ['天機', ['肝臟相關', '肌肉筋脈與四肢相關']],
    ['太陽', ['心臟與心血管相關']],
    ['武曲', ['肺部與呼吸相關', '骨骼與脊椎相關']],
    [
      '天同',
      ['腎臟相關', '口腔與牙齒相關', '耳朵與聽力相關', '內分泌與代謝相關'],
    ],
    ['廉貞', ['血液相關']],
    ['天府', ['脾胃相關']],
    ['太陰', ['腎臟相關']],
    ['貪狼', ['肝臟相關', '肌肉筋脈與四肢相關']],
    ['巨門', ['腎臟相關', '支氣管與呼吸道相關', '口腔與牙齒相關']],
    ['天相', ['腎臟相關', '內分泌與代謝相關', '淋巴相關', '循環相關']],
    ['天梁', ['骨骼與脊椎相關', '脾胃相關']],
    [
      '七殺',
      ['肺部與呼吸相關', '骨骼與脊椎相關', '頭部與神經急症相關', '皮膚相關'],
    ],
    ['破軍', ['腎臟相關', '泌尿相關']],
  ] as const

  for (const [starName, expectedDirections] of cases) {
    const scan = buildAiChartD1HealthDirectionScan({
      n0: createN0([{ palaceIndex: 0, stars: [starName] }]),
      gender: 'male',
    })
    assert.deepEqual(
      scan.findings
        .filter((finding) => finding.activation === 'DIRECT')
        .map((finding) => finding.canonicalHealthDirection),
      expectedDirections,
      starName,
    )
  }
})

test('太陽與太陰只在午未宮位增加眼睛方向', () => {
  const activeTaiyang = buildAiChartD1HealthDirectionScan({
    n0: createN0([{ palaceIndex: 6, stars: ['太陽'] }]),
    gender: 'male',
  })
  const activeTaiyin = buildAiChartD1HealthDirectionScan({
    n0: createN0([{ palaceIndex: 6, stars: ['太陰'] }]),
    gender: 'male',
  })
  assert.equal(
    [...activeTaiyang.findings, ...activeTaiyin.findings].filter(
      (finding) =>
        finding.canonicalHealthDirection === '眼睛與視力相關',
    ).length,
    2,
  )
  assert.equal(
    [...activeTaiyang.findings, ...activeTaiyin.findings]
      .filter((finding) => finding.canonicalHealthDirection === '眼睛與視力相關')
      .every((finding) => finding.activation === 'BRANCH_WU_WEI'),
    true,
  )

  const inactive = buildAiChartD1HealthDirectionScan({
    n0: createN0([
      { palaceIndex: 0, stars: ['太陽'] },
      { palaceIndex: 5, stars: ['太陰'] },
    ]),
    gender: 'male',
  })
  assert.equal(inactive.canonicalHealthDirections.includes('眼睛與視力相關'), false)
})

test('女性條件只為太陰與破軍增加婦科生殖方向', () => {
  const n0 = createN0([
    { palaceIndex: 0, stars: ['太陰'] },
    { palaceIndex: 5, stars: ['破軍'] },
  ])
  const male = buildAiChartD1HealthDirectionScan({ n0, gender: 'male' })
  const female = buildAiChartD1HealthDirectionScan({ n0, gender: 'female' })

  assert.equal(male.canonicalHealthDirections.includes('婦科與生殖相關'), false)
  assert.equal(
    female.findings.filter(
      (finding) => finding.canonicalHealthDirection === '婦科與生殖相關',
    ).length,
    2,
  )
})

test('天機天梁只在同宮或對宮建立固定脊椎關係軌跡', () => {
  const samePalace = buildAiChartD1HealthDirectionScan({
    n0: createN0([{ palaceIndex: 0, stars: ['天機', '天梁'] }]),
    gender: 'male',
  })
  const sameFinding = samePalace.findings.find(
    (finding) =>
      finding.ruleId === AI_CHART_D1_HEALTH_TIANJI_TIANLIANG_RULE.ruleId,
  )
  assert.deepEqual(
    sameFinding && {
      activation: sameFinding.activation,
      sourcePalaceId: sameFinding.sourcePalaceId,
      relatedPalaceId: sameFinding.relatedPalaceId,
      relatedStarName: sameFinding.relatedStarName,
    },
    {
      activation: 'TIANJI_TIANLIANG_SAME_OR_OPPOSITE',
      sourcePalaceId: 'palace:ming',
      relatedPalaceId: 'palace:ming',
      relatedStarName: '天梁',
    },
  )

  const opposite = buildAiChartD1HealthDirectionScan({
    n0: createN0([
      { palaceIndex: 0, stars: ['天機'] },
      { palaceIndex: 6, stars: ['天梁'] },
    ]),
    gender: 'male',
  })
  const oppositeFinding = opposite.findings.find(
    (finding) =>
      finding.ruleId === AI_CHART_D1_HEALTH_TIANJI_TIANLIANG_RULE.ruleId,
  )
  assert.equal(oppositeFinding?.relatedPalaceId, 'palace:travel')

  const absent = buildAiChartD1HealthDirectionScan({
    n0: createN0([{ palaceIndex: 0, stars: ['天機', '巨門'] }]),
    gender: 'male',
  })
  assert.equal(
    absent.findings.some(
      (finding) =>
        finding.ruleId === AI_CHART_D1_HEALTH_TIANJI_TIANLIANG_RULE.ruleId,
    ),
    false,
  )
})

test('掃描只使用四宮實際主星，不把借星、三方或輔星改寫成身體方向', () => {
  const n0 = createN0([
    { palaceIndex: 1, stars: ['紫微'] },
    { palaceIndex: 6, stars: ['天相'] },
  ])
  const scan = buildAiChartD1HealthDirectionScan({ n0, gender: 'male' })

  assert.deepEqual(
    [...new Set(scan.findings.map((finding) => finding.sourcePalaceId))],
    ['palace:travel'],
  )
  assert.equal(scan.findings.some((finding) => finding.sourceStarName === '紫微'), false)
  assert.deepEqual(scan.canonicalHealthDirections, [
    '腎臟相關',
    '內分泌與代謝相關',
    '淋巴相關',
    '循環相關',
  ])
  assert.equal(scan.canonicalHealthDirections.includes('頸部相關'), false)
})

test('巨門固定為腎臟、支氣管與口腔，不擴張成肺部、過敏或代謝', () => {
  const scan = buildAiChartD1HealthDirectionScan({
    n0: createN0([{ palaceIndex: 0, stars: ['巨門'] }]),
    gender: 'male',
  })
  assert.deepEqual(scan.canonicalHealthDirections, [
    '腎臟相關',
    '支氣管與呼吸道相關',
    '口腔與牙齒相關',
  ])
  assert.equal(scan.canonicalHealthDirections.includes('肺部與呼吸相關'), false)
  assert.equal(scan.canonicalHealthDirections.includes('支氣管與過敏相關'), false)
  assert.equal(scan.canonicalHealthDirections.includes('內分泌與代謝相關'), false)
})

test('掃描方向可直接交給既有 deterministic 提醒卡選擇器', () => {
  const scan = buildAiChartD1HealthDirectionScan({
    n0: createN0([{ palaceIndex: 0, stars: ['巨門'] }]),
    gender: 'male',
  })
  const section = buildAiChartD1HealthReminderSection({
    targetPalaceId: 'palace:health',
    canonicalHealthDirections: scan.canonicalHealthDirections,
  })
  assert.deepEqual(
    section?.reminderCards.map((card) => card.cardId),
    ['H07', 'H06', 'H09'],
  )
})

test('輸出與嵌套軌跡全部不可變', () => {
  const scan = buildAiChartD1HealthDirectionScan({
    n0: createN0([{ palaceIndex: 0, stars: ['天相'] }]),
    gender: 'male',
  })
  assert.equal(Object.isFrozen(scan), true)
  assert.equal(Object.isFrozen(scan.scannedPalaceIds), true)
  assert.equal(Object.isFrozen(scan.findings), true)
  assert.equal(scan.findings.every(Object.isFrozen), true)
  assert.equal(Object.isFrozen(scan.canonicalHealthDirections), true)
  assert.equal(Object.isFrozen(AI_CHART_D1_HEALTH_DIRECTION_SCAN_PALACE_IDS), true)
})

test('畸形 N0 與 gender 固定 fail closed，不回傳原始值', () => {
  const cases = [
    { n0: { raw: 'sensitive-marker' }, gender: 'male' },
    { n0: createN0([]), gender: 'unknown-sensitive-marker' },
  ]
  for (const input of cases) {
    assert.throws(
      () => buildAiChartD1HealthDirectionScan(input),
      (error: unknown) => {
        assert.equal(error instanceof AiChartD1HealthDirectionScanError, true)
        assert.equal((error as Error).message.includes('sensitive-marker'), false)
        assert.equal(JSON.stringify(error).includes('sensitive-marker'), false)
        assert.equal(Object.isFrozen(error), true)
        return true
      },
    )
  }
})

test('外層 accessor 與 symbol 欄位會在讀值前 fail closed', () => {
  let getterCalls = 0
  const accessorInput = Object.defineProperties({}, {
    n0: {
      enumerable: true,
      get() {
        getterCalls += 1
        return createN0([])
      },
    },
    gender: {
      enumerable: true,
      value: 'male',
    },
  })
  assert.throws(
    () => buildAiChartD1HealthDirectionScan(accessorInput),
    AiChartD1HealthDirectionScanError,
  )
  assert.equal(getterCalls, 0)

  const symbolInput = {
    n0: createN0([]),
    gender: 'male',
    [Symbol('hidden')]: 'sensitive-marker',
  }
  assert.throws(
    () => buildAiChartD1HealthDirectionScan(symbolInput),
    AiChartD1HealthDirectionScanError,
  )
})
