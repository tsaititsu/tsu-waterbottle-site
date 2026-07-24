import assert from 'node:assert/strict'
import type { AdminListQuery } from './query'
import {
  getAdminBankTransfer,
  listAdminBankTransfers,
} from './bankTransfers.server'
import { getAdminMember, listAdminMembers } from './members.server'

type Call = { method: string; args: unknown[] }

type SyntheticPaginationRow = {
  id: string
  created_at: string
}

class FakeQuery {
  readonly calls: Call[] = []

  constructor(private readonly result: Record<string, unknown>) {}

  select(...args: unknown[]) { this.calls.push({ method: 'select', args }); return this }
  ilike(...args: unknown[]) { this.calls.push({ method: 'ilike', args }); return this }
  eq(...args: unknown[]) { this.calls.push({ method: 'eq', args }); return this }
  gte(...args: unknown[]) { this.calls.push({ method: 'gte', args }); return this }
  lte(...args: unknown[]) { this.calls.push({ method: 'lte', args }); return this }
  order(...args: unknown[]) { this.calls.push({ method: 'order', args }); return this }
  range(...args: unknown[]) { this.calls.push({ method: 'range', args }); return this }
  maybeSingle() { this.calls.push({ method: 'maybeSingle', args: [] }); return Promise.resolve(this.result) }
  insert(): never { throw new Error('write_method_called') }
  update(): never { throw new Error('write_method_called') }
  delete(): never { throw new Error('write_method_called') }
  upsert(): never { throw new Error('write_method_called') }
  rpc(): never { throw new Error('write_method_called') }

  then(resolve: (value: Record<string, unknown>) => unknown, reject: (error: unknown) => unknown) {
    return Promise.resolve(this.result).then(resolve, reject)
  }
}

function orderedRows(rows: SyntheticPaginationRow[], calls: Call[]) {
  const orderCalls = calls.filter((call) => call.method === 'order')

  return [...rows].sort((left, right) => {
    for (const call of orderCalls) {
      const [column, options] = call.args as [
        keyof SyntheticPaginationRow,
        { ascending?: boolean },
      ]
      const leftValue = left[column]
      const rightValue = right[column]
      if (leftValue === rightValue) continue
      const comparison = leftValue < rightValue ? -1 : 1
      return options?.ascending === false ? -comparison : comparison
    }
    return 0
  })
}

function assertStableSameTimestampPagination(calls: Call[], label: string) {
  const orderCalls = calls.filter((call) => call.method === 'order')
  assert.deepEqual(orderCalls.map((call) => call.args), [
    ['created_at', { ascending: false }],
    ['id', { ascending: false }],
  ], `${label} 必須在資料庫層使用 created_at DESC、id DESC`)

  const rangeIndex = calls.findIndex((call) => call.method === 'range')
  assert.ok(rangeIndex >= 0, `${label} 必須套用 range`)
  assert.equal(
    calls.findIndex((call) => call.method === 'order' && call.args[0] === 'id') < rangeIndex,
    true,
    `${label} 的唯一 id tie-breaker 必須在 range 前套用`,
  )

  const createdAt = '2026-07-01T00:00:00.000Z'
  const rowA = { id: '00000000-0000-4000-8000-00000000000a', created_at: createdAt }
  const rowB = { id: '00000000-0000-4000-8000-00000000000b', created_at: createdAt }
  const rowC = { id: '00000000-0000-4000-8000-00000000000c', created_at: createdAt }
  const differentlyOrderedSources = [
    [rowA, rowB, rowC],
    [rowC, rowA, rowB],
    [rowB, rowC, rowA],
  ]

  const pageSizeOneIds = differentlyOrderedSources.map((rows, pageIndex) =>
    orderedRows(rows, calls).slice(pageIndex, pageIndex + 1)[0]?.id,
  )
  assert.deepEqual(pageSizeOneIds, [rowC.id, rowB.id, rowA.id])
  assert.equal(new Set(pageSizeOneIds).size, 3, `${label} pageSize=1 不得重複或遺漏`)

  const pageSizeTwoIds = [
    ...orderedRows(differentlyOrderedSources[0], calls).slice(0, 2),
    ...orderedRows(differentlyOrderedSources[1], calls).slice(2, 4),
  ].map((row) => row.id)
  assert.deepEqual(pageSizeTwoIds, [rowC.id, rowB.id, rowA.id])
  assert.equal(new Set(pageSizeTwoIds).size, 3, `${label} pageSize=2 不得重複或遺漏`)
}

