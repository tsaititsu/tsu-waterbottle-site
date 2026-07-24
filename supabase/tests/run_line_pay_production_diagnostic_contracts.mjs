import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import {
  parseAndValidateDiagnosticOutput,
} from '../../scripts/supabase/validate-line-pay-production-diagnostic.mjs'
import { LINE_PAY_POSTGRES_IMAGE } from './line_pay_postgres_image.mjs'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const root = resolve(scriptDirectory, '../..')
const taskLabel = 'line-pay-production-data-drift-diagnostic'
const suffix = randomBytes(6).toString('hex')
const containerName = `${taskLabel}-${suffix}`
const networkName = `${containerName}-network`
const volumeName = `${containerName}-data`
const password = randomBytes(32).toString('base64url')
const image = LINE_PAY_POSTGRES_IMAGE
const diagnosticPath = join(
  root,
  'supabase/deployment/line_pay_remediation_diagnostic.sql',
)
const fencePath = join(
  root,
  'supabase/migrations/20260722065311_retire_bank_transfer_submissions_writes.sql',
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

function psql(sql, label, options = {}) {
  const result = spawnSync(
    'docker',
    [
      'exec',
      '-i',
      ...(options.readOnly
        ? ['--env', `PGOPTIONS=${fixedPgOptions}`]
        : []),
      containerName,
      'psql',
      '-X',
      '--set=ON_ERROR_STOP=1',
      ...(options.quiet ? ['--quiet'] : []),
      '--no-align',
      '--tuples-only',
      '-U',
      'postgres',
      '-d',
      'postgres',
    ],
    {
      cwd: root,
      encoding: 'utf8',
      input: sql,
    },
  )
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
      create schema supabase_migrations;
      create table supabase_migrations.schema_migrations (
        version text primary key,
        statements text[],
        name text
      );

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

      insert into public.payments (
        id, user_id, provider, item_type, item_name, amount_twd,
        currency, status, merchant_order_no, updated_at
      )
      select
        (
          '20000000-0000-4000-8000-' ||
          lpad(series::text, 12, '0')
        )::uuid,
        null,
        'manual',
        'product_order',
        'Synthetic payment ' || series::text,
        100 + series,
        'TWD',
        'pending',
        'SYNTHETIC-PAYMENT-' || series::text,
        '2026-07-01 00:00:00+00'
      from pg_catalog.generate_series(100, 113) as series;

      update public.payments
      set updated_at = '2026-07-01 00:00:00+00';

      insert into public.product_orders (
        id, order_no, user_id, total_amount_twd, payment_method,
        payment_status, order_status, shipping_status, payment_id,
        note, created_at, updated_at
      ) values (
        '30000000-0000-4000-8000-000000000005',
        'SYNTHETIC-ORDER-5',
        null,
        900,
        'newebpay',
        'pending',
        'pending_payment',
        'not_shipped',
        null,
        null,
        '2026-07-05 00:00:00+00',
        '2026-07-05 00:00:00+00'
      );
    `,
    'diagnostic baseline fixtures',
  )
  psql(readFileSync(fencePath, 'utf8'), 'bank transfer fence')
}

function readFingerprints() {
  return JSON.parse(
    psql(
      `
        with
        bank_transfer as (
          select
            count(*)::integer as rows,
            count(*) filter (where status = 'pending_review')::integer
              as pending_review,
            encode(
              sha256(convert_to(
                coalesce(string_agg(id::text, E'\\n' order by id), ''),
                'UTF8'
              )),
              'hex'
            ) as pk_digest,
            encode(
              sha256(convert_to(
                coalesce(
                  string_agg(to_jsonb(row_value)::text, E'\\n' order by id),
                  ''
                ),
                'UTF8'
              )),
              'hex'
            ) as content_digest
          from public.bank_transfer_submissions as row_value
        ),
        payments as (
          select
            count(*)::integer as rows,
            encode(
              sha256(convert_to(
                coalesce(string_agg(id::text, E'\\n' order by id), ''),
                'UTF8'
              )),
              'hex'
            ) as pk_digest,
            encode(
              sha256(convert_to(
                coalesce(
                  string_agg(
                    (to_jsonb(row_value) - 'updated_at')::text,
                    E'\\n' order by id
                  ),
                  ''
                ),
                'UTF8'
              )),
              'hex'
            ) as content_digest
          from public.payments as row_value
        ),
        product_orders as (
          select
            count(*)::integer as rows,
            encode(
              sha256(convert_to(
                coalesce(string_agg(id::text, E'\\n' order by id), ''),
                'UTF8'
              )),
              'hex'
            ) as pk_digest,
            encode(
              sha256(convert_to(
                coalesce(
                  string_agg(to_jsonb(row_value)::text, E'\\n' order by id),
                  ''
                ),
                'UTF8'
              )),
              'hex'
            ) as content_digest
          from public.product_orders as row_value
        )
        select jsonb_build_object(
          'bank_transfer',
          (select to_jsonb(row_value) from bank_transfer as row_value),
          'payments',
          (select to_jsonb(row_value) from payments as row_value),
          'product_orders',
          (select to_jsonb(row_value) from product_orders as row_value)
        );
      `,
      'fixture fingerprints',
    ),
  )
}

function buildFixtureDiagnostic(baseline) {
  const productionFingerprints = {
    bank_transfer: {
      pk_digest:
        'e6a67042ff04db27bea56f76d9d983e6762ba4122e67fe54c30d740e458f5fec',
      content_digest:
        'e87a8425def35ac99bb054b4b2e0fee3efe985d5b3376ab6011d30e730c3bc40',
    },
    payments: {
      pk_digest:
        'bc3bd47469b3d4c199be57d54c18195f9869d9b1c94527fee445d8cf83f2fa79',
      content_digest:
        'da6b440446bde8d5816f06a610baba34140a21dbd9d58e9c8ffbc0867395d1ab',
    },
    product_orders: {
      pk_digest:
        '5b2aa41738c901750a2bb752ce23f7e18743631e941476e84a86336e874b55cd',
      content_digest:
        'eb133b3808572d8ae76829ba87edc33ae04725609cd1d82e3e1a2db0d502f853',
    },
  }
  let source = readFileSync(diagnosticPath, 'utf8')
  let replacements = 0
  for (const dataset of Object.keys(productionFingerprints)) {
    for (const key of ['pk_digest', 'content_digest']) {
      const expected = productionFingerprints[dataset][key]
      assert.equal(source.split(expected).length, 2)
      source = source.replace(expected, baseline[dataset][key])
      replacements += 1
    }
  }
  assert.equal(replacements, 6)
  return source
}

function runDiagnostic(source) {
  const before = readFingerprints()
  const raw = psql(source, 'read-only diagnostic', {
    quiet: true,
    readOnly: true,
  })
  const after = readFingerprints()
  assert.deepEqual(after, before)
  assert.equal(raw.split(/\r?\n/u).filter(Boolean).length, 1)
  assert.doesNotMatch(
    raw,
    /(?:[0-9a-f]{8}-){1,4}[0-9a-f-]+|\b[0-9a-f]{64}\b|@/iu,
  )
  return parseAndValidateDiagnosticOutput(`${raw}\n`)
}

function assertOnlyDatasetChanged(baseline, drift, datasetName) {
  assert.equal(drift.status, 'DIAGNOSTIC_COMPLETED')
  for (const key of [
    'database_identity_match',
    'line_pay_unapplied',
    'migration_history_absent',
    'fence_match',
  ]) {
    assert.equal(drift[key], baseline[key])
  }
  for (let index = 0; index < baseline.datasets.length; index += 1) {
    if (baseline.datasets[index].dataset === datasetName) continue
    assert.deepEqual(drift.datasets[index], baseline.datasets[index])
  }
}

function dataset(result, name) {
  return result.datasets.find((item) => item.dataset === name)
}

function runScenarios(source, baselineResult) {
  const results = []

  psql(
    `
      insert into public.bank_transfer_submissions (
        id, user_id, item_type, item_name, amount_twd,
        payer_name, payer_phone, bank_account_last5, status
      ) values (
        '21000000-0000-4000-8000-000000000099',
        null, 'synthetic', 'Synthetic extra', 999,
        'Synthetic User', '0000000000', '00999', 'pending_review'
      );
    `,
    'add bank transfer drift',
  )
  let result = runDiagnostic(source)
  assertOnlyDatasetChanged(baselineResult, result, 'bank_transfer')
  assert.deepEqual(
    {
      rows: dataset(result, 'bank_transfer').actual_rows,
      rowsMatch: dataset(result, 'bank_transfer').rows_match,
      pending: dataset(result, 'bank_transfer').actual_pending_review,
      pendingMatch: dataset(result, 'bank_transfer').pending_review_match,
    },
    { rows: 4, rowsMatch: false, pending: 4, pendingMatch: false },
  )
  results.push('bank_transfer_plus_one')
  psql(
    "delete from public.bank_transfer_submissions where id = '21000000-0000-4000-8000-000000000099';",
    'restore bank transfer count',
  )

  psql(
    `
      insert into public.payments (
        id, provider, item_type, item_name, amount_twd,
        currency, status, merchant_order_no, updated_at
      ) values (
        '20000000-0000-4000-8000-000000000099',
        'manual', 'product_order', 'Synthetic extra payment', 999,
        'TWD', 'pending', 'SYNTHETIC-PAYMENT-99',
        '2026-07-01 00:00:00+00'
      );
    `,
    'add payment drift',
  )
  result = runDiagnostic(source)
  assertOnlyDatasetChanged(baselineResult, result, 'payments')
  assert.equal(dataset(result, 'payments').actual_rows, 19)
  assert.equal(dataset(result, 'payments').rows_match, false)
  results.push('payment_plus_one')
  psql(
    "delete from public.payments where id = '20000000-0000-4000-8000-000000000099';",
    'restore payment count',
  )

  psql(
    `
      insert into public.product_orders (
        id, order_no, total_amount_twd, payment_method,
        payment_status, order_status, shipping_status
      ) values (
        '30000000-0000-4000-8000-000000000099',
        'SYNTHETIC-ORDER-99', 999, 'newebpay',
        'pending', 'pending_payment', 'not_shipped'
      );
    `,
    'add product order drift',
  )
  result = runDiagnostic(source)
  assertOnlyDatasetChanged(baselineResult, result, 'product_orders')
  assert.equal(dataset(result, 'product_orders').actual_rows, 6)
  assert.equal(dataset(result, 'product_orders').rows_match, false)
  results.push('product_order_plus_one')
  psql(
    "delete from public.product_orders where id = '30000000-0000-4000-8000-000000000099';",
    'restore product order count',
  )

  psql(
    `
      update public.payments
      set updated_at = '2030-01-01 00:00:00+00'
      where id = '20000000-0000-4000-8000-000000000001';
    `,
    'mutate payment updated at',
  )
  result = runDiagnostic(source)
  assert.deepEqual(result, baselineResult)
  results.push('payment_updated_at_only')
  psql(
    `
      update public.payments
      set updated_at = '2026-07-01 00:00:00+00'
      where id = '20000000-0000-4000-8000-000000000001';
    `,
    'restore payment updated at',
  )

  psql(
    `
      update public.payments
      set item_name = 'Synthetic changed payment'
      where id = '20000000-0000-4000-8000-000000000001';
    `,
    'mutate payment content',
  )
  result = runDiagnostic(source)
  assertOnlyDatasetChanged(baselineResult, result, 'payments')
  assert.equal(dataset(result, 'payments').rows_match, true)
  assert.equal(dataset(result, 'payments').pk_digest_match, true)
  assert.equal(dataset(result, 'payments').content_digest_match, false)
  results.push('payment_content')
  psql(
    `
      update public.payments
      set item_name = 'legacy bank transfer'
      where id = '20000000-0000-4000-8000-000000000001';
    `,
    'restore payment content',
  )

  psql(
    `
      update public.product_orders
      set note = 'Synthetic changed order'
      where id = '30000000-0000-4000-8000-000000000005';
    `,
    'mutate product order content',
  )
  result = runDiagnostic(source)
  assertOnlyDatasetChanged(baselineResult, result, 'product_orders')
  assert.equal(dataset(result, 'product_orders').rows_match, true)
  assert.equal(dataset(result, 'product_orders').pk_digest_match, true)
  assert.equal(
    dataset(result, 'product_orders').content_digest_match,
    false,
  )
  results.push('product_order_content')
  psql(
    `
      update public.product_orders
      set note = null
      where id = '30000000-0000-4000-8000-000000000005';
    `,
    'restore product order content',
  )

  psql(
    `
      update public.bank_transfer_submissions
      set note = 'Synthetic changed transfer'
      where id = '21000000-0000-4000-8000-000000000001';
    `,
    'mutate bank transfer content',
  )
  result = runDiagnostic(source)
  assertOnlyDatasetChanged(baselineResult, result, 'bank_transfer')
  assert.equal(dataset(result, 'bank_transfer').rows_match, true)
  assert.equal(dataset(result, 'bank_transfer').pk_digest_match, true)
  assert.equal(
    dataset(result, 'bank_transfer').content_digest_match,
    false,
  )
  results.push('bank_transfer_content')
  psql(
    `
      update public.bank_transfer_submissions
      set note = 'synthetic'
      where id = '21000000-0000-4000-8000-000000000001';
    `,
    'restore bank transfer content',
  )

  psql(
    `
      update public.bank_transfer_submissions
      set status = 'confirmed'
      where id = '21000000-0000-4000-8000-000000000001';
    `,
    'mutate pending review count',
  )
  result = runDiagnostic(source)
  assertOnlyDatasetChanged(baselineResult, result, 'bank_transfer')
  assert.equal(dataset(result, 'bank_transfer').actual_rows, 3)
  assert.equal(dataset(result, 'bank_transfer').rows_match, true)
  assert.equal(dataset(result, 'bank_transfer').pk_digest_match, true)
  assert.equal(dataset(result, 'bank_transfer').actual_pending_review, 2)
  assert.equal(dataset(result, 'bank_transfer').pending_review_match, false)
  assert.equal(
    dataset(result, 'bank_transfer').content_digest_match,
    false,
  )
  results.push('pending_review_count')
  psql(
    `
      update public.bank_transfer_submissions
      set status = 'pending_review'
      where id = '21000000-0000-4000-8000-000000000001';
    `,
    'restore pending review count',
  )

  return results
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

function assertNoTaskResources() {
  for (const [resource, args] of [
    ['container', ['ps', '-aq', '--filter', `label=task=${taskLabel}`]],
    ['volume', ['volume', 'ls', '-q', '--filter', `label=task=${taskLabel}`]],
    ['network', ['network', 'ls', '-q', '--filter', `label=task=${taskLabel}`]],
  ]) {
    const result = spawnSync('docker', args, {
      cwd: root,
      encoding: 'utf8',
    })
    if (result.status !== 0 || result.stdout.trim()) {
      throw new Error(`DIAGNOSTIC_${resource.toUpperCase()}_CLEANUP_FAILED`)
    }
  }
}

async function main() {
  const localImage = spawnSync('docker', ['image', 'inspect', image], {
    cwd: root,
    encoding: 'utf8',
  })
  if (localImage.status !== 0) runDocker(['pull', image])
  const digests = JSON.parse(
    runDocker([
      'image',
      'inspect',
      '--format',
      '{{json .RepoDigests}}',
      image,
    ]),
  )
  if (!Array.isArray(digests) || !digests.includes(image)) {
    throw new Error('POSTGRES_IMAGE_REPOSITORY_DIGEST_MISMATCH')
  }
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
  let consecutiveReadyChecks = 0
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const ready = spawnSync(
      'docker',
      [
        'exec',
        containerName,
        'psql',
        '-X',
        '--set=ON_ERROR_STOP=1',
        '--no-align',
        '--tuples-only',
        '-U',
        'postgres',
        '-d',
        'postgres',
        '--command=select 1;',
      ],
      { cwd: root, encoding: 'utf8' },
    )
    consecutiveReadyChecks =
      ready.status === 0 && ready.stdout.trim() === '1'
        ? consecutiveReadyChecks + 1
        : 0
    if (consecutiveReadyChecks >= 2) break
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250))
    if (attempt === 59) throw new Error('POSTGRES_READINESS_TIMEOUT')
  }
  const version = runDocker([
    'exec',
    containerName,
    'postgres',
    '--version',
  ])
  assert.match(version, /^postgres \(PostgreSQL\) 17(?:[.]|$)/u)

  prepareBaseline()
  const baselineFingerprints = readFingerprints()
  assert.deepEqual(
    {
      bankTransfer: baselineFingerprints.bank_transfer.rows,
      payments: baselineFingerprints.payments.rows,
      productOrders: baselineFingerprints.product_orders.rows,
      pendingReview: baselineFingerprints.bank_transfer.pending_review,
    },
    {
      bankTransfer: 3,
      payments: 18,
      productOrders: 5,
      pendingReview: 3,
    },
  )
  const source = buildFixtureDiagnostic(baselineFingerprints)
  const baselineResult = runDiagnostic(source)
  assert.equal(baselineResult.database_identity_match, true)
  assert.equal(baselineResult.line_pay_unapplied, true)
  assert.equal(baselineResult.migration_history_absent, true)
  assert.equal(baselineResult.fence_match, true)
  for (const item of baselineResult.datasets) {
    assert.equal(item.rows_match, true)
    assert.equal(item.pk_digest_match, true)
    assert.equal(item.content_digest_match, true)
  }
  assert.equal(
    baselineResult.datasets[0].pending_review_match,
    true,
  )

  const scenarios = runScenarios(source, baselineResult)
  assert.equal(scenarios.length, 8)
  assert.deepEqual(readFingerprints(), baselineFingerprints)
  return scenarios.length
}

let scenarioCount
try {
  scenarioCount = await main()
} finally {
  cleanup()
}
assertNoTaskResources()
console.log(
  'LINE_PAY_PRODUCTION_DIAGNOSTIC_CONTRACTS_PASS ' +
    'postgres=17 baseline=3/18/5 pending_review=3 ' +
    `drift_scenarios=${scenarioCount} read_only=PASS cleanup=PASS`,
)
