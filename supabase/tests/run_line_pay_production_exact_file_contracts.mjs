import { spawn, spawnSync } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { parseAndValidateDiagnosticOutput } from '../../scripts/supabase/validate-line-pay-application-state-diagnostic.mjs'
import { LINE_PAY_POSTGRES_IMAGE } from './line_pay_postgres_image.mjs'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const root = resolve(scriptDirectory, '../..')
const taskLabel = 'line-pay-production-exact-file-runner'
const suffix = randomBytes(6).toString('hex')
const containerName = `${taskLabel}-${suffix}`
const networkName = `${containerName}-network`
const volumeName = `${containerName}-data`
const password = randomBytes(32).toString('base64url')
const image = LINE_PAY_POSTGRES_IMAGE
let measuredLockedDeployMs = 0
const deployAttestationMarkers = Object.freeze([
  'LINE_PAY_DEPLOY_MIGRATION_STARTED',
  'LINE_PAY_DEPLOY_MIGRATION_COMMITTED',
  'LINE_PAY_DEPLOY_POSTFLIGHT_STARTED',
  'LINE_PAY_DEPLOY_POSTFLIGHT_STATE_EMITTED',
  'LINE_PAY_DEPLOY_POSTFLIGHT_COMMITTED',
])
const migrationPath = join(
  root,
  'supabase/migrations/20260719033404_line_pay_remediation_contracts.sql',
)
const fencePath = join(
  root,
  'supabase/migrations/20260722065311_retire_bank_transfer_submissions_writes.sql',
)
const preflightPath = join(
  root,
  'supabase/deployment/line_pay_remediation_preflight.sql',
)
const postflightPath = join(
  root,
  'supabase/deployment/line_pay_remediation_postflight.sql',
)
const applicationStateDiagnosticPath = join(
  root,
  'supabase/deployment/line_pay_application_state_diagnostic.sql',
)
const deployPath = join(
  root,
  'supabase/deployment/line_pay_remediation_deploy.sql',
)
const baselineCapturePath = join(
  root,
  'supabase/deployment/bank_transfer_historical_baseline_capture.sql',
)
const baselineFiles = [
  'supabase/schema.sql',
  'supabase/bank_transfer_submissions_patch.sql',
  'supabase/newebpay_payments_patch.sql',
  'supabase/payments_service_role_grants.sql',
  'supabase/product_orders_schema_draft.sql',
  'supabase/migrations/20260707_line_pay_provider_schema_draft.sql',
  'supabase/tests/line_pay_upgrade_fixture.sql',
]

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

function psqlAs(
  database,
  user,
  sql,
  label,
  expectFailure = false,
  quiet = false,
) {
  const result = spawnSync(
    'docker',
    [
      'exec',
      '-i',
      containerName,
      'psql',
      '-X',
      ...(quiet ? ['--quiet'] : []),
      '--set=ON_ERROR_STOP=1',
      '--no-align',
      '--tuples-only',
      '-U',
      user,
      '-d',
      database,
    ],
    {
      cwd: root,
      encoding: 'utf8',
      input: sql,
    },
  )
  if (expectFailure) {
    if (result.status === 0) {
      throw new Error(`${label}:EXPECTED_FAILURE_MISSING`)
    }
    return ''
  }
  if (result.status !== 0) {
    throw new Error(`${label}:FAILED\n${result.stderr || result.stdout}`)
  }
  return result.stdout.trim()
}

function psql(
  database,
  sql,
  label,
  expectFailure = false,
  quiet = false,
) {
  return psqlAs(
    database,
    'postgres',
    sql,
    label,
    expectFailure,
    quiet,
  )
}

function psqlFileAs(
  database,
  user,
  relativePath,
  label = relativePath,
) {
  psqlAs(
    database,
    user,
    readFileSync(join(root, relativePath), 'utf8'),
    label,
  )
}

function psqlFile(database, relativePath, label = relativePath) {
  psqlFileAs(database, 'postgres', relativePath, label)
}

function psqlContainerFileAs(database, user, containerPath, label) {
  const result = spawnSync(
    'docker',
    [
      'exec',
      '-i',
      containerName,
      'psql',
      '-X',
      '--set=ON_ERROR_STOP=1',
      '--quiet',
      '--no-align',
      '--tuples-only',
      '-U',
      user,
      '-d',
      database,
      `--file=${containerPath}`,
    ],
    { cwd: root, encoding: 'utf8' },
  )
  if (result.status !== 0) {
    throw new Error(`${label}:FAILED\n${result.stderr || result.stdout}`)
  }
  return result.stdout.trim()
}

function psqlContainerFile(database, containerPath, label) {
  return psqlContainerFileAs(
    database,
    'postgres',
    containerPath,
    label,
  )
}

function writeContainerFile(containerPath, contents) {
  const result = spawnSync(
    'docker',
    ['exec', '-i', containerName, 'tee', containerPath],
    {
      cwd: root,
      encoding: 'utf8',
      input: contents,
      stdio: ['pipe', 'ignore', 'pipe'],
    },
  )
  if (result.status !== 0) {
    throw new Error(`CONTAINER_FIXTURE_WRITE_FAILED:${containerPath}`)
  }
}

function startBlockingLock(database, tableName) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(
      'docker',
      [
        'exec',
        '-i',
        containerName,
        'psql',
        '-X',
        '--set=ON_ERROR_STOP=1',
        '--no-align',
        '--tuples-only',
        '-U',
        'postgres',
        '-d',
        database,
      ],
      { cwd: root, stdio: ['pipe', 'pipe', 'pipe'] },
    )
    let stdout = ''
    let settled = false
    const completion = new Promise((resolveCompletion) => {
      child.once('close', (code) => resolveCompletion(code))
    })
    child.once('error', rejectPromise)
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8')
      if (!settled && stdout.includes('LOCK_READY')) {
        settled = true
        resolvePromise({ child, completion })
      }
    })
    child.stdin.end(`
      begin;
      lock table public.${tableName} in access exclusive mode;
      select 'LOCK_READY';
      select pg_sleep(3);
      commit;
    `)
  })
}

function startContainerPsqlFile(database, containerPath) {
  const child = spawn(
    'docker',
    [
      'exec',
      '-i',
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
      `--file=${containerPath}`,
    ],
    { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] },
  )
  let stdout = ''
  let stderr = ''
  child.stdout.on('data', (chunk) => {
    stdout += chunk.toString('utf8')
  })
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString('utf8')
  })
  return {
    child,
    completion: new Promise((resolvePromise, rejectPromise) => {
      child.once('error', rejectPromise)
      child.once('close', (code) =>
        resolvePromise({ code, stdout: stdout.trim(), stderr: stderr.trim() }),
      )
    }),
  }
}

async function waitForCommittedMigration(database) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const result = psql(
      database,
      "select to_regclass('public.line_pay_checkout_attempts') is not null;",
      'post-migration gap probe',
    )
    if (result === 't') return
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100))
  }
  throw new Error('POST_MIGRATION_GAP_NOT_REACHED')
}

