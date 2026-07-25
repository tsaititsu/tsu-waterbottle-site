import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { isTrustedPaidBooking } from '../../../lib/bookings/bookingSuccess'

assert.equal(isTrustedPaidBooking({ status: 'confirmed', paymentStatus: 'paid' }), true)
assert.equal(isTrustedPaidBooking({ status: 'pending_payment', paymentStatus: 'pending' }), false)
assert.equal(isTrustedPaidBooking({ status: 'confirmed', paymentStatus: 'pending' }), false)
assert.equal(isTrustedPaidBooking({ status: 'paid', paymentStatus: 'paid' }), false)

const source = readFileSync(join(process.cwd(), 'src/app/booking/success/page.tsx'), 'utf8')
assert.equal(source.includes("postJson('/api/bookings/update'"), false)
assert.equal(source.includes('mock-payment-'), false)
assert.equal(source.includes('paymentId: booking.paymentId'), false)
assert.equal(source.includes("postJson('/api/calendar/create-event', { bookingId: booking.id }, accessToken)"), true)
assert.equal(source.includes('付款確認中'), true)
assert.equal(source.includes('isTrustedPaidBooking(booking)'), true)
assert.equal(source.includes("const syncBookingIdRef = useRef('')"), true)
assert.equal(source.includes("syncBookingIdRef.current === booking.id"), true)
assert.equal(source.includes("syncBookingIdRef.current = booking.id"), true)
assert.equal(source.includes("setBooking(null)"), true)
assert.equal(source.includes("setLoadStatus('loading')"), true)
assert.equal(source.includes('subscribeAuthChange'), true)
assert.equal(source.includes('createAsyncIdentityGuard'), true)
assert.equal(source.includes('requestGuard.isCurrent(requestToken, currentIdentity())'), true)
assert.ok(
  source.lastIndexOf('requestGuard.isCurrent(requestToken, currentIdentity())') >
    source.indexOf("postJson('/api/email/send-booking-confirmation'"),
  'identity must still be current after the last external synchronization',
)

console.log('booking success tests passed')
