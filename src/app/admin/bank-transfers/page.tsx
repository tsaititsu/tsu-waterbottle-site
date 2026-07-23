'use client'

import AdminPageHeader from '@/components/admin/AdminPageHeader'
import AdminRecordList from '@/components/admin/AdminRecordList'
import AdminStatusBadge from '@/components/admin/AdminStatusBadge'
import { formatAdminDateTime, formatAdminTwd } from '@/lib/admin/format'
import type { AdminBankTransferListItem } from '@/lib/admin/bankTransfers'

const statusOptions = [
  { value: 'pending_review', label: '待檢視' },
  { value: 'confirmed', label: '已確認' },
  { value: 'rejected', label: '已拒絕' },
  { value: 'cancelled', label: '已取消' },
]

export default function AdminBankTransfersPage() {
  return (
    <main className="grid gap-5">
      <AdminPageHeader
        description="新的銀行／郵局匯款流程已停止，本頁只供查閱歷史紀錄。"
        notice="不提供審核、確認、退款、改狀態或重送通知操作。"
        title="歷史匯款回報"
      />
      <AdminRecordList<AdminBankTransferListItem>
        columns={[
          { key: 'created', label: '回報時間', render: (record) => formatAdminDateTime(record.createdAt) },
          { key: 'payer', label: '匯款人', render: (record) => record.payerName },
          { key: 'amount', label: '金額', render: (record) => formatAdminTwd(record.amountTwd) },
          { key: 'last5', label: '後五碼（遮蔽）', render: (record) => record.maskedLast5 },
          { key: 'item', label: '項目', render: (record) => `${record.itemType} · ${record.itemName}` },
          { key: 'status', label: '既有狀態', render: (record) => <AdminStatusBadge value={record.status} /> },
        ]}
        detailBasePath="/admin/bank-transfers"
        emptyMessage="目前條件下沒有歷史匯款回報。"
        endpoint="/api/admin/bank-transfers"
        renderMobile={(record) => (
          <div className="grid gap-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-serifTC text-lg font-semibold text-deepPurple">{record.payerName}</h2>
                <p className="mt-1 text-sm text-textMuted">{formatAdminDateTime(record.createdAt)}</p>
              </div>
              <AdminStatusBadge value={record.status} />
            </div>
            <p className="font-semibold text-deepPurple">{formatAdminTwd(record.amountTwd)}</p>
            <p className="text-sm text-textMuted">{record.itemType} · {record.itemName} · {record.maskedLast5}</p>
          </div>
        )}
        responseKey="bankTransfers"
        searchLabel="搜尋匯款人姓名"
        statusOptions={statusOptions}
      />
    </main>
  )
}
