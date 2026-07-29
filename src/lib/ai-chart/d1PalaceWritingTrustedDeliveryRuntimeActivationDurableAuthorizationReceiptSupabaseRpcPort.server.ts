import 'server-only'

import {
  assertAiChartD1SafeGraph,
  freezeAiChartD1Value,
  requireAiChartD1ExactObject,
} from './d1CommonContracts'
import {
  AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_CONTRACT,
  type AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptStorageCondition,
} from './d1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptStorageContracts.server'

export const AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_SUPABASE_RPC_PORT_VERSION =
  'ai-chart-d1-palace-writing-trusted-delivery-runtime-activation-durable-authorization-receipt-supabase-rpc-port/v1' as const
export const AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_SUPABASE_RPC_PORT_TASK =
  'D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_SUPABASE_RPC_PORT' as const

const DEPENDENCY_FIELDS = Object.freeze([
  'rpc',
] as const)
const SUPABASE_RPC_RESPONSE_FIELDS =
  Object.freeze([
    'data',
    'error',
    'count',
    'status',
    'statusText',
  ] as const)
const SUPABASE_RPC_ERROR_FIELDS =
  Object.freeze([
    'code',
    'details',
    'hint',
    'message',
  ] as const)
const MAXIMUM_PARAMETER_LENGTH = 4_000

const storageContract =
  AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_CONTRACT

export type AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptSupabaseRpcName =
  | typeof storageContract.atomicCreateRpc
  | typeof storageContract.unknownWriteReconciliationRpc
  | typeof storageContract.runtimeReadRpc

export type AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptSupabaseRpcParameters =
  Readonly<Record<string, string>>

export type AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptSupabaseRpcPortOutcome =
  | Readonly<{
      status: 'SUCCESS'
      row: Readonly<Record<string, string>>
    }>
  | Readonly<{
      status: 'FAILURE'
      condition:
        AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptStorageCondition
    }>
  | Readonly<{
      status: 'UNKNOWN_WRITE_OUTCOME'
    }>

export type AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptSupabaseRpcInvoker =
  (
    name:
      AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptSupabaseRpcName,
    parameters:
      AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptSupabaseRpcParameters,
  ) => PromiseLike<unknown>

export type AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptSupabaseRpcPort =
  (
    name:
      AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptSupabaseRpcName,
    parameters:
      AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptSupabaseRpcParameters,
  ) => Promise<AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptSupabaseRpcPortOutcome>

function invalid(): never {
  throw new TypeError(
    'ai_chart_d1_durable_authorization_receipt_supabase_rpc_port_invalid',
  )
}

function failure(
  condition:
    AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptStorageCondition,
): AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptSupabaseRpcPortOutcome {
  return freezeAiChartD1Value({
    status: 'FAILURE' as const,
    condition,
  })
}

function requiredParameterFields(
  name:
    AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptSupabaseRpcName,
): readonly string[] {
  if (name === storageContract.atomicCreateRpc) {
    return storageContract.atomicCreateRpcParameters
  }
  if (
    name ===
    storageContract.unknownWriteReconciliationRpc
  ) {
    return storageContract.unknownWriteReconciliationRpcParameters
  }
  if (name === storageContract.runtimeReadRpc) {
    return storageContract.runtimeReadRpcParameters
  }
  return invalid()
}

function parseParameters(
  name:
    AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptSupabaseRpcName,
  value: unknown,
): AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptSupabaseRpcParameters {
  try {
    assertAiChartD1SafeGraph(value)
    const parameters =
      requireAiChartD1ExactObject(
        value,
        requiredParameterFields(name),
      )
    for (const field of Object.keys(parameters)) {
      const entry = parameters[field]
      if (
        typeof entry !== 'string' ||
        entry.length === 0 ||
        entry.length > MAXIMUM_PARAMETER_LENGTH
      ) {
        return invalid()
      }
    }
    return freezeAiChartD1Value({
      ...parameters,
    } as Record<string, string>)
  } catch {
    return invalid()
  }
}

function parseSuccessRow(
  value: unknown,
  name:
    AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptSupabaseRpcName,
): Readonly<Record<string, string>> | null {
  try {
    assertAiChartD1SafeGraph(value)
    const row = requireAiChartD1ExactObject(
      value,
      storageContract.rpcResponseFields,
    )
    for (const field of storageContract.rpcResponseFields) {
      if (typeof row[field] !== 'string') {
        return null
      }
    }
    const allowedResultCodes =
      name === storageContract.atomicCreateRpc
        ? ['CREATED', 'EXISTING_EXACT']
        : name ===
            storageContract.unknownWriteReconciliationRpc
          ? ['RECONCILED_EXACT']
          : ['READ_EXACT']
    if (
      !allowedResultCodes.includes(
        row.result_code as string,
      )
    ) {
      return null
    }
    return freezeAiChartD1Value(
      Object.fromEntries(
        storageContract.rpcResponseFields.map(
          (field) => [
            field,
            row[field] as string,
          ],
        ),
      ),
    )
  } catch {
    return null
  }
}

