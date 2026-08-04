import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { normalizeAiChartD1N0 } from './d1N0'
import { AI_CHART_D1_PALACE_IDENTITIES } from './d1N0Constants'
import type { AiChartD1N0 } from './d1N0Parser'
import {
  AI_CHART_D1_PALACE_FACET_REGISTRY,
  type AiChartD1PalaceFacetId,
} from './d1PalaceFacetRegistry'
import {
  AI_CHART_D1_PALACE_WRITING_FIDELITY_REVIEW_VERSION,
  type AiChartD1PalaceWritingFidelityReview,
} from './d1PalaceWritingFidelityReviewContracts'
import {
  AI_CHART_D1_PALACE_WRITING_PROMPT_INSTRUCTIONS_SHA256,
  AI_CHART_D1_PALACE_WRITING_PROMPT_MAX_INSTRUCTIONS_UTF8_BYTES,
  AI_CHART_D1_PALACE_WRITING_PROMPT_MAX_TOTAL_UTF8_BYTES,
  AI_CHART_D1_PALACE_WRITING_PROMPT_MAX_USER_INPUT_UTF8_BYTES,
  AI_CHART_D1_PALACE_WRITING_PROMPT_PACKAGE_VERSION,
  AI_CHART_D1_PALACE_WRITING_PROMPT_INPUT_VERSION,
  AI_CHART_D1_PALACE_WRITING_PROMPT_TASK,
  AI_CHART_D1_PALACE_WRITING_PROMPT_VERSION,
  AI_CHART_D1_PALACE_WRITING_POLICY,
  createAiChartD1PalaceWritingCanonicalJson,
  parseAiChartD1PalaceWritingPromptPackage,
  type AiChartD1PalaceWritingPromptPackage,
} from './d1PalaceWritingPromptPackageContracts'
import { AI_CHART_D1_PALACE_WRITING_PROMPT_INSTRUCTIONS } from './d1PalaceWritingPromptInstructions'
import {
  AI_CHART_D1_PALACE_WRITING_RESULT_TASK,
  AI_CHART_D1_PALACE_WRITING_RESULT_VERSION,
  createAiChartD1PalaceWritingResultSha256,
  type AiChartD1PalaceWritingResult,
} from './d1PalaceWritingResultContracts'
import {
  AiChartD1ReportAssemblyError,
  AI_CHART_D1_REPORT_ASSEMBLY_VERSION,
  buildAiChartD1ReportAssembly,
} from './d1ReportAssemblyContracts'
import {
  createAiChartD1FlyingModelInputTestFixture,
  createAiChartD1FlyingModelInputTestSnapshot,
} from './d1FlyingModelInputTestSupport'

type PalaceId = (typeof AI_CHART_D1_PALACE_IDENTITIES)[number]['palaceId']

type AssemblySource = Readonly<{
  promptPackage: AiChartD1PalaceWritingPromptPackage
  writingResult: AiChartD1PalaceWritingResult
  fidelityReview: AiChartD1PalaceWritingFidelityReview
}>

type MutableRecord = Record<string, unknown>

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

function firstFacetId(palaceId: PalaceId): AiChartD1PalaceFacetId {
  const entry = AI_CHART_D1_PALACE_FACET_REGISTRY.find(
    (candidate) => candidate.palaceId === palaceId,
  )
  assert.notEqual(entry, undefined)
  return entry!.facetIds[0]
}

