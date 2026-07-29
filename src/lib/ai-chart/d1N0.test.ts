import assert from 'node:assert/strict'
import { MUTAGEN_TABLE } from '../../features/ziwei-chart/lib/engine/constants'
import {
  AI_CHART_D1_DOUBLE_MAJOR_STAR_PAIRS,
  AI_CHART_D1_F1_BLOCKED_STATUS,
  AI_CHART_D1_MUTAGEN_TYPES,
  AI_CHART_D1_N0_CONTRACT_VERSION,
  AI_CHART_D1_N0_INVALID,
  AI_CHART_D1_PALACE_IDENTITIES,
} from './d1N0Constants'
import { normalizeAiChartD1N0 } from './d1N0'
import { parseAiChartD1N0 } from './d1N0Parser'

type MutableRecord = Record<string, unknown>
type SyntheticStar = Readonly<{
  name: string
  type: string
  scope: 'origin'
  mutagen?: string
  group?: string
}>

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

let checks = 0

function check(name: string, run: () => void) {
  try {
    run()
    checks += 1
    console.log(`✓ ${name}`)
  } catch (error) {
    console.error(`✗ ${name}`)
    throw error
  }
}

function star(
  name: string,
  type: string,
  mutagen?: string,
): SyntheticStar {
  return {
    name,
    type,
    scope: 'origin',
    ...(mutagen === undefined ? {} : { mutagen }),
  }
}

function createBaseSnapshot(bodyIndex: number): MutableRecord {
  return {
    version: 'ai-chart-chart-snapshot/v1',
    source: 'waterbottle-ziwei-native',
    engineVersion: 'v1',
    birthInputVersion: 'ai-chart-birth-input/v1',
    lunarDate: 'synthetic-lunar-marker',
    fiveElementsClass: 'synthetic-five-elements-marker',
    palaces: AI_CHART_D1_PALACE_IDENTITIES.map((identity, index) => ({
      index,
      name: identity.engineName,
      isMingPalace: index === 0,
      isBodyPalace: index === bodyIndex,
      heavenlyStem: STEMS[index % STEMS.length],
      earthlyBranch: BRANCHES[index],
      majorStars: [] as SyntheticStar[],
      minorStars: [] as SyntheticStar[],
      adjectiveStars: [] as SyntheticStar[],
      decadal: {
        range: [index * 10, index * 10 + 9],
        heavenlyStem: STEMS[(index + 1) % STEMS.length],
        earthlyBranch: BRANCHES[(index + 1) % BRANCHES.length],
      },
      ages: [index + 1],
    })),
  }
}

function palaces(snapshot: MutableRecord): MutableRecord[] {
  assert.equal(Array.isArray(snapshot.palaces), true)
  return snapshot.palaces as MutableRecord[]
}

function starArray(palace: MutableRecord, field: string): SyntheticStar[] {
  assert.equal(Array.isArray(palace[field]), true)
  return palace[field] as SyntheticStar[]
}

function fixtureA(): MutableRecord {
  const snapshot = createBaseSnapshot(3)
  const items = palaces(snapshot)
  items[0].majorStars = [star('紫微', 'major', '化科'), star('七殺', 'major')]
  items[1].majorStars = [star('武曲', 'major')]
  items[3].majorStars = [star('天同', 'major'), star('太陰', 'major', '化忌')]
  items[4].majorStars = [star('廉貞', 'major'), star('天相', 'major')]
  items[6].majorStars = [star('天府', 'major')]
  items[8].majorStars = [star('天機', 'major', '化祿'), star('巨門', 'major')]
  items[10].majorStars = [star('太陽', 'major')]
  items[11].majorStars = [star('天梁', 'major', '化權')]

  items[0].minorStars = [star('文昌', 'soft'), star('擎羊', 'tough')]
  items[1].minorStars = [star('文曲', 'soft'), star('陀羅', 'tough')]
  items[2].minorStars = [star('左輔', 'soft'), star('火星', 'tough')]
  items[3].minorStars = [star('右弼', 'soft'), star('鈴星', 'tough')]
  items[4].minorStars = [star('天魁', 'soft'), star('祿存', 'lucun')]
  items[5].minorStars = [star('天鉞', 'soft')]
  items[6].minorStars = [star('地空', 'tough'), star('地劫', 'tough')]
  items[7].minorStars = [star('天馬', 'tianma')]
  items[8].adjectiveStars = [
    star('紅鸞', 'flower'),
    star('天才', 'adjective'),
    star('博士', 'helper'),
  ]
  return snapshot
}

