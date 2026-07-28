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
  EXPECTED_DIAGNOSTIC_SHA256,
  parseAndValidateInitializerOutput,
  safeErrorCode,
} from './validate-line-pay-checkout-initializer-production.mjs'
import { readAndValidateFixedFile } from './validate-line-pay-production-deployment.mjs'

export function runInitializerApplicationStateDiagnostic(options = {}) {
  return runDiagnostic({
    ...options,
    diagnosticFile: DIAGNOSTIC_FILE,
    applicationName:
      'line-pay-checkout-initializer-state-read-only-diagnostic',
    credentialPrefix: 'line-pay-checkout-initializer-state-',
    validateDiagnosticFile: (root) =>
      readAndValidateFixedFile(
        root,
        DIAGNOSTIC_FILE,
        EXPECTED_DIAGNOSTIC_SHA256,
      ),
    parseDiagnosticOutput: parseAndValidateInitializerOutput,
  })
}

async function main() {
  validateCliArguments(process.argv)
  const result = await runInitializerApplicationStateDiagnostic()
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
