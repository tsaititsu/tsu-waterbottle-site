import 'server-only'

import { createHash } from 'node:crypto'
import {
  assertAiChartD1SafeGraph,
  freezeAiChartD1Value,
  requireAiChartD1ExactObject,
} from './d1CommonContracts'
import {
  createAiChartD1PalaceWritingCanonicalJson,
} from './d1PalaceWritingPromptPackageContracts'
import {
  AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_PORT_CONTRACT,
  AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_PORT_COMMAND_TASK,
  AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_PORT_COMMAND_VERSION,
  AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_PORT_CONTRACT_VERSION,
  type AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationPortCommand,
} from './d1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationPortContracts.server'
import {
  AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_CONTRACT_TASK,
  AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_CONTRACT_VERSION,
  AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_REQUIRED_CREATE_FIELDS,
  AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_REQUIRED_READ_FIELDS,
  type AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceipt,
  type AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptCreateCommand,
  type AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptReadCommand,
} from './d1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptContracts.server'
import {
  AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_CONTRACT,
  type AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptStorageCondition,
} from './d1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptStorageContracts.server'
import {
  AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_GITHUB_ENVIRONMENT_SOURCE_CONTRACT,
  AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_GITHUB_ENVIRONMENT_SOURCE_CONTRACT_VERSION,
} from './d1PalaceWritingTrustedDeliveryRuntimeActivationGitHubEnvironmentSourceContracts.server'
import {
  AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_GITHUB_OIDC_ATTESTATION_TRANSPORT_CONTRACT,
  AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_GITHUB_OIDC_ATTESTATION_TRANSPORT_CONTRACT_VERSION,
} from './d1PalaceWritingTrustedDeliveryRuntimeActivationGitHubOidcAttestationTransportContracts.server'
import {
  AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_MIGRATION_SHA256,
  AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_MIGRATION_VERSION,
  AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_PRODUCTION_BINDING_FEATURE,
} from './d1PalaceWritingTrustedDeliveryProductionBindingReadiness.server'
import {
  AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_SCOPE,
} from './d1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationHandoff.server'
import {
  AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_POLICY_VERSION,
} from './d1PalaceWritingTrustedDeliveryRuntimeActivationPolicy.server'

export const AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_RPC_ADAPTER_PROBE_VERSION =
  'ai-chart-d1-palace-writing-trusted-delivery-runtime-activation-durable-authorization-receipt-rpc-adapter-probe/v1' as const
export const AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_RPC_ADAPTER_PROBE_TASK =
  'D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_RPC_ADAPTER_PROBE' as const

export const AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_RPC_ADAPTER_PROBE_FAILURE_CODES =
  Object.freeze([
    'AUTHORIZATION_RECEIPT_REPOSITORY_UNAVAILABLE',
    'AUTHORIZATION_RECEIPT_CREATE_FAILED',
    'AUTHORIZATION_RECEIPT_NOT_FOUND',
    'AUTHORIZATION_RECEIPT_INVALID',
    'AUTHORIZATION_RECEIPT_CONFLICT',
    'AUTHORIZATION_RECEIPT_BINDING_MISMATCH',
    'AUTHORIZATION_RECEIPT_RECONCILIATION_REQUIRED',
  ] as const)

export type AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptRpcAdapterProbeFailureCode =
  (typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_RPC_ADAPTER_PROBE_FAILURE_CODES)[number]

export type AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptRpcName =
  | typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_CONTRACT.atomicCreateRpc
  | typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_CONTRACT.unknownWriteReconciliationRpc
  | typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_CONTRACT.runtimeReadRpc

export type AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptRpcParameters =
  Readonly<Record<string, string>>

export type AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptRpcPortOutcome =
  | Readonly<{
      status: 'SUCCESS'
      row: unknown
    }>
  | Readonly<{
      status: 'FAILURE'
      condition:
        AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptStorageCondition
    }>
  | Readonly<{
      status: 'UNKNOWN_WRITE_OUTCOME'
    }>

