import assert from 'node:assert/strict'
import test from 'node:test'
import {
  AI_CHART_D1_HEALTH_REMINDER_CARD_REGISTRY,
  AI_CHART_D1_HEALTH_REMINDER_SELECTION_POLICY,
  AI_CHART_D1_HEALTH_REMINDER_SECTION_VERSION,
  AiChartD1HealthReminderError,
  buildAiChartD1HealthReminderSection,
} from './d1HealthReminderCards'

const APPROVED_SOURCE_HOSTS = new Set([
  'www.aad.org',
  'www.acog.org',
  'www.cdc.gov',
  'www.nhs.uk',
  'www.niams.nih.gov',
  'www.nidcd.nih.gov',
  'www.niddk.nih.gov',
  'www.nei.nih.gov',
  'www.nhlbi.nih.gov',
  'www.nimh.nih.gov',
  'www.cancer.gov',
])

test('health reminder registry exposes twenty immutable independent cards', () => {
  assert.equal(AI_CHART_D1_HEALTH_REMINDER_CARD_REGISTRY.length, 20)
  assert.deepEqual(
    AI_CHART_D1_HEALTH_REMINDER_CARD_REGISTRY.map((card) => card.cardId),
    Array.from({ length: 20 }, (_, index) =>
      `H${String(index + 1).padStart(2, '0')}`,
    ),
  )
  assert.equal(Object.isFrozen(AI_CHART_D1_HEALTH_REMINDER_CARD_REGISTRY), true)

  const allDirections = AI_CHART_D1_HEALTH_REMINDER_CARD_REGISTRY.flatMap(
    (card) => card.canonicalHealthDirections,
  )
  assert.equal(new Set(allDirections).size, allDirections.length)

  for (const card of AI_CHART_D1_HEALTH_REMINDER_CARD_REGISTRY) {
    assert.equal(Object.isFrozen(card), true)
    assert.equal(Object.isFrozen(card.canonicalHealthDirections), true)
    assert.equal(Object.isFrozen(card.observableStates), true)
    assert.equal(Object.isFrozen(card.urgentCare), true)
    assert.equal(Object.isFrozen(card.forbiddenInferences), true)
    assert.equal(Object.isFrozen(card.sources), true)
    assert.equal(card.observableStates.length >= 1, true)
    assert.equal(card.observableStates.length <= 4, true)
    assert.match(card.customerReminder, /不是.+診斷/u)
    assert.equal(card.sources.length >= 1, true)

    for (const source of card.sources) {
      assert.equal(Object.isFrozen(source), true)
      const url = new URL(source.url)
      assert.equal(url.protocol, 'https:')
      assert.equal(APPROVED_SOURCE_HOSTS.has(url.hostname), true)
    }
  }
})

test('selection policy keeps card choice and exact reminder copy outside the model', () => {
  assert.deepEqual(AI_CHART_D1_HEALTH_REMINDER_SELECTION_POLICY, {
    owner: 'deterministic-program',
    unknownDirection: 'fail-closed',
    modelMayChooseCard: false,
    modelMayAddSymptoms: false,
    modelRewriteAllowed: false,
    appendUnselectedCardAllowed: false,
    preserveCardOrder: true,
    preserveReminderBytes: true,
  })
  assert.equal(Object.isFrozen(AI_CHART_D1_HEALTH_REMINDER_SELECTION_POLICY), true)
})

test('current chart health directions resolve to exact H07, H02, H01 reminders', () => {
  const section = buildAiChartD1HealthReminderSection({
    targetPalaceId: 'palace:health',
    canonicalHealthDirections: [
      '腎臟相關',
      '肝臟相關',
      '脾胃相關',
    ],
  })

  assert.ok(section)
  assert.equal(section.contractVersion, AI_CHART_D1_HEALTH_REMINDER_SECTION_VERSION)
  assert.equal(section.targetPalaceId, 'palace:health')
  assert.deepEqual(
    section.reminderCards.map((card) => card.cardId),
    ['H07', 'H02', 'H01'],
  )
  assert.equal(
    section.reminderCards[0].customerReminder,
    '腎臟相關較需要保養。腎臟問題早期常常沒有明顯感覺；生活中若持續出現容易疲倦、沒精神、肌肉抽筋、眼皮或腳踝浮腫、泡泡尿久久不散，或尿液呈紅色、茶色，建議接受專業抽血與驗尿檢查。這是保養提醒，不是疾病診斷，有問題仍要由醫師判斷。',
  )
  assert.equal(section.renderingPolicy.modelRewriteAllowed, false)
  assert.equal(section.renderingPolicy.preserveReminderBytes, true)
  assert.deepEqual(Object.keys(section.reminderCards[0]), [
    'cardId',
    'title',
    'customerReminder',
    'urgentCare',
  ])
  assert.equal(section.reminderCards[0].urgentCare.length > 0, true)
  assert.equal(Object.isFrozen(section), true)
  assert.equal(Object.isFrozen(section.canonicalHealthDirections), true)
  assert.equal(Object.isFrozen(section.reminderCards), true)
  assert.equal(Object.isFrozen(section.reminderCards[0]), true)
  assert.equal(Object.isFrozen(section.reminderCards[0].urgentCare), true)
})

test('two directions mapped to the same card emit that card once', () => {
  const section = buildAiChartD1HealthReminderSection({
    targetPalaceId: 'palace:health',
    canonicalHealthDirections: ['腎臟相關', '泌尿相關'],
  })

  assert.ok(section)
  assert.deepEqual(section.canonicalHealthDirections, [
    '腎臟相關',
    '泌尿相關',
  ])
  assert.deepEqual(
    section.reminderCards.map((card) => card.cardId),
    ['H07'],
  )
})

test('an empty direction set produces no invented health section', () => {
  assert.equal(
    buildAiChartD1HealthReminderSection({
      targetPalaceId: 'palace:health',
      canonicalHealthDirections: [],
    }),
    null,
  )
  assert.equal(
    buildAiChartD1HealthReminderSection({
      targetPalaceId: 'palace:ming',
      canonicalHealthDirections: [],
    }),
    null,
  )
})

test('unknown, duplicate, and non-health-palace directions fail closed', () => {
  const cases = [
    {
      input: {
        targetPalaceId: 'palace:health' as const,
        canonicalHealthDirections: ['未知身體方向'],
      },
      reasonCode: 'UNKNOWN_HEALTH_DIRECTION',
    },
    {
      input: {
        targetPalaceId: 'palace:health' as const,
        canonicalHealthDirections: ['腎臟相關', '腎臟相關'],
      },
      reasonCode: 'DUPLICATE_HEALTH_DIRECTION',
    },
    {
      input: {
        targetPalaceId: 'palace:ming' as const,
        canonicalHealthDirections: ['腎臟相關'],
      },
      reasonCode: 'NON_HEALTH_PALACE_DIRECTION',
    },
    {
      input: {
        targetPalaceId: 'palace:unknown',
        canonicalHealthDirections: [],
      },
      reasonCode: 'INPUT_INVALID',
    },
  ]

  for (const { input, reasonCode } of cases) {
    assert.throws(
      () => buildAiChartD1HealthReminderSection(input),
      (error: unknown) => {
        assert.equal(error instanceof AiChartD1HealthReminderError, true)
        assert.equal(
          (error as AiChartD1HealthReminderError).reasonCode,
          reasonCode,
        )
        assert.equal(Object.isFrozen(error), true)
        return true
      },
    )
  }
})
