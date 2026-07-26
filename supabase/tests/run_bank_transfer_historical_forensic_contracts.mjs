import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  assertForensicSql,
  parseAndValidateForensicOutput,
} from '../../scripts/supabase/validate-bank-transfer-production-forensic.mjs'
import { LINE_PAY_POSTGRES_IMAGE } from './line_pay_postgres_image.mjs'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const root = resolve(scriptDirectory, '../..')
const taskLabel = 'bank-transfer-historical-forensic'
const suffix = randomBytes(6).toString('hex')
const containerName = `${taskLabel}-${suffix}`
const networkName = `${containerName}-network`
const volumeName = `${containerName}-data`
const password = randomBytes(32).toString('base64url')
const image = LINE_PAY_POSTGRES_IMAGE
const forensicPath = join(
  root,
  'supabase/deployment/bank_transfer_historical_forensic.sql',
)
const fencePath = join(
  root,
  'supabase/migrations/20260722065311_retire_bank_transfer_submissions_writes.sql',
)
const baselineFiles = Object.freeze([
  'supabase/schema.sql',
  'supabase/bank_transfer_submissions_patch.sql',
  'supabase/newebpay_payments_patch.sql',
  'supabase/payments_service_role_grants.sql',
  'supabase/product_orders_schema_draft.sql',
  'supabase/migrations/20260707_line_pay_provider_schema_draft.sql',
  'supabase/tests/line_pay_upgrade_fixture.sql',
])
const fixedPgOptions =
  '-c default_transaction_read_only=on ' +
  '-c statement_timeout=120000 ' +
  '-c lock_timeout=15000 ' +
  '-c idle_in_transaction_session_timeout=30000'

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
      `LOCAL_DB_COMMAND_FAILED:${args[0]}:${result.status}\n${
        result.stderr || result.stdout
      }`,
    )
  }
  return result.stdout.trim()
}

function attemptPsql(sql, {
  database = 'postgres',
  readOnly = false,
  role,
} = {}) {
  const pgOptions = [
    ...(readOnly ? [fixedPgOptions] : []),
    ...(role ? [`-c role=${role}`] : []),
  ].join(' ')
  return spawnSync(
    'docker',
    [
      'exec',
      '-i',
      ...(pgOptions ? ['--env', `PGOPTIONS=${pgOptions}`] : []),
      containerName,
      'psql',
      '-X',
      '--set=ON_ERROR_STOP=1',
      '--quiet',
      '--no-align',
      '--tuples-only',
      '-U',
      'postgres',
      '-d',
      database,
    ],
    {
      cwd: root,
      encoding: 'utf8',
      input: sql,
    },
  )
}

function psql(sql, label, options = {}) {
  const result = attemptPsql(sql, options)
  if (result.status !== 0) {
    throw new Error(`${label}:FAILED\n${result.stderr || result.stdout}`)
  }
  return result.stdout.trim()
}

function psqlFile(relativePath) {
  psql(
    readFileSync(join(root, relativePath), 'utf8'),
    relativePath,
  )
}

