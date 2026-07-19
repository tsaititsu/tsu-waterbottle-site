import {
  buildAiChartD1P1PromptPackages,
  parseAiChartD1P1PromptPackage,
} from './d1P1PromptPackageBuilder'
import {
  createAiChartD1P1PromptPackageBudget,
  createAiChartD1P1PromptPackageFingerprint,
  hashAiChartD1P1PromptPackageValue,
  type AiChartD1P1PromptPackage,
  type AiChartD1P1PromptPackageWithoutFingerprint,
} from './d1P1PromptPackageContracts'
import {
  createModelInputFixture,
  type ModelInputFixture,
  type Mutable,
} from './d1P1ModelInputTestSupport'

export type PromptPackageFixture = ModelInputFixture &
  Readonly<{
    promptPackages: readonly AiChartD1P1PromptPackage[]
  }>

export async function createPromptPackageFixture(
  identity = 'prompt-package',
): Promise<PromptPackageFixture> {
  const fixture = await createModelInputFixture(identity)
  const promptPackages = buildAiChartD1P1PromptPackages(
    fixture.catalog,
    fixture.structuralInputs,
    fixture.bundles,
    fixture.modelInputs,
  )
  return { ...fixture, promptPackages }
}

export function recalculatePromptPackageFingerprint(
  value: Mutable<AiChartD1P1PromptPackage>,
): void {
  const payload = structuredClone(value) as unknown as Record<string, unknown>
  delete payload.packageFingerprint
  value.packageFingerprint = createAiChartD1P1PromptPackageFingerprint(
    payload as AiChartD1P1PromptPackageWithoutFingerprint,
  )
}

export function recalculatePromptPackageTextBindings(
  value: Mutable<AiChartD1P1PromptPackage>,
): void {
  value.instructionsSha256 = hashAiChartD1P1PromptPackageValue(
    value.instructions,
  )
  value.userInputSha256 = hashAiChartD1P1PromptPackageValue(value.userInput)
  value.budget = structuredClone(
    createAiChartD1P1PromptPackageBudget(
      value.instructions,
      value.userInput,
    ),
  )
  recalculatePromptPackageFingerprint(value)
}

export function parseFixturePromptPackage(
  fixture: PromptPackageFixture,
  index: number,
  value: unknown,
): AiChartD1P1PromptPackage {
  return parseAiChartD1P1PromptPackage(
    value,
    fixture.catalog,
    fixture.structuralInputs[index],
    fixture.bundles[index],
    fixture.modelInputs[index],
  )
}

export type { Mutable }
