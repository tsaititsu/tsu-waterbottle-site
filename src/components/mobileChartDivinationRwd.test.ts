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

// 手動選牌沿用 ziwei-card 的完整 14 張橢圓扇形，不再拆成五張分頁。
assert.equal(divination.includes('mobile-card-fan-stage relative -mx-5 flex h-[260px]'), true)
assert.equal(divination.includes('w-[calc(100%+2.5rem)] min-w-0 items-center justify-center'), true)
assert.equal(divination.includes('const angle = -55 + index * (110 / (ziweiCards.length - 1))'), true)
assert.equal(divination.includes('getEllipticalFanTransform(index, 150, 78, isPicked)'), true)
assert.equal(divination.includes('getEllipticalFanTransform(index, 340, 130, isPicked)'), true)
assert.equal(divination.includes('Math.sin((angle * Math.PI) / 180) * radius'), true)
assert.equal(divination.includes('-Math.cos((angle * Math.PI) / 180) * yRadius + 65 - (isPicked ? 72 : 0)'), true)
assert.equal(divination.includes('rotate(${angle / 3}deg)'), true)
assert.equal(divination.includes('group absolute h-[100px] w-[72px]'), true)
assert.equal(divination.includes('data-mobile-fan-index={index}'), true)
assert.equal(divination.includes('getMobileFanTransform(index, pendingIndex === index)'), true)
assert.equal(divination.includes('zIndex: pendingIndex === index ? 100 : index + 1'), true)
assert.equal(divination.includes('mobile-card-fan-visual'), true)
assert.equal(divination.includes('desktop-card-fan-stage relative hidden h-[380px]'), true)
assert.equal(divination.includes('group absolute h-[173px] w-[125px]'), true)
assert.equal(divination.includes('getDesktopFanTransform(index, pendingIndex === index)'), true)
assert.equal(divination.includes('zIndex: pendingIndex === index ? 300'), true)
assert.equal(divination.includes('data-selected={pendingIndex === index ? "true" : "false"}'), true)
assert.equal(divination.includes('pendingIndex !== null || shuffling || isInterpreting'), true)
assert.equal(divination.includes('你選中的牌已停在上方。請確認是不是這張，再繼續解讀。'), true)
assert.equal(divination.includes('就是這張，開始解讀'), true)
assert.equal(divination.includes(') : pendingIndex === null ? ('), false)
assert.equal(divination.includes('getMobileFanPages'), false)
assert.equal(divination.includes('mobileFanPageSize'), false)
assert.equal(divination.includes('snap-x snap-mandatory'), false)
assert.equal(divination.includes('min-w-max'), false)
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
