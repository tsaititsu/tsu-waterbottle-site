import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const modalSource = readFileSync(join(process.cwd(), 'src/components/LoginModal.tsx'), 'utf8')
const authSource = readFileSync(join(process.cwd(), 'src/lib/mockAuth.ts'), 'utf8')

assert.match(modalSource, /returnTo\?: string/)
assert.match(modalSource, /await loginWithProvider\(provider, returnTo\)/)
assert.match(modalSource, /onClick=\{\(\) => handleLogin\('line'\)\}/)
assert.match(modalSource, /onClick=\{\(\) => handleLogin\('google'\)\}/)
assert.equal(modalSource.match(/loginWithProvider\(/g)?.length, 1)
assert.doesNotMatch(modalSource, /localStorage|sessionStorage|https?:\/\//)

assert.match(authSource, /loginWithProvider\(provider: 'line' \| 'google', returnTo\?: string\)/)
assert.match(authSource, /loginWithLine\(returnTo\?: string\)/)
assert.match(authSource, /returnTo \?\? currentPath/)
assert.match(authSource, /sanitizeAuthReturnPath\(returnTo \?\? currentPath\)/)
assert.match(
  authSource,
  /buildSameOriginAuthCallbackUrl\(window\.location\.origin, safeReturnPath\)/,
)
assert.match(authSource, /loginWithLine\(safeReturnPath\)/)
assert.doesNotMatch(authSource, /NEXT_PUBLIC_SITE_URL/)
assert.equal(authSource.match(/buildSameOriginAuthCallbackUrl\(/g)?.length, 2)

console.log('LoginModal auth return contract tests passed')
