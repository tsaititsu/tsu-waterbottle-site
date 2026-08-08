import {
  assertAiChartD1SafeGraph,
  freezeAiChartD1Value,
  requireAiChartD1ExactObject,
} from './d1CommonContracts'
import {
  buildAiChartD1HealthDirectionScan,
  type AiChartD1HealthDirectionScan,
} from './d1HealthDirectionScan'
import {
  buildAiChartD1HealthReminderSection,
  type AiChartD1HealthReminderSection,
} from './d1HealthReminderCards'
import {
  AI_CHART_D1_PALACE_IDENTITIES,
  type AiChartD1PalaceId,
} from './d1N0Constants'
import { parseAiChartD1N0 } from './d1N0Parser'
import {
  validateAiChartD1PalaceWritingFidelityReviewAgainstSources,
} from './d1PalaceWritingFidelityReviewContracts'
import {
  parseAiChartD1PalaceWritingPromptPackage,
} from './d1PalaceWritingPromptPackageContracts'
import {
  createAiChartD1PalaceWritingResultSha256,
  validateAiChartD1PalaceWritingResultAgainstPromptPackage,
  type AiChartD1PalaceWritingResultSection,
} from './d1PalaceWritingResultContracts'

export const AI_CHART_D1_REPORT_ASSEMBLY_VERSION =
  'ai-chart-d1-report-assembly/v1' as const
export const AI_CHART_D1_REPORT_ASSEMBLY_INVALID =
  'ai_chart_d1_report_assembly_invalid' as const

export const AI_CHART_D1_REPORT_ASSEMBLY_ERROR_REASONS = Object.freeze([
  'INPUT_SHAPE_INVALID',
  'PALACE_COVERAGE_MISMATCH',
  'SOURCE_CONTRACT_INVALID',
  'IDENTITY_OR_SOURCE_MISMATCH',
  'FIDELITY_REVIEW_NOT_APPROVED',
] as const)

export type AiChartD1ReportAssemblyErrorReason =
  (typeof AI_CHART_D1_REPORT_ASSEMBLY_ERROR_REASONS)[number]

export type AiChartD1ReportAssemblyPalace = Readonly<{
  targetPalaceId: AiChartD1PalaceId
  sourcePackageFingerprint: string
  sourceWritingResultSha256: string
  sourceFidelityReviewId: string
  sections: readonly AiChartD1PalaceWritingResultSection[]
  healthReminderSection: AiChartD1HealthReminderSection | null
}>

export type AiChartD1ReportAssembly = Readonly<{
  contractVersion: typeof AI_CHART_D1_REPORT_ASSEMBLY_VERSION
  chartId: string
  runId: string
  sourceSnapshotSha256: string
  sourceContentGridSha256: string
  primaryLifeRegion: string
  reportLanguage: string
  palaces: readonly AiChartD1ReportAssemblyPalace[]
  healthDirectionScan: AiChartD1HealthDirectionScan
  fidelityReviewStatus: 'approved'
  humanReviewStatus: 'required'
  customerDeliveryStatus: 'blocked_pending_human_review'
  openAiCallable: false
}>

export class AiChartD1ReportAssemblyError extends Error {
  readonly code = AI_CHART_D1_REPORT_ASSEMBLY_INVALID
  declare readonly reasonCode: AiChartD1ReportAssemblyErrorReason

  constructor(reasonCode: AiChartD1ReportAssemblyErrorReason) {
    super(AI_CHART_D1_REPORT_ASSEMBLY_INVALID)
    this.name = 'AiChartD1ReportAssemblyError'
    Object.defineProperty(this, 'reasonCode', {
      value: reasonCode,
      enumerable: true,
      writable: false,
      configurable: false,
    })
    Object.freeze(this)
  }
}

const INPUT_FIELDS = Object.freeze([
  'n0',
  'gender',
  'palaceSources',
] as const)
const PALACE_SOURCE_FIELDS = Object.freeze([
  'promptPackage',
  'writingResult',
  'fidelityReview',
] as const)

function invalid(reasonCode: AiChartD1ReportAssemblyErrorReason): never {
  throw new AiChartD1ReportAssemblyError(reasonCode)
}

function parseInput(input: unknown): Readonly<{
  n0: unknown
  gender: 'male' | 'female'
  palaceSources: readonly unknown[]
}> {
  try {
    assertAiChartD1SafeGraph(input)
    const record = requireAiChartD1ExactObject(input, INPUT_FIELDS)
    if (
      (record.gender !== 'male' && record.gender !== 'female') ||
      !Array.isArray(record.palaceSources)
    ) {
      invalid('INPUT_SHAPE_INVALID')
    }
    return Object.freeze({
      n0: record.n0,
      gender: record.gender,
      palaceSources: record.palaceSources,
    })
  } catch (error) {
    if (error instanceof AiChartD1ReportAssemblyError) throw error
    invalid('INPUT_SHAPE_INVALID')
  }
}

