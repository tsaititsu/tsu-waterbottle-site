import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { lstat } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  AI_CHART_TEST_NODE_VERSION,
  AI_CHART_REACT_SERVER_TEST_FILES,
  AiChartTestRunnerError,
  REMOVED_TEST_ENVIRONMENT_KEYS,
  assertCanonicalNodeVersion,
  createIsolatedTestEnvironment,
  discoverAiChartTestFiles,
  normalizeDiscoveredTestFiles,
  runSequentialTestFiles,
  validateLocalTsx,
} from './test-runner.mjs'

const EXPECTED_CURRENT_AI_CHART_TEST_FILE_COUNT = 77
const THIS_FILE = fileURLToPath(import.meta.url)
const DEFAULT_REPOSITORY_ROOT = resolve(dirname(THIS_FILE), '../..')

async function check(name, run) {
  await run()
  console.log(`[ai-chart-runner-contract] PASS ${name}`)
}

function executeSyntheticChild(exitCode, environment) {
  const result = spawnSync(
    process.execPath,
    ['--input-type=module', '--eval', `process.exit(${exitCode})`],
    {
      env: environment,
      stdio: 'ignore',
    },
  )
  return result.status ?? 1
}

export async function runTestRunnerContract(
  repositoryRoot = DEFAULT_REPOSITORY_ROOT,
) {
  let checks = 0

  await check('Node version is exactly canonical', async () => {
    assertCanonicalNodeVersion()
    assert.equal(process.versions.node, AI_CHART_TEST_NODE_VERSION)
    assert.doesNotThrow(() => assertCanonicalNodeVersion('24.16.0'))
    for (const rejectedVersion of ['24.16.1', '24.17.0', '23.0.0']) {
      assert.throws(() => assertCanonicalNodeVersion(rejectedVersion), {
        code: 'AI_CHART_TEST_RUNNER_NODE_VERSION_INVALID',
      })
    }
  })
  checks += 1

  await check('complete removed environment is isolated from children', async () => {
    const sourceEnvironment = Object.fromEntries(
      REMOVED_TEST_ENVIRONMENT_KEYS.map((key) => [key, 'synthetic-value']),
    )
    sourceEnvironment.NODE_ENV = 'production'
    sourceEnvironment.UNRELATED_SAFE_VALUE = 'preserved'
    const originalEnvironment = { ...sourceEnvironment }
    const isolated = createIsolatedTestEnvironment(sourceEnvironment)

    assert.equal(isolated.NODE_ENV, 'test')
    assert.equal(isolated.UNRELATED_SAFE_VALUE, 'preserved')
    for (const key of REMOVED_TEST_ENVIRONMENT_KEYS) {
      assert.equal(Object.hasOwn(isolated, key), false)
    }
    assert.deepEqual(sourceEnvironment, originalEnvironment)

    const childProbe = [
      `const forbidden = ${JSON.stringify(REMOVED_TEST_ENVIRONMENT_KEYS)};`,
      "if (process.env.NODE_ENV !== 'test') process.exit(1);",
      "if (process.env.UNRELATED_SAFE_VALUE !== 'preserved') process.exit(1);",
      'if (forbidden.some((key) => Object.hasOwn(process.env, key))) process.exit(1);',
      'process.exit(0);',
    ].join('')
    const child = spawnSync(
      process.execPath,
      ['--input-type=module', '--eval', childProbe],
      { env: isolated, stdio: 'ignore' },
    )
    assert.equal(child.status, 0)
  })
  checks += 1

  await check('test paths sort deterministically', async () => {
    const ordered = normalizeDiscoveredTestFiles([
      'src/lib/ai-chart/z.test.ts',
      'src/lib/ai-chart/a.test.ts',
      'src/lib/ai-chart/m.test.ts',
    ])
    assert.deepEqual(ordered, [
      'src/lib/ai-chart/a.test.ts',
      'src/lib/ai-chart/m.test.ts',
      'src/lib/ai-chart/z.test.ts',
    ])
  })
  checks += 1

  await check('duplicate test paths are rejected', async () => {
    assert.throws(
      () =>
        normalizeDiscoveredTestFiles([
          'src/lib/ai-chart/a.test.ts',
          'src/lib/ai-chart/a.test.ts',
        ]),
      { code: 'AI_CHART_TEST_RUNNER_DUPLICATE_TEST' },
    )
  })
  checks += 1

  const discovered = await discoverAiChartTestFiles(repositoryRoot)
  await check('repository discovery matches the current contract count', async () => {
    assert.equal(discovered.length, EXPECTED_CURRENT_AI_CHART_TEST_FILE_COUNT)
    assert.deepEqual(discovered, [...discovered].sort())
    assert.equal(new Set(discovered).size, discovered.length)
    for (const testFile of discovered) {
      const metadata = await lstat(resolve(repositoryRoot, testFile))
      assert.equal(metadata.isFile(), true)
      assert.equal(metadata.isSymbolicLink(), false)
    }
  })
  checks += 1

  await check('non-zero child result fails fast', async () => {
    const executed = []
    await assert.rejects(
      () =>
        runSequentialTestFiles(
          [
            'src/lib/ai-chart/c.test.ts',
            'src/lib/ai-chart/a.test.ts',
            'src/lib/ai-chart/b.test.ts',
          ],
          {
            executeTestFile: async (testFile) => {
              executed.push(testFile)
              return executeSyntheticChild(
                testFile.endsWith('/b.test.ts') ? 7 : 0,
                createIsolatedTestEnvironment({}),
              )
            },
          },
        ),
      {
        code: 'AI_CHART_TEST_RUNNER_CHILD_FAILED',
        testFile: 'src/lib/ai-chart/b.test.ts',
      },
    )
    assert.deepEqual(executed, [
      'src/lib/ai-chart/a.test.ts',
      'src/lib/ai-chart/b.test.ts',
    ])
  })
  checks += 1

  await check('all successful children produce overall success', async () => {
    const executed = []
    const result = await runSequentialTestFiles(
      [
        'src/lib/ai-chart/b.test.ts',
        'src/lib/ai-chart/a.test.ts',
      ],
      {
        executeTestFile: async (testFile) => {
          executed.push(testFile)
          return executeSyntheticChild(0, createIsolatedTestEnvironment({}))
        },
      },
    )
    assert.deepEqual(executed, [
      'src/lib/ai-chart/a.test.ts',
      'src/lib/ai-chart/b.test.ts',
    ])
    assert.deepEqual(result, { passed: 2, total: 2 })
  })
  checks += 1

  const tsx = await validateLocalTsx(repositoryRoot)
  await check('tsx is local and exactly pinned', async () => {
    assert.equal(/^\d+\.\d+\.\d+$/u.test(tsx.version), true)
    assert.equal(tsx.importUrl.startsWith('file:'), true)
  })
  checks += 1

  await check('react-server condition is limited to the server-only report test', async () => {
    assert.deepEqual(AI_CHART_REACT_SERVER_TEST_FILES, [
      'src/lib/ai-chart/reportCompletion.test.ts',
    ])
    assert.equal(Object.isFrozen(AI_CHART_REACT_SERVER_TEST_FILES), true)
  })
  checks += 1

  console.log(
    `[ai-chart-runner-contract] PASS ${checks} checks; ` +
      `${discovered.length} test files discovered; tsx ${tsx.version}`,
  )
  return Object.freeze({
    checks,
    discoveredTestFiles: discovered.length,
    tsxVersion: tsx.version,
  })
}

const isDirectExecution =
  process.argv[1] !== undefined &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url

if (isDirectExecution) {
  runTestRunnerContract().catch((error) => {
    const code =
      error instanceof AiChartTestRunnerError
        ? error.code
        : 'AI_CHART_TEST_RUNNER_CONTRACT_FAILED'
    console.error(`[ai-chart-runner-contract] FAIL ${code}`)
    process.exitCode = 1
  })
}
