import assert from 'node:assert/strict'
import { maskEmail, maskIdentifier, maskPhone, summarizeAddress } from './pii'

for (const missing of [null, undefined, '', '   ']) {
  assert.equal(maskEmail(missing), '未提供')
  assert.equal(maskPhone(missing), '未提供')
  assert.equal(maskIdentifier(missing), '未提供')
  assert.equal(summarizeAddress(missing), '未提供')
}

assert.equal(maskEmail('a@example.test'), '*@example.test')
assert.equal(maskEmail('amy@example.test'), 'a***y@example.test')
assert.equal(maskEmail('測試@example.test'), '測***試@example.test')
assert.equal(maskEmail('malformed-email'), 'malf…mail')

assert.equal(maskPhone('0912-345-678'), '09••••5678')
assert.equal(maskPhone('+886 912 345 678'), '88••••5678')
assert.equal(maskPhone('12'), '••')
assert.equal(maskPhone('電話未知'), '電…知')

assert.equal(maskIdentifier('11111111-2222-4333-8444-555555555555'), '1111…5555')
assert.equal(maskIdentifier('abc'), 'a…c')
assert.equal(maskIdentifier('測試'), '••')

assert.equal(summarizeAddress('臺北市大安區信義路四段100號'), '臺北市大安區（其餘已遮蔽）')
assert.equal(summarizeAddress('新竹縣竹北市光明六路1號'), '新竹縣竹北市（其餘已遮蔽）')
assert.equal(summarizeAddress('Unknown address'), 'Unk…（其餘已遮蔽）')

console.log('✓ admin PII minimization tests passed')