export type AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptRpcInvoker =
  (
    name:
      AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptRpcName,
    parameters:
      AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptRpcParameters,
  ) => PromiseLike<unknown>

type RpcAdapterProbeStatus =
  | 'CREATED_STOPPED'
  | 'EXISTING_EXACT_STOPPED'
  | 'RECONCILED_EXACT_STOPPED'
  | 'READ_EXACT_STOPPED'

export type AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptRpcAdapterProbeResult =
  Readonly<{
    probeVersion:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_RPC_ADAPTER_PROBE_VERSION
    task:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_RPC_ADAPTER_PROBE_TASK
    status: RpcAdapterProbeStatus
    receipt:
      AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceipt
    rpcInvocations: 1 | 2
    writeRpcInvocations: 0 | 1
    readRpcInvocations: 0 | 1
    automaticRetryAllowed: false
    runtimeActivationAllowed: false
    customerDeliveryAllowed: false
    productionCallable: false
    databaseConnections: 0
    reportMutations: 0
    openAiRequests: 0
  }>

export type AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptRpcAdapterProbe =
  Readonly<{
    createOrReadExact: (
      command:
        AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptCreateCommand,
    ) => Promise<AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptRpcAdapterProbeResult>
    readExact: (
      command:
        AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptReadCommand,
    ) => Promise<AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptRpcAdapterProbeResult>
  }>

const DEPENDENCY_FIELDS = Object.freeze([
  'invokeRpc',
] as const)
const AUTHORIZATION_COMMAND_FIELDS = Object.freeze([
  'contractVersion',
  'task',
  'authorizationScope',
  'feature',
  'releaseCommitSha',
  'migrationVersion',
  'migrationSha256',
  'migrationReadinessFingerprint',
  'runtimeActivationPolicyVersion',
] as const)
const RPC_SUCCESS_OUTCOME_FIELDS =
  Object.freeze([
    'status',
    'row',
  ] as const)
const RPC_FAILURE_OUTCOME_FIELDS =
  Object.freeze([
    'status',
    'condition',
  ] as const)
const RPC_UNKNOWN_OUTCOME_FIELDS =
  Object.freeze([
    'status',
  ] as const)
const SHA256_PATTERN = /^[a-f0-9]{64}$/u
const COMMIT_SHA_PATTERN = /^[a-f0-9]{40}$/u

export class AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptRpcAdapterProbeError extends Error {
  readonly code:
    AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptRpcAdapterProbeFailureCode

  constructor(
    code:
      AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptRpcAdapterProbeFailureCode,
  ) {
    const safeCode =
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_RPC_ADAPTER_PROBE_FAILURE_CODES.includes(
        code,
      )
        ? code
        : 'AUTHORIZATION_RECEIPT_REPOSITORY_UNAVAILABLE'
    super(safeCode)
    this.name =
      'AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptRpcAdapterProbeError'
    this.code = safeCode
    Object.freeze(this)
  }
}

function fail(
  code:
    AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptRpcAdapterProbeFailureCode,
): never {
  throw new AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptRpcAdapterProbeError(
    code,
  )
}

function requireSha256(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !SHA256_PATTERN.test(value)
  ) {
    fail('AUTHORIZATION_RECEIPT_INVALID')
  }
  return value
}

