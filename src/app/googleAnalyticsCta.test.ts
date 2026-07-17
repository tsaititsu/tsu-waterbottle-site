import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  createGoogleAnalyticsCtaClickPayload,
  createGoogleAnalyticsQueue,
  GOOGLE_ANALYTICS_CTA_DESTINATIONS,
  GOOGLE_ANALYTICS_CTA_PLACEMENTS,
  trackGoogleAnalyticsCtaClick,
} from '../lib/analytics/googleAnalytics'
import type {
  GoogleAnalyticsCtaClickInput,
  GoogleAnalyticsFunction,
  GoogleAnalyticsWindowLike,
} from '../lib/analytics/googleAnalytics'

const root = process.cwd()
const helperSource = readFileSync(
  join(root, 'src/lib/analytics/googleAnalytics.ts'),
  'utf8',
)
const trackedLinkSource = readFileSync(
  join(root, 'src/components/analytics/TrackedPublicCtaLink.tsx'),
  'utf8',
)
const actionButtonSource = readFileSync(join(root, 'src/components/ActionButton.tsx'), 'utf8')
const heroSource = readFileSync(join(root, 'src/components/HeroSection.tsx'), 'utf8')
const serviceCardsSource = readFileSync(join(root, 'src/components/ServiceCards.tsx'), 'utf8')
const feedbackSource = readFileSync(join(root, 'src/components/CustomerFeedback.tsx'), 'utf8')
const pricingSource = readFileSync(join(root, 'src/components/PricingSection.tsx'), 'utf8')
const courseSource = readFileSync(join(root, 'src/components/CoursePreview.tsx'), 'utf8')
const headerSource = readFileSync(join(root, 'src/components/Header.tsx'), 'utf8')
const mobileNavSource = readFileSync(join(root, 'src/components/MobileBottomNav.tsx'), 'utf8')
const footerSource = readFileSync(join(root, 'src/components/Footer.tsx'), 'utf8')
const floatingLineSource = readFileSync(
  join(root, 'src/components/FloatingLineButton.tsx'),
  'utf8',
)

const homeHeroInput: GoogleAnalyticsCtaClickInput = {
  destination: 'ai_chart',
  placement: 'home_hero',
}

assert.deepEqual(GOOGLE_ANALYTICS_CTA_DESTINATIONS, [
  'ai_chart',
  'ai_divination',
  'booking',
  'courses',
  'spiritual_products',
  'line_official_account',
])
assert.deepEqual(GOOGLE_ANALYTICS_CTA_PLACEMENTS, [
  'home_hero',
  'home_service_card',
  'home_feedback',
  'home_pricing',
  'home_course_preview',
  'header_desktop',
  'header_mobile',
  'mobile_bottom_nav',
  'footer_service',
  'footer_line',
  'floating_line',
])

const payload = createGoogleAnalyticsCtaClickPayload(
  '/ai-chart?readingId=private#result',
  homeHeroInput,
)

assert.deepEqual(payload, {
  cta_id: 'home_hero_ai_chart',
  cta_destination: 'ai_chart',
  cta_placement: 'home_hero',
  source_path: '/ai-chart',
})
assert.deepEqual(Object.keys(payload ?? {}), [
  'cta_id',
  'cta_destination',
  'cta_placement',
  'source_path',
])
assert.equal(Object.values(payload ?? {}).includes(undefined), false)
assert.equal(JSON.stringify(payload).includes('readingId'), false)

function createQueuedAnalyticsTarget() {
  const dataLayer: unknown[] = []
  const target: GoogleAnalyticsWindowLike = {
    dataLayer,
    gtag: createGoogleAnalyticsQueue(dataLayer),
  }
  return { dataLayer, target }
}

for (const hostname of ['tsu-waterbottle.com', 'www.tsu-waterbottle.com']) {
  const { dataLayer, target } = createQueuedAnalyticsTarget()
  assert.equal(trackGoogleAnalyticsCtaClick(target, hostname, '/', homeHeroInput), true)
  assert.equal(dataLayer.length, 1)
}

for (const hostname of [
  'localhost',
  '127.0.0.1',
  'tsu-waterbottle-site.vercel.app',
  'preview-tsu-waterbottle.vercel.app',
  'example.com',
]) {
  const { dataLayer, target } = createQueuedAnalyticsTarget()
  assert.equal(trackGoogleAnalyticsCtaClick(target, hostname, '/', homeHeroInput), false)
  assert.equal(dataLayer.length, 0)
}

for (const pathname of [
  '/account',
  '/cart',
  '/payment',
  '/payment/fail',
  '/admin',
  '/api/test',
]) {
  const { dataLayer, target } = createQueuedAnalyticsTarget()
  assert.equal(
    trackGoogleAnalyticsCtaClick(target, 'tsu-waterbottle.com', pathname, homeHeroInput),
    false,
  )
  assert.equal(dataLayer.length, 0)
}

