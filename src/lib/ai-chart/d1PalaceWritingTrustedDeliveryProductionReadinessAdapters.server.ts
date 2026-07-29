import 'server-only'

import { createHash } from 'node:crypto'
import {
  assertAiChartD1SafeGraph,
  freezeAiChartD1Value,
  requireAiChartD1ExactObject,
} from './d1CommonContracts'
import {
  AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_MIGRATION_PATH,
  AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_MIGRATION_SHA256,
  AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_MIGRATION_VERSION,
  AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_PRODUCTION_BINDING_FEATURE,
  type AiChartD1PalaceWritingTrustedDeliveryMigrationReadinessCommand,
  type AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationCommand,
} from './d1PalaceWritingTrustedDeliveryProductionBindingReadiness.server'
import {
  createAiChartD1PalaceWritingCanonicalJson,
} from './d1PalaceWritingPromptPackageContracts'
import {
  AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_SUPABASE_RPC_NAME,
} from './d1PalaceWritingTrustedDeliverySupabaseRepository.server'
import {
  consumeAiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationHandoff,
  type AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationHandoff,
} from './d1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationHandoff.server'
import {
  AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_POLICY,
  AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_POLICY_VERSION,
} from './d1PalaceWritingTrustedDeliveryRuntimeActivationPolicy.server'

export {
  AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_POLICY,
  AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_POLICY_VERSION,
} from './d1PalaceWritingTrustedDeliveryRuntimeActivationPolicy.server'

export const AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_PRODUCTION_READINESS_ADAPTERS_VERSION =
  'ai-chart-d1-palace-writing-trusted-delivery-production-readiness-adapters/v2' as const
export const AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_PRODUCTION_READINESS_ADAPTERS_TASK =
  'D1_PALACE_WRITING_TRUSTED_DELIVERY_PRODUCTION_READINESS_ADAPTERS' as const
export const AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_DEPLOYMENT_ATTESTATION_SOURCE =
  'APPROVED_PSQL_EXACT_FILE_RUNNER' as const
export const AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_DEPLOYMENT_ATTESTATION_REQUIRED_CHECKS =
  Object.freeze([
    'SOURCE_VALIDATION',
    'PREFLIGHT',
    'MIGRATION',
    'POSTFLIGHT',
  ] as const)

export const AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_PRODUCTION_READINESS_ADAPTER_FAILURE_CODES =
  Object.freeze([
    'PRODUCTION_READINESS_ADAPTERS_UNAVAILABLE',
    'MIGRATION_READINESS_COMMAND_INVALID',
    'DEPLOYMENT_ATTESTATION_ALREADY_CONSUMED',
    'DEPLOYMENT_ATTESTATION_CHECK_FAILED',
    'DEPLOYMENT_ATTESTATION_RESPONSE_INVALID',
    'DEPLOYMENT_ATTESTATION_NOT_VERIFIED',
    'RUNTIME_ACTIVATION_ALREADY_CONSUMED',
    'RUNTIME_ACTIVATION_SEQUENCE_INVALID',
    'RUNTIME_ACTIVATION_COMMAND_INVALID',
    'RUNTIME_ACTIVATION_AUTHORIZATION_HANDOFF_INVALID',
    'RUNTIME_ACTIVATION_AUTHORIZATION_BINDING_INVALID',
  ] as const)

export type AiChartD1PalaceWritingTrustedDeliveryProductionReadinessAdapterFailureCode =
  (typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_PRODUCTION_READINESS_ADAPTER_FAILURE_CODES)[number]

const MIGRATION_READINESS_BINDING_MODE =
  'INJECTED_PRODUCTION_BINDING_READINESS_PROBE_ONLY' as const
const RUNTIME_ACTIVATION_BINDING_MODE =
  'INJECTED_RUNTIME_ACTIVATION_GATE_PROBE_ONLY' as const
const DEPLOYMENT_ATTESTATION_BINDING_MODE =
  'INJECTED_CONTROLLED_DEPLOYMENT_ATTESTATION_PROBE_ONLY' as const
