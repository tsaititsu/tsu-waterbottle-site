import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  AI_CHART_D1_PALACE_WRITING_FIDELITY_ISSUE_CODES,
  AI_CHART_D1_PALACE_WRITING_FIDELITY_REVIEW_JSON_SCHEMA,
  AI_CHART_D1_PALACE_WRITING_FIDELITY_REVIEW_VERSION,
  AiChartD1PalaceWritingFidelityReviewError,
  parseAiChartD1PalaceWritingFidelityReview,
  validateAiChartD1PalaceWritingFidelityReviewAgainstSources,
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
} from './d1PalaceWritingPromptPackageContracts'
import { AI_CHART_D1_PALACE_WRITING_PROMPT_INSTRUCTIONS } from './d1PalaceWritingPromptInstructions'
import {
  AI_CHART_D1_PALACE_WRITING_RESULT_JSON_SCHEMA,
  AI_CHART_D1_PALACE_WRITING_RESULT_TASK,
  AI_CHART_D1_PALACE_WRITING_RESULT_VERSION,
  AiChartD1PalaceWritingResultError,
  createAiChartD1PalaceWritingResultSha256,
  parseAiChartD1PalaceWritingResult,
  validateAiChartD1PalaceWritingResultAgainstPromptPackage,
} from './d1PalaceWritingResultContracts'

type MutableRecord = Record<string, unknown>

let checks = 0

