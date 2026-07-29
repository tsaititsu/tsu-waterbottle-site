import 'server-only'

import {
  assertAiChartD1SafeGraph,
  freezeAiChartD1Value,
  requireAiChartD1ExactObject,
} from './d1CommonContracts'
import {
  AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_MIGRATION_SHA256,
  AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_MIGRATION_VERSION,
  AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_PRODUCTION_BINDING_FEATURE,
} from './d1PalaceWritingTrustedDeliveryProductionBindingReadiness.server'
import {
  AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_POLICY_VERSION,
} from './d1PalaceWritingTrustedDeliveryRuntimeActivationPolicy.server'

export const AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_ADAPTER_COMMAND_VERSION =
  'ai-chart-d1-palace-writing-trusted-delivery-runtime-activation-authorization-adapter-command/v1' as const
export const AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_ADAPTER_COMMAND_TASK =
  'D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_ADAPTER_COMMAND' as const
export const AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_HANDOFF_VERSION =
  'ai-chart-d1-palace-writing-trusted-delivery-runtime-activation-authorization-handoff/v1' as const
export const AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_HANDOFF_TASK =
  'D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_HANDOFF' as const
export const AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_HANDOFF_PREPARATION_VERSION =
  'ai-chart-d1-palace-writing-trusted-delivery-runtime-activation-authorization-handoff-preparation/v1' as const
export const AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_HANDOFF_PREPARATION_TASK =
  'D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_HANDOFF_PREPARATION' as const
export const AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_HANDOFF_CONSUMPTION_VERSION =
  'ai-chart-d1-palace-writing-trusted-delivery-runtime-activation-authorization-handoff-consumption/v1' as const
export const AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_HANDOFF_CONSUMPTION_TASK =
  'D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_HANDOFF_CONSUMPTION' as const
export const AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_SCOPE =
  'ACTIVATE_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_FOR_EXACT_RELEASE' as const

export const AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_HANDOFF_FAILURE_CODES =
  Object.freeze([
    'RUNTIME_ACTIVATION_AUTHORIZATION_HANDOFF_UNAVAILABLE',
    'RUNTIME_ACTIVATION_AUTHORIZATION_TARGET_INVALID',
    'RUNTIME_ACTIVATION_AUTHORIZATION_CHECK_FAILED',
    'RUNTIME_ACTIVATION_AUTHORIZATION_RESPONSE_INVALID',
    'RUNTIME_ACTIVATION_AUTHORIZATION_NOT_GRANTED',
    'RUNTIME_ACTIVATION_AUTHORIZATION_HANDOFF_INVALID',
    'RUNTIME_ACTIVATION_AUTHORIZATION_HANDOFF_ALREADY_CONSUMED',
  ] as const)

export type AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationHandoffFailureCode =
  (typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_HANDOFF_FAILURE_CODES)[number]

const AUTHORIZATION_ADAPTER_MODE =
  'INJECTED_RELEASE_SCOPED_RUNTIME_ACTIVATION_AUTHORIZATION_PROBE_ONLY' as const
const SHA1_PATTERN = /^[a-f0-9]{40}$/u
const SHA256_PATTERN = /^[a-f0-9]{64}$/u
const INPUT_FIELDS = Object.freeze([
  'activationTarget',
  'verifyReleaseScopedRuntimeActivationAuthorization',
] as const)
const TARGET_FIELDS = Object.freeze([
  'releaseCommitSha',
  'migrationReadinessFingerprint',
] as const)
const AUTHORIZATION_RESPONSE_FIELDS =
  Object.freeze([
    'adapterMode',
    'authorizationStatus',
    'authorizationScope',
    'feature',
    'releaseCommitSha',
    'migrationVersion',
    'migrationSha256',
    'migrationReadinessFingerprint',
    'runtimeActivationPolicyVersion',
  ] as const)

export type AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationTarget =
  Readonly<{
    releaseCommitSha: string
    migrationReadinessFingerprint: string
  }>

export type AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationAdapterCommand =
  Readonly<{
    contractVersion:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_ADAPTER_COMMAND_VERSION
    task:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_ADAPTER_COMMAND_TASK
    adapterMode: typeof AUTHORIZATION_ADAPTER_MODE
    sequence: 1
    authorizationScope:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_SCOPE
    feature:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_PRODUCTION_BINDING_FEATURE
    releaseCommitSha: string
    migrationVersion:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_MIGRATION_VERSION
    migrationSha256:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_MIGRATION_SHA256
    migrationReadinessFingerprint: string
    runtimeActivationPolicyVersion:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_POLICY_VERSION
  }>

