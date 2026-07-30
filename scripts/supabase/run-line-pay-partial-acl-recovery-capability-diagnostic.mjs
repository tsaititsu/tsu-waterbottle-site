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
  parseAndValidateCapabilityDiagnosticOutput,
  readAndValidateDiagnosticFile,
  safeErrorCode,
} from './validate-line-pay-partial-acl-recovery-capability-diagnostic.mjs'

export function runPartialAclRecoveryCapabilityDiagnostic(options = {}) {
  return runDiagnostic({
    ...options,
    diagnosticFile: DIAGNOSTIC_FILE,
    applicationName:
      'line-pay-partial-acl-recovery-capability-read-only-diagnostic',
    credentialPrefix: 'line-pay-partial-acl-capability-',
    validateDiagnosticFile: readAndValidateDiagnosticFile,
    parseDiagnosticOutput: parseAndValidateCapabilityDiagnosticOutput,
  })
}

async function main() {
  validateCliArguments(process.argv)
  const result = await runPartialAclRecoveryCapabilityDiagnostic()
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