const SHA1_PATTERN = /^[a-f0-9]{40}$/u
const SHA256_PATTERN = /^[a-f0-9]{64}$/u
const DEPENDENCY_FIELDS = Object.freeze([
  'verifyControlledDeploymentMigrationAttestation',
  'runtimeActivationAuthorizationHandoff',
] as const)
const MIGRATION_READINESS_COMMAND_FIELDS =
  Object.freeze([
    'bindingMode',
    'migrationVersion',
    'migrationPath',
    'migrationSha256',
    'requiredRpcName',
  ] as const)
const RUNTIME_ACTIVATION_COMMAND_FIELDS =
  Object.freeze([
    'bindingMode',
    'feature',
    'migrationVersion',
    'migrationSha256',
    'migrationReadinessFingerprint',
  ] as const)
const DEPLOYMENT_ATTESTATION_RESPONSE_FIELDS =
  Object.freeze([
    'bindingMode',
    'attestationStatus',
    'attestationSource',
    'sourceCommitSha',
    'migrationVersion',
    'migrationPath',
    'migrationSha256',
    'requiredRpcName',
    'sourceValidationStatus',
    'preflightStatus',
    'migrationApplyStatus',
    'postflightStatus',
    'schemaContractStatus',
    'rpcExecuteGrantStatus',
  ] as const)

export type AiChartD1PalaceWritingTrustedDeliveryControlledDeploymentAttestationCommand =
  Readonly<{
    bindingMode:
      typeof DEPLOYMENT_ATTESTATION_BINDING_MODE
    attestationSource:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_DEPLOYMENT_ATTESTATION_SOURCE
    migrationVersion:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_MIGRATION_VERSION
    migrationPath:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_MIGRATION_PATH
    migrationSha256:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_MIGRATION_SHA256
    requiredRpcName:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_SUPABASE_RPC_NAME
    requiredChecks:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_DEPLOYMENT_ATTESTATION_REQUIRED_CHECKS
  }>

export type AiChartD1PalaceWritingTrustedDeliveryProductionReadinessAdapters =
  Readonly<{
    contractVersion:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_PRODUCTION_READINESS_ADAPTERS_VERSION
    task:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_PRODUCTION_READINESS_ADAPTERS_TASK
    dataClassification:
      'DEPLOYMENT_ATTESTATION_RELEASE_AUTHORIZATION_AND_RUNTIME_POLICY_METADATA'
    bindingStatus:
      'OFFLINE_ATTESTATION_AND_RELEASE_AUTHORIZATION_BOUND_RUNTIME_BLOCKED'
    deploymentAttestationSource:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_DEPLOYMENT_ATTESTATION_SOURCE
    runtimeActivationPolicyVersion:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_POLICY_VERSION
    runtimeActivationPolicyStatus:
      'BLOCKED_PENDING_EXPLICIT_PRODUCTION_AUTHORIZATION'
    verifyMigrationReadiness: (
      command:
        AiChartD1PalaceWritingTrustedDeliveryMigrationReadinessCommand,
    ) => Promise<unknown>
    verifyRuntimeActivation: (
      command:
        AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationCommand,
    ) => Promise<unknown>
    automaticRetryAllowed: false
    customerDeliveryAllowed: false
    productionCallable: false
    databaseConnections: 0
    reportMutations: 0
    openAiRequests: 0
    nextRequiredAction:
      'IMPLEMENT_APPROVED_PRODUCTION_RUNTIME_ACTIVATION_ADAPTER_BEFORE_ADMIN_BINDING'
  }>

export class AiChartD1PalaceWritingTrustedDeliveryProductionReadinessAdapterError
  extends Error {
  readonly code:
    AiChartD1PalaceWritingTrustedDeliveryProductionReadinessAdapterFailureCode

  constructor(
    code:
      AiChartD1PalaceWritingTrustedDeliveryProductionReadinessAdapterFailureCode,
  ) {
    const safeCode =
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_PRODUCTION_READINESS_ADAPTER_FAILURE_CODES.includes(
        code,
      )
        ? code
        : 'PRODUCTION_READINESS_ADAPTERS_UNAVAILABLE'
    super(safeCode)
    this.name =
      'AiChartD1PalaceWritingTrustedDeliveryProductionReadinessAdapterError'
    this.code = safeCode
    Object.freeze(this)
  }
}

function fail(
  code:
    AiChartD1PalaceWritingTrustedDeliveryProductionReadinessAdapterFailureCode,
): never {
  throw new AiChartD1PalaceWritingTrustedDeliveryProductionReadinessAdapterError(
    code,
  )
}

