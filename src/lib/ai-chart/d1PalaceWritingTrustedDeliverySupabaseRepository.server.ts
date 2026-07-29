import 'server-only'

import {
  assertAiChartD1SafeGraph,
  freezeAiChartD1Value,
  requireAiChartD1ExactObject,
} from './d1CommonContracts'
import type {
  AiChartD1PalaceWritingAtomicDeliveryRpcCommand,
} from './d1PalaceWritingTrustedDeliveryRepositoryAdapter.server'

export const AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_SUPABASE_REPOSITORY_VERSION =
  'ai-chart-d1-palace-writing-trusted-delivery-supabase-repository/v1' as const
export const AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_SUPABASE_REPOSITORY_TASK =
  'D1_PALACE_WRITING_TRUSTED_DELIVERY_SUPABASE_REPOSITORY' as const
export const AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_SUPABASE_RPC_NAME =
  'deliver_ai_chart_report_after_review' as const

export const AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_SUPABASE_REPOSITORY_FAILURE_CODES =
  Object.freeze([
    'SUPABASE_RPC_REPOSITORY_UNAVAILABLE',
    'SUPABASE_RPC_COMMAND_INVALID',
    'SUPABASE_RPC_TRANSPORT_FAILED',
    'SUPABASE_RPC_FAILED',
    'SUPABASE_RPC_RESPONSE_INVALID',
  ] as const)

export type AiChartD1PalaceWritingTrustedDeliverySupabaseRepositoryFailureCode =
  (typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_SUPABASE_REPOSITORY_FAILURE_CODES)[number]

const DEPENDENCY_FIELDS = Object.freeze([
  'rpc',
] as const)
const COMMAND_FIELDS = Object.freeze([
  'p_report_id',
  'p_expected_owner_user_id',
  'p_review_record',
  'p_report_snapshot_sha256',
  'p_gate_fingerprint',
  'p_record_fingerprint',
  'p_record_payload_sha256',
  'p_envelope_fingerprint',
  'p_contract_fingerprint',
  'p_source_coordination_fingerprint',
  'p_idempotency_key',
  'p_artifact_payload_sha256',
  'p_ledger_receipt_fingerprint',
  'p_delivery_claim_fingerprint',
  'p_delivery_receipt_fingerprint',
  'p_report_content_sha256',
  'p_report_content',
] as const)
const RESPONSE_FIELDS = Object.freeze([
  'data',
  'error',
  'count',
  'status',
  'statusText',
] as const)
const RESULT_FIELDS = Object.freeze([
  'result_code',
  'ledger_receipt_fingerprint',
  'delivery_claim_fingerprint',
  'delivery_receipt_fingerprint',
  'report_content_sha256',
] as const)
const ERROR_FIELDS = Object.freeze([
  'code',
  'details',
  'hint',
  'message',
] as const)
const KNOWN_DELIVERY_FAILURE_MESSAGES =
  Object.freeze([
    'ai_chart_report_delivery_report_not_found',
    'ai_chart_report_delivery_owner_mismatch',
    'ai_chart_report_delivery_payment_required',
    'ai_chart_report_delivery_snapshot_missing',
    'ai_chart_report_delivery_snapshot_mismatch',
    'ai_chart_report_delivery_ledger_conflict',
    'ai_chart_report_delivery_report_state_conflict',
    'ai_chart_report_delivery_idempotency_conflict',
  ] as const)
const SHA256_PATTERN = /^[a-f0-9]{64}$/u
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu
const SHA256_COMMAND_FIELDS = Object.freeze([
  'p_report_snapshot_sha256',
  'p_gate_fingerprint',
  'p_record_fingerprint',
  'p_record_payload_sha256',
  'p_envelope_fingerprint',
  'p_contract_fingerprint',
  'p_source_coordination_fingerprint',
  'p_idempotency_key',
  'p_artifact_payload_sha256',
  'p_ledger_receipt_fingerprint',
  'p_delivery_claim_fingerprint',
  'p_delivery_receipt_fingerprint',
  'p_report_content_sha256',
] as const)

type SupabaseRpc = (
  functionName:
    typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_SUPABASE_RPC_NAME,
  command:
    AiChartD1PalaceWritingAtomicDeliveryRpcCommand,
) => PromiseLike<unknown>

export type AiChartD1PalaceWritingTrustedDeliverySupabaseAtomicRpcInvoker =
  (
    command:
      AiChartD1PalaceWritingAtomicDeliveryRpcCommand,
  ) => Promise<unknown>

export class AiChartD1PalaceWritingTrustedDeliverySupabaseRepositoryError
  extends Error {
  readonly code:
    AiChartD1PalaceWritingTrustedDeliverySupabaseRepositoryFailureCode

  constructor(
    code:
      AiChartD1PalaceWritingTrustedDeliverySupabaseRepositoryFailureCode,
    safeMessage?: string,
  ) {
    const safeCode =
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_SUPABASE_REPOSITORY_FAILURE_CODES.includes(
        code,
      )
        ? code
        : 'SUPABASE_RPC_REPOSITORY_UNAVAILABLE'
    const normalizedMessage =
      safeMessage !== undefined &&
      KNOWN_DELIVERY_FAILURE_MESSAGES.includes(
        safeMessage as
          (typeof KNOWN_DELIVERY_FAILURE_MESSAGES)[number],
      )
        ? safeMessage
        : safeCode
    super(normalizedMessage)
    this.name =
      'AiChartD1PalaceWritingTrustedDeliverySupabaseRepositoryError'
    this.code = safeCode
    Object.freeze(this)
  }
}

