import assert from 'node:assert/strict'
import {
  createAdminPageAccessController,
  type AdminPageAccessSnapshot,
} from './adminPageAccess'
import type { UserProfile } from './types'

const tests: Array<{ name: string; run: () => Promise<void> | void }> = []
function test(name: string, run: () => Promise<void> | void) {
  tests.push({ name, run })
}

const userA: UserProfile = {
  id: 'user-a',
  provider: 'google',
  displayName: 'Synthetic A',
  createdAt: '2026-01-01T00:00:00.000Z',
  lastLoginAt: '2026-01-01T00:00:00.000Z',
}
const userB: UserProfile = { ...userA, id: 'user-b', displayName: 'Synthetic B' }

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

function response(status: number, payload: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  }
}

test('slow old 200 cannot overwrite fast 403', async () => {
  const oldResponse = deferred<ReturnType<typeof response>>()
  const snapshots: AdminPageAccessSnapshot[] = []
  let calls = 0
  const controller = createAdminPageAccessController({
    getAccessToken: async () => 'synthetic-token',
    fetchSession: async () => {
      calls += 1
      return calls === 1
        ? oldResponse.promise
        : response(403, { ok: false, isAdmin: false })
    },
  }, (snapshot) => snapshots.push(snapshot))

  const oldRun = controller.run(userA)
  await controller.run(userA)
  assert.equal(snapshots.at(-1)?.state, 'forbidden')

  oldResponse.resolve(response(200, { ok: true, isAdmin: true }))
  await oldRun
  assert.equal(snapshots.at(-1)?.state, 'forbidden')
})

test('logout revokes authorized immediately and ignores old success', async () => {
  const oldResponse = deferred<ReturnType<typeof response>>()
  const snapshots: AdminPageAccessSnapshot[] = []
  const controller = createAdminPageAccessController({
    getAccessToken: async () => 'synthetic-token',
    fetchSession: async () => oldResponse.promise,
  }, (snapshot) => snapshots.push(snapshot))

  const oldRun = controller.run(userA)
  await controller.run(null)
  assert.equal(snapshots.at(-1)?.state, 'unauthenticated')

  oldResponse.resolve(response(200, { ok: true, isAdmin: true }))
  await oldRun
  assert.equal(snapshots.at(-1)?.state, 'unauthenticated')
})

test('user A slow success cannot authorize denied user B', async () => {
  const oldResponse = deferred<ReturnType<typeof response>>()
  const snapshots: AdminPageAccessSnapshot[] = []
  let calls = 0
  const controller = createAdminPageAccessController({
    getAccessToken: async () => 'synthetic-token',
    fetchSession: async () => {
      calls += 1
      return calls === 1 ? oldResponse.promise : response(401, { ok: false })
    },
  }, (snapshot) => snapshots.push(snapshot))

  const userARun = controller.run(userA)
  await controller.run(userB)
  assert.equal(snapshots.at(-1)?.state, 'unauthenticated')
  assert.equal(snapshots.at(-1)?.subjectKey, 'google:user-b')

  oldResponse.resolve(response(200, { ok: true, isAdmin: true }))
  await userARun
  assert.equal(snapshots.at(-1)?.state, 'unauthenticated')
})

test('active auth change immediately publishes checking and hides prior authorization', async () => {
  const snapshots: AdminPageAccessSnapshot[] = []
  const pending = deferred<ReturnType<typeof response>>()
  let calls = 0
  const controller = createAdminPageAccessController({
    getAccessToken: async () => 'synthetic-token',
    fetchSession: async () => {
      calls += 1
      return calls === 1
        ? response(200, { ok: true, isAdmin: true })
        : pending.promise
    },
  }, (snapshot) => snapshots.push(snapshot))

  await controller.run(userA)
  assert.equal(snapshots.at(-1)?.state, 'authorized')

  const nextRun = controller.run(userA)
  assert.equal(snapshots.at(-1)?.state, 'checking')
  pending.resolve(response(403, { ok: false }))
  await nextRun
})

test('cancel aborts and invalidates without publishing after cleanup', async () => {
  const pending = deferred<ReturnType<typeof response>>()
  const snapshots: AdminPageAccessSnapshot[] = []
  const controller = createAdminPageAccessController({
    getAccessToken: async () => 'synthetic-token',
    fetchSession: async (_input, init) => {
      assert.equal(init.signal instanceof AbortSignal, true)
      return pending.promise
    },
  }, (snapshot) => snapshots.push(snapshot))

  const run = controller.run(userA)
  const publishedBeforeCancel = snapshots.length
  controller.cancel()
  pending.resolve(response(200, { ok: true, isAdmin: true }))
  await run
  assert.equal(snapshots.length, publishedBeforeCancel)
})

test('malformed 200 payload is forbidden', async () => {
  for (const payload of [
    null,
    {},
    { ok: true },
    { isAdmin: true },
    { ok: true, isAdmin: 'true' },
    { ok: true, isAdmin: true, extra: true },
  ]) {
    const snapshots: AdminPageAccessSnapshot[] = []
    const controller = createAdminPageAccessController({
      getAccessToken: async () => 'synthetic-token',
      fetchSession: async () => response(200, payload),
    }, (snapshot) => snapshots.push(snapshot))
    await controller.run(userA)
    assert.equal(snapshots.at(-1)?.state, 'forbidden')
  }
})

test('missing token is unauthenticated and skips session fetch', async () => {
  const snapshots: AdminPageAccessSnapshot[] = []
  let fetchCalls = 0
  const controller = createAdminPageAccessController({
    getAccessToken: async () => null,
    fetchSession: async () => {
      fetchCalls += 1
      return response(200, { ok: true, isAdmin: true })
    },
  }, (snapshot) => snapshots.push(snapshot))

  await controller.run(userA)
  assert.equal(snapshots.at(-1)?.state, 'unauthenticated')
  assert.equal(fetchCalls, 0)
})

test('aborted response cannot change the latest snapshot', async () => {
  const oldResponse = deferred<ReturnType<typeof response>>()
  const snapshots: AdminPageAccessSnapshot[] = []
  let calls = 0
  const controller = createAdminPageAccessController({
    getAccessToken: async () => 'synthetic-token',
    fetchSession: async () => {
      calls += 1
      return calls === 1
        ? oldResponse.promise
        : response(403, { ok: false })
    },
  }, (snapshot) => snapshots.push(snapshot))

  const oldRun = controller.run(userA)
  await controller.run(userB)
  const latest = snapshots.at(-1)
  oldResponse.resolve(response(200, { ok: true, isAdmin: true }))
  await oldRun
  assert.deepEqual(snapshots.at(-1), latest)
})

async function main() {
  for (const current of tests) {
    await current.run()
    console.log(`✓ ${current.name}`)
  }
  console.log(`admin page access controller tests passed (${tests.length} cases)`)
}

void main()
