import assert from 'node:assert/strict'
import {
  existsSync,
  mkdtempSync,
  readFileSync,
} from 'node:fs'
import {
  chmod,
  lstat,
  mkdir,
  rm,
} from 'node:fs/promises'
import Module, { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildAiChartD1PalaceWritingGoldenCase,
} from './d1PalaceWritingGoldenCaseContracts'
import {
  AI_CHART_D1_PALACE_WRITING_PREVIEW_AUTHORIZATION_ACKNOWLEDGEMENT,
  AI_CHART_D1_PALACE_WRITING_PREVIEW_AUTHORIZATION_MODE,
  AI_CHART_D1_PALACE_WRITING_PREVIEW_AUTHORIZATION_TASK,
  AI_CHART_D1_PALACE_WRITING_PREVIEW_AUTHORIZATION_VERSION,
  AiChartD1PalaceWritingPreviewGateError,
  buildAiChartD1PalaceWritingPreviewGatePlan,
} from './d1PalaceWritingPreviewGateContracts'
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
const originalTemporaryDirectory = tmpdir()
const originalTmpdirEnvironment = process.env.TMPDIR
const suiteRoot = mkdtempSync(
  join(
    originalTemporaryDirectory,
    'ai-chart-d1-palace-writing-runtime-handoff-suite-',
  ),
)
process.env.TMPDIR = suiteRoot
const claimStorageRoot = join(
  suiteRoot,
  'ai-chart-d1-palace-writing-preview-claims',
)

let serverModule:
  typeof import('./d1PalaceWritingPreviewRuntimeHandoff.server')

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
    './d1PalaceWritingPreviewRuntimeHandoff.server',
  ) as typeof import(
    './d1PalaceWritingPreviewRuntimeHandoff.server'
  )
} finally {
  moduleInternals._resolveFilename = originalResolveFilename
  moduleInternals._load = originalLoad
}

const {
  AiChartD1PalaceWritingPreviewRuntimeHandoffAlreadyConsumedError,
  AiChartD1PalaceWritingPreviewRuntimeHandoffInvalidError,
  consumeAiChartD1PalaceWritingPreviewRuntimeHandoff,
  prepareAiChartD1PalaceWritingPreviewRuntimeHandoff,
} = serverModule

const previewPlan = buildAiChartD1PalaceWritingPreviewPlan(
  buildAiChartD1PalaceWritingGoldenCase(),
)
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

