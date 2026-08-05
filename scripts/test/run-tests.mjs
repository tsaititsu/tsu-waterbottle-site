import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { lstat, readFile } from 'node:fs/promises'
import { dirname, isAbsolute, posix, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const MANIFEST_SCHEMA_VERSION = 'canonical-test-manifest-v1'
export const TYPESCRIPT_TEST_SUFFIXES = Object.freeze([
  '.test.ts',
  '.test.tsx',
  '.spec.ts',
  '.spec.tsx',
])
export const TYPESCRIPT_DISCOVERY_ROOTS = Object.freeze([
  'infra/line-pay-gateway/test/',
  'src/',
  'supabase/',
])
export const OPT_IN_TYPESCRIPT_INTEGRATIONS = Object.freeze([
  'supabase/booking_atomic_create_postgres17.test.ts',
  'supabase/profiles_admin_audit_postgres16.test.ts',
])
export const NATIVE_NODE_TEST_FILES = Object.freeze([
  'src/components/divination/DivinationSearchParamsBridge.test.ts',
  'src/lib/supabase/linePayDatabaseContracts.test.ts',
])
export const REACT_SERVER_TEST_FILES = Object.freeze([
  'src/app/api/account/divination-readings/[id]/route.test.ts',
  'src/app/api/account/divination-readings/route.test.ts',
  'src/app/api/admin/adminReadOnlyHandlers.test.ts',
  'src/app/api/admin/bookings/handler.test.ts',
  'src/app/api/admin/divination-one-dollar-test/handler.test.ts',
  'src/app/api/admin/line-pay-entry-one-dollar-test/handler.test.ts',
  'src/app/api/ai-chart/reports/create/route.test.ts',
  'src/app/api/ai-chart/reports/read/route.test.ts',
  'src/app/api/bookings/create/route.test.ts',
  'src/app/api/bookings/read/handler.test.ts',
  'src/app/api/bookings/update/handler.test.ts',
  'src/app/api/calendar/create-event/handler.test.ts',
  'src/app/api/calendar/cancel-event/handler.test.ts',
  'src/app/api/divination/interpret/resume.test.ts',
  'src/app/api/payments/newebpay/create/divinationOneDollarTest.test.ts',
  'src/app/api/payments/newebpay/create/route.test.ts',
  'src/app/api/payments/newebpay/return/handler.test.ts',
  'src/app/api/payments/newebpay/test/start/handler.test.ts',
  'src/app/api/product-orders/create/route.test.ts',
  'src/app/payment/newebpay/return/route.test.ts',
  'src/lib/ai-chart/reportCompletion.test.ts',
  'src/lib/auth/admin.test.ts',
  'src/lib/auth/line.test.ts',
  'src/lib/bookings/bookingAccess.test.ts',
  'src/lib/email/bookingEmailRequestHandler.test.ts',
  'src/lib/email/sendBookingEmails.test.ts',
  'src/lib/google/createBookingCalendarEvent.test.ts',
  'src/lib/newebpay/aiChartSync.test.ts',
  'src/lib/newebpay/divinationOneDollarTest.test.ts',
  'src/lib/newebpay/divinationSync.test.ts',
  'src/lib/newebpay/notify.test.ts',
  'src/lib/newebpay/paymentForm.test.ts',
  'src/lib/payments/productOrderPayment.test.ts',
  'src/lib/supabase/adminBookings.test.ts',
  'src/lib/supabase/aiChartReports.test.ts',
  'src/lib/supabase/bookingPayments.test.ts',
  'src/lib/supabase/bookings.test.ts',
  'src/lib/supabase/coursePurchases.test.ts',
  'src/lib/supabase/divinationReadings.test.ts',
  'src/lib/supabase/payments.test.ts',
  'src/lib/supabase/productOrderSync.test.ts',
  'src/lib/supabase/productOrders.test.ts',
])
export const OFFLINE_CONTRACT_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: 'ai-chart-runner-contract',
    path: 'scripts/ai-chart/test-runner.contract.mjs',
    source: 'offline contract allowlist',
    type: 'offline-contract',
  }),
  Object.freeze({
    id: 'canonical-test-runner-contract',
    path: 'scripts/test/run-tests.contract.mjs',
    source: 'offline contract allowlist',
    type: 'offline-contract',
  }),
])

