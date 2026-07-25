import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const sources = [
  'src/app/account/page.tsx',
  'src/app/account/divinations/page.tsx',
  'src/app/account/divinations/[id]/page.tsx',
  'src/app/ai-divination/result/[readingId]/DivinationResultPageClient.tsx',
]

for (const file of sources) {
  const source = readFileSync(join(root, file), 'utf8')
  assert.match(source, /requestGenerationRef/)
  assert.match(source, /getMockUser\(\)\?\.id/)
  assert.match(source, /setReading\(null\)|setReadings\(\[\]\)|setPurchasedCourseIds\(\[\]\)/)
}

const detailSource = readFileSync(
  join(root, 'src/app/account/divinations/[id]/page.tsx'),
  'utf8',
)
assert.match(detailSource, /requestedReadingId/)
assert.match(detailSource, /requestGenerationRef\.current === requestGeneration/)

const resultSource = readFileSync(
  join(root, 'src/app/ai-divination/result/[readingId]/DivinationResultPageClient.tsx'),
  'utf8',
)
assert.match(resultSource, /activeReadingIdRef\.current === expectedReadingId/)
assert.match(resultSource, /activeUserIdRef\.current === expectedUser\?\.id/)
assert.match(resultSource, /resumeGenerationRef/)

const authSource = readFileSync(join(root, 'src/lib/mockAuth.ts'), 'utf8')
const legacyLoader = authSource.match(
  /function getLegacyMockUser\(\): UserProfile \| null \{([\s\S]*?)\n\}/,
)?.[1]
assert.ok(legacyLoader)
assert.doesNotMatch(legacyLoader, /JSON\.parse/)
assert.match(legacyLoader, /removeItem\(LEGACY_USER_KEY\)/)

console.log('private-page request identity and legacy browser storage contracts passed')