export type AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationHandoff =
  Readonly<{
    contractVersion:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_HANDOFF_VERSION
    task:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_HANDOFF_TASK
    authorizationScope:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_SCOPE
    feature:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_PRODUCTION_BINDING_FEATURE
    releaseCommitSha: string
    migrationVersion:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_MIGRATION_VERSION
    migrationSha256:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_MIGRATION_SHA256
    migrationReadinessFingerprint: string
    runtimeActivationPolicyVersion:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_POLICY_VERSION
    status: 'READY_NOT_CONSUMED'
    capabilityScope:
      'IN_PROCESS_EXACT_OBJECT_IDENTITY'
    adapterMode:
      'OFFLINE_SYNTHETIC_AUTHORIZATION_PROBE_ONLY'
    authorizationStatus:
      'SYNTHETIC_AUTHORIZED_NOT_PRODUCTION'
    runtimeActivationAllowed: false
    automaticRetryAllowed: false
    customerDeliveryAllowed: false
    productionCallable: false
    databaseConnections: 0
    reportMutations: 0
    openAiRequests: 0
  }>

export type AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationHandoffPreparation =
  Readonly<{
    contractVersion:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_HANDOFF_PREPARATION_VERSION
    task:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_HANDOFF_PREPARATION_TASK
    status: 'READY_STOPPED'
    stage:
      'OFFLINE_RELEASE_SCOPED_RUNTIME_ACTIVATION_AUTHORIZATION_HANDOFF_CREATED'
    nextRequiredAction:
      'CONSUME_OFFLINE_RELEASE_SCOPED_RUNTIME_ACTIVATION_AUTHORIZATION_HANDOFF_ONCE'
    handoff:
      AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationHandoff
    runtimeActivationAllowed: false
    customerDeliveryAllowed: false
    productionCallable: false
    databaseConnections: 0
    reportMutations: 0
    openAiRequests: 0
  }>

export type AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationHandoffConsumption =
  Readonly<{
    contractVersion:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_HANDOFF_CONSUMPTION_VERSION
    task:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_HANDOFF_CONSUMPTION_TASK
    authorizationScope:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_SCOPE
    feature:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_PRODUCTION_BINDING_FEATURE
    releaseCommitSha: string
    migrationVersion:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_MIGRATION_VERSION
    migrationSha256:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_MIGRATION_SHA256
    migrationReadinessFingerprint: string
    runtimeActivationPolicyVersion:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_POLICY_VERSION
    status: 'CONSUMED_STOPPED'
    stage:
      'OFFLINE_RELEASE_SCOPED_RUNTIME_ACTIVATION_AUTHORIZATION_HANDOFF_CONSUMED'
    capabilityScope:
      'IN_PROCESS_EXACT_OBJECT_IDENTITY'
    authorizationStatus:
      'SYNTHETIC_AUTHORIZED_NOT_PRODUCTION'
    nextRequiredAction:
      'VERIFY_RELEASE_BINDING_AND_KEEP_RUNTIME_INACTIVE'
    runtimeActivationAllowed: false
    automaticRetryAllowed: false
    customerDeliveryAllowed: false
    productionCallable: false
    databaseConnections: 0
    reportMutations: 0
    openAiRequests: 0
  }>

type RuntimeActivationAuthorizationHandoffBinding =
  Readonly<{
    authorizationScope:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_SCOPE
    feature:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_PRODUCTION_BINDING_FEATURE
    releaseCommitSha: string
    migrationVersion:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_MIGRATION_VERSION
    migrationSha256:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_MIGRATION_SHA256
    migrationReadinessFingerprint: string
    runtimeActivationPolicyVersion:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_POLICY_VERSION
  }>

const activeHandoffs = new WeakMap<
  AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationHandoff,
  RuntimeActivationAuthorizationHandoffBinding
>()
const consumedHandoffs = new WeakSet<
  AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationHandoff
>()

export class AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationHandoffError
  extends Error {
  readonly code:
    AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationHandoffFailureCode

  constructor(
    code:
      AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationHandoffFailureCode,
  ) {
    const safeCode =
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_HANDOFF_FAILURE_CODES.includes(
        code,
      )
        ? code
        : 'RUNTIME_ACTIVATION_AUTHORIZATION_HANDOFF_UNAVAILABLE'
    super(safeCode)
    this.name =
      'AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationHandoffError'
    this.code = safeCode
    Object.freeze(this)
  }
}

export class AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationHandoffAlreadyConsumedError
  extends Error {
  readonly code =
    'RUNTIME_ACTIVATION_AUTHORIZATION_HANDOFF_ALREADY_CONSUMED' as const

  constructor() {
    super(
      'RUNTIME_ACTIVATION_AUTHORIZATION_HANDOFF_ALREADY_CONSUMED',
    )
    this.name =
      'AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationHandoffAlreadyConsumedError'
    Object.freeze(this)
  }
}

function fail(
  code:
    AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationHandoffFailureCode,
): never {
  throw new AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationHandoffError(
    code,
  )
}

