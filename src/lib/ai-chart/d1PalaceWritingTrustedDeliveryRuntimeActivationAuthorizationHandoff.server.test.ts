import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import Module, { createRequire } from 'node:module'
import {
  createAiChartD1PalaceWritingCanonicalJson,
} from './d1PalaceWritingPromptPackageContracts'

type NodeModuleInternals = {
  _resolveFilename: (
    request: string,
    parent: unknown,
    isMain: boolean,
    options?: unknown,
  ) => string
  _load: (
    request: string,
    parent: unknown,
    isMain: boolean,
  ) => unknown
}

const moduleInternals =
  Module as unknown as NodeModuleInternals
const originalResolveFilename =
  moduleInternals._resolveFilename
const originalLoad = moduleInternals._load
const testRequire = createRequire(import.meta.url)
const serverOnlyStubPath =
  testRequire.resolve('./d1Assets')

let serverModule:
  typeof import(
    './d1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationHandoff.server'
  )
let readinessAdaptersModule:
  typeof import(
    './d1PalaceWritingTrustedDeliveryProductionReadinessAdapters.server'
  )
let productionBindingReadinessModule:
  typeof import(
    './d1PalaceWritingTrustedDeliveryProductionBindingReadiness.server'
  )
let authorizationPortContractModule:
  typeof import(
    './d1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationPortContracts.server'
  )
let githubEnvironmentSourceContractModule:
  typeof import(
    './d1PalaceWritingTrustedDeliveryRuntimeActivationGitHubEnvironmentSourceContracts.server'
  )
let githubOidcAttestationTransportContractModule:
  typeof import(
    './d1PalaceWritingTrustedDeliveryRuntimeActivationGitHubOidcAttestationTransportContracts.server'
  )
let durableAuthorizationReceiptContractModule:
  typeof import(
    './d1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptContracts.server'
  )
let durableAuthorizationReceiptAdapterProbeModule:
  typeof import(
    './d1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptAdapterProbe.server'
  )
let durableAuthorizationReceiptStorageContractModule:
  typeof import(
    './d1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptStorageContracts.server'
  )

try {
  moduleInternals._resolveFilename =
    function resolveFilenameForTest(
      this: unknown,
      request: string,
      parent: unknown,
      isMain: boolean,
      options?: unknown,
    ) {
      if (request === 'server-only') {
        return serverOnlyStubPath
      }
      return originalResolveFilename.call(
        this,
        request,
        parent,
        isMain,
        options,
      )
    }
  moduleInternals._load = function loadForTest(
    this: unknown,
    request: string,
    parent: unknown,
    isMain: boolean,
  ) {
    if (request === 'server-only') return {}
    return originalLoad.call(
      this,
      request,
      parent,
      isMain,
    )
  }
  serverModule = testRequire(
    './d1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationHandoff.server',
  ) as typeof import(
    './d1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationHandoff.server'
  )
  readinessAdaptersModule = testRequire(
    './d1PalaceWritingTrustedDeliveryProductionReadinessAdapters.server',
  ) as typeof import(
    './d1PalaceWritingTrustedDeliveryProductionReadinessAdapters.server'
  )
  productionBindingReadinessModule =
    testRequire(
      './d1PalaceWritingTrustedDeliveryProductionBindingReadiness.server',
    ) as typeof import(
      './d1PalaceWritingTrustedDeliveryProductionBindingReadiness.server'
    )
  authorizationPortContractModule =
    testRequire(
      './d1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationPortContracts.server',
    ) as typeof import(
      './d1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationPortContracts.server'
    )
  githubEnvironmentSourceContractModule =
    testRequire(
      './d1PalaceWritingTrustedDeliveryRuntimeActivationGitHubEnvironmentSourceContracts.server',
    ) as typeof import(
      './d1PalaceWritingTrustedDeliveryRuntimeActivationGitHubEnvironmentSourceContracts.server'
    )
  githubOidcAttestationTransportContractModule =
    testRequire(
      './d1PalaceWritingTrustedDeliveryRuntimeActivationGitHubOidcAttestationTransportContracts.server',
    ) as typeof import(
      './d1PalaceWritingTrustedDeliveryRuntimeActivationGitHubOidcAttestationTransportContracts.server'
    )
  durableAuthorizationReceiptContractModule =
    testRequire(
      './d1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptContracts.server',
    ) as typeof import(
      './d1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptContracts.server'
    )
  durableAuthorizationReceiptAdapterProbeModule =
    testRequire(
      './d1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptAdapterProbe.server',
    ) as typeof import(
      './d1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptAdapterProbe.server'
    )
  durableAuthorizationReceiptStorageContractModule =
    testRequire(
      './d1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptStorageContracts.server',
    ) as typeof import(
      './d1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptStorageContracts.server'
    )
} finally {
  moduleInternals._resolveFilename =
    originalResolveFilename
  moduleInternals._load = originalLoad
}

const {
  AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationHandoffAlreadyConsumedError,
  AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationHandoffError,
  consumeAiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationHandoff,
  prepareAiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationHandoff,
} = serverModule
const {
  createAiChartD1PalaceWritingTrustedDeliveryProductionReadinessAdapters,
} = readinessAdaptersModule
const {
  AiChartD1PalaceWritingTrustedDeliveryProductionBindingReadinessError,
  prepareAiChartD1PalaceWritingTrustedDeliveryProductionBindingReadiness,
} = productionBindingReadinessModule
const {
  AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_PORT_CONTRACT,
  AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_PORT_FAILURE_CODES,
} = authorizationPortContractModule
const {
  AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_GITHUB_ENVIRONMENT_SOURCE_CONTRACT,
  AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_GITHUB_ENVIRONMENT_SOURCE_REQUIRED_BINDING_CHECKS,
} = githubEnvironmentSourceContractModule
const {
  AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_GITHUB_OIDC_ATTESTATION_TRANSPORT_CONTRACT,
  AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_GITHUB_OIDC_ATTESTATION_TRANSPORT_REQUIRED_ENVELOPE_FIELDS,
  AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_GITHUB_OIDC_ATTESTATION_TRANSPORT_REQUIRED_TOKEN_CLAIMS,
  AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_GITHUB_OIDC_ATTESTATION_TRANSPORT_REQUIRED_VERIFICATION_CHECKS,
} = githubOidcAttestationTransportContractModule
const {
  AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_CONTRACT,
  AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_FAILURE_CODES,
  AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_RECONCILIATION_CASES,
  AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_REQUIRED_CREATE_FIELDS,
  AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_REQUIRED_READ_FIELDS,
  AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_REQUIRED_RECEIPT_FIELDS,
  AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_REQUIRED_RUNTIME_READ_CHECKS,
  AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_UNIQUE_KEYS,
} = durableAuthorizationReceiptContractModule
const {
  AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptAdapterProbeError,
  createAiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptAdapterProbe,
} = durableAuthorizationReceiptAdapterProbeModule
const {
  AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_CONTRACT,
  AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_ATOMIC_CREATE_RPC_PARAMETERS,
  AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_COLUMN_MAPPINGS,
  AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_FAILURE_MAPPINGS,
  AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_METHOD_MAPPINGS,
  AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_RECONCILIATION_RPC_PARAMETERS,
  AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_REQUIRED_COLUMNS,
  AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_REQUIRED_SECURITY_CONTROLS,
  AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_RESULT_CODES,
  AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_RPC_RESPONSE_FIELDS,
  AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_RUNTIME_READ_RPC_PARAMETERS,
  AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_UNIQUE_CONSTRAINTS,
} = durableAuthorizationReceiptStorageContractModule

const RELEASE_COMMIT_SHA = 'a'.repeat(40)
const MIGRATION_VERSION = '20260728120000'
const MIGRATION_PATH =
  'supabase/migrations/20260728120000_ai_chart_report_trusted_delivery_contracts.sql'
const MIGRATION_SHA256 =
  '8d310b1ef2750afbd41da00e04e0a10b6198fd2f894d07d09f11b5dfc7df3e66'
const REQUIRED_RPC_NAME =
  'deliver_ai_chart_report_after_review'
const MIGRATION_READINESS_RESPONSE =
  Object.freeze({
    bindingMode:
      'INJECTED_PRODUCTION_BINDING_READINESS_PROBE_ONLY' as const,
    readinessStatus: 'READY' as const,
    migrationVersion: MIGRATION_VERSION,
    migrationSha256: MIGRATION_SHA256,
    requiredRpcName: REQUIRED_RPC_NAME,
    schemaContractStatus:
      'VERIFIED' as const,
    rpcExecuteGrantStatus:
      'SERVICE_ROLE_ONLY_VERIFIED' as const,
  })
const MIGRATION_READINESS_FINGERPRINT =
  createHash('sha256')
    .update(
      createAiChartD1PalaceWritingCanonicalJson(
        MIGRATION_READINESS_RESPONSE,
      ),
      'utf8',
    )
    .digest('hex')
const MIGRATION_READINESS_COMMAND =
  Object.freeze({
    bindingMode:
      'INJECTED_PRODUCTION_BINDING_READINESS_PROBE_ONLY' as const,
    migrationVersion: MIGRATION_VERSION,
    migrationPath: MIGRATION_PATH,
    migrationSha256: MIGRATION_SHA256,
    requiredRpcName: REQUIRED_RPC_NAME,
  })
const mutableEnvironment =
  process.env as Record<
    string,
    string | undefined
  >
const previousNodeEnv =
  mutableEnvironment.NODE_ENV
const SENSITIVE_MARKER =
  'synthetic-sensitive-runtime-authorization-marker'

function recursivelyFrozen(
  value: unknown,
): boolean {
  if (
    value === null ||
    typeof value !== 'object'
  ) {
    return true
  }
  if (!Object.isFrozen(value)) return false
  return Reflect.ownKeys(value).every((key) =>
    recursivelyFrozen(
      (
        value as Record<
          PropertyKey,
          unknown
        >
      )[key],
    ),
  )
}

let checks = 0

async function check(
  name: string,
  runCheck: () => void | Promise<void>,
): Promise<void> {
  await runCheck()
  checks += 1
  console.log(`✓ ${name}`)
}

function createAuthorizedOutcome(
  command:
    import(
      './d1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationHandoff.server'
    ).AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationAdapterCommand,
) {
  return {
    adapterMode: command.adapterMode,
    authorizationStatus:
      'AUTHORIZED',
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
  } as const
}

async function prepareFreshHandoff(
  target: Readonly<{
    releaseCommitSha?: string
    migrationReadinessFingerprint?: string
  }> = {},
) {
  const prepared =
    await prepareAiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationHandoff(
      {
        activationTarget: {
          releaseCommitSha:
            target.releaseCommitSha ??
            RELEASE_COMMIT_SHA,
          migrationReadinessFingerprint:
            target.migrationReadinessFingerprint ??
            MIGRATION_READINESS_FINGERPRINT,
        },
        verifyReleaseScopedRuntimeActivationAuthorization:
          async (command) =>
            createAuthorizedOutcome(command),
      },
    )
  return prepared.handoff
}

function createRuntimeActivationCommand(
  migrationReadinessFingerprint =
    MIGRATION_READINESS_FINGERPRINT,
) {
  return Object.freeze({
    bindingMode:
      'INJECTED_RUNTIME_ACTIVATION_GATE_PROBE_ONLY' as const,
    feature:
      'D1_PALACE_WRITING_TRUSTED_DELIVERY' as const,
    migrationVersion: MIGRATION_VERSION,
    migrationSha256: MIGRATION_SHA256,
    migrationReadinessFingerprint,
  })
}

