import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  CanonicalTestRunnerError,
  OFFLINE_CONTRACT_DEFINITIONS,
  OPT_IN_TYPESCRIPT_INTEGRATIONS,
  buildCanonicalManifest,
  buildChildProcessSpec,
  compareUtf8Bytes,
  computeManifestSha256,
  executeManifest,
  getSignalExitCode,
  normalizeManifestEntries,
  validateRepositoryFile,
} from './run-tests.mjs'

const syntheticTypeScriptEntry = (path, source = 'git-tracked') => ({
  id: path,
  path,
  source,
  type: 'typescript',
})

async function check(name, run) {
  await run()
  console.log(`[canonical-test-runner-contract] PASS ${name}`)
}

async function runContract() {
  let checks = 0

  await check('deterministic UTF-8 byte ordering', () => {
    const ordered = ['é.test.ts', 'z.test.ts', 'a.test.ts'].sort(compareUtf8Bytes)
    assert.deepEqual(ordered, ['a.test.ts', 'z.test.ts', 'é.test.ts'])
  })
  checks += 1

  await check('duplicate manifest fails closed with both sources', () => {
    assert.throws(
      () =>
        normalizeManifestEntries([
          syntheticTypeScriptEntry('src/a.test.ts', 'tracked discovery'),
          syntheticTypeScriptEntry('src/a.test.ts', 'offline allowlist'),
        ]),
      (error) => {
        assert.equal(error.code, 'CANONICAL_TEST_DUPLICATE_ENTRY')
        assert.deepEqual(error.sources, ['tracked discovery', 'offline allowlist'])
        return true
      },
    )
  })
  checks += 1

  await check('empty TypeScript suite fails closed', () => {
    assert.throws(() => buildCanonicalManifest({ trackedFiles: [] }), {
      code: 'CANONICAL_TEST_EMPTY_TYPESCRIPT_SUITE',
    })
  })
  checks += 1

  const mixedManifest = normalizeManifestEntries([
    syntheticTypeScriptEntry('src/pass.test.ts'),
    syntheticTypeScriptEntry('src/fail.test.ts'),
    {
      id: 'offline-contract',
      path: 'scripts/offline.contract.mjs',
      source: 'offline allowlist',
      type: 'offline-contract',
    },
  ])

  await check('non-zero child exit makes the overall result fail', async () => {
    const result = await executeManifest(mixedManifest, {
      executeEntry: async (entry) => ({
        code: entry.path === 'src/fail.test.ts' ? 7 : 0,
        durationMs: 1,
        error: null,
        signal: null,
      }),
    })
    assert.equal(result.ok, false)
    assert.deepEqual(result.failedTests, ['src/fail.test.ts'])
  })
  checks += 1

  await check('child signal makes the overall result fail', async () => {
    const result = await executeManifest(
      [syntheticTypeScriptEntry('src/signal.test.ts')],
      {
        executeEntry: async () => ({
          code: null,
          durationMs: 1,
          error: null,
          signal: 'SIGTERM',
        }),
      },
    )
    assert.equal(result.ok, false)
    assert.deepEqual(result.failedTests, ['src/signal.test.ts'])
  })
  checks += 1

  await check('parent interrupt signals retain conventional exit codes', () => {
    assert.equal(getSignalExitCode('SIGINT'), 130)
    assert.equal(getSignalExitCode('SIGTERM'), 143)
  })
  checks += 1

  await check('parent interrupt stops the manifest immediately', async () => {
    let executions = 0
    await assert.rejects(
      () =>
        executeManifest(mixedManifest, {
          executeEntry: async () => {
            executions += 1
            throw new CanonicalTestRunnerError(
              'CANONICAL_TEST_INTERRUPTED',
              { exitCode: 130 },
            )
          },
        }),
      {
        code: 'CANONICAL_TEST_INTERRUPTED',
        exitCode: 130,
      },
    )
    assert.equal(executions, 1)
  })
  checks += 1

  await check('spawn error makes the overall result fail', async () => {
    const result = await executeManifest(
      [syntheticTypeScriptEntry('src/spawn-error.test.ts')],
      {
        executeEntry: async () => ({
          code: null,
          durationMs: 1,
          error: new Error('synthetic spawn error'),
          signal: null,
        }),
      },
    )
    assert.equal(result.ok, false)
    assert.deepEqual(result.failedTests, ['src/spawn-error.test.ts'])
  })
  checks += 1

  await check('success and failure counts are exact', async () => {
    const result = await executeManifest(mixedManifest, {
      executeEntry: async (entry) => ({
        code: entry.path === 'src/fail.test.ts' ? 1 : 0,
        durationMs: 1,
        error: null,
        signal: null,
      }),
    })
    assert.deepEqual(result.counts, {
      offlineContractsFailed: 0,
      offlineContractsPassed: 1,
      offlineContractsTotal: 1,
      typescriptFailed: 1,
      typescriptPassed: 1,
      typescriptTotal: 2,
    })
  })
  checks += 1

  await check('failed test list preserves manifest order', async () => {
    const result = await executeManifest(mixedManifest, {
      executeEntry: async () => ({
        code: 1,
        durationMs: 1,
        error: null,
        signal: null,
      }),
    })
    assert.deepEqual(result.failedTests, [
      'src/fail.test.ts',
      'src/pass.test.ts',
      'scripts/offline.contract.mjs',
    ])
  })
  checks += 1

  await check('a path containing spaces is one child argument', () => {
    const specification = buildChildProcessSpec(
      syntheticTypeScriptEntry('src/path with spaces/example.test.ts'),
      {
        repositoryRoot: '/tmp/repository',
        tsxImportUrl: 'file:///tmp/repository/node_modules/tsx/dist/loader.mjs',
      },
    )
    assert.equal(
      specification.args.filter((argument) =>
        argument.includes('path with spaces'),
      ).length,
      1,
    )
    assert.equal(
      specification.args.at(-1),
      '/tmp/repository/src/path with spaces/example.test.ts',
    )
  })
  checks += 1

  await check('absolute and traversal paths are rejected', () => {
    for (const path of ['/tmp/escape.test.ts', '../escape.test.ts']) {
      assert.throws(
        () =>
          normalizeManifestEntries([
            syntheticTypeScriptEntry(path),
          ]),
        { code: 'CANONICAL_TEST_PATH_INVALID' },
      )
    }
  })
  checks += 1

  await check('non-regular repository paths are rejected', async () => {
    const temporaryRoot = await mkdtemp(join(tmpdir(), 'canonical-test-contract-'))
    try {
      await mkdir(join(temporaryRoot, 'directory.test.ts'))
      await assert.rejects(
        () =>
          validateRepositoryFile(
            temporaryRoot,
            'directory.test.ts',
          ),
        { code: 'CANONICAL_TEST_REGULAR_FILE_REQUIRED' },
      )
      await writeFile(join(temporaryRoot, 'regular.test.ts'), 'export {}\n')
      await validateRepositoryFile(temporaryRoot, 'regular.test.ts')
    } finally {
      await rm(temporaryRoot, { force: true, recursive: true })
    }
  })
  checks += 1

  await check('list mode does not execute child processes', async () => {
    let executions = 0
    const result = await executeManifest(mixedManifest, {
      executeEntry: async () => {
        executions += 1
        throw new Error('list mode must not execute')
      },
      listOnly: true,
    })
    assert.equal(executions, 0)
    assert.equal(result.ok, true)
  })
  checks += 1

  await check('list mode and execution use the same order', async () => {
    const listed = []
    const executed = []
    await executeManifest(mixedManifest, {
      executeEntry: async (entry) => {
        executed.push(entry.path)
        return { code: 0, durationMs: 1, error: null, signal: null }
      },
      listOnly: true,
      report: (event, entry) => {
        if (event === 'list') listed.push(entry.path)
      },
    })
    await executeManifest(mixedManifest, {
      executeEntry: async (entry) => {
        executed.push(entry.path)
        return { code: 0, durationMs: 1, error: null, signal: null }
      },
    })
    assert.deepEqual(executed, listed)
  })
  checks += 1

  await check('excluded integration runner never enters the manifest', () => {
    const safe = 'src/safe.test.ts'
    const excluded = OPT_IN_TYPESCRIPT_INTEGRATIONS[0]
    const manifest = buildCanonicalManifest({
      trackedFiles: [excluded, safe],
    })
    assert.deepEqual(
      manifest.filter(({ type }) => type === 'typescript').map(({ path }) => path),
      [safe],
    )
    assert.equal(manifest.some(({ path }) => path === excluded), false)
    assert.equal(
      OFFLINE_CONTRACT_DEFINITIONS.some(({ path }) => path === excluded),
      false,
    )
  })
  checks += 1

  await check('child specification always disables shell execution', () => {
    const specification = buildChildProcessSpec(
      syntheticTypeScriptEntry('src/safe.test.ts'),
      {
        repositoryRoot: '/tmp/repository',
        tsxImportUrl: 'file:///tmp/repository/node_modules/tsx/dist/loader.mjs',
      },
    )
    assert.equal(specification.options.shell, false)
  })
  checks += 1

  await check('react-server condition is limited to server-only tests', () => {
    const options = {
      repositoryRoot: '/tmp/repository',
      tsxImportUrl: 'file:///tmp/repository/node_modules/tsx/dist/loader.mjs',
    }
    const clientSpecification = buildChildProcessSpec(
      syntheticTypeScriptEntry('src/components/LoginModal.test.ts'),
      options,
    )
    const serverSpecification = buildChildProcessSpec(
      syntheticTypeScriptEntry('src/lib/auth/line.test.ts'),
      options,
    )
    assert.equal(
      clientSpecification.args.includes('--conditions=react-server'),
      false,
    )
    assert.equal(
      serverSpecification.args.includes('--conditions=react-server'),
      true,
    )
  })
  checks += 1

  await check('manifest SHA is stable and machine independent', () => {
    const first = computeManifestSha256(mixedManifest)
    const second = computeManifestSha256(
      mixedManifest.map((entry) => ({ ...entry, source: 'different source label' })),
    )
    assert.match(first, /^[a-f0-9]{64}$/u)
    assert.equal(first, second)
  })
  checks += 1

  assert.equal(CanonicalTestRunnerError.prototype instanceof Error, true)
  console.log(
    `[canonical-test-runner-contract] PASS ${checks} checks`,
  )
  return checks
}

runContract().catch((error) => {
  const code =
    error instanceof CanonicalTestRunnerError
      ? error.code
      : 'CANONICAL_TEST_RUNNER_CONTRACT_FAILED'
  console.error(`[canonical-test-runner-contract] FAIL ${code}`)
  process.exitCode = 1
})
