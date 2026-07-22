import assert from 'node:assert/strict'
import {
  beginAdminMenuAccessCheck,
  canShowAdminMenu,
  completeAdminMenuAccessCheck,
  verifyAdminMenuAccess,
  type VerifyAdminMenuAccessDeps,
} from './adminMenuAccess'
import type { UserProfile } from './types'

const tests: Array<{ name: string; fn: () => Promise<void> | void }> = []

function test(name: string, fn: () => Promise<void> | void) {
  tests.push({ name, fn })
}

const googleUser: UserProfile = {
  id: 'google-user-1',
  provider: 'google',
  displayName: 'Synthetic Google Member',
  createdAt: '2026-01-01T00:00:00.000Z',
  lastLoginAt: '2026-01-01T00:00:00.000Z',
}

const secondGoogleUser: UserProfile = {
  ...googleUser,
  id: 'google-user-2',
}

const lineUser: UserProfile = {
  ...googleUser,
  id: 'line-user-1',
  provider: 'line',
}

const linkedIdentityUser: UserProfile = {
  ...lineUser,
  id: 'linked-identity-user-1',
  displayName: 'Synthetic Linked Identity Member',
}

type FetchCall = { input: string; init: RequestInit }

function makeDeps(input: {
  token?: string | null
  response?: { ok: boolean; payload?: unknown; jsonError?: Error }
  fetchError?: Error
}) {
  const calls: FetchCall[] = []
  let tokenCalls = 0

  const deps: VerifyAdminMenuAccessDeps = {
    getAccessToken: async () => {
      tokenCalls += 1
      return input.token ?? null
    },
    fetchSession: async (requestInput, init) => {
      calls.push({ input: requestInput, init })
      if (input.fetchError) throw input.fetchError

      return {
        ok: input.response?.ok ?? true,
        json: async () => {
          if (input.response?.jsonError) throw input.response.jsonError
          return input.response?.payload
        },
      }
    },
  }

  return { deps, calls, getTokenCalls: () => tokenCalls }
}

test('未登入時保持 idle，且不取得 token 或呼叫 admin session', async () => {
  const context = makeDeps({ token: 'unused-token' })

  assert.equal(await verifyAdminMenuAccess(null, context.deps), 'idle')
  assert.equal(context.getTokenCalls(), 0)
  assert.equal(context.calls.length, 0)
})

test('任一已登入 UserProfile 都先進入 checking，不以 provider 字串直接 denied', () => {
  assert.equal(beginAdminMenuAccessCheck(googleUser, 1).state, 'checking')
  assert.equal(beginAdminMenuAccessCheck(lineUser, 2).state, 'checking')
})

test('provider=line 且 token 缺失時 denied，且不呼叫 admin session', async () => {
  const context = makeDeps({ token: null })

  assert.equal(await verifyAdminMenuAccess(lineUser, context.deps), 'denied')
  assert.equal(context.getTokenCalls(), 1)
  assert.equal(context.calls.length, 0)
})

test('provider=line 且 server 回 403 時 denied', async () => {
  const context = makeDeps({
    token: 'synthetic-line-access-token',
    response: { ok: false, payload: { ok: false } },
  })

  assert.equal(await verifyAdminMenuAccess(lineUser, context.deps), 'denied')
  assert.equal(context.getTokenCalls(), 1)
  assert.equal(context.calls.length, 1)
})

test('provider=line 但 server 明確 authorized 時可顯示入口', async () => {
  const context = makeDeps({
    token: 'synthetic-linked-access-token',
    response: { ok: true, payload: { ok: true, isAdmin: true } },
  })

  assert.equal(await verifyAdminMenuAccess(linkedIdentityUser, context.deps), 'authorized')
  assert.equal(context.getTokenCalls(), 1)
  assert.equal(context.calls.length, 1)
})

test('Google 會員使用 Bearer token 呼叫固定 admin session endpoint', async () => {
  const context = makeDeps({
    token: 'synthetic-access-token',
    response: { ok: true, payload: { ok: true, isAdmin: true } },
  })

  assert.equal(await verifyAdminMenuAccess(googleUser, context.deps), 'authorized')
  assert.equal(context.getTokenCalls(), 1)
  assert.equal(context.calls.length, 1)
  assert.equal(context.calls[0]?.input, '/api/admin/session')
  assert.deepEqual(context.calls[0]?.init.headers, {
    Authorization: 'Bearer synthetic-access-token',
  })
})

