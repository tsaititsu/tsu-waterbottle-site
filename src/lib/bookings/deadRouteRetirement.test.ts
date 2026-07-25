import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const retiredRoutes = [
  'src/app/api/bookings/confirm-payment/route.ts',
  'src/app/api/calendar/test-event/route.ts',
]

for (const relativePath of retiredRoutes) {
  const source = readFileSync(join(root, relativePath), 'utf8')
  assert.doesNotMatch(source, /createBookingCalendarEvent|sendBookingConfirmationEmails/)
  assert.doesNotMatch(source, /process\.env|req\.json|request\.json/)
  assert.match(source, /status:\s*404/)
  assert.match(source, /message:\s*'Not found'/)
}

const checkoutSource = readFileSync(
  join(root, 'src/app/booking/checkout/page.tsx'),
  'utf8',
)
assert.match(checkoutSource, /notFound\(\)/)
assert.doesNotMatch(checkoutSource, /Mock Checkout|paymentId|fetch\(/)

console.log('booking external-side-effect dead route retirement contract passed')
