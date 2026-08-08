import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LINE_PAY_POSTGRES_IMAGE } from './line_pay_postgres_image.mjs'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const root = resolve(scriptDirectory, '../..')
const taskLabel = 'bank-transfer-db-readonly-fence-remediation-v1'
const containerName = `${taskLabel}-${randomBytes(6).toString('hex')}`
const networkName = `${containerName}-network`
const volumeName = `${containerName}-data`
const localPostgresPassword = randomBytes(32).toString('base64url')
const image = LINE_PAY_POSTGRES_IMAGE
const oldMigration = join(
  root,
  'supabase/migrations/20260722065311_retire_bank_transfer_submissions_writes.sql',
)
const migration = join(
  root,
  'supabase/migrations/20260723082100_bank_transfer_submissions_readonly_fence_remediation.sql',
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
const PROCESS_TIMEOUT_MS = 120_000
const DATABASE_COMMAND_TIMEOUT_MS = 45_000
const MAX_PROCESS_OUTPUT_BYTES = 8 * 1024 * 1024
const MAX_DIAGNOSTIC_OUTPUT_BYTES = 8 * 1024
const createdResources = {
  container: false,
  network: false,
  volume: false,
}

function boundedOutput(result) {
  return `${result.stdout ?? ''}\n${result.stderr ?? ''}`.slice(
    0,
    MAX_DIAGNOSTIC_OUTPUT_BYTES,
  )
}

function spawnDocker(args, options = {}) {
  const result = spawnSync('docker', args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: MAX_PROCESS_OUTPUT_BYTES,
    timeout: options.timeout ?? PROCESS_TIMEOUT_MS,
    ...(options.input === undefined ? {} : { input: options.input }),
  })

  if (result.error?.code === 'ENOENT') {
    throw new Error('LOCAL_DB_RUNTIME_UNAVAILABLE: docker command not found')
  }

  if (result.error?.code === 'ETIMEDOUT') {
    throw new Error(`LOCAL_DB_COMMAND_TIMEOUT: docker ${args[0]}`)
  }

  if (result.error?.code === 'ENOBUFS') {
    throw new Error(`LOCAL_DB_OUTPUT_LIMIT_EXCEEDED: docker ${args[0]}`)
  }

  if (result.error) {
    throw new Error(`LOCAL_DB_PROCESS_ERROR: docker ${args[0]}: ${result.error.code ?? 'unknown'}`)
  }

  if (result.signal) {
    throw new Error(`LOCAL_DB_PROCESS_SIGNAL: docker ${args[0]}: ${result.signal}`)
  }

  if (result.status === null) {
    throw new Error(`LOCAL_DB_PROCESS_NO_EXIT_CODE: docker ${args[0]}`)
  }

  return result
}

function spawnDockerAsync(args, options = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn('docker', args, {
      cwd: root,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    let settled = false
    const timeout = setTimeout(() => {
      if (settled) return
      settled = true
      child.kill('SIGTERM')
      rejectPromise(new Error(`LOCAL_DB_COMMAND_TIMEOUT: docker ${args[0]}`))
    }, options.timeout ?? PROCESS_TIMEOUT_MS)

    const appendBounded = (current, chunk) => {
      const next = current + chunk.toString('utf8')
      if (Buffer.byteLength(next) > MAX_PROCESS_OUTPUT_BYTES) {
        if (!settled) {
          settled = true
          clearTimeout(timeout)
          child.kill('SIGTERM')
          rejectPromise(new Error(`LOCAL_DB_OUTPUT_LIMIT_EXCEEDED: docker ${args[0]}`))
        }
        return current
      }
      return next
    }

    child.stdout.on('data', (chunk) => {
      stdout = appendBounded(stdout, chunk)
    })
    child.stderr.on('data', (chunk) => {
      stderr = appendBounded(stderr, chunk)
    })
    child.on('error', (error) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      rejectPromise(
        new Error(
          error.code === 'ENOENT'
            ? 'LOCAL_DB_RUNTIME_UNAVAILABLE: docker command not found'
            : `LOCAL_DB_PROCESS_ERROR: docker ${args[0]}: ${error.code ?? 'unknown'}`,
        ),
      )
    })
    child.on('close', (status, signal) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      if (signal) {
        rejectPromise(new Error(`LOCAL_DB_PROCESS_SIGNAL: docker ${args[0]}: ${signal}`))
        return
      }
      if (status === null) {
        rejectPromise(new Error(`LOCAL_DB_PROCESS_NO_EXIT_CODE: docker ${args[0]}`))
        return
      }
      resolvePromise({ status, signal: null, stdout, stderr })
    })

    child.stdin.end(options.input ?? '')
  })
}

function runDocker(args) {
  const result = spawnDocker(args)

  if (result.status !== 0) {
    throw new Error(
      `LOCAL_DB_COMMAND_FAILED: docker ${args[0]} exited ${result.status}\n${boundedOutput(result)}`,
    )
  }

  return result.stdout.trim()
}

function psqlResult(database, sql, timeout = DATABASE_COMMAND_TIMEOUT_MS) {
  return spawnDocker(
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
      input: sql,
      timeout,
    },
  )
}

function psqlResultAsync(database, sql, timeout = DATABASE_COMMAND_TIMEOUT_MS) {
  return spawnDockerAsync(
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
    { input: sql, timeout },
  )
}

function psql(database, sql, label, timeout = DATABASE_COMMAND_TIMEOUT_MS) {
  const result = psqlResult(database, sql, timeout)

  if (result.status !== 0) {
    throw new Error(`${label} failed\n${boundedOutput(result)}`)
  }

  return result.stdout.trim()
}

function psqlFile(database, path, label = path) {
  psql(database, readFileSync(path, 'utf8'), label)
}

function psqlFileExpectFailure(database, path, expectedPattern, label) {
  const result = psqlResult(database, readFileSync(path, 'utf8'))
  const combinedOutput = `${result.stdout}\n${result.stderr}`

  if (result.status === 0 || !expectedPattern.test(combinedOutput)) {
    throw new Error(`${label} did not fail closed with the required catalog ACL mismatch`)
  }
}

