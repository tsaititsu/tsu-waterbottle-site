import 'server-only'

import { createHash } from 'node:crypto'
import type {
  getSupabaseAdmin as getExistingSupabaseAdmin,
} from '../supabase/admin'
import {
  assertAiChartD1SafeGraph,
  freezeAiChartD1Value,
  requireAiChartD1ExactObject,
} from './d1CommonContracts'
import {
  createAiChartD1PalaceWritingCanonicalJson,
} from './d1PalaceWritingPromptPackageContracts'
import {
  AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_SUPABASE_ADMIN_CLIENT_FACTORY_VERSION,
  createAiChartD1PalaceWritingTrustedDeliverySupabaseAdminClientRepositoryBundle,
  type AiChartD1PalaceWritingTrustedDeliverySupabaseAdminClientRepositoryBundle,
} from './d1PalaceWritingTrustedDeliverySupabaseAdminClientFactory.server'
import {
  AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_SUPABASE_RPC_NAME,
} from './d1PalaceWritingTrustedDeliverySupabaseRepository.server'

export const AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_PRODUCTION_BINDING_READINESS_VERSION =
  'ai-chart-d1-palace-writing-trusted-delivery-production-binding-readiness/v1' as const
export const AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_PRODUCTION_BINDING_READINESS_TASK =
  'D1_PALACE_WRITING_TRUSTED_DELIVERY_PRODUCTION_BINDING_READINESS' as const
export const AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_MIGRATION_VERSION =
  '20260728120000' as const
export const AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_MIGRATION_PATH =
  'supabase/migrations/20260728120000_ai_chart_report_trusted_delivery_contracts.sql' as const
export const AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_MIGRATION_SHA256 =
  '8d310b1ef2750afbd41da00e04e0a10b6198fd2f894d07d09f11b5dfc7df3e66' as const
export const AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_PRODUCTION_BINDING_FEATURE =
  'D1_PALACE_WRITING_TRUSTED_DELIVERY' as const

export const AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_PRODUCTION_BINDING_DEPENDENCY_ORDER =
  Object.freeze([
    'VERIFY_MIGRATION_READINESS',
    'VERIFY_RUNTIME_ACTIVATION',
    'BIND_EXISTING_GET_SUPABASE_ADMIN',
  ] as const)

export const AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_PRODUCTION_BINDING_FAILURE_CODES =
  Object.freeze([
    'PRODUCTION_BINDING_READINESS_UNAVAILABLE',
    'MIGRATION_READINESS_CHECK_FAILED',
    'MIGRATION_NOT_READY',
    'MIGRATION_READINESS_RESPONSE_INVALID',
    'RUNTIME_ACTIVATION_CHECK_FAILED',
    'RUNTIME_NOT_ACTIVE',
    'RUNTIME_ACTIVATION_RESPONSE_INVALID',
    'ADMIN_CLIENT_BINDING_FAILED',
  ] as const)

export type AiChartD1PalaceWritingTrustedDeliveryProductionBindingFailureCode =
  (typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_PRODUCTION_BINDING_FAILURE_CODES)[number]

const MIGRATION_BINDING_MODE =
  'INJECTED_PRODUCTION_BINDING_READINESS_PROBE_ONLY' as const
const RUNTIME_ACTIVATION_BINDING_MODE =
  'INJECTED_RUNTIME_ACTIVATION_GATE_PROBE_ONLY' as const

const DEPENDENCY_FIELDS = Object.freeze([
  'verifyMigrationReadiness',
  'verifyRuntimeActivation',
  'getSupabaseAdmin',
] as const)
const MIGRATION_READINESS_RESPONSE_FIELDS =
  Object.freeze([
    'bindingMode',
    'readinessStatus',
    'migrationVersion',
    'migrationSha256',
    'requiredRpcName',
    'schemaContractStatus',
    'rpcExecuteGrantStatus',
  ] as const)
const RUNTIME_ACTIVATION_RESPONSE_FIELDS =
  Object.freeze([
    'bindingMode',
    'activationStatus',
    'feature',
    'migrationReadinessFingerprint',
  ] as const)

