import assert from 'node:assert/strict'
import robots from './robots'
import sitemap from './sitemap'

const expectedUrls = [
  'https://tsu-waterbottle.com/',
  'https://tsu-waterbottle.com/ai-chart',
  'https://tsu-waterbottle.com/ai-divination',
  'https://tsu-waterbottle.com/booking',
  'https://tsu-waterbottle.com/courses',
  'https://tsu-waterbottle.com/spiritual-products',
]

const sitemapEntries = sitemap()

assert.equal(sitemapEntries.length, expectedUrls.length)
assert.deepEqual(
  sitemapEntries.map((entry) => entry.url),
  expectedUrls,
)
assert.equal(sitemapEntries.some((entry) => 'lastModified' in entry), false)
assert.equal(sitemapEntries.some((entry) => entry.url.includes('/products')), false)
assert.equal(sitemapEntries.some((entry) => entry.url.includes('/api/')), false)

assert.deepEqual(robots(), {
  rules: {
    userAgent: '*',
    allow: '/',
    disallow: '/api/',
  },
  sitemap: 'https://tsu-waterbottle.com/sitemap.xml',
})

console.log('metadata route tests passed')
