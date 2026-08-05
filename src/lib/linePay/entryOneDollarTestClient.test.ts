import assert from 'node:assert/strict'
import { checkLinePayEntryOneDollarTestAvailability } from './entryOneDollarTestClient'

async function runTests() {
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

  for (const input of [
    {
      getAccessToken: async () => null,
      fetchStatus: async () => Response.json({ ok: true, enabled: true }),
    },
    {
      getAccessToken: async () => 'synthetic-access-token',
      fetchStatus: async () => Response.json(
        { ok: false, error: 'forbidden' },
        { status: 403 },
      ),
    },
    {
      getAccessToken: async () => 'synthetic-access-token',
      fetchStatus: async () => Response.json({ ok: true, enabled: false }),
    },
  ] as const) {
    assert.equal(
      await checkLinePayEntryOneDollarTestAvailability(input),
      false,
    )
  }

  assert.equal(
    await checkLinePayEntryOneDollarTestAvailability({
      getAccessToken: async () => 'synthetic-access-token',
      fetchStatus: async () => {
        throw new Error('offline')
      },
    }),
    false,
  )

  console.log('LINE Pay entry NT$1 availability client tests passed')
}

void runTests()
