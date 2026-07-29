import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync } from 'node:fs'
import {
  chmod,
  lstat,
  mkdir,
  readFile,
  readdir,
  rm,
  symlink,
  unlink,
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
    'ai-chart-d1-palace-writing-atomic-suite-',
  ),
)
process.env.TMPDIR = suiteRoot
const claimStorageRoot = join(
  suiteRoot,
  'ai-chart-d1-palace-writing-preview-claims',
)

let serverModule:
  typeof import('./d1PalaceWritingPreviewAtomicClaim.server')

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
    './d1PalaceWritingPreviewAtomicClaim.server',
  ) as typeof import('./d1PalaceWritingPreviewAtomicClaim.server')
} finally {
  moduleInternals._resolveFilename = originalResolveFilename
  moduleInternals._load = originalLoad
}

const {
  AI_CHART_D1_PALACE_WRITING_PREVIEW_CLAIM_ALREADY_EXISTS,
  AI_CHART_D1_PALACE_WRITING_PREVIEW_CLAIM_STORAGE_INVALID,
  AiChartD1PalaceWritingPreviewClaimAlreadyExistsError,
  AiChartD1PalaceWritingPreviewClaimStorageError,
  claimAiChartD1PalaceWritingPreviewExecution,
  observeAiChartD1PalaceWritingPreviewClaim,
} = serverModule

let checks = 0

async function check(
  name: string,
  run: () => Promise<void>,
): Promise<void> {
  await run()
  checks += 1
  console.log(`✓ ${name}`)
}

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

function sha256(value: Buffer): string {
  return createHash('sha256').update(value).digest('hex')
}

