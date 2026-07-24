import type { RequireAdminUserResult } from '@/lib/auth/admin'
import { requireAdminUser } from '@/lib/auth/admin'
import { adminJson, withAdminNoStore } from '@/lib/admin/http'
import type { AdminMemberRecord } from '@/lib/admin/members'
import {
  AdminQueryValidationError,
  isValidAdminRecordId,
  parseAdminListQuery,
  type AdminListQuery,
} from '@/lib/admin/query'
import type { getSupabaseAdmin } from '@/lib/supabase/admin'

type AdminClient = ReturnType<typeof getSupabaseAdmin>

type MemberListResult = {
  records: AdminMemberRecord[]
  total: number
}

export type AdminMembersHandlerDeps = {
  requireAdmin: (request: Request) => Promise<RequireAdminUserResult>
  listRecords: (client: AdminClient, query: AdminListQuery) => Promise<MemberListResult>
  getRecord: (client: AdminClient, id: string) => Promise<AdminMemberRecord | null>
}

const defaultDeps: AdminMembersHandlerDeps = {
  requireAdmin: requireAdminUser,
  listRecords: async (client, query) => {
    const { listAdminMembers } = await import('@/lib/admin/members.server')
    return listAdminMembers(client, query)
  },
  getRecord: async (client, id) => {
    const { getAdminMember } = await import('@/lib/admin/members.server')
    return getAdminMember(client, id)
  },
}

export async function handleAdminMembersList(
  request: Request,
  deps: AdminMembersHandlerDeps = defaultDeps,
) {
  try {
    const auth = await deps.requireAdmin(request)
    if ('error' in auth) return withAdminNoStore(auth.error)

    const query = parseAdminListQuery(new URL(request.url).searchParams)
    const result = await deps.listRecords(auth.supabase, query)
    return adminJson({
      ok: true,
      members: result.records,
      meta: {
        total: result.total,
        page: query.page,
        pageSize: query.pageSize,
        totalPages: result.total === 0 ? 0 : Math.ceil(result.total / query.pageSize),
      },
    })
  } catch (error) {
    if (error instanceof AdminQueryValidationError) {
      return adminJson({ ok: false, error: '查詢參數不合法。' }, { status: 400 })
    }
    console.error('Failed to list admin members')
    return adminJson({ ok: false, error: '讀取會員名錄失敗。' }, { status: 500 })
  }
}

export async function handleAdminMemberDetail(
  request: Request,
  id: string,
  deps: AdminMembersHandlerDeps = defaultDeps,
) {
  try {
    const auth = await deps.requireAdmin(request)
    if ('error' in auth) return withAdminNoStore(auth.error)
    if (!isValidAdminRecordId(id)) {
      return adminJson({ ok: false, error: '會員 ID 格式不合法。' }, { status: 400 })
    }

    const record = await deps.getRecord(auth.supabase, id)
    if (!record) return adminJson({ ok: false, error: '查無會員資料。' }, { status: 404 })
    return adminJson({ ok: true, member: record })
  } catch {
    console.error('Failed to read admin member')
    return adminJson({ ok: false, error: '讀取會員名錄失敗。' }, { status: 500 })
  }
}
