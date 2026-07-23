import { maskIdentifier } from './pii'

export const ADMIN_MEMBER_COLUMNS = 'id,display_name,created_at,updated_at'

export type AdminMemberRecord = {
  id: string
  maskedId: string
  displayName: string
  createdAt: string
  updatedAt: string
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
}

function text(value: unknown) {
  return typeof value === 'string' ? value : ''
}

export function mapAdminMemberRow(value: unknown): AdminMemberRecord {
  const row = record(value)
  const id = text(row.id)
  return {
    id,
    maskedId: maskIdentifier(id),
    displayName: text(row.display_name) || '未設定顯示名稱',
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
  }
}