function fixtureB(): MutableRecord {
  const snapshot = createBaseSnapshot(0)
  const items = palaces(snapshot)
  items[0].majorStars = [star('天同', 'major', '化科'), star('太陰', 'major')]
  items[6].majorStars = [star('紫微', 'major'), star('天相', 'major', '化忌')]
  items[7].majorStars = [star('武曲', 'major', '化權')]
  items[8].majorStars = [star('太陽', 'major', '化祿')]
  items[9].majorStars = [star('天梁', 'major')]
  items[11].majorStars = [star('紫微', 'major'), star('天府', 'major')]
  items[2].minorStars = [star('擎羊', 'tough')]
  items[3].minorStars = [star('祿存', 'lucun')]
  return snapshot
}

const MUTAGEN_SUPPORTING_STAR_TYPES: Readonly<Record<string, string>> =
  Object.freeze({
    文昌: 'soft',
    文曲: 'soft',
    左輔: 'soft',
    右弼: 'soft',
  })

function mutagenSnapshot(
  assignments: readonly Readonly<{
    starName: string
    mutagen: (typeof AI_CHART_D1_MUTAGEN_TYPES)[number]
  }>[],
): MutableRecord {
  const snapshot = createBaseSnapshot(0)
  const items = palaces(snapshot)
  assignments.forEach(({ starName, mutagen }, index) => {
    const supportingType = MUTAGEN_SUPPORTING_STAR_TYPES[starName]
    if (supportingType === undefined) {
      items[index].majorStars = [star(starName, 'major', mutagen)]
    } else {
      items[index].minorStars = [star(starName, supportingType, mutagen)]
    }
  })
  return snapshot
}

function replaceStringDeep(value: unknown, from: string, to: string): void {
  if (value === null || typeof value !== 'object') return
  for (const [key, child] of Object.entries(value)) {
    if (typeof child === 'string') {
      ;(value as MutableRecord)[key] = child.replaceAll(from, to)
    } else {
      replaceStringDeep(child, from, to)
    }
  }
}

function swapFirstTwo(value: unknown): void {
  assert.equal(Array.isArray(value), true)
  const items = value as unknown[]
  ;[items[0], items[1]] = [items[1], items[0]]
}

function normalize(snapshot: unknown = fixtureA()) {
  return normalizeAiChartD1N0(snapshot, { chartId: 'chart:synthetic-a' })
}

function expectInvalid(value: unknown, rawMarker?: string) {
  try {
    normalize(value)
    assert.fail('expected N0 validation failure')
  } catch (error) {
    assert.equal(error instanceof Error, true)
    if (!(error instanceof Error)) assert.fail('expected Error')
    assert.equal(error.message, AI_CHART_D1_N0_INVALID)
    if (rawMarker) assert.equal(error.message.includes(rawMarker), false)
  }
}

function expectInvalidMutation(mutate: (snapshot: MutableRecord) => void) {
  const snapshot = structuredClone(fixtureA()) as MutableRecord
  mutate(snapshot)
  expectInvalid(snapshot)
}

function assertNoForbiddenKeys(value: unknown) {
  const forbidden = new Set([
    'name',
    'solarDate',
    'lunarDate',
    'timeIndex',
    'gender',
    'fixLeap',
    'birthInput',
    'userId',
    'user_id',
    'reportId',
    'orderId',
    'paymentId',
    'fiveElementsClass',
    'decadal',
    'ages',
    'prompt',
    'openAiRequest',
    'openAiResponse',
    'flyingTransformations',
  ])
  const visit = (current: unknown): void => {
    if (current === null || typeof current !== 'object') return
    if (Array.isArray(current)) {
      current.forEach(visit)
      return
    }
    for (const [key, child] of Object.entries(current)) {
      if (key === 'name') {
        const parent = current as MutableRecord
        assert.equal(
          'placementId' in parent || 'borrowedPlacementId' in parent,
          true,
        )
      } else {
        assert.equal(forbidden.has(key), false, key)
      }
      visit(child)
    }
  }
  visit(value)
}

check('N0 contract version is locked', () => {
  assert.equal(normalize().contractVersion, AI_CHART_D1_N0_CONTRACT_VERSION)
})

check('valid synthetic Snapshot A normalizes', () => {
  const result = normalize()
  assert.equal(result.palaces.length, 12)
  assert.equal(result.chartId, 'chart:synthetic-a')
})

check('valid synthetic Snapshot B normalizes', () => {
  assert.equal(normalize(fixtureB()).palaces.length, 12)
})

check('unknown N0 version is rejected by runtime parser', () => {
  const result = structuredClone(normalize()) as MutableRecord
  result.contractVersion = 'ai-chart-d1-n0/unknown'
  assert.throws(() => parseAiChartD1N0(result), {
    message: AI_CHART_D1_N0_INVALID,
  })
})

