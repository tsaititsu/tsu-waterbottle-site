import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  createAiChartD1PalaceWritingResultSha256,
  validateAiChartD1PalaceWritingResultAgainstPromptPackage,
  type AiChartD1PalaceWritingResult,
} from './d1PalaceWritingResultContracts'
import {
  AI_CHART_D1_PALACE_WRITING_FIDELITY_REVIEW_TASK,
  AI_CHART_D1_PALACE_WRITING_FIDELITY_REVIEW_VERSION,
} from './d1PalaceWritingFidelityReviewContracts'
import {
  buildAiChartD1PalaceWritingGoldenCase,
} from './d1PalaceWritingGoldenCaseContracts'
import {
  buildAiChartD1PalaceWritingPreviewPlan,
} from './d1PalaceWritingPreviewContracts'
import {
  AiChartD1PalaceWritingPreviewMockRuntimeError,
  runAiChartD1PalaceWritingPreviewMockRuntime,
  type AiChartD1PalaceWritingPreviewMockStageCommand,
} from './d1PalaceWritingPreviewMockRuntimeContracts'

let checks = 0

async function check(
  name: string,
  run: () => Promise<void> | void,
): Promise<void> {
  try {
    await run()
    checks += 1
    console.log(`✓ ${name}`)
  } catch (error) {
    console.error(`✗ ${name}`)
    throw error
  }
}

function recursivelyFrozen(value: unknown): boolean {
  if (value === null || typeof value !== 'object') return true
  if (!Object.isFrozen(value)) return false
  return Reflect.ownKeys(value).every((key) =>
    recursivelyFrozen(
      (value as Record<PropertyKey, unknown>)[key],
    ),
  )
}

const goldenCase = buildAiChartD1PalaceWritingGoldenCase()
const plan = buildAiChartD1PalaceWritingPreviewPlan(goldenCase)

function createAlternativeWritingResult():
  AiChartD1PalaceWritingResult {
  const value = structuredClone(
    goldenCase.expectedWritingResult,
  ) as unknown as {
    sections: Array<{
      contentCellRef: string
      facetId: string
      customerText: string
    }>
  }
  value.sections[0].customerText =
    '命宮的紫微重視尊重、面子與主導感，所以你可能希望自己的決定被認真看待；這是人格傾向，不代表每次都一定如此。'
  return validateAiChartD1PalaceWritingResultAgainstPromptPackage(
    value,
    goldenCase.writingPromptPackage,
  )
}