function prepareBaseline() {
  psqlFile('supabase/tests/line_pay_local_postgres_bootstrap.sql')
  for (const file of baselineFiles) psqlFile(file)
  psql(
    `
      insert into auth.users (id) values
        ('10000000-0000-4000-8000-000000000011'),
        ('10000000-0000-4000-8000-000000000012')
      on conflict (id) do nothing;

      insert into public.bank_transfer_submissions (
        id, user_id, item_type, item_id, item_name, amount_twd,
        payer_name, payer_phone, payer_email, line_display_name,
        bank_account_last5, transfer_time, note, status, admin_note,
        created_at, confirmed_at
      ) values
        (
          '21000000-0000-4000-8000-000000000001',
          '10000000-0000-4000-8000-000000000011',
          'synthetic', 'fixture-1', 'Synthetic fixture 1', 100,
          'Synthetic User', '0000000000', 'one@example.invalid', null,
          '00001', '2026-07-01 00:00:00+00', 'synthetic',
          'pending_review', null, '2026-07-01 00:00:00+00', null
        ),
        (
          '21000000-0000-4000-8000-000000000002',
          '10000000-0000-4000-8000-000000000011',
          'synthetic', 'fixture-2', 'Synthetic fixture 2', 200,
          'Synthetic User', '0000000000', 'two@example.invalid', null,
          '00002', '2026-07-02 00:00:00+00', 'synthetic',
          'pending_review', null, '2026-07-02 00:00:00+00', null
        ),
        (
          '21000000-0000-4000-8000-000000000003',
          '10000000-0000-4000-8000-000000000012',
          'synthetic', 'fixture-3', 'Synthetic fixture 3', 300,
          'Synthetic User', '0000000000', 'three@example.invalid', null,
          '00003', '2026-07-03 00:00:00+00', 'synthetic',
          'pending_review', null, '2026-07-03 00:00:00+00', null
        );
    `,
    'forensic baseline fixtures',
  )
  psql(readFileSync(fencePath, 'utf8'), 'bank transfer fence')
}

function readFingerprint() {
  return JSON.parse(
    psql(
      `
        select jsonb_build_object(
          'rows', count(*)::integer,
          'pending_review',
          count(*) filter (where status = 'pending_review')::integer,
          'pk_digest',
          encode(
            sha256(convert_to(
              coalesce(string_agg(id::text, E'\\n' order by id), ''),
              'UTF8'
            )),
            'hex'
          ),
          'content_digest',
          encode(
            sha256(convert_to(
              coalesce(
                string_agg(to_jsonb(row_value)::text, E'\\n' order by id),
                ''
              ),
              'UTF8'
            )),
            'hex'
          )
        )
        from public.bank_transfer_submissions as row_value;
      `,
      'fixture fingerprint',
    ),
  )
}

function buildFixtureForensic() {
  const baseline = readFingerprint()
  let source = readFileSync(forensicPath, 'utf8')
  const productionDigests = [
    'e6a67042ff04db27bea56f76d9d983e6762ba4122e67fe54c30d740e458f5fec',
    'e87a8425def35ac99bb054b4b2e0fee3efe985d5b3376ab6011d30e730c3bc40',
  ]
  for (const [index, replacement] of [
    baseline.pk_digest,
    baseline.content_digest,
  ].entries()) {
    assert.equal(source.split(productionDigests[index]).length, 2)
    source = source.replace(productionDigests[index], replacement)
  }
  assert.equal(assertForensicSql(source), true)
  return source
}

function runForensic(source) {
  const before = readFingerprint()
  const result = attemptPsql(source, { readOnly: true })
  assert.equal(result.status, 0, result.stderr || result.stdout)
  const after = readFingerprint()
  assert.deepEqual(after, before)
  const rows = result.stdout.split(/\r?\n/u).filter(Boolean)
  assert.equal(rows.length, 1)
  assert.doesNotMatch(
    result.stdout,
    /(?:[0-9a-f]{8}-){1,4}[0-9a-f-]+|\b[0-9a-f]{64}\b|@/iu,
  )
  return parseAndValidateForensicOutput(`${rows[0]}\n`)
}

function runForensicWithoutFingerprint(source) {
  const result = attemptPsql(source, { readOnly: true })
  assert.equal(result.status, 0, result.stderr || result.stdout)
  const rows = result.stdout.split(/\r?\n/u).filter(Boolean)
  assert.equal(rows.length, 1)
  assert.doesNotMatch(
    result.stdout,
    /(?:[0-9a-f]{8}-){1,4}[0-9a-f-]+|\b[0-9a-f]{64}\b|@/iu,
  )
  return parseAndValidateForensicOutput(`${rows[0]}\n`)
}

