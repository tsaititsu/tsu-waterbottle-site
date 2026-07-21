import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { POST } from './route'

const root = process.cwd()
const routeSource = readFileSync(join(root, 'src/app/api/bank-transfer/submit/route.ts'), 'utf8')
const expectedBody = {
  ok: false,
  code: 'bank_transfer_retired',
  message: '銀行匯款付款方式已停止使用，請改用網站提供的線上付款方式。',
}

async function assertRetiredResponse(response: Response) {
  assert.equal(response.status, 410)
  assert.deepEqual(await response.json(), expectedBody)
}

async function run() {
  await assertRetiredResponse(await POST())

  const unauthenticatedRequest = new Request('https://example.test/api/bank-transfer/submit', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ bankAccountLast5: '12345' }),
  })
  await assertRetiredResponse(await Reflect.apply(POST, undefined, [unauthenticatedRequest]))

  const malformedBodyRequest = new Request('https://example.test/api/bank-transfer/submit', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{malformed',
  })
  await assertRetiredResponse(await Reflect.apply(POST, undefined, [malformedBodyRequest]))

  for (const forbiddenSource of [
    '@/lib/supabase/admin',
    '@/lib/supabase/auth',
    'getSupabaseAdmin',
    'hasSupabaseAdminConfig',
    'getUserIdFromRequest',
    'request.json',
    '.from(',
    '.insert(',
    'bank_transfer_submissions',
  ]) {
    assert.equal(routeSource.includes(forbiddenSource), false, forbiddenSource)
  }

  console.log('✓ bank transfer submission API permanently returns 410 without reads or writes')
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
