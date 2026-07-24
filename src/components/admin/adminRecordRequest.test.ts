import assert from 'node:assert/strict'
import {
  createAdminRecordRequestController,
  type AdminRecordRequestSnapshot,
} from './adminRecordRequest'

type SyntheticUser = {
  id: string
  provider: 'google'
}

type SyntheticResult =
  | { state: 'authorized'; value: string }
  | { state: 'forbidden' }

type SyntheticResponse = {
  ok: boolean
  status: number
  json: () => Promise<unknown>
}

const userA: SyntheticUser = { id: 'user-a', provider: 'google' }
const userB: SyntheticUser = { id: 'user-b', provider: 'google' }

const tests: Array<{ name: string; run: () => Promise<void> }> = []
function test(name: string, run: () => Promise<void>) {
  tests.push({ name, run })
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

function response(status: number, body: unknown): SyntheticResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }
}

function classifyResponse(
  currentResponse: SyntheticResponse,
  body: unknown,
): SyntheticResult {
  if (currentResponse.status === 401 || currentResponse.status === 403) {
    return { state: 'forbidden' }
  }
  if (
    !currentResponse.ok ||
    typeof body !== 'object' ||
    body === null ||
    Array.isArray(body)
  ) {
    return { state: 'forbidden' }
  }

  const record = body as Record<string, unknown>
  if (
    Object.keys(record).sort().join(',') !== 'ok,value' ||
    record.ok !== true ||
    typeof record.value !== 'string'
  ) {
    return { state: 'forbidden' }
  }
  return { state: 'authorized', value: record.value }
}

test('stale token cannot issue a request or publish after a newer generation', async () => {
  let currentUser: SyntheticUser | null = userA
  const oldToken = deferred<string | null>()
  const snapshots: AdminRecordRequestSnapshot<SyntheticResult>[] = []
  const requestedTokens: string[] = []
  let tokenCalls = 0
  const controller = createAdminRecordRequestController<SyntheticResult>({
    getCurrentUser: () => currentUser,
    getAccessToken: async () => {
      tokenCalls += 1
      return tokenCalls === 1 ? oldToken.promise : 'token-b'
    },
    fetchResponse: async (token) => {
      requestedTokens.push(token)
      return response(200, { ok: true, value: 'new-result' })
    },
    classifyResponse,
  }, (snapshot) => snapshots.push(snapshot))

  const oldRun = controller.run(userA)
  currentUser = userB
  await controller.run(userB)
  const latestSnapshot = snapshots.at(-1)

  oldToken.resolve('token-a')
  await oldRun

  assert.deepEqual(requestedTokens, ['token-b'])
  assert.deepEqual(snapshots.at(-1), latestSnapshot)
  assert.equal(snapshots.at(-1)?.subjectKey, 'google:user-b')
})

test('unmount during token await aborts and prevents request or state updates', async () => {
  let currentUser: SyntheticUser | null = userA
  const token = deferred<string | null>()
  const snapshots: AdminRecordRequestSnapshot<SyntheticResult>[] = []
  let fetchCalls = 0
  const controller = createAdminRecordRequestController<SyntheticResult>({
    getCurrentUser: () => currentUser,
    getAccessToken: async () => token.promise,
    fetchResponse: async () => {
      fetchCalls += 1
      return response(200, { ok: true, value: 'old-result' })
    },
    classifyResponse,
  }, (snapshot) => snapshots.push(snapshot))

  const run = controller.run(userA)
  const snapshotsBeforeUnmount = snapshots.length
  controller.cancel()
  currentUser = null
  token.resolve('token-a')
  await run

  assert.equal(fetchCalls, 0)
  assert.equal(snapshots.length, snapshotsBeforeUnmount)
})

test('logout immediately revokes state and old token cannot restore data', async () => {
  let currentUser: SyntheticUser | null = userA
  const token = deferred<string | null>()
  const snapshots: AdminRecordRequestSnapshot<SyntheticResult>[] = []
  let fetchCalls = 0
  const controller = createAdminRecordRequestController<SyntheticResult>({
    getCurrentUser: () => currentUser,
    getAccessToken: async () => token.promise,
    fetchResponse: async () => {
      fetchCalls += 1
      return response(200, { ok: true, value: 'old-result' })
    },
    classifyResponse,
  }, (snapshot) => snapshots.push(snapshot))

  const oldRun = controller.run(userA)
  currentUser = null
  await controller.run(null)
  assert.equal(snapshots.at(-1)?.state, 'unauthorized')

  token.resolve('token-a')
  await oldRun
  assert.equal(fetchCalls, 0)
  assert.equal(snapshots.at(-1)?.state, 'unauthorized')
})