function requireAuthorizationCommand(
  value: unknown,
): AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationPortCommand {
  let command: Record<string, unknown>
  try {
    assertAiChartD1SafeGraph(value)
    command = requireAiChartD1ExactObject(
      value,
      AUTHORIZATION_COMMAND_FIELDS,
    )
  } catch {
    fail('AUTHORIZATION_RECEIPT_INVALID')
  }

  if (
    typeof command.releaseCommitSha !==
      'string' ||
    !COMMIT_SHA_PATTERN.test(
      command.releaseCommitSha,
    ) ||
    typeof command.migrationReadinessFingerprint !==
      'string' ||
    !SHA256_PATTERN.test(
      command.migrationReadinessFingerprint,
    )
  ) {
    fail('AUTHORIZATION_RECEIPT_INVALID')
  }
  if (
    command.contractVersion !==
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_PORT_COMMAND_VERSION ||
    command.task !==
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_PORT_COMMAND_TASK ||
    command.authorizationScope !==
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_SCOPE ||
    command.feature !==
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_PRODUCTION_BINDING_FEATURE ||
    command.migrationVersion !==
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_MIGRATION_VERSION ||
    command.migrationSha256 !==
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_MIGRATION_SHA256 ||
    command.runtimeActivationPolicyVersion !==
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_POLICY_VERSION
  ) {
    fail('AUTHORIZATION_RECEIPT_BINDING_MISMATCH')
  }

  return freezeAiChartD1Value({
    contractVersion:
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_PORT_COMMAND_VERSION,
    task:
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_PORT_COMMAND_TASK,
    authorizationScope:
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_SCOPE,
    feature:
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_PRODUCTION_BINDING_FEATURE,
    releaseCommitSha:
      command.releaseCommitSha,
    migrationVersion:
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_MIGRATION_VERSION,
    migrationSha256:
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_MIGRATION_SHA256,
    migrationReadinessFingerprint:
      command.migrationReadinessFingerprint,
    runtimeActivationPolicyVersion:
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_POLICY_VERSION,
  })
}

function requireCommandFingerprint(
  command:
    AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationPortCommand,
  value: unknown,
): string {
  const fingerprint = requireSha256(value)
  const expected = createHash('sha256')
    .update(
      createAiChartD1PalaceWritingCanonicalJson(
        command,
      ),
      'utf8',
    )
    .digest('hex')
  if (fingerprint !== expected) {
    fail('AUTHORIZATION_RECEIPT_BINDING_MISMATCH')
  }
  return fingerprint
}

function requireCurrentFingerprint(
  value: unknown,
  expected: string,
): string {
  const fingerprint = requireSha256(value)
  if (fingerprint !== expected) {
    fail('AUTHORIZATION_RECEIPT_BINDING_MISMATCH')
  }
  return fingerprint
}

function parseCreateCommand(
  value: unknown,
): AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptCreateCommand {
  let input: Record<string, unknown>
  try {
    assertAiChartD1SafeGraph(value)
    input = requireAiChartD1ExactObject(
      value,
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_REQUIRED_CREATE_FIELDS,
    )
  } catch {
    fail('AUTHORIZATION_RECEIPT_INVALID')
  }
  if (
    input.sourceContractVersion !==
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_GITHUB_ENVIRONMENT_SOURCE_CONTRACT_VERSION ||
    input.authorizationPortContractVersion !==
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_PORT_CONTRACT_VERSION ||
    input.transportContractVersion !==
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_GITHUB_OIDC_ATTESTATION_TRANSPORT_CONTRACT_VERSION
  ) {
    fail('AUTHORIZATION_RECEIPT_BINDING_MISMATCH')
  }
  const authorizationCommand =
    requireAuthorizationCommand(
      input.authorizationCommand,
    )

  return freezeAiChartD1Value({
    sourceContractVersion:
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_GITHUB_ENVIRONMENT_SOURCE_CONTRACT_VERSION,
    sourceContractFingerprint:
      requireCurrentFingerprint(
        input.sourceContractFingerprint,
        AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_GITHUB_ENVIRONMENT_SOURCE_CONTRACT.contractFingerprint,
      ),
    authorizationPortContractVersion:
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_PORT_CONTRACT_VERSION,
    authorizationPortContractFingerprint:
      requireCurrentFingerprint(
        input.authorizationPortContractFingerprint,
        AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_PORT_CONTRACT.contractFingerprint,
      ),
    transportContractVersion:
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_GITHUB_OIDC_ATTESTATION_TRANSPORT_CONTRACT_VERSION,
    transportContractFingerprint:
      requireCurrentFingerprint(
        input.transportContractFingerprint,
        AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_GITHUB_OIDC_ATTESTATION_TRANSPORT_CONTRACT.contractFingerprint,
      ),
    authorizationCommand,
    authorizationCommandFingerprint:
      requireCommandFingerprint(
        authorizationCommand,
        input.authorizationCommandFingerprint,
      ),
    replayKeyFingerprint: requireSha256(
      input.replayKeyFingerprint,
    ),
  })
}

