'use client'

import AdminDetailSection, { AdminDetailField } from '@/components/admin/AdminDetailSection'
import AdminPageHeader from '@/components/admin/AdminPageHeader'
import AdminRecordDetail from '@/components/admin/AdminRecordDetail'
import AdminStatusBadge from '@/components/admin/AdminStatusBadge'
import { formatAdminDateTime, formatAdminTwd } from '@/lib/admin/format'
import {
  isAdminBankTransferDetail,
  type AdminBankTransferDetail,
} from '@/lib/admin/bankTransfers'

export default function BankTransferDetailClient({ id }: { id: string }) {
  return (
    <main className="grid gap-5">
      <AdminPageHeader
        description="新的銀行／郵局匯款流程已停止，本頁只供查閱歷史紀錄。"
        notice="不提供審核、確認、退款、改狀態或重送通知操作。"
        title="歷史匯款回報詳情"
      />
      <AdminRecordDetail<AdminBankTransferDetail>
        backHref="/admin/bank-transfers"
        backLabel="返回歷史匯款回報"
        endpoint={`/api/admin/bank-transfers/${encodeURIComponent(id)}`}
        render={(record) => (
          <AdminDetailSection title="回報資料">
            <AdminDetailField label="回報時間" value={formatAdminDateTime(record.createdAt)} />
            <AdminDetailField label="匯款時間" value={formatAdminDateTime(record.transferTime)} />
            <AdminDetailField label="匯款人" value={record.payerName} />
            <AdminDetailField label="電話（遮蔽）" value={record.payerPhone} />
            <AdminDetailField label="Email（遮蔽）" value={record.payerEmail} />
            <AdminDetailField label="金額" value={formatAdminTwd(record.amountTwd)} />
            <AdminDetailField label="後五碼" value={record.bankAccountLast5} />
            <AdminDetailField label="項目類型" value={record.itemType} />
            <AdminDetailField label="項目名稱" value={record.itemName} />
            <AdminDetailField label="項目 ID（遮蔽）" value={record.itemId} />
            <AdminDetailField label="既有狀態" value={<AdminStatusBadge value={record.status} />} />
            <AdminDetailField label="確認時間" value={formatAdminDateTime(record.confirmedAt)} />
          </AdminDetailSection>
        )}
        responseKey="bankTransfer"
        validateRecord={isAdminBankTransferDetail}
      />
    </main>
  )
}
