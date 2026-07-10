import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// 22J-44：會員選單需有「我的占卜紀錄」（桌面下拉＋手機選單），
// 且不得移除或混淆既有項目。

const source = readFileSync(join(process.cwd(), 'src/components/Header.tsx'), 'utf8')

// 1. 「我的占卜紀錄」存在，且桌面＋手機兩套選單都有（至少出現 2 次）
const recordLabelCount = source.split('我的占卜紀錄').length - 1
assert.equal(recordLabelCount >= 2, true, '桌面與手機選單都應有「我的占卜紀錄」')

// 2. 連結指向 /account/divinations（同樣兩處）
const recordHrefCount = source.split('"/account/divinations"').length - 1
assert.equal(recordHrefCount >= 2, true, '「我的占卜紀錄」應連到 /account/divinations')

// 3. 桌面版點擊後關閉選單（與既有項目一致）
assert.equal(
  source.includes(
    '<Link href="/account/divinations" onClick={() => setAccountMenuOpen(false)}',
  ),
  true,
  '桌面選單項點擊後應關閉下拉選單',
)

// 4.「紫微牌卡占卜」（開始新占卜）仍保留且連到 /ai-divination，文案與紀錄入口不同
assert.equal(source.includes('紫微牌卡占卜'), true)
assert.equal(source.includes('href="/ai-divination"'), true)

// 5. 原有項目均未移除
for (const label of ['會員中心', '我的課程', '我的預約', '命盤紀錄', '登出']) {
  assert.equal(source.includes(label), true, `選單應保留「${label}」`)
}

// 6. 排序：命盤紀錄 → 我的占卜紀錄 → 紫微牌卡占卜（桌面下拉）
const chartIndex = source.indexOf('命盤紀錄')
const recordIndex = source.indexOf('我的占卜紀錄')
const newDivinationIndex = source.indexOf('紫微牌卡占卜', chartIndex)
assert.equal(chartIndex >= 0 && recordIndex > chartIndex && newDivinationIndex > recordIndex, true)

// 7. 本輪不得觸碰占卜 API / OpenAI / paid gate
assert.equal(source.includes('api.openai.com'), false)
assert.equal(source.includes('/api/divination/interpret'), false)

console.log('✓ headerAccountMenu 全部通過')
