import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { spiritualProducts } from './spiritualProducts'

assert.equal(spiritualProducts.length, 10)
assert.equal(spiritualProducts.some((product) => product.slug === 'wu-lei-ya-sha-fu'), false)
assert.equal(spiritualProducts.some((product) => product.name === '五雷壓煞符'), false)

for (const expected of [
  { slug: 'ren-yuan-fu', name: '人緣符' },
  { slug: 'kai-yun-cai-fu', name: '開運財符' },
  { slug: 'ju-bao-pen', name: '聚寶盆' },
]) {
  assert.equal(
    spiritualProducts.some((product) => product.slug === expected.slug && product.name === expected.name),
    true,
    `${expected.name} must remain in the catalog`,
  )
}

assert.equal(new Set(spiritualProducts.map((product) => product.slug)).size, spiritualProducts.length)
assert.equal(
  spiritualProducts.some((product) => Object.prototype.hasOwnProperty.call(product, 'availability')),
  false,
)
assert.equal(
  existsSync(join(process.cwd(), 'public/products/spiritual/wu-lei-ya-sha-fu.jpg')),
  true,
  'the retired product image must remain untouched',
)

console.log('✓ spiritual product catalog contracts passed')
