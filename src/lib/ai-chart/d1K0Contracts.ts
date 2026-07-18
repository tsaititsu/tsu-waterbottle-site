import { createHash } from 'node:crypto'
import {
  AI_CHART_D1_ASSET_MANIFEST_VERSION,
  AI_CHART_D1_LOCKED_MANIFEST_SHA256,
} from './d1Assets'
import {
  AI_CHART_D1_ID_PATTERN,
  AI_CHART_D1_MAX_LIST_ITEMS,
  AI_CHART_D1_MAX_SHORT_TEXT_LENGTH,
  AI_CHART_D1_MAX_TEXT_LENGTH,
  AI_CHART_D1_RULE_STATUSES,
  assertAiChartD1SafeGraph,
  freezeAiChartD1Value,
  parseAiChartD1Boolean,
  parseAiChartD1Enum,
  parseAiChartD1Id,
  parseAiChartD1Text,
  requireAiChartD1ExactObject,
  type AiChartD1JsonSchema,
  type AiChartD1RuleStatus,
} from './d1CommonContracts'
import {
  AI_CHART_D1_MAJOR_STAR_NAMES,
  AI_CHART_D1_MUTAGEN_TYPES,
  AI_CHART_D1_P1_STRUCTURAL_INPUT_CONTRACT_VERSION,
  AI_CHART_D1_PALACE_IDENTITIES,
  type AiChartD1MajorStarName,
  type AiChartD1MutagenType,
  type AiChartD1PalaceId,
} from './d1N0Constants'
import {
  AI_CHART_D1_K0_BUNDLE_VERSION,
  AI_CHART_D1_K0_CATALOG_ID,
  AI_CHART_D1_K0_CATALOG_VERSION,
  AI_CHART_D1_K0_COMPILED_AT_POLICY,
  AI_CHART_D1_K0_DOUBLE_STAR_INVENTORY,
  AI_CHART_D1_K0_MAJOR_STAR_NAMES,
  AI_CHART_D1_K0_MEANING_SLUGS,
  AI_CHART_D1_K0_MUTAGEN_SLUGS,
  AI_CHART_D1_K0_PALACE_MEANING_DEFINITIONS,
  AI_CHART_D1_K0_SOURCE_AUTHORITY_PRIORITIES,
  AI_CHART_D1_K0_SOURCE_FILES,
  AI_CHART_D1_K0_SOURCE_SHA256,
  AI_CHART_D1_K0_SOURCE_WHITELIST,
  AI_CHART_D1_K0_STRUCTURE_RULE_DEFINITIONS,
  AI_CHART_D1_K0_SUPPORTING_RULE_DEFINITIONS,
  AI_CHART_D1_K0_TEACHER_SUPPLEMENT_SEGMENTS,
  getAiChartD1K0MutagenAssignmentUniverse,
  getAiChartD1K0StarSlug,
} from './d1K0Registry'

export const AI_CHART_D1_K0_CATALOG_INVALID =
  'ai_chart_d1_k0_catalog_invalid' as const
export const AI_CHART_D1_K0_BUNDLE_INVALID =
  'ai_chart_d1_k0_bundle_invalid' as const

export const AI_CHART_D1_K0_RULE_KINDS = Object.freeze([
  'common',
  'palace_meaning',
  'single_star',
  'double_star',
  'natal_mutagen',
  'supporting_star',
  'empty_palace',
  'relationship',
  'four_horse',
  'd2_boundary',
] as const)
export const AI_CHART_D1_K0_SOURCE_AUTHORITIES = Object.freeze([
  'formal_teacher_confirmed',
  'reasoning_teacher_confirmed',
  'reasoning_confirmed',
  'lecture_backfill',
  'working_inference',
] as const)
export const AI_CHART_D1_K0_PALACE_ROLES = Object.freeze([
  'target',
  'opposite',
  'hidden_combination',
  'trine_1',
  'trine_2',
] as const)
export const AI_CHART_D1_K0_SELECTION_REASONS = Object.freeze([
  'required_common_rule',
  'palace_meaning',
  'major_star_present',
  'borrowed_major_star_present',
  'double_star_present',
  'natal_mutagen_present',
  'supporting_star_present',
  'empty_palace_rule',
  'relationship_rule',
  'four_horse_target',
] as const)
export const AI_CHART_D1_K0_MISSING_REASON_CODES = Object.freeze([
  'missing_palace_meaning',
  'missing_single_star_rule',
  'missing_confirmed_double_star_core',
  'missing_specific_mutagen_rule',
  'missing_supporting_star_rule',
  'missing_empty_palace_rule',
  'missing_relationship_rule',
  'missing_four_horse_rule',
] as const)
export const AI_CHART_D1_K0_D1_SAFETY =
  'd1_personality_no_event_prediction' as const

export type AiChartD1K0RuleKind =
  (typeof AI_CHART_D1_K0_RULE_KINDS)[number]
export type AiChartD1K0SourceAuthority =
  (typeof AI_CHART_D1_K0_SOURCE_AUTHORITIES)[number]
export type AiChartD1K0PalaceRole =
  (typeof AI_CHART_D1_K0_PALACE_ROLES)[number]
export type AiChartD1K0SelectionReason =
  (typeof AI_CHART_D1_K0_SELECTION_REASONS)[number]
export type AiChartD1K0MissingReasonCode =
  (typeof AI_CHART_D1_K0_MISSING_REASON_CODES)[number]

export type AiChartD1K0SourceLocator = Readonly<{
  sourceType: 'markdown' | 'json'
  headingPath: readonly string[]
  headingLevel: 0 | 1 | 2 | 3 | 4
  exactHeading: string | null
  occurrenceIndex: number
  extractionMode:
    | 'exact_section'
    | 'exact_bullet'
    | 'exact_bullet_block'
    | 'exact_labeled_bullet_block'
    | 'exact_labeled_bullets'
    | 'exact_line'
  itemIndex: number | null
  exactLabel: string | null
  exactText: string | null
  jsonPath: string | null
  jsonMatchField: string | null
  jsonMatchValue: string | null
}>

export type AiChartD1K0Rule = Readonly<{
  ruleId: string
  kind: AiChartD1K0RuleKind
  title: string
  content: string
  contentSha256: string
  ruleStatus: AiChartD1RuleStatus
  sourceAuthority: AiChartD1K0SourceAuthority
  sourceFile: string
  sourceFileSha256: string
  sourceLocator: AiChartD1K0SourceLocator
  appliesTo: readonly string[]
  priority: number
  d1Safety: typeof AI_CHART_D1_K0_D1_SAFETY
  selectionTags: readonly string[]
}>

export type AiChartD1K0PalaceMeaning = Readonly<{
  meaningId: string
  palaceId: AiChartD1PalaceId
  text: string
  contentSha256: string
  order: number
  sourceFile: string
  sourceFileSha256: string
  sourceLocator: AiChartD1K0SourceLocator
}>

export type AiChartD1K0DoubleStarInventoryItem = Readonly<{
  pairKey: string
  leftStar: AiChartD1MajorStarName
  rightStar: AiChartD1MajorStarName
  canonicalOrder: number
  specificRuleStatus: AiChartD1RuleStatus | null
  specificRuleId: string | null
  missingReason: 'missing_confirmed_double_star_core' | null
}>

export type AiChartD1K0MutagenInventoryItem = Readonly<{
  starName: string
  mutagenType: AiChartD1MutagenType
  specificRuleId: string | null
  sourceAuthority: AiChartD1K0SourceAuthority | null
  missingReason: 'missing_specific_mutagen_rule' | null
}>

export type AiChartD1K0CoverageCount = Readonly<{
  covered: number
  total: number
}>

export type AiChartD1K0Coverage = Readonly<{
  palaceMeaningCoverage: AiChartD1K0CoverageCount
  singleStarCoverage: AiChartD1K0CoverageCount
  singleStarTeacherSupplementCoverage: AiChartD1K0CoverageCount
  doubleStarSpecificCoverage: AiChartD1K0CoverageCount
  mutagenSpecificCoverage: AiChartD1K0CoverageCount
  supportingStarCoverage: AiChartD1K0CoverageCount
  structureRuleCoverage: AiChartD1K0CoverageCount
}>

export type AiChartD1K0Catalog = Readonly<{
  contractVersion: typeof AI_CHART_D1_K0_CATALOG_VERSION
  catalogId: typeof AI_CHART_D1_K0_CATALOG_ID
  catalogFingerprint: string
  sourceManifestVersion: string
  sourceManifestSha256: string
  compiledAtPolicy: typeof AI_CHART_D1_K0_COMPILED_AT_POLICY
  rules: readonly AiChartD1K0Rule[]
  palaceMeanings: readonly AiChartD1K0PalaceMeaning[]
  doubleStarInventory: readonly AiChartD1K0DoubleStarInventoryItem[]
  mutagenInventory: readonly AiChartD1K0MutagenInventoryItem[]
  coverage: AiChartD1K0Coverage
  warnings: readonly string[]
  readiness: 'ready' | 'partial'
}>

