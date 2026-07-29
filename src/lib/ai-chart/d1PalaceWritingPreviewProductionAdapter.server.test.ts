import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import Module, { createRequire } from 'node:module'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  AI_CHART_D1_PALACE_WRITING_RESULT_SCHEMA_NAME,
  createAiChartD1PalaceWritingResultSha256,
  type AiChartD1PalaceWritingResult,
} from './d1PalaceWritingResultContracts'
import {
  AI_CHART_D1_PALACE_WRITING_FIDELITY_REVIEW_SCHEMA_NAME,
  AI_CHART_D1_PALACE_WRITING_FIDELITY_REVIEW_TASK,
  AI_CHART_D1_PALACE_WRITING_FIDELITY_REVIEW_VERSION,
} from './d1PalaceWritingFidelityReviewContracts'
import {
  buildAiChartD1PalaceWritingGoldenCase,
} from './d1PalaceWritingGoldenCaseContracts'
import {
  buildAiChartD1PalaceWritingPreviewPlan,
} from './d1PalaceWritingPreviewContracts'
import {
  type AiChartOpenAiStructuredRequest,
  type AiChartOpenAiStructuredResult,
} from './openAiResponses'

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

let adapterModule:
  typeof import(
    './d1PalaceWritingPreviewProductionAdapter.server'
  )
let openAiServerModule:
  typeof import('./openAiResponses.server')

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
  adapterModule = testRequire(
    './d1PalaceWritingPreviewProductionAdapter.server',
  ) as typeof import(
    './d1PalaceWritingPreviewProductionAdapter.server'
  )
  openAiServerModule = testRequire(
    './openAiResponses.server',
  ) as typeof import('./openAiResponses.server')
} finally {
  moduleInternals._resolveFilename = originalResolveFilename
  moduleInternals._load = originalLoad
}

const {
  AiChartD1PalaceWritingPreviewProductionAdapterError,
  probeAiChartD1PalaceWritingPreviewProductionAdapter,
} = adapterModule

type StructuredRequester =
  typeof openAiServerModule.requestAiChartOpenAiStructuredResponse

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

function recursivelyFrozen(value: unknown): boolean {
  if (value === null || typeof value !== 'object') return true
  if (!Object.isFrozen(value)) return false
  return Reflect.ownKeys(value).every((key) =>
    recursivelyFrozen(
      (value as Record<PropertyKey, unknown>)[key],
    ),
  )
}

const goldenCase = buildAiChartD1PalaceWritingGoldenCase()
const previewPlan =
  buildAiChartD1PalaceWritingPreviewPlan(goldenCase)
const writingResult = goldenCase.expectedWritingResult

function createApprovedReview(
  result: AiChartD1PalaceWritingResult,
): unknown {
  return {
    contractVersion:
      AI_CHART_D1_PALACE_WRITING_FIDELITY_REVIEW_VERSION,
    task:
      AI_CHART_D1_PALACE_WRITING_FIDELITY_REVIEW_TASK,
    fidelityReviewId:
      'palace-writing-review:palace:ming:production-adapter-probe-v1',
    chartId: result.chartId,
    runId: result.runId,
    callId: result.callId,
    targetPalaceId: result.targetPalaceId,
    sourcePackageFingerprint:
      result.sourcePackageFingerprint,
    sourceWritingResultVersion: result.contractVersion,
    sourceWritingResultSha256:
      createAiChartD1PalaceWritingResultSha256(result),
    sectionReviews: result.sections.map((section) => ({
      contentCellRef: section.contentCellRef,
      decision: 'APPROVED',
      issueCodes: [],
      repairScope: 'NONE',
    })),
    fidelityReviewStatus: 'approved',
    customerDeliveryStatus: 'ready',
    rewriteStatus: 'forbidden',
  }
}

const WRITING_USAGE = Object.freeze({
  inputTokens: 120,
  outputTokens: 60,
  reasoningTokens: 10,
  totalTokens: 180,
})
const REVIEW_USAGE = Object.freeze({
  inputTokens: 80,
  outputTokens: 20,
  reasoningTokens: 5,
  totalTokens: 100,
})

function createRequester(
  execute: <T>(
    request: AiChartOpenAiStructuredRequest<T>,
  ) => Promise<AiChartOpenAiStructuredResult<T>>,
): StructuredRequester {
  return async <T>(
    request: AiChartOpenAiStructuredRequest<T>,
  ) => execute(request)
}

