import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import AdminNavigation from './AdminNavigation'
import AdminOrderStatusSet from './AdminOrderStatusSet'
import AdminDataState from './AdminDataState'
import AdminPagination from './AdminPagination'
import {
  buildAdminListRequestUrl,
  classifyAdminDetailResponse,
  classifyAdminListResponse,
} from './adminRecordState'

const navigationMarkup = renderToStaticMarkup(
  createElement(AdminNavigation, { pathname: '/admin/product-orders' }),
)
const ids = [...navigationMarkup.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1])
assert.equal(new Set(ids).size, ids.length, '桌面與手機導覽不得產生重複 id')
for (const labelledBy of navigationMarkup.matchAll(/aria-labelledby="([^"]+)"/g)) {
  assert.ok(ids.includes(labelledBy[1]), `aria-labelledby 必須指向存在且唯一的 heading：${labelledBy[1]}`)
}
assert.match(navigationMarkup, /aria-current="page"[^>]*href="\/admin\/product-orders"/)

const statusMarkup = renderToStaticMarkup(createElement(AdminOrderStatusSet, {
  orderStatus: 'paid',
  paymentStatus: 'payment_pending',
  shippingStatus: 'not_shipped',
}))
assert.match(statusMarkup, />訂單</)
assert.match(statusMarkup, />付款</)
assert.match(statusMarkup, />物流</)
assert.match(statusMarkup, /付款確認中/)

for (const [state, expected] of [
  ['loading', '正在讀取資料'],
  ['empty', '目前沒有紀錄'],
  ['error', '暫時無法讀取'],
  ['unauthorized', '沒有管理權限'],
] as const) {
  const markup = renderToStaticMarkup(createElement(AdminDataState, {
    state,
    onRetry: state === 'error' ? () => undefined : undefined,
  }))
  assert.match(markup, new RegExp(expected))
  if (state === 'error') assert.match(markup, /重新讀取/)
}

const paginationMarkup = renderToStaticMarkup(createElement(AdminPagination, {
  page: 2,
  total: 45,
  totalPages: 3,
  onPageChange: () => undefined,
}))
assert.match(paginationMarkup, /第 2／3 頁，共 45 筆/)
assert.match(paginationMarkup, /上一頁/)
assert.match(paginationMarkup, /下一頁/)

assert.equal(
  buildAdminListRequestUrl('/api/admin/product-orders', 2, {
    q: 'ORDER-1',
    from: '2026-07-01',
    to: '2026-07-31',
    status: 'payment_pending',
  }),
  '/api/admin/product-orders?page=2&pageSize=20&q=ORDER-1&from=2026-07-01&to=2026-07-31&status=payment_pending',
)

assert.deepEqual(
  classifyAdminListResponse(401, false, {}, 'productOrders'),
  { state: 'unauthorized' },
)
assert.deepEqual(
  classifyAdminListResponse(200, true, {
    ok: true,
    productOrders: [],
    meta: { total: 0, page: 1, pageSize: 20, totalPages: 0 },
  }, 'productOrders'),
  {
    state: 'empty',
    records: [],
    meta: { total: 0, page: 1, pageSize: 20, totalPages: 0 },
  },
)
assert.equal(
  classifyAdminListResponse(500, false, { error: '安全錯誤' }, 'productOrders').state,
  'error',
)
assert.equal(
  classifyAdminListResponse(200, true, {
    ok: true,
    productOrders: [{ id: 'order-1' }],
    meta: { total: 1, page: 1, pageSize: 20, totalPages: 1 },
  }, 'productOrders').state,
  'ready',
)

assert.deepEqual(
  classifyAdminDetailResponse(403, false, {}, 'productOrder'),
  { state: 'unauthorized' },
)
assert.equal(
  classifyAdminDetailResponse(404, false, { error: '找不到紀錄' }, 'productOrder').state,
  'error',
)
assert.deepEqual(
  classifyAdminDetailResponse(200, true, {
    ok: true,
    productOrder: { id: 'order-1' },
  }, 'productOrder'),
  { state: 'ready', record: { id: 'order-1' } },
)

console.log('✓ admin read-only rendered behavior and state transition tests passed')