function createCanonicalSha256(
  value: unknown,
): string {
  return createHash('sha256')
    .update(
      createAiChartD1PalaceWritingCanonicalJson(value),
      'utf8',
    )
    .digest('hex')
}

function parseMigrationReadinessCommand(
  value: unknown,
): AiChartD1PalaceWritingTrustedDeliveryMigrationReadinessCommand {
  try {
    assertAiChartD1SafeGraph(value)
    const command = requireAiChartD1ExactObject(
      value,
      MIGRATION_READINESS_COMMAND_FIELDS,
    )
    if (
      command.bindingMode !==
        MIGRATION_READINESS_BINDING_MODE ||
      command.migrationVersion !==
        AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_MIGRATION_VERSION ||
      command.migrationPath !==
        AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_MIGRATION_PATH ||
      command.migrationSha256 !==
        AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_MIGRATION_SHA256 ||
      command.requiredRpcName !==
        AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_SUPABASE_RPC_NAME
    ) {
      fail('MIGRATION_READINESS_COMMAND_INVALID')
    }
    return command as
      AiChartD1PalaceWritingTrustedDeliveryMigrationReadinessCommand
  } catch (error) {
    if (
      error instanceof
      AiChartD1PalaceWritingTrustedDeliveryProductionReadinessAdapterError
    ) {
      throw error
    }
    fail('MIGRATION_READINESS_COMMAND_INVALID')
  }
}

function parseRuntimeActivationCommand(
  value: unknown,
  migrationReadinessFingerprint: string | null,
): AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationCommand {
  if (migrationReadinessFingerprint === null) {
    fail('RUNTIME_ACTIVATION_SEQUENCE_INVALID')
  }
  try {
    assertAiChartD1SafeGraph(value)
    const command = requireAiChartD1ExactObject(
      value,
      RUNTIME_ACTIVATION_COMMAND_FIELDS,
    )
    if (
      command.bindingMode !==
        RUNTIME_ACTIVATION_BINDING_MODE ||
      command.feature !==
        AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_PRODUCTION_BINDING_FEATURE ||
      command.migrationVersion !==
        AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_MIGRATION_VERSION ||
      command.migrationSha256 !==
        AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_MIGRATION_SHA256 ||
      typeof command.migrationReadinessFingerprint !==
        'string' ||
      !SHA256_PATTERN.test(
        command.migrationReadinessFingerprint,
      ) ||
      command.migrationReadinessFingerprint !==
        migrationReadinessFingerprint
    ) {
      fail('RUNTIME_ACTIVATION_COMMAND_INVALID')
    }
    return command as
      AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationCommand
  } catch (error) {
    if (
      error instanceof
      AiChartD1PalaceWritingTrustedDeliveryProductionReadinessAdapterError
    ) {
      throw error
    }
    fail('RUNTIME_ACTIVATION_COMMAND_INVALID')
  }
}