function assertBaselineResult(result) {
  assert.equal(result.status, 'FORENSIC_COMPLETED')
  assert.equal(result.database_identity_match, true)
  assert.equal(result.fence_match, true)
  assert.equal(result.row_count, 3)
  assert.equal(result.pk_digest_match, true)
  assert.equal(result.pending_review_count, 3)
  assert.equal(result.pending_review_match, true)
  assert.equal(result.full_content_digest_match, true)
  for (const key of [
    'schema_signature_match',
    'column_set_match',
    'column_order_match',
    'column_type_match',
    'column_nullability_match',
    'column_default_match',
    'column_generated_match',
    'column_identity_match',
    'no_dropped_columns',
  ]) {
    assert.equal(result[key], true, key)
  }
  assert.equal(result.commit_timestamp_tracking_enabled, true)
  assert.equal(result.tuple_commit_timestamp_evidence_available, true)
  assert.equal(result.rows_with_known_commit_timestamp, 3)
  assert.equal(result.table_stats_available, true)
  assert.equal(result.table_stats_authoritative, false)
  assert.equal(result.baseline_provenance_complete, false)
  assert.equal(result.exact_changed_row_identifiable, false)
  assert.equal(result.exact_changed_column_identifiable, false)
  assert.equal(
    result.database_audit_log_evidence_status,
    'DATABASE_AUDIT_LOG_EVIDENCE_UNAVAILABLE',
  )
}

function resetScenario() {
  psql(
    `
      drop database if exists postgres with (force);
      create database postgres template forensic_template;
    `,
    'reset forensic scenario',
    { database: 'template1' },
  )
}

function assertSchemaDrift(result, expectedFalseKeys) {
  assert.equal(result.schema_signature_match, false)
  for (const key of expectedFalseKeys) assert.equal(result[key], false, key)
  assert.equal(result.baseline_provenance_complete, false)
  assert.equal(result.exact_changed_row_identifiable, false)
  assert.equal(result.exact_changed_column_identifiable, false)
}

function runSchemaScenarios(source) {
  const scenarios = [
    {
      name: 'column_added',
      sql: 'alter table public.bank_transfer_submissions add column unexpected text;',
      keys: ['column_set_match', 'column_order_match'],
    },
    {
      name: 'column_deleted',
      sql: 'alter table public.bank_transfer_submissions drop column note;',
      keys: ['column_set_match', 'column_order_match', 'column_type_match', 'no_dropped_columns'],
    },
    {
      name: 'column_type_changed',
      sql: 'alter table public.bank_transfer_submissions alter column amount_twd type bigint;',
      keys: ['column_type_match'],
    },
    {
      name: 'column_default_changed',
      sql: "alter table public.bank_transfer_submissions alter column status set default 'changed';",
      keys: ['column_default_match'],
    },
    {
      name: 'column_nullability_changed',
      sql: 'alter table public.bank_transfer_submissions alter column user_id set not null;',
      keys: ['column_nullability_match'],
    },
  ]
  const results = []
  for (const scenario of scenarios) {
    resetScenario()
    psql(scenario.sql, scenario.name)
    assertSchemaDrift(runForensic(source), scenario.keys)
    results.push(scenario.name)
  }

  resetScenario()
  const orderMutation = source
    .replace("(1, 'id'", "(2, 'id'")
    .replace("(2, 'user_id'", "(1, 'user_id'")
  assert.notEqual(orderMutation, source)
  assertSchemaDrift(runForensic(orderMutation), ['column_order_match'])
  results.push('column_reordered')

  resetScenario()
  const generatedMutation = source.replace(
    "(17, 'confirmed_at', 'timestamp with time zone', false, null, '', '')",
    "(17, 'confirmed_at', 'timestamp with time zone', false, null, 's', '')",
  )
  assert.notEqual(generatedMutation, source)
  assertSchemaDrift(runForensic(generatedMutation), [
    'column_generated_match',
  ])
  results.push('generated_kind_changed')

  resetScenario()
  const identityMutation = source.replace(
    "(17, 'confirmed_at', 'timestamp with time zone', false, null, '', '')",
    "(17, 'confirmed_at', 'timestamp with time zone', false, null, '', 'a')",
  )
  assert.notEqual(identityMutation, source)
  assertSchemaDrift(runForensic(identityMutation), [
    'column_identity_match',
  ])
  results.push('identity_kind_changed')
  return results
}

