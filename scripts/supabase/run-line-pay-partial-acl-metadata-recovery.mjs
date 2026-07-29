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
  EXPECTED_PREFLIGHT_SHA256,
  EXPECTED_RECOVERY_MIGRATION_SHA256,
  FENCE_MIGRATION_FILE,
  PREFLIGHT_FILE,
  RECOVERY_MIGRATION_FILE,
  parseAndValidateRecoveryDeployOutput,
  parseAndValidateRecoveryPreflightOutput,
} from './validate-line-pay-partial-acl-metadata-recovery.mjs'

function freezeAttestation(value) {
  for (const nested of Object.values(value)) {
    if (nested && typeof nested === 'object') freezeAttestation(nested)
  }
  return Object.freeze(value)
}

export function buildPartialRecoveryDeploySuccessAttestation(
  evidence,
  validatedPostflight,
) {
  return freezeAttestation({
    status: 'PARTIAL_RECOVERY_DEPLOYMENT_VALIDATED',
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
      migration_history_version_present:
        validatedPostflight.migration_history.version_present,
      incomplete_categories:
        validatedPostflight.details.incomplete_categories.length,
      relation_metadata_details:
        validatedPostflight.details.relation_metadata.length,
      existing_relation_access_details:
        validatedPostflight.details.existing_relation_access.length,
    },
  })
}

export const PARTIAL_RECOVERY_DATABASE_CONTRACT = Object.freeze({
  phaseFiles: Object.freeze({
    preflight: PREFLIGHT_FILE,
    deploy: DEPLOY_FILE,
  }),
  successMessages: Object.freeze({
    preflight: 'PARTIAL_RECOVERY_PREFLIGHT_VALIDATED',
    deploy: 'PARTIAL_RECOVERY_DEPLOYMENT_VALIDATED',
  }),
  fixedFiles: Object.freeze([
    Object.freeze({
      path: RECOVERY_MIGRATION_FILE,
      sha256: EXPECTED_RECOVERY_MIGRATION_SHA256,
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
      path: DEPLOY_FILE,
      sha256: EXPECTED_DEPLOY_SHA256,
    }),
  ]),
  parsePreflightOutput: parseAndValidateRecoveryPreflightOutput,
  parseDeployOutput: parseAndValidateRecoveryDeployOutput,
  buildDeploySuccessAttestation:
    buildPartialRecoveryDeploySuccessAttestation,
})

const SAFE_PARTIAL_RECOVERY_FAILURE_CODES = new Set([
  'APPLICATION_STATE_DIAGNOSTIC_OUTPUT_INVALID',
  'LINE_PAY_PARTIAL_RECOVERY_POSTFLIGHT_NOT_FULL',
  'LINE_PAY_PARTIAL_RECOVERY_PREFLIGHT_STATE_INVALID',
])

export function runPartialRecoveryDatabasePhase(phase, options = {}) {
  return runFixedDatabasePhase(
    phase,
    PARTIAL_RECOVERY_DATABASE_CONTRACT,
    options,
  )
}

export function safePartialRecoveryFailureOutput(error) {
  const inherited = safeFailureOutput(error)
  if (
    inherited.startsWith('{') ||
    !(error instanceof Error) ||
    !SAFE_PARTIAL_RECOVERY_FAILURE_CODES.has(error.message)
  ) {
    return inherited
  }
  return error.message
}

async function main() {
  if (process.argv.length !== 3) {
    throw new Error('UNSUPPORTED_DATABASE_PHASE')
  }
  const result = await runPartialRecoveryDatabasePhase(process.argv[2])
  console.log(
    typeof result === 'string' ? result : JSON.stringify(result),
  )
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : ''
if (invokedPath === import.meta.url) {
  main().catch((error) => {
    console.error(safePartialRecoveryFailureOutput(error))
    process.exitCode = 1
  })
}