const THIS_FILE = fileURLToPath(import.meta.url)
const DEFAULT_REPOSITORY_ROOT = resolve(dirname(THIS_FILE), '../..')
const ENTRY_TYPE_ORDER = Object.freeze({
  typescript: 0,
  'offline-contract': 1,
})

export class CanonicalTestRunnerError extends Error {
  constructor(code, options = {}) {
    super(code)
    this.name = 'CanonicalTestRunnerError'
    this.code = code
    this.exitCode = options.exitCode ?? 1
    this.path = options.path ?? null
    this.sources = options.sources ?? []
  }
}

export function getSignalExitCode(signal) {
  if (signal === 'SIGINT') return 130
  if (signal === 'SIGTERM') return 143
  throw new CanonicalTestRunnerError('CANONICAL_TEST_SIGNAL_INVALID')
}

export function compareUtf8Bytes(left, right) {
  return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'))
}

function normalizeRelativePath(path) {
  if (
    typeof path !== 'string' ||
    path.length === 0 ||
    path.includes('\0') ||
    path.includes('\\') ||
    isAbsolute(path) ||
    path === '..' ||
    path.startsWith('../') ||
    path.includes('/../') ||
    posix.normalize(path) !== path
  ) {
    throw new CanonicalTestRunnerError('CANONICAL_TEST_PATH_INVALID', {
      path: typeof path === 'string' ? path : null,
    })
  }
  return path
}

function compareManifestEntries(left, right) {
  const typeDifference =
    ENTRY_TYPE_ORDER[left.type] - ENTRY_TYPE_ORDER[right.type]
  if (typeDifference !== 0) return typeDifference
  return compareUtf8Bytes(left.path, right.path)
}

export function normalizeManifestEntries(entries, options = {}) {
  if (!Array.isArray(entries)) {
    throw new CanonicalTestRunnerError('CANONICAL_TEST_MANIFEST_INVALID')
  }

  const normalized = entries.map((entry) => {
    if (
      typeof entry !== 'object' ||
      entry === null ||
      !Object.hasOwn(ENTRY_TYPE_ORDER, entry.type) ||
      typeof entry.id !== 'string' ||
      entry.id.length === 0 ||
      typeof entry.source !== 'string' ||
      entry.source.length === 0
    ) {
      throw new CanonicalTestRunnerError('CANONICAL_TEST_MANIFEST_INVALID')
    }
    return Object.freeze({
      id: entry.id,
      path: normalizeRelativePath(entry.path),
      source: entry.source,
      type: entry.type,
    })
  })

  const sourcesByPath = new Map()
  for (const entry of normalized) {
    const sources = sourcesByPath.get(entry.path) ?? []
    sources.push(entry.source)
    sourcesByPath.set(entry.path, sources)
  }
  for (const [path, sources] of sourcesByPath) {
    if (sources.length > 1) {
      throw new CanonicalTestRunnerError(
        'CANONICAL_TEST_DUPLICATE_ENTRY',
        { path, sources },
      )
    }
  }

  if (
    options.requireTypescript === true &&
    normalized.every(({ type }) => type !== 'typescript')
  ) {
    throw new CanonicalTestRunnerError(
      'CANONICAL_TEST_EMPTY_TYPESCRIPT_SUITE',
    )
  }

  return Object.freeze([...normalized].sort(compareManifestEntries))
}

function isTypeScriptTestPath(path) {
  return TYPESCRIPT_TEST_SUFFIXES.some((suffix) => path.endsWith(suffix))
}

function isInCanonicalTypeScriptRoot(path) {
  return TYPESCRIPT_DISCOVERY_ROOTS.some((root) => path.startsWith(root))
}

