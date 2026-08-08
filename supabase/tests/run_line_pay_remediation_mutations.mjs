import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const root = resolve(scriptDirectory, '../..')
const sourceMigration = join(
  root,
  'supabase/migrations/20260719033404_line_pay_remediation_contracts.sql',
)
const contractRunner = join(root, 'supabase/tests/run_line_pay_remediation_db_contracts.mjs')
const conflictRunner = join(root, 'supabase/tests/run_line_pay_second_remediation_conflicts.mjs')
const postgresImageContract = join(root, 'supabase/tests/line_pay_postgres_image.mjs')
const source = readFileSync(sourceMigration, 'utf8')
const selectedMutation = process.env.LINE_PAY_MUTATION_SCENARIO ?? null
const tempDirectory = mkdtempSync(join(tmpdir(), 'line-pay-remediation-mutations-'))
const tempFiles = []
const MUTATION_CHILD_TIMEOUT_MS = 120_000
const PROCESS_HARNESS_TIMEOUT_MS = 50

function replaceRequired(input, search, replacement, label) {
  const output = input.replace(search, replacement)
  if (output === input) throw new Error(`MUTATION_ANCHOR_NOT_FOUND: ${label}`)
  return output
}

function removeMatchingLines(input, patterns, label) {
  let output = input
  for (const pattern of patterns) {
    output = replaceRequired(output, pattern, '', label)
  }
  return output
}

function replaceInFunction(input, functionName, transform, label) {
  const marker = `create or replace function public.${functionName}(`
  const start = input.indexOf(marker)
  if (start < 0) throw new Error(`MUTATION_ANCHOR_NOT_FOUND: ${label}`)
  const end = input.indexOf('\n$$;', start)
  if (end < 0) throw new Error(`MUTATION_ANCHOR_NOT_FOUND: ${label}`)
  const section = input.slice(start, end + 4)
  const mutatedSection = transform(section)
  if (mutatedSection === section) throw new Error(`MUTATION_ANCHOR_NOT_FOUND: ${label}`)
  return input.slice(0, start) + mutatedSection + input.slice(end + 4)
}

function allowTerminalField(input, functionName, fieldName, label) {
  return replaceInFunction(
    input,
    functionName,
    (section) => section.replaceAll(
      "(pg_catalog.to_jsonb(new) - 'updated_at')",
      `(pg_catalog.to_jsonb(new) - array['updated_at', '${fieldName}']::text[])`,
    ).replaceAll(
      "(pg_catalog.to_jsonb(old) - 'updated_at')",
      `(pg_catalog.to_jsonb(old) - array['updated_at', '${fieldName}']::text[])`,
    ),
    label,
  )
}

function removeRoleGuard(input, guardName, label) {
  const marker = `    -- line_pay_role_guard:${guardName}`
  const start = input.indexOf(marker)
  if (start < 0) throw new Error(`MUTATION_ANCHOR_NOT_FOUND: ${label}`)
  const nextGuard = input.indexOf('    -- line_pay_role_guard:', start + marker.length)
  const loopEnd = input.indexOf('  end loop;', start)
  const end = nextGuard >= 0 && nextGuard < loopEnd ? nextGuard : loopEnd
  if (end < 0) throw new Error(`MUTATION_ANCHOR_NOT_FOUND: ${label}`)
  let output = input.slice(0, start) + input.slice(end)
  if (guardName === 'default_acl') {
    output = replaceRequired(
      output,
      /-- Default ACLs must be rejected before[\s\S]*?\n\$\$;\n\n(?=create or replace function public\.line_pay_sanitized_result_is_valid)/,
      '',
      label,
    )
  }
  return output
}

const INFRASTRUCTURE_FAILURE_MARKERS = [
  'ENOENT',
  'ENOBUFS',
  'ETIMEDOUT',
  'LOCAL_DB_RUNTIME_UNAVAILABLE',
  'LOCAL_DB_COMMAND_FAILED',
  'LOCAL_DB_COMMAND_TIMEOUT',
  'LOCAL_DB_OUTPUT_LIMIT_EXCEEDED',
  'LOCAL_DB_PROCESS_ERROR',
  'LOCAL_DB_PROCESS_SIGNAL',
  'LOCAL_DB_PROCESS_NO_EXIT_CODE',
  'POSTGRES_IMAGE_REPOSITORY_DIGEST_MISMATCH',
  'POSTGRES_IMAGE_MAJOR_VERSION_MISMATCH',
  'Cannot connect to the Docker daemon',
  'docker command not found',
  'no such image',
  'image pull failure',
  'failed to resolve reference',
  'TLS handshake timeout',
  'context deadline exceeded',
  'dial tcp',
  'network is unreachable',
  'temporary failure in name resolution',
  'i/o timeout',
  'connection refused',
  'child process timeout',
  'maxBuffer overflow',
  'process crash',
]

