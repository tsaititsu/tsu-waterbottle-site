import assert from 'node:assert/strict'
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
} from 'node:fs'
import {
  chmod,
  rm,
} from 'node:fs/promises'
import Module, { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  AI_CHART_D1_PALACE_WRITING_PREVIEW_AUTHORIZATION_ACKNOWLEDGEMENT,
  AI_CHART_D1_PALACE_WRITING_PREVIEW_AUTHORIZATION_MODE,
  AI_CHART_D1_PALACE_WRITING_PREVIEW_AUTHORIZATION_TASK,
  AI_CHART_D1_PALACE_WRITING_PREVIEW_AUTHORIZATION_VERSION,
  buildAiChartD1PalaceWritingPreviewGatePlan,
} from './d1PalaceWritingPreviewGateContracts'
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
const originalTemporaryDirectory = tmpdir()
const originalTmpdirEnvironment = process.env.TMPDIR
const suiteRoot = mkdtempSync(
  join(
    originalTemporaryDirectory,
    'ai-chart-d1-palace-writing-runtime-binding-suite-',
  ),
)
process.env.TMPDIR = suiteRoot
const claimStorageRoot = join(
  suiteRoot,
  'ai-chart-d1-palace-writing-preview-claims',
)

let bindingModule:
  typeof import(
    './d1PalaceWritingPreviewRuntimeBinding.server'
  )
let handoffModule:
  typeof import(
    './d1PalaceWritingPreviewRuntimeHandoff.server'
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
  bindingModule = testRequire(
    './d1PalaceWritingPreviewRuntimeBinding.server',
  ) as typeof import(
    './d1PalaceWritingPreviewRuntimeBinding.server'
  )
  handoffModule = testRequire(
    './d1PalaceWritingPreviewRuntimeHandoff.server',
  ) as typeof import(
    './d1PalaceWritingPreviewRuntimeHandoff.server'
  )
  openAiServerModule = testRequire(
    './openAiResponses.server',
  ) as typeof import('./openAiResponses.server')
} finally {
  moduleInternals._resolveFilename = originalResolveFilename
  moduleInternals._load = originalLoad
}

const {
  AiChartD1PalaceWritingPreviewRuntimeBindingError,
  probeAiChartD1PalaceWritingPreviewRuntimeBinding,
} = bindingModule
const {
  AiChartD1PalaceWritingPreviewRuntimeHandoffAlreadyConsumedError,
  AiChartD1PalaceWritingPreviewRuntimeHandoffInvalidError,
  prepareAiChartD1PalaceWritingPreviewRuntimeHandoff,
} = handoffModule

type StructuredRequester =
  typeof openAiServerModule.requestAiChartOpenAiStructuredResponse

const goldenCase = buildAiChartD1PalaceWritingGoldenCase()
const previewPlan =
  buildAiChartD1PalaceWritingPreviewPlan(goldenCase)
const gatePlan =
  buildAiChartD1PalaceWritingPreviewGatePlan(previewPlan)
const authorization = Object.freeze({
  contractVersion:
    AI_CHART_D1_PALACE_WRITING_PREVIEW_AUTHORIZATION_VERSION,
  task: AI_CHART_D1_PALACE_WRITING_PREVIEW_AUTHORIZATION_TASK,
  mode: AI_CHART_D1_PALACE_WRITING_PREVIEW_AUTHORIZATION_MODE,
  fixtureId: gatePlan.fixtureId,
  caseFingerprint: gatePlan.caseFingerprint,
  previewPlanFingerprint: gatePlan.previewPlanFingerprint,
  gateFingerprint: gatePlan.gateFingerprint,
  maxRequests: 2,
  fetchHardLimit: 2,
  retry: false,
  acknowledgement:
    AI_CHART_D1_PALACE_WRITING_PREVIEW_AUTHORIZATION_ACKNOWLEDGEMENT,
})
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

function createRequester(
  execute: <T>(
    request: AiChartOpenAiStructuredRequest<T>,
  ) => Promise<AiChartOpenAiStructuredResult<T>>,
): StructuredRequester {
  return async <T>(
    request: AiChartOpenAiStructuredRequest<T>,
  ) => execute(request)
}

function createSuccessfulRequester(
  calls: string[],
): StructuredRequester {
  return createRequester(async <T>(
    request: AiChartOpenAiStructuredRequest<T>,
  ) => {
    calls.push(request.schemaName)
    return Object.freeze({
      data:
        calls.length === 1
          ? (goldenCase.expectedWritingResult as T)
          : (goldenCase.expectedFidelityReview as T),
      usage:
        calls.length === 1
          ? WRITING_USAGE
          : REVIEW_USAGE,
    })
  })
}

async function resetClaimStorage(): Promise<void> {
  await rm(claimStorageRoot, {
    recursive: true,
    force: true,
  })
}

