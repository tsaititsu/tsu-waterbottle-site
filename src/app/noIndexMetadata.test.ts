import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { NO_INDEX_METADATA, NO_INDEX_ROBOTS } from '../lib/seo/noIndexMetadata'

const root = process.cwd()

assert.deepEqual(NO_INDEX_ROBOTS, {
  index: false,
  follow: false,
  googleBot: {
    index: false,
    follow: false,
  },
})
assert.deepEqual(NO_INDEX_METADATA.robots, NO_INDEX_ROBOTS)

const layoutCoverage = {
  'src/app/account/layout.tsx': [
    '/account',
    '/account/bookings',
    '/account/courses',
    '/account/divinations',
    '/account/divinations/[id]',
  ],
  'src/app/admin/layout.tsx': ['/admin', '/admin/booking-slots'],
  'src/app/ai-chart/result/layout.tsx': ['/ai-chart/result', '/ai-chart/result/[id]'],
  'src/app/ai-divination/draw/layout.tsx': ['/ai-divination/draw'],
  'src/app/bank-transfer/layout.tsx': ['/bank-transfer', '/bank-transfer/submit'],
  'src/app/booking/checkout/layout.tsx': ['/booking/checkout'],
  'src/app/booking/fail/layout.tsx': ['/booking/fail'],
  'src/app/booking/success/layout.tsx': ['/booking/success'],
  'src/app/cart/layout.tsx': ['/cart'],
  'src/app/courses/[id]/learn/layout.tsx': ['/courses/[id]/learn'],
  'src/app/payment/fail/layout.tsx': ['/payment/fail'],
  'src/app/payment/newebpay/redirect/layout.tsx': ['/payment/newebpay/redirect'],
  'src/app/payment/newebpay/result/layout.tsx': ['/payment/newebpay/result'],
  'src/app/payment/newebpay/test/layout.tsx': ['/payment/newebpay/test'],
  'src/app/dev/layout.tsx': ['/dev/newebpay-test'],
  'src/app/internal/layout.tsx': ['/internal/newebpay/apple-pay-test'],
} as const

const layoutRoutes = Object.values(layoutCoverage).flat()
assert.equal(layoutRoutes.length, 23)
assert.equal(new Set(layoutRoutes).size, layoutRoutes.length)

for (const file of Object.keys(layoutCoverage)) {
  const source = readFileSync(join(root, file), 'utf8')
  assert.match(source, /export const metadata/)
  assert.ok(source.includes('NO_INDEX_METADATA'))
}

const divinationResultPage = readFileSync(
  join(root, 'src/app/ai-divination/result/[readingId]/page.tsx'),
  'utf8',
)
assert.ok(divinationResultPage.includes('robots: NO_INDEX_ROBOTS'))

const adminLayout = readFileSync(join(root, 'src/app/admin/layout.tsx'), 'utf8')
assert.doesNotMatch(adminLayout, /^['"]use client['"]/)
assert.ok(adminLayout.includes('NO_INDEX_METADATA'))
assert.ok(adminLayout.includes('<AdminLayoutClient>{children}</AdminLayoutClient>'))

const adminLayoutClient = readFileSync(join(root, 'src/app/admin/AdminLayoutClient.tsx'), 'utf8')
assert.match(adminLayoutClient, /^'use client'/)
for (const expectedSource of [
  "getMockUser()",
  "getAuthAccessToken()",
  "fetch('/api/admin/session'",
  "cache: 'no-store'",
  'response.status === 401',
  "setAccessState('authorized')",
  "setAccessState('unauthenticated')",
  "setAccessState('forbidden')",
  'subscribeAuthChange',
  '請先登入管理員帳號',
  '<LoginModal',
  'returnTo={returnTo}',
  "accessState === 'authorized'",
  "accessState === 'forbidden'",
  '正在確認管理權限...',
]) {
  assert.ok(adminLayoutClient.includes(expectedSource), `admin guard lost: ${expectedSource}`)
}
assert.equal(adminLayoutClient.includes("router.replace('/')"), false)

const publicRouteSources = [
  'src/app/page.tsx',
  'src/app/ai-chart/page.tsx',
  'src/app/ai-divination/page.tsx',
  'src/app/booking/page.tsx',
  'src/app/courses/page.tsx',
  'src/app/spiritual-products/layout.tsx',
  'src/app/consumer-rights/page.tsx',
  'src/app/contact/page.tsx',
  'src/app/privacy/page.tsx',
  'src/app/refund-policy/page.tsx',
  'src/app/terms/page.tsx',
]

for (const file of publicRouteSources) {
  const source = readFileSync(join(root, file), 'utf8')
  assert.doesNotMatch(source, /NO_INDEX_(?:METADATA|ROBOTS)|index:\s*false/)
}

const rootLayout = readFileSync(join(root, 'src/app/layout.tsx'), 'utf8')
assert.doesNotMatch(rootLayout, /NO_INDEX_(?:METADATA|ROBOTS)|index:\s*false/)

assert.equal(existsSync(join(root, 'src/app/payment/layout.tsx')), false)

console.log('noindex metadata tests passed')