function parseReadCommand(
  value: unknown,
): AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptReadCommand {
  let input: Record<string, unknown>
  try {
    assertAiChartD1SafeGraph(value)
    input = requireAiChartD1ExactObject(
      value,
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_REQUIRED_READ_FIELDS,
    )
  } catch {
    fail('AUTHORIZATION_RECEIPT_INVALID')
  }
  const authorizationCommand =
    requireAuthorizationCommand(
      input.authorizationCommand,
    )

  return freezeAiChartD1Value({
    authorizationCommand,
    authorizationCommandFingerprint:
      requireCommandFingerprint(
        authorizationCommand,
        input.authorizationCommandFingerprint,
      ),
    sourceContractFingerprint:
      requireCurrentFingerprint(
        input.sourceContractFingerprint,
        AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_GITHUB_ENVIRONMENT_SOURCE_CONTRACT.contractFingerprint,
      ),
    authorizationPortContractFingerprint:
      requireCurrentFingerprint(
        input.authorizationPortContractFingerprint,
        AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_PORT_CONTRACT.contractFingerprint,
      ),
    transportContractFingerprint:
      requireCurrentFingerprint(
        input.transportContractFingerprint,
        AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_GITHUB_OIDC_ATTESTATION_TRANSPORT_CONTRACT.contractFingerprint,
      ),
  })
}

function createReceipt(
  command:
    AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptCreateCommand,
): AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceipt {
  const withoutFingerprint =
    freezeAiChartD1Value({
      contractVersion:
        AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_CONTRACT_VERSION,
      task:
        AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_CONTRACT_TASK,
      authorizationStatus:
        'AUTHORIZED' as const,
      ...command,
    })
  const receiptFingerprint = createHash('sha256')
    .update(
      createAiChartD1PalaceWritingCanonicalJson(
        withoutFingerprint,
      ),
      'utf8',
    )
    .digest('hex')

  return freezeAiChartD1Value({
    ...withoutFingerprint,
    receiptFingerprint,
  })
}

function createAtomicParameters(
  receipt:
    AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceipt,
): AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptRpcParameters {
  return freezeAiChartD1Value({
    p_receipt_contract_version:
      receipt.contractVersion,
    p_receipt_task: receipt.task,
    p_authorization_status:
      receipt.authorizationStatus,
    p_source_contract_version:
      receipt.sourceContractVersion,
    p_source_contract_fingerprint:
      receipt.sourceContractFingerprint,
    p_authorization_port_contract_version:
      receipt.authorizationPortContractVersion,
    p_authorization_port_contract_fingerprint:
      receipt.authorizationPortContractFingerprint,
    p_transport_contract_version:
      receipt.transportContractVersion,
    p_transport_contract_fingerprint:
      receipt.transportContractFingerprint,
    p_authorization_command_contract_version:
      receipt.authorizationCommand
        .contractVersion,
    p_authorization_command_task:
      receipt.authorizationCommand.task,
    p_authorization_scope:
      receipt.authorizationCommand
        .authorizationScope,
    p_feature:
      receipt.authorizationCommand.feature,
    p_release_commit_sha:
      receipt.authorizationCommand
        .releaseCommitSha,
    p_migration_version:
      receipt.authorizationCommand
        .migrationVersion,
    p_migration_sha256:
      receipt.authorizationCommand
        .migrationSha256,
    p_migration_readiness_fingerprint:
      receipt.authorizationCommand
        .migrationReadinessFingerprint,
    p_runtime_activation_policy_version:
      receipt.authorizationCommand
        .runtimeActivationPolicyVersion,
    p_authorization_command_fingerprint:
      receipt.authorizationCommandFingerprint,
    p_replay_key_fingerprint:
      receipt.replayKeyFingerprint,
    p_receipt_fingerprint:
      receipt.receiptFingerprint,
  })
}