check('non-plain Snapshot values are rejected', () => {
  for (const value of [null, [], new Date(), new (class Snapshot {})()]) {
    expectInvalid(value)
  }
})

check('unknown Snapshot top-level field is rejected', () => {
  expectInvalidMutation((snapshot) => {
    snapshot.unknownField = 'synthetic-marker'
  })
})

check('Snapshot PII field is rejected with fixed safe error', () => {
  const marker = 'synthetic-secret-marker'
  const snapshot = fixtureA()
  snapshot.solarDate = marker
  expectInvalid(snapshot, marker)
})

check('discarded Snapshot fields never enter N0', () => {
  const result = normalize()
  const serialized = JSON.stringify(result)
  for (const marker of [
    'synthetic-lunar-marker',
    'synthetic-five-elements-marker',
    'decadal',
    'ages',
  ]) {
    assert.equal(serialized.includes(marker), false, marker)
  }
})

check('recursive PII denylist is absent from N0', () => {
  assertNoForbiddenKeys(normalize())
})

check('N0 contains all twelve deterministic palace IDs and indices', () => {
  const result = normalize()
  assert.deepEqual(result.palaces.map((palace) => palace.index), [...Array(12).keys()])
  assert.deepEqual(
    result.palaces.map((palace) => palace.palaceId),
    AI_CHART_D1_PALACE_IDENTITIES.map((identity) => identity.palaceId),
  )
})

check('N0 parser rejects a reordered palace array', () => {
  const result = structuredClone(normalize()) as MutableRecord
  swapFirstTwo(result.palaces)
  assert.throws(() => parseAiChartD1N0(result), {
    message: AI_CHART_D1_N0_INVALID,
  })
})

check('N0 parser rejects synchronized palace and relationship reordering', () => {
  const result = structuredClone(normalize()) as MutableRecord
  swapFirstTwo(result.palaces)
  swapFirstTwo(result.relationships)
  assert.throws(() => parseAiChartD1N0(result), {
    message: AI_CHART_D1_N0_INVALID,
  })
})

check('N0 parser rejects all three canonical arrays reordered together', () => {
  const result = structuredClone(normalize()) as MutableRecord
  swapFirstTwo(result.palaces)
  swapFirstTwo(result.relationships)
  const globalScan = result.globalScan as MutableRecord
  swapFirstTwo(globalScan.palaceScans)
  assert.throws(() => parseAiChartD1N0(result), {
    message: AI_CHART_D1_N0_INVALID,
  })
})

for (const [label, mutate] of [
  ['unknown palace name', (items: MutableRecord[]) => (items[2].name = '未知宮')],
  ['duplicate palace name', (items: MutableRecord[]) => (items[2].name = items[1].name)],
  ['missing palace', (items: MutableRecord[]) => items.pop()],
  [
    'duplicate earthly branch',
    (items: MutableRecord[]) => (items[2].earthlyBranch = items[1].earthlyBranch),
  ],
  [
    'duplicate Ming flags',
    (items: MutableRecord[]) => (items[1].isMingPalace = true),
  ],
  [
    'duplicate body flags',
    (items: MutableRecord[]) => (items[1].isBodyPalace = true),
  ],
] as const) {
  check(`${label} is rejected`, () => {
    expectInvalidMutation((snapshot) => mutate(palaces(snapshot)))
  })
}

check('Ming and body can be different palaces', () => {
  const result = normalize()
  assert.match(result.sourceSnapshotSha256, /^[a-f0-9]{64}$/u)
  assert.equal(result.sameAsMingPalace, false)
  assert.notEqual(result.mingPalaceId, result.bodyPalaceId)
})

check('canonical Snapshot digest is stable and changes with source content', () => {
  const first = fixtureA()
  const reordered = Object.fromEntries(
    Object.entries(first).reverse(),
  )
  const changed = structuredClone(first)
  changed.lunarDate = 'different-synthetic-lunar-marker'

  assert.equal(
    normalize(first).sourceSnapshotSha256,
    normalize(reordered).sourceSnapshotSha256,
  )
  assert.notEqual(
    normalize(first).sourceSnapshotSha256,
    normalize(changed).sourceSnapshotSha256,
  )
})

check('N0 parser rejects a malformed Snapshot digest', () => {
  const forged = structuredClone(normalize()) as MutableRecord
  forged.sourceSnapshotSha256 = 'f'.repeat(63)
  assert.throws(() => parseAiChartD1N0(forged), {
    message: AI_CHART_D1_N0_INVALID,
  })
})

