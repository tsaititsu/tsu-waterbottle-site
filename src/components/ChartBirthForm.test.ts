import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const source = readFileSync(join(process.cwd(), 'src/components/ChartBirthForm.tsx'), 'utf8')

assert.equal(source.includes('雙胞胎／多胞胎命盤請點這裡'), true)
assert.equal(source.includes('若為第二胎以上，請選擇出生順序；第一胎與非多胞胎可直接略過。'), true)
assert.equal(source.includes('多胞胎功能 · 測試中 Beta'), false)
assert.equal(source.includes("const birthOrders = ['第二胎', '第三胎', '第四胎']"), true)

assert.equal(source.includes('const [isTwinOptionsOpen, setIsTwinOptionsOpen] = useState(false)'), true)
assert.equal(source.includes('aria-controls="twin-birth-order-options"'), true)
assert.equal(source.includes('aria-expanded={isTwinOptionsOpen}'), true)
assert.equal(source.includes('id="twin-birth-order-options"'), true)
assert.equal(source.includes('{isTwinOptionsOpen && ('), true)
assert.equal(source.includes('{birthOrders.map((order) => ('), true)

assert.equal(source.includes("onClick={() => setIsTwinOptionsOpen((current) => !current)}"), true)
assert.equal(source.includes("onClick={() => setSelectedBirthOrder((current) => (current === order ? '' : order))}"), true)
assert.equal(source.includes('{selectedBirthOrder && !isTwinOptionsOpen && ('), true)
assert.equal(source.includes('已選擇：{selectedBirthOrder}'), true)

const resetStart = source.indexOf('const resetFormToBlank = useCallback(() => {')
const resetEnd = source.indexOf('  }, [])', resetStart)
const resetSource = source.slice(resetStart, resetEnd)
assert.equal(resetSource.includes("setSelectedBirthOrder('')"), true)
assert.equal(resetSource.includes('setIsTwinOptionsOpen(false)'), true)

assert.equal(source.includes('setAiChartDraftSession'), true)
assert.equal(source.includes('setAiChartDraftWorkspace'), true)
assert.equal(source.includes('localStorage'), false)
assert.equal(source.includes('sessionStorage'), false)
assert.equal(source.includes('birthOrder: selectedBirthOrder'), true)
assert.equal(source.includes('const generateChart = () => {'), true)
assert.equal(source.includes('const payload = createZiweiGptPayload(result.input)'), true)
assert.equal(source.includes("router.push('/ai-chart/result')"), true)

console.log('✓ ChartBirthForm twin birth-order disclosure contract passed')
