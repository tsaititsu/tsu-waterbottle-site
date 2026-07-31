import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import Module, { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { AI_CHART_D1_PALACE_IDENTITIES } from './d1N0Constants'
import { AI_CHART_D1_P1_MAX_OUTPUT_TOKENS } from './d1P1AdapterBridgeContracts'
import { AI_CHART_D1_P1_REPORT_OPENAI_RUNTIME_TIMEOUT_MS } from './d1P1PreviewTimeoutContracts'
import { completeModelInputSnapshot, getTestCatalog } from './d1P1ModelInputTestSupport'
import { buildAiChartD1ReportGenerationPlan } from './reportGenerationPipeline'
import {
  AI_CHART_OPENAI_REQUEST_FAILED,
  AiChartOpenAiError,
  type AiChartOpenAiStructuredRequest,
  type AiChartOpenAiStructuredResult,
} from './openAiResponses'
import {
  createAiChartD1P1ReportExecutionPlanFingerprint,
  type AiChartD1P1ReportExecutionLedger,
} from './d1P1ReportExecutionRuntimeContracts'

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

const moduleInternals = Module as unknown as NodeModuleInternals
const originalResolveFilename = moduleInternals._resolveFilename
const originalLoad = moduleInternals._load
const testRequire = createRequire(import.meta.url)
const serverOnlyStubPath = testRequire.resolve('./d1Assets')

let runtimeModule:
  typeof import('./d1P1ReportOpenAiRuntime.server')

try {
  moduleInternals._resolveFilename =
    function resolveFilenameForTest(
      this: unknown,
      request: string,
      parent: unknown,
      isMain: boolean,
      options?: unknown,
    ) {
      if (request === 'server-only') return serverOnlyStubPath
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
    return originalLoad.call(this, request, parent, isMain)
  }
  runtimeModule = testRequire(
    './d1P1ReportOpenAiRuntime.server',
  ) as typeof import('./d1P1ReportOpenAiRuntime.server')
} finally {
  moduleInternals._resolveFilename = originalResolveFilename
  moduleInternals._load = originalLoad
}

const {
  AI_CHART_D1_P1_REPORT_OPENAI_RUNTIME_CONFIRMATION,
  AI_CHART_D1_P1_REPORT_OPENAI_RUNTIME_INVALID,
  AiChartD1P1ReportOpenAiRuntimeError,
  createAiChartD1P1ReportOpenAiRuntimeAuthorization,
  prepareAiChartD1P1ReportOpenAiRuntimeCapsule,
  executeAiChartD1P1ReportOpenAiRuntime,
} = runtimeModule

type StructuredRequester =
  typeof import('./openAiResponses.server').requestAiChartOpenAiStructuredResponse

let checks = 0

async function check(
  name: string,
  run: () => Promise<void> | void,
): Promise<void> {
  try {
    await run()
    checks += 1
    console.log(`✓ ${name}`)
  } catch (error) {
    console.error(`✗ ${name}`)
    throw error
  }
}

function recursivelyFrozen(
  value: unknown,
  seen = new WeakSet<object>(),
): boolean {
  if (value === null || typeof value !== 'object') return true
  if (seen.has(value)) return true
  seen.add(value)
  if (!Object.isFrozen(value)) return false
  return Reflect.ownKeys(value).every((key) =>
    recursivelyFrozen(
      (value as Record<PropertyKey, unknown>)[key],
      seen,
    ),
  )
}

function createRequester(
  execute: <T>(
    request: AiChartOpenAiStructuredRequest<T>,
  ) => Promise<AiChartOpenAiStructuredResult<T>>,
): StructuredRequester {
  return async <T>(
    request: AiChartOpenAiStructuredRequest<T>,
  ) => execute(request)
}

async function createRuntimeFixture(reportId: string) {
  const chartSnapshot = completeModelInputSnapshot()
  const d1K0Catalog = await getTestCatalog()
  const reportPlan = buildAiChartD1ReportGenerationPlan({
    reportId,
    chartSnapshot,
    d1K0Catalog,
  })
  const capsule = prepareAiChartD1P1ReportOpenAiRuntimeCapsule({
    reportId,
    chartSnapshot,
    d1K0Catalog,
  })
  return { chartSnapshot, d1K0Catalog, reportPlan, capsule }
}

function assertRequesterWasNotCalled(calls: number) {
  assert.equal(calls, 0)
}

async function main() {
  await check('runtime capsule exposes only safe metadata and matches the report-generation execution plan', async () => {
    const { reportPlan, capsule } = await createRuntimeFixture(
      'report-openai-runtime-safe-metadata',
    )

    assert.equal(capsule.status, 'READY_FOR_EXPLICIT_OPENAI_AUTHORIZATION')
    assert.equal(capsule.stage, 'D1_P1_REPORT_OPENAI_PRE_REQUEST_READY')
    assert.equal(capsule.targetPalaceCount, 12)
    assert.deepEqual(
      capsule.targetPalaceIds,
      AI_CHART_D1_PALACE_IDENTITIES.map((identity) => identity.palaceId),
    )
    assert.equal(capsule.maxRequests, 12)
    assert.equal(capsule.fetchHardLimit, 12)
    assert.deepEqual(
      capsule.p1AdapterBridgeDescriptors.map(
        (descriptor) => descriptor.timeoutMs,
      ),
      Array.from(
        { length: 12 },
        () => AI_CHART_D1_P1_REPORT_OPENAI_RUNTIME_TIMEOUT_MS,
      ),
    )
    assert.equal(capsule.retryAllowed, false)
    assert.equal(capsule.fallbackAllowed, false)
    assert.equal(capsule.customerDeliveryAllowed, false)
    assert.equal(capsule.openAiCallable, false)
    assert.equal(capsule.fetchAllowed, false)
    assert.equal(capsule.safeMetadataOnly, true)
    assert.equal(
      capsule.planFingerprint,
      createAiChartD1P1ReportExecutionPlanFingerprint(
        reportPlan.p1ReportExecutionPlan,
      ),
    )
    assert.deepEqual(
      capsule.p1AdapterBridgeDescriptors,
      reportPlan.p1ReportExecutionPlan.p1AdapterBridgeDescriptors,
    )
    assert.equal(recursivelyFrozen(capsule), true)

    const serialized = JSON.stringify(capsule)
    assert.equal(serialized.includes('instructions'), false)
    assert.equal(serialized.includes('userInput'), false)
    assert.equal(serialized.includes('schema'), false)
    assert.equal(serialized.includes('parseResult'), false)
    assert.equal(serialized.includes('output_text'), false)
    assert.equal(serialized.includes('Authorization'), false)
    assert.equal(serialized.includes('apiKey'), false)
  })

  await check('authorization is exact and malformed authorization fails before any requester call', async () => {
    const { capsule } = await createRuntimeFixture(
      'report-openai-runtime-authorization',
    )
    const authorization =
      createAiChartD1P1ReportOpenAiRuntimeAuthorization({
        capsule,
        confirmation:
          AI_CHART_D1_P1_REPORT_OPENAI_RUNTIME_CONFIRMATION,
      })

    assert.equal(recursivelyFrozen(authorization), true)
    assert.equal(authorization.maxRequests, 12)
    assert.equal(authorization.fetchHardLimit, 12)
    assert.equal(authorization.retryAllowed, false)
    assert.equal(authorization.fallbackAllowed, false)
    assert.equal(authorization.customerDeliveryAllowed, false)

    let calls = 0
    const requester = createRequester(async <T>(
      request: AiChartOpenAiStructuredRequest<T>,
    ) => {
      calls += 1
      return {
        data: { schemaName: request.schemaName } as T,
        usage: null,
      }
    })

    await assert.rejects(
      () =>
        executeAiChartD1P1ReportOpenAiRuntime(
          capsule,
          {
            ...authorization,
            confirmation: 'wrong-confirmation' as never,
          },
          { requestStructuredResponse: requester },
        ),
      (error) => {
        assert.equal(
          error instanceof AiChartD1P1ReportOpenAiRuntimeError,
          true,
        )
        assert.equal(
          (error as { readonly code?: unknown }).code,
          AI_CHART_D1_P1_REPORT_OPENAI_RUNTIME_INVALID,
        )
        return true
      },
    )
    assertRequesterWasNotCalled(calls)

    await assert.rejects(
      () =>
        executeAiChartD1P1ReportOpenAiRuntime(
          { ...capsule },
          authorization,
          { requestStructuredResponse: requester },
        ),
      { message: AI_CHART_D1_P1_REPORT_OPENAI_RUNTIME_INVALID },
    )
    assertRequesterWasNotCalled(calls)
  })

  await check('authorized runtime executes exactly twelve validated requests sequentially with a fake requester', async () => {
    const { capsule } = await createRuntimeFixture(
      'report-openai-runtime-success',
    )
    const authorization =
      createAiChartD1P1ReportOpenAiRuntimeAuthorization({
        capsule,
        confirmation:
          AI_CHART_D1_P1_REPORT_OPENAI_RUNTIME_CONFIRMATION,
      })
    const requests: AiChartOpenAiStructuredRequest<unknown>[] = []
    const settlements: string[] = []
    const requester = createRequester(async <T>(
      request: AiChartOpenAiStructuredRequest<T>,
    ) => {
      requests.push(request as AiChartOpenAiStructuredRequest<unknown>)
      assert.equal(
        request.timeoutMs,
        AI_CHART_D1_P1_REPORT_OPENAI_RUNTIME_TIMEOUT_MS,
      )
      assert.equal(request.maxOutputTokens, AI_CHART_D1_P1_MAX_OUTPUT_TOKENS)
      assert.equal(request.reasoningEffort, 'medium')
      assert.equal(Object.isFrozen(request), true)
      assert.equal(recursivelyFrozen(request.schema), true)
      assert.deepEqual(
        Object.keys(request).sort(),
        [
          'description',
          'instructions',
          'maxOutputTokens',
          'parseResult',
          'reasoningEffort',
          'schema',
          'schemaName',
          'timeoutMs',
          'userInput',
        ].sort(),
      )
      assert.equal(Object.hasOwn(request, 'apiKey'), false)
      assert.equal(Object.hasOwn(request, 'authorization'), false)
      assert.equal(Object.hasOwn(request, 'model'), false)
      assert.equal(Object.hasOwn(request, 'endpoint'), false)
      return Object.freeze({
        data: Object.freeze({
          targetPalaceId:
            capsule.targetPalaceIds[requests.length - 1],
          safeSequenceNumber: requests.length,
        }) as T,
        usage: Object.freeze({
          inputTokens: 100 + requests.length,
          outputTokens: 50,
          reasoningTokens: 10,
          totalTokens: 160 + requests.length,
        }),
      })
    })

    const ledger =
      await executeAiChartD1P1ReportOpenAiRuntime(
        capsule,
        authorization,
        {
          requestStructuredResponse: requester,
          onPalaceSettled: async (settlement) => {
            settlements.push(settlement.targetPalaceId)
            assert.equal(settlement.status, 'SUCCEEDED')
          },
        },
      )

    assert.equal(requests.length, 12)
    assert.deepEqual(settlements, capsule.targetPalaceIds)
    assert.equal(ledger.status, 'SUCCEEDED')
    assert.equal(ledger.attemptedRequests, 12)
    assert.equal(ledger.executedRequests, 12)
    assert.equal(ledger.fetchCount, 12)
    assert.equal(ledger.openAiRequests, 12)
    assert.equal(ledger.retryPerformed, false)
    assert.deepEqual(
      ledger.palaceExecutions.map((entry) => entry.status),
      Array.from({ length: 12 }, () => 'SUCCEEDED'),
    )
    assert.deepEqual(
      ledger.palaceExecutions.map((entry) => entry.targetPalaceId),
      capsule.targetPalaceIds,
    )
    assert.equal(recursivelyFrozen(ledger), true)
    assert.equal(JSON.stringify(ledger).includes('safeSequenceNumber'), false)

    let secondRunCalls = 0
    await assert.rejects(
      () =>
        executeAiChartD1P1ReportOpenAiRuntime(
          capsule,
          authorization,
          {
            requestStructuredResponse: createRequester(async <T>(
              request: AiChartOpenAiStructuredRequest<T>,
            ) => {
              secondRunCalls += 1
              return { data: request as T, usage: null }
            }),
          },
        ),
      { message: AI_CHART_D1_P1_REPORT_OPENAI_RUNTIME_INVALID },
    )
    assertRequesterWasNotCalled(secondRunCalls)
  })

  await check('runtime continues after one OpenAI error and preserves only sanitized diagnostics', async () => {
    const { capsule } = await createRuntimeFixture(
      'report-openai-runtime-failure',
    )
    const authorization =
      createAiChartD1P1ReportOpenAiRuntimeAuthorization({
        capsule,
        confirmation:
          AI_CHART_D1_P1_REPORT_OPENAI_RUNTIME_CONFIRMATION,
      })
    let calls = 0
    const requester = createRequester(async <T>() => {
      calls += 1
      if (calls === 1) {
        throw new AiChartOpenAiError(
          AI_CHART_OPENAI_REQUEST_FAILED,
          true,
          undefined,
          Object.freeze({
            failureKind: 'NETWORK_ERROR',
            httpStatus: null,
            requestId: null,
            clientRequestId: 'client-request-safe-id',
            responseErrorType: null,
            responseErrorCode: null,
            responseErrorParam: null,
          }),
        )
      }
      return Object.freeze({
        data: Object.freeze({ safeSequenceNumber: calls }) as T,
        usage: null,
      })
    })

    const ledger: AiChartD1P1ReportExecutionLedger =
      await executeAiChartD1P1ReportOpenAiRuntime(
        capsule,
        authorization,
        { requestStructuredResponse: requester },
      )

    assert.equal(calls, 12)
    assert.equal(ledger.status, 'FAILED')
    assert.equal(ledger.attemptedRequests, 12)
    assert.equal(ledger.executedRequests, 11)
    assert.equal(ledger.fetchCount, 12)
    assert.equal(ledger.openAiRequests, 12)
    assert.equal(ledger.currentPalaceId, capsule.targetPalaceIds[0])
    assert.equal(
      ledger.palaceExecutions[0].errorCode,
      AI_CHART_OPENAI_REQUEST_FAILED,
    )
    assert.equal(ledger.palaceExecutions[0].retryable, true)
    assert.deepEqual(
      ledger.palaceExecutions[0].transportDiagnostic,
      {
        failureKind: 'NETWORK_ERROR',
        httpStatus: null,
        requestId: null,
        clientRequestId: 'client-request-safe-id',
        responseErrorType: null,
        responseErrorCode: null,
        responseErrorParam: null,
      },
    )
    assert.equal(
      ledger.palaceExecutions
        .slice(1)
        .every((entry) => entry.status === 'SUCCEEDED'),
      true,
    )
    const serialized = JSON.stringify(ledger)
    assert.equal(serialized.includes('instructions'), false)
    assert.equal(serialized.includes('userInput'), false)
    assert.equal(serialized.includes('schema'), false)
    assert.equal(serialized.includes('Authorization'), false)
    assert.equal(serialized.includes('apiKey'), false)
  })

  await check('runtime server module has no direct fetch, env, retry, fallback, or persistence side effects', () => {
    const runtimeSource = readFileSync(
      fileURLToPath(
        new URL(
          './d1P1ReportOpenAiRuntime.server.ts',
          import.meta.url,
        ),
      ),
      'utf8',
    )
    assert.match(runtimeSource, /server-only/u)
    assert.match(runtimeSource, /requestAiChartOpenAiStructuredResponse/u)
    assert.equal(runtimeSource.includes('OPENAI_API_KEY'), false)
    assert.equal(runtimeSource.includes('process.env'), false)
    assert.equal(/\bfetch\s*\(/u.test(runtimeSource), false)
    assert.equal(/Promise\.all/u.test(runtimeSource), false)
    assert.equal(/\bretry\s*\(/u.test(runtimeSource), false)
    assert.equal(/fallback\s*\(/u.test(runtimeSource), false)
    assert.equal(/\bwriteFile\b|\bappendFile\b|\bmkdir\b|\bunlink\b|\brm\b|\brename\b/u.test(runtimeSource), false)
  })

  console.log(
    `D1 P1 Report OpenAI runtime server checks passed: ${checks}`,
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
