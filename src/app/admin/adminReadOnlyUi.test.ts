import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const listSource = readFileSync(join(root, 'src/components/admin/AdminRecordList.tsx'), 'utf8')
const detailSource = readFileSync(join(root, 'src/components/admin/AdminRecordDetail.tsx'), 'utf8')
const dataStateSource = readFileSync(join(root, 'src/components/admin/AdminDataState.tsx'), 'utf8')

assert.match(listSource, /state === 'loading'/)
assert.match(listSource, /state === 'empty'/)
assert.match(listSource, /state === 'error'/)
assert.match(listSource, /state === 'unauthorized'/)
assert.match(listSource, /data-mobile-admin-records/)
assert.match(listSource, /lg:hidden/)
assert.match(listSource, /hidden overflow-x-auto[\s\S]*lg:block/)
assert.match(listSource, /type="search"/)
assert.match(listSource, /type="date"/)
assert.match(listSource, /statusOptions/)
assert.match(listSource, /AdminPagination/)
assert.match(listSource, /查看詳情/)
assert.match(dataStateSource, /state: 'loading' \| 'empty' \| 'error' \| 'unauthorized' \| 'unavailable'/)
assert.match(detailSource, /cache: 'no-store'/)

const pageFiles = [
  'src/app/admin/product-orders/page.tsx',
  'src/app/admin/product-orders/[id]/ProductOrderDetailClient.tsx',
  'src/app/admin/members/page.tsx',
  'src/app/admin/members/[id]/MemberDetailClient.tsx',
  'src/app/admin/bank-transfers/page.tsx',
  'src/app/admin/bank-transfers/[id]/BankTransferDetailClient.tsx',
]

for (const file of [
  ...pageFiles,
  'src/components/admin/AdminRecordList.tsx',
  'src/components/admin/AdminRecordDetail.tsx',
]) {
  const source = readFileSync(join(root, file), 'utf8')
  assert.equal(source.includes('dangerouslySetInnerHTML'), false, `${file} 不得注入 HTML`)
  assert.equal(source.includes('localStorage'), false, `${file} 不得持久化 PII`)
  assert.equal(source.includes('sessionStorage'), false, `${file} 不得持久化 PII`)
  assert.doesNotMatch(source, /method:\s*['"](?:POST|PUT|PATCH|DELETE)['"]/, `${file} 不得發出寫入 request`)
}

const bankList = readFileSync(join(root, 'src/app/admin/bank-transfers/page.tsx'), 'utf8')
const bankDetail = readFileSync(join(root, 'src/app/admin/bank-transfers/[id]/BankTransferDetailClient.tsx'), 'utf8')
for (const source of [bankList, bankDetail]) {
  assert.match(source, /新的銀行／郵局匯款流程已停止/)
  assert.match(source, /不提供審核、確認、退款、改狀態或重送通知操作/)
  assert.doesNotMatch(source, /(?:approve|reject|refund|confirm)[A-Z]\w*\s*=/)
}

const memberPage = readFileSync(join(root, 'src/app/admin/members/page.tsx'), 'utf8')
assert.match(memberPage, /目前為基本會員名錄，跨訂單、預約、付款與 AI 紀錄彙整尚未啟用/)

console.log('✓ admin read-only UI state and mutation-absence tests passed')
