import assert from 'node:assert/strict'
import type { AdminListQuery } from './query'
import {
  getAdminBankTransfer,
  listAdminBankTransfers,
} from './bankTransfers.server'
import { getAdminMember, listAdminMembers } from './members.server'
import {
  getAdminProductOrder,
  listAdminProductOrders,
} from './productOrders.server'

type Call = { method: string; args: unknown[] }

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
  q: '100%_safe',
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
  const orderListClient = client({ data: [orderRow], error: null, count: 1 })
  const orders = await listAdminProductOrders(orderListClient.value as never, listQuery)
  assert.equal(orderListClient.table, 'product_orders')
  assert.equal(orders.total, 1)
  assert.deepEqual(
    orderListClient.query.calls.map((call) => call.method),
    ['select', 'ilike', 'eq', 'gte', 'lte', 'order', 'range'],
  )
  assert.deepEqual(orderListClient.query.calls.at(-1)?.args, [20, 39])
  assert.deepEqual(orderListClient.query.calls.find((call) => call.method === 'ilike')?.args, [
    'order_no',
    '%100\\%\\_safe%',
  ])

  const orderDetailClient = client({ data: orderRow, error: null })
  assert.equal((await getAdminProductOrder(orderDetailClient.value as never, orderRow.id))?.id, orderRow.id)
  assert.equal(orderDetailClient.table, 'product_orders')
  assert.deepEqual(orderDetailClient.query.calls.map((call) => call.method), ['select', 'eq', 'maybeSingle'])

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
    ['select', 'ilike', 'gte', 'lte', 'order', 'range'],
  )
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
    ['select', 'ilike', 'eq', 'gte', 'lte', 'order', 'range'],
  )
  const transferDetailClient = client({ data: transferRow, error: null })
  assert.equal((await getAdminBankTransfer(transferDetailClient.value as never, transferRow.id))?.bankAccountLast5, '12345')

  for (const query of [
    orderListClient.query,
    orderDetailClient.query,
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