function psqlExpectDenied(database, sql, label) {
  const result = psqlResult(database, sql)
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
          null,
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

function snapshotHistoricalState(database) {
  const rows = psql(
    database,
    `
      select pg_catalog.row_to_json(submission)::text
      from public.bank_transfer_submissions as submission
      order by submission.id;
    `,
    'complete historical row values snapshot',
  )
  const columns = psql(
    database,
    `
      select pg_catalog.json_agg(column_contract order by column_contract.attnum)::text
      from (
        select
          attribute.attnum,
          attribute.attname,
          pg_catalog.format_type(attribute.atttypid, attribute.atttypmod) as data_type,
          attribute.attnotnull,
          attribute.attidentity,
          attribute.attgenerated,
          pg_catalog.pg_get_expr(default_value.adbin, default_value.adrelid) as default_expression
        from pg_catalog.pg_attribute as attribute
        left join pg_catalog.pg_attrdef as default_value
          on default_value.adrelid = attribute.attrelid
          and default_value.adnum = attribute.attnum
        where attribute.attrelid = 'public.bank_transfer_submissions'::pg_catalog.regclass
          and attribute.attnum > 0
          and not attribute.attisdropped
      ) as column_contract;
    `,
    'complete column contract snapshot',
  )
  const primaryKey = psql(
    database,
    `
      select
        constraint_row.conname,
        pg_catalog.pg_get_constraintdef(constraint_row.oid, true)
      from pg_catalog.pg_constraint as constraint_row
      where constraint_row.conrelid = 'public.bank_transfer_submissions'::pg_catalog.regclass
        and constraint_row.contype = 'p';
    `,
    'primary key contract snapshot',
  )

  return { rows, columns, primaryKey }
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
        acl.grantee = relation.relowner,
        coalesce(grantor.rolname, acl.grantor::text),
        acl.grantor = relation.relowner
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
      left join pg_catalog.pg_roles as grantor
        on grantor.oid = acl.grantor
      where namespace.nspname = 'public'
        and relation.relname = 'bank_transfer_submissions'
        and acl.grantee <> relation.relowner
      order by 1, 2, 3, 4, 5, 6;
    `,
    'exact table ACL catalog query',
  )

  assert.equal(
    output,
    [
      'authenticated|SELECT|f|f|postgres|t',
      'service_role|SELECT|f|f|postgres|t',
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
  const before = snapshotHistoricalState(database)

  psqlFile(database, migration, 'bank transfer read-only fence remediation migration')

  const after = snapshotHistoricalState(database)
  assert.deepEqual(after, before)
  assertExactPrivileges(database)
  assertExactAclCatalog(database)
  assertExactPolicyAndRls(database)
  assertRoleBehavior(database)
  assertNoCommerceWrites(database)
}

function applyOldFenceThenRemediation(database) {
  prepareLegacySchema(database, true)
  const before = snapshotHistoricalState(database)

  psqlFile(database, oldMigration, 'merged bank transfer read-only fence migration')
  psqlFile(database, migration, 'bank transfer read-only fence remediation migration')

  assert.deepEqual(snapshotHistoricalState(database), before)
  assertExactPrivileges(database)
  assertExactAclCatalog(database)
  assertExactPolicyAndRls(database)
  assertRoleBehavior(database)
  assertNoCommerceWrites(database)
}

function applyAfterLinePayAndAssert(database) {
  prepareLinePayUpgradeSchema(database)
  const before = snapshotHistoricalState(database)

  psqlFile(database, linePayMigration, 'LINE Pay remediation migration')
  psqlFile(database, migration, 'bank transfer read-only fence remediation migration')
  psqlFile(
    database,
    join(root, 'supabase/tests/line_pay_upgrade_assertions.sql'),
    'LINE Pay upgrade assertions after read-only fence',
  )

  const after = snapshotHistoricalState(database)
  assert.deepEqual(after, before)
  assertExactPrivileges(database)
  assertExactAclCatalog(database)
  assertExactPolicyAndRls(database)
  assertRoleBehavior(database)
}

function applyFenceBeforeLinePayAndAssert(database) {
  prepareLinePayUpgradeSchema(database)
  const before = snapshotHistoricalState(database)

  psqlFile(database, migration, 'bank transfer read-only fence remediation migration')
  assertExactPrivileges(database)
  assertExactAclCatalog(database)
  assertExactPolicyAndRls(database)

  psqlFile(database, linePayMigration, 'LINE Pay remediation migration after read-only fence')
  psqlFile(database, migration, 'bank transfer read-only fence remediation after LINE Pay')
  psqlFile(
    database,
    join(root, 'supabase/tests/line_pay_upgrade_assertions.sql'),
    'LINE Pay upgrade assertions after fence-first sequence',
  )

  const after = snapshotHistoricalState(database)
  assert.deepEqual(after, before)
  assertExactPrivileges(database)
  assertExactAclCatalog(database)
  assertExactPolicyAndRls(database)
  assertRoleBehavior(database)
}

function applyOldFenceLinePayRemediation(database) {
  prepareLinePayUpgradeSchema(database)
  const before = snapshotHistoricalState(database)

  psqlFile(database, oldMigration, 'merged bank transfer read-only fence migration')
  psqlFile(database, linePayMigration, 'LINE Pay remediation after merged fence')
  psqlFile(database, migration, 'bank transfer read-only fence remediation after LINE Pay')
  psqlFile(
    database,
    join(root, 'supabase/tests/line_pay_upgrade_assertions.sql'),
    'LINE Pay upgrade assertions after old-fence remediation sequence',
  )

  assert.deepEqual(snapshotHistoricalState(database), before)
  assertExactPrivileges(database)
  assertExactAclCatalog(database)
  assertExactPolicyAndRls(database)
  assertRoleBehavior(database)
}

function assertUnknownWriteAclFailsClosed(database) {
  prepareLegacySchema(database, true)
  const before = snapshotHistoricalState(database)

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

  const after = snapshotHistoricalState(database)
  assert.deepEqual(after, before)
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

const unknownAclFixtureMutations = [
  {
    name: 'unknown role SELECT',
    database: 'bt_acl_unknown_select',
    role: 'bank_transfer_unknown_select',
    privilege: 'SELECT',
    grantOption: false,
  },
  {
    name: 'unknown role SELECT WITH GRANT OPTION',
    database: 'bt_acl_unknown_select_grant',
    role: 'bank_transfer_unknown_select_grant',
    privilege: 'SELECT',
    grantOption: true,
  },
  {
    name: 'unknown role REFERENCES',
    database: 'bt_acl_unknown_references',
    role: 'bank_transfer_unknown_references',
    privilege: 'REFERENCES',
    grantOption: false,
  },
  {
    name: 'unknown role TRIGGER',
    database: 'bt_acl_unknown_trigger',
    role: 'bank_transfer_unknown_trigger',
    privilege: 'TRIGGER',
    grantOption: false,
  },
  {
    name: 'unknown role MAINTAIN',
    database: 'bt_acl_unknown_maintain',
    role: 'bank_transfer_unknown_maintain',
    privilege: 'MAINTAIN',
    grantOption: false,
  },
  {
    name: 'unknown role existing UPDATE privilege',
    database: 'bt_acl_unknown_update',
    role: 'bank_transfer_unknown_update',
    privilege: 'UPDATE',
    grantOption: false,
  },
]

function unknownAclEntryCount(database, mutation) {
  return psql(
    database,
    `
      select pg_catalog.count(*)
      from pg_catalog.pg_class as relation
      cross join lateral pg_catalog.aclexplode(
        coalesce(
          relation.relacl,
          pg_catalog.acldefault('r', relation.relowner)
        )
      ) as acl
      join pg_catalog.pg_roles as grantee
        on grantee.oid = acl.grantee
      where relation.oid = 'public.bank_transfer_submissions'::pg_catalog.regclass
        and grantee.rolname = '${mutation.role}'
        and acl.privilege_type = '${mutation.privilege}'
        and acl.is_grantable = ${mutation.grantOption};
    `,
    `${mutation.name} ACL catalog oracle`,
  )
}

function runUnknownAclFixtureMutationMatrix() {
  let caught = 0
  let uncaught = 0
  let infrastructureFailures = 0

  for (const mutation of unknownAclFixtureMutations) {
    createDatabase(mutation.database)
    prepareLegacySchema(mutation.database, true)
    const before = snapshotHistoricalState(mutation.database)
    const relationOid = psql(
      mutation.database,
      `select 'public.bank_transfer_submissions'::pg_catalog.regclass::oid;`,
      `${mutation.name} fixed relation OID`,
    )

    try {
      psql(
        mutation.database,
        `
          create role ${mutation.role} nologin;
          grant ${mutation.privilege}
          on table public.bank_transfer_submissions
          to ${mutation.role}${mutation.grantOption ? ' with grant option' : ''};
        `,
        `${mutation.name} fixture grant`,
      )
      assert.equal(unknownAclEntryCount(mutation.database, mutation), '1')

      const result = psqlResult(mutation.database, readFileSync(migration, 'utf8'))
      const output = boundedOutput(result)

      if (/syntax error/i.test(output)) {
        process.stderr.write(`ACL_MUTATION_INFRASTRUCTURE=${mutation.name}:syntax\n${output}\n`)
        infrastructureFailures += 1
        continue
      }

      if (result.status === 0) {
        uncaught += 1
        continue
      }

      if (/bank_transfer_submissions_readonly_fence:catalog_acl_mismatch/i.test(output)) {
        assert.deepEqual(snapshotHistoricalState(mutation.database), before)
        assert.equal(unknownAclEntryCount(mutation.database, mutation), '1')
        assert.equal(
          psql(
            mutation.database,
            `
              select pg_catalog.count(*)
              from pg_catalog.pg_policy
              where polrelid = 'public.bank_transfer_submissions'::pg_catalog.regclass;
            `,
            `${mutation.name} rollback policy oracle`,
          ),
          '2',
        )
        assert.equal(
          psql(
            mutation.database,
            `select 'public.bank_transfer_submissions'::pg_catalog.regclass::oid;`,
            `${mutation.name} relation OID revalidation`,
          ),
          relationOid,
        )
        caught += 1
        continue
      }

      process.stderr.write(`ACL_MUTATION_INFRASTRUCTURE=${mutation.name}:unexpected failure\n${output}\n`)
      infrastructureFailures += 1
    } catch (error) {
      if (/LOCAL_DB_(?:COMMAND_TIMEOUT|OUTPUT_LIMIT_EXCEEDED|PROCESS_)/.test(String(error))) {
        process.stderr.write(`ACL_MUTATION_INFRASTRUCTURE=${mutation.name}:${String(error)}\n`)
        infrastructureFailures += 1
      } else {
        throw new Error(`${mutation.name} harness failure: ${String(error)}`)
      }
    }
  }

  const mutationTotal = unknownAclFixtureMutations.length
  process.stdout.write(`ACL_MUTATION_TOTAL=${mutationTotal}\n`)
  process.stdout.write(`ACL_MUTATION_CAUGHT=${caught}\n`)
  process.stdout.write(`ACL_MUTATION_UNCAUGHT=${uncaught}\n`)
  process.stdout.write(`ACL_MUTATION_INFRASTRUCTURE_FAILURES=${infrastructureFailures}\n`)
  assert.equal(caught, mutationTotal)
  assert.equal(uncaught, 0)
  assert.equal(infrastructureFailures, 0)
  return { mutationTotal, caught, uncaught, infrastructureFailures }
}

function createDatabase(database) {
  psql('postgres', `create database ${database};`, `create ${database} database`)
}

function replaceExactly(source, search, replacement, label) {
  const occurrences = source.split(search).length - 1
  assert.equal(occurrences, 1, `${label} mutation seam must occur exactly once`)
  const mutated = source.replace(search, () => replacement)
  assert.notEqual(mutated, source, `${label} mutation must change the executed SQL`)
  return mutated
}

function replaceAllOccurrences(source, search, replacement, label) {
  const occurrences = source.split(search).length - 1
  assert.ok(occurrences > 0, `${label} mutation seam must occur`)
  const mutated = source.split(search).join(replacement)
  assert.notEqual(mutated, source, `${label} mutation must change the executed SQL`)
  return mutated
}

function injectBeforePostcondition(source, sql, label) {
  const marker = 'do $$\ndeclare\n  v_authenticated_oid oid;'
  return replaceExactly(source, marker, `${sql}\n\n${marker}`, label)
}

function injectAfterCanonicalGrant(source, sql, label) {
  const marker = 'to authenticated, service_role;\n\ncomment on table'
  return replaceExactly(
    source,
    marker,
    `to authenticated, service_role;\n\n${sql}\n\ncomment on table`,
    label,
  )
}

function waitForAccessExclusiveLock(database, expected, label) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const count = psql(
      database,
      `
        select count(*)
        from pg_catalog.pg_locks
        where relation = 'public.bank_transfer_submissions'::pg_catalog.regclass
          and mode = 'AccessExclusiveLock'
          and granted;
      `,
      `${label} lock poll`,
      5_000,
    )
    if ((Number(count) > 0) === expected) return
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100)
  }
  throw new Error(`${label}: lock state did not become ${expected ? 'held' : 'released'}`)
}

function holdAccessExclusiveLock(database, seconds) {
  runDocker([
    'exec',
    '--detach',
    containerName,
    'psql',
    '-X',
    '-v',
    'ON_ERROR_STOP=1',
    '-U',
    'postgres',
    '-d',
    database,
    '-c',
    `begin; lock table public.bank_transfer_submissions in access exclusive mode; select pg_catalog.pg_sleep(${seconds}); commit;`,
  ])
  waitForAccessExclusiveLock(database, true, 'access-exclusive fixture')
}

function assertLockTimeoutFailureResult(result) {
  assert.notEqual(result.status, 0, 'lock-timeout migration must fail')
  assert.match(boundedOutput(result), /canceling statement due to lock timeout/i)
}

function assertLockTimeoutRollback(database) {
  prepareLegacySchema(database, true)
  const before = snapshotHistoricalState(database)
  const beforeBoundary = psql(
    database,
    `
      select
        pg_catalog.has_table_privilege('authenticated', 'public.bank_transfer_submissions', 'INSERT'),
        (
          select count(*)
          from pg_catalog.pg_policy as policy
          where policy.polrelid = 'public.bank_transfer_submissions'::pg_catalog.regclass
        );
    `,
    'lock-timeout precondition',
  )

  holdAccessExclusiveLock(database, 12)
  const result = psqlResult(database, readFileSync(migration, 'utf8'), 18_000)
  assertLockTimeoutFailureResult(result)
  waitForAccessExclusiveLock(database, false, 'access-exclusive fixture')

  assert.deepEqual(snapshotHistoricalState(database), before)
  assert.equal(
    psql(
      database,
      `
        select
          pg_catalog.has_table_privilege('authenticated', 'public.bank_transfer_submissions', 'INSERT'),
          (
            select count(*)
            from pg_catalog.pg_policy as policy
            where policy.polrelid = 'public.bank_transfer_submissions'::pg_catalog.regclass
          );
      `,
      'lock-timeout rollback postcondition',
    ),
    beforeBoundary,
  )
}

function assertSecondRunBehavior(database) {
  prepareLegacySchema(database, true)
  const before = snapshotHistoricalState(database)
  psqlFile(database, migration, 'first read-only fence run')
  psqlFile(database, migration, 'second read-only fence run')
  assert.deepEqual(snapshotHistoricalState(database), before)
  assertExactPrivileges(database)
  assertExactAclCatalog(database)
  assertExactPolicyAndRls(database)
  assertRoleBehavior(database)
}

function prepareRelationIdentityMismatch(database) {
  psqlFile(
    database,
    join(root, 'supabase/tests/line_pay_local_postgres_bootstrap.sql'),
    'runtime role bootstrap for relation identity mismatch',
  )
  psql(
    database,
    `
      create table public.bank_transfer_submissions (
        id uuid not null,
        user_id uuid
      ) partition by hash (id);
    `,
    'partitioned relation identity mismatch fixture',
  )
}

function assertRelationIdentityMismatch(database) {
  prepareRelationIdentityMismatch(database)
  const result = psqlResult(database, readFileSync(migration, 'utf8'))
  assert.notEqual(result.status, 0)
  assert.match(boundedOutput(result), /bank_transfer_submissions_readonly_fence:unexpected_relation_kind/i)
  assert.equal(
    psql(
      database,
      `
        select relation.relkind, relation.relrowsecurity,
          (
            select count(*)
            from pg_catalog.pg_policy as policy
            where policy.polrelid = relation.oid
          )
        from pg_catalog.pg_class as relation
        where relation.oid = 'public.bank_transfer_submissions'::pg_catalog.regclass;
      `,
      'relation identity mismatch rollback',
    ),
    'p|f|0',
  )
}

function assertRelationMissing(database) {
  psqlFile(
    database,
    join(root, 'supabase/tests/line_pay_local_postgres_bootstrap.sql'),
    'runtime role bootstrap for missing relation',
  )
  const result = psqlResult(database, readFileSync(migration, 'utf8'))
  assert.notEqual(result.status, 0)
  assert.match(boundedOutput(result), /bank_transfer_submissions_readonly_fence:relation_missing/i)
  assert.equal(
    psql(
      database,
      `select pg_catalog.to_regclass('public.bank_transfer_submissions') is null;`,
      'missing relation rollback',
    ),
    't',
  )
}

function waitForAdvisoryLockWaiter(database) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const state = psql(
      database,
      `
        select
          count(*) filter (where granted),
          count(*) filter (where not granted)
        from pg_catalog.pg_locks
        where locktype = 'advisory';
      `,
      'relation replacement advisory lock poll',
      5_000,
    )
    if (state === '1|1') return
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100)
  }
  throw new Error('relation replacement advisory lock did not expose one holder and one waiter')
}

async function assertConcurrentRelationReplacement(database) {
  prepareLegacySchema(database, true)
  const originalOid = psql(
    database,
    `select 'public.bank_transfer_submissions'::pg_catalog.regclass::oid;`,
    'original relation OID',
  )
  const source = readFileSync(migration, 'utf8')
  const instrumented = replaceExactly(
    source,
    'lock table public.bank_transfer_submissions in access exclusive mode;',
    `set local lock_timeout = '15s';
select pg_catalog.pg_advisory_lock(72422065311);
set local lock_timeout = '5s';

lock table public.bank_transfer_submissions in access exclusive mode;`,
    'deterministic relation replacement pause',
  )

  runDocker([
    'exec',
    '--detach',
    containerName,
    'psql',
    '-X',
    '-v',
    'ON_ERROR_STOP=1',
    '-U',
    'postgres',
    '-d',
    database,
    '-c',
    'select pg_catalog.pg_advisory_lock(72422065311); select pg_catalog.pg_sleep(8);',
  ])
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const granted = psql(
      database,
      `select count(*) from pg_catalog.pg_locks
       where locktype = 'advisory' and granted;`,
      'relation replacement advisory holder poll',
      5_000,
    )
    if (granted === '1') break
    if (attempt === 79) throw new Error('relation replacement advisory holder was not acquired')
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100)
  }

  const migrationPromise = psqlResultAsync(database, instrumented, 20_000)
  waitForAdvisoryLockWaiter(database)
  psql(
    database,
    `
      alter table public.bank_transfer_submissions
      rename to bank_transfer_submissions_original;
      create table public.bank_transfer_submissions
      (like public.bank_transfer_submissions_original including all);
    `,
    'concurrent relation replacement fixture',
  )

  const result = await migrationPromise
  assert.notEqual(result.status, 0)
  assert.match(boundedOutput(result), /bank_transfer_submissions_readonly_fence:relation_identity_changed/i)
  assert.notEqual(
    psql(
      database,
      `select 'public.bank_transfer_submissions'::pg_catalog.regclass::oid;`,
      'replacement relation OID',
    ),
    originalOid,
  )
  assert.equal(
    psql(
      database,
      `
        select
          replacement.relkind,
          replacement.relrowsecurity,
          (
            select count(*)
            from pg_catalog.pg_policy as policy
            where policy.polrelid = replacement.oid
          )
        from pg_catalog.pg_class as replacement
        where replacement.oid = 'public.bank_transfer_submissions'::pg_catalog.regclass;
      `,
      'replacement relation untouched oracle',
    ),
    'r|f|0',
  )
}

async function assertLockRemovalMutation(database) {
  prepareLegacySchema(database, true)
  const source = readFileSync(migration, 'utf8')
  const mutated = replaceExactly(
    replaceExactly(
      replaceExactly(
        source,
        'lock table public.bank_transfer_submissions in access exclusive mode;',
        `set local lock_timeout = '15s';
select pg_catalog.pg_advisory_lock(72423082100);
set local lock_timeout = '5s';`,
        'relation lock removal',
      ),
      'if v_relation_oid is distinct from v_expected_relation_oid then',
      'if false then',
      'post-lock identity guard removal',
    ),
    `if pg_catalog.to_regclass('public.bank_transfer_submissions')
    is distinct from v_relation_oid then`,
    'if false then',
    'final identity guard removal',
  )

  runDocker([
    'exec',
    '--detach',
    containerName,
    'psql',
    '-X',
    '-v',
    'ON_ERROR_STOP=1',
    '-U',
    'postgres',
    '-d',
    database,
    '-c',
    'select pg_catalog.pg_advisory_lock(72423082100); select pg_catalog.pg_sleep(8);',
  ])
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const granted = psql(
      database,
      `select count(*) from pg_catalog.pg_locks
       where locktype = 'advisory' and granted;`,
      'lock-removal mutation advisory holder poll',
      5_000,
    )
    if (granted === '1') break
    if (attempt === 79) throw new Error('lock-removal mutation advisory holder was not acquired')
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100)
  }

  const migrationPromise = psqlResultAsync(database, mutated, 20_000)
  waitForAdvisoryLockWaiter(database)
  psql(
    database,
    `
      alter table public.bank_transfer_submissions
      rename to bank_transfer_submissions_original;
      create table public.bank_transfer_submissions
      (like public.bank_transfer_submissions_original including all);
    `,
    'lock-removal concurrent replacement fixture',
  )

  const result = await migrationPromise
  assert.notEqual(result.status, 0)
  assert.match(
    boundedOutput(result),
    /bank_transfer_submissions_readonly_fence:catalog_select_acl_mismatch/i,
  )
  assert.equal(
    psql(
      database,
      `
        select replacement.relrowsecurity,
          (
            select count(*)
            from pg_catalog.pg_policy as policy
            where policy.polrelid = replacement.oid
          )
        from pg_catalog.pg_class as replacement
        where replacement.oid = 'public.bank_transfer_submissions'::pg_catalog.regclass;
      `,
      'lock-removal replacement rollback oracle',
    ),
    'f|0',
  )
  process.stdout.write('CONCURRENT_LOCK_REMOVAL_MUTATION_CAUGHT=1\n')
}

function mutationDefinitions(source) {
  const revoke = 'from public, anon, authenticated, service_role;'
  const canonicalGrant =
    'grant select on table public.bank_transfer_submissions\nto authenticated, service_role;'
  const policyUsing = 'using ((select auth.uid()) = user_id);'
  const mutationInsert = (sql, label) => injectBeforePostcondition(source, sql, label)
  const mutationGrant = (sql, label) => injectAfterCanonicalGrant(source, sql, label)

  return [
    {
      name: 'relation OID binding removed',
      sql: replaceExactly(
        source,
        `  perform pg_catalog.set_config(
    'bank_transfer_submissions_readonly_fence.relation_oid',
    v_relation_oid::text,
    true
  );`,
        '  perform v_relation_oid;',
        'relation OID binding',
      ),
    },
    {
      name: 'post-lock OID revalidation removed',
      sql: replaceExactly(
        source,
        'if v_relation_oid is distinct from v_expected_relation_oid then',
        'if false then',
        'post-lock OID revalidation',
      ),
      sourceGuard: /if v_relation_oid is distinct from v_expected_relation_oid then/,
    },
    {
      name: 'relation lock removed',
      sql: replaceExactly(
        source,
        'lock table public.bank_transfer_submissions in access exclusive mode;',
        'select 1;',
        'relation lock',
      ),
      sourceGuard: /lock table public\.bank_transfer_submissions in access exclusive mode;/i,
    },
    {
      name: 'relation kind guard removed',
      setup: 'relation-mismatch',
      sql: replaceExactly(
        source,
        `if v_relation_kind is distinct from 'r' then`,
        'if false then',
        'relation kind guard',
      ),
    },
    {
      name: 'wrong schema',
      sql: replaceAllOccurrences(
        source,
        'public.bank_transfer_submissions',
        'private.bank_transfer_submissions',
        'wrong schema',
      ),
    },
    {
      name: 'wrong relation name',
      sql: replaceAllOccurrences(
        source,
        'public.bank_transfer_submissions',
        'public.bank_transfer_submissions_mutated',
        'wrong relation name',
      ),
    },
    {
      name: 'statement timeout removed',
      sql: replaceExactly(
        source,
        "set local statement_timeout = '30s';\n",
        '',
        'statement timeout',
      ),
      sourceGuard: /set local statement_timeout = '30s';/i,
    },
    {
      name: 'remove PUBLIC revoke',
      sql: replaceExactly(source, revoke, 'from anon, authenticated, service_role;', 'PUBLIC revoke'),
    },
    {
      name: 'remove anon revoke',
      sql: replaceExactly(source, revoke, 'from public, authenticated, service_role;', 'anon revoke'),
    },
    {
      name: 'remove authenticated revoke',
      sql: replaceExactly(source, revoke, 'from public, anon, service_role;', 'authenticated revoke'),
    },
    {
      name: 'remove service_role revoke',
      sql: replaceExactly(source, revoke, 'from public, anon, authenticated;', 'service role revoke'),
    },
    {
      name: 'extra INSERT privilege',
      sql: mutationGrant(
        'grant insert on table public.bank_transfer_submissions to authenticated;',
        'extra INSERT privilege',
      ),
    },
    {
      name: 'extra UPDATE privilege',
      sql: mutationGrant(
        'grant update on table public.bank_transfer_submissions to authenticated;',
        'extra UPDATE privilege',
      ),
    },
    {
      name: 'extra DELETE privilege',
      sql: mutationGrant(
        'grant delete on table public.bank_transfer_submissions to service_role;',
        'extra DELETE privilege',
      ),
    },
    {
      name: 'extra TRUNCATE privilege',
      sql: mutationGrant(
        'grant truncate on table public.bank_transfer_submissions to service_role;',
        'extra TRUNCATE privilege',
      ),
    },
    {
      name: 'extra REFERENCES privilege',
      sql: mutationGrant(
        'grant references on table public.bank_transfer_submissions to authenticated;',
        'extra REFERENCES privilege',
      ),
    },
    {
      name: 'extra TRIGGER privilege',
      sql: mutationGrant(
        'grant trigger on table public.bank_transfer_submissions to service_role;',
        'extra TRIGGER privilege',
      ),
    },
    {
      name: 'SELECT grant option',
      sql: replaceExactly(
        source,
        canonicalGrant,
        `${canonicalGrant.slice(0, -1)} with grant option;`,
        'grant option',
      ),
    },
    {
      name: 'authenticated SELECT WITH GRANT OPTION',
      sql: replaceExactly(
        source,
        canonicalGrant,
        `grant select on table public.bank_transfer_submissions
to authenticated with grant option;
grant select on table public.bank_transfer_submissions
to service_role;`,
        'authenticated SELECT grant option',
      ),
    },
    {
      name: 'service_role SELECT WITH GRANT OPTION',
      sql: replaceExactly(
        source,
        canonicalGrant,
        `grant select on table public.bank_transfer_submissions
to authenticated;
grant select on table public.bank_transfer_submissions
to service_role with grant option;`,
        'service_role SELECT grant option',
      ),
    },
    {
      name: 'authenticated missing SELECT',
      sql: replaceExactly(
        source,
        canonicalGrant,
        'grant select on table public.bank_transfer_submissions\nto service_role;',
        'authenticated SELECT',
      ),
    },
    {
      name: 'service_role missing SELECT',
      sql: replaceExactly(
        source,
        canonicalGrant,
        'grant select on table public.bank_transfer_submissions\nto authenticated;',
        'service role SELECT',
      ),
    },
    {
      name: 'anon gains SELECT',
      sql: mutationGrant(
        'grant select on table public.bank_transfer_submissions to anon;',
        'anon SELECT',
      ),
    },
    {
      name: 'PUBLIC gains SELECT',
      sql: mutationGrant(
        'grant select on table public.bank_transfer_submissions to public;',
        'PUBLIC SELECT',
      ),
    },
    {
      name: 'wrong SELECT grantor',
      sql: mutationGrant(
        `create role bank_transfer_mutated_grantor nologin;
grant select on table public.bank_transfer_submissions
to bank_transfer_mutated_grantor with grant option;
set role bank_transfer_mutated_grantor;
grant select on table public.bank_transfer_submissions to authenticated;
reset role;`,
        'wrong SELECT grantor',
      ),
    },
    {
      name: 'policy command ALL',
      sql: replaceExactly(source, 'for select\nto authenticated', 'for all\nto authenticated', 'policy ALL'),
    },
    {
      name: 'policy role wrong',
      sql: replaceExactly(source, 'to authenticated\nusing', 'to anon\nusing', 'policy role'),
    },
    {
      name: 'policy USING widened',
      sql: replaceExactly(source, policyUsing, 'using (true);', 'policy USING widened'),
    },
    {
      name: 'policy USING wrong column',
      sql: replaceExactly(
        source,
        policyUsing,
        'using ((select auth.uid()) = id);',
        'policy USING wrong column',
      ),
    },
    {
      name: 'policy WITH CHECK non-null',
      sql: replaceExactly(
        source,
        `for select\nto authenticated\n${policyUsing}`,
        `for all\nto authenticated\nusing ((select auth.uid()) = user_id)\nwith check ((select auth.uid()) = user_id);`,
        'policy WITH CHECK',
      ),
    },
    {
      name: 'INSERT policy remains',
      sql: mutationInsert(
        `create policy "Mutated insert policy"
on public.bank_transfer_submissions for insert to authenticated
with check ((select auth.uid()) = user_id);`,
        'INSERT policy',
      ),
    },
    {
      name: 'extra SELECT policy',
      sql: mutationInsert(
        `create policy "Mutated extra read policy"
on public.bank_transfer_submissions for select to service_role
using (true);`,
        'extra policy',
      ),
    },
    {
      name: 'RLS disabled',
      sql: mutationInsert(
        'alter table public.bank_transfer_submissions disable row level security;',
        'RLS disabled',
      ),
    },
    {
      name: 'historical row deleted',
      sql: mutationInsert(
        `delete from public.bank_transfer_submissions
where id = '20000000-0000-4000-8000-000000000001';`,
        'historical delete',
      ),
    },
    {
      name: 'historical row updated',
      sql: mutationInsert(
        `update public.bank_transfer_submissions
set note = 'mutated'
where id = '20000000-0000-4000-8000-000000000001';`,
        'historical update',
      ),
    },
    {
      name: 'historical table truncated',
      sql: mutationInsert(
        'truncate table public.bank_transfer_submissions;',
        'historical truncate',
      ),
    },
    {
      name: 'historical table dropped',
      sql: mutationInsert(
        'drop table public.bank_transfer_submissions;',
        'historical drop table',
      ),
    },
    {
      name: 'primary key changed',
      sql: mutationInsert(
        'alter table public.bank_transfer_submissions drop constraint bank_transfer_submissions_pkey;',
        'primary key change',
      ),
    },
    {
      name: 'column metadata changed',
      sql: mutationInsert(
        'alter table public.bank_transfer_submissions add column mutated_marker text;',
        'column metadata change',
      ),
    },
    {
      name: 'relation identity guard removed',
      setup: 'relation-mismatch',
      sql: replaceExactly(
        replaceExactly(
          replaceExactly(
            source,
            'if v_relation_oid is distinct from v_expected_relation_oid then',
            'if false then',
            'post-lock identity guard',
          ),
          `if pg_catalog.to_regclass('public.bank_transfer_submissions')
    is distinct from v_relation_oid then`,
          'if false then',
          'final identity guard',
        ),
        `if v_relation_kind is distinct from 'r' then`,
        'if false then',
        'relation kind guard',
      ).replace("      and relation.relkind = 'r'\n", ''),
    },
    {
      name: 'owner exclusion broadened to non-owner role',
      setup: 'unknown-acl',
      sql: replaceExactly(
        source,
        'acl.grantee <> relation.relowner\n          and acl.grantee <> 0',
        'acl.grantee = relation.relowner\n          and acl.grantee <> 0',
        'owner exclusion',
      ),
    },
    {
      name: 'unknown role ACL ignored',
      setup: 'unknown-acl',
      sql: replaceExactly(
        source,
        `and coalesce(grantee.rolname, '') not in (
            'anon',
            'authenticated',
            'service_role'
          )`,
        `and false
          and coalesce(grantee.rolname, '') not in (
            'anon',
            'authenticated',
            'service_role'
          )`,
        'unknown role exact ACL',
      ),
    },
    {
      name: 'lock timeout removed',
      setup: 'lock-timeout',
      sql: replaceExactly(source, "set local lock_timeout = '5s';\n", '', 'lock timeout'),
    },
    {
      name: 'transaction boundary removed',
      setup: 'transaction',
      sql: replaceExactly(
        replaceExactly(source, 'begin;\n', '', 'transaction begin'),
        '\ncommit;\n',
        '\n',
        'transaction commit',
      ),
    },
    {
      name: 'second run duplicates canonical policy',
      setup: 'second-run-duplicate',
      sql: replaceExactly(
        source,
        `drop policy if exists "Users can read own bank transfer submissions"
on public.bank_transfer_submissions;`,
        '-- second-run mutation intentionally leaves the canonical policy in place',
        'second-run policy drop',
      ),
    },
  ]
}

function prepareUnknownAclMutation(database) {
  prepareLegacySchema(database, true)
  psql(
    database,
    `
      do $$
      begin
        if not exists (select 1 from pg_catalog.pg_roles where rolname = 'bank_transfer_legacy_writer') then
          create role bank_transfer_legacy_writer nologin;
        end if;
      end
      $$;
      grant insert on table public.bank_transfer_submissions to bank_transfer_legacy_writer;
    `,
    'unknown role mutation fixture',
  )
}

function assertUnknownAclRollback(database) {
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
            select count(*)
            from pg_catalog.pg_policy
            where polrelid = 'public.bank_transfer_submissions'::pg_catalog.regclass
          );
      `,
      'unknown role rollback oracle',
    ),
    't|2',
  )
}

