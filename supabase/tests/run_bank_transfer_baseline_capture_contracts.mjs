import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  assertCaptureSql,
  parseAndValidateBaselineArtifact,
} from '../../scripts/supabase/validate-bank-transfer-production-baseline-capture.mjs'
import { LINE_PAY_POSTGRES_IMAGE } from './line_pay_postgres_image.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const suffix = randomBytes(6).toString('hex')
const taskLabel = 'bank-transfer-baseline-capture'
const containerName = `${taskLabel}-${suffix}`
const networkName = `${containerName}-network`
const volumeName = `${containerName}-data`
const password = randomBytes(32).toString('base64url')
const capturePath = join(
  root,
  'supabase/deployment/bank_transfer_historical_baseline_capture.sql',
)

function docker(args, options = {}) {
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

function psql(sql, label, { readOnly = false } = {}) {
  const result = spawnSync(
    'docker',
    [
      'exec',
      '-i',
      ...(readOnly
        ? [
            '--env',
            'PGOPTIONS=-c default_transaction_read_only=on -c statement_timeout=120000 -c lock_timeout=15000 -c idle_in_transaction_session_timeout=30000',
          ]
        : []),
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
      'postgres',
    ],
    { cwd: root, encoding: 'utf8', input: sql },
  )
  if (result.status !== 0) {
    throw new Error(`${label}:FAILED\n${result.stderr || result.stdout}`)
  }
  return result.stdout.trim()
}

function prepareFixture() {
  psql(
    `
      create extension if not exists pgcrypto;
      create schema auth;
      create role anon nologin;
      create role authenticated nologin;
      create role service_role nologin;

      create function auth.uid() returns uuid
      language sql stable
      as 'select null::uuid';

      create table public.bank_transfer_submissions (
        id uuid primary key default gen_random_uuid(),
        user_id uuid,
        item_type text not null,
        item_id text,
        item_name text not null,
        amount_twd integer not null,
        payer_name text not null,
        payer_phone text not null,
        payer_email text,
        line_display_name text,
        bank_account_last5 text not null,
        transfer_time timestamptz,
        note text,
        status text not null default 'pending_review',
        admin_note text,
        created_at timestamptz default now(),
        confirmed_at timestamptz
      );

      alter table public.bank_transfer_submissions enable row level security;
      create policy "Users can read own bank transfer submissions"
        on public.bank_transfer_submissions
        for select
        to authenticated
        using ((select auth.uid()) = user_id);
      revoke all privileges on table public.bank_transfer_submissions
        from public, anon, authenticated, service_role;
      grant select on table public.bank_transfer_submissions
        to authenticated, service_role;

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
          'Synthetic User 1', '0000000001', 'one@example.invalid', null,
          '00001', '2026-07-01 08:00:00+00', 'synthetic one',
          'pending_review', null, '2026-07-01 00:00:00+00', null
        ),
        (
          '21000000-0000-4000-8000-000000000002',
          '10000000-0000-4000-8000-000000000011',
          'synthetic', 'fixture-2', 'Synthetic fixture 2', 200,
          'Synthetic User 2', '0000000002', 'two@example.invalid', 'Line 2',
          '00002', '2026-07-02 08:00:00+00', 'synthetic two',
          'pending_review', null, '2026-07-02 00:00:00+00', null
        ),
        (
          '21000000-0000-4000-8000-000000000003',
          '10000000-0000-4000-8000-000000000012',
          'synthetic', 'fixture-3', 'Synthetic fixture 3', 300,
          'Synthetic User 3', '0000000003', null, null,
          '00003', null, null,
          'pending_review', null, '2026-07-03 00:00:00+00', null
        );
    `,
    'prepare capture fixture',
  )
}

function capture(source) {
  const before = psql(
    `
      select jsonb_build_object(
        'rows', count(*)::integer,
        'xmin', min(xmin::text),
        'xmax', max(xmax::text)
      )
      from public.bank_transfer_submissions;
    `,
    'before fingerprint',
  )
  const output = psql(source, 'baseline capture', { readOnly: true })
  const after = psql(
    `
      select jsonb_build_object(
        'rows', count(*)::integer,
        'xmin', min(xmin::text),
        'xmax', max(xmax::text)
      )
      from public.bank_transfer_submissions;
    `,
    'after fingerprint',
  )
  assert.equal(after, before)
  const rows = output.split(/\r?\n/u).filter(Boolean)
  assert.equal(rows.length, 1)
  return parseAndValidateBaselineArtifact(`${rows[0]}\n`)
}

function mutate(sql) {
  psql(sql, 'capture mutation')
}

function restore() {
  psql(
    `
      drop table public.bank_transfer_submissions;
      drop function auth.uid();
      drop schema auth;
      drop role anon;
      drop role authenticated;
      drop role service_role;
    `,
    'reset capture fixture',
  )
  prepareFixture()
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
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500)
  }
  assert.fail('POSTGRES_FINAL_SERVER_NOT_READY')
}

let failure
try {
  docker(['network', 'create', '--label', `task=${taskLabel}`, networkName])
  docker(['volume', 'create', '--label', `task=${taskLabel}`, volumeName])
  docker([
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
    LINE_PAY_POSTGRES_IMAGE,
  ])

  waitForPostgres()
  assert.match(psql('show server_version;', 'postgres version'), /^17[.]/u)

  prepareFixture()
  const source = readFileSync(capturePath, 'utf8')
  assert.equal(assertCaptureSql(source), true)
  const baseline = capture(source)
  assert.equal(baseline.row_count, 3)
  assert.equal(baseline.pending_review_count, 3)
  assert.deepEqual(Object.keys(baseline.ordinal_digests), [
    'ordinal_1',
    'ordinal_2',
    'ordinal_3',
  ])

  const scenarios = [
    {
      group: 'identity_and_amount',
      sql: `
        update public.bank_transfer_submissions
        set amount_twd = amount_twd + 1
        where id = '21000000-0000-4000-8000-000000000001';
      `,
    },
    {
      group: 'payer_contact',
      sql: `
        update public.bank_transfer_submissions
        set payer_phone = '9999999999'
        where id = '21000000-0000-4000-8000-000000000001';
      `,
    },
    {
      group: 'transfer_details',
      sql: `
        update public.bank_transfer_submissions
        set note = 'changed synthetic note'
        where id = '21000000-0000-4000-8000-000000000001';
      `,
    },
    {
      group: 'review_and_confirmation',
      sql: `
        update public.bank_transfer_submissions
        set admin_note = 'changed synthetic admin note'
        where id = '21000000-0000-4000-8000-000000000001';
      `,
    },
  ]

  for (const scenario of scenarios) {
    mutate(scenario.sql)
    const changed = capture(source)
    assert.notEqual(
      changed.group_digests[scenario.group],
      baseline.group_digests[scenario.group],
      scenario.group,
    )
    assert.notEqual(
      changed.group_digests.full_canonical_row,
      baseline.group_digests.full_canonical_row,
      `${scenario.group}:full`,
    )
    assert.notEqual(
      changed.ordinal_digests.ordinal_1[scenario.group],
      baseline.ordinal_digests.ordinal_1[scenario.group],
      `${scenario.group}:ordinal`,
    )
    restore()
  }

  console.log('Bank Transfer baseline capture contracts: PASS')
} catch (error) {
  failure = error
} finally {
  spawnSync('docker', ['rm', '--force', containerName], { encoding: 'utf8' })
  spawnSync('docker', ['network', 'rm', networkName], { encoding: 'utf8' })
  spawnSync('docker', ['volume', 'rm', volumeName], { encoding: 'utf8' })
}

if (failure) throw failure