function createPromptPackage(
  n0: AiChartD1N0,
  palaceId: PalaceId,
): AiChartD1PalaceWritingPromptPackage {
  const facetId = firstFacetId(palaceId)
  const contentCellId = `content-grid-cell:${palaceId}:1`
  const sourceCellRef = `writing-source-cell:${palaceId}:1`
  const sourceRef = `axis-claim:${palaceId}:1`
  const contentGrid = {
    targetPalaceId: palaceId,
    facetSections: [
      {
        facetId,
        contentCells: [
          {
            contentCellId,
            targetPalaceId: palaceId,
            facetId,
            sourceCellRefs: [sourceCellRef],
            relationRefs: [],
            writingStatus: 'required',
          },
        ],
      },
    ],
  }
  const userInputValue = {
    contractVersion:
      AI_CHART_D1_PALACE_WRITING_PROMPT_INPUT_VERSION,
    chartId: n0.chartId,
    runId: 'run:report-assembly',
    targetPalaceId: palaceId,
    reportContext: {
      primaryLifeRegion: 'TW',
      reportLanguage: 'zh-Hant-TW',
    },
    contentGrid,
    sourceMaterials: [
      {
        contentCellId,
        targetPalaceId: palaceId,
        facetId,
        sourceCellRef,
        sourceKind: 'AXIS_CLAIM',
        sourceRef,
        material: {
          statement: 'A source-bound possibility.',
        },
      },
    ],
    relationContext: [],
    writingPolicy: AI_CHART_D1_PALACE_WRITING_POLICY,
  }
  const userInput =
    createAiChartD1PalaceWritingCanonicalJson(userInputValue)
  const instructionsUtf8Bytes = Buffer.byteLength(
    AI_CHART_D1_PALACE_WRITING_PROMPT_INSTRUCTIONS,
    'utf8',
  )
  const userInputUtf8Bytes = Buffer.byteLength(userInput, 'utf8')
  const sourceContentGridSha256 = '1'.repeat(64)
  const withoutFingerprint = {
    contractVersion:
      AI_CHART_D1_PALACE_WRITING_PROMPT_PACKAGE_VERSION,
    promptVersion: AI_CHART_D1_PALACE_WRITING_PROMPT_VERSION,
    task: AI_CHART_D1_PALACE_WRITING_PROMPT_TASK,
    chartId: n0.chartId,
    runId: 'run:report-assembly',
    callId: `palace-writing-call:${palaceId}`,
    targetPalaceId: palaceId,
    sourceSnapshotSha256: n0.sourceSnapshotSha256,
    sourceContentGridVersion: 'ai-chart-d1-palace-content-grid/v1',
    sourceContentGridSha256,
    sourceWritingSetVersion:
      'ai-chart-d1-palace-writing-source-set/v1',
    sourceWholeChartResultVersion:
      'ai-chart-d1-whole-chart-relation-result/v1',
    primaryLifeRegion: 'TW',
    reportLanguage: 'zh-Hant-TW',
    instructions: AI_CHART_D1_PALACE_WRITING_PROMPT_INSTRUCTIONS,
    instructionsSha256:
      AI_CHART_D1_PALACE_WRITING_PROMPT_INSTRUCTIONS_SHA256,
    userInput,
    userInputSha256: sha256(userInput),
    sourceTrace: {
      sourceSnapshotSha256: n0.sourceSnapshotSha256,
      contentGridSha256: sourceContentGridSha256,
      contentCellIds: [contentCellId],
      sourceCellRefs: [sourceCellRef],
      sourceRefs: [sourceRef],
      relationRefs: [],
    },
    budget: {
      measurement: 'utf8_bytes',
      instructionsUtf8Bytes,
      userInputUtf8Bytes,
      totalUtf8Bytes: instructionsUtf8Bytes + userInputUtf8Bytes,
      maxInstructionsUtf8Bytes:
        AI_CHART_D1_PALACE_WRITING_PROMPT_MAX_INSTRUCTIONS_UTF8_BYTES,
      maxUserInputUtf8Bytes:
        AI_CHART_D1_PALACE_WRITING_PROMPT_MAX_USER_INPUT_UTF8_BYTES,
      maxTotalUtf8Bytes:
        AI_CHART_D1_PALACE_WRITING_PROMPT_MAX_TOTAL_UTF8_BYTES,
      status: 'within_budget',
    },
    writingOutputContractStatus: 'available',
    promptStatus: 'prepared',
    adapterStatus: 'bridge_required',
    customerWritingStatus: 'not_generated',
    openAiCallable: false,
  }

  return parseAiChartD1PalaceWritingPromptPackage({
    ...withoutFingerprint,
    packageFingerprint: sha256(
      createAiChartD1PalaceWritingCanonicalJson(withoutFingerprint),
    ),
  })
}

