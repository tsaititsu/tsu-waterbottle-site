import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import Module, { createRequire } from 'node:module'
import { join, relative } from 'node:path'
import {
  createValidAiChartD1P1Result,
  createAdapterBridgeFixture,
  type AdapterBridgeFixture,
  type Mutable,
} from './d1P1AdapterBridgeTestSupport'
import {
  AI_CHART_D1_P1_PREVIEW_AUTHORIZATION_ACKNOWLEDGEMENT,
  AI_CHART_D1_P1_PREVIEW_GATE_DISABLED,
  AI_CHART_D1_P1_PREVIEW_GATE_INVALID,
  AI_CHART_D1_P1_PREVIEW_GATE_PRODUCTION_FORBIDDEN,
  createAiChartD1P1PreviewAuthorization,
  createAiChartD1P1PreviewRequestPlanFingerprint,
  type AiChartD1P1PreviewAuthorization,
  type AiChartD1P1PreviewRequestPlan,
  type AiChartD1P1PreviewRequestPlanWithoutFingerprint,
} from './d1P1PreviewRequestGateContracts'
import type { AiChartD1P1Result } from './d1P1F1Contracts'
import {
  AI_CHART_OPENAI_REQUEST_FAILED,
  AI_CHART_OPENAI_RESPONSE_INVALID,
  AI_CHART_OPENAI_TIMEOUT,
  AiChartOpenAiError,
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

let serverModule: typeof import('./d1P1PreviewRequestGate.server')

try {
  moduleInternals._resolveFilename = function resolveFilenameForTest(
    this: unknown,
    request: string,
    parent: unknown,
    isMain: boolean,
    options?: unknown,
  ) {
    if (request === 'server-only') return serverOnlyStubPath
    return originalResolveFilename.call(this, request, parent, isMain, options)
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
  serverModule = testRequire(
    './d1P1PreviewRequestGate.server',
  ) as typeof import('./d1P1PreviewRequestGate.server')
} finally {
  moduleInternals._resolveFilename = originalResolveFilename
  moduleInternals._load = originalLoad
}

const {
  buildAiChartD1P1PreviewRequestPlan,
  executeAiChartD1P1PreviewRequest,
  parseAiChartD1P1PreviewRequestPlan,
} = serverModule

type RequestImplementation = (
  request: AiChartOpenAiStructuredRequest<AiChartD1P1Result>,
) => Promise<AiChartOpenAiStructuredResult<AiChartD1P1Result>>

const GATE_ENV_KEYS = [
  'NODE_ENV',
  'CI',
  'VERCEL',
  'VERCEL_ENV',
  'AI_CHART_D1_P1_PREVIEW_ENABLED',
  'AI_CHART_D1_P1_PREVIEW_TARGET_PALACE_ID',
  'AI_CHART_D1_P1_PREVIEW_PLAN_FINGERPRINT',
  'AI_CHART_D1_P1_PREVIEW_CONFIRM',
] as const

let checks = 0

function check(name: string, run: () => void) {
  run()
  checks += 1
  console.log(`✓ ${name}`)
}

async function asyncCheck(name: string, run: () => Promise<void>) {
  await run()
  checks += 1
  console.log(`✓ ${name}`)
}

function sourceFilesUnder(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? sourceFilesUnder(path) : [path]
  })
}

function collectKeys(value: unknown, output = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    value.forEach((entry) => collectKeys(entry, output))
  } else if (value !== null && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) {
      output.add(key)
      collectKeys(entry, output)
    }
  }
  return output
}

function environmentFor(
  plan: AiChartD1P1PreviewRequestPlan,
  overrides: Readonly<Record<string, string | undefined>> = {},
): Record<string, string | undefined> {
  return {
    NODE_ENV: 'development',
    AI_CHART_D1_P1_PREVIEW_ENABLED: '1',
    AI_CHART_D1_P1_PREVIEW_TARGET_PALACE_ID: plan.targetPalaceId,
    AI_CHART_D1_P1_PREVIEW_PLAN_FINGERPRINT: plan.planFingerprint,
    AI_CHART_D1_P1_PREVIEW_CONFIRM:
      AI_CHART_D1_P1_PREVIEW_AUTHORIZATION_ACKNOWLEDGEMENT,
    ...overrides,
  }
}

