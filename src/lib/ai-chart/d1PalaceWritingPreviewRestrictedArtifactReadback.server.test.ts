import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
} from 'node:fs'
import {
  chmod,
  readFile,
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
    '.ai-chart-restricted-readback-suite-',
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
  const readback =
    loadServerOnlyModule<
      typeof import('./d1PalaceWritingPreviewRestrictedArtifactReadback.server')
    >(
      './d1PalaceWritingPreviewRestrictedArtifactReadback.server',
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
  const persist = async () => {
    await rm(restrictedStorageRoot, {
      recursive: true,
      force: true,
    })
    return writer.persistAiChartD1PalaceWritingPreviewRestrictedArtifact(
      {
        ...sourceInput,
        envelope,
      },
    )
  }
  const read = (
    persistedRestrictedArtifact: unknown,
  ) =>
    readback.readAndVerifyAiChartD1PalaceWritingPreviewRestrictedArtifact(
      {
        ...sourceInput,
        persistedRestrictedArtifact,
      },
    )
  const artifactPath = () =>
    join(
      restrictedStorageRoot,
      gatePlan.gateFingerprint,
      'restricted-result.json',
    )

  await check(
    'persisted synthetic restricted artifact can be read back, fully revalidated, and kept blocked for human review',
    async () => {
      const persistedRestrictedArtifact = await persist()
      const verified = await read(
        persistedRestrictedArtifact,
      )

      assert.equal(verified.status, 'VERIFIED')
      assert.equal(
        verified.authority,
        'TRUSTED_SERVER_RESTRICTED_ARTIFACT_READBACK_ADAPTER',
      )
      assert.equal(
        verified.dataClassification,
        'RESTRICTED_MODEL_OUTPUT',
      )
      assert.equal(
        verified.gateFingerprint,
        gatePlan.gateFingerprint,
      )
      assert.equal(
        verified.artifactName,
        'restricted-result.json',
      )
      assert.equal(
        verified.restrictedArtifactFingerprint,
        persistedRestrictedArtifact.restrictedArtifactFingerprint,
      )
      assert.equal(
        verified.artifactPayloadSha256,
        persistedRestrictedArtifact.artifactPayloadSha256,
      )
      assert.deepEqual(
        verified.restrictedArtifact,
        restrictedArtifact,
      )
      assert.equal(verified.humanReviewStatus, 'NOT_REVIEWED')
      assert.equal(
        verified.customerDeliveryStatus,
        'BLOCKED_PENDING_HUMAN_REVIEW',
      )
      assert.equal('artifactPath' in verified, false)
      assert.equal(recursivelyFrozen(verified), true)
    },
  )

  await check(
    'missing, duplicate, permissive, symbolic-link, oversized, and non-canonical artifacts fail closed',
    async () => {
      const expectInvalid = async (
        mutate: (
          path: string,
          persisted: Awaited<ReturnType<typeof persist>>,
        ) => Promise<void>,
      ): Promise<void> => {
        const persisted = await persist()
        const path = artifactPath()
        await mutate(path, persisted)
        await assert.rejects(
          read(persisted),
          readback.AiChartD1PalaceWritingPreviewRestrictedArtifactReadbackError,
        )
      }

      await expectInvalid(async (path) => {
        await unlink(path)
      })
      await expectInvalid(async (path) => {
        await writeFile(
          join(
            restrictedStorageRoot,
            gatePlan.gateFingerprint,
            'unexpected.json',
          ),
          '{}',
          { mode: 0o600 },
        )
        assert.equal((await readFile(path)).length > 0, true)
      })
      await expectInvalid(async (path) => {
        await chmod(path, 0o644)
      })
      await expectInvalid(async () => {
        await chmod(
          join(
            restrictedStorageRoot,
            gatePlan.gateFingerprint,
          ),
          0o755,
        )
      })
      await expectInvalid(async () => {
        await chmod(restrictedStorageRoot, 0o755)
      })
      await expectInvalid(async (path) => {
        const target = join(
          suiteRoot,
          'restricted-readback-symlink-target',
        )
        await writeFile(target, '{}', { mode: 0o600 })
        await unlink(path)
        await symlink(target, path)
      })
      await expectInvalid(async (path) => {
        await writeFile(path, 'x'.repeat(256 * 1024 + 1))
      })
      await expectInvalid(async (path) => {
        const payload = await readFile(path, 'utf8')
        await writeFile(path, `${payload}\n`)
      })
    },
  )

  await check(
    'receipt, Gate, input, and source-bound artifact drift fail with a fixed non-leaking error',
    async () => {
      const sensitiveMarker =
        'synthetic-sensitive-model-output-marker'
      const persisted = await persist()
      const receiptCases: unknown[] = [
        {
          ...structuredClone(persisted),
          artifactPayloadSha256: '0'.repeat(64),
        },
        {
          ...structuredClone(persisted),
          outputText: sensitiveMarker,
        },
      ]

      for (const persistedRestrictedArtifact of receiptCases) {
        let thrown: unknown
        try {
          await read(persistedRestrictedArtifact)
        } catch (error) {
          thrown = error
        }
        assert.equal(
          thrown instanceof
            readback.AiChartD1PalaceWritingPreviewRestrictedArtifactReadbackError,
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
        readback.readAndVerifyAiChartD1PalaceWritingPreviewRestrictedArtifact(
          {
            ...sourceInput,
            gatePlan: driftedGatePlan,
            persistedRestrictedArtifact: persisted,
          },
        ),
        readback.AiChartD1PalaceWritingPreviewRestrictedArtifactReadbackError,
      )
      await assert.rejects(
        Reflect.apply(
          readback.readAndVerifyAiChartD1PalaceWritingPreviewRestrictedArtifact,
          undefined,
          [
            {
              ...sourceInput,
              persistedRestrictedArtifact: persisted,
              storageRoot: join(suiteRoot, 'caller-root'),
            },
          ],
        ) as Promise<unknown>,
        readback.AiChartD1PalaceWritingPreviewRestrictedArtifactReadbackError,
      )

      const payload = JSON.parse(
        await readFile(artifactPath(), 'utf8'),
      ) as Record<string, unknown>
      payload.writingResult = {
        ...(payload.writingResult as Record<string, unknown>),
        outputText: sensitiveMarker,
      }
      await writeFile(
        artifactPath(),
        createAiChartD1PalaceWritingCanonicalJson(payload),
      )
      let contentError: unknown
      try {
        await read(persisted)
      } catch (error) {
        contentError = error
      }
      assert.equal(
        contentError instanceof
          readback.AiChartD1PalaceWritingPreviewRestrictedArtifactReadbackError,
        true,
      )
      assert.equal(
        JSON.stringify(contentError).includes(sensitiveMarker),
        false,
      )
    },
  )

  await check(
    'verified readback exposes only the validated restricted artifact and never changes review authority',
    async () => {
      const persisted = await persist()
      const verified = await read(persisted)
      const serialized = JSON.stringify(verified)

      assert.equal(
        verified.restrictedArtifact.modelOutputIncluded,
        true,
      )
      assert.equal(
        verified.restrictedArtifact.promptIncluded,
        false,
      )
      assert.equal(
        verified.restrictedArtifact.requestBodyIncluded,
        false,
      )
      assert.equal(
        verified.restrictedArtifact.secretsIncluded,
        false,
      )
      assert.equal(
        verified.accessPolicy,
        'SERVER_ONLY_EXPLICIT_HUMAN_REVIEW',
      )
      assert.equal(verified.humanReviewStatus, 'NOT_REVIEWED')
      assert.equal(
        verified.customerDeliveryStatus,
        'BLOCKED_PENDING_HUMAN_REVIEW',
      )
      assert.equal(
        verified.safeEvidenceArtifactStatus,
        'SEPARATE_ALREADY_VERIFIED_NOT_INCLUDED',
      )
      assert.equal(serialized.includes('"artifactPath"'), false)
      assert.equal(serialized.includes('"storageRoot"'), false)
    },
  )

  await check(
    'server-only readback is bounded and read-only with no Runtime, request, secret, or review mutation',
    async () => {
      const source = readFileSync(
        fileURLToPath(
          new URL(
            './d1PalaceWritingPreviewRestrictedArtifactReadback.server.ts',
            import.meta.url,
          ),
        ),
        'utf8',
      )

      assert.equal(source.split('\n')[0], "import 'server-only'")
      assert.match(source, /O_RDONLY \| O_NOFOLLOW/)
      assert.match(
        source,
        /MAX_RESTRICTED_ARTIFACT_BYTES = 256 \* 1024/,
      )
      assert.match(
        source,
        /parseAiChartD1PalaceWritingPreviewRestrictedArtifact/,
      )
      assert.doesNotMatch(
        source,
        /fetch\s*\(|OPENAI_API_KEY|Authorization|process\.env|writeFile|mkdir|unlink\s*\(|\brm\s*\(|\bretry\s*\(|APPROVED|DELIVERED/,
      )
    },
  )

  console.log(
    `AI Chart D1 palace-writing Preview restricted artifact readback checks passed: ${checks}`,
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
