import assert from 'node:assert/strict'
import {
  AI_CHART_OPENAI_CONFIG_INVALID,
  AiChartOpenAiError,
  buildAiChartOpenAiResponsesBody,
  validateAiChartOpenAiStructuredRequest,
} from './openAiResponses'
import {
  AI_CHART_D1_CONTRACT_INVALID,
  AI_CHART_D1_P1_F1_CONTRACT_VERSION,
  AiChartD1ContractError,
} from './d1CommonContracts'
import {
  AI_CHART_D1_F1_OUTPUT_SCHEMA,
  AI_CHART_D1_F1_CANDIDATE_FIELDS,
  AI_CHART_D1_F1_COVERAGE_MATRIX_FIELDS,
  AI_CHART_D1_F1_MERGED_GROUP_FIELDS,
  AI_CHART_D1_F1_RESULT_FIELDS,
  AI_CHART_D1_F1_SCHEMA_NAME,
  AI_CHART_D1_P1_OUTPUT_SCHEMA,
  AI_CHART_D1_P1_COVERAGE_FIELDS,
  AI_CHART_D1_P1_PRIMARY_AXIS_FIELDS,
  AI_CHART_D1_P1_RESULT_FIELDS,
  AI_CHART_D1_P1_SCHEMA_NAME,
  parseAiChartD1F1Result,
  parseAiChartD1P1Result,
} from './d1P1F1Contracts'

type MutableRecord = Record<string, unknown>

const SYNTHETIC_MARKER = 'synthetic-private-contract-marker'

let testCount = 0

