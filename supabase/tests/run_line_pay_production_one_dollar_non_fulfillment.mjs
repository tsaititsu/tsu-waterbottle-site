import { spawn, spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { inspectDeployOutput } from '../../scripts/supabase/run-line-pay-production-exact-file.mjs'
import {
  parseDeployOutput,
  parseVerificationOutput,
} from '../../scripts/supabase/validate-line-pay-production-one-dollar-non-fulfillment.mjs'
import { LINE_PAY_POSTGRES_IMAGE } from './line_pay_postgres_image.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const taskLabel = 'line-pay-nt1-non-fulfillment'
const containerName = `${taskLabel}-${randomBytes(6).toString('hex')}`
const password = randomBytes(32).toString('base64url')
const baselineFiles = [
  'supabase/schema.sql',
  'supabase/bank_transfer_submissions_patch.sql',
  'supabase/newebpay_payments_patch.sql',
  'supabase/payments_service_role_grants.sql',
  'supabase/product_orders_schema_draft.sql',
  'supabase/migrations/20260707_line_pay_provider_schema_draft.sql',
  'supabase/migrations/20260719033404_line_pay_remediation_contracts.sql',
  'supabase/migrations/20260728053215_line_pay_checkout_aggregate_initialization.sql',
]

function runDocker(args) {
  const result = spawnSync('docker', args, {
    cwd: root,
    encoding: 'utf8',
  })
  if (result.error?.code === 'ENOENT') {
    throw new Error('LOCAL_DB_RUNTIME_UNAVAILABLE')
  }
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout)
  }
  return result.stdout.trim()
}

