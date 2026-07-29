import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import Module, { createRequire } from 'node:module'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  createAiChartD1PalaceWritingResultSha256,
  validateAiChartD1PalaceWritingResultAgainstPromptPackage,
  type AiChartD1PalaceWritingResult,
} from './d1PalaceWritingResultContracts'
import {
  AI_CHART_D1_PALACE_WRITING_FIDELITY_REVIEW_TASK,
  AI_CHART_D1_PALACE_WRITING_FIDELITY_REVIEW_VERSION,
} from './d1PalaceWritingFidelityReviewContracts'
import {
  buildAiChartD1PalaceWritingGoldenCase,
} from './d1PalaceWritingGoldenCaseContracts'
import {
  buildAiChartD1PalaceWritingPreviewPlan,
} from './d1PalaceWritingPreviewContracts'

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

let serverModule:
  typeof import('./d1PalaceWritingPreviewRuntimePort.server')

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
  serverModule = testRequire(
    './d1PalaceWritingPreviewRuntimePort.server',
  ) as typeof import(
    './d1PalaceWritingPreviewRuntimePort.server'
  )
} finally {
  moduleInternals._resolveFilename = originalResolveFilename
  moduleInternals._load = originalLoad
}

const {
  AiChartD1PalaceWritingPreviewRuntimePortError,
  probeAiChartD1PalaceWritingPreviewRuntimePort,
} = serverModule
type RuntimePortCommand = import(
  './d1PalaceWritingPreviewRuntimePort.server'
).AiChartD1PalaceWritingPreviewRuntimePortCommand

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
  if (
    value === null ||
    typeof value !== 'object'
  ) {
    return true
  }
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

function createAlternativeWritingResult():
  AiChartD1PalaceWritingResult {
  const value = structuredClone(
    goldenCase.expectedWritingResult,
  ) as unknown as {
    sections: Array<{
      contentCellRef: string
      facetId: string
      customerText: string
    }>
  }
  value.sections[0].customerText =
    '命宮的紫微重視尊重、面子與主導感，所以你可能希望自己的決定被認真看待；這是人格傾向，不代表每次都一定如此。'
  return validateAiChartD1PalaceWritingResultAgainstPromptPackage(
    value,
    goldenCase.writingPromptPackage,
  )
}

