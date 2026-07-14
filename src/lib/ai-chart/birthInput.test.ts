import assert from 'node:assert/strict'
import type { ChartInput } from '@/features/ziwei-chart/package'
import {
  AI_CHART_BIRTH_INPUT_REQUEST_JSON_SCHEMA,
  AI_CHART_BIRTH_INPUT_VERSION,
  parseAiChartBirthInput,
  toZiweiChartEngineInput,
  type AiChartBirthInputIssueCode,
  type CanonicalAiChartBirthInput,
} from './birthInput'

const minimalInput = {
  solarDate: '1990-02-03',
  timeIndex: 6,
  gender: 'female',
} as const

function parseValid(value: unknown): CanonicalAiChartBirthInput {
  const result = parseAiChartBirthInput(value)
  assert.equal(result.ok, true)

  if (!result.ok) {
    assert.fail('expected valid input')
  }

  return result.value
}

function expectIssue(value: unknown, code: AiChartBirthInputIssueCode, field?: string) {
  const result = parseAiChartBirthInput(value)
  assert.equal(result.ok, false)

  if (result.ok) {
    assert.fail('expected invalid input')
  }

  assert.equal(result.error, 'invalid_ai_chart_birth_input')
  assert.equal(
    result.issues.some((issue) => issue.code === code && (field === undefined || issue.field === field)),
    true,
    `expected ${code}${field ? ` for ${field}` : ''}: ${JSON.stringify(result.issues)}`,
  )
}

const minimal = parseValid(minimalInput)
assert.deepEqual(minimal, {
  version: AI_CHART_BIRTH_INPUT_VERSION,
  solarDate: '1990-02-03',
  timeIndex: 6,
  gender: 'female',
  fixLeap: false,
})
assert.equal(minimal.version, 'ai-chart-birth-input/v1')
assert.equal(minimal.fixLeap, false)

const complete = parseValid({
  ...minimalInput,
  name: '  測試使用者  ',
  fixLeap: true,
})
assert.deepEqual(complete, {
  version: AI_CHART_BIRTH_INPUT_VERSION,
  solarDate: '1990-02-03',
  timeIndex: 6,
  gender: 'female',
  name: '測試使用者',
  fixLeap: true,
})

const withoutBlankName = parseValid({ ...minimalInput, name: '   ' })
assert.equal('name' in withoutBlankName, false)

for (const solarDate of ['1900-01-01', '2000-02-29', '2100-12-31']) {
  assert.equal(parseAiChartBirthInput({ ...minimalInput, solarDate }).ok, true, solarDate)
}

for (const solarDate of [
  '1990-2-3',
  '1990/02/03',
  '2026-02-29',
  '2026-13-01',
  '2026-04-31',
  '1899-12-31',
  '2101-01-01',
]) {
  expectIssue({ ...minimalInput, solarDate }, 'invalid_solar_date', 'solarDate')
}

for (const timeIndex of [-1, 13, 6.5, '6']) {
  expectIssue({ ...minimalInput, timeIndex }, 'invalid_time_index', 'timeIndex')
}

for (const gender of ['other', '', 1]) {
  expectIssue({ ...minimalInput, gender }, 'invalid_gender', 'gender')
}

for (const name of [123, {}, [], 'a'.repeat(81)]) {
  expectIssue({ ...minimalInput, name }, 'invalid_name', 'name')
}

for (const fixLeap of [0, 1, 'true', 'false', null]) {
  expectIssue({ ...minimalInput, fixLeap }, 'invalid_fix_leap', 'fixLeap')
}

for (const value of [null, undefined, 'input', 123, new Date(), new (class BirthInput {})()]) {
  expectIssue(value, 'not_object')
}
expectIssue([minimalInput], 'not_object')

const nullPrototypeInput = Object.assign(Object.create(null) as Record<string, unknown>, minimalInput)
assert.equal(parseAiChartBirthInput(nullPrototypeInput).ok, true)

expectIssue({ ...minimalInput, unexpected: true }, 'unexpected_field', 'unexpected')
expectIssue({ ...minimalInput, version: AI_CHART_BIRTH_INPUT_VERSION }, 'unexpected_field', 'version')

for (const field of ['userId', 'user_id', 'owner', 'ownerId', 'paid', 'success', 'paymentStatus']) {
  expectIssue({ ...minimalInput, [field]: 'client-controlled' }, 'unexpected_field', field)
}

for (const field of [
  'lunarDate',
  'palaces',
  'stars',
  'mutagens',
  'chartContext',
  'messages',
  'responseSchema',
  'reportContent',
  'prompt',
  'openAiResponse',
]) {
  expectIssue({ ...minimalInput, [field]: {} }, 'unexpected_field', field)
}

const originalInput = Object.freeze({
  ...minimalInput,
  name: '  不可修改  ',
  fixLeap: true,
})
const originalSnapshot = { ...originalInput }
parseValid(originalInput)
assert.deepEqual(originalInput, originalSnapshot)

const engineInput: ChartInput = toZiweiChartEngineInput(complete)
assert.deepEqual(engineInput, {
  solarDate: '1990-02-03',
  timeIndex: 6,
  gender: 'female',
  name: '測試使用者',
  fixLeap: true,
})
assert.equal('version' in engineInput, false)

const minimalEngineInput: ChartInput = toZiweiChartEngineInput(minimal)
assert.equal('name' in minimalEngineInput, false)
assert.deepEqual(Object.keys(minimalEngineInput).sort(), ['fixLeap', 'gender', 'solarDate', 'timeIndex'])

assert.equal(AI_CHART_BIRTH_INPUT_REQUEST_JSON_SCHEMA.type, 'object')
assert.equal(AI_CHART_BIRTH_INPUT_REQUEST_JSON_SCHEMA.additionalProperties, false)
assert.deepEqual(AI_CHART_BIRTH_INPUT_REQUEST_JSON_SCHEMA.required, ['solarDate', 'timeIndex', 'gender'])
assert.equal(
  AI_CHART_BIRTH_INPUT_REQUEST_JSON_SCHEMA.properties.solarDate.pattern,
  '^[0-9]{4}-[0-9]{2}-[0-9]{2}$',
)
assert.equal(AI_CHART_BIRTH_INPUT_REQUEST_JSON_SCHEMA.properties.timeIndex.type, 'integer')
assert.equal(AI_CHART_BIRTH_INPUT_REQUEST_JSON_SCHEMA.properties.timeIndex.minimum, 0)
assert.equal(AI_CHART_BIRTH_INPUT_REQUEST_JSON_SCHEMA.properties.timeIndex.maximum, 12)
assert.deepEqual(AI_CHART_BIRTH_INPUT_REQUEST_JSON_SCHEMA.properties.gender.enum, ['male', 'female'])
assert.equal(AI_CHART_BIRTH_INPUT_REQUEST_JSON_SCHEMA.properties.name.maxLength, 80)
assert.equal(AI_CHART_BIRTH_INPUT_REQUEST_JSON_SCHEMA.properties.fixLeap.type, 'boolean')
assert.deepEqual(
  JSON.parse(JSON.stringify(AI_CHART_BIRTH_INPUT_REQUEST_JSON_SCHEMA)),
  AI_CHART_BIRTH_INPUT_REQUEST_JSON_SCHEMA,
)

console.log('✓ AI chart birth input schema, parser, allowlist, and engine adapter')
