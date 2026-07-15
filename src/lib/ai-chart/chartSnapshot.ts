import {
  AI_CHART_BIRTH_INPUT_VERSION,
  type CanonicalAiChartBirthInput,
} from '@/lib/ai-chart/birthInput'
import type {
  EarthlyBranch,
  HeavenlyStem,
  ZiweiChart,
} from '@/features/ziwei-chart/types/ziwei'

export const AI_CHART_SNAPSHOT_VERSION = 'ai-chart-chart-snapshot/v1' as const
export const AI_CHART_ENGINE_NAME = 'waterbottle-ziwei-native' as const
export const AI_CHART_ENGINE_VERSION = 'v1' as const

export type CanonicalAiChartStarSnapshot = {
  name: string
  type:
    | 'major'
    | 'soft'
    | 'tough'
    | 'adjective'
    | 'flower'
    | 'helper'
    | 'lucun'
    | 'tianma'
  scope: 'origin'
  brightness?: string
  mutagen?: '化祿' | '化權' | '化科' | '化忌'
  group?: 'doctor' | 'suiqian' | 'nianzhi'
}

export type CanonicalAiChartPalaceSnapshot = {
  index: number
  name: string
  isMingPalace: boolean
  isBodyPalace: boolean
  heavenlyStem: HeavenlyStem
  earthlyBranch: EarthlyBranch
  majorStars: CanonicalAiChartStarSnapshot[]
  minorStars: CanonicalAiChartStarSnapshot[]
  adjectiveStars: CanonicalAiChartStarSnapshot[]
  decadal: {
    range: [number, number]
    heavenlyStem: HeavenlyStem
    earthlyBranch: EarthlyBranch
  }
  ages: number[]
}

export type CanonicalAiChartSnapshot = {
  version: typeof AI_CHART_SNAPSHOT_VERSION
  source: typeof AI_CHART_ENGINE_NAME
  engineVersion: typeof AI_CHART_ENGINE_VERSION
  birthInputVersion: typeof AI_CHART_BIRTH_INPUT_VERSION
  lunarDate: string
  fiveElementsClass: string
  palaces: CanonicalAiChartPalaceSnapshot[]
}

const HEAVENLY_STEMS = new Set<unknown>(['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'])
const EARTHLY_BRANCHES = new Set<unknown>([
  '子',
  '丑',
  '寅',
  '卯',
  '辰',
  '巳',
  '午',
  '未',
  '申',
  '酉',
  '戌',
  '亥',
])
const STAR_TYPES = new Set<unknown>([
  'major',
  'soft',
  'tough',
  'adjective',
  'flower',
  'helper',
  'lucun',
  'tianma',
])
const MUTAGENS = new Set<unknown>(['化祿', '化權', '化科', '化忌'])
const STAR_GROUPS = new Set<unknown>(['doctor', 'suiqian', 'nianzhi'])
const FORBIDDEN_FIELD_NAMES = new Set([
  'horoscope',
  'chartContext',
  'keyPalaces',
  'mutagenSummary',
  'sanFangSiZheng',
  'messages',
  'prompt',
  'responseSchema',
  'openAiRequest',
  'openAiResponse',
  'solarDate',
  'timeIndex',
  'gender',
  'fixLeap',
])

type PlainRecord = Record<string, unknown>

function invariantFailed(): never {
  throw new Error('ai_chart_snapshot_invariant_failed')
}

function isPlainObject(value: unknown): value is PlainRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false

  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isHeavenlyStem(value: unknown): value is HeavenlyStem {
  return HEAVENLY_STEMS.has(value)
}

function isEarthlyBranch(value: unknown): value is EarthlyBranch {
  return EARTHLY_BRANCHES.has(value)
}

function isStarType(value: unknown): value is CanonicalAiChartStarSnapshot['type'] {
  return STAR_TYPES.has(value)
}

function isMutagen(value: unknown): value is NonNullable<CanonicalAiChartStarSnapshot['mutagen']> {
  return MUTAGENS.has(value)
}

function isStarGroup(value: unknown): value is NonNullable<CanonicalAiChartStarSnapshot['group']> {
  return STAR_GROUPS.has(value)
}

