import type { ChartInput } from '@/features/ziwei-chart/package'

export const AI_CHART_PROFILE_CATEGORY_MAX_LENGTH = 80
export const AI_CHART_PROFILE_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type MemberAiChartProfile = {
  id: string
  category: string
  input: ChartInput
}

export type AiChartProfileRow = {
  id: string
  user_id: string
  category: string
  name: string | null
  gender: string
  solar_date: string
  birth_time: string
  birth_place: string | null
  ziwei_payload: unknown
}

export function normalizeAiChartProfileCategory(value: unknown) {
  if (typeof value !== 'string') return null
  const category = value.trim()
  if (!category || Array.from(category).length > AI_CHART_PROFILE_CATEGORY_MAX_LENGTH) {
    return null
  }
  return category
}

export function normalizeAiChartProfileId(value: unknown) {
  if (typeof value !== 'string') return null
  const id = value.trim()
  return AI_CHART_PROFILE_ID_PATTERN.test(id) ? id : null
}

function readFixLeap(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  return (value as Record<string, unknown>).fixLeap === true
}

export function mapAiChartProfileRow(
  row: AiChartProfileRow,
): MemberAiChartProfile | null {
  const id = normalizeAiChartProfileId(row.id)
  const category = normalizeAiChartProfileCategory(row.category)
  const timeIndex = Number(row.birth_time)
  const birthPlace = row.birth_place?.trim() ?? ''

  if (
    !id ||
    !category ||
    (row.gender !== 'male' && row.gender !== 'female') ||
    !Number.isInteger(timeIndex) ||
    timeIndex < 0 ||
    timeIndex > 12 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(row.solar_date)
  ) {
    return null
  }

  return {
    id,
    category,
    input: {
      solarDate: row.solar_date,
      timeIndex,
      gender: row.gender,
      ...(row.name?.trim() ? { name: row.name.trim() } : {}),
      ...(birthPlace ? { birthPlace } : {}),
      fixLeap: readFixLeap(row.ziwei_payload),
    },
  }
}
