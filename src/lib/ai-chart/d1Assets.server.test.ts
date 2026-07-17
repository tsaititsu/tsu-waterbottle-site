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
  writeFile,
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
import { AI_CHART_D1_K0_SOURCE_WHITELIST } from './d1K0Registry'

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
const testRequire = createRequire(__filename)
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
  readVerifiedAiChartD1CompilationAssets,
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

    const compilationAssets = await readVerifiedAiChartD1CompilationAssets(
      AI_CHART_D1_K0_SOURCE_WHITELIST,
      { allowedPaths: AI_CHART_D1_K0_SOURCE_WHITELIST },
    )
    assert.equal(compilationAssets.length, 9)
    assert.equal(Object.isFrozen(compilationAssets), true)
    assert.equal(compilationAssets.every((asset) => Object.isFrozen(asset)), true)
    assert.equal(compilationAssets.every((asset) => asset.text.length > 0), true)

    await expectIntegrityFailure(() =>
      readVerifiedAiChartD1CompilationAssets(
        ['content/ai-chart/d1-v1/knowledge/not-in-manifest.md'],
        {
          allowedPaths: [
            'content/ai-chart/d1-v1/knowledge/not-in-manifest.md',
          ],
        },
      ),
    )
    await expectIntegrityFailure(() =>
      readVerifiedAiChartD1CompilationAssets(
        ['content/ai-chart/d1-v1/prompt/0_主控.md'],
        { allowedPaths: AI_CHART_D1_K0_SOURCE_WHITELIST },
      ),
    )
    const nonRuntimeSource = verified.manifest.files.find(
      (file) => file.status === 'draft' || file.status === 'reference_only',
    )
    assert.ok(nonRuntimeSource)
    await expectIntegrityFailure(() =>
      readVerifiedAiChartD1CompilationAssets([nonRuntimeSource.path], {
        allowedPaths: [nonRuntimeSource.path],
      }),
    )
    await expectIntegrityFailure(() =>
      readVerifiedAiChartD1CompilationAssets(['../outside.md'], {
        allowedPaths: ['../outside.md'],
      }),
    )
    await expectIntegrityFailure(() =>
      readVerifiedAiChartD1CompilationAssets(['/tmp/outside.md'], {
        allowedPaths: ['/tmp/outside.md'],
      }),
    )

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
    await appendFile(
      join(tamperedProject, AI_CHART_D1_K0_SOURCE_WHITELIST[0]),
      '\ntampered-k0-content',
    )
    await expectIntegrityFailure(() =>
      readVerifiedAiChartD1CompilationAssets(
        [AI_CHART_D1_K0_SOURCE_WHITELIST[0]],
        {
          projectRoot: tamperedProject,
          allowedPaths: AI_CHART_D1_K0_SOURCE_WHITELIST,
        },
      ),
    )

    const invalidUtf8Project = await copyProjectAssets()
    await writeFile(
      join(invalidUtf8Project, AI_CHART_D1_K0_SOURCE_WHITELIST[0]),
      Buffer.from([0xc3, 0x28]),
    )
    await expectIntegrityFailure(() =>
      readVerifiedAiChartD1CompilationAssets(
        [AI_CHART_D1_K0_SOURCE_WHITELIST[0]],
        {
          projectRoot: invalidUtf8Project,
          allowedPaths: AI_CHART_D1_K0_SOURCE_WHITELIST,
        },
      ),
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
    const symlinkPath = join(
      symlinkProject,
      AI_CHART_D1_K0_SOURCE_WHITELIST[0],
    )
    const symlinkTarget = join(
      symlinkProject,
      AI_CHART_D1_K0_SOURCE_WHITELIST[1],
    )
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
      await expectIntegrityFailure(() =>
        readVerifiedAiChartD1CompilationAssets(
          [AI_CHART_D1_K0_SOURCE_WHITELIST[0]],
          {
            projectRoot: symlinkProject,
            allowedPaths: AI_CHART_D1_K0_SOURCE_WHITELIST,
          },
        ),
      )
      console.log('✓ symlink asset rejected')
    }

    console.log('✓ repository manifest lock and 23 asset SHA checks')
    console.log('✓ tampered asset rejected')
    console.log('✓ missing asset rejected')
    console.log('✓ tampered manifest lock rejected')
    console.log('✓ runtime disabled guard rejected loading')
    console.log('✓ server-only K0 compilation whitelist and UTF-8 guards')
  } finally {
    await safeCleanup(suiteRoot)
  }
}

void run()
