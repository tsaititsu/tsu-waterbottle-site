import 'server-only'

import { createHash } from 'node:crypto'
import { lstat, readFile, realpath } from 'node:fs/promises'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import {
  AI_CHART_D1_ASSET_INTEGRITY_FAILED,
  AI_CHART_D1_LOCKED_MANIFEST_SHA256,
  AI_CHART_D1_MANIFEST_PATH,
  AI_CHART_D1_RUNTIME_DISABLED,
  assertAiChartD1RuntimeEnabled,
  validateAiChartD1AssetManifest,
  type AiChartD1AssetClassification,
  type AiChartD1AssetManifest,
  type AiChartD1AssetStatus,
} from './d1Assets'

export type AiChartD1VerifiedAssetFile = {
  path: string
  sha256: string
  byteLength: number
  classification: AiChartD1AssetClassification
  status: AiChartD1AssetStatus
  runtimeEligible: boolean
  runtimeEnabled: boolean
}

export type AiChartD1VerifiedAssetBundle = {
  manifest: AiChartD1AssetManifest
  manifestSha256: string
  files: AiChartD1VerifiedAssetFile[]
  runtimeEnabled: boolean
}

type VerifyAiChartD1AssetBundleOptions = {
  projectRoot?: string
}

function integrityFailed(): never {
  throw new Error(AI_CHART_D1_ASSET_INTEGRITY_FAILED)
}

function sha256(value: Buffer): string {
  return createHash('sha256').update(value).digest('hex')
}

function isPathInside(root: string, candidate: string): boolean {
  const relativePath = relative(root, candidate)
  return (
    relativePath.length > 0 &&
    relativePath !== '..' &&
    !relativePath.startsWith(`..${sep}`) &&
    !isAbsolute(relativePath)
  )
}

async function readVerifiedRegularFile(
  projectRoot: string,
  repositoryRelativePath: string,
): Promise<Buffer> {
  const filePath = resolve(projectRoot, repositoryRelativePath)
  if (!isPathInside(projectRoot, filePath)) integrityFailed()

  const fileStat = await lstat(filePath)
  if (fileStat.isSymbolicLink() || !fileStat.isFile()) integrityFailed()

  const realFilePath = await realpath(filePath)
  if (!isPathInside(projectRoot, realFilePath)) {
    integrityFailed()
  }

  return readFile(filePath)
}

async function verifyAssetBundle(
  options: VerifyAiChartD1AssetBundleOptions,
): Promise<AiChartD1VerifiedAssetBundle> {
  const projectRoot = await realpath(resolve(options.projectRoot ?? process.cwd()))
  const manifestBuffer = await readVerifiedRegularFile(
    projectRoot,
    AI_CHART_D1_MANIFEST_PATH,
  )
  const manifestSha256 = sha256(manifestBuffer)

  if (manifestSha256 !== AI_CHART_D1_LOCKED_MANIFEST_SHA256) integrityFailed()

  const manifest = validateAiChartD1AssetManifest(
    JSON.parse(manifestBuffer.toString('utf8')) as unknown,
  )

  const files: AiChartD1VerifiedAssetFile[] = []

  for (const manifestFile of manifest.files) {
    const fileBuffer = await readVerifiedRegularFile(projectRoot, manifestFile.path)
    const fileSha256 = sha256(fileBuffer)

    if (fileSha256 !== manifestFile.sha256) integrityFailed()

    if (manifestFile.path.endsWith('.json')) {
      JSON.parse(fileBuffer.toString('utf8'))
    }

    files.push(
      Object.freeze({
        path: manifestFile.path,
        sha256: fileSha256,
        byteLength: fileBuffer.byteLength,
        classification: manifestFile.classification,
        status: manifestFile.status,
        runtimeEligible: manifestFile.runtimeEligible,
        runtimeEnabled: manifestFile.runtimeEnabled,
      }),
    )
  }

  return Object.freeze({
    manifest,
    manifestSha256,
    files: Object.freeze(files) as unknown as AiChartD1VerifiedAssetFile[],
    runtimeEnabled: manifest.runtimeEnabled,
  })
}

export async function verifyAiChartD1AssetBundle(
  options: VerifyAiChartD1AssetBundleOptions = {},
): Promise<AiChartD1VerifiedAssetBundle> {
  try {
    return await verifyAssetBundle(options)
  } catch {
    integrityFailed()
  }
}

export async function loadAiChartD1RuntimeAssetBundle(): Promise<never> {
  const bundle = await verifyAiChartD1AssetBundle()
  assertAiChartD1RuntimeEnabled(bundle.manifest)
  throw new Error(AI_CHART_D1_RUNTIME_DISABLED)
}
