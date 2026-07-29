import 'server-only'

import { lstat, mkdir, open, realpath } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import { freezeAiChartD1Value } from './d1CommonContracts'
import {
  AI_CHART_D1_PALACE_WRITING_PREVIEW_CLAIM_OBSERVATION_TASK,
  AI_CHART_D1_PALACE_WRITING_PREVIEW_CLAIM_OBSERVATION_VERSION,
  parseAiChartD1PalaceWritingPreviewAuthorization,
  parseAiChartD1PalaceWritingPreviewGatePlan,
  type AiChartD1PalaceWritingPreviewClaimObservation,
  type AiChartD1PalaceWritingPreviewGatePlan,
} from './d1PalaceWritingPreviewGateContracts'
import {
  createAiChartD1PalaceWritingCanonicalJson,
} from './d1PalaceWritingPromptPackageContracts'

export const AI_CHART_D1_PALACE_WRITING_PREVIEW_ATOMIC_CLAIM_VERSION =
  'ai-chart-d1-palace-writing-preview-atomic-claim/v1' as const
export const AI_CHART_D1_PALACE_WRITING_PREVIEW_ATOMIC_CLAIM_TASK =
  'D1_PALACE_WRITING_PREVIEW_ATOMIC_CLAIM' as const
export const AI_CHART_D1_PALACE_WRITING_PREVIEW_CLAIM_ALREADY_EXISTS =
  'ai_chart_d1_palace_writing_preview_claim_already_exists' as const
export const AI_CHART_D1_PALACE_WRITING_PREVIEW_CLAIM_STORAGE_INVALID =
  'ai_chart_d1_palace_writing_preview_claim_storage_invalid' as const

export type AiChartD1PalaceWritingPreviewAtomicClaim =
  Readonly<{
    contractVersion:
      typeof AI_CHART_D1_PALACE_WRITING_PREVIEW_ATOMIC_CLAIM_VERSION
    task:
      typeof AI_CHART_D1_PALACE_WRITING_PREVIEW_ATOMIC_CLAIM_TASK
    gateFingerprint: string
    authority: 'TRUSTED_ATOMIC_STORAGE_ADAPTER'
    claimArtifactName: 'request-started.json'
    status: 'CLAIMED'
    authorizationConsumed: true
    nextRequiredAction: 'STOP_BEFORE_REQUEST_RUNTIME'
    fetchAllowed: false
    openAiCallable: false
    attemptedRequests: 0
    fetchCount: 0
    openAiRequests: 0
  }>

export class AiChartD1PalaceWritingPreviewClaimAlreadyExistsError
  extends Error {
  readonly code =
    AI_CHART_D1_PALACE_WRITING_PREVIEW_CLAIM_ALREADY_EXISTS

  constructor() {
    super(AI_CHART_D1_PALACE_WRITING_PREVIEW_CLAIM_ALREADY_EXISTS)
    this.name =
      'AiChartD1PalaceWritingPreviewClaimAlreadyExistsError'
    Object.freeze(this)
  }
}

export class AiChartD1PalaceWritingPreviewClaimStorageError
  extends Error {
  readonly code =
    AI_CHART_D1_PALACE_WRITING_PREVIEW_CLAIM_STORAGE_INVALID

  constructor() {
    super(AI_CHART_D1_PALACE_WRITING_PREVIEW_CLAIM_STORAGE_INVALID)
    this.name = 'AiChartD1PalaceWritingPreviewClaimStorageError'
    Object.freeze(this)
  }
}

function storageInvalid(): never {
  throw new AiChartD1PalaceWritingPreviewClaimStorageError()
}

function alreadyClaimed(): never {
  throw new AiChartD1PalaceWritingPreviewClaimAlreadyExistsError()
}

