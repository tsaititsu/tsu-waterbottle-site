'use client'

import AdminPageHeader from '@/components/admin/AdminPageHeader'
import AdminOrderStatusSet from '@/components/admin/AdminOrderStatusSet'
import AdminRecordList from '@/components/admin/AdminRecordList'
import { formatAdminDateTime, formatAdminTwd } from '@/lib/admin/format'
import {
  isAdminProductOrderListItem,
  type AdminProductOrderListItem,
} from '@/lib/admin/productOrders'

const statusOptions = [
  { value: 'pending_payment', label: '待付款' },
  { value: 'payment_requesting', label: '付款請求中' },
  { value: 'payment_pending', label: '付款確認中' },
  { value: 'payment_failed', label: '付款失敗' },
  { value: 'paid', label: '已付款' },
  { value: 'preparing', label: '準備中' },
  { value: 'shipped', label: '已出貨' },
  { value: 'completed', label: '已完成' },
  { value: 'canceled', label: '已取消' },
]

export default function AdminProductOrdersPage() {
  return (
    <main className="grid gap-5">
      <AdminPageHeader
        description="查看商品訂單、商品摘要與三組既有持久化狀態；此頁不提供付款、出貨、退款或訂單修改。"
        title="商品訂單"
      />
      <AdminRecordList<AdminProductOrderListItem>
        columns={[
          { key: 'order', label: '訂單', render: (order) => (
            <div>
              <p className="font-semibold text-deepPurple">{order.orderNumber || '未提供'}</p>
              <p className="mt-1 text-xs text-textMuted">{formatAdminDateTime(order.createdAt)}</p>
            </div>
          ) },
          { key: 'customer', label: '客戶', render: (order) => (
            <div>
              <p>{order.customerName}</p>
              <p className="mt-1 text-xs text-textMuted">{order.customerEmail}</p>
              <p className="text-xs text-textMuted">{order.customerPhone}</p>
            </div>
          ) },
          { key: 'items', label: '商品摘要', render: (order) => order.productSummary },
          { key: 'amount', label: '總額', render: (order) => formatAdminTwd(order.totalAmountTwd) },
          { key: 'status', label: '狀態', render: (order) => (
            <AdminOrderStatusSet
              orderStatus={order.orderStatus}
              paymentStatus={order.paymentStatus}
              shippingStatus={order.shippingStatus}
            />
          ) },
        ]}
        detailBasePath="/admin/product-orders"
        emptyMessage="目前條件下沒有商品訂單。"
        endpoint="/api/admin/product-orders"
        getSearchText={(order) => [
          order.orderNumber,
          order.customerName,
          order.productSummary,
        ].join(' ')}
        renderMobile={(order) => (
          <div className="grid gap-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-serifTC text-lg font-semibold text-deepPurple">{order.orderNumber || '未提供'}</h2>
                <p className="mt-1 text-sm text-textMuted">{formatAdminDateTime(order.createdAt)}</p>
              </div>
              <strong className="text-deepPurple">{formatAdminTwd(order.totalAmountTwd)}</strong>
            </div>
            <p className="text-sm leading-6 text-textDark">{order.customerName} · {order.productSummary}</p>
            <p className="text-sm text-textMuted">{order.customerEmail} · {order.customerPhone}</p>
            <AdminOrderStatusSet
              orderStatus={order.orderStatus}
              paymentStatus={order.paymentStatus}
              shippingStatus={order.shippingStatus}
            />
          </div>
        )}
        responseKey="productOrders"
        statusOptions={statusOptions}
        validateRecord={isAdminProductOrderListItem}
      />
    </main>
  )
}
