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

for (const source of [errorSource, globalErrorSource]) {
  assert.match(source, /^'use client'/)
  assert.ok(source.includes('reset: () => void'))
  assert.ok(source.includes('onRetry={reset}'))
}

assert.ok(errorSource.includes('頁面暫時無法顯示'))
assert.ok(globalErrorSource.includes('網站暫時無法載入'))
assert.ok(globalErrorSource.includes('<html lang="zh-Hant">'))
assert.ok(globalErrorSource.includes('<body style={{ margin: 0 }}>'))
assert.ok(globalErrorSource.includes('<title>'))
assert.ok(globalErrorSource.includes('<main>'))

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
