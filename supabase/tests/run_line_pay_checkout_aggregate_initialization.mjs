import { spawn, spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LINE_PAY_POSTGRES_IMAGE } from './line_pay_postgres_image.mjs'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const root = resolve(scriptDirectory, '../..')
const taskLabel = 'line-pay-initialize-aggregate-v1'
const containerName = `${taskLabel}-${randomBytes(6).toString('hex')}`
const networkName = `${containerName}-network`
const volumeName = `${containerName}-data`
const localPostgresPassword = randomBytes(32).toString('base64url')
const image = LINE_PAY_POSTGRES_IMAGE
const baseMigration = join(
  root,
  'supabase/migrations/20260719033404_line_pay_remediation_contracts.sql',
)
const initializationMigration = join(
  root,
  'supabase/migrations/20260728053215_line_pay_checkout_aggregate_initialization.sql',
)
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

function psql(database, sql, label) {
  const result = spawnSync(
    'docker',
    [
      'exec',
      '-i',
      containerName,
      'psql',
      '-X',
      '-v',
      'ON_ERROR_STOP=1',
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

  if (result.status !== 0) {
    throw new Error(`${label} failed\n${result.stderr || result.stdout}`)
  }

  return result.stdout.trim()
}

function psqlFile(database, path) {
  const absolutePath = path.startsWith('/') ? path : join(root, path)
  return psql(database, readFileSync(absolutePath, 'utf8'), path)
}

function psqlExpectDenied(database, role, label) {
  const sql = `
    set role ${role};
    select *
    from public.initialize_product_order_line_pay_checkout(
      pg_catalog.jsonb_build_object()
    );
  `
  const result = spawnSync(
    'docker',
    [
      'exec',
      '-i',
      containerName,
      'psql',
      '-X',
      '-v',
      'ON_ERROR_STOP=1',
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
  const output = `${result.stdout}\n${result.stderr}`

  if (
    result.status === 0
    || !/permission denied for function initialize_product_order_line_pay_checkout/i.test(
      output,
    )
  ) {
    throw new Error(`${label} did not fail with the exact function denial`)
  }
}

function prepareDatabase(database) {
  psqlFile(database, 'supabase/tests/line_pay_local_postgres_bootstrap.sql')
  for (const file of baselineFiles) psqlFile(database, file)
  psqlFile(database, baseMigration)
  psqlFile(database, initializationMigration)
}

function runPsqlAsync(database, sql) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(
      'docker',
      [
        'exec',
        '-i',
        containerName,
        'psql',
        '-X',
        '-A',
        '-t',
        '-F',
        '|',
        '-v',
        'ON_ERROR_STOP=1',
        '-U',
        'postgres',
        '-d',
        database,
      ],
      { cwd: root, encoding: 'utf8' },
    )
    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk) => {
      stdout += chunk
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk
    })
    child.on('error', rejectPromise)
    child.on('close', (code) => {
      if (code !== 0) {
        rejectPromise(
          new Error(`concurrent initializer exited ${code}\n${stderr || stdout}`),
        )
        return
      }
      resolvePromise(stdout.trim())
    })
    child.stdin.end(sql)
  })
}

async function testConcurrentInitialization(database) {
  psql(
    database,
    `
      insert into auth.users (id)
      values ('41000000-0000-4000-8000-000000000002')
      on conflict (id) do nothing;
    `,
    'concurrent auth fixture',
  )

  const capabilityExpiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()
  const payload = {
    user_id: '41000000-0000-4000-8000-000000000002',
    environment: 'sandbox',
    order_no: 'PO-SANDBOX-CONCURRENT-1',
    merchant_order_no: 'LP_SANDBOX_CONCURRENT_1',
    customer_name: null,
    customer_email: null,
    customer_phone: null,
    note: null,
    items: [
      {
        product_slug: 'sandbox-concurrent-item',
        product_name: 'Sandbox concurrent item',
        unit_price_twd: 100,
        quantity: 1,
        product_snapshot: {
          slug: 'sandbox-concurrent-item',
          name: 'Sandbox concurrent item',
          category: '符咒商品',
          priceTwd: 100,
        },
      },
    ],
    shipping_info: {
      recipient_name: null,
      recipient_phone: null,
      recipient_email: null,
      shipping_method: 'manual',
      postal_code: null,
      address: null,
      store_type: null,
      store_id: null,
      store_name: null,
      store_address: null,
      store_phone: null,
    },
    idempotency_key: 'sandbox-concurrent-idempotency-0001',
    request_body_sha256: '1'.repeat(64),
    confirm_token_hash: '2'.repeat(64),
    cancel_token_hash: '3'.repeat(64),
    capability_expires_at: capabilityExpiresAt,
  }
  const payloadLiteral = JSON.stringify(payload).replaceAll("'", "''")
  const statement = `
    set role service_role;
    select
      result_code,
      product_order_id,
      payment_id,
      attempt_id,
      outbox_id,
      confirm_capability_id,
      cancel_capability_id
    from public.initialize_product_order_line_pay_checkout(
      '${payloadLiteral}'::jsonb
    );
  `
  const outputs = await Promise.all([
    runPsqlAsync(database, statement),
    runPsqlAsync(database, statement),
  ])
  const rows = outputs.map((output) => {
    const resultLine = output.trim().split('\n').at(-1)
    return resultLine ? resultLine.split('|') : []
  })
  const resultCodes = rows.map((row) => row[0]).sort()

  if (
    resultCodes[0] !== 'already_initialized'
    || resultCodes[1] !== 'initialized'
  ) {
    throw new Error(
      `concurrent initializer result codes were not idempotent: ${JSON.stringify(resultCodes)}`,
    )
  }

  if (
    rows[0].length !== 7
    || rows[1].length !== 7
    || rows[0].slice(1).some((value, index) => value !== rows[1][index + 1])
  ) {
    throw new Error('concurrent initializer returned different aggregate ids')
  }

  psql(
    database,
    `
      do $$
      begin
        if (
          select pg_catalog.count(*)
          from public.product_orders
          where order_no = 'PO-SANDBOX-CONCURRENT-1'
        ) <> 1
        or (
          select pg_catalog.count(*)
          from public.payments
          where merchant_order_no = 'LP_SANDBOX_CONCURRENT_1'
        ) <> 1
        or (
          select pg_catalog.count(*)
          from public.line_pay_checkout_attempts
          where idempotency_key = 'sandbox-concurrent-idempotency-0001'
        ) <> 1
        or (
          select pg_catalog.count(*)
          from public.line_pay_request_outbox
          where idempotency_key = 'sandbox-concurrent-idempotency-0001'
        ) <> 1
        or (
          select pg_catalog.count(*)
          from public.line_pay_payment_audit_events
          where checkout_attempt_id = (
            select id
            from public.line_pay_checkout_attempts
            where idempotency_key = 'sandbox-concurrent-idempotency-0001'
          )
            and event_type = 'checkout_initialized'
        ) <> 1 then
          raise exception 'concurrent_initializer_created_duplicate_aggregate';
        end if;
      end
      $$;
    `,
    'concurrent aggregate count assertions',
  )
}