const SYNTAX_FAILURE_PATTERNS = [
  /\bSyntaxError\b/i,
  /JavaScript syntax error/i,
  /SQL syntax error/i,
  /\bsyntax error at or near\b/i,
  /\bsyntax error\b/i,
  /is not a known variable/i,
  /MUTATION_ANCHOR_NOT_FOUND/i,
  /UNKNOWN_LINE_PAY_MUTATION_SCENARIO/i,
  /UNKNOWN_LINE_PAY_CONFLICT_SCENARIO/i,
]

function findInfrastructureFailure(output) {
  const normalized = output.toLowerCase()
  return INFRASTRUCTURE_FAILURE_MARKERS.find((marker) =>
    normalized.includes(marker.toLowerCase()),
  ) ?? null
}

function findSyntaxFailure(output) {
  return SYNTAX_FAILURE_PATTERNS.find((pattern) => pattern.test(output))?.source ?? null
}

function classifyMutationExecution({ mutationName, scenario, expectedMarkers, result }) {
  const executionLabel = `${mutationName}/${scenario ?? 'default'}`
  const combinedOutput = `${result.stdout ?? ''}\n${result.stderr ?? ''}`

  if (result.error !== undefined) {
    return {
      classification: 'invalid',
      infrastructure: true,
      reason: `result.error:${result.error.code ?? result.error.name ?? 'unknown'}`,
    }
  }

  if (result.signal !== null) {
    return {
      classification: 'invalid',
      infrastructure: true,
      reason: `result.signal:${String(result.signal)}`,
    }
  }

  if (!Number.isInteger(result.status)) {
    return {
      classification: 'invalid',
      infrastructure: true,
      reason: `non_integer_exit_status:${String(result.status)}`,
    }
  }

  const infrastructureFailure = findInfrastructureFailure(combinedOutput)
  if (infrastructureFailure !== null) {
    return {
      classification: 'invalid',
      infrastructure: true,
      reason: `infrastructure:${infrastructureFailure}`,
    }
  }

  const syntaxFailure = findSyntaxFailure(combinedOutput)
  if (syntaxFailure !== null) {
    return {
      classification: 'invalid',
      infrastructure: false,
      reason: `syntax:${syntaxFailure}`,
    }
  }

  if (result.status === 0) {
    return {
      classification: 'uncaught',
      infrastructure: false,
      reason: `zero_exit_status:${executionLabel}`,
    }
  }

  const matchedMarker = expectedMarkers.find((marker) => combinedOutput.includes(marker))
  if (matchedMarker === undefined) {
    return {
      classification: 'invalid',
      infrastructure: false,
      reason: `missing_expected_marker:${executionLabel}`,
    }
  }

  return {
    classification: 'caught',
    infrastructure: false,
    reason: `expected_marker:${matchedMarker}`,
  }
}

function expectedMarkersFor(mutation, scenario) {
  if (mutation.expectedMarkersByScenario !== undefined) {
    return mutation.expectedMarkersByScenario[scenario] ?? []
  }
  return mutation.expectedMarkers ?? []
}