function client(result: Record<string, unknown>) {
  const query = new FakeQuery(result)
  let table = ''
  return {
    query,
    get table() { return table },
    value: {
      from(nextTable: string) {
        table = nextTable
        return query
      },
    },
  }
}

const listQuery: AdminListQuery = {
  page: 2,
  pageSize: 20,
  from: '2026-07-01T00:00:00.000Z',
  to: '2026-07-31T23:59:59.999Z',
  status: 'paid',
  offset: 20,
  rangeEnd: 39,
}

const orderRow = {
  id: '11111111-2222-4333-8444-555555555555',
  order_no: 'ORDER-1',
  customer_name: '合成客戶',
  customer_email: 'synthetic@example.test',
  customer_phone: '0912345678',
  total_amount_twd: 1000,
  payment_status: 'paid',
  order_status: 'paid',
  shipping_status: 'not_shipped',
  created_at: '2026-07-01T00:00:00.000Z',
  updated_at: '2026-07-02T00:00:00.000Z',
  product_order_items: [],
  product_shipping_info: [],
}

async function main() {
  const memberRow = {
    id: orderRow.id,
    display_name: '合成會員',
    created_at: orderRow.created_at,
    updated_at: orderRow.updated_at,
  }
  const memberListClient = client({ data: [memberRow], error: null, count: 1 })
  await listAdminMembers(memberListClient.value as never, { ...listQuery, status: null })
  assert.equal(memberListClient.table, 'profiles')
  assert.deepEqual(
    memberListClient.query.calls.map((call) => call.method),
    ['select', 'gte', 'lte', 'order', 'order', 'range'],
  )
  assertStableSameTimestampPagination(memberListClient.query.calls, 'member list')
  const memberDetailClient = client({ data: memberRow, error: null })
  assert.equal((await getAdminMember(memberDetailClient.value as never, memberRow.id))?.maskedId, '1111…5555')

  const transferRow = {
    id: orderRow.id,
    item_type: 'product',
    item_id: 'item-1',
    item_name: '合成商品',
    amount_twd: 1000,
    payer_name: '合成匯款人',
    payer_phone: '0912345678',
    payer_email: 'payer@example.test',
    bank_account_last5: '12345',
    transfer_time: null,
    status: 'paid',
    created_at: orderRow.created_at,
    confirmed_at: null,
  }
  const transferListClient = client({ data: [transferRow], error: null, count: 1 })
  await listAdminBankTransfers(transferListClient.value as never, listQuery)
  assert.equal(transferListClient.table, 'bank_transfer_submissions')
  assert.deepEqual(
    transferListClient.query.calls.map((call) => call.method),
    ['select', 'eq', 'gte', 'lte', 'order', 'order', 'range'],
  )
  assertStableSameTimestampPagination(transferListClient.query.calls, 'bank transfer list')
  const transferDetailClient = client({ data: transferRow, error: null })
  assert.equal((await getAdminBankTransfer(transferDetailClient.value as never, transferRow.id))?.bankAccountLast5, '12345')

  for (const query of [
    memberListClient.query,
    memberDetailClient.query,
    transferListClient.query,
    transferDetailClient.query,
  ]) {
    assert.equal(query.calls.some((call) => ['insert', 'update', 'delete', 'upsert', 'rpc'].includes(call.method)), false)
  }

  console.log('ADMIN_READ_ONLY_QUERY_FIXTURE_PASS')
}

void main()
