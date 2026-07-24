import type { RequireAdminUserResult } from '@/lib/auth/admin'
import { requireAdminUser } from '@/lib/auth/admin'
import { adminJson, withAdminNoStore } from '@/lib/admin/http'
import {
  PRODUCT_ORDER_STATUSES,
  type AdminProductOrderDetail,
  type AdminProductOrderListItem,
} from '@/lib/admin/productOrders'
import {
  AdminQueryValidationError,
  isValidAdminRecordId,
  parseAdminListQuery,
  type AdminListQuery,
} from '@/lib/admin/query'
import type { getSupabaseAdmin } from '@/lib/supabase/admin'

type AdminClient = ReturnType<typeof getSupabaseAdmin>

type ProductOrderListResult = {
  records: AdminProductOrderListItem[]
  total: number
}

export type AdminProductOrdersHandlerDeps = {
  requireAdmin: (request: Request) => Promise<RequireAdminUserResult>
  listRecords: (client: AdminClient, query: AdminListQuery) => Promise<ProductOrderListResult>
  getRecord: (client: AdminClient, id: string) => Promise<AdminProductOrderDetail | null>
}

const defaultDeps: AdminProductOrdersHandlerDeps = {
  requireAdmin: requireAdminUser,
  listRecords: async (client, query) => {
    const { listAdminProductOrders } = await import('@/lib/admin/productOrders.server')
    return listAdminProductOrders(client, query)
  },
  getRecord: async (client, id) => {
    const { getAdminProductOrder } = await import('@/lib/admin/productOrders.server')
    return getAdminProductOrder(client, id)
  },
}

export async function handleAdminProductOrdersList(
  request: Request,
  deps: AdminProductOrdersHandlerDeps = defaultDeps,
) {
  try {
    const auth = await deps.requireAdmin(request)
    if ('error' in auth) return withAdminNoStore(auth.error)

    const query = parseAdminListQuery(new URL(request.url).searchParams, {
      allowedStatuses: PRODUCT_ORDER_STATUSES,
    })
    const result = await deps.listRecords(auth.supabase, query)

    return adminJson({
      ok: true,
      productOrders: result.records,
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
    console.error('Failed to list admin product orders')
    return adminJson({ ok: false, error: '讀取商品訂單失敗。' }, { status: 500 })
  }
}

export async function handleAdminProductOrderDetail(
  request: Request,
  id: string,
  deps: AdminProductOrdersHandlerDeps = defaultDeps,
) {
  try {
    const auth = await deps.requireAdmin(request)
    if ('error' in auth) return withAdminNoStore(auth.error)
    if (!isValidAdminRecordId(id)) {
      return adminJson({ ok: false, error: '訂單 ID 格式不合法。' }, { status: 400 })
    }

    const record = await deps.getRecord(auth.supabase, id)
    if (!record) return adminJson({ ok: false, error: '查無商品訂單。' }, { status: 404 })
    return adminJson({ ok: true, productOrder: record })
  } catch {
    console.error('Failed to read admin product order')
    return adminJson({ ok: false, error: '讀取商品訂單失敗。' }, { status: 500 })
  }
}