function createAssemblySource(
  n0: AiChartD1N0,
  palaceId: PalaceId,
): AssemblySource {
  const promptPackage = createPromptPackage(n0, palaceId)
  const facetId = firstFacetId(palaceId)
  const contentCellRef = `content-grid-cell:${palaceId}:1`
  const writingResult: AiChartD1PalaceWritingResult = {
    contractVersion: AI_CHART_D1_PALACE_WRITING_RESULT_VERSION,
    task: AI_CHART_D1_PALACE_WRITING_RESULT_TASK,
    writingResultId: `palace-writing-result:${palaceId}`,
    chartId: promptPackage.chartId,
    runId: promptPackage.runId,
    callId: promptPackage.callId,
    targetPalaceId: palaceId,
    sourcePackageFingerprint: promptPackage.packageFingerprint,
    sections: [
      {
        contentCellRef,
        facetId,
        customerText: `這是 ${palaceId} 經來源綁定的客戶文字。`,
      },
    ],
    resultStatus: 'complete',
    fidelityReviewStatus: 'required',
    customerDeliveryStatus: 'blocked',
  }
  const fidelityReview: AiChartD1PalaceWritingFidelityReview = {
    contractVersion:
      AI_CHART_D1_PALACE_WRITING_FIDELITY_REVIEW_VERSION,
    task: 'D1_PALACE_WRITING_FIDELITY_REVIEW',
    fidelityReviewId: `palace-writing-review:${palaceId}`,
    chartId: promptPackage.chartId,
    runId: promptPackage.runId,
    callId: promptPackage.callId,
    targetPalaceId: palaceId,
    sourcePackageFingerprint: promptPackage.packageFingerprint,
    sourceWritingResultVersion:
      AI_CHART_D1_PALACE_WRITING_RESULT_VERSION,
    sourceWritingResultSha256:
      createAiChartD1PalaceWritingResultSha256(writingResult),
    sectionReviews: [
      {
        contentCellRef,
        decision: 'APPROVED',
        issueCodes: [],
        repairScope: 'NONE',
      },
    ],
    fidelityReviewStatus: 'approved',
    customerDeliveryStatus: 'ready',
    rewriteStatus: 'forbidden',
  }
  return Object.freeze({
    promptPackage,
    writingResult,
    fidelityReview,
  })
}

function createAssemblyFixture() {
  const { n0 } = createAiChartD1FlyingModelInputTestFixture()
  return {
    n0,
    sources: AI_CHART_D1_PALACE_IDENTITIES.map(({ palaceId }) =>
      createAssemblySource(n0, palaceId),
    ),
  }
}

function expectAssemblyInvalid(
  run: () => unknown,
  reasonCode: string,
): void {
  assert.throws(run, (error: unknown) => {
    assert.equal(error instanceof AiChartD1ReportAssemblyError, true)
    assert.equal(
      (error as AiChartD1ReportAssemblyError).reasonCode,
      reasonCode,
    )
    return true
  })
}

test('formal report assembly preserves all twelve approved palace texts and deterministically appends health reminders only to Health Palace', () => {
  const fixture = createAssemblyFixture()
  const assembly = buildAiChartD1ReportAssembly({
    n0: fixture.n0,
    gender: 'male',
    palaceSources: fixture.sources,
  })

  assert.equal(
    assembly.contractVersion,
    AI_CHART_D1_REPORT_ASSEMBLY_VERSION,
  )
  assert.deepEqual(
    assembly.palaces.map((palace) => palace.targetPalaceId),
    AI_CHART_D1_PALACE_IDENTITIES.map(({ palaceId }) => palaceId),
  )
  assert.deepEqual(
    assembly.palaces.map((palace) => palace.sections[0].customerText),
    fixture.sources.map(
      ({ writingResult }) => writingResult.sections[0].customerText,
    ),
  )
  assert.equal(
    assembly.palaces.filter(
      (palace) => palace.healthReminderSection !== null,
    ).length,
    1,
  )
  const healthPalace = assembly.palaces.find(
    (palace) => palace.targetPalaceId === 'palace:health',
  )
  assert.notEqual(healthPalace, undefined)
  assert.notEqual(healthPalace!.healthReminderSection, null)
  assert.deepEqual(
    healthPalace!.healthReminderSection!.canonicalHealthDirections,
    assembly.healthDirectionScan.canonicalHealthDirections,
  )
  assert.equal(assembly.fidelityReviewStatus, 'approved')
  assert.equal(assembly.humanReviewStatus, 'required')
  assert.equal(
    assembly.customerDeliveryStatus,
    'blocked_pending_human_review',
  )
  assert.equal(assembly.openAiCallable, false)
  assert.equal(Object.isFrozen(assembly), true)
  assert.equal(Object.isFrozen(assembly.palaces), true)
  assert.equal(Object.isFrozen(assembly.palaces[0].sections), true)
  assert.equal(Object.isFrozen(assembly.healthDirectionScan), true)
  assert.equal(
    Object.isFrozen(
      healthPalace!.healthReminderSection!.reminderCards,
    ),
    true,
  )
})

