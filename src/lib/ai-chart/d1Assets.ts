export const AI_CHART_D1_ASSET_MANIFEST_VERSION = 'ai-chart-d1-assets/v1' as const
export const AI_CHART_D1_SCOPE = 'D1' as const
export const AI_CHART_D1_MODEL_TARGET = 'gpt-5.6-sol' as const
export const AI_CHART_D1_MODEL_ENVIRONMENT_VARIABLE = 'OPENAI_AI_CHART_MODEL' as const
export const AI_CHART_D1_ASSET_ROOT = 'content/ai-chart/d1-v1' as const
export const AI_CHART_D1_MANIFEST_PATH =
  'content/ai-chart/d1-v1/manifest.json' as const
export const AI_CHART_D1_EXPECTED_FILE_COUNT = 23 as const
export const AI_CHART_D1_LOCKED_MANIFEST_SHA256 =
  '1781c04b939dc71be8882b993f5eb456def3fd3f8332ccb3e0af825af3a0d733' as const

export const AI_CHART_D1_MANIFEST_INVALID = 'ai_chart_d1_manifest_invalid' as const
export const AI_CHART_D1_ASSET_INTEGRITY_FAILED =
  'ai_chart_d1_asset_integrity_failed' as const
export const AI_CHART_D1_RUNTIME_DISABLED =
  'ai_chart_d1_assets_runtime_disabled' as const

export type AiChartD1AssetClassification =
  | 'prompt'
  | 'quality_rules'
  | 'primary_engineering_spec'
  | 'draft_schema_spec'
  | 'reference_spec'
  | 'formal_knowledge'
  | 'current_knowledge_source'
  | 'reasoning_knowledge'

export type AiChartD1AssetStatus =
  | 'prompt_source_candidate'
  | 'primary_spec'
  | 'draft'
  | 'reference_only'
  | 'formal_confirmed'
  | 'current_source_candidate'
  | 'reasoning_source_candidate'

export type AiChartD1AssetManifestFile = {
  path: string
  sourcePath: string
  sha256: string
  classification: AiChartD1AssetClassification
  status: AiChartD1AssetStatus
  runtimeEligible: boolean
  runtimeEnabled: boolean
}

export type AiChartD1AssetManifest = {
  manifestVersion: typeof AI_CHART_D1_ASSET_MANIFEST_VERSION
  scope: typeof AI_CHART_D1_SCOPE
  baseCommit: string
  modelTarget: typeof AI_CHART_D1_MODEL_TARGET
  modelEnvironmentVariable: typeof AI_CHART_D1_MODEL_ENVIRONMENT_VARIABLE
  runtimeEnabled: boolean
  sourceRoot: 'AI 命盤 OpenAI/'
  files: AiChartD1AssetManifestFile[]
}

type PlainRecord = Record<string, unknown>

const TOP_LEVEL_FIELDS = new Set([
  'manifestVersion',
  'scope',
  'baseCommit',
  'modelTarget',
  'modelEnvironmentVariable',
  'runtimeEnabled',
  'sourceRoot',
  'files',
])

const FILE_FIELDS = new Set([
  'path',
  'sourcePath',
  'sha256',
  'classification',
  'status',
  'runtimeEligible',
  'runtimeEnabled',
])

const CLASSIFICATIONS = new Set<unknown>([
  'prompt',
  'quality_rules',
  'primary_engineering_spec',
  'draft_schema_spec',
  'reference_spec',
  'formal_knowledge',
  'current_knowledge_source',
  'reasoning_knowledge',
])

const STATUSES = new Set<unknown>([
  'prompt_source_candidate',
  'primary_spec',
  'draft',
  'reference_only',
  'formal_confirmed',
  'current_source_candidate',
  'reasoning_source_candidate',
])

const CLASSIFICATION_STATUS: Readonly<
  Record<AiChartD1AssetClassification, AiChartD1AssetStatus>
> = Object.freeze({
  prompt: 'prompt_source_candidate',
  quality_rules: 'prompt_source_candidate',
  primary_engineering_spec: 'primary_spec',
  draft_schema_spec: 'draft',
  reference_spec: 'reference_only',
  formal_knowledge: 'formal_confirmed',
  current_knowledge_source: 'current_source_candidate',
  reasoning_knowledge: 'reasoning_source_candidate',
})

const RUNTIME_ELIGIBILITY: Readonly<Record<AiChartD1AssetStatus, boolean>> =
  Object.freeze({
    prompt_source_candidate: true,
    primary_spec: true,
    draft: false,
    reference_only: false,
    formal_confirmed: true,
    current_source_candidate: true,
    reasoning_source_candidate: true,
  })

const LOWERCASE_COMMIT_PATTERN = /^[0-9a-f]{40}$/
const LOWERCASE_SHA256_PATTERN = /^[0-9a-f]{64}$/
const WINDOWS_ABSOLUTE_PATH_PATTERN = /^[A-Za-z]:/

function manifestInvalid(): never {
  throw new Error(AI_CHART_D1_MANIFEST_INVALID)
}

function isPlainObject(value: unknown): value is PlainRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false

  try {
    const prototype = Object.getPrototypeOf(value)
    return prototype === Object.prototype || prototype === null
  } catch {
    return false
  }
}

