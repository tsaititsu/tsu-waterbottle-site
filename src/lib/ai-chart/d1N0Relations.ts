import type { EarthlyBranch } from '@/features/ziwei-chart/types/ziwei'
import {
  AI_CHART_D1_HIDDEN_COMBINATION_PAIRS,
  AI_CHART_D1_N0_INVALID,
  AI_CHART_D1_TRINE_GROUPS,
  type AiChartD1PalaceId,
} from './d1N0Constants'

export type AiChartD1N0RelationSeed = Readonly<{
  palaceId: AiChartD1PalaceId
  index: number
  earthlyBranch: EarthlyBranch
}>

export type AiChartD1N0PalaceRelations = Readonly<{
  palaceId: AiChartD1PalaceId
  oppositePalaceId: AiChartD1PalaceId
  hiddenCombinationPalaceId: AiChartD1PalaceId
  trinePalaceIds: readonly AiChartD1PalaceId[]
  otherTrinePalaceIds: readonly AiChartD1PalaceId[]
}>

function relationInvalid(): never {
  throw new Error(AI_CHART_D1_N0_INVALID)
}

function buildHiddenBranchMap(): Readonly<Record<EarthlyBranch, EarthlyBranch>> {
  const entries: [EarthlyBranch, EarthlyBranch][] = []
  for (const [left, right] of AI_CHART_D1_HIDDEN_COMBINATION_PAIRS) {
    entries.push([left, right], [right, left])
  }
  return Object.freeze(Object.fromEntries(entries) as Record<EarthlyBranch, EarthlyBranch>)
}

const HIDDEN_BRANCH_MAP = buildHiddenBranchMap()

export function buildAiChartD1N0PalaceRelations(
  palaces: readonly AiChartD1N0RelationSeed[],
): readonly AiChartD1N0PalaceRelations[] {
  if (palaces.length !== 12) relationInvalid()

  const byIndex = new Map<number, AiChartD1N0RelationSeed>()
  const byBranch = new Map<EarthlyBranch, AiChartD1N0RelationSeed>()
  const palaceIds = new Set<AiChartD1PalaceId>()

  for (const palace of palaces) {
    if (
      !Number.isInteger(palace.index) ||
      palace.index < 0 ||
      palace.index > 11 ||
      byIndex.has(palace.index) ||
      byBranch.has(palace.earthlyBranch) ||
      palaceIds.has(palace.palaceId)
    ) {
      relationInvalid()
    }
    byIndex.set(palace.index, palace)
    byBranch.set(palace.earthlyBranch, palace)
    palaceIds.add(palace.palaceId)
  }

  if (byIndex.size !== 12 || byBranch.size !== 12 || palaceIds.size !== 12) {
    relationInvalid()
  }

  return Object.freeze(
    palaces.map((palace) => {
      const opposite = byIndex.get((palace.index + 6) % 12)
      const hiddenBranch = HIDDEN_BRANCH_MAP[palace.earthlyBranch]
      const hidden = byBranch.get(hiddenBranch)
      const trineGroup = AI_CHART_D1_TRINE_GROUPS.find((group) =>
        (group as readonly EarthlyBranch[]).includes(palace.earthlyBranch),
      )
      if (!opposite || !hidden || !trineGroup) relationInvalid()

      const trinePalaces = trineGroup.map((branch) => byBranch.get(branch))
      if (trinePalaces.some((item) => item === undefined)) relationInvalid()

      const otherTrines = (trinePalaces as AiChartD1N0RelationSeed[])
        .filter((item) => item.palaceId !== palace.palaceId)
        .sort((left, right) => left.index - right.index)

      if (
        opposite.palaceId === palace.palaceId ||
        hidden.palaceId === palace.palaceId ||
        otherTrines.length !== 2 ||
        otherTrines.some(
          (item) =>
            item.palaceId === palace.palaceId ||
            item.palaceId === opposite.palaceId,
        )
      ) {
        relationInvalid()
      }

      return Object.freeze({
        palaceId: palace.palaceId,
        oppositePalaceId: opposite.palaceId,
        hiddenCombinationPalaceId: hidden.palaceId,
        trinePalaceIds: Object.freeze([
          palace.palaceId,
          ...otherTrines.map((item) => item.palaceId),
        ]),
        otherTrinePalaceIds: Object.freeze(
          otherTrines.map((item) => item.palaceId),
        ),
      })
    }),
  )
}
