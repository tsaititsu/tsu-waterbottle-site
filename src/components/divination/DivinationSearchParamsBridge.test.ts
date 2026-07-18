import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

type FollowUpStorageModule = typeof import('../../lib/divination/followUpStorage')

const followUpStorage = (await import(
  new URL('../../lib/divination/followUpStorage.ts', import.meta.url).href
)) as FollowUpStorageModule

const {
  DIVINATION_FOLLOW_UP_ACTIVE_THREAD_ID_STORAGE_KEY,
  DIVINATION_FOLLOW_UP_DRAFT_STORAGE_KEY,
  clearDivinationFollowUpDisplayThread,
  clearDivinationFollowUpDraft,
  getDivinationFollowUpThreadStorageKey,
  loadDivinationFollowUpDisplayThread,
  loadDivinationFollowUpDraft,
} = followUpStorage

const projectRoot = process.cwd()

function readSource(relativePath: string) {
  return readFileSync(join(projectRoot, relativePath), 'utf8')
}

function extractEffect(source: string, dependency: 'resetKey' | 'followUpKey') {
  const effect = source.match(
    new RegExp(`useEffect\\(\\(\\) => \\{([\\s\\S]*?)\\n  \\}, \\[${dependency}\\]\\)`),
  )

  assert.ok(effect, `expected an effect whose only dependency is ${dependency}`)
  return effect[1]
}

function occurrenceCount(source: string, pattern: RegExp) {
  return source.match(pattern)?.length ?? 0
}

class FakeStorage {
  private data = new Map<string, string>()

  get length() {
    return this.data.size
  }

  clear() {
    this.data.clear()
  }

  getItem(key: string) {
    return this.data.get(key) ?? null
  }

  key(index: number) {
    return [...this.data.keys()][index] ?? null
  }

  removeItem(key: string) {
    this.data.delete(key)
  }

  setItem(key: string, value: string) {
    this.data.set(key, value)
  }
}

async function withFakeSessionStorage(
  run: (storage: FakeStorage) => Promise<void> | void,
) {
  const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const storage = new FakeStorage()

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    writable: true,
    value: { sessionStorage: storage },
  })

  try {
    await run(storage)
  } finally {
    if (originalWindowDescriptor) {
      Object.defineProperty(globalThis, 'window', originalWindowDescriptor)
    } else {
      Reflect.deleteProperty(globalThis, 'window')
    }
  }
}

const canonicalDraftStorageKey = 'divination_follow_up_draft'
const canonicalActiveThreadIdStorageKey = 'divination_follow_up_active_thread_id'
const canonicalThreadStoragePrefix = 'divination_follow_up_thread:'
const threadId = 'codex-thread-fixture'
const canonicalSyntheticThreadStorageKey = `${canonicalThreadStoragePrefix}${threadId}`
const readingId = 'codex-reading-fixture'
const question = 'synthetic-question'
const finalAnswer = 'synthetic-answer'
const createdAt = '1970-01-01T00:00:00.000Z'
const unrelatedSyntheticKey = 'codex-unrelated-session-fixture'

const syntheticDraft = {
  threadId,
  parentReadingId: readingId,
  previousReadings: [
    {
      readingId,
      question,
      answerSummary: finalAnswer,
      finalAnswer,
      createdAt,
    },
  ],
  createdAt,
}

const syntheticDisplayThread = {
  threadId,
  readings: [
    {
      readingId,
      question,
      finalAnswer,
      createdAt,
    },
  ],
  updatedAt: createdAt,
}

test('ai-divination page keeps query parsing out of the Server Page shell', () => {
  const pageSource = readSource('src/app/ai-divination/page.tsx')

  assert.match(pageSource, /export default function AiDivinationPage\(\)/)
  assert.doesNotMatch(pageSource, /\bsearchParams\b/)
  assert.doesNotMatch(pageSource, /\bawait\s+searchParams\b/)
  assert.doesNotMatch(pageSource, /\b(?:resetKey|followUpKey)\b/)
  assert.match(
    pageSource,
    /<Suspense\s+fallback=\{null\}>\s*<DivinationSearchParamsBridge\s*\/>\s*<\/Suspense>/,
  )
})

