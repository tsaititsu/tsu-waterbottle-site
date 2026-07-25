import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { isAbsolute, resolve } from 'node:path'

import {
  APPROVED_SOURCE_COMMIT,
  EXPECTED_CONSTRAINT_DEFINITION_MD5,
  EXPECTED_FUNCTION_DEFINITION_MD5,
  EXPECTED_MIGRATION_SHA256,
  MIGRATION_FILE,
  POSTGRES_IMAGE,
  POSTGRES_PLATFORM,
  parseAndValidateAuditOutput,
  validateApprovedSource,
  validatePostgresImageIdentity,
} from '../../scripts/supabase/validate-booking-atomic-production-deployment.mjs'

const root = process.cwd()
const approvedSourceRoot = process.env.APPROVED_SOURCE_ROOT
const printIdentity = process.argv[2] === '--print-identity'
const container = `codex-booking-production-pipeline-pg17-${process.pid}`
const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const planId = 'waterbottle-consultation-60'
let containerStarted = false
let assertions = 0

if (
  process.argv.length > (printIdentity ? 3 : 2) ||
  !isAbsolute(approvedSourceRoot ?? '')
) {
  throw new Error('APPROVED_SOURCE_INVALID')
}
validateApprovedSource(approvedSourceRoot)

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    input: options.input,
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      NODE_ENV: 'test',
    },
  })
  if (!options.allowFailure && result.status !== 0) {
    throw new Error(
      `${command} ${args.join(' ')} failed with exit ${result.status}\n${result.stderr}`,
    )
  }
  return result
}

function cleanup() {
  if (!containerStarted) return
  run('docker', ['rm', '--force', container], { allowFailure: true })
  containerStarted = false
}

function psql(input, file, options = {}) {
  const args = [
    'exec',
    '-i',
    container,
    'psql',
    '-X',
    '--no-psqlrc',
    '--set=ON_ERROR_STOP=1',
    '--quiet',
    '--no-align',
    '--tuples-only',
    '-U',
    'postgres',
    '-d',
    'postgres',
  ]
  if (file) args.push(`--file=${file}`)
  return run('docker', args, {
    allowFailure: options.allowFailure,
    input,
  })
}

function check(callback) {
  callback()
  assertions += 1
}

const fixture = `
create extension if not exists pgcrypto;
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create schema auth;
create table auth.users (id uuid primary key);
insert into auth.users (id) values ('${userId}'::uuid);

create table public.consultation_plans (
  id text primary key,
  name text not null,
  description text not null default '',
  duration_minutes integer not null check (duration_minutes > 0),
  price_twd integer not null check (price_twd >= 0),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.consultation_availability_slots (
  id uuid primary key default gen_random_uuid(),
  start_at timestamptz not null,
  end_at timestamptz not null,
  is_available boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint consultation_availability_slots_time_check
    check (end_at > start_at)
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  plan_id text references public.consultation_plans(id),
  plan_name text not null,
  amount_twd integer not null,
  currency text not null default 'TWD',
  status text not null default 'pending_payment',
  payment_status text not null default 'pending',
  refund_status text not null default 'none',
  customer_name text not null,
  customer_email text not null,
  customer_phone text,
  line_display_name text,
  gender text not null check (gender in ('male', 'female', 'other')),
  birth_date date not null,
  birth_time time not null,
  birth_place text,
  is_birth_time_accurate boolean not null,
  question text not null,
  note text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  timezone text not null default 'Asia/Taipei',
  google_calendar_event_id text,
  google_calendar_event_link text,
  google_calendar_cancelled boolean not null default false,
  confirmation_email_sent_to_customer boolean not null default false,
  confirmation_email_sent_to_admin boolean not null default false,
  cancellation_email_sent_to_customer boolean not null default false,
  cancellation_email_sent_to_admin boolean not null default false,
  accepted_notice_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  rescheduled_from_booking_id uuid references public.bookings(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.consultation_plans (
  id,
  name,
  duration_minutes,
  price_twd,
  is_active
) values (
  '${planId}',
  '資料庫正式方案',
  60,
  4100,
  true
);

grant usage on schema public to service_role, authenticated, anon;
grant select on public.consultation_plans to service_role;
grant select, update on public.consultation_availability_slots to service_role;
grant select, insert on public.bookings to service_role;
`

