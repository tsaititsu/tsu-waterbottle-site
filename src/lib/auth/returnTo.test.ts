import assert from 'node:assert/strict'
import {
  buildSameOriginAuthCallbackUrl,
  buildSameOriginReturnUrl,
  DEFAULT_AUTH_RETURN_PATH,
  sanitizeAuthReturnPath,
} from './returnTo'

const acceptedPaths = [
  '/admin',
  '/admin/bookings',
  '/admin/bookings?status=paid',
  '/account',
  '/booking?step=payment',
]

for (const path of acceptedPaths) {
  assert.equal(sanitizeAuthReturnPath(path), path)
}

const rejectedValues: unknown[] = [
  'https://evil.example',
  'http://evil.example',
  '//evil.example',
  String.raw`/\evil.example`,
  String.raw`/\\evil.example`,
  '%2F%2Fevil.example',
  '%252F%252Fevil.example',
  '/%2F%2Fevil.example',
  '/%252F%252Fevil.example',
  '/%5Cevil.example',
  'javascript:alert(1)',
  'data:text/html,test',
  '/admin\r\nLocation: https://evil.example',
  '/admin%0d%0aLocation:%20https://evil.example',
  `/admin${String.fromCharCode(0)}evil`,
  `/admin${String.fromCharCode(0x85)}evil`,
  '',
  null,
  undefined,
  42,
  { path: '/admin' },
]

for (const value of rejectedValues) {
  assert.equal(sanitizeAuthReturnPath(value), DEFAULT_AUTH_RETURN_PATH)
}

assert.equal(sanitizeAuthReturnPath('/admin/bookings?status=paid#private'), '/admin/bookings?status=paid')
assert.equal(sanitizeAuthReturnPath('/admin/../account?tab=bookings'), '/account?tab=bookings')
assert.equal(sanitizeAuthReturnPath('//evil.example', '//also-evil.example'), DEFAULT_AUTH_RETURN_PATH)

const previewOrigin = 'https://tsu-waterbottle-site-example-tsaititsus-projects.vercel.app'
const previewCallback = new URL(buildSameOriginAuthCallbackUrl(previewOrigin, '/admin/bookings'))
assert.equal(previewCallback.origin, previewOrigin)
assert.equal(previewCallback.pathname, '/auth/callback')
assert.equal(previewCallback.searchParams.get('next'), '/admin/bookings')

const productionOrigin = 'https://tsu-waterbottle.com'
const productionCallback = new URL(buildSameOriginAuthCallbackUrl(productionOrigin, '/admin/orders'))
assert.equal(productionCallback.origin, productionOrigin)
assert.equal(productionCallback.searchParams.get('next'), '/admin/orders')

for (const value of rejectedValues) {
  const callback = new URL(buildSameOriginAuthCallbackUrl(previewOrigin, value))
  const destination = new URL(buildSameOriginReturnUrl(previewOrigin, value))

  assert.equal(callback.origin, previewOrigin)
  assert.equal(callback.searchParams.get('next'), DEFAULT_AUTH_RETURN_PATH)
  assert.equal(destination.origin, previewOrigin)
  assert.equal(destination.pathname, DEFAULT_AUTH_RETURN_PATH)
}

const safeDestination = new URL(
  buildSameOriginReturnUrl(previewOrigin, '/admin/bookings?status=paid#private'),
)
assert.equal(safeDestination.origin, previewOrigin)
assert.equal(safeDestination.pathname, '/admin/bookings')
assert.equal(safeDestination.search, '?status=paid')
assert.equal(safeDestination.hash, '')

console.log('auth returnTo tests passed')
