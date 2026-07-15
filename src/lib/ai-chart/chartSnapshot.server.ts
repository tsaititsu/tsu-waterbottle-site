import { createZiweiChart } from '@/features/ziwei-chart/lib/astrolabe/createAstrolabe'
import {
  toZiweiChartEngineInput,
  type CanonicalAiChartBirthInput,
} from '@/lib/ai-chart/birthInput'
import {
  buildCanonicalAiChartSnapshot,
  type CanonicalAiChartSnapshot,
} from '@/lib/ai-chart/chartSnapshot'

export function createCanonicalAiChartSnapshot(
  birthInput: CanonicalAiChartBirthInput,
): CanonicalAiChartSnapshot {
  const chart = createZiweiChart(toZiweiChartEngineInput(birthInput))
  return buildCanonicalAiChartSnapshot(birthInput, chart)
}