process.once('SIGINT', () => {
  cleanup()
  process.exit(130)
})
process.once('SIGTERM', () => {
  cleanup()
  process.exit(143)
})

function main() {
  try {
    check(() => {
      assert.equal(
        APPROVED_SOURCE_COMMIT,
        'cdc2a4fa49300a62782a7171ac9ab77a95a9a602',
      )
      assert.equal(
        EXPECTED_MIGRATION_SHA256,
        'ea02c044e19bacdfc10c81b109bb858d26d205fc58691ddfbb18ea418c9d25e1',
      )
      assert.equal(
        readFileSync(resolve(approvedSourceRoot, MIGRATION_FILE), 'utf8')
          .length > 0,
        true,
      )
    })

    const imageInspection = run('docker', [
      'image',
      'inspect',
      '--format',
      '{{.Os}}|{{.Architecture}}|{{.Id}}',
      POSTGRES_IMAGE,
    ])
    assert.equal(validatePostgresImageIdentity(imageInspection.stdout), true)

    run('docker', [
      'run',
      `--platform=${POSTGRES_PLATFORM}`,
      '--pull=never',
      '--rm',
      '--detach',
      '--name',
      container,
      '--label',
      'codex.task=booking-atomic-production-pipeline-postgres17',
      '--network',
      'none',
      '--tmpfs',
      '/var/lib/postgresql/data:rw,noexec,nosuid',
      '--mount',
      `type=bind,source=${root},target=/pipeline,readonly`,
      '--mount',
      `type=bind,source=${approvedSourceRoot},target=/approved-source,readonly`,
      '--env',
      'POSTGRES_HOST_AUTH_METHOD=trust',
      POSTGRES_IMAGE,
    ])
    containerStarted = true

    let ready = false
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const result = run(
        'docker',
        ['exec', container, 'pg_isready', '-U', 'postgres', '-d', 'postgres'],
        { allowFailure: true },
      )
      if (result.status === 0) {
        ready = true
        break
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250)
    }
    assert.equal(ready, true, 'PostgreSQL container did not become ready')

    psql(fixture)
    check(() => {
      assert.match(psql('show server_version_num;').stdout.trim(), /^17\d{4}$/)
    })

    if (printIdentity) {
      psql(
        undefined,
        `/approved-source/${MIGRATION_FILE}`,
      )
      const identity = psql(`
select
  md5(pg_get_functiondef(procedure.oid)) || '|' ||
  md5(pg_get_constraintdef(constraint_row.oid, true))
from pg_catalog.pg_proc as procedure
join pg_catalog.pg_namespace as function_namespace
  on function_namespace.oid = procedure.pronamespace
join pg_catalog.pg_constraint as constraint_row
  on constraint_row.conname = 'bookings_active_schedule_no_overlap'
join pg_catalog.pg_class as relation
  on relation.oid = constraint_row.conrelid
join pg_catalog.pg_namespace as relation_namespace
  on relation_namespace.oid = relation.relnamespace
where function_namespace.nspname = 'public'
  and procedure.proname = 'create_booking_with_available_slot'
  and relation_namespace.nspname = 'public'
  and relation.relname = 'bookings';
`).stdout.trim()
      console.log(identity)
      return
    }

    const preflight = psql(
      undefined,
      '/pipeline/supabase/deployment/booking_atomic_create_preflight.sql',
    ).stdout
    check(() => {
      assert.equal(parseAndValidateAuditOutput(preflight, 'preflight'), true)
    })

    psql(undefined, `/approved-source/${MIGRATION_FILE}`)
    psql(`
alter table public.bookings
  drop constraint bookings_active_schedule_no_overlap;
`)
    const lockedDrift = psql(
      undefined,
      '/pipeline/supabase/deployment/booking_atomic_create_deploy.sql',
      { allowFailure: true },
    )
    check(() => {
      assert.notEqual(lockedDrift.status, 0)
      assert.match(
        lockedDrift.stderr,
        /BOOKING_ATOMIC_LOCKED_SCHEMA_DRIFT/,
      )
      assert.equal(
        psql(`
select
  (select count(*)
   from pg_catalog.pg_constraint
   where conname = 'bookings_active_schedule_no_overlap')::text || '|' ||
  (select count(*)
   from pg_catalog.pg_proc as procedure
   join pg_catalog.pg_namespace as namespace
     on namespace.oid = procedure.pronamespace
   where namespace.nspname = 'public'
     and procedure.proname =
       'create_booking_with_available_slot')::text;
`).stdout.trim(),
        '0|1',
      )
    })
    psql(`
drop function public.create_booking_with_available_slot(
  uuid, uuid, text, text, text, text, text, text, date,
  time without time zone, text, boolean, text, text
);
`)

    const deploy = psql(
      undefined,
      '/pipeline/supabase/deployment/booking_atomic_create_deploy.sql',
    ).stdout
    check(() => {
      assert.equal(parseAndValidateAuditOutput(deploy, 'deploy'), true)
    })

    check(() => {
      assert.equal(
        psql(`
select
  md5(pg_get_functiondef(procedure.oid)) || '|' ||
  md5(pg_get_constraintdef(constraint_row.oid, true)) || '|' ||
  has_function_privilege('service_role', procedure.oid, 'EXECUTE')::text || '|' ||
  has_function_privilege('authenticated', procedure.oid, 'EXECUTE')::text || '|' ||
  has_function_privilege('anon', procedure.oid, 'EXECUTE')::text
from pg_catalog.pg_proc as procedure
join pg_catalog.pg_namespace as function_namespace
  on function_namespace.oid = procedure.pronamespace
join pg_catalog.pg_constraint as constraint_row
  on constraint_row.conname = 'bookings_active_schedule_no_overlap'
join pg_catalog.pg_class as relation
  on relation.oid = constraint_row.conrelid
join pg_catalog.pg_namespace as relation_namespace
  on relation_namespace.oid = relation.relnamespace
where function_namespace.nspname = 'public'
  and procedure.proname = 'create_booking_with_available_slot'
  and relation_namespace.nspname = 'public'
  and relation.relname = 'bookings';
`).stdout.trim(),
        `${EXPECTED_FUNCTION_DEFINITION_MD5}|${EXPECTED_CONSTRAINT_DEFINITION_MD5}|true|false|false`,
      )
    })

    check(() => {
      assert.equal(
        psql(`
select
  (select count(*) from public.consultation_plans
   where id = '__codex_booking_atomic_smoke_20260725__')::text || '|' ||
  (select count(*) from public.consultation_availability_slots
   where id = '8f3a7d4a-1111-4111-8111-8f3a7d4a1111'::uuid)::text || '|' ||
  (select count(*) from public.bookings
   where customer_email = 'codex-booking-atomic-smoke@example.invalid')::text;
`).stdout.trim(),
        '0|0|0',
      )
    })

    const appliedPreflight = psql(
      undefined,
      '/pipeline/supabase/deployment/booking_atomic_create_preflight.sql',
    ).stdout
    check(() => {
      assert.throws(
        () => parseAndValidateAuditOutput(appliedPreflight, 'preflight'),
        /ALREADY_APPLIED/,
      )
    })

    const driftedPreflight = psql(`
begin;
grant execute on function public.create_booking_with_available_slot(
  uuid, uuid, text, text, text, text, text, text, date,
  time without time zone, text, boolean, text, text
) to authenticated;
\\i /pipeline/supabase/deployment/booking_atomic_create_preflight.sql
rollback;
`).stdout
    check(() => {
      assert.throws(
        () => parseAndValidateAuditOutput(driftedPreflight, 'preflight'),
        /SCHEMA_DRIFT/,
      )
    })

    console.log(
      `booking_atomic_production_pipeline: PASS (${assertions} PostgreSQL 17 checks, exact source, preflight, locked Migration, identity, ACL, rollback-only smoke, no persisted synthetic rows)`,
    )
  } finally {
    cleanup()
  }
}

main()
