import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { NextResponse } from 'next/server'
import type { RequireAdminUserResult } from '@/lib/auth/admin'
import { requireAdminUser } from '@/lib/auth/admin'
import type { AdminBankTransferDetail, AdminBankTransferListItem } from '@/lib/admin/bankTransfers'
import type { AdminMemberRecord } from '@/lib/admin/members'
import type { AdminProductOrderDetail, AdminProductOrderListItem } from '@/lib/admin/productOrders'
import type { getSupabaseAdmin } from '@/lib/supabase/admin'
import {
  handleAdminBankTransferDetail,
  handleAdminBankTransfersList,
  type AdminBankTransfersHandlerDeps,
} from './bank-transfers/handler'
import {
  handleAdminMemberDetail,
  handleAdminMembersList,
  type AdminMembersHandlerDeps,
} from './members/handler'
import {
  handleAdminProductOrderDetail,
  handleAdminProductOrdersList,
  type AdminProductOrdersHandlerDeps,
} from './product-orders/handler'

const VALID_ID = '11111111-2222-4333-8444-555555555555'
const fakeSupabase = { source: 'authorized-client' } as unknown as ReturnType<typeof getSupabaseAdmin>

const productOrder: AdminProductOrderListItem = {
  id: VALID_ID,
  orderNumber: 'ORDER-SYNTHETIC-001',
  createdAt: '2026-07-01T00:00:00.000Z',
  customerName: '合成訂購人',
  customerEmail: 's***c@example.test',
  customerPhone: '09••••5678',
  productSummary: '合成商品 × 1',
  totalAmountTwd: 2800,
  orderStatus: 'paid',
  paymentStatus: 'paid',
  shippingStatus: 'not_shipped',
}
const productOrderDetail: AdminProductOrderDetail = {
  ...productOrder,
  updatedAt: '2026-07-02T00:00:00.000Z',
  items: [],
  shipping: null,
}
const member: AdminMemberRecord = {
  id: VALID_ID,
  maskedId: '1111…5555',
  displayName: '合成會員',
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-02T00:00:00.000Z',
}
const transfer: AdminBankTransferListItem = {
  id: VALID_ID,
  createdAt: '2026-07-01T00:00:00.000Z',
  payerName: '合成匯款人',
  amountTwd: 2800,
  maskedLast5: '•••45',
  itemType: 'product',
  itemName: '合成商品',
  status: 'pending_review',
}
const transferDetail: AdminBankTransferDetail = {
  ...transfer,
  payerPhone: '09••••5678',
  payerEmail: 'p***r@example.test',
  itemId: 'item…2345',
  bankAccountLast5: '12345',
  transferTime: null,
  confirmedAt: null,
}

