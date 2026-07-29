import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const root = resolve(scriptDirectory, '../..')
const containerName = `ai-chart-trusted-delivery-${randomBytes(6).toString('hex')}`
const networkName = `${containerName}-network`
const volumeName = `${containerName}-data`
const localPostgresPassword = randomBytes(32).toString('base64url')
const image = 'postgres:17'

const files = Object.freeze([
  'supabase/tests/ai_chart_report_trusted_delivery_local_postgres_bootstrap.sql',
  'supabase/migrations/20260728120000_ai_chart_report_trusted_delivery_contracts.sql',
  'supabase/tests/ai_chart_report_trusted_delivery_contracts.sql',
])

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
      `LOCAL_DB_COMMAND_FAILED:${args[0]}:${result.status}\n${result.stderr || result.stdout}`,
    )
  }

  return result.stdout.trim()
}

function runPsqlFile(relativePath) {
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
      'postgres',
    ],
    {
      cwd: root,
      encoding: 'utf8',
      input: readFileSync(join(root, relativePath), 'utf8'),
    },
  )

  if (result.status !== 0) {
    throw new Error(
      `LOCAL_DB_CONTRACT_FAILED:${relativePath}\n${result.stderr || result.stdout}`,
    )
  }
}

function runPsqlExpectPermissionDenied(sql, label) {
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
      'postgres',
    ],
    {
      cwd: root,
      encoding: 'utf8',
      input: sql,
    },
  )

  const output = `${result.stdout}\n${result.stderr}`
  if (result.status === 0 || !/permission denied/iu.test(output)) {
    throw new Error(`LOCAL_DB_PERMISSION_CONTRACT_FAILED:${label}`)
  }
}

function waitForPostgres() {
  let consecutiveReadyChecks = 0

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
      { cwd: root, encoding: 'utf8' },
    )

    consecutiveReadyChecks =
      result.status === 0 && result.stdout.trim() === '1'
        ? consecutiveReadyChecks + 1
        : 0

    if (consecutiveReadyChecks >= 2) return
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250)
  }

  throw new Error('LOCAL_DB_RUNTIME_UNAVAILABLE')
}

function main() {
  runDocker(['image', 'inspect', image])

  const postgresVersion = runDocker([
    'run',
    '--rm',
    '--network',
    'none',
    image,
    'postgres',
    '--version',
  ])

  if (!/^postgres \(PostgreSQL\) 17(?:[.]|$)/u.test(postgresVersion)) {
    throw new Error('POSTGRES_IMAGE_MAJOR_VERSION_MISMATCH')
  }

  runDocker([
    'volume',
    'create',
    '--label',
    'task=ai-chart-trusted-delivery-contracts',
    volumeName,
  ])
  runDocker([
    'network',
    'create',
    '--driver',
    'bridge',
    '--internal',
    '--label',
    'task=ai-chart-trusted-delivery-contracts',
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

  waitForPostgres()

  for (const file of files) runPsqlFile(file)

  runPsqlExpectPermissionDenied(
    `
      set role anon;
      select *
      from public.deliver_ai_chart_report_after_review(
        null::uuid,
        null::uuid,
        null::text,
        null::text,
        null::text,
        null::text,
        null::text,
        null::text,
        null::text,
        null::text,
        null::text,
        null::text,
        null::text,
        null::text,
        null::text,
        null::text,
        null::text
      );
    `,
    'anon RPC execute',
  )
  runPsqlExpectPermissionDenied(
    `
      set role authenticated;
      select *
      from public.ai_chart_report_review_ledger;
    `,
    'authenticated ledger read',
  )
  runPsqlExpectPermissionDenied(
    `
      set role service_role;
      select *
      from public.ai_chart_report_deliveries;
    `,
    'service role receipt direct read',
  )

  process.stdout.write(
    'ai_chart_report_trusted_delivery_db_contracts: PASS (publish, replay, conflicts, rollback, immutability, RLS)\n',
  )
}

try {
  main()
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
} finally {
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
