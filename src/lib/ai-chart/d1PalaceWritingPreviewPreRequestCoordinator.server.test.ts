import assert from 'node:assert/strict'
import {
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
    'ai-chart-d1-palace-writing-coordinator-suite-',
  ),
)
process.env.TMPDIR = suiteRoot
const claimStorageRoot = join(
  suiteRoot,
  'ai-chart-d1-palace-writing-preview-claims',
)

let serverModule:
  typeof import('./d1PalaceWritingPreviewPreRequestCoordinator.server')

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
    './d1PalaceWritingPreviewPreRequestCoordinator.server',
  ) as typeof import(
    './d1PalaceWritingPreviewPreRequestCoordinator.server'
  )
} finally {
  moduleInternals._resolveFilename = originalResolveFilename
  moduleInternals._load = originalLoad
}

const {
  coordinateAiChartD1PalaceWritingPreviewPreRequest,
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

function isNodeErrorCode(
  value: unknown,
  code: string,
): boolean {
  return (
    value instanceof Error &&
    'code' in value &&
    value.code === code
  )
}

async function run(): Promise<void> {
  await rm(claimStorageRoot, { recursive: true, force: true })
  try {
    const result =
      await coordinateAiChartD1PalaceWritingPreviewPreRequest(
        gatePlan,
        authorization,
      )

    assert.deepEqual(result, {
      contractVersion:
        'ai-chart-d1-palace-writing-preview-pre-request-coordinator/v1',
      task:
        'D1_PALACE_WRITING_PRE_REQUEST_COORDINATOR',
      gateFingerprint: gatePlan.gateFingerprint,
      claimArtifactName: 'request-started.json',
      status: 'CLAIMED_STOPPED',
      stage: 'ATOMIC_CLAIM_CREATED',
      authorizationConsumed: true,
      atomicClaimStatus: 'claimed',
      nextRequiredAction: 'STOP_BEFORE_REQUEST_RUNTIME',
      fetchAllowed: false,
      openAiCallable: false,
      attemptedRequests: 0,
      fetchCount: 0,
      openAiRequests: 0,
    })
    assert.equal(Object.isFrozen(result), true)
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
      '✓ legal pre-request coordination creates one claim and stops before request runtime',
    )

    const blocked =
      await coordinateAiChartD1PalaceWritingPreviewPreRequest(
        gatePlan,
        authorization,
      )
    assert.deepEqual(blocked, {
      contractVersion:
        'ai-chart-d1-palace-writing-preview-pre-request-coordinator/v1',
      task:
        'D1_PALACE_WRITING_PRE_REQUEST_COORDINATOR',
      gateFingerprint: gatePlan.gateFingerprint,
      claimArtifactName: 'request-started.json',
      status: 'BLOCKED_ALREADY_CONSUMED',
      stage: 'CLAIM_ALREADY_EXISTS',
      authorizationConsumed: true,
      atomicClaimStatus: 'claimed',
      nextRequiredAction: 'STOP',
      fetchAllowed: false,
      openAiCallable: false,
      attemptedRequests: 0,
      fetchCount: 0,
      openAiRequests: 0,
    })
    assert.equal(Object.isFrozen(blocked), true)
    console.log(
      '✓ existing claim returns one safe blocked result without re-claiming',
    )

    await rm(claimStorageRoot, { recursive: true, force: true })
    const concurrent = await Promise.all([
      coordinateAiChartD1PalaceWritingPreviewPreRequest(
        gatePlan,
        authorization,
      ),
      coordinateAiChartD1PalaceWritingPreviewPreRequest(
        gatePlan,
        authorization,
      ),
    ])
    assert.deepEqual(
      concurrent.map((result) => result.status).sort(),
      ['BLOCKED_ALREADY_CONSUMED', 'CLAIMED_STOPPED'],
    )
    for (const result of concurrent) {
      assert.equal(result.fetchAllowed, false)
      assert.equal(result.openAiCallable, false)
      assert.equal(result.attemptedRequests, 0)
      assert.equal(result.fetchCount, 0)
      assert.equal(result.openAiRequests, 0)
      assert.equal(Object.isFrozen(result), true)
    }
    console.log(
      '✓ concurrent coordinators return one claimed result and one blocked result',
    )

    await rm(claimStorageRoot, { recursive: true, force: true })
    await assert.rejects(
      coordinateAiChartD1PalaceWritingPreviewPreRequest(
        gatePlan,
        {
          ...authorization,
          gateFingerprint: '0'.repeat(64),
        },
      ),
      AiChartD1PalaceWritingPreviewGateError,
    )
    await assert.rejects(
      lstat(claimStorageRoot),
      (error: unknown) => isNodeErrorCode(error, 'ENOENT'),
    )
    console.log(
      '✓ invalid authorization fails before coordinator storage mutation',
    )

    await mkdir(claimStorageRoot, { mode: 0o755 })
    await chmod(claimStorageRoot, 0o755)
    await assert.rejects(
      coordinateAiChartD1PalaceWritingPreviewPreRequest(
        gatePlan,
        authorization,
      ),
      (error: unknown) =>
        error instanceof Error &&
        'code' in error &&
        error.code ===
          'ai_chart_d1_palace_writing_preview_claim_storage_invalid',
    )
    console.log(
      '✓ unsafe storage metadata remains a fixed fail-closed error',
    )

    const source = readFileSync(
      fileURLToPath(
        new URL(
          './d1PalaceWritingPreviewPreRequestCoordinator.server.ts',
          import.meta.url,
        ),
      ),
      'utf8',
    )
    assert.equal(source.split('\n')[0], "import 'server-only'")
    assert.doesNotMatch(
      source,
      /fetch\s*\(|OPENAI_API_KEY|Authorization\s*:|Bearer\s|requestAiChartOpenAiStructuredResponse|Promise\.all|retry|fallback|unlink\s*\(|\brm\s*\(|rename\s*\(/,
    )
    console.log(
      '✓ coordinator has no request, secret, retry, parallel-fetch, or deletion path',
    )
    console.log(
      'AI Chart D1 palace-writing pre-request coordinator checks passed: 6',
    )
  } finally {
    await rm(claimStorageRoot, { recursive: true, force: true })
  }
}

void run().finally(async () => {
  if (originalTmpdirEnvironment === undefined) {
    delete process.env.TMPDIR
  } else {
    process.env.TMPDIR = originalTmpdirEnvironment
  }
  await rm(suiteRoot, { recursive: true, force: true })
})