function withoutFingerprint(
  plan: AiChartD1P1PreviewRequestPlan,
): AiChartD1P1PreviewRequestPlanWithoutFingerprint {
  const payload = structuredClone(plan) as unknown as Record<string, unknown>
  delete payload.planFingerprint
  return payload as AiChartD1P1PreviewRequestPlanWithoutFingerprint
}

function recalculatePlanFingerprint(
  plan: Mutable<AiChartD1P1PreviewRequestPlan>,
): void {
  plan.planFingerprint = createAiChartD1P1PreviewRequestPlanFingerprint(
    withoutFingerprint(plan),
  )
}

function buildPlan(
  fixture: AdapterBridgeFixture,
  targetPalaceId = fixture.modelInputs[0].targetPalaceId,
  modelInputs: unknown = fixture.modelInputs,
  promptPackages: unknown = fixture.promptPackages,
): AiChartD1P1PreviewRequestPlan {
  return buildAiChartD1P1PreviewRequestPlan(
    fixture.catalog,
    fixture.structuralInputs,
    fixture.bundles,
    modelInputs,
    promptPackages,
    targetPalaceId,
  )
}

function execute(
  fixture: AdapterBridgeFixture,
  plan: AiChartD1P1PreviewRequestPlan,
  authorization: AiChartD1P1PreviewAuthorization,
  environment: Record<string, string | undefined>,
  requestImplementation: RequestImplementation,
  targetPalaceId: unknown = plan.targetPalaceId,
  modelInputs: unknown = fixture.modelInputs,
  promptPackages: unknown = fixture.promptPackages,
) {
  return executeAiChartD1P1PreviewRequest(
    plan,
    authorization,
    fixture.catalog,
    fixture.structuralInputs,
    fixture.bundles,
    modelInputs,
    promptPackages,
    targetPalaceId,
    { environment, requestImplementation },
  )
}

