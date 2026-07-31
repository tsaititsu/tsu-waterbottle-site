import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  AI_CHART_D1_REPORT_GENERATION_PIPELINE_VERSION,
  AI_CHART_D1_REPORT_WRITER_RUNTIME_NOT_READY,
  AiChartD1ReportWriterRuntimeNotReadyError,
  buildAiChartD1ReportGenerationPlan,
  generateAiChartD1ReportContentFromSnapshot,
} from './reportGenerationPipeline'
import { AI_CHART_D1_PALACE_IDENTITIES } from './d1N0Constants'
import { AI_CHART_D1_P1_MAX_OUTPUT_TOKENS } from './d1P1AdapterBridgeContracts'
import { AI_CHART_D1_P1_REPORT_OPENAI_RUNTIME_TIMEOUT_MS } from './d1P1PreviewTimeoutContracts'
import { completeModelInputSnapshot, getTestCatalog } from './d1P1ModelInputTestSupport'
import {
  AI_CHART_D1_REPORT_WRITER_RUNTIME_MODEL_EXECUTION_REQUIRED,
  createAiChartD1ReportWriterRuntimeCommandFingerprint,
  prepareAiChartD1ReportWriterRuntimeAdapter,
} from './d1ReportWriterRuntimeContracts'
import {
  AI_CHART_D1_P1_REPORT_EXECUTION_LEDGER_VERSION,
  AI_CHART_D1_P1_REPORT_EXECUTION_PLAN_INVALID,
  AI_CHART_D1_P1_REPORT_EXECUTION_RUNTIME_PLAN_VERSION,
  buildAiChartD1P1ReportExecutionPlan,
  createAiChartD1P1ReportExecutionLedger,
  createAiChartD1P1ReportExecutionPlanFingerprint,
  runAiChartD1P1ReportExecutionRuntime,
} from './d1P1ReportExecutionRuntimeContracts'
import {
  AI_CHART_OPENAI_OUTPUT_SCHEMA_INVALID,
  AI_CHART_OPENAI_RESPONSE_INVALID,
  AiChartOpenAiError,
} from './openAiResponses'