test('admin session request 一律使用 no-store', async () => {
  const context = makeDeps({
    token: 'synthetic-access-token',
    response: { ok: true, payload: { ok: true, isAdmin: true } },
  })

  await verifyAdminMenuAccess(googleUser, context.deps)
  assert.equal(context.calls[0]?.init.cache, 'no-store')
})

test('只有 200 ok 與明確 admin payload 才 authorized', async () => {
  const context = makeDeps({
    token: 'synthetic-access-token',
    response: { ok: true, payload: { ok: true, isAdmin: true } },
  })

  assert.equal(await verifyAdminMenuAccess(googleUser, context.deps), 'authorized')
})

test('200 的非預期 payload 一律 denied', async () => {
  const payloads = [
    null,
    {},
    { ok: true },
    { isAdmin: true },
    { ok: false, isAdmin: true },
    { ok: true, isAdmin: false },
    { ok: 'true', isAdmin: true },
  ]

  for (const payload of payloads) {
    const context = makeDeps({
      token: 'synthetic-access-token',
      response: { ok: true, payload },
    })
    assert.equal(await verifyAdminMenuAccess(googleUser, context.deps), 'denied')
  }
})

for (const status of [401, 403, 500]) {
  test(`${status} 回應一律 denied`, async () => {
    const context = makeDeps({
      token: 'synthetic-access-token',
      response: { ok: false, payload: { ok: false, status } },
    })

    assert.equal(await verifyAdminMenuAccess(googleUser, context.deps), 'denied')
  })
}

test('network error 一律 denied', async () => {
  const context = makeDeps({
    token: 'synthetic-access-token',
    fetchError: new Error('synthetic network failure'),
  })

  assert.equal(await verifyAdminMenuAccess(googleUser, context.deps), 'denied')
})

test('malformed JSON 一律 denied', async () => {
  const context = makeDeps({
    token: 'synthetic-access-token',
    response: {
      ok: true,
      jsonError: new SyntaxError('synthetic malformed json'),
    },
  })

  assert.equal(await verifyAdminMenuAccess(googleUser, context.deps), 'denied')
})

test('token 缺失時 denied，且不呼叫 admin session', async () => {
  const context = makeDeps({ token: null })

  assert.equal(await verifyAdminMenuAccess(googleUser, context.deps), 'denied')
  assert.equal(context.getTokenCalls(), 1)
  assert.equal(context.calls.length, 0)
})

test('logout 立即清除 authorized 狀態', () => {
  const checking = beginAdminMenuAccessCheck(googleUser, 1)
  const authorized = completeAdminMenuAccessCheck(checking, 1, 'authorized')
  const loggedOut = beginAdminMenuAccessCheck(null, 2)

  assert.equal(canShowAdminMenu(authorized, googleUser), true)
  assert.equal(loggedOut.state, 'idle')
  assert.equal(canShowAdminMenu(loggedOut, null), false)
})

test('user 切換立即清除 authorized 狀態', () => {
  const checking = beginAdminMenuAccessCheck(googleUser, 1)
  const authorized = completeAdminMenuAccessCheck(checking, 1, 'authorized')
  const switched = beginAdminMenuAccessCheck(secondGoogleUser, 2)

  assert.equal(switched.state, 'checking')
  assert.equal(canShowAdminMenu(authorized, secondGoogleUser), false)
  assert.equal(canShowAdminMenu(switched, secondGoogleUser), false)
})

test('stale response 不得把新使用者設為 authorized', () => {
  const current = beginAdminMenuAccessCheck(secondGoogleUser, 2)
  const staleCompletion = completeAdminMenuAccessCheck(current, 1, 'authorized')

  assert.deepEqual(staleCompletion, current)
  assert.equal(canShowAdminMenu(staleCompletion, secondGoogleUser), false)
})

async function runTests() {
  for (const { name, fn } of tests) {
    try {
      await fn()
      console.log(`✓ ${name}`)
    } catch (error) {
      console.error(`✗ ${name}`)
      throw error
    }
  }

  console.log(`admin menu access contract tests passed (${tests.length} cases)`)
}

void runTests()
