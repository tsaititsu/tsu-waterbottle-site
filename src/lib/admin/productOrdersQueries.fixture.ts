import assert from 'node:assert/strict'
import type { AdminListQuery } from './query'
import {
  getAdminProductOrder,
  listAdminProductOrders,
} from './productOrders.server'

type QueryResult = {
  data: unknown
  error: unknown
  count?: number | null
}

type Call = {
  table: string
  method: string
  args: unknown[]
}

type SyntheticPaginationRow = {
  id: string
  created_at: string
}

class FakeQuery {
  constructor(
    private readonly table: string,
    private readonly result: QueryResult,
    private readonly calls: Call[],
  ) {}

  private record(method: string, args: unknown[]) {
    this.calls.push({ table: this.table, method, args })
    return this
  }

  select(...args: unknown[]) { return this.record('select', args) }
  eq(...args: unknown[]) { return this.record('eq', args) }
  in(...args: unknown[]) { return this.record('in', args) }
  gte(...args: unknown[]) { return this.record('gte', args) }
  lte(...args: unknown[]) { return this.record('lte', args) }
  order(...args: unknown[]) { return this.record('order', args) }
  range(...args: unknown[]) { return this.record('range', args) }
  maybeSingle() {
    this.record('maybeSingle', [])
    return Promise.resolve(this.result)
  }

  then(resolve: (value: QueryResult) => unknown, reject: (error: unknown) => unknown) {
    return Promise.resolve(this.result).then(resolve, reject)
  }
}

