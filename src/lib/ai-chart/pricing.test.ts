import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  AI_CHART_REPORT_PRICE_LABEL,
  AI_CHART_REPORT_PRICE_TWD,
} from './pricing'
import { AI_CHART_REPORT_AMOUNT_TWD } from '@/lib/newebpay/aiChartPayment'

assert.equal(AI_CHART_REPORT_PRICE_TWD, 600)
assert.equal(AI_CHART_REPORT_PRICE_LABEL, 'NT$600')
assert.equal(AI_CHART_REPORT_AMOUNT_TWD, AI_CHART_REPORT_PRICE_TWD)
const reportsSource = readFileSync(
  join(process.cwd(), 'src/lib/supabase/aiChartReports.ts'),
  'utf8',
)
assert.equal(reportsSource.includes('AI_CHART_REPORT_PRICE_TWD'), true)
assert.equal(reportsSource.includes('AI_CHART_REPORT_DEFAULT_AMOUNT_TWD = 100'), false)

console.log('✓ AI chart price is consistently NT$600')
