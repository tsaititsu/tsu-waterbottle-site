import assert from 'node:assert/strict'
import Module, { createRequire } from 'node:module'

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

const authorizationModule =
  loadServerOnlyModule<
    typeof import(
      './d1PalaceWritingHumanReviewRequestAuthorization.server'
    )
  >(
    './d1PalaceWritingHumanReviewRequestAuthorization.server',
  )

const {
  AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_REQUEST_AUTHORIZATION_FAILURE_CODES,
  AiChartD1PalaceWritingHumanReviewRequestAuthorizationError,
  authorizeAiChartD1PalaceWritingHumanReviewRequest,
  consumeAiChartD1PalaceWritingHumanReviewRequestAuthorization,
} = authorizationModule

const REVIEWER_ID =
  '3e0ba27e-95f8-4c22-92b1-a42fb9bfaed9'
const REQUIRED_PERMISSION =
  'AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW'
const SENSITIVE_EMAIL =
  'private-reviewer@example.test'
const SENSITIVE_TOKEN =
  'sensitive-reviewer-bearer-token'

type AuthorizationDependencies = NonNullable<
  Parameters<
    typeof authorizeAiChartD1PalaceWritingHumanReviewRequest
  >[1]
>
type RequireAdmin = NonNullable<
  AuthorizationDependencies['requireAdmin']
>