export type AiChartD1PalaceWritingTrustedDeliveryMigrationReadinessCommand =
  Readonly<{
    bindingMode: typeof MIGRATION_BINDING_MODE
    migrationVersion:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_MIGRATION_VERSION
    migrationPath:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_MIGRATION_PATH
    migrationSha256:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_MIGRATION_SHA256
    requiredRpcName:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_SUPABASE_RPC_NAME
  }>

export type AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationCommand =
  Readonly<{
    bindingMode:
      typeof RUNTIME_ACTIVATION_BINDING_MODE
    feature:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_PRODUCTION_BINDING_FEATURE
    migrationVersion:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_MIGRATION_VERSION
    migrationSha256:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_MIGRATION_SHA256
    migrationReadinessFingerprint: string
  }>

type ExistingSupabaseAdminFactory =
  typeof getExistingSupabaseAdmin
type GetSupabaseAdminDependency = (
  ...args: Parameters<ExistingSupabaseAdminFactory>
) => unknown

export type AiChartD1PalaceWritingTrustedDeliveryProductionBindingReadiness =
  Readonly<{
    contractVersion:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_PRODUCTION_BINDING_READINESS_VERSION
    task:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_PRODUCTION_BINDING_READINESS_TASK
    dataClassification:
      'PRODUCTION_BINDING_READINESS_METADATA'
    bindingStatus: 'TEST_ONLY_ORDER_VERIFIED'
    dependencyOrder:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_PRODUCTION_BINDING_DEPENDENCY_ORDER
    migrationVersion:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_MIGRATION_VERSION
    migrationSha256:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_MIGRATION_SHA256
    migrationReadinessFingerprint: string
    migrationReadinessStatus: 'VERIFIED'
    runtimeActivationStatus: 'VERIFIED'
    adminClientBindingStatus:
      'BOUND_TO_INJECTED_EXISTING_GET_SUPABASE_ADMIN'
    adminClientFactoryContractVersion:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_SUPABASE_ADMIN_CLIENT_FACTORY_VERSION
    repositoryBundle:
      AiChartD1PalaceWritingTrustedDeliverySupabaseAdminClientRepositoryBundle
    automaticRetryAllowed: false
    customerDeliveryAllowed: false
    productionCallable: false
    databaseConnections: 0
    reportMutations: 0
    openAiRequests: 0
    nextRequiredAction:
      'IMPLEMENT_APPROVED_PRODUCTION_READINESS_ADAPTERS_BEFORE_ROUTE_WIRING'
  }>

export class AiChartD1PalaceWritingTrustedDeliveryProductionBindingReadinessError
  extends Error {
  readonly code:
    AiChartD1PalaceWritingTrustedDeliveryProductionBindingFailureCode

  constructor(
    code:
      AiChartD1PalaceWritingTrustedDeliveryProductionBindingFailureCode,
  ) {
    const safeCode =
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_PRODUCTION_BINDING_FAILURE_CODES.includes(
        code,
      )
        ? code
        : 'PRODUCTION_BINDING_READINESS_UNAVAILABLE'
    super(safeCode)
    this.name =
      'AiChartD1PalaceWritingTrustedDeliveryProductionBindingReadinessError'
    this.code = safeCode
    Object.freeze(this)
  }
}

