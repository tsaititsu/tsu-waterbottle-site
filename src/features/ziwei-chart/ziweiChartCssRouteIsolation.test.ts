import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const readSource = (path: string) => readFileSync(join(root, path), 'utf8')

const rootLayoutPath = 'src/app/layout.tsx'
const globalsPath = 'src/app/globals.css'
const aiChartPagePath = 'src/app/ai-chart/page.tsx'
const resultPagePath = 'src/app/ai-chart/result/page.tsx'
const chartFormCssPath = 'src/app/ai-chart/chart-form.css'
const resultChartCssPath = 'src/app/ai-chart/result/result-chart.css'

const rootLayout = readSource(rootLayoutPath)
const globals = readSource(globalsPath)
const aiChartPage = readSource(aiChartPagePath)
const resultPage = readSource(resultPagePath)
const chartFormCss = readSource(chartFormCssPath)
const resultChartCss = readSource(resultChartCssPath)

assert.equal(rootLayout.includes("import './globals.css'"), true)
assert.equal(rootLayout.includes('original-chart.css'), false)
assert.equal(rootLayout.includes('ziwei-chart-package.css'), false)

const originalChartImport = "import '@/features/ziwei-chart/original-chart.css'"
const resultChartImport = "import './result-chart.css'"
assert.equal(resultPage.startsWith(`${originalChartImport}\n${resultChartImport}\n`), true)
assert.equal(aiChartPage.includes("import './chart-form.css'"), true)

for (const forbiddenGlobalMarker of [
  '.chart-workspace',
  '.original-ziwei-view',
  '.waterbottle-chart-embed',
  '.zce-',
  '.chart-birth-form',
]) {
  assert.equal(
    globals.includes(forbiddenGlobalMarker),
    false,
    `${globalsPath} must not contain ${forbiddenGlobalMarker}`,
  )
}

for (const requiredResultRule of [
  '.chart-workspace {\n  min-height: calc(100vh - 150px);',
  '.original-ziwei-view {\n  max-width: 100%;\n  min-width: 0;',
  '.original-ziwei-view .chart-wrapper {\n  max-width: 100%;\n  min-width: 0;',
  '.original-ziwei-view .chart-grid {',
  'grid-template-rows: repeat(4, minmax(clamp(110px, 17vh, 240px), 1fr));',
  '.original-ziwei-view .palace-cell,\n.original-ziwei-view .center-cell {',
  '.original-ziwei-view .decadal-timeline,\n.original-ziwei-view .yearly-timeline {',
  '@media (max-width: 768px)',
  '.chart-workspace {\n    min-height: auto;',
  '--fs-pinyin: 11px;',
  '--fs-small: 12px;',
  '--fs-star: 13px;',
  '--fs-zh-small: 12px;',
  '--fs-zh-star: 13px;',
  '--fs-zh-tiny: 11px;',
]) {
  assert.equal(
    resultChartCss.includes(requiredResultRule),
    true,
    `${resultChartCssPath} must contain ${requiredResultRule}`,
  )
}

for (const requiredFormRule of [
  '@media (max-width: 768px)',
  ".chart-birth-form input:not([type='checkbox']):not([type='radio']),",
  '.chart-birth-form select,',
  '.chart-birth-form textarea {',
  'font-size: 16px;',
]) {
  assert.equal(
    chartFormCss.includes(requiredFormRule),
    true,
    `${chartFormCssPath} must contain ${requiredFormRule}`,
  )
}

function assertRouteCssHasNoDocumentScope(css: string, path: string) {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '')
  assert.doesNotMatch(withoutComments, /^\s*(?::root|html|body|\*|\*::before|\*::after)\s*(?:,|\{)/m)
  assert.equal(withoutComments.includes('!important'), false, `${path} must not use !important`)
  assert.equal(withoutComments.includes('@scope'), false, `${path} must not use @scope`)
}

assertRouteCssHasNoDocumentScope(resultChartCss, resultChartCssPath)
assertRouteCssHasNoDocumentScope(chartFormCss, chartFormCssPath)

const trackedRuntimeSources = execFileSync('git', ['ls-files'], {
  cwd: root,
  encoding: 'utf8',
})
  .trim()
  .split('\n')
  .filter(Boolean)
  .filter((path) => /\.(?:[cm]?[jt]sx?)$/.test(path))
  .filter((path) => !path.endsWith('.d.ts'))
  .filter((path) => !path.includes('.test.'))
  .filter((path) => path !== 'src/features/ziwei-chart/package/index.js')

const runtimeSources = trackedRuntimeSources.map((path) => ({ path, source: readSource(path) }))
const embedConsumers = runtimeSources.filter(({ source }) => /\bZiweiChartEmbed\b/.test(source))
assert.deepEqual(embedConsumers.map(({ path }) => path), [])

const packageCssImporters = runtimeSources.filter(({ source }) =>
  source.includes('ziwei-chart-package.css'),
)
assert.deepEqual(packageCssImporters.map(({ path }) => path), [])

const originalChartCssImporters = runtimeSources.filter(({ source }) =>
  source.includes('original-chart.css'),
)
assert.deepEqual(originalChartCssImporters.map(({ path }) => path), [resultPagePath])

console.log('✓ Ziwei chart CSS is owned only by its intended routes')
