import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import {
  DEFAULT_DIVINATION_OPENAI_MODEL,
  DEFAULT_DIVINATION_REASONING_EFFORT,
  getDivinationOpenAIModel,
  getDivinationReasoningEffort,
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

function isRuntimeSourceFile(path: string): boolean {
  return (
    /\.(?:ts|tsx)$/u.test(path) &&
    !/\.(?:test|spec)\.(?:ts|tsx)$/u.test(path) &&
    !/\.d\.ts$/u.test(path)
  )
}

type RuntimeSourceFile = Readonly<{
  path: string
  source: string
}>

function assertAiChartRuntimeModelIsolation(files: readonly RuntimeSourceFile[]) {
  assert.ok(files.length > 0, 'expected AI Chart runtime source files')

  for (const file of files) {
    assert.doesNotMatch(file.source, /divinationModel/, file.path)
    assert.doesNotMatch(file.source, /OPENAI_DIVINATION_MODEL/, file.path)
  }
}

test('default divination OpenAI model is Terra with max reasoning', () => {
  assert.equal(DEFAULT_DIVINATION_OPENAI_MODEL, 'gpt-5.6-terra')
  assert.equal(DEFAULT_DIVINATION_REASONING_EFFORT, 'max')
  assert.equal(getDivinationOpenAIModel(), 'gpt-5.6-terra')
  assert.equal(getDivinationOpenAIModel({}), 'gpt-5.6-terra')
  assert.equal(getDivinationReasoningEffort(), 'max')
})

test('divination model stays on Terra even when a legacy override exists', () => {
  assert.equal(
    getDivinationOpenAIModel({
      OPENAI_DIVINATION_MODEL: 'custom-divination-model',
    }),
    'gpt-5.6-terra',
  )
})

test('empty OPENAI_DIVINATION_MODEL falls back to Terra', () => {
  assert.equal(getDivinationOpenAIModel({ OPENAI_DIVINATION_MODEL: '' }), 'gpt-5.6-terra')
  assert.equal(getDivinationOpenAIModel({ OPENAI_DIVINATION_MODEL: '   ' }), 'gpt-5.6-terra')
  assert.equal(getDivinationOpenAIModel({ OPENAI_DIVINATION_MODEL: null }), 'gpt-5.6-terra')
})

test('reasoning effort is fixed at max for the divination workload', () => {
  assert.equal(getDivinationReasoningEffort(), 'max')
  assert.equal(getDivinationReasoningEffort({ OPENAI_DIVINATION_REASONING_EFFORT: 'xhigh' }), 'max')
})

test('divination interpret route uses the dedicated model helper', () => {
  const source = readWorkspaceFile('src/app/api/divination/interpret/route.ts')
  const engineSource = readWorkspaceFile('src/lib/divination/ziweiCardReadingEngine.ts')

  assert.match(engineSource, /getDivinationOpenAIModel\(process\.env\)/)
  assert.match(engineSource, /getDivinationReasoningEffort\(\)/)
  assert.match(engineSource, /reasoning:\s*\{\s*effort:/)
  assert.doesNotMatch(`${source}\n${engineSource}`, /process\.env\.OPENAI_MODEL/)
  assert.doesNotMatch(`${source}\n${engineSource}`, /fallbackOpenAiModel/)
})

test('divination route uses the migrated ziwei-card reasoning engine', () => {
  const source = readWorkspaceFile('src/app/api/divination/interpret/route.ts')
  const engineSource = readWorkspaceFile('src/lib/divination/ziweiCardReadingEngine.ts')

  assert.match(source, /generateZiweiCardReading/)
  assert.match(engineSource, /questionDomain/)
  assert.match(engineSource, /questionIntent/)
  assert.match(engineSource, /single_investment_guarded/)
  assert.match(engineSource, /經營｜商品品項決策/)
  assert.match(engineSource, /合約｜法律勝負/)
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
  const runtimeFiles = aiChartFiles.filter(isRuntimeSourceFile)

  assertAiChartRuntimeModelIsolation(
    runtimeFiles.map((path) => ({
      path,
      source: readWorkspaceFile(path),
    })),
  )
})

test('ai-chart runtime scan includes production sources and excludes tests', () => {
  const aiChartFiles = [
    ...listFiles('src/app/ai-chart'),
    ...listFiles('src/app/api/ai-chart'),
    ...listFiles('src/lib/ai-chart'),
  ]
  const runtimeFiles = aiChartFiles.filter(isRuntimeSourceFile)

  assert.ok(runtimeFiles.length > 0)
  assert.equal(
    runtimeFiles.includes('src/lib/ai-chart/openAiResponses.server.ts'),
    true,
  )
  assert.equal(
    runtimeFiles.includes('src/lib/ai-chart/openAiResponses.server.test.ts'),
    false,
  )
})

test('runtime source classification excludes generalized test and spec files', () => {
  assert.equal(isRuntimeSourceFile('src/lib/ai-chart/runtime.ts'), true)
  assert.equal(isRuntimeSourceFile('src/app/ai-chart/page.tsx'), true)
  assert.equal(isRuntimeSourceFile('src/lib/ai-chart/runtime.test.ts'), false)
  assert.equal(isRuntimeSourceFile('src/lib/ai-chart/runtime.test.tsx'), false)
  assert.equal(isRuntimeSourceFile('src/lib/ai-chart/runtime.spec.ts'), false)
  assert.equal(isRuntimeSourceFile('src/lib/ai-chart/runtime.spec.tsx'), false)
  assert.equal(isRuntimeSourceFile('src/lib/ai-chart/runtime.d.ts'), false)
  assert.equal(isRuntimeSourceFile('src/lib/ai-chart/runtime.js'), false)
})

test('runtime isolation rejects a divination model helper dependency', () => {
  assert.throws(() =>
    assertAiChartRuntimeModelIsolation([
      {
        path: 'src/lib/ai-chart/synthetic-runtime.ts',
        source: "import '../openai/divinationModel'",
      },
    ]),
  )
})

test('runtime isolation rejects the divination model environment variable', () => {
  assert.throws(() =>
    assertAiChartRuntimeModelIsolation([
      {
        path: 'src/lib/ai-chart/synthetic-runtime.ts',
        source: 'const model = process.env.OPENAI_DIVINATION_MODEL',
      },
    ]),
  )
})

test('helper source does not contain API keys or payment secrets', () => {
  const source = readWorkspaceFile('src/lib/openai/divinationModel.ts')

  assert.doesNotMatch(source, /OPENAI_API_KEY/)
  assert.doesNotMatch(source, /NEWEBPAY/)
  assert.doesNotMatch(source, /LINE_PAY/)
  assert.doesNotMatch(source, /TradeInfo|TradeSha|HashKey|HashIV/)
})
