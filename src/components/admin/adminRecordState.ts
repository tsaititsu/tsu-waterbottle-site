import {
  hasExactKeys,
  isNonNegativeSafeInteger,
  isPlainRecord,
  isPositiveSafeInteger,
} from '@/lib/admin/validation'

export type AdminListMeta = {
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export type AdminListFilters = {
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

type RecordGuard<T> = (value: unknown) => value is T

export function isAdminListMeta(value: unknown): value is AdminListMeta {
  if (!isPlainRecord(value) || !hasExactKeys(value, ['total', 'page', 'pageSize', 'totalPages'])) {
    return false
  }
  if (
    !isNonNegativeSafeInteger(value.total) ||
    !isPositiveSafeInteger(value.page) ||
    !isPositiveSafeInteger(value.pageSize) ||
    value.pageSize > 50 ||
    !isNonNegativeSafeInteger(value.totalPages)
  ) {
    return false
  }
  const expectedTotalPages = value.total === 0 ? 0 : Math.ceil(value.total / value.pageSize)
  return value.totalPages === expectedTotalPages
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

export function filterAdminRecordsForCurrentPage<T>(
  records: readonly T[],
  query: string,
  getSearchText: (record: T) => string,
) {
  const normalized = query.trim().toLocaleLowerCase()
  if (!normalized) return [...records]
  return records.filter((record) =>
    getSearchText(record).toLocaleLowerCase().includes(normalized))
}

export function classifyAdminListResponse<T>(
  status: number,
  ok: boolean,
  body: unknown,
  responseKey: string,
  isRecord: RecordGuard<T>,
): AdminListResult<T> {
  if (status === 401 || status === 403) return { state: 'unauthorized' }

  if (!ok || !isPlainRecord(body) || !hasExactKeys(body, ['ok', responseKey, 'meta'])) {
    return { state: 'error', message: '讀取資料失敗。' }
  }

  const rawRecords = body[responseKey]
  if (body.ok !== true || !Array.isArray(rawRecords) || !isAdminListMeta(body.meta)) {
    return { state: 'error', message: '讀取資料失敗。' }
  }

  const records: T[] = []
  for (const rawRecord of rawRecords) {
    if (!isRecord(rawRecord)) {
      return { state: 'error', message: '讀取資料失敗。' }
    }
    records.push(rawRecord)
  }

  return {
    state: records.length === 0 ? 'empty' : 'ready',
    records,
    meta: body.meta,
  }
}

export function classifyAdminDetailResponse<T>(
  status: number,
  ok: boolean,
  body: unknown,
  responseKey: string,
  isRecord: RecordGuard<T>,
): AdminDetailResult<T> {
  if (status === 401 || status === 403) return { state: 'unauthorized' }

  if (
    !ok ||
    !isPlainRecord(body) ||
    !hasExactKeys(body, ['ok', responseKey]) ||
    body.ok !== true ||
    !isRecord(body[responseKey])
  ) {
    return { state: 'error', message: '讀取資料失敗。' }
  }

  return { state: 'ready', record: body[responseKey] }
}