test('client bridge maps reset and followUp query keys to their matching preview props', () => {
  const bridgeSource = readSource(
    'src/components/divination/DivinationSearchParamsBridge.tsx',
  )

  assert.match(bridgeSource, /const searchParams = useSearchParams\(\)/)
  assert.match(
    bridgeSource,
    /const resetKey = searchParams\.get\(['"]reset['"]\) \?\? (['"])\1/,
  )
  assert.match(
    bridgeSource,
    /const followUpKey = searchParams\.get\(['"]followUp['"]\) \?\? (['"])\1/,
  )
  assert.match(
    bridgeSource,
    /<DivinationLocalPreview\s+resetKey=\{resetKey\}\s+followUpKey=\{followUpKey\}\s*\/>/,
  )
  assert.doesNotMatch(bridgeSource, /resetKey=\{followUpKey\}|followUpKey=\{resetKey\}/)
})

test('reset effect clears every reading and gates follow-up cleanup behind a non-empty resetKey', () => {
  const previewSource = readSource(
    'src/components/divination/DivinationLocalPreview.tsx',
  )
  const resetEffect = extractEffect(previewSource, 'resetKey')
  const resetConditionIndex = resetEffect.indexOf('if (resetKey)')
  const resetCondition = resetEffect.match(/if \(resetKey\) \{([\s\S]*?)\n    \}/)

  assert.notEqual(resetConditionIndex, -1, 'follow-up cleanup must require a non-empty resetKey')
  assert.ok(resetCondition, 'expected a non-empty resetKey cleanup block')
  assert.match(resetEffect.slice(0, resetConditionIndex), /clearReadingSession\(\)/)
  assert.doesNotMatch(resetCondition[1], /clearReadingSession\(\)/)
  assert.match(resetCondition[1], /clearDivinationFollowUpDraft\(\)/)
  assert.match(resetCondition[1], /clearDivinationFollowUpDisplayThread\(\)/)
  assert.equal(occurrenceCount(resetEffect, /clearReadingSession\(\)/g), 1)
  assert.equal(occurrenceCount(resetEffect, /clearDivinationFollowUpDraft\(\)/g), 1)
  assert.equal(
    occurrenceCount(resetEffect, /clearDivinationFollowUpDisplayThread\(\)/g),
    1,
  )
  assert.match(
    previewSource,
    /<DivinationQuestionForm\s+key=\{resetKey \|\| ['"]initial['"]\}\s+onQuestionSubmit=\{handleQuestionSubmit\}/,
  )
})

test('followUp effect resets empty state and reloads draft plus its matching display thread', () => {
  const previewSource = readSource(
    'src/components/divination/DivinationLocalPreview.tsx',
  )
  const followUpEffect = extractEffect(previewSource, 'followUpKey')
  const emptyBranch = followUpEffect.match(
    /if \(!followUpKey\) \{([\s\S]*?)\n      return\s*\n    \}/,
  )

  assert.ok(emptyBranch, 'expected an explicit empty followUpKey branch')
  assert.match(emptyBranch[1], /setFollowUpDraft\(null\)/)
  assert.match(emptyBranch[1], /setFollowUpDisplayThread\(null\)/)
  assert.match(
    followUpEffect,
    /const draft = loadDivinationFollowUpDraft\(\)\s*setFollowUpDraft\(draft\)\s*setFollowUpDisplayThread\(loadDivinationFollowUpDisplayThread\(draft\?\.threadId\)\)/,
  )
  assert.equal(occurrenceCount(followUpEffect, /loadDivinationFollowUpDraft\(\)/g), 1)
  assert.equal(
    occurrenceCount(followUpEffect, /loadDivinationFollowUpDisplayThread\(draft\?\.threadId\)/g),
    1,
  )
  assert.match(previewSource, /\{followUpKey && latestFollowUpReading \? \(/)
})

test('follow-up storage exports preserve canonical browser storage keys', () => {
  assert.equal(DIVINATION_FOLLOW_UP_DRAFT_STORAGE_KEY, canonicalDraftStorageKey)
  assert.equal(
    DIVINATION_FOLLOW_UP_ACTIVE_THREAD_ID_STORAGE_KEY,
    canonicalActiveThreadIdStorageKey,
  )
  assert.equal(
    getDivinationFollowUpThreadStorageKey(threadId),
    canonicalSyntheticThreadStorageKey,
  )
})

test('follow-up draft loader reads the complete synthetic draft contract', { concurrency: false }, async () => {
  await withFakeSessionStorage((storage) => {
    storage.setItem(canonicalDraftStorageKey, JSON.stringify(syntheticDraft))

    const loaded = loadDivinationFollowUpDraft()

    assert.equal(loaded?.threadId, threadId)
    assert.equal(loaded?.parentReadingId, readingId)
    assert.deepEqual(loaded?.previousReadings, syntheticDraft.previousReadings)
    assert.equal(loaded?.createdAt, createdAt)
  })
})

test('display loader resolves the synthetic thread through the active thread ID', { concurrency: false }, async () => {
  await withFakeSessionStorage((storage) => {
    storage.setItem(canonicalActiveThreadIdStorageKey, threadId)
    storage.setItem(canonicalSyntheticThreadStorageKey, JSON.stringify(syntheticDisplayThread))

    const loaded = loadDivinationFollowUpDisplayThread()

    assert.equal(loaded?.threadId, threadId)
    assert.deepEqual(loaded?.readings, syntheticDisplayThread.readings)
    assert.equal(loaded?.updatedAt, createdAt)
  })
})

test('draft and display loaders fail closed on invalid synthetic JSON', { concurrency: false }, async () => {
  await withFakeSessionStorage((storage) => {
    storage.setItem(canonicalDraftStorageKey, '{not-json')
    storage.setItem(canonicalActiveThreadIdStorageKey, threadId)
    storage.setItem(canonicalSyntheticThreadStorageKey, '{not-json')

    assert.equal(loadDivinationFollowUpDraft(), null)
    assert.equal(loadDivinationFollowUpDisplayThread(), null)
  })
})

test('draft cleanup removes only the draft key', { concurrency: false }, async () => {
  await withFakeSessionStorage((storage) => {
    storage.setItem(canonicalDraftStorageKey, JSON.stringify(syntheticDraft))
    storage.setItem(canonicalActiveThreadIdStorageKey, threadId)
    storage.setItem(unrelatedSyntheticKey, 'keep')

    clearDivinationFollowUpDraft()

    assert.equal(storage.getItem(canonicalDraftStorageKey), null)
    assert.equal(storage.getItem(canonicalActiveThreadIdStorageKey), threadId)
    assert.equal(storage.getItem(unrelatedSyntheticKey), 'keep')
  })
})

test('display cleanup removes the active thread pair and preserves unrelated synthetic storage', { concurrency: false }, async () => {
  await withFakeSessionStorage((storage) => {
    storage.setItem(canonicalActiveThreadIdStorageKey, threadId)
    storage.setItem(canonicalSyntheticThreadStorageKey, JSON.stringify(syntheticDisplayThread))
    storage.setItem(unrelatedSyntheticKey, 'keep')

    clearDivinationFollowUpDisplayThread()

    assert.equal(storage.getItem(canonicalActiveThreadIdStorageKey), null)
    assert.equal(storage.getItem(canonicalSyntheticThreadStorageKey), null)
    assert.equal(storage.getItem(unrelatedSyntheticKey), 'keep')
  })
})
