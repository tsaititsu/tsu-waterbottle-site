const dateTimeFormatter = new Intl.DateTimeFormat('zh-TW', {
  timeZone: 'Asia/Taipei',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const twdFormatter = new Intl.NumberFormat('zh-TW', {
  style: 'currency',
  currency: 'TWD',
  maximumFractionDigits: 0,
})

export function formatAdminDateTime(value: string | null | undefined) {
  if (!value) return '未提供'
  const timestamp = Date.parse(value)
  return Number.isNaN(timestamp) ? '未提供' : dateTimeFormatter.format(timestamp)
}

export function formatAdminTwd(value: number) {
  return twdFormatter.format(Number.isFinite(value) ? value : 0)
}
