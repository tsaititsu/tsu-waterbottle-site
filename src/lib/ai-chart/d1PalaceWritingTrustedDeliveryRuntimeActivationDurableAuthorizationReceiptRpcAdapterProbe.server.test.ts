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

let rpcAdapterProbeModule:
  typeof import(
    './d1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptRpcAdapterProbe.server'
  )
let storageContractModule:
  typeof import(
    './d1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptStorageContracts.server'
  )
let authorizationPortContractModule:
  typeof import(
    './d1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationPortContracts.server'
  )
let sourceContractModule:
  typeof import(
    './d1PalaceWritingTrustedDeliveryRuntimeActivationGitHubEnvironmentSourceContracts.server'
  )
let transportContractModule:
  typeof import(
    './d1PalaceWritingTrustedDeliveryRuntimeActivationGitHubOidcAttestationTransportContracts.server'
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
  rpcAdapterProbeModule = testRequire(
    './d1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptRpcAdapterProbe.server',
  ) as typeof import(
    './d1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptRpcAdapterProbe.server'
  )
  storageContractModule = testRequire(
    './d1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptStorageContracts.server',
  ) as typeof import(
    './d1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptStorageContracts.server'
  )
  authorizationPortContractModule =
    testRequire(
      './d1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationPortContracts.server',
    ) as typeof import(
      './d1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationPortContracts.server'
    )
  sourceContractModule = testRequire(
    './d1PalaceWritingTrustedDeliveryRuntimeActivationGitHubEnvironmentSourceContracts.server',
  ) as typeof import(
    './d1PalaceWritingTrustedDeliveryRuntimeActivationGitHubEnvironmentSourceContracts.server'
  )
  transportContractModule = testRequire(
    './d1PalaceWritingTrustedDeliveryRuntimeActivationGitHubOidcAttestationTransportContracts.server',
  ) as typeof import(
    './d1PalaceWritingTrustedDeliveryRuntimeActivationGitHubOidcAttestationTransportContracts.server'
  )
} finally {
  moduleInternals._resolveFilename =
    originalResolveFilename
  moduleInternals._load = originalLoad
}

const {
  AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptRpcAdapterProbeError,
  createAiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptRpcAdapterProbe,
} = rpcAdapterProbeModule
const {
  AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_CONTRACT,
} = storageContractModule
const {
  AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_PORT_CONTRACT,
} = authorizationPortContractModule
const {
  AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_GITHUB_ENVIRONMENT_SOURCE_CONTRACT,
} = sourceContractModule
const {
  AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_GITHUB_OIDC_ATTESTATION_TRANSPORT_CONTRACT,
} = transportContractModule

const RELEASE_COMMIT_SHA = 'a'.repeat(40)
const MIGRATION_VERSION = '20260728120000'
const MIGRATION_SHA256 =
  '8d310b1ef2750afbd41da00e04e0a10b6198fd2f894d07d09f11b5dfc7df3e66'
const MIGRATION_READINESS_FINGERPRINT =
  'c'.repeat(64)
const SENSITIVE_MARKER =
  'synthetic-provider-message-must-never-escape'
const mutableEnvironment =
  process.env as Record<string, string | undefined>
const previousNodeEnv = mutableEnvironment.NODE_ENV
let checks = 0

async function check(
  name: string,
  runCheck: () => void | Promise<void>,
): Promise<void> {
  await runCheck()
  checks += 1
  console.log(`✓ ${name}`)
}

function recursivelyFrozen(
  value: unknown,
  seen = new Set<object>(),
): boolean {
  if (
    value === null ||
    (typeof value !== 'object' &&
      typeof value !== 'function')
  ) {
    return true
  }
  const objectValue = value as object
  if (seen.has(objectValue)) return true
  seen.add(objectValue)
  if (!Object.isFrozen(objectValue)) return false
  return Reflect.ownKeys(objectValue).every((key) =>
    recursivelyFrozen(
      Reflect.get(objectValue, key),
      seen,
    ),
  )
}

