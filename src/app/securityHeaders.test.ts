import assert from 'node:assert/strict'
import nextConfig from '../../next.config'
import {
  CONTENT_SECURITY_POLICY_REPORT_ONLY,
  createContentSecurityPolicyReportOnly,
  SECURITY_HEADERS,
} from '../lib/security/securityHeaders'

const headersByKey = new Map(SECURITY_HEADERS.map((header) => [header.key, header.value]))

assert.equal(headersByKey.get('X-Content-Type-Options'), 'nosniff')
assert.equal(headersByKey.get('Referrer-Policy'), 'strict-origin-when-cross-origin')
assert.equal(
  headersByKey.get('Permissions-Policy'),
  'camera=(), microphone=(), geolocation=(), browsing-topics=()',
)
assert.equal(headersByKey.get('X-Frame-Options'), 'SAMEORIGIN')
assert.equal(nextConfig.poweredByHeader, false)
assert.equal('redirects' in nextConfig, false)
assert.equal('rewrites' in nextConfig, false)
assert.equal('images' in nextConfig, false)

async function assertConfiguredRoutes() {
  assert.equal(typeof nextConfig.headers, 'function')
  const configuredRoutes = await nextConfig.headers?.()
  assert.deepEqual(configuredRoutes, [
    {
      source: '/:path*',
      headers: SECURITY_HEADERS,
    },
  ])
}

assert.equal(SECURITY_HEADERS.filter((header) => header.key === 'Content-Security-Policy').length, 0)
assert.equal(
  SECURITY_HEADERS.filter((header) => header.key === 'Content-Security-Policy-Report-Only').length,
  1,
)
assert.equal(SECURITY_HEADERS.some((header) => header.key === 'Strict-Transport-Security'), false)
assert.equal(createContentSecurityPolicyReportOnly(), CONTENT_SECURITY_POLICY_REPORT_ONLY)

assert.equal(CONTENT_SECURITY_POLICY_REPORT_ONLY.includes('\n'), false)
assert.equal(CONTENT_SECURITY_POLICY_REPORT_ONLY.includes('\r'), false)
assert.equal(CONTENT_SECURITY_POLICY_REPORT_ONLY.includes('  '), false)

const directiveEntries = CONTENT_SECURITY_POLICY_REPORT_ONLY.split(';').map((entry) => entry.trim())
assert.equal(directiveEntries.some((entry) => entry.length === 0), false)

const directives = new Map(
  directiveEntries.map((entry) => {
    const [directive, ...sources] = entry.split(' ')
    return [directive, sources]
  }),
)

assert.equal(directives.size, directiveEntries.length)
assert.deepEqual(directives.get('default-src'), ["'self'"])
assert.deepEqual(directives.get('base-uri'), ["'self'"])
assert.deepEqual(directives.get('object-src'), ["'none'"])
assert.deepEqual(directives.get('frame-ancestors'), ["'self'"])
assert.deepEqual(directives.get('script-src'), [
  "'self'",
  "'unsafe-inline'",
  'https://www.googletagmanager.com',
])
assert.deepEqual(directives.get('style-src'), ["'self'", "'unsafe-inline'"])
assert.deepEqual(directives.get('img-src'), [
  "'self'",
  'data:',
  'blob:',
  'https://www.google-analytics.com',
  'https://region1.google-analytics.com',
  'https://www.googletagmanager.com',
])
assert.deepEqual(directives.get('font-src'), ["'self'", 'data:'])
assert.deepEqual(directives.get('connect-src'), [
  "'self'",
  'https://www.google-analytics.com',
  'https://region1.google-analytics.com',
  'https://www.googletagmanager.com',
  'https://ndbqoznvobmpkgxkiezz.supabase.co',
  'wss://ndbqoznvobmpkgxkiezz.supabase.co',
])
assert.deepEqual(directives.get('form-action'), [
  "'self'",
  'https://core.newebpay.com',
  'https://ccore.newebpay.com',
])
assert.deepEqual(directives.get('frame-src'), ["'self'"])
assert.deepEqual(directives.get('worker-src'), ["'self'", 'blob:'])
assert.deepEqual(directives.get('media-src'), ["'self'", 'blob:'])
assert.deepEqual(directives.get('manifest-src'), ["'self'"])

const headerKeys = SECURITY_HEADERS.map((header) => header.key.toLowerCase())
assert.equal(new Set(headerKeys).size, headerKeys.length)

for (const forbiddenValue of [
  'localhost',
  '127.0.0.1',
  'vercel.app',
  "'unsafe-eval'",
  'script-src *',
  'connect-src *',
  'default-src *',
  'http:',
  'API key',
  'Bearer',
  'service_role',
  'anon key',
  'report-uri',
  'report-to',
  'Reporting-Endpoints',
]) {
  assert.equal(CONTENT_SECURITY_POLICY_REPORT_ONLY.includes(forbiddenValue), false)
}

assert.equal(CONTENT_SECURITY_POLICY_REPORT_ONLY.includes('*.supabase.co'), false)

void assertConfiguredRoutes()
  .then(() => {
    console.log('Security headers tests passed')
  })
  .catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
