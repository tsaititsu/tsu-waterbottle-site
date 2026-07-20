import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import ts from 'typescript'

type FollowUpStorageModule = typeof import('../../lib/divination/followUpStorage')
type PublicFormSearchParamsModule = typeof import('../../lib/publicFormSearchParams')

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

const {
  INITIAL_BOOKING_SEARCH_PARAM_STATE,
  INITIAL_DIVINATION_SEARCH_PARAM_STATE,
  reconcileBookingSearchParamState,
  reconcileDivinationSearchParamState,
} = (await import(
  new URL('../../lib/publicFormSearchParams.ts', import.meta.url).href
)) as PublicFormSearchParamsModule

const projectRoot = process.cwd()

function readSource(relativePath: string) {
  return readFileSync(join(projectRoot, relativePath), 'utf8')
}

function parseSource(relativePath: string) {
  return ts.createSourceFile(
    relativePath,
    readSource(relativePath),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  )
}

function findJsxTag(sourceFile: ts.SourceFile, tagName: string) {
  const matches: Array<ts.JsxOpeningElement | ts.JsxSelfClosingElement> = []

  function visit(node: ts.Node) {
    if (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      node.tagName.getText(sourceFile) === tagName
    ) {
      matches.push(node)
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return matches
}

function hasJsxAncestor(
  node: ts.Node,
  sourceFile: ts.SourceFile,
  tagName: string,
) {
  let ancestor = node.parent

  while (ancestor) {
    if (
      ts.isJsxElement(ancestor) &&
      ancestor.openingElement.tagName.getText(sourceFile) === tagName
    ) {
      return true
    }

    ancestor = ancestor.parent
  }

  return false
}

function getJsxAttribute(
  node: ts.JsxOpeningElement | ts.JsxSelfClosingElement,
  attributeName: string,
) {
  return node.attributes.properties.find(
    (attribute): attribute is ts.JsxAttribute =>
      ts.isJsxAttribute(attribute) &&
      attribute.name.getText(node.getSourceFile()) === attributeName,
  )
}

function hasNullReturn(sourceFile: ts.SourceFile) {
  let found = false

  function visit(node: ts.Node) {
    if (
      ts.isReturnStatement(node) &&
      node.expression?.kind === ts.SyntaxKind.NullKeyword
    ) {
      found = true
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return found
}

function findNamedCalls(sourceFile: ts.SourceFile, functionName: string) {
  const matches: ts.CallExpression[] = []

  function visit(node: ts.Node) {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === functionName
    ) {
      matches.push(node)
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return matches
}

function getObjectPropertyNames(node: ts.Expression | undefined) {
  if (!node || !ts.isObjectLiteralExpression(node)) return []

  return node.properties.map((property) => property.name?.getText()).filter(Boolean)
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

test('public pages render stable client shells without reading search params on the server', () => {
  const divinationPage = parseSource('src/app/ai-divination/page.tsx')
  const bookingPage = parseSource('src/app/booking/page.tsx')

  assert.equal(findJsxTag(divinationPage, 'DivinationPageShell').length, 1)
  assert.equal(findJsxTag(bookingPage, 'BookingPageShell').length, 1)
  assert.equal(findJsxTag(divinationPage, 'Suspense').length, 0)
  assert.equal(findJsxTag(bookingPage, 'Suspense').length, 0)
  assert.equal(findJsxTag(divinationPage, 'DivinationSearchParamsBridge').length, 0)
  assert.equal(findJsxTag(bookingPage, 'BookingSearchParamsBridge').length, 0)
  assert.equal(
    divinationPage.statements.some(
      (statement) =>
        ts.isFunctionDeclaration(statement) &&
        statement.name?.text === 'AiDivinationPage' &&
        statement.parameters.length === 0,
    ),
    true,
  )
  assert.equal(
    bookingPage.statements.some(
      (statement) =>
        ts.isFunctionDeclaration(statement) &&
        statement.name?.text === 'BookingPage' &&
        statement.parameters.length === 0,
    ),
    true,
  )
})

test('large public forms render outside the search-param Suspense boundary without remount keys', () => {
  const divinationShell = parseSource(
    'src/components/divination/DivinationPageShell.tsx',
  )
  const bookingShell = parseSource('src/components/BookingPageShell.tsx')
  const divinationPreview = findJsxTag(
    divinationShell,
    'DivinationLocalPreview',
  )
  const bookingForm = findJsxTag(bookingShell, 'BookingForm')
  const divinationObserver = findJsxTag(
    divinationShell,
    'DivinationSearchParamsBridge',
  )
  const bookingObserver = findJsxTag(
    bookingShell,
    'BookingSearchParamsBridge',
  )

  assert.equal(divinationPreview.length, 1)
  assert.equal(bookingForm.length, 1)
  assert.equal(divinationObserver.length, 1)
  assert.equal(bookingObserver.length, 1)
  assert.equal(hasJsxAncestor(divinationPreview[0], divinationShell, 'Suspense'), false)
  assert.equal(hasJsxAncestor(bookingForm[0], bookingShell, 'Suspense'), false)
  assert.equal(hasJsxAncestor(divinationObserver[0], divinationShell, 'Suspense'), true)
  assert.equal(hasJsxAncestor(bookingObserver[0], bookingShell, 'Suspense'), true)
  assert.equal(getJsxAttribute(divinationPreview[0], 'key'), undefined)
  assert.equal(getJsxAttribute(bookingForm[0], 'key'), undefined)

  assert.equal(
    getJsxAttribute(divinationPreview[0], 'resetKey')?.initializer?.getText(),
    '{searchParamState.resetKey}',
  )
  assert.equal(
    getJsxAttribute(divinationPreview[0], 'followUpKey')?.initializer?.getText(),
    '{searchParamState.followUpKey}',
  )
  assert.equal(
    getJsxAttribute(bookingForm[0], 'resetKey')?.initializer?.getText(),
    '{searchParamState.resetKey}',
  )
})

test('search-param observers are effect-only and never own the large forms', () => {
  const divinationObserver = parseSource(
    'src/components/divination/DivinationSearchParamsBridge.tsx',
  )
  const bookingObserver = parseSource(
    'src/components/BookingSearchParamsBridge.tsx',
  )

  assert.equal(findJsxTag(divinationObserver, 'DivinationLocalPreview').length, 0)
  assert.equal(findJsxTag(bookingObserver, 'BookingForm').length, 0)
  assert.equal(findJsxTag(divinationObserver, 'Suspense').length, 0)
  assert.equal(findJsxTag(bookingObserver, 'Suspense').length, 0)
  assert.equal(hasNullReturn(divinationObserver), true)
  assert.equal(hasNullReturn(bookingObserver), true)

  assert.equal(findNamedCalls(divinationObserver, 'useSearchParams').length, 1)
  assert.equal(findNamedCalls(bookingObserver, 'useSearchParams').length, 1)
  assert.equal(findNamedCalls(divinationObserver, 'useEffect').length, 1)
  assert.equal(findNamedCalls(bookingObserver, 'useEffect').length, 1)

  const divinationNotification = findNamedCalls(divinationObserver, 'onChange')
  const bookingNotification = findNamedCalls(bookingObserver, 'onChange')

  assert.equal(divinationNotification.length, 1)
  assert.equal(bookingNotification.length, 1)
  assert.deepEqual(
    getObjectPropertyNames(divinationNotification[0].arguments[0]),
    ['resetKey', 'followUpKey'],
  )
  assert.deepEqual(getObjectPropertyNames(bookingNotification[0].arguments[0]), [
    'resetKey',
  ])
})

test('query reconciliation preserves component identity for unchanged keys and accepts navigation changes', () => {
  const unchangedDivination = reconcileDivinationSearchParamState(
    INITIAL_DIVINATION_SEARCH_PARAM_STATE,
    { resetKey: '', followUpKey: '' },
  )
  const changedDivination = reconcileDivinationSearchParamState(
    unchangedDivination,
    { resetKey: 'reset-audit', followUpKey: 'follow-up-audit' },
  )
  const unchangedBooking = reconcileBookingSearchParamState(
    INITIAL_BOOKING_SEARCH_PARAM_STATE,
    { resetKey: '' },
  )
  const changedBooking = reconcileBookingSearchParamState(unchangedBooking, {
    resetKey: 'reset-audit',
  })

  assert.equal(unchangedDivination, INITIAL_DIVINATION_SEARCH_PARAM_STATE)
  assert.deepEqual(changedDivination, {
    resetKey: 'reset-audit',
    followUpKey: 'follow-up-audit',
  })
  assert.equal(unchangedBooking, INITIAL_BOOKING_SEARCH_PARAM_STATE)
  assert.deepEqual(changedBooking, { resetKey: 'reset-audit' })
})

test('booking slots remain a single mount fetch outside the query observer', () => {
  const bookingForm = readSource('src/components/BookingForm.tsx')
  const bookingShell = readSource('src/components/BookingPageShell.tsx')
  const bookingObserver = readSource('src/components/BookingSearchParamsBridge.tsx')

  assert.equal(occurrenceCount(bookingForm, /['"]\/api\/booking-slots['"]/g), 1)
  assert.doesNotMatch(bookingShell, /fetch\s*\(/)
  assert.doesNotMatch(bookingObserver, /fetch\s*\(/)
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