check('Ming and body can be the same palace', () => {
  const result = normalize(fixtureB())
  assert.equal(result.sameAsMingPalace, true)
  assert.equal(result.mingPalaceId, result.bodyPalaceId)
})

check('single major star is retained', () => {
  const result = normalize()
  assert.deepEqual(result.palaces[1].canonicalMajorStars.map((item) => item.name), ['武曲'])
})

check('empty palace remains structurally empty', () => {
  assert.equal(normalize().palaces[2].isEmptyOfMajorStars, true)
})

check('two legal major stars are retained', () => {
  assert.deepEqual(normalize().palaces[0].canonicalMajorStars.map((item) => item.name), ['紫微', '七殺'])
})

check('three major stars are rejected', () => {
  expectInvalidMutation((snapshot) => {
    starArray(palaces(snapshot)[0], 'majorStars').push(star('天府', 'major'))
  })
})

check('unknown major star is rejected', () => {
  expectInvalidMutation((snapshot) => {
    palaces(snapshot)[0].majorStars = [star('未知主星', 'major')]
  })
})

check('duplicate major star is rejected', () => {
  expectInvalidMutation((snapshot) => {
    palaces(snapshot)[0].majorStars = [star('紫微', 'major'), star('紫微', 'major')]
  })
})

check('source order is preserved while canonical order is normalized', () => {
  const palace = normalize(fixtureB()).palaces[0]
  assert.deepEqual(palace.sourceMajorStars.map((item) => item.name), ['天同', '太陰'])
  assert.deepEqual(palace.sourceMajorStars.map((item) => item.sourceOrder), [0, 1])
  assert.deepEqual(palace.canonicalMajorStars.map((item) => item.name), ['太陰', '天同'])
  assert.deepEqual(palace.canonicalMajorStars.map((item) => item.canonicalOrder), [0, 1])
})

for (const pair of AI_CHART_D1_DOUBLE_MAJOR_STAR_PAIRS) {
  check(`legal double-star pair ${pair.join('＋')} canonicalizes`, () => {
    const snapshot = fixtureA()
    palaces(snapshot)[0].majorStars = pair.map((name) => star(name, 'major'))
    assert.deepEqual(
      normalize(snapshot).palaces[0].canonicalMajorStars.map((item) => item.name),
      [...pair],
    )
  })
  check(`reversed double-star pair ${pair.join('＋')} canonicalizes`, () => {
    const snapshot = fixtureA()
    palaces(snapshot)[0].majorStars = [...pair]
      .reverse()
      .map((name) => star(name, 'major'))
    assert.deepEqual(
      normalize(snapshot).palaces[0].canonicalMajorStars.map((item) => item.name),
      [...pair],
    )
  })
}

check('illegal double-star pair is rejected', () => {
  expectInvalidMutation((snapshot) => {
    palaces(snapshot)[0].majorStars = [star('紫微', 'major'), star('天同', 'major')]
  })
})

check('太陰天同 uses the fixed canonical order', () => {
  const palace = normalize(fixtureB()).palaces[0]
  assert.deepEqual(palace.canonicalMajorStars.map((item) => item.name), ['太陰', '天同'])
})

for (const [name, type] of Object.entries({
  文昌: 'soft',
  文曲: 'soft',
  左輔: 'soft',
  右弼: 'soft',
  天魁: 'soft',
  天鉞: 'soft',
  擎羊: 'tough',
  陀羅: 'tough',
  火星: 'tough',
  鈴星: 'tough',
  祿存: 'lucun',
})) {
  check(`${name} is admitted as modeled ${type}`, () => {
    const snapshot = fixtureB()
    palaces(snapshot)[5].minorStars = [star(name, type)]
    const modeled = normalize(snapshot).palaces[5].modeledSupportingStars
    assert.deepEqual(modeled.map((item) => [item.name, item.type]), [[name, type]])
  })
}

check('modeled star type mismatch is rejected', () => {
  expectInvalidMutation((snapshot) => {
    palaces(snapshot)[5].minorStars = [star('文昌', 'tough')]
  })
})

check('duplicate modeled supporting star is rejected', () => {
  expectInvalidMutation((snapshot) => {
    palaces(snapshot)[5].minorStars = [
      star('文昌', 'soft'),
      star('文昌', 'soft'),
    ]
  })
})