export type AiChartD1K0SelectedMeaning = Readonly<{
  palaceRole: AiChartD1K0PalaceRole
  palaceId: AiChartD1PalaceId
  meaningId: string
  text: string
  contentSha256: string
  order: number
}>

export type AiChartD1K0SelectionTrace = Readonly<{
  ruleId: string
  reason: AiChartD1K0SelectionReason
  palaceRole: AiChartD1K0PalaceRole | null
  palaceId: AiChartD1PalaceId | null
  placementId: string | null
  starName: string | null
  mutagenType: AiChartD1MutagenType | null
  structuralReference: string
}>

export type AiChartD1K0MissingRequirement = Readonly<{
  requirementId: string
  kind: AiChartD1K0RuleKind
  palaceRole: AiChartD1K0PalaceRole | null
  palaceId: AiChartD1PalaceId | null
  starName: string | null
  mutagenType: AiChartD1MutagenType | null
  pairKey: string | null
  reasonCode: AiChartD1K0MissingReasonCode
}>

export type AiChartD1K0P1Bundle = Readonly<{
  contractVersion: typeof AI_CHART_D1_K0_BUNDLE_VERSION
  bundleId: string
  catalogId: typeof AI_CHART_D1_K0_CATALOG_ID
  catalogFingerprint: string
  sourceManifestSha256: string
  task: 'D1_K0_P1'
  chartId: string
  runId: string
  callId: string
  targetPalaceId: AiChartD1PalaceId
  p1StructuralInputContractVersion: typeof AI_CHART_D1_P1_STRUCTURAL_INPUT_CONTRACT_VERSION
  outputContractVersion: 'ai-chart-d1-p1-f1/v1'
  selectedRules: readonly AiChartD1K0Rule[]
  selectedMeanings: readonly AiChartD1K0SelectedMeaning[]
  selectionTrace: readonly AiChartD1K0SelectionTrace[]
  missingRequirements: readonly AiChartD1K0MissingRequirement[]
  knowledgeStatus: 'ready' | 'partial'
  promptStatus: 'prompt_builder_required'
  openAiCallable: false
  warnings: readonly string[]
}>

export class AiChartD1K0CatalogError extends Error {
  readonly code = AI_CHART_D1_K0_CATALOG_INVALID
  constructor() {
    super(AI_CHART_D1_K0_CATALOG_INVALID)
    this.name = 'AiChartD1K0CatalogError'
  }
}

export class AiChartD1K0BundleError extends Error {
  readonly code = AI_CHART_D1_K0_BUNDLE_INVALID
  constructor() {
    super(AI_CHART_D1_K0_BUNDLE_INVALID)
    this.name = 'AiChartD1K0BundleError'
  }
}

function catalogInvalid(): never {
  throw new AiChartD1K0CatalogError()
}

function bundleInvalid(): never {
  throw new AiChartD1K0BundleError()
}

export function hashAiChartD1K0Content(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

function parseSha(value: unknown, invalid: () => never): string {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) invalid()
  return value
}

function parseInteger(
  value: unknown,
  minimum: number,
  maximum: number,
  invalid: () => never,
): number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < minimum ||
    value > maximum
  ) {
    invalid()
  }
  return value
}

function parseNullableText(
  value: unknown,
  invalid: () => never,
): string | null {
  if (value === null) return null
  try {
    return parseAiChartD1Text(value, AI_CHART_D1_MAX_SHORT_TEXT_LENGTH)
  } catch {
    invalid()
  }
}

function parseNullableId(
  value: unknown,
  invalid: () => never,
): string | null {
  if (value === null) return null
  try {
    return parseAiChartD1Id(value)
  } catch {
    invalid()
  }
}

function parseIdArray(value: unknown, invalid: () => never): readonly string[] {
  if (
    !Array.isArray(value) ||
    value.length > AI_CHART_D1_MAX_LIST_ITEMS
  ) {
    invalid()
  }
  const result = value.map((entry) => {
    try {
      return parseAiChartD1Id(entry)
    } catch {
      invalid()
    }
  })
  if (new Set(result).size !== result.length) invalid()
  return Object.freeze(result)
}

function parsePalaceId(value: unknown, invalid: () => never): AiChartD1PalaceId {
  const id = parseNullableId(value, invalid)
  if (
    id === null ||
    !AI_CHART_D1_PALACE_IDENTITIES.some((identity) => identity.palaceId === id)
  ) {
    invalid()
  }
  return id as AiChartD1PalaceId
}

function parseNullablePalaceId(
  value: unknown,
  invalid: () => never,
): AiChartD1PalaceId | null {
  return value === null ? null : parsePalaceId(value, invalid)
}

const LOCATOR_FIELDS = Object.freeze([
  'sourceType',
  'headingPath',
  'headingLevel',
  'exactHeading',
  'occurrenceIndex',
  'extractionMode',
  'itemIndex',
  'exactLabel',
  'exactText',
  'jsonPath',
  'jsonMatchField',
  'jsonMatchValue',
] as const)

function parseLocator(
  value: unknown,
  invalid: () => never,
): AiChartD1K0SourceLocator {
  let record: Record<string, unknown>
  try {
    record = requireAiChartD1ExactObject(value, LOCATOR_FIELDS)
  } catch {
    invalid()
  }
  const sourceType = parseAiChartD1Enum(record.sourceType, [
    'markdown',
    'json',
  ] as const)
  if (!Array.isArray(record.headingPath) || record.headingPath.length > 4) {
    invalid()
  }
  const headingPath = Object.freeze(
    record.headingPath.map((entry) => {
      try {
        return parseAiChartD1Text(entry, AI_CHART_D1_MAX_SHORT_TEXT_LENGTH)
      } catch {
        invalid()
      }
    }),
  )
  const headingLevel = parseInteger(record.headingLevel, 0, 4, invalid) as
    | 0
    | 1
    | 2
    | 3
    | 4
  const exactHeading = parseNullableText(record.exactHeading, invalid)
  const extractionMode = parseAiChartD1Enum(record.extractionMode, [
    'exact_section',
    'exact_bullet',
    'exact_bullet_block',
    'exact_labeled_bullet_block',
    'exact_labeled_bullets',
    'exact_line',
  ] as const)
  const itemIndex =
    record.itemIndex === null
      ? null
      : parseInteger(record.itemIndex, 0, 127, invalid)
  const exactLabel = parseNullableText(record.exactLabel, invalid)
  const exactText = parseNullableText(record.exactText, invalid)
  const jsonPath = parseNullableText(record.jsonPath, invalid)
  const jsonMatchField = parseNullableText(record.jsonMatchField, invalid)
  const jsonMatchValue = parseNullableText(record.jsonMatchValue, invalid)
  const markdownValid =
    sourceType === 'markdown' &&
    headingLevel >= 1 &&
    exactHeading !== null &&
    jsonPath === null &&
    jsonMatchField === null &&
    jsonMatchValue === null
  const jsonValid =
    sourceType === 'json' &&
    headingPath.length === 0 &&
    headingLevel === 0 &&
    exactHeading === null &&
    extractionMode === 'exact_line' &&
    itemIndex === null &&
    exactLabel === null &&
    exactText === null &&
    jsonPath !== null &&
    jsonMatchField !== null &&
    jsonMatchValue !== null
  if (!markdownValid && !jsonValid) invalid()

  return Object.freeze({
    sourceType,
    headingPath,
    headingLevel,
    exactHeading,
    occurrenceIndex: parseInteger(record.occurrenceIndex, 0, 127, invalid),
    extractionMode,
    itemIndex,
    exactLabel,
    exactText,
    jsonPath,
    jsonMatchField,
    jsonMatchValue,
  })
}

const RULE_FIELDS = Object.freeze([
  'ruleId',
  'kind',
  'title',
  'content',
  'contentSha256',
  'ruleStatus',
  'sourceAuthority',
  'sourceFile',
  'sourceFileSha256',
  'sourceLocator',
  'appliesTo',
  'priority',
  'd1Safety',
  'selectionTags',
] as const)