function createDurableAuthorizationReceiptCommands(
  overrides: Readonly<{
    releaseCommitSha?: string
    migrationReadinessFingerprint?: string
    replayKeyFingerprint?: string
    sourceContractFingerprint?: string
    authorizationPortContractFingerprint?: string
    transportContractFingerprint?: string
  }> = {},
) {
  const authorizationCommand =
    Object.freeze({
      contractVersion:
        'ai-chart-d1-palace-writing-trusted-delivery-runtime-activation-authorization-port-command/v1' as const,
      task:
        'D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_PORT_COMMAND' as const,
      authorizationScope:
        'ACTIVATE_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_FOR_EXACT_RELEASE' as const,
      feature:
        'D1_PALACE_WRITING_TRUSTED_DELIVERY' as const,
      releaseCommitSha:
        overrides.releaseCommitSha ??
        RELEASE_COMMIT_SHA,
      migrationVersion: MIGRATION_VERSION,
      migrationSha256: MIGRATION_SHA256,
      migrationReadinessFingerprint:
        overrides.migrationReadinessFingerprint ??
        MIGRATION_READINESS_FINGERPRINT,
      runtimeActivationPolicyVersion:
        'ai-chart-d1-palace-writing-trusted-delivery-runtime-activation-policy/v1' as const,
    })
  const authorizationCommandFingerprint =
    createHash('sha256')
      .update(
        createAiChartD1PalaceWritingCanonicalJson(
          authorizationCommand,
        ),
        'utf8',
      )
      .digest('hex')
  const sourceContractFingerprint =
    overrides.sourceContractFingerprint ??
    AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_GITHUB_ENVIRONMENT_SOURCE_CONTRACT.contractFingerprint
  const authorizationPortContractFingerprint =
    overrides.authorizationPortContractFingerprint ??
    AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_PORT_CONTRACT.contractFingerprint
  const transportContractFingerprint =
    overrides.transportContractFingerprint ??
    AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_GITHUB_OIDC_ATTESTATION_TRANSPORT_CONTRACT.contractFingerprint

  return Object.freeze({
    createCommand: Object.freeze({
      sourceContractVersion:
        'ai-chart-d1-palace-writing-trusted-delivery-runtime-activation-github-environment-source-contract/v1' as const,
      sourceContractFingerprint,
      authorizationPortContractVersion:
        'ai-chart-d1-palace-writing-trusted-delivery-runtime-activation-authorization-port-contract/v1' as const,
      authorizationPortContractFingerprint,
      transportContractVersion:
        'ai-chart-d1-palace-writing-trusted-delivery-runtime-activation-github-oidc-attestation-transport-contract/v1' as const,
      transportContractFingerprint,
      authorizationCommand,
      authorizationCommandFingerprint,
      replayKeyFingerprint:
        overrides.replayKeyFingerprint ??
        'b'.repeat(64),
    }),
    readCommand: Object.freeze({
      authorizationCommand,
      authorizationCommandFingerprint,
      sourceContractFingerprint,
      authorizationPortContractFingerprint,
      transportContractFingerprint,
    }),
  })
}

function createVerifiedDeploymentAttestation(
  sourceCommitSha = RELEASE_COMMIT_SHA,
) {
  return {
    bindingMode:
      'INJECTED_CONTROLLED_DEPLOYMENT_ATTESTATION_PROBE_ONLY',
    attestationStatus: 'VERIFIED',
    attestationSource:
      'APPROVED_PSQL_EXACT_FILE_RUNNER',
    sourceCommitSha,
    migrationVersion: MIGRATION_VERSION,
    migrationPath: MIGRATION_PATH,
    migrationSha256: MIGRATION_SHA256,
    requiredRpcName: REQUIRED_RPC_NAME,
    sourceValidationStatus: 'PASSED',
    preflightStatus: 'PASSED',
    migrationApplyStatus: 'APPLIED',
    postflightStatus: 'PASSED',
    schemaContractStatus: 'VERIFIED',
    rpcExecuteGrantStatus:
      'SERVICE_ROLE_ONLY_VERIFIED',
  } as const
}

function expectAuthorizationError(
  error: unknown,
  code:
    import(
      './d1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationHandoff.server'
    ).AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationHandoffFailureCode,
): boolean {
  assert.equal(
    error instanceof
      AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationHandoffError,
    true,
  )
  assert.equal(
    (
      error as InstanceType<
        typeof AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationHandoffError
      >
    ).code,
    code,
  )
  assert.equal(Object.isFrozen(error), true)
  assert.equal(
    JSON.stringify(error).includes(
      SENSITIVE_MARKER,
    ),
    false,
  )
  return true
}

function expectReadinessAdapterError(
  error: unknown,
  code:
    import(
      './d1PalaceWritingTrustedDeliveryProductionReadinessAdapters.server'
    ).AiChartD1PalaceWritingTrustedDeliveryProductionReadinessAdapterFailureCode,
): boolean {
  assert.equal(
    error instanceof
      readinessAdaptersModule.AiChartD1PalaceWritingTrustedDeliveryProductionReadinessAdapterError,
    true,
  )
  assert.equal(
    (
      error as InstanceType<
        typeof readinessAdaptersModule.AiChartD1PalaceWritingTrustedDeliveryProductionReadinessAdapterError
      >
    ).code,
    code,
  )
  assert.equal(Object.isFrozen(error), true)
  assert.equal(
    JSON.stringify(error).includes(
      SENSITIVE_MARKER,
    ),
    false,
  )
  return true
}

function expectReceiptAdapterProbeError(
  error: unknown,
  code:
    import(
      './d1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptAdapterProbe.server'
    ).AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptAdapterProbeFailureCode,
): boolean {
  assert.equal(
    error instanceof
      AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptAdapterProbeError,
    true,
  )
  assert.equal(
    (
      error as InstanceType<
        typeof AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptAdapterProbeError
      >
    ).code,
    code,
  )
  assert.equal(Object.isFrozen(error), true)
  const serialized = JSON.stringify(error)
  assert.equal(
    serialized.includes(SENSITIVE_MARKER),
    false,
  )
  assert.equal(serialized.includes('stack'), false)
  return true
}