function parseDeploymentAttestation(
  value: unknown,
) {
  try {
    assertAiChartD1SafeGraph(value)
    const response = requireAiChartD1ExactObject(
      value,
      DEPLOYMENT_ATTESTATION_RESPONSE_FIELDS,
    )
    if (
      response.bindingMode !==
        DEPLOYMENT_ATTESTATION_BINDING_MODE ||
      response.attestationSource !==
        AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_DEPLOYMENT_ATTESTATION_SOURCE ||
      typeof response.sourceCommitSha !== 'string' ||
      !SHA1_PATTERN.test(response.sourceCommitSha) ||
      response.migrationVersion !==
        AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_MIGRATION_VERSION ||
      response.migrationPath !==
        AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_MIGRATION_PATH ||
      response.migrationSha256 !==
        AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_MIGRATION_SHA256 ||
      response.requiredRpcName !==
        AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_SUPABASE_RPC_NAME
    ) {
      fail('DEPLOYMENT_ATTESTATION_RESPONSE_INVALID')
    }
    if (
      response.attestationStatus !== 'VERIFIED' ||
      response.sourceValidationStatus !==
        'PASSED' ||
      response.preflightStatus !== 'PASSED' ||
      response.migrationApplyStatus !==
        'APPLIED' ||
      response.postflightStatus !== 'PASSED' ||
      response.schemaContractStatus !==
        'VERIFIED' ||
      response.rpcExecuteGrantStatus !==
        'SERVICE_ROLE_ONLY_VERIFIED'
    ) {
      fail('DEPLOYMENT_ATTESTATION_NOT_VERIFIED')
    }
    return freezeAiChartD1Value({
      bindingMode:
        DEPLOYMENT_ATTESTATION_BINDING_MODE,
      attestationStatus: 'VERIFIED' as const,
      attestationSource:
        AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_DEPLOYMENT_ATTESTATION_SOURCE,
      sourceCommitSha: response.sourceCommitSha,
      migrationVersion:
        AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_MIGRATION_VERSION,
      migrationPath:
        AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_MIGRATION_PATH,
      migrationSha256:
        AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_MIGRATION_SHA256,
      requiredRpcName:
        AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_SUPABASE_RPC_NAME,
      sourceValidationStatus: 'PASSED' as const,
      preflightStatus: 'PASSED' as const,
      migrationApplyStatus: 'APPLIED' as const,
      postflightStatus: 'PASSED' as const,
      schemaContractStatus: 'VERIFIED' as const,
      rpcExecuteGrantStatus:
        'SERVICE_ROLE_ONLY_VERIFIED' as const,
    })
  } catch (error) {
    if (
      error instanceof
      AiChartD1PalaceWritingTrustedDeliveryProductionReadinessAdapterError
    ) {
      throw error
    }
    fail('DEPLOYMENT_ATTESTATION_RESPONSE_INVALID')
  }
}

