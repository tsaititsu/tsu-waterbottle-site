import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const source = readFileSync(join(process.cwd(), 'src/app/account/bookings/page.tsx'), 'utf8')

assert.match(source, /const loadRequestGenerationRef = useRef\(0\)/)
assert.match(source, /const requestGeneration = \+\+loadRequestGenerationRef\.current/)
assert.match(source, /requestGeneration !== loadRequestGenerationRef\.current/)
assert.match(source, /requestGeneration === loadRequestGenerationRef\.current/)
assert.match(source, /if \(nextUser\) void loadBookings\(requestGeneration\)/)
assert.match(source, /loadBookings\(loadRequestGenerationRef\.current, bookings\.length\)/)
assert.match(source, /bookings\.length < totalBookings/)
assert.match(source, /載入更多預約/)
assert.match(source, /setBookings\(\[\]\)/)
assert.match(source, /loadRequestGenerationRef\.current \+= 1/)
assert.match(source, /const requestToken = cancelGuard\.begin\(currentIdentity\(\)\)/)
assert.match(source, /cancelGuard\.isCurrent\(requestToken, currentIdentity\(\)\)/)
assert.equal(
  source.match(/getAuthAccessToken\(\)/g)?.length,
  2,
  'list load and cancellation each capture one token; follow-up side effects must reuse the captured cancellation token',
)

assert.ok(
  source.indexOf('setBookings([])') < source.indexOf('if (nextUser) void loadBookings(requestGeneration)'),
  'auth identity changes must clear the previous member booking records before loading the next identity',
)

assert.ok(
  source.indexOf('try {', source.indexOf('async function cancelBooking')) <
    source.indexOf('await getAuthAccessToken()', source.indexOf('async function cancelBooking')),
  'token acquisition must be caught so cancellation cannot remain permanently pending',
)

console.log('account bookings request identity contract passed')