test('formal assembly rejects missing, extra, and reordered palace source contracts', () => {
  const fixture = createAssemblyFixture()

  expectAssemblyInvalid(
    () =>
      buildAiChartD1ReportAssembly({
        n0: fixture.n0,
        gender: 'male',
        palaceSources: fixture.sources.slice(0, -1),
      }),
    'PALACE_COVERAGE_MISMATCH',
  )
  expectAssemblyInvalid(
    () =>
      buildAiChartD1ReportAssembly({
        n0: fixture.n0,
        gender: 'male',
        palaceSources: [...fixture.sources, fixture.sources[0]],
      }),
    'PALACE_COVERAGE_MISMATCH',
  )

  const reordered = [...fixture.sources]
  ;[reordered[0], reordered[1]] = [reordered[1], reordered[0]]
  expectAssemblyInvalid(
    () =>
      buildAiChartD1ReportAssembly({
        n0: fixture.n0,
        gender: 'male',
        palaceSources: reordered,
      }),
    'PALACE_COVERAGE_MISMATCH',
  )
})

test('formal assembly refuses repair-required fidelity review and a different N0 identity', () => {
  const fixture = createAssemblyFixture()
  const repairSource = structuredClone(fixture.sources[0])
  const review =
    repairSource.fidelityReview as unknown as MutableRecord
  const sectionReviews = review.sectionReviews as MutableRecord[]
  sectionReviews[0].decision = 'REPAIR_REQUIRED'
  sectionReviews[0].issueCodes = ['SOURCE_MEANING_DISTORTED']
  sectionReviews[0].repairScope = 'CONTENT_CELL_ONLY'
  review.fidelityReviewStatus = 'repair_required'
  review.customerDeliveryStatus = 'blocked'
  const repairSources = [...fixture.sources]
  repairSources[0] = repairSource

  expectAssemblyInvalid(
    () =>
      buildAiChartD1ReportAssembly({
        n0: fixture.n0,
        gender: 'male',
        palaceSources: repairSources,
      }),
    'FIDELITY_REVIEW_NOT_APPROVED',
  )

  const otherN0 = structuredClone(fixture.n0) as unknown as MutableRecord
  otherN0.chartId = 'chart:other-report-assembly'
  expectAssemblyInvalid(
    () =>
      buildAiChartD1ReportAssembly({
        n0: otherN0,
        gender: 'male',
        palaceSources: fixture.sources,
      }),
    'IDENTITY_OR_SOURCE_MISMATCH',
  )
})

test('formal assembly creates no health section when the four fixed source palaces produce no direction', () => {
  const snapshot = createAiChartD1FlyingModelInputTestSnapshot()
  const palaces = snapshot.palaces as MutableRecord[]
  for (const index of [0, 5, 6, 11]) {
    palaces[index].majorStars = []
  }
  const n0 = normalizeAiChartD1N0(snapshot, {
    chartId: 'chart:report-assembly-no-health-direction',
  })
  const sources = AI_CHART_D1_PALACE_IDENTITIES.map(({ palaceId }) =>
    createAssemblySource(n0, palaceId),
  )
  const assembly = buildAiChartD1ReportAssembly({
    n0,
    gender: 'male',
    palaceSources: sources,
  })

  assert.deepEqual(
    assembly.healthDirectionScan.canonicalHealthDirections,
    [],
  )
  assert.equal(
    assembly.palaces.every(
      (palace) => palace.healthReminderSection === null,
    ),
    true,
  )
})

test('formal assembly rejects unknown fields and accessors without invoking them', () => {
  const fixture = createAssemblyFixture()
  expectAssemblyInvalid(
    () =>
      buildAiChartD1ReportAssembly({
        n0: fixture.n0,
        gender: 'male',
        palaceSources: fixture.sources,
        unexpected: true,
      }),
    'INPUT_SHAPE_INVALID',
  )

  let getterInvocations = 0
  const accessorInput: MutableRecord = {
    gender: 'male',
    palaceSources: fixture.sources,
  }
  Object.defineProperty(accessorInput, 'n0', {
    enumerable: true,
    get() {
      getterInvocations += 1
      return fixture.n0
    },
  })
  expectAssemblyInvalid(
    () => buildAiChartD1ReportAssembly(accessorInput),
    'INPUT_SHAPE_INVALID',
  )
  assert.equal(getterInvocations, 0)
})

test('formal assembly remains a pure offline source-bound contract without request capability', () => {
  const source = readFileSync(
    fileURLToPath(
      new URL('./d1ReportAssemblyContracts.ts', import.meta.url),
    ),
    'utf8',
  )

  assert.doesNotMatch(
    source,
    /fetch\s*\(|requestAiChartOpenAi|OPENAI_API_KEY|Authorization\s*:|node:fs/,
  )
})
