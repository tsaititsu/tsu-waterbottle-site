import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
} from 'node:fs'
import {
  lstat,
  readFile,
  readdir,
  rm,
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
  AiChartD1PalaceWritingPreviewEvidencePersistenceError,
} from './d1PalaceWritingPreviewEvidencePersistenceContracts'
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
  join(process.cwd(), '.ai-chart-evidence-coordinator-suite-'),
)
chmodSync(suiteRoot, 0o700)
process.env.TMPDIR = suiteRoot
const evidenceStorageRoot = join(
  suiteRoot,
  'ai-chart-d1-palace-writing-preview-evidence',
)

let serverModule:
  typeof import('./d1PalaceWritingPreviewEvidencePersistenceCoordinator.server')
let writerModule:
  typeof import('./d1PalaceWritingPreviewEvidenceWriter.server')

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
    './d1PalaceWritingPreviewEvidencePersistenceCoordinator.server',
  ) as typeof import('./d1PalaceWritingPreviewEvidencePersistenceCoordinator.server')
  writerModule = testRequire(
    './d1PalaceWritingPreviewEvidenceWriter.server',
  ) as typeof import('./d1PalaceWritingPreviewEvidenceWriter.server')
} finally {
  moduleInternals._resolveFilename = originalResolveFilename
  moduleInternals._load = originalLoad
}

const {
  persistAiChartD1PalaceWritingPreviewTerminalEvidence,
} = serverModule
const {
  AiChartD1PalaceWritingPreviewEvidenceAlreadyPersistedError,
} = writerModule

let checks = 0

async function check(
  name: string,
  run: () => Promise<void>,
): Promise<void> {
  await run()
  checks += 1
  console.log(`✓ ${name}`)
}

