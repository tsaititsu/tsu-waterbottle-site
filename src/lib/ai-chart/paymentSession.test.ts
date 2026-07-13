import assert from 'node:assert/strict'
import {
  AI_CHART_PAYMENT_SESSION_DEFAULT_AMOUNT_TWD,
  AI_CHART_PAYMENT_SESSION_KEY,
  clearAiChartPaymentSession,
  getAiChartPaymentSession,
  isAiChartPaymentSession,
  saveAiChartPaymentSession,
} from './paymentSession'

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`✓ ${name}`)
  } catch (error) {
    console.error(`✗ ${name}`)
    throw error
  }
}

function createMockSessionStorage() {
  const store = new Map<string, string>()

  return {
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null
    },
    setItem(key: string, value: string) {
      store.set(key, String(value))
    },
    removeItem(key: string) {
      store.delete(key)
    },
    clear() {
      store.clear()
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null
    },
    get length() {
      return store.size
    },
  } satisfies Storage
}

function installMockSessionStorage() {
  const storage = createMockSessionStorage()
  Object.defineProperty(globalThis, 'sessionStorage', {
    value: storage,
    configurable: true,
  })
  return storage
}

function readSavedSession(): Record<string, unknown> {
  const raw = sessionStorage.getItem(AI_CHART_PAYMENT_SESSION_KEY)
  assert.equal(typeof raw, 'string')
  return JSON.parse(raw!)
}

function assertNoUnsafeKeys(payload: Record<string, unknown>) {
  assert.equal('TradeInfo' in payload, false)
  assert.equal('TradeSha' in payload, false)
  assert.equal('HashKey' in payload, false)
  assert.equal('HashIV' in payload, false)
  assert.equal('MerchantID' in payload, false)
  assert.equal('Version' in payload, false)
  assert.equal('creditCard' in payload, false)
  assert.equal('cardNumber' in payload, false)
  assert.equal('birthData' in payload, false)
  assert.equal('birthDate' in payload, false)
  assert.equal('birthTime' in payload, false)
  assert.equal('birthPlace' in payload, false)
  assert.equal('ziweiPayload' in payload, false)
  assert.equal('chartPayload' in payload, false)
  assert.equal('report_content' in payload, false)
  assert.equal('reportContent' in payload, false)
  assert.equal('prompt' in payload, false)
  assert.equal('openAiRequest' in payload, false)
  assert.equal('openAiResponse' in payload, false)
  assert.equal('paymentForm' in payload, false)
}

const reportId = '2df1a8da-3893-4b81-8d00-774a9cc0e472'
const merchantOrderNo = 'WB20260706172000AICH'

test('saveAiChartPaymentSession stores reportId with the default amount and fixed source', () => {
  installMockSessionStorage()

  const session = saveAiChartPaymentSession({ reportId })
  const saved = readSavedSession()

  assert.equal(session.reportId, reportId)
  assert.equal(session.amountTwd, AI_CHART_PAYMENT_SESSION_DEFAULT_AMOUNT_TWD)
  assert.equal(session.source, 'ai_chart_report')
  assert.equal(saved.reportId, reportId)
  assert.equal(saved.amountTwd, 100)
  assert.equal(saved.source, 'ai_chart_report')
  assert.equal(typeof saved.createdAt, 'string')
  assert.equal(Number.isNaN(Date.parse(saved.createdAt as string)), false)
})

test('saveAiChartPaymentSession can store merchantOrderNo and returnPath', () => {
  installMockSessionStorage()

  const session = saveAiChartPaymentSession({
    reportId,
    merchantOrderNo,
    returnPath: '/ai-chart/result',
  })

  assert.equal(session.merchantOrderNo, merchantOrderNo)
  assert.equal(session.returnPath, '/ai-chart/result')

  const saved = readSavedSession()
  assert.equal(saved.merchantOrderNo, merchantOrderNo)
  assert.equal(saved.returnPath, '/ai-chart/result')
})

test('saveAiChartPaymentSession rejects invalid reportId', () => {
  installMockSessionStorage()

  assert.throws(
    () =>
      saveAiChartPaymentSession({
        reportId: 'not-a-uuid',
      }),
    /invalid_ai_chart_report_id/,
  )
})

test('saveAiChartPaymentSession does not persist unsafe extra fields', () => {
  installMockSessionStorage()

  saveAiChartPaymentSession({
    reportId,
    merchantOrderNo,
    TradeInfo: 'unsafe-trade-info',
    TradeSha: 'unsafe-trade-sha',
    HashKey: 'unsafe-hash-key',
    HashIV: 'unsafe-hash-iv',
    MerchantID: 'MS123456789',
    Version: '2.3',
    birthData: { name: 'unsafe' },
    chartPayload: { unsafe: true },
    reportContent: 'unsafe report content',
  } as Parameters<typeof saveAiChartPaymentSession>[0] & Record<string, unknown>)

  assertNoUnsafeKeys(readSavedSession())
})

test('getAiChartPaymentSession returns null when no session exists', () => {
  installMockSessionStorage()

  assert.equal(getAiChartPaymentSession(), null)
})

test('getAiChartPaymentSession returns null for invalid JSON', () => {
  installMockSessionStorage()
  sessionStorage.setItem(AI_CHART_PAYMENT_SESSION_KEY, '{not-json')

  assert.equal(getAiChartPaymentSession(), null)
})

test('getAiChartPaymentSession returns null for an invalid schema', () => {
  installMockSessionStorage()
  sessionStorage.setItem(
    AI_CHART_PAYMENT_SESSION_KEY,
    JSON.stringify({
      reportId,
      amountTwd: 100,
      source: 'wrong_source',
      createdAt: new Date().toISOString(),
    }),
  )

  assert.equal(getAiChartPaymentSession(), null)
})

test('getAiChartPaymentSession returns a valid saved session', () => {
  installMockSessionStorage()
  const saved = saveAiChartPaymentSession({
    reportId,
    merchantOrderNo,
    returnPath: '/ai-chart/result',
  })

  assert.deepEqual(getAiChartPaymentSession(), saved)
  assert.equal(isAiChartPaymentSession(saved), true)
})

test('isAiChartPaymentSession rejects unsafe or malformed sessions', () => {
  assert.equal(
    isAiChartPaymentSession({
      reportId,
      amountTwd: 100,
      source: 'ai_chart_report',
      createdAt: 'not-a-date',
    }),
    false,
  )
  assert.equal(
    isAiChartPaymentSession({
      reportId: 'not-a-uuid',
      amountTwd: 100,
      source: 'ai_chart_report',
      createdAt: new Date().toISOString(),
    }),
    false,
  )
})

test('clearAiChartPaymentSession only removes the AI chart payment session key', () => {
  installMockSessionStorage()
  sessionStorage.setItem('waterbottle-chart-current-session', 'keep')
  sessionStorage.setItem('unrelated_session_storage_key', 'keep')
  sessionStorage.setItem('waterbottle_mock_payments', 'keep')
  sessionStorage.setItem('waterbottle_mock_records', 'keep')

  saveAiChartPaymentSession({ reportId })
  clearAiChartPaymentSession()

  assert.equal(sessionStorage.getItem(AI_CHART_PAYMENT_SESSION_KEY), null)
  assert.equal(sessionStorage.getItem('waterbottle-chart-current-session'), 'keep')
  assert.equal(sessionStorage.getItem('unrelated_session_storage_key'), 'keep')
  assert.equal(sessionStorage.getItem('waterbottle_mock_payments'), 'keep')
  assert.equal(sessionStorage.getItem('waterbottle_mock_records'), 'keep')
})
