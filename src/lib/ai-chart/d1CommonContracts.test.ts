import assert from 'node:assert/strict'
import {
  AI_CHART_D1_CONTRACT_INVALID,
  AI_CHART_D1_CANDIDATE_FIELDS,
  AI_CHART_D1_CANDIDATE_SCHEMA,
  AI_CHART_D1_D2_BOUNDARY_FIELDS,
  AI_CHART_D1_D2_BOUNDARY_SCHEMA,
  AI_CHART_D1_INTENSITIES,
  AI_CHART_D1_MAX_TEXT_LENGTH,
  AI_CHART_D1_PALACE_NAMES,
  AI_CHART_D1_RESULT_STATUSES,
  AI_CHART_D1_RULE_STATUSES,
  AI_CHART_D1_SCOPES,
  AI_CHART_D1_STRUCTURE_BASES,
  AI_CHART_D1_TRAIT_TENSION_FIELDS,
  AI_CHART_D1_TRAIT_TENSION_SCHEMA,
  AiChartD1ContractError,
  parseAiChartD1Candidate,
  parseAiChartD1D2Boundary,
  parseAiChartD1Enum,
  parseAiChartD1TraitTension,
} from './d1CommonContracts'

type MutableRecord = Record<string, unknown>

const SYNTHETIC_MARKER = 'synthetic-private-candidate-marker'

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

