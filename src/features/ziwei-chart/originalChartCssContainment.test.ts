import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const css = readFileSync(
  join(process.cwd(), 'src/features/ziwei-chart/original-chart.css'),
  'utf8',
)
const source = css.replace(/\/\*[\s\S]*?\*\//g, '')

type CssRule = {
  selectors: string[]
  declarations: string
}

function collectRules(input: string): CssRule[] {
  const rules: CssRule[] = []
  let blockStart = input.indexOf('{')

  while (blockStart !== -1) {
    const previousBoundary = Math.max(input.lastIndexOf('{', blockStart - 1), input.lastIndexOf('}', blockStart - 1))
    const header = input.slice(previousBoundary + 1, blockStart).trim()
    const blockEnd = input.indexOf('}', blockStart + 1)

    if (blockEnd === -1) break
    if (header.startsWith('@')) {
      blockStart = input.indexOf('{', blockStart + 1)
      continue
    }

    const selectors = header
      .split(',')
      .map((selector) => selector.trim().replace(/\s+/g, ' '))
      .filter(Boolean)

    rules.push({ selectors, declarations: input.slice(blockStart + 1, blockEnd) })
    blockStart = input.indexOf('{', blockStart + 1)
  }

  return rules
}

const rules = collectRules(source)
const nakedDocumentSelectors = new Set([':root', 'html', 'body'])
const nakedUniversalSelectors = new Set(['*', '*::before', '*::after'])

for (const rule of rules) {
  for (const selector of rule.selectors) {
    assert.equal(
      nakedDocumentSelectors.has(selector),
      false,
      `original chart CSS must not own document selector ${selector}`,
    )
    assert.equal(
      nakedUniversalSelectors.has(selector),
      false,
      `original chart CSS must not reset global selector ${selector}`,
    )
  }
}

const wrapperRules = rules.filter(
  (rule) => rule.selectors.length === 1 && rule.selectors[0] === '.original-ziwei-view',
)
const wrapperBaseRule = wrapperRules.find(
  (rule) =>
    rule.declarations.includes('--red:') &&
    rule.declarations.includes('--font:') &&
    rule.declarations.includes('--fs-star:'),
)

assert.ok(wrapperBaseRule, 'chart variables must be scoped to .original-ziwei-view')
assert.match(wrapperBaseRule.declarations, /font-family:\s*var\(--font\)/)
assert.match(wrapperBaseRule.declarations, /background:\s*#f5f5f0/)
assert.match(wrapperBaseRule.declarations, /color:\s*var\(--black\)/)

const resetRule = rules.find(
  (rule) =>
    rule.selectors.join(', ') ===
    '.original-ziwei-view, .original-ziwei-view *, .original-ziwei-view *::before, .original-ziwei-view *::after',
)

assert.ok(resetRule, 'chart reset must include only the wrapper and its descendants')
assert.match(resetRule.declarations, /box-sizing:\s*border-box/)
assert.match(resetRule.declarations, /margin:\s*0/)
assert.match(resetRule.declarations, /padding:\s*0/)

assert.match(
  source,
  /@media\s*\(max-width:\s*520px\)\s*\{[\s\S]*?\.original-ziwei-view\s*\{[^}]*--fs-star:\s*12px[^}]*--fs-pinyin:\s*10px[^}]*--fs-small:\s*11px/,
  'mobile chart variables must remain scoped to .original-ziwei-view',
)

const legacyImportantCount = 13
assert.equal(
  (source.match(/!important/g) ?? []).length,
  legacyImportantCount,
  'selector containment must not add or remove legacy !important declarations',
)
assert.equal(source.includes('@scope'), false, 'selector containment must not depend on @scope')

console.log('✓ original Ziwei chart CSS top-level selectors are contained')