function createReconciliationParameters(
  receipt:
    AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceipt,
): AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptRpcParameters {
  return freezeAiChartD1Value({
    p_authorization_command_fingerprint:
      receipt.authorizationCommandFingerprint,
    p_replay_key_fingerprint:
      receipt.replayKeyFingerprint,
  })
}

function createRuntimeReadParameters(
  command:
    AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptReadCommand,
): AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptRpcParameters {
  return freezeAiChartD1Value({
    p_authorization_command_fingerprint:
      command.authorizationCommandFingerprint,
  })
}

function parseRpcPortOutcome(
  value: unknown,
): AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptRpcPortOutcome {
  try {
    assertAiChartD1SafeGraph(value)
    if (
      value === null ||
      typeof value !== 'object' ||
      Array.isArray(value)
    ) {
      fail(
        'AUTHORIZATION_RECEIPT_REPOSITORY_UNAVAILABLE',
      )
    }
    const status = Reflect.get(
      value,
      'status',
    )
    if (status === 'SUCCESS') {
      const outcome =
        requireAiChartD1ExactObject(
          value,
          RPC_SUCCESS_OUTCOME_FIELDS,
        )
      return freezeAiChartD1Value({
        status: 'SUCCESS' as const,
        row: outcome.row,
      })
    }
    if (status === 'FAILURE') {
      const outcome =
        requireAiChartD1ExactObject(
          value,
          RPC_FAILURE_OUTCOME_FIELDS,
        )
      if (
        typeof outcome.condition !==
          'string' ||
        !AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_CONTRACT.failureMappings.some(
          (mapping) =>
            mapping.storageCondition ===
            outcome.condition,
        )
      ) {
        fail(
          'AUTHORIZATION_RECEIPT_REPOSITORY_UNAVAILABLE',
        )
      }
      return freezeAiChartD1Value({
        status: 'FAILURE' as const,
        condition:
          outcome.condition as
            AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptStorageCondition,
      })
    }
    if (
      status === 'UNKNOWN_WRITE_OUTCOME'
    ) {
      requireAiChartD1ExactObject(
        value,
        RPC_UNKNOWN_OUTCOME_FIELDS,
      )
      return freezeAiChartD1Value({
        status:
          'UNKNOWN_WRITE_OUTCOME' as const,
      })
    }
    fail(
      'AUTHORIZATION_RECEIPT_REPOSITORY_UNAVAILABLE',
    )
  } catch (error) {
    if (
      error instanceof
      AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptRpcAdapterProbeError
    ) {
      throw error
    }
    fail(
      'AUTHORIZATION_RECEIPT_REPOSITORY_UNAVAILABLE',
    )
  }
}

function mapStorageFailure(
  condition:
    AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptStorageCondition,
): never {
  const mapping =
    AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_CONTRACT.failureMappings.find(
      (item) =>
        item.storageCondition === condition,
    )
  if (!mapping) {
    fail(
      'AUTHORIZATION_RECEIPT_REPOSITORY_UNAVAILABLE',
    )
  }
  fail(mapping.repositoryFailureCode)
}

