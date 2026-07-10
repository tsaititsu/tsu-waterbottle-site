import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { getDivinationReadingAction } from './getDivinationReadingAction'

const readingId = 'a2e3c86a-d6e2-424e-9a37-48cef981b3b1'

assert.deepEqual(getDivinationReadingAction(readingId, 'paid'), {
  label: '繼續產生解讀',
  href: `/ai-divination/result/${readingId}?payment=success`,
})
assert.deepEqual(getDivinationReadingAction(readingId, 'interpreting'), {
  label: '查看解讀進度',
  href: `/ai-divination/result/${readingId}`,
})
assert.deepEqual(getDivinationReadingAction(readingId, 'completed'), {
  label: '查看解讀',
  href: `/account/divinations/${readingId}`,
})
assert.equal(getDivinationReadingAction(readingId, 'pending_payment'), null)
assert.equal(getDivinationReadingAction(readingId, 'failed'), null)

const pageSource = readFileSync(join(process.cwd(), 'src/app/account/divinations/page.tsx'), 'utf8')
const actionSource = readFileSync(
  join(process.cwd(), 'src/app/account/divinations/DivinationReadingAction.tsx'),
  'utf8',
)
const layoutSource = readFileSync(join(process.cwd(), 'src/app/layout.tsx'), 'utf8')
const globalsSource = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8')
assert.equal(pageSource.includes('<DivinationReadingAction'), true)
assert.equal(pageSource.includes('readingId={reading.id}'), true)
assert.equal(pageSource.includes('status={reading.status}'), true)
assert.equal(pageSource.includes("cache: 'no-store'"), true)
assert.equal(pageSource.includes("addEventListener('pageshow'"), true)
assert.equal(pageSource.includes("addEventListener('visibilitychange'"), true)
assert.equal(actionSource.includes('getDivinationReadingAction'), true)
assert.equal(actionSource.includes('hasInterpretation'), false)
assert.equal(actionSource.includes('尚未完成付款。'), true)
assert.equal(actionSource.includes('再次付款'), true)
assert.equal(actionSource.includes('min-h-11'), true)
assert.equal(actionSource.includes('w-full'), true)
assert.equal(actionSource.includes('sm:w-fit'), true)
assert.equal(actionSource.includes('hidden'), false)
assert.equal(layoutSource.includes('className="site-main"'), true)
assert.equal(globalsSource.includes('var(--mobile-bottom-nav-height)'), true)
assert.equal(globalsSource.includes('env(safe-area-inset-bottom, 0px)'), true)

console.log('✓ account divination reading actions passed')