for (const [name, type, collection] of [
  ['地空', 'tough', 'minorStars'],
  ['地劫', 'tough', 'minorStars'],
  ['天馬', 'tianma', 'minorStars'],
  ['紅鸞', 'flower', 'adjectiveStars'],
  ['天才', 'adjective', 'adjectiveStars'],
  ['博士', 'helper', 'adjectiveStars'],
] as const) {
  check(`${name} is preserved outside modeled semantic rules with a warning`, () => {
    const snapshot = fixtureB()
    palaces(snapshot)[5][collection] = [star(name, type)]
    const result = normalize(snapshot)
    assert.equal(result.palaces[5].modeledSupportingStars.some((item) => item.name === name), false)
    assert.equal(result.palaces[5].excludedStarSummary.some((item) => item.name === name), true)
    assert.equal(result.dataWarnings.some((warning) => warning.code === 'unmodeled_stars_present'), true)
  })
}

check('duplicate unmodeled adjective star names retain distinct source placements', () => {
  const snapshot = fixtureB()
  palaces(snapshot)[5].adjectiveStars = [
    star('小耗', 'adjective'),
    star('小耗', 'adjective'),
  ]

  const result = normalize(snapshot)
  const excluded = result.palaces[5].excludedStarSummary.filter(
    (item) => item.name === '小耗',
  )

  assert.equal(excluded.length, 2)
  assert.equal(new Set(excluded.map((item) => item.placementId)).size, 2)
  assert.deepEqual(
    excluded.map((item) => item.sourceIndex),
    [0, 1],
  )
  assert.equal(
    result.dataWarnings.some(
      (warning) =>
        warning.code === 'unmodeled_stars_present' &&
        warning.placementIds.includes(excluded[0].placementId) &&
        warning.placementIds.includes(excluded[1].placementId),
    ),
    true,
  )
})

for (const mutagen of ['化祿', '化權', '化科', '化忌'] as const) {
  check(`${mutagen} placement is indexed`, () => {
    const result = normalize()
    const item = result.natalMutagens.find((candidate) => candidate.type === mutagen)
    assert.ok(item)
    const palace = result.palaces.find((candidate) => candidate.palaceId === item.palaceId)
    assert.ok(palace)
    assert.equal(
      [...palace.sourceMajorStars, ...palace.modeledSupportingStars, ...palace.excludedStarSummary]
        .some((placement) => placement.placementId === item.starPlacementId),
      true,
    )
  })
}

MUTAGEN_TABLE.forEach((row, rowIndex) => {
  check(`MUTAGEN_TABLE row ${rowIndex} validates as one complete quartet`, () => {
    const snapshot = mutagenSnapshot(
      row.map((starName, index) => ({
        starName,
        mutagen: AI_CHART_D1_MUTAGEN_TYPES[index],
      })),
    )
    assert.equal(
      normalize(snapshot).readiness.natalMutagenStatus,
      'snapshot_origin_mutagen_table_validated',
    )
  })
})

check('a mixed complete quartet from different table rows is rejected', () => {
  expectInvalid(
    mutagenSnapshot([
      { starName: '天機', mutagen: '化祿' },
      { starName: '破軍', mutagen: '化權' },
      { starName: '武曲', mutagen: '化科' },
      { starName: '太陽', mutagen: '化忌' },
    ]),
  )
})

check('a compatible partial mutagen set remains partial', () => {
  const result = normalize(
    mutagenSnapshot([
      { starName: '天機', mutagen: '化祿' },
      { starName: '天梁', mutagen: '化權' },
      { starName: '紫微', mutagen: '化科' },
    ]),
  )
  assert.equal(
    result.readiness.natalMutagenStatus,
    'snapshot_origin_mutagen_partial',
  )
  assert.equal(
    result.dataWarnings.some(
      (warning) => warning.code === 'natal_mutagen_missing',
    ),
    true,
  )
})

check('individually legal but table-incompatible partial assignments are rejected', () => {
  expectInvalid(
    mutagenSnapshot([
      { starName: '天機', mutagen: '化祿' },
      { starName: '破軍', mutagen: '化權' },
    ]),
  )
})

check('an impossible star and mutagen assignment is rejected', () => {
  expectInvalid(
    mutagenSnapshot([{ starName: '紫微', mutagen: '化祿' }]),
  )
})

check('duplicate mutagen types stay partial when every assignment is a legal candidate', () => {
  const result = normalize(
    mutagenSnapshot([
      { starName: '廉貞', mutagen: '化祿' },
      { starName: '天機', mutagen: '化祿' },
    ]),
  )
  assert.equal(
    result.readiness.natalMutagenStatus,
    'snapshot_origin_mutagen_partial',
  )
  assert.equal(
    result.dataWarnings.some(
      (warning) => warning.code === 'natal_mutagen_duplicate_type',
    ),
    true,
  )
})

