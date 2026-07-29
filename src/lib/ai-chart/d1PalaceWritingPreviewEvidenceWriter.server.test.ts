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
  buildAiChartD1PalaceWritingPreviewPlan,
} from './d1PalaceWritingPreviewContracts'
import {
  advanceAiChartD1PalaceWritingPreviewExecutionLedger,
  createAiChartD1PalaceWritingPreviewExecutionLedger,
} from './d1PalaceWritingPreviewExecutionLedgerContracts'
import {
  AiChartD1PalaceWritingPreviewEvidencePersistenceError,
  buildAiChartD1PalaceWritingPreviewEvidencePersistenceEnvelope,
} from './d1PalaceWritingPreviewEvidencePersistenceContracts'
import {
  buildAiChartD1PalaceWritingPreviewGatePlan,
} from './d1PalaceWritingPreviewGateContracts'
import {
  createAiChartD1PalaceWritingCanonicalJson,
} from './d1PalaceWritingPromptPackageContracts'

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
  join(process.cwd(), '.ai-chart-evidence-writer-suite-'),
)
chmodSync(suiteRoot, 0o700)
process.env.TMPDIR = suiteRoot
const evidenceStorageRoot = join(
  suiteRoot,
  'ai-chart-d1-palace-writing-preview-evidence',
)

let serverModule:
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
    './d1PalaceWritingPreviewEvidenceWriter.server',
  ) as typeof import('./d1PalaceWritingPreviewEvidenceWriter.server')
} finally {
  moduleInternals._resolveFilename = originalResolveFilename
  moduleInternals._load = originalLoad
}