function parseRule(value: unknown, invalid: () => never): AiChartD1K0Rule {
  let record: Record<string, unknown>
  try {
    record = requireAiChartD1ExactObject(value, RULE_FIELDS)
  } catch {
    invalid()
  }
  const content = parseAiChartD1Text(record.content, AI_CHART_D1_MAX_TEXT_LENGTH)
  const contentSha256 = parseSha(record.contentSha256, invalid)
  if (hashAiChartD1K0Content(content) !== contentSha256) invalid()
  const sourceAuthority = parseAiChartD1Enum(
    record.sourceAuthority,
    AI_CHART_D1_K0_SOURCE_AUTHORITIES,
  )
  const sourceFile = parseAiChartD1Text(
    record.sourceFile,
    AI_CHART_D1_MAX_SHORT_TEXT_LENGTH,
  )
  if (!AI_CHART_D1_K0_SOURCE_WHITELIST.some((path) => path === sourceFile)) {
    invalid()
  }
  const sourceFileSha256 = parseSha(record.sourceFileSha256, invalid)
  if (
    AI_CHART_D1_K0_SOURCE_SHA256[
      sourceFile as keyof typeof AI_CHART_D1_K0_SOURCE_SHA256
    ] !== sourceFileSha256
  ) {
    invalid()
  }
  const priority = parseInteger(record.priority, 100, 400, invalid)
  if (priority !== AI_CHART_D1_K0_SOURCE_AUTHORITY_PRIORITIES[sourceAuthority]) {
    invalid()
  }
  if (record.d1Safety !== AI_CHART_D1_K0_D1_SAFETY) invalid()
  return Object.freeze({
    ruleId: parseAiChartD1Id(record.ruleId),
    kind: parseAiChartD1Enum(record.kind, AI_CHART_D1_K0_RULE_KINDS),
    title: parseAiChartD1Text(record.title, AI_CHART_D1_MAX_SHORT_TEXT_LENGTH),
    content,
    contentSha256,
    ruleStatus: parseAiChartD1Enum(record.ruleStatus, AI_CHART_D1_RULE_STATUSES),
    sourceAuthority,
    sourceFile,
    sourceFileSha256,
    sourceLocator: parseLocator(record.sourceLocator, invalid),
    appliesTo: parseIdArray(record.appliesTo, invalid),
    priority,
    d1Safety: AI_CHART_D1_K0_D1_SAFETY,
    selectionTags: parseIdArray(record.selectionTags, invalid),
  })
}

const MEANING_FIELDS = Object.freeze([
  'meaningId',
  'palaceId',
  'text',
  'contentSha256',
  'order',
  'sourceFile',
  'sourceFileSha256',
  'sourceLocator',
] as const)

function parseMeaning(
  value: unknown,
  invalid: () => never,
): AiChartD1K0PalaceMeaning {
  const record = requireAiChartD1ExactObject(value, MEANING_FIELDS)
  const text = parseAiChartD1Text(record.text, AI_CHART_D1_MAX_SHORT_TEXT_LENGTH)
  const contentSha256 = parseSha(record.contentSha256, invalid)
  if (hashAiChartD1K0Content(text) !== contentSha256) invalid()
  const sourceFile = parseAiChartD1Text(
    record.sourceFile,
    AI_CHART_D1_MAX_SHORT_TEXT_LENGTH,
  )
  const sourceFileSha256 = parseSha(record.sourceFileSha256, invalid)
  if (
    sourceFile !== 'content/ai-chart/d1-v1/knowledge/core/C_十二宮分面與身宮疾厄田宅.md' ||
    AI_CHART_D1_K0_SOURCE_SHA256[
      sourceFile as keyof typeof AI_CHART_D1_K0_SOURCE_SHA256
    ] !== sourceFileSha256
  ) {
    invalid()
  }
  return Object.freeze({
    meaningId: parseAiChartD1Id(record.meaningId),
    palaceId: parsePalaceId(record.palaceId, invalid),
    text,
    contentSha256,
    order: parseInteger(record.order, 0, 31, invalid),
    sourceFile,
    sourceFileSha256,
    sourceLocator: parseLocator(record.sourceLocator, invalid),
  })
}

function parseNullableEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  invalid: () => never,
): T | null {
  if (value === null) return null
  try {
    return parseAiChartD1Enum(value, allowed)
  } catch {
    invalid()
  }
}

const DOUBLE_FIELDS = Object.freeze([
  'pairKey',
  'leftStar',
  'rightStar',
  'canonicalOrder',
  'specificRuleStatus',
  'specificRuleId',
  'missingReason',
] as const)

function parseDoubleInventory(
  value: unknown,
  invalid: () => never,
): AiChartD1K0DoubleStarInventoryItem {
  const record = requireAiChartD1ExactObject(value, DOUBLE_FIELDS)
  const specificRuleId = parseNullableId(record.specificRuleId, invalid)
  const missingReason = parseNullableEnum(
    record.missingReason,
    ['missing_confirmed_double_star_core'] as const,
    invalid,
  )
  if ((specificRuleId === null) !== (missingReason !== null)) invalid()
  return Object.freeze({
    pairKey: parseAiChartD1Id(record.pairKey),
    leftStar: parseAiChartD1Enum(record.leftStar, AI_CHART_D1_MAJOR_STAR_NAMES),
    rightStar: parseAiChartD1Enum(record.rightStar, AI_CHART_D1_MAJOR_STAR_NAMES),
    canonicalOrder: parseInteger(record.canonicalOrder, 0, 23, invalid),
    specificRuleStatus: parseNullableEnum(
      record.specificRuleStatus,
      AI_CHART_D1_RULE_STATUSES,
      invalid,
    ),
    specificRuleId,
    missingReason,
  })
}

const MUTAGEN_FIELDS = Object.freeze([
  'starName',
  'mutagenType',
  'specificRuleId',
  'sourceAuthority',
  'missingReason',
] as const)

function parseMutagenInventory(
  value: unknown,
  invalid: () => never,
): AiChartD1K0MutagenInventoryItem {
  const record = requireAiChartD1ExactObject(value, MUTAGEN_FIELDS)
  const specificRuleId = parseNullableId(record.specificRuleId, invalid)
  const sourceAuthority = parseNullableEnum(
    record.sourceAuthority,
    AI_CHART_D1_K0_SOURCE_AUTHORITIES,
    invalid,
  )
  const missingReason = parseNullableEnum(
    record.missingReason,
    ['missing_specific_mutagen_rule'] as const,
    invalid,
  )
  if (
    (specificRuleId === null) !== (missingReason !== null) ||
    (specificRuleId === null) !== (sourceAuthority === null)
  ) {
    invalid()
  }
  return Object.freeze({
    starName: parseAiChartD1Text(
      record.starName,
      AI_CHART_D1_MAX_SHORT_TEXT_LENGTH,
    ),
    mutagenType: parseAiChartD1Enum(
      record.mutagenType,
      AI_CHART_D1_MUTAGEN_TYPES,
    ),
    specificRuleId,
    sourceAuthority,
    missingReason,
  })
}

const COUNT_FIELDS = Object.freeze(['covered', 'total'] as const)
const COVERAGE_FIELDS = Object.freeze([
  'palaceMeaningCoverage',
  'singleStarCoverage',
  'singleStarTeacherSupplementCoverage',
  'doubleStarSpecificCoverage',
  'mutagenSpecificCoverage',
  'supportingStarCoverage',
  'structureRuleCoverage',
] as const)

function parseCoverageCount(
  value: unknown,
  invalid: () => never,
): AiChartD1K0CoverageCount {
  const record = requireAiChartD1ExactObject(value, COUNT_FIELDS)
  const covered = parseInteger(record.covered, 0, 256, invalid)
  const total = parseInteger(record.total, 0, 256, invalid)
  if (covered > total) invalid()
  return Object.freeze({ covered, total })
}

function parseCoverage(
  value: unknown,
  invalid: () => never,
): AiChartD1K0Coverage {
  const record = requireAiChartD1ExactObject(value, COVERAGE_FIELDS)
  return Object.freeze({
    palaceMeaningCoverage: parseCoverageCount(
      record.palaceMeaningCoverage,
      invalid,
    ),
    singleStarCoverage: parseCoverageCount(record.singleStarCoverage, invalid),
    singleStarTeacherSupplementCoverage: parseCoverageCount(
      record.singleStarTeacherSupplementCoverage,
      invalid,
    ),
    doubleStarSpecificCoverage: parseCoverageCount(
      record.doubleStarSpecificCoverage,
      invalid,
    ),
    mutagenSpecificCoverage: parseCoverageCount(
      record.mutagenSpecificCoverage,
      invalid,
    ),
    supportingStarCoverage: parseCoverageCount(
      record.supportingStarCoverage,
      invalid,
    ),
    structureRuleCoverage: parseCoverageCount(
      record.structureRuleCoverage,
      invalid,
    ),
  })
}

function parseArray<T>(
  value: unknown,
  parser: (entry: unknown, invalid: () => never) => T,
  invalid: () => never,
  maximum = 256,
): readonly T[] {
  if (!Array.isArray(value) || value.length > maximum) invalid()
  return Object.freeze(value.map((entry) => parser(entry, invalid)))
}

function parseUniqueStringArray(
  value: unknown,
  invalid: () => never,
): readonly string[] {
  if (!Array.isArray(value) || value.length > 128) invalid()
  const result = value.map((entry) => {
    try {
      return parseAiChartD1Id(entry)
    } catch {
      invalid()
    }
  })
  if (new Set(result).size !== result.length) invalid()
  return Object.freeze(result)
}

export function compareAiChartD1K0Rules(
  left: Pick<AiChartD1K0Rule, 'priority' | 'ruleId'>,
  right: Pick<AiChartD1K0Rule, 'priority' | 'ruleId'>,
): number {
  return right.priority - left.priority || left.ruleId.localeCompare(right.ruleId, 'en')
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (typeof value !== 'object' || value === null) return value
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right, 'en'))
      .map(([key, entry]) => [key, canonicalize(entry)]),
  )
}

