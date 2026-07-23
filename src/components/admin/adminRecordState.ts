export type AdminListMeta = {
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export type AdminListFilters = {
  q: string
  from: string
  to: string
  status: string
}

type AdminListResult<T> =
  | { state: 'unauthorized' }
  | { state: 'error'; message: string }
  | { state: 'empty' | 'ready'; records: T[]; meta: AdminListMeta }

type AdminDetailResult<T> =
  | { state: 'unauthorized' }
  | { state: 'error'; message: string }
  | { state: 'ready'; record: T }

type AdminResponseBody = {
  ok?: boolean
  error?: string
  meta?: AdminListMeta
  [key: string]: unknown
}

export function buildAdminListRequestUrl(
  endpoint: string,
  page: number,
  filters: AdminListFilters,
) {
  const params = new URLSearchParams({ page: String(page), pageSize: '20' })
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value)
  }
  return `${endpoint}?${params.toString()}`
}

export function classifyAdminListResponse<T>(
  status: number,
  ok: boolean,
  body: AdminResponseBody,
  responseKey: string,
): AdminListResult<T> {
  if (status === 401 || status === 403) return { state: 'unauthorized' }

  const records = body[responseKey]
  if (!ok || body.ok !== true || !Array.isArray(records) || !body.meta) {
    return { state: 'error', message: body.error ?? '讀取資料失敗。' }
  }

  return {
    state: records.length === 0 ? 'empty' : 'ready',
    records: records as T[],
    meta: body.meta,
  }
}

export function classifyAdminDetailResponse<T>(
  status: number,
  ok: boolean,
  body: AdminResponseBody,
  responseKey: string,
): AdminDetailResult<T> {
  if (status === 401 || status === 403) return { state: 'unauthorized' }

  const record = body[responseKey]
  if (!ok || body.ok !== true || !record) {
    return { state: 'error', message: body.error ?? '讀取資料失敗。' }
  }

  return { state: 'ready', record: record as T }
}