async function resetClaimStorage(): Promise<void> {
  await rm(claimStorageRoot, { recursive: true, force: true })
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

async function run(): Promise<void> {
  await resetClaimStorage()
  try {
    const prepared =
      await prepareAiChartD1PalaceWritingPreviewRuntimeHandoff(
        gatePlan,
        authorization,
      )

    assert.equal(prepared.status, 'READY_STOPPED')
    assert.equal(prepared.stage, 'RUNTIME_HANDOFF_CREATED')
    assert.equal(
      prepared.nextRequiredAction,
      'CONSUME_HANDOFF_ONCE',
    )
    assert.equal(prepared.fetchAllowed, false)
    assert.equal(prepared.openAiCallable, false)
    assert.equal(prepared.attemptedRequests, 0)
    assert.equal(prepared.fetchCount, 0)
    assert.equal(prepared.openAiRequests, 0)
    assert.equal(Object.isFrozen(prepared), true)
    assert.notEqual(prepared.handoff, null)
    assert.equal(Object.isFrozen(prepared.handoff), true)
    assert.deepEqual(prepared.handoff, {
      contractVersion:
        'ai-chart-d1-palace-writing-preview-runtime-handoff/v1',
      task:
        'D1_PALACE_WRITING_PREVIEW_RUNTIME_HANDOFF',
      fixtureId: gatePlan.fixtureId,
      caseFingerprint: gatePlan.caseFingerprint,
      previewPlanFingerprint: gatePlan.previewPlanFingerprint,
      gateFingerprint: gatePlan.gateFingerprint,
      claimArtifactName: 'request-started.json',
      status: 'READY_NOT_CONSUMED',
      capabilityScope: 'IN_PROCESS_EXACT_OBJECT_IDENTITY',
      authorizationConsumed: true,
      atomicClaimStatus: 'claimed',
      runtimeAdapterStatus: 'not_implemented',
      fetchAllowed: false,
      openAiCallable: false,
      attemptedRequests: 0,
      fetchCount: 0,
      openAiRequests: 0,
    })
    const claimMetadata = await lstat(
      join(
        claimStorageRoot,
        gatePlan.gateFingerprint,
        gatePlan.claimArtifactName,
      ),
    )
    assert.equal(claimMetadata.isFile(), true)
    assert.equal(claimMetadata.mode & 0o777, 0o600)
    console.log(
      '✓ successful atomic claim creates one frozen in-process runtime handoff',
    )

    const blocked =
      await prepareAiChartD1PalaceWritingPreviewRuntimeHandoff(
        gatePlan,
        authorization,
      )
    assert.deepEqual(blocked, {
      contractVersion:
        'ai-chart-d1-palace-writing-preview-runtime-handoff-preparation/v1',
      task:
        'D1_PALACE_WRITING_PREVIEW_RUNTIME_HANDOFF_PREPARATION',
      gateFingerprint: gatePlan.gateFingerprint,
      status: 'BLOCKED_ALREADY_CONSUMED',
      stage: 'CLAIM_ALREADY_EXISTS',
      authorizationConsumed: true,
      atomicClaimStatus: 'claimed',
      nextRequiredAction: 'STOP',
      handoff: null,
      fetchAllowed: false,
      openAiCallable: false,
      attemptedRequests: 0,
      fetchCount: 0,
      openAiRequests: 0,
    })
    assert.equal(Object.isFrozen(blocked), true)
    console.log(
      '✓ existing atomic claim returns a frozen blocked result without a handoff',
    )

    const handoff = await prepareFreshHandoff()
    const fieldEquivalentCopy = { ...handoff }
    const structuredCopy = structuredClone(handoff)
    assert.throws(
      () =>
        consumeAiChartD1PalaceWritingPreviewRuntimeHandoff(
          fieldEquivalentCopy,
        ),
      AiChartD1PalaceWritingPreviewRuntimeHandoffInvalidError,
    )
    assert.throws(
      () =>
        consumeAiChartD1PalaceWritingPreviewRuntimeHandoff(
          structuredCopy,
        ),
      AiChartD1PalaceWritingPreviewRuntimeHandoffInvalidError,
    )
    const consumed =
      consumeAiChartD1PalaceWritingPreviewRuntimeHandoff(handoff)
    assert.deepEqual(consumed, {
      contractVersion:
        'ai-chart-d1-palace-writing-preview-runtime-handoff-consumption/v1',
      task:
        'D1_PALACE_WRITING_PREVIEW_RUNTIME_HANDOFF_CONSUMPTION',
      fixtureId: gatePlan.fixtureId,
      caseFingerprint: gatePlan.caseFingerprint,
      previewPlanFingerprint: gatePlan.previewPlanFingerprint,
      gateFingerprint: gatePlan.gateFingerprint,
      status: 'CONSUMED_STOPPED',
      stage: 'RUNTIME_HANDOFF_CONSUMED',
      capabilityScope: 'IN_PROCESS_EXACT_OBJECT_IDENTITY',
      authorizationConsumed: true,
      atomicClaimStatus: 'claimed',
      runtimeAdapterStatus: 'not_implemented',
      nextRequiredAction:
        'STOP_BEFORE_PRODUCTION_RUNTIME_ADAPTER',
      fetchAllowed: false,
      openAiCallable: false,
      attemptedRequests: 0,
      fetchCount: 0,
      openAiRequests: 0,
    })
    assert.equal(Object.isFrozen(consumed), true)
    assert.throws(
      () =>
        consumeAiChartD1PalaceWritingPreviewRuntimeHandoff(handoff),
      AiChartD1PalaceWritingPreviewRuntimeHandoffAlreadyConsumedError,
    )
    console.log(
      '✓ copied handoffs are rejected while the exact handoff can be consumed only once',
    )

    const concurrentHandoff = await prepareFreshHandoff()
    const concurrent = await Promise.allSettled([
      Promise.resolve().then(() =>
        consumeAiChartD1PalaceWritingPreviewRuntimeHandoff(
          concurrentHandoff,
        ),
      ),
      Promise.resolve().then(() =>
        consumeAiChartD1PalaceWritingPreviewRuntimeHandoff(
          concurrentHandoff,
        ),
      ),
    ])
    assert.equal(
      concurrent.filter((result) => result.status === 'fulfilled')
        .length,
      1,
    )
    assert.equal(
      concurrent.filter((result) => result.status === 'rejected')
        .length,
      1,
    )
    const rejected = concurrent.find(
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
    console.log(
      '✓ two concurrent consumers allow exactly one in-process handoff consumption',
    )

    await resetClaimStorage()
    await assert.rejects(
      prepareAiChartD1PalaceWritingPreviewRuntimeHandoff(
        gatePlan,
        {
          ...authorization,
          gateFingerprint: '0'.repeat(64),
        },
      ),
      AiChartD1PalaceWritingPreviewGateError,
    )
    assert.equal(existsSync(claimStorageRoot), false)
    console.log(
      '✓ invalid authorization fails before claim storage or handoff creation',
    )

    await mkdir(claimStorageRoot, { mode: 0o700 })
    await chmod(claimStorageRoot, 0o755)
    await assert.rejects(
      prepareAiChartD1PalaceWritingPreviewRuntimeHandoff(
        gatePlan,
        authorization,
      ),
      (error: unknown) =>
        error instanceof Error &&
        'code' in error &&
        error.code ===
          'ai_chart_d1_palace_writing_preview_claim_storage_invalid',
    )
    assert.equal((await lstat(claimStorageRoot)).mode & 0o777, 0o755)
    console.log(
      '✓ unsafe atomic claim storage fails closed without a runtime handoff',
    )

    const source = readFileSync(
      fileURLToPath(
        new URL(
          './d1PalaceWritingPreviewRuntimeHandoff.server.ts',
          import.meta.url,
        ),
      ),
      'utf8',
    )
    assert.equal(source.split('\n')[0], "import 'server-only'")
    assert.equal(/\bfetch\s*\(/u.test(source), false)
    assert.equal(/\bPromise\.all\b/u.test(source), false)
    assert.equal(/\bOPENAI_API_KEY\b/u.test(source), false)
    assert.equal(/\bAuthorization\b/u.test(source), false)
    assert.equal(/\bretry\b/u.test(source), false)
    assert.equal(/\bfallback\b/ui.test(source), false)
    assert.equal(/\b(?:rm|unlink|rename|writeFile|open)\s*\(/u.test(source), false)
    assert.equal(
      /requestAiChartOpenAiStructuredResponse/u.test(source),
      false,
    )
    console.log(
      '✓ server-only handoff has no request, secret, retry, deletion, or direct storage path',
    )

    assert.equal(
      moduleInternals._resolveFilename,
      originalResolveFilename,
    )
    assert.equal(moduleInternals._load, originalLoad)
    console.log(
      '✓ server-only interception is restored after handoff module loading',
    )
  } finally {
    await chmod(claimStorageRoot, 0o700).catch(() => undefined)
    await resetClaimStorage()
    await rm(suiteRoot, { recursive: true, force: true })
    if (originalTmpdirEnvironment === undefined) {
      delete process.env.TMPDIR
    } else {
      process.env.TMPDIR = originalTmpdirEnvironment
    }
  }
}

run().catch((error) => {
  const code =
    error instanceof Error && 'code' in error
      ? String(error.code)
      : 'AI_CHART_D1_PALACE_WRITING_PREVIEW_RUNTIME_HANDOFF_TEST_FAILED'
  console.error(`✗ ${code}`)
  process.exitCode = 1
})