check('duplicate mutagen IDs are rejected by N0 parser', () => {
  const result = structuredClone(normalize()) as MutableRecord
  const mutagens = result.natalMutagens as MutableRecord[]
  mutagens[1].mutagenId = mutagens[0].mutagenId
  assert.throws(() => parseAiChartD1N0(result), { message: AI_CHART_D1_N0_INVALID })
})

check('no flying transformations or palace-stem-derived mutagens exist', () => {
  const result = normalize()
  const serialized = JSON.stringify(result)
  assert.equal(serialized.includes('flyingTransform'), false)
  assert.equal(result.natalMutagens.length, 4)
  assert.equal(result.palaces.every((palace) => palace.heavenlyStemAuthority === 'not_authoritative_flying_transform_source'), true)
})

for (let index = 0; index < 12; index += 1) {
  check(`palace ${index} has a valid bidirectional opposite relation`, () => {
    const result = normalize()
    const palace = result.palaces[index]
    const opposite = result.palaces.find((item) => item.palaceId === palace.oppositePalaceId)
    assert.ok(opposite)
    assert.equal(opposite.oppositePalaceId, palace.palaceId)
    assert.notEqual(opposite.palaceId, palace.palaceId)
  })
}

for (const [left, right] of [
  ['子', '丑'],
  ['寅', '亥'],
  ['卯', '戌'],
  ['辰', '酉'],
  ['巳', '申'],
  ['午', '未'],
] as const) {
  check(`hidden combination ${left}－${right} is bidirectional`, () => {
    const result = normalize()
    const leftPalace = result.palaces.find((palace) => palace.earthlyBranch === left)
    const rightPalace = result.palaces.find((palace) => palace.earthlyBranch === right)
    assert.ok(leftPalace)
    assert.ok(rightPalace)
    assert.equal(leftPalace.hiddenCombinationPalaceId, rightPalace.palaceId)
    assert.equal(rightPalace.hiddenCombinationPalaceId, leftPalace.palaceId)
  })
}

for (const group of [
  ['申', '子', '辰'],
  ['亥', '卯', '未'],
  ['寅', '午', '戌'],
  ['巳', '酉', '丑'],
] as const) {
  check(`trine ${group.join('－')} is complete`, () => {
    const result = normalize()
    for (const branch of group) {
      const palace = result.palaces.find((item) => item.earthlyBranch === branch)
      assert.ok(palace)
      assert.equal(palace.trinePalaceIds.length, 3)
      assert.equal(palace.otherTrinePalaceIds.length, 2)
      assert.equal(palace.otherTrinePalaceIds.includes(palace.palaceId), false)
      assert.equal(palace.otherTrinePalaceIds.includes(palace.oppositePalaceId), false)
    }
  })
}

check('broken relation reference is rejected by N0 parser', () => {
  const result = structuredClone(normalize()) as MutableRecord
  const items = result.palaces as MutableRecord[]
  items[0].oppositePalaceId = 'palace:parents'
  assert.throws(() => parseAiChartD1N0(result), { message: AI_CHART_D1_N0_INVALID })
})

for (const branch of BRANCHES) {
  check(`${branch} four-horse classification is deterministic`, () => {
    const palace = normalize().palaces.find((item) => item.earthlyBranch === branch)
    assert.ok(palace)
    assert.equal(palace.isFourHorsePalace, ['寅', '巳', '申', '亥'].includes(branch))
  })
}

check('non-empty palace never borrows', () => {
  const palace = normalize(fixtureB()).palaces[0]
  assert.equal(palace.borrowStatus, 'not_empty')
  assert.equal(palace.borrowedMajorStars.length, 0)
})

check('empty palace without blocker borrows one opposite star', () => {
  const palace = normalize(fixtureB()).palaces[1]
  assert.equal(palace.borrowStatus, 'eligible_and_borrowed')
  assert.deepEqual(palace.borrowedMajorStars.map((item) => item.name), ['武曲'])
})

for (const blocker of ['擎羊', '陀羅', '火星', '鈴星', '文昌', '文曲'] as const) {
  check(`${blocker} blocks empty-palace borrowing`, () => {
    const snapshot = fixtureB()
    palaces(snapshot)[2].minorStars = [
      star(blocker, ['擎羊', '陀羅', '火星', '鈴星'].includes(blocker) ? 'tough' : 'soft'),
    ]
    const palace = normalize(snapshot).palaces[2]
    assert.equal(palace.borrowStatus, 'blocked_by_local_star')
    assert.equal(palace.borrowedMajorStars.length, 0)
  })
}