function test(name: string, run: () => void) {
  try {
    run()
    testCount += 1
    console.log(`✓ ${name}`)
  } catch (error) {
    console.error(`✗ ${name}`)
    throw error
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function asRecord(value: unknown): MutableRecord {
  assert.equal(typeof value, 'object')
  assert.notEqual(value, null)
  assert.equal(Array.isArray(value), false)
  return value as MutableRecord
}

function asArray(value: unknown): unknown[] {
  assert.equal(Array.isArray(value), true)
  return value as unknown[]
}

function candidateFixture(candidateId: string): MutableRecord {
  return {
    candidateId,
    statement: `Synthetic statement for ${candidateId}`,
    lifeExamples: [`Synthetic example for ${candidateId}`],
    scopes: ['personality'],
    palaceIds: ['palace.synthetic.1'],
    starBasis: ['Synthetic star basis'],
    structureBasis: ['本宮'],
    usedRuleIds: ['rule.synthetic.1'],
    ruleStatus: 'teacher_confirmed',
    intensity: 'normal',
    conflictGroupId: null,
    d2Boundary: null,
  }
}

function boundaryFixture(boundaryId = 'boundary.synthetic.1'): MutableRecord {
  return {
    boundaryId,
    topic: 'Synthetic boundary topic',
    prohibitedD1Conclusion: 'Synthetic prohibited conclusion',
    allowedD1Wording: 'Synthetic allowed wording',
    reason: 'Synthetic boundary reason',
  }
}

function p1Fixture(): MutableRecord {
  return {
    contractVersion: AI_CHART_D1_P1_F1_CONTRACT_VERSION,
    task: 'P1',
    callId: 'call.synthetic.p1',
    chartId: 'chart.synthetic.1',
    palaceId: 'palace.synthetic.1',
    palace: '命宮',
    status: 'complete',
    primaryAxis: {
      statement: 'Synthetic primary axis',
      majorStarCore: ['Synthetic major star core'],
      doubleStarCore: null,
      borrowedStarMode: 'none',
      usedRuleIds: ['rule.synthetic.primary'],
    },
    directCandidates: [candidateFixture('candidate.synthetic.p1.direct')],
    oppositeInfluences: [
      candidateFixture('candidate.synthetic.p1.opposite'),
    ],
    hiddenCombinationInfluences: [],
    trineInfluences: [],
    combinedCandidates: [],
    tensions: [
      {
        tensionId: 'tension.synthetic.p1',
        sideA: 'Synthetic side A',
        sideB: 'Synthetic side B',
        coexistenceExplanation: 'Synthetic coexistence explanation',
        candidateIds: [
          'candidate.synthetic.p1.direct',
          'candidate.synthetic.p1.opposite',
        ],
      },
    ],
    strengths: [],
    imbalancePossibilities: [],
    coverage: {
      directMeaningsConsidered: ['Synthetic direct meaning'],
      majorStarsCovered: ['Synthetic major star'],
      minorStarsCovered: ['Synthetic minor star'],
      mutagensCovered: ['Synthetic mutagen'],
      maleficsCovered: ['Synthetic malefic'],
      noblesCovered: ['Synthetic noble'],
      oppositeProcessed: true,
      hiddenCombinationProcessed: true,
      trinesProcessed: true,
      omittedItems: [
        {
          item: 'Synthetic omitted item',
          reason: 'Synthetic omission reason',
        },
      ],
    },
    d2Boundaries: [boundaryFixture()],
    warnings: ['Synthetic warning'],
  }
}

function f1CandidateFixture(
  candidateId = 'candidate.synthetic.f1',
  sourceMeaningId = 'meaning.synthetic.source.1',
  destinationMeaningId = 'meaning.synthetic.destination.1',
): MutableRecord {
  return {
    ...candidateFixture(candidateId),
    sourceMeaningId,
    destinationMeaningId,
    bridgeMechanism: 'Synthetic bridge mechanism',
    sourceBehavior: 'Synthetic source behavior',
    destinationEffect: 'Synthetic destination effect',
  }
}

function f1Fixture(): MutableRecord {
  return {
    contractVersion: AI_CHART_D1_P1_F1_CONTRACT_VERSION,
    task: 'F1',
    callId: 'call.synthetic.f1',
    chartId: 'chart.synthetic.1',
    flyingTransformId: 'flying.synthetic.1',
    status: 'complete',
    sourceSummary: 'Synthetic source summary',
    destinationSummary: 'Synthetic destination summary',
    transformationCore: 'Synthetic transformation core',
    candidates: [f1CandidateFixture()],
    coverageMatrix: [
      {
        sourceMeaningId: 'meaning.synthetic.source.1',
        destinationMeaningId: 'meaning.synthetic.destination.1',
        status: 'candidate_created',
        candidateId: 'candidate.synthetic.f1',
        mergedIntoCandidateId: null,
        exclusionReason: null,
      },
    ],
    mergedCandidateGroups: [
      {
        retainedCandidateId: 'candidate.synthetic.f1',
        mergedCandidateIds: ['candidate.synthetic.merged.1'],
        reason: 'Synthetic merge reason',
      },
    ],
    d2Boundaries: [boundaryFixture()],
    warnings: ['Synthetic warning'],
  }
}

function expectContractInvalid(
  run: () => unknown,
  markers: readonly string[] = [],
) {
  try {
    run()
    assert.fail('expected D1 contract invalid')
  } catch (error) {
    assert.equal(error instanceof AiChartD1ContractError, true)
    if (!(error instanceof AiChartD1ContractError)) {
      assert.fail('expected AiChartD1ContractError')
    }
    assert.equal(error.message, AI_CHART_D1_CONTRACT_INVALID)
    assert.equal(error.code, AI_CHART_D1_CONTRACT_INVALID)
    for (const marker of markers) {
      assert.equal(error.message.includes(marker), false)
    }
  }
}

function expectAdapterValid(
  schemaName: string,
  schema: Record<string, unknown>,
  parseResult: (value: unknown) => unknown,
) {
  const request = {
    instructions: 'Synthetic contract instructions',
    userInput: 'Synthetic contract input',
    schemaName,
    schema,
    parseResult,
  }
  const validated = validateAiChartOpenAiStructuredRequest(request)
  assert.equal(validated.schemaName, schemaName)
  return buildAiChartOpenAiResponsesBody(request)
}

function visitSchema(
  value: unknown,
  visitor: (schema: MutableRecord) => void,
  visited = new Set<object>(),
) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return
  }
  if (visited.has(value)) return
  visited.add(value)

  const schema = value as MutableRecord
  visitor(schema)
  if (schema.type === 'object') {
    const properties = asRecord(schema.properties)
    for (const child of Object.values(properties)) {
      visitSchema(child, visitor, visited)
    }
  } else if (schema.type === 'array') {
    visitSchema(schema.items, visitor, visited)
  }
}

