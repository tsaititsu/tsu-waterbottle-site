import 'server-only'

import { createHash } from 'node:crypto'
import {
  getAiChartReportReviewSubject,
  type AiChartReportReviewSubject,
} from '@/lib/supabase/aiChartReports'
import {
  assertAiChartD1SafeGraph,
  freezeAiChartD1Value,
  requireAiChartD1ExactObject,
} from './d1CommonContracts'
import { normalizeAiChartD1N0 } from './d1N0'
import {
  createAiChartD1PalaceWritingCanonicalJson,
} from './d1PalaceWritingPromptPackageContracts'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu
const INPUT_FIELDS = Object.freeze([
  'reportId',
] as const)
const LOOKUP_RESULT_FIELDS = Object.freeze([
  'id',
  'ownerUserId',
  'paymentStatus',
  'chartSnapshot',
] as const)

export const AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_REPORT_SUBJECT_VERSION =
  'ai-chart-d1-palace-writing-human-review-report-subject/v1' as const
export const AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_REPORT_SUBJECT_TASK =
  'D1_PALACE_WRITING_HUMAN_REVIEW_REPORT_SUBJECT' as const

export const AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_REPORT_SUBJECT_FAILURE_CODES =
  Object.freeze([
    'REPORT_ID_INVALID',
    'REPORT_LOOKUP_UNAVAILABLE',
    'REPORT_NOT_FOUND',
    'REPORT_OWNER_INVALID',
    'REPORT_PAYMENT_REQUIRED',
    'REPORT_SNAPSHOT_INVALID',
  ] as const)

export type AiChartD1PalaceWritingHumanReviewReportSubjectFailureCode =
  (typeof AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_REPORT_SUBJECT_FAILURE_CODES)[number]

type LookupReportReviewSubject =
  (
    reportId: string,
  ) => Promise<AiChartReportReviewSubject | null>

export type AiChartD1PalaceWritingHumanReviewReportSubject =
  Readonly<{
    contractVersion:
      typeof AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_REPORT_SUBJECT_VERSION
    task:
      typeof AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_REPORT_SUBJECT_TASK
    dataClassification:
      'REPORT_SUBJECT_BINDING_METADATA'
    reportId: string
    reportSnapshotSha256: string
    reportLookupStatus: 'SERVER_FOUND'
    paymentStatus: 'SERVER_VERIFIED_PAID'
    ownerBindingStatus:
      'SERVER_RESOLVED_OWNER_PRESENT'
    sourceBindingStatus:
      'PENDING_ARTIFACT_SNAPSHOT_PROOF'
    capabilityScope:
      'IN_PROCESS_EXACT_OBJECT_IDENTITY'
    productionCallable: true
    formalReviewRecordAllowed: false
    customerDeliveryAllowed: false
    openAiRequests: 0
    subjectFingerprint: string
  }>

const activeSubjects = new WeakMap<
  AiChartD1PalaceWritingHumanReviewReportSubject,
  AiChartD1PalaceWritingHumanReviewReportSubject
>()
const consumedSubjects =
  new WeakSet<AiChartD1PalaceWritingHumanReviewReportSubject>()

export class AiChartD1PalaceWritingHumanReviewReportSubjectError
  extends Error {
  readonly code:
    AiChartD1PalaceWritingHumanReviewReportSubjectFailureCode

  constructor(
    code:
      AiChartD1PalaceWritingHumanReviewReportSubjectFailureCode,
  ) {
    const safeCode =
      AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_REPORT_SUBJECT_FAILURE_CODES.includes(
        code,
      )
        ? code
        : 'REPORT_LOOKUP_UNAVAILABLE'
    super(safeCode)
    this.name =
      'AiChartD1PalaceWritingHumanReviewReportSubjectError'
    this.code = safeCode
    Object.freeze(this)
  }
}

function fail(
  code:
    AiChartD1PalaceWritingHumanReviewReportSubjectFailureCode,
): never {
  throw new AiChartD1PalaceWritingHumanReviewReportSubjectError(
    code,
  )
}

function parseReportId(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !UUID_PATTERN.test(value)
  ) {
    fail('REPORT_ID_INVALID')
  }
  return value
}