const sanitizedQueue = createQueuedAnalyticsTarget()
assert.equal(
  trackGoogleAnalyticsCtaClick(
    sanitizedQueue.target,
    'tsu-waterbottle.com',
    '/courses?source=private#course-master',
    { destination: 'courses', placement: 'home_course_preview' },
  ),
  true,
)
const sanitizedCommand = sanitizedQueue.dataLayer[0] as ArrayLike<unknown>
assert.equal(sanitizedCommand[0], 'event')
assert.equal(sanitizedCommand[1], 'cta_click')
assert.deepEqual(sanitizedCommand[2], {
  cta_id: 'home_course_preview_courses',
  cta_destination: 'courses',
  cta_placement: 'home_course_preview',
  source_path: '/courses',
})

const fullHrefQueue = createQueuedAnalyticsTarget()
assert.equal(
  trackGoogleAnalyticsCtaClick(
    fullHrefQueue.target,
    'tsu-waterbottle.com',
    'https://tsu-waterbottle.com/ai-chart?source=private',
    homeHeroInput,
  ),
  false,
)
assert.equal(fullHrefQueue.dataLayer.length, 0)

const missingGtagTarget: GoogleAnalyticsWindowLike = {}
assert.doesNotThrow(() =>
  trackGoogleAnalyticsCtaClick(
    missingGtagTarget,
    'tsu-waterbottle.com',
    '/',
    homeHeroInput,
  ),
)
assert.equal(
  trackGoogleAnalyticsCtaClick(
    missingGtagTarget,
    'tsu-waterbottle.com',
    '/',
    homeHeroInput,
  ),
  false,
)
assert.equal(missingGtagTarget.dataLayer, undefined)
assert.equal(missingGtagTarget.waterbottleGoogleAnalyticsInitialized, undefined)

const throwingGtag = (() => {
  throw new Error('queue unavailable')
}) as GoogleAnalyticsFunction
assert.equal(
  trackGoogleAnalyticsCtaClick(
    { gtag: throwingGtag },
    'tsu-waterbottle.com',
    '/',
    homeHeroInput,
  ),
  false,
)

const invalidDestination = {
  destination: 'unknown',
  placement: 'home_hero',
} as unknown as GoogleAnalyticsCtaClickInput
const invalidPlacement = {
  destination: 'ai_chart',
  placement: 'unknown',
} as unknown as GoogleAnalyticsCtaClickInput
assert.equal(createGoogleAnalyticsCtaClickPayload('/', invalidDestination), null)
assert.equal(createGoogleAnalyticsCtaClickPayload('/', invalidPlacement), null)

const repeatedQueue = createQueuedAnalyticsTarget()
assert.equal(
  trackGoogleAnalyticsCtaClick(
    repeatedQueue.target,
    'tsu-waterbottle.com',
    '/',
    homeHeroInput,
  ),
  true,
)
assert.equal(
  trackGoogleAnalyticsCtaClick(
    repeatedQueue.target,
    'tsu-waterbottle.com',
    '/',
    homeHeroInput,
  ),
  true,
)
assert.equal(repeatedQueue.dataLayer.length, 2)

for (const entry of repeatedQueue.dataLayer) {
  const command = entry as ArrayLike<unknown>
  assert.equal(Array.isArray(command), false)
  assert.equal(Object.prototype.toString.call(command), '[object Arguments]')
  assert.equal(command[0], 'event')
  assert.equal(command[1], 'cta_click')
  assert.deepEqual(command[2], payload && { ...payload, source_path: '/' })
}

const ctaHelperStart = helperSource.indexOf(
  'export function createGoogleAnalyticsCtaClickPayload',
)
const ctaHelperEnd = helperSource.indexOf('export function createGoogleAnalyticsPageViewPayload')
const ctaHelperSource = helperSource.slice(ctaHelperStart, ctaHelperEnd)

for (const forbiddenValue of [
  'itemName',
  'amount',
  'value',
  'currency',
  'productSlug',
  'user_id',
  'member_id',
  'readingId',
  'reportId',
  'orderId',
  'paymentId',
  'window.location.href',
  'document.referrer',
  'localStorage',
  'sessionStorage',
  'cookie',
  'https://lin.ee',
]) {
  assert.equal(ctaHelperSource.includes(forbiddenValue), false)
}

for (const forbiddenEvent of [
  'button_click',
  'link_click',
  'service_click',
  'line_click',
  'purchase',
  'add_to_cart',
  'begin_checkout',
  'generate_lead',
]) {
  assert.equal(ctaHelperSource.includes(forbiddenEvent), false)
}

assert.ok(trackedLinkSource.startsWith("'use client'"))
assert.ok(trackedLinkSource.includes('window.location.hostname'))
assert.ok(trackedLinkSource.includes('window.location.pathname'))
assert.equal(trackedLinkSource.includes('window.location.href'), false)
assert.equal(trackedLinkSource.includes('preventDefault'), false)
assert.equal(trackedLinkSource.includes('event_callback'), false)
assert.equal(trackedLinkSource.includes('setTimeout'), false)
assert.ok(
  trackedLinkSource.indexOf('trackGoogleAnalyticsCtaClick(') <
    trackedLinkSource.indexOf('onClick?.(event)'),
)

