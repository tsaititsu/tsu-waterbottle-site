import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const source = readFileSync(join(process.cwd(), 'src/app/api/divination/interpret/route.ts'), 'utf8')

assert.equal(source.includes('resumeFromDb'), true)
assert.equal(source.includes('resumePersistedDivinationReadingFromDb'), true)
assert.equal(source.includes('getUserIdFromRequest(input.request)'), true)
assert.equal(source.includes('getDivinationReadingResumeContextForUser(input.readingId, userId)'), true)
assert.equal(source.includes('startDivinationReadingInterpretationIfPaid(reading.id)'), true)
assert.equal(source.includes('updateDivinationReadingDrawSelection'), true)

const persistedStart = source.indexOf('async function interpretPersistedDivinationReading')
const persistedEnd = source.indexOf('async function resumePersistedDivinationReadingFromDb', persistedStart)
const persistedSource = source.slice(persistedStart, persistedEnd > persistedStart ? persistedEnd : undefined)
assert.equal(persistedSource.includes('cardId: input.card.id'), true)
assert.equal(persistedSource.includes('cardName: input.card.name'), true)
assert.equal(persistedSource.indexOf('updateDivinationReadingDrawSelection') < persistedSource.indexOf('paymentRequiredResponse'), true)

const resumeStart = source.indexOf('async function resumePersistedDivinationReadingFromDb')
const resumeEnd = source.indexOf('\nexport async function POST', resumeStart)
const resumeSource = source.slice(resumeStart, resumeEnd > resumeStart ? resumeEnd : undefined)

assert.equal(resumeSource.includes('reading.question'), true)
assert.equal(resumeSource.includes('reading.cardId'), true)
assert.equal(resumeSource.includes('reading.position'), true)
assert.equal(resumeSource.includes('reading.drawMode'), true)
assert.equal(resumeSource.includes('PAYMENT_PENDING'), true)
assert.equal(resumeSource.includes('DIVINATION_READING_INTERPRETING'), true)
assert.equal(resumeSource.includes('already_completed'), true)
assert.equal(resumeSource.includes('markDivinationReadingCompleted'), true)
assert.equal(resumeSource.includes('markDivinationReadingFailed'), true)
assert.equal(resumeSource.includes('process.env.OPENAI_API_KEY'), false)

const resumeBranchStart = source.indexOf('if (isPersistedDivinationReadingsEnabled() && resumeFromDb)')
const resumeBranchEnd = source.indexOf('\n  if (!question)', resumeBranchStart)
const resumeBranchSource = source.slice(resumeBranchStart, resumeBranchEnd > resumeBranchStart ? resumeBranchEnd : undefined)

assert.equal(resumeBranchSource.includes('question'), false)
assert.equal(resumeBranchSource.includes('cardId'), false)
assert.equal(resumeBranchSource.includes('position'), false)
assert.equal(resumeBranchSource.includes('drawMode'), false)

console.log('✓ divination interpret resume route source checks passed')
