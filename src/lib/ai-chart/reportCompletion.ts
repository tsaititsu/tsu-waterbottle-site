import {
  decideAiChartReportResultAccess,
  getAiChartReportCompletionSubject,
  markAiChartReportCompleted,
  markAiChartReportFailed,
} from '../supabase/aiChartReports'
import {
  AI_CHART_D1_REPORT_WRITER_RUNTIME_NOT_READY,
  AiChartD1ReportWriterRuntimeNotReadyError,
  createAiChartD1ReportChartId,
} from './reportGenerationPipeline'
import { generateAiChartReportContent, type AiChartReportGenerationInput } from './reportGenerator'
import { createAiChartD1CanonicalSha256 } from './d1CanonicalDigest'
import {
  AI_CHART_D1_REPORT_ASSEMBLY_VERSION,
  buildAiChartD1ReportAssembly,
  type AiChartD1ReportAssembly,
} from './d1ReportAssemblyContracts'

export const AI_CHART_REPORT_GENERATION_FAILED = 'AI_CHART_REPORT_GENERATION_FAILED'
export const AI_CHART_REPORT_COMPLETION_CHART_SNAPSHOT_REQUIRED =
  'AI_CHART_REPORT_COMPLETION_CHART_SNAPSHOT_REQUIRED' as const

export type CompleteAiChartReportInput = {
  reportId: string
  chartInput?: AiChartReportGenerationInput | null
}

export type CompleteAiChartReportResult =
  | { result: 'completed'; reportId: string }
  | {
      result: 'human_review_required'
      reportId: string
      assemblyFingerprint: string
      palaceCount: 12
    }
  | { result: 'already_completed'; reportId: string }
  | { result: 'payment_required'; reportId: string }
  | { result: 'not_found'; reportId: string }
  | { result: 'invalid_state'; reportId: string; paymentStatus: string | null }
  | {
      result: 'runtime_not_ready'
      reportId: string
      error: typeof AI_CHART_D1_REPORT_WRITER_RUNTIME_NOT_READY
    }
  | {
      result: 'chart_snapshot_required'
      reportId: string
      error: typeof AI_CHART_REPORT_COMPLETION_CHART_SNAPSHOT_REQUIRED
    }
  | { result: 'failed'; reportId: string; error: string }

type AiChartD1K0CatalogCompiler = () => Promise<unknown>
type AiChartReportContentGenerator = (
  chartInput: AiChartReportGenerationInput,
) => string | Promise<string>
type AiChartD1ReportAssemblyInputPreparer = (
  chartInput: AiChartReportGenerationInput,
) => unknown | Promise<unknown>
export type PersistAiChartD1ReportAssemblyForHumanReviewInput = Readonly<{
  reportId: string
  sourceSnapshotSha256: string
  assemblyFingerprint: string
  assembly: AiChartD1ReportAssembly
}>
export type PersistAiChartD1ReportAssemblyForHumanReviewResult =
  Readonly<{
    result: 'persisted' | 'already_persisted'
    reportId: string
    assemblyFingerprint: string
  }>
type PersistAiChartD1ReportAssemblyForHumanReview = (
  input: PersistAiChartD1ReportAssemblyForHumanReviewInput,
) => Promise<PersistAiChartD1ReportAssemblyForHumanReviewResult>

async function compileDefaultAiChartD1K0Catalog(): Promise<unknown> {
  const { compileAiChartD1K0Catalog } = await import(
    './d1K0Catalog.server'
  )
  return compileAiChartD1K0Catalog()
}

function isAiChartD1ReportWriterRuntimeNotReadyError(error: unknown) {
  return (
    error instanceof AiChartD1ReportWriterRuntimeNotReadyError ||
    (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === AI_CHART_D1_REPORT_WRITER_RUNTIME_NOT_READY
    )
  )
}

