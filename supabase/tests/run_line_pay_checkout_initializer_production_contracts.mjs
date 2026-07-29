import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { inspectDeployOutput } from '../../scripts/supabase/run-line-pay-production-exact-file.mjs'
import {
  parseAndValidateInitializerDeployOutput,
  parseAndValidateInitializerOutput,
  parseAndValidateInitializerPreflightOutput,
} from '../../scripts/supabase/validate-line-pay-checkout-initializer-production.mjs'
import { LINE_PAY_POSTGRES_IMAGE } from './line_pay_postgres_image.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const taskLabel = 'line-pay-checkout-initializer-production'
const containerName =
  `${taskLabel}-${randomBytes(6).toString('hex')}`
const password = randomBytes(32).toString('base64url')
const baselineFiles = [
  'supabase/schema.sql',
  'supabase/bank_transfer_submissions_patch.sql',
  'supabase/newebpay_payments_patch.sql',
  'supabase/payments_service_role_grants.sql',
  'supabase/product_orders_schema_draft.sql',
  'supabase/migrations/20260707_line_pay_provider_schema_draft.sql',
]
const baseMigration =
  'supabase/migrations/20260719033404_line_pay_remediation_contracts.sql'
const diagnosticFile =
  'supabase/deployment/line_pay_checkout_aggregate_initialization_application_state.sql'
const preflightFile =
  'supabase/deployment/line_pay_checkout_aggregate_initialization_preflight.sql'
const deployFile =
  'supabase/deployment/line_pay_checkout_aggregate_initialization_deploy.sql'

function runDocker(args, options = {}) {
  const result = spawnSync('docker', args, {
    cwd: root,
    encoding: 'utf8',
    ...options,
  })
  if (result.error?.code === 'ENOENT') {
    throw new Error('LOCAL_DB_RUNTIME_UNAVAILABLE')
  }
  if (result.status !== 0) {
    throw new Error(
      `LOCAL_DB_COMMAND_FAILED:${args[0]}:${result.status}\n` +
        (result.stderr || result.stdout),
    )
  }
  return result.stdout.trim()
}

function psqlArgs() {
  return [
    'exec',
    '--env',
    `PGPASSWORD=${password}`,
    containerName,
    'psql',
    '--no-psqlrc',
    '--set=ON_ERROR_STOP=1',
    '--quiet',
    '--no-align',
    '--tuples-only',
    '--username=postgres',
    '--dbname=postgres',
  ]
}

function psqlSql(sql, expectFailure = false) {
  const result = spawnSync(
    'docker',
    [...psqlArgs(), '--command', sql],
    {
      cwd: root,
      encoding: 'utf8',
    },
  )
  if (expectFailure) {
    if (result.status === 0) {
      throw new Error('EXPECTED_PSQL_FAILURE_DID_NOT_OCCUR')
    }
    return `${result.stdout}\n${result.stderr}`
  }
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout)
  }
  return result.stdout.trim()
}

function psqlFile(path, expectFailure = false) {
  const result = spawnSync(
    'docker',
    [
      ...psqlArgs(),
      `--file=/workspace/${path}`,
    ],
    {
      cwd: root,
      encoding: 'utf8',
    },
  )
  if (expectFailure) {
    if (result.status === 0) {
      throw new Error(`EXPECTED_FILE_FAILURE_DID_NOT_OCCUR:${path}`)
    }
    return `${result.stdout}\n${result.stderr}`
  }
  if (result.status !== 0) {
    throw new Error(`${path}\n${result.stderr || result.stdout}`)
  }
  return result.stdout.trim()
}

function waitForPostgres() {
  let consecutiveReadyChecks = 0
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const finalProcess = spawnSync(
      'docker',
      ['exec', containerName, 'cat', '/proc/1/comm'],
      { cwd: root, encoding: 'utf8' },
    )
    if (
      finalProcess.status !== 0 ||
      finalProcess.stdout.trim() !== 'postgres'
    ) {
      consecutiveReadyChecks = 0
      Atomics.wait(
        new Int32Array(new SharedArrayBuffer(4)),
        0,
        0,
        250,
      )
      continue
    }

    const result = spawnSync(
      'docker',
      [
        'exec',
        '--env',
        `PGPASSWORD=${password}`,
        containerName,
        'psql',
        '-X',
        '-A',
        '-t',
        '--username=postgres',
        '--dbname=postgres',
        '--command=select 1;',
      ],
      { cwd: root, encoding: 'utf8' },
    )
    consecutiveReadyChecks =
      result.status === 0 && result.stdout.trim() === '1'
        ? consecutiveReadyChecks + 1
        : 0
    if (consecutiveReadyChecks >= 2) return
    Atomics.wait(
      new Int32Array(new SharedArrayBuffer(4)),
      0,
      0,
      250,
    )
  }
  throw new Error('POSTGRES_STABLE_READINESS_TIMEOUT')
}

