import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import {
  isDiagnosticExecutionFailure,
  runDiagnostic,
  toSafeFailureAttestation,
  validateCliArguments,
} from './run-line-pay-production-diagnostic.mjs'
import {
  DIAGNOSTIC_FILE,
  parseAndValidateMembershipDiagnosticOutput,
  readAndValidateDiagnosticFile,
  safeErrorCode,
} from './validate-line-pay-function-owner-membership-diagnostic.mjs'

export function runFunctionOwnerMembershipDiagnostic(options = {}) {
  return runDiagnostic({
    ...options,
    diagnosticFile: DIAGNOSTIC_FILE,
    applicationName:
      'line-pay-owner-membership-read-only-diagnostic',
    credentialPrefix: 'line-pay-owner-membership-',
    validateDiagnosticFile: readAndValidateDiagnosticFile,
    parseDiagnosticOutput: parseAndValidateMembershipDiagnosticOutput,
  })
}

async function main() {
  validateCliArguments(process.argv)
  const result = await runFunctionOwnerMembershipDiagnostic()
  console.log(JSON.stringify(result))
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : ''
if (invokedPath === import.meta.url) {
  main().catch((error) => {
    console.error(
      isDiagnosticExecutionFailure(error)
        ? JSON.stringify(toSafeFailureAttestation(error))
        : safeErrorCode(error),
    )
    process.exitCode = 1
  })
}
