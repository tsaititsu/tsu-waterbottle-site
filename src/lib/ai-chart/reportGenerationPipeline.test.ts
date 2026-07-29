import assert from 'node:assert/strict'
import {
  AI_CHART_D1_REPORT_GENERATION_PIPELINE_VERSION,
  AI_CHART_D1_REPORT_WRITER_RUNTIME_NOT_READY,
  AiChartD1ReportWriterRuntimeNotReadyError,
  buildAiChartD1ReportGenerationPlan,
  generateAiChartD1ReportContentFromSnapshot,
} from './reportGenerationPipeline'
import { AI_CHART_D1_PALACE_IDENTITIES } from './d1N0Constants'
import { createAiChartD1FlyingModelInputTestSnapshot } from './d1FlyingModelInputTestSupport'

async function main() {
  const snapshot = createAiChartD1FlyingModelInputTestSnapshot()
  const plan = buildAiChartD1ReportGenerationPlan({
    reportId: 'report-pipeline-1',
    chartSnapshot: snapshot,
  })

  assert.equal(
    plan.contractVersion,
    AI_CHART_D1_REPORT_GENERATION_PIPELINE_VERSION,
  )
  assert.equal(plan.chartId, 'chart:report-pipeline-1')
  assert.equal(plan.p1StructuralInputCount, 12)
  assert.equal(plan.openAiCallable, false)
  assert.equal(plan.nextStage, 'd1_report_writer_runtime_disabled')
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
    'DISABLED_PENDING_IMPLEMENTATION',
  )
  assert.equal(
    plan.writerRuntimeCommand.nextRequiredAction,
    'IMPLEMENT_D1_REPORT_WRITER_RUNTIME_ADAPTER',
  )
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

  try {
    generateAiChartD1ReportContentFromSnapshot({
      reportId: 'report-pipeline-1',
      chartSnapshot: snapshot,
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
    }),
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