function assertRecursivelyStrict(schema: Record<string, unknown>) {
  let objectCount = 0
  visitSchema(schema, (node) => {
    if (node.type !== 'object') return
    objectCount += 1
    assert.equal(node.additionalProperties, false)
    const properties = asRecord(node.properties)
    const required = asArray(node.required)
    assert.deepEqual(
      [...required].sort(),
      Object.keys(properties).sort(),
    )
  })
  assert.ok(objectCount > 1)
}

function assertDeeplyFrozen(value: unknown, visited = new Set<object>()) {
  if (typeof value !== 'object' || value === null || visited.has(value)) return
  visited.add(value)
  assert.equal(Object.isFrozen(value), true)
  for (const child of Object.values(value)) {
    assertDeeplyFrozen(child, visited)
  }
}

test('P1 root schema is strict', () => {
  assert.equal(AI_CHART_D1_P1_OUTPUT_SCHEMA.type, 'object')
  assert.equal(AI_CHART_D1_P1_OUTPUT_SCHEMA.additionalProperties, false)
})

test('F1 root schema is strict', () => {
  assert.equal(AI_CHART_D1_F1_OUTPUT_SCHEMA.type, 'object')
  assert.equal(AI_CHART_D1_F1_OUTPUT_SCHEMA.additionalProperties, false)
})

test('P1 nested object schemas are recursively strict', () => {
  assertRecursivelyStrict(AI_CHART_D1_P1_OUTPUT_SCHEMA)
})

test('F1 nested object schemas are recursively strict', () => {
  assertRecursivelyStrict(AI_CHART_D1_F1_OUTPUT_SCHEMA)
})

test('P1 required fields match formal result fields', () => {
  const properties = asRecord(AI_CHART_D1_P1_OUTPUT_SCHEMA.properties)
  const required = asArray(AI_CHART_D1_P1_OUTPUT_SCHEMA.required)
  assert.deepEqual(Object.keys(properties), [...AI_CHART_D1_P1_RESULT_FIELDS])
  assert.deepEqual(required, [...AI_CHART_D1_P1_RESULT_FIELDS])
})

test('F1 required fields match formal result fields', () => {
  const properties = asRecord(AI_CHART_D1_F1_OUTPUT_SCHEMA.properties)
  const required = asArray(AI_CHART_D1_F1_OUTPUT_SCHEMA.required)
  assert.deepEqual(Object.keys(properties), [...AI_CHART_D1_F1_RESULT_FIELDS])
  assert.deepEqual(required, [...AI_CHART_D1_F1_RESULT_FIELDS])
})

test('P1 nested schema fields match formal field lists', () => {
  const properties = asRecord(AI_CHART_D1_P1_OUTPUT_SCHEMA.properties)
  const primaryAxis = asRecord(properties.primaryAxis)
  const coverage = asRecord(properties.coverage)
  assert.deepEqual(Object.keys(asRecord(primaryAxis.properties)), [
    ...AI_CHART_D1_P1_PRIMARY_AXIS_FIELDS,
  ])
  assert.deepEqual(Object.keys(asRecord(coverage.properties)), [
    ...AI_CHART_D1_P1_COVERAGE_FIELDS,
  ])
})

test('F1 nested schema fields match formal field lists', () => {
  const properties = asRecord(AI_CHART_D1_F1_OUTPUT_SCHEMA.properties)
  const candidates = asRecord(properties.candidates)
  const matrix = asRecord(properties.coverageMatrix)
  const groups = asRecord(properties.mergedCandidateGroups)
  assert.deepEqual(Object.keys(asRecord(asRecord(candidates.items).properties)), [
    ...AI_CHART_D1_F1_CANDIDATE_FIELDS,
  ])
  assert.deepEqual(Object.keys(asRecord(asRecord(matrix.items).properties)), [
    ...AI_CHART_D1_F1_COVERAGE_MATRIX_FIELDS,
  ])
  assert.deepEqual(Object.keys(asRecord(asRecord(groups.items).properties)), [
    ...AI_CHART_D1_F1_MERGED_GROUP_FIELDS,
  ])
})

