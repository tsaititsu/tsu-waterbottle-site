import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  clearAiChartDraftSession,
  getAiChartDraftNotes,
  getAiChartDraftSession,
  getAiChartDraftWorkspace,
  setAiChartDraftNotes,
  setAiChartDraftSession,
  setAiChartDraftWorkspace,
} from './chartDraftMemory'

const input = {
  solarDate: '1990-01-01',
  timeIndex: 6,
  gender: 'female' as const,
  name: '測試名字',
}

setAiChartDraftSession({
  input,
  chartId: 'chart-1',
  selectedCategory: '自己',
})
assert.equal(getAiChartDraftSession()?.input.name, '測試名字')
clearAiChartDraftSession()
assert.equal(getAiChartDraftSession(), null)

setAiChartDraftNotes({ 'chart-1': '私人筆記' })
const notes = getAiChartDraftNotes()
notes['chart-1'] = '外部修改'
assert.equal(getAiChartDraftNotes()['chart-1'], '私人筆記')

setAiChartDraftWorkspace({
  categories: ['自己'],
  selectedCategory: '自己',
  selectedChartId: 'chart-1',
  charts: { 自己: [{ id: 'chart-1', input }] },
})
const workspace = getAiChartDraftWorkspace()
workspace.charts['自己']![0]!.input.name = '外部修改'
assert.equal(getAiChartDraftWorkspace().charts['自己']?.[0]?.input.name, '測試名字')

for (const relativePath of [
  'src/components/ChartBirthForm.tsx',
  'src/components/ChartResultSessionView.tsx',
  'src/lib/ai-chart/chartDraftMemory.ts',
]) {
  const source = readFileSync(join(process.cwd(), relativePath), 'utf8')
  assert.doesNotMatch(source, /localStorage|sessionStorage/)
}

console.log('AI chart in-memory private draft contract passed')