async function main() {
  const snapshot = completeModelInputSnapshot()
  const d1K0Catalog = await getTestCatalog()
  const plan = buildAiChartD1ReportGenerationPlan({
    reportId: 'report-pipeline-1',
    chartSnapshot: snapshot,
    d1K0Catalog,
  })

  assert.equal(
    plan.contractVersion,
    AI_CHART_D1_REPORT_GENERATION_PIPELINE_VERSION,
  )
  assert.equal(plan.chartId, 'chart:report-pipeline-1')
  assert.equal(plan.p1StructuralInputCount, 12)
  assert.equal(plan.openAiCallable, false)
  assert.equal(plan.nextStage, 'd1_p1_model_execution_required')
  assert.deepEqual(
    plan.targetPalaceIds,
    AI_CHART_D1_PALACE_IDENTITIES.map((identity) => identity.palaceId),
  )
  assert.equal(
    plan.writerRuntimeCommand.runtimeMode,
    'PRODUCTION_REPORT_WRITER',
  )
  assert.equal(
    plan.writerRuntimeCommand.runtimeStatus,
    'D1_P1_ADAPTER_BRIDGES_PREPARED',
  )
  assert.equal(
    plan.writerRuntimeCommand.nextRequiredAction,
    'EXECUTE_D1_P1_MODEL_REQUESTS_WITH_EXPLICIT_AUTHORIZATION',
  )
  assert.equal(plan.writerRuntimeCommand.p1AdapterBridgeDescriptorCount, 12)
  assert.deepEqual(
    plan.writerRuntimeCommand.p1AdapterBridgeDescriptors.map(
      (descriptor) => descriptor.targetPalaceId,
    ),
    plan.targetPalaceIds,
  )
  for (const descriptor of plan.writerRuntimeCommand.p1AdapterBridgeDescriptors) {
    assert.equal(descriptor.requestStatus, 'ready')
    assert.equal(descriptor.runtimeStatus, 'runtime_wiring_required')
    assert.equal(descriptor.openAiCallable, false)
    assert.equal(
      descriptor.timeoutMs,
      AI_CHART_D1_P1_REPORT_OPENAI_RUNTIME_TIMEOUT_MS,
    )
    assert.equal(descriptor.maxOutputTokens, AI_CHART_D1_P1_MAX_OUTPUT_TOKENS)
    assert.match(descriptor.bridgeFingerprint, /^[a-f0-9]{64}$/u)
    assert.match(descriptor.packageFingerprint, /^[a-f0-9]{64}$/u)
    assert.match(descriptor.modelInputFingerprint, /^[a-f0-9]{64}$/u)
  }
  assert.equal(plan.writerRuntimeCommand.productionCallable, false)
  assert.equal(plan.writerRuntimeCommand.fetchAllowed, false)
  assert.equal(plan.writerRuntimeCommand.openAiCallable, false)
  assert.equal(plan.writerRuntimeCommand.attemptedRequests, 0)
  assert.equal(plan.writerRuntimeCommand.executedRequests, 0)
  assert.equal(plan.writerRuntimeCommand.fetchCount, 0)
  assert.equal(plan.writerRuntimeCommand.openAiRequests, 0)
  assert.equal(plan.writerRuntimeCommand.retryPerformed, false)
  assert.equal(
    plan.writerRuntimeCommand.customerDeliveryAllowed,
    false,
  )
  assert.equal(
    plan.p1ReportExecutionPlan.contractVersion,
    AI_CHART_D1_P1_REPORT_EXECUTION_RUNTIME_PLAN_VERSION,
  )
  assert.equal(
    plan.p1ReportExecutionPlan.executionMode,
    'sequential_twelve_palaces',
  )
  assert.equal(plan.p1ReportExecutionPlan.maxRequests, 12)
  assert.equal(
    plan.p1ReportExecutionPlan.p1AdapterBridgeDescriptorCount,
    12,
  )
  assert.deepEqual(
    plan.p1ReportExecutionPlan.targetPalaceIds,
    plan.targetPalaceIds,
  )
  assert.deepEqual(
    plan.p1ReportExecutionPlan.p1AdapterBridgeDescriptors.map(
      (descriptor) => descriptor.targetPalaceId,
    ),
    plan.targetPalaceIds,
  )
  assert.deepEqual(
    plan.p1ReportExecutionPlan.p1AdapterBridgeDescriptors.map(
      (descriptor) => descriptor.timeoutMs,
    ),
    Array.from(
      { length: 12 },
      () => AI_CHART_D1_P1_REPORT_OPENAI_RUNTIME_TIMEOUT_MS,
    ),
  )
  assert.equal(plan.p1ReportExecutionPlan.productionCallable, false)
  assert.equal(plan.p1ReportExecutionPlan.fetchAllowed, false)
  assert.equal(plan.p1ReportExecutionPlan.openAiCallable, false)
  assert.equal(plan.p1ReportExecutionPlan.retryAllowed, false)
  assert.equal(plan.p1ReportExecutionPlan.fallbackAllowed, false)
  assert.equal(plan.p1ReportExecutionPlan.customerDeliveryAllowed, false)
  assert.equal(plan.p1ReportExecutionPlan.safeMetadataOnly, true)
  assert.equal(Object.isFrozen(plan.p1ReportExecutionPlan), true)
  assert.equal(
    Object.isFrozen(plan.p1ReportExecutionPlan.targetPalaceIds),
    true,
  )
  assert.equal(
    Object.isFrozen(
      plan.p1ReportExecutionPlan.p1AdapterBridgeDescriptors,
    ),
    true,
  )
  assert.deepEqual(
    plan.writerRuntimeCommand.targetPalaceIds,
    plan.targetPalaceIds,
  )
  assert.equal(Object.isFrozen(plan), true)
  assert.equal(Object.isFrozen(plan.targetPalaceIds), true)
  assert.equal(
    Object.isFrozen(plan.writerRuntimeCommand),
    true,
  )
  assert.equal(
    Object.isFrozen(
      plan.writerRuntimeCommand.targetPalaceIds,
    ),
    true,
  )
  assert.equal(
    Object.isFrozen(
      plan.writerRuntimeCommand.p1AdapterBridgeDescriptors,
    ),
    true,
  )
  assert.equal(
    Object.isFrozen(
      plan.writerRuntimeCommand.p1AdapterBridgeDescriptors[0],
    ),
    true,
  )

  const independentlyBuiltExecutionPlan =
    buildAiChartD1P1ReportExecutionPlan(plan.writerRuntimeCommand)
  assert.deepEqual(
    independentlyBuiltExecutionPlan,
    plan.p1ReportExecutionPlan,
  )
  const executionPlanFingerprint =
    createAiChartD1P1ReportExecutionPlanFingerprint(
      plan.p1ReportExecutionPlan,
    )
  assert.match(executionPlanFingerprint, /^[a-f0-9]{64}$/u)
  const readyLedger = createAiChartD1P1ReportExecutionLedger(
    plan.p1ReportExecutionPlan,
  )
  assert.equal(
    readyLedger.contractVersion,
    AI_CHART_D1_P1_REPORT_EXECUTION_LEDGER_VERSION,
  )
  assert.equal(readyLedger.status, 'READY')
  assert.equal(readyLedger.planFingerprint, executionPlanFingerprint)
  assert.equal(readyLedger.palaceExecutionCount, 12)
  assert.equal(readyLedger.attemptedRequests, 0)
  assert.equal(readyLedger.executedRequests, 0)
  assert.equal(readyLedger.fetchCount, 0)
  assert.equal(readyLedger.openAiRequests, 0)
  assert.equal(readyLedger.retryPerformed, false)
  assert.equal(readyLedger.currentPalaceId, null)
  assert.deepEqual(
    readyLedger.palaceExecutions.map((entry) => entry.status),
    Array.from({ length: 12 }, () => 'PENDING'),
  )
  assert.equal(Object.isFrozen(readyLedger), true)
  assert.equal(Object.isFrozen(readyLedger.palaceExecutions), true)
  assert.equal(Object.isFrozen(readyLedger.palaceExecutions[0]), true)

  const successfulCalls: string[] = []
  const successfulSettlements: Array<{
    targetPalaceId: string
    result: unknown
  }> = []
  const successLedger = await runAiChartD1P1ReportExecutionRuntime(
    plan.p1ReportExecutionPlan,
    async (descriptor) => {
      successfulCalls.push(descriptor.targetPalaceId)
      return {
        data: {
          marker:
            'raw model output marker must never be stored in execution ledger',
          targetPalaceId: descriptor.targetPalaceId,
        },
        usage: {
          inputTokens: 10,
          outputTokens: 20,
          reasoningTokens: 3,
          totalTokens: 33,
        },
      }
    },
    {
      onPalaceSettled: async (settlement) => {
        assert.equal(settlement.status, 'SUCCEEDED')
        successfulSettlements.push({
          targetPalaceId: settlement.targetPalaceId,
          result: settlement.result,
        })
      },
    },
  )
  assert.deepEqual(successfulCalls, plan.targetPalaceIds)
  assert.deepEqual(
    successfulSettlements.map(({ targetPalaceId }) => targetPalaceId),
    plan.targetPalaceIds,
  )
  assert.equal(
    successfulSettlements.every(
      ({ result }) =>
        typeof result === 'object' &&
        result !== null &&
        Object.isFrozen(result),
    ),
    true,
  )
  assert.equal(successLedger.status, 'SUCCEEDED')
  assert.equal(successLedger.attemptedRequests, 12)
  assert.equal(successLedger.executedRequests, 12)
  assert.equal(successLedger.fetchCount, 12)
  assert.equal(successLedger.openAiRequests, 12)
  assert.equal(successLedger.retryPerformed, false)
  assert.equal(successLedger.currentPalaceId, null)
  assert.equal(
    successLedger.palaceExecutions.every(
      (entry) =>
        entry.status === 'SUCCEEDED' &&
        entry.attemptedRequests === 1 &&
        entry.executedRequests === 1 &&
        entry.fetchCount === 1 &&
        entry.openAiRequests === 1 &&
        entry.retryPerformed === false &&
        typeof entry.resultFingerprint === 'string' &&
        /^[a-f0-9]{64}$/u.test(entry.resultFingerprint) &&
        entry.errorCode === null &&
        entry.retryable === null &&
        entry.responseDiagnostic === null &&
        entry.transportDiagnostic === null &&
        entry.usage?.totalTokens === 33,
    ),
    true,
  )
  assert.equal(
    JSON.stringify(successLedger).includes('raw model output marker'),
    false,
  )

  const failedCalls: string[] = []
  const failedSettlements: Array<{
    targetPalaceId: string
    status: string
    result: unknown
  }> = []
  const leakedOutputText = 'sensitive output_text marker'
  const failureLedger = await runAiChartD1P1ReportExecutionRuntime(
    plan.p1ReportExecutionPlan,
    async (descriptor) => {
      failedCalls.push(descriptor.targetPalaceId)
      if (descriptor.targetPalaceId === plan.targetPalaceIds[0]) {
        throw new AiChartOpenAiError(
          AI_CHART_OPENAI_OUTPUT_SCHEMA_INVALID,
          false,
          {
            responseStatus: 'completed',
            incompleteReason: null,
            responseErrorCode: null,
            outputItemTypes: ['message'],
            contentItemTypes: ['output_text'],
            outputTextCount: 1,
            outputSchemaValidationCode:
              'COVERAGE_MAJOR_STARS_MISMATCH',
            usage: {
              inputTokens: 17,
              outputTokens: 8,
              reasoningTokens: 2,
              totalTokens: 27,
            },
            unsafe: leakedOutputText,
          } as never,
        )
      }
      return {
        data: Object.freeze({
          targetPalaceId: descriptor.targetPalaceId,
        }),
        usage: null,
      }
    },
    {
      onPalaceSettled: async (settlement) => {
        failedSettlements.push({
          targetPalaceId: settlement.targetPalaceId,
          status: settlement.status,
          result:
            settlement.status === 'SUCCEEDED'
              ? settlement.result
              : null,
        })
      },
    },
  )
  assert.deepEqual(failedCalls, plan.targetPalaceIds)
  assert.deepEqual(
    failedSettlements.map(({ targetPalaceId }) => targetPalaceId),
    plan.targetPalaceIds,
  )
  assert.deepEqual(
    failedSettlements.map(({ status }) => status),
    [
      'FAILED',
      ...Array.from({ length: 11 }, () => 'SUCCEEDED'),
    ],
  )
  assert.equal(failedSettlements[0].result, null)
  assert.equal(failureLedger.status, 'FAILED')
  assert.equal(failureLedger.attemptedRequests, 12)
  assert.equal(failureLedger.executedRequests, 11)
  assert.equal(failureLedger.fetchCount, 12)
  assert.equal(failureLedger.openAiRequests, 12)
  assert.equal(failureLedger.retryPerformed, false)
  assert.equal(failureLedger.currentPalaceId, plan.targetPalaceIds[0])
  assert.equal(
    failureLedger.palaceExecutions[0].errorCode,
    AI_CHART_OPENAI_OUTPUT_SCHEMA_INVALID,
  )
  assert.equal(failureLedger.palaceExecutions[0].retryable, false)
  assert.equal(
    failureLedger.palaceExecutions[0].responseDiagnostic
      ?.outputSchemaValidationCode,
    'COVERAGE_MAJOR_STARS_MISMATCH',
  )
  assert.equal(
    failureLedger.palaceExecutions[0].responseDiagnostic?.usage
      ?.totalTokens,
    27,
  )
  assert.deepEqual(
    failureLedger.palaceExecutions
      .slice(1)
      .map((entry) => entry.status),
    Array.from({ length: 11 }, () => 'SUCCEEDED'),
  )
  assert.equal(JSON.stringify(failureLedger).includes(leakedOutputText), false)
  assert.equal(JSON.stringify(failureLedger).includes('output_text'), true)
  assert.equal(Object.isFrozen(failureLedger), true)
  assert.equal(
    Object.isFrozen(
      failureLedger.palaceExecutions[0].responseDiagnostic,
    ),
    true,
  )

  let persistenceFailureExecutorCalls = 0
  await assert.rejects(
    () =>
      runAiChartD1P1ReportExecutionRuntime(
        plan.p1ReportExecutionPlan,
        async (descriptor) => {
          persistenceFailureExecutorCalls += 1
          return {
            data: Object.freeze({
              targetPalaceId: descriptor.targetPalaceId,
            }),
            usage: null,
          }
        },
        {
          onPalaceSettled: async () => {
            throw new Error('durable_palace_result_write_failed')
          },
        },
      ),
    { message: 'durable_palace_result_write_failed' },
  )
  assert.equal(persistenceFailureExecutorCalls, 1)

  let forgedPlanExecutorCalls = 0
  const forgedThirteenPalacePlan = Object.freeze({
    ...plan.p1ReportExecutionPlan,
    targetPalaceIds: Object.freeze([
      ...plan.p1ReportExecutionPlan.targetPalaceIds,
      'palace:forged',
    ]),
    p1AdapterBridgeDescriptors: Object.freeze([
      ...plan.p1ReportExecutionPlan.p1AdapterBridgeDescriptors,
      {
        ...plan.p1ReportExecutionPlan.p1AdapterBridgeDescriptors[0],
        targetPalaceId: 'palace:forged',
        callId: 'forged-call-id',
      },
    ]),
  })
  await assert.rejects(
    () =>
      runAiChartD1P1ReportExecutionRuntime(
        forgedThirteenPalacePlan as never,
        async (descriptor) => {
          forgedPlanExecutorCalls += 1
          return {
            data: { targetPalaceId: descriptor.targetPalaceId },
            usage: null,
          }
        },
      ),
    { message: AI_CHART_D1_P1_REPORT_EXECUTION_PLAN_INVALID },
  )
  assert.equal(forgedPlanExecutorCalls, 0)

  const maliciousErrorCode =
    'prompt-output-chart-marker must never be stored as an error code'
  const maliciousCodeLedger =
    await runAiChartD1P1ReportExecutionRuntime(
      plan.p1ReportExecutionPlan,
      async () => {
        throw new AiChartOpenAiError(
          maliciousErrorCode as never,
          true,
        )
      },
    )
  assert.equal(
    maliciousCodeLedger.palaceExecutions[0].errorCode,
    AI_CHART_OPENAI_RESPONSE_INVALID,
  )
  assert.equal(maliciousCodeLedger.palaceExecutions[0].retryable, false)
  assert.equal(
    JSON.stringify(maliciousCodeLedger).includes(maliciousErrorCode),
    false,
  )

  const runtimeSource = readFileSync(
    fileURLToPath(
      new URL('./d1P1ReportExecutionRuntimeContracts.ts', import.meta.url),
    ),
    'utf8',
  )
  assert.equal(
    runtimeSource.includes('requestAiChartOpenAiStructuredResponse'),
    false,
  )
  assert.equal(runtimeSource.includes('OPENAI_API_KEY'), false)
  assert.equal(runtimeSource.includes('process.env'), false)
  assert.equal(/\bfetch\s*\(/u.test(runtimeSource), false)

  const adapterResult =
    prepareAiChartD1ReportWriterRuntimeAdapter(
      plan.writerRuntimeCommand,
    )
  assert.equal(
    adapterResult.status,
    'BLOCKED_D1_P1_MODEL_EXECUTION_REQUIRED',
  )
  assert.equal(
    adapterResult.stage,
    'D1_P1_ADAPTER_BRIDGES_PREPARED',
  )
  assert.equal(
    adapterResult.error,
    AI_CHART_D1_REPORT_WRITER_RUNTIME_MODEL_EXECUTION_REQUIRED,
  )
  assert.equal(
    adapterResult.commandFingerprint,
    createAiChartD1ReportWriterRuntimeCommandFingerprint(
      plan.writerRuntimeCommand,
    ),
  )
  assert.equal(adapterResult.productionCallable, false)
  assert.equal(adapterResult.fetchAllowed, false)
  assert.equal(adapterResult.openAiCallable, false)
  assert.equal(adapterResult.attemptedRequests, 0)
  assert.equal(adapterResult.executedRequests, 0)
  assert.equal(adapterResult.fetchCount, 0)
  assert.equal(adapterResult.openAiRequests, 0)
  assert.equal(adapterResult.retryPerformed, false)
  assert.equal(adapterResult.customerDeliveryAllowed, false)
  assert.equal(
    adapterResult.reportContentStatus,
    'BLOCKED_PENDING_D1_P1_MODEL_OUTPUTS',
  )
  assert.equal(adapterResult.p1AdapterBridgeDescriptorCount, 12)
  assert.deepEqual(
    adapterResult.p1AdapterBridgeDescriptors.map(
      (descriptor) => descriptor.targetPalaceId,
    ),
    plan.targetPalaceIds,
  )
  assert.equal(Object.isFrozen(adapterResult), true)
  assert.equal(
    Object.isFrozen(adapterResult.targetPalaceIds),
    true,
  )
  assert.equal(
    Object.isFrozen(adapterResult.p1AdapterBridgeDescriptors),
    true,
  )
  assert.deepEqual(
    adapterResult.targetPalaceIds,
    plan.targetPalaceIds,
  )
  const sensitiveMarker = 'sensitive prompt marker'
  assert.throws(
    () =>
      prepareAiChartD1ReportWriterRuntimeAdapter({
        ...plan.writerRuntimeCommand,
        prompt: sensitiveMarker,
      }),
    (error) => {
      assert.equal(
        error instanceof Error &&
          error.message.includes(sensitiveMarker),
        false,
      )
      return true
    },
  )
  assert.equal(
    JSON.stringify(adapterResult).includes('OpenAI'),
    false,
  )
  assert.equal(
    JSON.stringify(adapterResult).includes('instructions'),
    false,
  )
  assert.equal(
    JSON.stringify(adapterResult).includes('userInput'),
    false,
  )
  assert.equal(
    JSON.stringify(adapterResult).includes('schema'),
    false,
  )
  assert.equal(
    JSON.stringify(adapterResult).includes('output_text'),
    false,
  )

  try {
    generateAiChartD1ReportContentFromSnapshot({
      reportId: 'report-pipeline-1',
      chartSnapshot: snapshot,
      d1K0Catalog,
    })
    assert.fail('expected writer runtime not ready')
  } catch (error) {
    assert.equal(error instanceof AiChartD1ReportWriterRuntimeNotReadyError, true)
    assert.equal(
      (error as AiChartD1ReportWriterRuntimeNotReadyError).code,
      AI_CHART_D1_REPORT_WRITER_RUNTIME_NOT_READY,
    )
    assert.equal(String(error).includes('OpenAI'), false)
    assert.equal(String(error).includes('output_text'), false)
  }

  assert.throws(() =>
    buildAiChartD1ReportGenerationPlan({
      reportId: '   ',
      chartSnapshot: snapshot,
      d1K0Catalog,
    }),
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