function tableSnapshot() {
  return psqlSql(`
    select pg_catalog.jsonb_build_object(
      'product_orders', (
        select pg_catalog.jsonb_build_object(
          'count', pg_catalog.count(*),
          'digest', pg_catalog.md5(coalesce(
            pg_catalog.string_agg(
              pg_catalog.md5(pg_catalog.to_jsonb(row_value)::text),
              '' order by row_value.id::text
            ),
            ''
          ))
        )
        from public.product_orders as row_value
      ),
      'product_order_items', (
        select pg_catalog.jsonb_build_object(
          'count', pg_catalog.count(*),
          'digest', pg_catalog.md5(coalesce(
            pg_catalog.string_agg(
              pg_catalog.md5(pg_catalog.to_jsonb(row_value)::text),
              '' order by row_value.id::text
            ),
            ''
          ))
        )
        from public.product_order_items as row_value
      ),
      'product_shipping_info', (
        select pg_catalog.jsonb_build_object(
          'count', pg_catalog.count(*),
          'digest', pg_catalog.md5(coalesce(
            pg_catalog.string_agg(
              pg_catalog.md5(pg_catalog.to_jsonb(row_value)::text),
              '' order by row_value.id::text
            ),
            ''
          ))
        )
        from public.product_shipping_info as row_value
      ),
      'payments', (
        select pg_catalog.jsonb_build_object(
          'count', pg_catalog.count(*),
          'digest', pg_catalog.md5(coalesce(
            pg_catalog.string_agg(
              pg_catalog.md5(pg_catalog.to_jsonb(row_value)::text),
              '' order by row_value.id::text
            ),
            ''
          ))
        )
        from public.payments as row_value
      ),
      'audit', (
        select pg_catalog.jsonb_build_object(
          'count', pg_catalog.count(*),
          'digest', pg_catalog.md5(coalesce(
            pg_catalog.string_agg(
              pg_catalog.md5(pg_catalog.to_jsonb(row_value)::text),
              '' order by row_value.id::text
            ),
            ''
          ))
        )
        from public.line_pay_payment_audit_events as row_value
      )
    )::text;
  `)
}

