import assert from 'node:assert/strict'
import Module, { createRequire } from 'node:module'
import {
  appendFile,
  cp,
  mkdir,
  mkdtemp,
  rm,
  symlink,
  unlink,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import {
  AI_CHART_D1_ASSET_INTEGRITY_FAILED,
  AI_CHART_D1_ASSET_ROOT,
  AI_CHART_D1_EXPECTED_FILE_COUNT,
  AI_CHART_D1_LOCKED_MANIFEST_SHA256,
  AI_CHART_D1_MANIFEST_PATH,
  AI_CHART_D1_RUNTIME_DISABLED,
} from './d1Assets'

type NodeModuleInternals = {
  _resolveFilename: (
    request: string,
    parent: unknown,
    isMain: boolean,
    options?: unknown,
  ) => string
  _load: (request: string, parent: unknown, isMain: boolean) => unknown
}

const moduleInternals = Module as unknown as NodeModuleInternals
const originalResolveFilename = moduleInternals._resolveFilename
const originalLoad = moduleInternals._load
const testRequire = createRequire(import.meta.url)
const serverOnlyStubPath = testRequire.resolve('./d1Assets')

moduleInternals._resolveFilename = function resolveFilenameForTest(
  this: unknown,
  request: string,
  parent: unknown,
  isMain: boolean,
  options?: unknown,
) {
  if (request === 'server-only') return serverOnlyStubPath
  return originalResolveFilename.call(this, request, parent, isMain, options)
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

const {
  loadAiChartD1RuntimeAssetBundle,
  verifyAiChartD1AssetBundle,
} = testRequire('./d1Assets.server') as typeof import('./d1Assets.server')

moduleInternals._resolveFilename = originalResolveFilename
moduleInternals._load = originalLoad

function isWithinOrEqual(root: string, candidate: string): boolean {
  const relativePath = relative(root, candidate)
  return (
    relativePath === '' ||
    (relativePath !== '..' &&
      !relativePath.startsWith(`..${sep}`) &&
      !isAbsolute(relativePath))
  )
}

async function expectIntegrityFailure(run: () => Promise<unknown>) {
  try {
    await run()
    assert.fail('expected asset integrity failure')
  } catch (error) {
    assert.equal(error instanceof Error, true)
    if (!(error instanceof Error)) assert.fail('expected Error')
    assert.equal(error.message, AI_CHART_D1_ASSET_INTEGRITY_FAILED)
  }
}

async function run() {
  const repositoryRoot = process.cwd()
  const suiteRoot = await mkdtemp(join(tmpdir(), 'ai-chart-d1-assets-'))
  assert.equal(isWithinOrEqual(resolve(tmpdir()), resolve(suiteRoot)), true)

  async function copyProjectAssets() {
    const projectRoot = await mkdtemp(join(suiteRoot, 'case-'))
    const destination = join(projectRoot, AI_CHART_D1_ASSET_ROOT)
    await mkdir(dirname(destination), { recursive: true })
    await cp(join(repositoryRoot, AI_CHART_D1_ASSET_ROOT), destination, {
      recursive: true,
    })
    return projectRoot
  }

  async function safeCleanup(pathToRemove: string) {
    const resolvedSuiteRoot = resolve(suiteRoot)
    const resolvedRemovalPath = resolve(pathToRemove)
    assert.equal(isWithinOrEqual(resolvedSuiteRoot, resolvedRemovalPath), true)
    await rm(resolvedRemovalPath, { recursive: true, force: true })
  }

  try {
    const verified = await verifyAiChartD1AssetBundle()
    assert.equal(verified.manifestSha256, AI_CHART_D1_LOCKED_MANIFEST_SHA256)
    assert.equal(verified.files.length, AI_CHART_D1_EXPECTED_FILE_COUNT)
    assert.equal(verified.runtimeEnabled, false)
    assert.equal(Object.isFrozen(verified), true)
    assert.equal(Object.isFrozen(verified.files), true)

    for (let index = 0; index < verified.files.length; index += 1) {
      assert.equal(verified.files[index].sha256, verified.manifest.files[index].sha256)
      assert.equal(verified.files[index].path, verified.manifest.files[index].path)
      assert.equal(Object.isFrozen(verified.files[index]), true)
    }

    await assert.rejects(
      () => loadAiChartD1RuntimeAssetBundle(),
      { message: AI_CHART_D1_RUNTIME_DISABLED },
    )

    const tamperedProject = await copyProjectAssets()
    await appendFile(
      join(tamperedProject, verified.manifest.files[0].path),
      '\ntampered-test-content',
    )
    await expectIntegrityFailure(() =>
      verifyAiChartD1AssetBundle({ projectRoot: tamperedProject }),
    )

    const missingProject = await copyProjectAssets()
    await unlink(join(missingProject, verified.manifest.files[0].path))
    await expectIntegrityFailure(() =>
      verifyAiChartD1AssetBundle({ projectRoot: missingProject }),
    )

    const manifestTamperProject = await copyProjectAssets()
    await appendFile(join(manifestTamperProject, AI_CHART_D1_MANIFEST_PATH), ' ')
    await expectIntegrityFailure(() =>
      verifyAiChartD1AssetBundle({ projectRoot: manifestTamperProject }),
    )

    const symlinkProject = await copyProjectAssets()
    const symlinkPath = join(symlinkProject, verified.manifest.files[0].path)
    const symlinkTarget = join(symlinkProject, verified.manifest.files[1].path)
    let symlinkCreated = false

    try {
      await unlink(symlinkPath)
      await symlink(symlinkTarget, symlinkPath)
      symlinkCreated = true
    } catch (error) {
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? String(error.code)
          : ''
      if (!['EPERM', 'EACCES', 'ENOTSUP'].includes(code)) throw error
      console.log(`- symlink test skipped: ${code}`)
    }

    if (symlinkCreated) {
      await expectIntegrityFailure(() =>
        verifyAiChartD1AssetBundle({ projectRoot: symlinkProject }),
      )
      console.log('✓ symlink asset rejected')
    }

    console.log('✓ repository manifest lock and 23 asset SHA checks')
    console.log('✓ tampered asset rejected')
    console.log('✓ missing asset rejected')
    console.log('✓ tampered manifest lock rejected')
    console.log('✓ runtime disabled guard rejected loading')
  } finally {
    await safeCleanup(suiteRoot)
  }
}

void run()
