import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

import {
  isDiagnosticExecutionFailure,
  runDiagnostic,
  toSafeFailureAttestation,
  validateCliArguments,
} from './run-line-pay-production-diagnostic.mjs'
import {
  DIAGNOSTIC_FILE,
  parseAndValidateDiagnosticOutput,
  readAndValidateDiagnosticFile,
  safeErrorCode,
} from './validate-line-pay-application-state-diagnostic.mjs'

export function runApplicationStateDiagnostic(options = {}) {
  return runDiagnostic({
    ...options,
    diagnosticFile: DIAGNOSTIC_FILE,
    applicationName: 'line-pay-application-state-read-only-diagnostic',
    credentialPrefix: 'line-pay-application-state-',
    validateDiagnosticFile: readAndValidateDiagnosticFile,
    parseDiagnosticOutput: parseAndValidateDiagnosticOutput,
  })
}

async function main() {
  validateCliArguments(process.argv)
  const result = await runApplicationStateDiagnostic()
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