const syntheticBankTransferFixtures = `
  insert into auth.users (id) values
    ('10000000-0000-4000-8000-000000000011'),
    ('10000000-0000-4000-8000-000000000012')
  on conflict (id) do nothing;

  insert into public.bank_transfer_submissions (
    id, user_id, item_type, item_id, item_name, amount_twd,
    payer_name, payer_phone, payer_email, bank_account_last5,
    transfer_time, note, status, created_at
  ) values
    (
      '21000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000011',
      'synthetic', 'fixture-1', 'Synthetic fixture 1', 100,
      'Synthetic User', '0000000000', 'one@example.invalid', '00001',
      '2026-07-01 00:00:00+00', 'synthetic', 'pending_review',
      '2026-07-01 00:00:00+00'
    ),
    (
      '21000000-0000-4000-8000-000000000002',
      '10000000-0000-4000-8000-000000000011',
      'synthetic', 'fixture-2', 'Synthetic fixture 2', 200,
      'Synthetic User', '0000000000', 'two@example.invalid', '00002',
      '2026-07-02 00:00:00+00', 'synthetic', 'pending_review',
      '2026-07-02 00:00:00+00'
    ),
    (
      '21000000-0000-4000-8000-000000000003',
      '10000000-0000-4000-8000-000000000012',
      'synthetic', 'fixture-3', 'Synthetic fixture 3', 300,
      'Synthetic User', '0000000000', 'three@example.invalid', '00003',
      '2026-07-03 00:00:00+00', 'synthetic', 'pending_review',
      '2026-07-03 00:00:00+00'
    );
`

function prepareBaselineForUser(database, user) {
  for (const file of baselineFiles) {
    psqlFileAs(database, user, file)
  }
  psqlAs(
    database,
    user,
    syntheticBankTransferFixtures,
    'synthetic bank transfer fixtures',
  )
  psqlAs(
    database,
    user,
    readFileSync(fencePath, 'utf8'),
    'read-only fence',
  )
}

function prepareBaseline(database) {
  psqlFile(database, 'supabase/tests/line_pay_local_postgres_bootstrap.sql')
  prepareBaselineForUser(database, 'postgres')
}

function readFingerprints(database, afterMigration, user = 'postgres') {
  const paymentExpression = afterMigration
    ? `(to_jsonb(row_value) - array[
        'updated_at',
        'product_order_id','environment','checkout_attempt_id','request_state',
        'request_idempotency_key','request_body_sha256',
        'line_pay_transaction_id','reconciliation_required','state_version'
      ])`
    : `(to_jsonb(row_value) - 'updated_at')`
  const orderExpression = afterMigration
    ? `(to_jsonb(row_value) - array[
        'environment','fulfillment_mode','sandbox_test','currency',
        'checkout_attempt_id','payment_request_state',
        'reconciliation_required','state_version'
      ])`
    : 'to_jsonb(row_value)'
  const output = psqlAs(
    database,
    user,
    `
      with
      bank_transfer as (
        select
          count(*)::integer as rows,
          count(*) filter (where status = 'pending_review')::integer as pending_review,
          encode(sha256(convert_to(coalesce(string_agg(id::text, E'\\n' order by id), ''), 'UTF8')), 'hex') as pk_digest,
          encode(sha256(convert_to(coalesce(string_agg(to_jsonb(row_value)::text, E'\\n' order by id), ''), 'UTF8')), 'hex') as content_digest
        from public.bank_transfer_submissions as row_value
      ),
      payments as (
        select
          count(*)::integer as rows,
          encode(sha256(convert_to(coalesce(string_agg(id::text, E'\\n' order by id), ''), 'UTF8')), 'hex') as pk_digest,
          encode(sha256(convert_to(coalesce(string_agg(${paymentExpression}::text, E'\\n' order by id), ''), 'UTF8')), 'hex') as content_digest
        from public.payments as row_value
      ),
      product_orders as (
        select
          count(*)::integer as rows,
          encode(sha256(convert_to(coalesce(string_agg(id::text, E'\\n' order by id), ''), 'UTF8')), 'hex') as pk_digest,
          encode(sha256(convert_to(coalesce(string_agg(${orderExpression}::text, E'\\n' order by id), ''), 'UTF8')), 'hex') as content_digest
        from public.product_orders as row_value
      )
      select jsonb_build_object(
        'bank_transfer', (select to_jsonb(row_value) from bank_transfer as row_value),
        'payments', (select to_jsonb(row_value) from payments as row_value),
        'product_orders', (select to_jsonb(row_value) from product_orders as row_value)
      );
    `,
    'fixture fingerprints',
  )
  return JSON.parse(output)
}

function readActiveTableManifests(database) {
  const output = psql(
    database,
    `
      with
      payments_manifest as (
        select coalesce(
          jsonb_object_agg(
            row_value.id::text,
            encode(
              sha256(convert_to(
                jsonb_build_object(
                  'id', row_value.id,
                  'user_id', row_value.user_id,
                  'booking_id', row_value.booking_id,
                  'provider', row_value.provider,
                  'provider_payment_id', row_value.provider_payment_id,
                  'item_type', row_value.item_type,
                  'item_name', row_value.item_name,
                  'amount_twd', row_value.amount_twd,
                  'currency', row_value.currency,
                  'status', row_value.status,
                  'paid_at', row_value.paid_at,
                  'refunded_at', row_value.refunded_at,
                  'raw_payload', row_value.raw_payload,
                  'created_at', row_value.created_at,
                  'item_id', row_value.item_id,
                  'merchant_order_no', row_value.merchant_order_no,
                  'provider_trade_no', row_value.provider_trade_no,
                  'notify_received_at', row_value.notify_received_at,
                  'failure_reason', row_value.failure_reason
                )::text,
                'UTF8'
              )),
              'hex'
            )
            order by row_value.id
          ),
          '{}'::jsonb
        ) as value
        from public.payments as row_value
      ),
      product_orders_manifest as (
        select coalesce(
          jsonb_object_agg(
            row_value.id::text,
            encode(
              sha256(convert_to(
                jsonb_build_object(
                  'id', row_value.id,
                  'order_no', row_value.order_no,
                  'user_id', row_value.user_id,
                  'customer_name', row_value.customer_name,
                  'customer_email', row_value.customer_email,
                  'customer_phone', row_value.customer_phone,
                  'total_amount_twd', row_value.total_amount_twd,
                  'payment_method', row_value.payment_method,
                  'payment_status', row_value.payment_status,
                  'order_status', row_value.order_status,
                  'shipping_status', row_value.shipping_status,
                  'payment_id', row_value.payment_id,
                  'bank_transfer_submission_id',
                    row_value.bank_transfer_submission_id,
                  'note', row_value.note,
                  'created_at', row_value.created_at,
                  'updated_at', row_value.updated_at
                )::text,
                'UTF8'
              )),
              'hex'
            )
            order by row_value.id
          ),
          '{}'::jsonb
        ) as value
        from public.product_orders as row_value
      )
      select jsonb_build_object(
        'payments_manifest', (select value from payments_manifest),
        'payments_row_count', (select count(*) from public.payments),
        'product_orders_manifest', (select value from product_orders_manifest),
        'product_orders_row_count', (select count(*) from public.product_orders)
      );
    `,
    'active table manifest capture',
  )
  return JSON.parse(output)
}

function withActiveTableManifest(source, manifest) {
  return [
    `\\set baseline_payments_manifest '${JSON.stringify(
      manifest.payments_manifest,
    )}'`,
    `\\set baseline_payments_row_count ${manifest.payments_row_count}`,
    `\\set baseline_product_orders_manifest '${JSON.stringify(
      manifest.product_orders_manifest,
    )}'`,
    `\\set baseline_product_orders_row_count ${manifest.product_orders_row_count}`,
    '\\set line_pay_baseline_manifest 1',
    source,
  ].join('\n')
}