function check(name: string, run: () => void): void {
  try {
    run()
    checks += 1
    console.log(`✓ ${name}`)
  } catch (error) {
    console.error(`✗ ${name}`)
    throw error
  }
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

function expectResultInvalid(
  run: () => unknown,
  reasonCode?: string,
): void {
  assert.throws(run, (error: unknown) => {
    assert.equal(error instanceof AiChartD1PalaceWritingResultError, true)
    if (reasonCode !== undefined) {
      assert.equal(
        (error as AiChartD1PalaceWritingResultError).reasonCode,
        reasonCode,
      )
    }
    return true
  })
}

function expectReviewInvalid(
  run: () => unknown,
  reasonCode?: string,
): void {
  assert.throws(run, (error: unknown) => {
    assert.equal(
      error instanceof AiChartD1PalaceWritingFidelityReviewError,
      true,
    )
    if (reasonCode !== undefined) {
      assert.equal(
        (error as AiChartD1PalaceWritingFidelityReviewError)
          .reasonCode,
        reasonCode,
      )
    }
    return true
  })
}

function createPromptPackage() {
  const contentGrid = {
    targetPalaceId: 'palace:ming',
    facetSections: [
      {
        facetId: 'life.core_personality',
        contentCells: [
          {
            contentCellId: 'content-grid-cell:palace:ming:1',
            targetPalaceId: 'palace:ming',
            facetId: 'life.core_personality',
            sourceCellRefs: ['writing-source-cell:palace:ming:1'],
            relationRefs: ['whole-chart-relation:direction'],
            writingStatus: 'required',
          },
        ],
      },
      {
        facetId: 'life.values_direction',
        contentCells: [
          {
            contentCellId: 'content-grid-cell:palace:ming:2',
            targetPalaceId: 'palace:ming',
            facetId: 'life.values_direction',
            sourceCellRefs: ['writing-source-cell:palace:ming:2'],
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
    chartId: 'chart:writing-result-contract',
    runId: 'run:writing-result-contract',
    targetPalaceId: 'palace:ming',
    reportContext: {
      primaryLifeRegion: 'TW',
      reportLanguage: 'zh-Hant-TW',
    },
    contentGrid,
    sourceMaterials: [
      {
        contentCellId: 'content-grid-cell:palace:ming:1',
        targetPalaceId: 'palace:ming',
        facetId: 'life.core_personality',
        sourceCellRef: 'writing-source-cell:palace:ming:1',
        sourceKind: 'AXIS_CLAIM',
        sourceRef: 'axis-claim:palace:ming:1',
        material: {
          statement: 'A source-bound possibility.',
        },
      },
      {
        contentCellId: 'content-grid-cell:palace:ming:2',
        targetPalaceId: 'palace:ming',
        facetId: 'life.values_direction',
        sourceCellRef: 'writing-source-cell:palace:ming:2',
        sourceKind: 'FLYING_INFLUENCE',
        sourceRef: 'flying-influence:palace:ming:1',
        material: {
          mechanismLink: 'A source-bound influence.',
        },
      },
    ],
    relationContext: [
      {
        relationId: 'whole-chart-relation:direction',
        relationKind: 'OVERALL_DIRECTION',
      },
    ],
    writingPolicy: AI_CHART_D1_PALACE_WRITING_POLICY,
  }
  const userInput =
    createAiChartD1PalaceWritingCanonicalJson(userInputValue)
  const sourceContentGridSha256 = '1'.repeat(64)
  const instructionsUtf8Bytes = Buffer.byteLength(
    AI_CHART_D1_PALACE_WRITING_PROMPT_INSTRUCTIONS,
    'utf8',
  )
  const userInputUtf8Bytes = Buffer.byteLength(userInput, 'utf8')
  const sourceSnapshotSha256 = 'a'.repeat(64)
  const withoutFingerprint = {
    contractVersion:
      AI_CHART_D1_PALACE_WRITING_PROMPT_PACKAGE_VERSION,
    promptVersion: AI_CHART_D1_PALACE_WRITING_PROMPT_VERSION,
    task: AI_CHART_D1_PALACE_WRITING_PROMPT_TASK,
    chartId: 'chart:writing-result-contract',
    runId: 'run:writing-result-contract',
    callId: 'palace-writing-call:palace:ming',
    targetPalaceId: 'palace:ming',
    sourceSnapshotSha256,
    sourceContentGridVersion:
      'ai-chart-d1-palace-content-grid/v1',
    sourceContentGridSha256,
    sourceWritingSetVersion:
      'ai-chart-d1-palace-writing-source-set/v1',
    sourceWholeChartResultVersion:
      'ai-chart-d1-whole-chart-relation-result/v1',
    primaryLifeRegion: 'TW',
    reportLanguage: 'zh-Hant-TW',
    instructions:
      AI_CHART_D1_PALACE_WRITING_PROMPT_INSTRUCTIONS,
    instructionsSha256:
      AI_CHART_D1_PALACE_WRITING_PROMPT_INSTRUCTIONS_SHA256,
    userInput,
    userInputSha256: sha256(userInput),
    sourceTrace: {
      sourceSnapshotSha256,
      contentGridSha256: sourceContentGridSha256,
      contentCellIds: [
        'content-grid-cell:palace:ming:1',
        'content-grid-cell:palace:ming:2',
      ],
      sourceCellRefs: [
        'writing-source-cell:palace:ming:1',
        'writing-source-cell:palace:ming:2',
      ],
      sourceRefs: [
        'axis-claim:palace:ming:1',
        'flying-influence:palace:ming:1',
      ],
      relationRefs: ['whole-chart-relation:direction'],
    },
    budget: {
      measurement: 'utf8_bytes',
      instructionsUtf8Bytes,
      userInputUtf8Bytes,
      totalUtf8Bytes:
        instructionsUtf8Bytes + userInputUtf8Bytes,
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

function createWritingResult(promptPackage: ReturnType<typeof createPromptPackage>) {
  return {
    contractVersion: AI_CHART_D1_PALACE_WRITING_RESULT_VERSION,
    task: AI_CHART_D1_PALACE_WRITING_RESULT_TASK,
    writingResultId: 'palace-writing-result:palace:ming',
    chartId: promptPackage.chartId,
    runId: promptPackage.runId,
    callId: promptPackage.callId,
    targetPalaceId: promptPackage.targetPalaceId,
    sourcePackageFingerprint: promptPackage.packageFingerprint,
    sections: [
      {
        contentCellRef: 'content-grid-cell:palace:ming:1',
        facetId: 'life.core_personality',
        customerText:
          '你在做重要選擇時，可能先確認這件事是否符合自己真正重視的方向。',
      },
      {
        contentCellRef: 'content-grid-cell:palace:ming:2',
        facetId: 'life.values_direction',
        customerText:
          '當外部條件帶來壓力時，你可能會反覆衡量，而不是立刻下定論。',
      },
    ],
    resultStatus: 'complete',
    fidelityReviewStatus: 'required',
    customerDeliveryStatus: 'blocked',
  }
}

function createReview(
  promptPackage: ReturnType<typeof createPromptPackage>,
  writingResult: ReturnType<typeof createWritingResult>,
) {
  return {
    contractVersion:
      AI_CHART_D1_PALACE_WRITING_FIDELITY_REVIEW_VERSION,
    task: 'D1_PALACE_WRITING_FIDELITY_REVIEW',
    fidelityReviewId: 'palace-writing-review:palace:ming',
    chartId: promptPackage.chartId,
    runId: promptPackage.runId,
    callId: promptPackage.callId,
    targetPalaceId: promptPackage.targetPalaceId,
    sourcePackageFingerprint: promptPackage.packageFingerprint,
    sourceWritingResultVersion:
      AI_CHART_D1_PALACE_WRITING_RESULT_VERSION,
    sourceWritingResultSha256:
      createAiChartD1PalaceWritingResultSha256(writingResult),
    sectionReviews: [
      {
        contentCellRef: 'content-grid-cell:palace:ming:1',
        decision: 'APPROVED',
        issueCodes: [],
        repairScope: 'NONE',
      },
      {
        contentCellRef: 'content-grid-cell:palace:ming:2',
        decision: 'APPROVED',
        issueCodes: [],
        repairScope: 'NONE',
      },
    ],
    fidelityReviewStatus: 'approved',
    customerDeliveryStatus: 'ready',
    rewriteStatus: 'forbidden',
  }
}

const promptPackage = createPromptPackage()
const writingResultValue = createWritingResult(promptPackage)
const approvedReviewValue = createReview(
  promptPackage,
  writingResultValue,
)

check('Prompt Package now exposes an available Result Contract while remaining non-callable without a bridge', () => {
  assert.equal(
    promptPackage.writingOutputContractStatus,
    'available',
  )
  assert.equal(promptPackage.adapterStatus, 'bridge_required')
  assert.equal(promptPackage.openAiCallable, false)
})

check('Result parser accepts one customer section per content cell and returns an immutable value', () => {
  const parsed = parseAiChartD1PalaceWritingResult(
    writingResultValue,
  )
  assert.equal(parsed.sections.length, 2)
  assert.equal(Object.isFrozen(parsed), true)
  assert.equal(Object.isFrozen(parsed.sections), true)
  assert.equal(Object.isFrozen(parsed.sections[0]), true)
  assert.match(
    createAiChartD1PalaceWritingResultSha256(parsed),
    /^[a-f0-9]{64}$/,
  )
})

check('Result source binding requires exact identity, package fingerprint, cell order, and facet mapping', () => {
  const parsed =
    validateAiChartD1PalaceWritingResultAgainstPromptPackage(
      writingResultValue,
      promptPackage,
    )
  assert.deepEqual(
    parsed.sections.map((section) => section.contentCellRef),
    promptPackage.sourceTrace.contentCellIds,
  )

  const changedIdentity = structuredClone(writingResultValue)
  changedIdentity.chartId = 'chart:forged'
  expectResultInvalid(
    () =>
      validateAiChartD1PalaceWritingResultAgainstPromptPackage(
        changedIdentity,
        promptPackage,
      ),
    'IDENTITY_OR_SOURCE_MISMATCH',
  )

  const changedFingerprint = structuredClone(writingResultValue)
  changedFingerprint.sourcePackageFingerprint = '2'.repeat(64)
  expectResultInvalid(
    () =>
      validateAiChartD1PalaceWritingResultAgainstPromptPackage(
        changedFingerprint,
        promptPackage,
      ),
    'IDENTITY_OR_SOURCE_MISMATCH',
  )

  const changedOrder = structuredClone(writingResultValue)
  changedOrder.sections.reverse()
  expectResultInvalid(
    () =>
      validateAiChartD1PalaceWritingResultAgainstPromptPackage(
        changedOrder,
        promptPackage,
      ),
    'CONTENT_CELL_COVERAGE_MISMATCH',
  )

  const changedFacet = structuredClone(writingResultValue)
  changedFacet.sections[0].facetId = 'life.values_direction'
  expectResultInvalid(
    () =>
      validateAiChartD1PalaceWritingResultAgainstPromptPackage(
        changedFacet,
        promptPackage,
      ),
    'CONTENT_CELL_COVERAGE_MISMATCH',
  )
})

check('Result Contract rejects missing, duplicate, self-declared coverage, and premature delivery', () => {
  const missing = structuredClone(writingResultValue)
  missing.sections.pop()
  expectResultInvalid(() =>
    validateAiChartD1PalaceWritingResultAgainstPromptPackage(
      missing,
      promptPackage,
    ),
  )

  const duplicate = structuredClone(writingResultValue)
  duplicate.sections[1].contentCellRef =
    duplicate.sections[0].contentCellRef
  expectResultInvalid(() =>
    parseAiChartD1PalaceWritingResult(duplicate),
  )

  const selfDeclared = {
    ...structuredClone(writingResultValue),
    majorStarsConsidered: ['紫微'],
  }
  expectResultInvalid(() =>
    parseAiChartD1PalaceWritingResult(selfDeclared),
  )

  const prematurelyDelivered = structuredClone(writingResultValue)
  prematurelyDelivered.customerDeliveryStatus = 'ready'
  expectResultInvalid(() =>
    parseAiChartD1PalaceWritingResult(prematurelyDelivered),
  )
})

check('approved Fidelity Review covers every section and unlocks delivery without rewriting', () => {
  const parsed =
    validateAiChartD1PalaceWritingFidelityReviewAgainstSources(
      approvedReviewValue,
      writingResultValue,
      promptPackage,
    )
  assert.equal(parsed.fidelityReviewStatus, 'approved')
  assert.equal(parsed.customerDeliveryStatus, 'ready')
  assert.equal(parsed.rewriteStatus, 'forbidden')
  assert.equal(Object.isFrozen(parsed), true)
  assert.equal(Object.isFrozen(parsed.sectionReviews), true)
  assert.equal(Object.isFrozen(parsed.sectionReviews[0]), true)
})

check('one rejected section creates a content-cell-only repair handoff and preserves approved siblings', () => {
  const repair = structuredClone(approvedReviewValue)
  const repairReview = repair
    .sectionReviews[1] as unknown as MutableRecord
  repairReview.decision = 'REPAIR_REQUIRED'
  repairReview.issueCodes = ['POSSIBILITY_BECAME_CERTAINTY']
  repairReview.repairScope = 'CONTENT_CELL_ONLY'
  repair.fidelityReviewStatus = 'repair_required'
  repair.customerDeliveryStatus = 'blocked'
  const parsed =
    validateAiChartD1PalaceWritingFidelityReviewAgainstSources(
      repair,
      writingResultValue,
      promptPackage,
    )
  assert.equal(parsed.sectionReviews[0].decision, 'APPROVED')
  assert.equal(
    parsed.sectionReviews[1].repairScope,
    'CONTENT_CELL_ONLY',
  )
  assert.deepEqual(
    parsed.sectionReviews
      .filter((review) => review.decision === 'REPAIR_REQUIRED')
      .map((review) => review.contentCellRef),
    ['content-grid-cell:palace:ming:2'],
  )
})

check('Fidelity Review enforces decision, issue-code, and repair-scope coherence', () => {
  const approvedWithIssue = structuredClone(approvedReviewValue)
  ;(
    approvedWithIssue.sectionReviews[0] as unknown as MutableRecord
  ).issueCodes = [
    'SOURCE_MEANING_DISTORTED',
  ]
  expectReviewInvalid(
    () =>
      parseAiChartD1PalaceWritingFidelityReview(
        approvedWithIssue,
      ),
    'DECISION_OR_REPAIR_SCOPE_MISMATCH',
  )

  const repairWithoutIssue = structuredClone(approvedReviewValue)
  const repairWithoutIssueReview = repairWithoutIssue
    .sectionReviews[0] as unknown as MutableRecord
  repairWithoutIssueReview.decision = 'REPAIR_REQUIRED'
  repairWithoutIssueReview.repairScope = 'CONTENT_CELL_ONLY'
  repairWithoutIssue.fidelityReviewStatus = 'repair_required'
  repairWithoutIssue.customerDeliveryStatus = 'blocked'
  expectReviewInvalid(
    () =>
      parseAiChartD1PalaceWritingFidelityReview(
        repairWithoutIssue,
      ),
    'DECISION_OR_REPAIR_SCOPE_MISMATCH',
  )
})

check('Fidelity Review is source-bound and cannot omit cells, alter result hash, or add rewritten text', () => {
  const missingCell = structuredClone(approvedReviewValue)
  missingCell.sectionReviews.pop()
  expectReviewInvalid(
    () =>
      validateAiChartD1PalaceWritingFidelityReviewAgainstSources(
        missingCell,
        writingResultValue,
        promptPackage,
      ),
    'SECTION_REVIEW_COVERAGE_MISMATCH',
  )

  const changedHash = structuredClone(approvedReviewValue)
  changedHash.sourceWritingResultSha256 = '3'.repeat(64)
  expectReviewInvalid(
    () =>
      validateAiChartD1PalaceWritingFidelityReviewAgainstSources(
        changedHash,
        writingResultValue,
        promptPackage,
      ),
    'IDENTITY_OR_SOURCE_MISMATCH',
  )

  const rewritten = structuredClone(approvedReviewValue)
  ;(
    rewritten.sectionReviews[0] as unknown as MutableRecord
  ).rewrittenCustomerText = '審查器不得直接改寫。'
  expectReviewInvalid(() =>
    parseAiChartD1PalaceWritingFidelityReview(rewritten),
  )
})

check('Result and Fidelity Review Schemas are strict, serializable, bounded, and contain no self-declared source coverage or rewrite channel', () => {
  for (const schema of [
    AI_CHART_D1_PALACE_WRITING_RESULT_JSON_SCHEMA,
    AI_CHART_D1_PALACE_WRITING_FIDELITY_REVIEW_JSON_SCHEMA,
  ]) {
    const serialized = JSON.stringify(schema)
    assert.equal(Object.isFrozen(schema), true)
    assert.deepEqual(JSON.parse(serialized), schema)
    assert.equal(serialized.includes('uniqueItems'), false)
    for (const forbidden of [
      'majorStarsConsidered',
      'rewrittenCustomerText',
      'safeReason',
      'error.message',
      'output_text',
      'Prompt',
      'OPENAI_API_KEY',
    ]) {
      assert.equal(serialized.includes(forbidden), false, forbidden)
    }
    const visit = (candidate: unknown): void => {
      if (candidate === null || typeof candidate !== 'object') return
      if (Array.isArray(candidate)) {
        candidate.forEach(visit)
        return
      }
      const record = candidate as MutableRecord
      if (record.type === 'object') {
        assert.equal(record.additionalProperties, false)
        const properties = record.properties as MutableRecord
        assert.deepEqual(record.required, Object.keys(properties))
      }
      Object.values(record).forEach(visit)
    }
    visit(schema)
  }
  assert.equal(
    AI_CHART_D1_PALACE_WRITING_FIDELITY_ISSUE_CODES.length >= 10,
    true,
  )
})

check('Writing Result and Fidelity Review modules have no runtime request, environment, or persistence access', () => {
  for (const file of [
    './d1PalaceWritingResultContracts.ts',
    './d1PalaceWritingFidelityReviewContracts.ts',
  ]) {
    const source = readFileSync(
      fileURLToPath(new URL(file, import.meta.url)),
      'utf8',
    )
    for (const forbidden of [
      'fetch(',
      'responses.create',
      'requestAiChartOpenAiStructuredResponse',
      'OPENAI_API_KEY',
      'process.env',
      'console.',
      'retry',
      'database',
      'supabase',
    ]) {
      assert.equal(source.includes(forbidden), false, forbidden)
    }
  }
})

console.log(
  `d1PalaceWritingResultContracts tests passed (${checks} checks)`,
)