export function createAiChartD1K0CatalogFingerprint(
  catalog: Omit<AiChartD1K0Catalog, 'catalogFingerprint'>,
): string {
  const payload = {
    contractVersion: catalog.contractVersion,
    catalogId: catalog.catalogId,
    sourceManifestVersion: catalog.sourceManifestVersion,
    sourceManifestSha256: catalog.sourceManifestSha256,
    compiledAtPolicy: catalog.compiledAtPolicy,
    rules: catalog.rules.map((rule) => ({
      ruleId: rule.ruleId,
      kind: rule.kind,
      contentSha256: rule.contentSha256,
      sourceFile: rule.sourceFile,
      sourceFileSha256: rule.sourceFileSha256,
    })),
    palaceMeanings: catalog.palaceMeanings.map((meaning) => ({
      meaningId: meaning.meaningId,
      palaceId: meaning.palaceId,
      contentSha256: meaning.contentSha256,
    })),
    doubleStarInventory: catalog.doubleStarInventory,
    mutagenInventory: catalog.mutagenInventory,
    coverage: catalog.coverage,
    warnings: catalog.warnings,
    readiness: catalog.readiness,
  }
  return hashAiChartD1K0Content(JSON.stringify(canonicalize(payload)))
}

function stableEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function parseRuleContentObject(content: string): Record<string, unknown> {
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    catalogInvalid()
  }
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    Array.isArray(parsed) ||
    Object.getPrototypeOf(parsed) !== Object.prototype
  ) {
    catalogInvalid()
  }
  return parsed as Record<string, unknown>
}

function assertCoverageCount(
  actual: AiChartD1K0CoverageCount,
  covered: number,
  total: number,
): void {
  if (actual.covered !== covered || actual.total !== total) catalogInvalid()
}

export function validateAiChartD1K0CatalogSemantics(
  catalog: Omit<AiChartD1K0Catalog, 'catalogFingerprint'>,
): void {
  try {
    const rulesById = new Map(catalog.rules.map((rule) => [rule.ruleId, rule]))

    const expectedMeanings = AI_CHART_D1_K0_PALACE_MEANING_DEFINITIONS.flatMap(
      ([palaceId, , , texts]) => {
        const palaceSlug = palaceId.slice('palace:'.length)
        return texts.map((text, order) => {
          const meaningSlug = AI_CHART_D1_K0_MEANING_SLUGS[text]
          if (!meaningSlug) catalogInvalid()
          return {
            meaningId: `meaning:palace:${palaceSlug}:${meaningSlug}`,
            palaceId,
            text,
            order,
          }
        })
      },
    )
    const palaceRules = catalog.rules.filter(
      (rule) => rule.kind === 'palace_meaning',
    )
    if (
      palaceRules.length !== AI_CHART_D1_K0_PALACE_MEANING_DEFINITIONS.length ||
      AI_CHART_D1_K0_PALACE_MEANING_DEFINITIONS.some(([palaceId]) => {
        const palaceSlug = palaceId.slice('palace:'.length)
        const rule = rulesById.get(`rule:palace:${palaceSlug}:meanings`)
        return !rule || rule.kind !== 'palace_meaning'
      }) ||
      catalog.palaceMeanings.length !== 52 ||
      !stableEqual(
        catalog.palaceMeanings.map(
          ({ meaningId, palaceId, text, order }) => ({
            meaningId,
            palaceId,
            text,
            order,
          }),
        ),
        expectedMeanings,
      )
    ) {
      catalogInvalid()
    }
    assertCoverageCount(
      catalog.coverage.palaceMeaningCoverage,
      AI_CHART_D1_K0_PALACE_MEANING_DEFINITIONS.length,
      AI_CHART_D1_K0_PALACE_MEANING_DEFINITIONS.length,
    )

    const singleStarRules = catalog.rules.filter(
      (rule) => rule.kind === 'single_star',
    )
    let teacherSupplementCovered = 0
    if (singleStarRules.length !== AI_CHART_D1_K0_MAJOR_STAR_NAMES.length) {
      catalogInvalid()
    }
    for (const starName of AI_CHART_D1_K0_MAJOR_STAR_NAMES) {
      const starSlug = getAiChartD1K0StarSlug(starName)
      if (!starSlug) catalogInvalid()
      const rule = rulesById.get(`rule:star:${starSlug}:core`)
      if (
        !rule ||
        rule.kind !== 'single_star' ||
        rule.sourceAuthority !== 'formal_teacher_confirmed' ||
        rule.ruleStatus !== 'teacher_confirmed' ||
        rule.sourceFile !== AI_CHART_D1_K0_SOURCE_FILES.stars
      ) {
        catalogInvalid()
      }
      const content = parseRuleContentObject(rule.content)
      const approvedSegments = Object.prototype.hasOwnProperty.call(
        AI_CHART_D1_K0_TEACHER_SUPPLEMENT_SEGMENTS,
        starName,
      )
        ? AI_CHART_D1_K0_TEACHER_SUPPLEMENT_SEGMENTS[
            starName as keyof typeof AI_CHART_D1_K0_TEACHER_SUPPLEMENT_SEGMENTS
          ]
        : undefined
      const hasSupplement = Object.prototype.hasOwnProperty.call(
        content,
        '老師補充D1',
      )
      if (approvedSegments) {
        if (!hasSupplement || !stableEqual(content.老師補充D1, approvedSegments)) {
          catalogInvalid()
        }
        teacherSupplementCovered += 1
      } else if (hasSupplement) {
        catalogInvalid()
      }
    }
    assertCoverageCount(
      catalog.coverage.singleStarCoverage,
      AI_CHART_D1_K0_MAJOR_STAR_NAMES.length,
      AI_CHART_D1_K0_MAJOR_STAR_NAMES.length,
    )
    assertCoverageCount(
      catalog.coverage.singleStarTeacherSupplementCoverage,
      teacherSupplementCovered,
      AI_CHART_D1_K0_MAJOR_STAR_NAMES.length,
    )

    let doubleStarCovered = 0
    const referencedDoubleRuleIds = new Set<string>()
    if (
      catalog.doubleStarInventory.length !==
      AI_CHART_D1_K0_DOUBLE_STAR_INVENTORY.length
    ) {
      catalogInvalid()
    }
    catalog.doubleStarInventory.forEach((item, index) => {
      const expected = AI_CHART_D1_K0_DOUBLE_STAR_INVENTORY[index]
      if (
        item.pairKey !== expected.pairKey ||
        item.leftStar !== expected.leftStar ||
        item.rightStar !== expected.rightStar ||
        item.canonicalOrder !== expected.canonicalOrder
      ) {
        catalogInvalid()
      }
      if (item.specificRuleId === null) {
        if (
          item.specificRuleStatus !== null ||
          item.missingReason !== 'missing_confirmed_double_star_core'
        ) {
          catalogInvalid()
        }
        return
      }
      const expectedRuleId = `rule:double:${item.pairKey.slice('pair:'.length)}:core`
      const rule = rulesById.get(item.specificRuleId)
      if (
        item.specificRuleId !== expectedRuleId ||
        !rule ||
        rule.kind !== 'double_star' ||
        item.specificRuleStatus !== rule.ruleStatus ||
        item.missingReason !== null
      ) {
        catalogInvalid()
      }
      referencedDoubleRuleIds.add(item.specificRuleId)
      doubleStarCovered += 1
    })
    const doubleStarRules = catalog.rules.filter(
      (rule) => rule.kind === 'double_star',
    )
    if (
      doubleStarRules.length !== referencedDoubleRuleIds.size ||
      doubleStarRules.some((rule) => !referencedDoubleRuleIds.has(rule.ruleId))
    ) {
      catalogInvalid()
    }
    assertCoverageCount(
      catalog.coverage.doubleStarSpecificCoverage,
      doubleStarCovered,
      AI_CHART_D1_K0_DOUBLE_STAR_INVENTORY.length,
    )

    const mutagenUniverse = getAiChartD1K0MutagenAssignmentUniverse()
    let mutagenCovered = 0
    const referencedMutagenRuleIds = new Set<string>()
    if (catalog.mutagenInventory.length !== mutagenUniverse.length) {
      catalogInvalid()
    }
    catalog.mutagenInventory.forEach((item, index) => {
      const expected = mutagenUniverse[index]
      if (
        item.starName !== expected.starName ||
        item.mutagenType !== expected.mutagenType
      ) {
        catalogInvalid()
      }
      if (item.specificRuleId === null) {
        if (
          item.sourceAuthority !== null ||
          item.missingReason !== 'missing_specific_mutagen_rule'
        ) {
          catalogInvalid()
        }
        return
      }
      const starSlug = getAiChartD1K0StarSlug(item.starName)
      if (!starSlug) catalogInvalid()
      const expectedRuleId =
        `rule:mutagen:${starSlug}:${AI_CHART_D1_K0_MUTAGEN_SLUGS[item.mutagenType]}`
      const rule = rulesById.get(item.specificRuleId)
      if (
        item.specificRuleId !== expectedRuleId ||
        !rule ||
        rule.kind !== 'natal_mutagen' ||
        item.sourceAuthority !== rule.sourceAuthority ||
        item.missingReason !== null
      ) {
        catalogInvalid()
      }
      referencedMutagenRuleIds.add(item.specificRuleId)
      mutagenCovered += 1
    })
    const mutagenSpecificRules = catalog.rules.filter(
      (rule) =>
        rule.kind === 'natal_mutagen' &&
        !rule.ruleId.startsWith('rule:mutagen:common:'),
    )
    if (
      mutagenSpecificRules.length !== referencedMutagenRuleIds.size ||
      mutagenSpecificRules.some(
        (rule) => !referencedMutagenRuleIds.has(rule.ruleId),
      )
    ) {
      catalogInvalid()
    }
    assertCoverageCount(
      catalog.coverage.mutagenSpecificCoverage,
      mutagenCovered,
      mutagenUniverse.length,
    )

    const supportingRules = catalog.rules.filter(
      (rule) => rule.kind === 'supporting_star',
    )
    if (
      supportingRules.length !==
      AI_CHART_D1_K0_SUPPORTING_RULE_DEFINITIONS.length
    ) {
      catalogInvalid()
    }
    for (const definition of AI_CHART_D1_K0_SUPPORTING_RULE_DEFINITIONS) {
      const starSlug = getAiChartD1K0StarSlug(definition.starName)
      if (!starSlug) catalogInvalid()
      const rule = rulesById.get(`rule:supporting:${starSlug}:core`)
      if (
        !rule ||
        rule.kind !== 'supporting_star' ||
        rule.sourceFile !== AI_CHART_D1_K0_SOURCE_FILES.supporting ||
        rule.content !==
          JSON.stringify({ bullets: definition.expectedBullets })
      ) {
        catalogInvalid()
      }
    }
    assertCoverageCount(
      catalog.coverage.supportingStarCoverage,
      AI_CHART_D1_K0_SUPPORTING_RULE_DEFINITIONS.length,
      AI_CHART_D1_K0_SUPPORTING_RULE_DEFINITIONS.length,
    )

    const expectedStructureRuleIds = new Set(
      AI_CHART_D1_K0_STRUCTURE_RULE_DEFINITIONS.map(
        (definition) => definition.ruleId,
      ),
    )
    const structureRules = catalog.rules.filter((rule) =>
      ['common', 'relationship', 'empty_palace', 'four_horse', 'd2_boundary']
        .includes(rule.kind),
    )
    if (
      structureRules.length !== AI_CHART_D1_K0_STRUCTURE_RULE_DEFINITIONS.length ||
      structureRules.some((rule) => !expectedStructureRuleIds.has(rule.ruleId)) ||
      rulesById.has('rule:structure:opposite-empty') ||
      AI_CHART_D1_K0_STRUCTURE_RULE_DEFINITIONS.some((definition) => {
        const rule = rulesById.get(definition.ruleId)
        return (
          !rule ||
          rule.kind !== definition.kind ||
          rule.sourceFile !== definition.sourceFile
        )
      })
    ) {
      catalogInvalid()
    }
    assertCoverageCount(
      catalog.coverage.structureRuleCoverage,
      AI_CHART_D1_K0_STRUCTURE_RULE_DEFINITIONS.length,
      15,
    )

    const expectedWarnings = [
      ...(teacherSupplementCovered < AI_CHART_D1_K0_MAJOR_STAR_NAMES.length
        ? ['warning:k0:missing-single-star-teacher-supplement']
        : []),
      ...(doubleStarCovered < AI_CHART_D1_K0_DOUBLE_STAR_INVENTORY.length
        ? ['warning:k0:missing-double-star-specific']
        : []),
      ...(mutagenCovered < mutagenUniverse.length
        ? ['warning:k0:missing-mutagen-specific']
        : []),
      'warning:k0:missing-opposite-empty-rule',
    ]
    const allCoverageComplete = Object.values(catalog.coverage).every(
      (coverage) => coverage.covered === coverage.total,
    )
    if (
      !stableEqual(catalog.warnings, expectedWarnings) ||
      catalog.readiness !== (allCoverageComplete ? 'ready' : 'partial')
    ) {
      catalogInvalid()
    }
  } catch (error) {
    if (error instanceof AiChartD1K0CatalogError) throw error
    catalogInvalid()
  }
}