check('祿存 does not block borrowing', () => {
  const palace = normalize(fixtureB()).palaces[3]
  assert.equal(palace.borrowStatus, 'eligible_and_borrowed')
  assert.deepEqual(palace.borrowedMajorStars.map((item) => item.name), ['天梁'])
})

for (const name of ['地空', '地劫'] as const) {
  check(`${name} is observation-only and does not block borrowing`, () => {
    const snapshot = fixtureB()
    palaces(snapshot)[5].minorStars = [star(name, 'tough')]
    const palace = normalize(snapshot).palaces[5]

    assert.equal(palace.modeledSupportingStars.length, 0)
    assert.deepEqual(palace.excludedStarSummary, [
      {
        placementId: 'palace:health:star:minor:0',
        name,
        type: 'tough',
        sourceCollection: 'minorStars',
        sourceIndex: 0,
        natalMutagen: null,
        reason: 'observation_only',
      },
    ])
    assert.equal(palace.borrowStatus, 'eligible_and_borrowed')
    assert.deepEqual(palace.borrowBlockerPlacementIds, [])
  })
}

check('opposite double stars are borrowed in canonical order with mutagen reference', () => {
  const palace = normalize(fixtureB()).palaces[5]
  assert.equal(palace.borrowStatus, 'eligible_and_borrowed')
  assert.deepEqual(palace.borrowedMajorStars.map((item) => item.name), ['紫微', '天府'])
  assert.deepEqual(palace.borrowedMajorStars.map((item) => item.canonicalOrder), [0, 1])
  assert.equal(palace.borrowedMajorStars.every((item) => item.sourcePlacementId.length > 0), true)
})

check('opposite empty palace is explicit', () => {
  const result = normalize(fixtureB())
  assert.equal(result.palaces[4].borrowStatus, 'opposite_empty')
  assert.equal(result.palaces[10].borrowStatus, 'opposite_empty')
})

check('borrowed stars are deep copies and exclude supporting stars', () => {
  const result = normalize(fixtureB())
  const borrowed = result.palaces[1].borrowedMajorStars[0]
  const source = result.palaces[7].canonicalMajorStars[0]
  assert.notEqual(borrowed, source)
  assert.equal('type' in borrowed, false)
  assert.equal(Object.isFrozen(borrowed), true)
})

for (const category of [
  'directSignals',
  'oppositeSignals',
  'hiddenCombinationSignals',
  'trineSignals',
] as const) {
  check(`${category} is populated and counted deterministically`, () => {
    const scan = normalize().globalScan.palaceScans[0]
    assert.equal(scan[category].length, scan[category.replace('Signals', 'Count') as keyof typeof scan])
  })
}

check('signal IDs are unique and total count is deduplicated', () => {
  const result = normalize()
  assert.equal(new Set(result.globalScan.signals.map((item) => item.signalId)).size, result.globalScan.signals.length)
  for (const scan of result.globalScan.palaceScans) {
    const ids = [
      ...scan.directSignals,
      ...scan.oppositeSignals,
      ...scan.hiddenCombinationSignals,
      ...scan.trineSignals,
    ]
    assert.equal(scan.totalRelevantCount, new Set(ids).size)
  }
})

check('陀羅 and natal 化忌 global indexes reference existing records', () => {
  const result = normalize()
  assert.equal(result.tuoLuoPlacementIds.length, 1)
  assert.deepEqual(result.globalScan.tuoLuoPlacementIds, result.tuoLuoPlacementIds)
  assert.equal(result.globalScan.natalJiMutagenIds.length, 1)
  assert.equal(result.globalScan.natalJiMutagenIds[0], result.natalMutagens.find((item) => item.type === '化忌')?.mutagenId)
})

check('scan completeness is natal-only and never invents flying counts', () => {
  const result = normalize()
  assert.equal(result.globalScan.completeness, 'natal_structure_only_flying_unavailable')
  assert.equal(result.globalScan.palaceScans.every((scan) => scan.completeness === result.globalScan.completeness), true)
  assert.equal(JSON.stringify(result.globalScan).includes('flying'), true)
  assert.equal(JSON.stringify(result.globalScan).includes('flyingCount'), false)
})

check('F1 remains blocked by the missing authoritative flying source', () => {
  assert.equal(normalize().f1Readiness, AI_CHART_D1_F1_BLOCKED_STATUS)
})

check('N0 parser rejects an unknown field', () => {
  const result = structuredClone(normalize()) as MutableRecord
  result.unknown = true
  assert.throws(() => parseAiChartD1N0(result), { message: AI_CHART_D1_N0_INVALID })
})

