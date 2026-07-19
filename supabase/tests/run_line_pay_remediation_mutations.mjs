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
const source = readFileSync(sourceMigration, 'utf8')
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

const mutations = [
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
    const mutated = mutation.apply(source)
    const mutationFile = join(tempDirectory, `${mutation.name}.sql`)
    tempFiles.push(mutationFile)
    writeFileSync(mutationFile, mutated, { encoding: 'utf8', mode: 0o600 })

    const result = spawnSync(process.execPath, [contractRunner], {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...process.env,
        LINE_PAY_MIGRATION_UNDER_TEST: mutationFile,
      },
      maxBuffer: 16 * 1024 * 1024,
    })

    if (result.status === 0) uncaught.push(mutation.name)
    else caught.push(mutation.name)
  }

  if (uncaught.length > 0) {
    throw new Error(`UNCAUGHT_LINE_PAY_MUTATIONS: ${uncaught.join(',')}`)
  }

  process.stdout.write(
    `line_pay_remediation_mutations: PASS (${caught.length}/${mutations.length} caught)\n`,
  )
} finally {
  for (const file of tempFiles) {
    if (existsSync(file)) unlinkSync(file)
  }
  if (existsSync(tempDirectory)) rmdirSync(tempDirectory)
}
