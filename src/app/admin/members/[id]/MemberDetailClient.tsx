'use client'

import AdminDetailSection, { AdminDetailField } from '@/components/admin/AdminDetailSection'
import AdminPageHeader from '@/components/admin/AdminPageHeader'
import AdminRecordDetail from '@/components/admin/AdminRecordDetail'
import { formatAdminDateTime } from '@/lib/admin/format'
import type { AdminMemberRecord } from '@/lib/admin/members'

export default function MemberDetailClient({ id }: { id: string }) {
  return (
    <main className="grid gap-5">
      <AdminPageHeader
        description="只顯示 profiles 已確認存在的基本欄位；不讀取登入提供者、token、identity 或角色資料。"
        title="會員詳情"
      />
      <AdminRecordDetail<AdminMemberRecord>
        backHref="/admin/members"
        backLabel="返回會員名錄"
        endpoint={`/api/admin/members/${encodeURIComponent(id)}`}
        render={(member) => (
          <AdminDetailSection title="基本資料">
            <AdminDetailField label="顯示名稱" value={member.displayName} />
            <AdminDetailField label="內部 ID（遮蔽）" value={member.maskedId} />
            <AdminDetailField label="建立時間" value={formatAdminDateTime(member.createdAt)} />
            <AdminDetailField label="更新時間" value={formatAdminDateTime(member.updatedAt)} />
          </AdminDetailSection>
        )}
        responseKey="member"
      />
    </main>
  )
}
