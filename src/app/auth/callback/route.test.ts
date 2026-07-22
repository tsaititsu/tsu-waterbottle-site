import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildSameOriginReturnUrl } from '../../../lib/auth/returnTo'

const previewOrigin = 'https://tsu-waterbottle-site-example-tsaititsus-projects.vercel.app'
const productionOrigin = 'https://tsu-waterbottle.com'

assert.equal(
  buildSameOriginReturnUrl(previewOrigin, '/admin/bookings'),
  `${previewOrigin}/admin/bookings`,
)
assert.equal(
  buildSameOriginReturnUrl(productionOrigin, '/admin/orders'),
  `${productionOrigin}/admin/orders`,
)

for (const attack of [
  'https://evil.example',
  '//evil.example',
  String.raw`/\evil.example`,
  '/%5Cevil.example',
  '%2F%2Fevil.example',
  '%252F%252Fevil.example',
]) {
  const destination = new URL(buildSameOriginReturnUrl(previewOrigin, attack))
  assert.equal(destination.origin, previewOrigin)
  assert.equal(destination.pathname, '/account')
}

const source = readFileSync(join(process.cwd(), 'src/app/auth/callback/route.ts'), 'utf8')

assert.match(source, /import \{ buildSameOriginReturnUrl \} from ['"]@\/lib\/auth\/returnTo['"]/)
assert.match(
  source,
  /buildSameOriginReturnUrl\(\s*request\.nextUrl\.origin,\s*request\.nextUrl\.searchParams\.get\('next'\)/,
)
assert.doesNotMatch(source, /function sanitizeNextPath/)
assert.doesNotMatch(source, /NEXT_PUBLIC_SITE_URL/)
assert.match(source, /const GENERIC_AUTH_ERROR = '登入失敗，請重新登入。'/)
assert.match(source, /if \(oauthError\) return redirectWithError\(request, GENERIC_AUTH_ERROR\)/)
assert.match(source, /catch \{\s*return redirectWithError\(request, GENERIC_AUTH_ERROR\)/)
assert.match(source, /exchangeCodeForSession\(code\)/)
assert.match(source, /await syncProfile\(user\)/)

console.log('auth callback route contract tests passed')