let started = false
try {
  runDocker([
    'run',
    '--detach',
    '--name',
    containerName,
    '--label',
    `task=${taskLabel}`,
    '--env',
    `POSTGRES_PASSWORD=${password}`,
    '--mount',
    `type=bind,source=${root},target=/workspace,readonly`,
    LINE_PAY_POSTGRES_IMAGE,
  ])
  started = true
  waitForPostgres()

  psqlFile('supabase/tests/line_pay_local_postgres_bootstrap.sql')
  for (const file of baselineFiles) psqlFile(file)
  psqlFile(baseMigration)

  const unapplied = parseAndValidateInitializerOutput(
    `${psqlFile(diagnosticFile)}\n`,
  )
  if (unapplied.application_state !== 'UNAPPLIED') {
    throw new Error('UNAPPLIED_STATE_NOT_OBSERVED')
  }
  parseAndValidateInitializerPreflightOutput(
    `${psqlFile(preflightFile)}\n`,
  )

  psqlSql(`
    create function public.initialize_product_order_line_pay_checkout(jsonb)
    returns void
    language sql
    as 'select';
  `)
  const partial = parseAndValidateInitializerOutput(
    `${psqlFile(diagnosticFile)}\n`,
  )
  if (partial.application_state !== 'PARTIAL') {
    throw new Error('PARTIAL_STATE_NOT_OBSERVED')
  }
  const partialFailure = psqlFile(preflightFile, true)
  if (!/line_pay_checkout_initializer_partial_or_applied/u.test(partialFailure)) {
    throw new Error('PARTIAL_PREFLIGHT_FAILURE_MISMATCH')
  }
  psqlSql(
    'drop function public.initialize_product_order_line_pay_checkout(jsonb);',
  )

  const before = tableSnapshot()
  const deploymentOutput = psqlFile(deployFile)
  const evidence = inspectDeployOutput(deploymentOutput)
  if (
    !evidence.migration_commit_observed ||
    !evidence.postflight_commit_observed ||
    !evidence.markerSequenceValid
  ) {
    throw new Error('DEPLOY_ATTESTATION_INCOMPLETE')
  }
  const full = parseAndValidateInitializerDeployOutput(
    `${deploymentOutput}\n`,
  )
  if (full.application_state !== 'FULL') {
    throw new Error('FULL_STATE_NOT_OBSERVED')
  }
  const after = tableSnapshot()
  if (before !== after) throw new Error('HISTORICAL_DATA_CHANGED')

  psqlSql(`
    create role line_pay_initializer_acl_probe nologin;
    grant execute on function
      public.initialize_product_order_line_pay_checkout(jsonb)
    to line_pay_initializer_acl_probe;
  `)
  const initializerAclMutation = parseAndValidateInitializerOutput(
    `${psqlFile(diagnosticFile)}\n`,
  )
  if (initializerAclMutation.application_state !== 'PARTIAL') {
    throw new Error('INITIALIZER_FUNCTION_ACL_MUTATION_NOT_CAUGHT')
  }
  psqlSql(`
    revoke execute on function
      public.initialize_product_order_line_pay_checkout(jsonb)
    from line_pay_initializer_acl_probe;
    drop role line_pay_initializer_acl_probe;
  `)

  psqlSql(`
    revoke execute on function
      public.initialize_product_order_line_pay_checkout(jsonb)
    from service_role;
    grant line_pay_payment_function_owner to service_role
      with inherit true, set true;
  `)
  const initializerInheritedAclMutation =
    parseAndValidateInitializerOutput(`${psqlFile(diagnosticFile)}\n`)
  if (initializerInheritedAclMutation.application_state !== 'PARTIAL') {
    throw new Error('INITIALIZER_INHERITED_ACL_MUTATION_NOT_CAUGHT')
  }
  psqlSql(`
    revoke line_pay_payment_function_owner from service_role;
    grant execute on function
      public.initialize_product_order_line_pay_checkout(jsonb)
    to service_role;
  `)

  psqlSql(`
    grant execute on function
      public.initialize_product_order_line_pay_checkout(jsonb)
    to service_role with grant option;
  `)
  const initializerGrantOptionMutation =
    parseAndValidateInitializerOutput(`${psqlFile(diagnosticFile)}\n`)
  if (initializerGrantOptionMutation.application_state !== 'PARTIAL') {
    throw new Error('INITIALIZER_GRANT_OPTION_MUTATION_NOT_CAUGHT')
  }
  psqlSql(`
    revoke grant option for execute on function
      public.initialize_product_order_line_pay_checkout(jsonb)
    from service_role;
  `)

  psqlSql(`
    grant execute on function
      line_pay_private.record_line_pay_checkout_initialized_audit(
        uuid,
        uuid,
        uuid,
        text
      )
    to service_role with grant option;
  `)
  const helperAclMutation = parseAndValidateInitializerOutput(
    `${psqlFile(diagnosticFile)}\n`,
  )
  if (helperAclMutation.application_state !== 'PARTIAL') {
    throw new Error('AUDIT_HELPER_ACL_MUTATION_NOT_CAUGHT')
  }
  psqlSql(`
    revoke grant option for execute on function
      line_pay_private.record_line_pay_checkout_initialized_audit(
        uuid,
        uuid,
        uuid,
        text
      )
    from service_role;
  `)

  psqlSql(`
    create role line_pay_initializer_helper_acl_probe nologin;
    grant execute on function
      line_pay_private.record_line_pay_checkout_initialized_audit(
        uuid,
        uuid,
        uuid,
        text
      )
    to line_pay_initializer_helper_acl_probe;
  `)
  const helperUnknownAclMutation = parseAndValidateInitializerOutput(
    `${psqlFile(diagnosticFile)}\n`,
  )
  if (helperUnknownAclMutation.application_state !== 'PARTIAL') {
    throw new Error('AUDIT_HELPER_UNKNOWN_ACL_MUTATION_NOT_CAUGHT')
  }
  psqlSql(`
    revoke execute on function
      line_pay_private.record_line_pay_checkout_initialized_audit(
        uuid,
        uuid,
        uuid,
        text
      )
    from line_pay_initializer_helper_acl_probe;
    drop role line_pay_initializer_helper_acl_probe;
  `)

  psqlSql(`
    create role line_pay_initializer_table_acl_probe nologin;
    grant select on table public.line_pay_payment_audit_events
    to line_pay_initializer_table_acl_probe;
  `)
  const auditTableAclMutation = parseAndValidateInitializerOutput(
    `${psqlFile(diagnosticFile)}\n`,
  )
  if (auditTableAclMutation.application_state !== 'PARTIAL') {
    throw new Error('AUDIT_TABLE_ACL_MUTATION_NOT_CAUGHT')
  }
  psqlSql(`
    revoke select on table public.line_pay_payment_audit_events
    from line_pay_initializer_table_acl_probe;
    drop role line_pay_initializer_table_acl_probe;
  `)

  psqlSql(`
    create role line_pay_initializer_membership_probe nologin;
    grant line_pay_initializer_membership_probe
    to line_pay_payment_function_owner
      with inherit true, set true;
  `)
  const functionOwnerMembershipMutation =
    parseAndValidateInitializerOutput(`${psqlFile(diagnosticFile)}\n`)
  if (functionOwnerMembershipMutation.application_state !== 'PARTIAL') {
    throw new Error('FUNCTION_OWNER_MEMBERSHIP_MUTATION_NOT_CAUGHT')
  }
  psqlSql(`
    revoke line_pay_initializer_membership_probe
    from line_pay_payment_function_owner;
    drop role line_pay_initializer_membership_probe;
  `)

  psqlSql(`
    alter function public.initialize_product_order_line_pay_checkout(jsonb)
    owner to line_pay_payment_function_owner;
  `)
  const initializerOwnerMutation = parseAndValidateInitializerOutput(
    `${psqlFile(diagnosticFile)}\n`,
  )
  if (initializerOwnerMutation.application_state !== 'PARTIAL') {
    throw new Error('INITIALIZER_FUNCTION_OWNER_MUTATION_NOT_CAUGHT')
  }
  psqlSql(`
    alter function public.initialize_product_order_line_pay_checkout(jsonb)
    owner to postgres;
  `)

  psqlSql(`
    drop index
      public.line_pay_payment_audit_events_checkout_initialized_once_idx;
    create unique index
      line_pay_payment_audit_events_checkout_initialized_once_idx
    on public.line_pay_payment_audit_events (payment_id)
    where event_type = 'checkout_initialized';
  `)
  const indexMutation = parseAndValidateInitializerOutput(
    `${psqlFile(diagnosticFile)}\n`,
  )
  if (indexMutation.application_state !== 'PARTIAL') {
    throw new Error('INITIALIZER_INDEX_DEFINITION_MUTATION_NOT_CAUGHT')
  }
  psqlSql(`
    drop index
      public.line_pay_payment_audit_events_checkout_initialized_once_idx;
    create unique index
      line_pay_payment_audit_events_checkout_initialized_once_idx
    on public.line_pay_payment_audit_events (checkout_attempt_id)
    where event_type = 'checkout_initialized';
  `)

  psqlSql(`
    drop index
      public.line_pay_payment_audit_events_checkout_initialized_once_idx;
    create unique index
      line_pay_payment_audit_events_checkout_initialized_once_idx
    on public.line_pay_payment_audit_events (checkout_attempt_id)
    where event_type = 'request_claimed';
  `)
  const indexPredicateMutation = parseAndValidateInitializerOutput(
    `${psqlFile(diagnosticFile)}\n`,
  )
  if (indexPredicateMutation.application_state !== 'PARTIAL') {
    throw new Error('INITIALIZER_INDEX_PREDICATE_MUTATION_NOT_CAUGHT')
  }
  psqlSql(`
    drop index
      public.line_pay_payment_audit_events_checkout_initialized_once_idx;
    create unique index
      line_pay_payment_audit_events_checkout_initialized_once_idx
    on public.line_pay_payment_audit_events (checkout_attempt_id)
    where event_type = 'checkout_initialized';
  `)

  psqlSql(`
    drop policy
      line_pay_payment_function_owner_initialization_items_select
    on public.product_order_items;
    create policy
      line_pay_payment_function_owner_initialization_items_select
    on public.product_order_items
    for select
    to line_pay_payment_function_owner
    using (true);
  `)
  const policyMutation = parseAndValidateInitializerOutput(
    `${psqlFile(diagnosticFile)}\n`,
  )
  if (policyMutation.application_state !== 'PARTIAL') {
    throw new Error('POLICY_MUTATION_NOT_CAUGHT')
  }

  process.stdout.write(
    'line_pay_checkout_initializer_production_contracts: PASS ' +
      '(PostgreSQL 17, UNAPPLIED/PARTIAL/FULL, exact-file deploy, ' +
      'commit attestations, historical row digests preserved, ' +
      'function owner/ACL, index definition, and policy mutations caught)\n',
  )
} finally {
  if (started) {
    spawnSync('docker', ['rm', '--force', containerName], {
      cwd: root,
      encoding: 'utf8',
    })
  }
}
