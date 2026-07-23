import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LINE_PAY_POSTGRES_IMAGE } from './line_pay_postgres_image.mjs'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const root = resolve(scriptDirectory, '../..')
const taskLabel = 'bank-transfer-db-readonly-fence'
const containerName = `${taskLabel}-${randomBytes(6).toString('hex')}`
const networkName = `${containerName}-network`
const volumeName = `${containerName}-data`
const localPostgresPassword = randomBytes(32).toString('base64url')
const image = LINE_PAY_POSTGRES_IMAGE
const migration = join(
  root,
  'supabase/migrations/20260722065311_retire_bank_transfer_submissions_writes.sql',
)
const linePayMigration = join(
  root,
  'supabase/migrations/20260719033404_line_pay_remediation_contracts.sql',
)
const linePayBaselineFiles = [
  'supabase/schema.sql',
  'supabase/bank_transfer_submissions_patch.sql',
  'supabase/newebpay_payments_patch.sql',
  'supabase/payments_service_role_grants.sql',
  'supabase/product_orders_schema_draft.sql',
  'supabase/migrations/20260707_line_pay_provider_schema_draft.sql',
]
const fixtureUsers = {
  owner: '10000000-0000-4000-8000-000000000001',
  other: '10000000-0000-4000-8000-000000000002',
}

