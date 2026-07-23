import 'server-only'
import type { getSupabaseAdmin } from '@/lib/supabase/admin'
import { escapeLikePattern, type AdminListQuery } from './query'
import { ADMIN_MEMBER_COLUMNS, mapAdminMemberRow, type AdminMemberRecord } from './members'

type AdminReadClient = ReturnType<typeof getSupabaseAdmin>

export type AdminMemberListResult = {
  records: AdminMemberRecord[]
  total: number
}

export async function listAdminMembers(
  supabase: AdminReadClient,
  query: AdminListQuery,
): Promise<AdminMemberListResult> {
  let request = supabase.from('profiles').select(ADMIN_MEMBER_COLUMNS, { count: 'exact' })

  if (query.q) request = request.ilike('display_name', `%${escapeLikePattern(query.q)}%`)
  if (query.from) request = request.gte('created_at', query.from)
  if (query.to) request = request.lte('created_at', query.to)

  const { data, error, count } = await request
    .order('created_at', { ascending: false })
    .range(query.offset, query.rangeEnd)

  if (error) throw new Error('admin_member_list_failed')
  return {
    records: (data ?? []).map(mapAdminMemberRow),
    total: typeof count === 'number' ? count : 0,
  }
}

export async function getAdminMember(
  supabase: AdminReadClient,
  id: string,
): Promise<AdminMemberRecord | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select(ADMIN_MEMBER_COLUMNS)
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error('admin_member_detail_failed')
  return data ? mapAdminMemberRow(data) : null
}
