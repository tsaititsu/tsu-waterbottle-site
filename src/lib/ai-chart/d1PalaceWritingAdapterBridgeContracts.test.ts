import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  AI_CHART_D1_PALACE_WRITING_ADAPTER_BRIDGE_DESCRIPTION,
  AI_CHART_D1_PALACE_WRITING_ADAPTER_BRIDGE_VERSION,
  AI_CHART_D1_PALACE_WRITING_FIDELITY_ADAPTER_BRIDGE_DESCRIPTION,
  AI_CHART_D1_PALACE_WRITING_FIDELITY_ADAPTER_BRIDGE_VERSION,
  AI_CHART_D1_PALACE_WRITING_MAX_OUTPUT_TOKENS,
  AI_CHART_D1_PALACE_WRITING_REVIEW_MAX_OUTPUT_TOKENS,
  buildAiChartD1PalaceWritingAdapterBridge,
  buildAiChartD1PalaceWritingFidelityAdapterBridge,
} from './d1PalaceWritingAdapterBridgeContracts'
import {
  AI_CHART_D1_PALACE_WRITING_FIDELITY_PROMPT_INPUT_VERSION,
  AI_CHART_D1_PALACE_WRITING_FIDELITY_PROMPT_PACKAGE_VERSION,
  AI_CHART_D1_PALACE_WRITING_FIDELITY_PROMPT_TASK,
  buildAiChartD1PalaceWritingFidelityPromptPackage,
  createAiChartD1PalaceWritingFidelityCanonicalJson,
  parseAiChartD1PalaceWritingFidelityPromptPackage,
  validateAiChartD1PalaceWritingFidelityPromptPackageAgainstSources,
} from './d1PalaceWritingFidelityPromptPackageContracts'
import { AI_CHART_D1_PALACE_WRITING_FIDELITY_PROMPT_INSTRUCTIONS } from './d1PalaceWritingFidelityPromptInstructions'
import {
  AI_CHART_D1_PALACE_WRITING_FIDELITY_REVIEW_SCHEMA_NAME,
  AI_CHART_D1_PALACE_WRITING_FIDELITY_REVIEW_VERSION,
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
  AI_CHART_D1_PALACE_WRITING_RESULT_SCHEMA_NAME,
  AI_CHART_D1_PALACE_WRITING_RESULT_TASK,
  AI_CHART_D1_PALACE_WRITING_RESULT_VERSION,
  createAiChartD1PalaceWritingResultSha256,
} from './d1PalaceWritingResultContracts'
import {
  AI_CHART_OPENAI_DEFAULT_MAX_OUTPUT_TOKENS,
  AI_CHART_OPENAI_DEFAULT_REASONING_EFFORT,
  AI_CHART_OPENAI_DEFAULT_TIMEOUT_MS,
  buildAiChartOpenAiResponsesBody,
} from './openAiResponses'

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

