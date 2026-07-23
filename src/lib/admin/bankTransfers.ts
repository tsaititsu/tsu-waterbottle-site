import { maskEmail, maskIdentifier, maskPhone } from './pii'

export const BANK_TRANSFER_STATUSES = [
  'pending_review',
  'confirmed',
  'rejected',
  'cancelled',
] as const

export const ADMIN_BANK_TRANSFER_COLUMNS = [
  'id',
  'item_type',
  'item_id',
  'item_name',
  'amount_twd',
  'payer_name',
  'payer_phone',
  'payer_email',
  'bank_account_last5',
  'transfer_time',
  'status',
  'created_at',
  'confirmed_at',
].join(',')

export type AdminBankTransferListItem = {
  id: string
  createdAt: string
  payerName: string
  amountTwd: number
  maskedLast5: string
  itemType: string
  itemName: string
  status: string
}

export type AdminBankTransferDetail = AdminBankTransferListItem & {
  payerPhone: string
  payerEmail: string
  itemId: string
  bankAccountLast5: string
  transferTime: string | null
  confirmedAt: string | null
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
}

function text(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function nullableText(value: unknown) {
  const normalized = text(value)
  return normalized ? normalized : null
}

function number(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function maskLast5(value: unknown) {
  const normalized = text(value)
  if (!normalized) return '未提供'
  return `•••${Array.from(normalized).slice(-2).join('')}`
}

export function mapAdminBankTransferListRow(value: unknown): AdminBankTransferListItem {
  const row = record(value)
  return {
    id: text(row.id),
    createdAt: text(row.created_at),
    payerName: text(row.payer_name) || '未提供',
    amountTwd: number(row.amount_twd),
    maskedLast5: maskLast5(row.bank_account_last5),
    itemType: text(row.item_type) || 'unknown',
    itemName: text(row.item_name) || '未提供',
    status: text(row.status) || 'unknown',
  }
}

export function mapAdminBankTransferDetailRow(value: unknown): AdminBankTransferDetail {
  const row = record(value)
  return {
    ...mapAdminBankTransferListRow(row),
    payerPhone: maskPhone(nullableText(row.payer_phone)),
    payerEmail: maskEmail(nullableText(row.payer_email)),
    itemId: maskIdentifier(nullableText(row.item_id)),
    bankAccountLast5: text(row.bank_account_last5) || '未提供',
    transferTime: nullableText(row.transfer_time),
    confirmedAt: nullableText(row.confirmed_at),
  }
}
