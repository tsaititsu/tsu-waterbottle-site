import 'server-only'

import { createHash } from 'node:crypto'
import {
  freezeAiChartD1Value,
} from './d1CommonContracts'
import {
  AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_MIGRATION_SHA256,
  AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_MIGRATION_VERSION,
  AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_PRODUCTION_BINDING_FEATURE,
} from './d1PalaceWritingTrustedDeliveryProductionBindingReadiness.server'
import {
  createAiChartD1PalaceWritingCanonicalJson,
} from './d1PalaceWritingPromptPackageContracts'
import {
  AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_SCOPE,
} from './d1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationHandoff.server'
import {
  AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_POLICY_VERSION,
} from './d1PalaceWritingTrustedDeliveryRuntimeActivationPolicy.server'

export const AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_PORT_CONTRACT_VERSION =
  'ai-chart-d1-palace-writing-trusted-delivery-runtime-activation-authorization-port-contract/v1' as const
export const AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_PORT_CONTRACT_TASK =
  'D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_PORT_CONTRACT' as const
export const AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_PORT_COMMAND_VERSION =
  'ai-chart-d1-palace-writing-trusted-delivery-runtime-activation-authorization-port-command/v1' as const
export const AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_PORT_COMMAND_TASK =
  'D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_PORT_COMMAND' as const
export const AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_PORT_OUTCOME_VERSION =
  'ai-chart-d1-palace-writing-trusted-delivery-runtime-activation-authorization-port-outcome/v1' as const
export const AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_PORT_OUTCOME_TASK =
  'D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_PORT_OUTCOME' as const

export const AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_PORT_FAILURE_CODES =
  Object.freeze([
    'AUTHORIZATION_SOURCE_UNAVAILABLE',
    'AUTHORIZATION_CHECK_FAILED',
    'AUTHORIZATION_RESPONSE_INVALID',
    'AUTHORIZATION_NOT_GRANTED',
    'AUTHORIZATION_BINDING_MISMATCH',
  ] as const)

