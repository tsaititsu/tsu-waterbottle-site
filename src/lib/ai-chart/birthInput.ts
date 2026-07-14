import type { ChartInput } from '@/features/ziwei-chart/package'

export const AI_CHART_BIRTH_INPUT_VERSION = 'ai-chart-birth-input/v1' as const

export type AiChartBirthInputRequest = {
  solarDate: string
  timeIndex: number
  gender: 'male' | 'female'
  name?: string
  fixLeap?: boolean
}

export type CanonicalAiChartBirthInput = {
  version: typeof AI_CHART_BIRTH_INPUT_VERSION
  solarDate: string
  timeIndex: number
  gender: 'male' | 'female'
  name?: string
  fixLeap: boolean
}

export type AiChartBirthInputIssueCode =
  | 'not_object'
  | 'unexpected_field'
  | 'invalid_solar_date'
  | 'invalid_time_index'
  | 'invalid_gender'
  | 'invalid_name'
  | 'invalid_fix_leap'

export type AiChartBirthInputIssue = {
  code: AiChartBirthInputIssueCode
  field?: string
}

export type AiChartBirthInputParseResult =
  | {
      ok: true
      value: CanonicalAiChartBirthInput
    }
  | {
      ok: false
      error: 'invalid_ai_chart_birth_input'
      issues: AiChartBirthInputIssue[]
    }

const SOLAR_DATE_PATTERN = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/
const MIN_SOLAR_DATE = '1900-01-01'
const MAX_SOLAR_DATE = '2100-12-31'
const MAX_NAME_LENGTH = 80

const ALLOWED_FIELDS = new Set(['solarDate', 'timeIndex', 'gender', 'name', 'fixLeap'])

export const AI_CHART_BIRTH_INPUT_REQUEST_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['solarDate', 'timeIndex', 'gender'],
  properties: {
    solarDate: {
      type: 'string',
      pattern: '^[0-9]{4}-[0-9]{2}-[0-9]{2}$',
      format: 'date',
      formatMinimum: MIN_SOLAR_DATE,
      formatMaximum: MAX_SOLAR_DATE,
    },
    timeIndex: {
      type: 'integer',
      minimum: 0,
      maximum: 12,
    },
    gender: {
      type: 'string',
      enum: ['male', 'female'],
    },
    name: {
      type: 'string',
      maxLength: MAX_NAME_LENGTH,
    },
    fixLeap: {
      type: 'boolean',
    },
  },
} as const

function invalidResult(issues: AiChartBirthInputIssue[]): AiChartBirthInputParseResult {
  return {
    ok: false,
    error: 'invalid_ai_chart_birth_input',
    issues,
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false

  try {
    const prototype = Object.getPrototypeOf(value)
    return prototype === Object.prototype || prototype === null
  } catch {
    return false
  }
}

function hasOwnField(value: Record<string, unknown>, field: string) {
  return Object.prototype.hasOwnProperty.call(value, field)
}

function isValidSolarDate(value: unknown): value is string {
  if (typeof value !== 'string') return false

  const match = SOLAR_DATE_PATTERN.exec(value)
  if (!match || value < MIN_SOLAR_DATE || value > MAX_SOLAR_DATE) return false

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

function isValidTimeIndex(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 12
}

function isValidGender(value: unknown): value is 'male' | 'female' {
  return value === 'male' || value === 'female'
}

function parsePlainBirthInput(value: Record<string, unknown>): AiChartBirthInputParseResult {
  const issues: AiChartBirthInputIssue[] = []

  for (const field of Object.keys(value)) {
    if (!ALLOWED_FIELDS.has(field)) {
      issues.push({ code: 'unexpected_field', field })
    }
  }

  let solarDate: string | null = null
  if (isValidSolarDate(value.solarDate)) {
    solarDate = value.solarDate
  } else {
    issues.push({ code: 'invalid_solar_date', field: 'solarDate' })
  }

  let timeIndex: number | null = null
  if (isValidTimeIndex(value.timeIndex)) {
    timeIndex = value.timeIndex
  } else {
    issues.push({ code: 'invalid_time_index', field: 'timeIndex' })
  }

  let gender: 'male' | 'female' | null = null
  if (isValidGender(value.gender)) {
    gender = value.gender
  } else {
    issues.push({ code: 'invalid_gender', field: 'gender' })
  }

  let name: string | undefined
  if (hasOwnField(value, 'name')) {
    if (typeof value.name !== 'string') {
      issues.push({ code: 'invalid_name', field: 'name' })
    } else {
      const normalizedName = value.name.trim()
      if (Array.from(normalizedName).length > MAX_NAME_LENGTH) {
        issues.push({ code: 'invalid_name', field: 'name' })
      } else if (normalizedName) {
        name = normalizedName
      }
    }
  }

  let fixLeap = false
  if (hasOwnField(value, 'fixLeap')) {
    if (typeof value.fixLeap !== 'boolean') {
      issues.push({ code: 'invalid_fix_leap', field: 'fixLeap' })
    } else {
      fixLeap = value.fixLeap
    }
  }

  if (issues.length > 0 || solarDate === null || timeIndex === null || gender === null) {
    return invalidResult(issues)
  }

  return {
    ok: true,
    value: {
      version: AI_CHART_BIRTH_INPUT_VERSION,
      solarDate,
      timeIndex,
      gender,
      ...(name ? { name } : {}),
      fixLeap,
    },
  }
}

export function parseAiChartBirthInput(value: unknown): AiChartBirthInputParseResult {
  if (!isPlainObject(value)) {
    return invalidResult([{ code: 'not_object' }])
  }

  try {
    return parsePlainBirthInput(value)
  } catch {
    return invalidResult([{ code: 'not_object' }])
  }
}

export function toZiweiChartEngineInput(input: CanonicalAiChartBirthInput): ChartInput {
  return {
    solarDate: input.solarDate,
    timeIndex: input.timeIndex,
    gender: input.gender,
    ...(input.name ? { name: input.name } : {}),
    fixLeap: input.fixLeap,
  }
}