function parseTarget(
  value: unknown,
): AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationTarget {
  try {
    assertAiChartD1SafeGraph(value)
    const target = requireAiChartD1ExactObject(
      value,
      TARGET_FIELDS,
    )
    if (
      typeof target.releaseCommitSha !==
        'string' ||
      !SHA1_PATTERN.test(
        target.releaseCommitSha,
      ) ||
      typeof target.migrationReadinessFingerprint !==
        'string' ||
      !SHA256_PATTERN.test(
        target.migrationReadinessFingerprint,
      )
    ) {
      fail(
        'RUNTIME_ACTIVATION_AUTHORIZATION_TARGET_INVALID',
      )
    }
    return freezeAiChartD1Value({
      releaseCommitSha:
        target.releaseCommitSha,
      migrationReadinessFingerprint:
        target.migrationReadinessFingerprint,
    })
  } catch (error) {
    if (
      error instanceof
      AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationHandoffError
    ) {
      throw error
    }
    fail(
      'RUNTIME_ACTIVATION_AUTHORIZATION_TARGET_INVALID',
    )
  }
}

function parseAuthorizedOutcome(
  value: unknown,
  command:
    AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationAdapterCommand,
): void {
  try {
    assertAiChartD1SafeGraph(value)
    const outcome =
      requireAiChartD1ExactObject(
        value,
        AUTHORIZATION_RESPONSE_FIELDS,
      )
    if (
      outcome.adapterMode !==
        command.adapterMode ||
      outcome.authorizationScope !==
        command.authorizationScope ||
      outcome.feature !== command.feature ||
      outcome.releaseCommitSha !==
        command.releaseCommitSha ||
      outcome.migrationVersion !==
        command.migrationVersion ||
      outcome.migrationSha256 !==
        command.migrationSha256 ||
      outcome.migrationReadinessFingerprint !==
        command.migrationReadinessFingerprint ||
      outcome.runtimeActivationPolicyVersion !==
        command.runtimeActivationPolicyVersion
    ) {
      fail(
        'RUNTIME_ACTIVATION_AUTHORIZATION_RESPONSE_INVALID',
      )
    }
    if (
      outcome.authorizationStatus !==
      'AUTHORIZED'
    ) {
      fail(
        'RUNTIME_ACTIVATION_AUTHORIZATION_NOT_GRANTED',
      )
    }
  } catch (error) {
    if (
      error instanceof
      AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationHandoffError
    ) {
      throw error
    }
    fail(
      'RUNTIME_ACTIVATION_AUTHORIZATION_RESPONSE_INVALID',
    )
  }
}