async function run(): Promise<void> {
  await check(
    'two concurrent claimants admit exactly one execution and reject the other as consumed',
    async () => {
      await rm(claimStorageRoot, { recursive: true, force: true })
      try {
        const attempts = await Promise.allSettled([
          claimAiChartD1PalaceWritingPreviewExecution(
            gatePlan,
            authorization,
          ),
          claimAiChartD1PalaceWritingPreviewExecution(
            gatePlan,
            authorization,
          ),
        ])
        const fulfilled = attempts.filter(
          (attempt) => attempt.status === 'fulfilled',
        )
        const rejected = attempts.filter(
          (attempt) => attempt.status === 'rejected',
        )

        assert.equal(fulfilled.length, 1)
        assert.equal(rejected.length, 1)
        if (fulfilled[0]?.status !== 'fulfilled') {
          assert.fail('expected one fulfilled atomic claim')
        }
        assert.equal(fulfilled[0].value.status, 'CLAIMED')
        assert.equal(fulfilled[0].value.authorizationConsumed, true)
        assert.equal(fulfilled[0].value.fetchAllowed, false)
        assert.equal(fulfilled[0].value.openAiCallable, false)
        assert.equal(fulfilled[0].value.attemptedRequests, 0)
        assert.equal(fulfilled[0].value.fetchCount, 0)
        assert.equal(fulfilled[0].value.openAiRequests, 0)

        if (rejected[0]?.status !== 'rejected') {
          assert.fail('expected one rejected atomic claim')
        }
        assert.equal(
          rejected[0].reason instanceof
            AiChartD1PalaceWritingPreviewClaimAlreadyExistsError,
          true,
        )
        assert.equal(
          rejected[0].reason.code,
          AI_CHART_D1_PALACE_WRITING_PREVIEW_CLAIM_ALREADY_EXISTS,
        )
        assert.deepEqual(
          Object.keys(rejected[0].reason).sort(),
          ['code', 'name'],
        )
      } finally {
        await rm(claimStorageRoot, { recursive: true, force: true })
      }
    },
  )

  await check(
    'trusted observation is absent before claim and present after claim without granting fetch',
    async () => {
      await rm(claimStorageRoot, { recursive: true, force: true })
      try {
        const before =
          await observeAiChartD1PalaceWritingPreviewClaim(
            gatePlan,
          )
        assert.equal(before.authority, 'TRUSTED_ATOMIC_STORAGE_ADAPTER')
        assert.equal(before.state, 'ABSENT')
        assert.equal(Object.isFrozen(before), true)

        await claimAiChartD1PalaceWritingPreviewExecution(
          gatePlan,
          authorization,
        )

        const after =
          await observeAiChartD1PalaceWritingPreviewClaim(
            gatePlan,
          )
        assert.equal(after.authority, 'TRUSTED_ATOMIC_STORAGE_ADAPTER')
        assert.equal(after.state, 'PRESENT')
        assert.equal(after.gateFingerprint, gatePlan.gateFingerprint)
        assert.equal(
          after.claimArtifactName,
          gatePlan.claimArtifactName,
        )
        assert.equal(Object.isFrozen(after), true)
        assert.equal(
          'fetchAllowed' in after ||
            'openAiCallable' in after ||
            'attemptedRequests' in after,
          false,
        )
      } finally {
        await rm(claimStorageRoot, { recursive: true, force: true })
      }
    },
  )

  await check(
    'claim artifact is private, safe, immutable, and never overwritten by a second claimant',
    async () => {
      await rm(claimStorageRoot, { recursive: true, force: true })
      try {
        const claim =
          await claimAiChartD1PalaceWritingPreviewExecution(
            gatePlan,
            authorization,
          )
        const claimDirectory = join(
          claimStorageRoot,
          gatePlan.gateFingerprint,
        )
        const claimPath = join(
          claimDirectory,
          gatePlan.claimArtifactName,
        )
        const directoryMetadata = await lstat(claimDirectory)
        const fileMetadata = await lstat(claimPath)
        const before = await readFile(claimPath)
        const parsed = JSON.parse(before.toString('utf8')) as unknown
        const serialized = JSON.stringify(parsed)

        assert.equal(directoryMetadata.isDirectory(), true)
        assert.equal(directoryMetadata.isSymbolicLink(), false)
        assert.equal(directoryMetadata.mode & 0o777, 0o700)
        assert.equal(fileMetadata.isFile(), true)
        assert.equal(fileMetadata.isSymbolicLink(), false)
        assert.equal(fileMetadata.mode & 0o777, 0o600)
        assert.deepEqual(parsed, claim)
        assert.deepEqual(Object.keys(parsed as object).sort(), [
          'attemptedRequests',
          'authority',
          'authorizationConsumed',
          'claimArtifactName',
          'contractVersion',
          'fetchAllowed',
          'fetchCount',
          'gateFingerprint',
          'nextRequiredAction',
          'openAiCallable',
          'openAiRequests',
          'status',
          'task',
        ])

        for (const forbidden of [
          'apiKey',
          'authorizationHeader',
          'bearer',
          'prompt',
          'instructions',
          'userInput',
          'requestBody',
          'outputText',
          'output_text',
          'chartSnapshot',
          'birthDate',
          'birthTime',
          AI_CHART_D1_PALACE_WRITING_PREVIEW_AUTHORIZATION_ACKNOWLEDGEMENT,
        ]) {
          assert.equal(
            serialized
              .toLowerCase()
              .includes(forbidden.toLowerCase()),
            false,
          )
        }

        await assert.rejects(
          claimAiChartD1PalaceWritingPreviewExecution(
            gatePlan,
            authorization,
          ),
          AiChartD1PalaceWritingPreviewClaimAlreadyExistsError,
        )
        const after = await readFile(claimPath)
        assert.equal(sha256(after), sha256(before))
      } finally {
        await rm(claimStorageRoot, { recursive: true, force: true })
      }
    },
  )

  await check(
    'invalid authorization fails before creating the storage root',
    async () => {
      await rm(claimStorageRoot, { recursive: true, force: true })
      const invalidAuthorization = {
        ...authorization,
        gateFingerprint: '0'.repeat(64),
      }

      await assert.rejects(
        claimAiChartD1PalaceWritingPreviewExecution(
          gatePlan,
          invalidAuthorization,
        ),
        AiChartD1PalaceWritingPreviewGateError,
      )
      await assert.rejects(
        lstat(claimStorageRoot),
        (error: unknown) => isNodeErrorCode(error, 'ENOENT'),
      )
    },
  )

  await check(
    'caller cannot select another storage root to bypass an existing claim',
    async () => {
      await rm(claimStorageRoot, { recursive: true, force: true })
      const alternateRoot = join(suiteRoot, 'caller-selected-root')
      await rm(alternateRoot, { recursive: true, force: true })
      try {
        await claimAiChartD1PalaceWritingPreviewExecution(
          gatePlan,
          authorization,
        )
        await assert.rejects(
          Reflect.apply(
            claimAiChartD1PalaceWritingPreviewExecution,
            undefined,
            [gatePlan, authorization, { storageRoot: alternateRoot }],
          ) as Promise<unknown>,
          AiChartD1PalaceWritingPreviewClaimAlreadyExistsError,
        )
        await assert.rejects(
          lstat(alternateRoot),
          (error: unknown) => isNodeErrorCode(error, 'ENOENT'),
        )
      } finally {
        await rm(claimStorageRoot, { recursive: true, force: true })
        await rm(alternateRoot, { recursive: true, force: true })
      }
    },
  )

  await check(
    'symbolic-link storage fails closed without writing through the link',
    async () => {
      await rm(claimStorageRoot, { recursive: true, force: true })
      const attackTarget = join(suiteRoot, 'symlink-target')
      await rm(attackTarget, { recursive: true, force: true })
      await mkdir(attackTarget, { mode: 0o700 })
      await symlink(attackTarget, claimStorageRoot)
      try {
        await assert.rejects(
          observeAiChartD1PalaceWritingPreviewClaim(gatePlan),
          (error: unknown) =>
            error instanceof
              AiChartD1PalaceWritingPreviewClaimStorageError &&
            error.code ===
              AI_CHART_D1_PALACE_WRITING_PREVIEW_CLAIM_STORAGE_INVALID,
        )
        await assert.rejects(
          claimAiChartD1PalaceWritingPreviewExecution(
            gatePlan,
            authorization,
          ),
          AiChartD1PalaceWritingPreviewClaimStorageError,
        )
        assert.deepEqual(await readdir(attackTarget), [])
      } finally {
        await unlink(claimStorageRoot).catch(() => undefined)
        await rm(attackTarget, { recursive: true, force: true })
      }
    },
  )

  await check(
    'pre-existing storage with permissive mode fails closed before creating a claim',
    async () => {
      await rm(claimStorageRoot, { recursive: true, force: true })
      await mkdir(claimStorageRoot, { mode: 0o755 })
      await chmod(claimStorageRoot, 0o755)
      try {
        await assert.rejects(
          claimAiChartD1PalaceWritingPreviewExecution(
            gatePlan,
            authorization,
          ),
          AiChartD1PalaceWritingPreviewClaimStorageError,
        )
        assert.deepEqual(await readdir(claimStorageRoot), [])
      } finally {
        await rm(claimStorageRoot, { recursive: true, force: true })
      }
    },
  )

  await check(
    'server-only claim adapter has no request, secret, retry, overwrite, or deletion path',
    async () => {
      const source = readFileSync(
        fileURLToPath(
          new URL(
            './d1PalaceWritingPreviewAtomicClaim.server.ts',
            import.meta.url,
          ),
        ),
        'utf8',
      )
      assert.equal(source.split('\n')[0], "import 'server-only'")
      assert.match(
        source,
        /open\(claimPath,\s*'wx',\s*0o600\)/,
      )
      assert.doesNotMatch(
        source,
        /fetch\s*\(|OPENAI_API_KEY|authorizationHeader|Bearer\s|requestAiChartOpenAiStructuredResponse|Promise\.all|retry|fallback|unlink\s*\(|\brm\s*\(|rename\s*\(/,
      )
    },
  )

  console.log(
    `AI Chart D1 palace-writing atomic claim checks passed: ${checks}`,
  )
}

void run().finally(async () => {
  if (originalTmpdirEnvironment === undefined) {
    delete process.env.TMPDIR
  } else {
    process.env.TMPDIR = originalTmpdirEnvironment
  }
  await rm(suiteRoot, { recursive: true, force: true })
})