async function main() {
  runDocker(['pull', image])

  const repositoryDigests = JSON.parse(
    runDocker(['image', 'inspect', '--format', '{{json .RepoDigests}}', image]),
  )
  if (
    !Array.isArray(repositoryDigests)
    || !repositoryDigests.includes(LINE_PAY_POSTGRES_IMAGE)
  ) {
    throw new Error('POSTGRES_IMAGE_REPOSITORY_DIGEST_MISMATCH')
  }

  const postgresVersion = runDocker([
    'run',
    '--rm',
    '--network',
    'none',
    image,
    'postgres',
    '--version',
  ])
  if (!/^postgres \(PostgreSQL\) 17(?:\.|$)/.test(postgresVersion)) {
    throw new Error(`POSTGRES_IMAGE_MAJOR_VERSION_MISMATCH: ${postgresVersion}`)
  }

  runDocker(['volume', 'create', '--label', `task=${taskLabel}`, volumeName])
  runDocker([
    'network',
    'create',
    '--driver',
    'bridge',
    '--internal',
    '--label',
    `task=${taskLabel}`,
    networkName,
  ])
  runDocker([
    'run',
    '--detach',
    '--rm',
    '--name',
    containerName,
    '--label',
    `task=${taskLabel}`,
    '--network',
    networkName,
    '--mount',
    `type=volume,src=${volumeName},dst=/var/lib/postgresql/data`,
    '--env',
    `POSTGRES_PASSWORD=${localPostgresPassword}`,
    image,
  ])

  let readyChecks = 0
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const result = spawnSync(
      'docker',
      [
        'exec',
        containerName,
        'psql',
        '-X',
        '-A',
        '-t',
        '-U',
        'postgres',
        '-d',
        'postgres',
        '-c',
        'select 1',
      ],
      { encoding: 'utf8' },
    )
    readyChecks =
      result.status === 0 && result.stdout.trim() === '1'
        ? readyChecks + 1
        : 0
    if (readyChecks >= 2) break
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250)
  }

  if (readyChecks < 2) {
    throw new Error(
      'LOCAL_DB_RUNTIME_UNAVAILABLE: PostgreSQL did not become stably ready',
    )
  }

  psql(
    'postgres',
    'create database line_pay_initialization_contract;',
    'create contract database',
  )
  psql(
    'postgres',
    'create database line_pay_initialization_concurrent;',
    'create concurrency database',
  )

  prepareDatabase('line_pay_initialization_contract')
  psqlFile(
    'line_pay_initialization_contract',
    'supabase/tests/line_pay_checkout_aggregate_initialization.sql',
  )
  for (const role of ['public_probe', 'anon', 'authenticated']) {
    psqlExpectDenied(
      'line_pay_initialization_contract',
      role,
      `${role} initializer RPC guard`,
    )
  }

  prepareDatabase('line_pay_initialization_concurrent')
  await testConcurrentInitialization('line_pay_initialization_concurrent')

  process.stdout.write(
    'line_pay_checkout_aggregate_initialization: PASS (PostgreSQL 17, atomic aggregate, replay, concurrency, rollback, ACL)\n',
  )
}

try {
  await main()
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  )
  process.exitCode = 1
} finally {
  spawnSync('docker', ['rm', '--force', containerName], { encoding: 'utf8' })
  spawnSync('docker', ['volume', 'rm', volumeName], { encoding: 'utf8' })
  spawnSync('docker', ['network', 'rm', networkName], { encoding: 'utf8' })
}