async function run() {
  const originalEnvironment = Object.fromEntries(
    GATE_ENV_KEYS.map((key) => [key, process.env[key]]),
  )
  Reflect.set(process.env, 'NODE_ENV', 'test')
  for (const key of GATE_ENV_KEYS.slice(1)) delete process.env[key]

  try {
    const fixture = await createAdapterBridgeFixture('preview-gate-server')
    const plan = buildPlan(fixture)
    const secondPlan = buildPlan(fixture, fixture.modelInputs[1].targetPalaceId)
    const authorization = createAiChartD1P1PreviewAuthorization(plan)

    check('Plan builder authenticates one target from fixed twelve Bridges', () => {
      assert.equal(fixture.bridges.length, 12)
      assert.equal(plan.targetPalaceId, fixture.bridges[0].descriptor.targetPalaceId)
    })
    check('Plan maps exact Bridge identity and fingerprints', () => {
      const descriptor = fixture.bridges[0].descriptor
      assert.equal(plan.chartId, descriptor.chartId)
      assert.equal(plan.runId, descriptor.runId)
      assert.equal(plan.callId, descriptor.callId)
      assert.equal(plan.bridgeFingerprint, descriptor.bridgeFingerprint)
      assert.equal(plan.packageFingerprint, descriptor.packageFingerprint)
      assert.equal(plan.modelInputFingerprint, descriptor.modelInputFingerprint)
    })
    check('Plan builder is deterministic for identical authenticated sources', () => {
      assert.deepEqual(buildPlan(fixture), plan)
    })
    check('Plan builder performs no request and no global fetch', () => {
      const originalFetch = globalThis.fetch
      let globalFetchCount = 0
      globalThis.fetch = (async () => {
        globalFetchCount += 1
        throw new Error('network_forbidden')
      }) as typeof fetch
      try {
        assert.deepEqual(buildPlan(fixture), plan)
      } finally {
        globalThis.fetch = originalFetch
      }
      assert.equal(globalFetchCount, 0)
    })
    check('Different target palace selects a different authenticated Bridge', () => {
      assert.notEqual(secondPlan.targetPalaceId, plan.targetPalaceId)
      assert.notEqual(secondPlan.callId, plan.callId)
      assert.notEqual(secondPlan.bridgeFingerprint, plan.bridgeFingerprint)
      assert.notEqual(secondPlan.planFingerprint, plan.planFingerprint)
    })
    check('Plan builder rejects a target index', () => {
      assert.throws(() => buildPlan(fixture, 0 as never), {
        message: AI_CHART_D1_P1_PREVIEW_GATE_INVALID,
      })
    })
    check('Plan builder rejects an unknown palace', () => {
      assert.throws(() => buildPlan(fixture, 'palace:unknown' as never), {
        message: AI_CHART_D1_P1_PREVIEW_GATE_INVALID,
      })
    })
    check('Plan parser rebuilds and accepts the exact expected Plan', () => {
      assert.deepEqual(
        parseAiChartD1P1PreviewRequestPlan(
          plan,
          fixture.catalog,
          fixture.structuralInputs,
          fixture.bundles,
          fixture.modelInputs,
          fixture.promptPackages,
          plan.targetPalaceId,
        ),
        plan,
      )
    })
    check('Plan parser returns a frozen Plan', () => {
      const parsed = parseAiChartD1P1PreviewRequestPlan(
        plan,
        fixture.catalog,
        fixture.structuralInputs,
        fixture.bundles,
        fixture.modelInputs,
        fixture.promptPackages,
        plan.targetPalaceId,
      )
      assert.equal(Object.isFrozen(parsed), true)
    })
    check('Another palace Plan is rejected for the requested target', () => {
      assert.throws(
        () =>
          parseAiChartD1P1PreviewRequestPlan(
            secondPlan,
            fixture.catalog,
            fixture.structuralInputs,
            fixture.bundles,
            fixture.modelInputs,
            fixture.promptPackages,
            plan.targetPalaceId,
          ),
        { message: AI_CHART_D1_P1_PREVIEW_GATE_INVALID },
      )
    })
    check('Modified Plan with a recomputed fingerprint remains source-rejected', () => {
      const supplied = structuredClone(plan) as Mutable<AiChartD1P1PreviewRequestPlan>
      supplied.callId = 'call:synthetic-recomputed-but-untrusted'
      recalculatePlanFingerprint(supplied)
      assert.throws(
        () =>
          parseAiChartD1P1PreviewRequestPlan(
            supplied,
            fixture.catalog,
            fixture.structuralInputs,
            fixture.bundles,
            fixture.modelInputs,
            fixture.promptPackages,
            plan.targetPalaceId,
          ),
        { message: AI_CHART_D1_P1_PREVIEW_GATE_INVALID },
      )
    })
    check('Prompt Package mutation is source-rejected', () => {
      const packages = structuredClone(fixture.promptPackages) as Mutable<
        AdapterBridgeFixture['promptPackages']
      >
      packages[0].userInput = 'synthetic mutated user input'
      assert.throws(() => buildPlan(fixture, plan.targetPalaceId, fixture.modelInputs, packages), {
        message: AI_CHART_D1_P1_PREVIEW_GATE_INVALID,
      })
    })
    check('Model Input mutation is source-rejected', () => {
      const inputs = structuredClone(fixture.modelInputs) as Mutable<
        AdapterBridgeFixture['modelInputs']
      >
      inputs[0].callId = 'call:synthetic-mutated-model-input'
      assert.throws(() => buildPlan(fixture, plan.targetPalaceId, inputs), {
        message: AI_CHART_D1_P1_PREVIEW_GATE_INVALID,
      })
    })
    check('Partial fixed-12 input is rejected with no ready subset', () => {
      assert.throws(
        () =>
          buildAiChartD1P1PreviewRequestPlan(
            fixture.catalog,
            fixture.structuralInputs.slice(0, 11),
            fixture.bundles,
            fixture.modelInputs,
            fixture.promptPackages,
            plan.targetPalaceId,
          ),
        { message: AI_CHART_D1_P1_PREVIEW_GATE_INVALID },
      )
    })

    let successCount = 0
    const successRequest: RequestImplementation = async (request) => {
      successCount += 1
      return {
        data: request.parseResult(
          createValidAiChartD1P1Result(fixture.modelInputs[0]),
        ),
        usage: {
          inputTokens: 101,
          outputTokens: 202,
          reasoningTokens: 303,
          totalTokens: 606,
        },
      }
    }
    const success = await execute(
      fixture,
      plan,
      authorization,
      environmentFor(plan),
      successRequest,
    )
    check('Development policy with explicit authorization executes one mock request', () => {
      assert.equal(successCount, 1)
      assert.equal(success.executedRequests, 1)
    })
    check('Successful mock returns parsed source-bound P1 data', () => {
      assert.equal(success.data.callId, plan.callId)
      assert.equal(success.data.palaceId, plan.targetPalaceId)
    })
    check('Successful mock returns normalized usage', () => {
      assert.deepEqual(success.usage, {
        inputTokens: 101,
        outputTokens: 202,
        reasoningTokens: 303,
        totalTokens: 606,
      })
    })
    check('Execution Result and nested Plan/data/usage are frozen', () => {
      assert.equal(Object.isFrozen(success), true)
      assert.equal(Object.isFrozen(success.plan), true)
      assert.equal(Object.isFrozen(success.data), true)
      assert.equal(Object.isFrozen(success.usage), true)
    })
    check('Safe execution result exposes only plan, data, usage and count', () => {
      assert.deepEqual(Object.keys(success), [
        'plan',
        'data',
        'usage',
        'executedRequests',
      ])
    })
    check('Safe execution result excludes raw response and request secrets', () => {
      const keys = collectKeys(success)
      for (const forbidden of [
        'rawResponse',
        'Authorization',
        'apiKey',
        'instructions',
        'userInput',
        'requestBody',
        'output_text',
        'encrypted_reasoning',
      ]) {
        assert.equal(keys.has(forbidden), false)
      }
    })
    await asyncCheck('Injected mock path does not call global fetch', async () => {
      const originalFetch = globalThis.fetch
      let globalFetchCount = 0
      globalThis.fetch = (async () => {
        globalFetchCount += 1
        throw new Error('network_forbidden')
      }) as typeof fetch
      try {
        await execute(
          fixture,
          plan,
          authorization,
          environmentFor(plan),
          successRequest,
        )
      } finally {
        globalThis.fetch = originalFetch
      }
      assert.equal(globalFetchCount, 0)
    })

    for (const [name, environment, expectedError] of [
      ['production', environmentFor(plan, { NODE_ENV: 'production' }), AI_CHART_D1_P1_PREVIEW_GATE_PRODUCTION_FORBIDDEN],
      ['CI true', environmentFor(plan, { CI: 'true' }), AI_CHART_D1_P1_PREVIEW_GATE_PRODUCTION_FORBIDDEN],
      ['CI one', environmentFor(plan, { CI: '1' }), AI_CHART_D1_P1_PREVIEW_GATE_PRODUCTION_FORBIDDEN],
      ['Vercel', environmentFor(plan, { VERCEL: '1' }), AI_CHART_D1_P1_PREVIEW_GATE_PRODUCTION_FORBIDDEN],
      ['Vercel environment', environmentFor(plan, { VERCEL_ENV: 'preview' }), AI_CHART_D1_P1_PREVIEW_GATE_PRODUCTION_FORBIDDEN],
      ['test real path policy', environmentFor(plan, { NODE_ENV: 'test' }), AI_CHART_D1_P1_PREVIEW_GATE_DISABLED],
      ['missing enabled flag', environmentFor(plan, { AI_CHART_D1_P1_PREVIEW_ENABLED: undefined }), AI_CHART_D1_P1_PREVIEW_GATE_DISABLED],
      ['wrong enabled flag', environmentFor(plan, { AI_CHART_D1_P1_PREVIEW_ENABLED: 'true' }), AI_CHART_D1_P1_PREVIEW_GATE_DISABLED],
      ['wrong target binding', environmentFor(plan, { AI_CHART_D1_P1_PREVIEW_TARGET_PALACE_ID: 'palace:siblings' }), AI_CHART_D1_P1_PREVIEW_GATE_DISABLED],
      ['wrong Plan fingerprint binding', environmentFor(plan, { AI_CHART_D1_P1_PREVIEW_PLAN_FINGERPRINT: 'f'.repeat(64) }), AI_CHART_D1_P1_PREVIEW_GATE_DISABLED],
      ['wrong confirmation', environmentFor(plan, { AI_CHART_D1_P1_PREVIEW_CONFIRM: 'NO' }), AI_CHART_D1_P1_PREVIEW_GATE_DISABLED],
    ] as const) {
      await asyncCheck(`${name} fails closed with zero requests`, async () => {
        let requestCount = 0
        await assert.rejects(
          () =>
            execute(
              fixture,
              plan,
              authorization,
              { ...environment },
              async () => {
                requestCount += 1
                return successRequest(fixture.bridges[0].request)
              },
            ),
          { message: expectedError },
        )
        assert.equal(requestCount, 0)
      })
    }

    await asyncCheck('Real request path is disabled in test runtime with zero requests', async () => {
      await assert.rejects(
        () =>
          executeAiChartD1P1PreviewRequest(
            plan,
            authorization,
            fixture.catalog,
            fixture.structuralInputs,
            fixture.bundles,
            fixture.modelInputs,
            fixture.promptPackages,
            plan.targetPalaceId,
          ),
        { message: AI_CHART_D1_P1_PREVIEW_GATE_DISABLED },
      )
    })
    await asyncCheck('Custom request injection is rejected outside test runtime', async () => {
      Reflect.set(process.env, 'NODE_ENV', 'development')
      try {
        await assert.rejects(
          () =>
            execute(
              fixture,
              plan,
              authorization,
              environmentFor(plan),
              successRequest,
            ),
          { message: AI_CHART_D1_P1_PREVIEW_GATE_INVALID },
        )
      } finally {
        Reflect.set(process.env, 'NODE_ENV', 'test')
      }
    })

    for (const [name, error] of [
      ['retryable failure', new AiChartOpenAiError(AI_CHART_OPENAI_REQUEST_FAILED, true)],
      ['timeout', new AiChartOpenAiError(AI_CHART_OPENAI_TIMEOUT, true)],
      ['response invalid', new AiChartOpenAiError(AI_CHART_OPENAI_RESPONSE_INVALID, false)],
    ] as const) {
      await asyncCheck(`${name} propagates after exactly one request`, async () => {
        let requestCount = 0
        await assert.rejects(
          () =>
            execute(
              fixture,
              plan,
              authorization,
              environmentFor(plan),
              async () => {
                requestCount += 1
                throw error
              },
            ),
          (thrown) => thrown === error,
        )
        assert.equal(requestCount, 1)
      })
    }
    await asyncCheck('Source-bound invalid result fails after exactly one request', async () => {
      let requestCount = 0
      await assert.rejects(
        () =>
          execute(
            fixture,
            plan,
            authorization,
            environmentFor(plan),
            async (request) => {
              requestCount += 1
              const result = createValidAiChartD1P1Result(fixture.modelInputs[0])
              result.primaryAxis.majorStarCore = ['紫微']
              return { data: request.parseResult(result), usage: null }
            },
          ),
        { message: 'ai_chart_d1_p1_adapter_bridge_result_invalid' },
      )
      assert.equal(requestCount, 1)
    })
    await asyncCheck('Invalid Authorization fails before request execution', async () => {
      let requestCount = 0
      await assert.rejects(
        () =>
          execute(
            fixture,
            plan,
            { ...authorization, acknowledgement: false } as unknown as AiChartD1P1PreviewAuthorization,
            environmentFor(plan),
            async () => {
              requestCount += 1
              return successRequest(fixture.bridges[0].request)
            },
          ),
        { message: AI_CHART_D1_P1_PREVIEW_GATE_INVALID },
      )
      assert.equal(requestCount, 0)
    })
    await asyncCheck('Caller-supplied Bridge dependency is rejected before execution', async () => {
      let requestCount = 0
      await assert.rejects(
        () =>
          executeAiChartD1P1PreviewRequest(
            plan,
            authorization,
            fixture.catalog,
            fixture.structuralInputs,
            fixture.bundles,
            fixture.modelInputs,
            fixture.promptPackages,
            plan.targetPalaceId,
            {
              environment: environmentFor(plan),
              requestImplementation: async () => {
                requestCount += 1
                return successRequest(fixture.bridges[0].request)
              },
              bridge: fixture.bridges[1],
            } as never,
          ),
        { message: AI_CHART_D1_P1_PREVIEW_GATE_INVALID },
      )
      assert.equal(requestCount, 0)
    })
    await asyncCheck('Caller-supplied request field in Plan is rejected before execution', async () => {
      let requestCount = 0
      const supplied = {
        ...plan,
        request: fixture.bridges[1].request,
      }
      await assert.rejects(
        () =>
          executeAiChartD1P1PreviewRequest(
            supplied,
            authorization,
            fixture.catalog,
            fixture.structuralInputs,
            fixture.bundles,
            fixture.modelInputs,
            fixture.promptPackages,
            plan.targetPalaceId,
            {
              environment: environmentFor(plan),
              requestImplementation: async () => {
                requestCount += 1
                return successRequest(fixture.bridges[0].request)
              },
            },
          ),
        { message: AI_CHART_D1_P1_PREVIEW_GATE_INVALID },
      )
      assert.equal(requestCount, 0)
    })
    await asyncCheck('Tampered Plan with recomputed fingerprint fails before request execution', async () => {
      let requestCount = 0
      const supplied = structuredClone(plan) as Mutable<AiChartD1P1PreviewRequestPlan>
      supplied.callId = 'call:tampered-preview-plan'
      recalculatePlanFingerprint(supplied)
      await assert.rejects(
        () =>
          execute(
            fixture,
            supplied,
            createAiChartD1P1PreviewAuthorization(supplied),
            environmentFor(supplied),
            async () => {
              requestCount += 1
              return successRequest(fixture.bridges[0].request)
            },
          ),
        { message: AI_CHART_D1_P1_PREVIEW_GATE_INVALID },
      )
      assert.equal(requestCount, 0)
    })

    const repositoryRoot = process.cwd()
    const sourceFiles = sourceFilesUnder(join(repositoryRoot, 'src'))
    const productionFiles = sourceFiles.filter(
      (path) =>
        (path.endsWith('.ts') || path.endsWith('.tsx')) &&
        !path.endsWith('.test.ts') &&
        !path.endsWith('TestSupport.ts'),
    )
    const gatePath = join(
      repositoryRoot,
      'src/lib/ai-chart/d1P1PreviewRequestGate.server.ts',
    )
    const gateSource = readFileSync(gatePath, 'utf8')
    const serverRequestSource = readFileSync(
      join(repositoryRoot, 'src/lib/ai-chart/openAiResponses.server.ts'),
      'utf8',
    )

    check('Preview Gate file starts with the exact server-only import', () => {
      assert.equal(gateSource.split('\n')[0], "import 'server-only'")
    })
    check('Adapter Bridge builder production consumer is only Preview Gate', () => {
      const consumers = productionFiles
        .filter((path) =>
          readFileSync(path, 'utf8').includes('buildAiChartD1P1AdapterBridges'),
        )
        .map((path) => relative(repositoryRoot, path))
        .filter((path) => !path.endsWith('d1P1AdapterBridge.ts'))
      assert.deepEqual(consumers, [
        'src/lib/ai-chart/d1P1PreviewRequestGate.server.ts',
      ])
    })
    check('Preview Gate execute function has zero production consumers', () => {
      const consumers = productionFiles
        .filter((path) =>
          readFileSync(path, 'utf8').includes('executeAiChartD1P1PreviewRequest'),
        )
        .map((path) => relative(repositoryRoot, path))
        .filter((path) => !path.endsWith('d1P1PreviewRequestGate.server.ts'))
      assert.deepEqual(consumers, [])
    })
    for (const [name, matcher] of [
      ['src/app', /\/src\/app\//u],
      ['API Route', /\/route\.ts$/u],
      ['Report', /report/iu],
      ['Supabase', /supabase/iu],
      ['Payment', /payment/iu],
      ['Cron or background', /cron|background/iu],
    ] as const) {
      check(`${name} imports zero Preview Gate modules`, () => {
        assert.equal(
          productionFiles
            .filter((path) => matcher.test(path))
            .some((path) =>
              readFileSync(path, 'utf8').includes('d1P1PreviewRequestGate'),
            ),
          false,
        )
      })
    }
    check('No Server Action imports Preview Gate', () => {
      assert.equal(
        productionFiles.some((path) => {
          const source = readFileSync(path, 'utf8')
          return (
            /^['"]use server['"]/mu.test(source) &&
            source.includes('d1P1PreviewRequestGate')
          )
        }),
        false,
      )
    })
    check('Server request does not import Preview Gate', () => {
      assert.doesNotMatch(serverRequestSource, /d1P1PreviewRequestGate/u)
    })
    check('Preview Gate reuses the existing Server request', () => {
      assert.match(gateSource, /requestAiChartOpenAiStructuredResponse/u)
      assert.match(gateSource, /\.\/openAiResponses\.server/u)
    })
    check('Preview Gate contains no direct fetch', () => {
      assert.doesNotMatch(gateSource, /\bfetch\s*\(|globalThis\.fetch/u)
    })
    check('Preview Gate contains no direct API key read or Authorization header', () => {
      assert.doesNotMatch(
        gateSource,
        /OPENAI_API_KEY|['"]Authorization['"]\s*:/u,
      )
    })
    check('Preview Gate contains no Responses body builder', () => {
      assert.doesNotMatch(gateSource, /buildAiChartOpenAiResponsesBody/u)
    })
    check('Preview Gate contains no retry, Promise.all or fallback model', () => {
      assert.doesNotMatch(gateSource, /Promise\.all|retry|backoff|fallbackModel/u)
    })
    check('Repository contains no runtimeEnabled=true wiring', () => {
      assert.equal(
        productionFiles.some((path) =>
          /runtimeEnabled\s*[:=]\s*true/u.test(readFileSync(path, 'utf8')),
        ),
        false,
      )
    })
    check('No F1 Input module was created', () => {
      assert.equal(sourceFiles.some((path) => /d1F1Input/u.test(path)), false)
    })
    check('F1 remains blocked in README', () => {
      assert.match(
        readFileSync(
          join(repositoryRoot, 'content/ai-chart/d1-v1/README.md'),
          'utf8',
        ),
        /F1_BLOCKED_BY_MISSING_FLYING_TRANSFORM_SOURCE/u,
      )
    })

    console.log(`\n${checks} D1 P1 Preview Gate Server checks passed.`)
  } finally {
    for (const key of GATE_ENV_KEYS) {
      const original = originalEnvironment[key]
      if (original === undefined) delete process.env[key]
      else Reflect.set(process.env, key, original)
    }
  }
}

void run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
