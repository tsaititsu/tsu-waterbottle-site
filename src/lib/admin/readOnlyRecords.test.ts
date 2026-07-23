import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  ADMIN_BANK_TRANSFER_COLUMNS,
  mapAdminBankTransferDetailRow,
  mapAdminBankTransferListRow,
} from './bankTransfers'
import { ADMIN_MEMBER_COLUMNS, mapAdminMemberRow } from './members'
import {
  ADMIN_PRODUCT_ORDER_DETAIL_COLUMNS,
  ADMIN_PRODUCT_ORDER_LIST_COLUMNS,
  mapAdminProductOrderDetailRow,
  mapAdminProductOrderListRow,
} from './productOrders'

const orderRow = {
  id: '11111111-2222-4333-8444-555555555555',
  order_no: 'ORDER-SYNTHETIC-001',
  customer_name: '合成訂購人',
  customer_email: 'synthetic@example.test',
  customer_phone: '0912-345-678',
  total_amount_twd: 2800,
  payment_status: 'provider_future_status',
  order_status: 'paid',
  shipping_status: 'not_shipped',
  created_at: '2026-07-01T00:00:00.000Z',
  updated_at: '2026-07-02T00:00:00.000Z',
  payment_id: 'must-not-leak',
  raw_payload: { secret: true },
  product_order_items: [
    {
      id: 'item-1',
      product_name: '合成商品',
      unit_price_twd: 1400,
      quantity: 2,
      subtotal_twd: 2800,
      product_snapshot: { secret: true },
    },
  ],
  product_shipping_info: {
    recipient_name: '收件人',
    recipient_phone: '0900000000',
    recipient_email: 'recipient@example.test',
    shipping_method: 'home_delivery',
    postal_code: '100',
    address: '臺北市中正區測試路1號',
    store_type: null,
    store_name: null,
    store_address: null,
    store_phone: null,
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-02T00:00:00.000Z',
  },
}

const orderList = mapAdminProductOrderListRow(orderRow)
assert.equal(orderList.customerEmail, 's***c@example.test')
assert.equal(orderList.customerPhone, '09••••5678')
assert.equal(orderList.productSummary, '合成商品 × 2')
assert.equal(orderList.paymentStatus, 'provider_future_status', '未知狀態應安全顯示，不應推導')
assert.equal(JSON.stringify(orderList).includes('must-not-leak'), false)
assert.equal(JSON.stringify(orderList).includes('raw_payload'), false)

const orderDetail = mapAdminProductOrderDetailRow(orderRow)
assert.equal(orderDetail.items[0]?.productName, '合成商品')
assert.equal(orderDetail.shipping?.recipientName, '收件人')
assert.equal(JSON.stringify(orderDetail).includes('product_snapshot'), false)
assert.equal(JSON.stringify(orderDetail).includes('must-not-leak'), false)

const member = mapAdminMemberRow({
  id: '11111111-2222-4333-8444-555555555555',
  display_name: '合成會員',
  created_at: '2026-07-01T00:00:00.000Z',
  updated_at: '2026-07-02T00:00:00.000Z',
  email: 'must-not-leak@example.test',
  app_metadata: { admin: true },
  user_metadata: { phone: 'must-not-leak' },
  access_token: 'must-not-leak',
  identities: [{ id: 'must-not-leak' }],
})
assert.equal(member.maskedId, '1111…5555')
assert.equal(JSON.stringify(member).includes('must-not-leak'), false)

const transferRow = {
  id: '11111111-2222-4333-8444-555555555555',
  item_type: 'product',
  item_id: 'private-item-id-12345',
  item_name: '合成商品',
  amount_twd: 2800,
  payer_name: '合成匯款人',
  payer_phone: '0912345678',
  payer_email: 'payer@example.test',
  bank_account_last5: '12345',
  transfer_time: '2026-07-01T01:00:00.000Z',
  status: 'pending_review',
  created_at: '2026-07-01T00:00:00.000Z',
  confirmed_at: null,
  admin_note: 'must-not-leak',
  raw_payload: { secret: true },
}
const transferList = mapAdminBankTransferListRow(transferRow)
assert.equal(transferList.maskedLast5, '•••45')
assert.equal(JSON.stringify(transferList).includes('12345'), false)

const transferDetail = mapAdminBankTransferDetailRow(transferRow)
assert.equal(transferDetail.bankAccountLast5, '12345')
assert.equal(transferDetail.itemId, 'priv…2345')
assert.equal(transferDetail.payerEmail, 'p***r@example.test')
assert.equal(JSON.stringify(transferDetail).includes('must-not-leak'), false)

for (const columns of [
  ADMIN_PRODUCT_ORDER_LIST_COLUMNS,
  ADMIN_PRODUCT_ORDER_DETAIL_COLUMNS,
  ADMIN_MEMBER_COLUMNS,
  ADMIN_BANK_TRANSFER_COLUMNS,
]) {
  assert.equal(columns.includes('*'), false)
  assert.equal(columns.includes('raw_payload'), false)
  assert.equal(columns.includes('payment_id'), false)
  assert.equal(columns.includes('admin_note'), false)
}

assert.equal(ADMIN_MEMBER_COLUMNS, 'id,display_name,created_at,updated_at')

const root = process.cwd()
for (const file of [
  'src/lib/admin/productOrders.server.ts',
  'src/lib/admin/members.server.ts',
  'src/lib/admin/bankTransfers.server.ts',
]) {
  const source = readFileSync(join(root, file), 'utf8')
  assert.match(source, /^import 'server-only'/)
  assert.doesNotMatch(source, /\.(?:insert|update|delete|upsert|rpc)\(/)
  assert.doesNotMatch(source, /select\(\s*['"`]\*['"`]/)
}

console.log('✓ admin read-only record mapper and server-boundary tests passed')
