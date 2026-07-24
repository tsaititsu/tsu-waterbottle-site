import assert from 'node:assert/strict'
import {
  classifyAdminDetailResponse,
  classifyAdminListResponse,
  isAdminListMeta,
} from './adminRecordState'
import {
  isAdminProductOrderDetail,
  isAdminProductOrderListItem,
} from '@/lib/admin/productOrders'
import { isAdminMemberDetail, isAdminMemberListItem } from '@/lib/admin/members'
import {
  isAdminBankTransferDetail,
  isAdminBankTransferListItem,
} from '@/lib/admin/bankTransfers'

const productOrder = {
  id: 'order-id',
  orderNumber: 'ORDER-1',
  createdAt: '2026-07-01T00:00:00.000Z',
  customerName: '合成客戶',
  customerEmail: 's***c@example.test',
  customerPhone: '09••••••78',
  productSummary: '合成商品 × 1',
  totalAmountTwd: 1000,
  orderStatus: 'paid',
  paymentStatus: 'paid',
  shippingStatus: 'not_shipped',
}
const productDetail = {
  ...productOrder,
  updatedAt: '2026-07-02T00:00:00.000Z',
  items: [{
    id: 'item-id',
    productName: '合成商品',
    unitPriceTwd: 1000,
    quantity: 1,
    subtotalTwd: 1000,
  }],
  shipping: null,
}
const member = {
  id: 'member-id',
  maskedId: 'memb…r-id',
  displayName: '合成會員',
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-02T00:00:00.000Z',
}
const transfer = {
  id: 'transfer-id',
  createdAt: '2026-07-01T00:00:00.000Z',
  payerName: '合成匯款人',
  amountTwd: 1000,
  maskedLast5: '•••45',
  itemType: 'product',
  itemName: '合成商品',
  status: 'pending_review',
}
const transferDetail = {
  ...transfer,
  payerPhone: '09••••••78',
  payerEmail: 'p***r@example.test',
  itemId: 'item…m-id',
  bankAccountLast5: '12345',
  transferTime: null,
  confirmedAt: null,
}
const meta = { total: 1, page: 1, pageSize: 20, totalPages: 1 }

assert.equal(isAdminProductOrderListItem(productOrder), true, 'valid product list record')
assert.equal(isAdminMemberListItem(member), true, 'valid member record')
assert.equal(isAdminMemberDetail(member), true, 'valid member detail')
assert.equal(isAdminBankTransferListItem(transfer), true, 'valid bank transfer record')
assert.equal(isAdminProductOrderDetail(productDetail), true, 'valid product detail')
assert.equal(isAdminBankTransferDetail(transferDetail), true, 'valid transfer detail')

for (const body of [null, [], 'invalid']) {
  assert.equal(
    classifyAdminListResponse(200, true, body, 'productOrders', isAdminProductOrderListItem).state,
    'error',
    'non-object body must fail closed',
  )
}

assert.equal(
  classifyAdminListResponse(
    200,
    true,
    { productOrders: [productOrder], meta },
    'productOrders',
    isAdminProductOrderListItem,
  ).state,
  'error',
  'missing ok must fail',
)
assert.equal(
  classifyAdminListResponse(
    200,
    true,
    { ok: true, productOrders: {}, meta },
    'productOrders',
    isAdminProductOrderListItem,
  ).state,
  'error',
  'records must be an array',
)
assert.equal(
  classifyAdminListResponse(
    200,
    true,
    { ok: true, productOrders: [productOrder, { id: 'malformed' }], meta },
    'productOrders',
    isAdminProductOrderListItem,
  ).state,
  'error',
  'one malformed record invalidates the whole response',
)
assert.equal(isAdminProductOrderListItem({ ...productOrder, raw_payload: {} }), false)
assert.equal(isAdminMemberListItem({ ...member, token: 'synthetic-secret' }), false)
assert.equal(
  isAdminProductOrderDetail({
    ...productDetail,
    items: [{ ...productDetail.items[0], quantity: '1' }],
  }),
  false,
)
assert.equal(
  isAdminProductOrderDetail({
    ...productDetail,
    shipping: { recipientName: 'only-one-field' },
  }),
  false,
)

for (const invalidMeta of [
  { ...meta, extra: true },
  { ...meta, total: -1 },
  { ...meta, total: Number.MAX_SAFE_INTEGER + 1 },
  { ...meta, page: 0 },
  { ...meta, pageSize: 51 },
  { ...meta, totalPages: 2 },
]) {
  assert.equal(isAdminListMeta(invalidMeta), false)
}

assert.equal(
  classifyAdminDetailResponse(
    200,
    true,
    { ok: true, productOrder: null },
    'productOrder',
    isAdminProductOrderDetail,
  ).state,
  'error',
  'absent detail must fail',
)
assert.equal(
  classifyAdminDetailResponse(
    200,
    true,
    { ok: true, productOrder: { ...productDetail, metadata: { private: true } } },
    'productOrder',
    isAdminProductOrderDetail,
  ).state,
  'error',
  'detail with extra sensitive fields must fail',
)

assert.deepEqual(
  classifyAdminListResponse(401, false, { error: 'private' }, 'members', isAdminMemberListItem),
  { state: 'unauthorized' },
)
assert.deepEqual(
  classifyAdminDetailResponse(403, false, { error: 'private' }, 'member', isAdminMemberListItem),
  { state: 'unauthorized' },
)
assert.deepEqual(
  classifyAdminListResponse(
    500,
    false,
    { error: 'synthetic database password' },
    'members',
    isAdminMemberListItem,
  ),
  { state: 'error', message: '讀取資料失敗。' },
)

console.log('✓ admin exact runtime response validation tests passed')