function buildStarSnapshot(value: unknown): CanonicalAiChartStarSnapshot {
  if (!isPlainObject(value)) invariantFailed()

  const { name, type, scope, brightness, mutagen, group } = value
  if (!isNonBlankString(name) || !isStarType(type) || scope !== 'origin') invariantFailed()
  if (brightness !== undefined && !isNonBlankString(brightness)) invariantFailed()
  if (mutagen !== undefined && !isMutagen(mutagen)) invariantFailed()
  if (group !== undefined && !isStarGroup(group)) invariantFailed()

  return {
    name,
    type,
    scope: 'origin',
    ...(brightness !== undefined ? { brightness } : {}),
    ...(mutagen !== undefined ? { mutagen } : {}),
    ...(group !== undefined ? { group } : {}),
  }
}

function buildStarSnapshots(value: unknown): CanonicalAiChartStarSnapshot[] {
  if (!Array.isArray(value)) invariantFailed()
  return value.map((star) => buildStarSnapshot(star))
}

function buildPalaceSnapshot(value: unknown): CanonicalAiChartPalaceSnapshot {
  if (!isPlainObject(value)) invariantFailed()

  const {
    index,
    name,
    isOriginalPalace,
    isBodyPalace,
    heavenlyStem,
    earthlyBranch,
    decadal,
    ages,
  } = value

  if (!Number.isInteger(index) || !isNonBlankString(name)) invariantFailed()
  if (typeof isOriginalPalace !== 'boolean' || typeof isBodyPalace !== 'boolean') invariantFailed()
  if (!isHeavenlyStem(heavenlyStem) || !isEarthlyBranch(earthlyBranch)) invariantFailed()
  if (!isPlainObject(decadal) || !Array.isArray(decadal.range) || decadal.range.length !== 2) {
    invariantFailed()
  }

  const [rangeStart, rangeEnd] = decadal.range
  if (
    !Number.isInteger(rangeStart) ||
    !Number.isInteger(rangeEnd) ||
    (rangeStart as number) > (rangeEnd as number) ||
    !isHeavenlyStem(decadal.heavenlyStem) ||
    !isEarthlyBranch(decadal.earthlyBranch)
  ) {
    invariantFailed()
  }

  if (!Array.isArray(ages) || !ages.every((age) => Number.isInteger(age))) invariantFailed()

  return {
    index: index as number,
    name,
    isMingPalace: isOriginalPalace,
    isBodyPalace,
    heavenlyStem,
    earthlyBranch,
    majorStars: buildStarSnapshots(value.majorStars),
    minorStars: buildStarSnapshots(value.minorStars),
    adjectiveStars: buildStarSnapshots(value.adjectiveStars),
    decadal: {
      range: [rangeStart as number, rangeEnd as number],
      heavenlyStem: decadal.heavenlyStem,
      earthlyBranch: decadal.earthlyBranch,
    },
    ages: [...(ages as number[])],
  }
}

function assertSerializableSnapshot(value: unknown) {
  const seen = new Set<object>()

  function visit(current: unknown): void {
    if (typeof current === 'string' || typeof current === 'boolean') return
    if (typeof current === 'number') {
      if (!Number.isFinite(current)) invariantFailed()
      return
    }

    if (typeof current !== 'object' || current === null) invariantFailed()
    if (seen.has(current)) invariantFailed()
    seen.add(current)

    if (Array.isArray(current)) {
      for (const item of current) visit(item)
      seen.delete(current)
      return
    }

    if (!isPlainObject(current) || Object.getOwnPropertySymbols(current).length > 0) {
      invariantFailed()
    }

    for (const [key, item] of Object.entries(current)) {
      if (FORBIDDEN_FIELD_NAMES.has(key)) invariantFailed()
      visit(item)
    }

    seen.delete(current)
  }

  visit(value)

  const serialized = JSON.stringify(value)
  const roundTripped = JSON.parse(serialized) as unknown
  if (JSON.stringify(roundTripped) !== serialized) invariantFailed()
}

