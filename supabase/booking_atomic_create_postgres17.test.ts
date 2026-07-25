import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const expectedImageId =
  'sha256:742f40ea20b9ff2ff31db5458d127452988a2164df9e17441e191f3b72252193'
const image = expectedImageId
const container = `codex-booking-atomic-pg17-${process.pid}`
const migration = readFileSync(
  join(
    root,
    'supabase/migrations/20260725123441_create_booking_with_available_slot.sql',
  ),
  'utf8',
)

const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const planId = 'waterbottle-consultation-60'
let containerStarted = false
let assertions = 0

function run(
  command: string,
  args: string[],
  options: { input?: string; allowFailure?: boolean } = {},
) {
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

function psql(sql: string, allowFailure = false) {
  return run(
    'docker',
    [
      'exec',
      '-i',
      container,
      'psql',
      '-X',
      '--no-psqlrc',
      '-v',
      'ON_ERROR_STOP=1',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-Atq',
    ],
    { input: sql, allowFailure },
  )
}

function check(assertion: () => void) {
  assertion()
  assertions += 1
}

function bookingCall(slotId: string, gender = 'female') {
  return `
set role service_role;
select row_to_json(result)::text
from public.create_booking_with_available_slot(
  '${userId}'::uuid,
  '${slotId}'::uuid,
  '${planId}'::text,
  '離線測試會員'::text,
  'member@example.test'::text,
  null::text,
  null::text,
  '${gender}'::text,
  '1990-01-01'::date,
  '12:00:00'::time,
  '台北市'::text,
  true,
  '離線原子交易測試'::text,
  null::text
) as result;
`
}

function concurrentPsql(sql: string) {
  return new Promise<{
    status: number | null
    signal: NodeJS.Signals | null
    stdout: string
    stderr: string
  }>((resolve, reject) => {
    const child = spawn(
      'docker',
      [
        'exec',
        '-i',
        container,
        'psql',
        '-X',
        '--no-psqlrc',
        '-v',
        'ON_ERROR_STOP=1',
        '-U',
        'postgres',
        '-d',
        'postgres',
        '-Atq',
      ],
      {
        cwd: root,
        env: {
          PATH: process.env.PATH,
          HOME: process.env.HOME,
          NODE_ENV: 'test',
        },
      },
    )
    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk) => {
      stdout += chunk
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk
    })
    child.once('error', reject)
    child.once('close', (status, signal) => {
      resolve({ status, signal, stdout, stderr })
    })
    child.stdin.end(sql)
  })
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
  constraint consultation_availability_slots_time_check check (end_at > start_at)
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

