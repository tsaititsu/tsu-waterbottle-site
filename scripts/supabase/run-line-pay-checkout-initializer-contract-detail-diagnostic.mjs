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
  parseAndValidateContractDetailOutput,
  readAndValidateDiagnosticFile,
  safeErrorCode,
} from './validate-line-pay-checkout-initializer-contract-detail-diagnostic.mjs'

export function runCheckoutInitializerContractDetailDiagnostic(
  options = {},
) {
  return runDiagnostic({
    ...options,
    diagnosticFile: DIAGNOSTIC_FILE,
    applicationName:
      'line-pay-checkout-initializer-detail-read-only-diagnostic',
    credentialPrefix: 'line-pay-initializer-detail-',
    validateDiagnosticFile: readAndValidateDiagnosticFile,
    parseDiagnosticOutput: parseAndValidateContractDetailOutput,
  })
}

async function main() {
  validateCliArguments(process.argv)
  const result =
    await runCheckoutInitializerContractDetailDiagnostic()
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
