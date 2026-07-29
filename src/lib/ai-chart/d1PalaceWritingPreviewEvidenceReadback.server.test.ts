import assert from 'node:assert/strict'
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
} from 'node:fs'
import {
  chmod,
  readFile,
  readdir,
  rm,
  symlink,
  unlink,
  writeFile,
} from 'node:fs/promises'
import Module, { createRequire } from 'node:module'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildAiChartD1PalaceWritingGoldenCase,
} from './d1PalaceWritingGoldenCaseContracts'
import {
  buildAiChartD1PalaceWritingPreviewPlan,
} from './d1PalaceWritingPreviewContracts'
import {
  advanceAiChartD1PalaceWritingPreviewExecutionLedger,
  createAiChartD1PalaceWritingPreviewExecutionLedger,
} from './d1PalaceWritingPreviewExecutionLedgerContracts'
import {
  buildAiChartD1PalaceWritingPreviewGatePlan,
} from './d1PalaceWritingPreviewGateContracts'

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
const originalTmpdirEnvironment = process.env.TMPDIR
const suiteRoot = mkdtempSync(
  join(process.cwd(), '.ai-chart-evidence-readback-suite-'),
)
chmodSync(suiteRoot, 0o700)
process.env.TMPDIR = suiteRoot
const evidenceStorageRoot = join(
  suiteRoot,
  'ai-chart-d1-palace-writing-preview-evidence',
)

function loadServerOnlyModule<T>(request: string): T {
  try {
    moduleInternals._resolveFilename =
      function resolveFilenameForTest(
        this: unknown,
        moduleRequest: string,
        parent: unknown,
        isMain: boolean,
        options?: unknown,
      ) {
        if (moduleRequest === 'server-only') {
          return serverOnlyStubPath
        }
        return originalResolveFilename.call(
          this,
          moduleRequest,
          parent,
          isMain,
          options,
        )
      }
    moduleInternals._load = function loadForTest(
      this: unknown,
      moduleRequest: string,
      parent: unknown,
      isMain: boolean,
    ) {
      if (moduleRequest === 'server-only') return {}
      return originalLoad.call(
        this,
        moduleRequest,
        parent,
        isMain,
      )
    }
    return testRequire(request) as T
  } finally {
    moduleInternals._resolveFilename = originalResolveFilename
    moduleInternals._load = originalLoad
  }
}

const previewPlan = buildAiChartD1PalaceWritingPreviewPlan(
  buildAiChartD1PalaceWritingGoldenCase(),
)
const gatePlan =
  buildAiChartD1PalaceWritingPreviewGatePlan(previewPlan)
const writingUsage = {
  inputTokens: 1_200,
  outputTokens: 800,
  reasoningTokens: 200,
  totalTokens: 2_000,
} as const
const fidelityUsage = {
  inputTokens: 900,
  outputTokens: 300,
  reasoningTokens: 100,
  totalTokens: 1_200,
} as const
const writingResultFingerprint = 'b'.repeat(64)
const fidelityBridgeFingerprint = 'c'.repeat(64)
const fidelityResultFingerprint = 'd'.repeat(64)

function buildWritingPreFetchFailureLedger() {
  const ready =
    createAiChartD1PalaceWritingPreviewExecutionLedger({
      previewPlan,
      gateFingerprint: gatePlan.gateFingerprint,
    })
  const attempted =
    advanceAiChartD1PalaceWritingPreviewExecutionLedger({
      previewPlan,
      ledger: ready,
      event: {
        type: 'REQUEST_ATTEMPTED',
        sequence: 1,
        stage: 'WRITING',
        bridgeFingerprint:
          previewPlan.stages[0].bridgeFingerprint,
      },
    })
  return advanceAiChartD1PalaceWritingPreviewExecutionLedger({
    previewPlan,
    ledger: attempted,
    event: {
      type: 'STAGE_FAILED',
      sequence: 1,
      stage: 'WRITING',
      failurePhase: 'PRE_FETCH',
      durationMs: 75,
      usage: null,
      errorCode: 'WRITING_REQUEST_FAILED',
    },
  })
}

