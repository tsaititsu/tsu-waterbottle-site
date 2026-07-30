import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import Module, { createRequire } from 'node:module'
import { join, relative } from 'node:path'
import {
  buildAiChartD1P1AdapterBridges,
} from './d1P1AdapterBridge'
import {
  AI_CHART_D1_P1_ADAPTER_BRIDGE_RESULT_INVALID,
  AI_CHART_D1_P1_MAX_OUTPUT_TOKENS,
} from './d1P1AdapterBridgeContracts'
import {
  createValidAiChartD1P1Result as createValidAiChartD1P1ResultWithServerFacts,
  createAdapterBridgeFixture,
  type AdapterBridgeFixture,
  type Mutable,
} from './d1P1AdapterBridgeTestSupport'
import { buildAiChartD1P1PromptPackages } from './d1P1PromptPackageBuilder'
import { buildAiChartD1K0P1KnowledgeBundles } from './d1K0Selection'
import {
  bundleIds,
  completeModelInputSnapshot,
  createStructuralInputs,
  createModelInputFixture,
  type MutableRecord,
} from './d1P1ModelInputTestSupport'
import {
  AI_CHART_D1_P1_PREVIEW_AUTHORIZATION_ACKNOWLEDGEMENT,
  AI_CHART_D1_P1_PREVIEW_GATE_DISABLED,
  AI_CHART_D1_P1_PREVIEW_GATE_INVALID,
  AI_CHART_D1_P1_PREVIEW_GATE_NOT_READY,
  AI_CHART_D1_P1_PREVIEW_GATE_PRODUCTION_FORBIDDEN,
  createAiChartD1P1PreviewEvidenceContractSummary,
  createAiChartD1P1PreviewAuthorization,
  createAiChartD1P1PreviewRequestPlanFingerprint,
  type AiChartD1P1PreviewAuthorization,
  type AiChartD1P1PreviewRequestPlan,
  type AiChartD1P1PreviewRequestPlanWithoutFingerprint,
} from './d1P1PreviewRequestGateContracts'
import type { AiChartD1P1Result } from './d1P1F1Contracts'
import {
  AI_CHART_D1_P1_LOCAL_PREVIEW_TIMEOUT_MS,
  AI_CHART_D1_P1_PREVIEW_TIMEOUT_ENVIRONMENT_VARIABLE,
} from './d1P1PreviewTimeoutContracts'
import {
  AI_CHART_OPENAI_DEFAULT_MAX_OUTPUT_TOKENS,
  AI_CHART_OPENAI_DEFAULT_TIMEOUT_MS,
  AI_CHART_OPENAI_REQUEST_FAILED,
  AI_CHART_OPENAI_RESPONSE_INVALID,
  AI_CHART_OPENAI_TIMEOUT,
  AiChartOpenAiError,
  type AiChartOpenAiStructuredRequest,
  type AiChartOpenAiStructuredResult,
} from './openAiResponses'

function createValidAiChartD1P1Result(
  ...args: Parameters<typeof createValidAiChartD1P1ResultWithServerFacts>
): Mutable<AiChartD1P1Result> {
  const result = createValidAiChartD1P1ResultWithServerFacts(...args)
  result.primaryAxis.majorStarCore = []
  result.coverage.majorStarsCovered = []
  return result
}

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
  AI_CHART_D1_P1_PREVIEW_TIMEOUT_ENVIRONMENT_VARIABLE,
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
    ...(plan.timeoutMs === AI_CHART_D1_P1_LOCAL_PREVIEW_TIMEOUT_MS
      ? {
          [AI_CHART_D1_P1_PREVIEW_TIMEOUT_ENVIRONMENT_VARIABLE]: String(
            AI_CHART_D1_P1_LOCAL_PREVIEW_TIMEOUT_MS,
          ),
        }
      : {}),
    ...overrides,
  }
}