function hasExactFields(value: PlainRecord, expected: ReadonlySet<string>): boolean {
  const keys = Reflect.ownKeys(value)
  return (
    keys.length === expected.size &&
    keys.every((key) => typeof key === 'string' && expected.has(key))
  )
}

function isClassification(value: unknown): value is AiChartD1AssetClassification {
  return CLASSIFICATIONS.has(value)
}

function isStatus(value: unknown): value is AiChartD1AssetStatus {
  return STATUSES.has(value)
}

function isSafeRelativePath(value: unknown, requiredPrefix: string): value is string {
  if (typeof value !== 'string' || !value.startsWith(requiredPrefix)) return false
  if (value.length <= requiredPrefix.length) return false
  if (
    value.startsWith('/') ||
    WINDOWS_ABSOLUTE_PATH_PATTERN.test(value) ||
    value.includes('..') ||
    value.includes('\0') ||
    value.includes('\\')
  ) {
    return false
  }

  const segments = value.split('/')
  return segments.every((segment) => segment.length > 0 && segment !== '.')
}

function buildManifestFile(value: unknown): AiChartD1AssetManifestFile {
  if (!isPlainObject(value) || !hasExactFields(value, FILE_FIELDS)) manifestInvalid()

  const {
    path,
    sourcePath,
    sha256,
    classification,
    status,
    runtimeEligible,
    runtimeEnabled,
  } = value

  if (!isSafeRelativePath(path, `${AI_CHART_D1_ASSET_ROOT}/`)) manifestInvalid()
  if (!isSafeRelativePath(sourcePath, 'AI 命盤 OpenAI/')) manifestInvalid()
  if (typeof sha256 !== 'string' || !LOWERCASE_SHA256_PATTERN.test(sha256)) {
    manifestInvalid()
  }
  if (!isClassification(classification) || !isStatus(status)) manifestInvalid()
  if (CLASSIFICATION_STATUS[classification] !== status) manifestInvalid()
  if (typeof runtimeEligible !== 'boolean') manifestInvalid()
  if (RUNTIME_ELIGIBILITY[status] !== runtimeEligible) manifestInvalid()
  if (runtimeEnabled !== false) manifestInvalid()

  return Object.freeze({
    path,
    sourcePath,
    sha256,
    classification,
    status,
    runtimeEligible,
    runtimeEnabled: false,
  })
}

function buildManifest(value: unknown): AiChartD1AssetManifest {
  if (!isPlainObject(value) || !hasExactFields(value, TOP_LEVEL_FIELDS)) {
    manifestInvalid()
  }

  const {
    manifestVersion,
    scope,
    baseCommit,
    modelTarget,
    modelEnvironmentVariable,
    runtimeEnabled,
    sourceRoot,
    files,
  } = value

  if (manifestVersion !== AI_CHART_D1_ASSET_MANIFEST_VERSION) manifestInvalid()
  if (scope !== AI_CHART_D1_SCOPE) manifestInvalid()
  if (typeof baseCommit !== 'string' || !LOWERCASE_COMMIT_PATTERN.test(baseCommit)) {
    manifestInvalid()
  }
  if (modelTarget !== AI_CHART_D1_MODEL_TARGET) manifestInvalid()
  if (modelEnvironmentVariable !== AI_CHART_D1_MODEL_ENVIRONMENT_VARIABLE) {
    manifestInvalid()
  }
  if (runtimeEnabled !== false || sourceRoot !== 'AI 命盤 OpenAI/') manifestInvalid()
  if (!Array.isArray(files) || files.length !== AI_CHART_D1_EXPECTED_FILE_COUNT) {
    manifestInvalid()
  }

  const manifestFiles = files.map((file) => buildManifestFile(file))
  const paths = new Set(manifestFiles.map((file) => file.path))
  const sourcePaths = new Set(manifestFiles.map((file) => file.sourcePath))

  if (
    paths.size !== AI_CHART_D1_EXPECTED_FILE_COUNT ||
    sourcePaths.size !== AI_CHART_D1_EXPECTED_FILE_COUNT
  ) {
    manifestInvalid()
  }

  return Object.freeze({
    manifestVersion: AI_CHART_D1_ASSET_MANIFEST_VERSION,
    scope: AI_CHART_D1_SCOPE,
    baseCommit,
    modelTarget: AI_CHART_D1_MODEL_TARGET,
    modelEnvironmentVariable: AI_CHART_D1_MODEL_ENVIRONMENT_VARIABLE,
    runtimeEnabled: false,
    sourceRoot: 'AI 命盤 OpenAI/',
    files: Object.freeze(manifestFiles) as unknown as AiChartD1AssetManifestFile[],
  })
}

export function validateAiChartD1AssetManifest(value: unknown): AiChartD1AssetManifest {
  try {
    return buildManifest(value)
  } catch {
    manifestInvalid()
  }
}

export function assertAiChartD1RuntimeEnabled(
  manifest: AiChartD1AssetManifest,
): void {
  if (!manifest.runtimeEnabled) {
    throw new Error(AI_CHART_D1_RUNTIME_DISABLED)
  }
}
