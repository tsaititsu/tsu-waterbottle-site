import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import {
  DEPLOYMENT_RECORDING_POLICY,
  runFixedDatabasePhase,
  safeFailureOutput,
} from './run-line-pay-production-exact-file.mjs'
import {
  DEPLOY_FILE,
  EXPECTED_DEPLOY_SHA256,
  EXPECTED_MIGRATION_SHA256,
  EXPECTED_POSTFLIGHT_SHA256,
  EXPECTED_PREFLIGHT_SHA256,
  MIGRATION_FILE,
  POSTFLIGHT_FILE,
  PREFLIGHT_FILE,
  parseDeployOutput,
  parsePreflightOutput,
} from './validate-service-line-pay-checkout-production.mjs'

function freeze(value) {
  for (const nested of Object.values(value)) {
    if (nested && typeof nested === 'object') freeze(nested)
  }
  return Object.freeze(value)
}

export function buildServiceCheckoutDeployAttestation(
  evidence,
  postflight,
) {
  return freeze({
    status: 'SERVICE_CHECKOUT_DEPLOYMENT_VALIDATED',
    deployment_recording_policy: DEPLOYMENT_RECORDING_POLICY,
    transaction_boundary_attestation: {
      migration_started_observed: evidence.migration_started_observed,
      migration_commit_observed: evidence.migration_commit_observed,
      postflight_started_observed: evidence.postflight_started_observed,
      postflight_state_observed: evidence.postflight_state_observed,
      postflight_commit_observed: evidence.postflight_commit_observed,
    },
    database_postflight_attestation: {
      status: postflight.status,
      service_checkout_contract_ready:
        postflight.status === 'postflight_ready',
    },
  })
}

export const SERVICE_CHECKOUT_DATABASE_CONTRACT = Object.freeze({
  phaseFiles: Object.freeze({
    preflight: PREFLIGHT_FILE,
    deploy: DEPLOY_FILE,
  }),
  successMessages: Object.freeze({
    preflight: 'SERVICE_CHECKOUT_PREFLIGHT_VALIDATED',
    deploy: 'SERVICE_CHECKOUT_DEPLOYMENT_VALIDATED',
  }),
  fixedFiles: Object.freeze([
    Object.freeze({
      path: MIGRATION_FILE,
      sha256: EXPECTED_MIGRATION_SHA256,
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
  parsePreflightOutput,
  parseDeployOutput,
  buildDeploySuccessAttestation: buildServiceCheckoutDeployAttestation,
})

export function runServiceCheckoutDatabasePhase(phase, options = {}) {
  return runFixedDatabasePhase(
    phase,
    SERVICE_CHECKOUT_DATABASE_CONTRACT,
    options,
  )
}

async function main() {
  if (process.argv.length !== 3) {
    throw new Error('UNSUPPORTED_DATABASE_PHASE')
  }
  const result = await runServiceCheckoutDatabasePhase(process.argv[2])
  console.log(
    typeof result === 'string' ? result : JSON.stringify(result),
  )
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : ''
if (invokedPath === import.meta.url) {
  main().catch((error) => {
    console.error(safeFailureOutput(error))
    process.exitCode = 1
  })
}