function runFenceMutationMatrix() {
  const source = readFileSync(migration, 'utf8')
  const definitions = mutationDefinitions(source)
  let caught = 0
  let uncaught = 0
  let infrastructureFailures = 0

  definitions.forEach((mutation, index) => {
    const database = `bt_mutation_${String(index + 1).padStart(2, '0')}`
    createDatabase(database)
    let before

    try {
      if (mutation.setup === 'relation-mismatch') {
        prepareRelationIdentityMismatch(database)
      } else if (mutation.setup === 'unknown-acl' || mutation.setup === 'transaction') {
        prepareUnknownAclMutation(database)
        before = snapshotHistoricalState(database)
      } else if (mutation.setup === 'second-run-duplicate') {
        prepareLegacySchema(database, true)
        before = snapshotHistoricalState(database)
        psqlFile(database, migration, 'canonical first run for second-run mutation')
      } else {
        prepareLegacySchema(database, true)
        before = snapshotHistoricalState(database)
      }

      if (mutation.setup === 'lock-timeout') {
        holdAccessExclusiveLock(database, 8)
      }

      const result = psqlResult(database, mutation.sql, 15_000)
      const output = boundedOutput(result)

      if (/syntax error/i.test(output)) {
        process.stderr.write(`MUTATION_INFRASTRUCTURE=${mutation.name}:syntax\n${output}\n`)
        infrastructureFailures += 1
        return
      }

      if (mutation.setup === 'transaction') {
        if (result.status === 0) {
          uncaught += 1
          return
        }
        if (/LOCK TABLE can only be used in transaction blocks/i.test(output)) {
          assert.deepEqual(snapshotHistoricalState(database), before)
          assertUnknownAclRollback(database)
          caught += 1
          return
        }
        assert.match(output, /bank_transfer_submissions_readonly_fence:/i)
        const postMutationPolicyCount = psql(
          database,
          `
            select count(*)
            from pg_catalog.pg_policy
            where polrelid = 'public.bank_transfer_submissions'::pg_catalog.regclass;
          `,
          'transaction mutation damage oracle',
        )
        if (postMutationPolicyCount === '1') caught += 1
        else uncaught += 1
        return
      }

      if (mutation.setup === 'second-run-duplicate') {
        if (
          result.status !== 0
          && /policy "Users can read own bank transfer submissions" for table "bank_transfer_submissions" already exists/i.test(output)
        ) {
          assert.deepEqual(snapshotHistoricalState(database), before)
          assertExactPrivileges(database)
          assertExactAclCatalog(database)
          assertExactPolicyAndRls(database)
          caught += 1
        } else if (result.status === 0) {
          uncaught += 1
        } else {
          process.stderr.write(`MUTATION_INFRASTRUCTURE=${mutation.name}:unexpected failure\n${output}\n`)
          infrastructureFailures += 1
        }
        return
      }

      if (mutation.setup === 'lock-timeout') {
        waitForAccessExclusiveLock(database, false, 'lock-timeout mutation fixture')
        try {
          assertLockTimeoutFailureResult(result)
          uncaught += 1
        } catch (error) {
          if (error?.code === 'ERR_ASSERTION') caught += 1
          else throw error
        }
        return
      }

      if (result.status !== 0) {
        if (/bank_transfer_submissions_readonly_fence:/i.test(output)) caught += 1
        else {
          process.stderr.write(`MUTATION_INFRASTRUCTURE=${mutation.name}:unexpected failure\n${output}\n`)
          infrastructureFailures += 1
        }
        return
      }

      try {
        if (mutation.sourceGuard) {
          assert.match(mutation.sql, mutation.sourceGuard)
        }
        if (mutation.setup === 'relation-mismatch') {
          assert.equal(
            psql(
              database,
              `select relkind from pg_catalog.pg_class
               where oid = 'public.bank_transfer_submissions'::pg_catalog.regclass;`,
              'relation kind mutation oracle',
            ),
            'r',
          )
        } else {
          assert.deepEqual(snapshotHistoricalState(database), before)
          assertExactPrivileges(database)
          assertExactAclCatalog(database)
          assertExactPolicyAndRls(database)
          if (mutation.setup === 'unknown-acl') assertUnknownAclRollback(database)
        }
        uncaught += 1
      } catch (error) {
        if (error?.code === 'ERR_ASSERTION') {
          caught += 1
        } else if (
          mutation.name === 'historical table dropped'
          && /relation "public\.bank_transfer_submissions" does not exist/i.test(String(error))
        ) {
          caught += 1
        } else if (/LOCAL_DB_(?:COMMAND_TIMEOUT|OUTPUT_LIMIT_EXCEEDED|PROCESS_)/.test(String(error))) {
          process.stderr.write(`MUTATION_INFRASTRUCTURE=${mutation.name}:${String(error)}\n`)
          infrastructureFailures += 1
        } else {
          throw new Error(`mutation "${mutation.name}" oracle failure: ${String(error)}`)
        }
      }
    } catch (error) {
      if (/LOCAL_DB_(?:COMMAND_TIMEOUT|OUTPUT_LIMIT_EXCEEDED|PROCESS_)/.test(String(error))) {
        process.stderr.write(`MUTATION_INFRASTRUCTURE=${mutation.name}:${String(error)}\n`)
        infrastructureFailures += 1
      } else {
        throw new Error(`mutation "${mutation.name}" harness failure: ${String(error)}`)
      }
    }
  })

  const mutationTotal = definitions.length
  process.stdout.write(`MUTATION_TOTAL=${mutationTotal}\n`)
  process.stdout.write(`MUTATION_CAUGHT=${caught}\n`)
  process.stdout.write(`MUTATION_UNCAUGHT=${uncaught}\n`)
  process.stdout.write(`MUTATION_INFRASTRUCTURE_FAILURES=${infrastructureFailures}\n`)
  assert.equal(caught, mutationTotal)
  assert.equal(uncaught, 0)
  assert.equal(infrastructureFailures, 0)
  return { mutationTotal, caught, uncaught, infrastructureFailures }
}

