import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import Module, { createRequire } from 'node:module'

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

let rpcPortModule:
  typeof import(
    './d1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptSupabaseRpcPort.server'
  )
let storageContractModule:
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
  rpcPortModule = testRequire(
    './d1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptSupabaseRpcPort.server',
  ) as typeof import(
    './d1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptSupabaseRpcPort.server'
  )
  storageContractModule = testRequire(
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
  createAiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptSupabaseRpcPort,
} = rpcPortModule
const {
  AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_DURABLE_AUTHORIZATION_RECEIPT_STORAGE_CONTRACT:
    storageContract,
} = storageContractModule

let checks = 0

async function check(
  name: string,
  run: () => void | Promise<void>,
) {
  await run()
  checks += 1
  console.log(`✓ ${name}`)
}

function parametersFor(
  name:
    | typeof storageContract.atomicCreateRpc
    | typeof storageContract.unknownWriteReconciliationRpc
    | typeof storageContract.runtimeReadRpc,
): Readonly<Record<string, string>> {
  const fields =
    name === storageContract.atomicCreateRpc
      ? storageContract.atomicCreateRpcParameters
      : name ===
          storageContract.unknownWriteReconciliationRpc
        ? storageContract.unknownWriteReconciliationRpcParameters
        : storageContract.runtimeReadRpcParameters
  return Object.freeze(
    Object.fromEntries(
      fields.map((field) => [
        field,
        field === 'p_release_commit_sha'
          ? 'a'.repeat(40)
          : field.endsWith('_fingerprint') ||
              field.endsWith('_sha256')
            ? 'b'.repeat(64)
            : 'FIXED_CONTRACT_VALUE',
      ]),
    ),
  )
}

function rowFor(
  resultCode:
    | 'CREATED'
    | 'EXISTING_EXACT'
    | 'RECONCILED_EXACT'
    | 'READ_EXACT',
): Readonly<Record<string, string>> {
  return Object.freeze(
    Object.fromEntries([
      ['result_code', resultCode],
      ...storageContract.requiredColumns.map(
        (column) => [
          column,
          column === 'release_commit_sha'
            ? 'a'.repeat(40)
            : column.endsWith('_fingerprint') ||
                column.endsWith('_sha256')
              ? 'b'.repeat(64)
              : 'FIXED_CONTRACT_VALUE',
        ],
      ),
    ]),
  )
}

function response(
  row: unknown,
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    data: Object.freeze([row]),
    error: null,
    count: null,
    status: 200,
    statusText: 'OK',
  })
}