test('new 403 wins over an older token and older success', async () => {
  let currentUser: SyntheticUser | null = userA
  const oldToken = deferred<string | null>()
  const snapshots: AdminRecordRequestSnapshot<SyntheticResult>[] = []
  let tokenCalls = 0
  const controller = createAdminRecordRequestController<SyntheticResult>({
    getCurrentUser: () => currentUser,
    getAccessToken: async () => {
      tokenCalls += 1
      return tokenCalls === 1 ? oldToken.promise : 'token-b'
    },
    fetchResponse: async (token) =>
      token === 'token-b'
        ? response(403, { ok: false })
        : response(200, { ok: true, value: 'old-result' }),
    classifyResponse,
  }, (snapshot) => snapshots.push(snapshot))

  const oldRun = controller.run(userA)
  currentUser = userB
  await controller.run(userB)
  assert.deepEqual(snapshots.at(-1)?.result, { state: 'forbidden' })

  oldToken.resolve('token-a')
  await oldRun
  assert.deepEqual(snapshots.at(-1)?.result, { state: 'forbidden' })
  assert.equal(snapshots.at(-1)?.subjectKey, 'google:user-b')
})

test('subject identity change invalidates an in-flight response', async () => {
  let currentUser: SyntheticUser | null = userA
  const oldResponse = deferred<SyntheticResponse>()
  const snapshots: AdminRecordRequestSnapshot<SyntheticResult>[] = []
  const controller = createAdminRecordRequestController<SyntheticResult>({
    getCurrentUser: () => currentUser,
    getAccessToken: async () => 'token-a',
    fetchResponse: async () => oldResponse.promise,
    classifyResponse,
  }, (snapshot) => snapshots.push(snapshot))

  const oldRun = controller.run(userA)
  await Promise.resolve()
  currentUser = userB
  const snapshotBeforeOldResponse = snapshots.at(-1)
  oldResponse.resolve(response(200, { ok: true, value: 'old-result' }))
  await oldRun

  assert.deepEqual(snapshots.at(-1), snapshotBeforeOldResponse)
  assert.equal(
    snapshots.some(
      (snapshot) =>
        snapshot.state === 'result' &&
        snapshot.result.state === 'authorized' &&
        snapshot.result.value === 'old-result',
    ),
    false,
  )
})

test('only the latest generation can finish loading', async () => {
  let currentUser: SyntheticUser | null = userA
  const oldToken = deferred<string | null>()
  const snapshots: AdminRecordRequestSnapshot<SyntheticResult>[] = []
  let tokenCalls = 0
  const controller = createAdminRecordRequestController<SyntheticResult>({
    getCurrentUser: () => currentUser,
    getAccessToken: async () => {
      tokenCalls += 1
      return tokenCalls === 1 ? oldToken.promise : 'token-b'
    },
    fetchResponse: async () => response(200, { ok: true, value: 'new-result' }),
    classifyResponse,
  }, (snapshot) => snapshots.push(snapshot))

  const oldRun = controller.run(userA)
  currentUser = userB
  await controller.run(userB)
  const snapshotsAfterNewResult = snapshots.length
  oldToken.resolve('token-a')
  await oldRun

  assert.equal(snapshots.length, snapshotsAfterNewResult)
  assert.deepEqual(
    snapshots.map((snapshot) => [snapshot.state, snapshot.subjectKey]),
    [
      ['loading', 'google:user-a'],
      ['loading', 'google:user-b'],
      ['result', 'google:user-b'],
    ],
  )
})

test('malformed 200 remains fail-closed', async () => {
  for (const payload of [
    null,
    {},
    { ok: true },
    { ok: true, value: 42 },
    { ok: true, value: 'synthetic', extra: true },
  ]) {
    let currentUser: SyntheticUser | null = userA
    const snapshots: AdminRecordRequestSnapshot<SyntheticResult>[] = []
    const controller = createAdminRecordRequestController<SyntheticResult>({
      getCurrentUser: () => currentUser,
      getAccessToken: async () => 'token-a',
      fetchResponse: async () => response(200, payload),
      classifyResponse,
    }, (snapshot) => snapshots.push(snapshot))

    await controller.run(userA)
    assert.deepEqual(snapshots.at(-1)?.result, { state: 'forbidden' })
    controller.cancel()
    currentUser = null
  }
})

async function main() {
  for (const currentTest of tests) {
    await currentTest.run()
    console.log(`✓ ${currentTest.name}`)
  }
  console.log(`admin record request controller tests passed (${tests.length} cases)`)
}

void main()
