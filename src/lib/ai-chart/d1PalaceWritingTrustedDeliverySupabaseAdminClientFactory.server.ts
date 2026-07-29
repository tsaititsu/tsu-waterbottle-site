import 'server-only'

import {
  assertAiChartD1SafeGraph,
  freezeAiChartD1Value,
  requireAiChartD1ExactObject,
} from './d1CommonContracts'
import {
  AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_REPOSITORY_ADAPTER_MODE,
  type AiChartD1PalaceWritingAtomicDeliveryRpcCommand,
  type AiChartD1PalaceWritingExpectedOwnerLookupCommand,
} from './d1PalaceWritingTrustedDeliveryRepositoryAdapter.server'
import {
  AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_SUPABASE_RPC_NAME,
  createAiChartD1PalaceWritingTrustedDeliverySupabaseAtomicRpcInvoker,
} from './d1PalaceWritingTrustedDeliverySupabaseRepository.server'

export const AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_SUPABASE_ADMIN_CLIENT_FACTORY_VERSION =
  'ai-chart-d1-palace-writing-trusted-delivery-supabase-admin-client-factory/v1' as const
export const AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_SUPABASE_ADMIN_CLIENT_FACTORY_TASK =
  'D1_PALACE_WRITING_TRUSTED_DELIVERY_SUPABASE_ADMIN_CLIENT_FACTORY' as const

export const AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_SUPABASE_ADMIN_CLIENT_FACTORY_FAILURE_CODES =
  Object.freeze([
    'SUPABASE_ADMIN_REPOSITORY_BUNDLE_UNAVAILABLE',
    'SUPABASE_ADMIN_CLIENT_UNAVAILABLE',
    'SUPABASE_ADMIN_OWNER_LOOKUP_COMMAND_INVALID',
    'SUPABASE_ADMIN_OWNER_LOOKUP_FAILED',
    'SUPABASE_ADMIN_OWNER_LOOKUP_NOT_FOUND',
    'SUPABASE_ADMIN_OWNER_LOOKUP_RESPONSE_INVALID',
  ] as const)

export type AiChartD1PalaceWritingTrustedDeliverySupabaseAdminClientFactoryFailureCode =
  (typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_SUPABASE_ADMIN_CLIENT_FACTORY_FAILURE_CODES)[number]

const DEPENDENCY_FIELDS = Object.freeze([
  'getSupabaseAdmin',
] as const)
const OWNER_LOOKUP_COMMAND_FIELDS = Object.freeze([
  'adapterMode',
  'reportId',
] as const)
const OWNER_LOOKUP_RESPONSE_FIELDS = Object.freeze([
  'data',
  'error',
  'count',
  'status',
  'statusText',
] as const)
const OWNER_ROW_FIELDS = Object.freeze([
  'id',
  'user_id',
] as const)
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu

type SupabaseAdminOwnerQuery = Readonly<{
  select: (
    columns: 'id,user_id',
  ) => Readonly<{
    eq: (
      column: 'id',
      reportId: string,
    ) => Readonly<{
      retry: (
        enabled: false,
      ) => Readonly<{
        maybeSingle: () => PromiseLike<unknown>
      }>
    }>
  }>
}>

type SupabaseAdminClientBoundary = Readonly<{
  from: (
    tableName: 'ai_chart_reports',
  ) => SupabaseAdminOwnerQuery
  rpc: (
    functionName:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_SUPABASE_RPC_NAME,
    command:
      AiChartD1PalaceWritingAtomicDeliveryRpcCommand,
  ) => PromiseLike<unknown>
}>

type GetSupabaseAdmin = () => unknown

export type AiChartD1PalaceWritingTrustedDeliverySupabaseAdminClientRepositoryBundle =
  Readonly<{
    lookupExpectedOwner: (
      command:
        AiChartD1PalaceWritingExpectedOwnerLookupCommand,
    ) => Promise<unknown>
    invokeAtomicDeliveryRpc: (
      command:
        AiChartD1PalaceWritingAtomicDeliveryRpcCommand,
    ) => Promise<unknown>
  }>

export class AiChartD1PalaceWritingTrustedDeliverySupabaseAdminClientFactoryError
  extends Error {
  readonly code:
    AiChartD1PalaceWritingTrustedDeliverySupabaseAdminClientFactoryFailureCode

  constructor(
    code:
      AiChartD1PalaceWritingTrustedDeliverySupabaseAdminClientFactoryFailureCode,
  ) {
    const safeCode =
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_SUPABASE_ADMIN_CLIENT_FACTORY_FAILURE_CODES.includes(
        code,
      )
        ? code
        : 'SUPABASE_ADMIN_REPOSITORY_BUNDLE_UNAVAILABLE'
    super(safeCode)
    this.name =
      'AiChartD1PalaceWritingTrustedDeliverySupabaseAdminClientFactoryError'
    this.code = safeCode
    Object.freeze(this)
  }
}

function fail(
  code:
    AiChartD1PalaceWritingTrustedDeliverySupabaseAdminClientFactoryFailureCode,
): never {
  throw new AiChartD1PalaceWritingTrustedDeliverySupabaseAdminClientFactoryError(
    code,
  )
}