function runContentScenarios(source) {
  const results = []

  resetScenario()
  psql(
    "update public.bank_transfer_submissions set note = 'changed' where item_id = 'fixture-1';",
    'content drift',
  )
  let result = runForensic(source)
  assert.equal(result.row_count, 3)
  assert.equal(result.pk_digest_match, true)
  assert.equal(result.pending_review_match, true)
  assert.equal(result.full_content_digest_match, false)
  assert.equal(result.exact_changed_row_identifiable, false)
  assert.equal(result.exact_changed_column_identifiable, false)
  results.push('content_changed')

  resetScenario()
  psql(
    "update public.bank_transfer_submissions set status = 'confirmed' where item_id = 'fixture-1';",
    'status drift',
  )
  result = runForensic(source)
  assert.equal(result.pending_review_count, 2)
  assert.equal(result.pending_review_match, false)
  assert.equal(result.full_content_digest_match, false)
  results.push('status_changed')

  resetScenario()
  psql(
    "update public.bank_transfer_submissions set id = '21000000-0000-4000-8000-000000000099' where item_id = 'fixture-1';",
    'primary key drift',
  )
  result = runForensic(source)
  assert.equal(result.row_count, 3)
  assert.equal(result.pk_digest_match, false)
  assert.equal(result.full_content_digest_match, false)
  results.push('primary_key_changed')

  resetScenario()
  psql(
    "grant insert on public.bank_transfer_submissions to authenticated;",
    'fence drift',
  )
  result = runForensic(source)
  assert.equal(result.fence_match, false)
  results.push('fence_changed')
  return results
}

function runEvidenceScenarios(source) {
  const results = []

  resetScenario()
  psql(
    'alter table public.bank_transfer_submissions drop column id cascade;',
    'missing primary key column',
  )
  let result = runForensicWithoutFingerprint(source)
  assertSchemaDrift(result, [
    'column_set_match',
    'column_order_match',
    'column_type_match',
    'no_dropped_columns',
  ])
  assert.equal(result.pk_digest_match, false)
  results.push('primary_key_column_missing')

  resetScenario()
  psql(
    'alter table public.bank_transfer_submissions drop column status cascade;',
    'missing status column',
  )
  result = runForensicWithoutFingerprint(source)
  assertSchemaDrift(result, [
    'column_set_match',
    'column_order_match',
    'column_type_match',
    'no_dropped_columns',
  ])
  assert.equal(result.pending_review_match, false)
  results.push('status_column_missing')

  resetScenario()
  const disabled = source.replace(
    "pg_catalog.current_setting('track_commit_timestamp') = 'on'",
    'false',
  )
  assert.notEqual(disabled, source)
  result = runForensic(disabled)
  assert.equal(result.commit_timestamp_tracking_enabled, false)
  assert.equal(result.tuple_commit_timestamp_evidence_available, false)
  assert.equal(result.rows_with_known_commit_timestamp, 0)
  results.push('commit_timestamp_disabled')

  resetScenario()
  const statsUnavailable = source.replace(
    "where schemaname = 'public'",
    "where false and schemaname = 'public'",
  )
  assert.notEqual(statsUnavailable, source)
  result = runForensic(statsUnavailable)
  assert.equal(result.table_stats_available, false)
  assert.equal(result.reported_insert_count, 0)
  assert.equal(result.reported_update_count, 0)
  assert.equal(result.reported_delete_count, 0)
  results.push('table_stats_unavailable')

  resetScenario()
  psql(
    `
      create role forensic_reader nologin;
      grant usage on schema public to forensic_reader;
    `,
    'restricted forensic reader',
  )
  const permissionDenied = attemptPsql(source, {
    readOnly: true,
    role: 'forensic_reader',
  })
  assert.equal(permissionDenied.status, 3)
  results.push('permission_denied')

  resetScenario()
  psql(
    'drop table public.bank_transfer_submissions cascade;',
    'missing forensic relation',
  )
  result = runForensicWithoutFingerprint(source)
  assert.equal(result.row_count, 0)
  assert.equal(result.schema_signature_match, false)
  assert.equal(result.fence_match, false)
  results.push('relation_missing')

  resetScenario()
  const syntaxMutation = source.replace(
    'expected_columns(',
    'expected_columns syntax_error (',
  )
  assert.notEqual(syntaxMutation, source)
  const syntaxFailure = attemptPsql(syntaxMutation, { readOnly: true })
  assert.equal(syntaxFailure.status, 3)
  results.push('syntax_failure')

  resetScenario()
  const writeMutation = source.replace(
    'ROLLBACK;',
    'delete from public.bank_transfer_submissions; ROLLBACK;',
  )
  const writeFailure = attemptPsql(writeMutation, { readOnly: true })
  assert.equal(writeFailure.status, 3)
  assert.equal(readFingerprint().rows, 3)
  results.push('read_only_write_denied')
  return results
}

