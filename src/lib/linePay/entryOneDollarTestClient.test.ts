import assert from 'node:assert/strict'
import { test } from 'node:test'
import { checkLinePayEntryOneDollarTestAvailability } from './entryOneDollarTestClient'

test('returns true only for an authenticated enabled admin response', async () => {
  const calls: Array<{ url: string; init: RequestInit }> = []
  const available = await checkLinePayEntryOneDollarTestAvailability({
    getAccessToken: async () => 'synthetic-access-token',
    fetchStatus: async (url, init) => {
      calls.push({ url: String(url), init: init ?? {} })
      return Response.json({ ok: true, enabled: true })
    },
  })

  assert.equal(available, true)
  assert.equal(calls[0]?.url, '/api/admin/line-pay-entry-one-dollar-test')
  assert.equal(calls[0]?.init.cache, 'no-store')
  assert.equal(
    (calls[0]?.init.headers as Record<string, string>).Authorization,
    'Bearer synthetic-access-token',
  )
})

for (const [name, input] of [
  ['missing token', {
    getAccessToken: async () => null,
    fetchStatus: async () => Response.json({ ok: true, enabled: true }),
  }],
  ['non-admin response', {
    getAccessToken: async () => 'synthetic-access-token',
    fetchStatus: async () => Response.json(
      { ok: false, error: 'forbidden' },
      { status: 403 },
    ),
  }],
  ['disabled response', {
    getAccessToken: async () => 'synthetic-access-token',
    fetchStatus: async () => Response.json({ ok: true, enabled: false }),
  }],
] as const) {
  test(`${name} returns false`, async () => {
    assert.equal(
      await checkLinePayEntryOneDollarTestAvailability(input),
      false,
    )
  })
}

test('network or invalid JSON failures stay hidden', async () => {
  assert.equal(
    await checkLinePayEntryOneDollarTestAvailability({
      getAccessToken: async () => 'synthetic-access-token',
      fetchStatus: async () => {
        throw new Error('offline')
      },
    }),
    false,
  )
})