const {
  AiChartD1PalaceWritingPreviewEvidenceAlreadyPersistedError,
  AiChartD1PalaceWritingPreviewEvidenceStorageError,
  persistAiChartD1PalaceWritingPreviewEvidence,
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

function sha256(value: Buffer | string): string {
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

function buildFailedEnvelope() {
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
  const failed =
    advanceAiChartD1PalaceWritingPreviewExecutionLedger({
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
  return buildAiChartD1PalaceWritingPreviewEvidencePersistenceEnvelope(
    {
      previewPlan,
      gatePlan,
      executionLedger: failed,
    },
  )
}

function buildSuccessfulEnvelope() {
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
  const succeeded =
    advanceAiChartD1PalaceWritingPreviewExecutionLedger({
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
  return buildAiChartD1PalaceWritingPreviewEvidencePersistenceEnvelope(
    {
      previewPlan,
      gatePlan,
      executionLedger: succeeded,
    },
  )
}

async function run(): Promise<void> {
  await check(
    'trusted writer persists canonical failed Evidence once with private permissions',
    async () => {
      await rm(evidenceStorageRoot, {
        recursive: true,
        force: true,
      })
      const envelope = buildFailedEnvelope()
      const persisted =
        await persistAiChartD1PalaceWritingPreviewEvidence({
          previewPlan,
          gatePlan,
          envelope,
        })
      const gateDirectory = join(
        evidenceStorageRoot,
        gatePlan.gateFingerprint,
      )
      const artifactPath = join(
        gateDirectory,
        envelope.artifactName,
      )
      const payload = await readFile(artifactPath)
      const directoryMetadata = await lstat(gateDirectory)
      const fileMetadata = await lstat(artifactPath)

      assert.equal(persisted.status, 'PERSISTED')
      assert.equal(
        persisted.authority,
        'TRUSTED_SERVER_EVIDENCE_STORAGE_ADAPTER',
      )
      assert.equal(
        persisted.gateFingerprint,
        gatePlan.gateFingerprint,
      )
      assert.equal(
        persisted.artifactName,
        'request-failed.json',
      )
      assert.equal(
        persisted.evidenceFingerprint,
        envelope.evidenceFingerprint,
      )
      assert.equal(persisted.overwriteAllowed, false)
      assert.equal(persisted.retryAllowed, false)
      assert.equal(
        persisted.restrictedResultArtifactStatus,
        'NOT_PERSISTED',
      )
      assert.equal('artifactPath' in persisted, false)
      assert.equal(Object.isFrozen(persisted), true)
      assert.equal(
        payload.toString('utf8'),
        createAiChartD1PalaceWritingCanonicalJson(
          envelope.evidence,
        ),
      )
      assert.equal(
        sha256(payload),
        envelope.evidenceFingerprint,
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
    'same Gate admits only one terminal Evidence even when success and failure race',
    async () => {
      await rm(evidenceStorageRoot, {
        recursive: true,
        force: true,
      })
      const failedEnvelope = buildFailedEnvelope()
      const succeededEnvelope = buildSuccessfulEnvelope()
      const attempts = await Promise.allSettled([
        persistAiChartD1PalaceWritingPreviewEvidence({
          previewPlan,
          gatePlan,
          envelope: failedEnvelope,
        }),
        persistAiChartD1PalaceWritingPreviewEvidence({
          previewPlan,
          gatePlan,
          envelope: succeededEnvelope,
        }),
      ])
      const fulfilled = attempts.filter(
        (attempt) => attempt.status === 'fulfilled',
      )
      const rejected = attempts.filter(
        (attempt) => attempt.status === 'rejected',
      )
      const gateDirectory = join(
        evidenceStorageRoot,
        gatePlan.gateFingerprint,
      )

      assert.equal(fulfilled.length, 1)
      assert.equal(rejected.length, 1)
      if (fulfilled[0]?.status !== 'fulfilled') {
        assert.fail('expected one persisted Evidence')
      }
      if (rejected[0]?.status !== 'rejected') {
        assert.fail('expected one rejected Evidence')
      }
      assert.equal(
        rejected[0].reason instanceof
          AiChartD1PalaceWritingPreviewEvidenceAlreadyPersistedError,
        true,
      )
      assert.equal(Object.isFrozen(rejected[0].reason), true)
      assert.deepEqual(
        await readdir(gateDirectory),
        [fulfilled[0].value.artifactName],
      )

      const artifactPath = join(
        gateDirectory,
        fulfilled[0].value.artifactName,
      )
      const before = await readFile(artifactPath)
      await assert.rejects(
        persistAiChartD1PalaceWritingPreviewEvidence({
          previewPlan,
          gatePlan,
          envelope:
            fulfilled[0].value.artifactName ===
            'request-succeeded.json'
              ? failedEnvelope
              : succeededEnvelope,
        }),
        AiChartD1PalaceWritingPreviewEvidenceAlreadyPersistedError,
      )
      const after = await readFile(artifactPath)
      assert.equal(sha256(after), sha256(before))
    },
  )

  await check(
    'tampered envelope and caller-selected storage root fail before filesystem creation without leaking data',
    async () => {
      await rm(evidenceStorageRoot, {
        recursive: true,
        force: true,
      })
      const alternateRoot = join(
        suiteRoot,
        'caller-selected-evidence-root',
      )
      const sensitiveMarker = 'sensitive-model-output-marker'
      const tamperedEnvelope = structuredClone(
        buildFailedEnvelope(),
      ) as Record<string, unknown>
      tamperedEnvelope.evidenceFingerprint = '0'.repeat(64)
      tamperedEnvelope.evidence = {
        ...(tamperedEnvelope.evidence as Record<string, unknown>),
        outputText: sensitiveMarker,
      }

      let serializedError = ''
      try {
        await persistAiChartD1PalaceWritingPreviewEvidence({
          previewPlan,
          gatePlan,
          envelope: tamperedEnvelope,
        })
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
      await assert.rejects(
        lstat(evidenceStorageRoot),
        (error: unknown) =>
          error instanceof Error &&
          'code' in error &&
          error.code === 'ENOENT',
      )

      await assert.rejects(
        Reflect.apply(
          persistAiChartD1PalaceWritingPreviewEvidence,
          undefined,
          [
            {
              previewPlan,
              gatePlan,
              envelope: buildFailedEnvelope(),
              storageRoot: alternateRoot,
            },
          ],
        ) as Promise<unknown>,
        AiChartD1PalaceWritingPreviewEvidencePersistenceError,
      )
      await assert.rejects(
        lstat(alternateRoot),
        (error: unknown) =>
          error instanceof Error &&
          'code' in error &&
          error.code === 'ENOENT',
      )
      await assert.rejects(
        lstat(evidenceStorageRoot),
        (error: unknown) =>
          error instanceof Error &&
          'code' in error &&
          error.code === 'ENOENT',
      )
    },
  )

  await check(
    'symbolic-link and permissive storage roots fail closed without writing Evidence',
    async () => {
      await rm(evidenceStorageRoot, {
        recursive: true,
        force: true,
      })
      const attackTarget = join(
        suiteRoot,
        'evidence-symlink-target',
      )
      await rm(attackTarget, { recursive: true, force: true })
      await mkdir(attackTarget, { mode: 0o700 })
      await symlink(attackTarget, evidenceStorageRoot)
      try {
        await assert.rejects(
          persistAiChartD1PalaceWritingPreviewEvidence({
            previewPlan,
            gatePlan,
            envelope: buildFailedEnvelope(),
          }),
          AiChartD1PalaceWritingPreviewEvidenceStorageError,
        )
        assert.deepEqual(await readdir(attackTarget), [])
      } finally {
        await unlink(evidenceStorageRoot).catch(() => undefined)
        await rm(attackTarget, {
          recursive: true,
          force: true,
        })
      }

      await mkdir(evidenceStorageRoot, { mode: 0o755 })
      await chmod(evidenceStorageRoot, 0o755)
      try {
        await assert.rejects(
          persistAiChartD1PalaceWritingPreviewEvidence({
            previewPlan,
            gatePlan,
            envelope: buildFailedEnvelope(),
          }),
          AiChartD1PalaceWritingPreviewEvidenceStorageError,
        )
        assert.deepEqual(await readdir(evidenceStorageRoot), [])
      } finally {
        await rm(evidenceStorageRoot, {
          recursive: true,
          force: true,
        })
      }
    },
  )

  await check(
    'successful Evidence stays safe and separate from restricted model output',
    async () => {
      await rm(evidenceStorageRoot, {
        recursive: true,
        force: true,
      })
      const envelope = buildSuccessfulEnvelope()
      const persisted =
        await persistAiChartD1PalaceWritingPreviewEvidence({
          previewPlan,
          gatePlan,
          envelope,
        })
      const artifactPath = join(
        evidenceStorageRoot,
        gatePlan.gateFingerprint,
        'request-succeeded.json',
      )
      const payload = await readFile(artifactPath, 'utf8')
      const parsed = JSON.parse(payload) as unknown

      assert.deepEqual(parsed, envelope.evidence)
      assert.equal(
        persisted.restrictedResultArtifactStatus,
        'NOT_PERSISTED',
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
        '"refusal"',
        '"prompt"',
        '"instructions"',
        '"userInput"',
        '"requestBody"',
        '"apiKey"',
        '"authorization"',
        '"chartSnapshot"',
        '"birthDate"',
        '"birthTime"',
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
    'server-only writer has exclusive persistence but no request, secret, retry, deletion, or restricted artifact path',
    async () => {
      const source = readFileSync(
        fileURLToPath(
          new URL(
            './d1PalaceWritingPreviewEvidenceWriter.server.ts',
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
        /fetch\s*\(|OPENAI_API_KEY|Authorization|requestAiChartOpenAiStructuredResponse|process\.env|unlink\s*\(|\brm\s*\(|rename\s*\(|restrictedResultArtifact\s*:/,
      )
    },
  )

  console.log(
    `AI Chart D1 palace-writing Preview Evidence writer checks passed: ${checks}`,
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
