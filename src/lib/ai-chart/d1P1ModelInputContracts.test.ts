import assert from 'node:assert/strict'
import {
  AI_CHART_D1_P1_F1_CONTRACT_VERSION,
  AI_CHART_D1_P1_F1_CONTRACT_VERSION as OUTPUT_CONTRACT_VERSION,
} from './d1CommonContracts'
import { AI_CHART_D1_K0_BUNDLE_VERSION } from './d1K0Registry'
import { AI_CHART_D1_P1_STRUCTURAL_INPUT_CONTRACT_VERSION } from './d1N0Constants'
import { AI_CHART_D1_P1_SCHEMA_NAME } from './d1P1F1Contracts'
import {
  AI_CHART_D1_P1_MODEL_INPUT_CONTRACT_VERSION,
  AI_CHART_D1_P1_MODEL_INPUT_FIELDS,
  AI_CHART_D1_P1_MODEL_INPUT_INTERNAL_JSON_SCHEMA,
  AI_CHART_D1_P1_MODEL_INPUT_INVALID,
  AI_CHART_D1_P1_MODEL_INPUT_NOT_READY,
  AI_CHART_D1_P1_MODEL_INPUT_SCHEMA_NAME,
  AI_CHART_D1_P1_MODEL_INPUT_TASK,
  assertAiChartD1P1ModelInputHasNoForbiddenData,
  createAiChartD1P1ModelInputFingerprint,
  stableAiChartD1P1ModelInputEqual,
  type AiChartD1P1ModelInput,
  type AiChartD1P1ModelInputWithoutFingerprint,
} from './d1P1ModelInputContracts'
import {
  type Mutable,
  createModelInputFixture,
  parseFixtureModelInput,
  recalculateModelInputFingerprint,
} from './d1P1ModelInputTestSupport'

let checks = 0

function check(name: string, run: () => void) {
  run()
  checks += 1
  console.log(`✓ ${name}`)
}

function assertInvalid(run: () => unknown): void {
  assert.throws(run, { message: AI_CHART_D1_P1_MODEL_INPUT_INVALID })
}

function withoutFingerprint(
  value: AiChartD1P1ModelInput,
): AiChartD1P1ModelInputWithoutFingerprint {
  const payload = structuredClone(value) as unknown as Record<string, unknown>
  delete payload.inputFingerprint
  return payload as AiChartD1P1ModelInputWithoutFingerprint
}

function allowedNameGraph(
  role:
    | 'targetPalace'
    | 'oppositePalace'
    | 'hiddenCombinationPalace'
    | 'otherTrinePalaces',
  collection:
    | 'canonicalMajorStars'
    | 'modeledSupportingStars'
    | 'borrowedMajorStars',
  otherTrineIndex = 0,
): unknown {
  const name = collection === 'modeledSupportingStars' ? '文昌' : '紫微'
  const palace = { [collection]: [{ name }] }
  return {
    structuralContext: {
      [role]:
        role === 'otherTrinePalaces'
          ? Array.from({ length: otherTrineIndex + 1 }, (_, index) =>
              index === otherTrineIndex ? palace : {},
            )
          : palace,
    },
  }
}

function mutateAndReject(
  fixture: Awaited<ReturnType<typeof createModelInputFixture>>,
  name: string,
  mutate: (value: Mutable<AiChartD1P1ModelInput>) => void,
  recalculate = true,
): void {
  check(name, () => {
    const value = structuredClone(
      fixture.modelInputs[0],
    ) as Mutable<AiChartD1P1ModelInput>
    mutate(value)
    if (recalculate) recalculateModelInputFingerprint(value)
    assertInvalid(() => parseFixtureModelInput(fixture, 0, value))
  })
}

