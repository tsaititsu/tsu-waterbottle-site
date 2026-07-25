import { spawnSync } from 'node:child_process'
import { lstat, readFile, readdir } from 'node:fs/promises'
import { relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

export const AI_CHART_TEST_DIRECTORY = 'src/lib/ai-chart'
export const AI_CHART_TEST_FILE_SUFFIX = '.test.ts'
export const AI_CHART_TEST_NODE_VERSION = '24.16.0'
export const AI_CHART_REACT_SERVER_TEST_FILES = Object.freeze([
  'src/lib/ai-chart/reportCompletion.test.ts',
])

export const REMOVED_TEST_ENVIRONMENT_KEYS = Object.freeze([
  'OPENAI_API_KEY',
  'OPENAI_AI_CHART_MODEL',
  'OPENAI_BASE_URL',
  'OPENAI_ORG_ID',
  'OPENAI_PROJECT_ID',
  'AI_CHART_D1_P1_PREVIEW_ENABLED',
  'AI_CHART_D1_P1_PREVIEW_TARGET_PALACE_ID',
  'AI_CHART_D1_P1_PREVIEW_PLAN_FINGERPRINT',
  'AI_CHART_D1_P1_PREVIEW_CONFIRM',
  'VERCEL',
  'VERCEL_ENV',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_ACCESS_TOKEN',
  'SUPABASE_DB_PASSWORD',
  'SUPABASE_SERVICE_ROLE_KEY',
  'DATABASE_URL',
  'NODE_OPTIONS',
  'TSX_TSCONFIG_PATH',
])

export class AiChartTestRunnerError extends Error {
  constructor(code, testFile = null) {
    super(code)
    this.name = 'AiChartTestRunnerError'
    this.code = code
    this.testFile = testFile
  }
}

function compareAscii(left, right) {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

function toRepositoryRelativePath(repositoryRoot, absolutePath) {
  return relative(repositoryRoot, absolutePath).split(sep).join('/')
}

export function assertCanonicalNodeVersion(version = process.versions.node) {
  if (version !== AI_CHART_TEST_NODE_VERSION) {
    throw new AiChartTestRunnerError('AI_CHART_TEST_RUNNER_NODE_VERSION_INVALID')
  }
}

export function createIsolatedTestEnvironment(sourceEnvironment = process.env) {
  const isolated = { ...sourceEnvironment, NODE_ENV: 'test' }
  for (const key of REMOVED_TEST_ENVIRONMENT_KEYS) delete isolated[key]
  return isolated
}

export function normalizeDiscoveredTestFiles(testFiles) {
  if (!Array.isArray(testFiles) || testFiles.length === 0) {
    throw new AiChartTestRunnerError('AI_CHART_TEST_RUNNER_NO_TESTS')
  }
  if (testFiles.some((testFile) => typeof testFile !== 'string')) {
    throw new AiChartTestRunnerError('AI_CHART_TEST_RUNNER_PATH_INVALID')
  }
  if (
    testFiles.some(
      (testFile) =>
        !testFile.startsWith(`${AI_CHART_TEST_DIRECTORY}/`) ||
        !testFile.endsWith(AI_CHART_TEST_FILE_SUFFIX) ||
        testFile.includes('/../') ||
        testFile.includes('\\'),
    )
  ) {
    throw new AiChartTestRunnerError('AI_CHART_TEST_RUNNER_PATH_INVALID')
  }
  const unique = new Set(testFiles)
  if (unique.size !== testFiles.length) {
    throw new AiChartTestRunnerError('AI_CHART_TEST_RUNNER_DUPLICATE_TEST')
  }
  return Object.freeze([...testFiles].sort(compareAscii))
}

async function collectTestFiles(repositoryRoot, directoryPath, output) {
  const entries = await readdir(directoryPath, { withFileTypes: true })
  entries.sort((left, right) => compareAscii(left.name, right.name))

  for (const entry of entries) {
    const absolutePath = resolve(directoryPath, entry.name)
    if (entry.isSymbolicLink()) {
      throw new AiChartTestRunnerError(
        'AI_CHART_TEST_RUNNER_SYMLINK_FORBIDDEN',
        toRepositoryRelativePath(repositoryRoot, absolutePath),
      )
    }
    if (entry.isDirectory()) {
      await collectTestFiles(repositoryRoot, absolutePath, output)
      continue
    }
    if (!entry.name.endsWith(AI_CHART_TEST_FILE_SUFFIX)) continue

    const metadata = await lstat(absolutePath)
    if (metadata.isSymbolicLink() || !metadata.isFile()) {
      throw new AiChartTestRunnerError(
        'AI_CHART_TEST_RUNNER_REGULAR_FILE_REQUIRED',
        toRepositoryRelativePath(repositoryRoot, absolutePath),
      )
    }
    output.push(toRepositoryRelativePath(repositoryRoot, absolutePath))
  }
}

export async function discoverAiChartTestFiles(repositoryRoot) {
  const testDirectory = resolve(repositoryRoot, AI_CHART_TEST_DIRECTORY)
  const metadata = await lstat(testDirectory)
  if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
    throw new AiChartTestRunnerError('AI_CHART_TEST_RUNNER_DIRECTORY_INVALID')
  }

  const discovered = []
  await collectTestFiles(repositoryRoot, testDirectory, discovered)
  return normalizeDiscoveredTestFiles(discovered)
}

function parseJsonObject(value, errorCode) {
  try {
    const parsed = JSON.parse(value)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error(errorCode)
    }
    return parsed
  } catch {
    throw new AiChartTestRunnerError(errorCode)
  }
}