function rehashFidelityPromptPackage(
  value: MutableRecord,
): void {
  const userInput = value.userInput
  const budget = value.budget
  assert.equal(typeof userInput, 'string')
  assert.equal(
    budget !== null && typeof budget === 'object',
    true,
  )
  const mutableBudget = budget as MutableRecord
  const userInputUtf8Bytes = Buffer.byteLength(
    userInput as string,
    'utf8',
  )
  mutableBudget.userInputUtf8Bytes = userInputUtf8Bytes
  mutableBudget.totalUtf8Bytes =
    (mutableBudget.instructionsUtf8Bytes as number) +
    userInputUtf8Bytes
  value.userInputSha256 = sha256(userInput as string)
  const withoutFingerprint = Object.fromEntries(
    Object.entries(value).filter(
      ([field]) => field !== 'packageFingerprint',
    ),
  )
  value.packageFingerprint = sha256(
    createAiChartD1PalaceWritingFidelityCanonicalJson(
      withoutFingerprint,
    ),
  )
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
    chartId: 'chart:writing-adapter-contract',
    runId: 'run:writing-adapter-contract',
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
    chartId: 'chart:writing-adapter-contract',
    runId: 'run:writing-adapter-contract',
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

function createWritingResult(
  promptPackage: ReturnType<typeof createPromptPackage>,
) {
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

function createApprovedReview(
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
    sectionReviews: writingResult.sections.map((section) => ({
      contentCellRef: section.contentCellRef,
      decision: 'APPROVED',
      issueCodes: [],
      repairScope: 'NONE',
    })),
    fidelityReviewStatus: 'approved',
    customerDeliveryStatus: 'ready',
    rewriteStatus: 'forbidden',
  }
}

const promptPackage = createPromptPackage()
const writingResult = createWritingResult(promptPackage)
const approvedReview = createApprovedReview(
  promptPackage,
  writingResult,
)

check('Writing Adapter binds the validated Prompt Package to the strict Result Contract without enabling runtime execution', () => {
  const bridge =
    buildAiChartD1PalaceWritingAdapterBridge(promptPackage)
  assert.equal(
    bridge.descriptor.contractVersion,
    AI_CHART_D1_PALACE_WRITING_ADAPTER_BRIDGE_VERSION,
  )
  assert.equal(
    bridge.descriptor.description,
    AI_CHART_D1_PALACE_WRITING_ADAPTER_BRIDGE_DESCRIPTION,
  )
  assert.equal(
    bridge.descriptor.promptPackageFingerprint,
    promptPackage.packageFingerprint,
  )
  assert.equal(
    bridge.descriptor.outputContractVersion,
    AI_CHART_D1_PALACE_WRITING_RESULT_VERSION,
  )
  assert.equal(
    bridge.descriptor.outputSchemaName,
    AI_CHART_D1_PALACE_WRITING_RESULT_SCHEMA_NAME,
  )
  assert.equal(
    bridge.descriptor.reasoningEffort,
    AI_CHART_OPENAI_DEFAULT_REASONING_EFFORT,
  )
  assert.equal(
    bridge.descriptor.timeoutMs,
    AI_CHART_OPENAI_DEFAULT_TIMEOUT_MS,
  )
  assert.equal(
    bridge.descriptor.maxOutputTokens,
    AI_CHART_D1_PALACE_WRITING_MAX_OUTPUT_TOKENS,
  )
  assert.equal(
    AI_CHART_D1_PALACE_WRITING_MAX_OUTPUT_TOKENS,
    AI_CHART_OPENAI_DEFAULT_MAX_OUTPUT_TOKENS,
  )
  assert.equal(bridge.descriptor.requestStatus, 'ready')
  assert.equal(
    bridge.descriptor.runtimeStatus,
    'runtime_wiring_required',
  )
  assert.equal(bridge.descriptor.openAiCallable, false)
  assert.equal(bridge.request.instructions, promptPackage.instructions)
  assert.equal(bridge.request.userInput, promptPackage.userInput)
  assert.equal(Object.isFrozen(bridge), true)
  assert.equal(Object.isFrozen(bridge.descriptor), true)
  assert.deepEqual(
    bridge.request.parseResult(writingResult),
    writingResult,
  )

  const forged = structuredClone(writingResult)
  forged.sourcePackageFingerprint = 'f'.repeat(64)
  assert.throws(() => bridge.request.parseResult(forged))
})

check('Writing Adapter produces the existing pure Responses body without changing model policy or sending a request', () => {
  const bridge =
    buildAiChartD1PalaceWritingAdapterBridge(promptPackage)
  const body = buildAiChartOpenAiResponsesBody(bridge.request)
  assert.equal(body.instructions, promptPackage.instructions)
  assert.equal(body.input[0].content, promptPackage.userInput)
  assert.equal(
    body.max_output_tokens,
    AI_CHART_D1_PALACE_WRITING_MAX_OUTPUT_TOKENS,
  )
  assert.equal(body.reasoning.effort, 'medium')
  assert.equal(body.store, false)
  assert.equal(body.stream, false)
})

check('Fidelity Prompt Package binds the exact source package and writing result into one immutable review input', () => {
  const reviewPackage =
    buildAiChartD1PalaceWritingFidelityPromptPackage(
      promptPackage,
      writingResult,
    )
  assert.equal(
    reviewPackage.contractVersion,
    AI_CHART_D1_PALACE_WRITING_FIDELITY_PROMPT_PACKAGE_VERSION,
  )
  assert.equal(
    reviewPackage.task,
    AI_CHART_D1_PALACE_WRITING_FIDELITY_PROMPT_TASK,
  )
  assert.equal(
    reviewPackage.sourcePackageFingerprint,
    promptPackage.packageFingerprint,
  )
  assert.equal(
    reviewPackage.sourceWritingResultSha256,
    createAiChartD1PalaceWritingResultSha256(writingResult),
  )
  assert.equal(
    reviewPackage.instructions,
    AI_CHART_D1_PALACE_WRITING_FIDELITY_PROMPT_INSTRUCTIONS,
  )
  assert.equal(reviewPackage.promptStatus, 'prepared')
  assert.equal(reviewPackage.adapterStatus, 'bridge_required')
  assert.equal(reviewPackage.reviewStatus, 'not_generated')
  assert.equal(reviewPackage.customerDeliveryStatus, 'blocked')
  assert.equal(reviewPackage.openAiCallable, false)
  assert.equal(Object.isFrozen(reviewPackage), true)
  assert.equal(Object.isFrozen(reviewPackage.sourceTrace), true)

  const input = JSON.parse(reviewPackage.userInput) as MutableRecord
  assert.equal(
    input.contractVersion,
    AI_CHART_D1_PALACE_WRITING_FIDELITY_PROMPT_INPUT_VERSION,
  )
  assert.deepEqual(
    input.sourceWritingPromptInput,
    JSON.parse(promptPackage.userInput),
  )
  assert.deepEqual(input.writingResult, writingResult)
  assert.equal(
    reviewPackage.userInput,
    createAiChartD1PalaceWritingFidelityCanonicalJson(input),
  )
})

check('Fidelity Prompt Package is deterministic and rejects any stale or forged source binding', () => {
  const first = buildAiChartD1PalaceWritingFidelityPromptPackage(
    promptPackage,
    writingResult,
  )
  const second = buildAiChartD1PalaceWritingFidelityPromptPackage(
    promptPackage,
    writingResult,
  )
  assert.deepEqual(first, second)
  assert.deepEqual(
    parseAiChartD1PalaceWritingFidelityPromptPackage(first),
    first,
  )
  assert.deepEqual(
    validateAiChartD1PalaceWritingFidelityPromptPackageAgainstSources(
      first,
      promptPackage,
      writingResult,
    ),
    first,
  )

  const forged = structuredClone(first)
  const mutableForged = forged as unknown as MutableRecord
  mutableForged.sourceWritingResultSha256 = 'a'.repeat(64)
  assert.throws(() =>
    validateAiChartD1PalaceWritingFidelityPromptPackageAgainstSources(
      forged,
      promptPackage,
      writingResult,
    ),
  )

  const changedResult = structuredClone(writingResult)
  changedResult.sections[0].customerText = 'Changed writing.'
  assert.throws(() =>
    validateAiChartD1PalaceWritingFidelityPromptPackageAgainstSources(
      first,
      promptPackage,
      changedResult,
    ),
  )
})

check('Fidelity Prompt Package parser rejects non-canonical input and duplicate trace even after attacker-controlled hashes are recomputed', () => {
  const source = buildAiChartD1PalaceWritingFidelityPromptPackage(
    promptPackage,
    writingResult,
  )
  const nonCanonical = structuredClone(
    source,
  ) as unknown as MutableRecord
  const parsedInput = JSON.parse(
    nonCanonical.userInput as string,
  ) as MutableRecord
  nonCanonical.userInput = JSON.stringify(
    Object.fromEntries(Object.entries(parsedInput).reverse()),
  )
  rehashFidelityPromptPackage(nonCanonical)
  assert.throws(() =>
    parseAiChartD1PalaceWritingFidelityPromptPackage(
      nonCanonical,
    ),
  )

  const duplicatedTrace = structuredClone(
    source,
  ) as unknown as MutableRecord
  const sourceTrace =
    duplicatedTrace.sourceTrace as MutableRecord
  const sourceRefs = sourceTrace.sourceRefs as string[]
  sourceRefs.push(sourceRefs[0])
  rehashFidelityPromptPackage(duplicatedTrace)
  assert.throws(() =>
    parseAiChartD1PalaceWritingFidelityPromptPackage(
      duplicatedTrace,
    ),
  )
})

check('Fidelity Adapter binds the exact review package and validates model output against both immutable sources', () => {
  const reviewPackage =
    buildAiChartD1PalaceWritingFidelityPromptPackage(
      promptPackage,
      writingResult,
    )
  const bridge =
    buildAiChartD1PalaceWritingFidelityAdapterBridge(
      reviewPackage,
      promptPackage,
      writingResult,
    )
  assert.equal(
    bridge.descriptor.contractVersion,
    AI_CHART_D1_PALACE_WRITING_FIDELITY_ADAPTER_BRIDGE_VERSION,
  )
  assert.equal(
    bridge.descriptor.description,
    AI_CHART_D1_PALACE_WRITING_FIDELITY_ADAPTER_BRIDGE_DESCRIPTION,
  )
  assert.equal(
    bridge.descriptor.promptPackageFingerprint,
    reviewPackage.packageFingerprint,
  )
  assert.equal(
    bridge.descriptor.sourceWritingPackageFingerprint,
    promptPackage.packageFingerprint,
  )
  assert.equal(
    bridge.descriptor.sourceWritingResultSha256,
    createAiChartD1PalaceWritingResultSha256(writingResult),
  )
  assert.equal(
    bridge.descriptor.outputContractVersion,
    AI_CHART_D1_PALACE_WRITING_FIDELITY_REVIEW_VERSION,
  )
  assert.equal(
    bridge.descriptor.outputSchemaName,
    AI_CHART_D1_PALACE_WRITING_FIDELITY_REVIEW_SCHEMA_NAME,
  )
  assert.equal(
    bridge.descriptor.maxOutputTokens,
    AI_CHART_D1_PALACE_WRITING_REVIEW_MAX_OUTPUT_TOKENS,
  )
  assert.equal(bridge.descriptor.openAiCallable, false)
  assert.equal(
    bridge.request.instructions,
    reviewPackage.instructions,
  )
  assert.equal(bridge.request.userInput, reviewPackage.userInput)
  assert.deepEqual(
    bridge.request.parseResult(approvedReview),
    approvedReview,
  )

  const wrongCell = structuredClone(approvedReview)
  wrongCell.sectionReviews[0].contentCellRef =
    'content-grid-cell:palace:ming:forged'
  assert.throws(() => bridge.request.parseResult(wrongCell))
})

check('Fidelity instructions make the stage review-only and forbid free-form rewriting', () => {
  assert.match(
    AI_CHART_D1_PALACE_WRITING_FIDELITY_PROMPT_INSTRUCTIONS,
    /逐格/
  )
  assert.match(
    AI_CHART_D1_PALACE_WRITING_FIDELITY_PROMPT_INSTRUCTIONS,
    /不得改寫/
  )
  assert.match(
    AI_CHART_D1_PALACE_WRITING_FIDELITY_PROMPT_INSTRUCTIONS,
    /單一 JSON value/
  )
  assert.doesNotMatch(
    AI_CHART_D1_PALACE_WRITING_FIDELITY_PROMPT_INSTRUCTIONS,
    /API[_ -]?KEY|OPENAI_API_KEY|Authorization/i,
  )
})

check('Writing and review Adapter modules remain pure contracts with no server runtime, fetch, env, or secret access', () => {
  const files = [
    './d1PalaceWritingAdapterBridgeContracts.ts',
    './d1PalaceWritingFidelityPromptPackageContracts.ts',
    './d1PalaceWritingFidelityPromptInstructions.ts',
  ]
  for (const relativePath of files) {
    const source = readFileSync(
      fileURLToPath(new URL(relativePath, import.meta.url)),
      'utf8',
    )
    assert.doesNotMatch(source, /\bfetch\s*\(/)
    assert.doesNotMatch(source, /process\.env/)
    assert.doesNotMatch(source, /\.server(?:['"]|$)/)
    assert.doesNotMatch(
      source,
      /OPENAI_API_KEY|Authorization|Bearer\s/i,
    )
  }
})

console.log(
  `AI Chart D1 palace writing Adapter bridge contracts: ${checks} checks passed`,
)