function parseLookupResult(
  value: unknown,
  reportId: string,
): Readonly<{
  reportSnapshotSha256: string
}> {
  let record: Record<string, unknown>
  try {
    assertAiChartD1SafeGraph(value)
    record = requireAiChartD1ExactObject(
      value,
      LOOKUP_RESULT_FIELDS,
    )
  } catch {
    fail('REPORT_LOOKUP_UNAVAILABLE')
  }

  if (
    typeof record.id !== 'string' ||
    !UUID_PATTERN.test(record.id) ||
    record.id !== reportId
  ) {
    fail('REPORT_LOOKUP_UNAVAILABLE')
  }
  if (
    typeof record.ownerUserId !== 'string' ||
    !UUID_PATTERN.test(record.ownerUserId)
  ) {
    fail('REPORT_OWNER_INVALID')
  }
  if (record.paymentStatus !== 'paid') {
    fail('REPORT_PAYMENT_REQUIRED')
  }

  try {
    const n0 = normalizeAiChartD1N0(record.chartSnapshot, {
      chartId:
        `chart:report-review-subject:${reportId}`,
    })
    return freezeAiChartD1Value({
      reportSnapshotSha256:
        n0.sourceSnapshotSha256,
    })
  } catch {
    fail('REPORT_SNAPSHOT_INVALID')
  }
}

export async function resolveAiChartD1PalaceWritingHumanReviewReportSubject(
  input: unknown,
  dependencies: Readonly<{
    lookupReportReviewSubject?:
      LookupReportReviewSubject
  }> = {},
): Promise<AiChartD1PalaceWritingHumanReviewReportSubject> {
  try {
    assertAiChartD1SafeGraph(input)
    const inputRecord = requireAiChartD1ExactObject(
      input,
      INPUT_FIELDS,
    )
    const reportId = parseReportId(inputRecord.reportId)

    if (
      dependencies.lookupReportReviewSubject !==
        undefined &&
      process.env.NODE_ENV !== 'test'
    ) {
      fail('REPORT_LOOKUP_UNAVAILABLE')
    }
    const lookupReportReviewSubject =
      dependencies.lookupReportReviewSubject ??
      getAiChartReportReviewSubject
    const lookupResult =
      await lookupReportReviewSubject(reportId)
    if (lookupResult === null) {
      fail('REPORT_NOT_FOUND')
    }
    const { reportSnapshotSha256 } =
      parseLookupResult(lookupResult, reportId)

    const withoutFingerprint = {
      contractVersion:
        AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_REPORT_SUBJECT_VERSION,
      task:
        AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_REPORT_SUBJECT_TASK,
      dataClassification:
        'REPORT_SUBJECT_BINDING_METADATA' as const,
      reportId,
      reportSnapshotSha256,
      reportLookupStatus: 'SERVER_FOUND' as const,
      paymentStatus: 'SERVER_VERIFIED_PAID' as const,
      ownerBindingStatus:
        'SERVER_RESOLVED_OWNER_PRESENT' as const,
      sourceBindingStatus:
        'PENDING_ARTIFACT_SNAPSHOT_PROOF' as const,
      capabilityScope:
        'IN_PROCESS_EXACT_OBJECT_IDENTITY' as const,
      productionCallable: true as const,
      formalReviewRecordAllowed: false as const,
      customerDeliveryAllowed: false as const,
      openAiRequests: 0 as const,
    }
    const subject = freezeAiChartD1Value({
      ...withoutFingerprint,
      subjectFingerprint:
        createHash('sha256')
          .update(
            createAiChartD1PalaceWritingCanonicalJson(
              withoutFingerprint,
            ),
            'utf8',
          )
          .digest('hex'),
    })
    activeSubjects.set(subject, subject)
    return subject
  } catch (error) {
    if (
      error instanceof
      AiChartD1PalaceWritingHumanReviewReportSubjectError
    ) {
      throw error
    }
    fail('REPORT_LOOKUP_UNAVAILABLE')
  }
}

export function consumeAiChartD1PalaceWritingHumanReviewReportSubject(
  value: unknown,
): AiChartD1PalaceWritingHumanReviewReportSubject {
  try {
    if (
      value === null ||
      typeof value !== 'object'
    ) {
      fail('REPORT_LOOKUP_UNAVAILABLE')
    }
    const subject =
      value as AiChartD1PalaceWritingHumanReviewReportSubject
    if (consumedSubjects.has(subject)) {
      fail('REPORT_LOOKUP_UNAVAILABLE')
    }
    const activeSubject = activeSubjects.get(subject)
    if (activeSubject === undefined) {
      fail('REPORT_LOOKUP_UNAVAILABLE')
    }
    activeSubjects.delete(subject)
    consumedSubjects.add(subject)
    return activeSubject
  } catch (error) {
    if (
      error instanceof
      AiChartD1PalaceWritingHumanReviewReportSubjectError
    ) {
      throw error
    }
    fail('REPORT_LOOKUP_UNAVAILABLE')
  }
}