function buildSnapshot(
  birthInput: CanonicalAiChartBirthInput,
  chart: ZiweiChart,
): CanonicalAiChartSnapshot {
  if (birthInput.version !== AI_CHART_BIRTH_INPUT_VERSION || !isPlainObject(chart)) {
    invariantFailed()
  }

  if (!isPlainObject(chart.birthInfo)) invariantFailed()
  if (
    chart.birthInfo.solarDate !== birthInput.solarDate ||
    chart.birthInfo.timeIndex !== birthInput.timeIndex ||
    chart.birthInfo.gender !== birthInput.gender ||
    !isNonBlankString(chart.birthInfo.lunarDate) ||
    !isNonBlankString(chart.fiveElementsClass) ||
    !Array.isArray(chart.palaces) ||
    chart.palaces.length !== 12
  ) {
    invariantFailed()
  }

  const palaces = chart.palaces
    .map((palace) => buildPalaceSnapshot(palace))
    .sort((left, right) => left.index - right.index)

  if (!palaces.every((palace, index) => palace.index === index)) invariantFailed()
  if (new Set(palaces.map((palace) => palace.earthlyBranch)).size !== 12) invariantFailed()
  if (new Set(palaces.map((palace) => palace.name)).size !== 12) invariantFailed()
  if (palaces.filter((palace) => palace.isMingPalace).length !== 1) invariantFailed()
  if (palaces.filter((palace) => palace.isBodyPalace).length !== 1) invariantFailed()

  const snapshot: CanonicalAiChartSnapshot = {
    version: AI_CHART_SNAPSHOT_VERSION,
    source: AI_CHART_ENGINE_NAME,
    engineVersion: AI_CHART_ENGINE_VERSION,
    birthInputVersion: AI_CHART_BIRTH_INPUT_VERSION,
    lunarDate: chart.birthInfo.lunarDate,
    fiveElementsClass: chart.fiveElementsClass,
    palaces,
  }

  assertSerializableSnapshot(snapshot)
  return snapshot
}

export function buildCanonicalAiChartSnapshot(
  birthInput: CanonicalAiChartBirthInput,
  chart: ZiweiChart,
): CanonicalAiChartSnapshot {
  try {
    return buildSnapshot(birthInput, chart)
  } catch {
    invariantFailed()
  }
}

function copyStarSnapshot(star: CanonicalAiChartStarSnapshot): CanonicalAiChartStarSnapshot {
  return {
    name: star.name,
    type: star.type,
    scope: 'origin',
    ...(star.brightness !== undefined ? { brightness: star.brightness } : {}),
    ...(star.mutagen !== undefined ? { mutagen: star.mutagen } : {}),
    ...(star.group !== undefined ? { group: star.group } : {}),
  }
}

export function copyCanonicalAiChartSnapshot(
  snapshot: CanonicalAiChartSnapshot,
): CanonicalAiChartSnapshot {
  try {
    const copy: CanonicalAiChartSnapshot = {
      version: snapshot.version,
      source: snapshot.source,
      engineVersion: snapshot.engineVersion,
      birthInputVersion: snapshot.birthInputVersion,
      lunarDate: snapshot.lunarDate,
      fiveElementsClass: snapshot.fiveElementsClass,
      palaces: snapshot.palaces.map((palace) => ({
        index: palace.index,
        name: palace.name,
        isMingPalace: palace.isMingPalace,
        isBodyPalace: palace.isBodyPalace,
        heavenlyStem: palace.heavenlyStem,
        earthlyBranch: palace.earthlyBranch,
        majorStars: palace.majorStars.map(copyStarSnapshot),
        minorStars: palace.minorStars.map(copyStarSnapshot),
        adjectiveStars: palace.adjectiveStars.map(copyStarSnapshot),
        decadal: {
          range: [palace.decadal.range[0], palace.decadal.range[1]],
          heavenlyStem: palace.decadal.heavenlyStem,
          earthlyBranch: palace.decadal.earthlyBranch,
        },
        ages: [...palace.ages],
      })),
    }

    assertSerializableSnapshot(copy)
    return copy
  } catch {
    invariantFailed()
  }
}
