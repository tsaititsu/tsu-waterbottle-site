import type { CSSProperties } from 'react'

export type HeavenlyStem = '甲' | '乙' | '丙' | '丁' | '戊' | '己' | '庚' | '辛' | '壬' | '癸'
export type EarthlyBranch = '子' | '丑' | '寅' | '卯' | '辰' | '巳' | '午' | '未' | '申' | '酉' | '戌' | '亥'
export type MutagenType = '化祿' | '化權' | '化科' | '化忌'

export type ChartInput = {
  solarDate: string
  timeIndex: number
  gender: 'male' | 'female'
  name?: string
  fixLeap?: boolean
}

export type StarInfo = {
  name: string
  type: 'major' | 'soft' | 'tough' | 'adjective' | 'flower' | 'helper' | 'lucun' | 'tianma'
  scope: 'origin' | 'decadal' | 'yearly' | 'monthly' | 'daily'
  brightness?: string
  mutagen?: MutagenType
  group?: 'doctor' | 'suiqian' | 'nianzhi'
}

export type ZiweiPalace = {
  index: number
  name: string
  isBodyPalace: boolean
  isOriginalPalace: boolean
  heavenlyStem: HeavenlyStem
  earthlyBranch: EarthlyBranch
  majorStars: StarInfo[]
  minorStars: StarInfo[]
  adjectiveStars: StarInfo[]
  decadal: {
    range: [number, number]
    heavenlyStem: HeavenlyStem
    earthlyBranch: EarthlyBranch
  }
  ages: number[]
}

export type ZiweiChart = {
  birthInfo: {
    solarDate: string
    lunarDate: string
    timeIndex: number
    gender: 'male' | 'female'
    name: string
  }
  fiveElementsClass: string
  palaces: ZiweiPalace[]
  horoscope: (queryDate?: Date) => unknown
}

export type ZiweiGptChartContext = {
  version: 'ziwei-gpt-context/v1'
  source: 'ziwei-chart-package'
  birthInfo: {
    solarDate: string
    lunarDate: string
    timeIndex: number
    gender: 'male' | 'female'
    name?: string
  }
  fiveElementsClass: string
  keyPalaces: unknown
  mutagenSummary: unknown[]
  sanFangSiZheng: unknown
  palaces: unknown[]
}

export type ZiweiGptPayload = {
  chart: ZiweiChart
  chartContext: ZiweiGptChartContext
  messages: Array<{ role: 'system' | 'user'; content: string }>
  responseSchema: unknown
}

export type ZiweiChartEmbedProps = {
  chart: ZiweiChart
  className?: string
  style?: CSSProperties
}

export function createZiweiChart(input: ChartInput): ZiweiChart
export function createZiweiGptPayload(input: ChartInput): ZiweiGptPayload
export function toGptChartContext(chart: ZiweiChart): ZiweiGptChartContext
export function ZiweiChartEmbed(props: ZiweiChartEmbedProps): JSX.Element

