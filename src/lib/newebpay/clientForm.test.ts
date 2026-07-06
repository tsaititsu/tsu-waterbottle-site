import assert from 'node:assert/strict'
import {
  buildNewebPayClientFormFields,
  NEWEBPAY_CLIENT_FORM_FIELD_NAMES,
} from './clientForm'

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`✓ ${name}`)
  } catch (error) {
    console.error(`✗ ${name}`)
    throw error
  }
}

const validFields = {
  MerchantID: 'MS123456789',
  TradeInfo: 'encrypted-trade-info',
  TradeSha: 'A'.repeat(64),
  Version: '2.3',
}

test('buildNewebPayClientFormFields returns only the allowed MPG fields', () => {
  const result = buildNewebPayClientFormFields(validFields)

  assert.equal(result.ok, true)
  if (!result.ok) return

  assert.deepEqual(
    result.fields.map((field) => field.name),
    NEWEBPAY_CLIENT_FORM_FIELD_NAMES,
  )
  assert.deepEqual(result.fields, [
    { name: 'MerchantID', value: validFields.MerchantID },
    { name: 'TradeInfo', value: validFields.TradeInfo },
    { name: 'TradeSha', value: validFields.TradeSha },
    { name: 'Version', value: validFields.Version },
  ])
})

test('buildNewebPayClientFormFields ignores unknown fields', () => {
  const result = buildNewebPayClientFormFields({
    ...validFields,
    HashKey: 'unsafe-hash-key',
    HashIV: 'unsafe-hash-iv',
    CustomField: 'should-not-be-forwarded',
  })

  assert.equal(result.ok, true)
  if (!result.ok) return

  const names = result.fields.map((field) => field.name)
  assert.equal((names as string[]).includes('HashKey'), false)
  assert.equal((names as string[]).includes('HashIV'), false)
  assert.equal((names as string[]).includes('CustomField'), false)
  assert.deepEqual(names, NEWEBPAY_CLIENT_FORM_FIELD_NAMES)
})

test('buildNewebPayClientFormFields rejects missing TradeInfo', () => {
  const result = buildNewebPayClientFormFields({
    MerchantID: validFields.MerchantID,
    TradeSha: validFields.TradeSha,
    Version: validFields.Version,
  })

  assert.deepEqual(result, {
    ok: false,
    error: 'missing_required_field',
    missingField: 'TradeInfo',
  })
})

test('buildNewebPayClientFormFields rejects missing TradeSha', () => {
  const result = buildNewebPayClientFormFields({
    MerchantID: validFields.MerchantID,
    TradeInfo: validFields.TradeInfo,
    Version: validFields.Version,
  })

  assert.deepEqual(result, {
    ok: false,
    error: 'missing_required_field',
    missingField: 'TradeSha',
  })
})

test('buildNewebPayClientFormFields rejects blank required values', () => {
  const result = buildNewebPayClientFormFields({
    ...validFields,
    TradeInfo: '   ',
  })

  assert.deepEqual(result, {
    ok: false,
    error: 'missing_required_field',
    missingField: 'TradeInfo',
  })
})