const productionBankTransferVerifiers = Object.freeze({
  schema_signature:
    '45d35856ba4ee300e196c562eb8e0e9b37dde94d3bb9d148248163827e005a04',
  pk_digest:
    '4346bb9d65f1fe16ae98a26821e857bf49b158e12ac4e47d251380e6bc518199',
  group_digests: Object.freeze({
    identity_and_amount:
      '61ed62d26b2ffd626b1d494602b10700f6d79cf000ec7045261fbee44cff2c2c',
    payer_contact:
      '5eed83932fd5acd6a6c8fd1a7c8552e8d6c0f4bf67186b096ad702f1fff54c78',
    transfer_details:
      '624fe68a4f252e1128bbdf83e37050e4fbebc3b32828347fd10e5503cc93eb1b',
    review_and_confirmation:
      '0e04c05d7edca9319b6fee5837e186916eded596e9d31a51cfd9d68251524271',
    full_canonical_row:
      'd8ad6430e739d8a3d6d9b8f8d81680b2602313fa2f6b7662753331dda5fc93be',
  }),
  ordinal_digests: Object.freeze({
    ordinal_1: Object.freeze({
      identity_and_amount:
        '8054981959cf9095b36e19da0eea06e34d0b8f8f10379dc9313604e240a7db04',
      payer_contact:
        'f8172854e648abb71491098bb787edfd1b842f52b55c7631b91d8dcb3b14ed94',
      transfer_details:
        'bb6eea7c32aa16e55702e7eb058a7df3cebbbf631433d0c842b1aae135d1f79f',
      review_and_confirmation:
        'af75de6e16537e03fe5b9f1d905120e8cb84d7282de023357e0875b7e116d203',
      full_canonical_row:
        '77df43c18d57e3bb83ad9e285e14ca6429b50f177a353004170cf9863e849bb6',
    }),
    ordinal_2: Object.freeze({
      identity_and_amount:
        '41c0c3b20913fc951ad85057631d462e43f8e6ca335a0eb62c52685aa067d144',
      payer_contact:
        '6a751378fd21bc0574cfa1b412ce1cdd8682505eaf07dacfe0cd0a67893f85b3',
      transfer_details:
        '7e5639668922d5c1ef7e3d0be137bd98a2ccd63b27746984b79f5ee6bde1f0c7',
      review_and_confirmation:
        '1db2ac98556bf945c15586491b5d5f844acf3b767fef307101a401877cbc7677',
      full_canonical_row:
        'ad26153aa542a4310306d00da5c30fc3f3aff75fc71ce4e5385eae804059f514',
    }),
    ordinal_3: Object.freeze({
      identity_and_amount:
        'df58063e371c4dc75807b1426f407119a3cd71241d972ee68177b1e8d754a4ab',
      payer_contact:
        'a1d83ac319167825ab16544ff9a27124639371156607727eabc80a6b8e13f29e',
      transfer_details:
        'f1c8ca740c542cb6b51c330f8125aef55c89289f434058c9516d7558404975b6',
      review_and_confirmation:
        '73396a621108b90cf62be896452e3f4a44191f97febd055e10fd28af3a50b1bf',
      full_canonical_row:
        '782b67bbfb65e1819a24002a0ce4ecd7ab50396e1cf62fe4e8dc8913bb666772',
    }),
  }),
})

