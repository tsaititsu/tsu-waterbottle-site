import assert from 'node:assert/strict'
import Module, { createRequire } from 'node:module'
import {
  AI_CHART_BIRTH_INPUT_VERSION,
} from './birthInput'
import {
  AI_CHART_ENGINE_NAME,
  AI_CHART_ENGINE_VERSION,
  AI_CHART_SNAPSHOT_VERSION,
} from './chartSnapshot'

type NodeModuleInternals = {
  _resolveFilename: (
    request: string,
    parent: unknown,
    isMain: boolean,
    options?: unknown,
  ) => string
  _load: (
    request: string,
    parent: unknown,
    isMain: boolean,
  ) => unknown
}

const moduleInternals =
  Module as unknown as NodeModuleInternals
const originalResolveFilename =
  moduleInternals._resolveFilename
const originalLoad = moduleInternals._load
const testRequire = createRequire(import.meta.url)
const serverOnlyStubPath =
  testRequire.resolve('./d1Assets')

function loadServerOnlyModule<T>(request: string): T {
  try {
    moduleInternals._resolveFilename =
      function resolveFilenameForTest(
        this: unknown,
        moduleRequest: string,
        parent: unknown,
        isMain: boolean,
        options?: unknown,
      ) {
        if (moduleRequest === 'server-only') {
          return serverOnlyStubPath
        }
        return originalResolveFilename.call(
          this,
          moduleRequest,
          parent,
          isMain,
          options,
        )
      }
    moduleInternals._load = function loadForTest(
      this: unknown,
      moduleRequest: string,
      parent: unknown,
      isMain: boolean,
    ) {
      if (moduleRequest === 'server-only') return {}
      return originalLoad.call(
        this,
        moduleRequest,
        parent,
        isMain,
      )
    }
    return testRequire(request) as T
  } finally {
    moduleInternals._resolveFilename =
      originalResolveFilename
    moduleInternals._load = originalLoad
  }
}

const subjectModule =
  loadServerOnlyModule<
    typeof import(
      './d1PalaceWritingHumanReviewReportSubject.server'
    )
  >(
    './d1PalaceWritingHumanReviewReportSubject.server',
  )

const {
  AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_REPORT_SUBJECT_FAILURE_CODES,
  AiChartD1PalaceWritingHumanReviewReportSubjectError,
  consumeAiChartD1PalaceWritingHumanReviewReportSubject,
  resolveAiChartD1PalaceWritingHumanReviewReportSubject,
} = subjectModule

type ResolveDependencies = NonNullable<
  Parameters<
    typeof resolveAiChartD1PalaceWritingHumanReviewReportSubject
  >[1]
>
type LookupReportReviewSubject = NonNullable<
  ResolveDependencies['lookupReportReviewSubject']
>

const REPORT_ID =
  '3e0ba27e-95f8-4c22-92b1-a42fb9bfaed9'
const OWNER_ID =
  'f3ba29e1-7fde-4bc3-8d8f-158b24de81ae'
const SENSITIVE_MARKER =
  'sensitive-owner-chart-provider-message'
const EXPECTED_SNAPSHOT_SHA256 =
  '70a369b02849b64fb12b2d25ffa59f5c27f2943d367b796fbbe87a39e8448dd2'

const palaceNames = [
  '命宮',
  '兄弟',
  '夫妻',
  '子女',
  '財帛',
  '疾厄',
  '遷移',
  '僕役',
  '官祿',
  '田宅',
  '福德',
  '父母',
] as const
const heavenlyStems = [
  '甲',
  '乙',
  '丙',
  '丁',
  '戊',
  '己',
  '庚',
  '辛',
  '壬',
  '癸',
  '甲',
  '乙',
] as const
const earthlyBranches = [
  '子',
  '丑',
  '寅',
  '卯',
  '辰',
  '巳',
  '午',
  '未',
  '申',
  '酉',
  '戌',
  '亥',
] as const

const canonicalChartSnapshot = {
  version: AI_CHART_SNAPSHOT_VERSION,
  source: AI_CHART_ENGINE_NAME,
  engineVersion: AI_CHART_ENGINE_VERSION,
  birthInputVersion: AI_CHART_BIRTH_INPUT_VERSION,
  lunarDate: '庚午年四月廿六',
  fiveElementsClass: '木三局',
  palaces: palaceNames.map((name, index) => ({
    index,
    name,
    isMingPalace: index === 0,
    isBodyPalace: index === 1,
    heavenlyStem: heavenlyStems[index],
    earthlyBranch: earthlyBranches[index],
    majorStars:
      index === 0
        ? [
            {
              name: '紫微',
              type: 'major',
              scope: 'origin',
            },
          ]
        : [],
    minorStars: [],
    adjectiveStars: [],
    decadal: {
      range: [index + 1, index + 10],
      heavenlyStem: heavenlyStems[index],
      earthlyBranch: earthlyBranches[index],
    },
    ages: [index + 1],
  })),
}