function fail(
  code:
    AiChartD1PalaceWritingTrustedDeliveryProductionBindingFailureCode,
): never {
  throw new AiChartD1PalaceWritingTrustedDeliveryProductionBindingReadinessError(
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

function parseMigrationReadinessResponse(
  value: unknown,
): Readonly<{
  bindingMode: typeof MIGRATION_BINDING_MODE
  readinessStatus: 'READY'
  migrationVersion:
    typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_MIGRATION_VERSION
  migrationSha256:
    typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_MIGRATION_SHA256
  requiredRpcName:
    typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_SUPABASE_RPC_NAME
  schemaContractStatus: 'VERIFIED'
  rpcExecuteGrantStatus:
    'SERVICE_ROLE_ONLY_VERIFIED'
}> {
  try {
    assertAiChartD1SafeGraph(value)
    const response = requireAiChartD1ExactObject(
      value,
      MIGRATION_READINESS_RESPONSE_FIELDS,
    )
    if (
      response.bindingMode !==
        MIGRATION_BINDING_MODE ||
      response.migrationVersion !==
        AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_MIGRATION_VERSION ||
      response.migrationSha256 !==
        AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_MIGRATION_SHA256 ||
      response.requiredRpcName !==
        AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_SUPABASE_RPC_NAME
    ) {
      fail('MIGRATION_READINESS_RESPONSE_INVALID')
    }
    if (
      response.readinessStatus !== 'READY' ||
      response.schemaContractStatus !== 'VERIFIED' ||
      response.rpcExecuteGrantStatus !==
        'SERVICE_ROLE_ONLY_VERIFIED'
    ) {
      fail('MIGRATION_NOT_READY')
    }
    return freezeAiChartD1Value({
      bindingMode: MIGRATION_BINDING_MODE,
      readinessStatus: 'READY' as const,
      migrationVersion:
        AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_MIGRATION_VERSION,
      migrationSha256:
        AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_MIGRATION_SHA256,
      requiredRpcName:
        AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_SUPABASE_RPC_NAME,
      schemaContractStatus: 'VERIFIED' as const,
      rpcExecuteGrantStatus:
        'SERVICE_ROLE_ONLY_VERIFIED' as const,
    })
  } catch (error) {
    if (
      error instanceof
      AiChartD1PalaceWritingTrustedDeliveryProductionBindingReadinessError
    ) {
      throw error
    }
    fail('MIGRATION_READINESS_RESPONSE_INVALID')
  }
}

function parseRuntimeActivationResponse(
  value: unknown,
  migrationReadinessFingerprint: string,
): Readonly<{
  bindingMode: typeof RUNTIME_ACTIVATION_BINDING_MODE
  activationStatus: 'ACTIVE'
  feature:
    typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_PRODUCTION_BINDING_FEATURE
  migrationReadinessFingerprint: string
}> {
  try {
    assertAiChartD1SafeGraph(value)
    const response = requireAiChartD1ExactObject(
      value,
      RUNTIME_ACTIVATION_RESPONSE_FIELDS,
    )
    if (
      response.bindingMode !==
        RUNTIME_ACTIVATION_BINDING_MODE ||
      response.feature !==
        AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_PRODUCTION_BINDING_FEATURE ||
      response.migrationReadinessFingerprint !==
        migrationReadinessFingerprint
    ) {
      fail('RUNTIME_ACTIVATION_RESPONSE_INVALID')
    }
    if (response.activationStatus !== 'ACTIVE') {
      fail('RUNTIME_NOT_ACTIVE')
    }
    return freezeAiChartD1Value({
      bindingMode:
        RUNTIME_ACTIVATION_BINDING_MODE,
      activationStatus: 'ACTIVE' as const,
      feature:
        AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_PRODUCTION_BINDING_FEATURE,
      migrationReadinessFingerprint,
    })
  } catch (error) {
    if (
      error instanceof
      AiChartD1PalaceWritingTrustedDeliveryProductionBindingReadinessError
    ) {
      throw error
    }
    fail('RUNTIME_ACTIVATION_RESPONSE_INVALID')
  }
}

export async function prepareAiChartD1PalaceWritingTrustedDeliveryProductionBindingReadiness(
  dependencies: Readonly<{
    verifyMigrationReadiness: (
      command:
        AiChartD1PalaceWritingTrustedDeliveryMigrationReadinessCommand,
    ) => PromiseLike<unknown>
    verifyRuntimeActivation: (
      command:
        AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationCommand,
    ) => PromiseLike<unknown>
    getSupabaseAdmin: GetSupabaseAdminDependency
  }>,
): Promise<AiChartD1PalaceWritingTrustedDeliveryProductionBindingReadiness> {
  let dependencyRecord: Record<string, unknown>
  try {
    dependencyRecord =
      requireAiChartD1ExactObject(
        dependencies,
        DEPENDENCY_FIELDS,
      )
  } catch {
    fail('PRODUCTION_BINDING_READINESS_UNAVAILABLE')
  }
  if (
    process.env.NODE_ENV !== 'test' ||
    typeof dependencyRecord.verifyMigrationReadiness !==
      'function' ||
    typeof dependencyRecord.verifyRuntimeActivation !==
      'function' ||
    typeof dependencyRecord.getSupabaseAdmin !==
      'function'
  ) {
    fail('PRODUCTION_BINDING_READINESS_UNAVAILABLE')
  }

  const migrationCommand =
    freezeAiChartD1Value({
      bindingMode: MIGRATION_BINDING_MODE,
      migrationVersion:
        AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_MIGRATION_VERSION,
      migrationPath:
        AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_MIGRATION_PATH,
      migrationSha256:
        AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_MIGRATION_SHA256,
      requiredRpcName:
        AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_SUPABASE_RPC_NAME,
    })

  let migrationResponse: unknown
  try {
    migrationResponse = await (
      dependencyRecord.verifyMigrationReadiness as (
        command:
          AiChartD1PalaceWritingTrustedDeliveryMigrationReadinessCommand,
      ) => PromiseLike<unknown>
    )(migrationCommand)
  } catch {
    fail('MIGRATION_READINESS_CHECK_FAILED')
  }
  const migrationReadiness =
    parseMigrationReadinessResponse(
      migrationResponse,
    )
  const migrationReadinessFingerprint =
    sha256Canonical(migrationReadiness)

  const activationCommand =
    freezeAiChartD1Value({
      bindingMode:
        RUNTIME_ACTIVATION_BINDING_MODE,
      feature:
        AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_PRODUCTION_BINDING_FEATURE,
      migrationVersion:
        AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_MIGRATION_VERSION,
      migrationSha256:
        AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_MIGRATION_SHA256,
      migrationReadinessFingerprint,
    })

  let activationResponse: unknown
  try {
    activationResponse = await (
      dependencyRecord.verifyRuntimeActivation as (
        command:
          AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationCommand,
      ) => PromiseLike<unknown>
    )(activationCommand)
  } catch {
    fail('RUNTIME_ACTIVATION_CHECK_FAILED')
  }
  parseRuntimeActivationResponse(
    activationResponse,
    migrationReadinessFingerprint,
  )

  let repositoryBundle:
    AiChartD1PalaceWritingTrustedDeliverySupabaseAdminClientRepositoryBundle
  try {
    repositoryBundle =
      createAiChartD1PalaceWritingTrustedDeliverySupabaseAdminClientRepositoryBundle(
        {
          getSupabaseAdmin:
            dependencyRecord.getSupabaseAdmin as
              GetSupabaseAdminDependency,
        },
      )
  } catch {
    fail('ADMIN_CLIENT_BINDING_FAILED')
  }

  return freezeAiChartD1Value({
    contractVersion:
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_PRODUCTION_BINDING_READINESS_VERSION,
    task:
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_PRODUCTION_BINDING_READINESS_TASK,
    dataClassification:
      'PRODUCTION_BINDING_READINESS_METADATA' as const,
    bindingStatus:
      'TEST_ONLY_ORDER_VERIFIED' as const,
    dependencyOrder:
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_PRODUCTION_BINDING_DEPENDENCY_ORDER,
    migrationVersion:
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_MIGRATION_VERSION,
    migrationSha256:
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_MIGRATION_SHA256,
    migrationReadinessFingerprint,
    migrationReadinessStatus: 'VERIFIED' as const,
    runtimeActivationStatus: 'VERIFIED' as const,
    adminClientBindingStatus:
      'BOUND_TO_INJECTED_EXISTING_GET_SUPABASE_ADMIN' as const,
    adminClientFactoryContractVersion:
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_SUPABASE_ADMIN_CLIENT_FACTORY_VERSION,
    repositoryBundle,
    automaticRetryAllowed: false as const,
    customerDeliveryAllowed: false as const,
    productionCallable: false as const,
    databaseConnections: 0 as const,
    reportMutations: 0 as const,
    openAiRequests: 0 as const,
    nextRequiredAction:
      'IMPLEMENT_APPROVED_PRODUCTION_READINESS_ADAPTERS_BEFORE_ROUTE_WIRING' as const,
  })
}
