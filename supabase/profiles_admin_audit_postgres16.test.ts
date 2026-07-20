import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const image = 'postgres:16'
const container = `codex-profiles-acl-role-array-pg16-${process.pid}`
const preflight = readFileSync(
  join(root, 'supabase/deployment/profiles_admin_escalation_preflight.sql'),
  'utf8',
)
const postflight = readFileSync(
  join(root, 'supabase/deployment/profiles_admin_escalation_postflight.sql'),
  'utf8',
)

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
  run('docker', ['rm', '-f', container], { allowFailure: true })
  containerStarted = false
}

function psql(sql: string) {
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
    { input: sql },
  ).stdout.trim()
}

function check(name: string, assertion: () => void) {
  assertion()
  assertions += 1
  return name
}

function parseAudit(sql: string) {
  const output = psql(sql)
  assert.notEqual(output, '', 'audit SQL must emit a JSON result')
  return JSON.parse(output) as {
    target_policy: { count: number; roles: string[] }
  }
}

const roleTypeProbe = `
with target_table as (
  select c.oid as table_oid
  from pg_catalog.pg_class as c
  join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'profiles' and c.relkind in ('r', 'p')
),
target_policy_rows as (
  select
    array(
      select case
        when role_oid = 0 then 'public'::text
        else r.rolname::text
      end
      from unnest(p.polroles) as policy_roles(role_oid)
      left join pg_catalog.pg_roles as r
        on r.oid = policy_roles.role_oid
      order by 1
    ) as roles
  from pg_catalog.pg_policy as p
  join target_table on target_table.table_oid = p.polrelid
  where p.polname = 'profiles_update_own_or_admin'
),
target_policy as (
  select
    count(*)::integer as count,
    coalesce(
      (select roles from target_policy_rows limit 1),
      array[]::text[]
    ) as roles
  from target_policy_rows
)
select pg_typeof(roles)::text || '|' || roles::text || '|' || count::text
from target_policy;
`

const setup = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create schema auth;
create function auth.uid() returns uuid
language sql stable
as 'select null::uuid';
create table public.profiles (
  id uuid primary key,
  is_admin boolean not null default false
);
alter table public.profiles enable row level security;
create function public.is_admin() returns boolean
language sql stable security definer
set search_path to public
as 'select false';
`

const vulnerablePolicy = `
create policy profiles_update_own_or_admin
on public.profiles
for update
to public
using (id = auth.uid() or public.is_admin());
`

const securePolicy = `
drop policy profiles_update_own_or_admin on public.profiles;
create policy profiles_update_own_or_admin
on public.profiles
for update
to authenticated
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());
`

process.once('SIGINT', () => {
  cleanup()
  process.exit(130)
})
process.once('SIGTERM', () => {
  cleanup()
  process.exit(143)
})

try {
  check('preflight fixes role values to text', () => {
    assert.match(preflight, /when role_oid = 0 then 'public'::text/)
    assert.match(preflight, /else r[.]rolname::text/)
    assert.doesNotMatch(preflight, /\(array_agg\(roles\)\)\[1\]/)
  })
  check('postflight fixes role values to text', () => {
    assert.match(postflight, /when role_oid = 0 then 'public'::text/)
    assert.match(postflight, /else r[.]rolname::text/)
    assert.doesNotMatch(postflight, /\(array_agg\(roles\)\)\[1\]/)
  })

  run('docker', ['image', 'inspect', image])
  run('docker', [
    'run',
    '--rm',
    '--detach',
    '--name',
    container,
    '--label',
    'codex.task=profiles-acl-role-array-type',
    '--env',
    'POSTGRES_HOST_AUTH_METHOD=trust',
    image,
  ])
  containerStarted = true

  let ready = false
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const result = run(
      'docker',
      ['exec', container, 'pg_isready', '-U', 'postgres', '-d', 'postgres'],
      { allowFailure: true },
    )
    if (result.status === 0) {
      ready = true
      break
    }
    run('sleep', ['1'])
  }
  assert.equal(ready, true, 'PostgreSQL container did not become ready')

  check('server is PostgreSQL 16', () => {
    const version = psql('show server_version_num;')
    assert.match(version, /^16\d{4}$/)
  })

  psql(setup)

  check('zero policy rows produce an empty text array', () => {
    assert.equal(psql(roleTypeProbe), 'text[]|{}|0')
  })
  check('preflight executes with zero policy rows', () => {
    assert.deepEqual(parseAudit(preflight).target_policy, {
      count: 0,
      command: null,
      roles: [],
      using_expression: null,
      with_check_expression: null,
    })
  })
  check('postflight executes with zero policy rows', () => {
    assert.deepEqual(parseAudit(postflight).target_policy, {
      count: 0,
      command: null,
      roles: [],
      using_expression: null,
      with_check_expression: null,
    })
  })

  psql(vulnerablePolicy)

  check('one public policy row produces a public text array', () => {
    assert.equal(psql(roleTypeProbe), 'text[]|{public}|1')
  })
  check('preflight executes with a public policy row', () => {
    const result = parseAudit(preflight)
    assert.equal(result.target_policy.count, 1)
    assert.deepEqual(result.target_policy.roles, ['public'])
  })
  check('postflight executes with a public policy row', () => {
    const result = parseAudit(postflight)
    assert.equal(result.target_policy.count, 1)
    assert.deepEqual(result.target_policy.roles, ['public'])
  })

  psql(securePolicy)

  check('postflight executes with an authenticated policy row', () => {
    const result = parseAudit(postflight)
    assert.equal(result.target_policy.count, 1)
    assert.deepEqual(result.target_policy.roles, ['authenticated'])
  })

  console.log(`✓ ${assertions} PostgreSQL 16 profiles audit role-array checks passed`)
} finally {
  cleanup()
}
