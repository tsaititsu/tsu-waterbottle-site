import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const adminPageSource = readFileSync(join(root, 'src/app/admin/page.tsx'), 'utf8')
const layoutClientSource = readFileSync(join(root, 'src/app/admin/AdminLayoutClient.tsx'), 'utf8')
const shellSource = readFileSync(join(root, 'src/components/admin/AdminShell.tsx'), 'utf8')
const navigationSource = readFileSync(join(root, 'src/components/admin/AdminNavigation.tsx'), 'utf8')

assert.equal(
  adminPageSource.startsWith("'use client'"),
  false,
  '後台首頁不得建立第二套 client-only 登入守門',
)
assert.equal(adminPageSource.includes('overviewCards'), false, '後台首頁不得保留寫死統計卡片')
assert.equal(adminPageSource.includes('今日待處理'), false, '後台首頁不得顯示假的待處理數字')
assert.equal(adminPageSource.includes('待確認匯款'), false, '後台首頁不得顯示假的匯款數字')
assert.equal(adminPageSource.includes('開運商品數'), false, '後台首頁不得顯示假的商品數量')
assert.equal(adminPageSource.includes('getMockUser'), false, '後台首頁不得重複 layout 的登入守門')
assert.equal(adminPageSource.includes('subscribeAuthChange'), false, '後台首頁不得重複訂閱登入狀態')
assert.match(adminPageSource, /能力與模組狀態總覽/)
assert.match(adminPageSource, /已啟用：唯讀紀錄/)
assert.match(adminPageSource, /既有營運工具/)
assert.match(adminPageSource, /預約時段工具包含既有資料寫入能力/)
assert.match(adminPageSource, /尚未啟用/)
assert.doesNotMatch(adminPageSource, /disabled=/, '尚未啟用模組不得用假 disabled 操作按鈕')
assert.match(
  adminPageSource,
  /isLinePaySandboxE2eRouteEnabled\(process\.env\)/,
  'Sandbox E2E panel 必須共用 server-side Preview route gate',
)
assert.match(
  adminPageSource,
  /sandboxE2eEnabled \? <LinePaySandboxE2ePanel \/> : null/,
  'Sandbox E2E panel 只能在完整 server-side gate 通過後顯示',
)

assert.match(layoutClientSource, /return <AdminShell pathname=\{pathname\}>\{children\}<\/AdminShell>/)
assert.equal(
  layoutClientSource.match(/<AdminShell pathname=\{pathname\}>\{children\}<\/AdminShell>/g)?.length,
  1,
  'children 只能在 authorized gate 內進入 Admin Shell',
)
assert.match(shellSource, /返回前台/)
assert.match(
  navigationSource,
  /aria-current=\{isAdminModuleActive\(item, pathname\) \? 'page' : undefined\}/,
)
assert.match(navigationSource, /手機版後台導覽/)
assert.match(navigationSource, /<details/)
assert.match(navigationSource, /唯讀紀錄/)
assert.match(navigationSource, /既有營運工具/)
assert.match(navigationSource, /尚未啟用/)
assert.match(navigationSource, /data-admin-module-state="unavailable"/)
assert.doesNotMatch(
  navigationSource,
  /unavailableItems\.map\([\s\S]*?<Link/,
  '尚未啟用模組不得產生可點擊 Link',
)

console.log('✓ admin foundation dashboard contract tests passed')
