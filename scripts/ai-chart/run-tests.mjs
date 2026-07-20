import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  AiChartTestRunnerError,
  assertCanonicalNodeVersion,
  createLocalTsxExecutor,
  discoverAiChartTestFiles,
  runSequentialTestFiles,
  validateLocalTsx,
} from './test-runner.mjs'
import { runTestRunnerContract } from './test-runner.contract.mjs'

const THIS_FILE = fileURLToPath(import.meta.url)
const REPOSITORY_ROOT = resolve(dirname(THIS_FILE), '../..')

function report(status, testFile, passed, total) {
  if (status === 'run') {
    console.log(`[ai-chart-test] RUN ${passed + 1}/${total} ${testFile}`)
    return
  }
  if (status === 'pass') {
    console.log(`[ai-chart-test] PASS ${passed}/${total} ${testFile}`)
    return
  }
  console.error(`[ai-chart-test] FAIL ${passed + 1}/${total} ${testFile}`)
}

async function main() {
  console.log('[ai-chart-runner] Running safety contract')
  const contract = await runTestRunnerContract(REPOSITORY_ROOT)
  assertCanonicalNodeVersion()

  const [testFiles, tsx] = await Promise.all([
    discoverAiChartTestFiles(REPOSITORY_ROOT),
    validateLocalTsx(REPOSITORY_ROOT),
  ])
  if (testFiles.length !== contract.discoveredTestFiles) {
    throw new AiChartTestRunnerError('AI_CHART_TEST_RUNNER_DISCOVERY_CHANGED')
  }

  console.log(
    `[ai-chart-runner] Starting ${testFiles.length} sequential test files ` +
      `with local tsx ${tsx.version}`,
  )
  const result = await runSequentialTestFiles(testFiles, {
    executeTestFile: createLocalTsxExecutor({
      repositoryRoot: REPOSITORY_ROOT,
      tsxImportUrl: tsx.importUrl,
    }),
    report,
  })

  console.log(
    `[ai-chart-runner] PASS ${result.passed}/${result.total} test files; ` +
      `${contract.checks} runner contract checks`,
  )
}

main().catch((error) => {
  const code =
    error instanceof AiChartTestRunnerError
      ? error.code
      : 'AI_CHART_TEST_RUNNER_FAILED'
  const testFile =
    error instanceof AiChartTestRunnerError && error.testFile !== null
      ? ` ${error.testFile}`
      : ''
  console.error(`[ai-chart-runner] FAIL ${code}${testFile}`)
  process.exitCode = 1
})
