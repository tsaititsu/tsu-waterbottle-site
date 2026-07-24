import assert from 'node:assert/strict'
import {
  AdminQueryValidationError,
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
  from: null,
  to: null,
  status: null,
  offset: 0,
  rangeEnd: 19,
})
assert.deepEqual(parse('page=2&pageSize=50'), {
  page: 2,
  pageSize: 50,
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
  'page=1e2',
  'page=%2B1',
  'page=01',
  'pageSize=0',
  'pageSize=51',
  'pageSize=01',
  'q=Amy',
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

assert.equal(parse('page=&pageSize=').page, 1, '空值沿用預設頁碼')
assert.equal(parse('page=&pageSize=').pageSize, 20, '空值沿用預設頁數')

const lastLegalRange = parse('page=180143985094819&pageSize=50')
assert.equal(lastLegalRange.offset, 9007199254740900)
assert.equal(lastLegalRange.rangeEnd, 9007199254740949)
assertInvalid('page=180143985094820&pageSize=50')
assertInvalid('page=180143985094821&pageSize=50')
assertInvalid(`page=${Number.MAX_SAFE_INTEGER}&pageSize=50`)

const dated = parse('from=2026-07-01&to=2026-07-31&status=paid', ['paid', 'canceled'])
assert.equal(dated.from, '2026-07-01T00:00:00.000Z')
assert.equal(dated.to, '2026-07-31T23:59:59.999Z')
assert.equal(dated.status, 'paid')
assertInvalid('status=unknown', ['paid'])
assertInvalid('status=paid')

assert.equal(isValidAdminRecordId('11111111-2222-4333-8444-555555555555'), true)
assert.equal(isValidAdminRecordId('not-a-uuid'), false)
assert.equal(isValidAdminRecordId('11111111-2222-7333-8444-555555555555'), false)

console.log('✓ admin query validation tests passed')