function validateMutationDefinitions(definitions) {
  const mutationNames = new Set()
  const scenarioKeys = new Set()
  const overlyBroadMarkers = new Set(['failed', 'error', 'denied'])

  for (const mutation of definitions) {
    assert.equal(mutationNames.has(mutation.name), false, `duplicate mutation name: ${mutation.name}`)
    mutationNames.add(mutation.name)

    const scenarios = mutation.scenarios ?? [mutation.scenario ?? null]
    for (const scenario of scenarios) {
      const scenarioKey = `${mutation.name}:${scenario ?? 'default'}`
      assert.equal(scenarioKeys.has(scenarioKey), false, `duplicate mutation scenario: ${scenarioKey}`)
      scenarioKeys.add(scenarioKey)

      const expectedMarkers = expectedMarkersFor(mutation, scenario)
      assert.ok(
        Array.isArray(expectedMarkers) && expectedMarkers.length > 0,
        `missing expected markers: ${scenarioKey}`,
      )
      for (const marker of expectedMarkers) {
        assert.equal(typeof marker, 'string', `non-string expected marker: ${scenarioKey}`)
        assert.ok(marker.trim().length >= 12, `expected marker is too short: ${scenarioKey}`)
        assert.equal(
          overlyBroadMarkers.has(marker.trim().toLowerCase()),
          false,
          `expected marker is too broad: ${scenarioKey}`,
        )
      }
    }
  }
}

function assertMutationClassifierHarness() {
  const expectedMarkers = ['LINE_PAY_TEST_SECURITY_MARKER:contract']
  const base = {
    error: undefined,
    signal: null,
    status: 1,
    stdout: '',
    stderr: '',
  }
  const invalidCases = [
    { ...base },
    { ...base, stderr: 'Cannot connect to the Docker daemon' },
    { ...base, status: null, signal: 'SIGTERM' },
    { ...base, error: Object.assign(new Error('missing executable'), { code: 'ENOENT' }) },
    { ...base, error: Object.assign(new Error('output overflow'), { code: 'ENOBUFS' }) },
    { ...base, error: Object.assign(new Error('child timeout'), { code: 'ETIMEDOUT' }) },
    { ...base, stderr: 'TLS handshake timeout' },
    { ...base, stderr: 'network is unreachable' },
    { ...base, stderr: 'JavaScript syntax error' },
    { ...base, stderr: 'SQL syntax error' },
    { ...base, stderr: 'ERROR: "v_audit_event_id" is not a known variable' },
    { ...base, stderr: 'MUTATION_ANCHOR_NOT_FOUND: synthetic' },
    {
      ...base,
      stdout: 'LINE_PAY_TEST_SECURITY_MARKER:contract',
      stderr: 'context deadline exceeded',
    },
    { ...base, status: '1', stdout: 'LINE_PAY_TEST_SECURITY_MARKER:contract' },
  ]

  for (const result of invalidCases) {
    assert.equal(
      classifyMutationExecution({
        mutationName: 'classifier_harness',
        scenario: null,
        expectedMarkers,
        result,
      }).classification,
      'invalid',
    )
  }

  assert.equal(
    classifyMutationExecution({
      mutationName: 'classifier_harness',
      scenario: null,
      expectedMarkers,
      result: { ...base, status: 0 },
    }).classification,
    'uncaught',
  )
  assert.equal(
    classifyMutationExecution({
      mutationName: 'classifier_harness',
      scenario: null,
      expectedMarkers,
      result: { ...base, stdout: 'LINE_PAY_TEST_SECURITY_MARKER:contract' },
    }).classification,
    'caught',
  )

  process.stdout.write(`LINE_PAY_MUTATION_HARNESS_CHECKS=${invalidCases.length}\n`)
  return { negativeChecks: invalidCases.length, positiveChecks: 1 }
}

function assertMutationProcessHarness() {
  const timedOutResult = spawnSync(
    process.execPath,
    ['-e', 'Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 60000)'],
    {
      cwd: root,
      encoding: 'utf8',
      timeout: PROCESS_HARNESS_TIMEOUT_MS,
      maxBuffer: 1024 * 1024,
    },
  )
  const classification = classifyMutationExecution({
    mutationName: 'process_timeout_harness',
    scenario: null,
    expectedMarkers: ['LINE_PAY_TEST_TIMEOUT_SECURITY_MARKER'],
    result: timedOutResult,
  })

  assert.equal(timedOutResult.error?.code, 'ETIMEDOUT')
  assert.equal(classification.classification, 'invalid')
  assert.equal(classification.infrastructure, true)
  process.stdout.write('LINE_PAY_MUTATION_PROCESS_HARNESS_CHECKS=1\n')

  return { timeoutChecks: 1 }
}