function createCommands(
  overrides: Readonly<{
    releaseCommitSha?: string
    replayKeyFingerprint?: string
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
  const createCommand = Object.freeze({
    sourceContractVersion:
      'ai-chart-d1-palace-writing-trusted-delivery-runtime-activation-github-environment-source-contract/v1' as const,
    sourceContractFingerprint:
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_GITHUB_ENVIRONMENT_SOURCE_CONTRACT.contractFingerprint,
    authorizationPortContractVersion:
      'ai-chart-d1-palace-writing-trusted-delivery-runtime-activation-authorization-port-contract/v1' as const,
    authorizationPortContractFingerprint:
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_AUTHORIZATION_PORT_CONTRACT.contractFingerprint,
    transportContractVersion:
      'ai-chart-d1-palace-writing-trusted-delivery-runtime-activation-github-oidc-attestation-transport-contract/v1' as const,
    transportContractFingerprint:
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_GITHUB_OIDC_ATTESTATION_TRANSPORT_CONTRACT.contractFingerprint,
    authorizationCommand,
    authorizationCommandFingerprint,
    replayKeyFingerprint:
      overrides.replayKeyFingerprint ??
      'b'.repeat(64),
  })

  return Object.freeze({
    createCommand,
    readCommand: Object.freeze({
      authorizationCommand,
      authorizationCommandFingerprint,
      sourceContractFingerprint:
        createCommand.sourceContractFingerprint,
      authorizationPortContractFingerprint:
        createCommand.authorizationPortContractFingerprint,
      transportContractFingerprint:
        createCommand.transportContractFingerprint,
    }),
  })
}

function rowFromAtomicParameters(
  parameters: Readonly<Record<string, string>>,
  resultCode:
    | 'CREATED'
    | 'EXISTING_EXACT'
    | 'RECONCILED_EXACT'
    | 'READ_EXACT',
): Readonly<Record<string, string>> {
  return Object.freeze(
    Object.fromEntries([
      ['result_code', resultCode],
      ...Object.entries(parameters).map(
        ([key, value]) => [
          key.slice(2),
          value,
        ],
      ),
    ]),
  )
}

function expectProbeError(
  error: unknown,
  code:
    import(
      './d1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptRpcAdapterProbe.server'
    ).AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptRpcAdapterProbeFailureCode,
): boolean {
  assert.equal(
    error instanceof
      AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptRpcAdapterProbeError,
    true,
  )
  assert.equal(
    (
      error as InstanceType<
        typeof AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptRpcAdapterProbeError
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
    'RPC Adapter maps one create and one Runtime read through the exact fixed operations',
    async () => {
      const invocations: Array<{
        name: string
        parameters:
          Readonly<Record<string, string>>
      }> = []
      let persistedRow:
        Readonly<Record<string, string>> | null =
        null
      const repository =
        createAiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptRpcAdapterProbe(
          {
            invokeRpc: async (
              name,
              parameters,
            ) => {
              invocations.push({
                name,
                parameters,
              })
              if (
                name ===
                AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_CONTRACT.atomicCreateRpc
              ) {
                persistedRow =
                  rowFromAtomicParameters(
                    parameters,
                    'CREATED',
                  )
                return {
                  status: 'SUCCESS',
                  row: persistedRow,
                }
              }
              assert.ok(persistedRow)
              return {
                status: 'SUCCESS',
                row: {
                  ...persistedRow,
                  result_code: 'READ_EXACT',
                },
              }
            },
          },
        )
      const commands = createCommands()
      const created =
        await repository.createOrReadExact(
          commands.createCommand,
        )

      assert.equal(
        created.status,
        'CREATED_STOPPED',
      )
      assert.equal(created.rpcInvocations, 1)
      assert.equal(
        created.writeRpcInvocations,
        1,
      )
      assert.equal(created.readRpcInvocations, 0)
      assert.equal(
        invocations[0]?.name,
        AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_CONTRACT.atomicCreateRpc,
      )
      assert.deepEqual(
        Object.keys(
          invocations[0]?.parameters ?? {},
        ),
        AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_CONTRACT.atomicCreateRpcParameters,
      )
      assert.equal(
        Object.values(
          invocations[0]?.parameters ?? {},
        ).every(
          (value) =>
            typeof value === 'string',
        ),
        true,
      )
      assert.equal(
        recursivelyFrozen(
          invocations[0]?.parameters,
        ),
        true,
      )
      assert.equal(recursivelyFrozen(created), true)

      const read = await repository.readExact(
        commands.readCommand,
      )
      assert.equal(
        read.status,
        'READ_EXACT_STOPPED',
      )
      assert.equal(read.rpcInvocations, 1)
      assert.equal(read.writeRpcInvocations, 0)
      assert.equal(read.readRpcInvocations, 1)
      assert.equal(
        invocations[1]?.name,
        AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_CONTRACT.runtimeReadRpc,
      )
      assert.deepEqual(
        invocations[1]?.parameters,
        {
          p_authorization_command_fingerprint:
            commands.readCommand
              .authorizationCommandFingerprint,
        },
      )
      assert.equal(
        read.receipt.receiptFingerprint,
        created.receipt.receiptFingerprint,
      )
      assert.equal(recursivelyFrozen(read), true)
    },
  )

  await check(
    'exact existing result remains distinguishable without adding another Repository method',
    async () => {
      const repository =
        createAiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptRpcAdapterProbe(
          {
            invokeRpc: async (
              name,
              parameters,
            ) => {
              assert.equal(
                name,
                AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_CONTRACT.atomicCreateRpc,
              )
              return {
                status: 'SUCCESS',
                row: rowFromAtomicParameters(
                  parameters,
                  'EXISTING_EXACT',
                ),
              }
            },
          },
        )
      const result =
        await repository.createOrReadExact(
          createCommands().createCommand,
        )

      assert.equal(
        result.status,
        'EXISTING_EXACT_STOPPED',
      )
      assert.deepEqual(
        Object.keys(repository).sort(),
        [
          'createOrReadExact',
          'readExact',
        ],
      )
      assert.equal(recursivelyFrozen(result), true)
    },
  )

  await check(
    'unknown committed write performs one read-only both-key reconciliation and never retries create',
    async () => {
      const names: string[] = []
      let committedRow:
        Readonly<Record<string, string>> | null =
        null
      const repository =
        createAiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptRpcAdapterProbe(
          {
            invokeRpc: async (
              name,
              parameters,
            ) => {
              names.push(name)
              if (names.length === 1) {
                committedRow =
                  rowFromAtomicParameters(
                    parameters,
                    'CREATED',
                  )
                return {
                  status:
                    'UNKNOWN_WRITE_OUTCOME',
                }
              }
              assert.ok(committedRow)
              assert.deepEqual(parameters, {
                p_authorization_command_fingerprint:
                  committedRow.authorization_command_fingerprint,
                p_replay_key_fingerprint:
                  committedRow.replay_key_fingerprint,
              })
              return {
                status: 'SUCCESS',
                row: {
                  ...committedRow,
                  result_code:
                    'RECONCILED_EXACT',
                },
              }
            },
          },
        )
      const result =
        await repository.createOrReadExact(
          createCommands().createCommand,
        )

      assert.equal(
        result.status,
        'RECONCILED_EXACT_STOPPED',
      )
      assert.deepEqual(names, [
        AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_CONTRACT.atomicCreateRpc,
        AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_CONTRACT.unknownWriteReconciliationRpc,
      ])
      assert.equal(result.rpcInvocations, 2)
      assert.equal(
        result.writeRpcInvocations,
        1,
      )
      assert.equal(result.readRpcInvocations, 1)
      assert.equal(result.automaticRetryAllowed, false)
    },
  )

  await check(
    'unresolved unknown write fails after the single reconciliation read',
    async () => {
      let invocations = 0
      const repository =
        createAiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptRpcAdapterProbe(
          {
            invokeRpc: async () => {
              invocations += 1
              return {
                status:
                  'UNKNOWN_WRITE_OUTCOME',
              }
            },
          },
        )

      await assert.rejects(
        repository.createOrReadExact(
          createCommands().createCommand,
        ),
        (error: unknown) =>
          expectProbeError(
            error,
            'AUTHORIZATION_RECEIPT_RECONCILIATION_REQUIRED',
          ),
      )
      assert.equal(invocations, 2)
    },
  )

  await check(
    'fixed storage failures map to fixed Repository failures without provider text',
    async () => {
      const cases = [
        {
          condition:
            'SCHEMA_OR_RPC_UNAVAILABLE' as const,
          expected:
            'AUTHORIZATION_RECEIPT_REPOSITORY_UNAVAILABLE' as const,
        },
        {
          condition:
            'ATOMIC_CREATE_EXPLICIT_FAILURE' as const,
          expected:
            'AUTHORIZATION_RECEIPT_CREATE_FAILED' as const,
        },
        {
          condition:
            'UNIQUE_KEYS_PARTIAL_DIVERGED_OR_BINDINGS_CONFLICT' as const,
          expected:
            'AUTHORIZATION_RECEIPT_CONFLICT' as const,
        },
        {
          condition:
            'CURRENT_RELEASE_POLICY_OR_CONTRACT_BINDING_DRIFT' as const,
          expected:
            'AUTHORIZATION_RECEIPT_BINDING_MISMATCH' as const,
        },
        {
          condition:
            'RPC_ROW_SHAPE_OR_FINGERPRINT_INVALID' as const,
          expected:
            'AUTHORIZATION_RECEIPT_INVALID' as const,
        },
        {
          condition:
            'UNKNOWN_WRITE_NOT_RESOLVED_BY_ONE_BOTH_KEY_READ' as const,
          expected:
            'AUTHORIZATION_RECEIPT_RECONCILIATION_REQUIRED' as const,
        },
      ]

      for (const item of cases) {
        const repository =
          createAiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptRpcAdapterProbe(
            {
              invokeRpc: async () => ({
                status: 'FAILURE',
                condition: item.condition,
              }),
            },
          )
        await assert.rejects(
          repository.createOrReadExact(
            createCommands().createCommand,
          ),
          (error: unknown) =>
            expectProbeError(
              error,
              item.expected,
            ),
        )
      }

      const readRepository =
        createAiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptRpcAdapterProbe(
          {
            invokeRpc: async () => ({
              status: 'FAILURE',
              condition:
                'RUNTIME_EXACT_RECEIPT_ABSENT',
            }),
          },
        )
      await assert.rejects(
        readRepository.readExact(
          createCommands().readCommand,
        ),
        (error: unknown) =>
          expectProbeError(
            error,
            'AUTHORIZATION_RECEIPT_NOT_FOUND',
          ),
      )
    },
  )

  await check(
    'malformed or sensitive RPC responses fail closed and never escape arbitrary provider fields',
    async () => {
      const cases: unknown[] = [
        {
          status: 'SUCCESS',
          row: {
            result_code: 'CREATED',
            providerMessage:
              SENSITIVE_MARKER,
          },
        },
        {
          status: 'SUCCESS',
          row: {
            result_code:
              'UNREVIEWED_RESULT',
          },
        },
        {
          status: 'FAILURE',
          condition:
            'SCHEMA_OR_RPC_UNAVAILABLE',
          providerMessage:
            SENSITIVE_MARKER,
        },
      ]

      for (const outcome of cases) {
        const repository =
          createAiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptRpcAdapterProbe(
            {
              invokeRpc:
                async () => outcome,
            },
          )
        await assert.rejects(
          repository.createOrReadExact(
            createCommands().createCommand,
          ),
          (error: unknown) => {
            assert.equal(
              error instanceof
                AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptRpcAdapterProbeError,
              true,
            )
            assert.equal(
              JSON.stringify(error).includes(
                SENSITIVE_MARKER,
              ),
              false,
            )
            return true
          },
        )
      }

      const repository =
        createAiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptRpcAdapterProbe(
          {
            invokeRpc: async () => {
              throw new Error(
                SENSITIVE_MARKER,
              )
            },
          },
        )
      await assert.rejects(
        repository.createOrReadExact(
          createCommands().createCommand,
        ),
        (error: unknown) =>
          expectProbeError(
            error,
            'AUTHORIZATION_RECEIPT_REPOSITORY_UNAVAILABLE',
          ),
      )

      const fingerprintRepository =
        createAiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptRpcAdapterProbe(
          {
            invokeRpc: async (
              name,
              parameters,
            ) => {
              assert.equal(
                name,
                AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_CONTRACT.atomicCreateRpc,
              )
              return {
                status: 'SUCCESS',
                row: {
                  ...rowFromAtomicParameters(
                    parameters,
                    'CREATED',
                  ),
                  receipt_fingerprint:
                    'd'.repeat(64),
                },
              }
            },
          },
        )
      await assert.rejects(
        fingerprintRepository.createOrReadExact(
          createCommands().createCommand,
        ),
        (error: unknown) =>
          expectProbeError(
            error,
            'AUTHORIZATION_RECEIPT_INVALID',
          ),
      )
    },
  )

  await check(
    'caller expansion and Production mode fail before any injected RPC invocation',
    async () => {
      let rpcInvocations = 0
      const repository =
        createAiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptRpcAdapterProbe(
          {
            invokeRpc: async () => {
              rpcInvocations += 1
              throw new Error('unreachable')
            },
          },
        )
      let accessorReads = 0
      const expanded = Object.defineProperty(
        {
          ...createCommands().createCommand,
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
          expanded as never,
        ),
        (error: unknown) =>
          expectProbeError(
            error,
            'AUTHORIZATION_RECEIPT_INVALID',
          ),
      )
      assert.equal(accessorReads, 0)
      assert.equal(rpcInvocations, 0)

      mutableEnvironment.NODE_ENV =
        'production'
      try {
        assert.throws(
          () =>
            createAiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptRpcAdapterProbe(
              {
                invokeRpc: async () => ({
                  status: 'SUCCESS',
                  row: null,
                }),
              },
            ),
          (error: unknown) =>
            expectProbeError(
              error,
              'AUTHORIZATION_RECEIPT_REPOSITORY_UNAVAILABLE',
            ),
        )
      } finally {
        mutableEnvironment.NODE_ENV = 'test'
      }
    },
  )

  await check(
    'RPC Adapter Probe is test-only and has no database client, Environment, Secret, Runtime, or OpenAI implementation',
    () => {
      const source = readFileSync(
        new URL(
          './d1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptRpcAdapterProbe.server.ts',
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
    `AI Chart D1 durable authorization receipt RPC Adapter Probe checks passed: ${checks}`,
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
