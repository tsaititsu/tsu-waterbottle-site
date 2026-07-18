import Module, { createRequire } from 'node:module'
import { normalizeAiChartD1N0 } from './d1N0'
import type { AiChartD1K0Catalog, AiChartD1K0P1Bundle } from './d1K0Contracts'
import { buildAiChartD1K0P1KnowledgeBundles } from './d1K0Selection'
import {
  AI_CHART_D1_MODELED_SUPPORTING_STARS,
  AI_CHART_D1_PALACE_IDENTITIES,
} from './d1N0Constants'
import {
  buildAiChartD1P1StructuralInputs,
  type AiChartD1P1StructuralInput,
} from './d1P1InputContracts'
import {
  buildAiChartD1P1ModelInputs,
  parseAiChartD1P1ModelInput,
} from './d1P1ModelInputBindings'
import {
  createAiChartD1P1ModelInputFingerprint,
  type AiChartD1P1ModelInput,
  type AiChartD1P1ModelInputWithoutFingerprint,
} from './d1P1ModelInputContracts'

export type MutableRecord = Record<string, unknown>
export type Mutable<T> = {
  -readonly [Key in keyof T]: T[Key] extends readonly (infer Item)[]
    ? Mutable<Item>[]
    : T[Key] extends object
      ? Mutable<T[Key]>
      : T[Key]
}

type NodeModuleInternals = {
  _resolveFilename: (
    request: string,
    parent: unknown,
    isMain: boolean,
    options?: unknown,
  ) => string
  _load: (request: string, parent: unknown, isMain: boolean) => unknown
}

const BRANCHES = [
  '子',
  '丑',
  '寅',
  '卯',
  '辰',
  '巳',
  '午',
  '未',
  '申',
  '酉',
  '戌',
  '亥',
] as const
const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const
const MAJORS = [
  ['廉貞', '化祿'],
  ['破軍', '化權'],
  ['武曲', '化科'],
  ['太陽', '化忌'],
  ['天機', null],
  ['天同', null],
  ['天府', null],
  ['太陰', null],
  ['貪狼', null],
  ['巨門', null],
  ['天相', null],
  ['天梁', null],
] as const

let catalogPromise: Promise<AiChartD1K0Catalog> | null = null

function loadCatalogCompiler() {
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
  try {
    return testRequire(
      './d1K0Catalog.server',
    ) as typeof import('./d1K0Catalog.server')
  } finally {
    moduleInternals._resolveFilename = originalResolveFilename
    moduleInternals._load = originalLoad
  }
}

export function getTestCatalog(): Promise<AiChartD1K0Catalog> {
  if (!catalogPromise) {
    const { compileAiChartD1K0Catalog } = loadCatalogCompiler()
    catalogPromise = compileAiChartD1K0Catalog()
  }
  return catalogPromise
}

function star(name: string, type: string, mutagen?: string) {
  return {
    name,
    type,
    scope: 'origin',
    ...(mutagen === undefined ? {} : { mutagen }),
  }
}

export function completeModelInputSnapshot(): MutableRecord {
  const supportingNames = Object.keys(AI_CHART_D1_MODELED_SUPPORTING_STARS)
  return {
    version: 'ai-chart-chart-snapshot/v1',
    source: 'waterbottle-ziwei-native',
    engineVersion: 'v1',
    birthInputVersion: 'ai-chart-birth-input/v1',
    lunarDate: 'synthetic-p1-model-input',
    fiveElementsClass: 'synthetic-p1-model-input',
    palaces: AI_CHART_D1_PALACE_IDENTITIES.map((identity, index) => ({
      index,
      name: identity.engineName,
      isMingPalace: index === 0,
      isBodyPalace: index === 0,
      heavenlyStem: STEMS[index % STEMS.length],
      earthlyBranch: BRANCHES[index],
      majorStars: [
        star(MAJORS[index][0], 'major', MAJORS[index][1] ?? undefined),
      ],
      minorStars:
        index < supportingNames.length
          ? [
              star(
                supportingNames[index],
                AI_CHART_D1_MODELED_SUPPORTING_STARS[
                  supportingNames[
                    index
                  ] as keyof typeof AI_CHART_D1_MODELED_SUPPORTING_STARS
                ],
              ),
            ]
          : [],
      adjectiveStars: [],
      decadal: {
        range: [index * 10, index * 10 + 9],
        heavenlyStem: STEMS[(index + 1) % STEMS.length],
        earthlyBranch: BRANCHES[(index + 1) % BRANCHES.length],
      },
      ages: [index + 1],
    })),
  }
}

export function createStructuralInputs(
  snapshot: MutableRecord,
  identity: string,
): readonly AiChartD1P1StructuralInput[] {
  const n0 = normalizeAiChartD1N0(snapshot, { chartId: `chart:${identity}` })
  return buildAiChartD1P1StructuralInputs(n0, {
    runId: `run:${identity}`,
    callIds: Array.from(
      { length: 12 },
      (_, index) => `call:${identity}:${index}`,
    ),
  })
}

export function bundleIds(identity: string): readonly string[] {
  return Array.from(
    { length: 12 },
    (_, index) => `bundle:${identity}:${index}`,
  )
}

export type ModelInputFixture = Readonly<{
  catalog: AiChartD1K0Catalog
  structuralInputs: readonly AiChartD1P1StructuralInput[]
  bundles: readonly AiChartD1K0P1Bundle[]
  modelInputs: readonly AiChartD1P1ModelInput[]
}>

export async function createModelInputFixture(
  identity = 'model-input',
  snapshot: MutableRecord = completeModelInputSnapshot(),
): Promise<ModelInputFixture> {
  const catalog = await getTestCatalog()
  const structuralInputs = createStructuralInputs(snapshot, identity)
  const bundles = buildAiChartD1K0P1KnowledgeBundles(
    catalog,
    structuralInputs,
    { bundleIds: bundleIds(identity) },
  )
  const modelInputs = buildAiChartD1P1ModelInputs(
    catalog,
    structuralInputs,
    bundles,
  )
  return { catalog, structuralInputs, bundles, modelInputs }
}

export function recalculateModelInputFingerprint(
  value: Mutable<AiChartD1P1ModelInput>,
): void {
  const payload = structuredClone(value) as unknown as Record<string, unknown>
  delete payload.inputFingerprint
  value.inputFingerprint = createAiChartD1P1ModelInputFingerprint(
    payload as AiChartD1P1ModelInputWithoutFingerprint,
  )
}

export function parseFixtureModelInput(
  fixture: ModelInputFixture,
  index: number,
  value: unknown,
): AiChartD1P1ModelInput {
  return parseAiChartD1P1ModelInput(
    value,
    fixture.catalog,
    fixture.structuralInputs[index],
    fixture.bundles[index],
  )
}

export function allObjectKeys(
  value: unknown,
  output = new Set<string>(),
): Set<string> {
  if (Array.isArray(value)) {
    value.forEach((entry) => allObjectKeys(entry, output))
  } else if (value !== null && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) {
      output.add(key)
      allObjectKeys(entry, output)
    }
  }
  return output
}
