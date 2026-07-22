import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// 22J-44：會員選單需有「我的占卜紀錄」（桌面下拉＋手機選單），
// 且不得移除或混淆既有項目。

const source = readFileSync(join(process.cwd(), 'src/components/Header.tsx'), 'utf8')
const adminAccessSource = readFileSync(
  join(process.cwd(), 'src/lib/auth/adminMenuAccess.ts'),
  'utf8',
)

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

// 8. 管理員入口只依 server session 驗證結果顯示，不讀 allowlist 或硬編碼 Email。
assert.match(source, /getAuthAccessToken/)
assert.match(source, /verifyAdminMenuAccess\(user/)
assert.match(source, /const showAdminMenu = canShowAdminMenu\(adminMenuAccess, user\)/)
assert.equal(source.includes('ADMIN_EMAILS'), false)
assert.equal(source.includes('user.email'), false)
assert.equal(adminAccessSource.includes("'/api/admin/session'"), true)
assert.equal(adminAccessSource.includes("cache: 'no-store'"), true)
assert.match(adminAccessSource, /Authorization: `Bearer \$\{accessToken\}`/)
assert.equal(adminAccessSource.includes('localStorage'), false)
assert.equal(adminAccessSource.includes('sessionStorage'), false)

// 9. 桌機入口位於一般會員功能後、登出前，且點擊會關閉帳號選單。
const desktopMenuSource = source.slice(
  source.indexOf('const accountMenu = user ? ('),
  source.indexOf('const mobileAuthActions = user ? ('),
)
const desktopAdminIndex = desktopMenuSource.indexOf('後台管理')
const desktopMemberRecordIndex = desktopMenuSource.indexOf('我的占卜紀錄')
const desktopLogoutIndex = desktopMenuSource.indexOf('登出')

assert.equal(desktopAdminIndex > desktopMemberRecordIndex, true)
assert.equal(desktopLogoutIndex > desktopAdminIndex, true)
assert.match(
  desktopMenuSource,
  /\{showAdminMenu \? \([\s\S]*aria-label="管理員功能"[\s\S]*href="\/admin"[\s\S]*onClick=\{\(\) => setAccountMenuOpen\(false\)\}[\s\S]*後台管理[\s\S]*\) : null\}/,
)
assert.match(desktopMenuSource, /管理員功能" className="grid border-t border-white\/15/)
assert.equal(desktopMenuSource.indexOf('border-t border-white/15 bg-[#1c1c1f]') > desktopAdminIndex, true)

// 10. 手機入口同步顯示於會員功能後、登出前，點擊會關閉 mobile menu。
const mobileMenuSource = source.slice(
  source.indexOf('const mobileAuthActions = user ? ('),
  source.indexOf('\n  return ('),
)
const mobileAdminIndex = mobileMenuSource.indexOf('後台管理')
const mobileMemberRecordIndex = mobileMenuSource.indexOf('我的占卜紀錄')
const mobileLogoutIndex = mobileMenuSource.indexOf('登出')

assert.equal(mobileAdminIndex > mobileMemberRecordIndex, true)
assert.equal(mobileLogoutIndex > mobileAdminIndex, true)
assert.match(
  mobileMenuSource,
  /\{showAdminMenu \? \([\s\S]*href="\/admin"[\s\S]*onClick=\{\(\) => setMenuOpen\(false\)\}[\s\S]*後台管理[\s\S]*\) : null\}/,
)
for (const label of ['會員中心', '我的課程', '我的占卜紀錄', '登出']) {
  assert.equal(mobileMenuSource.includes(label), true, `手機選單應保留「${label}」`)
}

// 11. checking／denied／idle 都由 canShowAdminMenu fail closed；舊請求會被取消且受 sequence gate 保護。
assert.match(source, /const adminAccessRequestIdRef = useRef\(0\)/)
assert.match(source, /const controller = new AbortController\(\)/)
assert.match(source, /if \(cancelled \|\| result === 'idle'\) return/)
assert.match(source, /completeAdminMenuAccessCheck\(current, requestId, result\)/)
assert.match(source, /cancelled = true\s*\n\s*controller\.abort\(\)/)
assert.match(
  source,
  /setAdminMenuAccess\(beginAdminMenuAccessCheck\(null, requestId\)\)\s*\n\s*logoutMockUser\(\)/,
)

// 桌機＋手機各一個入口；URL 不含 token、Email 或管理員旗標。
assert.equal(source.split('後台管理').length - 1, 2)
assert.equal(source.split('href="/admin"').length - 1, 2)
assert.equal(/href="\/admin\?/.test(source), false)

console.log('✓ headerAccountMenu 全部通過')
