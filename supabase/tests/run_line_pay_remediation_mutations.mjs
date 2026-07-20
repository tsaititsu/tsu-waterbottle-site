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

const mutations = [
  {
    name: 'reconciliation_qualified_request_state',
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
    apply(input) {
      return allowTerminalField(input, 'line_pay_enforce_attempt_transition', 'idempotency_key', this.name)
    },
  },
  {
    name: 'paid_attempt_request_body_sha256_freeze',
    apply(input) {
      return allowTerminalField(input, 'line_pay_enforce_attempt_transition', 'request_body_sha256', this.name)
    },
  },
  {
    name: 'paid_attempt_sanitized_result_freeze',
    apply(input) {
      return allowTerminalField(input, 'line_pay_enforce_attempt_transition', 'sanitized_result', this.name)
    },
  },
  {
    name: 'completed_callback_last_error_code_freeze',
    apply(input) {
      return allowTerminalField(input, 'line_pay_enforce_callback_event_transition', 'last_error_code', this.name)
    },
  },
  {
    name: 'consumed_capability_expires_at_freeze',
    apply(input) {
      return allowTerminalField(input, 'line_pay_enforce_callback_capability_transition', 'expires_at', this.name)
    },
  },
  {
    name: 'service_role_audit_direct_write_revoke',
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
    apply(input) {
      return removeRoleGuard(input, guardName, this.name)
    },
  })),
  {
    name: 'payment_method_constraint_semantic_guard',
    runner: 'conflict',
    scenario: 'constraint-unknown-value',
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
    name: 'provider_success_check',
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
    apply(input) {
      return replaceRequired(
        input,
        /  insert into public\.line_pay_payment_audit_events \(\n    payment_id,[\s\S]*?  \) returning id into v_audit_event_id;\n\n  insert into line_pay_private\.line_pay_completion_proofs/,
        "  v_audit_event_id := gen_random_uuid();\n\n  insert into line_pay_private.line_pay_completion_proofs",
        this.name,
      )
    },
  },
  {
    name: 'canceled_after_paid_protection',
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

const uncaught = []
const caught = []

try {
  for (const mutation of mutations) {
    if (selectedMutation !== null && selectedMutation !== mutation.name) continue
    const mutated = mutation.apply(source)
    const mutationFile = join(tempDirectory, `${mutation.name}.sql`)
    tempFiles.push(mutationFile)
    writeFileSync(mutationFile, mutated, { encoding: 'utf8', mode: 0o600 })

    const selectedRunner = mutation.runner === 'conflict' ? conflictRunner : contractRunner
    const scenarios = mutation.scenarios ?? [mutation.scenario ?? null]
    let mutationWasCaught = true

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
        },
        maxBuffer: 16 * 1024 * 1024,
      })

      if (result.status === 0) {
        mutationWasCaught = false
        break
      }

      if (mutation.expectFindingAGuardMutation) {
        const expectedMarker = `FINDING_A_GUARD_MUTATION_CAUGHT:${scenario}:unsafe_non_check_replacement`
        const combinedOutput = `${result.stdout}\n${result.stderr}`
        if (!combinedOutput.includes(expectedMarker)) {
          throw new Error(
            `INVALID_MUTATION_CATCH_REASON: ${mutation.name}/${scenario}\n${combinedOutput.slice(-2000)}`,
          )
        }
      }
    }

    if (mutationWasCaught) caught.push(mutation.name)
    else uncaught.push(mutation.name)
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
    })
    if (mutableImageResult.status === 0) uncaught.push('postgres_mutable_tag')
    else caught.push('postgres_mutable_tag')
  }

  if (selectedMutation !== null && caught.length + uncaught.length !== 1) {
    throw new Error(`UNKNOWN_LINE_PAY_MUTATION_SCENARIO: ${selectedMutation}`)
  }

  if (uncaught.length > 0) {
    throw new Error(`UNCAUGHT_LINE_PAY_MUTATIONS: ${uncaught.join(',')}`)
  }

  process.stdout.write(
    `line_pay_remediation_mutations: PASS (${caught.length}/${selectedMutation === null ? mutations.length + 1 : 1} caught)\n`,
  )
} finally {
  for (const file of tempFiles) {
    if (existsSync(file)) unlinkSync(file)
  }
  if (existsSync(tempDirectory)) rmdirSync(tempDirectory)
}