async function main() {
  try {
    check(() => {
      assert.match(migration, /security invoker/i)
      assert.match(migration, /set search_path = ''/i)
      assert.match(migration, /revoke all on function[\s\S]*from public/i)
      assert.match(migration, /grant execute on function[\s\S]*to service_role/i)
      assert.match(
        migration,
        /exclude using gist\s*\(\s*pg_catalog\.tstzrange\(starts_at, ends_at, '\[\)'\) with &&\s*\)/i,
      )
      assert.match(
        migration,
        /pg_catalog\.pg_advisory_xact_lock\s*\(\s*pg_catalog\.hashtextextended/i,
      )
    })

  const imageInspection = run('docker', [
    'image',
    'inspect',
    '--format',
    '{{.Id}}',
    image,
  ])
  assert.equal(
    imageInspection.stdout.trim(),
    expectedImageId,
    'local PostgreSQL 17 image identity drifted',
  )
  run('docker', [
    'run',
    '--pull=never',
    '--rm',
    '--detach',
    '--name',
    container,
    '--label',
    'codex.task=booking-atomic-create-postgres17',
    '--network',
    'none',
    '--tmpfs',
    '/var/lib/postgresql/data:rw,noexec,nosuid',
    '--env',
    'POSTGRES_HOST_AUTH_METHOD=trust',
    image,
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

  check(() => {
    assert.match(psql('show server_version_num;').stdout.trim(), /^17\d{4}$/)
  })

  psql(fixture)
  psql(migration)

  check(() => {
    assert.equal(
      psql(`
select p.prosecdef::text || '|' ||
  has_function_privilege('service_role', p.oid, 'EXECUTE')::text || '|' ||
  has_function_privilege('authenticated', p.oid, 'EXECUTE')::text || '|' ||
  has_function_privilege('anon', p.oid, 'EXECUTE')::text
from pg_catalog.pg_proc as p
join pg_catalog.pg_namespace as n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'create_booking_with_available_slot';
`).stdout.trim(),
      'false|true|false|false',
    )
  })

  const firstSlot = '11111111-1111-4111-8111-111111111111'
  psql(`
insert into public.consultation_availability_slots (id, start_at, end_at)
values ('${firstSlot}', '2099-08-01T05:00:00Z', '2099-08-01T06:00:00Z');
`)
  const created = JSON.parse(psql(bookingCall(firstSlot)).stdout.trim()) as {
    plan_name: string
    amount_twd: number
    starts_at: string
    ends_at: string
  }
  check(() => {
    assert.equal(created.plan_name, '資料庫正式方案')
    assert.equal(created.amount_twd, 4100)
    assert.match(created.starts_at, /^2099-08-01T05:00:00/)
    assert.match(created.ends_at, /^2099-08-01T06:00:00/)
    assert.equal(
      psql(`
select is_available::text || '|' ||
  (select count(*)::text from public.bookings where starts_at = '2099-08-01T05:00:00Z')
from public.consultation_availability_slots
where id = '${firstSlot}';
`).stdout.trim(),
      'false|1',
    )
  })

  const concurrentSlot = '22222222-2222-4222-8222-222222222222'
  psql(`
insert into public.consultation_availability_slots (id, start_at, end_at)
values ('${concurrentSlot}', '2099-08-02T05:00:00Z', '2099-08-02T06:00:00Z');
`)
  const concurrentResults = await Promise.all([
    concurrentPsql(bookingCall(concurrentSlot)),
    concurrentPsql(bookingCall(concurrentSlot)),
  ])
  check(() => {
    const successes = concurrentResults.filter(
      (result) => result.status === 0 && result.signal === null,
    )
    const failures = concurrentResults.filter(
      (result) =>
        result.status !== 0 &&
        result.signal === null &&
        result.stderr.includes('booking_slot_unavailable'),
    )
    const resultSummary = JSON.stringify(concurrentResults)
    assert.equal(successes.length, 1, resultSummary)
    assert.equal(failures.length, 1, resultSummary)
    assert.equal(
      psql(`
select count(*)::text
from public.bookings
where starts_at = '2099-08-02T05:00:00Z';
`).stdout.trim(),
      '1',
    )
  })

  const overlappingSlotA = '55555555-5555-4555-8555-555555555555'
  const overlappingSlotB = '66666666-6666-4666-8666-666666666666'
  psql(`
insert into public.consultation_availability_slots (id, start_at, end_at)
values
  ('${overlappingSlotA}', '2099-08-04T05:00:00Z', '2099-08-04T06:00:00Z'),
  ('${overlappingSlotB}', '2099-08-04T05:00:00Z', '2099-08-04T06:00:00Z');
`)
  const overlappingResults = await Promise.all([
    concurrentPsql(bookingCall(overlappingSlotA)),
    concurrentPsql(bookingCall(overlappingSlotB)),
  ])
  check(() => {
    const successes = overlappingResults.filter(
      (result) => result.status === 0 && result.signal === null,
    )
    const failures = overlappingResults.filter(
      (result) =>
        result.status !== 0 &&
        result.signal === null &&
        result.stderr.includes('booking_slot_unavailable'),
    )
    const resultSummary = JSON.stringify(overlappingResults)
    assert.equal(successes.length, 1, resultSummary)
    assert.equal(failures.length, 1, resultSummary)
    assert.equal(
      psql(`
select
  (select count(*)::text
   from public.bookings
   where starts_at = '2099-08-04T05:00:00Z') || '|' ||
  (select count(*)::text
   from public.consultation_availability_slots
   where id in ('${overlappingSlotA}', '${overlappingSlotB}')
     and is_available is false);
`).stdout.trim(),
      '1|1',
    )
  })

  const rollbackSlot = '33333333-3333-4333-8333-333333333333'
  psql(`
insert into public.consultation_availability_slots (id, start_at, end_at)
values ('${rollbackSlot}', '2099-08-03T05:00:00Z', '2099-08-03T06:00:00Z');
`)
  const failedInsert = psql(bookingCall(rollbackSlot, 'invalid'), true)
  check(() => {
    assert.notEqual(failedInsert.status, 0)
    assert.equal(failedInsert.signal, null)
    assert.match(failedInsert.stderr, /bookings_gender_check/)
    assert.equal(
      psql(`
select is_available::text || '|' ||
  (select count(*)::text from public.bookings where starts_at = '2099-08-03T05:00:00Z')
from public.consultation_availability_slots
where id = '${rollbackSlot}';
`).stdout.trim(),
      'true|0',
    )
  })

  check(() => {
    const denied = psql(`
set role authenticated;
select public.create_booking_with_available_slot(
  '${userId}'::uuid,
  '44444444-4444-4444-8444-444444444444'::uuid,
  '${planId}',
  'blocked',
  'blocked@example.test',
  null,
  null,
  'female',
  '1990-01-01',
  '12:00:00',
  null,
  true,
  'blocked',
  null
);
`, true)
    assert.notEqual(denied.status, 0)
    assert.match(denied.stderr, /permission denied for function/)
  })

    console.log(
      `✓ ${assertions} PostgreSQL 17 atomic booking transaction checks passed`,
    )
  } finally {
    cleanup()
  }
}

void main()