async function run(): Promise<void> {
await check('production adapter probe forwards the exact validated Writing and derived Fidelity requests once each', async () => {
  const requests: AiChartOpenAiStructuredRequest<unknown>[] = []
  const requester = createRequester(async <T>(
    request: AiChartOpenAiStructuredRequest<T>,
  ) => {
    requests.push(request as AiChartOpenAiStructuredRequest<unknown>)
    const data =
      requests.length === 1
        ? writingResult
        : createApprovedReview(writingResult)
    return Object.freeze({
      data: data as T,
      usage:
        requests.length === 1
          ? WRITING_USAGE
          : REVIEW_USAGE,
    })
  })

  const result =
    await probeAiChartD1PalaceWritingPreviewProductionAdapter({
      previewPlan,
      goldenCase,
      requestStructuredResponseFake: requester,
    })

  assert.equal(requests.length, 2)
  assert.deepEqual(
    requests.map((request) => request.schemaName),
    [
      AI_CHART_D1_PALACE_WRITING_RESULT_SCHEMA_NAME,
      AI_CHART_D1_PALACE_WRITING_FIDELITY_REVIEW_SCHEMA_NAME,
    ],
  )
  for (const request of requests) {
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
  }
  assert.equal(result.status, 'PROBE_SUCCEEDED')
  assert.equal(result.completedStage, 'COMPLETE')
  assert.equal(result.portInvocations, 2)
  assert.equal(result.stages[0].status, 'SIMULATED_SUCCEEDED')
  assert.equal(result.stages[1].status, 'SIMULATED_SUCCEEDED')
  assert.deepEqual(result.stages[0].usage, WRITING_USAGE)
  assert.deepEqual(result.stages[1].usage, REVIEW_USAGE)
  assert.equal(result.attemptedRequests, 0)
  assert.equal(result.executedRequests, 0)
  assert.equal(result.fetchCount, 0)
  assert.equal(result.openAiRequests, 0)
  assert.equal(result.retryPerformed, false)
  assert.equal(recursivelyFrozen(result), true)
})

await check('requester exception becomes a sanitized single-shot Writing failure', async () => {
  let calls = 0
  const result =
    await probeAiChartD1PalaceWritingPreviewProductionAdapter({
      previewPlan,
      goldenCase,
      requestStructuredResponseFake: createRequester(
        async () => {
          calls += 1
          throw new Error(
            'sensitive provider body and synthetic model output',
          )
        },
      ),
    })

  assert.equal(calls, 1)
  assert.equal(result.status, 'PROBE_FAILED')
  assert.equal(result.completedStage, 'WRITING')
  assert.equal(result.portInvocations, 1)
  assert.equal(
    result.stages[0].errorCode,
    'WRITING_REQUEST_FAILED',
  )
  assert.equal(result.stages[1].status, 'NOT_STARTED')
  assert.equal(result.retryPerformed, false)
  assert.equal(
    JSON.stringify(result).includes('sensitive provider body'),
    false,
  )
  assert.equal(
    JSON.stringify(result).includes(
      'synthetic model output',
    ),
    false,
  )
})

await check('successful server result without safe usage fails closed before output validation', async () => {
  const result =
    await probeAiChartD1PalaceWritingPreviewProductionAdapter({
      previewPlan,
      goldenCase,
      requestStructuredResponseFake: createRequester(
        async <T>() =>
          Object.freeze({
            data: {
              sensitiveOutput:
                'must not cross the adapter probe result',
            } as T,
            usage: null,
          }),
      ),
    })

  assert.equal(result.status, 'PROBE_FAILED')
  assert.equal(
    result.stages[0].errorCode,
    'WRITING_REQUEST_FAILED',
  )
  assert.equal(result.stages[0].usage, null)
  assert.equal(
    JSON.stringify(result).includes(
      'must not cross the adapter probe result',
    ),
    false,
  )
})

await check('malformed usage is rejected rather than normalized or leaked', async () => {
  const result =
    await probeAiChartD1PalaceWritingPreviewProductionAdapter({
      previewPlan,
      goldenCase,
      requestStructuredResponseFake: createRequester(
        async <T>() =>
          ({
            data: writingResult as T,
            usage: {
              inputTokens: 120,
              outputTokens: 60,
              reasoningTokens: 61,
              totalTokens: 180,
              providerMessage: 'sensitive metadata',
            },
          }) as never,
      ),
    })

  assert.equal(result.status, 'PROBE_FAILED')
  assert.equal(
    result.stages[0].errorCode,
    'WRITING_REQUEST_FAILED',
  )
  assert.equal(result.stages[0].usage, null)
  assert.equal(
    JSON.stringify(result).includes('sensitive metadata'),
    false,
  )
})

await check('the real OpenAI server requester is rejected before it can read configuration or fetch', async () => {
  await assert.rejects(
    probeAiChartD1PalaceWritingPreviewProductionAdapter({
      previewPlan,
      goldenCase,
      requestStructuredResponseFake:
        openAiServerModule.requestAiChartOpenAiStructuredResponse,
    }),
    AiChartD1PalaceWritingPreviewProductionAdapterError,
  )
})

await check('adapter probe fails before fake invocation outside the canonical test environment', async () => {
  let calls = 0
  const mutableEnvironment = process.env as Record<
    string,
    string | undefined
  >
  const originalNodeEnvironment = mutableEnvironment.NODE_ENV
  try {
    mutableEnvironment.NODE_ENV = 'production'
    await assert.rejects(
      probeAiChartD1PalaceWritingPreviewProductionAdapter({
        previewPlan,
        goldenCase,
        requestStructuredResponseFake: createRequester(
          async <T>() => {
            calls += 1
            return Object.freeze({
              data: writingResult as T,
              usage: WRITING_USAGE,
            })
          },
        ),
      }),
      AiChartD1PalaceWritingPreviewProductionAdapterError,
    )
  } finally {
    if (originalNodeEnvironment === undefined) {
      delete mutableEnvironment.NODE_ENV
    } else {
      mutableEnvironment.NODE_ENV = originalNodeEnvironment
    }
  }
  assert.equal(calls, 0)
})

await check('invalid probe input fails before fake invocation', async () => {
  let calls = 0
  await assert.rejects(
    probeAiChartD1PalaceWritingPreviewProductionAdapter({
      previewPlan,
      goldenCase: {
        ...goldenCase,
        caseFingerprint: 'forged',
      },
      requestStructuredResponseFake: createRequester(
        async <T>() => {
          calls += 1
          return Object.freeze({
            data: writingResult as T,
            usage: WRITING_USAGE,
          })
        },
      ),
    }),
    AiChartD1PalaceWritingPreviewProductionAdapterError,
  )
  assert.equal(calls, 0)
})

await check('adapter probe has one typed server-adapter seam and no secret, transport, persistence, or consumer beyond the offline runtime binding', () => {
  const source = readFileSync(
    fileURLToPath(
      new URL(
        './d1PalaceWritingPreviewProductionAdapter.server.ts',
        import.meta.url,
      ),
    ),
    'utf8',
  )
  assert.match(
    source,
    /requestStructuredResponseFake:\s*typeof requestAiChartOpenAiStructuredResponse/u,
  )
  assert.match(
    source,
    /input\.requestStructuredResponseFake<unknown>\(\s*command\.request,\s*\)/u,
  )
  assert.doesNotMatch(
    source,
    /fetch\s*\(|OPENAI_API_KEY|Authorization\s*:|Bearer\s|process\.env\[[^\]]+\]|consumeAiChartD1PalaceWritingPreviewRuntimeHandoff|Promise\.all|retry\s*\(|fallback|writeFile|appendFile|unlink\s*\(|\brm\s*\(|rename\s*\(/u,
  )
  assert.match(
    source,
    /process\.env\.NODE_ENV !== 'test'/u,
  )

  const sourceRoot = fileURLToPath(
    new URL('../../', import.meta.url),
  )
  const consumers = (
    readdirSync(sourceRoot, {
      recursive: true,
      encoding: 'utf8',
    }) as string[]
  )
    .filter(
      (path) =>
        /\.(?:ts|tsx)$/.test(path) &&
        !path.endsWith(
          'd1PalaceWritingPreviewProductionAdapter.server.ts',
        ) &&
        !path.endsWith(
          'd1PalaceWritingPreviewProductionAdapter.server.test.ts',
        ) &&
        !path.endsWith(
          'd1PalaceWritingPreviewRuntimePort.server.test.ts',
        ) &&
        !path.endsWith(
          'd1PalaceWritingPreviewRuntimeBinding.server.test.ts',
        ),
    )
    .filter((path) =>
      readFileSync(join(sourceRoot, path), 'utf8').includes(
        'd1PalaceWritingPreviewProductionAdapter.server',
      ),
  )
  assert.deepEqual(consumers, [
    'lib/ai-chart/d1PalaceWritingPreviewRuntimeBinding.server.ts',
  ])
})

console.log(
  `AI Chart D1 palace-writing production-adapter probe checks passed: ${checks}`,
)
}

void run()