function parseRpcRow(
  value: unknown,
  allowedResultCodes:
    readonly (
      | 'CREATED'
      | 'EXISTING_EXACT'
      | 'RECONCILED_EXACT'
      | 'READ_EXACT'
    )[],
): Readonly<{
  resultCode:
    | 'CREATED'
    | 'EXISTING_EXACT'
    | 'RECONCILED_EXACT'
    | 'READ_EXACT'
  receipt:
    AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceipt
}> {
  let row: Record<string, unknown>
  try {
    assertAiChartD1SafeGraph(value)
    row = requireAiChartD1ExactObject(
      value,
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_CONTRACT.rpcResponseFields,
    )
  } catch {
    fail('AUTHORIZATION_RECEIPT_INVALID')
  }
  if (
    typeof row.result_code !== 'string' ||
    !allowedResultCodes.includes(
      row.result_code as
        | 'CREATED'
        | 'EXISTING_EXACT'
        | 'RECONCILED_EXACT'
        | 'READ_EXACT',
    )
  ) {
    fail('AUTHORIZATION_RECEIPT_INVALID')
  }
  for (const column of
    AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_CONTRACT.requiredColumns) {
    if (typeof row[column] !== 'string') {
      fail('AUTHORIZATION_RECEIPT_INVALID')
    }
  }

  const authorizationCommand =
    requireAuthorizationCommand({
      contractVersion:
        row.authorization_command_contract_version,
      task: row.authorization_command_task,
      authorizationScope:
        row.authorization_scope,
      feature: row.feature,
      releaseCommitSha:
        row.release_commit_sha,
      migrationVersion:
        row.migration_version,
      migrationSha256:
        row.migration_sha256,
      migrationReadinessFingerprint:
        row.migration_readiness_fingerprint,
      runtimeActivationPolicyVersion:
        row.runtime_activation_policy_version,
    })
  const authorizationCommandFingerprint =
    requireCommandFingerprint(
      authorizationCommand,
      row.authorization_command_fingerprint,
    )
  const receipt =
    freezeAiChartD1Value({
      contractVersion:
        row.receipt_contract_version,
      task: row.receipt_task,
      authorizationStatus:
        row.authorization_status,
      sourceContractVersion:
        row.source_contract_version,
      sourceContractFingerprint:
        row.source_contract_fingerprint,
      authorizationPortContractVersion:
        row.authorization_port_contract_version,
      authorizationPortContractFingerprint:
        row.authorization_port_contract_fingerprint,
      transportContractVersion:
        row.transport_contract_version,
      transportContractFingerprint:
        row.transport_contract_fingerprint,
      authorizationCommand,
      authorizationCommandFingerprint,
      replayKeyFingerprint:
        row.replay_key_fingerprint,
      receiptFingerprint:
        row.receipt_fingerprint,
    })

  if (
    receipt.contractVersion !==
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_CONTRACT_VERSION ||
    receipt.task !==
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_CONTRACT_TASK ||
    receipt.authorizationStatus !==
      'AUTHORIZED' ||
    receipt.sourceContractVersion !==
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_GITHUB_ENVIRONMENT_SOURCE_CONTRACT_VERSION ||
    receipt.authorizationPortContractVersion !==
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_PORT_CONTRACT_VERSION ||
    receipt.transportContractVersion !==
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_GITHUB_OIDC_ATTESTATION_TRANSPORT_CONTRACT_VERSION
  ) {
    fail('AUTHORIZATION_RECEIPT_BINDING_MISMATCH')
  }
  requireCurrentFingerprint(
    receipt.sourceContractFingerprint,
    AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_GITHUB_ENVIRONMENT_SOURCE_CONTRACT.contractFingerprint,
  )
  requireCurrentFingerprint(
    receipt.authorizationPortContractFingerprint,
    AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_PORT_CONTRACT.contractFingerprint,
  )
  requireCurrentFingerprint(
    receipt.transportContractFingerprint,
    AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_GITHUB_OIDC_ATTESTATION_TRANSPORT_CONTRACT.contractFingerprint,
  )
  requireSha256(receipt.replayKeyFingerprint)
  const receiptFingerprint = requireSha256(
    receipt.receiptFingerprint,
  )
  const withoutFingerprint =
    freezeAiChartD1Value({
      contractVersion:
        receipt.contractVersion,
      task: receipt.task,
      authorizationStatus:
        receipt.authorizationStatus,
      sourceContractVersion:
        receipt.sourceContractVersion,
      sourceContractFingerprint:
        receipt.sourceContractFingerprint,
      authorizationPortContractVersion:
        receipt.authorizationPortContractVersion,
      authorizationPortContractFingerprint:
        receipt.authorizationPortContractFingerprint,
      transportContractVersion:
        receipt.transportContractVersion,
      transportContractFingerprint:
        receipt.transportContractFingerprint,
      authorizationCommand:
        receipt.authorizationCommand,
      authorizationCommandFingerprint:
        receipt.authorizationCommandFingerprint,
      replayKeyFingerprint:
        receipt.replayKeyFingerprint,
    })
  const expectedReceiptFingerprint =
    createHash('sha256')
      .update(
        createAiChartD1PalaceWritingCanonicalJson(
          withoutFingerprint,
        ),
        'utf8',
      )
      .digest('hex')
  if (
    receiptFingerprint !==
      expectedReceiptFingerprint
  ) {
    fail('AUTHORIZATION_RECEIPT_INVALID')
  }

  return freezeAiChartD1Value({
    resultCode:
      row.result_code as
        | 'CREATED'
        | 'EXISTING_EXACT'
        | 'RECONCILED_EXACT'
        | 'READ_EXACT',
    receipt:
      receipt as
        AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceipt,
  })
}