test('P1 nullable fields remain required string-null unions', () => {
  const properties = asRecord(AI_CHART_D1_P1_OUTPUT_SCHEMA.properties)
  const primaryAxis = asRecord(properties.primaryAxis)
  const primaryProperties = asRecord(primaryAxis.properties)
  const primaryRequired = asArray(primaryAxis.required)
  const nullable = asRecord(primaryProperties.doubleStarCore)
  assert.equal(primaryRequired.includes('doubleStarCore'), true)
  assert.deepEqual(nullable.type, ['string', 'null'])
  assert.equal(nullable.minLength, 1)
})

test('F1 nullable fields remain required string-null unions', () => {
  const properties = asRecord(AI_CHART_D1_F1_OUTPUT_SCHEMA.properties)
  const matrixArray = asRecord(properties.coverageMatrix)
  const matrixItem = asRecord(matrixArray.items)
  const matrixProperties = asRecord(matrixItem.properties)
  const matrixRequired = asArray(matrixItem.required)
  for (const field of [
    'candidateId',
    'mergedIntoCandidateId',
    'exclusionReason',
  ]) {
    assert.equal(matrixRequired.includes(field), true)
    assert.deepEqual(asRecord(matrixProperties[field]).type, [
      'string',
      'null',
    ])
    assert.equal(asRecord(matrixProperties[field]).minLength, 1)
  }
})

test('P1 tension schema requires at least two candidate IDs', () => {
  const properties = asRecord(AI_CHART_D1_P1_OUTPUT_SCHEMA.properties)
  const tensions = asRecord(properties.tensions)
  const tensionProperties = asRecord(asRecord(tensions.items).properties)
  const candidateIds = asRecord(tensionProperties.candidateIds)
  assert.equal(candidateIds.minItems, 2)
})

test('P1 schema name is versioned and exact', () => {
  assert.equal(AI_CHART_D1_P1_SCHEMA_NAME, 'ai_chart_d1_p1_v1')
})

test('F1 schema name is versioned and exact', () => {
  assert.equal(AI_CHART_D1_F1_SCHEMA_NAME, 'ai_chart_d1_f1_v1')
})

test('P1 schema can be safely JSON serialized', () => {
  const serialized = JSON.stringify(AI_CHART_D1_P1_OUTPUT_SCHEMA)
  assert.equal(serialized.includes(AI_CHART_D1_P1_SCHEMA_NAME), false)
  assert.ok(serialized.length > 100)
})

test('F1 schema can be safely JSON serialized', () => {
  const serialized = JSON.stringify(AI_CHART_D1_F1_OUTPUT_SCHEMA)
  assert.equal(serialized.includes('$ref'), false)
  assert.ok(serialized.length > 100)
})

test('P1 schema is deeply frozen', () => {
  assertDeeplyFrozen(AI_CHART_D1_P1_OUTPUT_SCHEMA)
})

test('F1 schema is deeply frozen', () => {
  assertDeeplyFrozen(AI_CHART_D1_F1_OUTPUT_SCHEMA)
})

test('OpenAI Adapter accepts P1 schema', () => {
  expectAdapterValid(
    AI_CHART_D1_P1_SCHEMA_NAME,
    AI_CHART_D1_P1_OUTPUT_SCHEMA,
    parseAiChartD1P1Result,
  )
})

test('OpenAI Adapter accepts F1 schema', () => {
  expectAdapterValid(
    AI_CHART_D1_F1_SCHEMA_NAME,
    AI_CHART_D1_F1_OUTPUT_SCHEMA,
    parseAiChartD1F1Result,
  )
})

test('OpenAI Adapter body preserves store false', () => {
  const body = expectAdapterValid(
    AI_CHART_D1_P1_SCHEMA_NAME,
    AI_CHART_D1_P1_OUTPUT_SCHEMA,
    parseAiChartD1P1Result,
  )
  assert.equal(body.store, false)
})

test('OpenAI Adapter body preserves strict true', () => {
  const body = expectAdapterValid(
    AI_CHART_D1_F1_SCHEMA_NAME,
    AI_CHART_D1_F1_OUTPUT_SCHEMA,
    parseAiChartD1F1Result,
  )
  assert.equal(body.text.format.strict, true)
})

