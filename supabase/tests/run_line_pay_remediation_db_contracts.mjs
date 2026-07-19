import { spawn, spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const root = resolve(scriptDirectory, '../..')
const containerName = `line-pay-remediation-db-${randomBytes(6).toString('hex')}`
const networkName = `${containerName}-network`
const volumeName = `${containerName}-data`
const localPostgresPassword = randomBytes(32).toString('base64url')
const image = 'postgres:17-alpine'
const fakeMarkers = [
  'fake_test_token_do_not_use',
  'fake_test_signature_do_not_use',
  'fake_test_authorization_do_not_use',
]
const migration = process.env.LINE_PAY_MIGRATION_UNDER_TEST
  ? resolve(process.env.LINE_PAY_MIGRATION_UNDER_TEST)
  : join(root, 'supabase/migrations/20260719033404_line_pay_remediation_contracts.sql')
const baselineFiles = [
  'supabase/schema.sql',
  'supabase/bank_transfer_submissions_patch.sql',
  'supabase/newebpay_payments_patch.sql',
  'supabase/payments_service_role_grants.sql',
  'supabase/product_orders_schema_draft.sql',
  'supabase/migrations/20260707_line_pay_provider_schema_draft.sql',
]

function runDocker(args, options = {}) {
  const result = spawnSync('docker', args, {
    cwd: root,
    encoding: 'utf8',
    ...options,
  })

  if (result.error?.code === 'ENOENT') {
    throw new Error('LOCAL_DB_RUNTIME_UNAVAILABLE: docker command not found')
  }

  if (result.status !== 0) {
    throw new Error(
      `LOCAL_DB_COMMAND_FAILED: docker ${args[0]} exited ${result.status}\n${result.stderr || result.stdout}`,
    )
  }

  return result.stdout.trim()
}

function containsFakeMarker(output) {
  return fakeMarkers.some((marker) => output.includes(marker))
}

function assertNoFakeMarker(output, label) {
  if (containsFakeMarker(output)) {
    throw new Error(`${label} leaked a fake secret marker`)
  }
}

function psql(database, sql, label) {
  const result = spawnSync(
    'docker',
    ['exec', '-i', containerName, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', database],
    {
      cwd: root,
      encoding: 'utf8',
      input: sql,
    },
  )

  const combinedOutput = `${result.stdout}\n${result.stderr}`
  assertNoFakeMarker(combinedOutput, label)

  if (result.status !== 0) {
    throw new Error(`${label} failed\n${result.stderr || result.stdout}`)
  }
}

function psqlFile(database, relativePath) {
  const absolutePath = relativePath.startsWith('/') ? relativePath : join(root, relativePath)
  psql(database, readFileSync(absolutePath, 'utf8'), relativePath)
}

function psqlExpectDenied(database, sql, label) {
  const result = spawnSync(
    'docker',
    ['exec', '-i', containerName, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', database],
    {
      cwd: root,
      encoding: 'utf8',
      input: sql,
    },
  )
  const combinedOutput = `${result.stdout}\n${result.stderr}`
  assertNoFakeMarker(combinedOutput, label)

  if (result.status === 0 || !/permission denied/i.test(combinedOutput)) {
    throw new Error(`${label} did not fail with the required permission denial`)
  }
}

function prepareBaseline(database) {
  psqlFile(database, 'supabase/tests/line_pay_local_postgres_bootstrap.sql')
  for (const file of baselineFiles) psqlFile(database, file)
}

function runPsqlAsync(database, sql) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(
      'docker',
      ['exec', '-i', containerName, 'psql', '-X', '-A', '-t', '-F', '|', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', database],
      { cwd: root, encoding: 'utf8' },
    )
    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk) => { stdout += chunk })
    child.stderr.on('data', (chunk) => { stderr += chunk })
    child.on('error', rejectPromise)
    child.on('close', (code) => {
      const combinedOutput = `${stdout}\n${stderr}`
      if (containsFakeMarker(combinedOutput)) {
        rejectPromise(new Error('concurrent psql leaked a fake secret marker'))
        return
      }
      if (code !== 0) {
        rejectPromise(new Error(`concurrent psql exited ${code}\n${stderr || stdout}`))
        return
      }
      resolvePromise(stdout.trim())
    })
    child.stdin.end(sql)
  })
}

