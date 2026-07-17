import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  AI_CHART_D1_EXPECTED_FILE_COUNT,
  AI_CHART_D1_MANIFEST_INVALID,
  AI_CHART_D1_MANIFEST_PATH,
  AI_CHART_D1_RUNTIME_DISABLED,
  assertAiChartD1RuntimeEnabled,
  validateAiChartD1AssetManifest,
} from './d1Assets'

type MutableRecord = Record<string, unknown>

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

function cloneFixture(): MutableRecord {
  return structuredClone(formalManifest) as unknown as MutableRecord
}

function fixtureFiles(fixture: MutableRecord): MutableRecord[] {
  assert.equal(Array.isArray(fixture.files), true)
  return fixture.files as MutableRecord[]
}

function expectInvalid(value: unknown, rawMarker?: string) {
  try {
    validateAiChartD1AssetManifest(value)
    assert.fail('expected manifest validation failure')
  } catch (error) {
    assert.equal(error instanceof Error, true)
    if (!(error instanceof Error)) assert.fail('expected Error')
    assert.equal(error.message, AI_CHART_D1_MANIFEST_INVALID)
    if (rawMarker) assert.equal(error.message.includes(rawMarker), false)
  }
}

function expectInvalidMutation(mutate: (fixture: MutableRecord) => void, rawMarker?: string) {
  const fixture = cloneFixture()
  mutate(fixture)
  expectInvalid(fixture, rawMarker)
}

test('formal manifest fixture is valid and preserves source path whitespace', () => {
  const manifest = validateAiChartD1AssetManifest(cloneFixture())

  assert.equal(manifest.files.length, AI_CHART_D1_EXPECTED_FILE_COUNT)
  assert.equal(
    manifest.files.some((file) => file.sourcePath.includes('工作區 /')),
    true,
  )
})

test('non-plain top-level values are rejected', () => {
  for (const value of [
    null,
    [],
    new Date(),
    new (class Manifest {})(),
  ]) {
    expectInvalid(value)
  }
})

test('unexpected top-level fields are rejected', () => {
  expectInvalidMutation((fixture) => {
    fixture.unexpected = true
  })
})

test('manifestVersion mismatch is rejected', () => {
  expectInvalidMutation((fixture) => {
    fixture.manifestVersion = 'unsafe-manifest-version'
  }, 'unsafe-manifest-version')
})

test('scope mismatch is rejected', () => {
  expectInvalidMutation((fixture) => {
    fixture.scope = 'D2'
  }, 'D2')
})

test('modelTarget mismatch is rejected', () => {
  expectInvalidMutation((fixture) => {
    fixture.modelTarget = 'unsafe-model'
  }, 'unsafe-model')
})

test('modelEnvironmentVariable mismatch is rejected', () => {
  expectInvalidMutation((fixture) => {
    fixture.modelEnvironmentVariable = 'UNSAFE_MODEL_ENV'
  }, 'UNSAFE_MODEL_ENV')
})

test('top-level runtimeEnabled true is rejected', () => {
  expectInvalidMutation((fixture) => {
    fixture.runtimeEnabled = true
  })
})

test('manifest rejects 22 files', () => {
  expectInvalidMutation((fixture) => {
    fixtureFiles(fixture).pop()
  })
})

test('manifest rejects 24 files', () => {
  expectInvalidMutation((fixture) => {
    const files = fixtureFiles(fixture)
    files.push(structuredClone(files[0]))
  })
})

test('invalid SHA-256 format is rejected', () => {
  expectInvalidMutation((fixture) => {
    fixtureFiles(fixture)[0].sha256 = 'unsafe-sha'
  }, 'unsafe-sha')
})

test('absolute target path is rejected', () => {
  expectInvalidMutation((fixture) => {
    fixtureFiles(fixture)[0].path = '/content/ai-chart/d1-v1/prompt.md'
  })
})

test('target path traversal is rejected', () => {
  expectInvalidMutation((fixture) => {
    fixtureFiles(fixture)[0].path = 'content/ai-chart/d1-v1/../outside.md'
  })
})

test('target path with backslash is rejected', () => {
  expectInvalidMutation((fixture) => {
    fixtureFiles(fixture)[0].path = 'content/ai-chart/d1-v1\\outside.md'
  })
})

test('target path outside the formal root is rejected', () => {
  expectInvalidMutation((fixture) => {
    fixtureFiles(fixture)[0].path = 'content/ai-chart/d2-v1/outside.md'
  })
})

test('sourcePath outside AI chart source root is rejected', () => {
  expectInvalidMutation((fixture) => {
    fixtureFiles(fixture)[0].sourcePath = 'other-source/prompt.md'
  })
})

test('duplicate target paths are rejected', () => {
  expectInvalidMutation((fixture) => {
    const files = fixtureFiles(fixture)
    files[1].path = files[0].path
  })
})

test('duplicate source paths are rejected', () => {
  expectInvalidMutation((fixture) => {
    const files = fixtureFiles(fixture)
    files[1].sourcePath = files[0].sourcePath
  })
})

test('draft cannot be runtime eligible', () => {
  expectInvalidMutation((fixture) => {
    const draft = fixtureFiles(fixture).find((file) => file.status === 'draft')
    assert.ok(draft)
    draft.runtimeEligible = true
  })
})

test('reference-only material cannot be runtime eligible', () => {
  expectInvalidMutation((fixture) => {
    const reference = fixtureFiles(fixture).find(
      (file) => file.status === 'reference_only',
    )
    assert.ok(reference)
    reference.runtimeEligible = true
  })
})

test('file runtimeEnabled true is rejected', () => {
  expectInvalidMutation((fixture) => {
    fixtureFiles(fixture)[0].runtimeEnabled = true
  })
})

test('classification and status mismatch is rejected', () => {
  expectInvalidMutation((fixture) => {
    fixtureFiles(fixture)[0].classification = 'reference_spec'
  })
})

test('unexpected file fields are rejected', () => {
  expectInvalidMutation((fixture) => {
    fixtureFiles(fixture)[0].content = 'must-not-be-accepted'
  })
})

test('runtime enabled assertion fails closed with fixed error code', () => {
  const manifest = validateAiChartD1AssetManifest(cloneFixture())
  assert.throws(
    () => assertAiChartD1RuntimeEnabled(manifest),
    { message: AI_CHART_D1_RUNTIME_DISABLED },
  )
})

test('validated result is deeply independent and frozen', () => {
  const fixture = cloneFixture()
  const manifest = validateAiChartD1AssetManifest(fixture)
  const validatedPath = manifest.files[0].path

  fixtureFiles(fixture)[0].path = 'content/ai-chart/d1-v1/changed-after-validation.md'

  assert.equal(manifest.files[0].path, validatedPath)
  assert.equal(Object.isFrozen(manifest), true)
  assert.equal(Object.isFrozen(manifest.files), true)
  assert.equal(manifest.files.every((file) => Object.isFrozen(file)), true)
})

console.log('AI chart D1 manifest validator tests passed')