function createApprovedReview(
  writingResult: AiChartD1PalaceWritingResult,
): unknown {
  return {
    contractVersion:
      AI_CHART_D1_PALACE_WRITING_FIDELITY_REVIEW_VERSION,
    task:
      AI_CHART_D1_PALACE_WRITING_FIDELITY_REVIEW_TASK,
    fidelityReviewId:
      'palace-writing-review:palace:ming:mock-runtime-v1',
    chartId: writingResult.chartId,
    runId: writingResult.runId,
    callId: writingResult.callId,
    targetPalaceId: writingResult.targetPalaceId,
    sourcePackageFingerprint:
      writingResult.sourcePackageFingerprint,
    sourceWritingResultVersion: writingResult.contractVersion,
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

const WRITING_USAGE = Object.freeze({
  inputTokens: 120,
  outputTokens: 60,
  reasoningTokens: 10,
  totalTokens: 180,
})
const REVIEW_USAGE = Object.freeze({
  inputTokens: 80,
  outputTokens: 20,
  reasoningTokens: 5,
  totalTokens: 100,
})

async function run(): Promise<void> {
await check('mock runtime executes Writing then Fidelity Review and derives the second bridge from the actual validated Writing Result', async () => {
  const writingResult = createAlternativeWritingResult()
  const commands: AiChartD1PalaceWritingPreviewMockStageCommand[] = []
  const result =
    await runAiChartD1PalaceWritingPreviewMockRuntime(
      {
        previewPlan: plan,
        goldenCase,
        executeStage: async (command) => {
          commands.push(command)
          if (command.stage === 'WRITING') {
            return {
              status: 'SUCCEEDED',
              durationMs: 12,
              usage: WRITING_USAGE,
              output: writingResult,
            }
          }
          return {
            status: 'SUCCEEDED',
            durationMs: 8,
            usage: REVIEW_USAGE,
            output: createApprovedReview(writingResult),
          }
        },
      },
    )

  assert.deepEqual(
    commands.map((command) => [
      command.sequence,
      command.stage,
      command.runtimeMode,
    ]),
    [
      [1, 'WRITING', 'MOCK_ONLY'],
      [2, 'FIDELITY_REVIEW', 'MOCK_ONLY'],
    ],
  )
  assert.equal(
    plan.stages[0].bridgeBinding,
    'EXACT_PLAN_FINGERPRINT',
  )
  assert.equal(
    plan.stages[1].bridgeBinding,
    'DERIVED_FROM_VALIDATED_WRITING_RESULT',
  )
  assert.equal(
    commands[0].bridgeFingerprint,
    plan.stages[0].bridgeFingerprint,
  )
  assert.notEqual(
    commands[1].bridgeFingerprint,
    plan.stages[1].bridgeFingerprint,
  )
  assert.equal(result.status, 'SIMULATED_SUCCEEDED')
  assert.equal(result.completedStage, 'COMPLETE')
  assert.equal(result.mockStageExecutions, 2)
  assert.equal(result.attemptedRequests, 0)
  assert.equal(result.executedRequests, 0)
  assert.equal(result.fetchCount, 0)
  assert.equal(result.openAiRequests, 0)
  assert.equal(result.retryPerformed, false)
  assert.equal(result.customerDeliveryStatus, 'BLOCKED_MOCK_ONLY')
  assert.equal(result.stages[0].status, 'SIMULATED_SUCCEEDED')
  assert.equal(result.stages[1].status, 'SIMULATED_SUCCEEDED')
  assert.equal(
    result.stages[1].bridgeFingerprint,
    commands[1].bridgeFingerprint,
  )
  assert.equal(recursivelyFrozen(result), true)
})

await check('Writing request failure stops before Fidelity Review and never retries', async () => {
  const calls: string[] = []
  const result =
    await runAiChartD1PalaceWritingPreviewMockRuntime({
      previewPlan: plan,
      goldenCase,
      executeStage: async (command) => {
        calls.push(command.stage)
        throw new Error('sensitive mock provider message')
      },
    })

  assert.deepEqual(calls, ['WRITING'])
  assert.equal(result.status, 'SIMULATED_FAILED')
  assert.equal(result.completedStage, 'WRITING')
  assert.equal(result.mockStageExecutions, 1)
  assert.equal(result.stages[0].errorCode, 'WRITING_REQUEST_FAILED')
  assert.equal(result.stages[1].status, 'NOT_STARTED')
  assert.equal(result.retryPerformed, false)
  assert.equal(
    JSON.stringify(result).includes(
      'sensitive mock provider message',
    ),
    false,
  )
})

await check('invalid Writing output is classified without starting Fidelity Review', async () => {
  const calls: string[] = []
  const result =
    await runAiChartD1PalaceWritingPreviewMockRuntime({
      previewPlan: plan,
      goldenCase,
      executeStage: async (command) => {
        calls.push(command.stage)
        return {
          status: 'SUCCEEDED',
          durationMs: 4,
          usage: WRITING_USAGE,
          output: {
            outputText: 'sensitive invalid model text',
          },
        }
      },
    })

  assert.deepEqual(calls, ['WRITING'])
  assert.equal(result.stages[0].errorCode, 'WRITING_OUTPUT_INVALID')
  assert.equal(result.stages[1].status, 'NOT_STARTED')
  assert.equal(
    JSON.stringify(result).includes(
      'sensitive invalid model text',
    ),
    false,
  )
})

await check('bounded request-failure outcome is recorded without retry or provider text', async () => {
  let calls = 0
  const result =
    await runAiChartD1PalaceWritingPreviewMockRuntime({
      previewPlan: plan,
      goldenCase,
      executeStage: async () => {
        calls += 1
        return {
          status: 'REQUEST_FAILED',
          durationMs: 7,
          usage: null,
        }
      },
    })

  assert.equal(calls, 1)
  assert.equal(result.status, 'SIMULATED_FAILED')
  assert.equal(result.mockStageExecutions, 1)
  assert.equal(result.stages[0].durationMs, 7)
  assert.equal(result.stages[0].usage, null)
  assert.equal(result.stages[0].errorCode, 'WRITING_REQUEST_FAILED')
  assert.equal(result.stages[1].status, 'NOT_STARTED')
  assert.equal(result.retryPerformed, false)
})

await check('Fidelity Review failure preserves Writing success and remains blocked without retry', async () => {
  const writingResult = createAlternativeWritingResult()
  const calls: string[] = []
  const result =
    await runAiChartD1PalaceWritingPreviewMockRuntime({
      previewPlan: plan,
      goldenCase,
      executeStage: async (command) => {
        calls.push(command.stage)
        if (command.stage === 'WRITING') {
          return {
            status: 'SUCCEEDED',
            durationMs: 5,
            usage: WRITING_USAGE,
            output: writingResult,
          }
        }
        throw new Error('sensitive review failure')
      },
    })

  assert.deepEqual(calls, ['WRITING', 'FIDELITY_REVIEW'])
  assert.equal(result.status, 'SIMULATED_FAILED')
  assert.equal(result.completedStage, 'FIDELITY_REVIEW')
  assert.equal(result.mockStageExecutions, 2)
  assert.equal(result.stages[0].status, 'SIMULATED_SUCCEEDED')
  assert.equal(
    result.stages[1].errorCode,
    'FIDELITY_REVIEW_REQUEST_FAILED',
  )
  assert.equal(result.retryPerformed, false)
  assert.equal(result.customerDeliveryStatus, 'BLOCKED_MOCK_ONLY')
  assert.equal(
    JSON.stringify(result).includes('sensitive review failure'),
    false,
  )
})

await check('invalid Fidelity Review output has its own fixed failure state', async () => {
  const writingResult = createAlternativeWritingResult()
  const result =
    await runAiChartD1PalaceWritingPreviewMockRuntime({
      previewPlan: plan,
      goldenCase,
      executeStage: async (command) => ({
        status: 'SUCCEEDED',
        durationMs: 3,
        usage:
          command.stage === 'WRITING'
            ? WRITING_USAGE
            : REVIEW_USAGE,
        output:
          command.stage === 'WRITING'
            ? writingResult
            : { arbitrary: 'sensitive review body' },
      }),
    })

  assert.equal(
    result.stages[1].errorCode,
    'FIDELITY_REVIEW_OUTPUT_INVALID',
  )
  assert.equal(
    JSON.stringify(result).includes('sensitive review body'),
    false,
  )
})

await check('invalid plan and malformed mock adapter outcomes fail closed through the module interface', async () => {
  let calls = 0
  await assert.rejects(
    runAiChartD1PalaceWritingPreviewMockRuntime({
      previewPlan: {
        ...plan,
        retry: true,
      },
      goldenCase,
      executeStage: async () => {
        calls += 1
        return {
          status: 'SUCCEEDED',
          durationMs: 1,
          usage: WRITING_USAGE,
          output: goldenCase.expectedWritingResult,
        }
      },
    }),
    AiChartD1PalaceWritingPreviewMockRuntimeError,
  )
  assert.equal(calls, 0)

  await assert.rejects(
    runAiChartD1PalaceWritingPreviewMockRuntime({
      previewPlan: plan,
      goldenCase,
      executeStage: async () =>
        ({
          status: 'UNSAFE_DYNAMIC_STATUS',
          providerMessage: 'sensitive message',
        }) as never,
    }),
    AiChartD1PalaceWritingPreviewMockRuntimeError,
  )
})

await check('mock runtime source has no network, secret, parallel-stage, retry, fallback, persistence, or deletion capability', () => {
  const source = readFileSync(
    fileURLToPath(
      new URL(
        './d1PalaceWritingPreviewMockRuntimeContracts.ts',
        import.meta.url,
      ),
    ),
    'utf8',
  )
  assert.doesNotMatch(
    source,
    /fetch\s*\(|OPENAI_API_KEY|Authorization\s*:|Bearer\s|requestAiChartOpenAiStructuredResponse|Promise\.all|retry\s*\(|fallback|writeFile|appendFile|unlink\s*\(|\brm\s*\(|rename\s*\(/,
  )
})

console.log(
  `AI Chart D1 palace-writing mock runtime checks passed: ${checks}`,
)
}

void run()