check('N0 parser rejects duplicate placement IDs', () => {
  const result = structuredClone(normalize()) as MutableRecord
  const items = result.palaces as MutableRecord[]
  const stars0 = items[0].sourceMajorStars as MutableRecord[]
  const stars1 = items[1].sourceMajorStars as MutableRecord[]
  stars1[0].placementId = stars0[0].placementId
  assert.throws(() => parseAiChartD1N0(result), { message: AI_CHART_D1_N0_INVALID })
})

check('synchronized placement and mutagen reference replacement is rejected', () => {
  const result = structuredClone(normalize()) as MutableRecord
  replaceStringDeep(
    result,
    'palace:ming:star:major:0',
    'palace:ming:star:major:99',
  )
  assert.throws(() => parseAiChartD1N0(result), {
    message: AI_CHART_D1_N0_INVALID,
  })
})

check('synchronized placement and signal reference replacement is rejected', () => {
  const result = structuredClone(normalize()) as MutableRecord
  replaceStringDeep(
    result,
    'palace:ming:star:minor:1',
    'palace:ming:star:minor:99',
  )
  assert.throws(() => parseAiChartD1N0(result), {
    message: AI_CHART_D1_N0_INVALID,
  })
})

check('synchronized placement and borrowed source reference replacement is rejected', () => {
  const result = structuredClone(normalize(fixtureB())) as MutableRecord
  replaceStringDeep(
    result,
    'palace:parents:star:major:0',
    'palace:parents:star:major:99',
  )
  assert.throws(() => parseAiChartD1N0(result), {
    message: AI_CHART_D1_N0_INVALID,
  })
})

check('a non-deterministic excluded-star placement ID is rejected', () => {
  const result = structuredClone(normalize()) as MutableRecord
  replaceStringDeep(
    result,
    'palace:travel:star:minor:0',
    'palace:travel:star:minor:99',
  )
  assert.throws(() => parseAiChartD1N0(result), {
    message: AI_CHART_D1_N0_INVALID,
  })
})

check('invalid chart ID is rejected without echo', () => {
  const marker = 'invalid id with spaces'
  try {
    normalizeAiChartD1N0(fixtureA(), { chartId: marker })
    assert.fail('expected invalid chart ID')
  } catch (error) {
    assert.equal(error instanceof Error, true)
    if (!(error instanceof Error)) assert.fail('expected Error')
    assert.equal(error.message, AI_CHART_D1_N0_INVALID)
    assert.equal(error.message.includes(marker), false)
  }
})

check('symbol keys are rejected', () => {
  const snapshot = fixtureA()
  Object.defineProperty(snapshot, Symbol('synthetic'), {
    value: true,
    enumerable: true,
  })
  expectInvalid(snapshot)
})

check('accessor properties are rejected without invocation', () => {
  const snapshot = fixtureA()
  let invoked = false
  Object.defineProperty(snapshot, 'unknownAccessor', {
    enumerable: true,
    get() {
      invoked = true
      return 'synthetic'
    },
  })
  expectInvalid(snapshot)
  assert.equal(invoked, false)
})

check('cyclic input is rejected', () => {
  const snapshot = fixtureA()
  snapshot.cycle = snapshot
  expectInvalid(snapshot)
})

check('N0 is a deep copy, deeply frozen, and mutation-isolated', () => {
  const snapshot = fixtureA()
  const result = normalize(snapshot)
  const originalName = result.palaces[0].canonicalMajorStars[0].name
  ;(palaces(snapshot)[0].majorStars as MutableRecord[])[0].name = 'synthetic-mutated'
  assert.equal(result.palaces[0].canonicalMajorStars[0].name, originalName)
  assert.equal(Object.isFrozen(result), true)
  assert.equal(Object.isFrozen(result.palaces), true)
  assert.equal(Object.isFrozen(result.palaces[0]), true)
  assert.equal(Object.isFrozen(result.palaces[0].canonicalMajorStars), true)
})

check('fixed safe N0 error does not expose raw malformed content', () => {
  const marker = 'synthetic-sensitive-malformed-marker'
  const snapshot = fixtureA()
  palaces(snapshot)[0].name = marker
  try {
    normalize(snapshot)
    assert.fail('expected fixed error')
  } catch (error) {
    assert.equal(error instanceof Error, true)
    if (!(error instanceof Error)) assert.fail('expected Error')
    assert.equal(error.message, AI_CHART_D1_N0_INVALID)
    assert.equal(error.message.includes(marker), false)
  }
})

assert.equal(checks >= 110, true, `expected at least 110 N0 checks, got ${checks}`)
console.log(`AI chart D1 N0 tests passed (${checks} checks)`)