async function run() {
  const fixture = await createModelInputFixture('contract')
  const modelInput = fixture.modelInputs[0]
  const schema = AI_CHART_D1_P1_MODEL_INPUT_INTERNAL_JSON_SCHEMA as Record<
    string,
    unknown
  >
  const properties = schema.properties as Record<string, Record<string, unknown>>

  check('Model Input contract version is locked', () => {
    assert.equal(
      AI_CHART_D1_P1_MODEL_INPUT_CONTRACT_VERSION,
      'ai-chart-d1-p1-model-input/v1',
    )
  })
  check('Model Input schema name is locked', () => {
    assert.equal(
      AI_CHART_D1_P1_MODEL_INPUT_SCHEMA_NAME,
      'ai_chart_d1_p1_model_input_v1',
    )
  })
  check('Model Input task is locked', () => {
    assert.equal(AI_CHART_D1_P1_MODEL_INPUT_TASK, 'D1_P1_MODEL_INPUT')
  })
  check('invalid error code is locked', () => {
    assert.equal(
      AI_CHART_D1_P1_MODEL_INPUT_INVALID,
      'ai_chart_d1_p1_model_input_invalid',
    )
  })
  check('not-ready error code is locked separately', () => {
    assert.equal(
      AI_CHART_D1_P1_MODEL_INPUT_NOT_READY,
      'ai_chart_d1_p1_model_input_not_ready',
    )
    assert.notEqual(
      AI_CHART_D1_P1_MODEL_INPUT_NOT_READY,
      AI_CHART_D1_P1_MODEL_INPUT_INVALID,
    )
  })
  check('Structural Input contract reference is locked', () => {
    assert.equal(
      modelInput.structuralInputContractVersion,
      AI_CHART_D1_P1_STRUCTURAL_INPUT_CONTRACT_VERSION,
    )
  })
  check('Knowledge Bundle contract reference is locked', () => {
    assert.equal(
      modelInput.knowledgeBundleContractVersion,
      AI_CHART_D1_K0_BUNDLE_VERSION,
    )
  })
  check('P1 output contract reference is locked', () => {
    assert.equal(modelInput.outputContractVersion, OUTPUT_CONTRACT_VERSION)
    assert.equal(modelInput.outputContractVersion, AI_CHART_D1_P1_F1_CONTRACT_VERSION)
  })
  check('P1 output schema reference is locked', () => {
    assert.equal(modelInput.outputSchemaName, AI_CHART_D1_P1_SCHEMA_NAME)
  })
  check('Prompt status, version and callable state are locked', () => {
    assert.equal(modelInput.promptStatus, 'prompt_builder_required')
    assert.equal(modelInput.promptVersion, null)
    assert.equal(modelInput.openAiCallable, false)
  })

  for (const role of [
    'targetPalace',
    'oppositePalace',
    'hiddenCombinationPalace',
  ] as const) {
    for (const collection of [
      'canonicalMajorStars',
      'modeledSupportingStars',
      'borrowedMajorStars',
    ] as const) {
      check(`${role}.${collection}[].name is path-allowed`, () => {
        assert.doesNotThrow(() =>
          assertAiChartD1P1ModelInputHasNoForbiddenData(
            allowedNameGraph(role, collection),
          ),
        )
      })
    }
  }

  for (const [role, otherTrineIndex] of [
    ['trine_1', 0],
    ['trine_2', 1],
  ] as const) {
    for (const collection of [
      'canonicalMajorStars',
      'modeledSupportingStars',
      'borrowedMajorStars',
    ] as const) {
      check(`${role}.${collection}[].name is path-allowed`, () => {
        assert.doesNotThrow(() =>
          assertAiChartD1P1ModelInputHasNoForbiddenData(
            allowedNameGraph('otherTrinePalaces', collection, otherTrineIndex),
          ),
        )
      })
    }
  }

  check('structuralContext root name is rejected', () => {
    assertInvalid(() =>
      assertAiChartD1P1ModelInputHasNoForbiddenData({
        structuralContext: { name: '王小明' },
      }),
    )
  })
  check('Model Input envelope name is rejected', () => {
    assertInvalid(() =>
      assertAiChartD1P1ModelInputHasNoForbiddenData({ name: '王小明' }),
    )
  })
  check('knowledgeContext name is rejected', () => {
    assertInvalid(() =>
      assertAiChartD1P1ModelInputHasNoForbiddenData({
        knowledgeContext: { name: '王小明' },
      }),
    )
  })
  check('knowledgeContext rules name is rejected', () => {
    assertInvalid(() =>
      assertAiChartD1P1ModelInputHasNoForbiddenData({
        knowledgeContext: { rules: [{ name: '王小明' }] },
      }),
    )
  })
  check('knowledgeContext meanings name is rejected', () => {
    assertInvalid(() =>
      assertAiChartD1P1ModelInputHasNoForbiddenData({
        knowledgeContext: { meanings: [{ name: '王小明' }] },
      }),
    )
  })
  check('warnings item name is rejected', () => {
    assertInvalid(() =>
      assertAiChartD1P1ModelInputHasNoForbiddenData({
        warnings: [{ name: '王小明' }],
      }),
    )
  })
  check('unknown nested name is rejected', () => {
    assertInvalid(() =>
      assertAiChartD1P1ModelInputHasNoForbiddenData({
        arbitrary: { nested: [{ name: '王小明' }] },
      }),
    )
  })
  check('lookalike string paths cannot bypass name policy', () => {
    assertInvalid(() =>
      assertAiChartD1P1ModelInputHasNoForbiddenData({
        structuralContext: {
          'targetPalace.canonicalMajorStars': [{ name: '紫微' }],
        },
      }),
    )
  })
  check('canonical major name must use the existing closed enum', () => {
    assert.doesNotThrow(() =>
      assertAiChartD1P1ModelInputHasNoForbiddenData(
        allowedNameGraph(
          'targetPalace',
          'canonicalMajorStars',
        ) as { structuralContext: { targetPalace: { canonicalMajorStars: unknown[] } } },
      ),
    )
  })

  const invalidMajor = allowedNameGraph(
    'targetPalace',
    'canonicalMajorStars',
  ) as {
    structuralContext: {
      targetPalace: { canonicalMajorStars: Array<{ name: string }> }
    }
  }
  invalidMajor.structuralContext.targetPalace.canonicalMajorStars[0].name =
    '不存在主星'
  check('invalid canonical major star value is rejected', () => {
    assertInvalid(() =>
      assertAiChartD1P1ModelInputHasNoForbiddenData(invalidMajor),
    )
  })
  const invalidSupporting = allowedNameGraph(
    'targetPalace',
    'modeledSupportingStars',
  ) as {
    structuralContext: {
      targetPalace: { modeledSupportingStars: Array<{ name: string }> }
    }
  }
  invalidSupporting.structuralContext.targetPalace.modeledSupportingStars[0].name =
    '天馬'
  check('invalid modeled supporting star value is rejected', () => {
    assertInvalid(() =>
      assertAiChartD1P1ModelInputHasNoForbiddenData(invalidSupporting),
    )
  })
  const invalidBorrowed = allowedNameGraph(
    'targetPalace',
    'borrowedMajorStars',
  ) as {
    structuralContext: {
      targetPalace: { borrowedMajorStars: Array<{ name: string }> }
    }
  }
  invalidBorrowed.structuralContext.targetPalace.borrowedMajorStars[0].name =
    '文昌'
  check('invalid borrowed major star value is rejected', () => {
    assertInvalid(() =>
      assertAiChartD1P1ModelInputHasNoForbiddenData(invalidBorrowed),
    )
  })

  for (const forbiddenKey of [
    'solarDate',
    'lunarDate',
    'birthInput',
    'completeSnapshot',
    'userId',
    'report_id',
    'payment',
    'merchantOrderNo',
    'email',
    'token',
    'sourceFile',
    'sourceLocator',
    'sourcePath',
  ]) {
    check(`${forbiddenKey} is recursively rejected`, () => {
      assertInvalid(() =>
        assertAiChartD1P1ModelInputHasNoForbiddenData({
          safe: [{ nested: { [forbiddenKey]: 'forbidden' } }],
        }),
      )
    })
  }

  for (const forbiddenKey of [
    'messages',
    'input',
    'instructions',
    'system',
    'developer',
    'user',
    'model',
    'response_format',
    'temperature',
    'max_output_tokens',
    'tools',
    'tool_choice',
    'store',
    'metadata',
  ]) {
    check(`${forbiddenKey} Prompt/OpenAI key is rejected`, () => {
      assertInvalid(() =>
        assertAiChartD1P1ModelInputHasNoForbiddenData({
          safe: { [forbiddenKey]: 'forbidden' },
        }),
      )
    })
  }
  check('legitimate keys containing input are not substring-blocked', () => {
    assert.doesNotThrow(() =>
      assertAiChartD1P1ModelInputHasNoForbiddenData({
        inputFingerprint: 'safe',
        structuralInputContractVersion: 'safe',
        outputContractVersion: 'safe',
      }),
    )
  })

  mutateAndReject(fixture, 'unknown envelope field is rejected', (value) => {
    ;(value as unknown as Record<string, unknown>).unknown = true
  })
  check('accessor is rejected without invoking it', () => {
    const value = structuredClone(modelInput) as Record<string, unknown>
    let invoked = false
    Object.defineProperty(value, 'chartId', {
      enumerable: true,
      get() {
        invoked = true
        return 'chart:evil'
      },
    })
    assertInvalid(() => parseFixtureModelInput(fixture, 0, value))
    assert.equal(invoked, false)
  })
  check('symbol key is rejected', () => {
    const value = structuredClone(modelInput) as Record<PropertyKey, unknown>
    value[Symbol('forbidden')] = true
    assertInvalid(() => parseFixtureModelInput(fixture, 0, value))
  })
  check('cycle is rejected', () => {
    const value = structuredClone(modelInput) as Record<string, unknown>
    value.cycle = value
    assertInvalid(() => parseFixtureModelInput(fixture, 0, value))
  })
  check('error does not leak name, path or star value', () => {
    try {
      assertAiChartD1P1ModelInputHasNoForbiddenData({ name: '王小明' })
      assert.fail('expected invalid error')
    } catch (error) {
      assert.equal((error as Error).message, AI_CHART_D1_P1_MODEL_INPUT_INVALID)
      assert.doesNotMatch(String(error), /王小明|name|structuralContext|紫微/u)
    }
  })

  mutateAndReject(
    fixture,
    'valid star name changed with recalculated fingerprint still fails source binding',
    (value) => {
      value.structuralContext.targetPalace.canonicalMajorStars[0].name = '紫微'
    },
  )
  mutateAndReject(
    fixture,
    'rule content changed with recalculated fingerprint is rejected',
    (value) => {
      value.knowledgeContext.rules[0].content = 'tampered rule content'
    },
  )
  mutateAndReject(
    fixture,
    'rule hash changed with recalculated fingerprint is rejected',
    (value) => {
      value.knowledgeContext.rules[0].contentSha256 = 'a'.repeat(64)
    },
  )
  mutateAndReject(
    fixture,
    'selected rule deletion with recalculated fingerprint is rejected',
    (value) => {
      value.knowledgeContext.rules.splice(0, 1)
    },
  )
  mutateAndReject(
    fixture,
    'meaning role changed with recalculated fingerprint is rejected',
    (value) => {
      value.knowledgeContext.meanings[0].palaceRole = 'opposite'
    },
  )
  mutateAndReject(
    fixture,
    'trace placement changed with recalculated fingerprint is rejected',
    (value) => {
      const trace = value.knowledgeContext.selectionTrace.find(
        (entry) => entry.placementId !== null,
      )
      assert.ok(trace)
      trace.placementId = 'placement:tampered'
    },
  )
  mutateAndReject(
    fixture,
    'bundle id changed with recalculated fingerprint is rejected',
    (value) => {
      value.bundleId = 'bundle:tampered'
    },
  )
  mutateAndReject(
    fixture,
    'unchanged sources reject an incorrect fingerprint',
    (value) => {
      value.inputFingerprint = 'b'.repeat(64)
    },
    false,
  )

  check('repeated fingerprint creation is deterministic', () => {
    const payload = withoutFingerprint(modelInput)
    assert.equal(
      createAiChartD1P1ModelInputFingerprint(payload),
      createAiChartD1P1ModelInputFingerprint(structuredClone(payload)),
    )
  })
  for (const [label, mutate] of [
    [
      'structure',
      (value: Mutable<AiChartD1P1ModelInputWithoutFingerprint>) => {
        value.structuralContext.targetPalace.isBodyPalace =
          !value.structuralContext.targetPalace.isBodyPalace
      },
    ],
    [
      'rule',
      (value: Mutable<AiChartD1P1ModelInputWithoutFingerprint>) => {
        value.knowledgeContext.rules[0].title += ' changed'
      },
    ],
    [
      'meaning',
      (value: Mutable<AiChartD1P1ModelInputWithoutFingerprint>) => {
        value.knowledgeContext.meanings[0].text += ' changed'
      },
    ],
    [
      'trace',
      (value: Mutable<AiChartD1P1ModelInputWithoutFingerprint>) => {
        value.knowledgeContext.selectionTrace[0].structuralReference =
          'p1:changed'
      },
    ],
    [
      'warning',
      (value: Mutable<AiChartD1P1ModelInputWithoutFingerprint>) => {
        value.warnings.push({
          warningId: 'warning:changed',
          code: 'natal_mutagen_missing',
          palaceId: null,
          placementIds: [],
        })
      },
    ],
    [
      'metadata',
      (value: Mutable<AiChartD1P1ModelInputWithoutFingerprint>) => {
        value.bundleId = 'bundle:changed'
      },
    ],
  ] as const) {
    check(`${label} change changes fingerprint`, () => {
      const original = withoutFingerprint(modelInput)
      const changed = structuredClone(original) as Mutable<
        AiChartD1P1ModelInputWithoutFingerprint
      >
      mutate(changed)
      assert.notEqual(
        createAiChartD1P1ModelInputFingerprint(original),
        createAiChartD1P1ModelInputFingerprint(changed),
      )
    })
  }

  check('stable equality ignores object key insertion order only', () => {
    assert.equal(stableAiChartD1P1ModelInputEqual({ a: 1, b: 2 }, { b: 2, a: 1 }), true)
    assert.equal(stableAiChartD1P1ModelInputEqual([1, 2], [2, 1]), false)
  })
  check('parsed Model Input graph is recursively frozen', () => {
    assert.equal(Object.isFrozen(modelInput), true)
    assert.equal(Object.isFrozen(modelInput.structuralContext), true)
    assert.equal(Object.isFrozen(modelInput.structuralContext.targetPalace), true)
    assert.equal(Object.isFrozen(modelInput.knowledgeContext.rules), true)
    assert.equal(Object.isFrozen(modelInput.knowledgeContext.rules[0]), true)
  })

  check('internal schema is a strict object', () => {
    assert.equal(schema.type, 'object')
    assert.equal(schema.additionalProperties, false)
    assert.deepEqual(schema.required, Object.keys(properties))
    assert.deepEqual(Object.keys(properties), AI_CHART_D1_P1_MODEL_INPUT_FIELDS)
  })
  check('schema locks Model Input version and task', () => {
    assert.equal(properties.contractVersion.const, AI_CHART_D1_P1_MODEL_INPUT_CONTRACT_VERSION)
    assert.equal(properties.task.const, AI_CHART_D1_P1_MODEL_INPUT_TASK)
  })
  check('schema locks output contract and schema references', () => {
    assert.equal(properties.outputContractVersion.const, AI_CHART_D1_P1_F1_CONTRACT_VERSION)
    assert.equal(properties.outputSchemaName.const, AI_CHART_D1_P1_SCHEMA_NAME)
  })
  check('schema keeps otherTrinePalaces fixed at two', () => {
    const structural = properties.structuralContext.properties as Record<
      string,
      Record<string, unknown>
    >
    assert.equal(structural.otherTrinePalaces.minItems, 2)
    assert.equal(structural.otherTrinePalaces.maxItems, 2)
  })
  check('schema preserves star name in Structural Palace arrays', () => {
    const structural = properties.structuralContext.properties as Record<
      string,
      Record<string, unknown>
    >
    const palace = structural.targetPalace.properties as Record<
      string,
      Record<string, unknown>
    >
    for (const collection of [
      'canonicalMajorStars',
      'modeledSupportingStars',
      'borrowedMajorStars',
    ]) {
      const items = palace[collection].items as Record<string, unknown>
      assert.equal(
        Object.prototype.hasOwnProperty.call(
          items.properties as Record<string, unknown>,
          'name',
        ),
        true,
      )
    }
  })
  check('schema does not add name to envelope or knowledge projections', () => {
    assert.equal(Object.prototype.hasOwnProperty.call(properties, 'name'), false)
    const knowledge = properties.knowledgeContext.properties as Record<
      string,
      Record<string, unknown>
    >
    const rules = knowledge.rules.items as Record<string, unknown>
    const meanings = knowledge.meanings.items as Record<string, unknown>
    assert.equal(Object.prototype.hasOwnProperty.call(rules.properties as object, 'name'), false)
    assert.equal(Object.prototype.hasOwnProperty.call(meanings.properties as object, 'name'), false)
  })
  check('schema has no unsupported uniqueItems', () => {
    assert.doesNotMatch(JSON.stringify(schema), /uniqueItems/u)
  })
  check('schema contains no Prompt or OpenAI request keys', () => {
    const topKeys = new Set(Object.keys(properties))
    for (const key of [
      'messages',
      'input',
      'instructions',
      'system',
      'developer',
      'user',
      'model',
      'response_format',
      'temperature',
      'max_output_tokens',
      'tools',
      'store',
      'metadata',
    ]) {
      assert.equal(topKeys.has(key), false)
    }
  })
  check('schema keeps openAiCallable false and prompt unavailable', () => {
    assert.equal(properties.openAiCallable.const, false)
    assert.equal(properties.promptStatus.const, 'prompt_builder_required')
    assert.equal(properties.promptVersion.type, 'null')
  })

  console.log(`\n${checks} P1 Model Input contract checks passed.`)
}

void run()
