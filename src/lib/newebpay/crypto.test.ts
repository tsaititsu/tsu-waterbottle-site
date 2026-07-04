import assert from 'node:assert/strict'
import {
  buildQueryString,
  createTradeSha,
  decryptTradeInfo,
  encryptTradeInfo,
  getEncryptedTradeInfoDiagnostics,
  normalizeEncryptedTradeInfo,
  verifyTradeSha
} from './crypto'

const hashKey = '12345678901234567890123456789012'
const hashIv = '1234567890123456'

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`✓ ${name}`)
  } catch (error) {
    console.error(`✗ ${name}`)
    throw error
  }
}

test('buildQueryString creates a stable encoded query string', () => {
  assert.equal(
    buildQueryString({
      MerchantOrderNo: 'ORDER 1',
      Amt: 50,
      NullValue: null,
      UndefValue: undefined,
      Enabled: true,
      Disabled: false
    }),
    'Amt=50&Disabled=0&Enabled=1&MerchantOrderNo=ORDER+1'
  )
})

test('encryptTradeInfo output can be decrypted back to the query string', () => {
  const params = {
    MerchantID: 'MS123456789',
    MerchantOrderNo: 'ORDER123',
    Amt: 50,
    RespondType: 'JSON',
    LoginType: 0
  }
  const plainTradeInfo = buildQueryString(params)
  const encrypted = encryptTradeInfo(params, hashKey, hashIv)

  assert.match(encrypted, /^[0-9a-f]+$/)
  assert.equal(decryptTradeInfo(encrypted, hashKey, hashIv), plainTradeInfo)
  assert.equal(decryptTradeInfo(`\n ${encrypted} \n`, hashKey, hashIv), plainTradeInfo)
  assert.equal(decryptTradeInfo(encrypted.toUpperCase(), hashKey, hashIv), plainTradeInfo)
})

test('normalizeEncryptedTradeInfo preserves normal hex and decodes encoded values once', () => {
  const encrypted = encryptTradeInfo({ MerchantID: 'MS123456789', Amt: 50 }, hashKey, hashIv)

  assert.equal(normalizeEncryptedTradeInfo(encrypted), encrypted)
  assert.equal(normalizeEncryptedTradeInfo(` ${encrypted}\n`), encrypted)
  assert.equal(normalizeEncryptedTradeInfo(encodeURIComponent(encrypted)), encrypted)
})

test('getEncryptedTradeInfoDiagnostics reports shape without exposing raw payload', () => {
  const encrypted = encryptTradeInfo({ MerchantID: 'MS123456789', Amt: 50 }, hashKey, hashIv)
  const tradeSha = createTradeSha(encrypted, hashKey, hashIv)
  const diagnostics = getEncryptedTradeInfoDiagnostics(encrypted, tradeSha)

  assert.deepEqual(diagnostics, {
    tradeInfoLength: encrypted.length,
    tradeInfoIsHex: true,
    tradeInfoHexLengthIsEven: true,
    tradeInfoHexLengthMultipleOf32: true,
    tradeInfoFingerprint: diagnostics.tradeInfoFingerprint,
    tradeShaLength: 64,
    tradeShaLooksSha256: true,
  })
  assert.match(diagnostics.tradeInfoFingerprint, /^[0-9a-f]{12}$/)
})

test('createTradeSha returns uppercase SHA256 and verifyTradeSha validates it', () => {
  const encrypted = encryptTradeInfo({ MerchantID: 'MS123456789', Amt: 50 }, hashKey, hashIv)
  const tradeSha = createTradeSha(encrypted, hashKey, hashIv)
  const invalidTradeSha = `${tradeSha.slice(0, -1)}${tradeSha.endsWith('0') ? '1' : '0'}`

  assert.match(tradeSha, /^[0-9A-F]{64}$/)
  assert.equal(verifyTradeSha(encrypted, tradeSha, hashKey, hashIv), true)
  assert.equal(verifyTradeSha(encrypted, invalidTradeSha, hashKey, hashIv), false)
})

test('decryptTradeInfo rejects invalid hex input with clear errors', () => {
  assert.throws(() => decryptTradeInfo('not-hex', hashKey, hashIv), /TradeInfo must be hex encoded/)
  assert.throws(() => decryptTradeInfo('abc', hashKey, hashIv), /TradeInfo hex length must be even/)
  assert.throws(() => decryptTradeInfo('abcd', hashKey, hashIv), /TradeInfo hex length must be a multiple of 32/)
})
