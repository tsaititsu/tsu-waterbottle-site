'use client'

import AdminPageHeader from '@/components/admin/AdminPageHeader'
import AdminRecordList from '@/components/admin/AdminRecordList'
import { formatAdminDateTime } from '@/lib/admin/format'
import { isAdminMemberListItem, type AdminMemberRecord } from '@/lib/admin/members'

export default function AdminMembersPage() {
  return (
    <main className="grid gap-5">
      <AdminPageHeader
        description="目前為基本會員名錄，跨訂單、預約、付款與 AI 紀錄彙整尚未啟用。"
        title="會員名錄"
      />
      <AdminRecordList<AdminMemberRecord>
        columns={[
          { key: 'name', label: '顯示名稱', render: (member) => member.displayName },
          { key: 'id', label: '內部 ID（遮蔽）', render: (member) => member.maskedId },
          { key: 'created', label: '建立時間', render: (member) => formatAdminDateTime(member.createdAt) },
          { key: 'updated', label: '更新時間', render: (member) => formatAdminDateTime(member.updatedAt) },
        ]}
        detailBasePath="/admin/members"
        emptyMessage="目前條件下沒有會員資料。"
        endpoint="/api/admin/members"
        getSearchText={(member) => `${member.displayName} ${member.maskedId}`}
        renderMobile={(member) => (
          <dl className="grid gap-2 text-sm">
            <div>
              <dt className="text-xs font-semibold text-textMuted">顯示名稱</dt>
              <dd className="mt-1 font-serifTC text-lg font-semibold text-deepPurple">{member.displayName}</dd>
            </div>
            <div><dt className="text-xs font-semibold text-textMuted">內部 ID（遮蔽）</dt><dd>{member.maskedId}</dd></div>
            <div><dt className="text-xs font-semibold text-textMuted">建立時間</dt><dd>{formatAdminDateTime(member.createdAt)}</dd></div>
          </dl>
        )}
        responseKey="members"
        validateRecord={isAdminMemberListItem}
      />
    </main>
  )
}