function candidateFixture(): MutableRecord {
  return {
    candidateId: 'candidate.synthetic.1',
    statement: 'Synthetic candidate statement',
    lifeExamples: ['Synthetic life example'],
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

function boundaryFixture(): MutableRecord {
  return {
    boundaryId: 'boundary.synthetic.1',
    topic: 'Synthetic boundary topic',
    prohibitedD1Conclusion: 'Synthetic prohibited conclusion',
    allowedD1Wording: 'Synthetic allowed wording',
    reason: 'Synthetic boundary reason',
  }
}

function tensionFixture(): MutableRecord {
  return {
    tensionId: 'tension.synthetic.1',
    sideA: 'Synthetic side A',
    sideB: 'Synthetic side B',
    coexistenceExplanation: 'Synthetic coexistence explanation',
    candidateIds: ['candidate.synthetic.1', 'candidate.synthetic.2'],
  }
}

function expectInvalid(run: () => unknown, markers: readonly string[] = []) {
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

test('palace enum contains all twelve unique palaces', () => {
  assert.equal(AI_CHART_D1_PALACE_NAMES.length, 12)
  assert.equal(new Set(AI_CHART_D1_PALACE_NAMES).size, 12)
  assert.deepEqual(AI_CHART_D1_PALACE_NAMES, [
    '命宮',
    '父母宮',
    '福德宮',
    '田宅宮',
    '官祿宮',
    '僕役宮',
    '遷移宮',
    '疾厄宮',
    '財帛宮',
    '子女宮',
    '夫妻宮',
    '兄弟宮',
  ])
})

test('rule status enum contains every legal value', () => {
  assert.deepEqual(AI_CHART_D1_RULE_STATUSES, [
    'teacher_confirmed',
    'lecture_backfill',
    'working_inference',
  ])
  assert.equal(new Set(AI_CHART_D1_RULE_STATUSES).size, 3)
})

test('result status enum contains every legal value', () => {
  assert.deepEqual(AI_CHART_D1_RESULT_STATUSES, [
    'complete',
    'partial',
    'incomplete',
    'invalid',
  ])
  assert.equal(new Set(AI_CHART_D1_RESULT_STATUSES).size, 4)
})

test('scope enum contains every legal value', () => {
  assert.deepEqual(AI_CHART_D1_SCOPES, [
    'personality',
    'values',
    'thinking',
    'behavior',
    'relationship_pattern',
    'work_pattern',
    'money_pattern',
    'family_pattern',
    'health_habit',
    'long_term_need',
  ])
  assert.equal(new Set(AI_CHART_D1_SCOPES).size, 10)
})

test('structure basis enum contains every legal value', () => {
  assert.deepEqual(AI_CHART_D1_STRUCTURE_BASES, [
    '本宮',
    '對宮',
    '暗合',
    '三方',
    '空宮借星',
    '生年四化',
    '飛化',
    '煞忌',
    '輔星',
    '身宮',
  ])
  assert.equal(new Set(AI_CHART_D1_STRUCTURE_BASES).size, 10)
})

test('intensity enum contains every legal value', () => {
  assert.deepEqual(AI_CHART_D1_INTENSITIES, [
    'background',
    'normal',
    'strong',
  ])
  assert.equal(new Set(AI_CHART_D1_INTENSITIES).size, 3)
})

test('candidate schema fields match the formal candidate field list', () => {
  const properties = AI_CHART_D1_CANDIDATE_SCHEMA.properties as MutableRecord
  assert.deepEqual(Object.keys(properties), [...AI_CHART_D1_CANDIDATE_FIELDS])
  assert.deepEqual(AI_CHART_D1_CANDIDATE_SCHEMA.required, [
    ...AI_CHART_D1_CANDIDATE_FIELDS,
  ])
})

test('boundary schema fields match the formal boundary field list', () => {
  const properties = AI_CHART_D1_D2_BOUNDARY_SCHEMA.properties as MutableRecord
  assert.deepEqual(Object.keys(properties), [
    ...AI_CHART_D1_D2_BOUNDARY_FIELDS,
  ])
  assert.deepEqual(AI_CHART_D1_D2_BOUNDARY_SCHEMA.required, [
    ...AI_CHART_D1_D2_BOUNDARY_FIELDS,
  ])
})

test('tension schema fields match the formal tension field list', () => {
  const properties = AI_CHART_D1_TRAIT_TENSION_SCHEMA
    .properties as MutableRecord
  assert.deepEqual(Object.keys(properties), [
    ...AI_CHART_D1_TRAIT_TENSION_FIELDS,
  ])
  assert.deepEqual(AI_CHART_D1_TRAIT_TENSION_SCHEMA.required, [
    ...AI_CHART_D1_TRAIT_TENSION_FIELDS,
  ])
})

test('legal candidate is accepted without rewriting text', () => {
  const fixture = candidateFixture()
  fixture.statement = '  Preserve surrounding spaces  '
  const parsed = parseAiChartD1Candidate(fixture)
  assert.equal(parsed.statement, '  Preserve surrounding spaces  ')
})

test('unknown palace enum is rejected', () => {
  expectInvalid(() =>
    parseAiChartD1Enum('未知宮', AI_CHART_D1_PALACE_NAMES),
  )
})

test('unknown rule status is rejected', () => {
  const fixture = candidateFixture()
  fixture.ruleStatus = 'unknown_rule_status'
  expectInvalid(() => parseAiChartD1Candidate(fixture))
})

test('unknown scope is rejected', () => {
  const fixture = candidateFixture()
  fixture.scopes = ['unknown_scope']
  expectInvalid(() => parseAiChartD1Candidate(fixture))
})

test('unknown structure basis is rejected', () => {
  const fixture = candidateFixture()
  fixture.structureBasis = ['unknown_structure']
  expectInvalid(() => parseAiChartD1Candidate(fixture))
})

test('unknown intensity is rejected', () => {
  const fixture = candidateFixture()
  fixture.intensity = 'unknown_intensity'
  expectInvalid(() => parseAiChartD1Candidate(fixture))
})

test('blank statement is rejected', () => {
  const fixture = candidateFixture()
  fixture.statement = '   '
  expectInvalid(() => parseAiChartD1Candidate(fixture))
})

test('overlong statement is rejected', () => {
  const fixture = candidateFixture()
  fixture.statement = 'x'.repeat(AI_CHART_D1_MAX_TEXT_LENGTH + 1)
  expectInvalid(() => parseAiChartD1Candidate(fixture))
})

test('invalid candidate ID is rejected', () => {
  const fixture = candidateFixture()
  fixture.candidateId = 'candidate with spaces'
  expectInvalid(() => parseAiChartD1Candidate(fixture))
})

test('empty life examples are rejected', () => {
  const fixture = candidateFixture()
  fixture.lifeExamples = []
  expectInvalid(() => parseAiChartD1Candidate(fixture))
})

test('empty scopes are rejected', () => {
  const fixture = candidateFixture()
  fixture.scopes = []
  expectInvalid(() => parseAiChartD1Candidate(fixture))
})

test('empty palace IDs are rejected', () => {
  const fixture = candidateFixture()
  fixture.palaceIds = []
  expectInvalid(() => parseAiChartD1Candidate(fixture))
})

test('empty star basis is rejected', () => {
  const fixture = candidateFixture()
  fixture.starBasis = []
  expectInvalid(() => parseAiChartD1Candidate(fixture))
})

test('empty structure basis is rejected', () => {
  const fixture = candidateFixture()
  fixture.structureBasis = []
  expectInvalid(() => parseAiChartD1Candidate(fixture))
})

test('empty used rule IDs are rejected', () => {
  const fixture = candidateFixture()
  fixture.usedRuleIds = []
  expectInvalid(() => parseAiChartD1Candidate(fixture))
})

test('duplicate string array values are rejected', () => {
  const fixture = candidateFixture()
  fixture.lifeExamples = ['Repeated example', 'Repeated example']
  expectInvalid(() => parseAiChartD1Candidate(fixture))
})

test('undefined conflict group is rejected instead of treated as null', () => {
  const fixture = candidateFixture()
  fixture.conflictGroupId = undefined
  expectInvalid(() => parseAiChartD1Candidate(fixture))
})

test('undefined D2 boundary is rejected instead of treated as null', () => {
  const fixture = candidateFixture()
  fixture.d2Boundary = undefined
  expectInvalid(() => parseAiChartD1Candidate(fixture))
})

test('explicit null nullable candidate fields are accepted', () => {
  const parsed = parseAiChartD1Candidate(candidateFixture())
  assert.equal(parsed.conflictGroupId, null)
  assert.equal(parsed.d2Boundary, null)
})

test('unknown candidate key is rejected', () => {
  const fixture = candidateFixture()
  fixture.unknownField = 'synthetic'
  expectInvalid(() => parseAiChartD1Candidate(fixture))
})

test('class instance is rejected', () => {
  class SyntheticCandidate {
    candidateId = 'candidate.synthetic.1'
    statement = 'Synthetic candidate statement'
    lifeExamples = ['Synthetic life example']
    scopes = ['personality']
    palaceIds = ['palace.synthetic.1']
    starBasis = ['Synthetic star basis']
    structureBasis = ['本宮']
    usedRuleIds = ['rule.synthetic.1']
    ruleStatus = 'teacher_confirmed'
    intensity = 'normal'
    conflictGroupId = null
    d2Boundary = null
  }

  expectInvalid(() => parseAiChartD1Candidate(new SyntheticCandidate()))
})

test('getter property is rejected without invocation', () => {
  const fixture = candidateFixture()
  let invoked = false
  Object.defineProperty(fixture, 'statement', {
    enumerable: true,
    get() {
      invoked = true
      return SYNTHETIC_MARKER
    },
  })
  expectInvalid(() => parseAiChartD1Candidate(fixture), [SYNTHETIC_MARKER])
  assert.equal(invoked, false)
})

test('setter property is rejected', () => {
  const fixture = candidateFixture()
  Object.defineProperty(fixture, 'statement', {
    enumerable: true,
    set() {},
  })
  expectInvalid(() => parseAiChartD1Candidate(fixture))
})

test('symbol property is rejected', () => {
  const fixture = candidateFixture()
  Object.defineProperty(fixture, Symbol('synthetic'), {
    enumerable: true,
    value: SYNTHETIC_MARKER,
  })
  expectInvalid(() => parseAiChartD1Candidate(fixture), [SYNTHETIC_MARKER])
})

test('cyclic candidate data is rejected', () => {
  const fixture = candidateFixture()
  const cyclic: unknown[] = []
  cyclic.push(cyclic)
  fixture.lifeExamples = cyclic
  expectInvalid(() => parseAiChartD1Candidate(fixture))
})

test('parsed result is a deep copy of the source fixture', () => {
  const fixture = candidateFixture()
  const parsed = parseAiChartD1Candidate(fixture)
  ;(fixture.lifeExamples as string[])[0] = 'Changed after parsing'
  ;(fixture.scopes as string[]).push('values')
  fixture.statement = 'Changed statement'
  assert.equal(parsed.statement, 'Synthetic candidate statement')
  assert.deepEqual(parsed.lifeExamples, ['Synthetic life example'])
  assert.deepEqual(parsed.scopes, ['personality'])
})

test('parsed candidate result is deeply frozen', () => {
  const parsed = parseAiChartD1Candidate(candidateFixture())
  assert.equal(Object.isFrozen(parsed), true)
  assert.equal(Object.isFrozen(parsed.lifeExamples), true)
  assert.equal(Object.isFrozen(parsed.scopes), true)
  assert.throws(() => {
    ;(parsed.lifeExamples as string[]).push('mutation')
  }, TypeError)
})

test('fixed safe error excludes synthetic marker', () => {
  const fixture = candidateFixture()
  fixture.statement =
    SYNTHETIC_MARKER + 'x'.repeat(AI_CHART_D1_MAX_TEXT_LENGTH)
  expectInvalid(() => parseAiChartD1Candidate(fixture), [SYNTHETIC_MARKER])
})

test('legal D2 boundary is accepted and frozen', () => {
  const parsed = parseAiChartD1D2Boundary(boundaryFixture())
  assert.equal(parsed.boundaryId, 'boundary.synthetic.1')
  assert.equal(Object.isFrozen(parsed), true)
})

test('D2 boundary with an empty reason is rejected', () => {
  const fixture = boundaryFixture()
  fixture.reason = ''
  expectInvalid(() => parseAiChartD1D2Boundary(fixture))
})

test('D2 boundary with an unknown key is rejected', () => {
  const fixture = boundaryFixture()
  fixture.unknownField = SYNTHETIC_MARKER
  expectInvalid(() => parseAiChartD1D2Boundary(fixture), [SYNTHETIC_MARKER])
})

test('legal trait tension is accepted and deeply frozen', () => {
  const parsed = parseAiChartD1TraitTension(tensionFixture())
  assert.equal(parsed.tensionId, 'tension.synthetic.1')
  assert.equal(Object.isFrozen(parsed), true)
  assert.equal(Object.isFrozen(parsed.candidateIds), true)
})

test('trait tension with duplicate candidate IDs is rejected', () => {
  const fixture = tensionFixture()
  fixture.candidateIds = ['candidate.synthetic.1', 'candidate.synthetic.1']
  expectInvalid(() => parseAiChartD1TraitTension(fixture))
})

test('trait tension with an invalid ID is rejected', () => {
  const fixture = tensionFixture()
  fixture.tensionId = 'invalid tension id'
  expectInvalid(() => parseAiChartD1TraitTension(fixture))
})

assert.ok(testCount >= 30)
console.log(`Common contract tests passed: ${testCount}`)
