import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  createPublicMetadata,
  PUBLIC_PAGE_METADATA,
  SITE_TITLE,
} from '../lib/seo/publicMetadata'

const root = process.cwd()
const entries = Object.values(PUBLIC_PAGE_METADATA)
const metadata = entries.map(createPublicMetadata)

assert.equal(entries.length, 6)
assert.equal(new Set(entries.map((entry) => entry.title)).size, entries.length)
assert.equal(new Set(entries.map((entry) => entry.description)).size, entries.length)

for (const [index, entry] of entries.entries()) {
  const pageMetadata = metadata[index]
  assert.equal(pageMetadata.alternates?.canonical, entry.path)
  assert.equal(pageMetadata.openGraph?.url, entry.path)
  assert.equal(pageMetadata.openGraph?.description, entry.description)
  assert.ok(pageMetadata.twitter && 'card' in pageMetadata.twitter)
  assert.equal(pageMetadata.twitter.card, 'summary_large_image')
  assert.equal(pageMetadata.twitter.description, entry.description)
  assert.deepEqual(pageMetadata.openGraph?.images, [
    {
      url: '/opengraph-image',
      width: 1200,
      height: 630,
      alt: 'WATERBOTTLE 紫微命理',
      type: 'image/png',
    },
  ])
  assert.deepEqual(pageMetadata.twitter.images, ['/twitter-image'])
}

assert.deepEqual(metadata[0].title, { absolute: SITE_TITLE })
assert.equal(metadata[0].openGraph?.title, SITE_TITLE)
const publicPaths = new Set<string>(entries.map((entry) => entry.path))
assert.equal(publicPaths.has('/products'), false)
assert.equal(publicPaths.has('/spiritual-products'), true)

assert.throws(
  () => createPublicMetadata({ title: '外部頁面', description: '不接受外部網址', path: '//example.com' }),
  /local absolute path/,
)

const rootLayout = readFileSync(join(root, 'src/app/layout.tsx'), 'utf8')
assert.doesNotMatch(rootLayout, /canonical:\s*['"]\/['"]/)
assert.doesNotMatch(rootLayout, /url:\s*['"]\/['"]/)

const routeSources: Array<[string, string]> = [
  ['src/app/page.tsx', 'PUBLIC_PAGE_METADATA.home'],
  ['src/app/ai-chart/page.tsx', 'PUBLIC_PAGE_METADATA.aiChart'],
  ['src/app/ai-divination/page.tsx', 'PUBLIC_PAGE_METADATA.aiDivination'],
  ['src/app/booking/page.tsx', 'PUBLIC_PAGE_METADATA.booking'],
  ['src/app/courses/page.tsx', 'PUBLIC_PAGE_METADATA.courses'],
  ['src/app/spiritual-products/layout.tsx', 'PUBLIC_PAGE_METADATA.spiritualProducts'],
]

for (const [file, metadataKey] of routeSources) {
  const source = readFileSync(join(root, file), 'utf8')
  assert.match(source, /export const metadata/)
  assert.ok(source.includes(metadataKey))
}

console.log('public metadata tests passed')
