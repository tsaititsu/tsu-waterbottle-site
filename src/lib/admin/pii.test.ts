import assert from 'node:assert/strict'
import { maskEmail, maskIdentifier, maskPhone } from './pii'

for (const missing of [null, undefined, '', '   ']) {
  assert.equal(maskEmail(missing), '未提供')
  assert.equal(maskPhone(missing), '未提供')
  assert.equal(maskIdentifier(missing), '未提供')
}

assert.equal(maskEmail('a@example.test'), '*@example.test')
assert.equal(maskEmail('ab@example.test'), 'a*@example.test')
assert.equal(maskEmail('abc@example.test'), 'a*c@example.test')
assert.equal(maskEmail('amy@example.test'), 'a*y@example.test')
assert.equal(maskEmail('sarah@example.test'), 's***h@example.test')
assert.equal(maskEmail('測試@example.test'), '測*@example.test')
for (const [email, expected] of [
  ['你@example.test', '*@example.test'],
  ['你好@example.test', '你*@example.test'],
  ['你好嗎@example.test', '你*嗎@example.test'],
  ['😀a@example.test', '😀*@example.test'],
  ['e\u0301x@example.test', 'e\u0301*@example.test'],
] as const) {
  const masked = maskEmail(email)
  assert.equal(masked, expected)
  assert.notEqual(masked, email, `${email} 的完整 local part 不得洩漏`)
  assert.equal(masked.endsWith('@example.test'), true, 'Email domain 契約不得改變')
}
assert.equal(maskEmail('malformed-email'), 'malf…mail')

const segmenterDescriptor = Object.getOwnPropertyDescriptor(Intl, 'Segmenter')
assert.ok(segmenterDescriptor, '測試 runtime 必須提供 Intl.Segmenter')
Object.defineProperty(Intl, 'Segmenter', {
  configurable: true,
  value: undefined,
})
try {
  assert.equal(
    maskEmail('ab@example.test'),
    '*@example.test',
    '缺少 Segmenter 時必須保守遮蔽完整 local part',
  )
} finally {
  Object.defineProperty(Intl, 'Segmenter', segmenterDescriptor)
}

assert.equal(maskPhone('0912-345-678'), '09••••••78')
assert.equal(maskPhone('+886 912 345 678'), '88••••••••78')
assert.equal(maskPhone('12'), '••')

assert.equal(maskIdentifier('11111111-2222-4333-8444-555555555555'), '1111…5555')
assert.equal(maskIdentifier('abc'), 'a…c')
assert.equal(maskIdentifier('測試'), '••')

for (let length = 1; length <= 12; length += 1) {
  const original = Array.from({ length }, (_, index) => String((index + 1) % 10)).join('')
  const masked = maskPhone(original)
  const visibleDigits = masked.replace(/\D/gu, '')
  const maximumVisible = length <= 2 ? 0 : length <= 6 ? 1 : 4

  assert.notEqual(masked, original, `長度 ${length} 的電話不得完整顯示`)
  assert.equal(masked.includes(original), false, `長度 ${length} 的完整電話不得出現在結果中`)
  assert.ok(visibleDigits.length <= maximumVisible, `長度 ${length} 最多顯示 ${maximumVisible} 碼`)
  assert.equal(/[ ()+-]/u.test(masked), false, '遮蔽結果不得保留分隔符號')
}

for (const shortPhone of ['1234', '12345', '123456']) {
  assert.ok(maskPhone(shortPhone).replace(/\D/gu, '').length <= 1)
}

for (const phone of [
  '0912-345-678',
  '(02) 2345-6789',
  '+886 912 345 678',
  '電話未知',
  '１２３４',
  '👩‍💻☎️',
  'e\u0301',
]) {
  const normalized = phone.trim()
  const digits = normalized.replace(/\D/gu, '')
  const masked = maskPhone(phone)

  assert.notEqual(masked, normalized, `${phone} 不得完整顯示`)
  assert.equal(masked.includes(normalized), false, `${phone} 不得完整包含於結果`)
  if (digits) assert.equal(masked.includes(digits), false, `${phone} 的完整數字不得出現在結果`)
}

console.log('✓ admin PII minimization tests passed')