function mapProviderFailure(
  name:
    AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptSupabaseRpcName,
  value: unknown,
): AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptSupabaseRpcPortOutcome {
  try {
    assertAiChartD1SafeGraph(value)
    const providerError =
      requireAiChartD1ExactObject(
        value,
        SUPABASE_RPC_ERROR_FIELDS,
      )
    const message = providerError.message
    if (
      typeof message !== 'string'
    ) {
      return failure(
        'SCHEMA_OR_RPC_UNAVAILABLE',
      )
    }
    if (
      name === storageContract.atomicCreateRpc &&
      message ===
        'ai_chart_runtime_authorization_receipt_invalid_input'
    ) {
      return failure(
        'ATOMIC_CREATE_EXPLICIT_FAILURE',
      )
    }
    if (
      message ===
      'ai_chart_runtime_authorization_receipt_conflict'
    ) {
      return failure(
        'UNIQUE_KEYS_PARTIAL_DIVERGED_OR_BINDINGS_CONFLICT',
      )
    }
    if (
      name ===
        storageContract.unknownWriteReconciliationRpc &&
      message ===
        'ai_chart_runtime_authorization_receipt_reconciliation_required'
    ) {
      return failure(
        'UNKNOWN_WRITE_NOT_RESOLVED_BY_ONE_BOTH_KEY_READ',
      )
    }
    if (
      name === storageContract.runtimeReadRpc &&
      message ===
        'ai_chart_runtime_authorization_receipt_not_found'
    ) {
      return failure(
        'RUNTIME_EXACT_RECEIPT_ABSENT',
      )
    }
  } catch {
    // The provider response is intentionally reduced to one fixed condition.
  }
  return failure('SCHEMA_OR_RPC_UNAVAILABLE')
}

function parseProviderResponse(
  name:
    AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptSupabaseRpcName,
  value: unknown,
): AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptSupabaseRpcPortOutcome {
  let response: Record<string, unknown>
  try {
    assertAiChartD1SafeGraph(value)
    response = requireAiChartD1ExactObject(
      value,
      SUPABASE_RPC_RESPONSE_FIELDS,
    )
  } catch {
    return failure(
      'SCHEMA_OR_RPC_UNAVAILABLE',
    )
  }

  if (response.error !== null) {
    return mapProviderFailure(
      name,
      response.error,
    )
  }
  if (
    !Array.isArray(response.data) ||
    response.data.length !== 1
  ) {
    return failure(
      'RPC_ROW_SHAPE_OR_FINGERPRINT_INVALID',
    )
  }
  const row = parseSuccessRow(
    response.data[0],
    name,
  )
  if (!row) {
    return failure(
      'RPC_ROW_SHAPE_OR_FINGERPRINT_INVALID',
    )
  }
  return freezeAiChartD1Value({
    status: 'SUCCESS' as const,
    row,
  })
}

export function createAiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptSupabaseRpcPort(
  dependencies: Readonly<{
    rpc:
      AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptSupabaseRpcInvoker
  }>,
): AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptSupabaseRpcPort {
  let rpc:
    AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptSupabaseRpcInvoker
  try {
    assertAiChartD1SafeGraph(dependencies)
    const dependencyRecord =
      requireAiChartD1ExactObject(
        dependencies,
        DEPENDENCY_FIELDS,
      )
    if (
      typeof dependencyRecord.rpc !==
      'function'
    ) {
      return invalid()
    }
    rpc =
      dependencyRecord.rpc as
        AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptSupabaseRpcInvoker
  } catch {
    return invalid()
  }

  return async (
    name,
    parameterValue,
  ) => {
    const parameters = parseParameters(
      name,
      parameterValue,
    )
    let value: unknown
    try {
      value = await rpc(name, parameters)
    } catch {
      if (
        name === storageContract.atomicCreateRpc
      ) {
        return freezeAiChartD1Value({
          status:
            'UNKNOWN_WRITE_OUTCOME' as const,
        })
      }
      return failure(
        'SCHEMA_OR_RPC_UNAVAILABLE',
      )
    }
    return parseProviderResponse(name, value)
  }
}