function assertMutationHarnessInfrastructureClassification() {
  const source = readFileSync(migration, 'utf8')
  assert.throws(
    () => replaceExactly(source, 'not present in source', 'replacement', 'unexecuted mutation'),
    /must occur exactly once/,
  )

  createDatabase('bt_infrastructure_probes')
  const syntax = psqlResult('bt_infrastructure_probes', 'select definitely invalid syntax;')
  assert.notEqual(syntax.status, 0)
  assert.match(boundedOutput(syntax), /syntax error/i)

  assert.throws(
    () => psql('bt_infrastructure_probes', 'select pg_catalog.pg_sleep(2);', 'timeout probe', 100),
    /LOCAL_DB_COMMAND_TIMEOUT/,
  )
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2_100)

  const crash = spawnDocker(
    ['exec', `${containerName}-not-present`, 'postgres', '--version'],
    { timeout: 5_000 },
  )
  assert.notEqual(crash.status, 0)
  assert.match(boundedOutput(crash), /No such container/i)

  const network = spawnDocker(
    [
      'exec',
      '--env',
      'PGCONNECT_TIMEOUT=2',
      containerName,
      'psql',
      '-X',
      '-h',
      '192.0.2.1',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-c',
      'select 1',
    ],
    { timeout: 5_000 },
  )
  assert.notEqual(network.status, 0)
  assert.match(
    boundedOutput(network),
    /connection to server at .* failed|connection timed out|network is unreachable|no route to host/i,
  )

  process.stdout.write('MUTATION_HARNESS_CHECKS=5\n')
  return { checks: 5 }
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
  createdResources.volume = true
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
  createdResources.network = true
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
  createdResources.container = true

  let consecutiveReadyChecks = 0
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const result = spawnDocker(
      ['exec', containerName, 'psql', '-X', '-A', '-t', '-U', 'postgres', '-d', 'postgres', '-c', 'select 1'],
      { timeout: 5_000 },
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
    'create database bank_transfer_old_fence_upgrade;',
    'create old-fence remediation database',
  )
  psql(
    'postgres',
    'create database bank_transfer_old_fence_line_pay;',
    'create old-fence LINE Pay remediation database',
  )
  psql(
    'postgres',
    'create database bank_transfer_unknown_acl;',
    'create unknown ACL fail-closed database',
  )
  createDatabase('bank_transfer_lock_timeout')
  createDatabase('bank_transfer_second_run')
  createDatabase('bank_transfer_relation_mismatch')
  createDatabase('bank_transfer_relation_missing')
  createDatabase('bank_transfer_relation_replacement')
  createDatabase('bank_transfer_lock_removal_mutation')

  applyAndAssert('bank_transfer_clean', false)
  applyAndAssert('bank_transfer_upgrade', true)
  applyOldFenceThenRemediation('bank_transfer_old_fence_upgrade')
  applyAfterLinePayAndAssert('bank_transfer_line_pay_upgrade')
  applyFenceBeforeLinePayAndAssert('bank_transfer_fence_first')
  applyOldFenceLinePayRemediation('bank_transfer_old_fence_line_pay')
  assertUnknownWriteAclFailsClosed('bank_transfer_unknown_acl')
  assertLockTimeoutRollback('bank_transfer_lock_timeout')
  assertSecondRunBehavior('bank_transfer_second_run')
  assertRelationIdentityMismatch('bank_transfer_relation_mismatch')
  assertRelationMissing('bank_transfer_relation_missing')
  await assertConcurrentRelationReplacement('bank_transfer_relation_replacement')
  await assertLockRemovalMutation('bank_transfer_lock_removal_mutation')
  const harnessResult = assertMutationHarnessInfrastructureClassification()
  const aclMutationResult = runUnknownAclFixtureMutationMatrix()
  const mutationResult = runFenceMutationMatrix()
  const totalMutations = aclMutationResult.mutationTotal + mutationResult.mutationTotal
  const totalCaught = aclMutationResult.caught + mutationResult.caught

  process.stdout.write(
    `bank_transfer_submissions_readonly_fence: PASS (PostgreSQL 17, clean, production-like upgrade, LINE Pay-first, fence-first, full data/columns/primary key preservation, exact ACLs and grantors, unknown-role exact ACL fail-closed rollback, canonical policy, RLS, runtime denial, lock-timeout rollback, second run, relation mismatch, SQL and ACL mutations ${totalCaught}/${totalMutations}, concurrent lock-removal mutation 1/1, harness-negative checks ${harnessResult.checks}/${harnessResult.checks})\n`,
  )
}

function cleanupTaskOwnedDockerResources() {
  const failures = []
  const cleanup = [
    ['container', ['rm', '--force', containerName]],
    ['volume', ['volume', 'rm', volumeName]],
    ['network', ['network', 'rm', networkName]],
  ]

  for (const [resource, args] of cleanup) {
    if (!createdResources[resource]) continue
    try {
      const result = spawnDocker(args, { timeout: 30_000 })
      if (result.status !== 0) {
        failures.push(`${resource}: exit ${result.status}: ${boundedOutput(result)}`)
      } else {
        createdResources[resource] = false
      }
    } catch (error) {
      failures.push(`${resource}: ${String(error)}`)
    }
  }

  if (failures.length > 0) {
    throw new Error(`cleanup task-owned Docker resources failed\n${failures.join('\n')}`)
  }
}

try {
  await main()
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
} finally {
  try {
    cleanupTaskOwnedDockerResources()
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  }
}
