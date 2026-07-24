'use client'

import AdminDetailSection, { AdminDetailField } from '@/components/admin/AdminDetailSection'
import AdminOrderStatusSet from '@/components/admin/AdminOrderStatusSet'
import AdminPageHeader from '@/components/admin/AdminPageHeader'
import AdminRecordDetail from '@/components/admin/AdminRecordDetail'
import { formatAdminDateTime, formatAdminTwd } from '@/lib/admin/format'
import {
  isAdminProductOrderDetail,
  type AdminProductOrderDetail,
} from '@/lib/admin/productOrders'

export default function ProductOrderDetailClient({ id }: { id: string }) {
  return (
    <main className="grid gap-5">
      <AdminPageHeader
        description="查看該筆訂單的商品與寄送必要資料；所有付款、出貨、退款及狀態修改功能均未啟用。"
        title="商品訂單詳情"
      />
      <AdminRecordDetail<AdminProductOrderDetail>
        backHref="/admin/product-orders"
        backLabel="返回商品訂單"
        endpoint={`/api/admin/product-orders/${encodeURIComponent(id)}`}
        render={(order) => (
          <div className="grid gap-5">
            <AdminDetailSection title="訂單摘要">
              <AdminDetailField label="訂單編號" value={order.orderNumber} />
              <AdminDetailField label="訂單總額" value={formatAdminTwd(order.totalAmountTwd)} />
              <AdminDetailField label="客戶姓名" value={order.customerName} />
              <AdminDetailField label="客戶 Email（遮蔽）" value={order.customerEmail} />
              <AdminDetailField label="客戶電話（遮蔽）" value={order.customerPhone} />
              <AdminDetailField label="建立時間" value={formatAdminDateTime(order.createdAt)} />
              <AdminDetailField label="更新時間" value={formatAdminDateTime(order.updatedAt)} />
              <AdminDetailField
                label="既有狀態"
                value={(
                  <AdminOrderStatusSet
                    orderStatus={order.orderStatus}
                    paymentStatus={order.paymentStatus}
                    shippingStatus={order.shippingStatus}
                  />
                )}
              />
            </AdminDetailSection>

            <AdminDetailSection title="商品明細">
              {order.items.length > 0 ? order.items.map((item) => (
                <AdminDetailField
                  key={item.id || `${item.productName}-${item.quantity}`}
                  label={item.productName}
                  value={`${item.quantity} 件 × ${formatAdminTwd(item.unitPriceTwd)}，小計 ${formatAdminTwd(item.subtotalTwd)}`}
                />
              )) : <AdminDetailField label="商品" value="未提供商品明細" />}
            </AdminDetailSection>

            <AdminDetailSection title="收件資料">
              {order.shipping ? (
                <>
                  <AdminDetailField label="收件人" value={order.shipping.recipientName} />
                  <AdminDetailField label="收件電話" value={order.shipping.recipientPhone} />
                  <AdminDetailField label="收件 Email" value={order.shipping.recipientEmail} />
                  <AdminDetailField label="寄送方式" value={order.shipping.shippingMethod} />
                  <AdminDetailField label="郵遞區號" value={order.shipping.postalCode} />
                  <AdminDetailField label="地址" value={order.shipping.address} />
                  <AdminDetailField label="超商門市" value={order.shipping.storeName} />
                  <AdminDetailField label="門市地址" value={order.shipping.storeAddress} />
                  <AdminDetailField label="門市電話" value={order.shipping.storePhone} />
                </>
              ) : <AdminDetailField label="收件資料" value="未提供" />}
            </AdminDetailSection>
          </div>
        )}
        responseKey="productOrder"
        validateRecord={isAdminProductOrderDetail}
      />
    </main>
  )
}
