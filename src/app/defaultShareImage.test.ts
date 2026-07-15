import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createPublicMetadata, PUBLIC_PAGE_METADATA } from '../lib/seo/publicMetadata'

const root = process.cwd()
const openGraphPath = join(root, 'src/app/opengraph-image.tsx')
const twitterPath = join(root, 'src/app/twitter-image.tsx')
const rendererPath = join(root, 'src/lib/seo/defaultShareImage.tsx')

assert.equal(existsSync(openGraphPath), true)
assert.equal(existsSync(twitterPath), true)
assert.equal(existsSync(rendererPath), true)

const openGraphSource = readFileSync(openGraphPath, 'utf8')
const twitterSource = readFileSync(twitterPath, 'utf8')
const rendererSource = readFileSync(rendererPath, 'utf8')

for (const source of [openGraphSource, twitterSource]) {
  assert.match(source, /import \{ ImageResponse \} from 'next\/og'/)
  assert.match(source, /alt = 'WATERBOTTLE 紫微命理'/)
  assert.match(source, /width: 1200/)
  assert.match(source, /height: 630/)
  assert.match(source, /contentType = 'image\/png'/)
  assert.ok(source.includes('getDefaultShareImageElement'))
}

assert.ok(rendererSource.includes('public/brand/waterbottle-logo-web.png'))
assert.ok(rendererSource.includes('data:image/png;base64'))
assert.equal(/fetch\s*\(/.test(rendererSource), false)
assert.equal(/https?:\/\//.test(rendererSource), false)

for (const entry of Object.values(PUBLIC_PAGE_METADATA)) {
  const metadata = createPublicMetadata(entry)
  assert.ok(metadata.twitter && 'card' in metadata.twitter)
  assert.equal(metadata.twitter.card, 'summary_large_image')
  assert.equal(metadata.alternates?.canonical, entry.path)
  assert.equal(metadata.openGraph?.url, entry.path)
  assert.equal(metadata.openGraph?.description, entry.description)
  assert.equal(metadata.twitter?.description, entry.description)
  assert.deepEqual(metadata.openGraph?.images, [
    {
      url: '/opengraph-image',
      width: 1200,
      height: 630,
      alt: 'WATERBOTTLE 紫微命理',
      type: 'image/png',
    },
  ])
  assert.deepEqual(metadata.twitter.images, ['/twitter-image'])
}

console.log('default social share image tests passed')