async function markAiChartReportGenerationFailed(
  reportId: string,
  markFailed: typeof markAiChartReportFailed,
): Promise<CompleteAiChartReportResult> {
  try {
    await markFailed({
      reportId,
      errorMessage: AI_CHART_REPORT_GENERATION_FAILED,
    })
  } catch {
    // Best effort only: callers should receive the safe generation failure code.
  }

  return {
    result: 'failed',
    reportId,
    error: AI_CHART_REPORT_GENERATION_FAILED,
  }
}

function hasServerChartSnapshot(
  report: Pick<
    NonNullable<
      Awaited<ReturnType<typeof getAiChartReportCompletionSubject>>
    >,
    'chartSnapshot' | 'chartSnapshotSha256'
  >,
) {
  return (
    report.chartSnapshot !== null &&
    report.chartSnapshot !== undefined &&
    typeof report.chartSnapshotSha256 === 'string' &&
    report.chartSnapshotSha256.trim().length > 0
  )
}

function isAssemblyBoundToReport(input: {
  reportId: string
  chartSnapshotSha256: string
  assembly: AiChartD1ReportAssembly
}) {
  return (
    input.assembly.contractVersion === AI_CHART_D1_REPORT_ASSEMBLY_VERSION &&
    input.assembly.chartId === createAiChartD1ReportChartId(input.reportId) &&
    input.assembly.sourceSnapshotSha256 === input.chartSnapshotSha256 &&
    input.assembly.palaces.length === 12 &&
    input.assembly.fidelityReviewStatus === 'approved' &&
    input.assembly.humanReviewStatus === 'required' &&
    input.assembly.customerDeliveryStatus ===
      'blocked_pending_human_review' &&
    input.assembly.openAiCallable === false
  )
}

