import assert from 'node:assert/strict'
import { createZiweiChart as createServerZiweiChart } from '@/features/ziwei-chart/lib/astrolabe/createAstrolabe'
import type { ChartInput as ServerChartInput } from '@/features/ziwei-chart/lib/astrolabe/createAstrolabe'
import {
  createZiweiChart as createBrowserZiweiChart,
  type ZiweiChart as BrowserZiweiChart,
} from '@/features/ziwei-chart/package'

const syntheticInputs: ServerChartInput[] = [
  {
    solarDate: '1990-05-20',
    timeIndex: 6,
    gender: 'female',
    fixLeap: false,
  },
  {
    solarDate: '1990-05-20',
    timeIndex: 6,
    gender: 'female',
    fixLeap: true,
  },
  {
    solarDate: '1988-02-17',
    timeIndex: 0,
    gender: 'male',
    fixLeap: false,
  },
  {
    solarDate: '2001-09-09',
    timeIndex: 12,
    gender: 'female',
    fixLeap: false,
  },
]

function comparableBrowserChart(chart: BrowserZiweiChart) {
  return {
    birthInfo: chart.birthInfo,
    fiveElementsClass: chart.fiveElementsClass,
    palaces: chart.palaces,
  }
}

for (const input of syntheticInputs) {
  const serverChart = createServerZiweiChart(input)
  const browserChart = createBrowserZiweiChart(input)

  assert.deepEqual(
    {
      birthInfo: serverChart.birthInfo,
      fiveElementsClass: serverChart.fiveElementsClass,
      palaces: serverChart.palaces,
    },
    comparableBrowserChart(browserChart),
  )
}

console.log('✓ Server and Browser Ziwei engine parity test source compares all fields except horoscope')
