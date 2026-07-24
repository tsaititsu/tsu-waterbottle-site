type AdminStatusBadgeProps = {
  children?: string
  value?: string
  tone?: 'readonly' | 'tool' | 'unavailable' | 'success' | 'warning' | 'danger' | 'neutral'
}

const toneClasses: Record<NonNullable<AdminStatusBadgeProps['tone']>, string> = {
  readonly: 'bg-[#eee8f7] text-deepPurple',
  tool: 'bg-[#fff4d9] text-[#7d5a00]',
  unavailable: 'bg-[#f1eef4] text-textMuted',
  success: 'bg-[#e9f6e8] text-[#26713a]',
  warning: 'bg-[#fff4d9] text-[#7d5a00]',
  danger: 'bg-[#f8e8e8] text-[#9a2f2f]',
  neutral: 'bg-[#f1eef4] text-textDark',
}

const knownLabels: Record<string, string> = {
  pending: '待處理',
  pending_payment: '待付款',
  payment_requesting: '付款請求中',
  payment_pending: '付款確認中',
  payment_failed: '付款失敗',
  pending_review: '待檢視',
  paid: '已付款',
  confirmed: '已確認',
  preparing: '準備中',
  shipped: '已出貨',
  delivered: '已送達',
  completed: '已完成',
  canceled: '已取消',
  cancelled: '已取消',
  failed: '失敗',
  rejected: '已拒絕',
  refunded: '已退款',
  not_shipped: '尚未出貨',
  returned: '已退回',
}

function statusTone(value: string): NonNullable<AdminStatusBadgeProps['tone']> {
  if (['paid', 'confirmed', 'completed', 'delivered'].includes(value)) return 'success'
  if (['canceled', 'cancelled', 'failed', 'payment_failed', 'rejected', 'returned'].includes(value)) return 'danger'
  if (['pending', 'pending_payment', 'payment_requesting', 'payment_pending', 'pending_review', 'preparing', 'not_shipped'].includes(value)) {
    return 'warning'
  }
  return 'neutral'
}

export default function AdminStatusBadge({
  children,
  value,
  tone,
}: AdminStatusBadgeProps) {
  const normalized = value?.trim() || ''
  const label = children ?? knownLabels[normalized] ?? (normalized || '未提供')
  const resolvedTone = tone ?? statusTone(normalized)

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${toneClasses[resolvedTone]}`}>
      {label}
    </span>
  )
}
