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
  assert.equal(plan.nextStage, 'd1_palace_writer_runtime_required')
  assert.deepEqual(
    plan.targetPalaceIds,
    AI_CHART_D1_PALACE_IDENTITIES.map((identity) => identity.palaceId),
  )
  assert.equal(Object.isFrozen(plan), true)
  assert.equal(Object.isFrozen(plan.targetPalaceIds), true)

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