export function buildCanonicalManifest({ trackedFiles }) {
  if (!Array.isArray(trackedFiles)) {
    throw new CanonicalTestRunnerError('CANONICAL_TEST_DISCOVERY_INVALID')
  }

  const excluded = new Set(OPT_IN_TYPESCRIPT_INTEGRATIONS)
  const typescriptEntries = trackedFiles
    .map(normalizeRelativePath)
    .filter(
      (path) =>
        isTypeScriptTestPath(path) &&
        isInCanonicalTypeScriptRoot(path) &&
        !excluded.has(path),
    )
    .map((path) => ({
      id: path,
      path,
      source: 'git tracked TypeScript discovery',
      type: 'typescript',
    }))

  return normalizeManifestEntries(
    [...typescriptEntries, ...OFFLINE_CONTRACT_DEFINITIONS],
    { requireTypescript: true },
  )
}

export function computeManifestSha256(entries) {
  const normalized = normalizeManifestEntries(entries)
  const payload = {
    entries: normalized.map(({ id, path, type }) => ({ id, path, type })),
    schemaVersion: MANIFEST_SCHEMA_VERSION,
  }
  return createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex')
}

export async function validateRepositoryFile(repositoryRoot, path) {
  const normalizedPath = normalizeRelativePath(path)
  const absolutePath = resolve(repositoryRoot, normalizedPath)
  const relativePath = relative(repositoryRoot, absolutePath)
  if (
    relativePath === '..' ||
    relativePath.startsWith(`..${sep}`) ||
    isAbsolute(relativePath)
  ) {
    throw new CanonicalTestRunnerError('CANONICAL_TEST_PATH_ESCAPE', {
      path: normalizedPath,
    })
  }

  let metadata
  try {
    metadata = await lstat(absolutePath)
  } catch {
    throw new CanonicalTestRunnerError('CANONICAL_TEST_FILE_MISSING', {
      path: normalizedPath,
    })
  }
  if (metadata.isSymbolicLink() || !metadata.isFile()) {
    throw new CanonicalTestRunnerError(
      'CANONICAL_TEST_REGULAR_FILE_REQUIRED',
      { path: normalizedPath },
    )
  }
  return absolutePath
}

function parseJsonObject(source, errorCode) {
  try {
    const value = JSON.parse(source)
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new Error(errorCode)
    }
    return value
  } catch {
    throw new CanonicalTestRunnerError(errorCode)
  }
}

function isExactVersion(value) {
  return (
    typeof value === 'string' &&
    /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u.test(value)
  )
}

export async function validateLocalTsx(repositoryRoot) {
  const packageJsonPath = resolve(repositoryRoot, 'package.json')
  const packageLockPath = resolve(repositoryRoot, 'package-lock.json')
  const installedPackagePath = resolve(
    repositoryRoot,
    'node_modules/tsx/package.json',
  )
  const [packageJsonSource, packageLockSource, installedPackageSource] =
    await Promise.all([
      readFile(packageJsonPath, 'utf8'),
      readFile(packageLockPath, 'utf8'),
      readFile(installedPackagePath, 'utf8'),
    ])
  const packageJson = parseJsonObject(
    packageJsonSource,
    'CANONICAL_TEST_PACKAGE_INVALID',
  )
  const packageLock = parseJsonObject(
    packageLockSource,
    'CANONICAL_TEST_LOCK_INVALID',
  )
  const installedPackage = parseJsonObject(
    installedPackageSource,
    'CANONICAL_TEST_TSX_INVALID',
  )
  const pinnedVersion = packageJson.devDependencies?.tsx
  const lockVersion = packageLock.packages?.['']?.devDependencies?.tsx
  const installedVersion = installedPackage.version

  if (
    !isExactVersion(pinnedVersion) ||
    pinnedVersion !== lockVersion ||
    pinnedVersion !== installedVersion
  ) {
    throw new CanonicalTestRunnerError(
      'CANONICAL_TEST_TSX_VERSION_INVALID',
    )
  }

  const loaderPath = resolve(
    repositoryRoot,
    'node_modules/tsx/dist/loader.mjs',
  )
  await validateRepositoryFile(
    repositoryRoot,
    'node_modules/tsx/dist/loader.mjs',
  ).catch(() => {
    throw new CanonicalTestRunnerError('CANONICAL_TEST_TSX_ENTRY_INVALID')
  })

  return Object.freeze({
    importUrl: pathToFileURL(loaderPath).href,
    version: pinnedVersion,
  })
}

