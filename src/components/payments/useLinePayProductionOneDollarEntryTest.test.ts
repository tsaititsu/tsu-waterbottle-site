import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import {
  getLinePayProductionOneDollarEntryTestButtonLabel,
  isLinePayProductionOneDollarEntryTestBlocked,
} from './useLinePayProductionOneDollarEntryTest'

test('ambiguous Production LINE Pay mode is blocked fail-closed', () => {
  assert.equal(isLinePayProductionOneDollarEntryTestBlocked('checking'), true)
  assert.equal(isLinePayProductionOneDollarEntryTestBlocked('error'), true)
  assert.equal(isLinePayProductionOneDollarEntryTestBlocked('enabled'), false)
  assert.equal(isLinePayProductionOneDollarEntryTestBlocked('disabled'), false)
})

test('auth lookup failure is distinct from a confirmed logged-out state', () => {
  const source = readFileSync(
    join(
      process.cwd(),
      'src/components/payments/useLinePayProductionOneDollarEntryTest.ts',
    ),
    'utf8',
  )
  assert.match(
    source,
    /accessToken = await getAuthAccessToken\(\)[\s\S]*?catch \{[\s\S]*?setStatus\('error'\)/u,
  )
  assert.doesNotMatch(source, /getAuthAccessToken\(\)\.catch\(\(\) => null\)/u)
})

test('button label distinguishes NT$1, checking, error, and regular mode', () => {
  assert.equal(
    getLinePayProductionOneDollarEntryTestButtonLabel('enabled'),
    '管理員 LINE Pay 入口測試付款 NT$1',
  )
  assert.equal(
    getLinePayProductionOneDollarEntryTestButtonLabel('checking'),
    '正在確認 LINE Pay 付款模式...',
  )
  assert.equal(
    getLinePayProductionOneDollarEntryTestButtonLabel('error'),
    '暫時無法確認 LINE Pay 付款模式',
  )
  assert.equal(
    getLinePayProductionOneDollarEntryTestButtonLabel('disabled'),
    null,
  )
})