function isExactVersion(value) {
  return typeof value === 'string' && /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u.test(value)
}

export async function validateLocalTsx(repositoryRoot) {
  const packageJsonPath = resolve(repositoryRoot, 'package.json')
  const packageLockPath = resolve(repositoryRoot, 'package-lock.json')
  const installedPackagePath = resolve(
    repositoryRoot,
    'node_modules/tsx/package.json',
  )
  const installedPackageDirectory = resolve(repositoryRoot, 'node_modules/tsx')
  const [packageJsonSource, packageLockSource, installedPackageSource] =
    await Promise.all([
      readFile(packageJsonPath, 'utf8'),
      readFile(packageLockPath, 'utf8'),
      readFile(installedPackagePath, 'utf8'),
    ])
  const packageJson = parseJsonObject(
    packageJsonSource,
    'AI_CHART_TEST_RUNNER_PACKAGE_INVALID',
  )
  const packageLock = parseJsonObject(
    packageLockSource,
    'AI_CHART_TEST_RUNNER_LOCK_INVALID',
  )
  const installedPackage = parseJsonObject(
    installedPackageSource,
    'AI_CHART_TEST_RUNNER_TSX_INVALID',
  )
  const pinnedVersion = packageJson.devDependencies?.tsx
  const lockVersion = packageLock.packages?.['']?.devDependencies?.tsx
  const installedVersion = installedPackage.version

  if (
    !isExactVersion(pinnedVersion) ||
    pinnedVersion !== lockVersion ||
    pinnedVersion !== installedVersion
  ) {
    throw new AiChartTestRunnerError('AI_CHART_TEST_RUNNER_TSX_VERSION_INVALID')
  }

  const packageDirectoryMetadata = await lstat(installedPackageDirectory)
  if (
    packageDirectoryMetadata.isSymbolicLink() ||
    !packageDirectoryMetadata.isDirectory()
  ) {
    throw new AiChartTestRunnerError('AI_CHART_TEST_RUNNER_TSX_INVALID')
  }

  const tsxImportPath = resolve(repositoryRoot, 'node_modules/tsx/dist/loader.mjs')
  const metadata = await lstat(tsxImportPath)
  if (metadata.isSymbolicLink() || !metadata.isFile()) {
    throw new AiChartTestRunnerError('AI_CHART_TEST_RUNNER_TSX_ENTRY_INVALID')
  }

  return Object.freeze({
    version: pinnedVersion,
    importUrl: pathToFileURL(tsxImportPath).href,
  })
}

export async function runSequentialTestFiles(
  testFiles,
  { executeTestFile, report = () => {} },
) {
  if (typeof executeTestFile !== 'function' || typeof report !== 'function') {
    throw new AiChartTestRunnerError('AI_CHART_TEST_RUNNER_EXECUTOR_INVALID')
  }
  const orderedFiles = normalizeDiscoveredTestFiles(testFiles)
  let passed = 0

  for (const testFile of orderedFiles) {
    report('run', testFile, passed, orderedFiles.length)
    const exitCode = await executeTestFile(testFile)
    if (!Number.isInteger(exitCode) || exitCode !== 0) {
      report('fail', testFile, passed, orderedFiles.length)
      throw new AiChartTestRunnerError('AI_CHART_TEST_RUNNER_CHILD_FAILED', testFile)
    }
    passed += 1
    report('pass', testFile, passed, orderedFiles.length)
  }

  return Object.freeze({ passed, total: orderedFiles.length })
}

export function createLocalTsxExecutor({ repositoryRoot, tsxImportUrl }) {
  const environment = {
    ...createIsolatedTestEnvironment(process.env),
    NODE_PATH: resolve(repositoryRoot, 'node_modules/next/dist/compiled'),
  }
  return (testFile) => {
    const absoluteTestPath = resolve(repositoryRoot, testFile)
    const args = AI_CHART_REACT_SERVER_TEST_FILES.includes(testFile)
      ? ['--conditions=react-server', '--import', tsxImportUrl, absoluteTestPath]
      : ['--import', tsxImportUrl, absoluteTestPath]
    const result = spawnSync(
      process.execPath,
      args,
      {
        cwd: repositoryRoot,
        env: environment,
        stdio: 'inherit',
      },
    )
    if (result.error || result.signal !== null || result.status === null) return 1
    return result.status
  }
}
