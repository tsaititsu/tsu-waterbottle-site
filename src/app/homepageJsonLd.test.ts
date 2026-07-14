import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { HOMEPAGE_JSON_LD, serializeJsonLd } from '../lib/seo/homepageJsonLd'
import { PUBLIC_PAGE_METADATA } from '../lib/seo/publicMetadata'

const root = process.cwd()
const serialized = serializeJsonLd(HOMEPAGE_JSON_LD)
const parsed = JSON.parse(serialized) as typeof HOMEPAGE_JSON_LD

assert.equal(parsed['@context'], 'https://schema.org')
assert.ok(Array.isArray(parsed['@graph']))
assert.equal(parsed['@graph'].length, 2)

const organizations = parsed['@graph'].filter((entry) => entry['@type'] === 'Organization')
const websites = parsed['@graph'].filter((entry) => entry['@type'] === 'WebSite')

assert.equal(organizations.length, 1)
assert.equal(websites.length, 1)

const organization = organizations[0]
assert.equal(organization['@id'], 'https://tsu-waterbottle.com/#organization')
assert.equal(organization.name, 'WATERBOTTLE 紫微命理')
assert.equal(organization.url, 'https://tsu-waterbottle.com/')
assert.equal(organization.description, PUBLIC_PAGE_METADATA.home.description)
assert.deepEqual(organization.logo, {
  '@type': 'ImageObject',
  url: 'https://tsu-waterbottle.com/brand/waterbottle-logo-web.png',
  width: 512,
  height: 512,
})

const website = websites[0]
assert.equal(website['@id'], 'https://tsu-waterbottle.com/#website')
assert.equal(website.name, 'WATERBOTTLE 紫微命理')
assert.equal(website.url, 'https://tsu-waterbottle.com/')
assert.equal(website.inLanguage, 'zh-TW')
assert.deepEqual(website.publisher, {
  '@id': 'https://tsu-waterbottle.com/#organization',
})

for (const forbiddenField of [
  'SearchAction',
  'potentialAction',
  'Review',
  'AggregateRating',
  'address',
  'telephone',
  'email',
  'sameAs',
]) {
  assert.equal(serialized.includes(forbiddenField), false)
}

assert.equal(serialized.includes('localhost'), false)
assert.equal(serialized.includes('vercel.app'), false)
assert.equal(serialized.includes('undefined'), false)

const injectionProbe = serializeJsonLd({ value: '</script><script>alert(1)</script>' })
assert.equal(injectionProbe.includes('<'), false)
assert.ok(injectionProbe.includes('\\u003c/script>'))
assert.deepEqual(JSON.parse(injectionProbe), {
  value: '</script><script>alert(1)</script>',
})

const homepage = readFileSync(join(root, 'src/app/page.tsx'), 'utf8')
assert.equal(homepage.match(/homepage-structured-data/g)?.length, 1)
assert.ok(homepage.includes('type="application/ld+json"'))
assert.ok(homepage.includes('serializeJsonLd(HOMEPAGE_JSON_LD)'))

for (const file of [
  'src/app/layout.tsx',
  'src/app/ai-chart/page.tsx',
  'src/app/booking/page.tsx',
]) {
  const source = readFileSync(join(root, file), 'utf8')
  assert.equal(source.includes('homepage-structured-data'), false)
}

console.log('homepage JSON-LD tests passed')
