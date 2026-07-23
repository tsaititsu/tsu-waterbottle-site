import assert from 'node:assert/strict'
import {
  AdminQueryValidationError,
  escapeLikePattern,
  isValidAdminRecordId,
  parseAdminListQuery,
} from './query'

function parse(query = '', statuses: readonly string[] = []) {
  return parseAdminListQuery(new URLSearchParams(query), { allowedStatuses: statuses })
}

function assertInvalid(query: string, statuses: readonly string[] = []) {
  assert.throws(() => parse(query, statuses), AdminQueryValidationError)
}

assert.deepEqual(parse(), {
  page: 1,
  pageSize: 20,
  q: '',
  from: null,
  to: null,
  status: null,
  offset: 0,
  rangeEnd: 19,
})
assert.deepEqual(parse('page=2&pageSize=50&q=%20Amy%20'), {
  page: 2,
  pageSize: 50,
  q: 'Amy',
  from: null,
  to: null,
  status: null,
  offset: 50,
  rangeEnd: 99,
})

for (const invalid of [
  'page=0',
  'page=-1',
  'page=1.5',
  'pageSize=0',
  'pageSize=51',
  `q=${'a'.repeat(101)}`,
  'from=2026-02-30',
  'to=2026-13-01',
  'from=2026-07-01',
  'to=2026-07-31',
  'from=2026-07-02&to=2026-07-01',
  'from=2025-01-01&to=2026-01-02',
  'sort=created_at',
  'table=profiles',
  'unexpected=value',
  'page=1&page=2',
]) {
  assertInvalid(invalid)
}

const dated = parse('from=2026-07-01&to=2026-07-31&status=paid', ['paid', 'canceled'])
assert.equal(dated.from, '2026-07-01T00:00:00.000Z')
assert.equal(dated.to, '2026-07-31T23:59:59.999Z')
assert.equal(dated.status, 'paid')
assertInvalid('status=unknown', ['paid'])
assertInvalid('status=paid')

assert.equal(escapeLikePattern('100%_safe\\value'), '100\\%\\_safe\\\\value')
assert.equal(isValidAdminRecordId('11111111-2222-4333-8444-555555555555'), true)
assert.equal(isValidAdminRecordId('not-a-uuid'), false)
assert.equal(isValidAdminRecordId('11111111-2222-7333-8444-555555555555'), false)

console.log('✓ admin query validation tests passed')