function createChildEnvironment(repositoryRoot, sourceEnvironment = process.env) {
  const environment = {
    HOME: sourceEnvironment.HOME,
    LANG: sourceEnvironment.LANG ?? 'C.UTF-8',
    LC_ALL: sourceEnvironment.LC_ALL,
    NODE_ENV: 'test',
    NODE_PATH: resolve(repositoryRoot, 'node_modules/next/dist/compiled'),
    PATH: sourceEnvironment.PATH,
    TMPDIR: sourceEnvironment.TMPDIR ?? '/tmp',
    TZ: sourceEnvironment.TZ ?? 'UTC',
  }
  return Object.fromEntries(
    Object.entries(environment).filter(([, value]) => value !== undefined),
  )
}

export function buildChildProcessSpec(
  entry,
  { repositoryRoot, tsxImportUrl },
) {
  const [normalizedEntry] = normalizeManifestEntries([entry])
  const absolutePath = resolve(repositoryRoot, normalizedEntry.path)
  const isNativeNodeTest =
    normalizedEntry.type === 'typescript' &&
    NATIVE_NODE_TEST_FILES.includes(normalizedEntry.path)

  let args
  if (normalizedEntry.type === 'offline-contract') {
    args = [absolutePath]
  } else if (isNativeNodeTest) {
    args = ['--test', absolutePath]
  } else {
    args = REACT_SERVER_TEST_FILES.includes(normalizedEntry.path)
      ? [
          '--conditions=react-server',
          '--import',
          tsxImportUrl,
          absolutePath,
        ]
      : ['--import', tsxImportUrl, absolutePath]
  }

  return Object.freeze({
    args: Object.freeze(args),
    command: process.execPath,
    options: Object.freeze({
      cwd: repositoryRoot,
      env: createChildEnvironment(repositoryRoot),
      shell: false,
      stdio: 'inherit',
    }),
  })
}

export async function executeManifest(entries, options = {}) {
  const manifest = normalizeManifestEntries(entries)
  const executeEntry = options.executeEntry
  const listOnly = options.listOnly === true
  const report =
    typeof options.report === 'function' ? options.report : () => {}

  if (!listOnly && typeof executeEntry !== 'function') {
    throw new CanonicalTestRunnerError(
      'CANONICAL_TEST_EXECUTOR_INVALID',
    )
  }

  const counts = {
    offlineContractsFailed: 0,
    offlineContractsPassed: 0,
    offlineContractsTotal: manifest.filter(
      ({ type }) => type === 'offline-contract',
    ).length,
    typescriptFailed: 0,
    typescriptPassed: 0,
    typescriptTotal: manifest.filter(
      ({ type }) => type === 'typescript',
    ).length,
  }
  const failedTests = []

  if (listOnly) {
    manifest.forEach((entry, index) => {
      report('list', entry, index + 1, manifest.length, null)
    })
    return Object.freeze({
      counts: Object.freeze(counts),
      failedTests: Object.freeze([]),
      ok: true,
    })
  }

  for (let index = 0; index < manifest.length; index += 1) {
    const entry = manifest[index]
    report('run', entry, index + 1, manifest.length, null)
    let result
    try {
      result = await executeEntry(entry)
    } catch (error) {
      if (
        error instanceof CanonicalTestRunnerError &&
        error.code === 'CANONICAL_TEST_INTERRUPTED'
      ) {
        throw error
      }
      result = {
        code: null,
        durationMs: 0,
        error,
        signal: null,
      }
    }

    const passed =
      result?.error == null &&
      result?.signal == null &&
      result?.code === 0
    const countPrefix =
      entry.type === 'typescript' ? 'typescript' : 'offlineContracts'
    if (passed) {
      counts[`${countPrefix}Passed`] += 1
      report(
        'pass',
        entry,
        index + 1,
        manifest.length,
        result.durationMs,
      )
    } else {
      counts[`${countPrefix}Failed`] += 1
      failedTests.push(entry.path)
      report(
        'fail',
        entry,
        index + 1,
        manifest.length,
        result?.durationMs ?? 0,
      )
    }
  }

  return Object.freeze({
    counts: Object.freeze(counts),
    failedTests: Object.freeze(failedTests),
    ok: failedTests.length === 0,
  })
}

