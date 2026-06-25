export type DefaultBookingSlot = {
  id: string
  startAt: string
  endAt: string
}

export const defaultBookingSlotTimes = ['13:00', '15:00', '17:00'] as const
export const defaultBookingSlotDurationMinutes = 60
export const defaultBookingSlotWindowDays = 90

function parseDefaultSlotId(slotId: string) {
  const prefix = 'default:'
  if (!slotId.startsWith(prefix)) return null

  const payload = slotId.slice(prefix.length)
  const isoLength = '2026-01-01T00:00:00.000Z'.length
  if (payload.length !== isoLength * 2 + 1 || payload[isoLength] !== ':') return null

  return {
    startAt: payload.slice(0, isoLength),
    endAt: payload.slice(isoLength + 1),
  }
}

function getTaipeiDateValue(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${lookup.year}-${lookup.month}-${lookup.day}`
}

function addDaysToDateValue(dateValue: string, days: number) {
  const [year, month, day] = dateValue.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + days))
  return date.toISOString().slice(0, 10)
}

function taipeiDateTimeToIso(dateValue: string, timeValue: string) {
  return new Date(`${dateValue}T${timeValue}:00+08:00`).toISOString()
}

function addMinutesToIso(isoValue: string, minutes: number) {
  const date = new Date(isoValue)
  date.setMinutes(date.getMinutes() + minutes)
  return date.toISOString()
}

export function createDefaultBookingSlotId(startAt: string, endAt: string) {
  return `default:${startAt}:${endAt}`
}

export function createDefaultBookingSlotForDateTime(dateValue: string, timeValue: string): DefaultBookingSlot {
  const startAt = taipeiDateTimeToIso(dateValue, timeValue)
  const endAt = addMinutesToIso(startAt, defaultBookingSlotDurationMinutes)

  return {
    id: createDefaultBookingSlotId(startAt, endAt),
    startAt,
    endAt,
  }
}

export function listDefaultBookingSlots(now = new Date(), windowDays = defaultBookingSlotWindowDays) {
  const todayTaipei = getTaipeiDateValue(now)
  const slots: DefaultBookingSlot[] = []

  for (let offset = 1; offset <= windowDays; offset += 1) {
    const dateValue = addDaysToDateValue(todayTaipei, offset)
    for (const timeValue of defaultBookingSlotTimes) {
      slots.push(createDefaultBookingSlotForDateTime(dateValue, timeValue))
    }
  }

  return slots.filter((slot) => new Date(slot.startAt).getTime() >= now.getTime() + 24 * 60 * 60 * 1000)
}

export function resolveDefaultBookingSlotId(slotId: string, now = new Date()) {
  const parsed = parseDefaultSlotId(slotId)
  if (!parsed) return null

  const legalSlot = listDefaultBookingSlots(now).find((slot) => slot.startAt === parsed.startAt && slot.endAt === parsed.endAt)
  return legalSlot ?? null
}