const CATALOG_FIELDS = Object.freeze([
  'contractVersion',
  'catalogId',
  'catalogFingerprint',
  'sourceManifestVersion',
  'sourceManifestSha256',
  'compiledAtPolicy',
  'rules',
  'palaceMeanings',
  'doubleStarInventory',
  'mutagenInventory',
  'coverage',
  'warnings',
  'readiness',
] as const)

export function parseAiChartD1K0Catalog(value: unknown): AiChartD1K0Catalog {
  try {
    assertAiChartD1SafeGraph(value)
    const record = requireAiChartD1ExactObject(value, CATALOG_FIELDS)
    if (
      record.contractVersion !== AI_CHART_D1_K0_CATALOG_VERSION ||
      record.catalogId !== AI_CHART_D1_K0_CATALOG_ID ||
      record.compiledAtPolicy !== AI_CHART_D1_K0_COMPILED_AT_POLICY ||
      record.sourceManifestVersion !== AI_CHART_D1_ASSET_MANIFEST_VERSION ||
      record.sourceManifestSha256 !== AI_CHART_D1_LOCKED_MANIFEST_SHA256
    ) {
      catalogInvalid()
    }
    const rules = parseArray(record.rules, parseRule, catalogInvalid)
    const ruleIds = rules.map((rule) => rule.ruleId)
    if (
      new Set(ruleIds).size !== ruleIds.length ||
      rules.some(
        (rule, index) =>
          index > 0 && compareAiChartD1K0Rules(rules[index - 1], rule) > 0,
      )
    ) {
      catalogInvalid()
    }
    const ruleIdSet = new Set(ruleIds)
    const palaceMeanings = parseArray(
      record.palaceMeanings,
      parseMeaning,
      catalogInvalid,
    )
    if (
      new Set(palaceMeanings.map((meaning) => meaning.meaningId)).size !==
      palaceMeanings.length
    ) {
      catalogInvalid()
    }
    const doubleStarInventory = parseArray(
      record.doubleStarInventory,
      parseDoubleInventory,
      catalogInvalid,
      24,
    )
    const mutagenInventory = parseArray(
      record.mutagenInventory,
      parseMutagenInventory,
      catalogInvalid,
      64,
    )
    if (
      doubleStarInventory.length !== 24 ||
      doubleStarInventory.some(
        (item, index) =>
          item.canonicalOrder !== index ||
          (item.specificRuleId !== null && !ruleIdSet.has(item.specificRuleId)),
      ) ||
      mutagenInventory.some(
        (item) =>
          item.specificRuleId !== null && !ruleIdSet.has(item.specificRuleId),
      )
    ) {
      catalogInvalid()
    }
    const coverage = parseCoverage(record.coverage, catalogInvalid)
    const warnings = parseUniqueStringArray(record.warnings, catalogInvalid)
    const readiness = parseAiChartD1Enum(record.readiness, [
      'ready',
      'partial',
    ] as const)
    const catalogWithoutFingerprint: Omit<AiChartD1K0Catalog, 'catalogFingerprint'> = {
      contractVersion: AI_CHART_D1_K0_CATALOG_VERSION,
      catalogId: AI_CHART_D1_K0_CATALOG_ID,
      sourceManifestVersion: parseAiChartD1Text(
        record.sourceManifestVersion,
        AI_CHART_D1_MAX_SHORT_TEXT_LENGTH,
      ),
      sourceManifestSha256: parseSha(
        record.sourceManifestSha256,
        catalogInvalid,
      ),
      compiledAtPolicy: AI_CHART_D1_K0_COMPILED_AT_POLICY,
      rules,
      palaceMeanings,
      doubleStarInventory,
      mutagenInventory,
      coverage,
      warnings,
      readiness,
    }
    validateAiChartD1K0CatalogSemantics(catalogWithoutFingerprint)
    const catalogFingerprint = parseSha(
      record.catalogFingerprint,
      catalogInvalid,
    )
    if (
      createAiChartD1K0CatalogFingerprint(catalogWithoutFingerprint) !==
      catalogFingerprint
    ) {
      catalogInvalid()
    }
    return freezeAiChartD1Value({
      ...catalogWithoutFingerprint,
      catalogFingerprint,
    }) as AiChartD1K0Catalog
  } catch (error) {
    if (error instanceof AiChartD1K0CatalogError) throw error
    catalogInvalid()
  }
}