function discoverTrackedFiles(repositoryRoot) {
  const result = spawnSync('git', ['ls-files', '-z'], {
    cwd: repositoryRoot,
    encoding: 'buffer',
    shell: false,
  })
  if (
    result.error ||
    result.signal !== null ||
    result.status !== 0
  ) {
    throw new CanonicalTestRunnerError(
      'CANONICAL_TEST_GIT_DISCOVERY_FAILED',
    )
  }
  return result.stdout.toString('utf8').split('\0').filter(Boolean)
}

function createProcessExecutor({ repositoryRoot, tsxImportUrl }) {
  let activeChild = null
  let interruptSignal = null

  const handleSignal = (signal) => {
    interruptSignal = signal
    if (activeChild !== null) activeChild.kill(signal)
  }
  const handleSigint = () => handleSignal('SIGINT')
  const handleSigterm = () => handleSignal('SIGTERM')
  process.once('SIGINT', handleSigint)
  process.once('SIGTERM', handleSigterm)

  return Object.freeze({
    dispose() {
      process.off('SIGINT', handleSigint)
      process.off('SIGTERM', handleSigterm)
    },
    async execute(entry) {
      if (interruptSignal !== null) {
        throw new CanonicalTestRunnerError(
          'CANONICAL_TEST_INTERRUPTED',
          { exitCode: getSignalExitCode(interruptSignal) },
        )
      }
      const specification = buildChildProcessSpec(entry, {
        repositoryRoot,
        tsxImportUrl,
      })
      const startedAt = process.hrtime.bigint()
      const result = await new Promise((complete) => {
        let child
        try {
          child = spawn(
            specification.command,
            specification.args,
            specification.options,
          )
        } catch (error) {
          complete({ code: null, error, signal: null })
          return
        }
        activeChild = child
        let spawnError = null
        child.once('error', (error) => {
          spawnError = error
        })
        child.once('close', (code, signal) => {
          activeChild = null
          complete({ code, error: spawnError, signal })
        })
      })
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6
      if (interruptSignal !== null) {
        throw new CanonicalTestRunnerError(
          'CANONICAL_TEST_INTERRUPTED',
          { exitCode: getSignalExitCode(interruptSignal) },
        )
      }
      return { ...result, durationMs }
    },
  })
}

function reportManifestEvent(event, entry, index, total, durationMs) {
  const label = entry.type === 'typescript' ? 'TS' : 'CONTRACT'
  if (event === 'list') {
    console.log(
      `[canonical-test] LIST ${index}/${total} ${label} ${entry.path}`,
    )
    return
  }
  if (event === 'run') {
    console.log(
      `[canonical-test] RUN ${index}/${total} ${label} ${entry.path}`,
    )
    return
  }
  const duration = `${Math.round(durationMs)}ms`
  const output = event === 'pass' ? console.log : console.error
  output(
    `[canonical-test] ${event.toUpperCase()} ` +
      `${index}/${total} ${label} ${entry.path} ${duration}`,
  )
}

