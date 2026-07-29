import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
} from 'node:fs'
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
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildAiChartD1PalaceWritingGoldenCase,
} from './d1PalaceWritingGoldenCaseContracts'
import {
  createAiChartD1PalaceWritingFidelityCanonicalJson,
} from './d1PalaceWritingFidelityPromptPackageContracts'
import {
  buildAiChartD1PalaceWritingPreviewPlan,
} from './d1PalaceWritingPreviewContracts'
import {
  projectAiChartD1PalaceWritingPreviewEvidence,
} from './d1PalaceWritingPreviewEvidenceProjectionContracts'
import {
  advanceAiChartD1PalaceWritingPreviewExecutionLedger,
  createAiChartD1PalaceWritingPreviewExecutionLedger,
} from './d1PalaceWritingPreviewExecutionLedgerContracts'
import {
  buildAiChartD1PalaceWritingPreviewGatePlan,
} from './d1PalaceWritingPreviewGateContracts'
import {
  createAiChartD1PalaceWritingCanonicalJson,
} from './d1PalaceWritingPromptPackageContracts'
import {
  createAiChartD1PalaceWritingResultSha256,
} from './d1PalaceWritingResultContracts'

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
  join(
    process.cwd(),
    '.ai-chart-restricted-writer-suite-',
  ),
)
chmodSync(suiteRoot, 0o700)
process.env.TMPDIR = suiteRoot
const restrictedStorageRoot = join(
  suiteRoot,
  'ai-chart-d1-palace-writing-preview-restricted-artifact',
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

function sha256Canonical(value: unknown): string {
  return createHash('sha256')
    .update(
      createAiChartD1PalaceWritingFidelityCanonicalJson(value),
      'utf8',
    )
    .digest('hex')
}

function sha256(value: Buffer | string): string {
  return createHash('sha256').update(value).digest('hex')
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

const goldenCase =
  buildAiChartD1PalaceWritingGoldenCase()
const previewPlan =
  buildAiChartD1PalaceWritingPreviewPlan(goldenCase)
const gatePlan =
  buildAiChartD1PalaceWritingPreviewGatePlan(previewPlan)
const writingResultSha256 =
  createAiChartD1PalaceWritingResultSha256(
    goldenCase.expectedWritingResult,
  )
const fidelityReviewSha256 = sha256Canonical(
  goldenCase.expectedFidelityReview,
)

function buildSuccessfulVerifiedEvidence() {
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
        usage: {
          inputTokens: 1_200,
          outputTokens: 800,
          reasoningTokens: 200,
          totalTokens: 2_000,
        },
        resultFingerprint: writingResultSha256,
        nextBridgeFingerprint:
          goldenCase.benchmarkPlan.stages[1].bridgeFingerprint,
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
        bridgeFingerprint:
          goldenCase.benchmarkPlan.stages[1].bridgeFingerprint,
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
  const succeeded =
    advanceAiChartD1PalaceWritingPreviewExecutionLedger({
      previewPlan,
      ledger: fidelityDispatched,
      event: {
        type: 'STAGE_SUCCEEDED',
        sequence: 2,
        stage: 'FIDELITY_REVIEW',
        durationMs: 800,
        usage: {
          inputTokens: 900,
          outputTokens: 300,
          reasoningTokens: 100,
          totalTokens: 1_200,
        },
        resultFingerprint: fidelityReviewSha256,
      },
    })
  const evidence =
    projectAiChartD1PalaceWritingPreviewEvidence({
      previewPlan,
      executionLedger: succeeded,
    })
  const evidenceFingerprint = createHash('sha256')
    .update(
      createAiChartD1PalaceWritingCanonicalJson(evidence),
      'utf8',
    )
    .digest('hex')

  return Object.freeze({
    contractVersion:
      'ai-chart-d1-palace-writing-preview-evidence-readback/v1',
    task: 'D1_PALACE_WRITING_PREVIEW_EVIDENCE_READBACK',
    gateFingerprint: gatePlan.gateFingerprint,
    authority: 'TRUSTED_SERVER_EVIDENCE_READBACK_ADAPTER',
    artifactName: 'request-succeeded.json',
    evidenceFingerprint,
    status: 'VERIFIED',
    evidence,
    restrictedResultArtifactStatus: 'NOT_READ',
  })
}

async function run(): Promise<void> {
  const artifactContracts =
    loadServerOnlyModule<
      typeof import('./d1PalaceWritingPreviewRestrictedArtifactContracts.server')
    >(
      './d1PalaceWritingPreviewRestrictedArtifactContracts.server',
    )
  const persistenceContracts =
    loadServerOnlyModule<
      typeof import('./d1PalaceWritingPreviewRestrictedArtifactPersistenceContracts.server')
    >(
      './d1PalaceWritingPreviewRestrictedArtifactPersistenceContracts.server',
    )
  const writer =
    loadServerOnlyModule<
      typeof import('./d1PalaceWritingPreviewRestrictedArtifactWriter.server')
    >(
      './d1PalaceWritingPreviewRestrictedArtifactWriter.server',
    )
  const verifiedEvidence = buildSuccessfulVerifiedEvidence()
  const sourceInput = {
    previewPlan,
    gatePlan,
    verifiedEvidence,
    writingPromptPackage:
      goldenCase.writingPromptPackage,
    fidelityPromptPackage:
      goldenCase.fidelityPromptPackage,
  }
  const restrictedArtifact =
    artifactContracts.buildAiChartD1PalaceWritingPreviewRestrictedArtifact(
      {
        ...sourceInput,
        writingResult: goldenCase.expectedWritingResult,
        fidelityReview:
          goldenCase.expectedFidelityReview,
      },
    )
  const envelope =
    persistenceContracts.buildAiChartD1PalaceWritingPreviewRestrictedArtifactPersistenceEnvelope(
      {
        ...sourceInput,
        restrictedArtifact,
      },
    )
  const writerInput = {
    ...sourceInput,
    envelope,
  }
  const {
    AiChartD1PalaceWritingPreviewRestrictedArtifactAlreadyPersistedError,
    AiChartD1PalaceWritingPreviewRestrictedArtifactStorageError,
    persistAiChartD1PalaceWritingPreviewRestrictedArtifact,
  } = writer

  await check(
    'trusted writer persists canonical synthetic restricted output once with private permissions and a path-free receipt',
    async () => {
      await rm(restrictedStorageRoot, {
        recursive: true,
        force: true,
      })
      const receipt =
        await persistAiChartD1PalaceWritingPreviewRestrictedArtifact(
          writerInput,
        )
      const gateDirectory = join(
        restrictedStorageRoot,
        gatePlan.gateFingerprint,
      )
      const artifactPath = join(
        gateDirectory,
        envelope.artifactName,
      )
      const payload = await readFile(artifactPath)
      const directoryMetadata = await lstat(gateDirectory)
      const fileMetadata = await lstat(artifactPath)

      assert.equal(receipt.status, 'PERSISTED')
      assert.equal(
        receipt.authority,
        'TRUSTED_SERVER_RESTRICTED_ARTIFACT_STORAGE_ADAPTER',
      )
      assert.equal(
        receipt.dataClassification,
        'RESTRICTED_MODEL_OUTPUT',
      )
      assert.equal(
        receipt.gateFingerprint,
        gatePlan.gateFingerprint,
      )
      assert.equal(
        receipt.artifactName,
        'restricted-result.json',
      )
      assert.equal(
        receipt.restrictedArtifactFingerprint,
        envelope.restrictedArtifactFingerprint,
      )
      assert.equal(
        receipt.artifactPayloadSha256,
        envelope.artifactPayloadSha256,
      )
      assert.equal(receipt.humanReviewStatus, 'NOT_REVIEWED')
      assert.equal(
        receipt.customerDeliveryStatus,
        'BLOCKED_PENDING_HUMAN_REVIEW',
      )
      assert.equal(receipt.overwriteAllowed, false)
      assert.equal(receipt.retryAllowed, false)
      assert.equal(Object.isFrozen(receipt), true)
      assert.equal('artifactPath' in receipt, false)
      assert.equal('restrictedArtifact' in receipt, false)
      assert.equal(
        payload.toString('utf8'),
        createAiChartD1PalaceWritingCanonicalJson(
          envelope.restrictedArtifact,
        ),
      )
      assert.equal(
        sha256(payload),
        envelope.artifactPayloadSha256,
      )
      assert.equal(directoryMetadata.isDirectory(), true)
      assert.equal(directoryMetadata.isSymbolicLink(), false)
      assert.equal(directoryMetadata.mode & 0o777, 0o700)
      assert.equal(fileMetadata.isFile(), true)
      assert.equal(fileMetadata.isSymbolicLink(), false)
      assert.equal(fileMetadata.mode & 0o777, 0o600)
    },
  )

  await check(
    'same Gate admits exactly one restricted artifact under concurrent and repeated writes',
    async () => {
      await rm(restrictedStorageRoot, {
        recursive: true,
        force: true,
      })
      const attempts = await Promise.allSettled([
        persistAiChartD1PalaceWritingPreviewRestrictedArtifact(
          writerInput,
        ),
        persistAiChartD1PalaceWritingPreviewRestrictedArtifact(
          writerInput,
        ),
      ])
      const fulfilled = attempts.filter(
        (attempt) => attempt.status === 'fulfilled',
      )
      const rejected = attempts.filter(
        (attempt) => attempt.status === 'rejected',
      )
      const gateDirectory = join(
        restrictedStorageRoot,
        gatePlan.gateFingerprint,
      )
      const artifactPath = join(
        gateDirectory,
        envelope.artifactName,
      )

      assert.equal(fulfilled.length, 1)
      assert.equal(rejected.length, 1)
      if (rejected[0]?.status !== 'rejected') {
        assert.fail('expected one rejected restricted artifact')
      }
      assert.equal(
        rejected[0].reason instanceof
          AiChartD1PalaceWritingPreviewRestrictedArtifactAlreadyPersistedError,
        true,
      )
      assert.equal(Object.isFrozen(rejected[0].reason), true)
      assert.deepEqual(
        await readdir(gateDirectory),
        ['restricted-result.json'],
      )

      const before = await readFile(artifactPath)
      await assert.rejects(
        persistAiChartD1PalaceWritingPreviewRestrictedArtifact(
          writerInput,
        ),
        AiChartD1PalaceWritingPreviewRestrictedArtifactAlreadyPersistedError,
      )
      const after = await readFile(artifactPath)
      assert.equal(sha256(after), sha256(before))
    },
  )

  await check(
    'tampered envelope and caller-selected storage root fail before filesystem creation without leaking model output',
    async () => {
      await rm(restrictedStorageRoot, {
        recursive: true,
        force: true,
      })
      const alternateRoot = join(
        suiteRoot,
        'caller-selected-restricted-root',
      )
      const sensitiveMarker =
        'synthetic-sensitive-model-output-marker'
      const tamperedEnvelope = structuredClone(
        envelope,
      ) as Record<string, unknown>
      tamperedEnvelope.artifactPayloadSha256 = '0'.repeat(64)
      tamperedEnvelope.restrictedArtifact = {
        ...(tamperedEnvelope.restrictedArtifact as Record<
          string,
          unknown
        >),
        outputText: sensitiveMarker,
      }

      let serializedError = ''
      try {
        await persistAiChartD1PalaceWritingPreviewRestrictedArtifact(
          {
            ...sourceInput,
            envelope: tamperedEnvelope,
          },
        )
      } catch (error) {
        serializedError = JSON.stringify(error)
        assert.equal(
          error instanceof
            persistenceContracts.AiChartD1PalaceWritingPreviewRestrictedArtifactPersistenceError,
          true,
        )
      }
      assert.equal(
        serializedError.includes(sensitiveMarker),
        false,
      )
      await assert.rejects(
        lstat(restrictedStorageRoot),
        (error: unknown) =>
          error instanceof Error &&
          'code' in error &&
          error.code === 'ENOENT',
      )

      await assert.rejects(
        Reflect.apply(
          persistAiChartD1PalaceWritingPreviewRestrictedArtifact,
          undefined,
          [
            {
              ...writerInput,
              storageRoot: alternateRoot,
            },
          ],
        ) as Promise<unknown>,
        persistenceContracts.AiChartD1PalaceWritingPreviewRestrictedArtifactPersistenceError,
      )
      await assert.rejects(
        lstat(alternateRoot),
        (error: unknown) =>
          error instanceof Error &&
          'code' in error &&
          error.code === 'ENOENT',
      )
      await assert.rejects(
        lstat(restrictedStorageRoot),
        (error: unknown) =>
          error instanceof Error &&
          'code' in error &&
          error.code === 'ENOENT',
      )
    },
  )

  await check(
    'symbolic-link and permissive storage roots fail closed without writing restricted output',
    async () => {
      await rm(restrictedStorageRoot, {
        recursive: true,
        force: true,
      })
      const attackTarget = join(
        suiteRoot,
        'restricted-symlink-target',
      )
      await rm(attackTarget, { recursive: true, force: true })
      await mkdir(attackTarget, { mode: 0o700 })
      await symlink(attackTarget, restrictedStorageRoot)
      try {
        await assert.rejects(
          persistAiChartD1PalaceWritingPreviewRestrictedArtifact(
            writerInput,
          ),
          AiChartD1PalaceWritingPreviewRestrictedArtifactStorageError,
        )
        assert.deepEqual(await readdir(attackTarget), [])
      } finally {
        await unlink(restrictedStorageRoot).catch(() => undefined)
        await rm(attackTarget, {
          recursive: true,
          force: true,
        })
      }

      await mkdir(restrictedStorageRoot, { mode: 0o755 })
      await chmod(restrictedStorageRoot, 0o755)
      try {
        await assert.rejects(
          persistAiChartD1PalaceWritingPreviewRestrictedArtifact(
            writerInput,
          ),
          AiChartD1PalaceWritingPreviewRestrictedArtifactStorageError,
        )
        assert.deepEqual(
          await readdir(restrictedStorageRoot),
          [],
        )
      } finally {
        await rm(restrictedStorageRoot, {
          recursive: true,
          force: true,
        })
      }
    },
  )

  await check(
    'server-only writer has exclusive persistence but no request, secret, retry, deletion, or caller-selected root',
    async () => {
      const source = readFileSync(
        fileURLToPath(
          new URL(
            './d1PalaceWritingPreviewRestrictedArtifactWriter.server.ts',
            import.meta.url,
          ),
        ),
        'utf8',
      )
      assert.equal(source.split('\n')[0], "import 'server-only'")
      assert.match(
        source,
        /open\(artifactPath,\s*'wx',\s*0o600\)/,
      )
      assert.doesNotMatch(
        source,
        /fetch\s*\(|OPENAI_API_KEY|Authorization|requestAiChartOpenAiStructuredResponse|process\.env|unlink\s*\(|\brm\s*\(|rename\s*\(|storageRoot:\s*unknown/,
      )
    },
  )

  console.log(
    `AI Chart D1 palace-writing Preview restricted artifact writer checks passed: ${checks}`,
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