const SELECTED_MEANING_FIELDS = Object.freeze([
  'palaceRole',
  'palaceId',
  'meaningId',
  'text',
  'contentSha256',
  'order',
] as const)
const TRACE_FIELDS = Object.freeze([
  'ruleId',
  'reason',
  'palaceRole',
  'palaceId',
  'placementId',
  'starName',
  'mutagenType',
  'structuralReference',
] as const)
const MISSING_FIELDS = Object.freeze([
  'requirementId',
  'kind',
  'palaceRole',
  'palaceId',
  'starName',
  'mutagenType',
  'pairKey',
  'reasonCode',
] as const)
const BUNDLE_FIELDS = Object.freeze([
  'contractVersion',
  'bundleId',
  'catalogId',
  'catalogFingerprint',
  'sourceManifestSha256',
  'task',
  'chartId',
  'runId',
  'callId',
  'targetPalaceId',
  'p1StructuralInputContractVersion',
  'outputContractVersion',
  'selectedRules',
  'selectedMeanings',
  'selectionTrace',
  'missingRequirements',
  'knowledgeStatus',
  'promptStatus',
  'openAiCallable',
  'warnings',
] as const)

function parseSelectedMeaning(
  value: unknown,
  invalid: () => never,
): AiChartD1K0SelectedMeaning {
  const record = requireAiChartD1ExactObject(value, SELECTED_MEANING_FIELDS)
  const text = parseAiChartD1Text(record.text, AI_CHART_D1_MAX_SHORT_TEXT_LENGTH)
  const contentSha256 = parseSha(record.contentSha256, invalid)
  if (hashAiChartD1K0Content(text) !== contentSha256) invalid()
  return Object.freeze({
    palaceRole: parseAiChartD1Enum(record.palaceRole, AI_CHART_D1_K0_PALACE_ROLES),
    palaceId: parsePalaceId(record.palaceId, invalid),
    meaningId: parseAiChartD1Id(record.meaningId),
    text,
    contentSha256,
    order: parseInteger(record.order, 0, 31, invalid),
  })
}

function parseTrace(
  value: unknown,
  invalid: () => never,
): AiChartD1K0SelectionTrace {
  const record = requireAiChartD1ExactObject(value, TRACE_FIELDS)
  return Object.freeze({
    ruleId: parseAiChartD1Id(record.ruleId),
    reason: parseAiChartD1Enum(record.reason, AI_CHART_D1_K0_SELECTION_REASONS),
    palaceRole: parseNullableEnum(record.palaceRole, AI_CHART_D1_K0_PALACE_ROLES, invalid),
    palaceId: parseNullablePalaceId(record.palaceId, invalid),
    placementId: parseNullableId(record.placementId, invalid),
    starName: parseNullableText(record.starName, invalid),
    mutagenType: parseNullableEnum(record.mutagenType, AI_CHART_D1_MUTAGEN_TYPES, invalid),
    structuralReference: parseAiChartD1Id(record.structuralReference),
  })
}

function parseMissing(
  value: unknown,
  invalid: () => never,
): AiChartD1K0MissingRequirement {
  const record = requireAiChartD1ExactObject(value, MISSING_FIELDS)
  return Object.freeze({
    requirementId: parseAiChartD1Id(record.requirementId),
    kind: parseAiChartD1Enum(record.kind, AI_CHART_D1_K0_RULE_KINDS),
    palaceRole: parseNullableEnum(record.palaceRole, AI_CHART_D1_K0_PALACE_ROLES, invalid),
    palaceId: parseNullablePalaceId(record.palaceId, invalid),
    starName: parseNullableText(record.starName, invalid),
    mutagenType: parseNullableEnum(record.mutagenType, AI_CHART_D1_MUTAGEN_TYPES, invalid),
    pairKey: parseNullableId(record.pairKey, invalid),
    reasonCode: parseAiChartD1Enum(record.reasonCode, AI_CHART_D1_K0_MISSING_REASON_CODES),
  })
}

export function validateAiChartD1K0P1BundleSemantics(
  bundle: AiChartD1K0P1Bundle,
  catalog: AiChartD1K0Catalog,
): void {
  try {
    if (
      bundle.selectionTrace.length !== bundle.selectedRules.length ||
      bundle.selectionTrace.some(
        (trace, index) => trace.ruleId !== bundle.selectedRules[index].ruleId,
      )
    ) {
      bundleInvalid()
    }

    bundle.selectionTrace.forEach((trace, index) => {
      const rule = bundle.selectedRules[index]
      const requiresPalace = trace.reason !== 'required_common_rule'
      if (
        (requiresPalace &&
          (trace.palaceRole === null || trace.palaceId === null)) ||
        (!requiresPalace &&
          (trace.palaceRole !== null || trace.palaceId !== null)) ||
        trace.structuralReference !==
          (requiresPalace
            ? `p1:view:${trace.palaceRole}`
            : 'p1:required-common')
      ) {
        bundleInvalid()
      }

      const hasStarPlacement =
        trace.starName !== null && trace.placementId !== null
      const hasNoStarFields =
        trace.starName === null &&
        trace.placementId === null &&
        trace.mutagenType === null
      switch (trace.reason) {
        case 'required_common_rule':
          if (
            (rule.kind !== 'common' && rule.kind !== 'd2_boundary') ||
            !hasNoStarFields
          ) {
            bundleInvalid()
          }
          break
        case 'palace_meaning':
          if (rule.kind !== 'palace_meaning' || !hasNoStarFields) {
            bundleInvalid()
          }
          break
        case 'major_star_present':
        case 'borrowed_major_star_present':
          if (rule.kind !== 'single_star' || !hasStarPlacement) {
            bundleInvalid()
          }
          break
        case 'double_star_present':
          if (rule.kind !== 'double_star' || !hasNoStarFields) {
            bundleInvalid()
          }
          break
        case 'natal_mutagen_present':
          if (
            rule.kind !== 'natal_mutagen' ||
            !hasStarPlacement ||
            trace.mutagenType === null
          ) {
            bundleInvalid()
          }
          break
        case 'supporting_star_present':
          if (rule.kind !== 'supporting_star' || !hasStarPlacement) {
            bundleInvalid()
          }
          break
        case 'empty_palace_rule':
          if (rule.kind !== 'empty_palace' || !hasNoStarFields) {
            bundleInvalid()
          }
          break
        case 'relationship_rule':
          if (rule.kind !== 'relationship' || !hasNoStarFields) {
            bundleInvalid()
          }
          break
        case 'four_horse_target':
          if (
            (rule.kind !== 'four_horse' &&
              !(
                rule.kind === 'd2_boundary' &&
                rule.ruleId === 'rule:structure:four-horse-d1-boundary'
              )) ||
            !hasNoStarFields
          ) {
            bundleInvalid()
          }
          break
      }
    })

    const meaningIds = bundle.selectedMeanings.map(
      (meaning) => meaning.meaningId,
    )
    const roleMeaningIds = bundle.selectedMeanings.map(
      (meaning) => `${meaning.palaceRole}\u0000${meaning.meaningId}`,
    )
    if (
      new Set(meaningIds).size !== meaningIds.length ||
      new Set(roleMeaningIds).size !== roleMeaningIds.length
    ) {
      bundleInvalid()
    }
    const expectedSelectedMeanings: AiChartD1K0SelectedMeaning[] = []
    for (const role of AI_CHART_D1_K0_PALACE_ROLES) {
      const roleMeanings = bundle.selectedMeanings.filter(
        (meaning) => meaning.palaceRole === role,
      )
      const palaceIds = new Set(roleMeanings.map((meaning) => meaning.palaceId))
      if (roleMeanings.length === 0 || palaceIds.size !== 1) bundleInvalid()
      const palaceId = roleMeanings[0].palaceId
      if (role === 'target' && palaceId !== bundle.targetPalaceId) {
        bundleInvalid()
      }
      const expectedForPalace = catalog.palaceMeanings.filter(
        (meaning) => meaning.palaceId === palaceId,
      )
      if (expectedForPalace.length === 0) bundleInvalid()
      expectedSelectedMeanings.push(
        ...expectedForPalace.map((meaning) => ({
          palaceRole: role,
          palaceId: meaning.palaceId,
          meaningId: meaning.meaningId,
          text: meaning.text,
          contentSha256: meaning.contentSha256,
          order: meaning.order,
        })),
      )
    }
    if (!stableEqual(bundle.selectedMeanings, expectedSelectedMeanings)) {
      bundleInvalid()
    }

    if (
      new Set(
        bundle.missingRequirements.map((entry) => entry.requirementId),
      ).size !== bundle.missingRequirements.length ||
      bundle.missingRequirements.some(
        (entry, index) =>
          index > 0 &&
          bundle.missingRequirements[index - 1].requirementId.localeCompare(
            entry.requirementId,
            'en',
          ) > 0,
      )
    ) {
      bundleInvalid()
    }
    for (const missing of bundle.missingRequirements) {
      const requiresPalace = missing.kind !== 'common'
      if (
        (requiresPalace &&
          (missing.palaceRole === null || missing.palaceId === null)) ||
        (!requiresPalace &&
          (missing.palaceRole !== null || missing.palaceId !== null))
      ) {
        bundleInvalid()
      }
      const noStar = missing.starName === null
      const noMutagen = missing.mutagenType === null
      const noPair = missing.pairKey === null
      switch (missing.reasonCode) {
        case 'missing_palace_meaning':
          if (
            missing.kind !== 'palace_meaning' ||
            !noStar ||
            !noMutagen ||
            !noPair
          ) {
            bundleInvalid()
          }
          break
        case 'missing_single_star_rule':
          if (
            missing.kind !== 'single_star' ||
            missing.starName === null ||
            !noMutagen ||
            !noPair
          ) {
            bundleInvalid()
          }
          break
        case 'missing_confirmed_double_star_core':
          if (
            missing.kind !== 'double_star' ||
            missing.pairKey === null ||
            !noStar ||
            !noMutagen
          ) {
            bundleInvalid()
          }
          break
        case 'missing_specific_mutagen_rule':
          if (
            missing.kind !== 'natal_mutagen' ||
            missing.starName === null ||
            missing.mutagenType === null ||
            !noPair
          ) {
            bundleInvalid()
          }
          break
        case 'missing_supporting_star_rule':
          if (
            missing.kind !== 'supporting_star' ||
            missing.starName === null ||
            !noMutagen ||
            !noPair
          ) {
            bundleInvalid()
          }
          break
        case 'missing_empty_palace_rule':
          if (
            missing.kind !== 'empty_palace' ||
            !noStar ||
            !noMutagen ||
            !noPair
          ) {
            bundleInvalid()
          }
          break
        case 'missing_relationship_rule':
          if (
            (missing.kind !== 'relationship' && missing.kind !== 'common') ||
            !noStar ||
            !noMutagen ||
            !noPair
          ) {
            bundleInvalid()
          }
          break
        case 'missing_four_horse_rule':
          if (
            missing.kind !== 'four_horse' ||
            !noStar ||
            !noMutagen ||
            !noPair
          ) {
            bundleInvalid()
          }
          break
      }
    }

    const expectedStatus =
      bundle.missingRequirements.length === 0 ? 'ready' : 'partial'
    const expectedWarnings =
      expectedStatus === 'ready' ? [] : ['warning:k0:bundle-partial']
    if (
      bundle.knowledgeStatus !== expectedStatus ||
      !stableEqual(bundle.warnings, expectedWarnings)
    ) {
      bundleInvalid()
    }
  } catch (error) {
    if (error instanceof AiChartD1K0BundleError) throw error
    bundleInvalid()
  }
}