export async function prepareAiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationHandoff(
  input: Readonly<{
    activationTarget:
      AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationTarget
    verifyReleaseScopedRuntimeActivationAuthorization: (
      command:
        AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationAdapterCommand,
    ) => PromiseLike<unknown>
  }>,
): Promise<AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationHandoffPreparation> {
  let inputRecord: Record<string, unknown>
  try {
    inputRecord =
      requireAiChartD1ExactObject(
        input,
        INPUT_FIELDS,
      )
  } catch {
    fail(
      'RUNTIME_ACTIVATION_AUTHORIZATION_HANDOFF_UNAVAILABLE',
    )
  }
  if (
    process.env.NODE_ENV !== 'test' ||
    typeof inputRecord
      .verifyReleaseScopedRuntimeActivationAuthorization !==
      'function'
  ) {
    fail(
      'RUNTIME_ACTIVATION_AUTHORIZATION_HANDOFF_UNAVAILABLE',
    )
  }
  const target = parseTarget(
    inputRecord.activationTarget,
  )
  const command = freezeAiChartD1Value({
    contractVersion:
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_ADAPTER_COMMAND_VERSION,
    task:
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_ADAPTER_COMMAND_TASK,
    adapterMode:
      AUTHORIZATION_ADAPTER_MODE,
    sequence: 1 as const,
    authorizationScope:
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_SCOPE,
    feature:
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_PRODUCTION_BINDING_FEATURE,
    releaseCommitSha:
      target.releaseCommitSha,
    migrationVersion:
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_MIGRATION_VERSION,
    migrationSha256:
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_MIGRATION_SHA256,
    migrationReadinessFingerprint:
      target.migrationReadinessFingerprint,
    runtimeActivationPolicyVersion:
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_POLICY_VERSION,
  })

  let outcome: unknown
  try {
    outcome = await (
      inputRecord
        .verifyReleaseScopedRuntimeActivationAuthorization as (
          command:
            AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationAdapterCommand,
        ) => PromiseLike<unknown>
    )(command)
  } catch {
    fail(
      'RUNTIME_ACTIVATION_AUTHORIZATION_CHECK_FAILED',
    )
  }
  parseAuthorizedOutcome(outcome, command)

  const handoff = freezeAiChartD1Value({
    contractVersion:
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_HANDOFF_VERSION,
    task:
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_HANDOFF_TASK,
    authorizationScope:
      command.authorizationScope,
    feature: command.feature,
    releaseCommitSha:
      command.releaseCommitSha,
    migrationVersion:
      command.migrationVersion,
    migrationSha256:
      command.migrationSha256,
    migrationReadinessFingerprint:
      command.migrationReadinessFingerprint,
    runtimeActivationPolicyVersion:
      command.runtimeActivationPolicyVersion,
    status: 'READY_NOT_CONSUMED' as const,
    capabilityScope:
      'IN_PROCESS_EXACT_OBJECT_IDENTITY' as const,
    adapterMode:
      'OFFLINE_SYNTHETIC_AUTHORIZATION_PROBE_ONLY' as const,
    authorizationStatus:
      'SYNTHETIC_AUTHORIZED_NOT_PRODUCTION' as const,
    runtimeActivationAllowed: false as const,
    automaticRetryAllowed: false as const,
    customerDeliveryAllowed: false as const,
    productionCallable: false as const,
    databaseConnections: 0 as const,
    reportMutations: 0 as const,
    openAiRequests: 0 as const,
  })
  activeHandoffs.set(
    handoff,
    freezeAiChartD1Value({
      authorizationScope:
        command.authorizationScope,
      feature: command.feature,
      releaseCommitSha:
        command.releaseCommitSha,
      migrationVersion:
        command.migrationVersion,
      migrationSha256:
        command.migrationSha256,
      migrationReadinessFingerprint:
        command.migrationReadinessFingerprint,
      runtimeActivationPolicyVersion:
        command.runtimeActivationPolicyVersion,
    }),
  )

  return freezeAiChartD1Value({
    contractVersion:
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_HANDOFF_PREPARATION_VERSION,
    task:
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_HANDOFF_PREPARATION_TASK,
    status: 'READY_STOPPED' as const,
    stage:
      'OFFLINE_RELEASE_SCOPED_RUNTIME_ACTIVATION_AUTHORIZATION_HANDOFF_CREATED' as const,
    nextRequiredAction:
      'CONSUME_OFFLINE_RELEASE_SCOPED_RUNTIME_ACTIVATION_AUTHORIZATION_HANDOFF_ONCE' as const,
    handoff,
    runtimeActivationAllowed: false as const,
    customerDeliveryAllowed: false as const,
    productionCallable: false as const,
    databaseConnections: 0 as const,
    reportMutations: 0 as const,
    openAiRequests: 0 as const,
  })
}

export function consumeAiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationHandoff(
  value: unknown,
): AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationHandoffConsumption {
  if (
    typeof value !== 'object' ||
    value === null
  ) {
    fail(
      'RUNTIME_ACTIVATION_AUTHORIZATION_HANDOFF_INVALID',
    )
  }
  const handoff =
    value as
      AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationHandoff
  if (consumedHandoffs.has(handoff)) {
    throw new AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationHandoffAlreadyConsumedError()
  }
  const binding = activeHandoffs.get(handoff)
  if (binding === undefined) {
    fail(
      'RUNTIME_ACTIVATION_AUTHORIZATION_HANDOFF_INVALID',
    )
  }
  activeHandoffs.delete(handoff)
  consumedHandoffs.add(handoff)

  return freezeAiChartD1Value({
    contractVersion:
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_HANDOFF_CONSUMPTION_VERSION,
    task:
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_HANDOFF_CONSUMPTION_TASK,
    authorizationScope:
      binding.authorizationScope,
    feature: binding.feature,
    releaseCommitSha:
      binding.releaseCommitSha,
    migrationVersion:
      binding.migrationVersion,
    migrationSha256:
      binding.migrationSha256,
    migrationReadinessFingerprint:
      binding.migrationReadinessFingerprint,
    runtimeActivationPolicyVersion:
      binding.runtimeActivationPolicyVersion,
    status: 'CONSUMED_STOPPED' as const,
    stage:
      'OFFLINE_RELEASE_SCOPED_RUNTIME_ACTIVATION_AUTHORIZATION_HANDOFF_CONSUMED' as const,
    capabilityScope:
      'IN_PROCESS_EXACT_OBJECT_IDENTITY' as const,
    authorizationStatus:
      'SYNTHETIC_AUTHORIZED_NOT_PRODUCTION' as const,
    nextRequiredAction:
      'VERIFY_RELEASE_BINDING_AND_KEEP_RUNTIME_INACTIVE' as const,
    runtimeActivationAllowed: false as const,
    automaticRetryAllowed: false as const,
    customerDeliveryAllowed: false as const,
    productionCallable: false as const,
    databaseConnections: 0 as const,
    reportMutations: 0 as const,
    openAiRequests: 0 as const,
  })
}
