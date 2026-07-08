import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import {
  DEFAULT_DIVINATION_OPENAI_MODEL,
  getDivinationOpenAIModel,
} from './divinationModel'

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`✓ ${name}`)
  } catch (error) {
    console.error(`✗ ${name}`)
    throw error
  }
}

function readWorkspaceFile(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8')
}

function listFiles(directory: string): string[] {
  const absoluteDirectory = join(process.cwd(), directory)

  if (!existsSync(absoluteDirectory)) {
    return []
  }

  const files: string[] = []

  for (const entry of readdirSync(absoluteDirectory)) {
    const absoluteEntry = join(absoluteDirectory, entry)
    const relativeEntry = join(directory, entry)

    if (statSync(absoluteEntry).isDirectory()) {
      files.push(...listFiles(relativeEntry))
    } else {
      files.push(relativeEntry)
    }
  }

  return files
}

test('default divination OpenAI model is gpt-5.5', () => {
  assert.equal(DEFAULT_DIVINATION_OPENAI_MODEL, 'gpt-5.5')
  assert.equal(getDivinationOpenAIModel(), 'gpt-5.5')
  assert.equal(getDivinationOpenAIModel({}), 'gpt-5.5')
})

test('OPENAI_DIVINATION_MODEL can override the default model', () => {
  assert.equal(
    getDivinationOpenAIModel({
      OPENAI_DIVINATION_MODEL: 'custom-divination-model',
    }),
    'custom-divination-model',
  )
})

test('OPENAI_DIVINATION_MODEL override is trimmed', () => {
  assert.equal(
    getDivinationOpenAIModel({
      OPENAI_DIVINATION_MODEL: '  custom-divination-model  ',
    }),
    'custom-divination-model',
  )
})

test('empty OPENAI_DIVINATION_MODEL falls back to gpt-5.5', () => {
  assert.equal(getDivinationOpenAIModel({ OPENAI_DIVINATION_MODEL: '' }), 'gpt-5.5')
  assert.equal(getDivinationOpenAIModel({ OPENAI_DIVINATION_MODEL: '   ' }), 'gpt-5.5')
  assert.equal(getDivinationOpenAIModel({ OPENAI_DIVINATION_MODEL: null }), 'gpt-5.5')
})

test('divination interpret route uses the dedicated model helper', () => {
  const source = readWorkspaceFile('src/app/api/divination/interpret/route.ts')

  assert.match(source, /getDivinationOpenAIModel\(process\.env\)/)
  assert.doesNotMatch(source, /process\.env\.OPENAI_MODEL/)
  assert.doesNotMatch(source, /fallbackOpenAiModel/)
})

test('missing legacy reading and line routes are not active OpenAI call sites', () => {
  assert.equal(existsSync(join(process.cwd(), 'src/app/api/reading/route.ts')), false)
  assert.equal(existsSync(join(process.cwd(), 'src/app/api/line/draw/route.ts')), false)
  assert.equal(existsSync(join(process.cwd(), 'src/app/api/line/webhook/route.ts')), false)
  assert.equal(existsSync(join(process.cwd(), 'src/app/api/line/readings-supabase.ts')), false)
})

test('ai-chart files do not import the divination model helper', () => {
  const aiChartFiles = [
    ...listFiles('src/app/ai-chart'),
    ...listFiles('src/app/api/ai-chart'),
    ...listFiles('src/lib/ai-chart'),
  ]

  for (const file of aiChartFiles) {
    const source = readWorkspaceFile(file)

    assert.doesNotMatch(source, /divinationModel/)
    assert.doesNotMatch(source, /OPENAI_DIVINATION_MODEL/)
  }
})

test('helper source does not contain API keys or payment secrets', () => {
  const source = readWorkspaceFile('src/lib/openai/divinationModel.ts')

  assert.doesNotMatch(source, /OPENAI_API_KEY/)
  assert.doesNotMatch(source, /NEWEBPAY/)
  assert.doesNotMatch(source, /LINE_PAY/)
  assert.doesNotMatch(source, /TradeInfo|TradeSha|HashKey|HashIV/)
})