async function testConcurrentClaim(database) {
  psqlFile(database, 'supabase/tests/line_pay_concurrency_fixture.sql')
  const statement = `
    select result_code
    from public.claim_product_order_line_pay_request(
      '60000000-0000-4000-8000-000000000003',
      'sandbox',
      'concurrency-request-idempotency-1',
      repeat('4', 64),
      'a0000000-0000-4000-8000-000000000006',
      pg_catalog.clock_timestamp() + interval '2 minutes'
    );
  `
  const outputs = await Promise.all([
    runPsqlAsync(database, statement),
    runPsqlAsync(database, statement),
  ])
  const sorted = outputs.sort()

  if (sorted[0] !== 'already_claimed' || sorted[1] !== 'claimed') {
    throw new Error(`concurrent claim results were not idempotent: ${JSON.stringify(sorted)}`)
  }

  psql(
    database,
    `
      do $$
      begin
        if not exists (
          select 1
          from public.line_pay_checkout_attempts
          where id = '60000000-0000-4000-8000-000000000003'
            and request_state = 'requesting'
            and attempt_count = 1
        ) then
          raise exception 'concurrent_claim_attempt_count_contract_failed';
        end if;

        if (
          select count(*)
          from public.line_pay_payment_audit_events
          where checkout_attempt_id = '60000000-0000-4000-8000-000000000003'
            and event_type = 'request_claimed'
        ) <> 1 then
          raise exception 'concurrent_claim_audit_count_contract_failed';
        end if;
      end
      $$;
    `,
    'concurrent claim assertions',
  )
}

function testRoleAccess(database) {
  psqlExpectDenied(
    database,
    `
      set role public_probe;
      select * from public.read_product_order_line_pay_request_result(
        '60000000-0000-4000-8000-000000000001',
        'sandbox',
        'contract-request-idempotency-1',
        repeat('a', 64)
      );
    `,
    'PUBLIC-only role core RPC guard',
  )
  psqlExpectDenied(
    database,
    'set role anon; select * from public.line_pay_callback_capabilities limit 1;',
    'anon callback capability read guard',
  )
  psqlExpectDenied(
    database,
    `
      set role anon;
      select * from public.read_product_order_line_pay_request_result(
        '60000000-0000-4000-8000-000000000001',
        'sandbox',
        'contract-request-idempotency-1',
        repeat('a', 64)
      );
    `,
    'anon core RPC guard',
  )
  psqlExpectDenied(
    database,
    `
      set role authenticated;
      update public.payments set status = 'paid'
      where id = '70000000-0000-4000-8000-000000000002';
    `,
    'authenticated payment mutation guard',
  )
  psqlExpectDenied(
    database,
    'set role authenticated; select * from public.line_pay_callback_capabilities limit 1;',
    'authenticated callback capability read guard',
  )
  psqlExpectDenied(
    database,
    'set role authenticated; select * from public.line_pay_request_outbox limit 1;',
    'authenticated outbox read guard',
  )
  psqlExpectDenied(
    database,
    `
      set role authenticated;
      select * from public.claim_product_order_line_pay_request(
        '60000000-0000-4000-8000-000000000003',
        'sandbox',
        'concurrency-request-idempotency-1',
        repeat('4', 64),
        'a0000000-0000-4000-8000-000000000030',
        pg_catalog.clock_timestamp() + interval '2 minutes'
      );
    `,
    'authenticated outbox claim guard',
  )

  psql(
    database,
    `
      create schema line_pay_malicious;
      create table line_pay_malicious.line_pay_checkout_attempts (
        id uuid primary key,
        upstream_transaction_id text
      );
      insert into line_pay_malicious.line_pay_checkout_attempts values (
        '60000000-0000-4000-8000-000000000001',
        'malicious-shadow-value'
      );
      grant usage on schema line_pay_malicious to service_role;
      grant select on table line_pay_malicious.line_pay_checkout_attempts to service_role;
      set role service_role;
      set search_path = line_pay_malicious, public;
      do $$
      declare
        v_transaction_id text;
      begin
        select upstream_transaction_id into v_transaction_id
        from public.read_product_order_line_pay_request_result(
          '60000000-0000-4000-8000-000000000001',
          'sandbox',
          'contract-request-idempotency-1',
          repeat('a', 64)
        );
        if v_transaction_id <> '92233720368547758081234567890' then
          raise exception 'search_path_shadowing_was_not_blocked';
        end if;
      end
      $$;
      reset role;
    `,
    'service role and search_path injection assertions',
  )
}