const mutations = [
  {
    name: 'reconciliation_qualified_request_state',
    expectedMarkers: ['column reference "request_state" is ambiguous'],
    apply(input) {
      return replaceInFunction(
        input,
        'mark_product_order_line_pay_reconciliation',
        (section) => replaceRequired(
          section,
          "when payment.request_state in ('paid', 'canceled') then payment.request_state",
          "when request_state in ('paid', 'canceled') then request_state",
          this.name,
        ),
        this.name,
      )
    },
  },
  {
    name: 'paid_attempt_idempotency_key_freeze',
    expectedMarkers: ['paid_attempt_idempotency_key_was_rewritten'],
    apply(input) {
      return allowTerminalField(input, 'line_pay_enforce_attempt_transition', 'idempotency_key', this.name)
    },
  },
  {
    name: 'paid_attempt_request_body_sha256_freeze',
    expectedMarkers: ['paid_attempt_request_body_sha256_was_rewritten'],
    apply(input) {
      return allowTerminalField(input, 'line_pay_enforce_attempt_transition', 'request_body_sha256', this.name)
    },
  },
  {
    name: 'paid_attempt_sanitized_result_freeze',
    expectedMarkers: ['paid_attempt_sanitized_result_was_rewritten'],
    apply(input) {
      return allowTerminalField(input, 'line_pay_enforce_attempt_transition', 'sanitized_result', this.name)
    },
  },
  {
    name: 'completed_callback_last_error_code_freeze',
    expectedMarkers: ['completed_callback_last_error_code_was_rewritten'],
    apply(input) {
      return allowTerminalField(input, 'line_pay_enforce_callback_event_transition', 'last_error_code', this.name)
    },
  },
  {
    name: 'consumed_capability_expires_at_freeze',
    expectedMarkers: ['consumed_capability_expires_at_was_rewritten'],
    apply(input) {
      return allowTerminalField(input, 'line_pay_enforce_callback_capability_transition', 'expires_at', this.name)
    },
  },
  {
    name: 'service_role_audit_direct_write_revoke',
    expectedMarkers: ['line_pay_audit_or_executor_dml_postcondition_failed'],
    apply(input) {
      return replaceRequired(
        input,
        'revoke all on table public.line_pay_payment_audit_events from service_role;',
        'grant select, insert, update, delete on table public.line_pay_payment_audit_events to service_role;',
        this.name,
      )
    },
  },
  {
    name: 'cancel_db_built_audit_evidence',
    expectedMarkers: ['cancel_db_built_evidence_contract_failed'],
    apply(input) {
      return replaceInFunction(
        input,
        'cancel_product_order_line_pay_payment',
        (section) => replaceRequired(
          section,
          /      pg_catalog\.jsonb_build_object\(\n        'result_code', 'cancel_after_paid',[\s\S]*?      end\n(?=    \);)/,
          "      pg_catalog.jsonb_build_object(\n        'result_code', p_reason_code,\n        'reason_code', p_reason_code\n      )\n",
          this.name,
        ),
        this.name,
      )
    },
  },
  {
    name: 'reconciliation_db_built_audit_evidence',
    expectedMarkers: ['reconciliation_db_built_evidence_contract_failed'],
    apply(input) {
      return replaceInFunction(
        input,
        'mark_product_order_line_pay_reconciliation',
        (section) => replaceRequired(
          section,
          /    pg_catalog\.jsonb_build_object\(\n      'result_code', 'reconciliation_required',[\s\S]*?      end\n(?=  \);)/,
          "    pg_catalog.jsonb_build_object(\n      'result_code', 'reconciliation_required',\n      'reason_code', p_reason_code\n    )\n",
          this.name,
        ),
        this.name,
      )
    },
  },
  {
    name: 'sensitive_rpc_overload_inventory',
    runner: 'conflict',
    scenario: 'unexpected-overload',
    expectedMarkersByScenario: {
      'unexpected-overload': ['line_pay_sensitive_rpc_overload_postcondition_failed'],
    },
    apply(input) {
      return replaceRequired(
        input,
        /-- This migration is the first and only creator[\s\S]*?\n\$\$;\n\n(?=do \$\$)/,
        '',
        this.name,
      )
    },
  },
  ...[
    ['attributes', 'executor-attributes'],
    ['membership', 'executor-outbound-membership'],
    ['database', 'executor-database-privilege'],
    ['schema', 'executor-schema-usage'],
    ['relation', 'owner-table-select'],
    ['sequence', 'executor-sequence-privilege'],
    ['function', 'owner-function-ownership'],
    ['type', 'executor-type-privilege'],
    ['default_acl', 'executor-default-privilege'],
  ].map(([guardName, scenario]) => ({
    name: `role_${guardName}_baseline_guard`,
    runner: 'conflict',
    scenario,
    expectedMarkersByScenario: {
      [scenario]: [`${scenario} did not fail closed with the expected error`],
    },
    apply(input) {
      return removeRoleGuard(input, guardName, this.name)
    },
  })),
  {
    name: 'payment_method_constraint_semantic_guard',
    runner: 'conflict',
    scenario: 'constraint-unknown-value',
    expectedMarkersByScenario: {
      'constraint-unknown-value': [
        'constraint-unknown-value did not fail closed with the expected error',
      ],
    },
    apply(input) {
      return replaceRequired(
        input,
        /-- Guard every same-name constraint type[\s\S]*?\n\$\$;\n\n(?=-- Default ACLs must be rejected)/,
        '',
        this.name,
      )
    },
  },
  {
    name: 'same_name_non_check_constraint_guard',
    runner: 'conflict',
    scenarios: [
      'constraint-unique',
      'constraint-primary-key',
      'constraint-foreign-key',
      'constraint-exclude',
    ],
    expectedMarkersByScenario: {
      'constraint-unique': [
        'FINDING_A_GUARD_MUTATION_CAUGHT:constraint-unique:unsafe_non_check_replacement',
      ],
      'constraint-primary-key': [
        'FINDING_A_GUARD_MUTATION_CAUGHT:constraint-primary-key:unsafe_non_check_replacement',
      ],
      'constraint-foreign-key': [
        'FINDING_A_GUARD_MUTATION_CAUGHT:constraint-foreign-key:unsafe_non_check_replacement',
      ],
      'constraint-exclude': [
        'FINDING_A_GUARD_MUTATION_CAUGHT:constraint-exclude:unsafe_non_check_replacement',
      ],
    },
    expectFindingAGuardMutation: true,
    apply(input) {
      return replaceRequired(
        input,
        `  where constraint_row.conrelid = v_relation_oid
    and constraint_row.conname = 'product_orders_payment_method_check';

  if v_constraint_count > 1 then`,
        `  where constraint_row.conrelid = v_relation_oid
    and constraint_row.conname = 'product_orders_payment_method_check'
    and constraint_row.contype = 'c';

  if v_constraint_count > 1 then`,
        this.name,
      )
    },
  },
  {
    name: 'payment_method_relation_lock',
    runner: 'conflict',
    scenario: 'relation-lock-commit',
    expectedMarkersByScenario: {
      'relation-lock-commit': [
        'RELATION_LOCK_MUTATION_CAUGHT:unsafe_concurrent_constraint_replacement',
      ],
    },
    expectRelationLockMutation: true,
    apply(input) {
      return replaceRequired(
        input,
        'lock table public.product_orders in access exclusive mode;\n',
        '',
        this.name,
      )
    },
  },
  {
    name: 'provider_success_check',
    expectedMarkers: ['non_success_provider_outcome_was_accepted_failed'],
    apply(input) {
      let output = replaceRequired(
        input,
        "     or p_safe_result_code <> '0000'\n",
        '',
        this.name,
      )
      output = replaceRequired(
        output,
        /  if new\.state = 'provider_verified' and \(\n    new\.safe_result_code <> '0000'\n    or new\.provider_result_sha256 is null\n  \) then[\s\S]*?  end if;\n/,
        '',
        this.name,
      )
      return output
    },
  },
  {
    name: 'provider_evidence_hash_check',
    expectedMarkers: ['line_pay_confirmation_callback_event_update_failed'],
    apply(input) {
      return removeMatchingLines(input, [
        /\s+or v_callback_event\.provider_result_sha256 <> p_confirm_result_sha256(?= then)/,
        "      and callback_event.provider_result_sha256 = new.provider_result_sha256\n",
        "           and proof.provider_result_sha256 = new.provider_result_sha256\n",
      ], this.name)
    },
  },
  {
    name: 'completion_proof_requirement',
    expectedMarkers: ['service_role_direct_pending_to_paid_was_accepted'],
    apply(input) {
      return replaceRequired(
        input,
        /  if \(old\.status <> 'paid' or old\.request_state is distinct from 'paid'\)[\s\S]*?        message = 'line_pay_paid_payment_completion_proof_required';\n    end if;\n  end if;\n/,
        '',
        this.name,
      )
    },
  },
  {
    name: 'service_role_execute_revoke',
    expectedMarkers: ['line_pay_sensitive_rpc_security_postcondition_failed'],
    apply(input) {
      return replaceRequired(
        input,
        ") to line_pay_payment_executor;\ngrant execute on function public.cancel_product_order_line_pay_payment(",
        ") to line_pay_payment_executor, service_role;\ngrant execute on function public.cancel_product_order_line_pay_payment(",
        this.name,
      )
    },
  },
  {
    name: 'service_role_proof_table_revoke',
    expectedMarkers: ['service_role_has_completion_proof_dml'],
    apply(input) {
      return replaceRequired(
        input,
        'grant select on table line_pay_private.line_pay_completion_proofs to service_role;',
        'grant select, insert on table line_pay_private.line_pay_completion_proofs to service_role;',
        this.name,
      )
    },
  },
  {
    name: 'paid_evidence_immutability_trigger',
    expectedMarkers: ['paid_payment_transaction_was_rewritten'],
    apply(input) {
      return replaceRequired(
        input,
        /  if old\.status = 'paid' and \([\s\S]*?      message = 'line_pay_paid_payment_evidence_is_immutable';\n  end if;\n/,
        '',
        this.name,
      )
    },
  },
  {
    name: 'environment_binding',
    expectedMarkers: ['environment_mismatch_was_accepted'],
    apply(input) {
      return removeMatchingLines(input, [
        /^\s+or v_payment\.environment <> p_environment\n/gm,
        /^\s+or v_order\.environment <> p_environment\n/gm,
        /^\s+or v_attempt\.environment <> p_environment\n/gm,
        /^\s+or v_capability\.environment <> p_environment\n/gm,
        /^\s+or v_callback_event\.environment <> p_environment\n/gm,
        /^\s+and payment\.environment = new\.environment\n/gm,
        /^\s+and product_order\.environment = new\.environment\n/gm,
        /^\s+and attempt\.environment = new\.environment\n/gm,
        /^\s+and capability\.environment = new\.environment\n/gm,
        /^\s+and callback_event\.environment = new\.environment\n/gm,
        /^\s+and proof\.environment = new\.environment\n/gm,
      ], this.name)
    },
  },
  {
    name: 'transaction_id_binding',
    expectedMarkers: ['different_transaction_after_paid_was_accepted'],
    apply(input) {
      return removeMatchingLines(input, [
        /^\s+or v_payment\.line_pay_transaction_id <> p_transaction_id\n/gm,
        /^\s+or v_attempt\.upstream_transaction_id <> p_transaction_id\n/gm,
        /^\s+and proof\.transaction_id = p_transaction_id\n/gm,
      ], this.name).replace(
        "    if v_payment.provider_trade_no <> p_transaction_id\n",
        '    if false\n',
      )
    },
  },
  {
    name: 'amount_binding',
    expectedMarkers: ['amount_mismatch_was_accepted'],
    apply(input) {
      return removeMatchingLines(input, [
        /^\s+or v_payment\.amount_twd <> p_amount_twd\n/gm,
        /^\s+or v_order\.total_amount_twd <> p_amount_twd\n/gm,
        /^\s+or v_attempt\.amount_twd <> p_amount_twd\n/gm,
        /^\s+and payment\.amount_twd = new\.amount_twd\n/gm,
        /^\s+and product_order\.total_amount_twd = new\.amount_twd\n/gm,
        /^\s+and attempt\.amount_twd = new\.amount_twd\n/gm,
        /^\s+and proof\.amount_twd = new\.amount_twd\n/gm,
        /^\s+and proof\.amount_twd = new\.total_amount_twd\n/gm,
      ], this.name)
    },
  },
  {
    name: 'capability_consume',
    expectedMarkers: ['line_pay_confirmation_paid_evidence_conflict'],
    apply(input) {
      return replaceRequired(
        input,
        /  update public\.line_pay_callback_capabilities\n  set consumed_at = v_completed_at[\s\S]*?      message = 'line_pay_confirmation_capability_consume_failed';\n  end if;\n/,
        '',
        this.name,
      )
    },
  },
  {
    name: 'audit_atomicity',
    expectedMarkers: ['line_pay_completion_proof_contract_mismatch'],
    apply(input) {
      return replaceInFunction(
        input,
        'complete_product_order_line_pay_confirmation',
        (section) => replaceRequired(
          section,
          /  insert into public\.line_pay_payment_audit_events \(\n    payment_id,[\s\S]*?  \) returning id into v_audit_event_id;\n\n(?=  insert into line_pay_private\.line_pay_completion_proofs)/,
          '  v_audit_event_id := gen_random_uuid();\n\n',
          this.name,
        ),
        this.name,
      )
    },
  },
  {
    name: 'canceled_after_paid_protection',
    expectedMarkers: ['line_pay_cancel_invalid_state'],
    apply(input) {
      const marker = 'create or replace function public.cancel_product_order_line_pay_payment('
      const markerIndex = input.indexOf(marker)
      if (markerIndex < 0) throw new Error(`MUTATION_ANCHOR_NOT_FOUND: ${this.name}`)
      const prefix = input.slice(0, markerIndex)
      const suffix = input.slice(markerIndex)
      const mutatedSuffix = replaceRequired(
        suffix,
        "  if v_payment.status = 'paid' then\n",
        '  if false then\n',
        this.name,
      )
      return prefix + mutatedSuffix.replaceAll(
        "  if v_payment.status = 'paid' then\n",
        '  if false then\n',
      )
    },
  },
]

const postgresMutableTagMutation = {
  name: 'postgres_mutable_tag',
  expectedMarkers: ['LINE_PAY_POSTGRES_IMAGE_MUST_USE_REVIEWED_OFFICIAL_DIGEST'],
}

const uncaught = []
const caught = []
const invalidMutations = []
const invalidCatches = []
let infrastructureFailures = 0
let scenarioCaught = 0
let scenarioTotal = 0
let classifierHarness
let processHarness

try {
  validateMutationDefinitions([...mutations, postgresMutableTagMutation])
  classifierHarness = assertMutationClassifierHarness()
  processHarness = assertMutationProcessHarness()

  for (const mutation of mutations) {
    if (selectedMutation !== null && selectedMutation !== mutation.name) continue
    const mutated = mutation.apply(source)
    const mutationFile = join(tempDirectory, `${mutation.name}.sql`)
    tempFiles.push(mutationFile)
    writeFileSync(mutationFile, mutated, { encoding: 'utf8', mode: 0o600 })

    const selectedRunner = mutation.runner === 'conflict' ? conflictRunner : contractRunner
    const scenarios = mutation.scenarios ?? [mutation.scenario ?? null]
    let mutationClassification = 'caught'

    for (const scenario of scenarios) {
      const result = spawnSync(process.execPath, [selectedRunner], {
        cwd: root,
        encoding: 'utf8',
        env: {
          ...process.env,
          LINE_PAY_MIGRATION_UNDER_TEST: mutationFile,
          ...(scenario ? { LINE_PAY_CONFLICT_SCENARIO: scenario } : {}),
          ...(mutation.expectFindingAGuardMutation
            ? { LINE_PAY_EXPECT_FINDING_A_MUTATION: '1' }
            : {}),
          ...(mutation.expectRelationLockMutation
            ? { LINE_PAY_EXPECT_RELATION_LOCK_MUTATION: '1' }
            : {}),
        },
        maxBuffer: 16 * 1024 * 1024,
        timeout: MUTATION_CHILD_TIMEOUT_MS,
      })
      const classification = classifyMutationExecution({
        mutationName: mutation.name,
        scenario,
        expectedMarkers: expectedMarkersFor(mutation, scenario),
        result,
      })
      scenarioTotal += 1

      if (classification.classification === 'caught') {
        scenarioCaught += 1
      } else if (classification.classification === 'uncaught') {
        mutationClassification = 'uncaught'
      } else {
        mutationClassification = 'invalid'
        invalidCatches.push(`${mutation.name}/${scenario ?? 'default'}:${classification.reason}`)
        if (classification.infrastructure) infrastructureFailures += 1
      }
    }

    if (mutationClassification === 'caught') caught.push(mutation.name)
    else if (mutationClassification === 'uncaught') uncaught.push(mutation.name)
    else invalidMutations.push(mutation.name)
  }

  if (selectedMutation === null || selectedMutation === 'postgres_mutable_tag') {
    const mutableImageMutation = readFileSync(postgresImageContract, 'utf8').replace(
      'postgres@sha256:742f40ea20b9ff2ff31db5458d127452988a2164df9e17441e191f3b72252193',
      'postgres:17-alpine',
    )
    if (mutableImageMutation === readFileSync(postgresImageContract, 'utf8')) {
      throw new Error('MUTATION_ANCHOR_NOT_FOUND: postgres_mutable_tag')
    }
    const mutableImageFile = join(tempDirectory, 'postgres_mutable_tag.mjs')
    tempFiles.push(mutableImageFile)
    writeFileSync(mutableImageFile, mutableImageMutation, { encoding: 'utf8', mode: 0o600 })
    const mutableImageResult = spawnSync(process.execPath, [mutableImageFile], {
      cwd: root,
      encoding: 'utf8',
      timeout: MUTATION_CHILD_TIMEOUT_MS,
      maxBuffer: 16 * 1024 * 1024,
    })
    const classification = classifyMutationExecution({
      mutationName: postgresMutableTagMutation.name,
      scenario: null,
      expectedMarkers: postgresMutableTagMutation.expectedMarkers,
      result: mutableImageResult,
    })
    scenarioTotal += 1

    if (classification.classification === 'caught') {
      caught.push(postgresMutableTagMutation.name)
      scenarioCaught += 1
    } else if (classification.classification === 'uncaught') {
      uncaught.push(postgresMutableTagMutation.name)
    } else {
      invalidMutations.push(postgresMutableTagMutation.name)
      invalidCatches.push(
        `${postgresMutableTagMutation.name}/default:${classification.reason}`,
      )
      if (classification.infrastructure) infrastructureFailures += 1
    }
  }

  if (
    selectedMutation !== null
    && caught.length + uncaught.length + invalidMutations.length !== 1
  ) {
    throw new Error(`UNKNOWN_LINE_PAY_MUTATION_SCENARIO: ${selectedMutation}`)
  }

  const expectedMutationTotal = selectedMutation === null ? mutations.length + 1 : 1
  process.stdout.write(`LINE_PAY_MUTATION_TOTAL=${expectedMutationTotal}\n`)
  process.stdout.write(`LINE_PAY_MUTATION_CAUGHT=${caught.length}\n`)
  process.stdout.write(`LINE_PAY_MUTATION_UNCAUGHT=${uncaught.length}\n`)
  process.stdout.write(`LINE_PAY_MUTATION_INVALID_CATCHES=${invalidCatches.length}\n`)
  process.stdout.write(
    `LINE_PAY_MUTATION_INFRASTRUCTURE_FAILURES=${infrastructureFailures}\n`,
  )
  process.stdout.write(`LINE_PAY_MUTATION_SCENARIO_TOTAL=${scenarioTotal}\n`)
  process.stdout.write(`LINE_PAY_MUTATION_SCENARIO_CAUGHT=${scenarioCaught}\n`)
  process.stdout.write(
    `LINE_PAY_MUTATION_HARNESS_POSITIVE_CHECKS=${classifierHarness.positiveChecks}\n`,
  )
  process.stdout.write(
    `LINE_PAY_MUTATION_PROCESS_TIMEOUT_CHECKS=${processHarness.timeoutChecks}\n`,
  )

  if (invalidCatches.length > 0) {
    throw new Error(`INVALID_MUTATION_CATCH_REASON: ${invalidCatches.join(',')}`)
  }
  if (uncaught.length > 0) {
    throw new Error(`UNCAUGHT_LINE_PAY_MUTATIONS: ${uncaught.join(',')}`)
  }

  process.stdout.write(
    `line_pay_remediation_mutations: PASS (${caught.length}/${expectedMutationTotal} caught; scenarios ${scenarioCaught}/${scenarioTotal}; invalid catches 0; infrastructure failures 0)\n`,
  )
} finally {
  for (const file of tempFiles) {
    if (existsSync(file)) unlinkSync(file)
  }
  if (existsSync(tempDirectory)) rmdirSync(tempDirectory)
}