export function parseAiChartD1K0P1Bundle(
  value: unknown,
  catalogValue: unknown,
): AiChartD1K0P1Bundle {
  try {
    const catalog = parseAiChartD1K0Catalog(catalogValue)
    assertAiChartD1SafeGraph(value)
    const record = requireAiChartD1ExactObject(value, BUNDLE_FIELDS)
    if (
      record.contractVersion !== AI_CHART_D1_K0_BUNDLE_VERSION ||
      record.catalogId !== catalog.catalogId ||
      record.catalogFingerprint !== catalog.catalogFingerprint ||
      record.sourceManifestSha256 !== catalog.sourceManifestSha256 ||
      record.task !== 'D1_K0_P1' ||
      record.p1StructuralInputContractVersion !==
        AI_CHART_D1_P1_STRUCTURAL_INPUT_CONTRACT_VERSION ||
      record.outputContractVersion !== 'ai-chart-d1-p1-f1/v1' ||
      record.promptStatus !== 'prompt_builder_required' ||
      parseAiChartD1Boolean(record.openAiCallable) !== false
    ) {
      bundleInvalid()
    }
    const selectedRules = parseArray(record.selectedRules, parseRule, bundleInvalid)
    const ruleIds = selectedRules.map((rule) => rule.ruleId)
    if (
      new Set(ruleIds).size !== ruleIds.length ||
      selectedRules.some(
        (rule, index) =>
          index > 0 && compareAiChartD1K0Rules(selectedRules[index - 1], rule) > 0,
      )
    ) {
      bundleInvalid()
    }
    const catalogRules = new Map(catalog.rules.map((rule) => [rule.ruleId, rule]))
    if (
      selectedRules.some(
        (rule) => !stableEqual(rule, catalogRules.get(rule.ruleId)),
      )
    ) {
      bundleInvalid()
    }
    const selectedMeanings = parseArray(
      record.selectedMeanings,
      parseSelectedMeaning,
      bundleInvalid,
    )
    const roleOrder = new Map(
      AI_CHART_D1_K0_PALACE_ROLES.map((role, index) => [role, index]),
    )
    const palaceOrder = new Map(
      AI_CHART_D1_PALACE_IDENTITIES.map((palace, index) => [palace.palaceId, index]),
    )
    if (
      selectedMeanings.some((meaning, index) => {
        const catalogMeaning = catalog.palaceMeanings.find(
          (entry) => entry.meaningId === meaning.meaningId,
        )
        if (
          !catalogMeaning ||
          catalogMeaning.palaceId !== meaning.palaceId ||
          catalogMeaning.text !== meaning.text ||
          catalogMeaning.contentSha256 !== meaning.contentSha256 ||
          catalogMeaning.order !== meaning.order
        ) {
          return true
        }
        if (index === 0) return false
        const previous = selectedMeanings[index - 1]
        const left = [
          roleOrder.get(previous.palaceRole) ?? 99,
          palaceOrder.get(previous.palaceId) ?? 99,
          previous.order,
        ]
        const right = [
          roleOrder.get(meaning.palaceRole) ?? 99,
          palaceOrder.get(meaning.palaceId) ?? 99,
          meaning.order,
        ]
        for (let position = 0; position < left.length; position += 1) {
          if (left[position] < right[position]) return false
          if (left[position] > right[position]) return true
        }
        return false
      })
    ) {
      bundleInvalid()
    }
    const selectionTrace = parseArray(
      record.selectionTrace,
      parseTrace,
      bundleInvalid,
    )
    if (
      selectionTrace.length !== selectedRules.length ||
      new Set(selectionTrace.map((trace) => trace.ruleId)).size !==
        selectionTrace.length ||
      selectionTrace.some((trace) => !ruleIds.includes(trace.ruleId))
    ) {
      bundleInvalid()
    }
    const missingRequirements = parseArray(
      record.missingRequirements,
      parseMissing,
      bundleInvalid,
    )
    if (
      new Set(missingRequirements.map((entry) => entry.requirementId)).size !==
      missingRequirements.length
    ) {
      bundleInvalid()
    }
    const knowledgeStatus = parseAiChartD1Enum(record.knowledgeStatus, [
      'ready',
      'partial',
    ] as const)
    const parsedBundle: AiChartD1K0P1Bundle = {
      contractVersion: AI_CHART_D1_K0_BUNDLE_VERSION,
      bundleId: parseAiChartD1Id(record.bundleId),
      catalogId: AI_CHART_D1_K0_CATALOG_ID,
      catalogFingerprint: parseSha(record.catalogFingerprint, bundleInvalid),
      sourceManifestSha256: parseSha(
        record.sourceManifestSha256,
        bundleInvalid,
      ),
      task: 'D1_K0_P1',
      chartId: parseAiChartD1Id(record.chartId),
      runId: parseAiChartD1Id(record.runId),
      callId: parseAiChartD1Id(record.callId),
      targetPalaceId: parsePalaceId(record.targetPalaceId, bundleInvalid),
      p1StructuralInputContractVersion:
        AI_CHART_D1_P1_STRUCTURAL_INPUT_CONTRACT_VERSION,
      outputContractVersion: 'ai-chart-d1-p1-f1/v1',
      selectedRules,
      selectedMeanings,
      selectionTrace,
      missingRequirements,
      knowledgeStatus,
      promptStatus: 'prompt_builder_required',
      openAiCallable: false,
      warnings: parseUniqueStringArray(record.warnings, bundleInvalid),
    }
    validateAiChartD1K0P1BundleSemantics(parsedBundle, catalog)
    return freezeAiChartD1Value(parsedBundle) as AiChartD1K0P1Bundle
  } catch (error) {
    if (error instanceof AiChartD1K0BundleError) throw error
    bundleInvalid()
  }
}

function strictObject(properties: Record<string, unknown>): AiChartD1JsonSchema {
  return {
    type: 'object',
    additionalProperties: false,
    properties,
    required: Object.keys(properties),
  }
}

