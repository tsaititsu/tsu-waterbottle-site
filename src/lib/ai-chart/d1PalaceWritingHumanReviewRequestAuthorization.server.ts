import 'server-only'

import { createHash } from 'node:crypto'
import {
  requireAdminUser,
  type RequireAdminUserResult,
} from '@/lib/auth/admin'
import {
  freezeAiChartD1Value,
} from './d1CommonContracts'
import {
  AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_PERMISSION,
} from './d1PalaceWritingPreviewHumanReviewAuthorizationHandoff.server'
import {
  createAiChartD1PalaceWritingCanonicalJson,
} from './d1PalaceWritingPromptPackageContracts'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_REQUEST_AUTHORIZATION_VERSION =
  'ai-chart-d1-palace-writing-human-review-request-authorization/v1' as const
export const AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_REQUEST_AUTHORIZATION_TASK =
  'D1_PALACE_WRITING_HUMAN_REVIEW_REQUEST_AUTHORIZATION' as const

export const AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_REQUEST_AUTHORIZATION_FAILURE_CODES =
  Object.freeze([
    'AUTHORIZATION_ADAPTER_UNAVAILABLE',
    'REVIEWER_SESSION_INVALID',
    'REVIEWER_PERMISSION_DENIED',
    'REVIEWER_IDENTITY_INVALID',
  ] as const)

export type AiChartD1PalaceWritingHumanReviewRequestAuthorizationFailureCode =
  (typeof AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_REQUEST_AUTHORIZATION_FAILURE_CODES)[number]

type RequireAdmin =
  (request: Request) => Promise<RequireAdminUserResult>

export type AiChartD1PalaceWritingHumanReviewRequestAuthorization =
  Readonly<{
    contractVersion:
      typeof AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_REQUEST_AUTHORIZATION_VERSION
    task:
      typeof AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_REQUEST_AUTHORIZATION_TASK
    dataClassification:
      'AUTHORIZED_REVIEWER_IDENTITY_METADATA'
    reviewerId: string
    permission:
      typeof AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_PERMISSION
    sessionBindingStatus:
      'REQUEST_BOUND_SERVER_VERIFIED'
    authorizationPolicy:
      'EXISTING_SERVER_ADMIN_ALLOWLIST'
    capabilityScope:
      'IN_PROCESS_EXACT_OBJECT_IDENTITY'
    productionCallable: true
    formalReviewRecordAllowed: false
    customerDeliveryAllowed: false
    openAiRequests: 0
    authorizationFingerprint: string
  }>

const activeAuthorizations = new WeakMap<
  AiChartD1PalaceWritingHumanReviewRequestAuthorization,
  AiChartD1PalaceWritingHumanReviewRequestAuthorization
>()
const consumedAuthorizations =
  new WeakSet<AiChartD1PalaceWritingHumanReviewRequestAuthorization>()

export class AiChartD1PalaceWritingHumanReviewRequestAuthorizationError
  extends Error {
  readonly code:
    AiChartD1PalaceWritingHumanReviewRequestAuthorizationFailureCode

  constructor(
    code:
      AiChartD1PalaceWritingHumanReviewRequestAuthorizationFailureCode,
  ) {
    const safeCode =
      AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_REQUEST_AUTHORIZATION_FAILURE_CODES.includes(
        code,
      )
        ? code
        : 'AUTHORIZATION_ADAPTER_UNAVAILABLE'
    super(safeCode)
    this.name =
      'AiChartD1PalaceWritingHumanReviewRequestAuthorizationError'
    this.code = safeCode
    Object.freeze(this)
  }
}

function fail(
  code:
    AiChartD1PalaceWritingHumanReviewRequestAuthorizationFailureCode,
): never {
  throw new AiChartD1PalaceWritingHumanReviewRequestAuthorizationError(
    code,
  )
}