function buildSuccessfulLedger() {
  const ready =
    createAiChartD1PalaceWritingPreviewExecutionLedger({
      previewPlan,
      gateFingerprint: gatePlan.gateFingerprint,
    })
  const writingAttempted =
    advanceAiChartD1PalaceWritingPreviewExecutionLedger({
      previewPlan,
      ledger: ready,
      event: {
        type: 'REQUEST_ATTEMPTED',
        sequence: 1,
        stage: 'WRITING',
        bridgeFingerprint:
          previewPlan.stages[0].bridgeFingerprint,
      },
    })
  const writingDispatched =
    advanceAiChartD1PalaceWritingPreviewExecutionLedger({
      previewPlan,
      ledger: writingAttempted,
      event: {
        type: 'FETCH_DISPATCHED',
        sequence: 1,
        stage: 'WRITING',
      },
    })
  const writingSucceeded =
    advanceAiChartD1PalaceWritingPreviewExecutionLedger({
      previewPlan,
      ledger: writingDispatched,
      event: {
        type: 'STAGE_SUCCEEDED',
        sequence: 1,
        stage: 'WRITING',
        durationMs: 1_500,
        usage: writingUsage,
        resultFingerprint: writingResultFingerprint,
        nextBridgeFingerprint: fidelityBridgeFingerprint,
      },
    })
  const fidelityAttempted =
    advanceAiChartD1PalaceWritingPreviewExecutionLedger({
      previewPlan,
      ledger: writingSucceeded,
      event: {
        type: 'REQUEST_ATTEMPTED',
        sequence: 2,
        stage: 'FIDELITY_REVIEW',
        bridgeFingerprint: fidelityBridgeFingerprint,
      },
    })
  const fidelityDispatched =
    advanceAiChartD1PalaceWritingPreviewExecutionLedger({
      previewPlan,
      ledger: fidelityAttempted,
      event: {
        type: 'FETCH_DISPATCHED',
        sequence: 2,
        stage: 'FIDELITY_REVIEW',
      },
    })
  return advanceAiChartD1PalaceWritingPreviewExecutionLedger({
    previewPlan,
    ledger: fidelityDispatched,
    event: {
      type: 'STAGE_SUCCEEDED',
      sequence: 2,
      stage: 'FIDELITY_REVIEW',
      durationMs: 800,
      usage: fidelityUsage,
      resultFingerprint: fidelityResultFingerprint,
    },
  })
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

let checks = 0

async function check(
  name: string,
  runCheck: () => Promise<void>,
): Promise<void> {
  await runCheck()
  checks += 1
  console.log(`✓ ${name}`)
}

async function run(): Promise<void> {
  const coordinator =
    loadServerOnlyModule<
      typeof import('./d1PalaceWritingPreviewEvidencePersistenceCoordinator.server')
    >(
      './d1PalaceWritingPreviewEvidencePersistenceCoordinator.server',
    )
  const readback =
    loadServerOnlyModule<
      typeof import('./d1PalaceWritingPreviewEvidenceReadback.server')
    >('./d1PalaceWritingPreviewEvidenceReadback.server')
  const persist = async (
    executionLedger: unknown,
  ): Promise<
    Awaited<
      ReturnType<
        typeof coordinator.persistAiChartD1PalaceWritingPreviewTerminalEvidence
      >
    >
  > => {
    await rm(evidenceStorageRoot, {
      recursive: true,
      force: true,
    })
    return coordinator.persistAiChartD1PalaceWritingPreviewTerminalEvidence(
      {
        previewPlan,
        gatePlan,
        executionLedger,
      },
    )
  }
  const read = (
    persistedEvidence: unknown,
  ) =>
    readback.readAndVerifyAiChartD1PalaceWritingPreviewEvidence(
      {
        previewPlan,
        gatePlan,
        persistedEvidence,
      },
    )
  const artifactPath = (
    artifactName: 'request-succeeded.json' | 'request-failed.json',
  ) =>
    join(
      evidenceStorageRoot,
      gatePlan.gateFingerprint,
      artifactName,
    )

  await check(
    'persisted safe Evidence can be read back and verified without exposing storage paths',
    async () => {
      const persisted = await persist(
        buildWritingPreFetchFailureLedger(),
      )
      const verified = await read(persisted)

      assert.equal(verified.status, 'VERIFIED')
      assert.equal(
        verified.authority,
        'TRUSTED_SERVER_EVIDENCE_READBACK_ADAPTER',
      )
      assert.equal(
        verified.gateFingerprint,
        gatePlan.gateFingerprint,
      )
      assert.equal(
        verified.artifactName,
        'request-failed.json',
      )
      assert.equal(
        verified.evidenceFingerprint,
        persisted.evidenceFingerprint,
      )
      assert.equal(verified.evidence.status, 'FAILED')
      assert.equal(verified.evidence.completedStage, 'WRITING')
      assert.equal(
        verified.restrictedResultArtifactStatus,
        'NOT_READ',
      )
      assert.equal('artifactPath' in verified, false)
      assert.equal(recursivelyFrozen(verified), true)
    },
  )

  await check(
    'successful safe Evidence remains blocked for human review after readback',
    async () => {
      const persisted = await persist(buildSuccessfulLedger())
      const verified = await read(persisted)

      assert.equal(verified.artifactName, 'request-succeeded.json')
      assert.equal(verified.evidence.status, 'SUCCEEDED')
      assert.equal(verified.evidence.completedStage, 'COMPLETE')
      assert.equal(
        verified.evidence.customerDeliveryStatus,
        'BLOCKED_PENDING_HUMAN_REVIEW',
      )
      assert.equal(verified.evidence.attemptedRequests, 2)
      assert.equal(verified.evidence.executedRequests, 2)
      assert.equal(verified.evidence.fetchCount, 2)
      assert.equal(
        verified.restrictedResultArtifactStatus,
        'NOT_READ',
      )
    },
  )

  await check(
    'missing, duplicate, permissive, symbolic-link, oversized, and tampered artifacts fail closed',
    async () => {
      const expectInvalid = async (
        mutate: (
          path: string,
          persisted: Awaited<
            ReturnType<typeof persist>
          >,
        ) => Promise<void>,
      ): Promise<void> => {
        const persisted = await persist(
          buildWritingPreFetchFailureLedger(),
        )
        const path = artifactPath(persisted.artifactName)
        await mutate(path, persisted)
        await assert.rejects(
          read(persisted),
          readback.AiChartD1PalaceWritingPreviewEvidenceReadbackError,
        )
      }

      await expectInvalid(async (path) => {
        await unlink(path)
      })
      await expectInvalid(async () => {
        await writeFile(
          artifactPath('request-succeeded.json'),
          '{}',
          { mode: 0o600 },
        )
      })
      await expectInvalid(async (path) => {
        await chmod(path, 0o644)
      })
      await expectInvalid(async () => {
        await chmod(
          join(
            evidenceStorageRoot,
            gatePlan.gateFingerprint,
          ),
          0o755,
        )
      })
      await expectInvalid(async () => {
        await chmod(evidenceStorageRoot, 0o755)
      })
      await expectInvalid(async (path) => {
        const target = join(suiteRoot, 'readback-symlink-target')
        await writeFile(target, '{}', { mode: 0o600 })
        await unlink(path)
        await symlink(target, path)
      })
      await expectInvalid(async (path) => {
        await writeFile(path, 'x'.repeat(128 * 1024 + 1))
      })
      await expectInvalid(async (path) => {
        const payload = await readFile(path, 'utf8')
        await writeFile(path, `${payload}\n`)
      })
    },
  )

  await check(
    'receipt, Gate, and input drift fail with a fixed error and never reveal sensitive additions',
    async () => {
      const sensitiveMarker = 'sensitive-model-output-marker'
      const persisted = await persist(
        buildWritingPreFetchFailureLedger(),
      )
      const cases: unknown[] = [
        {
          ...structuredClone(persisted),
          evidenceFingerprint: '0'.repeat(64),
        },
        {
          ...structuredClone(persisted),
          outputText: sensitiveMarker,
        },
      ]

      for (const persistedEvidence of cases) {
        let thrown: unknown
        try {
          await read(persistedEvidence)
        } catch (error) {
          thrown = error
        }
        assert.equal(
          thrown instanceof
            readback.AiChartD1PalaceWritingPreviewEvidenceReadbackError,
          true,
        )
        assert.equal(Object.isFrozen(thrown), true)
        assert.equal(
          JSON.stringify(thrown).includes(sensitiveMarker),
          false,
        )
      }

      const driftedGatePlan = {
        ...structuredClone(gatePlan),
        gateFingerprint: 'f'.repeat(64),
      }
      await assert.rejects(
        readback.readAndVerifyAiChartD1PalaceWritingPreviewEvidence(
          {
            previewPlan,
            gatePlan: driftedGatePlan,
            persistedEvidence: persisted,
          },
        ),
        readback.AiChartD1PalaceWritingPreviewEvidenceReadbackError,
      )
      await assert.rejects(
        Reflect.apply(
          readback.readAndVerifyAiChartD1PalaceWritingPreviewEvidence,
          undefined,
          [
            {
              previewPlan,
              gatePlan,
              persistedEvidence: persisted,
              storageRoot: join(suiteRoot, 'caller-root'),
            },
          ],
        ) as Promise<unknown>,
        readback.AiChartD1PalaceWritingPreviewEvidenceReadbackError,
      )
      assert.deepEqual(
        await readdir(
          join(
            evidenceStorageRoot,
            gatePlan.gateFingerprint,
          ),
        ),
        ['request-failed.json'],
      )
    },
  )

  await check(
    'server-only readback is bounded and read-only with no Runtime or restricted-artifact access',
    async () => {
      const source = readFileSync(
        fileURLToPath(
          new URL(
            './d1PalaceWritingPreviewEvidenceReadback.server.ts',
            import.meta.url,
          ),
        ),
        'utf8',
      )

      assert.equal(source.split('\n')[0], "import 'server-only'")
      assert.match(source, /O_RDONLY \| O_NOFOLLOW/)
      assert.match(source, /MAX_EVIDENCE_BYTES = 128 \* 1024/)
      assert.match(
        source,
        /parseAiChartD1PalaceWritingPreviewEvidence/,
      )
      assert.doesNotMatch(
        source,
        /fetch\s*\(|OPENAI_API_KEY|Authorization|process\.env|writeFile|mkdir|unlink\s*\(|\brm\s*\(|\bretry\s*\(|outputText|restrictedResultArtifact\s*:/,
      )
    },
  )

  console.log(
    `AI Chart D1 palace-writing Preview Evidence readback checks passed: ${checks}`,
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
