import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const expectedFiles = [
  'src/app/not-found.tsx',
  'src/app/error.tsx',
  'src/app/global-error.tsx',
  'src/components/BrandedErrorPage.tsx',
] as const

for (const relativePath of expectedFiles) {
  assert.equal(existsSync(join(root, relativePath)), true, `${relativePath} must exist`)
}

const readSource = (relativePath: (typeof expectedFiles)[number]) =>
  readFileSync(join(root, relativePath), 'utf8')

const notFoundSource = readSource('src/app/not-found.tsx')
const errorSource = readSource('src/app/error.tsx')
const globalErrorSource = readSource('src/app/global-error.tsx')
const brandedErrorPageSource = readSource('src/components/BrandedErrorPage.tsx')

assert.ok(notFoundSource.includes('這個頁面找不到'))
assert.ok(notFoundSource.includes('網址可能已變更，或頁面暫時不存在。'))
assert.ok(notFoundSource.includes('BrandedErrorPage'))
assert.ok(notFoundSource.includes("title: '找不到頁面'"))
assert.ok(notFoundSource.includes('showChartLink'))

assert.match(errorSource, /^'use client'/)
assert.ok(errorSource.includes('reset: () => void'))
assert.ok(errorSource.includes('onRetry={reset}'))
assert.equal(errorSource.includes('showChartLink'), false)

assert.ok(errorSource.includes('頁面暫時無法顯示'))
assert.match(globalErrorSource, /^'use client'/)
assert.ok(globalErrorSource.includes('網站暫時無法載入'))
assert.ok(globalErrorSource.includes('<html lang="zh-Hant">'))
assert.ok(globalErrorSource.includes('<body'))
assert.ok(globalErrorSource.includes('<title>'))
assert.ok(globalErrorSource.includes('<main'))
assert.ok(globalErrorSource.includes('reset: () => void'))
assert.ok(globalErrorSource.includes('onClick={reset}'))
assert.ok(globalErrorSource.includes('type="button"'))
assert.match(globalErrorSource, /<a[^>]*href="\/"[^>]*>回到首頁<\/a>/)
assert.match(
  globalErrorSource,
  /<meta\s+name="robots"\s+content="noindex,\s*nofollow"\s*\/>/,
)

for (const forbiddenGlobalDependency of [
  'BrandedErrorPage',
  'next/image',
  'next/link',
  '@/',
]) {
  assert.equal(
    globalErrorSource.includes(forbiddenGlobalDependency),
    false,
    `Global error must be self-contained: ${forbiddenGlobalDependency}`,
  )
}

assert.doesNotMatch(globalErrorSource, /^\s*import\s/m)

for (const expectedContract of [
  'WATERBOTTLE',
  '/brand/waterbottle-logo-transparent.png',
  '重新嘗試',
  '回到首頁',
  '聯絡客服',
  'href="/"',
  'href="/contact"',
  'type="button"',
  'focus-visible',
]) {
  assert.ok(
    brandedErrorPageSource.includes(expectedContract),
    `Branded error UI lost: ${expectedContract}`,
  )
}

for (const notFoundAction of [
  'href="/"',
  'href="/ai-chart"',
  'href="/contact"',
]) {
  assert.ok(
    brandedErrorPageSource.includes(notFoundAction),
    `404 action missing: ${notFoundAction}`,
  )
}

const allErrorSources = [
  notFoundSource,
  errorSource,
  globalErrorSource,
  brandedErrorPageSource,
].join('\n')

for (const forbiddenSource of [
  'error.message',
  'error.stack',
  'error.digest',
  'JSON.stringify(error',
  'console.error',
  'console.log',
  'fetch(',
  'sendBeacon',
  'setInterval(',
  'setTimeout(',
  'location.reload',
  'process.env',
]) {
  assert.equal(
    allErrorSources.includes(forbiddenSource),
    false,
    `Error pages must not expose or transmit: ${forbiddenSource}`,
  )
}

console.log('✓ branded 404 and error page contracts passed')