function isNodeErrorWithCode(
  value: unknown,
  code: string,
): boolean {
  return (
    value instanceof Error &&
    'code' in value &&
    value.code === code
  )
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

async function validatePrivateDirectory(
  directory: string,
): Promise<void> {
  const metadata = await lstat(directory)
  const currentUserId =
    typeof process.getuid === 'function' ? process.getuid() : null
  if (
    metadata.isSymbolicLink() ||
    !metadata.isDirectory() ||
    (metadata.mode & 0o777) !== 0o700 ||
    (currentUserId !== null && metadata.uid !== currentUserId)
  ) {
    storageInvalid()
  }
}

async function validatePrivateClaimFile(
  claimPath: string,
): Promise<void> {
  const metadata = await lstat(claimPath)
  const currentUserId =
    typeof process.getuid === 'function' ? process.getuid() : null
  if (
    metadata.isSymbolicLink() ||
    !metadata.isFile() ||
    (metadata.mode & 0o777) !== 0o600 ||
    (currentUserId !== null && metadata.uid !== currentUserId)
  ) {
    storageInvalid()
  }
}

async function resolveStorageRoot(): Promise<string> {
  const systemTemporaryRoot = await realpath(resolve(tmpdir()))
  const unresolvedStorageRoot = resolve(
    join(
      tmpdir(),
      'ai-chart-d1-palace-writing-preview-claims',
    ),
  )

  try {
    await mkdir(unresolvedStorageRoot, { mode: 0o700 })
  } catch (error) {
    if (!isNodeErrorWithCode(error, 'EEXIST')) {
      storageInvalid()
    }
  }
  await validatePrivateDirectory(unresolvedStorageRoot)
  const storageRoot = await realpath(unresolvedStorageRoot)
  if (!isPathInside(systemTemporaryRoot, storageRoot)) {
    storageInvalid()
  }
  return storageRoot
}

async function resolveExistingStorageRoot(): Promise<string | null> {
  const unresolvedTemporaryRoot = resolve(tmpdir())
  const unresolvedStorageRoot = resolve(
    join(
      unresolvedTemporaryRoot,
      'ai-chart-d1-palace-writing-preview-claims',
    ),
  )
  if (
    !isPathInside(
      unresolvedTemporaryRoot,
      unresolvedStorageRoot,
    )
  ) {
    storageInvalid()
  }

  try {
    await validatePrivateDirectory(unresolvedStorageRoot)
  } catch (error) {
    if (isNodeErrorWithCode(error, 'ENOENT')) return null
    if (
      error instanceof
      AiChartD1PalaceWritingPreviewClaimStorageError
    ) {
      throw error
    }
    storageInvalid()
  }

  const systemTemporaryRoot = await realpath(
    unresolvedTemporaryRoot,
  )
  const storageRoot = await realpath(unresolvedStorageRoot)
  if (!isPathInside(systemTemporaryRoot, storageRoot)) {
    storageInvalid()
  }
  return storageRoot
}

async function createClaimDirectory(
  storageRoot: string,
  gateFingerprint: string,
): Promise<string> {
  const claimDirectory = join(storageRoot, gateFingerprint)
  if (!isPathInside(storageRoot, claimDirectory)) {
    storageInvalid()
  }
  try {
    await mkdir(claimDirectory, { mode: 0o700 })
  } catch (error) {
    if (!isNodeErrorWithCode(error, 'EEXIST')) {
      storageInvalid()
    }
  }
  await validatePrivateDirectory(claimDirectory)
  return claimDirectory
}

function createClaimValue(
  gatePlan: AiChartD1PalaceWritingPreviewGatePlan,
): AiChartD1PalaceWritingPreviewAtomicClaim {
  return freezeAiChartD1Value({
    contractVersion:
      AI_CHART_D1_PALACE_WRITING_PREVIEW_ATOMIC_CLAIM_VERSION,
    task:
      AI_CHART_D1_PALACE_WRITING_PREVIEW_ATOMIC_CLAIM_TASK,
    gateFingerprint: gatePlan.gateFingerprint,
    authority: 'TRUSTED_ATOMIC_STORAGE_ADAPTER' as const,
    claimArtifactName: gatePlan.claimArtifactName,
    status: 'CLAIMED' as const,
    authorizationConsumed: true as const,
    nextRequiredAction: 'STOP_BEFORE_REQUEST_RUNTIME' as const,
    fetchAllowed: false as const,
    openAiCallable: false as const,
    attemptedRequests: 0 as const,
    fetchCount: 0 as const,
    openAiRequests: 0 as const,
  })
}

function createClaimObservation(
  gatePlan: AiChartD1PalaceWritingPreviewGatePlan,
  state: AiChartD1PalaceWritingPreviewClaimObservation['state'],
): AiChartD1PalaceWritingPreviewClaimObservation {
  return freezeAiChartD1Value({
    contractVersion:
      AI_CHART_D1_PALACE_WRITING_PREVIEW_CLAIM_OBSERVATION_VERSION,
    task:
      AI_CHART_D1_PALACE_WRITING_PREVIEW_CLAIM_OBSERVATION_TASK,
    gateFingerprint: gatePlan.gateFingerprint,
    authority: 'TRUSTED_ATOMIC_STORAGE_ADAPTER' as const,
    claimArtifactName: gatePlan.claimArtifactName,
    state,
  })
}

export async function observeAiChartD1PalaceWritingPreviewClaim(
  gatePlanValue: unknown,
): Promise<AiChartD1PalaceWritingPreviewClaimObservation> {
  const gatePlan =
    parseAiChartD1PalaceWritingPreviewGatePlan(gatePlanValue)
  const storageRoot = await resolveExistingStorageRoot()
  if (storageRoot === null) {
    return createClaimObservation(gatePlan, 'ABSENT')
  }

  const claimDirectory = join(
    storageRoot,
    gatePlan.gateFingerprint,
  )
  try {
    await validatePrivateDirectory(claimDirectory)
  } catch (error) {
    if (isNodeErrorWithCode(error, 'ENOENT')) {
      return createClaimObservation(gatePlan, 'ABSENT')
    }
    if (
      error instanceof
      AiChartD1PalaceWritingPreviewClaimStorageError
    ) {
      throw error
    }
    storageInvalid()
  }

  const claimPath = join(
    claimDirectory,
    gatePlan.claimArtifactName,
  )
  try {
    await validatePrivateClaimFile(claimPath)
  } catch (error) {
    if (isNodeErrorWithCode(error, 'ENOENT')) {
      return createClaimObservation(gatePlan, 'ABSENT')
    }
    if (
      error instanceof
      AiChartD1PalaceWritingPreviewClaimStorageError
    ) {
      throw error
    }
    storageInvalid()
  }

  return createClaimObservation(gatePlan, 'PRESENT')
}

export async function claimAiChartD1PalaceWritingPreviewExecution(
  gatePlanValue: unknown,
  authorizationValue: unknown,
): Promise<AiChartD1PalaceWritingPreviewAtomicClaim> {
  const gatePlan =
    parseAiChartD1PalaceWritingPreviewGatePlan(gatePlanValue)
  parseAiChartD1PalaceWritingPreviewAuthorization(
    authorizationValue,
    gatePlan,
  )
  const claimValue = createClaimValue(gatePlan)

  let claimDirectory: string
  try {
    const storageRoot = await resolveStorageRoot()
    claimDirectory = await createClaimDirectory(
      storageRoot,
      gatePlan.gateFingerprint,
    )
  } catch (error) {
    if (
      error instanceof
      AiChartD1PalaceWritingPreviewClaimStorageError
    ) {
      throw error
    }
    storageInvalid()
  }

  const claimPath = join(
    claimDirectory,
    gatePlan.claimArtifactName,
  )
  let claimFile
  try {
    claimFile = await open(claimPath, 'wx', 0o600)
  } catch (error) {
    if (isNodeErrorWithCode(error, 'EEXIST')) {
      try {
        await validatePrivateClaimFile(claimPath)
      } catch (metadataError) {
        if (
          metadataError instanceof
          AiChartD1PalaceWritingPreviewClaimStorageError
        ) {
          throw metadataError
        }
        storageInvalid()
      }
      alreadyClaimed()
    }
    storageInvalid()
  }

  try {
    await claimFile.writeFile(
      createAiChartD1PalaceWritingCanonicalJson(claimValue),
      { encoding: 'utf8' },
    )
    await claimFile.sync()
  } catch {
    storageInvalid()
  } finally {
    await claimFile.close().catch(() => undefined)
  }

  return claimValue
}
