import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import {
  DEPLOYMENT_RECORDING_POLICY,
  runFixedDatabasePhase,
  safeFailureOutput,
} from './run-line-pay-production-exact-file.mjs'
import {
  BASE_MIGRATION_FILE,
  DEPLOY_FILE,
  DIAGNOSTIC_FILE,
  EXPECTED_BASE_MIGRATION_SHA256,
  EXPECTED_DEPLOY_SHA256,
  EXPECTED_DIAGNOSTIC_SHA256,
  EXPECTED_FENCE_MIGRATION_SHA256,
  EXPECTED_MIGRATION_SHA256,
  EXPECTED_POSTFLIGHT_SHA256,
  EXPECTED_PREFLIGHT_SHA256,
  FENCE_MIGRATION_FILE,
  MIGRATION_FILE,
  POSTFLIGHT_FILE,
  PREFLIGHT_FILE,
  parseAndValidateInitializerDeployOutput,
  parseAndValidateInitializerPreflightOutput,
} from './validate-line-pay-checkout-initializer-production.mjs'

function freezeAttestation(value) {
  for (const nested of Object.values(value)) {
    if (nested && typeof nested === 'object') {
      freezeAttestation(nested)
    }
  }
  return Object.freeze(value)
}

export function buildInitializerDeploySuccessAttestation(
  evidence,
  validatedPostflight,
) {
  return freezeAttestation({
    status: 'INITIALIZER_DEPLOYMENT_VALIDATED',
    deployment_recording_policy: DEPLOYMENT_RECORDING_POLICY,
    transaction_boundary_attestation: {
      migration_started_observed:
        evidence.migration_started_observed,
      migration_commit_observed:
        evidence.migration_commit_observed,
      postflight_started_observed:
        evidence.postflight_started_observed,
      postflight_state_observed:
        evidence.postflight_state_observed,
      postflight_commit_observed:
        evidence.postflight_commit_observed,
    },
    database_postflight_attestation: {
      status: validatedPostflight.status,
      application_state: validatedPostflight.application_state,
      base_remediation_ready:
        validatedPostflight.contracts.base_remediation_ready,
      initializer_exact:
        validatedPostflight.contracts.initializer_exact,
      checkout_initialized_audit_count:
        validatedPostflight.checkout_initialized_audit_count,
    },
  })
}

export const INITIALIZER_DATABASE_CONTRACT = Object.freeze({
  phaseFiles: Object.freeze({
    preflight: PREFLIGHT_FILE,
    deploy: DEPLOY_FILE,
  }),
  successMessages: Object.freeze({
    preflight: 'INITIALIZER_PREFLIGHT_VALIDATED',
    deploy: 'INITIALIZER_DEPLOYMENT_VALIDATED',
  }),
  fixedFiles: Object.freeze([
    Object.freeze({
      path: MIGRATION_FILE,
      sha256: EXPECTED_MIGRATION_SHA256,
    }),
    Object.freeze({
      path: BASE_MIGRATION_FILE,
      sha256: EXPECTED_BASE_MIGRATION_SHA256,
    }),
    Object.freeze({
      path: FENCE_MIGRATION_FILE,
      sha256: EXPECTED_FENCE_MIGRATION_SHA256,
    }),
    Object.freeze({
      path: DIAGNOSTIC_FILE,
      sha256: EXPECTED_DIAGNOSTIC_SHA256,
    }),
    Object.freeze({
      path: PREFLIGHT_FILE,
      sha256: EXPECTED_PREFLIGHT_SHA256,
    }),
    Object.freeze({
      path: POSTFLIGHT_FILE,
      sha256: EXPECTED_POSTFLIGHT_SHA256,
    }),
    Object.freeze({
      path: DEPLOY_FILE,
      sha256: EXPECTED_DEPLOY_SHA256,
    }),
  ]),
  parsePreflightOutput: parseAndValidateInitializerPreflightOutput,
  parseDeployOutput: parseAndValidateInitializerDeployOutput,
  buildDeploySuccessAttestation:
    buildInitializerDeploySuccessAttestation,
})

const SAFE_INITIALIZER_FAILURE_CODES = new Set([
  'INITIALIZER_ALREADY_PRESENT',
  'INITIALIZER_BASE_CONTRACT_MISSING',
  'INITIALIZER_DATA_DRIFT',
  'INITIALIZER_DATABASE_IDENTITY_MISMATCH',
  'INITIALIZER_DIAGNOSTIC_OUTPUT_INVALID',
  'INITIALIZER_PARTIAL_APPLICATION',
  'INITIALIZER_POSTFLIGHT_CONTRACT_FAILED',
])

export function runInitializerDatabasePhase(phase, options = {}) {
  return runFixedDatabasePhase(
    phase,
    INITIALIZER_DATABASE_CONTRACT,
    options,
  )
}

export function safeInitializerFailureOutput(error) {
  const inherited = safeFailureOutput(error)
  if (
    inherited.startsWith('{') ||
    !(error instanceof Error) ||
    !SAFE_INITIALIZER_FAILURE_CODES.has(error.message)
  ) {
    return inherited
  }
  return error.message
}

async function main() {
  if (process.argv.length !== 3) {
    throw new Error('UNSUPPORTED_DATABASE_PHASE')
  }
  const result = await runInitializerDatabasePhase(process.argv[2])
  console.log(
    typeof result === 'string' ? result : JSON.stringify(result),
  )
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : ''
if (invokedPath === import.meta.url) {
  main().catch((error) => {
    console.error(safeInitializerFailureOutput(error))
    process.exitCode = 1
  })
}