async function run(): Promise<void> {
  await check(
    'exact release target receives one frozen authorization command and creates a blocked non-production handoff',
    async () => {
      const commands:
        import(
          './d1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationHandoff.server'
        ).AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationAdapterCommand[] =
        []
      const prepared =
        await prepareAiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationHandoff(
          {
            activationTarget: {
              releaseCommitSha:
                RELEASE_COMMIT_SHA,
              migrationReadinessFingerprint:
                MIGRATION_READINESS_FINGERPRINT,
            },
            verifyReleaseScopedRuntimeActivationAuthorization:
              async (
                command:
                  import(
                    './d1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationHandoff.server'
                  ).AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationAdapterCommand,
              ) => {
                commands.push(command)
                return createAuthorizedOutcome(
                  command,
                )
              },
          },
        )

      assert.equal(commands.length, 1)
      assert.deepEqual(commands[0], {
        contractVersion:
          'ai-chart-d1-palace-writing-trusted-delivery-runtime-activation-authorization-adapter-command/v1',
        task:
          'D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_ADAPTER_COMMAND',
        adapterMode:
          'INJECTED_RELEASE_SCOPED_RUNTIME_ACTIVATION_AUTHORIZATION_PROBE_ONLY',
        sequence: 1,
        authorizationScope:
          'ACTIVATE_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_FOR_EXACT_RELEASE',
        feature:
          'D1_PALACE_WRITING_TRUSTED_DELIVERY',
        releaseCommitSha:
          RELEASE_COMMIT_SHA,
        migrationVersion: '20260728120000',
        migrationSha256:
          '8d310b1ef2750afbd41da00e04e0a10b6198fd2f894d07d09f11b5dfc7df3e66',
        migrationReadinessFingerprint:
          MIGRATION_READINESS_FINGERPRINT,
        runtimeActivationPolicyVersion:
          'ai-chart-d1-palace-writing-trusted-delivery-runtime-activation-policy/v1',
      })
      assert.equal(
        recursivelyFrozen(commands[0]),
        true,
      )
      assert.equal(
        prepared.status,
        'READY_STOPPED',
      )
      assert.equal(
        prepared.stage,
        'OFFLINE_RELEASE_SCOPED_RUNTIME_ACTIVATION_AUTHORIZATION_HANDOFF_CREATED',
      )
      assert.equal(
        prepared.handoff.releaseCommitSha,
        RELEASE_COMMIT_SHA,
      )
      assert.equal(
        prepared.handoff
          .migrationReadinessFingerprint,
        MIGRATION_READINESS_FINGERPRINT,
      )
      assert.equal(
        prepared.handoff
          .authorizationStatus,
        'SYNTHETIC_AUTHORIZED_NOT_PRODUCTION',
      )
      assert.equal(
        prepared.handoff
          .runtimeActivationAllowed,
        false,
      )
      assert.equal(
        prepared.handoff.productionCallable,
        false,
      )
      assert.equal(
        prepared.handoff
          .customerDeliveryAllowed,
        false,
      )
      assert.equal(
        prepared.handoff
          .databaseConnections,
        0,
      )
      assert.equal(
        prepared.handoff.openAiRequests,
        0,
      )
      assert.equal(
        recursivelyFrozen(prepared),
        true,
      )
    },
  )

  await check(
    'field-equivalent copies are rejected while the exact handoff is consumed once and remains unable to activate Runtime',
    async () => {
      const prepared =
        await prepareAiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationHandoff(
          {
            activationTarget: {
              releaseCommitSha:
                RELEASE_COMMIT_SHA,
              migrationReadinessFingerprint:
                MIGRATION_READINESS_FINGERPRINT,
            },
            verifyReleaseScopedRuntimeActivationAuthorization:
              async (command) =>
                createAuthorizedOutcome(
                  command,
                ),
          },
        )
      const handoff = prepared.handoff

      assert.throws(
        () =>
          consumeAiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationHandoff(
            { ...handoff },
          ),
        AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationHandoffError,
      )
      assert.throws(
        () =>
          consumeAiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationHandoff(
            structuredClone(handoff),
          ),
        AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationHandoffError,
      )

      const consumed =
        consumeAiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationHandoff(
          handoff,
        )
      assert.equal(
        consumed.status,
        'CONSUMED_STOPPED',
      )
      assert.equal(
        consumed.stage,
        'OFFLINE_RELEASE_SCOPED_RUNTIME_ACTIVATION_AUTHORIZATION_HANDOFF_CONSUMED',
      )
      assert.equal(
        consumed.nextRequiredAction,
        'VERIFY_RELEASE_BINDING_AND_KEEP_RUNTIME_INACTIVE',
      )
      assert.equal(
        consumed.releaseCommitSha,
        RELEASE_COMMIT_SHA,
      )
      assert.equal(
        consumed
          .migrationReadinessFingerprint,
        MIGRATION_READINESS_FINGERPRINT,
      )
      assert.equal(
        consumed.runtimeActivationAllowed,
        false,
      )
      assert.equal(
        consumed.productionCallable,
        false,
      )
      assert.equal(
        consumed.customerDeliveryAllowed,
        false,
      )
      assert.equal(
        consumed.databaseConnections,
        0,
      )
      assert.equal(
        consumed.openAiRequests,
        0,
      )
      assert.equal(
        recursivelyFrozen(consumed),
        true,
      )
      assert.throws(
        () =>
          consumeAiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationHandoff(
            handoff,
          ),
        AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationHandoffAlreadyConsumedError,
      )
    },
  )

  await check(
    'invalid or caller-expanded release targets fail before the authorization boundary',
    async () => {
      const invalidInputs = [
        {
          activationTarget: {
            releaseCommitSha:
              'A'.repeat(40),
            migrationReadinessFingerprint:
              MIGRATION_READINESS_FINGERPRINT,
          },
        },
        {
          activationTarget: {
            releaseCommitSha:
              RELEASE_COMMIT_SHA,
            migrationReadinessFingerprint:
              'not-a-sha256',
          },
        },
        {
          activationTarget: {
            releaseCommitSha:
              RELEASE_COMMIT_SHA,
            migrationReadinessFingerprint:
              MIGRATION_READINESS_FINGERPRINT,
            runtimeActivationAllowed: true,
          },
        },
      ] as const

      for (const item of invalidInputs) {
        let authorizationCalls = 0
        await assert.rejects(
          prepareAiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationHandoff(
            {
              activationTarget:
                item.activationTarget,
              verifyReleaseScopedRuntimeActivationAuthorization:
                async (command) => {
                  authorizationCalls += 1
                  return createAuthorizedOutcome(
                    command,
                  )
                },
            },
          ),
          (error: unknown) =>
            expectAuthorizationError(
              error,
              'RUNTIME_ACTIVATION_AUTHORIZATION_TARGET_INVALID',
            ),
        )
        assert.equal(authorizationCalls, 0)
      }

      let authorizationCalls = 0
      await assert.rejects(
        prepareAiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationHandoff(
          {
            activationTarget: {
              releaseCommitSha:
                RELEASE_COMMIT_SHA,
              migrationReadinessFingerprint:
                MIGRATION_READINESS_FINGERPRINT,
            },
            verifyReleaseScopedRuntimeActivationAuthorization:
              async (
                command:
                  import(
                    './d1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationHandoff.server'
                  ).AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationAdapterCommand,
              ) => {
                authorizationCalls += 1
                return createAuthorizedOutcome(
                  command,
                )
              },
            runtimeActivationAllowed: true,
          } as never,
        ),
        (error: unknown) =>
          expectAuthorizationError(
            error,
            'RUNTIME_ACTIVATION_AUTHORIZATION_HANDOFF_UNAVAILABLE',
          ),
      )
      assert.equal(authorizationCalls, 0)
    },
  )

  await check(
    'authorization denial, release drift, extra provider payload, and boundary exceptions use fixed safe errors without retry',
    async () => {
      const cases = [
        {
          expectedCode:
            'RUNTIME_ACTIVATION_AUTHORIZATION_NOT_GRANTED' as const,
          createOutcome: (
            command:
              import(
                './d1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationHandoff.server'
              ).AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationAdapterCommand,
          ) => ({
            ...createAuthorizedOutcome(command),
            authorizationStatus:
              'DENIED',
          }),
        },
        {
          expectedCode:
            'RUNTIME_ACTIVATION_AUTHORIZATION_RESPONSE_INVALID' as const,
          createOutcome: (
            command:
              import(
                './d1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationHandoff.server'
              ).AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationAdapterCommand,
          ) => ({
            ...createAuthorizedOutcome(command),
            releaseCommitSha:
              'c'.repeat(40),
          }),
        },
        {
          expectedCode:
            'RUNTIME_ACTIVATION_AUTHORIZATION_RESPONSE_INVALID' as const,
          createOutcome: (
            command:
              import(
                './d1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationHandoff.server'
              ).AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationAdapterCommand,
          ) => ({
            ...createAuthorizedOutcome(command),
            providerMessage:
              SENSITIVE_MARKER,
          }),
        },
      ] as const

      for (const item of cases) {
        let authorizationCalls = 0
        await assert.rejects(
          prepareAiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationHandoff(
            {
              activationTarget: {
                releaseCommitSha:
                  RELEASE_COMMIT_SHA,
                migrationReadinessFingerprint:
                  MIGRATION_READINESS_FINGERPRINT,
              },
              verifyReleaseScopedRuntimeActivationAuthorization:
                async (command) => {
                  authorizationCalls += 1
                  return item.createOutcome(
                    command,
                  )
                },
            },
          ),
          (error: unknown) =>
            expectAuthorizationError(
              error,
              item.expectedCode,
            ),
        )
        assert.equal(authorizationCalls, 1)
      }

      let authorizationCalls = 0
      await assert.rejects(
        prepareAiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationHandoff(
          {
            activationTarget: {
              releaseCommitSha:
                RELEASE_COMMIT_SHA,
              migrationReadinessFingerprint:
                MIGRATION_READINESS_FINGERPRINT,
            },
            verifyReleaseScopedRuntimeActivationAuthorization:
              async () => {
                authorizationCalls += 1
                throw new Error(
                  SENSITIVE_MARKER,
                )
              },
          },
        ),
        (error: unknown) =>
          expectAuthorizationError(
            error,
            'RUNTIME_ACTIVATION_AUTHORIZATION_CHECK_FAILED',
          ),
      )
      assert.equal(authorizationCalls, 1)
    },
  )

  await check(
    'two concurrent consumers can consume one exact in-process handoff at most once',
    async () => {
      const handoff = await prepareFreshHandoff()
      const results = await Promise.allSettled([
        Promise.resolve().then(() =>
          consumeAiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationHandoff(
            handoff,
          ),
        ),
        Promise.resolve().then(() =>
          consumeAiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationHandoff(
            handoff,
          ),
        ),
      ])
      assert.equal(
        results.filter(
          (result) =>
            result.status === 'fulfilled',
        ).length,
        1,
      )
      assert.equal(
        results.filter(
          (result) =>
            result.status === 'rejected' &&
            result.reason instanceof
              AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationHandoffAlreadyConsumedError,
        ).length,
        1,
      )
    },
  )

  await check(
    'exact release authorization is consumed inside the existing readiness order while Runtime remains inactive before admin binding',
    async () => {
      const handoff = await prepareFreshHandoff()
      let attestationCalls = 0
      let adminFactoryCalls = 0
      const adapters =
        createAiChartD1PalaceWritingTrustedDeliveryProductionReadinessAdapters(
          {
            verifyControlledDeploymentMigrationAttestation:
              async () => {
                attestationCalls += 1
                return createVerifiedDeploymentAttestation()
              },
            runtimeActivationAuthorizationHandoff:
              handoff,
          } as never,
        )

      await assert.rejects(
        prepareAiChartD1PalaceWritingTrustedDeliveryProductionBindingReadiness(
          {
            verifyMigrationReadiness:
              adapters.verifyMigrationReadiness,
            verifyRuntimeActivation:
              adapters.verifyRuntimeActivation,
            getSupabaseAdmin: () => {
              adminFactoryCalls += 1
              throw new Error(
                'admin factory must remain unreachable',
              )
            },
          },
        ),
        (
          error: unknown,
        ): boolean => {
          assert.equal(
            error instanceof
              AiChartD1PalaceWritingTrustedDeliveryProductionBindingReadinessError,
            true,
          )
          assert.equal(
            (
              error as InstanceType<
                typeof AiChartD1PalaceWritingTrustedDeliveryProductionBindingReadinessError
              >
            ).code,
            'RUNTIME_NOT_ACTIVE',
          )
          return true
        },
      )

      assert.equal(attestationCalls, 1)
      assert.equal(adminFactoryCalls, 0)
      assert.throws(
        () =>
          consumeAiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationHandoff(
            handoff,
          ),
        AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationHandoffAlreadyConsumedError,
      )
      assert.equal(
        adapters.runtimeActivationPolicyStatus,
        'BLOCKED_PENDING_EXPLICIT_PRODUCTION_AUTHORIZATION',
      )
      assert.equal(
        adapters.bindingStatus,
        'OFFLINE_ATTESTATION_AND_RELEASE_AUTHORIZATION_BOUND_RUNTIME_BLOCKED',
      )
      assert.equal(
        adapters.productionCallable,
        false,
      )
      assert.equal(
        adapters.databaseConnections,
        0,
      )
      assert.equal(
        adapters.reportMutations,
        0,
      )
      assert.equal(
        adapters.openAiRequests,
        0,
      )
    },
  )

  await check(
    'release and Migration-readiness drift consume the one-shot authorization but fail with a fixed binding error',
    async () => {
      for (const drift of [
        'release',
        'migration-readiness',
      ] as const) {
        const handoff =
          await prepareFreshHandoff(
            drift === 'migration-readiness'
              ? {
                  migrationReadinessFingerprint:
                    'c'.repeat(64),
                }
              : {},
          )
        const adapters =
          createAiChartD1PalaceWritingTrustedDeliveryProductionReadinessAdapters(
            {
              verifyControlledDeploymentMigrationAttestation:
                async () =>
                  createVerifiedDeploymentAttestation(
                    drift === 'release'
                      ? 'd'.repeat(40)
                      : RELEASE_COMMIT_SHA,
                  ),
              runtimeActivationAuthorizationHandoff:
                handoff,
            },
          )

        await adapters.verifyMigrationReadiness(
          MIGRATION_READINESS_COMMAND,
        )
        await assert.rejects(
          adapters.verifyRuntimeActivation(
            createRuntimeActivationCommand(),
          ),
          (error: unknown) =>
            expectReadinessAdapterError(
              error,
              'RUNTIME_ACTIVATION_AUTHORIZATION_BINDING_INVALID',
            ),
        )
        assert.throws(
          () =>
            consumeAiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationHandoff(
              handoff,
            ),
          AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationHandoffAlreadyConsumedError,
        )
      }
    },
  )

  await check(
    'field-equivalent handoff copies fail closed without consuming the original authorization capability',
    async () => {
      const handoff = await prepareFreshHandoff()
      const adapters =
        createAiChartD1PalaceWritingTrustedDeliveryProductionReadinessAdapters(
          {
            verifyControlledDeploymentMigrationAttestation:
              async () =>
                createVerifiedDeploymentAttestation(),
            runtimeActivationAuthorizationHandoff:
              { ...handoff },
          } as never,
        )

      await adapters.verifyMigrationReadiness(
        MIGRATION_READINESS_COMMAND,
      )
      await assert.rejects(
        adapters.verifyRuntimeActivation(
          createRuntimeActivationCommand(),
        ),
        (error: unknown) =>
          expectReadinessAdapterError(
            error,
            'RUNTIME_ACTIVATION_AUTHORIZATION_HANDOFF_INVALID',
          ),
      )

      const consumed =
        consumeAiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationHandoff(
          handoff,
        )
      assert.equal(
        consumed.status,
        'CONSUMED_STOPPED',
      )
      assert.equal(
        consumed.runtimeActivationAllowed,
        false,
      )
    },
  )

  await check(
    'failed Migration attestation and out-of-order Runtime checks stop before consuming exact authorization',
    async () => {
      const migrationFailureHandoff =
        await prepareFreshHandoff()
      const migrationFailureAdapters =
        createAiChartD1PalaceWritingTrustedDeliveryProductionReadinessAdapters(
          {
            verifyControlledDeploymentMigrationAttestation:
              async () => {
                throw new Error(SENSITIVE_MARKER)
              },
            runtimeActivationAuthorizationHandoff:
              migrationFailureHandoff,
          },
        )
      await assert.rejects(
        migrationFailureAdapters.verifyMigrationReadiness(
          MIGRATION_READINESS_COMMAND,
        ),
        (error: unknown) =>
          expectReadinessAdapterError(
            error,
            'DEPLOYMENT_ATTESTATION_CHECK_FAILED',
          ),
      )
      assert.equal(
        consumeAiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationHandoff(
          migrationFailureHandoff,
        ).status,
        'CONSUMED_STOPPED',
      )

      const sequenceHandoff =
        await prepareFreshHandoff()
      const sequenceAdapters =
        createAiChartD1PalaceWritingTrustedDeliveryProductionReadinessAdapters(
          {
            verifyControlledDeploymentMigrationAttestation:
              async () =>
                createVerifiedDeploymentAttestation(),
            runtimeActivationAuthorizationHandoff:
              sequenceHandoff,
          },
        )
      await assert.rejects(
        sequenceAdapters.verifyRuntimeActivation(
          createRuntimeActivationCommand(),
        ),
        (error: unknown) =>
          expectReadinessAdapterError(
            error,
            'RUNTIME_ACTIVATION_SEQUENCE_INVALID',
          ),
      )
      assert.equal(
        consumeAiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationHandoff(
          sequenceHandoff,
        ).status,
        'CONSUMED_STOPPED',
      )
    },
  )

  await check(
    'Production rejects the readiness adapter before consuming release authorization',
    async () => {
      const handoff = await prepareFreshHandoff()
      mutableEnvironment.NODE_ENV =
        'production'
      try {
        assert.throws(
          () =>
            createAiChartD1PalaceWritingTrustedDeliveryProductionReadinessAdapters(
              {
                verifyControlledDeploymentMigrationAttestation:
                  async () =>
                    createVerifiedDeploymentAttestation(),
                runtimeActivationAuthorizationHandoff:
                  handoff,
              },
            ),
          (error: unknown) =>
            expectReadinessAdapterError(
              error,
              'PRODUCTION_READINESS_ADAPTERS_UNAVAILABLE',
            ),
        )
      } finally {
        mutableEnvironment.NODE_ENV =
          'test'
      }

      assert.equal(
        consumeAiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationHandoff(
          handoff,
        ).status,
        'CONSUMED_STOPPED',
      )
    },
  )

  await check(
    'production mode fails before authorization and leaves the same target usable after test mode is restored',
    async () => {
      let authorizationCalls = 0
      mutableEnvironment.NODE_ENV =
        'production'
      try {
        await assert.rejects(
          prepareAiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationHandoff(
            {
              activationTarget: {
                releaseCommitSha:
                  RELEASE_COMMIT_SHA,
                migrationReadinessFingerprint:
                  MIGRATION_READINESS_FINGERPRINT,
              },
              verifyReleaseScopedRuntimeActivationAuthorization:
                async (command) => {
                  authorizationCalls += 1
                  return createAuthorizedOutcome(
                    command,
                  )
                },
            },
          ),
          (error: unknown) =>
            expectAuthorizationError(
              error,
              'RUNTIME_ACTIVATION_AUTHORIZATION_HANDOFF_UNAVAILABLE',
            ),
        )
      } finally {
        mutableEnvironment.NODE_ENV = 'test'
      }
      assert.equal(authorizationCalls, 0)

      const handoff = await prepareFreshHandoff()
      assert.equal(
        handoff.releaseCommitSha,
        RELEASE_COMMIT_SHA,
      )
    },
  )

  await check(
    'formal authorization port contract declares one exact release-scoped seam without implementing or invoking it',
    () => {
      const contract =
        AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_PORT_CONTRACT

      assert.deepEqual(contract, {
        contractVersion:
          'ai-chart-d1-palace-writing-trusted-delivery-runtime-activation-authorization-port-contract/v1',
        task:
          'D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_PORT_CONTRACT',
        dataClassification:
          'RUNTIME_ACTIVATION_AUTHORIZATION_PORT_METADATA',
        port:
          'VERIFY_EXPLICIT_RELEASE_SCOPED_RUNTIME_ACTIVATION_AUTHORIZATION',
        portInterface:
          'ONE_EXACT_COMMAND_ONE_SAFE_DECISION',
        commandContractVersion:
          'ai-chart-d1-palace-writing-trusted-delivery-runtime-activation-authorization-port-command/v1',
        commandTask:
          'D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_PORT_COMMAND',
        outcomeContractVersion:
          'ai-chart-d1-palace-writing-trusted-delivery-runtime-activation-authorization-port-outcome/v1',
        outcomeTask:
          'D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_PORT_OUTCOME',
        authorizationScope:
          'ACTIVATE_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_FOR_EXACT_RELEASE',
        requiredCommandFields: [
          'contractVersion',
          'task',
          'authorizationScope',
          'feature',
          'releaseCommitSha',
          'migrationVersion',
          'migrationSha256',
          'migrationReadinessFingerprint',
          'runtimeActivationPolicyVersion',
        ],
        allowedOutcomeFields: [
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
        ],
        authorizationStatusValues: [
          'AUTHORIZED',
          'DENIED',
        ],
        authorizationSource:
          'CONTROLLED_PRODUCTION_RELEASE_AUTHORIZATION_NOT_SELECTED',
        commandOwnership:
          'MODULE_OWNED_EXACT_RELEASE_BINDING_ONLY',
        authorizerIdentityHandling:
          'VERIFY_INTERNALLY_DO_NOT_RETURN',
        authorizationProofHandling:
          'VERIFY_INTERNALLY_DO_NOT_RETURN',
        callerBooleanAllowed: false,
        environmentOverrideAllowed: false,
        reusableAuthorizationTokenAllowed: false,
        providerMetadataAllowed: false,
        freeTextOutputAllowed: false,
        automaticRetryAllowed: false,
        failureCodes:
          AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_PORT_FAILURE_CODES,
        implementationStatus:
          'PORT_DECLARED_NOT_IMPLEMENTED',
        authorizationStatus: 'NOT_EVALUATED',
        handoffStatus: 'NOT_CREATED',
        runtimeActivationAllowed: false,
        customerDeliveryAllowed: false,
        productionCallable: false,
        adapterInvocations: 0,
        environmentReads: 0,
        secretReads: 0,
        databaseConnections: 0,
        reportMutations: 0,
        openAiRequests: 0,
        nextRequiredAction:
          'SELECT_CONTROLLED_AUTHORIZATION_SOURCE_BEFORE_IMPLEMENTING_ADAPTER',
        contractFingerprint:
          contract.contractFingerprint,
      })
      assert.match(
        contract.contractFingerprint,
        /^[a-f0-9]{64}$/u,
      )
      const {
        contractFingerprint,
        ...withoutFingerprint
      } = contract
      assert.equal(
        contractFingerprint,
        createHash('sha256')
          .update(
            createAiChartD1PalaceWritingCanonicalJson(
              withoutFingerprint,
            ),
            'utf8',
          )
          .digest('hex'),
      )
      assert.equal(recursivelyFrozen(contract), true)
    },
  )

  await check(
    'formal authorization port exposes only fixed safe failures and never returns identity, proof, free text, or reusable authority',
    () => {
      assert.deepEqual(
        AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_PORT_FAILURE_CODES,
        [
          'AUTHORIZATION_SOURCE_UNAVAILABLE',
          'AUTHORIZATION_CHECK_FAILED',
          'AUTHORIZATION_RESPONSE_INVALID',
          'AUTHORIZATION_NOT_GRANTED',
          'AUTHORIZATION_BINDING_MISMATCH',
        ],
      )
      const serialized = JSON.stringify(
        AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_PORT_CONTRACT,
      )
      for (const forbiddenKey of [
        'authorizerId',
        'authorizerEmail',
        'authorizationProof',
        'providerMessage',
        'accessToken',
        'secretValue',
      ]) {
        assert.equal(
          Object.prototype.hasOwnProperty.call(
            AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_PORT_CONTRACT,
            forbiddenKey,
          ),
          false,
          forbiddenKey,
        )
      }
      assert.equal(
        serialized.includes(SENSITIVE_MARKER),
        false,
      )
    },
  )

  await check(
    'formal authorization port source is declaration-only and has no Environment, Secret, database, transport, Runtime activation, or customer-delivery implementation',
    () => {
      const source = readFileSync(
        new URL(
          './d1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationPortContracts.server.ts',
          import.meta.url,
        ),
        'utf8',
      )
      for (const forbidden of [
        'process.env',
        'getSupabaseAdmin',
        'createClient',
        '.from(',
        '.rpc(',
        'fetch(',
        'OPENAI_API_KEY',
        'SUPABASE_SERVICE_ROLE_KEY',
        'runtimeActivationAllowed: true',
        'customerDeliveryAllowed: true',
        'productionCallable: true',
      ]) {
        assert.equal(
          source.includes(forbidden),
          false,
          forbidden,
        )
      }
    },
  )

  await check(
    'GitHub Environment source contract selects one protected manual-approval source bound to the formal authorization port',
    () => {
      const contract =
        AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_GITHUB_ENVIRONMENT_SOURCE_CONTRACT

      assert.deepEqual(contract, {
        contractVersion:
          'ai-chart-d1-palace-writing-trusted-delivery-runtime-activation-github-environment-source-contract/v1',
        task:
          'D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_GITHUB_ENVIRONMENT_SOURCE_CONTRACT',
        dataClassification:
          'RUNTIME_ACTIVATION_AUTHORIZATION_SOURCE_METADATA',
        authorizationSource:
          'GITHUB_ENVIRONMENT_REQUIRED_REVIEWER_MANUAL_APPROVAL',
        repository:
          'tsaititsu/tsu-waterbottle-site',
        environmentName:
          'ai-chart-production-runtime',
        environmentProtection:
          'REQUIRED_REVIEWER_MANUAL_APPROVAL',
        preventSelfReviewRequired: true,
        administratorBypassAllowed: false,
        deploymentBranchPolicy: 'MAIN_ONLY',
        branch: 'main',
        ref: 'refs/heads/main',
        portContractVersion:
          'ai-chart-d1-palace-writing-trusted-delivery-runtime-activation-authorization-port-contract/v1',
        portContractFingerprint:
          AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_PORT_CONTRACT.contractFingerprint,
        port:
          'VERIFY_EXPLICIT_RELEASE_SCOPED_RUNTIME_ACTIVATION_AUTHORIZATION',
        authorizationScope:
          'ACTIVATE_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_FOR_EXACT_RELEASE',
        requiredBindingChecks:
          AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_GITHUB_ENVIRONMENT_SOURCE_REQUIRED_BINDING_CHECKS,
        approvalScope:
          'ONE_EXACT_RELEASE_AND_MIGRATION_READINESS_FINGERPRINT',
        approvalReusePolicy:
          'ONE_MANUAL_APPROVAL_ONE_EXACT_AUTHORIZATION_COMMAND',
        serializedMetadataAuthority:
          'NONE_DECLARATION_ONLY',
        manualApprovalRequired: true,
        automaticApprovalAllowed: false,
        callerDeclaredApprovalAllowed: false,
        environmentVariableApprovalAllowed: false,
        unprotectedBranchAllowed: false,
        crossReleaseReuseAllowed: false,
        crossMigrationReadinessReuseAllowed: false,
        providerIdentityOutputAllowed: false,
        providerProofOutputAllowed: false,
        providerMessageOutputAllowed: false,
        environmentSecretRequiredByContract: false,
        environmentMutationAllowed: false,
        sourceSelectionStatus:
          'GITHUB_ENVIRONMENT_SOURCE_SELECTED',
        portAdapterStatus: 'NOT_IMPLEMENTED',
        workflowImplementationStatus:
          'NOT_IMPLEMENTED',
        approvalAttestationTransportStatus:
          'NOT_IMPLEMENTED',
        durableRuntimeActivationStatus:
          'NOT_IMPLEMENTED',
        authorizationStatus:
          'SOURCE_SELECTED_NOT_VERIFIED',
        runtimeActivationAllowed: false,
        customerDeliveryAllowed: false,
        productionCallable: false,
        adapterInvocations: 0,
        githubApiCalls: 0,
        environmentReads: 0,
        secretReads: 0,
        databaseConnections: 0,
        reportMutations: 0,
        openAiRequests: 0,
        nextRequiredAction:
          'USE_GITHUB_OIDC_ATTESTATION_TRANSPORT_CONTRACT_BEFORE_IMPLEMENTING_ADAPTER',
        contractFingerprint:
          contract.contractFingerprint,
      })
      assert.deepEqual(
        contract.requiredBindingChecks,
        [
          'REPOSITORY_EXACT_MATCH',
          'PROTECTED_ENVIRONMENT_EXACT_MATCH',
          'MAIN_BRANCH_EXACT_MATCH',
          'MAIN_REF_EXACT_MATCH',
          'REQUIRED_REVIEWER_MANUAL_APPROVAL_PRESENT',
          'PREVENT_SELF_REVIEW_ENABLED',
          'ADMINISTRATOR_BYPASS_DISABLED',
          'DEPLOYMENT_BRANCH_POLICY_MAIN_ONLY',
          'RELEASE_COMMIT_SHA_EXACT_MATCH',
          'MIGRATION_IDENTITY_EXACT_MATCH',
          'MIGRATION_READINESS_FINGERPRINT_EXACT_MATCH',
          'RUNTIME_ACTIVATION_POLICY_VERSION_EXACT_MATCH',
          'AUTHORIZATION_PORT_CONTRACT_FINGERPRINT_EXACT_MATCH',
        ],
      )
      assert.match(
        contract.contractFingerprint,
        /^[a-f0-9]{64}$/u,
      )
      const {
        contractFingerprint,
        ...withoutFingerprint
      } = contract
      assert.equal(
        contractFingerprint,
        createHash('sha256')
          .update(
            createAiChartD1PalaceWritingCanonicalJson(
              withoutFingerprint,
            ),
            'utf8',
          )
          .digest('hex'),
      )
      assert.equal(recursivelyFrozen(contract), true)
    },
  )

  await check(
    'GitHub Environment source declaration cannot itself grant authority or expose reviewer, approval proof, provider payload, or Secret data',
    () => {
      const contract =
        AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_GITHUB_ENVIRONMENT_SOURCE_CONTRACT
      const serialized = JSON.stringify(contract)

      assert.equal(
        contract.serializedMetadataAuthority,
        'NONE_DECLARATION_ONLY',
      )
      assert.equal(
        contract.authorizationStatus,
        'SOURCE_SELECTED_NOT_VERIFIED',
      )
      assert.equal(
        contract.preventSelfReviewRequired,
        true,
      )
      assert.equal(
        contract.administratorBypassAllowed,
        false,
      )
      assert.equal(
        contract.deploymentBranchPolicy,
        'MAIN_ONLY',
      )
      for (const forbiddenKey of [
        'reviewerId',
        'reviewerLogin',
        'reviewerEmail',
        'approvalProof',
        'approvalToken',
        'workflowRunId',
        'deploymentId',
        'providerPayload',
        'providerMessage',
        'secretName',
        'secretValue',
      ]) {
        assert.equal(
          Object.prototype.hasOwnProperty.call(
            contract,
            forbiddenKey,
          ),
          false,
          forbiddenKey,
        )
      }
      assert.equal(
        serialized.includes(SENSITIVE_MARKER),
        false,
      )
    },
  )

  await check(
    'GitHub Environment source module is selection-only and performs no GitHub, Environment, Secret, database, Runtime, customer-delivery, or OpenAI action',
    () => {
      const source = readFileSync(
        new URL(
          './d1PalaceWritingTrustedDeliveryRuntimeActivationGitHubEnvironmentSourceContracts.server.ts',
          import.meta.url,
        ),
        'utf8',
      )
      for (const forbidden of [
        'process.env',
        'getSupabaseAdmin',
        'createClient',
        '.from(',
        '.rpc(',
        'fetch(',
        'api.github.com',
        'gh api',
        'OPENAI_API_KEY',
        'SUPABASE_SERVICE_ROLE_KEY',
        'runtimeActivationAllowed: true',
        'customerDeliveryAllowed: true',
        'productionCallable: true',
      ]) {
        assert.equal(
          source.includes(forbidden),
          false,
          forbidden,
        )
      }
    },
  )

  await check(
    'GitHub OIDC transport contract carries one exact authorization command through a short-lived signed identity without a shared Secret',
    () => {
      const contract =
        AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_GITHUB_OIDC_ATTESTATION_TRANSPORT_CONTRACT

      assert.deepEqual(contract, {
        contractVersion:
          'ai-chart-d1-palace-writing-trusted-delivery-runtime-activation-github-oidc-attestation-transport-contract/v1',
        task:
          'D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_GITHUB_OIDC_ATTESTATION_TRANSPORT_CONTRACT',
        dataClassification:
          'RUNTIME_ACTIVATION_AUTHORIZATION_TRANSPORT_METADATA',
        sourceContractVersion:
          'ai-chart-d1-palace-writing-trusted-delivery-runtime-activation-github-environment-source-contract/v1',
        sourceContractFingerprint:
          AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_GITHUB_ENVIRONMENT_SOURCE_CONTRACT.contractFingerprint,
        authorizationPortContractVersion:
          'ai-chart-d1-palace-writing-trusted-delivery-runtime-activation-authorization-port-contract/v1',
        authorizationPortContractFingerprint:
          AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_PORT_CONTRACT.contractFingerprint,
        transport:
          'GITHUB_ACTIONS_OIDC_AUTHENTICATED_SERVER_POST',
        trustModel:
          'SHORT_LIVED_SIGNED_IDENTITY_PLUS_EXACT_COMMAND_AND_ATOMIC_REPLAY_GUARD',
        issuer:
          'https://token.actions.githubusercontent.com',
        audience:
          'urn:tsu-waterbottle-site:ai-chart-runtime-activation',
        tokenPlacement:
          'AUTHORIZATION_BEARER_HEADER_ONLY',
        manualApprovalEvidence:
          'JOB_STARTED_ONLY_AFTER_PROTECTED_ENVIRONMENT_APPROVAL',
        subjectPolicy:
          'VERIFY_ENVIRONMENT_CONTEXT_WITHOUT_ASSUMING_NAME_ONLY_SUB_FORMAT',
        requiredTokenClaims:
          AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_GITHUB_OIDC_ATTESTATION_TRANSPORT_REQUIRED_TOKEN_CLAIMS,
        requiredAttestationEnvelopeFields:
          AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_GITHUB_OIDC_ATTESTATION_TRANSPORT_REQUIRED_ENVELOPE_FIELDS,
        requiredVerificationChecks:
          AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_GITHUB_OIDC_ATTESTATION_TRANSPORT_REQUIRED_VERIFICATION_CHECKS,
        replayKeyInputs: [
          'jti',
          'repository_id',
          'run_id',
          'run_attempt',
          'sha',
          'authorizationCommandFingerprint',
        ],
        replayProtection:
          'ATOMIC_DURABLE_EXACT_ONCE_REQUIRED',
        tokenLifetimePolicy:
          'VERIFY_EXP_IAT_NBF_DO_NOT_EXTEND',
        sourceContractAuthority:
          'SOURCE_METADATA_NOT_AUTHORITY',
        rawTokenPersistenceAllowed: false,
        rawTokenLoggingAllowed: false,
        providerClaimsOutputAllowed: false,
        authorizerIdentityOutputAllowed: false,
        approvalProofOutputAllowed: false,
        providerMessageOutputAllowed: false,
        longLivedSharedSecretRequired: false,
        environmentSecretRequiredByContract: false,
        requestBodyFreeTextAllowed: false,
        networkRetryAllowed: false,
        automaticRetryAllowed: false,
        transportStatus:
          'CONTRACT_DECLARED_NOT_IMPLEMENTED',
        httpEndpointStatus: 'NOT_IMPLEMENTED',
        oidcVerifierStatus: 'NOT_IMPLEMENTED',
        replayStoreStatus: 'NOT_IMPLEMENTED',
        authorizationPortAdapterStatus:
          'NOT_IMPLEMENTED',
        durableRuntimeActivationStatus:
          'NOT_IMPLEMENTED',
        authorizationStatus:
          'TRANSPORT_DESIGNED_NOT_VERIFIED',
        runtimeActivationAllowed: false,
        customerDeliveryAllowed: false,
        productionCallable: false,
        oidcTokensRequested: 0,
        oidcTokensVerified: 0,
        transportRequests: 0,
        authorizationPortInvocations: 0,
        environmentReads: 0,
        secretReads: 0,
        databaseConnections: 0,
        reportMutations: 0,
        openAiRequests: 0,
        nextRequiredAction:
          'USE_DURABLE_ATOMIC_AUTHORIZATION_RECEIPT_CONTRACT_BEFORE_IMPLEMENTING_TRANSPORT',
        contractFingerprint:
          contract.contractFingerprint,
      })
      assert.deepEqual(
        contract.requiredTokenClaims,
        [
          'iss',
          'aud',
          'sub',
          'jti',
          'iat',
          'nbf',
          'exp',
          'repository',
          'repository_id',
          'repository_owner_id',
          'ref',
          'sha',
          'environment',
          'workflow_ref',
          'workflow_sha',
          'run_id',
          'run_attempt',
          'event_name',
        ],
      )
      assert.deepEqual(
        contract.requiredAttestationEnvelopeFields,
        [
          'sourceContractVersion',
          'sourceContractFingerprint',
          'authorizationPortContractVersion',
          'authorizationPortContractFingerprint',
          'authorizationCommand',
          'authorizationCommandFingerprint',
        ],
      )
      assert.deepEqual(
        contract.requiredVerificationChecks,
        [
          'OIDC_SIGNATURE_VALID',
          'OIDC_ISSUER_EXACT_MATCH',
          'OIDC_AUDIENCE_EXACT_MATCH',
          'OIDC_TIME_WINDOW_VALID',
          'OIDC_JTI_PRESENT',
          'REPOSITORY_NAME_AND_ID_EXACT_MATCH',
          'REPOSITORY_OWNER_ID_EXACT_MATCH',
          'PROTECTED_ENVIRONMENT_EXACT_MATCH',
          'MAIN_REF_EXACT_MATCH',
          'RELEASE_COMMIT_SHA_EXACT_MATCH',
          'WORKFLOW_IDENTITY_EXACT_MATCH',
          'WORKFLOW_SOURCE_SHA_EXACT_MATCH',
          'MIGRATION_IDENTITY_EXACT_MATCH',
          'MIGRATION_READINESS_FINGERPRINT_EXACT_MATCH',
          'RUNTIME_ACTIVATION_POLICY_VERSION_EXACT_MATCH',
          'AUTHORIZATION_COMMAND_FINGERPRINT_EXACT_MATCH',
          'AUTHORIZATION_PORT_CONTRACT_FINGERPRINT_EXACT_MATCH',
          'ATTESTATION_ENVELOPE_STRICT',
          'REPLAY_KEY_DURABLE_ATOMIC_CLAIM_OR_EXACT_EXISTING',
        ],
      )
      assert.match(
        contract.contractFingerprint,
        /^[a-f0-9]{64}$/u,
      )
      const {
        contractFingerprint,
        ...withoutFingerprint
      } = contract
      assert.equal(
        contractFingerprint,
        createHash('sha256')
          .update(
            createAiChartD1PalaceWritingCanonicalJson(
              withoutFingerprint,
            ),
            'utf8',
          )
          .digest('hex'),
      )
      assert.equal(recursivelyFrozen(contract), true)
    },
  )

  await check(
    'GitHub OIDC transport declaration excludes raw token, reviewer, provider payload, free text, and reusable authority',
    () => {
      const contract =
        AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_GITHUB_OIDC_ATTESTATION_TRANSPORT_CONTRACT
      const serialized = JSON.stringify(contract)

      for (const forbiddenKey of [
        'rawToken',
        'idToken',
        'reviewerId',
        'reviewerLogin',
        'reviewerEmail',
        'approvalProof',
        'providerClaims',
        'providerPayload',
        'providerMessage',
        'secretName',
        'secretValue',
        'authorizationHeader',
      ]) {
        assert.equal(
          Object.prototype.hasOwnProperty.call(
            contract,
            forbiddenKey,
          ),
          false,
          forbiddenKey,
        )
      }
      assert.equal(
        serialized.includes(SENSITIVE_MARKER),
        false,
      )
      assert.equal(
        contract.longLivedSharedSecretRequired,
        false,
      )
      assert.equal(
        contract.rawTokenPersistenceAllowed,
        false,
      )
      assert.equal(
        contract.rawTokenLoggingAllowed,
        false,
      )
    },
  )

  await check(
    'GitHub OIDC transport module is declaration-only and has no token request, HTTP endpoint, GitHub API, Secret, database, Runtime, customer-delivery, or OpenAI implementation',
    () => {
      const source = readFileSync(
        new URL(
          './d1PalaceWritingTrustedDeliveryRuntimeActivationGitHubOidcAttestationTransportContracts.server.ts',
          import.meta.url,
        ),
        'utf8',
      )
      for (const forbidden of [
        'process.env',
        'getSupabaseAdmin',
        'createClient',
        '.from(',
        '.rpc(',
        'fetch(',
        'getIDToken(',
        'api.github.com',
        'ACTIONS_ID_TOKEN_REQUEST_TOKEN',
        'OPENAI_API_KEY',
        'SUPABASE_SERVICE_ROLE_KEY',
        'runtimeActivationAllowed: true',
        'customerDeliveryAllowed: true',
        'productionCallable: true',
      ]) {
        assert.equal(
          source.includes(forbidden),
          false,
          forbidden,
        )
      }
    },
  )

  await check(
    'durable authorization receipt contract defines one atomic create-or-read seam and one exact Runtime read seam',
    () => {
      const contract =
        AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_CONTRACT

      assert.deepEqual(contract, {
        contractVersion:
          'ai-chart-d1-palace-writing-trusted-delivery-runtime-activation-durable-authorization-receipt-contract/v1',
        task:
          'D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_CONTRACT',
        dataClassification:
          'RUNTIME_ACTIVATION_AUTHORIZATION_RECEIPT_METADATA',
        sourceContractVersion:
          'ai-chart-d1-palace-writing-trusted-delivery-runtime-activation-github-environment-source-contract/v1',
        sourceContractFingerprint:
          AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_GITHUB_ENVIRONMENT_SOURCE_CONTRACT.contractFingerprint,
        authorizationPortContractVersion:
          'ai-chart-d1-palace-writing-trusted-delivery-runtime-activation-authorization-port-contract/v1',
        authorizationPortContractFingerprint:
          AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_PORT_CONTRACT.contractFingerprint,
        transportContractVersion:
          'ai-chart-d1-palace-writing-trusted-delivery-runtime-activation-github-oidc-attestation-transport-contract/v1',
        transportContractFingerprint:
          AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_GITHUB_OIDC_ATTESTATION_TRANSPORT_CONTRACT.contractFingerprint,
        repository:
          'DURABLE_ATOMIC_AUTHORIZATION_RECEIPT_REPOSITORY',
        repositoryInterface:
          'CREATE_OR_READ_EXACT_AND_READ_EXACT',
        receiptShape:
          'IMMUTABLE_EXACT_RELEASE_AUTHORIZATION_RECEIPT',
        requiredCreateFields:
          AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_REQUIRED_CREATE_FIELDS,
        requiredReceiptFields:
          AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_REQUIRED_RECEIPT_FIELDS,
        uniqueKeys:
          AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_UNIQUE_KEYS,
        replayKeyDerivation:
          'SHA256_CANONICAL_VERIFIED_REPLAY_KEY_INPUTS',
        receiptFingerprintDerivation:
          'SHA256_CANONICAL_RECEIPT_WITHOUT_FINGERPRINT',
        atomicCreatePolicy:
          'ONE_TRANSACTION_INSERT_OR_VERIFY_EXACT_EXISTING',
        exactExistingPolicy:
          'RETURN_EXISTING_ONLY_WHEN_ALL_RECEIPT_FIELDS_MATCH',
        conflictPolicy:
          'ANY_KEY_OR_BINDING_CONFLICT_FAILS_CLOSED',
        uncertainOutcomePolicy:
          'READ_BOTH_UNIQUE_KEYS_AND_RECONCILE_WITHOUT_BLIND_RETRY',
        reconciliationCases:
          AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_RECONCILIATION_CASES,
        runtimeReadInterface:
          'READ_EXACT_AUTHORIZATION_RECEIPT_FOR_CURRENT_RUNTIME_TARGET',
        requiredReadFields:
          AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_REQUIRED_READ_FIELDS,
        requiredRuntimeReadChecks:
          AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_REQUIRED_RUNTIME_READ_CHECKS,
        runtimeAuthorityPolicy:
          'EXACT_DURABLE_RECEIPT_PLUS_CURRENT_RELEASE_AND_POLICY_REVALIDATION',
        currentPolicyRevalidationRequired: true,
        revocationPolicy:
          'RELEASE_OR_POLICY_DRIFT_FAILS_CLOSED_WITHOUT_MUTATING_RECEIPT',
        persistencePolicy:
          'APPEND_ONLY_DURABLE_SERVER_STORAGE_REQUIRED',
        rawReplayInputsPersistenceAllowed: false,
        rawProviderClaimsPersistenceAllowed: false,
        rawTokenPersistenceAllowed: false,
        authorizerIdentityPersistenceAllowed: false,
        approvalProofPersistenceAllowed: false,
        providerMessagePersistenceAllowed: false,
        freeTextPersistenceAllowed: false,
        receiptUpdateAllowed: false,
        receiptDeleteAllowed: false,
        automaticRetryAllowed: false,
        serializedContractAuthority:
          'NONE_DECLARATION_ONLY',
        failureCodes:
          AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_FAILURE_CODES,
        repositoryStatus:
          'CONTRACT_DECLARED_NOT_IMPLEMENTED',
        storageSchemaStatus:
          'CONTRACT_DECLARED_NOT_IMPLEMENTED',
        productionAdapterMappingStatus:
          'OFFLINE_RPC_MAPPING_VERIFIED_PRODUCTION_NOT_IMPLEMENTED',
        atomicCreateAdapterStatus: 'NOT_IMPLEMENTED',
        runtimeReadAdapterStatus: 'NOT_IMPLEMENTED',
        reconciliationAdapterStatus: 'NOT_IMPLEMENTED',
        offlineAtomicAdapterProbeStatus:
          'VERIFIED',
        offlineRpcAdapterProbeStatus:
          'VERIFIED',
        receiptStatus: 'NOT_CREATED',
        runtimeActivationStatus:
          'BLOCKED_PENDING_DURABLE_RECEIPT_ADAPTER',
        runtimeActivationAllowed: false,
        customerDeliveryAllowed: false,
        productionCallable: false,
        repositoryInvocations: 0,
        receiptWrites: 0,
        receiptReads: 0,
        databaseConnections: 0,
        environmentReads: 0,
        secretReads: 0,
        reportMutations: 0,
        openAiRequests: 0,
        nextRequiredAction:
          'DESIGN_MIGRATION_AND_PRODUCTION_ADAPTER_SOURCE_WITHOUT_DATABASE_APPLICATION',
        contractFingerprint:
          contract.contractFingerprint,
      })
      assert.deepEqual(
        contract.requiredCreateFields,
        [
          'sourceContractVersion',
          'sourceContractFingerprint',
          'authorizationPortContractVersion',
          'authorizationPortContractFingerprint',
          'transportContractVersion',
          'transportContractFingerprint',
          'authorizationCommand',
          'authorizationCommandFingerprint',
          'replayKeyFingerprint',
        ],
      )
      assert.deepEqual(
        contract.requiredReceiptFields,
        [
          'contractVersion',
          'task',
          'authorizationStatus',
          'sourceContractVersion',
          'sourceContractFingerprint',
          'authorizationPortContractVersion',
          'authorizationPortContractFingerprint',
          'transportContractVersion',
          'transportContractFingerprint',
          'authorizationCommand',
          'authorizationCommandFingerprint',
          'replayKeyFingerprint',
          'receiptFingerprint',
        ],
      )
      assert.deepEqual(
        contract.uniqueKeys,
        [
          'REPLAY_KEY_FINGERPRINT_UNIQUE',
          'AUTHORIZATION_COMMAND_FINGERPRINT_UNIQUE',
        ],
      )
      assert.deepEqual(
        contract.reconciliationCases,
        [
          'BOTH_KEYS_ABSENT_CREATE_EXACT_RECEIPT',
          'BOTH_KEYS_RESOLVE_ONE_EXACT_RECEIPT_RETURN_EXISTING',
          'ONE_KEY_ONLY_PRESENT_FAIL_CLOSED',
          'KEYS_RESOLVE_DIFFERENT_RECEIPTS_FAIL_CLOSED',
          'EXISTING_RECEIPT_BINDING_DRIFT_FAIL_CLOSED',
          'WRITE_OUTCOME_UNKNOWN_READ_BOTH_KEYS_NO_BLIND_RETRY',
        ],
      )
      assert.deepEqual(
        contract.requiredReadFields,
        [
          'authorizationCommand',
          'authorizationCommandFingerprint',
          'sourceContractFingerprint',
          'authorizationPortContractFingerprint',
          'transportContractFingerprint',
        ],
      )
      assert.deepEqual(
        contract.requiredRuntimeReadChecks,
        [
          'RECEIPT_SHAPE_EXACT',
          'RECEIPT_FINGERPRINT_VALID',
          'AUTHORIZATION_STATUS_AUTHORIZED',
          'AUTHORIZATION_SCOPE_EXACT_MATCH',
          'FEATURE_EXACT_MATCH',
          'RELEASE_COMMIT_SHA_EXACT_MATCH',
          'MIGRATION_IDENTITY_EXACT_MATCH',
          'MIGRATION_READINESS_FINGERPRINT_EXACT_MATCH',
          'RUNTIME_ACTIVATION_POLICY_VERSION_EXACT_MATCH',
          'SOURCE_CONTRACT_FINGERPRINT_EXACT_MATCH',
          'AUTHORIZATION_PORT_CONTRACT_FINGERPRINT_EXACT_MATCH',
          'TRANSPORT_CONTRACT_FINGERPRINT_EXACT_MATCH',
          'AUTHORIZATION_COMMAND_FINGERPRINT_EXACT_MATCH',
          'CURRENT_RELEASE_AND_POLICY_STILL_EXACT',
        ],
      )
      assert.deepEqual(
        contract.failureCodes,
        [
          'AUTHORIZATION_RECEIPT_REPOSITORY_UNAVAILABLE',
          'AUTHORIZATION_RECEIPT_CREATE_FAILED',
          'AUTHORIZATION_RECEIPT_NOT_FOUND',
          'AUTHORIZATION_RECEIPT_INVALID',
          'AUTHORIZATION_RECEIPT_CONFLICT',
          'AUTHORIZATION_RECEIPT_BINDING_MISMATCH',
          'AUTHORIZATION_RECEIPT_RECONCILIATION_REQUIRED',
        ],
      )
      assert.match(
        contract.contractFingerprint,
        /^[a-f0-9]{64}$/u,
      )
      const {
        contractFingerprint,
        ...withoutFingerprint
      } = contract
      assert.equal(
        contractFingerprint,
        createHash('sha256')
          .update(
            createAiChartD1PalaceWritingCanonicalJson(
              withoutFingerprint,
            ),
            'utf8',
          )
          .digest('hex'),
      )
      assert.equal(recursivelyFrozen(contract), true)
    },
  )

  await check(
    'durable authorization receipt storage contract fixes one private normalized append-only table and three internal RPC operations',
    () => {
      const contract =
        AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_CONTRACT

      assert.deepEqual(
        contract.requiredColumns,
        [
          'receipt_contract_version',
          'receipt_task',
          'authorization_status',
          'source_contract_version',
          'source_contract_fingerprint',
          'authorization_port_contract_version',
          'authorization_port_contract_fingerprint',
          'transport_contract_version',
          'transport_contract_fingerprint',
          'authorization_command_contract_version',
          'authorization_command_task',
          'authorization_scope',
          'feature',
          'release_commit_sha',
          'migration_version',
          'migration_sha256',
          'migration_readiness_fingerprint',
          'runtime_activation_policy_version',
          'authorization_command_fingerprint',
          'replay_key_fingerprint',
          'receipt_fingerprint',
        ],
      )
      assert.equal(
        contract.requiredColumns,
        AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_REQUIRED_COLUMNS,
      )
      assert.deepEqual(
        contract.columnMappings.map(
          (mapping) => mapping.receiptPath,
        ),
        [
          'contractVersion',
          'task',
          'authorizationStatus',
          'sourceContractVersion',
          'sourceContractFingerprint',
          'authorizationPortContractVersion',
          'authorizationPortContractFingerprint',
          'transportContractVersion',
          'transportContractFingerprint',
          'authorizationCommand.contractVersion',
          'authorizationCommand.task',
          'authorizationCommand.authorizationScope',
          'authorizationCommand.feature',
          'authorizationCommand.releaseCommitSha',
          'authorizationCommand.migrationVersion',
          'authorizationCommand.migrationSha256',
          'authorizationCommand.migrationReadinessFingerprint',
          'authorizationCommand.runtimeActivationPolicyVersion',
          'authorizationCommandFingerprint',
          'replayKeyFingerprint',
          'receiptFingerprint',
        ],
      )
      assert.deepEqual(
        contract.columnMappings.map(
          (mapping) => mapping.storageColumn,
        ),
        contract.requiredColumns,
      )
      assert.equal(
        contract.columnMappings,
        AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_COLUMN_MAPPINGS,
      )
      assert.deepEqual(
        contract.uniqueConstraints,
        [
          {
            constraint:
              'runtime_authorization_receipts_command_fingerprint_key',
            columns: [
              'authorization_command_fingerprint',
            ],
            role: 'PRIMARY_KEY',
          },
          {
            constraint:
              'runtime_authorization_receipts_replay_fingerprint_key',
            columns: [
              'replay_key_fingerprint',
            ],
            role: 'UNIQUE',
          },
        ],
      )
      assert.equal(
        contract.uniqueConstraints,
        AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_UNIQUE_CONSTRAINTS,
      )
      assert.deepEqual(
        contract.resultCodes,
        [
          'CREATED',
          'EXISTING_EXACT',
          'RECONCILED_EXACT',
          'READ_EXACT',
        ],
      )
      assert.equal(
        contract.resultCodes,
        AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_RESULT_CODES,
      )
      assert.deepEqual(
        contract.methodMappings,
        [
          {
            repositoryMethod:
              'createOrReadExact',
            rpcSequence: [
              'CREATE_OR_READ_EXACT_ONCE',
              'RECONCILE_BOTH_KEYS_ON_UNKNOWN_WRITE_ONLY',
            ],
            maximumWriteInvocations: 1,
            maximumReadInvocations: 1,
            automaticRetryAllowed: false,
          },
          {
            repositoryMethod: 'readExact',
            rpcSequence: [
              'READ_CURRENT_RUNTIME_EXACT_ONCE',
            ],
            maximumWriteInvocations: 0,
            maximumReadInvocations: 1,
            automaticRetryAllowed: false,
          },
        ],
      )
      assert.equal(
        contract.methodMappings,
        AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_METHOD_MAPPINGS,
      )
      assert.equal(
        contract.storageNamespace,
        'ai_chart_private',
      )
      assert.equal(
        contract.tableName,
        'runtime_activation_authorization_receipts',
      )
      assert.equal(
        contract.storageEncoding,
        'NORMALIZED_NON_NULL_SCALAR_COLUMNS_NO_JSONB',
      )
      assert.equal(
        contract.atomicCreateRpc,
        'create_or_read_ai_chart_runtime_authorization_receipt',
      )
      assert.deepEqual(
        contract.atomicCreateRpcParameters,
        contract.requiredColumns.map(
          (column) => `p_${column}`,
        ),
      )
      assert.equal(
        contract.atomicCreateRpcParameters,
        AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_ATOMIC_CREATE_RPC_PARAMETERS,
      )
      assert.equal(
        contract.unknownWriteReconciliationRpc,
        'reconcile_ai_chart_runtime_authorization_receipt',
      )
      assert.deepEqual(
        contract.unknownWriteReconciliationRpcParameters,
        [
          'p_authorization_command_fingerprint',
          'p_replay_key_fingerprint',
        ],
      )
      assert.equal(
        contract.unknownWriteReconciliationRpcParameters,
        AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_RECONCILIATION_RPC_PARAMETERS,
      )
      assert.equal(
        contract.runtimeReadRpc,
        'read_ai_chart_runtime_authorization_receipt',
      )
      assert.deepEqual(
        contract.runtimeReadRpcParameters,
        [
          'p_authorization_command_fingerprint',
        ],
      )
      assert.equal(
        contract.runtimeReadRpcParameters,
        AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_RUNTIME_READ_RPC_PARAMETERS,
      )
      assert.deepEqual(
        contract.rpcResponseFields,
        [
          'result_code',
          ...contract.requiredColumns,
        ],
      )
      assert.equal(
        contract.rpcResponseFields,
        AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_RPC_RESPONSE_FIELDS,
      )
      assert.deepEqual(
        contract.requiredSecurityControls,
        [
          'PRIVATE_SCHEMA_NOT_DATA_API_EXPOSED',
          'ROW_LEVEL_SECURITY_ENABLED_AND_FORCED',
          'FUNCTION_OWNER_NON_LOGIN_ROLE',
          'SECURITY_DEFINER_RPCS_WITH_EMPTY_SEARCH_PATH',
          'FULLY_SCHEMA_QUALIFIED_RELATIONS',
          'RPC_EXECUTE_SERVICE_ROLE_ONLY',
          'NO_DIRECT_TABLE_PRIVILEGES_FOR_PUBLIC_ANON_AUTHENTICATED',
          'NO_DIRECT_TABLE_PRIVILEGES_FOR_SERVICE_ROLE',
          'APPEND_ONLY_NO_UPDATE_DELETE_RPC',
          'NO_CALLER_SELECTED_SCHEMA_TABLE_OR_RPC',
        ],
      )
      assert.equal(
        contract.requiredSecurityControls,
        AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_REQUIRED_SECURITY_CONTROLS,
      )
      assert.deepEqual(
        contract.failureMappings,
        AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_FAILURE_MAPPINGS,
      )
      assert.equal(
        contract.externalRepositoryInterface,
        'CREATE_OR_READ_EXACT_AND_READ_EXACT',
      )
      assert.equal(
        contract.internalStorageOperations,
        'ATOMIC_CREATE_CONDITIONAL_RECONCILIATION_AND_RUNTIME_READ',
      )
      assert.equal(
        contract.unknownWritePolicy,
        'ONE_READ_ONLY_BOTH_KEY_RECONCILIATION_NO_WRITE_RETRY',
      )
      assert.equal(
        contract.schemaContractStatus,
        'DECLARED_NOT_IMPLEMENTED',
      )
      assert.equal(
        contract.productionAdapterMappingStatus,
        'OFFLINE_RPC_MAPPING_VERIFIED_PRODUCTION_NOT_IMPLEMENTED',
      )
      assert.equal(
        contract.offlineRpcAdapterProbeStatus,
        'VERIFIED',
      )
      assert.equal(
        contract.migrationStatus,
        'NOT_CREATED',
      )
      assert.equal(contract.databaseConnections, 0)
      assert.equal(contract.receiptWrites, 0)
      assert.equal(contract.receiptReads, 0)
      assert.equal(
        contract.runtimeActivationAllowed,
        false,
      )
      assert.equal(
        contract.productionCallable,
        false,
      )
      assert.equal(contract.openAiRequests, 0)
      assert.equal(
        contract.nextRequiredAction,
        'DESIGN_MIGRATION_AND_PRODUCTION_ADAPTER_SOURCE_WITHOUT_DATABASE_APPLICATION',
      )
      assert.match(
        contract.contractFingerprint,
        /^[a-f0-9]{64}$/u,
      )
      const {
        contractFingerprint,
        ...withoutFingerprint
      } = contract
      assert.equal(
        contractFingerprint,
        createHash('sha256')
          .update(
            createAiChartD1PalaceWritingCanonicalJson(
              withoutFingerprint,
            ),
            'utf8',
          )
          .digest('hex'),
      )
      assert.equal(recursivelyFrozen(contract), true)
    },
  )

  await check(
    'durable authorization receipt storage contract keeps reconciliation internal and persists no JSON, provider identity, secret, or free text',
    () => {
      const contract =
        AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_CONTRACT
      const serialized = JSON.stringify(contract)

      assert.equal(
        contract.methodMappings.length,
        2,
      )
      assert.equal(
        contract.storageOperationCount,
        3,
      )
      assert.equal(
        contract.normalizedReceiptColumnCount,
        21,
      )
      assert.equal(
        contract.rawAuthorizationCommandPersistenceAllowed,
        false,
      )
      assert.equal(
        contract.jsonPersistenceAllowed,
        false,
      )
      assert.equal(
        contract.rawProviderClaimsPersistenceAllowed,
        false,
      )
      assert.equal(
        contract.rawTokenPersistenceAllowed,
        false,
      )
      assert.equal(
        contract.authorizerIdentityPersistenceAllowed,
        false,
      )
      assert.equal(
        contract.providerMessagePersistenceAllowed,
        false,
      )
      assert.equal(
        contract.freeTextPersistenceAllowed,
        false,
      )
      for (const forbidden of [
        SENSITIVE_MARKER,
        'reviewerEmail',
        'reviewerLogin',
        'authorizationHeader',
        'providerPayload',
        'secretValue',
        'synthetic provider message that must remain private',
      ]) {
        assert.equal(
          serialized.includes(forbidden),
          false,
          forbidden,
        )
      }
    },
  )

  await check(
    'durable authorization receipt declaration persists only fixed fingerprints and exact command bindings',
    () => {
      const contract =
        AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_CONTRACT
      const serialized = JSON.stringify(contract)

      for (const forbiddenKey of [
        'jti',
        'runId',
        'runAttempt',
        'rawReplayInputs',
        'rawToken',
        'idToken',
        'authorizationHeader',
        'reviewerId',
        'reviewerLogin',
        'reviewerEmail',
        'authorizerIdentity',
        'approvalProof',
        'providerClaims',
        'providerPayload',
        'providerMessage',
        'secretName',
        'secretValue',
        'freeText',
      ]) {
        assert.equal(
          Object.prototype.hasOwnProperty.call(
            contract,
            forbiddenKey,
          ),
          false,
          forbiddenKey,
        )
      }
      assert.equal(
        serialized.includes(SENSITIVE_MARKER),
        false,
      )
      assert.equal(
        contract.rawReplayInputsPersistenceAllowed,
        false,
      )
      assert.equal(
        contract.rawProviderClaimsPersistenceAllowed,
        false,
      )
      assert.equal(
        contract.receiptUpdateAllowed,
        false,
      )
      assert.equal(
        contract.receiptDeleteAllowed,
        false,
      )
    },
  )

  await check(
    'offline durable authorization receipt adapter probe creates and reads one exact frozen receipt without activating Runtime',
    async () => {
      const repository =
        createAiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptAdapterProbe()
      const commands =
        createDurableAuthorizationReceiptCommands()
      const created =
        await repository.createOrReadExact(
          commands.createCommand,
        )

      assert.equal(
        created.status,
        'CREATED_STOPPED',
      )
      assert.deepEqual(created.receipt, {
        contractVersion:
          'ai-chart-d1-palace-writing-trusted-delivery-runtime-activation-durable-authorization-receipt-contract/v1',
        task:
          'D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_CONTRACT',
        authorizationStatus: 'AUTHORIZED',
        ...commands.createCommand,
        receiptFingerprint:
          created.receipt.receiptFingerprint,
      })
      assert.match(
        created.receipt.receiptFingerprint,
        /^[a-f0-9]{64}$/u,
      )
      assert.equal(
        recursivelyFrozen(created),
        true,
      )
      assert.equal(
        created.runtimeActivationAllowed,
        false,
      )
      assert.equal(
        created.customerDeliveryAllowed,
        false,
      )
      assert.equal(
        created.productionCallable,
        false,
      )
      assert.equal(
        created.databaseConnections,
        0,
      )
      assert.equal(created.reportMutations, 0)
      assert.equal(created.openAiRequests, 0)

      const read =
        await repository.readExact(
          commands.readCommand,
        )
      assert.equal(
        read.status,
        'READ_EXACT_STOPPED',
      )
      assert.equal(
        read.receipt.receiptFingerprint,
        created.receipt.receiptFingerprint,
      )
      assert.equal(recursivelyFrozen(read), true)
      assert.equal(
        JSON.stringify(read).includes(
          SENSITIVE_MARKER,
        ),
        false,
      )
    },
  )

  await check(
    'offline durable authorization receipt adapter probe atomically creates once across concurrent callers and returns exact replay',
    async () => {
      const repository =
        createAiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptAdapterProbe()
      const commands =
        createDurableAuthorizationReceiptCommands()
      const concurrent =
        await Promise.all([
          repository.createOrReadExact(
            commands.createCommand,
          ),
          repository.createOrReadExact(
            commands.createCommand,
          ),
        ])

      assert.deepEqual(
        concurrent
          .map((result) => result.status)
          .sort(),
        [
          'CREATED_STOPPED',
          'EXISTING_EXACT_STOPPED',
        ],
      )
      assert.equal(
        concurrent[0]?.receipt
          .receiptFingerprint,
        concurrent[1]?.receipt
          .receiptFingerprint,
      )
      const replay =
        await repository.createOrReadExact(
          commands.createCommand,
        )
      assert.equal(
        replay.status,
        'EXISTING_EXACT_STOPPED',
      )
      assert.equal(
        replay.receipt.receiptFingerprint,
        concurrent[0]?.receipt
          .receiptFingerprint,
      )
      assert.equal(recursivelyFrozen(replay), true)
    },
  )

  await check(
    'offline durable authorization receipt adapter probe fails closed for either unique-key conflict, cross-key conflict, and contract binding drift',
    async () => {
      const repository =
        createAiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptAdapterProbe()
      const first =
        createDurableAuthorizationReceiptCommands({
          replayKeyFingerprint: 'b'.repeat(64),
        })
      const second =
        createDurableAuthorizationReceiptCommands({
          releaseCommitSha: 'c'.repeat(40),
          replayKeyFingerprint: 'd'.repeat(64),
        })
      await repository.createOrReadExact(
        first.createCommand,
      )

      await assert.rejects(
        repository.createOrReadExact({
          ...first.createCommand,
          replayKeyFingerprint:
            'e'.repeat(64),
        }),
        (error: unknown) =>
          expectReceiptAdapterProbeError(
            error,
            'AUTHORIZATION_RECEIPT_CONFLICT',
          ),
      )
      await assert.rejects(
        repository.createOrReadExact({
          ...second.createCommand,
          replayKeyFingerprint:
            first.createCommand
              .replayKeyFingerprint,
        }),
        (error: unknown) =>
          expectReceiptAdapterProbeError(
            error,
            'AUTHORIZATION_RECEIPT_CONFLICT',
          ),
      )

      await repository.createOrReadExact(
        second.createCommand,
      )
      await assert.rejects(
        repository.createOrReadExact({
          ...first.createCommand,
          replayKeyFingerprint:
            second.createCommand
              .replayKeyFingerprint,
        }),
        (error: unknown) =>
          expectReceiptAdapterProbeError(
            error,
            'AUTHORIZATION_RECEIPT_CONFLICT',
          ),
      )

      const sourceDrift =
        createDurableAuthorizationReceiptCommands({
          sourceContractFingerprint:
            'f'.repeat(64),
        })
      await assert.rejects(
        repository.createOrReadExact(
          sourceDrift.createCommand,
        ),
        (error: unknown) =>
          expectReceiptAdapterProbeError(
            error,
            'AUTHORIZATION_RECEIPT_BINDING_MISMATCH',
          ),
      )
    },
  )

  await check(
    'offline durable authorization receipt adapter probe reports unknown committed write for explicit read reconciliation without blind retry',
    async () => {
      const repository =
        createAiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptAdapterProbe(
          {
            simulateUnknownWriteAfterCommitOnce:
              true,
          },
        )
      const commands =
        createDurableAuthorizationReceiptCommands()

      await assert.rejects(
        repository.createOrReadExact(
          commands.createCommand,
        ),
        (error: unknown) =>
          expectReceiptAdapterProbeError(
            error,
            'AUTHORIZATION_RECEIPT_RECONCILIATION_REQUIRED',
          ),
      )
      const reconciled =
        await repository.readExact(
          commands.readCommand,
        )
      assert.equal(
        reconciled.status,
        'READ_EXACT_STOPPED',
      )
      assert.equal(
        reconciled.receipt
          .authorizationCommandFingerprint,
        commands.createCommand
          .authorizationCommandFingerprint,
      )
      assert.equal(
        reconciled.runtimeActivationAllowed,
        false,
      )
    },
  )

  await check(
    'offline durable authorization receipt Runtime read fails closed for missing current release and current contract drift',
    async () => {
      const repository =
        createAiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptAdapterProbe()
      const current =
        createDurableAuthorizationReceiptCommands()
      await repository.createOrReadExact(
        current.createCommand,
      )

      const nextRelease =
        createDurableAuthorizationReceiptCommands({
          releaseCommitSha: 'c'.repeat(40),
        })
      await assert.rejects(
        repository.readExact(
          nextRelease.readCommand,
        ),
        (error: unknown) =>
          expectReceiptAdapterProbeError(
            error,
            'AUTHORIZATION_RECEIPT_NOT_FOUND',
          ),
      )
      await assert.rejects(
        repository.readExact({
          ...current.readCommand,
          transportContractFingerprint:
            'd'.repeat(64),
        }),
        (error: unknown) =>
          expectReceiptAdapterProbeError(
            error,
            'AUTHORIZATION_RECEIPT_BINDING_MISMATCH',
          ),
      )
    },
  )

  await check(
    'offline durable authorization receipt adapter probe rejects caller expansion without invoking accessors and remains test-only with no external effects',
    async () => {
      const repository =
        createAiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptAdapterProbe()
      const commands =
        createDurableAuthorizationReceiptCommands()
      let accessorReads = 0
      const expanded = Object.defineProperty(
        {
          ...commands.createCommand,
        },
        'providerPayload',
        {
          enumerable: true,
          get() {
            accessorReads += 1
            return SENSITIVE_MARKER
          },
        },
      )

      await assert.rejects(
        repository.createOrReadExact(
          expanded as typeof commands.createCommand,
        ),
        (error: unknown) =>
          expectReceiptAdapterProbeError(
            error,
            'AUTHORIZATION_RECEIPT_INVALID',
          ),
      )
      assert.equal(accessorReads, 0)

      mutableEnvironment.NODE_ENV =
        'production'
      try {
        assert.throws(
          () =>
            createAiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptAdapterProbe(),
          (error: unknown) =>
            expectReceiptAdapterProbeError(
              error,
              'AUTHORIZATION_RECEIPT_REPOSITORY_UNAVAILABLE',
            ),
        )
      } finally {
        mutableEnvironment.NODE_ENV = 'test'
      }

      const source = readFileSync(
        new URL(
          './d1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptAdapterProbe.server.ts',
          import.meta.url,
        ),
        'utf8',
      )
      for (const forbidden of [
        'getSupabaseAdmin',
        'createClient',
        '.from(',
        '.rpc(',
        'fetch(',
        'api.github.com',
        'OPENAI_API_KEY',
        'SUPABASE_SERVICE_ROLE_KEY',
        'process.env.AI_',
        'runtimeActivationAllowed: true',
        'customerDeliveryAllowed: true',
        'productionCallable: true',
      ]) {
        assert.equal(
          source.includes(forbidden),
          false,
          forbidden,
        )
      }
    },
  )

  await check(
    'durable authorization receipt module is declaration-only and has no storage, transport, Runtime, customer-delivery, or OpenAI implementation',
    () => {
      const source = readFileSync(
        new URL(
          './d1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptContracts.server.ts',
          import.meta.url,
        ),
        'utf8',
      )
      for (const forbidden of [
        'process.env',
        'getSupabaseAdmin',
        'createClient',
        '.from(',
        '.rpc(',
        'fetch(',
        'api.github.com',
        'ACTIONS_ID_TOKEN_REQUEST_TOKEN',
        'OPENAI_API_KEY',
        'SUPABASE_SERVICE_ROLE_KEY',
        'runtimeActivationAllowed: true',
        'customerDeliveryAllowed: true',
        'productionCallable: true',
      ]) {
        assert.equal(
          source.includes(forbidden),
          false,
          forbidden,
        )
      }
    },
  )

  await check(
    'durable authorization receipt storage module is declaration-only and contains no SQL, database client, environment, Runtime, or OpenAI implementation',
    () => {
      const source = readFileSync(
        new URL(
          './d1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptStorageContracts.server.ts',
          import.meta.url,
        ),
        'utf8',
      )
      for (const forbidden of [
        'process.env',
        'getSupabaseAdmin',
        'createClient',
        '.from(',
        '.rpc(',
        'fetch(',
        'create table',
        'create or replace function',
        'alter table',
        'grant ',
        'revoke ',
        'api.github.com',
        'ACTIONS_ID_TOKEN_REQUEST_TOKEN',
        'OPENAI_API_KEY',
        'SUPABASE_SERVICE_ROLE_KEY',
        'runtimeActivationAllowed: true',
        'customerDeliveryAllowed: true',
        'productionCallable: true',
      ]) {
        assert.equal(
          source.toLowerCase().includes(
            forbidden.toLowerCase(),
          ),
          false,
          forbidden,
        )
      }
    },
  )

  await check(
    'server-only handoff source has no database, transport, secret, environment override, activation, or customer-delivery path',
    () => {
      const source = readFileSync(
        new URL(
          './d1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationHandoff.server.ts',
          import.meta.url,
        ),
        'utf8',
      )
      for (const forbidden of [
        'getSupabaseAdmin',
        'createClient',
        '.from(',
        '.rpc(',
        'fetch(',
        'OPENAI_API_KEY',
        'SUPABASE_SERVICE_ROLE_KEY',
        'process.env.AI_',
        'runtimeActivationAllowed: true',
        'customerDeliveryAllowed: true',
        'productionCallable: true',
      ]) {
        assert.equal(
          source.includes(forbidden),
          false,
          forbidden,
        )
      }
    },
  )

  console.log(
    `AI Chart D1 trusted-delivery Runtime activation authorization handoff checks passed: ${checks}`,
  )
}

mutableEnvironment.NODE_ENV = 'test'
void run()
  .catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => {
    if (previousNodeEnv === undefined) {
      delete mutableEnvironment.NODE_ENV
      return
    }
    mutableEnvironment.NODE_ENV =
      previousNodeEnv
  })
