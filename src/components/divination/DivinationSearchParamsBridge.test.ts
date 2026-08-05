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
  clearDivinationFollowUpDisplayThread,
  clearDivinationFollowUpDraft,
  getDivinationFollowUpThreadStorageKey,
  loadDivinationFollowUpDisplayThread,
  loadDivinationFollowUpDraft,
  saveDivinationFollowUpDisplayReading,
  saveDivinationFollowUpDraft,
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

const canonicalThreadStoragePrefix = 'divination_follow_up_thread:'
const threadId = 'codex-thread-fixture'
const canonicalSyntheticThreadStorageKey = `${canonicalThreadStoragePrefix}${threadId}`
const readingId = 'codex-reading-fixture'
const question = 'synthetic-question'
const finalAnswer = 'synthetic-answer'
const createdAt = '1970-01-01T00:00:00.000Z'

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
    /<DivinationQuestionForm\s+key=\{resetKey \|\| ['"]initial['"]\}\s+disabled=\{isCreatingReading\}\s+onQuestionSubmit=\{handleQuestionSubmit\}/,
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
})

test('follow-up context panel keeps one unconditional shell before the question form', () => {
  const preview = parseSource(
    'src/components/divination/DivinationLocalPreview.tsx',
  )
  const previewSource = preview.getFullText()
  const panels = findJsxTag(preview, 'DivinationQuestionContextPanel')
  const questionForms = findJsxTag(preview, 'DivinationQuestionForm')

  assert.equal(panels.length, 1)
  assert.equal(questionForms.length, 1)
  assert.equal(
    hasJsxAncestor(panels[0], preview, 'Suspense'),
    false,
  )
  assert.ok(
    panels[0].getStart(preview) < questionForms[0].getStart(preview),
    'the stable context panel must remain before the question form',
  )
  assert.equal(
    getJsxAttribute(panels[0], 'isFollowUp')?.initializer?.getText(),
    '{Boolean(followUpKey)}',
  )
  assert.equal(
    getJsxAttribute(panels[0], 'followUpReading')?.initializer?.getText(),
    '{latestFollowUpReading}',
  )
  assert.equal(
    getJsxAttribute(panels[0], 'displayReading')?.initializer?.getText(),
    '{latestDisplayReading}',
  )
  assert.doesNotMatch(
    previewSource,
    /\{followUpKey && latestFollowUpReading \? \(/,
  )
})

test('reading creation takes a synchronous lock and disables every question submission control', () => {
  const previewSource = readSource(
    'src/components/divination/DivinationLocalPreview.tsx',
  )
  const formSource = readSource(
    'src/components/divination/DivinationQuestionForm.tsx',
  )

  assert.match(previewSource, /const createReadingInFlightRef = useRef\(false\)/)
  assert.match(
    previewSource,
    /if \(createReadingInFlightRef\.current\) \{\s*return\s*\}/,
  )
  assert.ok(
    previewSource.indexOf('createReadingInFlightRef.current = true') <
      previewSource.indexOf('const requestResetVersion = resetVersionRef.current'),
    'reading creation must take a synchronous lock before any awaited work',
  )
  assert.match(
    previewSource,
    /<DivinationQuestionForm[\s\S]*disabled=\{isCreatingReading\}[\s\S]*onQuestionSubmit=\{handleQuestionSubmit\}/,
  )
  assert.match(formSource, /disabled\?: boolean/)
  assert.equal(occurrenceCount(formSource, /disabled=\{disabled\}/g), 2)
})

test('context panel uses fixed grid rows and clamps dynamic follow-up text', () => {
  const panel = parseSource(
    'src/components/divination/DivinationQuestionContextPanel.tsx',
  )
  const panelSource = panel.getFullText()
  const articles = findJsxTag(panel, 'article')
  const details = findJsxTag(panel, 'details')
  const paragraphs = findJsxTag(panel, 'p')
  const questionRow = paragraphs.find(
    (paragraph) =>
      getJsxAttribute(paragraph, 'data-context-row')?.initializer?.getText() ===
      '"question"',
  )
  const cardRow = paragraphs.find(
    (paragraph) =>
      getJsxAttribute(paragraph, 'data-context-row')?.initializer?.getText() ===
      '"card"',
  )

  assert.equal(articles.length, 1)
  assert.equal(details.length, 1)
  assert.ok(questionRow)
  assert.ok(cardRow)
  assert.equal(
    getJsxAttribute(articles[0], 'data-testid')?.initializer?.getText(),
    '"divination-question-context-panel"',
  )
  assert.match(
    getJsxAttribute(articles[0], 'className')?.initializer?.getText() ?? '',
    /grid-rows-\[1\.5rem_4rem_1\.75rem_3\.5rem_auto\]/,
  )
  assert.match(
    getJsxAttribute(questionRow, 'className')?.initializer?.getText() ?? '',
    /line-clamp-2.*overflow-hidden/,
  )
  assert.match(
    getJsxAttribute(cardRow, 'className')?.initializer?.getText() ?? '',
    /truncate/,
  )
  assert.match(panelSource, /查看上一題題目與解答/)
  assert.match(panelSource, /displayReading\.finalAnswer/)
  assert.match(panelSource, /完成一次占卜後，可從解答頁延續追問/)
})

test('follow-up memory contract retains stable thread identity without browser storage', () => {
  assert.equal(
    getDivinationFollowUpThreadStorageKey(threadId),
    canonicalSyntheticThreadStorageKey,
  )
  const source = readSource('src/lib/divination/followUpStorage.ts')
  assert.doesNotMatch(source, /localStorage|sessionStorage/)
})

test('follow-up draft loader reads a defensive in-memory draft contract', () => {
  clearDivinationFollowUpDraft()
  saveDivinationFollowUpDraft(syntheticDraft)
  const loaded = loadDivinationFollowUpDraft()

  assert.equal(loaded?.threadId, threadId)
  assert.equal(loaded?.parentReadingId, readingId)
  assert.deepEqual(loaded?.previousReadings, syntheticDraft.previousReadings)
  assert.equal(loaded?.createdAt, createdAt)
  loaded!.previousReadings[0]!.question = 'external mutation'
  assert.equal(loadDivinationFollowUpDraft()?.previousReadings[0]?.question, question)
})

test('display loader resolves the current in-memory thread', () => {
  clearDivinationFollowUpDisplayThread()
  saveDivinationFollowUpDisplayReading({
    readingId,
    question,
    finalAnswer,
    existingFollowUpContext: {
      isFollowUp: true,
      threadId,
      parentReadingId: readingId,
      previousReadings: syntheticDraft.previousReadings,
    },
  })

  const loaded = loadDivinationFollowUpDisplayThread()
  assert.equal(loaded?.threadId, threadId)
  assert.equal(loaded?.readings[0]?.readingId, readingId)
  assert.equal(loaded?.readings[0]?.question, question)
  assert.equal(loaded?.readings[0]?.finalAnswer, finalAnswer)
})

test('draft cleanup does not clear the current display thread', () => {
  saveDivinationFollowUpDraft(syntheticDraft)
  clearDivinationFollowUpDraft()
  assert.equal(loadDivinationFollowUpDraft(), null)
  assert.equal(loadDivinationFollowUpDisplayThread()?.threadId, threadId)
})

test('display cleanup removes only the selected in-memory display thread', () => {
  saveDivinationFollowUpDraft(syntheticDraft)
  clearDivinationFollowUpDisplayThread()
  assert.equal(loadDivinationFollowUpDisplayThread(), null)
  assert.equal(loadDivinationFollowUpDraft()?.threadId, threadId)
})
