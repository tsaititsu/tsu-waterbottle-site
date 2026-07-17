import type { AiChartD1K0MarkdownLocatorDefinition } from './d1K0Registry'

export const AI_CHART_D1_K0_ASSET_INVALID =
  'ai_chart_d1_k0_asset_invalid' as const

export class AiChartD1K0AssetError extends Error {
  readonly code = AI_CHART_D1_K0_ASSET_INVALID

  constructor() {
    super(AI_CHART_D1_K0_ASSET_INVALID)
    this.name = 'AiChartD1K0AssetError'
  }
}

function invalid(): never {
  throw new AiChartD1K0AssetError()
}

type Heading = Readonly<{
  lineIndex: number
  level: number
  title: string
  path: readonly string[]
}>

function parseHeadings(text: string): readonly Heading[] {
  const lines = text.split('\n')
  const stack: string[] = []
  const headings: Heading[] = []

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const match = /^(#{1,4}) ([^\r]+)\r?$/.exec(lines[lineIndex])
    if (!match) continue
    const level = match[1].length
    const title = match[2]
    stack.length = level - 1
    const path = Object.freeze(stack.slice(1))
    headings.push(Object.freeze({ lineIndex, level, title, path }))
    stack[level - 1] = title
  }

  return Object.freeze(headings)
}

function samePath(left: readonly string[], right: readonly string[]): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  )
}

function getSectionLines(
  text: string,
  locator: AiChartD1K0MarkdownLocatorDefinition,
): readonly string[] {
  const lines = text.split('\n')
  const headings = parseHeadings(text)
  const matches = headings.filter(
    (heading) =>
      heading.level === locator.headingLevel &&
      heading.title === locator.exactHeading &&
      samePath(heading.path, locator.headingPath),
  )

  if (
    matches.length === 0 ||
    locator.occurrenceIndex < 0 ||
    locator.occurrenceIndex >= matches.length
  ) {
    invalid()
  }

  const selected = matches[locator.occurrenceIndex]
  const next = headings.find(
    (heading) =>
      heading.lineIndex > selected.lineIndex &&
      heading.level <= selected.level,
  )
  const end = next?.lineIndex ?? lines.length
  return Object.freeze(lines.slice(selected.lineIndex + 1, end))
}

function stripBold(value: string): string {
  return value.replace(/^\*\*(.+)\*\*$/, '$1')
}

function extractBulletText(lines: readonly string[]): readonly string[] {
  return Object.freeze(
    lines.flatMap((line) => {
      const match = /^\s*-\s+(.+?)\r?$/.exec(line)
      return match ? [match[1]] : []
    }),
  )
}

export function hasAiChartD1K0ExactMarkdownHeading(
  text: string,
  headingLevel: 1 | 2 | 3 | 4,
  exactHeading: string,
): boolean {
  return parseHeadings(text).some(
    (heading) =>
      heading.level === headingLevel && heading.title === exactHeading,
  )
}

export function extractAiChartD1K0Markdown(
  text: string,
  locator: AiChartD1K0MarkdownLocatorDefinition,
): string {
  try {
    const sectionLines = getSectionLines(text, locator)
    let result: string

    if (locator.extractionMode === 'exact_section') {
      if (
        locator.itemIndex !== null ||
        locator.exactLabel !== null ||
        locator.exactText !== null
      ) {
        invalid()
      }
      result = sectionLines.join('\n').trim()
    } else if (locator.extractionMode === 'exact_bullet') {
      if (
        locator.itemIndex === null ||
        locator.exactLabel !== null ||
        locator.exactText === null
      ) {
        invalid()
      }
      const bullets = extractBulletText(sectionLines)
      result = bullets[locator.itemIndex] ?? ''
      if (result !== locator.exactText) invalid()
    } else if (locator.extractionMode === 'exact_labeled_bullets') {
      if (
        locator.itemIndex !== null ||
        locator.exactLabel === null ||
        locator.exactText !== null
      ) {
        invalid()
      }
      const matching = extractBulletText(sectionLines).flatMap((entry) => {
        const separatorIndex = entry.indexOf('：')
        if (separatorIndex < 1) return []
        const label = stripBold(entry.slice(0, separatorIndex))
        return label === locator.exactLabel
          ? [entry.slice(separatorIndex + 1).trim()]
          : []
      })
      if (matching.length !== 1) invalid()
      result = matching[0]
    } else {
      if (
        locator.itemIndex === null ||
        locator.exactLabel !== null ||
        locator.exactText === null
      ) {
        invalid()
      }
      const nonEmptyLines = sectionLines
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
      result = nonEmptyLines[locator.itemIndex] ?? ''
      if (result !== locator.exactText) invalid()
    }

    if (result.length === 0) invalid()
    return result
  } catch (error) {
    if (error instanceof AiChartD1K0AssetError) throw error
    invalid()
  }
}
