export const ADMIN_DEFAULT_PAGE_SIZE = 20
export const ADMIN_MAX_PAGE_SIZE = 50
export const ADMIN_MAX_QUERY_LENGTH = 100

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u
const DAY_MS = 24 * 60 * 60 * 1000

export class AdminQueryValidationError extends Error {
  constructor() {
    super('admin_query_invalid')
    this.name = 'AdminQueryValidationError'
  }
}

export type AdminListQuery = {
  page: number
  pageSize: number
  q: string
  from: string | null
  to: string | null
  status: string | null
  offset: number
  rangeEnd: number
}

type AdminListQueryOptions = {
  allowedStatuses?: readonly string[]
}

function invalid(): never {
  throw new AdminQueryValidationError()
}

function parseInteger(value: string | null, fallback: number, maximum?: number) {
  if (value === null || value === '') return fallback
  if (!/^\d+$/u.test(value)) invalid()

  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < 1 || (maximum !== undefined && parsed > maximum)) {
    invalid()
  }
  return parsed
}

function parseDate(value: string | null, endOfDay: boolean) {
  if (value === null || value === '') return null
  if (!ISO_DATE_PATTERN.test(value)) invalid()

  const [year, month, day] = value.split('-').map(Number)
  const timestamp = Date.UTC(year, month - 1, day)
  const date = new Date(timestamp)
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    invalid()
  }

  return `${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`
}

function rejectAmbiguousOrUnsupportedParams(params: URLSearchParams) {
  const supported = new Set(['page', 'pageSize', 'q', 'from', 'to', 'status'])
  for (const key of supported) {
    if (params.getAll(key).length > 1) invalid()
  }
  for (const key of params.keys()) {
    if (!supported.has(key)) invalid()
  }
}

export function parseAdminListQuery(
  params: URLSearchParams,
  options: AdminListQueryOptions = {},
): AdminListQuery {
  rejectAmbiguousOrUnsupportedParams(params)

  const page = parseInteger(params.get('page'), 1)
  const pageSize = parseInteger(params.get('pageSize'), ADMIN_DEFAULT_PAGE_SIZE, ADMIN_MAX_PAGE_SIZE)
  const q = (params.get('q') ?? '').trim()
  if (Array.from(q).length > ADMIN_MAX_QUERY_LENGTH) invalid()

  const from = parseDate(params.get('from'), false)
  const to = parseDate(params.get('to'), true)
  if ((from === null) !== (to === null)) invalid()
  if (from && to) {
    const span = Date.parse(to) - Date.parse(from)
    if (span < 0 || span >= 366 * DAY_MS) invalid()
  }

  const statusValue = (params.get('status') ?? '').trim()
  const status = statusValue || null
  if (status && !(options.allowedStatuses ?? []).includes(status)) invalid()

  const offset = (page - 1) * pageSize
  if (!Number.isSafeInteger(offset)) invalid()

  return {
    page,
    pageSize,
    q,
    from,
    to,
    status,
    offset,
    rangeEnd: offset + pageSize - 1,
  }
}

export function isValidAdminRecordId(value: string) {
  return UUID_PATTERN.test(value)
}

export function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/gu, '\\$&')
}