function sha256(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

function readBankTransferFixture(database) {
  const source = readFileSync(baselineCapturePath, 'utf8').replace(
    "pg_catalog.current_database() = 'postgres'",
    `pg_catalog.current_database() = '${database}'`,
  )
  const result = JSON.parse(
    psql(database, source, 'bank transfer fixture capture', false, true),
  )
  if (
    result.row_count !== 3 ||
    result.pending_review_count !== 3 ||
    typeof result.schema_signature !== 'string' ||
    typeof result.pk_digest !== 'string'
  ) {
    throw new Error('BANK_TRANSFER_FIXTURE_CAPTURE_INVALID')
  }
  return result
}

function verifierPaths(contract, prefix = []) {
  if (typeof contract === 'string') return [prefix]
  return Object.keys(contract).flatMap((key) =>
    verifierPaths(contract[key], [...prefix, key]),
  )
}

function valueAtPath(contract, path) {
  return path.reduce((value, key) => value[key], contract)
}

function useFixtureContract(source, _fixture, database) {
  const artifact = readBankTransferFixture(database)
  const fixtureVerifiers = {
    schema_signature: sha256(artifact.schema_signature),
    pk_digest: sha256(artifact.pk_digest),
    group_digests: Object.fromEntries(
      Object.entries(artifact.group_digests).map(([key, value]) => [
        key,
        sha256(value),
      ]),
    ),
    ordinal_digests: Object.fromEntries(
      Object.entries(artifact.ordinal_digests).map(([ordinal, value]) => [
        ordinal,
        Object.fromEntries(
          Object.entries(value).map(([key, digest]) => [
            key,
            sha256(digest),
          ]),
        ),
      ]),
    ),
  }
  let output = source.replace(
    '{"name":"postgres","major":17,"recovery":false}',
    `{"name":"${database}","major":17,"recovery":false}`,
  )
  for (const path of verifierPaths(productionBankTransferVerifiers)) {
    output = output.replaceAll(
      valueAtPath(productionBankTransferVerifiers, path),
      valueAtPath(fixtureVerifiers, path),
    )
  }
  return output
}

function useApplicationStateDatabase(source, database) {
  const productionIdentity = "pg_catalog.current_database() = 'postgres'"
  if (source.split(productionIdentity).length !== 2) {
    throw new Error('APPLICATION_STATE_DATABASE_FIXTURE_INVALID')
  }
  return source.replace(
    productionIdentity,
    `pg_catalog.current_database() = '${database}'`,
  )
}

function stripDeployAttestationMarkers(output) {
  const rows = output.split(/\r?\n/u).filter(Boolean)
  const markerSet = new Set(deployAttestationMarkers)
  const observedMarkers = rows.filter((row) => markerSet.has(row))
  if (observedMarkers.length === 0) return output
  if (
    observedMarkers.length !== deployAttestationMarkers.length ||
    observedMarkers.some(
      (marker, index) => marker !== deployAttestationMarkers[index],
    )
  ) {
    throw new Error('DEPLOY_TRANSACTION_ATTESTATION_INVALID')
  }
  return rows.filter((row) => !markerSet.has(row)).join('\n')
}

function assertAuditStatus(output, expected) {
  const rows = stripDeployAttestationMarkers(output)
    .split(/\r?\n/u)
    .filter(Boolean)
  if (rows.length !== 1) throw new Error('AUDIT_OUTPUT_ROW_COUNT_INVALID')
  const result = JSON.parse(rows[0])
  if (result.status !== expected) {
    throw new Error(
      `AUDIT_STATUS_MISMATCH:${result.status}:${JSON.stringify({
        database: result.database,
        line_pay: result.line_pay,
        fence: result.fence,
        historical: result.historical,
        locks: result.locks,
        migration_history: result.migration_history,
      })}`,
    )
  }
  return result
}

function assertAuditFailureStatus(output, expected) {
  const rows = stripDeployAttestationMarkers(output)
    .split(/\r?\n/u)
    .filter(Boolean)
  if (rows.length !== 1) throw new Error('AUDIT_OUTPUT_ROW_COUNT_INVALID')
  const result = JSON.parse(rows[0])
  if (result.status !== expected) {
    throw new Error(
      `AUDIT_FAILURE_STATUS_MISMATCH:${expected}:${result.status}`,
    )
  }
}

function assertNoLinePayObjects(database) {
  const output = psql(
    database,
    `
      select jsonb_build_object(
        'relations', (
          select count(*)
          from pg_class as relation
          join pg_namespace as namespace on namespace.oid = relation.relnamespace
          where (namespace.nspname, relation.relname) in (
            ('public', 'app_environment_attestation'),
            ('public', 'line_pay_checkout_attempts'),
            ('public', 'line_pay_request_outbox'),
            ('public', 'line_pay_callback_capabilities'),
            ('public', 'line_pay_callback_events'),
            ('public', 'line_pay_payment_audit_events'),
            ('line_pay_private', 'line_pay_completion_proofs')
          )
        ),
        'roles', (
          select count(*)
          from pg_roles
          where rolname in (
            'line_pay_payment_executor',
            'line_pay_payment_function_owner'
          )
        )
      );
    `,
    'rollback inventory',
  )
  const result = JSON.parse(output)
  if (result.relations !== 0 || result.roles !== 0) {
    throw new Error(
      `MIGRATION_ROLLBACK_INCOMPLETE:relations=${result.relations}:roles=${result.roles}`,
    )
  }
}

function runHostedNonSuperuserMigrationScenario() {
  const database = 'exact_file_hosted_executor'
  const executor = 'postgres'
  const clusterAdmin = 'line_pay_cluster_admin_fixture'
  const originalPostgres = 'line_pay_original_postgres_fixture'
  const unexpectedMember = 'line_pay_unexpected_executor_member'

  psql(
    'postgres',
    `
      create role ${clusterAdmin}
        login inherit superuser createdb createrole replication bypassrls;
    `,
    'create hosted cluster admin role',
  )
  psqlAs(
    'postgres',
    clusterAdmin,
    `alter role postgres rename to ${originalPostgres};`,
    'reserve production executor role name',
  )
  psqlAs(
    'postgres',
    clusterAdmin,
    `
      create role ${executor}
        login inherit nosuperuser createdb createrole replication bypassrls;
    `,
    'create hosted executor role',
  )
  psqlAs(
    'postgres',
    clusterAdmin,
    `create database ${database} owner ${executor};`,
    'create hosted executor db',
  )
  psqlFileAs(
    database,
    clusterAdmin,
    'supabase/tests/line_pay_local_postgres_bootstrap.sql',
  )
  psqlAs(
    database,
    clusterAdmin,
    `
      grant all on schema auth to ${executor};
      grant all on all tables in schema auth to ${executor};
      grant all on all sequences in schema auth to ${executor};
      grant all on all routines in schema auth to ${executor};
      grant anon, authenticated, service_role
        to ${executor} with admin option;
    `,
    'grant hosted executor baseline capabilities',
  )
  prepareBaselineForUser(database, executor)

  const executorState = psqlAs(
    database,
    executor,
    `
      select jsonb_build_object(
        'superuser', role.rolsuper,
        'createdb', role.rolcreatedb,
        'createrole', role.rolcreaterole,
        'replication', role.rolreplication,
        'bypassrls', role.rolbypassrls,
        'createrole_self_grant',
          pg_catalog.current_setting('createrole_self_grant')
      )
      from pg_catalog.pg_roles as role
      where role.rolname = current_user;
    `,
    'hosted executor role state',
  )
  if (
    executorState !==
    '{"createdb": true, "bypassrls": true, "superuser": false, "createrole": true, "replication": true, "createrole_self_grant": ""}'
  ) {
    throw new Error(`HOSTED_EXECUTOR_ROLE_STATE_INVALID:${executorState}`)
  }

  const before = readFingerprints(database, false, executor)
  const activeTableManifest = readActiveTableManifests(database)
  const hostedPreflight = useFixtureContract(
    readFileSync(preflightPath, 'utf8'),
    before,
    database,
  )
  const hostedPostflight = withActiveTableManifest(
    useFixtureContract(
      readFileSync(postflightPath, 'utf8'),
      before,
      database,
    ),
    activeTableManifest,
  )
  assertAuditStatus(
    psqlAs(
      database,
      executor,
      hostedPreflight,
      'hosted executor preflight',
    ),
    'READY_EXPECTED',
    before,
  )
  assertAuditFailureStatus(
    psqlAs(
      database,
      executor,
      `begin;
set local createrole_self_grant = 'inherit';
${hostedPreflight}
rollback;`,
      'hosted incapable executor preflight',
      false,
      true,
    ),
    'SCHEMA_DRIFT',
  )

  writeContainerFile(
    '/workspace/supabase/deployment/line_pay_remediation_preflight.sql',
    hostedPreflight,
  )
  writeContainerFile(
    '/workspace/supabase/deployment/line_pay_remediation_postflight.sql',
    useFixtureContract(
      readFileSync(postflightPath, 'utf8'),
      before,
      database,
    ),
  )
  writeContainerFile(
    '/workspace/supabase/deployment/line_pay_remediation_deploy.sql',
    readFileSync(deployPath, 'utf8'),
  )
  const hostedDeployOutput = psqlContainerFileAs(
    database,
    executor,
    '/workspace/supabase/deployment/line_pay_remediation_deploy.sql',
    'hosted non-superuser deploy orchestration',
  )
  for (const marker of deployAttestationMarkers) {
    if (hostedDeployOutput.split(marker).length !== 2) {
      throw new Error(`HOSTED_DEPLOY_ATTESTATION_MISSING:${marker}`)
    }
  }
  assertAuditStatus(
    hostedDeployOutput,
    'DATABASE_CONTRACTS_READY_RUNTIME_DISABLED',
  )

  const after = readFingerprints(database, true, executor)
  if (JSON.stringify(before) !== JSON.stringify(after)) {
    throw new Error('HOSTED_EXECUTOR_EXISTING_DATA_FINGERPRINT_CHANGED')
  }

  const hostedApplicationStateDiagnostic = useApplicationStateDatabase(
    readFileSync(applicationStateDiagnosticPath, 'utf8'),
    database,
  )
  const hostedApplicationState = parseAndValidateDiagnosticOutput(
    psqlAs(
      database,
      executor,
      hostedApplicationStateDiagnostic,
      'hosted executor formal application-state diagnostic',
    ),
  )
  if (hostedApplicationState.application_state !== 'FULL_WITHOUT_HISTORY') {
    throw new Error(
      `HOSTED_APPLICATION_STATE_INVALID:${hostedApplicationState.application_state}`,
    )
  }

  const contract = JSON.parse(
    psqlAs(
      database,
      executor,
      `
        select jsonb_build_object(
          'relations', (
            select pg_catalog.count(*)
            from pg_catalog.pg_class as relation
            join pg_catalog.pg_namespace as namespace
              on namespace.oid = relation.relnamespace
            where relation.relkind in ('r', 'p')
              and (namespace.nspname, relation.relname) in (
                ('public', 'app_environment_attestation'),
                ('public', 'line_pay_checkout_attempts'),
                ('public', 'line_pay_request_outbox'),
                ('public', 'line_pay_callback_capabilities'),
                ('public', 'line_pay_callback_events'),
                ('public', 'line_pay_payment_audit_events'),
                ('line_pay_private', 'line_pay_completion_proofs')
              )
          ),
          'admin_only_executor_memberships', (
            select pg_catalog.count(*)
            from pg_catalog.pg_auth_members as membership
            join pg_catalog.pg_roles as granted_role
              on granted_role.oid = membership.roleid
            join pg_catalog.pg_roles as member_role
              on member_role.oid = membership.member
            join pg_catalog.pg_roles as grantor_role
              on grantor_role.oid = membership.grantor
            where granted_role.rolname in (
                'line_pay_payment_executor',
                'line_pay_payment_function_owner'
              )
              and member_role.rolname = current_user
              and grantor_role.rolsuper
              and membership.admin_option
              and not membership.inherit_option
              and not membership.set_option
          ),
          'unsafe_dedicated_role_memberships', (
            select pg_catalog.count(*)
            from pg_catalog.pg_auth_members as membership
            join pg_catalog.pg_roles as granted_role
              on granted_role.oid = membership.roleid
            join pg_catalog.pg_roles as member_role
              on member_role.oid = membership.member
            join pg_catalog.pg_roles as grantor_role
              on grantor_role.oid = membership.grantor
            where (
              granted_role.rolname in (
                'line_pay_payment_executor',
                'line_pay_payment_function_owner'
              )
              or member_role.rolname in (
                'line_pay_payment_executor',
                'line_pay_payment_function_owner'
              )
            )
            and not (
              granted_role.rolname in (
                'line_pay_payment_executor',
                'line_pay_payment_function_owner'
              )
              and member_role.rolname = current_user
              and grantor_role.rolsuper
              and membership.admin_option
              and not membership.inherit_option
              and not membership.set_option
            )
          ),
          'private_schema_owner', (
            select owner.rolname
            from pg_catalog.pg_namespace as namespace
            join pg_catalog.pg_roles as owner
              on owner.oid = namespace.nspowner
            where namespace.nspname = 'line_pay_private'
          ),
          'completion_proof_owner', (
            select owner.rolname
            from pg_catalog.pg_class as relation
            join pg_catalog.pg_namespace as namespace
              on namespace.oid = relation.relnamespace
            join pg_catalog.pg_roles as owner
              on owner.oid = relation.relowner
            where namespace.nspname = 'line_pay_private'
              and relation.relname = 'line_pay_completion_proofs'
          ),
          'runtime_attestations', (
            select pg_catalog.count(*)
            from public.app_environment_attestation
          )
        );
      `,
      'hosted executor post-migration contract',
    ),
  )
  if (
    contract.relations !== 7 ||
    contract.admin_only_executor_memberships !== 2 ||
    contract.unsafe_dedicated_role_memberships !== 0 ||
    contract.private_schema_owner !==
      'line_pay_payment_function_owner' ||
    contract.completion_proof_owner !==
      'line_pay_payment_function_owner' ||
    contract.runtime_attestations !== 0
  ) {
    throw new Error(
      `HOSTED_EXECUTOR_POST_MIGRATION_CONTRACT_FAILED:${JSON.stringify(
        contract,
      )}`,
    )
  }

  psqlAs(
    database,
    clusterAdmin,
    `
      grant line_pay_payment_function_owner to ${executor}
        with admin true, inherit false, set true;
    `,
    'hosted unsafe SET membership mutation',
  )
  assertAuditFailureStatus(
    psqlAs(
      database,
      executor,
      hostedPostflight,
      'hosted unsafe SET membership postflight',
    ),
    'POSTFLIGHT_CONTRACT_FAILED',
  )
  const unsafeSetApplicationState = parseAndValidateDiagnosticOutput(
    psqlAs(
      database,
      executor,
      hostedApplicationStateDiagnostic,
      'hosted unsafe SET membership application-state diagnostic',
    ),
  )
  if (unsafeSetApplicationState.application_state !== 'PARTIAL') {
    throw new Error(
      `HOSTED_UNSAFE_SET_APPLICATION_STATE_INVALID:${unsafeSetApplicationState.application_state}`,
    )
  }
  psqlAs(
    database,
    clusterAdmin,
    `
      grant line_pay_payment_function_owner to ${executor}
        with admin true, inherit false, set false;
    `,
    'restore hosted unsafe SET membership mutation',
  )
  assertAuditStatus(
    psqlAs(
      database,
      executor,
      hostedPostflight,
      'restored hosted SET membership postflight',
    ),
    'DATABASE_CONTRACTS_READY_RUNTIME_DISABLED',
  )

  psqlAs(
    database,
    clusterAdmin,
    `create role ${unexpectedMember} nologin noinherit;`,
    'create hosted unexpected member role',
  )
  psqlAs(
    database,
    executor,
    `
      grant line_pay_payment_executor to ${unexpectedMember}
        with admin false, inherit false, set false;
    `,
    'hosted duplicate membership mutation',
  )
  assertAuditFailureStatus(
    psqlAs(
      database,
      executor,
      hostedPostflight,
      'hosted duplicate membership postflight',
    ),
    'POSTFLIGHT_CONTRACT_FAILED',
  )
  const duplicateMembershipApplicationState =
    parseAndValidateDiagnosticOutput(
      psqlAs(
        database,
        executor,
        hostedApplicationStateDiagnostic,
        'hosted duplicate membership application-state diagnostic',
      ),
    )
  if (duplicateMembershipApplicationState.application_state !== 'PARTIAL') {
    throw new Error(
      `HOSTED_DUPLICATE_MEMBERSHIP_APPLICATION_STATE_INVALID:${duplicateMembershipApplicationState.application_state}`,
    )
  }
  psqlAs(
    database,
    executor,
    `revoke line_pay_payment_executor from ${unexpectedMember};`,
    'restore hosted duplicate membership mutation',
  )
  psqlAs(
    database,
    clusterAdmin,
    `drop role ${unexpectedMember};`,
    'drop hosted unexpected member role',
  )
  assertAuditStatus(
    psqlAs(
      database,
      executor,
      hostedPostflight,
      'restored hosted duplicate membership postflight',
    ),
    'DATABASE_CONTRACTS_READY_RUNTIME_DISABLED',
  )
  const restoredApplicationState = parseAndValidateDiagnosticOutput(
    psqlAs(
      database,
      executor,
      hostedApplicationStateDiagnostic,
      'restored hosted application-state diagnostic',
    ),
  )
  if (restoredApplicationState.application_state !== 'FULL_WITHOUT_HISTORY') {
    throw new Error(
      `HOSTED_RESTORED_APPLICATION_STATE_INVALID:${restoredApplicationState.application_state}`,
    )
  }

  psqlAs(
    'postgres',
    clusterAdmin,
    `drop database ${database};`,
    'drop hosted executor db',
  )
  psqlAs(
    'postgres',
    clusterAdmin,
    `
      drop role line_pay_payment_executor;
      drop role line_pay_payment_function_owner;
      drop role ${executor};
      alter role ${originalPostgres} rename to postgres;
    `,
    'restore original postgres role',
  )
  psql(
    'postgres',
    `drop role ${clusterAdmin};`,
    'drop hosted cluster admin role',
  )
}

function readLinePayFunctionMetadata(database) {
  return JSON.parse(
    psql(
      database,
      `
        select jsonb_agg(to_jsonb(row_value) order by schema_name, function_name, argument_types)
        from (
          select
            namespace.nspname as schema_name,
            procedure.proname as function_name,
            pg_catalog.oidvectortypes(procedure.proargtypes) as argument_types,
            pg_catalog.format_type(procedure.prorettype, null) as return_type,
            language.lanname as language_name,
            owner.rolname as owner_name,
            procedure.prosecdef as security_definer,
            procedure.provolatile as volatility,
            procedure.proparallel as parallel_safety,
            procedure.proleakproof as leakproof,
            procedure.proconfig as configuration,
            procedure.proacl::text as raw_acl
          from pg_catalog.pg_proc as procedure
          join pg_catalog.pg_namespace as namespace
            on namespace.oid = procedure.pronamespace
          join pg_catalog.pg_language as language
            on language.oid = procedure.prolang
          join pg_catalog.pg_roles as owner on owner.oid = procedure.proowner
          where procedure.proname in (
            'line_pay_sanitized_result_is_valid',
            'line_pay_audit_evidence_is_valid',
            'line_pay_touch_updated_at',
            'line_pay_enforce_attempt_transition',
            'line_pay_enforce_payment_transition',
            'line_pay_enforce_product_order_transition',
            'line_pay_enforce_outbox_transition',
            'line_pay_enforce_callback_capability_transition',
            'line_pay_enforce_callback_event_transition',
            'claim_product_order_line_pay_request',
            'record_product_order_line_pay_request_success',
            'record_product_order_line_pay_request_failure',
            'mark_product_order_line_pay_request_unknown',
            'read_product_order_line_pay_request_result',
            'claim_line_pay_callback_capability',
            'claim_product_order_line_pay_confirmation',
            'record_product_order_line_pay_confirmation_evidence',
            'complete_product_order_line_pay_confirmation',
            'cancel_product_order_line_pay_payment',
            'mark_product_order_line_pay_reconciliation',
            'line_pay_enforce_completion_proof'
          )
        ) as row_value;
      `,
      'function metadata diagnostics',
    ),
  )
}

function runDeployOrchestrationScenario() {
  const database = 'exact_file_orchestration'
  psql('postgres', `create database ${database};`, 'create orchestration db')
  prepareBaseline(database)
  const baseline = readFingerprints(database, false)
  runDocker([
    'exec',
    containerName,
    'mkdir',
    '-p',
    '/workspace/supabase/deployment',
    '/workspace/supabase/migrations',
  ])
  writeContainerFile(
    '/workspace/supabase/deployment/line_pay_remediation_preflight.sql',
    useFixtureContract(readFileSync(preflightPath, 'utf8'), baseline, database),
  )
  writeContainerFile(
    '/workspace/supabase/deployment/line_pay_remediation_postflight.sql',
    useFixtureContract(readFileSync(postflightPath, 'utf8'), baseline, database),
  )
  writeContainerFile(
    '/workspace/supabase/deployment/line_pay_remediation_deploy.sql',
    readFileSync(deployPath, 'utf8'),
  )
  runDocker([
    'cp',
    migrationPath,
    `${containerName}:/workspace/supabase/migrations/20260719033404_line_pay_remediation_contracts.sql`,
  ])
  const deployStartedAt = Date.now()
  const deployOutput = psqlContainerFile(
      database,
      '/workspace/supabase/deployment/line_pay_remediation_deploy.sql',
      'locked deploy orchestration',
    )
  measuredLockedDeployMs = Date.now() - deployStartedAt
  assertAuditStatus(
    deployOutput,
    'DATABASE_CONTRACTS_READY_RUNTIME_DISABLED',
    baseline,
  )
  psql(
    'postgres',
    `
      drop database ${database} with (force);
      drop role line_pay_payment_executor;
      drop role line_pay_payment_function_owner;
    `,
    'orchestration cleanup',
  )
}

function runManifestDriftScenario(database, label, mutationSql) {
  psql('postgres', `create database ${database};`, `create ${label} db`)
  prepareBaseline(database)
  const baseline = readFingerprints(database, false)
  writeContainerFile(
    '/workspace/supabase/deployment/line_pay_remediation_preflight.sql',
    useFixtureContract(readFileSync(preflightPath, 'utf8'), baseline, database),
  )
  writeContainerFile(
    '/workspace/supabase/deployment/line_pay_remediation_postflight.sql',
    useFixtureContract(readFileSync(postflightPath, 'utf8'), baseline, database),
  )
  writeContainerFile(
    '/workspace/supabase/deployment/line_pay_remediation_deploy.sql',
    readFileSync(deployPath, 'utf8').replace(
      '\\set line_pay_baseline_manifest 1',
      `${mutationSql}
\\set line_pay_baseline_manifest 1`,
    ),
  )
  assertAuditFailureStatus(
    psqlContainerFile(
      database,
      '/workspace/supabase/deployment/line_pay_remediation_deploy.sql',
      `${label} orchestration`,
    ),
    'POSTFLIGHT_CONTRACT_FAILED',
  )
  psql(
    'postgres',
    `
      drop database ${database} with (force);
      drop role line_pay_payment_executor;
      drop role line_pay_payment_function_owner;
    `,
    `${label} cleanup`,
  )
}

function runManifestDriftScenarios() {
  runManifestDriftScenario(
    'exact_file_manifest_business_drift',
    'business-field mutation',
    `
update public.payments
set item_name = 'post-commit synthetic drift'
where id = '20000000-0000-4000-8000-000000000001';`,
  )
  runManifestDriftScenario(
    'exact_file_manifest_unexpected_row',
    'unexpected-row mutation',
    `
insert into public.product_orders (
  id, order_no, user_id, total_amount_twd, payment_method,
  payment_status, order_status, shipping_status, payment_id
) values (
  '30000000-0000-4000-8000-000000000099',
  'POST-COMMIT-SYNTHETIC-ORDER',
  null,
  100,
  'newebpay',
  'pending',
  'pending_payment',
  'not_shipped',
  null
);`,
  )
  runManifestDriftScenario(
    'exact_file_manifest_missing_row',
    'missing-row mutation',
    `
delete from public.product_orders
where id = '30000000-0000-4000-8000-000000000004';`,
  )
}

async function runPostMigrationGapDriftScenario() {
  const database = 'exact_file_manifest_concurrent_gap_drift'
  psql('postgres', `create database ${database};`, 'create concurrent gap db')
  prepareBaseline(database)
  const baseline = readFingerprints(database, false)
  writeContainerFile(
    '/workspace/supabase/deployment/line_pay_remediation_preflight.sql',
    useFixtureContract(readFileSync(preflightPath, 'utf8'), baseline, database),
  )
  writeContainerFile(
    '/workspace/supabase/deployment/line_pay_remediation_postflight.sql',
    useFixtureContract(readFileSync(postflightPath, 'utf8'), baseline, database),
  )
  writeContainerFile(
    '/workspace/supabase/deployment/line_pay_remediation_deploy.sql',
    readFileSync(deployPath, 'utf8').replace(
      '\\ir ../migrations/20260719033404_line_pay_remediation_contracts.sql',
      `\\ir ../migrations/20260719033404_line_pay_remediation_contracts.sql
select pg_sleep(5);`,
    ),
  )
  const deployment = startContainerPsqlFile(
    database,
    '/workspace/supabase/deployment/line_pay_remediation_deploy.sql',
  )
  await waitForCommittedMigration(database)
  psql(
    database,
    `
      update public.payments
      set item_name = 'concurrent post-commit synthetic drift'
      where id = '20000000-0000-4000-8000-000000000001';
    `,
    'concurrent post-migration business-field mutation',
  )
  const result = await deployment.completion
  if (result.code !== 0) throw new Error('POST_MIGRATION_GAP_DEPLOY_FAILED')
  assertAuditFailureStatus(
    result.stdout,
    'POSTFLIGHT_CONTRACT_FAILED',
  )
  if (
    psql(
      database,
      "select to_regclass('public.line_pay_checkout_attempts') is not null;",
      'committed Migration evidence',
    ) !== 't' ||
    psql(
      database,
      `
        select item_name = 'concurrent post-commit synthetic drift'
        from public.payments
        where id = '20000000-0000-4000-8000-000000000001';
      `,
      'committed concurrent drift evidence',
    ) !== 't'
  ) {
    throw new Error('POST_MIGRATION_GAP_FIXTURE_INVALID')
  }
  psql(
    'postgres',
    `
      drop database ${database} with (force);
      drop role line_pay_payment_executor;
      drop role line_pay_payment_function_owner;
    `,
    'concurrent gap cleanup',
  )
}

async function runLockedTimeoutScenario(tableName) {
  const database = `exact_file_timeout_${tableName}`
  psql('postgres', `create database ${database};`, `create ${tableName} timeout db`)
  prepareBaseline(database)
  const before = readFingerprints(database, false)
  writeContainerFile(
    '/workspace/supabase/deployment/line_pay_remediation_preflight.sql',
    useFixtureContract(readFileSync(preflightPath, 'utf8'), before, database),
  )
  writeContainerFile(
    '/workspace/supabase/deployment/line_pay_remediation_postflight.sql',
    useFixtureContract(readFileSync(postflightPath, 'utf8'), before, database),
  )
  writeContainerFile(
    '/workspace/supabase/deployment/line_pay_remediation_deploy.sql',
    readFileSync(deployPath, 'utf8')
      .replace("set local lock_timeout = '15s';", "set local lock_timeout = '0';")
      .replace(
        "set local statement_timeout = '120s';",
        "set local statement_timeout = '750ms';",
      ),
  )
  const blocker = await startBlockingLock(database, tableName)
  let failure
  try {
    psqlContainerFile(
      database,
      '/workspace/supabase/deployment/line_pay_remediation_deploy.sql',
      `${tableName} statement timeout`,
    )
  } catch (error) {
    failure = error
  }
  if (
    !(failure instanceof Error) ||
    !failure.message.includes('canceling statement due to statement timeout')
  ) {
    throw new Error(`${tableName}:STATEMENT_TIMEOUT_NOT_OBSERVED`)
  }
  if ((await blocker.completion) !== 0) {
    throw new Error(`${tableName}:LOCK_HOLDER_FAILED`)
  }
  assertNoLinePayObjects(database)
  const after = readFingerprints(database, false)
  if (JSON.stringify(before) !== JSON.stringify(after)) {
    throw new Error(`${tableName}:TIMEOUT_ROLLBACK_FINGERPRINT_CHANGED`)
  }
  psql(
    'postgres',
    `drop database ${database} with (force);`,
    `${tableName} timeout cleanup`,
  )
}

function cleanup() {
  spawnSync('docker', ['rm', '--force', containerName], {
    cwd: root,
    encoding: 'utf8',
  })
  spawnSync('docker', ['volume', 'rm', volumeName], {
    cwd: root,
    encoding: 'utf8',
  })
  spawnSync('docker', ['network', 'rm', networkName], {
    cwd: root,
    encoding: 'utf8',
  })
}

async function waitForPostgres() {
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
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250))
  }
  throw new Error('POSTGRES_FINAL_SERVER_NOT_READY')
}