const REQUIRED_COMMAND_FIELDS = Object.freeze([
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

const ALLOWED_OUTCOME_FIELDS = Object.freeze([
  'contractVersion',
  'task',
  'authorizationStatus',
  'authorizationScope',
  'feature',
  'releaseCommitSha',
  'migrationVersion',
  'migrationSha256',
  'migrationReadinessFingerprint',
  'runtimeActivationPolicyVersion',
] as const)

const AUTHORIZATION_STATUS_VALUES = Object.freeze([
  'AUTHORIZED',
  'DENIED',
] as const)

export type AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationPortFailureCode =
  (typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_PORT_FAILURE_CODES)[number]

export type AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationPortCommand =
  Readonly<{
    contractVersion:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_PORT_COMMAND_VERSION
    task:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_PORT_COMMAND_TASK
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

export type AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationPort =
  (
    command:
      AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationPortCommand,
  ) => PromiseLike<unknown>

export type AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationPortContract =
  Readonly<{
    contractVersion:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_PORT_CONTRACT_VERSION
    task:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_PORT_CONTRACT_TASK
    dataClassification:
      'RUNTIME_ACTIVATION_AUTHORIZATION_PORT_METADATA'
    port:
      'VERIFY_EXPLICIT_RELEASE_SCOPED_RUNTIME_ACTIVATION_AUTHORIZATION'
    portInterface:
      'ONE_EXACT_COMMAND_ONE_SAFE_DECISION'
    commandContractVersion:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_PORT_COMMAND_VERSION
    commandTask:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_PORT_COMMAND_TASK
    outcomeContractVersion:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_PORT_OUTCOME_VERSION
    outcomeTask:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_PORT_OUTCOME_TASK
    authorizationScope:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_SCOPE
    requiredCommandFields:
      typeof REQUIRED_COMMAND_FIELDS
    allowedOutcomeFields:
      typeof ALLOWED_OUTCOME_FIELDS
    authorizationStatusValues:
      typeof AUTHORIZATION_STATUS_VALUES
    authorizationSource:
      'CONTROLLED_PRODUCTION_RELEASE_AUTHORIZATION_NOT_SELECTED'
    commandOwnership:
      'MODULE_OWNED_EXACT_RELEASE_BINDING_ONLY'
    authorizerIdentityHandling:
      'VERIFY_INTERNALLY_DO_NOT_RETURN'
    authorizationProofHandling:
      'VERIFY_INTERNALLY_DO_NOT_RETURN'
    callerBooleanAllowed: false
    environmentOverrideAllowed: false
    reusableAuthorizationTokenAllowed: false
    providerMetadataAllowed: false
    freeTextOutputAllowed: false
    automaticRetryAllowed: false
    failureCodes:
      readonly AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationPortFailureCode[]
    implementationStatus:
      'PORT_DECLARED_NOT_IMPLEMENTED'
    authorizationStatus: 'NOT_EVALUATED'
    handoffStatus: 'NOT_CREATED'
    runtimeActivationAllowed: false
    customerDeliveryAllowed: false
    productionCallable: false
    adapterInvocations: 0
    environmentReads: 0
    secretReads: 0
    databaseConnections: 0
    reportMutations: 0
    openAiRequests: 0
    nextRequiredAction:
      'SELECT_CONTROLLED_AUTHORIZATION_SOURCE_BEFORE_IMPLEMENTING_ADAPTER'
    contractFingerprint: string
  }>

const withoutFingerprint = {
  contractVersion:
    AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_PORT_CONTRACT_VERSION,
  task:
    AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_PORT_CONTRACT_TASK,
  dataClassification:
    'RUNTIME_ACTIVATION_AUTHORIZATION_PORT_METADATA' as const,
  port:
    'VERIFY_EXPLICIT_RELEASE_SCOPED_RUNTIME_ACTIVATION_AUTHORIZATION' as const,
  portInterface:
    'ONE_EXACT_COMMAND_ONE_SAFE_DECISION' as const,
  commandContractVersion:
    AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_PORT_COMMAND_VERSION,
  commandTask:
    AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_PORT_COMMAND_TASK,
  outcomeContractVersion:
    AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_PORT_OUTCOME_VERSION,
  outcomeTask:
    AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_PORT_OUTCOME_TASK,
  authorizationScope:
    AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_SCOPE,
  requiredCommandFields:
    REQUIRED_COMMAND_FIELDS,
  allowedOutcomeFields:
    ALLOWED_OUTCOME_FIELDS,
  authorizationStatusValues:
    AUTHORIZATION_STATUS_VALUES,
  authorizationSource:
    'CONTROLLED_PRODUCTION_RELEASE_AUTHORIZATION_NOT_SELECTED' as const,
  commandOwnership:
    'MODULE_OWNED_EXACT_RELEASE_BINDING_ONLY' as const,
  authorizerIdentityHandling:
    'VERIFY_INTERNALLY_DO_NOT_RETURN' as const,
  authorizationProofHandling:
    'VERIFY_INTERNALLY_DO_NOT_RETURN' as const,
  callerBooleanAllowed: false as const,
  environmentOverrideAllowed: false as const,
  reusableAuthorizationTokenAllowed: false as const,
  providerMetadataAllowed: false as const,
  freeTextOutputAllowed: false as const,
  automaticRetryAllowed: false as const,
  failureCodes:
    AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_PORT_FAILURE_CODES,
  implementationStatus:
    'PORT_DECLARED_NOT_IMPLEMENTED' as const,
  authorizationStatus:
    'NOT_EVALUATED' as const,
  handoffStatus: 'NOT_CREATED' as const,
  runtimeActivationAllowed: false as const,
  customerDeliveryAllowed: false as const,
  productionCallable: false as const,
  adapterInvocations: 0 as const,
  environmentReads: 0 as const,
  secretReads: 0 as const,
  databaseConnections: 0 as const,
  reportMutations: 0 as const,
  openAiRequests: 0 as const,
  nextRequiredAction:
    'SELECT_CONTROLLED_AUTHORIZATION_SOURCE_BEFORE_IMPLEMENTING_ADAPTER' as const,
}

const contractFingerprint = createHash('sha256')
  .update(
    createAiChartD1PalaceWritingCanonicalJson(
      withoutFingerprint,
    ),
    'utf8',
  )
  .digest('hex')

export const AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_PORT_CONTRACT:
  AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationPortContract =
    freezeAiChartD1Value({
      ...withoutFingerprint,
      contractFingerprint,
    })
