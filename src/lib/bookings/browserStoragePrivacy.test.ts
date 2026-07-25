import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const piiViews = [
  'src/components/BookingForm.tsx',
  'src/app/account/bookings/page.tsx',
  'src/app/booking/success/page.tsx',
]

for (const relativePath of piiViews) {
  const source = readFileSync(join(root, relativePath), 'utf8')
  assert.doesNotMatch(source, /localStorage|sessionStorage|mockBooking/)
}

assert.equal(existsSync(join(root, 'src/lib/mockBooking.ts')), false)

console.log('booking browser storage privacy contract passed')