async function run() {
  await check(
    'Supabase RPC Port forwards only the three fixed operation names and exact parameters',
    async () => {
      const calls: Array<
        Readonly<{
          name: string
          parameters: unknown
        }>
      > = []
      const port =
        createAiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptSupabaseRpcPort(
          {
            rpc: async (
              name,
              parameters,
            ) => {
              calls.push(
                Object.freeze({
                  name,
                  parameters,
                }),
              )
              const resultCode =
                name ===
                storageContract.atomicCreateRpc
                  ? 'CREATED'
                  : name ===
                      storageContract.unknownWriteReconciliationRpc
                    ? 'RECONCILED_EXACT'
                    : 'READ_EXACT'
              return response(
                rowFor(resultCode),
              )
            },
          },
        )

      for (const name of [
        storageContract.atomicCreateRpc,
        storageContract.unknownWriteReconciliationRpc,
        storageContract.runtimeReadRpc,
      ] as const) {
        const parameters = parametersFor(name)
        const outcome = await port(
          name,
          parameters,
        )
        assert.equal(outcome.status, 'SUCCESS')
      }

      assert.deepEqual(
        calls.map((call) => call.name),
        [
          storageContract.atomicCreateRpc,
          storageContract.unknownWriteReconciliationRpc,
          storageContract.runtimeReadRpc,
        ],
      )
      assert.deepEqual(
        calls.map((call) =>
          Object.keys(
            call.parameters as Record<
              string,
              unknown
            >,
          ),
        ),
        [
          [
            ...storageContract.atomicCreateRpcParameters,
          ],
          [
            ...storageContract.unknownWriteReconciliationRpcParameters,
          ],
          [
            ...storageContract.runtimeReadRpcParameters,
          ],
        ],
      )
    },
  )

  await check(
    'atomic transport uncertainty is preserved while read transport failure is fail-closed',
    async () => {
      const port =
        createAiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptSupabaseRpcPort(
          {
            rpc: async () => {
              throw new Error(
                'SENSITIVE_PROVIDER_MESSAGE',
              )
            },
          },
        )

      assert.deepEqual(
        await port(
          storageContract.atomicCreateRpc,
          parametersFor(
            storageContract.atomicCreateRpc,
          ),
        ),
        Object.freeze({
          status: 'UNKNOWN_WRITE_OUTCOME',
        }),
      )
      assert.deepEqual(
        await port(
          storageContract.runtimeReadRpc,
          parametersFor(
            storageContract.runtimeReadRpc,
          ),
        ),
        Object.freeze({
          status: 'FAILURE',
          condition: 'SCHEMA_OR_RPC_UNAVAILABLE',
        }),
      )
    },
  )

  await check(
    'fixed database failures map to fixed storage conditions without provider details',
    async () => {
      const cases = [
        [
          storageContract.atomicCreateRpc,
          'ai_chart_runtime_authorization_receipt_invalid_input',
          'ATOMIC_CREATE_EXPLICIT_FAILURE',
        ],
        [
          storageContract.atomicCreateRpc,
          'ai_chart_runtime_authorization_receipt_conflict',
          'UNIQUE_KEYS_PARTIAL_DIVERGED_OR_BINDINGS_CONFLICT',
        ],
        [
          storageContract.unknownWriteReconciliationRpc,
          'ai_chart_runtime_authorization_receipt_reconciliation_required',
          'UNKNOWN_WRITE_NOT_RESOLVED_BY_ONE_BOTH_KEY_READ',
        ],
        [
          storageContract.runtimeReadRpc,
          'ai_chart_runtime_authorization_receipt_not_found',
          'RUNTIME_EXACT_RECEIPT_ABSENT',
        ],
      ] as const

      for (const [
        name,
        message,
        condition,
      ] of cases) {
        const port =
          createAiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptSupabaseRpcPort(
            {
              rpc: async () =>
                Object.freeze({
                  data: null,
                  error: Object.freeze({
                    code: 'P0001',
                    details:
                      'SENSITIVE_PROVIDER_DETAILS',
                    hint: 'SENSITIVE_PROVIDER_HINT',
                    message,
                  }),
                  count: null,
                  status: 400,
                  statusText:
                    'SENSITIVE_PROVIDER_STATUS',
                }),
            },
          )
        const outcome = await port(
          name,
          parametersFor(name),
        )
        assert.deepEqual(
          outcome,
          Object.freeze({
            status: 'FAILURE',
            condition,
          }),
        )
        assert.doesNotMatch(
          JSON.stringify(outcome),
          /SENSITIVE_PROVIDER/u,
        )
      }
    },
  )

  await check(
    'unknown provider errors and malformed response envelopes remain sanitized',
    async () => {
      for (const providerResponse of [
        Object.freeze({
          data: null,
          error: Object.freeze({
            code: 'UNKNOWN',
            details: null,
            hint: null,
            message:
              'SENSITIVE_UNKNOWN_MESSAGE',
          }),
          count: null,
          status: 500,
          statusText: 'SENSITIVE_STATUS',
        }),
        Object.freeze({
          data: Object.freeze([]),
          error: null,
          count: null,
          status: 200,
          statusText: 'OK',
        }),
      ]) {
        const port =
          createAiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptSupabaseRpcPort(
            {
              rpc: async () =>
                providerResponse,
            },
          )
        const outcome = await port(
          storageContract.runtimeReadRpc,
          parametersFor(
            storageContract.runtimeReadRpc,
          ),
        )
        assert.equal(outcome.status, 'FAILURE')
        assert.doesNotMatch(
          JSON.stringify(outcome),
          /SENSITIVE/u,
        )
      }
    },
  )

  await check(
    'success rows are exact, deeply frozen, and cannot carry provider expansion',
    async () => {
      const port =
        createAiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptSupabaseRpcPort(
          {
            rpc: async () =>
              response(
                rowFor('READ_EXACT'),
              ),
          },
        )
      const outcome = await port(
        storageContract.runtimeReadRpc,
        parametersFor(
          storageContract.runtimeReadRpc,
        ),
      )
      assert.equal(outcome.status, 'SUCCESS')
      if (outcome.status !== 'SUCCESS') {
        assert.fail('success expected')
      }
      assert.equal(Object.isFrozen(outcome), true)
      assert.equal(
        Object.isFrozen(outcome.row),
        true,
      )

      const expandedPort =
        createAiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptSupabaseRpcPort(
          {
            rpc: async () =>
              response({
                ...rowFor('READ_EXACT'),
                provider_message:
                  'SENSITIVE_PROVIDER_MESSAGE',
              }),
          },
        )
      assert.deepEqual(
        await expandedPort(
          storageContract.runtimeReadRpc,
          parametersFor(
            storageContract.runtimeReadRpc,
          ),
        ),
        Object.freeze({
          status: 'FAILURE',
          condition:
            'RPC_ROW_SHAPE_OR_FINGERPRINT_INVALID',
        }),
      )
    },
  )

  await check(
    'caller cannot select another RPC or expand its parameter object',
    async () => {
      let invocations = 0
      const port =
        createAiChartD1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptSupabaseRpcPort(
          {
            rpc: async () => {
              invocations += 1
              return response(
                rowFor('READ_EXACT'),
              )
            },
          },
        )
      await assert.rejects(
        port(
          'caller_selected_rpc' as
            typeof storageContract.runtimeReadRpc,
          parametersFor(
            storageContract.runtimeReadRpc,
          ),
        ),
      )
      await assert.rejects(
        port(
          storageContract.runtimeReadRpc,
          {
            ...parametersFor(
              storageContract.runtimeReadRpc,
            ),
            caller_selected: 'FORBIDDEN',
          },
        ),
      )
      assert.equal(invocations, 0)
    },
  )

  await check(
    'Supabase RPC Port source has no client factory, Secret, Environment, Runtime, Report, or OpenAI binding',
    () => {
      const source = readFileSync(
        new URL(
          './d1PalaceWritingTrustedDeliveryRuntimeActivationDurableAuthorizationReceiptSupabaseRpcPort.server.ts',
          import.meta.url,
        ),
        'utf8',
      )
      for (const forbidden of [
        'getSupabaseAdmin',
        'process.env',
        'OPENAI_API_KEY',
        'SUPABASE_SERVICE_ROLE_KEY',
        'Authorization:',
        'Bearer ',
        '.from(',
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
    `AI Chart D1 durable authorization receipt Supabase RPC Port checks passed: ${checks}`,
  )
}

void run().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
