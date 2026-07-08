const taipeiOffsetHours = 8
const taipeiPayTimePattern =
  /^(\d{4})[-/](\d{2})[-/](\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/

function isValidDatePart(value: number, min: number, max: number) {
  return Number.isInteger(value) && value >= min && value <= max
}

function isUtcDateMatch(date: Date, parts: {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}) {
  return (
    date.getUTCFullYear() === parts.year &&
    date.getUTCMonth() === parts.month - 1 &&
    date.getUTCDate() === parts.day &&
    date.getUTCHours() === parts.hour &&
    date.getUTCMinutes() === parts.minute &&
    date.getUTCSeconds() === parts.second
  )
}

function parseDateWithTimezone(text: string) {
  if (!/(?:Z|[+-]\d{2}:?\d{2})$/i.test(text)) {
    return null
  }

  const date = new Date(text)
  if (Number.isNaN(date.getTime())) {
    return null
  }

  return date.toISOString()
}

export function parseNewebPayTaipeiPayTime(payTime: string | null | undefined): string | null {
  const text = typeof payTime === 'string' ? payTime.trim() : ''
  if (!text) {
    return null
  }

  const withTimezone = parseDateWithTimezone(text)
  if (withTimezone) {
    return withTimezone
  }

  const match = taipeiPayTimePattern.exec(text)
  if (!match) {
    return null
  }

  const [, yearText, monthText, dayText, hourText, minuteText, secondText] = match
  const parts = {
    year: Number(yearText),
    month: Number(monthText),
    day: Number(dayText),
    hour: Number(hourText),
    minute: Number(minuteText),
    second: Number(secondText),
  }

  if (
    !isValidDatePart(parts.month, 1, 12) ||
    !isValidDatePart(parts.day, 1, 31) ||
    !isValidDatePart(parts.hour, 0, 23) ||
    !isValidDatePart(parts.minute, 0, 59) ||
    !isValidDatePart(parts.second, 0, 59)
  ) {
    return null
  }

  const taipeiAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  )
  const date = new Date(taipeiAsUtc - taipeiOffsetHours * 60 * 60 * 1000)

  const reconstructedTaipei = new Date(date.getTime() + taipeiOffsetHours * 60 * 60 * 1000)
  if (!isUtcDateMatch(reconstructedTaipei, parts)) {
    return null
  }

  return date.toISOString()
}
