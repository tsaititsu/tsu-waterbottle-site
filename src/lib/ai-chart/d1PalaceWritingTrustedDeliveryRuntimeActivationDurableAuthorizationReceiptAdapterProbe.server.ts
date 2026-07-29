import 'server-only'

import { createHash } from 'node:crypto'
import {
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

export const AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_ADAPTER_PROBE_VERSION =
  'ai-chart-d1-palace-writing-trusted-delivery-runtime-activation-durable-authorization-receipt-adapter-probe/v1' as const
export const AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_ADAPTER_PROBE_TASK =
  'D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_ADAPTER_PROBE' as const

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

const SHA256_PATTERN = /^[a-f0-9]{64}$/u
const COMMIT_SHA_PATTERN = /^[a-f0-9]{40}$/u

export type AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptAdapterProbeFailureCode =
  | 'AUTHORIZATION_RECEIPT_REPOSITORY_UNAVAILABLE'
  | 'AUTHORIZATION_RECEIPT_CREATE_FAILED'
  | 'AUTHORIZATION_RECEIPT_NOT_FOUND'
  | 'AUTHORIZATION_RECEIPT_INVALID'
  | 'AUTHORIZATION_RECEIPT_CONFLICT'
  | 'AUTHORIZATION_RECEIPT_BINDING_MISMATCH'
  | 'AUTHORIZATION_RECEIPT_RECONCILIATION_REQUIRED'

type AdapterProbeStatus =
  | 'CREATED_STOPPED'
  | 'EXISTING_EXACT_STOPPED'
  | 'READ_EXACT_STOPPED'

export type AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptAdapterProbeResult =
  Readonly<{
    probeVersion:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_ADAPTER_PROBE_VERSION
    task:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_ADAPTER_PROBE_TASK
    status: AdapterProbeStatus
    receipt:
      AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceipt
    runtimeActivationAllowed: false
    customerDeliveryAllowed: false
    productionCallable: false
    databaseConnections: 0
    reportMutations: 0
    openAiRequests: 0
  }>

export type AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptAdapterProbe =
  Readonly<{
    createOrReadExact: (
      command:
        AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptCreateCommand,
    ) => Promise<AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptAdapterProbeResult>
    readExact: (
      command:
        AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptReadCommand,
    ) => Promise<AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptAdapterProbeResult>
  }>

export type AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptAdapterProbeOptions =
  Readonly<{
    simulateUnknownWriteAfterCommitOnce?: boolean
  }>

export class AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptAdapterProbeError extends Error {
  readonly code:
    AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptAdapterProbeFailureCode

  constructor(
    code:
      AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptAdapterProbeFailureCode,
  ) {
    super(code)
    this.name =
      'AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptAdapterProbeError'
    this.code = code
    Object.freeze(this)
  }
}

function fail(
  code:
    AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptAdapterProbeFailureCode,
): never {
  throw new AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptAdapterProbeError(
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
    command = requireAiChartD1ExactObject(
      value,
      AUTHORIZATION_COMMAND_FIELDS,
    )
  } catch {
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
    typeof command.releaseCommitSha !==
      'string' ||
    !COMMIT_SHA_PATTERN.test(
      command.releaseCommitSha,
    ) ||
    command.migrationVersion !==
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_MIGRATION_VERSION ||
    command.migrationSha256 !==
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_MIGRATION_SHA256 ||
    typeof command.migrationReadinessFingerprint !==
      'string' ||
    !SHA256_PATTERN.test(
      command.migrationReadinessFingerprint,
    ) ||
    command.runtimeActivationPolicyVersion !==
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_POLICY_VERSION
  ) {
    fail('AUTHORIZATION_RECEIPT_BINDING_MISMATCH')
  }

  return command as AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationPortCommand
}

function requireCommandFingerprint(
  authorizationCommand:
    AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationPortCommand,
  value: unknown,
): string {
  const fingerprint = requireSha256(value)
  const expected = createHash('sha256')
    .update(
      createAiChartD1PalaceWritingCanonicalJson(
        authorizationCommand,
      ),
      'utf8',
    )
    .digest('hex')
  if (fingerprint !== expected) {
    fail('AUTHORIZATION_RECEIPT_BINDING_MISMATCH')
  }
  return fingerprint
}

function requireCurrentContractFingerprint(
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
      requireCurrentContractFingerprint(
        input.sourceContractFingerprint,
        AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_GITHUB_ENVIRONMENT_SOURCE_CONTRACT.contractFingerprint,
      ),
    authorizationPortContractVersion:
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_PORT_CONTRACT_VERSION,
    authorizationPortContractFingerprint:
      requireCurrentContractFingerprint(
        input.authorizationPortContractFingerprint,
        AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_PORT_CONTRACT.contractFingerprint,
      ),
    transportContractVersion:
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_GITHUB_OIDC_ATTESTATION_TRANSPORT_CONTRACT_VERSION,
    transportContractFingerprint:
      requireCurrentContractFingerprint(
        input.transportContractFingerprint,
        AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_GITHUB_OIDC_ATTESTATION_TRANSPORT_CONTRACT.contractFingerprint,
      ),
    authorizationCommand:
      freezeAiChartD1Value({
        ...authorizationCommand,
      }),
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
    authorizationCommand:
      freezeAiChartD1Value({
        ...authorizationCommand,
      }),
    authorizationCommandFingerprint:
      requireCommandFingerprint(
        authorizationCommand,
        input.authorizationCommandFingerprint,
      ),
    sourceContractFingerprint:
      requireCurrentContractFingerprint(
        input.sourceContractFingerprint,
        AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_GITHUB_ENVIRONMENT_SOURCE_CONTRACT.contractFingerprint,
      ),
    authorizationPortContractFingerprint:
      requireCurrentContractFingerprint(
        input.authorizationPortContractFingerprint,
        AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_PORT_CONTRACT.contractFingerprint,
      ),
    transportContractFingerprint:
      requireCurrentContractFingerprint(
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

function receiptMatchesCreateCommand(
  receipt:
    AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceipt,
  command:
    AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptCreateCommand,
): boolean {
  const expected = createReceipt(command)
  return (
    expected.receiptFingerprint ===
      receipt.receiptFingerprint &&
    createAiChartD1PalaceWritingCanonicalJson(
      expected,
    ) ===
      createAiChartD1PalaceWritingCanonicalJson(
        receipt,
      )
  )
}

function receiptMatchesReadCommand(
  receipt:
    AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceipt,
  command:
    AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptReadCommand,
): boolean {
  return (
    receipt.authorizationStatus ===
      'AUTHORIZED' &&
    receipt.authorizationCommandFingerprint ===
      command.authorizationCommandFingerprint &&
    receipt.sourceContractFingerprint ===
      command.sourceContractFingerprint &&
    receipt.authorizationPortContractFingerprint ===
      command.authorizationPortContractFingerprint &&
    receipt.transportContractFingerprint ===
      command.transportContractFingerprint &&
    createAiChartD1PalaceWritingCanonicalJson(
      receipt.authorizationCommand,
    ) ===
      createAiChartD1PalaceWritingCanonicalJson(
        command.authorizationCommand,
      ) &&
    receiptMatchesCreateCommand(receipt, {
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
  )
}

function createResult(
  status: AdapterProbeStatus,
  receipt:
    AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceipt,
): AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptAdapterProbeResult {
  return freezeAiChartD1Value({
    probeVersion:
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_ADAPTER_PROBE_VERSION,
    task:
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_ADAPTER_PROBE_TASK,
    status,
    receipt,
    runtimeActivationAllowed: false as const,
    customerDeliveryAllowed: false as const,
    productionCallable: false as const,
    databaseConnections: 0 as const,
    reportMutations: 0 as const,
    openAiRequests: 0 as const,
  })
}

export function createAiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptAdapterProbe():
  AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptAdapterProbe
export function createAiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptAdapterProbe(
  options:
    AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptAdapterProbeOptions,
): AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptAdapterProbe
export function createAiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptAdapterProbe(
  options:
    AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptAdapterProbeOptions = {},
): AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptAdapterProbe {
  if (process.env.NODE_ENV !== 'test') {
    fail('AUTHORIZATION_RECEIPT_REPOSITORY_UNAVAILABLE')
  }
  if (
    Reflect.ownKeys(options).some(
      (key) =>
        key !==
        'simulateUnknownWriteAfterCommitOnce',
    ) ||
    (options.simulateUnknownWriteAfterCommitOnce !==
      undefined &&
      typeof options.simulateUnknownWriteAfterCommitOnce !==
        'boolean')
  ) {
    fail('AUTHORIZATION_RECEIPT_INVALID')
  }

  const byReplayKey = new Map<
    string,
    AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceipt
  >()
  const byCommandFingerprint = new Map<
    string,
    AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceipt
  >()
  let unknownWriteSimulationAvailable =
    options.simulateUnknownWriteAfterCommitOnce ===
    true

  return freezeAiChartD1Value({
    async createOrReadExact(
      value:
        AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptCreateCommand,
    ) {
      const command = parseCreateCommand(value)
      await Promise.resolve()
      const byReplay = byReplayKey.get(
        command.replayKeyFingerprint,
      )
      const byCommand =
        byCommandFingerprint.get(
          command.authorizationCommandFingerprint,
        )

      if (!byReplay && !byCommand) {
        const receipt = createReceipt(command)
        byReplayKey.set(
          command.replayKeyFingerprint,
          receipt,
        )
        byCommandFingerprint.set(
          command.authorizationCommandFingerprint,
          receipt,
        )
        if (unknownWriteSimulationAvailable) {
          unknownWriteSimulationAvailable = false
          fail(
            'AUTHORIZATION_RECEIPT_RECONCILIATION_REQUIRED',
          )
        }
        return createResult(
          'CREATED_STOPPED',
          receipt,
        )
      }
      if (
        byReplay &&
        byCommand &&
        byReplay === byCommand &&
        receiptMatchesCreateCommand(
          byReplay,
          command,
        )
      ) {
        return createResult(
          'EXISTING_EXACT_STOPPED',
          byReplay,
        )
      }
      fail('AUTHORIZATION_RECEIPT_CONFLICT')
    },
    async readExact(
      value:
        AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptReadCommand,
    ) {
      const command = parseReadCommand(value)
      const receipt =
        byCommandFingerprint.get(
          command.authorizationCommandFingerprint,
        )
      if (!receipt) {
        fail('AUTHORIZATION_RECEIPT_NOT_FOUND')
      }
      if (
        !receiptMatchesReadCommand(
          receipt,
          command,
        )
      ) {
        fail(
          'AUTHORIZATION_RECEIPT_BINDING_MISMATCH',
        )
      }
      return createResult(
        'READ_EXACT_STOPPED',
        receipt,
      )
    },
  })
}