function sha256Canonical(value: unknown): string {
  return createHash('sha256')
    .update(
      createAiChartD1PalaceWritingCanonicalJson(value),
      'utf8',
    )
    .digest('hex')
}

function mapDeniedStatus(status: number): never {
  if (status === 401) {
    fail('REVIEWER_SESSION_INVALID')
  }
  if (status === 403) {
    fail('REVIEWER_PERMISSION_DENIED')
  }
  fail('AUTHORIZATION_ADAPTER_UNAVAILABLE')
}

export async function authorizeAiChartD1PalaceWritingHumanReviewRequest(
  request: Request,
  dependencies: Readonly<{
    requireAdmin?: RequireAdmin
  }> = {},
): Promise<AiChartD1PalaceWritingHumanReviewRequestAuthorization> {
  try {
    if (!(request instanceof Request)) {
      fail('REVIEWER_SESSION_INVALID')
    }
    if (
      dependencies.requireAdmin !== undefined &&
      process.env.NODE_ENV !== 'test'
    ) {
      fail('AUTHORIZATION_ADAPTER_UNAVAILABLE')
    }
    const requireAdmin =
      dependencies.requireAdmin ?? requireAdminUser
    const result = await requireAdmin(request)
    if ('error' in result) {
      mapDeniedStatus(result.error.status)
    }
    if (
      typeof result.user.id !== 'string' ||
      !UUID_PATTERN.test(result.user.id)
    ) {
      fail('REVIEWER_IDENTITY_INVALID')
    }
    const withoutFingerprint = {
      contractVersion:
        AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_REQUEST_AUTHORIZATION_VERSION,
      task:
        AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_REQUEST_AUTHORIZATION_TASK,
      dataClassification:
        'AUTHORIZED_REVIEWER_IDENTITY_METADATA' as const,
      reviewerId: result.user.id,
      permission:
        AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_PERMISSION,
      sessionBindingStatus:
        'REQUEST_BOUND_SERVER_VERIFIED' as const,
      authorizationPolicy:
        'EXISTING_SERVER_ADMIN_ALLOWLIST' as const,
      capabilityScope:
        'IN_PROCESS_EXACT_OBJECT_IDENTITY' as const,
      productionCallable: true as const,
      formalReviewRecordAllowed: false as const,
      customerDeliveryAllowed: false as const,
      openAiRequests: 0 as const,
    }
    const authorization = freezeAiChartD1Value({
      ...withoutFingerprint,
      authorizationFingerprint:
        sha256Canonical(withoutFingerprint),
    })
    activeAuthorizations.set(
      authorization,
      authorization,
    )
    return authorization
  } catch (error) {
    if (
      error instanceof
      AiChartD1PalaceWritingHumanReviewRequestAuthorizationError
    ) {
      throw error
    }
    fail('AUTHORIZATION_ADAPTER_UNAVAILABLE')
  }
}

export function consumeAiChartD1PalaceWritingHumanReviewRequestAuthorization(
  value: unknown,
): AiChartD1PalaceWritingHumanReviewRequestAuthorization {
  try {
    if (
      value === null ||
      typeof value !== 'object'
    ) {
      fail('REVIEWER_SESSION_INVALID')
    }
    const authorization =
      value as AiChartD1PalaceWritingHumanReviewRequestAuthorization
    if (consumedAuthorizations.has(authorization)) {
      fail('REVIEWER_SESSION_INVALID')
    }
    const activeAuthorization =
      activeAuthorizations.get(authorization)
    if (activeAuthorization === undefined) {
      fail('REVIEWER_SESSION_INVALID')
    }
    activeAuthorizations.delete(authorization)
    consumedAuthorizations.add(authorization)
    return activeAuthorization
  } catch (error) {
    if (
      error instanceof
      AiChartD1PalaceWritingHumanReviewRequestAuthorizationError
    ) {
      throw error
    }
    fail('REVIEWER_SESSION_INVALID')
  }
}