function createApprovedReview(
  writingResult: AiChartD1PalaceWritingResult,
): unknown {
  return {
    contractVersion:
      AI_CHART_D1_PALACE_WRITING_FIDELITY_REVIEW_VERSION,
    task:
      AI_CHART_D1_PALACE_WRITING_FIDELITY_REVIEW_TASK,
    fidelityReviewId:
      'palace-writing-review:palace:ming:runtime-port-v1',
    chartId: writingResult.chartId,
    runId: writingResult.runId,
    callId: writingResult.callId,
    targetPalaceId: writingResult.targetPalaceId,
    sourcePackageFingerprint:
      writingResult.sourcePackageFingerprint,
    sourceWritingResultVersion: writingResult.contractVersion,
    sourceWritingResultSha256:
      createAiChartD1PalaceWritingResultSha256(writingResult),
    sectionReviews: writingResult.sections.map((section) => ({
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

async function run(): Promise<void> {
await check('runtime port probe exposes the exact validated stage request in Writing then Fidelity order', async () => {
  const writingResult = createAlternativeWritingResult()
  const commands: RuntimePortCommand[] = []
  const result =
    await probeAiChartD1PalaceWritingPreviewRuntimePort({
      previewPlan,
      goldenCase,
      executeStage: async (command) => {
        commands.push(command)
        if (command.stage === 'WRITING') {
          return {
            status: 'SUCCEEDED',
            durationMs: 12,
            usage: WRITING_USAGE,
            output: writingResult,
          }
        }
        return {
          status: 'SUCCEEDED',
          durationMs: 8,
          usage: REVIEW_USAGE,
          output: createApprovedReview(writingResult),
        }
      },
    })

  assert.deepEqual(
    commands.map((command) => [
      command.sequence,
      command.stage,
      command.runtimeMode,
    ]),
    [
      [1, 'WRITING', 'INJECTED_PORT_PROBE_ONLY'],
      [2, 'FIDELITY_REVIEW', 'INJECTED_PORT_PROBE_ONLY'],
    ],
  )
  assert.equal(
    commands[0].bridgeFingerprint,
    previewPlan.stages[0].bridgeFingerprint,
  )
  assert.notEqual(
    commands[1].bridgeFingerprint,
    previewPlan.stages[1].bridgeFingerprint,
  )
  for (const command of commands) {
    assert.deepEqual(
      Object.keys(command.request).sort(),
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
    assert.equal(
      Object.hasOwn(command.request, 'apiKey'),
      false,
    )
    assert.equal(
      Object.hasOwn(command.request, 'authorization'),
      false,
    )
    assert.equal(
      Object.hasOwn(command.request, 'model'),
      false,
    )
    assert.equal(recursivelyFrozen(command), true)
  }
  assert.equal(result.status, 'PROBE_SUCCEEDED')
  assert.equal(result.completedStage, 'COMPLETE')
  assert.equal(result.portInvocations, 2)
  assert.equal(result.attemptedRequests, 0)
  assert.equal(result.executedRequests, 0)
  assert.equal(result.fetchCount, 0)
  assert.equal(result.openAiRequests, 0)
  assert.equal(result.retryPerformed, false)
  assert.equal(
    result.customerDeliveryStatus,
    'BLOCKED_PORT_PROBE_ONLY',
  )
  assert.equal(
    JSON.stringify(result).includes(
      writingResult.sections[0].customerText,
    ),
    false,
  )
  assert.equal(recursivelyFrozen(result), true)
})

await check('invalid plan fails before the injected port is invoked', async () => {
  let calls = 0
  await assert.rejects(
    probeAiChartD1PalaceWritingPreviewRuntimePort({
      previewPlan: {
        ...previewPlan,
        retry: true,
      },
      goldenCase,
      executeStage: async () => {
        calls += 1
        return {
          status: 'REQUEST_FAILED',
          durationMs: 1,
          usage: null,
        }
      },
    }),
    AiChartD1PalaceWritingPreviewRuntimePortError,
  )
  assert.equal(calls, 0)
})

await check('injected port probe fails before adapter invocation outside the canonical test environment', async () => {
  let calls = 0
  const mutableEnvironment = process.env as Record<
    string,
    string | undefined
  >
  const originalNodeEnvironment = mutableEnvironment.NODE_ENV
  try {
    mutableEnvironment.NODE_ENV = 'production'
    await assert.rejects(
      probeAiChartD1PalaceWritingPreviewRuntimePort({
        previewPlan,
        goldenCase,
        executeStage: async () => {
          calls += 1
          return {
            status: 'REQUEST_FAILED',
            durationMs: 1,
            usage: null,
          }
        },
      }),
      AiChartD1PalaceWritingPreviewRuntimePortError,
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

await check('Writing transport failure is sanitized, single-shot, and stops before Fidelity Review', async () => {
  const calls: string[] = []
  const result =
    await probeAiChartD1PalaceWritingPreviewRuntimePort({
      previewPlan,
      goldenCase,
      executeStage: async (command) => {
        calls.push(command.stage)
        throw new Error('sensitive provider error body')
      },
    })

  assert.deepEqual(calls, ['WRITING'])
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
    JSON.stringify(result).includes(
      'sensitive provider error body',
    ),
    false,
  )
})

await check('invalid Writing output is rejected by the production parser before Fidelity Review', async () => {
  let calls = 0
  const result =
    await probeAiChartD1PalaceWritingPreviewRuntimePort({
      previewPlan,
      goldenCase,
      executeStage: async () => {
        calls += 1
        return {
          status: 'SUCCEEDED',
          durationMs: 5,
          usage: WRITING_USAGE,
          output: {
            outputText: 'sensitive unvalidated model output',
          },
        }
      },
    })

  assert.equal(calls, 1)
  assert.equal(
    result.stages[0].errorCode,
    'WRITING_OUTPUT_INVALID',
  )
  assert.equal(result.stages[1].status, 'NOT_STARTED')
  assert.equal(
    JSON.stringify(result).includes(
      'sensitive unvalidated model output',
    ),
    false,
  )
})

await check('Fidelity failure keeps Writing success but does not retry or expose provider text', async () => {
  const writingResult = createAlternativeWritingResult()
  const calls: string[] = []
  const result =
    await probeAiChartD1PalaceWritingPreviewRuntimePort({
      previewPlan,
      goldenCase,
      executeStage: async (command) => {
        calls.push(command.stage)
        if (command.stage === 'WRITING') {
          return {
            status: 'SUCCEEDED',
            durationMs: 5,
            usage: WRITING_USAGE,
            output: writingResult,
          }
        }
        throw new Error('sensitive fidelity provider text')
      },
    })

  assert.deepEqual(calls, ['WRITING', 'FIDELITY_REVIEW'])
  assert.equal(result.status, 'PROBE_FAILED')
  assert.equal(result.completedStage, 'FIDELITY_REVIEW')
  assert.equal(result.portInvocations, 2)
  assert.equal(result.stages[0].status, 'SIMULATED_SUCCEEDED')
  assert.equal(
    result.stages[1].errorCode,
    'FIDELITY_REVIEW_REQUEST_FAILED',
  )
  assert.equal(result.retryPerformed, false)
  assert.equal(
    JSON.stringify(result).includes(
      'sensitive fidelity provider text',
    ),
    false,
  )
})

await check('malformed port outcome fails closed without preserving arbitrary metadata', async () => {
  await assert.rejects(
    probeAiChartD1PalaceWritingPreviewRuntimePort({
      previewPlan,
      goldenCase,
      executeStage: async () =>
        ({
          status: 'UNSAFE_DYNAMIC_STATUS',
          providerMessage: 'sensitive arbitrary metadata',
        }) as never,
    }),
    AiChartD1PalaceWritingPreviewRuntimePortError,
  )
})

await check('runtime port module has no transport, secret, persistence, retry, fallback, handoff consumption, or consumer beyond the offline adapter probe', () => {
  const source = readFileSync(
    fileURLToPath(
      new URL(
        './d1PalaceWritingPreviewRuntimePort.server.ts',
        import.meta.url,
      ),
    ),
    'utf8',
  )
  assert.doesNotMatch(
    source,
    /fetch\s*\(|OPENAI_API_KEY|Authorization\s*:|Bearer\s|requestAiChartOpenAiStructuredResponse|openAiResponses\.server|consumeAiChartD1PalaceWritingPreviewRuntimeHandoff|Promise\.all|retry\s*\(|fallback|writeFile|appendFile|unlink\s*\(|\brm\s*\(|rename\s*\(/,
  )
  assert.match(
    source,
    /process\.env\.NODE_ENV !== 'test'/,
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
          'd1PalaceWritingPreviewRuntimePort.server.ts',
        ) &&
        !path.endsWith(
          'd1PalaceWritingPreviewRuntimePort.server.test.ts',
        ) &&
        !path.endsWith(
          'd1PalaceWritingPreviewProductionAdapter.server.test.ts',
        ),
    )
    .filter((path) =>
      readFileSync(join(sourceRoot, path), 'utf8').includes(
        'd1PalaceWritingPreviewRuntimePort.server',
      ),
    )
  assert.deepEqual(consumers, [
    'lib/ai-chart/d1PalaceWritingPreviewProductionAdapter.server.ts',
  ])
})

console.log(
  `AI Chart D1 palace-writing runtime port checks passed: ${checks}`,
)
}

void run()