assert.ok(heroSource.includes('destination="ai_chart"'))
assert.ok(heroSource.includes('destination="booking"'))
assert.equal(heroSource.match(/placement="home_hero"/g)?.length, 2)

for (const mapping of [
  "'/ai-chart': 'ai_chart'",
  "'/ai-divination': 'ai_divination'",
  "'/booking': 'booking'",
  "'/courses': 'courses'",
]) {
  assert.ok(serviceCardsSource.includes(mapping))
}
assert.ok(serviceCardsSource.includes('placement="home_service_card"'))
assert.ok(serviceCardsSource.includes('destination ? ('))
assert.ok(serviceCardsSource.includes('<Link className={ctaClassName}'))

assert.ok(feedbackSource.includes('destination="ai_divination"'))
assert.ok(feedbackSource.includes('destination="booking"'))
assert.equal(feedbackSource.match(/placement="home_feedback"/g)?.length, 2)

assert.ok(pricingSource.includes("placement: 'home_pricing'"))
assert.ok(pricingSource.includes('analytics={pricingCtaByItemType[plan.itemType]}'))
const actionStartSource = actionButtonSource.slice(
  actionButtonSource.indexOf('const start = async () => {'),
  actionButtonSource.indexOf('const continueAfterLogin = async () => {'),
)
const continueAfterLoginSource = actionButtonSource.slice(
  actionButtonSource.indexOf('const continueAfterLogin = async () => {'),
  actionButtonSource.indexOf('return ('),
)
assert.equal(actionStartSource.match(/trackGoogleAnalyticsCtaClick/g)?.length, 1)
assert.ok(
  actionStartSource.indexOf('trackGoogleAnalyticsCtaClick') <
    actionStartSource.indexOf('getMockUser'),
)
assert.equal(actionStartSource.includes('itemName'), false)
assert.equal(actionStartSource.includes('amount'), false)
assert.equal(continueAfterLoginSource.includes('trackGoogleAnalyticsCtaClick'), false)

assert.ok(courseSource.includes('destination="courses"'))
assert.ok(courseSource.includes('placement="home_course_preview"'))

assert.ok(headerSource.includes('placement="header_desktop"'))
assert.ok(headerSource.includes('placement="header_mobile"'))
assert.equal(
  headerSource.match(/router\.push\(`\$\{item\.href\}\?reset=\$\{Date\.now\(\)\}`\)/g)?.length,
  2,
)
assert.equal(headerSource.match(/<TrackedPublicCtaLink/g)?.length, 2)

const mobileMappingSource = mobileNavSource.slice(
  mobileNavSource.indexOf('const mobileCtaDestinationByHref'),
  mobileNavSource.indexOf('const visibleItems'),
)
assert.ok(mobileMappingSource.includes("'/ai-chart': 'ai_chart'"))
assert.ok(mobileMappingSource.includes("'/ai-divination': 'ai_divination'"))
assert.ok(mobileMappingSource.includes("'/courses': 'courses'"))
assert.equal(mobileMappingSource.includes("'/':"), false)
assert.equal(mobileMappingSource.includes("'/account':"), false)
assert.ok(mobileNavSource.includes('placement="mobile_bottom_nav"'))

assert.ok(footerSource.includes('placement="footer_service"'))
assert.ok(footerSource.includes('placement="footer_line"'))
assert.ok(footerSource.includes('destination="line_official_account"'))
const consumerLinksRenderSource = footerSource.slice(
  footerSource.indexOf('consumerLinks.map'),
  footerSource.indexOf('</nav>', footerSource.indexOf('consumerLinks.map')),
)
assert.equal(consumerLinksRenderSource.includes('TrackedPublicCtaLink'), false)

const floatingClickStart = floatingLineSource.indexOf('const handleClick')
const floatingClickSource = floatingLineSource.slice(
  floatingClickStart,
  floatingLineSource.indexOf('  return (', floatingClickStart),
)
assert.ok(floatingClickSource.includes('if (movedRef.current)'))
assert.ok(floatingClickSource.includes('event.preventDefault()'))
assert.ok(floatingClickSource.includes('return'))
assert.ok(floatingClickSource.includes("placement: 'floating_line'"))
assert.ok(
  floatingClickSource.indexOf('return') <
    floatingClickSource.indexOf('trackGoogleAnalyticsCtaClick'),
)

const componentSources = [
  trackedLinkSource,
  actionButtonSource,
  heroSource,
  serviceCardsSource,
  feedbackSource,
  pricingSource,
  courseSource,
  headerSource,
  mobileNavSource,
  footerSource,
  floatingLineSource,
].join('\n')

assert.equal(componentSources.includes("document.addEventListener('click'"), false)
assert.equal(componentSources.includes('event_callback'), false)
assert.equal(componentSources.includes('event_timeout'), false)

console.log('Google Analytics CTA tests passed')
