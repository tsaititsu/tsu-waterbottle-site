import assert from 'node:assert/strict'
import {
  AI_CHART_D1_REPORT_GENERATION_PIPELINE_VERSION,
  AI_CHART_D1_REPORT_WRITER_RUNTIME_NOT_READY,
  AiChartD1ReportWriterRuntimeNotReadyError,
  buildAiChartD1ReportGenerationPlan,
  generateAiChartD1ReportContentFromSnapshot,
} from './reportGenerationPipeline'
import { AI_CHART_D1_PALACE_IDENTITIES } from './d1N0Constants'
import { AI_CHART_D1_P1_MAX_OUTPUT_TOKENS } from './d1P1AdapterBridgeContracts'
import { completeModelInputSnapshot, getTestCatalog } from './d1P1ModelInputTestSupport'
import {
  AI_CHART_D1_REPORT_WRITER_RUNTIME_MODEL_EXECUTION_REQUIRED,
  createAiChartD1ReportWriterRuntimeCommandFingerprint,
  prepareAiChartD1ReportWriterRuntimeAdapter,
} from './d1ReportWriterRuntimeContracts'

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