function fail(
  code:
    AiChartD1PalaceWritingTrustedDeliverySupabaseRepositoryFailureCode,
  safeMessage?: string,
): never {
  throw new AiChartD1PalaceWritingTrustedDeliverySupabaseRepositoryError(
    code,
    safeMessage,
  )
}

function parseCommand(
  value: unknown,
): AiChartD1PalaceWritingAtomicDeliveryRpcCommand {
  try {
    assertAiChartD1SafeGraph(value)
    if (!Object.isFrozen(value)) {
      fail('SUPABASE_RPC_COMMAND_INVALID')
    }
    const command = requireAiChartD1ExactObject(
      value,
      COMMAND_FIELDS,
    )
    if (
      typeof command.p_report_id !== 'string' ||
      !UUID_PATTERN.test(command.p_report_id) ||
      typeof command.p_expected_owner_user_id !==
        'string' ||
      !UUID_PATTERN.test(
        command.p_expected_owner_user_id,
      ) ||
      typeof command.p_review_record !== 'string' ||
      command.p_review_record.trim().length === 0 ||
      Buffer.byteLength(
        command.p_review_record,
        'utf8',
      ) > 32_768 ||
      typeof command.p_report_content !== 'string' ||
      command.p_report_content.trim().length === 0 ||
      SHA256_COMMAND_FIELDS.some(
        (field) =>
          typeof command[field] !== 'string' ||
          !SHA256_PATTERN.test(command[field]),
      )
    ) {
      fail('SUPABASE_RPC_COMMAND_INVALID')
    }
    return value as
      AiChartD1PalaceWritingAtomicDeliveryRpcCommand
  } catch (error) {
    if (
      error instanceof
      AiChartD1PalaceWritingTrustedDeliverySupabaseRepositoryError
    ) {
      throw error
    }
    fail('SUPABASE_RPC_COMMAND_INVALID')
  }
}

function parseResponse(
  value: unknown,
): Readonly<Record<string, unknown>> {
  try {
    assertAiChartD1SafeGraph(value)
    const response = requireAiChartD1ExactObject(
      value,
      RESPONSE_FIELDS,
    )
    if (response.error !== null) {
      let safeMessage: string | undefined
      try {
        const providerError =
          requireAiChartD1ExactObject(
            response.error,
            ERROR_FIELDS,
          )
        if (typeof providerError.message === 'string') {
          safeMessage = providerError.message
        }
      } catch {
        safeMessage = undefined
      }
      fail('SUPABASE_RPC_FAILED', safeMessage)
    }
    if (
      !Array.isArray(response.data) ||
      response.data.length !== 1
    ) {
      fail('SUPABASE_RPC_RESPONSE_INVALID')
    }
    const row = requireAiChartD1ExactObject(
      response.data[0],
      RESULT_FIELDS,
    )
    return freezeAiChartD1Value({
      result_code: row.result_code,
      ledger_receipt_fingerprint:
        row.ledger_receipt_fingerprint,
      delivery_claim_fingerprint:
        row.delivery_claim_fingerprint,
      delivery_receipt_fingerprint:
        row.delivery_receipt_fingerprint,
      report_content_sha256:
        row.report_content_sha256,
    })
  } catch (error) {
    if (
      error instanceof
      AiChartD1PalaceWritingTrustedDeliverySupabaseRepositoryError
    ) {
      throw error
    }
    fail('SUPABASE_RPC_RESPONSE_INVALID')
  }
}

export function createAiChartD1PalaceWritingTrustedDeliverySupabaseAtomicRpcInvoker(
  dependencies: Readonly<{
    rpc: SupabaseRpc
  }>,
): AiChartD1PalaceWritingTrustedDeliverySupabaseAtomicRpcInvoker {
  let dependenciesRecord: Record<string, unknown>
  try {
    dependenciesRecord =
      requireAiChartD1ExactObject(
        dependencies,
        DEPENDENCY_FIELDS,
      )
  } catch {
    fail('SUPABASE_RPC_REPOSITORY_UNAVAILABLE')
  }
  if (
    process.env.NODE_ENV !== 'test' ||
    typeof dependenciesRecord.rpc !== 'function'
  ) {
    fail('SUPABASE_RPC_REPOSITORY_UNAVAILABLE')
  }
  const rpc = dependenciesRecord.rpc as SupabaseRpc

  const invoke =
    async (
      command:
        AiChartD1PalaceWritingAtomicDeliveryRpcCommand,
    ): Promise<unknown> => {
      const parsedCommand = parseCommand(command)
      let response: unknown
      try {
        response = await rpc(
          AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_SUPABASE_RPC_NAME,
          parsedCommand,
        )
      } catch {
        fail('SUPABASE_RPC_TRANSPORT_FAILED')
      }
      return parseResponse(response)
    }

  return Object.freeze(invoke)
}
