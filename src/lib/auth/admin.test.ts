import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { isAdminEmail, parseAdminEmails, requireAdminUser, type AdminRequestUser } from './admin'
import type { getSupabaseAdmin } from '../supabase/admin'

const tests: Array<{ name: string; fn: () => Promise<void> | void }> = []

function test(name: string, fn: () => Promise<void> | void) {
  tests.push({ name, fn })
}

const fakeSupabase = { fake: true } as unknown as ReturnType<typeof getSupabaseAdmin>

function makeRequest(token?: string) {
  return new Request('http://localhost/api/admin/booking-slots', {
    method: 'GET',
    headers: token ? { authorization: `Bearer ${token}` } : {},
  })
}

function makeDeps(input: { user?: AdminRequestUser | null; adminEmailsRaw?: string | null }) {
  return {
    verifyAccessToken: async (token: string) => (token === 'valid-token' ? (input.user ?? null) : null),
    getSupabase: () => fakeSupabase,
    adminEmailsRaw: input.adminEmailsRaw ?? null,
  }
}

// --- parseAdminEmails ---

test('parseAdminEmails returns empty list when env is missing or blank', () => {
  assert.deepEqual(parseAdminEmails(undefined), [])
  assert.deepEqual(parseAdminEmails(null), [])
  assert.deepEqual(parseAdminEmails(''), [])
  assert.deepEqual(parseAdminEmails('   '), [])
})

test('parseAdminEmails trims, lowercases and drops non-email entries', () => {
  assert.deepEqual(parseAdminEmails('  Admin@Example.com , owner@example.com ,not-an-email, ,'), [
    'admin@example.com',
    'owner@example.com',
  ])
})

// --- isAdminEmail ---

test('isAdminEmail fails closed when ADMIN_EMAILS is unset or empty', () => {
  assert.equal(isAdminEmail('admin@example.com', undefined), false)
  assert.equal(isAdminEmail('admin@example.com', null), false)
  assert.equal(isAdminEmail('admin@example.com', ''), false)
  assert.equal(isAdminEmail('admin@example.com', '   '), false)
})

test('isAdminEmail matches case-insensitively', () => {
  assert.equal(isAdminEmail('Admin@Example.COM', 'admin@example.com'), true)
  assert.equal(isAdminEmail('admin@example.com', 'ADMIN@EXAMPLE.COM'), true)
})

test('isAdminEmail trims surrounding whitespace', () => {
  assert.equal(isAdminEmail('  admin@example.com  ', ' admin@example.com , owner@example.com '), true)
})

test('isAdminEmail rejects emails not in the allowlist and empty emails', () => {
  assert.equal(isAdminEmail('member@example.com', 'admin@example.com,owner@example.com'), false)
  assert.equal(isAdminEmail(null, 'admin@example.com'), false)
  assert.equal(isAdminEmail(undefined, 'admin@example.com'), false)
  assert.equal(isAdminEmail('', 'admin@example.com'), false)
})

// --- requireAdminUser（admin API 守門行為）---

test('requireAdminUser returns 401 when request has no bearer token', async () => {
  const result = await requireAdminUser(
    makeRequest(),
    makeDeps({ user: { id: 'user-1', email: 'admin@example.com' }, adminEmailsRaw: 'admin@example.com' }),
  )

  assert.equal('error' in result, true)
  if ('error' in result) {
    assert.equal(result.error.status, 401)
  }
})

test('requireAdminUser returns 401 when token is invalid', async () => {
  const deps = makeDeps({ user: { id: 'user-1', email: 'admin@example.com' }, adminEmailsRaw: 'admin@example.com' })
  const result = await requireAdminUser(makeRequest('bad-token'), deps)

  assert.equal('error' in result, true)
  if ('error' in result) {
    assert.equal(result.error.status, 401)
  }
})

test('requireAdminUser returns 403 for a logged-in user whose email is not in ADMIN_EMAILS', async () => {
  const result = await requireAdminUser(
    makeRequest('valid-token'),
    makeDeps({ user: { id: 'user-1', email: 'member@example.com' }, adminEmailsRaw: 'admin@example.com' }),
  )

  assert.equal('error' in result, true)
  if ('error' in result) {
    assert.equal(result.error.status, 403)
  }
})

test('requireAdminUser fails closed with 403 when ADMIN_EMAILS is empty', async () => {
  const result = await requireAdminUser(
    makeRequest('valid-token'),
    makeDeps({ user: { id: 'user-1', email: 'admin@example.com' }, adminEmailsRaw: '' }),
  )

  assert.equal('error' in result, true)
  if ('error' in result) {
    assert.equal(result.error.status, 403)
  }
})

test('requireAdminUser returns 403 when the user has no email (e.g. LINE-only login)', async () => {
  const result = await requireAdminUser(
    makeRequest('valid-token'),
    makeDeps({ user: { id: 'user-1', email: null }, adminEmailsRaw: 'admin@example.com' }),
  )

  assert.equal('error' in result, true)
  if ('error' in result) {
    assert.equal(result.error.status, 403)
  }
})

test('requireAdminUser allows an admin email regardless of case and spacing', async () => {
  const result = await requireAdminUser(
    makeRequest('valid-token'),
    makeDeps({ user: { id: 'user-1', email: 'Admin@Example.com' }, adminEmailsRaw: ' admin@example.com , owner@example.com ' }),
  )

  assert.equal('error' in result, false)
  if (!('error' in result)) {
    assert.equal(result.user.id, 'user-1')
    assert.equal(result.supabase, fakeSupabase)
  }
})