function parseOwnerLookupCommand(
  value: unknown,
): AiChartD1PalaceWritingExpectedOwnerLookupCommand {
  try {
    assertAiChartD1SafeGraph(value)
    if (!Object.isFrozen(value)) {
      fail('SUPABASE_ADMIN_OWNER_LOOKUP_COMMAND_INVALID')
    }
    const command = requireAiChartD1ExactObject(
      value,
      OWNER_LOOKUP_COMMAND_FIELDS,
    )
    if (
      command.adapterMode !==
        AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_REPOSITORY_ADAPTER_MODE ||
      typeof command.reportId !== 'string' ||
      !UUID_PATTERN.test(command.reportId)
    ) {
      fail('SUPABASE_ADMIN_OWNER_LOOKUP_COMMAND_INVALID')
    }
    return value as
      AiChartD1PalaceWritingExpectedOwnerLookupCommand
  } catch (error) {
    if (
      error instanceof
      AiChartD1PalaceWritingTrustedDeliverySupabaseAdminClientFactoryError
    ) {
      throw error
    }
    fail('SUPABASE_ADMIN_OWNER_LOOKUP_COMMAND_INVALID')
  }
}

function parseOwnerLookupResponse(
  value: unknown,
  reportId: string,
): Readonly<{
  adapterMode:
    typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_REPOSITORY_ADAPTER_MODE
  reportId: string
  ownerUserId: string
}> {
  try {
    assertAiChartD1SafeGraph(value)
    const response = requireAiChartD1ExactObject(
      value,
      OWNER_LOOKUP_RESPONSE_FIELDS,
    )
    if (response.error !== null) {
      fail('SUPABASE_ADMIN_OWNER_LOOKUP_FAILED')
    }
    if (response.data === null) {
      fail('SUPABASE_ADMIN_OWNER_LOOKUP_NOT_FOUND')
    }
    const row = requireAiChartD1ExactObject(
      response.data,
      OWNER_ROW_FIELDS,
    )
    if (
      row.id !== reportId ||
      typeof row.user_id !== 'string' ||
      !UUID_PATTERN.test(row.user_id)
    ) {
      fail(
        'SUPABASE_ADMIN_OWNER_LOOKUP_RESPONSE_INVALID',
      )
    }
    return freezeAiChartD1Value({
      adapterMode:
        AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_REPOSITORY_ADAPTER_MODE,
      reportId,
      ownerUserId: row.user_id,
    })
  } catch (error) {
    if (
      error instanceof
      AiChartD1PalaceWritingTrustedDeliverySupabaseAdminClientFactoryError
    ) {
      throw error
    }
    fail('SUPABASE_ADMIN_OWNER_LOOKUP_RESPONSE_INVALID')
  }
}

function parseAdminClient(
  value: unknown,
): SupabaseAdminClientBoundary {
  if (
    value === null ||
    typeof value !== 'object' ||
    !('from' in value) ||
    typeof value.from !== 'function' ||
    !('rpc' in value) ||
    typeof value.rpc !== 'function'
  ) {
    fail('SUPABASE_ADMIN_CLIENT_UNAVAILABLE')
  }
  return value as SupabaseAdminClientBoundary
}

export function createAiChartD1PalaceWritingTrustedDeliverySupabaseAdminClientRepositoryBundle(
  dependencies: Readonly<{
    getSupabaseAdmin: GetSupabaseAdmin
  }>,
): AiChartD1PalaceWritingTrustedDeliverySupabaseAdminClientRepositoryBundle {
  let dependencyRecord: Record<string, unknown>
  try {
    dependencyRecord =
      requireAiChartD1ExactObject(
        dependencies,
        DEPENDENCY_FIELDS,
      )
  } catch {
    fail('SUPABASE_ADMIN_REPOSITORY_BUNDLE_UNAVAILABLE')
  }
  if (
    process.env.NODE_ENV !== 'test' ||
    typeof dependencyRecord.getSupabaseAdmin !==
      'function'
  ) {
    fail('SUPABASE_ADMIN_REPOSITORY_BUNDLE_UNAVAILABLE')
  }

  let adminClient: SupabaseAdminClientBoundary
  try {
    adminClient = parseAdminClient(
      (
        dependencyRecord.getSupabaseAdmin as
          GetSupabaseAdmin
      )(),
    )
  } catch (error) {
    if (
      error instanceof
      AiChartD1PalaceWritingTrustedDeliverySupabaseAdminClientFactoryError
    ) {
      throw error
    }
    fail('SUPABASE_ADMIN_CLIENT_UNAVAILABLE')
  }

  const lookupExpectedOwner =
    async (
      command:
        AiChartD1PalaceWritingExpectedOwnerLookupCommand,
    ): Promise<unknown> => {
      const parsedCommand =
        parseOwnerLookupCommand(command)
      let response: unknown
      try {
        response = await adminClient
          .from('ai_chart_reports')
          .select('id,user_id')
          .eq('id', parsedCommand.reportId)
          .retry(false)
          .maybeSingle()
      } catch {
        fail('SUPABASE_ADMIN_OWNER_LOOKUP_FAILED')
      }
      return parseOwnerLookupResponse(
        response,
        parsedCommand.reportId,
      )
    }

  const invokeAtomicDeliveryRpc =
    createAiChartD1PalaceWritingTrustedDeliverySupabaseAtomicRpcInvoker(
      {
        rpc: (functionName, command) =>
          adminClient.rpc(functionName, command),
      },
    )

  return Object.freeze({
    lookupExpectedOwner:
      Object.freeze(lookupExpectedOwner),
    invokeAtomicDeliveryRpc,
  })
}