export async function completePaidAiChartReport(
  input: CompleteAiChartReportInput,
  deps?: {
    getAiChartReportCompletionSubject?: typeof getAiChartReportCompletionSubject
    markAiChartReportCompleted?: typeof markAiChartReportCompleted
    markAiChartReportFailed?: typeof markAiChartReportFailed
    generateAiChartReportContent?: AiChartReportContentGenerator
    compileAiChartD1K0Catalog?: AiChartD1K0CatalogCompiler
    prepareAiChartD1ReportAssemblyInput?: AiChartD1ReportAssemblyInputPreparer
    buildAiChartD1ReportAssembly?: typeof buildAiChartD1ReportAssembly
    persistAiChartD1ReportAssemblyForHumanReview?:
      PersistAiChartD1ReportAssemblyForHumanReview
  },
): Promise<CompleteAiChartReportResult> {
  const readReport =
    deps?.getAiChartReportCompletionSubject ??
    getAiChartReportCompletionSubject
  const markCompleted = deps?.markAiChartReportCompleted ?? markAiChartReportCompleted
  const markFailed = deps?.markAiChartReportFailed ?? markAiChartReportFailed
  const generateReportContent = deps?.generateAiChartReportContent ?? generateAiChartReportContent
  const compileD1K0Catalog =
    deps?.compileAiChartD1K0Catalog ??
    compileDefaultAiChartD1K0Catalog

  const report = await readReport(input.reportId)
  if (report === null) {
    return {
      result: 'not_found',
      reportId: input.reportId,
    }
  }

  const decision = decideAiChartReportResultAccess(report)

  if (decision.result === 'not_found') {
    return {
      result: 'not_found',
      reportId: input.reportId,
    }
  }

  if (decision.result === 'payment_required') {
    return {
      result: 'payment_required',
      reportId: input.reportId,
    }
  }

  if (decision.result === 'ready') {
    return {
      result: 'already_completed',
      reportId: input.reportId,
    }
  }

  if (decision.result === 'invalid_state') {
    return {
      result: 'invalid_state',
      reportId: input.reportId,
      paymentStatus: decision.paymentStatus,
    }
  }

  if (!hasServerChartSnapshot(report)) {
    return {
      result: 'chart_snapshot_required',
      reportId: input.reportId,
      error: AI_CHART_REPORT_COMPLETION_CHART_SNAPSHOT_REQUIRED,
    }
  }
  const chartSnapshotSha256 = report.chartSnapshotSha256
  if (typeof chartSnapshotSha256 !== 'string') {
    return {
      result: 'chart_snapshot_required',
      reportId: input.reportId,
      error: AI_CHART_REPORT_COMPLETION_CHART_SNAPSHOT_REQUIRED,
    }
  }

  const generationInput: AiChartReportGenerationInput = {
    ...(input.chartInput ?? {}),
    reportId: input.reportId,
    chartSnapshot: report.chartSnapshot,
    chartSnapshotSha256,
  }
  const prepareAssemblyInput =
    deps?.prepareAiChartD1ReportAssemblyInput
  const persistAssembly =
    deps?.persistAiChartD1ReportAssemblyForHumanReview

  if (prepareAssemblyInput !== undefined || persistAssembly !== undefined) {
    if (prepareAssemblyInput === undefined || persistAssembly === undefined) {
      return {
        result: 'runtime_not_ready',
        reportId: input.reportId,
        error: AI_CHART_D1_REPORT_WRITER_RUNTIME_NOT_READY,
      }
    }

    try {
      const buildAssembly =
        deps?.buildAiChartD1ReportAssembly ??
        buildAiChartD1ReportAssembly
      const assembly = buildAssembly(
        await prepareAssemblyInput(generationInput),
      )
      if (
        !isAssemblyBoundToReport({
          reportId: input.reportId,
          chartSnapshotSha256,
          assembly,
        })
      ) {
        throw new Error(AI_CHART_REPORT_GENERATION_FAILED)
      }
      const assemblyFingerprint =
        createAiChartD1CanonicalSha256(assembly)
      const persistenceResult = await persistAssembly({
        reportId: input.reportId,
        sourceSnapshotSha256: chartSnapshotSha256,
        assemblyFingerprint,
        assembly,
      })
      if (
        (persistenceResult.result !== 'persisted' &&
          persistenceResult.result !== 'already_persisted') ||
        persistenceResult.reportId !== input.reportId ||
        persistenceResult.assemblyFingerprint !== assemblyFingerprint
      ) {
        throw new Error(AI_CHART_REPORT_GENERATION_FAILED)
      }

      return {
        result: 'human_review_required',
        reportId: input.reportId,
        assemblyFingerprint,
        palaceCount: 12,
      }
    } catch {
      return markAiChartReportGenerationFailed(
        input.reportId,
        markFailed,
      )
    }
  }

  let reportContent: string
  try {
    const d1K0Catalog =
      deps?.generateAiChartReportContent === undefined
        ? await compileD1K0Catalog()
        : undefined
    reportContent = await generateReportContent({
      ...generationInput,
      d1K0Catalog,
    })
  } catch (error) {
    if (isAiChartD1ReportWriterRuntimeNotReadyError(error)) {
      return {
        result: 'runtime_not_ready',
        reportId: input.reportId,
        error: AI_CHART_D1_REPORT_WRITER_RUNTIME_NOT_READY,
      }
    }

    return markAiChartReportGenerationFailed(input.reportId, markFailed)
  }

  try {
    const completedResult = await markCompleted({
      reportId: input.reportId,
      reportContent,
    })

    if (completedResult.result === 'updated') {
      return {
        result: 'completed',
        reportId: input.reportId,
      }
    }

    if (completedResult.result === 'already_completed') {
      return {
        result: 'already_completed',
        reportId: input.reportId,
      }
    }

    if (completedResult.result === 'payment_required') {
      return {
        result: 'payment_required',
        reportId: input.reportId,
      }
    }

    if (completedResult.result === 'not_found') {
      return {
        result: 'not_found',
        reportId: input.reportId,
      }
    }

    return {
      result: 'invalid_state',
      reportId: input.reportId,
      paymentStatus: completedResult.paymentStatus,
    }
  } catch {
    return markAiChartReportGenerationFailed(input.reportId, markFailed)
  }
}