function psqlArgs() {
  return [
    'exec',
    '--env',
    `PGPASSWORD=${password}`,
    '--workdir',
    '/workspace/supabase/deployment',
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

function psqlFile(path, expectFailure = false) {
  const result = spawnSync(
    'docker',
    [...psqlArgs(), `--file=/workspace/${path}`],
    { cwd: root, encoding: 'utf8' },
  )
  const output = `${result.stdout}\n${result.stderr}`
  if (expectFailure) {
    if (result.status === 0) throw new Error('EXPECTED_PSQL_FILE_FAILURE')
    return output
  }
  if (result.status !== 0) {
    throw new Error(`${path}\n${result.stderr || result.stdout}`)
  }
  return result.stdout.trim()
}

function startPsqlSession() {
  const args = psqlArgs()
  args.splice(1, 0, '--interactive')
  const child = spawn('docker', args, {
    cwd: root,
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  let output = ''
  child.stdout.on('data', (chunk) => {
    output += chunk.toString()
  })
  child.stderr.on('data', (chunk) => {
    output += chunk.toString()
  })
  return { child, output: () => output }
}

function waitForSessionOutput(session, expected, timeoutMs = 10000) {
  return new Promise((resolvePromise, rejectPromise) => {
    const startedAt = Date.now()
    const timer = setInterval(() => {
      if (session.output().includes(expected)) {
        clearInterval(timer)
        resolvePromise()
      } else if (session.child.exitCode !== null) {
        clearInterval(timer)
        rejectPromise(new Error(`PSQL_SESSION_EXITED\n${session.output()}`))
      } else if (Date.now() - startedAt >= timeoutMs) {
        clearInterval(timer)
        rejectPromise(new Error(`PSQL_SESSION_OUTPUT_TIMEOUT\n${session.output()}`))
      }
    }, 25)
  })
}

function waitForSessionExit(session, timeoutMs = 10000) {
  return new Promise((resolvePromise, rejectPromise) => {
    if (session.child.exitCode !== null) {
      resolvePromise(session.child.exitCode)
      return
    }
    const timer = setTimeout(() => {
      rejectPromise(new Error(`PSQL_SESSION_EXIT_TIMEOUT\n${session.output()}`))
    }, timeoutMs)
    session.child.once('exit', (code) => {
      clearTimeout(timer)
      resolvePromise(code)
    })
  })
}

async function verifyConcurrentChildMutationFence() {
  const childMutation = startPsqlSession()
  let marker = null
  try {
    childMutation.child.stdin.write(`
\\set ON_ERROR_STOP on
begin;
update public.product_order_items
set product_name = 'Concurrent forged item'
where order_id = (
  select id from public.product_orders
  where order_no = 'LPONE-eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
);
\\echo LINE_PAY_NT1_CHILD_LOCK_HELD
`)
    await waitForSessionOutput(
      childMutation,
      'LINE_PAY_NT1_CHILD_LOCK_HELD',
    )

    marker = startPsqlSession()
    marker.child.stdin.end(`
\\set ON_ERROR_STOP on
set role service_role;
select line_pay_private.mark_line_pay_production_one_dollar_non_fulfillment(
  (
    select id from public.product_orders
    where order_no = 'LPONE-eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
  ),
  '51000000-0000-4000-8000-000000000001',
  'ai_chart_report'
);
`)

    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250))
    if (marker.child.exitCode !== null) {
      throw new Error(`MARKER_DID_NOT_WAIT_FOR_CHILD_LOCK\n${marker.output()}`)
    }

    childMutation.child.stdin.end('commit;\n\\q\n')
    const childExit = await waitForSessionExit(childMutation)
    const markerExit = await waitForSessionExit(marker)
    if (
      childExit !== 0
      || markerExit === 0
      || !marker.output().includes(
        'line_pay_production_one_dollar_non_fulfillment_target_invalid',
      )
    ) {
      throw new Error(
        `CONCURRENT_CHILD_MUTATION_FENCE_INVALID\n${childMutation.output()}\n${marker.output()}`,
      )
    }
  } finally {
    if (childMutation.child.exitCode === null) childMutation.child.kill()
    if (marker?.child.exitCode === null) marker.child.kill()
  }
}

function psqlSql(sql, expectFailure = false) {
  const result = spawnSync(
    'docker',
    [...psqlArgs(), '--command', sql],
    { cwd: root, encoding: 'utf8' },
  )
  const output = `${result.stdout}\n${result.stderr}`
  if (expectFailure) {
    if (result.status === 0) throw new Error('EXPECTED_PSQL_FAILURE')
    return output
  }
  if (result.status !== 0) throw new Error(output)
  return result.stdout.trim()
}

function waitForPostgres() {
  let readyChecks = 0
  for (let attempt = 0; attempt < 120; attempt += 1) {
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
    readyChecks = result.status === 0 && result.stdout.trim() === '1'
      ? readyChecks + 1
      : 0
    if (readyChecks >= 2) return
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250)
  }
  throw new Error('POSTGRES_STABLE_READINESS_TIMEOUT')
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

  const deploymentOutput = psqlFile(
    'supabase/deployment/line_pay_production_one_dollar_non_fulfillment_deploy.sql',
  )
  const evidence = inspectDeployOutput(deploymentOutput)
  if (
    !evidence.markerSequenceValid
    || !evidence.migration_started_observed
    || !evidence.migration_commit_observed
    || !evidence.postflight_started_observed
    || !evidence.postflight_state_observed
    || !evidence.postflight_commit_observed
  ) {
    throw new Error('DEPLOYMENT_ATTESTATION_INVALID')
  }
  parseDeployOutput(evidence.auditOutput)

  const fixtureOutput = psqlFile(
    'supabase/tests/line_pay_production_one_dollar_non_fulfillment.sql',
  )
  if (
    fixtureOutput.trim()
    !== 'line_pay_production_one_dollar_non_fulfillment_contract_ready'
  ) {
    throw new Error('NON_FULFILLMENT_CONTRACT_OUTPUT_INVALID')
  }

  await verifyConcurrentChildMutationFence()

  const forbiddenFulfillmentOutput = psqlSql(`
    update public.product_orders
    set order_status = 'preparing'
    where order_no = 'LPONE-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  `, true)
  if (
    !forbiddenFulfillmentOutput.includes(
      'line_pay_production_one_dollar_fulfillment_is_forbidden',
    )
  ) {
    throw new Error('NON_FULFILLMENT_TRIGGER_NOT_ENFORCED')
  }

  const verifyOutput = psqlFile(
    'supabase/deployment/line_pay_production_one_dollar_non_fulfillment_verify.sql',
  )
  parseVerificationOutput(verifyOutput)

  psqlSql(`
    grant execute on function
      public.initialize_line_pay_production_nt1_non_fulfillment_checkout(jsonb, text)
    to authenticated;
  `)
  const aclDriftOutput = psqlFile(
    'supabase/deployment/line_pay_production_one_dollar_non_fulfillment_verify.sql',
    true,
  )
  if (!aclDriftOutput.includes(
    'line_pay_production_one_dollar_non_fulfillment_postflight_failed',
  )) {
    throw new Error('NON_FULFILLMENT_ACL_DRIFT_NOT_DETECTED')
  }
  psqlSql(`
    revoke execute on function
      public.initialize_line_pay_production_nt1_non_fulfillment_checkout(jsonb, text)
    from authenticated;
  `)

  psqlSql(`
    revoke execute on function
      line_pay_private.mark_line_pay_production_one_dollar_non_fulfillment(uuid, uuid, text)
    from service_role;
  `)
  const requiredAclDriftOutput = psqlFile(
    'supabase/deployment/line_pay_production_one_dollar_non_fulfillment_verify.sql',
    true,
  )
  if (!requiredAclDriftOutput.includes(
    'line_pay_production_one_dollar_non_fulfillment_postflight_failed',
  )) {
    throw new Error('NON_FULFILLMENT_REQUIRED_ACL_DRIFT_NOT_DETECTED')
  }
  psqlSql(`
    grant execute on function
      line_pay_private.mark_line_pay_production_one_dollar_non_fulfillment(uuid, uuid, text)
    to service_role;
  `)

  psqlSql(`
    alter table
      line_pay_private.line_pay_production_one_dollar_non_fulfillment_orders
    force row level security;
  `)
  const forceRlsDriftOutput = psqlFile(
    'supabase/deployment/line_pay_production_one_dollar_non_fulfillment_verify.sql',
    true,
  )
  if (!forceRlsDriftOutput.includes(
    'line_pay_production_one_dollar_non_fulfillment_postflight_failed',
  )) {
    throw new Error('NON_FULFILLMENT_FORCE_RLS_DRIFT_NOT_DETECTED')
  }
  psqlSql(`
    alter table
      line_pay_private.line_pay_production_one_dollar_non_fulfillment_orders
    no force row level security;
  `)

  psqlSql(`
    alter table public.product_order_items disable trigger
      line_pay_production_one_dollar_item_guard;
  `)
  const triggerDriftOutput = psqlFile(
    'supabase/deployment/line_pay_production_one_dollar_non_fulfillment_verify.sql',
    true,
  )
  if (!triggerDriftOutput.includes(
    'line_pay_production_one_dollar_non_fulfillment_postflight_failed',
  )) {
    throw new Error('NON_FULFILLMENT_TRIGGER_DRIFT_NOT_DETECTED')
  }
  psqlSql(`
    alter table public.product_order_items enable trigger
      line_pay_production_one_dollar_item_guard;
  `)

  const wrapperDefinition = psqlSql(`
    select pg_catalog.pg_get_functiondef(
      'public.initialize_line_pay_production_nt1_non_fulfillment_checkout(jsonb, text)'::regprocedure
    );
  `)
  psqlSql(`
    create or replace function
      public.initialize_line_pay_production_nt1_non_fulfillment_checkout(
        p_payload jsonb,
        p_entry_source text
      )
    returns table (
      result_code text,
      product_order_id uuid,
      payment_id uuid,
      attempt_id uuid,
      outbox_id uuid,
      confirm_capability_id uuid,
      cancel_capability_id uuid,
      merchant_order_no text,
      request_state text
    )
    language plpgsql
    volatile
    security invoker
    set search_path = ''
    as \$drift\$
    begin
      -- Retain the old name to prove substring checks are insufficient:
      -- mark_line_pay_production_one_dollar_non_fulfillment
      return query
      select * from public.initialize_product_order_line_pay_checkout(p_payload);
    end;
    \$drift\$;
  `)
  const wrapperDriftOutput = psqlFile(
    'supabase/deployment/line_pay_production_one_dollar_non_fulfillment_verify.sql',
    true,
  )
  if (!wrapperDriftOutput.includes(
    'line_pay_production_one_dollar_non_fulfillment_postflight_failed',
  )) {
    throw new Error('NON_FULFILLMENT_WRAPPER_DRIFT_NOT_DETECTED')
  }
  psqlSql(wrapperDefinition)

  psqlSql(`
    create or replace function
      line_pay_private.enforce_line_pay_production_one_dollar_child_guard()
    returns trigger
    language plpgsql
    volatile
    security definer
    set search_path = ''
    as \$drift\$
    begin
      -- Retain the old keywords to prove substring checks are insufficient:
      -- line_pay_production_nt1_non_fulfillment:
      -- line_pay_production_one_dollar_aggregate_is_immutable
      -- line_pay_production_one_dollar_non_fulfillment_orders
      return case when tg_op = 'DELETE' then old else new end;
    end;
    \$drift\$;
  `)
  const functionDriftOutput = psqlFile(
    'supabase/deployment/line_pay_production_one_dollar_non_fulfillment_verify.sql',
    true,
  )
  if (!functionDriftOutput.includes(
    'line_pay_production_one_dollar_non_fulfillment_postflight_failed',
  )) {
    throw new Error('NON_FULFILLMENT_FUNCTION_DRIFT_NOT_DETECTED')
  }

  console.log('line_pay_production_one_dollar_non_fulfillment_db_contracts_passed')
} finally {
  if (started) {
    spawnSync('docker', ['rm', '--force', containerName], {
      cwd: root,
      encoding: 'utf8',
    })
  }
}
