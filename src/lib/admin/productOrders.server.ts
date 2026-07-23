import 'server-only'
import type { getSupabaseAdmin } from '@/lib/supabase/admin'
import { escapeLikePattern, type AdminListQuery } from './query'
import {
  ADMIN_PRODUCT_ORDER_DETAIL_COLUMNS,
  ADMIN_PRODUCT_ORDER_LIST_COLUMNS,
  mapAdminProductOrderDetailRow,
  mapAdminProductOrderListRow,
  type AdminProductOrderDetail,
  type AdminProductOrderListItem,
} from './productOrders'

export type AdminReadClient = ReturnType<typeof getSupabaseAdmin>

export type AdminProductOrderListResult = {
  records: AdminProductOrderListItem[]
  total: number
}

export async function listAdminProductOrders(
  supabase: AdminReadClient,
  query: AdminListQuery,
): Promise<AdminProductOrderListResult> {
  let request = supabase
    .from('product_orders')
    .select(ADMIN_PRODUCT_ORDER_LIST_COLUMNS, { count: 'exact' })

  if (query.q) request = request.ilike('order_no', `%${escapeLikePattern(query.q)}%`)
  if (query.status) request = request.eq('order_status', query.status)
  if (query.from) request = request.gte('created_at', query.from)
  if (query.to) request = request.lte('created_at', query.to)

  const { data, error, count } = await request
    .order('created_at', { ascending: false })
    .range(query.offset, query.rangeEnd)

  if (error) throw new Error('admin_product_order_list_failed')

  return {
    records: (data ?? []).map(mapAdminProductOrderListRow),
    total: typeof count === 'number' ? count : 0,
  }
}

export async function getAdminProductOrder(
  supabase: AdminReadClient,
  id: string,
): Promise<AdminProductOrderDetail | null> {
  const { data, error } = await supabase
    .from('product_orders')
    .select(ADMIN_PRODUCT_ORDER_DETAIL_COLUMNS)
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error('admin_product_order_detail_failed')
  return data ? mapAdminProductOrderDetailRow(data) : null
}