test('requireAdminUser error responses never leak env details', async () => {
  const result = await requireAdminUser(
    makeRequest('valid-token'),
    makeDeps({ user: { id: 'user-1', email: 'member@example.com' }, adminEmailsRaw: 'admin@example.com' }),
  )

  assert.equal('error' in result, true)
  if ('error' in result) {
    const bodyText = JSON.stringify(await result.error.json())
    assert.equal(bodyText.includes('ADMIN_EMAILS'), false)
    assert.equal(bodyText.includes('admin@example.com'), false)
    assert.equal(bodyText.includes('stack'), false)
  }
})

// --- 路由與頁面套用檢查（source-level）---

const projectRoot = process.cwd()

test('all admin booking-slots routes use requireAdminUser instead of login-only checks', () => {
  const routeFiles = [
    'src/app/api/admin/booking-slots/route.ts',
    'src/app/api/admin/booking-slots/batch/route.ts',
    'src/app/api/admin/booking-slots/bulk-close/route.ts',
    'src/app/api/admin/booking-slots/[id]/route.ts',
  ]

  for (const routeFile of routeFiles) {
    const source = readFileSync(join(projectRoot, routeFile), 'utf8')
    assert.equal(source.includes('requireAdminUser'), true, `${routeFile} 應使用 requireAdminUser`)
    assert.equal(source.includes('requireAuthenticatedUser'), false, `${routeFile} 不應再使用僅檢查登入的守門`)
  }
})

test('admin layout guards the UI behind the server-side admin session check', () => {
  const layoutSource = readFileSync(join(projectRoot, 'src/app/admin/layout.tsx'), 'utf8')
  const clientSource = readFileSync(join(projectRoot, 'src/app/admin/AdminLayoutClient.tsx'), 'utf8')

  assert.equal(layoutSource.startsWith("'use client'"), false, 'admin layout 應保持為可匯出 metadata 的 Server Component')
  assert.match(layoutSource, /import AdminLayoutClient from ['"]\.\/AdminLayoutClient['"]/, 'layout 應匯入 Client 守門')
  assert.match(layoutSource, /export const metadata:\s*Metadata\s*=\s*NO_INDEX_METADATA/, 'layout 應匯出 noindex metadata')
  assert.match(
    layoutSource,
    /return\s+<AdminLayoutClient>\{children\}<\/AdminLayoutClient>/,
    'layout 應使用 Client 守門包住 children',
  )

  assert.equal(clientSource.startsWith("'use client'"), true, '互動式守門應留在 Client Component')
  assert.equal(clientSource.includes('getMockUser()'), true, '應先確認目前登入使用者')
  assert.equal(clientSource.includes('getAuthAccessToken()'), true, '應取得 access token')
  assert.equal(clientSource.includes("fetch('/api/admin/session'"), true, '應呼叫 server-side admin 驗證')
  assert.equal(clientSource.includes("cache: 'no-store'"), true, '管理員驗證不得使用快取結果')
  assert.match(
    clientSource,
    /if \(response\.ok\) \{\s*setAccessState\('authorized'\)\s*} else if \(response\.status === 401\) \{\s*setAccessState\('unauthenticated'\)\s*} else \{\s*setAccessState\('forbidden'\)\s*}/,
    '只有成功回應可授權，401 與其他拒絕回應必須分流',
  )
  assert.match(
    clientSource,
    /if \(accessState === 'unauthenticated'\) \{[\s\S]*請先登入管理員帳號[\s\S]*<LoginModal[\s\S]*returnTo=\{returnTo\}[\s\S]*mode="admin"/,
    '未登入時應顯示只允許 Google 且保留目前路徑的管理員登入入口',
  )
  assert.equal(clientSource.includes("router.replace('/')"), false, '未登入時不得離開目前 admin 頁面')
  assert.match(
    clientSource,
    /setReturnTo\(sanitizeAuthReturnPath\(`\$\{pathname\}\$\{window\.location\.search\}`\)\)/,
    'admin 登入 returnTo 應取自目前 pathname 與 search',
  )
  assert.match(
    clientSource,
    /if \(accessState === 'authorized'\) \{\s*return <>\{children\}<\/>\s*}/,
    '只有 authorized 狀態才能渲染後台 UI',
  )
  assert.equal(
    clientSource.match(/<>\{children\}<\/>/g)?.length,
    1,
    'children 不得出現在 authorized gate 以外的分支',
  )
  assert.equal(clientSource.includes("setAccessState('forbidden')"), true, '403 或驗證錯誤應進入 forbidden 狀態')
  assert.equal(clientSource.includes('沒有管理權限'), true, '非 admin 應看到沒有管理權限訊息')
  assert.equal(clientSource.includes('subscribeAuthChange'), true, '登入狀態變更時應重新驗證')
  assert.equal(clientSource.includes('ADMIN_EMAILS'), false, '前端不應出現 ADMIN_EMAILS 細節')
})

test('admin session route requires admin', () => {
  const source = readFileSync(join(projectRoot, 'src/app/api/admin/session/route.ts'), 'utf8')
  assert.equal(source.includes('requireAdminUser'), true)
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
}

void runTests()
