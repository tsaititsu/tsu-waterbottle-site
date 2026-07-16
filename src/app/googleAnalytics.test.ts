import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  createGoogleAnalyticsPageViewPayload,
  GA_MEASUREMENT_ID,
  GOOGLE_ANALYTICS_PUBLIC_PATHS,
  isGoogleAnalyticsProductionHost,
  sanitizeGoogleAnalyticsPath,
  shouldTrackGoogleAnalyticsPath,
} from '../lib/analytics/googleAnalytics'

const root = process.cwd()
const componentPath = 'src/components/analytics/GoogleAnalytics.tsx'
const helperPath = 'src/lib/analytics/googleAnalytics.ts'
const componentSource = readFileSync(join(root, componentPath), 'utf8')
const helperSource = readFileSync(join(root, helperPath), 'utf8')
const layoutSource = readFileSync(join(root, 'src/app/layout.tsx'), 'utf8')
const privacySource = readFileSync(join(root, 'src/app/privacy/page.tsx'), 'utf8')

assert.equal(GA_MEASUREMENT_ID, 'G-239FT0JGEC')
assert.equal(isGoogleAnalyticsProductionHost('tsu-waterbottle.com'), true)
assert.equal(isGoogleAnalyticsProductionHost('www.tsu-waterbottle.com'), true)

for (const hostname of [
  'localhost',
  '127.0.0.1',
  'tsu-waterbottle-site.vercel.app',
  'preview-tsu-waterbottle.vercel.app',
  'example.com',
]) {
  assert.equal(isGoogleAnalyticsProductionHost(hostname), false)
}

assert.deepEqual(GOOGLE_ANALYTICS_PUBLIC_PATHS, [
  '/',
  '/ai-chart',
  '/ai-divination',
  '/booking',
  '/courses',
  '/spiritual-products',
  '/contact',
  '/terms',
  '/privacy',
  '/refund-policy',
  '/consumer-rights',
])

for (const pathname of GOOGLE_ANALYTICS_PUBLIC_PATHS) {
  assert.equal(shouldTrackGoogleAnalyticsPath(pathname), true)
}

for (const pathname of [
  '/account',
  '/admin',
  '/ai-chart/result',
  '/ai-chart/result?readingId=test',
  '/ai-divination/draw',
  '/cart',
  '/payment',
  '/payment/fail',
  '/payment/success',
  '/bank-transfer',
  '/booking/checkout',
  '/api/test',
  '/dev/test',
  '/internal/test',
  '/unknown',
]) {
  assert.equal(shouldTrackGoogleAnalyticsPath(pathname), false)
}

assert.equal(sanitizeGoogleAnalyticsPath(''), '/')
assert.equal(sanitizeGoogleAnalyticsPath('/ai-chart?readingId=test#result'), '/ai-chart')
assert.equal(sanitizeGoogleAnalyticsPath('/contact#support'), '/contact')
assert.equal(shouldTrackGoogleAnalyticsPath('/ai-chart?source=test'), true)

assert.deepEqual(
  createGoogleAnalyticsPageViewPayload(
    '/ai-chart?readingId=private#result',
    'https://tsu-waterbottle.com',
    'AI 命盤',
  ),
  {
    page_title: 'AI 命盤',
    page_path: '/ai-chart',
    page_location: 'https://tsu-waterbottle.com/ai-chart',
    page_referrer: '',
  },
)

assert.ok(componentSource.startsWith("'use client'"))
assert.ok(componentSource.includes("import Script from 'next/script'"))
assert.ok(componentSource.includes("import { usePathname } from 'next/navigation'"))
assert.equal(componentSource.match(/googletagmanager\.com/g)?.length, 1)
assert.ok(componentSource.includes('strategy="afterInteractive"'))
assert.ok(componentSource.includes('send_page_view: false'))
assert.ok(componentSource.includes("'page_view'"))
assert.ok(componentSource.includes('window.location.origin'))
assert.ok(componentSource.includes("page_referrer: ''") || helperSource.includes("page_referrer: ''"))
assert.ok(componentSource.includes('lastTrackedPath.current === sanitizedPath'))
assert.equal(componentSource.includes('useSearchParams'), false)
assert.equal(componentSource.includes('window.location.href'), false)

assert.equal(layoutSource.startsWith("'use client'"), false)
assert.equal(layoutSource.match(/<GoogleAnalytics \/>/g)?.length, 1)
assert.equal(
  layoutSource.match(/import \{ GoogleAnalytics \} from '@\/components\/analytics\/GoogleAnalytics'/g)
    ?.length,
  1,
)

const analyticsSources = `${helperSource}\n${componentSource}`

for (const forbiddenValue of [
  'useSearchParams',
  'window.location.href',
  'user_id',
  'email',
  'birth',
  'birthday',
  'gender',
  'readingId',
  'reportId',
  'orderId',
  'paymentId',
  'amount',
  'transaction',
  'question',
  'prompt',
]) {
  assert.equal(analyticsSources.includes(forbiddenValue), false)
}

assert.ok(
  privacySource.includes(
    'Google Analytics：用於統計公開頁面的瀏覽與使用情況，可能透過 Cookie 處理頁面路徑、頁面標題、裝置／瀏覽器及大致地區等資訊。',
  ),
)
assert.ok(privacySource.includes('不會主動將姓名、生日、命盤內容、占卜問題、Email、會員 ID、訂單編號或付款資料'))

console.log('Google Analytics tests passed')
