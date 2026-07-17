import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import {
  AI_CHART_D1_MANIFEST_PATH,
  validateAiChartD1AssetManifest,
  type AiChartD1AssetManifest,
} from './d1Assets'
import {
  AI_CHART_D1_PRIMARY_SPEC_PATH,
  AI_CHART_D1_REQUIRED_REASONING_ASSETS,
  AI_CHART_D1_REQUIRED_REFERENCE_INVALID,
  assertAiChartD1RequiredAssetReferences,
} from './d1AssetReferences'

const formalManifest = JSON.parse(
  readFileSync(AI_CHART_D1_MANIFEST_PATH, 'utf8'),
) as unknown

function test(name: string, run: () => void) {
  try {
    run()
    console.log(`✓ ${name}`)
  } catch (error) {
    console.error(`✗ ${name}`)
    throw error
  }
}

function sha256(value: Buffer): string {
  return createHash('sha256').update(value).digest('hex')
}

function expectInvalid(
  manifest: AiChartD1AssetManifest,
  primarySpecText: string,
  rawMarker?: string,
) {
  try {
    assertAiChartD1RequiredAssetReferences(manifest, primarySpecText)
    assert.fail('expected required asset reference failure')
  } catch (error) {
    assert.equal(error instanceof Error, true)
    if (!(error instanceof Error)) assert.fail('expected Error')
    assert.equal(error.message, AI_CHART_D1_REQUIRED_REFERENCE_INVALID)
    if (rawMarker) assert.equal(error.message.includes(rawMarker), false)
  }
}

const manifest = validateAiChartD1AssetManifest(structuredClone(formalManifest))
const primarySpecText = readFileSync(AI_CHART_D1_PRIMARY_SPEC_PATH, 'utf8')

test('formal primary spec and manifest contain all required reasoning assets', () => {
  assertAiChartD1RequiredAssetReferences(manifest, primarySpecText)
  assert.equal(AI_CHART_D1_REQUIRED_REASONING_ASSETS.length, 7)
})

test('required reasoning assets are immutable and use unique source paths', () => {
  assert.equal(Object.isFrozen(AI_CHART_D1_REQUIRED_REASONING_ASSETS), true)
  assert.equal(
    AI_CHART_D1_REQUIRED_REASONING_ASSETS.every((asset) =>
      Object.isFrozen(asset),
    ),
    true,
  )
  assert.equal(
    new Set(
      AI_CHART_D1_REQUIRED_REASONING_ASSETS.map((asset) => asset.sourcePath),
    ).size,
    AI_CHART_D1_REQUIRED_REASONING_ASSETS.length,
  )
})

test('required tracked files exist and match manifest SHA-256 values', () => {
  for (const required of AI_CHART_D1_REQUIRED_REASONING_ASSETS) {
    const file = manifest.files.find((entry) => entry.path === required.path)
    assert.ok(file)
    assert.equal(sha256(readFileSync(required.path)), file.sha256)
    assert.equal(file.sourcePath, required.sourcePath)
    assert.equal(file.classification, 'reasoning_knowledge')
    assert.equal(file.status, 'reasoning_source_candidate')
    assert.equal(file.runtimeEligible, true)
    assert.equal(file.runtimeEnabled, false)
  }
})

test('removing any required primary spec reference fails closed', () => {
  for (const required of AI_CHART_D1_REQUIRED_REASONING_ASSETS) {
    const marker = `\`${required.fileName}\``
    const changedSpec = primarySpecText.replace(marker, '`missing-required-asset.md`')
    assert.notEqual(changedSpec, primarySpecText)
    expectInvalid(manifest, changedSpec, required.fileName)
  }
})

test('a required filename outside the explicit knowledge section is ignored', () => {
  const required = AI_CHART_D1_REQUIRED_REASONING_ASSETS[0]
  const marker = `\`${required.fileName}\``
  const changedSpec = `${primarySpecText.replace(
    marker,
    '`missing-required-asset.md`',
  )}\n\nGeneral note: ${marker}\n`

  expectInvalid(manifest, changedSpec, required.fileName)
})

test('removing any required manifest entry fails closed', () => {
  for (const required of AI_CHART_D1_REQUIRED_REASONING_ASSETS) {
    const changedManifest = structuredClone(manifest)
    changedManifest.files = changedManifest.files.filter(
      (file) => file.path !== required.path,
    )
    expectInvalid(changedManifest, primarySpecText, required.path)
  }
})

test('changed required metadata fails with a fixed safe error', () => {
  const marker = 'unsafe-local-source-marker'
  const changedManifest = structuredClone(manifest)
  const requiredPath = AI_CHART_D1_REQUIRED_REASONING_ASSETS[0].path
  const changedFile = changedManifest.files.find(
    (file) => file.path === requiredPath,
  )
  assert.ok(changedFile)
  changedFile.sourcePath = `AI 命盤 OpenAI/${marker}.md`

  expectInvalid(changedManifest, primarySpecText, marker)
})

console.log('AI chart D1 required asset reference tests passed')