function runDocker(args) {
  const result = spawnSync('docker', args, {
    cwd: root,
    encoding: 'utf8',
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

function psqlFile(database, path, label = path) {
  psql(database, readFileSync(path, 'utf8'), label)
}

function psqlFileExpectFailure(database, path, expectedPattern, label) {
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
      input: readFileSync(path, 'utf8'),
    },
  )
  const combinedOutput = `${result.stdout}\n${result.stderr}`

  if (result.status === 0 || !expectedPattern.test(combinedOutput)) {
    throw new Error(`${label} did not fail closed with the required catalog ACL mismatch`)
  }
}

function psqlExpectDenied(database, sql, label) {
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
  const combinedOutput = `${result.stdout}\n${result.stderr}`

  if (result.status === 0 || !/permission denied for table bank_transfer_submissions/i.test(combinedOutput)) {
    throw new Error(`${label} did not fail with the required table privilege denial`)
  }
}

function insertHistoricalFixtures(database) {
  psql(
    database,
    `
      insert into auth.users (id) values
        ('${fixtureUsers.owner}'),
        ('${fixtureUsers.other}')
      on conflict (id) do nothing;

      insert into public.bank_transfer_submissions (
        id,
        user_id,
        item_type,
        item_id,
        item_name,
        amount_twd,
        payer_name,
        payer_phone,
        payer_email,
        bank_account_last5,
        transfer_time,
        note,
        status,
        created_at
      ) values
        (
          '20000000-0000-4000-8000-000000000001',
          '${fixtureUsers.owner}',
          'legacy_fixture',
          'legacy-1',
          'Historical fixture 1',
          100,
          'Fixture Owner',
          '0000000000',
          'fixture-owner@example.invalid',
          '00001',
          '2026-06-01 01:02:03+00',
          'synthetic fixture',
          'pending_review',
          '2026-06-01 01:02:03+00'
        ),
        (
          '20000000-0000-4000-8000-000000000002',
          '${fixtureUsers.owner}',
          'legacy_fixture',
          'legacy-2',
          'Historical fixture 2',
          200,
          'Fixture Owner',
          '0000000000',
          'fixture-owner@example.invalid',
          '00002',
          '2026-06-02 01:02:03+00',
          'synthetic fixture',
          'confirmed',
          '2026-06-02 01:02:03+00'
        ),
        (
          '20000000-0000-4000-8000-000000000003',
          '${fixtureUsers.other}',
          'legacy_fixture',
          'legacy-3',
          'Historical fixture 3',
          300,
          'Fixture Other',
          '0000000000',
          'fixture-other@example.invalid',
          '00003',
          '2026-06-03 01:02:03+00',
          'synthetic fixture',
          'rejected',
          '2026-06-03 01:02:03+00'
        );
    `,
    'insert synthetic historical fixtures',
  )
}

function grantProductionLikePrivileges(database) {
  psql(
    database,
    `
      grant select, insert, update, delete, truncate, references, trigger
      on table public.bank_transfer_submissions
      to public;

      grant truncate, references, trigger
      on table public.bank_transfer_submissions
      to anon, authenticated;

      grant all privileges
      on table public.bank_transfer_submissions
      to service_role;
    `,
    'production-like legacy privilege surface',
  )
}

function prepareLegacySchema(database, productionLikePrivileges) {
  psqlFile(
    database,
    join(root, 'supabase/tests/line_pay_local_postgres_bootstrap.sql'),
    'runtime role bootstrap',
  )
  psqlFile(
    database,
    join(root, 'supabase/bank_transfer_submissions_patch.sql'),
    'legacy bank transfer schema',
  )
  insertHistoricalFixtures(database)

  if (productionLikePrivileges) {
    grantProductionLikePrivileges(database)
  }
}

function prepareLinePayUpgradeSchema(database) {
  psqlFile(
    database,
    join(root, 'supabase/tests/line_pay_local_postgres_bootstrap.sql'),
    'runtime role bootstrap',
  )
  for (const file of linePayBaselineFiles) {
    psqlFile(database, join(root, file), file)
  }
  psqlFile(
    database,
    join(root, 'supabase/tests/line_pay_upgrade_fixture.sql'),
    'LINE Pay upgrade fixture',
  )
  insertHistoricalFixtures(database)
  grantProductionLikePrivileges(database)
}

function snapshotHistoricalRows(database) {
  return psql(
    database,
    `
      select
        id,
        status,
        amount_twd,
        extract(epoch from created_at)::numeric
      from public.bank_transfer_submissions
      order by id;
    `,
    'historical row snapshot',
  )
}

function assertExactPrivileges(database) {
  const output = psql(
    database,
    `
      select
        role_name,
        privilege_name,
        pg_catalog.has_table_privilege(
          role_name,
          'public.bank_transfer_submissions',
          privilege_name
        )
      from unnest(array['anon', 'authenticated', 'service_role'])
        as runtime_role(role_name)
      cross join unnest(array[
        'SELECT',
        'INSERT',
        'UPDATE',
        'DELETE',
        'TRUNCATE',
        'REFERENCES',
        'TRIGGER',
        'MAINTAIN'
      ]) as runtime_privilege(privilege_name)
      order by role_name, privilege_name;
    `,
    'exact runtime privilege query',
  )

  const actual = new Map(
    output.split('\n').filter(Boolean).map((line) => {
      const [role, privilege, value] = line.split('|')
      return [`${role}:${privilege}`, value === 't']
    }),
  )

  for (const role of ['anon', 'authenticated', 'service_role']) {
    for (const privilege of [
      'SELECT',
      'INSERT',
      'UPDATE',
      'DELETE',
      'TRUNCATE',
      'REFERENCES',
      'TRIGGER',
      'MAINTAIN',
    ]) {
      const expected = privilege === 'SELECT' && role !== 'anon'
      assert.equal(actual.get(`${role}:${privilege}`), expected, `${role}:${privilege}`)
    }
  }
}

function assertExactAclCatalog(database) {
  const output = psql(
    database,
    `
      select
        case
          when acl.grantee = 0 then 'PUBLIC'
          else coalesce(grantee.rolname, acl.grantee::text)
        end,
        acl.privilege_type,
        acl.is_grantable,
        acl.grantee = relation.relowner
      from pg_catalog.pg_class as relation
      join pg_catalog.pg_namespace as namespace
        on namespace.oid = relation.relnamespace
      cross join lateral pg_catalog.aclexplode(
        coalesce(
          relation.relacl,
          pg_catalog.acldefault('r', relation.relowner)
        )
      ) as acl
      left join pg_catalog.pg_roles as grantee
        on grantee.oid = acl.grantee
      where namespace.nspname = 'public'
        and relation.relname = 'bank_transfer_submissions'
        and acl.grantee <> relation.relowner
      order by 1, 2, 3, 4;
    `,
    'exact table ACL catalog query',
  )

  assert.equal(
    output,
    [
      'authenticated|SELECT|f|f',
      'service_role|SELECT|f|f',
    ].join('\n'),
  )
}

function assertExactPolicyAndRls(database) {
  const policy = psql(
    database,
    `
      select
        policy.polname,
        policy.polcmd,
        pg_catalog.array_to_string(
          array(
            select role.rolname
            from pg_catalog.unnest(policy.polroles) as policy_role(role_oid)
            join pg_catalog.pg_roles as role
              on role.oid = policy_role.role_oid
            order by role.rolname
          ),
          ','
        ),
        policy.polwithcheck is null,
        pg_catalog.pg_get_expr(policy.polqual, policy.polrelid, false)
      from pg_catalog.pg_policy as policy
      join pg_catalog.pg_class as relation
        on relation.oid = policy.polrelid
      join pg_catalog.pg_namespace as namespace
        on namespace.oid = relation.relnamespace
      where namespace.nspname = 'public'
        and relation.relname = 'bank_transfer_submissions'
      order by policy.polname;
    `,
    'exact policy catalog query',
  )

  assert.equal(
    policy,
    'Users can read own bank transfer submissions|r|authenticated|t|(( SELECT auth.uid() AS uid) = user_id)',
  )

  const catalog = psql(
    database,
    `
      select
        relation.relrowsecurity,
        relation.relowner = (select role.oid from pg_catalog.pg_roles as role where role.rolname = 'postgres'),
        pg_catalog.has_table_privilege('postgres', relation.oid, 'INSERT')
      from pg_catalog.pg_class as relation
      join pg_catalog.pg_namespace as namespace
        on namespace.oid = relation.relnamespace
      where namespace.nspname = 'public'
        and relation.relname = 'bank_transfer_submissions';
    `,
    'RLS and database owner boundary query',
  )

  assert.equal(catalog, 't|t|t')
}

function assertRoleBehavior(database) {
  const ownRows = psql(
    database,
    `
      set role authenticated;
      select pg_catalog.set_config('request.jwt.claim.sub', '${fixtureUsers.owner}', false);
      select count(*) from public.bank_transfer_submissions;
    `,
    'authenticated owner read',
  ).split('\n').at(-1)
  assert.equal(ownRows, '2')

  const otherRows = psql(
    database,
    `
      set role authenticated;
      select pg_catalog.set_config('request.jwt.claim.sub', '${fixtureUsers.owner}', false);
      select count(*)
      from public.bank_transfer_submissions
      where user_id = '${fixtureUsers.other}';
    `,
    'authenticated cross-user read isolation',
  ).split('\n').at(-1)
  assert.equal(otherRows, '0')

  const serviceRows = psql(
    database,
    `
      set role service_role;
      select count(*) from public.bank_transfer_submissions;
    `,
    'service role read-only history access',
  ).split('\n').at(-1)
  assert.equal(serviceRows, '3')

  const deniedStatements = [
    [
      'authenticated insert',
      `set role authenticated; insert into public.bank_transfer_submissions (
        user_id, item_type, item_name, amount_twd, payer_name, payer_phone, bank_account_last5
      ) values ('${fixtureUsers.owner}', 'denied', 'Denied', 1, 'Denied', '0', '99999');`,
    ],
    [
      'authenticated update',
      `set role authenticated; update public.bank_transfer_submissions set status = 'confirmed';`,
    ],
    [
      'authenticated delete',
      `set role authenticated; delete from public.bank_transfer_submissions;`,
    ],
    [
      'authenticated truncate',
      `set role authenticated; truncate table public.bank_transfer_submissions;`,
    ],
    ['anon select', 'set role anon; select count(*) from public.bank_transfer_submissions;'],
    [
      'anon insert',
      `set role anon; insert into public.bank_transfer_submissions (
        item_type, item_name, amount_twd, payer_name, payer_phone, bank_account_last5
      ) values ('denied', 'Denied', 1, 'Denied', '0', '99999');`,
    ],
    ['anon update', `set role anon; update public.bank_transfer_submissions set status = 'confirmed';`],
    ['anon delete', 'set role anon; delete from public.bank_transfer_submissions;'],
    ['anon truncate', 'set role anon; truncate table public.bank_transfer_submissions;'],
    [
      'service role insert',
      `set role service_role; insert into public.bank_transfer_submissions (
        item_type, item_name, amount_twd, payer_name, payer_phone, bank_account_last5
      ) values ('denied', 'Denied', 1, 'Denied', '0', '99999');`,
    ],
    [
      'service role update',
      `set role service_role; update public.bank_transfer_submissions set status = 'confirmed';`,
    ],
    ['service role delete', 'set role service_role; delete from public.bank_transfer_submissions;'],
    ['service role truncate', 'set role service_role; truncate table public.bank_transfer_submissions;'],
  ]

  for (const [label, sql] of deniedStatements) {
    psqlExpectDenied(database, sql, label)
  }
}

function assertNoCommerceWrites(database) {
  const relations = psql(
    database,
    `
      select
        pg_catalog.to_regclass('public.payment_attempts') is null,
        pg_catalog.to_regclass('public.payments') is null,
        pg_catalog.to_regclass('public.product_orders') is null;
    `,
    'unrelated payment and order relation guard',
  )

  assert.equal(relations, 't|t|t')
}

function applyAndAssert(database, productionLikePrivileges) {
  prepareLegacySchema(database, productionLikePrivileges)
  const before = snapshotHistoricalRows(database)

  psqlFile(database, migration, 'bank transfer read-only fence migration')

  const after = snapshotHistoricalRows(database)
  assert.equal(after, before)
  assertExactPrivileges(database)
  assertExactAclCatalog(database)
  assertExactPolicyAndRls(database)
  assertRoleBehavior(database)
  assertNoCommerceWrites(database)
}

function applyAfterLinePayAndAssert(database) {
  prepareLinePayUpgradeSchema(database)
  const before = snapshotHistoricalRows(database)

  psqlFile(database, linePayMigration, 'LINE Pay remediation migration')
  psqlFile(database, migration, 'bank transfer read-only fence migration')
  psqlFile(
    database,
    join(root, 'supabase/tests/line_pay_upgrade_assertions.sql'),
    'LINE Pay upgrade assertions after read-only fence',
  )

  const after = snapshotHistoricalRows(database)
  assert.equal(after, before)
  assertExactPrivileges(database)
  assertExactAclCatalog(database)
  assertExactPolicyAndRls(database)
  assertRoleBehavior(database)
}

function applyFenceBeforeLinePayAndAssert(database) {
  prepareLinePayUpgradeSchema(database)
  const before = snapshotHistoricalRows(database)

  psqlFile(database, migration, 'bank transfer read-only fence migration')
  assertExactPrivileges(database)
  assertExactAclCatalog(database)
  assertExactPolicyAndRls(database)

  psqlFile(database, linePayMigration, 'LINE Pay remediation migration after read-only fence')
  psqlFile(
    database,
    join(root, 'supabase/tests/line_pay_upgrade_assertions.sql'),
    'LINE Pay upgrade assertions after fence-first sequence',
  )

  const after = snapshotHistoricalRows(database)
  assert.equal(after, before)
  assertExactPrivileges(database)
  assertExactAclCatalog(database)
  assertExactPolicyAndRls(database)
  assertRoleBehavior(database)
}

function assertUnknownWriteAclFailsClosed(database) {
  prepareLegacySchema(database, true)
  const before = snapshotHistoricalRows(database)

  psql(
    database,
    `
      create role bank_transfer_legacy_writer nologin;
      grant insert on table public.bank_transfer_submissions
      to bank_transfer_legacy_writer;
    `,
    'unknown non-owner write ACL fixture',
  )

  psqlFileExpectFailure(
    database,
    migration,
    /bank_transfer_submissions_readonly_fence:catalog_acl_mismatch/i,
    'unknown non-owner write ACL postcondition',
  )

  const after = snapshotHistoricalRows(database)
  assert.equal(after, before)
  assert.equal(
    psql(
      database,
      `
        select
          pg_catalog.has_table_privilege(
            'bank_transfer_legacy_writer',
            'public.bank_transfer_submissions',
            'INSERT'
          ),
          (
            select pg_catalog.count(*)
            from pg_catalog.pg_policies
            where schemaname = 'public'
              and tablename = 'bank_transfer_submissions'
          );
      `,
      'unknown ACL transaction rollback evidence',
    ),
    't|2',
  )
}

async function main() {
  runDocker(['pull', image])

  const repositoryDigests = JSON.parse(
    runDocker(['image', 'inspect', '--format', '{{json .RepoDigests}}', image]),
  )
  assert.ok(repositoryDigests.includes(LINE_PAY_POSTGRES_IMAGE))

  const postgresVersion = runDocker([
    'run',
    '--rm',
    '--network',
    'none',
    image,
    'postgres',
    '--version',
  ])
  assert.match(postgresVersion, /^postgres \(PostgreSQL\) 17(?:\.|$)/)

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

  psql('postgres', 'create database bank_transfer_clean;', 'create clean database')
  psql('postgres', 'create database bank_transfer_upgrade;', 'create upgrade database')
  psql(
    'postgres',
    'create database bank_transfer_line_pay_upgrade;',
    'create LINE Pay-first sequence database',
  )
  psql(
    'postgres',
    'create database bank_transfer_fence_first;',
    'create fence-first sequence database',
  )
  psql(
    'postgres',
    'create database bank_transfer_unknown_acl;',
    'create unknown ACL fail-closed database',
  )

  applyAndAssert('bank_transfer_clean', false)
  applyAndAssert('bank_transfer_upgrade', true)
  applyAfterLinePayAndAssert('bank_transfer_line_pay_upgrade')
  applyFenceBeforeLinePayAndAssert('bank_transfer_fence_first')
  assertUnknownWriteAclFailsClosed('bank_transfer_unknown_acl')

  process.stdout.write(
    'bank_transfer_submissions_readonly_fence: PASS (PostgreSQL 17, clean, production-like upgrade, LINE Pay-first, fence-first, data preservation, exact ACLs, unknown-write fail-closed rollback, canonical policy, RLS, runtime denial)\n',
  )
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