async function prepareFreshHandoff() {
  await resetClaimStorage()
  const prepared =
    await prepareAiChartD1PalaceWritingPreviewRuntimeHandoff(
      gatePlan,
      authorization,
    )
  assert.equal(prepared.status, 'READY_STOPPED')
  assert.notEqual(prepared.handoff, null)
  return prepared.handoff
}

async function runSuccessfulBinding(
  handoff: Awaited<
    ReturnType<typeof prepareFreshHandoff>
  >,
  calls: string[] = [],
) {
  return probeAiChartD1PalaceWritingPreviewRuntimeBinding({
    handoff,
    previewPlan,
    goldenCase,
    requestStructuredResponseFake:
      createSuccessfulRequester(calls),
  })
}

async function run(): Promise<void> {
  await resetClaimStorage()
  try {
    await check('exact handoff is consumed once before the two-stage offline adapter probe', async () => {
      const calls: string[] = []
      const result = await runSuccessfulBinding(
        await prepareFreshHandoff(),
        calls,
      )

      assert.deepEqual(calls, [
        'ai_chart_d1_palace_writing_result_v1',
        'ai_chart_d1_palace_writing_fidelity_review_v1',
      ])
      assert.equal(
        result.runtimeMode,
        'HANDOFF_BOUND_OFFLINE_ADAPTER_PROBE_ONLY',
      )
      assert.equal(result.status, 'PROBE_SUCCEEDED')
      assert.equal(result.completedStage, 'COMPLETE')
      assert.equal(result.portInvocations, 2)
      assert.equal(
        result.runtimeHandoffStatus,
        'CONSUMED_FOR_OFFLINE_ADAPTER_PROBE',
      )
      assert.equal(
        result.productionAdapterStatus,
        'NOT_IMPLEMENTED',
      )
      assert.equal(
        result.customerDeliveryStatus,
        'BLOCKED_OFFLINE_BINDING_ONLY',
      )
      assert.equal(result.attemptedRequests, 0)
      assert.equal(result.executedRequests, 0)
      assert.equal(result.fetchCount, 0)
      assert.equal(result.openAiRequests, 0)
      assert.equal(result.retryPerformed, false)
      assert.equal(result.restrictedArtifactPersisted, false)
      assert.equal(result.safeMetadataOnly, true)
      assert.equal(recursivelyFrozen(result), true)
    })

    await check('invalid plan fails before consuming the exact handoff', async () => {
      const handoff = await prepareFreshHandoff()
      let calls = 0
      await assert.rejects(
        probeAiChartD1PalaceWritingPreviewRuntimeBinding({
          handoff,
          previewPlan: {
            ...previewPlan,
            planFingerprint: '0'.repeat(64),
          },
          goldenCase,
          requestStructuredResponseFake: createRequester(
            async <T>() => {
              calls += 1
              return Object.freeze({
                data:
                  goldenCase.expectedWritingResult as T,
                usage: WRITING_USAGE,
              })
            },
          ),
        }),
        AiChartD1PalaceWritingPreviewRuntimeBindingError,
      )
      assert.equal(calls, 0)

      const retryCalls: string[] = []
      const result = await runSuccessfulBinding(
        handoff,
        retryCalls,
      )
      assert.equal(result.status, 'PROBE_SUCCEEDED')
      assert.equal(retryCalls.length, 2)
    })

    await check('real OpenAI requester is rejected before handoff consumption', async () => {
      const handoff = await prepareFreshHandoff()
      await assert.rejects(
        probeAiChartD1PalaceWritingPreviewRuntimeBinding({
          handoff,
          previewPlan,
          goldenCase,
          requestStructuredResponseFake:
            openAiServerModule.requestAiChartOpenAiStructuredResponse,
        }),
        AiChartD1PalaceWritingPreviewRuntimeBindingError,
      )

      const calls: string[] = []
      const result = await runSuccessfulBinding(handoff, calls)
      assert.equal(result.status, 'PROBE_SUCCEEDED')
      assert.equal(calls.length, 2)
    })

    await check('field-equivalent handoff copy is rejected while the original remains usable', async () => {
      const handoff = await prepareFreshHandoff()
      await assert.rejects(
        runSuccessfulBinding({ ...handoff } as typeof handoff),
        AiChartD1PalaceWritingPreviewRuntimeHandoffInvalidError,
      )

      const calls: string[] = []
      const result = await runSuccessfulBinding(handoff, calls)
      assert.equal(result.status, 'PROBE_SUCCEEDED')
      assert.equal(calls.length, 2)
    })

    await check('two concurrent bindings consume one handoff exactly once', async () => {
      const handoff = await prepareFreshHandoff()
      const calls: string[] = []
      const requester = createSuccessfulRequester(calls)
      const input = {
        handoff,
        previewPlan,
        goldenCase,
        requestStructuredResponseFake: requester,
      } as const
      const results = await Promise.allSettled([
        probeAiChartD1PalaceWritingPreviewRuntimeBinding(input),
        probeAiChartD1PalaceWritingPreviewRuntimeBinding(input),
      ])

      assert.equal(
        results.filter(
          (result) => result.status === 'fulfilled',
        ).length,
        1,
      )
      assert.equal(
        results.filter(
          (result) => result.status === 'rejected',
        ).length,
        1,
      )
      const rejected = results.find(
        (result) => result.status === 'rejected',
      )
      assert.equal(rejected?.status, 'rejected')
      if (rejected?.status === 'rejected') {
        assert.equal(
          rejected.reason instanceof
            AiChartD1PalaceWritingPreviewRuntimeHandoffAlreadyConsumedError,
          true,
        )
      }
      assert.equal(calls.length, 2)
    })

    await check('offline requester failure still consumes the handoff and cannot be retried', async () => {
      const handoff = await prepareFreshHandoff()
      let calls = 0
      const result =
        await probeAiChartD1PalaceWritingPreviewRuntimeBinding({
          handoff,
          previewPlan,
          goldenCase,
          requestStructuredResponseFake: createRequester(
            async () => {
              calls += 1
              throw new Error(
                'sensitive provider output must not escape',
              )
            },
          ),
        })

      assert.equal(result.status, 'PROBE_FAILED')
      assert.equal(result.completedStage, 'WRITING')
      assert.equal(calls, 1)
      assert.equal(
        JSON.stringify(result).includes(
          'sensitive provider output',
        ),
        false,
      )
      await assert.rejects(
        runSuccessfulBinding(handoff),
        AiChartD1PalaceWritingPreviewRuntimeHandoffAlreadyConsumedError,
      )
    })

    await check('non-test environment fails before consuming the handoff', async () => {
      const handoff = await prepareFreshHandoff()
      const mutableEnvironment = process.env as Record<
        string,
        string | undefined
      >
      const originalNodeEnvironment =
        mutableEnvironment.NODE_ENV
      try {
        mutableEnvironment.NODE_ENV = 'production'
        await assert.rejects(
          runSuccessfulBinding(handoff),
          AiChartD1PalaceWritingPreviewRuntimeBindingError,
        )
      } finally {
        if (originalNodeEnvironment === undefined) {
          delete mutableEnvironment.NODE_ENV
        } else {
          mutableEnvironment.NODE_ENV =
            originalNodeEnvironment
        }
      }

      const calls: string[] = []
      const result = await runSuccessfulBinding(handoff, calls)
      assert.equal(result.status, 'PROBE_SUCCEEDED')
      assert.equal(calls.length, 2)
    })

    await check('runtime binding is server-only and has no transport, secret, persistence, retry, or production consumer', () => {
      const source = readFileSync(
        fileURLToPath(
          new URL(
            './d1PalaceWritingPreviewRuntimeBinding.server.ts',
            import.meta.url,
          ),
        ),
        'utf8',
      )
      assert.equal(
        source.split('\n')[0],
        "import 'server-only'",
      )
      assert.match(
        source,
        /consumeAiChartD1PalaceWritingPreviewRuntimeHandoff/u,
      )
      assert.match(
        source,
        /probeAiChartD1PalaceWritingPreviewProductionAdapter/u,
      )
      assert.doesNotMatch(
        source,
        /fetch\s*\(|OPENAI_API_KEY|Authorization\s*:|Bearer\s|Promise\.all|retry\s*\(|fallback|writeFile|appendFile|unlink\s*\(|\brm\s*\(|rename\s*\(/u,
      )
      assert.doesNotMatch(
        source,
        /requestAiChartOpenAiStructuredResponse(?:<[^>]+>)?\s*\(/u,
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
              'd1PalaceWritingPreviewRuntimeBinding.server.ts',
            ) &&
            !path.endsWith(
              'd1PalaceWritingPreviewRuntimeBinding.server.test.ts',
            ) &&
            !path.endsWith(
              'd1PalaceWritingPreviewProductionAdapter.server.test.ts',
            ),
        )
        .filter((path) =>
          readFileSync(join(sourceRoot, path), 'utf8').includes(
            'd1PalaceWritingPreviewRuntimeBinding.server',
          ),
        )
      assert.deepEqual(consumers, [])
    })

    assert.equal(
      moduleInternals._resolveFilename,
      originalResolveFilename,
    )
    assert.equal(moduleInternals._load, originalLoad)
  } finally {
    await chmod(claimStorageRoot, 0o700).catch(
      () => undefined,
    )
    await resetClaimStorage()
    await rm(suiteRoot, {
      recursive: true,
      force: true,
    })
    if (originalTmpdirEnvironment === undefined) {
      delete process.env.TMPDIR
    } else {
      process.env.TMPDIR = originalTmpdirEnvironment
    }
  }

  console.log(
    `AI Chart D1 palace-writing runtime-binding checks passed: ${checks}`,
  )
}

void run()