function resolvedRow(
  overrides: Readonly<Record<string, unknown>> = {},
) {
  return {
    id: REPORT_ID,
    ownerUserId: OWNER_ID,
    paymentStatus: 'paid',
    chartSnapshot: canonicalChartSnapshot,
    ...overrides,
  }
}

let checks = 0

async function check(
  name: string,
  run: () => void | Promise<void>,
) {
  await run()
  checks += 1
  console.log(`✓ ${name}`)
}

async function main() {
  await check(
    'Server lookup resolves a paid owner-bound canonical Report Snapshot without exposing owner or chart data',
    async () => {
      let invocations = 0
      const subject =
        await resolveAiChartD1PalaceWritingHumanReviewReportSubject(
          { reportId: REPORT_ID },
          {
            lookupReportReviewSubject:
              async (reportId) => {
                invocations += 1
                assert.equal(reportId, REPORT_ID)
                return resolvedRow()
              },
          },
        )

      assert.equal(invocations, 1)
      assert.deepEqual(Object.keys(subject), [
        'contractVersion',
        'task',
        'dataClassification',
        'reportId',
        'reportSnapshotSha256',
        'reportLookupStatus',
        'paymentStatus',
        'ownerBindingStatus',
        'sourceBindingStatus',
        'capabilityScope',
        'productionCallable',
        'formalReviewRecordAllowed',
        'customerDeliveryAllowed',
        'openAiRequests',
        'subjectFingerprint',
      ])
      assert.equal(subject.reportId, REPORT_ID)
      assert.equal(
        subject.reportSnapshotSha256,
        EXPECTED_SNAPSHOT_SHA256,
      )
      assert.equal(
        subject.reportLookupStatus,
        'SERVER_FOUND',
      )
      assert.equal(
        subject.paymentStatus,
        'SERVER_VERIFIED_PAID',
      )
      assert.equal(
        subject.ownerBindingStatus,
        'SERVER_RESOLVED_OWNER_PRESENT',
      )
      assert.equal(
        subject.sourceBindingStatus,
        'PENDING_ARTIFACT_SNAPSHOT_PROOF',
      )
      assert.equal(subject.productionCallable, true)
      assert.equal(subject.formalReviewRecordAllowed, false)
      assert.equal(subject.customerDeliveryAllowed, false)
      assert.equal(subject.openAiRequests, 0)
      assert.equal(Object.isFrozen(subject), true)

      const serialized = JSON.stringify(subject)
      assert.equal(serialized.includes(OWNER_ID), false)
      assert.equal(serialized.includes('chartSnapshot'), false)
      assert.equal(serialized.includes('palaces'), false)
      assert.equal(serialized.includes('紫微'), false)
    },
  )

  await check(
    'invalid id, missing Report, missing owner, unpaid Report, and malformed Snapshot fail with fixed codes',
    async () => {
      const cases: ReadonlyArray<
        readonly [
          string,
          Readonly<{ reportId?: string; row: unknown }>,
          string,
        ]
      > = [
        [
          'invalid report id',
          {
            reportId: 'not-a-report-id',
            row: resolvedRow(),
          },
          'REPORT_ID_INVALID',
        ],
        [
          'missing report',
          { row: null },
          'REPORT_NOT_FOUND',
        ],
        [
          'missing owner',
          {
            row: resolvedRow({
              ownerUserId: null,
            }),
          },
          'REPORT_OWNER_INVALID',
        ],
        [
          'unpaid report',
          {
            row: resolvedRow({
              paymentStatus: 'pending',
            }),
          },
          'REPORT_PAYMENT_REQUIRED',
        ],
        [
          'malformed snapshot',
          {
            row: resolvedRow({
              chartSnapshot: {
                ...canonicalChartSnapshot,
                prompt: SENSITIVE_MARKER,
              },
            }),
          },
          'REPORT_SNAPSHOT_INVALID',
        ],
      ]

      for (const [name, input, expectedCode] of cases) {
        let caught: unknown
        try {
          await resolveAiChartD1PalaceWritingHumanReviewReportSubject(
            {
              reportId: input.reportId ?? REPORT_ID,
            },
            {
              lookupReportReviewSubject:
                async () => input.row as never,
            },
          )
        } catch (error) {
          caught = error
        }
        assert.equal(
          caught instanceof
            AiChartD1PalaceWritingHumanReviewReportSubjectError,
          true,
          name,
        )
        assert.equal(
          (
            caught as InstanceType<
              typeof AiChartD1PalaceWritingHumanReviewReportSubjectError
            >
          ).code,
          expectedCode,
          name,
        )
        assert.equal(
          JSON.stringify(caught).includes(SENSITIVE_MARKER),
          false,
          name,
        )
      }
    },
  )

  await check(
    'lookup errors and row identity drift remain sanitized and fail closed',
    async () => {
      const cases: readonly LookupReportReviewSubject[] = [
        async () => {
          throw new Error(SENSITIVE_MARKER)
        },
        async () =>
          resolvedRow({
            id: '6cb8f89e-81ef-4770-b181-b0625368f626',
          }),
      ]
      for (const lookupReportReviewSubject of cases) {
        let caught: unknown
        try {
          await resolveAiChartD1PalaceWritingHumanReviewReportSubject(
            { reportId: REPORT_ID },
            { lookupReportReviewSubject },
          )
        } catch (error) {
          caught = error
        }
        assert.equal(
          caught instanceof
            AiChartD1PalaceWritingHumanReviewReportSubjectError,
          true,
        )
        assert.equal(
          String(caught).includes(SENSITIVE_MARKER),
          false,
        )
        assert.equal(
          JSON.stringify(caught).includes(SENSITIVE_MARKER),
          false,
        )
      }
    },
  )

  await check(
    'Report subject capability requires exact object identity and is consumed once',
    async () => {
      const subject =
        await resolveAiChartD1PalaceWritingHumanReviewReportSubject(
          { reportId: REPORT_ID },
          {
            lookupReportReviewSubject:
              async () => resolvedRow(),
          },
        )
      for (const invalidCapability of [
        { ...subject },
        structuredClone(subject),
        JSON.parse(JSON.stringify(subject)),
      ]) {
        assert.throws(
          () =>
            consumeAiChartD1PalaceWritingHumanReviewReportSubject(
              invalidCapability,
            ),
          AiChartD1PalaceWritingHumanReviewReportSubjectError,
        )
      }
      assert.equal(
        consumeAiChartD1PalaceWritingHumanReviewReportSubject(
          subject,
        ),
        subject,
      )
      assert.throws(
        () =>
          consumeAiChartD1PalaceWritingHumanReviewReportSubject(
            subject,
          ),
        AiChartD1PalaceWritingHumanReviewReportSubjectError,
      )
    },
  )

  await check(
    'test lookup injection cannot replace the production repository outside tests',
    async () => {
      const mutableEnvironment = process.env as Record<
        string,
        string | undefined
      >
      const previousNodeEnvironment =
        mutableEnvironment.NODE_ENV
      let invocations = 0
      try {
        mutableEnvironment.NODE_ENV = 'production'
        await assert.rejects(
          () =>
            resolveAiChartD1PalaceWritingHumanReviewReportSubject(
              { reportId: REPORT_ID },
              {
                lookupReportReviewSubject:
                  async () => {
                    invocations += 1
                    return resolvedRow()
                  },
              },
            ),
          (
            error: unknown,
          ) =>
            error instanceof
              AiChartD1PalaceWritingHumanReviewReportSubjectError &&
            error.code ===
              'REPORT_LOOKUP_UNAVAILABLE',
        )
      } finally {
        if (previousNodeEnvironment === undefined) {
          delete mutableEnvironment.NODE_ENV
        } else {
          mutableEnvironment.NODE_ENV =
            previousNodeEnvironment
        }
      }
      assert.equal(invocations, 0)
    },
  )

  await check(
    'failure taxonomy is a frozen closed allowlist',
    () => {
      assert.deepEqual(
        AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_REPORT_SUBJECT_FAILURE_CODES,
        [
          'REPORT_ID_INVALID',
          'REPORT_LOOKUP_UNAVAILABLE',
          'REPORT_NOT_FOUND',
          'REPORT_OWNER_INVALID',
          'REPORT_PAYMENT_REQUIRED',
          'REPORT_SNAPSHOT_INVALID',
        ],
      )
      assert.equal(
        Object.isFrozen(
          AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_REPORT_SUBJECT_FAILURE_CODES,
        ),
        true,
      )
    },
  )

  console.log(
    `AI Chart D1 palace-writing trusted Report subject: ${checks} checks passed`,
  )
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
