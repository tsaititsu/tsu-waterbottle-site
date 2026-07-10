import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const pageSource = readFileSync(
  join(process.cwd(), 'src/app/ai-divination/result/[readingId]/page.tsx'),
  'utf8',
)
const clientSource = readFileSync(
  join(process.cwd(), 'src/app/ai-divination/result/[readingId]/DivinationResultPageClient.tsx'),
  'utf8',
)

assert.equal(pageSource.includes("index: false"), true)
assert.equal(clientSource.includes('/api/account/divination-readings/'), true)
assert.equal(clientSource.includes('/api/divination/interpret'), true)
assert.equal(clientSource.includes('resumeFromDb: true'), true)
assert.equal(clientSource.includes('readingId,'), true)
assert.equal(clientSource.includes('付款完成後會回到這個本次解讀頁'), true)
assert.equal(clientSource.includes('會員紀錄是日後再次觀看入口，不是付款完成當下的主要 landing page'), true)
assert.equal(clientSource.includes('正在確認付款結果'), true)
assert.equal(clientSource.includes('付款完成，正在產生解讀'), true)
assert.equal(clientSource.includes('請不要重新抽牌或重新付款'), true)
assert.equal(clientSource.includes('sessionStorage'), false)

const resumeBodyStart = clientSource.indexOf('body: JSON.stringify({')
const resumeBodyEnd = clientSource.indexOf('}),', resumeBodyStart)
const resumeBodySource = clientSource.slice(resumeBodyStart, resumeBodyEnd > resumeBodyStart ? resumeBodyEnd : undefined)
assert.equal(resumeBodySource.includes('readingId'), true)
assert.equal(resumeBodySource.includes('resumeFromDb: true'), true)
assert.equal(resumeBodySource.includes('question:'), false)
assert.equal(resumeBodySource.includes('cardId:'), false)
assert.equal(resumeBodySource.includes('position:'), false)
assert.equal(resumeBodySource.includes('drawMode:'), false)

console.log('✓ divination result page source checks passed')