function request(path: string, query = '', token: string | null = 'valid-token') {
  return new Request(`https://example.test${path}${query}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  })
}

function authError(status: 401 | 403): RequireAdminUserResult {
  const error = status === 401 ? '請先登入後再使用後台。' : '沒有管理權限。'
  return { error: NextResponse.json({ ok: false, error }, { status }) }
}

function authorized(): RequireAdminUserResult {
  return { supabase: fakeSupabase, user: { id: 'admin', email: 'admin@example.test' } }
}

async function json(response: Response) {
  return (await response.json()) as Record<string, unknown>
}

async function testProductOrders() {
  for (const status of [401, 403] as const) {
    let reads = 0
    const deps: AdminProductOrdersHandlerDeps = {
      requireAdmin: async () => authError(status),
      listRecords: async () => {
        reads += 1
        return { records: [productOrder], total: 1 }
      },
      getRecord: async () => {
        reads += 1
        return productOrderDetail
      },
    }
    const response = await handleAdminProductOrdersList(request('/api/admin/product-orders'), deps)
    assert.equal(response.status, status)
    assert.equal(reads, 0)
    assert.match(response.headers.get('cache-control') ?? '', /no-store/)
  }

  let receivedClient: unknown
  let receivedQuery: unknown
  const deps: AdminProductOrdersHandlerDeps = {
    requireAdmin: async () => authorized(),
    listRecords: async (client, query) => {
      receivedClient = client
      receivedQuery = query
      return { records: [productOrder], total: 51 }
    },
    getRecord: async (_client, id) => (id === VALID_ID ? productOrderDetail : null),
  }
  const response = await handleAdminProductOrdersList(
    request('/api/admin/product-orders', '?page=2&pageSize=50&status=paid'),
    deps,
  )
  const body = await json(response)
  assert.equal(response.status, 200)
  assert.equal(receivedClient, fakeSupabase)
  assert.deepEqual(receivedQuery, {
    page: 2,
    pageSize: 50,
    from: null,
    to: null,
    status: 'paid',
    offset: 50,
    rangeEnd: 99,
  })
  assert.deepEqual(body.meta, { total: 51, page: 2, pageSize: 50, totalPages: 2 })
  assert.equal(JSON.stringify(body).includes('raw_payload'), false)

  assert.equal(
    (await handleAdminProductOrdersList(request('/api/admin/product-orders', '?pageSize=51'), deps)).status,
    400,
  )
  assert.equal(
    (await handleAdminProductOrdersList(request('/api/admin/product-orders', '?q=ORDER'), deps)).status,
    400,
  )
  assert.equal(
    (await handleAdminProductOrderDetail(request('/api/admin/product-orders/nope'), 'nope', deps)).status,
    400,
  )
  assert.equal(
    (await handleAdminProductOrderDetail(request(`/api/admin/product-orders/${VALID_ID}`), VALID_ID, {
      ...deps,
      getRecord: async () => null,
    })).status,
    404,
  )
}

async function testMembers() {
  for (const status of [401, 403] as const) {
    let reads = 0
    const blocked: AdminMembersHandlerDeps = {
      requireAdmin: async () => authError(status),
      listRecords: async () => {
        reads += 1
        return { records: [member], total: 1 }
      },
      getRecord: async () => {
        reads += 1
        return member
      },
    }
    const blockedResponse = await handleAdminMembersList(request('/api/admin/members'), blocked)
    assert.equal(blockedResponse.status, status)
    assert.equal(reads, 0)
    assert.match(blockedResponse.headers.get('cache-control') ?? '', /no-store/)
  }

  const deps: AdminMembersHandlerDeps = {
    requireAdmin: async () => authorized(),
    listRecords: async (client, query) => {
      assert.equal(client, fakeSupabase)
      assert.equal(query.page, 1)
      return { records: [member], total: 1 }
    },
    getRecord: async (_client, id) => (id === VALID_ID ? member : null),
  }

  const response = await handleAdminMembersList(request('/api/admin/members'), deps)
  assert.equal(response.status, 200)
  assert.deepEqual((await json(response)).meta, { total: 1, page: 1, pageSize: 20, totalPages: 1 })
  assert.equal((await handleAdminMembersList(request('/api/admin/members', '?q=member'), deps)).status, 400)
  assert.equal((await handleAdminMembersList(request('/api/admin/members', '?status=admin'), deps)).status, 400)
  assert.equal((await handleAdminMemberDetail(request('/api/admin/members/nope'), 'nope', deps)).status, 400)
  assert.equal(
    (await handleAdminMemberDetail(request(`/api/admin/members/${VALID_ID}`), VALID_ID, {
      ...deps,
      getRecord: async () => null,
    })).status,
    404,
  )
}

async function testBankTransfers() {
  for (const status of [401, 403] as const) {
    let reads = 0
    const blocked: AdminBankTransfersHandlerDeps = {
      requireAdmin: async () => authError(status),
      listRecords: async () => {
        reads += 1
        return { records: [transfer], total: 1 }
      },
      getRecord: async () => {
        reads += 1
        return transferDetail
      },
    }
    const blockedResponse = await handleAdminBankTransfersList(request('/api/admin/bank-transfers'), blocked)
    assert.equal(blockedResponse.status, status)
    assert.equal(reads, 0)
    assert.match(blockedResponse.headers.get('cache-control') ?? '', /no-store/)
  }

  const deps: AdminBankTransfersHandlerDeps = {
    requireAdmin: async () => authorized(),
    listRecords: async (client, query) => {
      assert.equal(client, fakeSupabase)
      assert.equal(query.status, 'pending_review')
      return { records: [transfer], total: 1 }
    },
    getRecord: async (_client, id) => (id === VALID_ID ? transferDetail : null),
  }

  const response = await handleAdminBankTransfersList(
    request('/api/admin/bank-transfers', '?status=pending_review'),
    deps,
  )
  const serialized = JSON.stringify(await json(response))
  assert.equal(response.status, 200)
  assert.equal(serialized.includes('•••45'), true)
  assert.equal(serialized.includes('admin_note'), false)
  assert.equal((await handleAdminBankTransfersList(request('/api/admin/bank-transfers', '?status=paid'), deps)).status, 400)
  assert.equal((await handleAdminBankTransfersList(request('/api/admin/bank-transfers', '?q=payer'), deps)).status, 400)
  assert.equal(
    (await handleAdminBankTransferDetail(request('/api/admin/bank-transfers/nope'), 'nope', deps)).status,
    400,
  )
  assert.equal(
    (await handleAdminBankTransferDetail(request(`/api/admin/bank-transfers/${VALID_ID}`), VALID_ID, {
      ...deps,
      getRecord: async () => null,
    })).status,
    404,
  )
}

type DetailRequireAdmin = AdminProductOrdersHandlerDeps['requireAdmin']
type DetailAdapter = {
  name: string
  path: string
  record: AdminProductOrderDetail | AdminMemberRecord | AdminBankTransferDetail
  invoke: (
    adminRequest: Request,
    id: string,
    requireAdmin: DetailRequireAdmin,
    getRecord: () => Promise<unknown>,
  ) => Promise<Response>
}

function actualRequireAdmin(input: {
  user: { id: string; email: string | null } | null
  adminEmailsRaw: string | null
}): DetailRequireAdmin {
  return (adminRequest) =>
    requireAdminUser(adminRequest, {
      verifyAccessToken: async (token) => token === 'valid-token' ? input.user : null,
      adminEmailsRaw: input.adminEmailsRaw,
      getSupabase: () => fakeSupabase,
    })
}

async function testDetailHandlerAuthorization() {
  const adapters: DetailAdapter[] = [
    {
      name: 'product order',
      path: '/api/admin/product-orders',
      record: productOrderDetail,
      invoke: (adminRequest, id, requireAdmin, getRecord) =>
        handleAdminProductOrderDetail(adminRequest, id, {
          requireAdmin,
          listRecords: async () => ({ records: [], total: 0 }),
          getRecord: async () => (await getRecord()) as AdminProductOrderDetail | null,
        }),
    },
    {
      name: 'member',
      path: '/api/admin/members',
      record: member,
      invoke: (adminRequest, id, requireAdmin, getRecord) =>
        handleAdminMemberDetail(adminRequest, id, {
          requireAdmin,
          listRecords: async () => ({ records: [], total: 0 }),
          getRecord: async () => (await getRecord()) as AdminMemberRecord | null,
        }),
    },
    {
      name: 'bank transfer',
      path: '/api/admin/bank-transfers',
      record: transferDetail,
      invoke: (adminRequest, id, requireAdmin, getRecord) =>
        handleAdminBankTransferDetail(adminRequest, id, {
          requireAdmin,
          listRecords: async () => ({ records: [], total: 0 }),
          getRecord: async () => (await getRecord()) as AdminBankTransferDetail | null,
        }),
    },
  ]

  for (const adapter of adapters) {
    const scenarios = [
      {
        label: 'missing bearer',
        token: null,
        auth: actualRequireAdmin({
          user: { id: 'admin', email: 'admin@example.test' },
          adminEmailsRaw: 'admin@example.test',
        }),
        expectedStatus: 401,
      },
      {
        label: 'invalid token',
        token: 'invalid-token',
        auth: actualRequireAdmin({
          user: { id: 'admin', email: 'admin@example.test' },
          adminEmailsRaw: 'admin@example.test',
        }),
        expectedStatus: 401,
      },
      {
        label: 'non-admin',
        token: 'valid-token',
        auth: actualRequireAdmin({
          user: { id: 'member', email: 'member@example.test' },
          adminEmailsRaw: 'admin@example.test',
        }),
        expectedStatus: 403,
      },
      {
        label: 'ADMIN_EMAILS missing',
        token: 'valid-token',
        auth: actualRequireAdmin({
          user: { id: 'admin', email: 'admin@example.test' },
          adminEmailsRaw: null,
        }),
        expectedStatus: 403,
      },
    ]

    for (const scenario of scenarios) {
      let reads = 0
      const response = await adapter.invoke(
        request(`${adapter.path}/${VALID_ID}`, '', scenario.token),
        VALID_ID,
        scenario.auth,
        async () => {
          reads += 1
          return adapter.record
        },
      )
      assert.equal(response.status, scenario.expectedStatus, `${adapter.name}: ${scenario.label}`)
      assert.equal(reads, 0, `${adapter.name}: blocked auth must make zero reads`)
    }

    let invalidIdReads = 0
    const allowedAuth = actualRequireAdmin({
      user: { id: 'admin', email: 'admin@example.test' },
      adminEmailsRaw: 'admin@example.test',
    })
    const invalidIdResponse = await adapter.invoke(
      request(`${adapter.path}/invalid-id`),
      'invalid-id',
      allowedAuth,
      async () => {
        invalidIdReads += 1
        return adapter.record
      },
    )
    assert.equal(invalidIdResponse.status, 400)
    assert.equal(invalidIdReads, 0, `${adapter.name}: invalid id must make zero reads`)

    let validReads = 0
    const validResponse = await adapter.invoke(
      request(`${adapter.path}/${VALID_ID}`),
      VALID_ID,
      allowedAuth,
      async () => {
        validReads += 1
        return adapter.record
      },
    )
    assert.equal(validResponse.status, 200)
    assert.equal(validReads, 1, `${adapter.name}: valid admin reads exactly once`)

    const rawError = `${adapter.name} synthetic database password`
    const logs: unknown[][] = []
    const originalError = console.error
    console.error = (...args: unknown[]) => logs.push(args)
    try {
      const failedResponse = await adapter.invoke(
        request(`${adapter.path}/${VALID_ID}`),
        VALID_ID,
        allowedAuth,
        async () => {
          throw new Error(rawError)
        },
      )
      assert.equal(failedResponse.status, 500)
      assert.equal(JSON.stringify(await json(failedResponse)).includes(rawError), false)
      assert.equal(JSON.stringify(logs).includes(rawError), false)
    } finally {
      console.error = originalError
    }
  }
}

async function testFailClosedAdminAllowlist() {
  let reads = 0
  const result = await handleAdminMembersList(request('/api/admin/members'), {
    requireAdmin: (adminRequest) =>
      requireAdminUser(adminRequest, {
        verifyAccessToken: async () => ({ id: 'user', email: 'admin@example.test' }),
        adminEmailsRaw: null,
        getSupabase: () => fakeSupabase,
      }),
    listRecords: async () => {
      reads += 1
      return { records: [member], total: 1 }
    },
    getRecord: async () => member,
  })
  assert.equal(result.status, 403)
  assert.equal(reads, 0)
}

async function testSanitizedFailure() {
  const rawError = 'synthetic-secret database details'
  const logged: unknown[][] = []
  const original = console.error
  console.error = (...args: unknown[]) => logged.push(args)
  try {
    const response = await handleAdminBankTransfersList(request('/api/admin/bank-transfers'), {
      requireAdmin: async () => authorized(),
      listRecords: async () => {
        throw new Error(rawError)
      },
      getRecord: async () => null,
    })
    assert.equal(response.status, 500)
    assert.equal(JSON.stringify(await json(response)).includes(rawError), false)
    assert.equal(JSON.stringify(logged).includes(rawError), false)
  } finally {
    console.error = original
  }
}

async function main() {
  await testProductOrders()
  await testMembers()
  await testBankTransfers()
  await testDetailHandlerAuthorization()
  await testFailClosedAdminAllowlist()
  await testSanitizedFailure()

  const root = process.cwd()
  for (const route of [
    'src/app/api/admin/product-orders/route.ts',
    'src/app/api/admin/product-orders/[id]/route.ts',
    'src/app/api/admin/members/route.ts',
    'src/app/api/admin/members/[id]/route.ts',
    'src/app/api/admin/bank-transfers/route.ts',
    'src/app/api/admin/bank-transfers/[id]/route.ts',
  ]) {
    const source = readFileSync(join(root, route), 'utf8')
    assert.match(source, /export async function GET/)
    assert.doesNotMatch(source, /export async function (?:POST|PUT|PATCH|DELETE)/)
  }

  console.log('✓ admin read-only handler authorization and response tests passed')
}

void main()