function printSummary(result, durationMs, manifestSha256) {
  console.log('[canonical-test] Summary')
  console.log(
    `[canonical-test] Manifest SHA-256: ${manifestSha256}`,
  )
  console.log(
    `[canonical-test] TypeScript tests total: ` +
      `${result.counts.typescriptTotal}`,
  )
  console.log(
    `[canonical-test] TypeScript passed: ` +
      `${result.counts.typescriptPassed}`,
  )
  console.log(
    `[canonical-test] TypeScript failed: ` +
      `${result.counts.typescriptFailed}`,
  )
  console.log(
    `[canonical-test] Offline contracts total: ` +
      `${result.counts.offlineContractsTotal}`,
  )
  console.log(
    `[canonical-test] Offline contracts passed: ` +
      `${result.counts.offlineContractsPassed}`,
  )
  console.log(
    `[canonical-test] Offline contracts failed: ` +
      `${result.counts.offlineContractsFailed}`,
  )
  console.log(
    `[canonical-test] Overall duration: ${Math.round(durationMs)}ms`,
  )
  console.log(
    `[canonical-test] Failed test list: ` +
      `${result.failedTests.length === 0 ? 'none' : result.failedTests.join(', ')}`,
  )
  if (result.ok) console.log('[canonical-test] PASS')
  else console.error('[canonical-test] FAIL')
}

async function main(args = process.argv.slice(2)) {
  if (args.length > 1 || (args.length === 1 && args[0] !== '--list')) {
    throw new CanonicalTestRunnerError(
      'CANONICAL_TEST_ARGUMENT_INVALID',
    )
  }
  const listOnly = args[0] === '--list'
  const repositoryRoot = DEFAULT_REPOSITORY_ROOT
  const trackedFiles = discoverTrackedFiles(repositoryRoot)
  const trackedSet = new Set(trackedFiles)
  const manifest = buildCanonicalManifest({ trackedFiles })

  for (const entry of manifest) {
    if (!trackedSet.has(entry.path)) {
      throw new CanonicalTestRunnerError(
        'CANONICAL_TEST_MANIFEST_ENTRY_UNTRACKED',
        { path: entry.path },
      )
    }
    await validateRepositoryFile(repositoryRoot, entry.path)
  }

  const tsx = await validateLocalTsx(repositoryRoot)
  const manifestSha256 = computeManifestSha256(manifest)
  console.log(
    `[canonical-test] Manifest schema: ${MANIFEST_SCHEMA_VERSION}`,
  )
  console.log(
    `[canonical-test] Manifest SHA-256: ${manifestSha256}`,
  )
  console.log(
    `[canonical-test] TypeScript files: ` +
      `${manifest.filter(({ type }) => type === 'typescript').length}`,
  )
  console.log(
    `[canonical-test] Offline contracts: ` +
      `${manifest.filter(({ type }) => type === 'offline-contract').length}`,
  )
  console.log(`[canonical-test] Local tsx: ${tsx.version}`)

  if (listOnly) {
    await executeManifest(manifest, {
      listOnly: true,
      report: reportManifestEvent,
    })
    console.log('[canonical-test] LIST PASS')
    return
  }

  const executor = createProcessExecutor({
    repositoryRoot,
    tsxImportUrl: tsx.importUrl,
  })
  const startedAt = process.hrtime.bigint()
  try {
    const result = await executeManifest(manifest, {
      executeEntry: executor.execute,
      report: reportManifestEvent,
    })
    const durationMs =
      Number(process.hrtime.bigint() - startedAt) / 1e6
    printSummary(result, durationMs, manifestSha256)
    if (!result.ok) process.exitCode = 1
  } finally {
    executor.dispose()
  }
}

const isDirectExecution =
  process.argv[1] !== undefined &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url

if (isDirectExecution) {
  main().catch((error) => {
    const code =
      error instanceof CanonicalTestRunnerError
        ? error.code
        : 'CANONICAL_TEST_RUNNER_FAILED'
    const path =
      error instanceof CanonicalTestRunnerError && error.path !== null
        ? ` ${error.path}`
        : ''
    const sources =
      error instanceof CanonicalTestRunnerError &&
      error.sources.length > 0
        ? ` sources=${error.sources.join(', ')}`
        : ''
    console.error(`[canonical-test] FAIL ${code}${path}${sources}`)
    process.exitCode =
      error instanceof CanonicalTestRunnerError
        ? error.exitCode
        : 1
  })
}
