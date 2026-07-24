import 'server-only'
import type { getSupabaseAdmin } from '@/lib/supabase/admin'
import type { AdminListQuery } from './query'
import {
  ADMIN_BANK_TRANSFER_COLUMNS,
  mapAdminBankTransferDetailRow,
  mapAdminBankTransferListRow,
  type AdminBankTransferDetail,
  type AdminBankTransferListItem,
} from './bankTransfers'

type AdminReadClient = ReturnType<typeof getSupabaseAdmin>

export type AdminBankTransferListResult = {
  records: AdminBankTransferListItem[]
  total: number
}

export async function listAdminBankTransfers(
  supabase: AdminReadClient,
  query: AdminListQuery,
): Promise<AdminBankTransferListResult> {
  let request = supabase
    .from('bank_transfer_submissions')
    .select(ADMIN_BANK_TRANSFER_COLUMNS, { count: 'exact' })

  if (query.status) request = request.eq('status', query.status)
  if (query.from) request = request.gte('created_at', query.from)
  if (query.to) request = request.lte('created_at', query.to)

  const { data, error, count } = await request
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(query.offset, query.rangeEnd)

  if (error) throw new Error('admin_bank_transfer_list_failed')
  return {
    records: (data ?? []).map(mapAdminBankTransferListRow),
    total: typeof count === 'number' ? count : 0,
  }
}

export async function getAdminBankTransfer(
  supabase: AdminReadClient,
  id: string,
): Promise<AdminBankTransferDetail | null> {
  const { data, error } = await supabase
    .from('bank_transfer_submissions')
    .select(ADMIN_BANK_TRANSFER_COLUMNS)
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error('admin_bank_transfer_detail_failed')
  return data ? mapAdminBankTransferDetailRow(data) : null
}
