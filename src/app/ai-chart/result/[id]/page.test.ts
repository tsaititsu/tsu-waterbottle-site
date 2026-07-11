import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const pagePath = path.join(process.cwd(), 'src/app/ai-chart/result/[id]/page.tsx')
const mockPaymentPath = path.join(process.cwd(), 'src/lib/mockPayment.ts')
const actionButtonPath = path.join(process.cwd(), 'src/components/ActionButton.tsx')
const pricingSectionPath = path.join(process.cwd(), 'src/components/PricingSection.tsx')
const sourceRoot = path.join(process.cwd(), 'src')

const pageSource = fs.readFileSync(pagePath, 'utf8')
const mockPaymentSource = fs.readFileSync(mockPaymentPath, 'utf8')
const actionButtonSource = fs.readFileSync(actionButtonPath, 'utf8')
const pricingSectionSource = fs.readFileSync(pricingSectionPath, 'utf8')

function sourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) return sourceFiles(entryPath)
    return /\.(?:ts|tsx)$/.test(entry.name) ? [entryPath] : []
  })
}

const productionSource = sourceFiles(sourceRoot)
  .filter((filePath) => !/\.test\.(?:ts|tsx)$/.test(filePath))
  .map((filePath) => fs.readFileSync(filePath, 'utf8'))
  .join('\n')

assert.equal(pageSource.includes("from '@/lib/mockPayment'"), false)
assert.equal(pageSource.includes('getMockRecordById'), false)
assert.equal(pageSource.includes('localStorage'), false)
assert.equal(pageSource.includes('result-pay-'), false)
assert.equal(pageSource.includes('fallback_mock'), false)
assert.equal(pageSource.includes('analysisParagraphs'), false)
assert.equal(pageSource.includes('OriginalZiweiChartView'), false)

assert.match(pageSource, /isUuid\(resultId\) \? \{ status: 'loading' \} : \{ status: 'invalid_id' \}/)
assert.match(pageSource, /if \(!isUuid\(resultId\)\) \{\s*setDbReportState\(\{ status: 'invalid_id' \}\)\s*return/)
assert.match(pageSource, /fetch\(`\/api\/ai-chart\/reports\/read\?reportId=/)
assert.match(pageSource, /getAuthAccessToken\(\)/)
assert.match(pageSource, /authorization: `Bearer \$\{accessToken\}`/)
assert.equal(pageSource.includes('userId='), false)
assert.match(pageSource, /response\.status === 401/)
assert.match(pageSource, /response\.status === 403 \|\| response\.status === 404/)
assert.match(pageSource, /data\.error === 'unauthorized'/)
assert.match(pageSource, /data\.error === 'forbidden'/)
assert.match(pageSource, /data\.ok && data\.status === 'ready'/)
assert.match(pageSource, /readyDbReport\.reportContent/)
assert.match(pageSource, /status="invalid_id"|status: 'invalid_id'/)
assert.match(pageSource, /title="找不到報告"/)
assert.match(pageSource, /title="付款尚未完成"/)
assert.match(pageSource, /title="分析內容準備中"/)

assert.equal(mockPaymentSource.includes('createMockPayment'), false)
assert.equal(mockPaymentSource.includes('getMockRecordById'), false)
assert.equal(mockPaymentSource.includes('getMockRecords'), false)
assert.equal(mockPaymentSource.includes('appendMockRecord'), false)
assert.equal(mockPaymentSource.includes('waterbottle_mock_records'), false)
assert.equal(productionSource.includes('createMockPayment'), false)
assert.equal(productionSource.includes('result-pay-'), false)

assert.match(actionButtonSource, /'ai-divination': '\/ai-divination'/)
assert.match(actionButtonSource, /'ai-chart': '\/ai-chart'/)
assert.match(actionButtonSource, /booking: '\/booking'/)
assert.match(pricingSectionSource, /href=\{plan\.href\}/)

console.log('✓ AI chart result page only renders trusted server report content')
