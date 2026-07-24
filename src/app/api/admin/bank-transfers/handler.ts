import type { RequireAdminUserResult } from '@/lib/auth/admin'
import { requireAdminUser } from '@/lib/auth/admin'
import type { AdminBankTransferDetail, AdminBankTransferListItem } from '@/lib/admin/bankTransfers'
import { BANK_TRANSFER_STATUSES } from '@/lib/admin/bankTransfers'
import { adminJson, withAdminNoStore } from '@/lib/admin/http'
import {
  AdminQueryValidationError,
  isValidAdminRecordId,
  parseAdminListQuery,
  type AdminListQuery,
} from '@/lib/admin/query'
import type { getSupabaseAdmin } from '@/lib/supabase/admin'

type AdminClient = ReturnType<typeof getSupabaseAdmin>

type BankTransferListResult = {
  records: AdminBankTransferListItem[]
  total: number
}

export type AdminBankTransfersHandlerDeps = {
  requireAdmin: (request: Request) => Promise<RequireAdminUserResult>
  listRecords: (client: AdminClient, query: AdminListQuery) => Promise<BankTransferListResult>
  getRecord: (client: AdminClient, id: string) => Promise<AdminBankTransferDetail | null>
}

const defaultDeps: AdminBankTransfersHandlerDeps = {
  requireAdmin: requireAdminUser,
  listRecords: async (client, query) => {
    const { listAdminBankTransfers } = await import('@/lib/admin/bankTransfers.server')
    return listAdminBankTransfers(client, query)
  },
  getRecord: async (client, id) => {
    const { getAdminBankTransfer } = await import('@/lib/admin/bankTransfers.server')
    return getAdminBankTransfer(client, id)
  },
}

export async function handleAdminBankTransfersList(
  request: Request,
  deps: AdminBankTransfersHandlerDeps = defaultDeps,
) {
  try {
    const auth = await deps.requireAdmin(request)
    if ('error' in auth) return withAdminNoStore(auth.error)

    const query = parseAdminListQuery(new URL(request.url).searchParams, {
      allowedStatuses: BANK_TRANSFER_STATUSES,
    })
    const result = await deps.listRecords(auth.supabase, query)
    return adminJson({
      ok: true,
      bankTransfers: result.records,
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
    console.error('Failed to list admin bank transfers')
    return adminJson({ ok: false, error: '讀取歷史匯款回報失敗。' }, { status: 500 })
  }
}

export async function handleAdminBankTransferDetail(
  request: Request,
  id: string,
  deps: AdminBankTransfersHandlerDeps = defaultDeps,
) {
  try {
    const auth = await deps.requireAdmin(request)
    if ('error' in auth) return withAdminNoStore(auth.error)
    if (!isValidAdminRecordId(id)) {
      return adminJson({ ok: false, error: '匯款回報 ID 格式不合法。' }, { status: 400 })
    }

    const record = await deps.getRecord(auth.supabase, id)
    if (!record) return adminJson({ ok: false, error: '查無歷史匯款回報。' }, { status: 404 })
    return adminJson({ ok: true, bankTransfer: record })
  } catch {
    console.error('Failed to read admin bank transfer')
    return adminJson({ ok: false, error: '讀取歷史匯款回報失敗。' }, { status: 500 })
  }
}