test('schema excludes forbidden descriptive and secret-bearing keywords', () => {
  const serialized = JSON.stringify([
    AI_CHART_D1_P1_OUTPUT_SCHEMA,
    AI_CHART_D1_F1_OUTPUT_SCHEMA,
  ])
  for (const forbidden of [
    '"default"',
    '"examples"',
    '"title"',
    '"$comment"',
    '"$ref"',
    'apiKey',
    'birthDate',
    '姓名',
    'Prompt',
  ]) {
    assert.equal(serialized.includes(forbidden), false)
  }
})

test('legal P1 fixture is accepted', () => {
  const parsed = parseAiChartD1P1Result(p1Fixture())
  assert.equal(parsed.task, 'P1')
  assert.equal(parsed.directCandidates.length, 1)
})

test('P1 rejects wrong contract version', () => {
  const fixture = p1Fixture()
  fixture.contractVersion = 'ai-chart-d1-p1-f1/v2'
  expectContractInvalid(() => parseAiChartD1P1Result(fixture))
})

test('P1 rejects wrong task', () => {
  const fixture = p1Fixture()
  fixture.task = 'F1'
  expectContractInvalid(() => parseAiChartD1P1Result(fixture))
})

test('P1 rejects unknown palace', () => {
  const fixture = p1Fixture()
  fixture.palace = '未知宮'
  expectContractInvalid(() => parseAiChartD1P1Result(fixture))
})

test('P1 accepts explicit null double star core', () => {
  const parsed = parseAiChartD1P1Result(p1Fixture())
  assert.equal(parsed.primaryAxis.doubleStarCore, null)
})

test('P1 rejects missing double star core', () => {
  const fixture = p1Fixture()
  delete asRecord(fixture.primaryAxis).doubleStarCore
  expectContractInvalid(() => parseAiChartD1P1Result(fixture))
})

test('P1 rejects unknown borrowed star mode', () => {
  const fixture = p1Fixture()
  asRecord(fixture.primaryAxis).borrowedStarMode = 'unknown_mode'
  expectContractInvalid(() => parseAiChartD1P1Result(fixture))
})

test('P1 rejects duplicate candidate ID across collections', () => {
  const fixture = p1Fixture()
  fixture.strengths = [
    candidateFixture('candidate.synthetic.p1.direct'),
  ]
  expectContractInvalid(() => parseAiChartD1P1Result(fixture))
})

test('P1 rejects duplicate tension ID', () => {
  const fixture = p1Fixture()
  const tensions = asArray(fixture.tensions)
  tensions.push(clone(tensions[0]))
  expectContractInvalid(() => parseAiChartD1P1Result(fixture))
})

test('P1 rejects tension reference to missing candidate', () => {
  const fixture = p1Fixture()
  asRecord(asArray(fixture.tensions)[0]).candidateIds = [
    'candidate.synthetic.p1.direct',
    'candidate.synthetic.missing',
  ]
  expectContractInvalid(() => parseAiChartD1P1Result(fixture))
})

test('P1 rejects tension with fewer than two candidate IDs', () => {
  const fixture = p1Fixture()
  asRecord(asArray(fixture.tensions)[0]).candidateIds = [
    'candidate.synthetic.p1.direct',
  ]
  expectContractInvalid(() => parseAiChartD1P1Result(fixture))
})

test('P1 rejects duplicate boundary ID', () => {
  const fixture = p1Fixture()
  asArray(fixture.d2Boundaries).push(boundaryFixture())
  expectContractInvalid(() => parseAiChartD1P1Result(fixture))
})

test('P1 rejects coverage missing a required field', () => {
  const fixture = p1Fixture()
  delete asRecord(fixture.coverage).noblesCovered
  expectContractInvalid(() => parseAiChartD1P1Result(fixture))
})

test('P1 rejects unknown coverage field', () => {
  const fixture = p1Fixture()
  asRecord(fixture.coverage).unknownCoverage = 'synthetic'
  expectContractInvalid(() => parseAiChartD1P1Result(fixture))
})

test('P1 rejects duplicate coverage item', () => {
  const fixture = p1Fixture()
  asRecord(fixture.coverage).majorStarsCovered = [
    'Synthetic major star',
    'Synthetic major star',
  ]
  expectContractInvalid(() => parseAiChartD1P1Result(fixture))
})