const idSchema = { type: 'string', pattern: AI_CHART_D1_ID_PATTERN.source }
const shaSchema = { type: 'string', pattern: '^[a-f0-9]{64}$' }
const shortTextSchema = {
  type: 'string',
  minLength: 1,
  maxLength: AI_CHART_D1_MAX_SHORT_TEXT_LENGTH,
}
const nullableShortTextSchema = { anyOf: [shortTextSchema, { type: 'null' }] }
const nullableIdSchema = { anyOf: [idSchema, { type: 'null' }] }
const locatorSchema = strictObject({
  sourceType: { type: 'string', enum: ['markdown', 'json'] },
  headingPath: { type: 'array', maxItems: 4, items: shortTextSchema },
  headingLevel: { type: 'integer', minimum: 0, maximum: 4 },
  exactHeading: nullableShortTextSchema,
  occurrenceIndex: { type: 'integer', minimum: 0, maximum: 127 },
  extractionMode: {
    type: 'string',
    enum: [
      'exact_section',
      'exact_bullet',
      'exact_bullet_block',
      'exact_labeled_bullet_block',
      'exact_labeled_bullets',
      'exact_line',
    ],
  },
  itemIndex: { anyOf: [{ type: 'integer', minimum: 0, maximum: 127 }, { type: 'null' }] },
  exactLabel: nullableShortTextSchema,
  exactText: nullableShortTextSchema,
  jsonPath: nullableShortTextSchema,
  jsonMatchField: nullableShortTextSchema,
  jsonMatchValue: nullableShortTextSchema,
})
const ruleSchema = strictObject({
  ruleId: idSchema,
  kind: { type: 'string', enum: [...AI_CHART_D1_K0_RULE_KINDS] },
  title: shortTextSchema,
  content: { type: 'string', minLength: 1, maxLength: AI_CHART_D1_MAX_TEXT_LENGTH },
  contentSha256: shaSchema,
  ruleStatus: { type: 'string', enum: [...AI_CHART_D1_RULE_STATUSES] },
  sourceAuthority: { type: 'string', enum: [...AI_CHART_D1_K0_SOURCE_AUTHORITIES] },
  sourceFile: { type: 'string', enum: [...AI_CHART_D1_K0_SOURCE_WHITELIST] },
  sourceFileSha256: shaSchema,
  sourceLocator: locatorSchema,
  appliesTo: { type: 'array', maxItems: AI_CHART_D1_MAX_LIST_ITEMS, items: idSchema },
  priority: { type: 'integer', minimum: 100, maximum: 400 },
  d1Safety: { const: AI_CHART_D1_K0_D1_SAFETY },
  selectionTags: { type: 'array', maxItems: AI_CHART_D1_MAX_LIST_ITEMS, items: idSchema },
})
const meaningSchema = strictObject({
  meaningId: idSchema,
  palaceId: { type: 'string', enum: AI_CHART_D1_PALACE_IDENTITIES.map((entry) => entry.palaceId) },
  text: shortTextSchema,
  contentSha256: shaSchema,
  order: { type: 'integer', minimum: 0, maximum: 31 },
  sourceFile: { const: 'content/ai-chart/d1-v1/knowledge/core/C_十二宮分面與身宮疾厄田宅.md' },
  sourceFileSha256: shaSchema,
  sourceLocator: locatorSchema,
})
const countSchema = strictObject({
  covered: { type: 'integer', minimum: 0, maximum: 256 },
  total: { type: 'integer', minimum: 0, maximum: 256 },
})
const palaceIdSchema = {
  type: 'string',
  enum: AI_CHART_D1_PALACE_IDENTITIES.map((entry) => entry.palaceId),
}
const nullablePalaceIdSchema = {
  anyOf: [palaceIdSchema, { type: 'null' }],
}
const nullableMutagenSchema = {
  anyOf: [
    { type: 'string', enum: [...AI_CHART_D1_MUTAGEN_TYPES] },
    { type: 'null' },
  ],
}
const doubleInventorySchema = strictObject({
  pairKey: idSchema,
  leftStar: { type: 'string', enum: [...AI_CHART_D1_MAJOR_STAR_NAMES] },
  rightStar: { type: 'string', enum: [...AI_CHART_D1_MAJOR_STAR_NAMES] },
  canonicalOrder: { type: 'integer', minimum: 0, maximum: 23 },
  specificRuleStatus: {
    anyOf: [
      { type: 'string', enum: [...AI_CHART_D1_RULE_STATUSES] },
      { type: 'null' },
    ],
  },
  specificRuleId: nullableIdSchema,
  missingReason: {
    anyOf: [
      { const: 'missing_confirmed_double_star_core' },
      { type: 'null' },
    ],
  },
})
const mutagenInventorySchema = strictObject({
  starName: shortTextSchema,
  mutagenType: { type: 'string', enum: [...AI_CHART_D1_MUTAGEN_TYPES] },
  specificRuleId: nullableIdSchema,
  sourceAuthority: {
    anyOf: [
      { type: 'string', enum: [...AI_CHART_D1_K0_SOURCE_AUTHORITIES] },
      { type: 'null' },
    ],
  },
  missingReason: {
    anyOf: [{ const: 'missing_specific_mutagen_rule' }, { type: 'null' }],
  },
})
const selectedMeaningSchema = strictObject({
  palaceRole: { type: 'string', enum: [...AI_CHART_D1_K0_PALACE_ROLES] },
  palaceId: palaceIdSchema,
  meaningId: idSchema,
  text: shortTextSchema,
  contentSha256: shaSchema,
  order: { type: 'integer', minimum: 0, maximum: 31 },
})
const traceSchema = strictObject({
  ruleId: idSchema,
  reason: { type: 'string', enum: [...AI_CHART_D1_K0_SELECTION_REASONS] },
  palaceRole: {
    anyOf: [
      { type: 'string', enum: [...AI_CHART_D1_K0_PALACE_ROLES] },
      { type: 'null' },
    ],
  },
  palaceId: nullablePalaceIdSchema,
  placementId: nullableIdSchema,
  starName: nullableShortTextSchema,
  mutagenType: nullableMutagenSchema,
  structuralReference: idSchema,
})
const missingRequirementSchema = strictObject({
  requirementId: idSchema,
  kind: { type: 'string', enum: [...AI_CHART_D1_K0_RULE_KINDS] },
  palaceRole: {
    anyOf: [
      { type: 'string', enum: [...AI_CHART_D1_K0_PALACE_ROLES] },
      { type: 'null' },
    ],
  },
  palaceId: nullablePalaceIdSchema,
  starName: nullableShortTextSchema,
  mutagenType: nullableMutagenSchema,
  pairKey: nullableIdSchema,
  reasonCode: {
    type: 'string',
    enum: [...AI_CHART_D1_K0_MISSING_REASON_CODES],
  },
})

export const AI_CHART_D1_K0_CATALOG_INTERNAL_JSON_SCHEMA: AiChartD1JsonSchema =
  strictObject({
    contractVersion: { const: AI_CHART_D1_K0_CATALOG_VERSION },
    catalogId: { const: AI_CHART_D1_K0_CATALOG_ID },
    catalogFingerprint: shaSchema,
    sourceManifestVersion: shortTextSchema,
    sourceManifestSha256: shaSchema,
    compiledAtPolicy: { const: AI_CHART_D1_K0_COMPILED_AT_POLICY },
    rules: { type: 'array', maxItems: 256, items: ruleSchema },
    palaceMeanings: { type: 'array', maxItems: 128, items: meaningSchema },
    doubleStarInventory: {
      type: 'array',
      minItems: 24,
      maxItems: 24,
      items: doubleInventorySchema,
    },
    mutagenInventory: {
      type: 'array',
      maxItems: 64,
      items: mutagenInventorySchema,
    },
    coverage: strictObject({
      palaceMeaningCoverage: countSchema,
      singleStarCoverage: countSchema,
      singleStarTeacherSupplementCoverage: countSchema,
      doubleStarSpecificCoverage: countSchema,
      mutagenSpecificCoverage: countSchema,
      supportingStarCoverage: countSchema,
      structureRuleCoverage: countSchema,
    }),
    warnings: { type: 'array', maxItems: 128, items: idSchema },
    readiness: { type: 'string', enum: ['ready', 'partial'] },
  })

export const AI_CHART_D1_K0_P1_BUNDLE_INTERNAL_JSON_SCHEMA: AiChartD1JsonSchema =
  strictObject({
    contractVersion: { const: AI_CHART_D1_K0_BUNDLE_VERSION },
    bundleId: idSchema,
    catalogId: { const: AI_CHART_D1_K0_CATALOG_ID },
    catalogFingerprint: shaSchema,
    sourceManifestSha256: shaSchema,
    task: { const: 'D1_K0_P1' },
    chartId: idSchema,
    runId: idSchema,
    callId: idSchema,
    targetPalaceId: palaceIdSchema,
    p1StructuralInputContractVersion: { const: AI_CHART_D1_P1_STRUCTURAL_INPUT_CONTRACT_VERSION },
    outputContractVersion: { const: 'ai-chart-d1-p1-f1/v1' },
    selectedRules: { type: 'array', maxItems: 256, items: ruleSchema },
    selectedMeanings: {
      type: 'array',
      maxItems: 128,
      items: selectedMeaningSchema,
    },
    selectionTrace: { type: 'array', maxItems: 256, items: traceSchema },
    missingRequirements: {
      type: 'array',
      maxItems: 128,
      items: missingRequirementSchema,
    },
    knowledgeStatus: { type: 'string', enum: ['ready', 'partial'] },
    promptStatus: { const: 'prompt_builder_required' },
    openAiCallable: { const: false },
    warnings: { type: 'array', maxItems: 128, items: idSchema },
  })
