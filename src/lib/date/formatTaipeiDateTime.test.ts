import assert from 'node:assert/strict'
import { formatTaipeiDateTime } from './formatTaipeiDateTime'

// UTC → Asia/Taipei（+8），不手動加時數，交給 Intl 處理。
assert.equal(formatTaipeiDateTime('2026-07-09T16:08:00.000Z'), '2026/07/10 00:08')
assert.equal(formatTaipeiDateTime('2026-01-01T00:00:00.000Z'), '2026/01/01 08:00')
assert.equal(formatTaipeiDateTime('2026-12-31T15:59:00.000Z'), '2026/12/31 23:59')

// 跨日邊界：台北已是隔天
assert.equal(formatTaipeiDateTime('2026-02-28T16:30:00.000Z'), '2026/03/01 00:30')

// null / undefined / 空白 / 無法解析 → 「—」
assert.equal(formatTaipeiDateTime(null), '—')
assert.equal(formatTaipeiDateTime(undefined), '—')
assert.equal(formatTaipeiDateTime(''), '—')
assert.equal(formatTaipeiDateTime('   '), '—')
assert.equal(formatTaipeiDateTime('not-a-date'), '—')

console.log('✓ formatTaipeiDateTime 全部通過')
