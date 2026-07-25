import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  clearDivinationReadingDrawState,
  clearDivinationReadingSession,
  getDivinationReadingSession,
  setDivinationReadingSession,
  updateDivinationReadingDrawState,
  updateDivinationReadingMerchantOrderNo,
} from './readingSessionMemory'

clearDivinationReadingSession()
assert.equal(getDivinationReadingSession(), null)

setDivinationReadingSession({
  readingId: 'reading-1',
  question: '敏感問題',
  drawMode: 'manual',
  localUserId: 'local-user-1',
  persisted: true,
})
updateDivinationReadingDrawState({
  readingId: 'reading-1',
  question: '敏感問題',
  drawMode: 'manual',
  localUserId: 'local-user-1',
  persisted: true,
  cardId: 'card-1',
  position: 'upright',
})
updateDivinationReadingMerchantOrderNo({
  readingId: 'reading-1',
  merchantOrderNo: 'ORDER-1',
})
assert.equal(getDivinationReadingSession()?.cardId, 'card-1')
assert.equal(getDivinationReadingSession()?.merchantOrderNo, 'ORDER-1')

clearDivinationReadingDrawState('other-reading')
assert.equal(getDivinationReadingSession()?.cardId, 'card-1')
clearDivinationReadingDrawState('reading-1')
assert.equal(getDivinationReadingSession()?.cardId, undefined)

for (const relativePath of [
  'src/lib/divination/readingSessionMemory.ts',
  'src/lib/divination/followUpStorage.ts',
  'src/components/divination/DivinationLocalPreview.tsx',
  'src/components/divination/DivinationDrawStepPage.tsx',
  'src/components/divination/DivinationDrawPreview.tsx',
]) {
  const source = readFileSync(join(process.cwd(), relativePath), 'utf8')
  assert.doesNotMatch(source, /localStorage|sessionStorage/)
}

console.log('divination in-memory private session contract passed')
