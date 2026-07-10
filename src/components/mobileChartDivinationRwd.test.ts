import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const globals = readFileSync(join(root, 'src/app/globals.css'), 'utf8')
const originalChart = readFileSync(join(root, 'src/features/ziwei-chart/original-chart.css'), 'utf8')
const chartForm = readFileSync(join(root, 'src/components/ChartBirthForm.tsx'), 'utf8')
const divination = readFileSync(join(root, 'src/components/divination/DivinationDrawPreview.tsx'), 'utf8')

// 實際使用中的命盤 DOM grid 必須跟著窄版父層縮小，不依賴頁面裁切。
assert.equal(globals.includes('.original-ziwei-view {\n  max-width: 100%;\n  min-width: 0;'), true)
assert.equal(globals.includes('.original-ziwei-view .chart-wrapper {\n  max-width: 100%;\n  min-width: 0;'), true)
assert.equal(globals.includes('.original-ziwei-view .chart-grid {'), true)
assert.equal(globals.includes('.original-ziwei-view .palace-cell,\n.original-ziwei-view .center-cell {\n  min-width: 0;'), true)
assert.equal(originalChart.includes('grid-template-columns: repeat(4, minmax(0, 1fr))'), true)

// 手機盤面下限：主星 13px、宮位與地支 12px、次要資訊 11px。
assert.equal(globals.includes('--fs-zh-star: 13px'), true)
assert.equal(globals.includes('--fs-zh-small: 12px'), true)
assert.equal(globals.includes('--fs-zh-tiny: 11px'), true)
assert.equal(originalChart.includes('.doctor-label .star-zh { font-size: 11px; }'), true)
assert.equal(originalChart.includes('.native-id .id-zh       { font-size: 12px; }'), true)

// 實際出生資料表單在 iOS 手機維持至少 16px，桌面規則不被改寫。
assert.equal(chartForm.includes('className="chart-birth-form grid min-w-0 max-w-full'), true)
assert.equal(globals.includes(".chart-birth-form input:not([type='checkbox']):not([type='radio'])"), true)
assert.equal(globals.includes('.chart-birth-form select,'), true)
assert.equal(globals.includes('.chart-birth-form textarea {\n    font-size: 16px;'), true)
assert.equal(globals.includes('@media (max-width: 768px)'), true)

// 手動選牌只在自身容器水平捲動，不再撐大父層 grid track。
assert.equal(divination.includes('divination-card-scroller w-full min-w-0 max-w-full'), true)
assert.equal(divination.includes('overflow-x-auto overscroll-x-contain'), true)
assert.equal(divination.includes('flex w-max min-w-full'), true)
assert.equal(divination.includes('shrink-0 rounded-xl'), true)
assert.equal(divination.includes('spreadCardTransforms'), false)
assert.equal(divination.includes('<section className="min-w-0 max-w-full'), true)
assert.equal(divination.includes('<section className="overflow-hidden'), false)

// 手機操作按鈕完整留在容器內，抽牌與付款事件仍走原本 handler。
assert.equal(divination.includes('min-h-11 w-full rounded-full bg-deepPurple'), true)
assert.equal(divination.includes('min-h-11 w-full rounded-full border border-borderSoft'), true)
assert.equal(divination.includes('onClick={() => pickCard(index)}'), true)
assert.equal(divination.includes('onClick={confirmCard}'), true)
assert.equal(divination.includes('handleNewebPayDivinationCheckout'), true)
assert.equal(/right-\[?-/.test(divination), false)

// 不得用全域水平裁切掩蓋命盤或占卜子元素問題。
assert.equal(/(?:html|body)[^{]*\{[^}]*overflow-x:\s*hidden/s.test(globals), false)

console.log('✓ mobile chart and divination RWD source checks passed')