function sha256(value: Buffer): string {
  return createHash('sha256').update(value).digest('hex')
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

function buildWrongGateFailureLedger() {
  const ready =
    createAiChartD1PalaceWritingPreviewExecutionLedger({
      previewPlan,
      gateFingerprint: 'f'.repeat(64),
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

async function assertEvidenceStorageAbsent(): Promise<void> {
  await assert.rejects(
    lstat(evidenceStorageRoot),
    (error: unknown) =>
      error instanceof Error &&
      'code' in error &&
      error.code === 'ENOENT',
  )
}

async function run(): Promise<void> {
  await check(
    'single coordinator projects and persists a terminal failed Ledger without caller-built Evidence',
    async () => {
      await rm(evidenceStorageRoot, {
        recursive: true,
        force: true,
      })
      const receipt =
        await persistAiChartD1PalaceWritingPreviewTerminalEvidence({
          previewPlan,
          gatePlan,
          executionLedger: buildWritingPreFetchFailureLedger(),
        })
      const artifactPath = join(
        evidenceStorageRoot,
        gatePlan.gateFingerprint,
        'request-failed.json',
      )
      const payload = await readFile(artifactPath)
      const evidence = JSON.parse(payload.toString('utf8')) as {
        status: unknown
        completedStage: unknown
        attemptedRequests: unknown
        executedRequests: unknown
        fetchCount: unknown
      }

      assert.equal(receipt.status, 'PERSISTED')
      assert.equal(
        receipt.authority,
        'TRUSTED_SERVER_EVIDENCE_STORAGE_ADAPTER',
      )
      assert.equal(
        receipt.artifactName,
        'request-failed.json',
      )
      assert.equal(
        receipt.gateFingerprint,
        gatePlan.gateFingerprint,
      )
      assert.equal(
        receipt.evidenceFingerprint,
        sha256(payload),
      )
      assert.equal(receipt.overwriteAllowed, false)
      assert.equal(receipt.retryAllowed, false)
      assert.equal(
        receipt.restrictedResultArtifactStatus,
        'NOT_PERSISTED',
      )
      assert.equal('artifactPath' in receipt, false)
      assert.equal(Object.isFrozen(receipt), true)
      assert.equal(evidence.status, 'FAILED')
      assert.equal(evidence.completedStage, 'WRITING')
      assert.equal(evidence.attemptedRequests, 1)
      assert.equal(evidence.executedRequests, 0)
      assert.equal(evidence.fetchCount, 0)
    },
  )

  await check(
    'successful terminal Ledger persists only safe success Evidence and remains blocked for human review',
    async () => {
      await rm(evidenceStorageRoot, {
        recursive: true,
        force: true,
      })
      const receipt =
        await persistAiChartD1PalaceWritingPreviewTerminalEvidence({
          previewPlan,
          gatePlan,
          executionLedger: buildSuccessfulLedger(),
        })
      const artifactPath = join(
        evidenceStorageRoot,
        gatePlan.gateFingerprint,
        'request-succeeded.json',
      )
      const payload = await readFile(artifactPath, 'utf8')
      const evidence = JSON.parse(payload) as {
        status: unknown
        completedStage: unknown
        attemptedRequests: unknown
        executedRequests: unknown
        fetchCount: unknown
        customerDeliveryStatus: unknown
        summaryPolicy: unknown
      }

      assert.equal(receipt.artifactName, 'request-succeeded.json')
      assert.equal(
        receipt.restrictedResultArtifactStatus,
        'NOT_PERSISTED',
      )
      assert.equal(evidence.status, 'SUCCEEDED')
      assert.equal(evidence.completedStage, 'COMPLETE')
      assert.equal(evidence.attemptedRequests, 2)
      assert.equal(evidence.executedRequests, 2)
      assert.equal(evidence.fetchCount, 2)
      assert.equal(
        evidence.customerDeliveryStatus,
        'BLOCKED_PENDING_HUMAN_REVIEW',
      )
      assert.equal(
        JSON.stringify(evidence.summaryPolicy).includes(
          'outputText',
        ),
        false,
      )
      assert.deepEqual(
        await readdir(
          join(
            evidenceStorageRoot,
            gatePlan.gateFingerprint,
          ),
        ),
        ['request-succeeded.json'],
      )
      for (const forbidden of [
        '"outputText"',
        '"output_text"',
        '"prompt"',
        '"requestBody"',
        '"apiKey"',
        '"chartSnapshot"',
        '"birthDate"',
      ]) {
        assert.equal(
          payload.toLowerCase().includes(forbidden.toLowerCase()),
          false,
          forbidden,
        )
      }
    },
  )

  await check(
    'non-terminal, Gate-drifted, sensitive, and caller-expanded inputs fail before storage',
    async () => {
      const cases: unknown[] = [
        {
          previewPlan,
          gatePlan,
          executionLedger:
            createAiChartD1PalaceWritingPreviewExecutionLedger({
              previewPlan,
              gateFingerprint: gatePlan.gateFingerprint,
            }),
        },
        {
          previewPlan,
          gatePlan,
          executionLedger: buildWrongGateFailureLedger(),
        },
        {
          previewPlan,
          gatePlan,
          executionLedger: buildWritingPreFetchFailureLedger(),
          storageRoot: join(suiteRoot, 'caller-root'),
        },
      ]
      const sensitiveMarker = 'sensitive-model-output-marker'
      const sensitiveLedger = structuredClone(
        buildWritingPreFetchFailureLedger(),
      ) as Record<string, unknown>
      sensitiveLedger.outputText = sensitiveMarker
      cases.push({
        previewPlan,
        gatePlan,
        executionLedger: sensitiveLedger,
      })

      for (const input of cases) {
        await rm(evidenceStorageRoot, {
          recursive: true,
          force: true,
        })
        let serializedError = ''
        try {
          await Reflect.apply(
            persistAiChartD1PalaceWritingPreviewTerminalEvidence,
            undefined,
            [input],
          )
          assert.fail('expected fail-closed persistence rejection')
        } catch (error) {
          serializedError = JSON.stringify(error)
          assert.equal(
            error instanceof
              AiChartD1PalaceWritingPreviewEvidencePersistenceError,
            true,
          )
        }
        assert.equal(
          serializedError.includes(sensitiveMarker),
          false,
        )
        await assertEvidenceStorageAbsent()
      }
      await assert.rejects(
        lstat(join(suiteRoot, 'caller-root')),
        (error: unknown) =>
          error instanceof Error &&
          'code' in error &&
          error.code === 'ENOENT',
      )
    },
  )

  await check(
    'repeated coordination preserves the first immutable Evidence and refuses overwrite',
    async () => {
      await rm(evidenceStorageRoot, {
        recursive: true,
        force: true,
      })
      const input = {
        previewPlan,
        gatePlan,
        executionLedger: buildWritingPreFetchFailureLedger(),
      }
      const first =
        await persistAiChartD1PalaceWritingPreviewTerminalEvidence(
          input,
        )
      const artifactPath = join(
        evidenceStorageRoot,
        gatePlan.gateFingerprint,
        first.artifactName,
      )
      const before = await readFile(artifactPath)

      await assert.rejects(
        persistAiChartD1PalaceWritingPreviewTerminalEvidence(
          input,
        ),
        AiChartD1PalaceWritingPreviewEvidenceAlreadyPersistedError,
      )
      const after = await readFile(artifactPath)
      assert.equal(sha256(after), sha256(before))
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
    'server-only coordinator delegates validation and write-once persistence without Runtime authority',
    async () => {
      const source = readFileSync(
        fileURLToPath(
          new URL(
            './d1PalaceWritingPreviewEvidencePersistenceCoordinator.server.ts',
            import.meta.url,
          ),
        ),
        'utf8',
      )

      assert.equal(source.split('\n')[0], "import 'server-only'")
      assert.match(
        source,
        /buildAiChartD1PalaceWritingPreviewEvidencePersistenceEnvelope/,
      )
      assert.match(
        source,
        /persistAiChartD1PalaceWritingPreviewEvidence/,
      )
      assert.doesNotMatch(
        source,
        /fetch\s*\(|OPENAI_API_KEY|Authorization|process\.env|node:fs|writeFile|mkdir|open\s*\(|unlink\s*\(|\brm\s*\(|retry|restrictedResultArtifact\s*:/,
      )
    },
  )

  console.log(
    `AI Chart D1 palace-writing Preview Evidence persistence coordinator checks passed: ${checks}`,
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