function cleanup() {
  spawnSync('docker', ['rm', '--force', containerName], {
    cwd: root,
    stdio: 'ignore',
  })
  spawnSync('docker', ['network', 'rm', networkName], {
    cwd: root,
    stdio: 'ignore',
  })
  spawnSync('docker', ['volume', 'rm', volumeName], {
    cwd: root,
    stdio: 'ignore',
  })
}

function waitForPostgres() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const pidOneResult = spawnSync(
      'docker',
      ['exec', containerName, 'cat', '/proc/1/comm'],
      { cwd: root, encoding: 'utf8' },
    )
    if (
      pidOneResult.status === 0 &&
      pidOneResult.stdout.trim() === 'postgres'
    ) {
      const readyResult = spawnSync(
        'docker',
        [
          'exec',
          containerName,
          'pg_isready',
          '-U',
          'postgres',
          '-d',
          'postgres',
        ],
        { cwd: root, stdio: 'ignore' },
      )
      if (readyResult.status === 0) return
    }
    spawnSync('sleep', ['1'])
  }
  assert.fail('POSTGRES_FINAL_SERVER_NOT_READY')
}

try {
  assert.match(image, /^postgres@sha256:[0-9a-f]{64}$/u)
  runDocker(['pull', image])
  runDocker([
    'network',
    'create',
    '--label',
    `task=${taskLabel}`,
    networkName,
  ])
  runDocker([
    'volume',
    'create',
    '--label',
    `task=${taskLabel}`,
    volumeName,
  ])
  runDocker([
    'run',
    '--detach',
    '--name',
    containerName,
    '--label',
    `task=${taskLabel}`,
    '--network',
    networkName,
    '--mount',
    `type=volume,source=${volumeName},target=/var/lib/postgresql/data`,
    '--env',
    `POSTGRES_PASSWORD=${password}`,
    '--env',
    'POSTGRES_DB=postgres',
    image,
    'postgres',
    '-c',
    'track_commit_timestamp=on',
  ])

  waitForPostgres()

  prepareBaseline()
  const source = buildFixtureForensic()
  const baselineResult = runForensic(source)
  assertBaselineResult(baselineResult)
  psql(
    'create database forensic_template template postgres;',
    'create forensic template',
    { database: 'template1' },
  )

  const schemaScenarios = runSchemaScenarios(source)
  const contentScenarios = runContentScenarios(source)
  const evidenceScenarios = runEvidenceScenarios(source)
  const total =
    1 +
    schemaScenarios.length +
    contentScenarios.length +
    evidenceScenarios.length
  console.log(
    `Bank Transfer historical forensic PostgreSQL contracts: ${total} PASS`,
  )
  console.log(
    'Bank Transfer historical forensic mutation coverage: ' +
      `${schemaScenarios.length + contentScenarios.length} caught, 0 uncaught`,
  )
  console.log(
    'Database audit log evidence: DATABASE_AUDIT_LOG_EVIDENCE_UNAVAILABLE',
  )
} finally {
  cleanup()
}