async function main() {
  runDocker(['volume', 'create', '--label', 'task=line-pay-remediation-pr1', volumeName])
  runDocker([
    'network',
    'create',
    '--driver',
    'bridge',
    '--internal',
    '--label',
    'task=line-pay-remediation-pr1',
    networkName,
  ])
  runDocker([
    'run',
    '--detach',
    '--rm',
    '--name',
    containerName,
    '--network',
    networkName,
    '--mount',
    `type=volume,src=${volumeName},dst=/var/lib/postgresql/data`,
    '--env',
    `POSTGRES_PASSWORD=${localPostgresPassword}`,
    image,
  ])

  let consecutiveReadyChecks = 0
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const result = spawnSync(
      'docker',
      ['exec', containerName, 'psql', '-X', '-A', '-t', '-U', 'postgres', '-d', 'postgres', '-c', 'select 1'],
      { encoding: 'utf8' },
    )
    consecutiveReadyChecks = result.status === 0 && result.stdout.trim() === '1'
      ? consecutiveReadyChecks + 1
      : 0
    if (consecutiveReadyChecks >= 2) break
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250)
  }

  if (consecutiveReadyChecks < 2) {
    throw new Error('LOCAL_DB_RUNTIME_UNAVAILABLE: PostgreSQL did not become stably ready')
  }

  psql('postgres', 'create database line_pay_clean;', 'create clean database')
  psql('postgres', 'create database line_pay_upgrade;', 'create upgrade database')

  prepareBaseline('line_pay_clean')
  psqlFile('line_pay_clean', migration)
  psqlFile('line_pay_clean', 'supabase/tests/line_pay_remediation_contracts.sql')
  psqlFile('line_pay_clean', 'supabase/tests/line_pay_paid_security_invariants.sql')
  psqlFile('line_pay_clean', 'supabase/tests/line_pay_request_outcomes.sql')
  await testConcurrentClaim('line_pay_clean')
  testRoleAccess('line_pay_clean')

  prepareBaseline('line_pay_upgrade')
  psqlFile('line_pay_upgrade', 'supabase/tests/line_pay_upgrade_fixture.sql')
  psqlFile('line_pay_upgrade', migration)
  psqlFile('line_pay_upgrade', 'supabase/tests/line_pay_upgrade_assertions.sql')

  const postgresLogs = runDocker(['logs', containerName])
  assertNoFakeMarker(postgresLogs, 'PostgreSQL logs')

  process.stdout.write('line_pay_remediation_db_contracts: PASS (clean, upgrade, RPC, concurrency, rollback, RLS)\n')
}

try {
  await main()
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
} finally {
  spawnSync('docker', ['rm', '--force', containerName], { encoding: 'utf8' })
  spawnSync('docker', ['volume', 'rm', volumeName], { encoding: 'utf8' })
  spawnSync('docker', ['network', 'rm', networkName], { encoding: 'utf8' })
}
