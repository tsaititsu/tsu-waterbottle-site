import 'server-only'
import type { getSupabaseAdmin } from '@/lib/supabase/admin'
import type { AdminListQuery } from './query'
import {
  ADMIN_PRODUCT_ORDER_DETAIL_COLUMNS,
  ADMIN_PRODUCT_ORDER_DETAIL_ITEM_COLUMNS,
  ADMIN_PRODUCT_ORDER_LIST_COLUMNS,
  ADMIN_PRODUCT_ORDER_LIST_ITEM_COLUMNS,
  ADMIN_PRODUCT_ORDER_SHIPPING_COLUMNS,
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

function stringField(value: unknown, key: string) {
  if (typeof value !== 'object' || value === null) return ''
  const field = (value as Record<string, unknown>)[key]
  return typeof field === 'string' ? field : ''
}

export async function listAdminProductOrders(
  supabase: AdminReadClient,
  query: AdminListQuery,
): Promise<AdminProductOrderListResult> {
  let request = supabase
    .from('product_orders')
    .select(ADMIN_PRODUCT_ORDER_LIST_COLUMNS, { count: 'exact' })

  if (query.status) request = request.eq('order_status', query.status)
  if (query.from) request = request.gte('created_at', query.from)
  if (query.to) request = request.lte('created_at', query.to)

  const { data, error, count } = await request
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(query.offset, query.rangeEnd)

  if (error) throw new Error('admin_product_order_list_failed')
  const parentRows: unknown[] = Array.isArray(data) ? data : []
  if (parentRows.length === 0) {
    return {
      records: [],
      total: typeof count === 'number' ? count : 0,
    }
  }

  const parentIds = parentRows
    .map((row) => stringField(row, 'id'))
    .filter(Boolean)
  const { data: itemRows, error: itemsError } = await supabase
    .from('product_order_items')
    .select(ADMIN_PRODUCT_ORDER_LIST_ITEM_COLUMNS)
    .in('order_id', parentIds)
    .order('order_id', { ascending: true })
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })

  if (itemsError) throw new Error('admin_product_order_items_failed')

  const itemsByOrderId = new Map<string, unknown[]>()
  for (const item of itemRows ?? []) {
    const orderId = stringField(item, 'order_id')
    const existing = itemsByOrderId.get(orderId) ?? []
    existing.push(item)
    itemsByOrderId.set(orderId, existing)
  }

  return {
    records: parentRows.map((row) =>
      mapAdminProductOrderListRow(
        row,
        itemsByOrderId.get(stringField(row, 'id')) ?? [],
      )),
    total: typeof count === 'number' ? count : 0,
  }
}

export async function getAdminProductOrder(
  supabase: AdminReadClient,
  id: string,
): Promise<AdminProductOrderDetail | null> {
  const { data: parentRow, error: parentError } = await supabase
    .from('product_orders')
    .select(ADMIN_PRODUCT_ORDER_DETAIL_COLUMNS)
    .eq('id', id)
    .maybeSingle()

  if (parentError) throw new Error('admin_product_order_detail_failed')
  if (!parentRow) return null

  const { data: itemRows, error: itemsError } = await supabase
    .from('product_order_items')
    .select(ADMIN_PRODUCT_ORDER_DETAIL_ITEM_COLUMNS)
    .eq('order_id', id)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })

  if (itemsError) throw new Error('admin_product_order_items_failed')

  const { data: shippingRow, error: shippingError } = await supabase
    .from('product_shipping_info')
    .select(ADMIN_PRODUCT_ORDER_SHIPPING_COLUMNS)
    .eq('order_id', id)
    .maybeSingle()

  if (shippingError) throw new Error('admin_product_order_shipping_failed')
  return mapAdminProductOrderDetailRow(parentRow, itemRows ?? [], shippingRow)
}
