import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import {
  DEPLOYMENT_RECORDING_POLICY,
  runFixedDatabasePhase,
  safeFailureOutput,
} from './run-line-pay-production-exact-file.mjs'
import {
  DEPLOY_FILE,
  DIAGNOSTIC_FILE,
  EXPECTED_DEPLOY_SHA256,
  EXPECTED_DIAGNOSTIC_SHA256,
  EXPECTED_MIGRATION_SHA256,
  EXPECTED_POSTFLIGHT_SHA256,
  EXPECTED_PREFLIGHT_SHA256,
  MIGRATION_FILE,
  POSTFLIGHT_FILE,
  PREFLIGHT_FILE,
  parseAndValidateAtomicDeployOutput,
  parseAndValidateAtomicPreflightOutput,
} from './validate-line-pay-atomic-confirmation-finalization-production.mjs'

function freeze(value) {
  for (const nested of Object.values(value)) {
    if (nested && typeof nested === 'object') freeze(nested)
  }
  return Object.freeze(value)
}

export function buildAtomicDeploySuccessAttestation(
  evidence,
  validatedPostflight,
) {
  return freeze({
    status: 'ATOMIC_FINALIZATION_DEPLOYMENT_VALIDATED',
    deployment_recording_policy: DEPLOYMENT_RECORDING_POLICY,
    transaction_boundary_attestation: {
      migration_started_observed: evidence.migration_started_observed,
      migration_commit_observed: evidence.migration_commit_observed,
      postflight_started_observed: evidence.postflight_started_observed,
      postflight_state_observed: evidence.postflight_state_observed,
      postflight_commit_observed: evidence.postflight_commit_observed,
    },
    database_postflight_attestation: {
      status: validatedPostflight.status,
      application_state: validatedPostflight.application_state,
      base_ready: validatedPostflight.contracts.base_ready,
      atomic_exact: validatedPostflight.contracts.atomic_exact,
      wrapper_acl_exact: validatedPostflight.contracts.wrapper_acl_exact,
      executor_privilege_exact:
        validatedPostflight.contracts.executor_privilege_exact,
    },
  })
}

export const ATOMIC_DATABASE_CONTRACT = Object.freeze({
  phaseFiles: Object.freeze({
    preflight: PREFLIGHT_FILE,
    deploy: DEPLOY_FILE,
  }),
  successMessages: Object.freeze({
    preflight: 'ATOMIC_FINALIZATION_PREFLIGHT_VALIDATED',
    deploy: 'ATOMIC_FINALIZATION_DEPLOYMENT_VALIDATED',
  }),
  fixedFiles: Object.freeze([
    Object.freeze({ path: MIGRATION_FILE, sha256: EXPECTED_MIGRATION_SHA256 }),
    Object.freeze({ path: DIAGNOSTIC_FILE, sha256: EXPECTED_DIAGNOSTIC_SHA256 }),
    Object.freeze({ path: PREFLIGHT_FILE, sha256: EXPECTED_PREFLIGHT_SHA256 }),
    Object.freeze({ path: POSTFLIGHT_FILE, sha256: EXPECTED_POSTFLIGHT_SHA256 }),
    Object.freeze({ path: DEPLOY_FILE, sha256: EXPECTED_DEPLOY_SHA256 }),
  ]),
  parsePreflightOutput: parseAndValidateAtomicPreflightOutput,
  parseDeployOutput: parseAndValidateAtomicDeployOutput,
  buildDeploySuccessAttestation: buildAtomicDeploySuccessAttestation,
})

const SAFE_ATOMIC_FAILURE_CODES = new Set([
  'ATOMIC_FINALIZATION_ALREADY_APPLIED',
  'ATOMIC_FINALIZATION_APPLICATION_STATE_INVALID',
  'ATOMIC_FINALIZATION_DATA_DRIFT',
  'ATOMIC_FINALIZATION_PARTIAL_APPLICATION',
  'ATOMIC_FINALIZATION_POSTFLIGHT_NOT_FULL',
  'ATOMIC_FINALIZATION_PREFLIGHT_NOT_UNAPPLIED',
])

export function runAtomicDatabasePhase(phase, options = {}) {
  return runFixedDatabasePhase(phase, ATOMIC_DATABASE_CONTRACT, options)
}

export function safeAtomicFailureOutput(error) {
  const inherited = safeFailureOutput(error)
  if (
    inherited.startsWith('{') ||
    !(error instanceof Error) ||
    !SAFE_ATOMIC_FAILURE_CODES.has(error.message)
  ) {
    return inherited
  }
  return error.message
}

async function main() {
  if (process.argv.length !== 3) {
    throw new Error('UNSUPPORTED_DATABASE_PHASE')
  }
  const result = await runAtomicDatabasePhase(process.argv[2])
  console.log(typeof result === 'string' ? result : JSON.stringify(result))
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : ''
if (invokedPath === import.meta.url) {
  main().catch((error) => {
    console.error(safeAtomicFailureOutput(error))
    process.exitCode = 1
  })
}