function orderedRows(rows: SyntheticPaginationRow[], calls: Call[]) {
  const orderCalls = calls.filter(
    (call) => call.table === 'product_orders' && call.method === 'order',
  )

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

function assertStableSameTimestampPagination(calls: Call[]) {
  const parentCalls = calls.filter((call) => call.table === 'product_orders')
  const orderCalls = parentCalls.filter((call) => call.method === 'order')
  assert.deepEqual(orderCalls.map((call) => call.args), [
    ['created_at', { ascending: false }],
    ['id', { ascending: false }],
  ], 'product order parent list 必須在資料庫層使用 created_at DESC、id DESC')

  const rangeIndex = parentCalls.findIndex((call) => call.method === 'range')
  assert.ok(rangeIndex >= 0, 'product order parent list 必須套用 range')
  assert.equal(
    parentCalls.findIndex(
      (call) => call.method === 'order' && call.args[0] === 'id',
    ) < rangeIndex,
    true,
    'product order parent list 的唯一 id tie-breaker 必須在 range 前套用',
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
  assert.equal(new Set(pageSizeOneIds).size, 3, 'product orders pageSize=1 不得重複或遺漏')

  const pageSizeTwoIds = [
    ...orderedRows(differentlyOrderedSources[0], calls).slice(0, 2),
    ...orderedRows(differentlyOrderedSources[1], calls).slice(2, 4),
  ].map((row) => row.id)
  assert.deepEqual(pageSizeTwoIds, [rowC.id, rowB.id, rowA.id])
  assert.equal(new Set(pageSizeTwoIds).size, 3, 'product orders pageSize=2 不得重複或遺漏')
}

function createClient(plans: Record<string, QueryResult[]>) {
  const calls: Call[] = []
  return {
    calls,
    value: {
      from(table: string) {
        const result = plans[table]?.shift()
        assert.ok(result, `unexpected query for ${table}`)
        return new FakeQuery(table, result, calls)
      },
    },
  }
}

const query: AdminListQuery = {
  page: 1,
  pageSize: 20,
  from: null,
  to: null,
  status: null,
  offset: 0,
  rangeEnd: 19,
}

const firstId = '11111111-2222-4333-8444-555555555555'
const secondId = '22222222-3333-4444-8555-666666666666'
const parent = (id: string, orderNo: string) => ({
  id,
  order_no: orderNo,
  customer_name: '合成客戶',
  customer_email: 'synthetic@example.test',
  customer_phone: '0912345678',
  total_amount_twd: 1000,
  payment_status: 'paid',
  order_status: 'paid',
  shipping_status: 'not_shipped',
  created_at: '2026-07-01T00:00:00.000Z',
  updated_at: '2026-07-02T00:00:00.000Z',
})

const item = (
  id: string,
  orderId: string,
  productName: string,
  createdAt: string,
) => ({
  id,
  order_id: orderId,
  product_name: productName,
  unit_price_twd: 500,
  quantity: 1,
  subtotal_twd: 500,
  created_at: createdAt,
})

const shipping = {
  order_id: firstId,
  recipient_name: '合成收件人',
  recipient_phone: '0900000000',
  recipient_email: 'recipient@example.test',
  shipping_method: 'home_delivery',
  postal_code: '100',
  address: '合成地址',
  store_type: null,
  store_name: null,
  store_address: null,
  store_phone: null,
  created_at: '2026-07-01T00:00:00.000Z',
  updated_at: '2026-07-02T00:00:00.000Z',
}

async function listGroupsItemsAndUsesParentCount() {
  const client = createClient({
    product_orders: [{ data: [parent(firstId, 'ORDER-1')], error: null, count: 1 }],
    product_order_items: [{
      data: [
        item('item-c', firstId, '商品 C', '2026-07-03T00:00:00.000Z'),
        item('item-b', firstId, '商品 B', '2026-07-01T00:00:00.000Z'),
        item('item-a', firstId, '商品 A', '2026-07-01T00:00:00.000Z'),
      ],
      error: null,
    }],
  })

  const result = await listAdminProductOrders(client.value as never, query)
  assert.equal(result.total, 1)
  assert.equal(result.records.length, 1)
  assert.equal(result.records[0]?.productSummary, '商品 A × 1、商品 B × 1 等 3 項')
  assertStableSameTimestampPagination(client.calls)

  const parentSelect = client.calls.find(
    (call) => call.table === 'product_orders' && call.method === 'select',
  )
  assert.deepEqual(parentSelect?.args[1], { count: 'exact' })
  assert.equal(String(parentSelect?.args[0]).includes('('), false, 'parent select 不得嵌入 relation')

  const itemCalls = client.calls.filter((call) => call.table === 'product_order_items')
  assert.deepEqual(itemCalls.map((call) => call.method), [
    'select',
    'in',
    'order',
    'order',
    'order',
  ])
  assert.deepEqual(itemCalls.find((call) => call.method === 'in')?.args, ['order_id', [firstId]])
  assert.equal(String(itemCalls[0]?.args[0]), 'id,order_id,product_name,quantity,created_at')
}

async function listKeepsParentsSeparated() {
  const client = createClient({
    product_orders: [{
      data: [parent(firstId, 'ORDER-1'), parent(secondId, 'ORDER-2')],
      error: null,
      count: 2,
    }],
    product_order_items: [{
      data: [
        item('item-2', secondId, '第二單商品', '2026-07-01T00:00:00.000Z'),
        item('item-1', firstId, '第一單商品', '2026-07-01T00:00:00.000Z'),
      ],
      error: null,
    }],
  })

  const result = await listAdminProductOrders(client.value as never, query)
  assert.deepEqual(result.records.map((record) => record.productSummary), [
    '第一單商品 × 1',
    '第二單商品 × 1',
  ])
}

async function listUsesParentCountNotChildCount() {
  const client = createClient({
    product_orders: [{
      data: [parent(firstId, 'ORDER-1')],
      error: null,
      count: 42,
    }],
    product_order_items: [{
      data: [
        item('item-1', firstId, '商品 1', '2026-07-01T00:00:00.000Z'),
        item('item-2', firstId, '商品 2', '2026-07-02T00:00:00.000Z'),
        item('item-3', firstId, '商品 3', '2026-07-03T00:00:00.000Z'),
      ],
      error: null,
    }],
  })

  const result = await listAdminProductOrders(client.value as never, query)
  assert.equal(result.total, 42, '總筆數必須取 parent exact count，不得取 child count')
  assert.equal(result.records.length, 1)
}

async function emptyParentSkipsItems() {
  const client = createClient({
    product_orders: [{ data: [], error: null, count: 0 }],
  })

  assert.deepEqual(await listAdminProductOrders(client.value as never, query), {
    records: [],
    total: 0,
  })
  assert.equal(client.calls.some((call) => call.table === 'product_order_items'), false)
}

async function itemFailureFailsClosed() {
  const client = createClient({
    product_orders: [{ data: [parent(firstId, 'ORDER-1')], error: null, count: 1 }],
    product_order_items: [{ data: null, error: { message: 'synthetic item failure' } }],
  })

  await assert.rejects(
    listAdminProductOrders(client.value as never, query),
    /admin_product_order_items_failed/u,
  )
}

async function detailUsesSeparateStableQueries() {
  const client = createClient({
    product_orders: [{ data: parent(firstId, 'ORDER-1'), error: null }],
    product_order_items: [{
      data: [
        item('item-b', firstId, '商品 B', '2026-07-02T00:00:00.000Z'),
        item('item-a', firstId, '商品 A', '2026-07-01T00:00:00.000Z'),
      ],
      error: null,
    }],
    product_shipping_info: [{ data: shipping, error: null }],
  })

  const result = await getAdminProductOrder(client.value as never, firstId)
  assert.deepEqual(result?.items.map((entry) => entry.productName), ['商品 A', '商品 B'])
  assert.equal(result?.shipping?.recipientName, '合成收件人')
  assert.deepEqual(
    client.calls.filter((call) => call.table === 'product_order_items').map((call) => call.method),
    ['select', 'eq', 'order', 'order'],
  )
  assert.deepEqual(
    client.calls.filter((call) => call.table === 'product_shipping_info').map((call) => call.method),
    ['select', 'eq', 'maybeSingle'],
  )
}

async function absentDetailSkipsChildren() {
  const client = createClient({
    product_orders: [{ data: null, error: null }],
  })

  assert.equal(await getAdminProductOrder(client.value as never, firstId), null)
  assert.equal(client.calls.some((call) => call.table !== 'product_orders'), false)
}

async function duplicateShippingFailsClosed() {
  const client = createClient({
    product_orders: [{ data: parent(firstId, 'ORDER-1'), error: null }],
    product_order_items: [{ data: [], error: null }],
    product_shipping_info: [{
      data: null,
      error: { code: 'PGRST116', message: 'multiple rows returned' },
    }],
  })

  await assert.rejects(
    getAdminProductOrder(client.value as never, firstId),
    /admin_product_order_shipping_failed/u,
  )
}

async function missingShippingIsNull() {
  const client = createClient({
    product_orders: [{ data: parent(firstId, 'ORDER-1'), error: null }],
    product_order_items: [{ data: [], error: null }],
    product_shipping_info: [{ data: null, error: null }],
  })

  const result = await getAdminProductOrder(client.value as never, firstId)
  assert.equal(result?.shipping, null)
}

async function missingItemsAreSafe() {
  const client = createClient({
    product_orders: [{ data: parent(firstId, 'ORDER-1'), error: null }],
    product_order_items: [{ data: null, error: null }],
    product_shipping_info: [{ data: shipping, error: null }],
  })

  const result = await getAdminProductOrder(client.value as never, firstId)
  assert.deepEqual(result?.items, [])
  assert.equal(result?.shipping?.recipientName, '合成收件人')
}

async function main() {
  await listGroupsItemsAndUsesParentCount()
  await listKeepsParentsSeparated()
  await listUsesParentCountNotChildCount()
  await emptyParentSkipsItems()
  await itemFailureFailsClosed()
  await detailUsesSeparateStableQueries()
  await absentDetailSkipsChildren()
  await duplicateShippingFailsClosed()
  await missingShippingIsNull()
  await missingItemsAreSafe()

  console.log('ADMIN_PRODUCT_ORDER_QUERY_BEHAVIOR_PASS')
}

void main()