test('P1 rejects duplicate omitted item name', () => {
  const fixture = p1Fixture()
  asArray(asRecord(fixture.coverage).omittedItems).push({
    item: 'Synthetic omitted item',
    reason: 'Another synthetic reason',
  })
  expectContractInvalid(() => parseAiChartD1P1Result(fixture))
})

test('P1 rejects unknown top-level key', () => {
  const fixture = p1Fixture()
  fixture.unknownTopLevel = SYNTHETIC_MARKER
  expectContractInvalid(
    () => parseAiChartD1P1Result(fixture),
    [SYNTHETIC_MARKER],
  )
})

test('P1 result is deeply frozen', () => {
  const parsed = parseAiChartD1P1Result(p1Fixture())
  assert.equal(Object.isFrozen(parsed), true)
  assert.equal(Object.isFrozen(parsed.primaryAxis), true)
  assert.equal(Object.isFrozen(parsed.directCandidates), true)
  assert.equal(Object.isFrozen(parsed.directCandidates[0].lifeExamples), true)
})

test('P1 fixed error excludes synthetic marker', () => {
  const fixture = p1Fixture()
  fixture.callId = `${SYNTHETIC_MARKER} invalid`
  expectContractInvalid(
    () => parseAiChartD1P1Result(fixture),
    [SYNTHETIC_MARKER],
  )
})

test('P1 rejects duplicate warnings', () => {
  const fixture = p1Fixture()
  fixture.warnings = ['Synthetic warning', 'Synthetic warning']
  expectContractInvalid(() => parseAiChartD1P1Result(fixture))
})

test('legal F1 fixture is accepted', () => {
  const parsed = parseAiChartD1F1Result(f1Fixture())
  assert.equal(parsed.task, 'F1')
  assert.equal(parsed.coverageMatrix[0].status, 'candidate_created')
})

test('F1 rejects wrong contract version', () => {
  const fixture = f1Fixture()
  fixture.contractVersion = 'ai-chart-d1-p1-f1/v2'
  expectContractInvalid(() => parseAiChartD1F1Result(fixture))
})

test('F1 rejects wrong task', () => {
  const fixture = f1Fixture()
  fixture.task = 'P1'
  expectContractInvalid(() => parseAiChartD1F1Result(fixture))
})

test('F1 rejects duplicate candidate ID', () => {
  const fixture = f1Fixture()
  asArray(fixture.candidates).push(
    f1CandidateFixture(
      'candidate.synthetic.f1',
      'meaning.synthetic.source.2',
      'meaning.synthetic.destination.2',
    ),
  )
  expectContractInvalid(() => parseAiChartD1F1Result(fixture))
})

test('F1 rejects duplicate coverage matrix pair', () => {
  const fixture = f1Fixture()
  asArray(fixture.coverageMatrix).push({
    sourceMeaningId: 'meaning.synthetic.source.1',
    destinationMeaningId: 'meaning.synthetic.destination.1',
    status: 'excluded',
    candidateId: null,
    mergedIntoCandidateId: null,
    exclusionReason: 'Synthetic exclusion',
  })
  expectContractInvalid(() => parseAiChartD1F1Result(fixture))
})

test('F1 candidate-created rejects null candidate ID', () => {
  const fixture = f1Fixture()
  asRecord(asArray(fixture.coverageMatrix)[0]).candidateId = null
  expectContractInvalid(() => parseAiChartD1F1Result(fixture))
})

test('F1 candidate-created rejects missing candidate reference', () => {
  const fixture = f1Fixture()
  asRecord(asArray(fixture.coverageMatrix)[0]).candidateId =
    'candidate.synthetic.missing'
  expectContractInvalid(() => parseAiChartD1F1Result(fixture))
})

test('F1 candidate-created rejects merged-into value', () => {
  const fixture = f1Fixture()
  asRecord(asArray(fixture.coverageMatrix)[0]).mergedIntoCandidateId =
    'candidate.synthetic.f1'
  expectContractInvalid(() => parseAiChartD1F1Result(fixture))
})

test('F1 candidate-created rejects exclusion reason', () => {
  const fixture = f1Fixture()
  asRecord(asArray(fixture.coverageMatrix)[0]).exclusionReason =
    'Synthetic exclusion'
  expectContractInvalid(() => parseAiChartD1F1Result(fixture))
})