export function createAiChartD1PalaceWritingTrustedDeliveryProductionReadinessAdapters(
  dependencies: Readonly<{
    verifyControlledDeploymentMigrationAttestation: (
      command:
        AiChartD1PalaceWritingTrustedDeliveryControlledDeploymentAttestationCommand,
    ) => PromiseLike<unknown>
    runtimeActivationAuthorizationHandoff:
      AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationHandoff
  }>,
): AiChartD1PalaceWritingTrustedDeliveryProductionReadinessAdapters {
  let dependencyRecord: Record<string, unknown>
  try {
    dependencyRecord =
      requireAiChartD1ExactObject(
        dependencies,
        DEPENDENCY_FIELDS,
      )
  } catch {
    fail('PRODUCTION_READINESS_ADAPTERS_UNAVAILABLE')
  }
  if (
    process.env.NODE_ENV !== 'test' ||
    typeof dependencyRecord.verifyControlledDeploymentMigrationAttestation !==
      'function' ||
    typeof dependencyRecord.runtimeActivationAuthorizationHandoff !==
      'object' ||
    dependencyRecord.runtimeActivationAuthorizationHandoff ===
      null
  ) {
    fail('PRODUCTION_READINESS_ADAPTERS_UNAVAILABLE')
  }

  let migrationAttestationConsumed = false
  let runtimeActivationConsumed = false
  let verifiedMigrationReadinessFingerprint:
    string | null = null
  let verifiedDeploymentSourceCommitSha:
    string | null = null

  const verifyMigrationReadiness =
    async (
      value:
        AiChartD1PalaceWritingTrustedDeliveryMigrationReadinessCommand,
    ): Promise<unknown> => {
      if (migrationAttestationConsumed) {
        fail('DEPLOYMENT_ATTESTATION_ALREADY_CONSUMED')
      }
      migrationAttestationConsumed = true
      const command =
        parseMigrationReadinessCommand(value)
      const attestationCommand =
        freezeAiChartD1Value({
          bindingMode:
            DEPLOYMENT_ATTESTATION_BINDING_MODE,
          attestationSource:
            AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_DEPLOYMENT_ATTESTATION_SOURCE,
          migrationVersion:
            command.migrationVersion,
          migrationPath: command.migrationPath,
          migrationSha256:
            command.migrationSha256,
          requiredRpcName:
            command.requiredRpcName,
          requiredChecks:
            AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_DEPLOYMENT_ATTESTATION_REQUIRED_CHECKS,
        })

      let attestationResponse: unknown
      try {
        attestationResponse = await (
          dependencyRecord
            .verifyControlledDeploymentMigrationAttestation as (
              command:
                AiChartD1PalaceWritingTrustedDeliveryControlledDeploymentAttestationCommand,
            ) => PromiseLike<unknown>
        )(attestationCommand)
      } catch {
        fail('DEPLOYMENT_ATTESTATION_CHECK_FAILED')
      }
      const verifiedAttestation =
        parseDeploymentAttestation(
          attestationResponse,
        )
      verifiedDeploymentSourceCommitSha =
        verifiedAttestation.sourceCommitSha

      const readinessResponse =
        freezeAiChartD1Value({
          bindingMode:
            MIGRATION_READINESS_BINDING_MODE,
          readinessStatus: 'READY' as const,
          migrationVersion:
            AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_MIGRATION_VERSION,
          migrationSha256:
            AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_MIGRATION_SHA256,
          requiredRpcName:
            AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_SUPABASE_RPC_NAME,
          schemaContractStatus:
            'VERIFIED' as const,
          rpcExecuteGrantStatus:
            'SERVICE_ROLE_ONLY_VERIFIED' as const,
        })
      verifiedMigrationReadinessFingerprint =
        createCanonicalSha256(readinessResponse)
      return readinessResponse
    }

  const verifyRuntimeActivation =
    async (
      value:
        AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationCommand,
    ): Promise<unknown> => {
      if (runtimeActivationConsumed) {
        fail('RUNTIME_ACTIVATION_ALREADY_CONSUMED')
      }
      runtimeActivationConsumed = true
      const command = parseRuntimeActivationCommand(
        value,
        verifiedMigrationReadinessFingerprint,
      )
      let authorization
      try {
        authorization =
          consumeAiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationHandoff(
            dependencyRecord.runtimeActivationAuthorizationHandoff,
          )
      } catch {
        fail(
          'RUNTIME_ACTIVATION_AUTHORIZATION_HANDOFF_INVALID',
        )
      }
      if (
        verifiedDeploymentSourceCommitSha ===
          null ||
        authorization.releaseCommitSha !==
          verifiedDeploymentSourceCommitSha ||
        authorization.feature !==
          AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_PRODUCTION_BINDING_FEATURE ||
        authorization.migrationVersion !==
          AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_MIGRATION_VERSION ||
        authorization.migrationSha256 !==
          AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_MIGRATION_SHA256 ||
        authorization.migrationReadinessFingerprint !==
          command.migrationReadinessFingerprint ||
        authorization.runtimeActivationPolicyVersion !==
          AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_POLICY_VERSION ||
        authorization.runtimeActivationAllowed !==
          false ||
        authorization.productionCallable !==
          false
      ) {
        fail(
          'RUNTIME_ACTIVATION_AUTHORIZATION_BINDING_INVALID',
        )
      }
      return freezeAiChartD1Value({
        bindingMode:
          RUNTIME_ACTIVATION_BINDING_MODE,
        activationStatus: 'INACTIVE' as const,
        feature:
          AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_PRODUCTION_BINDING_FEATURE,
        migrationReadinessFingerprint:
          command.migrationReadinessFingerprint,
      })
    }

  return Object.freeze({
    contractVersion:
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_PRODUCTION_READINESS_ADAPTERS_VERSION,
    task:
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_PRODUCTION_READINESS_ADAPTERS_TASK,
    dataClassification:
      'DEPLOYMENT_ATTESTATION_RELEASE_AUTHORIZATION_AND_RUNTIME_POLICY_METADATA' as const,
    bindingStatus:
      'OFFLINE_ATTESTATION_AND_RELEASE_AUTHORIZATION_BOUND_RUNTIME_BLOCKED' as const,
    deploymentAttestationSource:
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_DEPLOYMENT_ATTESTATION_SOURCE,
    runtimeActivationPolicyVersion:
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_POLICY_VERSION,
    runtimeActivationPolicyStatus:
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_POLICY
        .activationStatus,
    verifyMigrationReadiness:
      Object.freeze(verifyMigrationReadiness),
    verifyRuntimeActivation:
      Object.freeze(verifyRuntimeActivation),
    automaticRetryAllowed: false as const,
    customerDeliveryAllowed: false as const,
    productionCallable: false as const,
    databaseConnections: 0 as const,
    reportMutations: 0 as const,
    openAiRequests: 0 as const,
    nextRequiredAction:
      'IMPLEMENT_APPROVED_PRODUCTION_RUNTIME_ACTIVATION_ADAPTER_BEFORE_ADMIN_BINDING' as const,
  })
}