function requireExactReceipt(
  actual:
    AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceipt,
  expected:
    AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceipt,
): void {
  if (
    createAiChartD1PalaceWritingCanonicalJson(
      actual,
    ) !==
      createAiChartD1PalaceWritingCanonicalJson(
        expected,
      )
  ) {
    fail(
      'AUTHORIZATION_RECEIPT_BINDING_MISMATCH',
    )
  }
}

function requireReceiptMatchesRead(
  receipt:
    AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceipt,
  command:
    AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptReadCommand,
): void {
  if (
    receipt.authorizationCommandFingerprint !==
      command.authorizationCommandFingerprint ||
    receipt.sourceContractFingerprint !==
      command.sourceContractFingerprint ||
    receipt.authorizationPortContractFingerprint !==
      command.authorizationPortContractFingerprint ||
    receipt.transportContractFingerprint !==
      command.transportContractFingerprint ||
    createAiChartD1PalaceWritingCanonicalJson(
      receipt.authorizationCommand,
    ) !==
      createAiChartD1PalaceWritingCanonicalJson(
        command.authorizationCommand,
      )
  ) {
    fail(
      'AUTHORIZATION_RECEIPT_BINDING_MISMATCH',
    )
  }
}

function createResult(
  status: RpcAdapterProbeStatus,
  receipt:
    AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceipt,
  counts: Readonly<{
    rpcInvocations: 1 | 2
    writeRpcInvocations: 0 | 1
    readRpcInvocations: 0 | 1
  }>,
): AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptRpcAdapterProbeResult {
  return freezeAiChartD1Value({
    probeVersion:
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_RPC_ADAPTER_PROBE_VERSION,
    task:
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_RPC_ADAPTER_PROBE_TASK,
    status,
    receipt,
    ...counts,
    automaticRetryAllowed: false as const,
    runtimeActivationAllowed: false as const,
    customerDeliveryAllowed: false as const,
    productionCallable: false as const,
    databaseConnections: 0 as const,
    reportMutations: 0 as const,
    openAiRequests: 0 as const,
  })
}