test('F1 merged status rejects null merged-into ID', () => {
  const fixture = f1Fixture()
  const matrix = asRecord(asArray(fixture.coverageMatrix)[0])
  matrix.status = 'merged'
  matrix.candidateId = null
  expectContractInvalid(() => parseAiChartD1F1Result(fixture))
})

test('F1 merged status rejects missing final candidate reference', () => {
  const fixture = f1Fixture()
  const matrix = asRecord(asArray(fixture.coverageMatrix)[0])
  matrix.status = 'merged'
  matrix.candidateId = null
  matrix.mergedIntoCandidateId = 'candidate.synthetic.missing'
  expectContractInvalid(() => parseAiChartD1F1Result(fixture))
})

test('F1 merged status rejects candidate ID value', () => {
  const fixture = f1Fixture()
  const matrix = asRecord(asArray(fixture.coverageMatrix)[0])
  matrix.status = 'merged'
  matrix.mergedIntoCandidateId = 'candidate.synthetic.f1'
  expectContractInvalid(() => parseAiChartD1F1Result(fixture))
})

test('F1 merged status accepts a valid reference combination', () => {
  const fixture = f1Fixture()
  const matrix = asRecord(asArray(fixture.coverageMatrix)[0])
  matrix.status = 'merged'
  matrix.candidateId = null
  matrix.mergedIntoCandidateId = 'candidate.synthetic.f1'
  const parsed = parseAiChartD1F1Result(fixture)
  assert.equal(parsed.coverageMatrix[0].status, 'merged')
})

test('F1 excluded status rejects missing exclusion reason', () => {
  const fixture = f1Fixture()
  const matrix = asRecord(asArray(fixture.coverageMatrix)[0])
  matrix.status = 'excluded'
  matrix.candidateId = null
  expectContractInvalid(() => parseAiChartD1F1Result(fixture))
})

test('F1 excluded status rejects candidate ID value', () => {
  const fixture = f1Fixture()
  const matrix = asRecord(asArray(fixture.coverageMatrix)[0])
  matrix.status = 'excluded'
  matrix.exclusionReason = 'Synthetic exclusion'
  expectContractInvalid(() => parseAiChartD1F1Result(fixture))
})

test('F1 excluded status rejects merged-into value', () => {
  const fixture = f1Fixture()
  const matrix = asRecord(asArray(fixture.coverageMatrix)[0])
  matrix.status = 'excluded'
  matrix.candidateId = null
  matrix.mergedIntoCandidateId = 'candidate.synthetic.f1'
  matrix.exclusionReason = 'Synthetic exclusion'
  expectContractInvalid(() => parseAiChartD1F1Result(fixture))
})

test('F1 rejects final candidate without matrix reference', () => {
  const fixture = f1Fixture()
  asArray(fixture.candidates).push(
    f1CandidateFixture(
      'candidate.synthetic.f1.unreferenced',
      'meaning.synthetic.source.2',
      'meaning.synthetic.destination.2',
    ),
  )
  expectContractInvalid(() => parseAiChartD1F1Result(fixture))
})

test('F1 rejects retained candidate that does not exist', () => {
  const fixture = f1Fixture()
  asRecord(asArray(fixture.mergedCandidateGroups)[0]).retainedCandidateId =
    'candidate.synthetic.missing'
  expectContractInvalid(() => parseAiChartD1F1Result(fixture))
})

test('F1 rejects empty merged candidate IDs', () => {
  const fixture = f1Fixture()
  asRecord(asArray(fixture.mergedCandidateGroups)[0]).mergedCandidateIds = []
  expectContractInvalid(() => parseAiChartD1F1Result(fixture))
})

test('F1 rejects duplicate IDs inside merged candidate group', () => {
  const fixture = f1Fixture()
  asRecord(asArray(fixture.mergedCandidateGroups)[0]).mergedCandidateIds = [
    'candidate.synthetic.merged.1',
    'candidate.synthetic.merged.1',
  ]
  expectContractInvalid(() => parseAiChartD1F1Result(fixture))
})

