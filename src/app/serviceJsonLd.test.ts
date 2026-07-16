import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { HOMEPAGE_JSON_LD } from '../lib/seo/homepageJsonLd'
import { PUBLIC_PAGE_METADATA } from '../lib/seo/publicMetadata'
import {
  AI_CHART_SERVICE_JSON_LD,
  AI_DIVINATION_SERVICE_JSON_LD,
  BOOKING_SERVICE_JSON_LD,
  serializeJsonLd,
} from '../lib/seo/serviceJsonLd'

const root = process.cwd()
const organizationId = 'https://tsu-waterbottle.com/#organization'

const services = [
  {
    schema: AI_CHART_SERVICE_JSON_LD,
    page: 'src/app/ai-chart/page.tsx',
    scriptId: 'ai-chart-service-structured-data',
    constantName: 'AI_CHART_SERVICE_JSON_LD',
    url: 'https://tsu-waterbottle.com/ai-chart',
    name: '紫微命盤分析',
    serviceType: 'AI 紫微命盤分析',
    description: PUBLIC_PAGE_METADATA.aiChart.description,
    offer: {
      name: 'AI 命盤分析',
      price: 100,
    },
  },
  {
    schema: AI_DIVINATION_SERVICE_JSON_LD,
    page: 'src/app/ai-divination/page.tsx',
    scriptId: 'ai-divination-service-structured-data',
    constantName: 'AI_DIVINATION_SERVICE_JSON_LD',
    url: 'https://tsu-waterbottle.com/ai-divination',
    name: '紫微牌卡占卜',
    serviceType: '紫微牌卡占卜與 AI 解讀',
    description: PUBLIC_PAGE_METADATA.aiDivination.description,
    offer: {
      name: '紫微牌卡 AI 解讀',
      price: 50,
    },
  },
  {
    schema: BOOKING_SERVICE_JSON_LD,
    page: 'src/app/booking/page.tsx',
    scriptId: 'booking-service-structured-data',
    constantName: 'BOOKING_SERVICE_JSON_LD',
    url: 'https://tsu-waterbottle.com/booking',
    name: '水瓶先生論命預約',
    serviceType: '一對一紫微斗數論命',
    description: PUBLIC_PAGE_METADATA.booking.description,
    offer: null,
  },
] as const

function assertNoEmptyValues(value: unknown, path = 'schema'): void {
  if (value === undefined) assert.fail(`${path} must not be undefined`)
  if (value === null) assert.fail(`${path} must not be null`)

  if (typeof value === 'string') {
    assert.notEqual(value.trim(), '', `${path} must not be empty`)
    return
  }

  if (Array.isArray(value)) {
    assert.ok(value.length > 0, `${path} must not be an empty array`)
    value.forEach((entry, index) => assertNoEmptyValues(entry, `${path}[${index}]`))
    return
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value)
    assert.ok(entries.length > 0, `${path} must not be an empty object`)
    entries.forEach(([key, entry]) => assertNoEmptyValues(entry, `${path}.${key}`))
  }
}

for (const service of services) {
  const serialized = serializeJsonLd(service.schema)
  const parsed = JSON.parse(serialized) as Record<string, unknown>

  assert.equal(parsed['@context'], 'https://schema.org')
  assert.equal(parsed['@type'], 'Service')
  assert.equal(parsed['@id'], `${service.url}#service`)
  assert.equal(parsed.name, service.name)
  assert.equal(parsed.serviceType, service.serviceType)
  assert.equal(parsed.description, service.description)
  assert.equal(parsed.url, service.url)
  assert.equal(parsed.mainEntityOfPage, service.url)
  assert.deepEqual(parsed.provider, { '@id': organizationId })
  assert.equal(serialized.includes('localhost'), false)
  assert.equal(serialized.includes('vercel.app'), false)
  assert.equal(serialized.includes('undefined'), false)
  assertNoEmptyValues(service.schema)

  if (service.offer) {
    assert.deepEqual(parsed.offers, {
      '@type': 'Offer',
      name: service.offer.name,
      price: service.offer.price,
      priceCurrency: 'TWD',
      url: service.url,
    })
  } else {
    assert.equal('offers' in parsed, false)
    assert.equal('price' in parsed, false)
    assert.equal('priceCurrency' in parsed, false)
  }

  for (const forbiddenField of [
    'Review',
    'AggregateRating',
    'potentialAction',
    'SearchAction',
    'areaServed',
    'ratingValue',
    'reviewCount',
    'telephone',
    'email',
    'address',
    'contactPoint',
    'sameAs',
    'availability',
    'availabilityStarts',
    'priceValidUntil',
    'validFrom',
    'eligibleRegion',
    'audience',
    'FAQPage',
    'Product',
    'Course',
    'Person',
    'ProfessionalService',
    'LocalBusiness',
    'PostalAddress',
    'openingHours',
    'image',
    'logo',
    'termsOfService',
    'hasOfferCatalog',
    'availableChannel',
    'serviceOutput',
  ]) {
    assert.equal(serialized.includes(forbiddenField), false)
  }
}

const aiChartPage = readFileSync(join(root, 'src/app/ai-chart/page.tsx'), 'utf8')
assert.equal(aiChartPage.includes('單次分析 NT$100'), true)
assert.equal(AI_DIVINATION_SERVICE_JSON_LD.description.includes('抽牌免費'), true)
assert.equal(AI_DIVINATION_SERVICE_JSON_LD.description.includes('AI 解讀每次 NT$50'), true)

const injectionProbe = serializeJsonLd({ value: '</script><script>alert(1)</script>' })
assert.equal(injectionProbe.includes('<'), false)
assert.deepEqual(JSON.parse(injectionProbe), {
  value: '</script><script>alert(1)</script>',
})
assert.throws(() => serializeJsonLd(undefined), /must be serializable/)

function collectTsxFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return collectTsxFiles(path)
    return entry.isFile() && entry.name.endsWith('.tsx') ? [path] : []
  })
}

const appSources = collectTsxFiles(join(root, 'src/app')).map((file) => ({
  file,
  source: readFileSync(file, 'utf8'),
}))

for (const service of services) {
  const pageSource = readFileSync(join(root, service.page), 'utf8')
  assert.equal(pageSource.match(new RegExp(service.scriptId, 'g'))?.length, 1)
  assert.ok(pageSource.includes('type="application/ld+json"'))
  assert.ok(pageSource.includes(`serializeJsonLd(${service.constantName})`))

  const filesWithScriptId = appSources.filter(({ source }) => source.includes(service.scriptId))
  assert.equal(filesWithScriptId.length, 1)
  assert.equal(filesWithScriptId[0].file, join(root, service.page))
}

for (const page of ['src/app/ai-divination/page.tsx', 'src/app/booking/page.tsx']) {
  const source = readFileSync(join(root, page), 'utf8')
  assert.ok(source.indexOf("redirect('/')") < source.indexOf('service-structured-data'))
}

const homepage = readFileSync(join(root, 'src/app/page.tsx'), 'utf8')
assert.equal(homepage.match(/homepage-structured-data/g)?.length, 1)
assert.equal(homepage.includes('service-structured-data'), false)
assert.equal(HOMEPAGE_JSON_LD['@graph'].length, 2)
assert.deepEqual(
  HOMEPAGE_JSON_LD['@graph'].map((entry) => entry['@type']),
  [['Organization', 'LocalBusiness'], 'WebSite'],
)

console.log('service JSON-LD tests passed')