function localPreviewBuildEnvironment(
  targetPalaceId: string,
  timeoutValue = String(AI_CHART_D1_P1_LOCAL_PREVIEW_TIMEOUT_MS),
  overrides: Readonly<Record<string, string | undefined>> = {},
): Record<string, string | undefined> {
  return {
    NODE_ENV: 'development',
    AI_CHART_D1_P1_PREVIEW_ENABLED: '1',
    AI_CHART_D1_P1_PREVIEW_TARGET_PALACE_ID: targetPalaceId,
    [AI_CHART_D1_P1_PREVIEW_TIMEOUT_ENVIRONMENT_VARIABLE]: timeoutValue,
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
  environment?: Record<string, string | undefined>,
): AiChartD1P1PreviewRequestPlan {
  if (environment !== undefined) {
    return buildAiChartD1P1PreviewRequestPlan(
      fixture.catalog,
      fixture.structuralInputs,
      fixture.bundles,
      modelInputs,
      promptPackages,
      targetPalaceId,
      { environment },
    )
  }
  return buildAiChartD1P1PreviewRequestPlan(
    fixture.catalog,
    fixture.structuralInputs,
    fixture.bundles,
    modelInputs,
    promptPackages,
    targetPalaceId,
  )
}

async function createCustomFixture(
  identity: string,
  snapshot: MutableRecord,
): Promise<AdapterBridgeFixture> {
  const modelFixture = await createModelInputFixture(identity, snapshot)
  const promptPackages = buildAiChartD1P1PromptPackages(
    modelFixture.catalog,
    modelFixture.structuralInputs,
    modelFixture.bundles,
    modelFixture.modelInputs,
  )
  const bridges = buildAiChartD1P1AdapterBridges(
    modelFixture.catalog,
    modelFixture.structuralInputs,
    modelFixture.bundles,
    modelFixture.modelInputs,
    promptPackages,
  )
  return { ...modelFixture, promptPackages, bridges }
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
    const localPreviewPlan = buildPlan(
      fixture,
      fixture.modelInputs[0].targetPalaceId,
      fixture.modelInputs,
      fixture.promptPackages,
      localPreviewBuildEnvironment(fixture.modelInputs[0].targetPalaceId),
    )
    const secondPlan = buildPlan(fixture, fixture.modelInputs[1].targetPalaceId)
    const authorization = createAiChartD1P1PreviewAuthorization(plan)
    const localPreviewAuthorization =
      createAiChartD1P1PreviewAuthorization(localPreviewPlan)

    check('Plan builder authenticates one target from fixed twelve Bridges', () => {
      assert.equal(fixture.bridges.length, 12)
      assert.equal(plan.targetPalaceId, fixture.bridges[0].descriptor.targetPalaceId)
    })
    check('Default Plan binds the descriptor and request to 16384 tokens', () => {
      const bridge = fixture.bridges[0]
      assert.equal(plan.maxOutputTokens, AI_CHART_D1_P1_MAX_OUTPUT_TOKENS)
      assert.equal(
        bridge.descriptor.maxOutputTokens,
        AI_CHART_D1_P1_MAX_OUTPUT_TOKENS,
      )
      assert.equal(
        bridge.request.maxOutputTokens,
        AI_CHART_D1_P1_MAX_OUTPUT_TOKENS,
      )
      assert.equal(plan.maxOutputTokens, bridge.descriptor.maxOutputTokens)
      assert.equal(plan.maxOutputTokens, bridge.request.maxOutputTokens)
    })
    check('Default Plan timeout remains 120 seconds', () => {
      assert.equal(plan.timeoutMs, AI_CHART_OPENAI_DEFAULT_TIMEOUT_MS)
      assert.equal(plan.maxRequests, 1)
      assert.equal(plan.productionCallable, false)
    })
    check('Local Preview override binds 300 seconds into Plan and Bridge fingerprint', () => {
      assert.equal(
        localPreviewPlan.timeoutMs,
        AI_CHART_D1_P1_LOCAL_PREVIEW_TIMEOUT_MS,
      )
      assert.equal(localPreviewPlan.maxRequests, 1)
      assert.equal(localPreviewPlan.productionCallable, false)
      assert.equal(
        localPreviewPlan.maxOutputTokens,
        AI_CHART_D1_P1_MAX_OUTPUT_TOKENS,
      )
      assert.notEqual(
        localPreviewPlan.bridgeFingerprint,
        plan.bridgeFingerprint,
      )
      assert.notEqual(
        localPreviewPlan.planFingerprint,
        plan.planFingerprint,
      )
    })
    check('Local Preview evidence summary records the effective timeout', () => {
      assert.deepEqual(
        createAiChartD1P1PreviewEvidenceContractSummary(localPreviewPlan),
        {
          planFingerprint: localPreviewPlan.planFingerprint,
          timeoutMs: AI_CHART_D1_P1_LOCAL_PREVIEW_TIMEOUT_MS,
          maxRequests: 1,
          productionCallable: false,
        },
      )
    })
    check('Local Preview Plan parser requires and accepts the same override environment', () => {
      assert.deepEqual(
        parseAiChartD1P1PreviewRequestPlan(
          localPreviewPlan,
          fixture.catalog,
          fixture.structuralInputs,
          fixture.bundles,
          fixture.modelInputs,
          fixture.promptPackages,
          localPreviewPlan.targetPalaceId,
          {
            environment: localPreviewBuildEnvironment(
              localPreviewPlan.targetPalaceId,
            ),
          },
        ),
        localPreviewPlan,
      )
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
        assert.deepEqual(
          buildPlan(
            fixture,
            localPreviewPlan.targetPalaceId,
            fixture.modelInputs,
            fixture.promptPackages,
            localPreviewBuildEnvironment(localPreviewPlan.targetPalaceId),
          ),
          localPreviewPlan,
        )
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
    await asyncCheck(
      'Legacy 8192 Plan fails before request execution with matching bindings',
      async () => {
        let requestCount = 0
        let globalFetchCount = 0
        const legacyPlanRecord = structuredClone(plan) as unknown as Record<
          string,
          unknown
        >
        legacyPlanRecord.maxOutputTokens =
          AI_CHART_OPENAI_DEFAULT_MAX_OUTPUT_TOKENS
        const legacyPlan = legacyPlanRecord as unknown as Mutable<
          AiChartD1P1PreviewRequestPlan
        >
        recalculatePlanFingerprint(legacyPlan)
        const legacyAuthorization = {
          ...authorization,
          planFingerprint: legacyPlan.planFingerprint,
        } as AiChartD1P1PreviewAuthorization
        const originalFetch = globalThis.fetch
        globalThis.fetch = (async () => {
          globalFetchCount += 1
          throw new Error('network_forbidden')
        }) as typeof fetch
        try {
          await assert.rejects(
            () =>
              execute(
                fixture,
                legacyPlan,
                legacyAuthorization,
                environmentFor(legacyPlan),
                async () => {
                  requestCount += 1
                  return {
                    data: createValidAiChartD1P1Result(
                      fixture.modelInputs[0],
                    ),
                    usage: null,
                  }
                },
              ),
            { message: AI_CHART_D1_P1_PREVIEW_GATE_INVALID },
          )
        } finally {
          globalThis.fetch = originalFetch
        }
        assert.notEqual(legacyPlan.planFingerprint, plan.planFingerprint)
        assert.equal(requestCount, 0)
        assert.equal(globalFetchCount, 0)
      },
    )
    check('Local Preview Plan is rejected when the override is not present', () => {
      assert.throws(
        () =>
          parseAiChartD1P1PreviewRequestPlan(
            localPreviewPlan,
            fixture.catalog,
            fixture.structuralInputs,
            fixture.bundles,
            fixture.modelInputs,
            fixture.promptPackages,
            localPreviewPlan.targetPalaceId,
          ),
        { message: AI_CHART_D1_P1_PREVIEW_GATE_INVALID },
      )
    })
    for (const timeoutValue of [
      'not-a-number',
      '0',
      '-1',
      '120001',
      '299999',
      '300001',
    ]) {
      check(`Local Preview timeout ${timeoutValue} is rejected`, () => {
        assert.throws(
          () =>
            buildPlan(
              fixture,
              plan.targetPalaceId,
              fixture.modelInputs,
              fixture.promptPackages,
              localPreviewBuildEnvironment(
                plan.targetPalaceId,
                timeoutValue,
              ),
            ),
          { message: AI_CHART_D1_P1_PREVIEW_GATE_INVALID },
        )
      })
    }
    for (const [name, overrides] of [
      ['production', { NODE_ENV: 'production' }],
      ['CI true', { CI: 'true' }],
      ['CI false but present', { CI: 'false' }],
      ['Vercel', { VERCEL: '1' }],
      ['Vercel environment', { VERCEL_ENV: 'preview' }],
    ] as const) {
      check(`Local Preview override rejects ${name}`, () => {
        assert.throws(
          () =>
            buildPlan(
              fixture,
              plan.targetPalaceId,
              fixture.modelInputs,
              fixture.promptPackages,
              localPreviewBuildEnvironment(
                plan.targetPalaceId,
                undefined,
                overrides,
              ),
            ),
          { message: AI_CHART_D1_P1_PREVIEW_GATE_PRODUCTION_FORBIDDEN },
        )
      })
    }
    for (const [name, overrides] of [
      ['test environment', { NODE_ENV: 'test' }],
      ['missing enabled flag', { AI_CHART_D1_P1_PREVIEW_ENABLED: undefined }],
      [
        'wrong target binding',
        { AI_CHART_D1_P1_PREVIEW_TARGET_PALACE_ID: 'palace:siblings' },
      ],
    ] as const) {
      check(`Local Preview override rejects ${name}`, () => {
        assert.throws(
          () =>
            buildPlan(
              fixture,
              plan.targetPalaceId,
              fixture.modelInputs,
              fixture.promptPackages,
              localPreviewBuildEnvironment(
                plan.targetPalaceId,
                undefined,
                overrides,
              ),
            ),
          { message: AI_CHART_D1_P1_PREVIEW_GATE_DISABLED },
        )
      })
    }
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

    const blockedSnapshot = completeModelInputSnapshot()
    const blockedPalaces = blockedSnapshot.palaces as MutableRecord[]
    blockedPalaces[0].majorStars = []
    blockedPalaces[0].minorStars = [
      { name: '文昌', type: 'soft', scope: 'origin' },
    ]
    const blockedFixture = await createCustomFixture(
      'preview-gate-blocked-target',
      blockedSnapshot,
    )
    const blockedTargetPalaceId = blockedFixture.modelInputs[0].targetPalaceId
    check('blocked_by_local_star target is authenticated but not Preview-ready', () => {
      assert.equal(
        blockedFixture.modelInputs[0].structuralContext.targetPalace.borrowStatus,
        'blocked_by_local_star',
      )
      assert.equal(blockedFixture.bridges.length, 12)
    })
    check('blocked_by_local_star target Plan builder returns not-ready', () => {
      assert.throws(
        () => buildPlan(blockedFixture, blockedTargetPalaceId),
        { message: AI_CHART_D1_P1_PREVIEW_GATE_NOT_READY },
      )
    })
    check('blocked target Plan parser returns not-ready before accepting a Plan', () => {
      assert.throws(
        () =>
          parseAiChartD1P1PreviewRequestPlan(
            plan,
            blockedFixture.catalog,
            blockedFixture.structuralInputs,
            blockedFixture.bundles,
            blockedFixture.modelInputs,
            blockedFixture.promptPackages,
            blockedTargetPalaceId,
          ),
        { message: AI_CHART_D1_P1_PREVIEW_GATE_NOT_READY },
      )
    })
    await asyncCheck('blocked target execution rejects before its request implementation', async () => {
      let requestCount = 0
      await assert.rejects(
        () =>
          execute(
            blockedFixture,
            plan,
            authorization,
            environmentFor(plan),
            async () => {
              requestCount += 1
              throw new Error('request_must_not_run')
            },
            blockedTargetPalaceId,
          ),
        { message: AI_CHART_D1_P1_PREVIEW_GATE_NOT_READY },
      )
      assert.equal(requestCount, 0)
    })
    check('blocked target not-ready error exposes no target metadata', () => {
      assert.throws(
        () => buildPlan(blockedFixture, blockedTargetPalaceId),
        (error) => {
          assert.equal(
            (error as Error).message,
            AI_CHART_D1_P1_PREVIEW_GATE_NOT_READY,
          )
          assert.doesNotMatch(
            String(error),
            /chart:|call:|palace:|文昌|[a-f0-9]{64}/u,
          )
          return true
        },
      )
    })
    check('a valid sibling target remains Preview-ready in the blocked chart', () => {
      const siblingPlan = buildPlan(
        blockedFixture,
        blockedFixture.modelInputs[1].targetPalaceId,
      )
      assert.equal(
        siblingPlan.targetPalaceId,
        blockedFixture.modelInputs[1].targetPalaceId,
      )
    })

    const borrowedSnapshot = completeModelInputSnapshot()
    const borrowedPalaces = borrowedSnapshot.palaces as MutableRecord[]
    borrowedPalaces[0].majorStars = []
    borrowedPalaces[0].minorStars = []
    const borrowedFixture = await createCustomFixture(
      'preview-gate-borrowed-target',
      borrowedSnapshot,
    )
    check('eligible_and_borrowed target with effective stars is Preview-ready', () => {
      assert.equal(
        borrowedFixture.modelInputs[0].structuralContext.targetPalace.borrowStatus,
        'eligible_and_borrowed',
      )
      assert.doesNotThrow(() => buildPlan(borrowedFixture))
    })
    check('canonical nonempty target remains Preview-ready', () => {
      assert.equal(
        fixture.modelInputs[0].structuralContext.targetPalace.canonicalMajorStars
          .length > 0,
        true,
      )
      assert.doesNotThrow(() => buildPlan(fixture))
    })

    const oppositeEmptySnapshot = completeModelInputSnapshot()
    const oppositeEmptyPalaces = oppositeEmptySnapshot.palaces as MutableRecord[]
    oppositeEmptyPalaces[0].majorStars = []
    oppositeEmptyPalaces[0].minorStars = []
    oppositeEmptyPalaces[6].majorStars = []
    const oppositeEmptyStructures = createStructuralInputs(
      oppositeEmptySnapshot,
      'preview-gate-opposite-empty',
    )
    const oppositeEmptyBundles = buildAiChartD1K0P1KnowledgeBundles(
      fixture.catalog,
      oppositeEmptyStructures,
      { bundleIds: bundleIds('preview-gate-opposite-empty') },
    )
    check('opposite_empty upstream remains Preview not-ready', () => {
      assert.equal(
        oppositeEmptyStructures[0].targetPalace.borrowStatus,
        'opposite_empty',
      )
      assert.throws(
        () =>
          buildAiChartD1P1PreviewRequestPlan(
            fixture.catalog,
            oppositeEmptyStructures,
            oppositeEmptyBundles,
            fixture.modelInputs,
            fixture.promptPackages,
            oppositeEmptyStructures[0].targetPalace.palaceId,
          ),
        { message: AI_CHART_D1_P1_PREVIEW_GATE_NOT_READY },
      )
    })

    let successCount = 0
    let successRequestMaxOutputTokens: number | undefined
    const successRequest: RequestImplementation = async (request) => {
      successCount += 1
      successRequestMaxOutputTokens = request.maxOutputTokens
      return {
        data: createValidAiChartD1P1Result(fixture.modelInputs[0]),
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
    let localPreviewRequestCount = 0
    let localPreviewRequestTimeoutMs: number | undefined
    let localPreviewRequestMaxOutputTokens: number | undefined
    const localPreviewSuccess = await execute(
      fixture,
      localPreviewPlan,
      localPreviewAuthorization,
      environmentFor(localPreviewPlan),
      async (request) => {
        localPreviewRequestCount += 1
        localPreviewRequestTimeoutMs = request.timeoutMs
        localPreviewRequestMaxOutputTokens = request.maxOutputTokens
        return {
          data: createValidAiChartD1P1Result(fixture.modelInputs[0]),
          usage: null,
        }
      },
    )
    check('Local Preview Plan and actual adapter request both use 300 seconds', () => {
      assert.equal(localPreviewRequestCount, 1)
      assert.equal(
        localPreviewSuccess.plan.timeoutMs,
        AI_CHART_D1_P1_LOCAL_PREVIEW_TIMEOUT_MS,
      )
      assert.equal(
        localPreviewRequestTimeoutMs,
        AI_CHART_D1_P1_LOCAL_PREVIEW_TIMEOUT_MS,
      )
      assert.equal(
        localPreviewRequestMaxOutputTokens,
        AI_CHART_D1_P1_MAX_OUTPUT_TOKENS,
      )
      assert.equal(
        localPreviewSuccess.plan.maxOutputTokens,
        localPreviewRequestMaxOutputTokens,
      )
      assert.equal(localPreviewSuccess.executedRequests, 1)
      assert.equal(localPreviewSuccess.plan.maxRequests, 1)
    })
    check('Development policy with explicit authorization executes one mock request', () => {
      assert.equal(successCount, 1)
      assert.equal(success.executedRequests, 1)
      assert.equal(
        successRequestMaxOutputTokens,
        AI_CHART_D1_P1_MAX_OUTPUT_TOKENS,
      )
      assert.equal(success.plan.maxOutputTokens, successRequestMaxOutputTokens)
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
        await execute(
          fixture,
          localPreviewPlan,
          localPreviewAuthorization,
          environmentFor(localPreviewPlan),
          async () => ({
            data: createValidAiChartD1P1Result(fixture.modelInputs[0]),
            usage: null,
          }),
        )
      } finally {
        globalThis.fetch = originalFetch
      }
      assert.equal(globalFetchCount, 0)
    })

    const assertResponseRejectedOnce = async (
      name: string,
      responseFactory: () => unknown,
      expectedMessage: string,
    ) => {
      await asyncCheck(name, async () => {
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
                return responseFactory() as never
              },
            ),
          { message: expectedMessage },
        )
        assert.equal(requestCount, 1)
      })
    }

    for (const [name, mutate] of [
      [
        'Gate rejects raw mock data with a wrong callId after one request',
        (value: Mutable<AiChartD1P1Result>) => {
          value.callId = 'call:synthetic-wrong-response'
        },
      ],
      [
        'Gate rejects raw mock data with a wrong palace after one request',
        (value: Mutable<AiChartD1P1Result>) => {
          value.palaceId = fixture.modelInputs[1].targetPalaceId
          value.palace =
            fixture.modelInputs[1].structuralContext.targetPalace.canonicalName
        },
      ],
      [
        'Gate rejects raw mock data with a wrong primary major core after one request',
        (value: Mutable<AiChartD1P1Result>) => {
          value.primaryAxis.majorStarCore = ['紫微']
        },
      ],
      [
        'Gate rejects raw mock data with an unknown primary Rule after one request',
        (value: Mutable<AiChartD1P1Result>) => {
          value.primaryAxis.usedRuleIds = ['rule:unknown']
        },
      ],
    ] as const) {
      await assertResponseRejectedOnce(
        name,
        () => {
          const data = createValidAiChartD1P1Result(fixture.modelInputs[0])
          mutate(data)
          return { data, usage: null }
        },
        AI_CHART_D1_P1_ADAPTER_BRIDGE_RESULT_INVALID,
      )
    }
    await assertResponseRejectedOnce(
      'Gate rejects arbitrary casted mock data after one request',
      () => ({ data: { arbitrary: true }, usage: null }),
      AI_CHART_D1_P1_ADAPTER_BRIDGE_RESULT_INVALID,
    )

    await assertResponseRejectedOnce(
      'Response wrapper extra field is rejected after one request',
      () => ({
        data: createValidAiChartD1P1Result(fixture.modelInputs[0]),
        usage: null,
        rawResponse: 'forbidden',
      }),
      AI_CHART_OPENAI_RESPONSE_INVALID,
    )
    let responseGetterCalls = 0
    await assertResponseRejectedOnce(
      'Response wrapper accessor is rejected without execution',
      () => {
        const value: Record<string, unknown> = { usage: null }
        Object.defineProperty(value, 'data', {
          enumerable: true,
          get() {
            responseGetterCalls += 1
            return createValidAiChartD1P1Result(fixture.modelInputs[0])
          },
        })
        return value
      },
      AI_CHART_OPENAI_RESPONSE_INVALID,
    )
    check('Response wrapper accessor getter was never executed', () => {
      assert.equal(responseGetterCalls, 0)
    })
    await assertResponseRejectedOnce(
      'Response wrapper symbol key is rejected after one request',
      () => {
        const value: Record<PropertyKey, unknown> = {
          data: createValidAiChartD1P1Result(fixture.modelInputs[0]),
          usage: null,
        }
        value[Symbol('forbidden')] = true
        return value
      },
      AI_CHART_OPENAI_RESPONSE_INVALID,
    )
    await assertResponseRejectedOnce(
      'Response wrapper cycle is rejected after one request',
      () => {
        const value: Record<string, unknown> = {
          data: createValidAiChartD1P1Result(fixture.modelInputs[0]),
          usage: null,
        }
        value.loop = value
        return value
      },
      AI_CHART_OPENAI_RESPONSE_INVALID,
    )
    await assertResponseRejectedOnce(
      'Response wrapper missing usage is rejected after one request',
      () => ({ data: createValidAiChartD1P1Result(fixture.modelInputs[0]) }),
      AI_CHART_OPENAI_RESPONSE_INVALID,
    )
    await assertResponseRejectedOnce(
      'Null response wrapper is rejected after one request',
      () => null,
      AI_CHART_OPENAI_RESPONSE_INVALID,
    )

    await asyncCheck('Usage null is accepted and remains null', async () => {
      let requestCount = 0
      const result = await execute(
        fixture,
        plan,
        authorization,
        environmentFor(plan),
        async () => {
          requestCount += 1
          return {
            data: createValidAiChartD1P1Result(fixture.modelInputs[0]),
            usage: null,
          }
        },
      )
      assert.equal(requestCount, 1)
      assert.equal(result.usage, null)
    })

    for (const [name, usage] of [
      ['negative token', { inputTokens: -1, outputTokens: 2, reasoningTokens: 3, totalTokens: 4 }],
      ['fractional token', { inputTokens: 1.5, outputTokens: 2, reasoningTokens: 3, totalTokens: 4 }],
      ['NaN token', { inputTokens: Number.NaN, outputTokens: 2, reasoningTokens: 3, totalTokens: 4 }],
      ['infinite token', { inputTokens: 1, outputTokens: Number.POSITIVE_INFINITY, reasoningTokens: 3, totalTokens: 4 }],
      ['missing token field', { inputTokens: 1, outputTokens: 2, totalTokens: 4 }],
      ['extra token field', { inputTokens: 1, outputTokens: 2, reasoningTokens: 3, totalTokens: 4, cachedTokens: 1 }],
    ] as const) {
      await assertResponseRejectedOnce(
        `Usage ${name} is rejected after one request`,
        () => ({
          data: createValidAiChartD1P1Result(fixture.modelInputs[0]),
          usage,
        }),
        AI_CHART_OPENAI_RESPONSE_INVALID,
      )
    }

    let usageGetterCalls = 0
    await assertResponseRejectedOnce(
      'Usage accessor is rejected without execution',
      () => {
        const usage: Record<string, unknown> = {
          outputTokens: 2,
          reasoningTokens: 3,
          totalTokens: 4,
        }
        Object.defineProperty(usage, 'inputTokens', {
          enumerable: true,
          get() {
            usageGetterCalls += 1
            return 1
          },
        })
        return {
          data: createValidAiChartD1P1Result(fixture.modelInputs[0]),
          usage,
        }
      },
      AI_CHART_OPENAI_RESPONSE_INVALID,
    )
    check('Usage accessor getter was never executed', () => {
      assert.equal(usageGetterCalls, 0)
    })
    await assertResponseRejectedOnce(
      'Usage symbol key is rejected after one request',
      () => {
        const usage: Record<PropertyKey, unknown> = {
          inputTokens: 1,
          outputTokens: 2,
          reasoningTokens: 3,
          totalTokens: 4,
        }
        usage[Symbol('forbidden')] = true
        return {
          data: createValidAiChartD1P1Result(fixture.modelInputs[0]),
          usage,
        }
      },
      AI_CHART_OPENAI_RESPONSE_INVALID,
    )
    await assertResponseRejectedOnce(
      'Usage cycle is rejected after one request',
      () => {
        const usage: Record<string, unknown> = {
          inputTokens: 1,
          outputTokens: 2,
          reasoningTokens: 3,
          totalTokens: 4,
        }
        usage.loop = usage
        return {
          data: createValidAiChartD1P1Result(fixture.modelInputs[0]),
          usage,
        }
      },
      AI_CHART_OPENAI_RESPONSE_INVALID,
    )

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

    for (const [name, overrides] of [
      ['production', { NODE_ENV: 'production' }],
      ['CI present', { CI: 'false' }],
      ['Vercel', { VERCEL: '1' }],
      ['Vercel environment', { VERCEL_ENV: 'preview' }],
    ] as const) {
      await asyncCheck(
        `Local Preview override rejects ${name} with zero requests`,
        async () => {
          let requestCount = 0
          await assert.rejects(
            () =>
              execute(
                fixture,
                localPreviewPlan,
                localPreviewAuthorization,
                environmentFor(localPreviewPlan, overrides),
                async () => {
                  requestCount += 1
                  return successRequest(fixture.bridges[0].request)
                },
              ),
            { message: AI_CHART_D1_P1_PREVIEW_GATE_PRODUCTION_FORBIDDEN },
          )
          assert.equal(requestCount, 0)
        },
      )
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
            async () => {
              requestCount += 1
              const result = createValidAiChartD1P1Result(fixture.modelInputs[0])
              result.primaryAxis.majorStarCore = ['紫微']
              return { data: result, usage: null }
            },
          ),
        { message: AI_CHART_D1_P1_ADAPTER_BRIDGE_RESULT_INVALID },
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
    const relativeProductionFiles = productionFiles.map((path) =>
      relative(repositoryRoot, path),
    )

    check('Preview Gate file starts with the exact server-only import', () => {
      assert.equal(gateSource.split('\n')[0], "import 'server-only'")
    })
    check('default Adapter Bridge builder production consumer is only Preview Gate', () => {
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
    check('Report OpenAI Runtime Bridge builder production consumers are only Report pipeline and Report runtime', () => {
      const consumers = productionFiles
        .filter((path) =>
          readFileSync(path, 'utf8').includes(
            'buildAiChartD1P1ReportOpenAiRuntimeAdapterBridges',
          ),
        )
        .map((path) => relative(repositoryRoot, path))
        .filter((path) => !path.endsWith('d1P1AdapterBridge.ts'))
      assert.deepEqual(consumers, [
        'src/lib/ai-chart/d1P1ReportOpenAiRuntime.server.ts',
        'src/lib/ai-chart/reportGenerationPipeline.ts',
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
      ['src/app', /^src\/app\//u],
      ['API Route', /\/route\.ts$/u],
      ['Report', /report/iu],
      ['Supabase', /supabase/iu],
      ['Payment', /payment/iu],
      ['Cron or background', /cron|background/iu],
    ] as const) {
      check(`${name} Preview Gate forbidden scope matches production files`, () => {
        assert.equal(
          relativeProductionFiles.some((path) => matcher.test(path)),
          true,
        )
      })
      check(`${name} imports zero Preview Gate modules`, () => {
        assert.equal(
          relativeProductionFiles
            .filter((path) => matcher.test(path))
            .some((path) =>
              readFileSync(join(repositoryRoot, path), 'utf8').includes(
                'd1P1PreviewRequestGate',
              ),
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