export function createAiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptRpcAdapterProbe(
  dependencies: Readonly<{
    invokeRpc:
      AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptRpcInvoker
  }>,
): AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptRpcAdapterProbe {
  let dependencyRecord: Record<
    string,
    unknown
  >
  try {
    assertAiChartD1SafeGraph(dependencies)
    dependencyRecord =
      requireAiChartD1ExactObject(
        dependencies,
        DEPENDENCY_FIELDS,
      )
  } catch {
    fail(
      'AUTHORIZATION_RECEIPT_REPOSITORY_UNAVAILABLE',
    )
  }
  if (
    process.env.NODE_ENV !== 'test' ||
    typeof dependencyRecord.invokeRpc !==
      'function'
  ) {
    fail(
      'AUTHORIZATION_RECEIPT_REPOSITORY_UNAVAILABLE',
    )
  }
  const invokeRpc =
    dependencyRecord.invokeRpc as
      AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptRpcInvoker

  async function invoke(
    name:
      AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptRpcName,
    parameters:
      AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptRpcParameters,
  ): Promise<AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptRpcPortOutcome> {
    let value: unknown
    try {
      value = await invokeRpc(
        name,
        parameters,
      )
    } catch {
      fail(
        'AUTHORIZATION_RECEIPT_REPOSITORY_UNAVAILABLE',
      )
    }
    return parseRpcPortOutcome(value)
  }

  return Object.freeze({
    async createOrReadExact(
      value:
        AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptCreateCommand,
    ) {
      const command = parseCreateCommand(value)
      const expectedReceipt =
        createReceipt(command)
      const createOutcome = await invoke(
        AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_CONTRACT.atomicCreateRpc,
        createAtomicParameters(
          expectedReceipt,
        ),
      )
      if (
        createOutcome.status === 'FAILURE'
      ) {
        mapStorageFailure(
          createOutcome.condition,
        )
      }
      if (
        createOutcome.status ===
        'UNKNOWN_WRITE_OUTCOME'
      ) {
        const reconciliationOutcome =
          await invoke(
            AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_CONTRACT.unknownWriteReconciliationRpc,
            createReconciliationParameters(
              expectedReceipt,
            ),
          )
        if (
          reconciliationOutcome.status ===
          'UNKNOWN_WRITE_OUTCOME'
        ) {
          fail(
            'AUTHORIZATION_RECEIPT_RECONCILIATION_REQUIRED',
          )
        }
        if (
          reconciliationOutcome.status ===
          'FAILURE'
        ) {
          mapStorageFailure(
            reconciliationOutcome.condition,
          )
        }
        const parsed = parseRpcRow(
          reconciliationOutcome.row,
          ['RECONCILED_EXACT'],
        )
        requireExactReceipt(
          parsed.receipt,
          expectedReceipt,
        )
        return createResult(
          'RECONCILED_EXACT_STOPPED',
          parsed.receipt,
          {
            rpcInvocations: 2,
            writeRpcInvocations: 1,
            readRpcInvocations: 1,
          },
        )
      }
      const parsed = parseRpcRow(
        createOutcome.row,
        ['CREATED', 'EXISTING_EXACT'],
      )
      requireExactReceipt(
        parsed.receipt,
        expectedReceipt,
      )
      return createResult(
        parsed.resultCode === 'CREATED'
          ? 'CREATED_STOPPED'
          : 'EXISTING_EXACT_STOPPED',
        parsed.receipt,
        {
          rpcInvocations: 1,
          writeRpcInvocations: 1,
          readRpcInvocations: 0,
        },
      )
    },
    async readExact(
      value:
        AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptReadCommand,
    ) {
      const command = parseReadCommand(value)
      const outcome = await invoke(
        AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_CONTRACT.runtimeReadRpc,
        createRuntimeReadParameters(
          command,
        ),
      )
      if (
        outcome.status ===
        'UNKNOWN_WRITE_OUTCOME'
      ) {
        fail(
          'AUTHORIZATION_RECEIPT_REPOSITORY_UNAVAILABLE',
        )
      }
      if (outcome.status === 'FAILURE') {
        mapStorageFailure(outcome.condition)
      }
      const parsed = parseRpcRow(
        outcome.row,
        ['READ_EXACT'],
      )
      requireReceiptMatchesRead(
        parsed.receipt,
        command,
      )
      return createResult(
        'READ_EXACT_STOPPED',
        parsed.receipt,
        {
          rpcInvocations: 1,
          writeRpcInvocations: 0,
          readRpcInvocations: 1,
        },
      )
    },
  })
}