function createRequest() {
  return new Request(
    'https://example.test/api/internal/ai-chart/review',
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${SENSITIVE_TOKEN}`,
      },
    },
  )
}

function authorized(
  userId = REVIEWER_ID,
): Awaited<ReturnType<RequireAdmin>> {
  return {
    supabase: {} as Awaited<
      ReturnType<RequireAdmin>
    > extends { supabase: infer T }
      ? T
      : never,
    user: {
      id: userId,
      email: SENSITIVE_EMAIL,
    },
  }
}

function denied(
  status: number,
): Awaited<ReturnType<RequireAdmin>> {
  return {
    error: new Response(null, {
      status,
    }) as never,
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
    'request-bound admin session grants one fixed review permission without retaining token or email',
    async () => {
      const request = createRequest()
      let invocations = 0
      const authorization =
        await authorizeAiChartD1PalaceWritingHumanReviewRequest(
          request,
          {
            requireAdmin: async (receivedRequest) => {
              invocations += 1
              assert.equal(receivedRequest, request)
              return authorized()
            },
          },
        )

      assert.equal(invocations, 1)
      assert.deepEqual(
        Object.keys(authorization),
        [
          'contractVersion',
          'task',
          'dataClassification',
          'reviewerId',
          'permission',
          'sessionBindingStatus',
          'authorizationPolicy',
          'capabilityScope',
          'productionCallable',
          'formalReviewRecordAllowed',
          'customerDeliveryAllowed',
          'openAiRequests',
          'authorizationFingerprint',
        ],
      )
      assert.equal(authorization.reviewerId, REVIEWER_ID)
      assert.equal(
        authorization.permission,
        REQUIRED_PERMISSION,
      )
      assert.equal(
        authorization.sessionBindingStatus,
        'REQUEST_BOUND_SERVER_VERIFIED',
      )
      assert.equal(
        authorization.authorizationPolicy,
        'EXISTING_SERVER_ADMIN_ALLOWLIST',
      )
      assert.equal(authorization.productionCallable, true)
      assert.equal(
        authorization.formalReviewRecordAllowed,
        false,
      )
      assert.equal(
        authorization.customerDeliveryAllowed,
        false,
      )
      assert.equal(authorization.openAiRequests, 0)
      assert.equal(Object.isFrozen(authorization), true)

      const serialized = JSON.stringify(authorization)
      assert.equal(serialized.includes(SENSITIVE_EMAIL), false)
      assert.equal(serialized.includes(SENSITIVE_TOKEN), false)
      assert.equal(
        serialized.includes('authorization'),
        true,
      )
    },
  )

  await check(
    'missing or invalid session and denied permission retain distinct fixed safe failures',
    async () => {
      const cases = [
        [401, 'REVIEWER_SESSION_INVALID'],
        [403, 'REVIEWER_PERMISSION_DENIED'],
        [500, 'AUTHORIZATION_ADAPTER_UNAVAILABLE'],
      ] as const

      for (const [status, expectedCode] of cases) {
        let caught: unknown
        try {
          await authorizeAiChartD1PalaceWritingHumanReviewRequest(
            createRequest(),
            {
              requireAdmin: async () => denied(status),
            },
          )
        } catch (error) {
          caught = error
        }
        assert.equal(
          caught instanceof
            AiChartD1PalaceWritingHumanReviewRequestAuthorizationError,
          true,
        )
        assert.equal(
          (
            caught as
              InstanceType<
                typeof AiChartD1PalaceWritingHumanReviewRequestAuthorizationError
              >
          ).code,
          expectedCode,
        )
        assert.equal(
          JSON.stringify(caught).includes(SENSITIVE_EMAIL),
          false,
        )
      }
    },
  )

  await check(
    'malformed reviewer identity and adapter exceptions fail closed without leaking provider text',
    async () => {
      const sensitiveMarker =
        'sensitive-auth-provider-message'
      for (const requireAdmin of [
        async () => authorized('not-a-uuid'),
        async () => {
          throw new Error(sensitiveMarker)
        },
      ] satisfies RequireAdmin[]) {
        let caught: unknown
        try {
          await authorizeAiChartD1PalaceWritingHumanReviewRequest(
            createRequest(),
            { requireAdmin },
          )
        } catch (error) {
          caught = error
        }
        assert.equal(
          caught instanceof
            AiChartD1PalaceWritingHumanReviewRequestAuthorizationError,
          true,
        )
        const serialized = JSON.stringify(caught)
        assert.equal(
          serialized.includes(sensitiveMarker),
          false,
        )
        assert.equal(
          String(caught).includes(sensitiveMarker),
          false,
        )
      }
    },
  )

  await check(
    'authorization capability requires the exact original object and is consumed once',
    async () => {
      const authorization =
        await authorizeAiChartD1PalaceWritingHumanReviewRequest(
          createRequest(),
          {
            requireAdmin: async () => authorized(),
          },
        )
      for (const invalidCapability of [
        { ...authorization },
        structuredClone(authorization),
        JSON.parse(JSON.stringify(authorization)),
      ]) {
        assert.throws(
          () =>
            consumeAiChartD1PalaceWritingHumanReviewRequestAuthorization(
              invalidCapability,
            ),
          AiChartD1PalaceWritingHumanReviewRequestAuthorizationError,
        )
      }
      assert.equal(
        consumeAiChartD1PalaceWritingHumanReviewRequestAuthorization(
          authorization,
        ),
        authorization,
      )
      assert.throws(
        () =>
          consumeAiChartD1PalaceWritingHumanReviewRequestAuthorization(
            authorization,
          ),
        AiChartD1PalaceWritingHumanReviewRequestAuthorizationError,
      )
    },
  )

  await check(
    'test dependency injection cannot replace the production authorization adapter outside tests',
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
            authorizeAiChartD1PalaceWritingHumanReviewRequest(
              createRequest(),
              {
                requireAdmin: async () => {
                  invocations += 1
                  return authorized()
                },
              },
            ),
          (
            error: unknown,
          ) =>
            error instanceof
              AiChartD1PalaceWritingHumanReviewRequestAuthorizationError &&
            error.code ===
              'AUTHORIZATION_ADAPTER_UNAVAILABLE',
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
        AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_REQUEST_AUTHORIZATION_FAILURE_CODES,
        [
          'AUTHORIZATION_ADAPTER_UNAVAILABLE',
          'REVIEWER_SESSION_INVALID',
          'REVIEWER_PERMISSION_DENIED',
          'REVIEWER_IDENTITY_INVALID',
        ],
      )
      assert.equal(
        Object.isFrozen(
          AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_REQUEST_AUTHORIZATION_FAILURE_CODES,
        ),
        true,
      )
    },
  )

  console.log(
    `AI Chart D1 palace-writing request-bound reviewer authorization: ${checks} checks passed`,
  )
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
