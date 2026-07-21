import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const pageSource = readFileSync(join(root, 'src/app/admin/bookings/page.tsx'), 'utf8')
const adminPageSource = readFileSync(join(root, 'src/app/admin/page.tsx'), 'utf8')
const routeSource = readFileSync(join(root, 'src/app/api/admin/bookings/route.ts'), 'utf8')

assert.match(pageSource, /fetch\('\/api\/admin\/bookings'/)
assert.match(pageSource, /getAuthAccessToken\(\)/)
assert.match(pageSource, /authorization: `Bearer \$\{accessToken\}`/)
assert.match(pageSource, /import \{ classifyAdminBookingStatus \} from '\.\/bookingStatus'/)
assert.match(pageSource, /if \(filter === 'all'\) return true/)
assert.match(pageSource, /return classifyAdminBookingStatus\(booking\) === filter/)
assert.match(pageSource, /const bucket = classifyAdminBookingStatus\(booking\)/)
assert.match(pageSource, /counts\[bucket\] \+= 1/)
assert.doesNotMatch(pageSource, /booking\.status === 'pending_payment' \|\| booking\.paymentStatus === 'pending'/)
assert.doesNotMatch(pageSource, /\['paid', 'confirmed'\]\.includes\(booking\.status\)/)
assert.match(pageSource, /return \(labels\[status\] \?\? status\) \|\| '未提供'/)
assert.equal(pageSource.includes("cache: 'no-store'"), true)
assert.equal(pageSource.includes('唯讀管理頁'), true)
assert.equal(pageSource.includes('修改、取消與退款功能尚未開放'), true)
assert.equal(pageSource.includes('最近 100 筆'), true)

for (const label of ['搜尋已載入紀錄', '待付款', '已付款／已確認', '已取消', '失敗', '未來預約', '過去預約']) {
  assert.equal(pageSource.includes(label), true, `頁面應包含 ${label}`)
}

assert.equal(pageSource.includes('data-mobile-booking-cards'), true)
assert.equal(pageSource.includes('lg:hidden'), true)
assert.equal(pageSource.includes('hidden overflow-x-auto lg:block'), true)
assert.equal(pageSource.includes('mailto:'), true)
assert.equal(pageSource.includes('tel:'), true)
assert.equal(pageSource.includes('line-clamp-2'), true)
assert.equal(pageSource.includes('dangerouslySetInnerHTML'), false)
assert.equal(pageSource.includes('localStorage'), false)
assert.equal(pageSource.includes('sessionStorage'), false)
assert.equal(pageSource.includes('URLSearchParams'), false)
assert.doesNotMatch(pageSource, /method:\s*['"](?:POST|PUT|PATCH|DELETE)['"]/)
assert.equal(pageSource.includes('/api/admin/booking-slots/batch'), false)
assert.equal(pageSource.includes('/api/admin/booking-slots/bulk-close'), false)

assert.match(adminPageSource, /label: '預約紀錄'.*href: '\/admin\/bookings'/)
assert.match(adminPageSource, /label: '預約時段'.*href: '\/admin\/booking-slots'/)
assert.equal(routeSource.includes("export const dynamic = 'force-dynamic'"), true)
assert.equal(routeSource.includes('handleAdminBookingsRequest(request)'), true)

console.log('✓ admin bookings page read-only contract tests passed')