test('F1 rejects retained ID inside merged candidate IDs', () => {
  const fixture = f1Fixture()
  asRecord(asArray(fixture.mergedCandidateGroups)[0]).mergedCandidateIds = [
    'candidate.synthetic.f1',
  ]
  expectContractInvalid(() => parseAiChartD1F1Result(fixture))
})

test('F1 rejects same merged ID across groups', () => {
  const fixture = f1Fixture()
  asArray(fixture.mergedCandidateGroups).push({
    retainedCandidateId: 'candidate.synthetic.f1',
    mergedCandidateIds: ['candidate.synthetic.merged.1'],
    reason: 'Another synthetic merge reason',
  })
  expectContractInvalid(() => parseAiChartD1F1Result(fixture))
})

test('F1 rejects duplicate boundary ID', () => {
  const fixture = f1Fixture()
  asArray(fixture.d2Boundaries).push(boundaryFixture())
  expectContractInvalid(() => parseAiChartD1F1Result(fixture))
})

test('F1 rejects unknown matrix status', () => {
  const fixture = f1Fixture()
  asRecord(asArray(fixture.coverageMatrix)[0]).status = 'unknown_status'
  expectContractInvalid(() => parseAiChartD1F1Result(fixture))
})

test('F1 rejects unknown top-level key', () => {
  const fixture = f1Fixture()
  fixture.unknownTopLevel = SYNTHETIC_MARKER
  expectContractInvalid(
    () => parseAiChartD1F1Result(fixture),
    [SYNTHETIC_MARKER],
  )
})

test('F1 result is deeply frozen', () => {
  const parsed = parseAiChartD1F1Result(f1Fixture())
  assert.equal(Object.isFrozen(parsed), true)
  assert.equal(Object.isFrozen(parsed.candidates), true)
  assert.equal(Object.isFrozen(parsed.candidates[0]), true)
  assert.equal(Object.isFrozen(parsed.coverageMatrix), true)
})

test('F1 fixed error excludes synthetic marker', () => {
  const fixture = f1Fixture()
  fixture.flyingTransformId = `${SYNTHETIC_MARKER} invalid`
  expectContractInvalid(
    () => parseAiChartD1F1Result(fixture),
    [SYNTHETIC_MARKER],
  )
})

test('F1 rejects malformed unknown candidate key', () => {
  const fixture = f1Fixture()
  asRecord(asArray(fixture.candidates)[0]).unknownCandidateField =
    SYNTHETIC_MARKER
  expectContractInvalid(
    () => parseAiChartD1F1Result(fixture),
    [SYNTHETIC_MARKER],
  )
})

test('F1 schema contract version and task are single-value enums', () => {
  const properties = asRecord(AI_CHART_D1_F1_OUTPUT_SCHEMA.properties)
  assert.deepEqual(asRecord(properties.contractVersion).enum, [
    AI_CHART_D1_P1_F1_CONTRACT_VERSION,
  ])
  assert.deepEqual(asRecord(properties.task).enum, ['F1'])
})

test('P1 schema contract version and task are single-value enums', () => {
  const properties = asRecord(AI_CHART_D1_P1_OUTPUT_SCHEMA.properties)
  assert.deepEqual(asRecord(properties.contractVersion).enum, [
    AI_CHART_D1_P1_F1_CONTRACT_VERSION,
  ])
  assert.deepEqual(asRecord(properties.task).enum, ['P1'])
})

test('Adapter rejects a deliberately non-strict schema control', () => {
  try {
    validateAiChartOpenAiStructuredRequest({
      instructions: 'Synthetic instructions',
      userInput: 'Synthetic input',
      schemaName: 'synthetic_non_strict_schema',
      schema: {
        type: 'object',
        additionalProperties: true,
        required: [],
        properties: {},
      },
      parseResult: (value) => value,
    })
    assert.fail('expected adapter config invalid')
  } catch (error) {
    assert.equal(error instanceof AiChartOpenAiError, true)
    if (!(error instanceof AiChartOpenAiError)) {
      assert.fail('expected AiChartOpenAiError')
    }
    assert.equal(error.code, AI_CHART_OPENAI_CONFIG_INVALID)
  }
})

assert.ok(testCount >= 50)
console.log(`P1/F1 contract tests passed: ${testCount}`)
