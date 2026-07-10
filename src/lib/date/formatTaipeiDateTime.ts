const taipeiDateTimeFormatter = new Intl.DateTimeFormat('zh-TW', {
  timeZone: 'Asia/Taipei',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

/**
 * 把 DB 的 UTC ISO 字串轉成台北時間顯示文字（固定格式：2026/07/10 00:08）。
 * DB 值維持 UTC 不動；只在顯示層用 Intl 指定 Asia/Taipei，不手動加 8 小時。
 * 以 formatToParts 自行組裝，避免不同 ICU 版本的分隔字元差異。
 * null / undefined / 無法解析的值一律回傳「—」。
 */
export function formatTaipeiDateTime(value: string | null | undefined): string {
  if (typeof value !== 'string' || !value.trim()) return '—'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'

  const parts = Object.fromEntries(
    taipeiDateTimeFormatter
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  ) as Record<string, string>

  if (!parts.year || !parts.month || !parts.day || !parts.hour || !parts.minute) return '—'

  // Intl 在 24 小時制可能把午夜輸出為 "24"，統一為 "00"。
  const hour = parts.hour === '24' ? '00' : parts.hour.padStart(2, '0')

  return `${parts.year}/${parts.month.padStart(2, '0')}/${parts.day.padStart(2, '0')} ${hour}:${parts.minute.padStart(2, '0')}`
}