export function buildAiChartD1ReportAssembly(
  input: unknown,
): AiChartD1ReportAssembly {
  const parsedInput = parseInput(input)
  if (
    parsedInput.palaceSources.length !==
    AI_CHART_D1_PALACE_IDENTITIES.length
  ) {
    invalid('PALACE_COVERAGE_MISMATCH')
  }

  let n0: ReturnType<typeof parseAiChartD1N0>
  let healthDirectionScan: AiChartD1HealthDirectionScan
  try {
    n0 = parseAiChartD1N0(parsedInput.n0)
    healthDirectionScan = buildAiChartD1HealthDirectionScan({
      n0,
      gender: parsedInput.gender,
    })
  } catch {
    invalid('SOURCE_CONTRACT_INVALID')
  }

  let runId: string | null = null
  let sourceContentGridSha256: string | null = null
  let primaryLifeRegion: string | null = null
  let reportLanguage: string | null = null
  const palaces: AiChartD1ReportAssemblyPalace[] = []

  for (
    let index = 0;
    index < AI_CHART_D1_PALACE_IDENTITIES.length;
    index += 1
  ) {
    const expectedPalaceId =
      AI_CHART_D1_PALACE_IDENTITIES[index].palaceId
    let sourceRecord: Record<string, unknown>
    try {
      sourceRecord = requireAiChartD1ExactObject(
        parsedInput.palaceSources[index],
        PALACE_SOURCE_FIELDS,
      )
    } catch {
      invalid('SOURCE_CONTRACT_INVALID')
    }

    try {
      const promptPackage =
        parseAiChartD1PalaceWritingPromptPackage(
          sourceRecord.promptPackage,
        )
      const writingResult =
        validateAiChartD1PalaceWritingResultAgainstPromptPackage(
          sourceRecord.writingResult,
          promptPackage,
        )
      const fidelityReview =
        validateAiChartD1PalaceWritingFidelityReviewAgainstSources(
          sourceRecord.fidelityReview,
          writingResult,
          promptPackage,
        )

      if (promptPackage.targetPalaceId !== expectedPalaceId) {
        invalid('PALACE_COVERAGE_MISMATCH')
      }
      if (
        promptPackage.chartId !== n0.chartId ||
        promptPackage.sourceSnapshotSha256 !==
          n0.sourceSnapshotSha256 ||
        (runId !== null && promptPackage.runId !== runId) ||
        (sourceContentGridSha256 !== null &&
          promptPackage.sourceContentGridSha256 !==
            sourceContentGridSha256) ||
        (primaryLifeRegion !== null &&
          promptPackage.primaryLifeRegion !== primaryLifeRegion) ||
        (reportLanguage !== null &&
          promptPackage.reportLanguage !== reportLanguage)
      ) {
        invalid('IDENTITY_OR_SOURCE_MISMATCH')
      }
      if (
        fidelityReview.fidelityReviewStatus !== 'approved' ||
        fidelityReview.customerDeliveryStatus !== 'ready'
      ) {
        invalid('FIDELITY_REVIEW_NOT_APPROVED')
      }

      runId ??= promptPackage.runId
      sourceContentGridSha256 ??=
        promptPackage.sourceContentGridSha256
      primaryLifeRegion ??= promptPackage.primaryLifeRegion
      reportLanguage ??= promptPackage.reportLanguage

      const healthReminderSection =
        expectedPalaceId === 'palace:health'
          ? buildAiChartD1HealthReminderSection({
              targetPalaceId: expectedPalaceId,
              canonicalHealthDirections:
                healthDirectionScan.canonicalHealthDirections,
            })
          : null

      palaces.push(
        freezeAiChartD1Value({
          targetPalaceId: expectedPalaceId,
          sourcePackageFingerprint:
            promptPackage.packageFingerprint,
          sourceWritingResultSha256:
            createAiChartD1PalaceWritingResultSha256(writingResult),
          sourceFidelityReviewId:
            fidelityReview.fidelityReviewId,
          sections: writingResult.sections.map((section) => ({
            contentCellRef: section.contentCellRef,
            facetId: section.facetId,
            customerText: section.customerText,
          })),
          healthReminderSection,
        }),
      )
    } catch (error) {
      if (error instanceof AiChartD1ReportAssemblyError) throw error
      invalid('SOURCE_CONTRACT_INVALID')
    }
  }

  if (
    runId === null ||
    sourceContentGridSha256 === null ||
    primaryLifeRegion === null ||
    reportLanguage === null
  ) {
    invalid('PALACE_COVERAGE_MISMATCH')
  }

  return freezeAiChartD1Value({
    contractVersion: AI_CHART_D1_REPORT_ASSEMBLY_VERSION,
    chartId: n0.chartId,
    runId,
    sourceSnapshotSha256: n0.sourceSnapshotSha256,
    sourceContentGridSha256,
    primaryLifeRegion,
    reportLanguage,
    palaces,
    healthDirectionScan,
    fidelityReviewStatus: 'approved' as const,
    humanReviewStatus: 'required' as const,
    customerDeliveryStatus:
      'blocked_pending_human_review' as const,
    openAiCallable: false as const,
  })
}