async function main() {
  const localImage = spawnSync('docker', ['image', 'inspect', image], {
    cwd: root,
    encoding: 'utf8',
  })
  if (localImage.status !== 0) runDocker(['pull', image])
  const digests = JSON.parse(
    runDocker(['image', 'inspect', '--format', '{{json .RepoDigests}}', image]),
  )
  if (!Array.isArray(digests) || !digests.includes(image)) {
    throw new Error('POSTGRES_IMAGE_REPOSITORY_DIGEST_MISMATCH')
  }
  runDocker(['network', 'create', '--label', `task=${taskLabel}`, networkName])
  runDocker(['volume', 'create', '--label', `task=${taskLabel}`, volumeName])
  runDocker([
    'run',
    '--detach',
    '--name',
    containerName,
    '--network',
    networkName,
    '--label',
    `task=${taskLabel}`,
    '--env',
    `POSTGRES_PASSWORD=${password}`,
    '--mount',
    `type=volume,source=${volumeName},target=/var/lib/postgresql/data`,
    image,
  ])
  await waitForPostgres()
  const version = runDocker([
    'exec',
    containerName,
    'postgres',
    '--version',
  ])
  if (!/^postgres \(PostgreSQL\) 17(?:[.]|$)/u.test(version)) {
    throw new Error('POSTGRES_MAJOR_VERSION_MISMATCH')
  }
  runDocker([
    'exec',
    containerName,
    'mkdir',
    '-p',
    '/workspace/supabase/deployment',
    '/workspace/supabase/migrations',
  ])
  runDocker([
    'cp',
    migrationPath,
    `${containerName}:/workspace/supabase/migrations/20260719033404_line_pay_remediation_contracts.sql`,
  ])
  runHostedNonSuperuserMigrationScenario()
  await runLockedTimeoutScenario('payments')
  await runLockedTimeoutScenario('product_orders')
  runDeployOrchestrationScenario()
  runManifestDriftScenarios()
  await runPostMigrationGapDriftScenario()

  psql('postgres', 'create database exact_file_success;', 'create success db')
  psql('postgres', 'create database exact_file_rollback;', 'create rollback db')

  prepareBaseline('exact_file_rollback')
  psql(
    'exact_file_rollback',
    `
      alter table public.product_orders
        drop constraint product_orders_payment_method_check;
      alter table public.product_orders
        add constraint product_orders_payment_method_check unique (id);
    `,
    'conflicting constraint fixture',
  )
  psql(
    'exact_file_rollback',
    readFileSync(migrationPath, 'utf8'),
    'rollback mutation',
    true,
  )
  assertNoLinePayObjects('exact_file_rollback')

  prepareBaseline('exact_file_success')
  const before = readFingerprints('exact_file_success', false)
  const activeTableManifest = readActiveTableManifests('exact_file_success')
  const preflight = useFixtureContract(
    readFileSync(preflightPath, 'utf8'),
    before,
    'exact_file_success',
  )
  assertAuditStatus(
    psql('exact_file_success', preflight, 'read-only preflight'),
    'READY_EXPECTED',
    before,
  )
  const preflightMutations = [
    {
      label: 'partial private schema',
      status: 'PARTIAL_APPLICATION',
      apply: 'create schema line_pay_private;',
    },
    {
      label: 'partial dedicated role',
      status: 'PARTIAL_APPLICATION',
      apply: 'create role line_pay_payment_executor nologin;',
    },
    {
      label: 'partial expected relation',
      status: 'PARTIAL_APPLICATION',
      apply: 'create table public.line_pay_request_outbox (id integer);',
    },
    {
      label: 'partial added column',
      status: 'PARTIAL_APPLICATION',
      apply: 'alter table public.payments add column environment text;',
    },
    {
      label: 'partial index',
      status: 'PARTIAL_APPLICATION',
      apply: 'create index line_pay_partial_index on public.payments (id);',
    },
    {
      label: 'migration history drift',
      status: 'SCHEMA_DRIFT',
      apply:
        'create schema supabase_migrations; create table supabase_migrations.schema_migrations (version text);',
    },
    {
      label: 'Fence ACL drift',
      status: 'FENCE_REGRESSION',
      apply:
        'grant insert on table public.bank_transfer_submissions to authenticated;',
    },
    {
      label: 'historical data drift',
      status: 'PRODUCTION_DATA_DRIFT',
      apply:
        "update public.bank_transfer_submissions set item_name = 'synthetic drift' where id = '21000000-0000-4000-8000-000000000001';",
    },
  ]
  for (const mutation of preflightMutations) {
    assertAuditFailureStatus(
      psql(
        'exact_file_success',
        `begin;\n${mutation.apply}\n${preflight}\nrollback;`,
        `${mutation.label} preflight`,
        false,
        true,
      ),
      mutation.status,
    )
    assertAuditStatus(
      psql(
        'exact_file_success',
        preflight,
        `${mutation.label} restored preflight`,
      ),
      'READY_EXPECTED',
      before,
    )
  }
  psql(
    'exact_file_success',
    readFileSync(migrationPath, 'utf8'),
    'exact LINE Pay Migration',
  )
  const after = readFingerprints('exact_file_success', true)
  if (JSON.stringify(before) !== JSON.stringify(after)) {
    const changedFields = Object.keys(before).flatMap((table) =>
      Object.keys(before[table])
        .filter((key) => before[table][key] !== after[table][key])
        .map((key) => `${table}.${key}`),
    )
    throw new Error(
      `EXISTING_DATA_FINGERPRINT_CHANGED:${changedFields.join(',')}`,
    )
  }
  assertAuditFailureStatus(
    psql(
      'exact_file_success',
      preflight,
      'already-applied preflight',
    ),
    'ALREADY_APPLIED',
  )
  const postflight = withActiveTableManifest(
    useFixtureContract(
      readFileSync(postflightPath, 'utf8'),
      after,
      'exact_file_success',
    ),
    activeTableManifest,
  )
  const postflightOutput = psql(
    'exact_file_success',
    postflight,
    'read-only postflight',
  )
  const parsedPostflight = JSON.parse(postflightOutput)
  if (parsedPostflight.line_pay?.functions_exact === false) {
    throw new Error(
      `FUNCTION_CONTRACT_MISMATCH:${JSON.stringify(
        readLinePayFunctionMetadata('exact_file_success'),
      )}`,
    )
  }
  const postflightResult = assertAuditStatus(
    postflightOutput,
    'DATABASE_CONTRACTS_READY_RUNTIME_DISABLED',
    after,
  )
  if (
    Object.values(postflightResult.line_pay.new_relation_rows).some(
      (count) => count !== 0,
    )
  ) {
    throw new Error('NEW_LINE_PAY_RELATION_NOT_EMPTY')
  }

  const catalogMutations = [
    {
      label: 'function metadata',
      apply:
        'alter function public.line_pay_sanitized_result_is_valid(jsonb) parallel unsafe;',
      restore:
        'alter function public.line_pay_sanitized_result_is_valid(jsonb) parallel safe;',
    },
    {
      label: 'column default',
      apply:
        'alter table public.line_pay_checkout_attempts alter column request_state drop default;',
      restore:
        "alter table public.line_pay_checkout_attempts alter column request_state set default 'initialized';",
    },
    {
      label: 'constraint inventory',
      apply:
        'alter table public.line_pay_checkout_attempts add constraint line_pay_unreviewed_contract check (true);',
      restore:
        'alter table public.line_pay_checkout_attempts drop constraint line_pay_unreviewed_contract;',
    },
    {
      label: 'index inventory',
      apply:
        'create index line_pay_unreviewed_index on public.line_pay_checkout_attempts (created_at);',
      restore: 'drop index public.line_pay_unreviewed_index;',
    },
    {
      label: 'trigger metadata',
      apply:
        'alter table public.line_pay_checkout_attempts disable trigger line_pay_checkout_attempts_transition_guard;',
      restore:
        'alter table public.line_pay_checkout_attempts enable trigger line_pay_checkout_attempts_transition_guard;',
    },
    {
      label: 'policy metadata',
      apply:
        'alter policy line_pay_payment_function_owner_payments_select on public.payments to public;',
      restore:
        'alter policy line_pay_payment_function_owner_payments_select on public.payments to line_pay_payment_function_owner;',
    },
    {
      label: 'role metadata',
      apply: 'alter role line_pay_payment_executor inherit;',
      restore: 'alter role line_pay_payment_executor noinherit;',
    },
    {
      label: 'role membership exact count',
      apply:
        'grant line_pay_payment_executor to current_user with admin true, inherit false, set false;',
      restore: 'revoke line_pay_payment_executor from current_user;',
    },
    {
      label: 'relation ACL',
      apply:
        'grant select on table public.line_pay_checkout_attempts to public;',
      restore:
        'revoke select on table public.line_pay_checkout_attempts from public;',
    },
    {
      label: 'schema ACL',
      apply: 'grant usage on schema line_pay_private to public;',
      restore: 'revoke usage on schema line_pay_private from public;',
    },
    {
      label: 'relation comment',
      apply:
        "comment on table public.line_pay_checkout_attempts is 'synthetic catalog drift';",
      restore:
        'comment on table public.line_pay_checkout_attempts is null;',
    },
  ]
  for (const mutation of catalogMutations) {
    psql(
      'exact_file_success',
      mutation.apply,
      `${mutation.label} mutation`,
    )
    assertAuditFailureStatus(
      psql(
        'exact_file_success',
        postflight,
        `${mutation.label} postflight`,
      ),
      'POSTFLIGHT_CONTRACT_FAILED',
    )
    psql(
      'exact_file_success',
      mutation.restore,
      `${mutation.label} restore`,
    )
    assertAuditStatus(
      psql(
        'exact_file_success',
        postflight,
        `${mutation.label} restored postflight`,
      ),
      'DATABASE_CONTRACTS_READY_RUNTIME_DISABLED',
      after,
    )
  }

  process.stdout.write(
    'line_pay_production_exact_file_contracts: PASS ' +
      '(PostgreSQL 17, final_server_readiness=PASS, ' +
      'hosted_non_superuser_deploy=PASS, preflight, exact Migration, postflight, ' +
      'server_timeouts=2/2, active_manifest=PASS, manifest_drifts=4/4 caught, ' +
      `catalog mutations, rollback, cleanup, locked_deploy_ms=${measuredLockedDeployMs})\n`,
  )
}

try {
  await main()
} finally {
  cleanup()
}
