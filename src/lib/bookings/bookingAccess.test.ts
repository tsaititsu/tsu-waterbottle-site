import assert from 'node:assert/strict'
import { resolveBookingAccess } from './bookingAccess'

assert.deepEqual(
  resolveBookingAccess({ requester: null, booking: { userId: 'user-1' }, adminEmailsRaw: '' }),
  { allowed: false, status: 401 },
)
assert.deepEqual(
  resolveBookingAccess({ requester: { id: 'user-1', email: null }, booking: null, adminEmailsRaw: '' }),
  { allowed: false, status: 404 },
)
assert.deepEqual(
  resolveBookingAccess({
    requester: { id: 'user-1', email: 'member@example.com' },
    booking: { userId: 'user-1' },
    adminEmailsRaw: '',
  }),
  { allowed: true, isAdmin: false },
)
assert.deepEqual(
  resolveBookingAccess({
    requester: { id: 'other-user', email: 'other@example.com' },
    booking: { userId: 'user-1' },
    adminEmailsRaw: '',
  }),
  { allowed: false, status: 404 },
)
assert.deepEqual(
  resolveBookingAccess({
    requester: { id: 'admin-user', email: 'boss@example.com' },
    booking: { userId: 'user-1' },
    adminEmailsRaw: 'boss@example.com',
  }),
  { allowed: true, isAdmin: true },
)

console.log('bookingAccess tests passed')
