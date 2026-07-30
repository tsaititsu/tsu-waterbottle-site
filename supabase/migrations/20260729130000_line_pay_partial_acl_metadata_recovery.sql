\set ON_ERROR_STOP on
\set QUIET on
\pset format unaligned
\pset tuples_only on

begin;
set local lock_timeout = '15s';
set local statement_timeout = '120s';
set local idle_in_transaction_session_timeout = '30s';

-- Fail-forward recovery for the reviewed Production PARTIAL state after the
-- LINE Pay exact-file migration committed its core schema but left catalog ACL
-- metadata outside the application-state contract. This file intentionally
-- does not rerun the original migration, does not touch migration history, and
-- does not enable LINE Pay runtime.

do $$
declare
  v_missing_identity text;
  v_migration_history_version_present boolean := false;
begin
  if to_regclass('supabase_migrations.schema_migrations') is not null then
    execute $query$
      select exists (
        select 1
        from supabase_migrations.schema_migrations
        where version = $1
      )
    $query$
    into v_migration_history_version_present
    using '20260719033404';
  end if;

  if v_migration_history_version_present then
    raise exception using errcode = '23505',
      message = 'line_pay_partial_recovery_migration_history_already_recorded';
  end if;

  select identity into v_missing_identity
  from (
    values
      ('public.app_environment_attestation'),
      ('public.line_pay_checkout_attempts'),
      ('public.line_pay_request_outbox'),
      ('public.line_pay_callback_capabilities'),
      ('public.line_pay_callback_events'),
      ('public.line_pay_payment_audit_events'),
      ('line_pay_private.line_pay_completion_proofs'),
      ('public.payments'),
      ('public.product_orders')
  ) as expected(identity)
  where to_regclass(expected.identity) is null
  order by identity
  limit 1;

  if v_missing_identity is not null then
    raise exception using errcode = '42P01',
      message = 'line_pay_partial_recovery_missing_relation';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_roles
    where rolname = 'line_pay_payment_executor'
  ) or not exists (
    select 1 from pg_catalog.pg_roles
    where rolname = 'line_pay_payment_function_owner'
  ) then
    raise exception using errcode = '42704',
      message = 'line_pay_partial_recovery_missing_runtime_role';
  end if;
end
$$;

-- Production's reviewed PARTIAL state already kept the private completion-proof
-- owner boundary under line_pay_payment_function_owner. The remaining
-- recoverable drift is public relation ACL metadata plus the active
-- payments/product_orders write boundary. Do not grant, revoke, or rewrite the
-- executor's function-owner role membership here; hosted Supabase role
-- memberships are part of the protected deployment channel, not application
-- schema metadata.

lock table
  public.payments,
  public.product_orders,
  public.app_environment_attestation,
  public.line_pay_checkout_attempts,
  public.line_pay_request_outbox,
  public.line_pay_callback_capabilities,
  public.line_pay_callback_events,
  public.line_pay_payment_audit_events
in access exclusive mode;

create temporary table line_pay_partial_recovery_expected_acl (
  schema_name text not null,
  relation_name text not null,
  allowed_grantees text[] not null,
  primary key (schema_name, relation_name)
) on commit drop;

insert into line_pay_partial_recovery_expected_acl (
  schema_name,
  relation_name,
  allowed_grantees
) values
  (
    'public',
    'payments',
    array['service_role', 'line_pay_payment_function_owner']::text[]
  ),
  (
    'public',
    'product_orders',
    array['service_role', 'line_pay_payment_function_owner']::text[]
  ),
  (
    'public',
    'app_environment_attestation',
    array['service_role']::text[]
  ),
  (
    'public',
    'line_pay_checkout_attempts',
    array['service_role', 'line_pay_payment_function_owner']::text[]
  ),
  (
    'public',
    'line_pay_request_outbox',
    array['service_role', 'line_pay_payment_function_owner']::text[]
  ),
  (
    'public',
    'line_pay_callback_capabilities',
    array['service_role', 'line_pay_payment_function_owner']::text[]
  ),
  (
    'public',
    'line_pay_callback_events',
    array['service_role', 'line_pay_payment_function_owner']::text[]
  ),
  (
    'public',
    'line_pay_payment_audit_events',
    array['line_pay_payment_function_owner']::text[]
  );

do $$
declare
  v_sql text;
begin
  for v_sql in
    select format(
      'alter table %I.%I owner to current_user',
      namespace.nspname,
      relation.relname
    )
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    join pg_catalog.pg_roles as owner_role
      on owner_role.oid = relation.relowner
    where namespace.nspname = 'public'
      and relation.relname in ('payments', 'product_orders')
      and owner_role.rolname in (
        'anon',
        'authenticated',
        'service_role',
        'line_pay_payment_executor',
        'line_pay_payment_function_owner'
      )
  loop
    execute v_sql;
  end loop;
end
$$;

do $$
declare
  v_sql text;
begin
  for v_sql in
    select format(
      'revoke all privileges on table %I.%I from public, anon, authenticated, service_role, line_pay_payment_executor, line_pay_payment_function_owner',
      expected.schema_name,
      expected.relation_name
    )
    from line_pay_partial_recovery_expected_acl as expected
  loop
    execute v_sql;
  end loop;

  for v_sql in
    select format(
      'revoke all privileges on table %I.%I from %I',
      namespace.nspname,
      relation.relname,
      grantee.rolname
    )
    from line_pay_partial_recovery_expected_acl as expected
    join pg_catalog.pg_namespace as namespace
      on namespace.nspname = expected.schema_name
    join pg_catalog.pg_class as relation
      on relation.relnamespace = namespace.oid
     and relation.relname = expected.relation_name
    join pg_catalog.pg_roles as owner_role on owner_role.oid = relation.relowner
    cross join lateral pg_catalog.aclexplode(
      coalesce(relation.relacl, pg_catalog.acldefault('r', relation.relowner))
    ) as acl
    join pg_catalog.pg_roles as grantee on grantee.oid = acl.grantee
    where grantee.rolname <> owner_role.rolname
      and not grantee.rolname = any(expected.allowed_grantees)
    group by namespace.nspname, relation.relname, grantee.rolname
  loop
    execute v_sql;
  end loop;

  for v_sql in
    select format(
      'revoke all privileges on table %I.%I from %I',
      namespace.nspname,
      relation.relname,
      owner_role.rolname
    )
    from line_pay_partial_recovery_expected_acl as expected
    join pg_catalog.pg_namespace as namespace
      on namespace.nspname = expected.schema_name
    join pg_catalog.pg_class as relation
      on relation.relnamespace = namespace.oid
     and relation.relname = expected.relation_name
    join pg_catalog.pg_roles as owner_role on owner_role.oid = relation.relowner
  loop
    execute v_sql;
  end loop;

  for v_sql in
    select format(
      'grant all privileges on table %I.%I to %I',
      namespace.nspname,
      relation.relname,
      owner_role.rolname
    )
    from line_pay_partial_recovery_expected_acl as expected
    join pg_catalog.pg_namespace as namespace
      on namespace.nspname = expected.schema_name
    join pg_catalog.pg_class as relation
      on relation.relnamespace = namespace.oid
     and relation.relname = expected.relation_name
    join pg_catalog.pg_roles as owner_role on owner_role.oid = relation.relowner
  loop
    execute v_sql;
  end loop;
end
$$;

do $$
declare
  v_sql text;
begin
  for v_sql in
    select format(
      'revoke all privileges (%I) on table %I.%I from public, anon, authenticated, service_role, line_pay_payment_executor, line_pay_payment_function_owner',
      attribute.attname,
      namespace.nspname,
      relation.relname
    )
    from line_pay_partial_recovery_expected_acl as expected
    join pg_catalog.pg_namespace as namespace
      on namespace.nspname = expected.schema_name
    join pg_catalog.pg_class as relation
      on relation.relnamespace = namespace.oid
     and relation.relname = expected.relation_name
    join pg_catalog.pg_attribute as attribute
      on attribute.attrelid = relation.oid
    where attribute.attnum > 0
      and not attribute.attisdropped
  loop
    execute v_sql;
  end loop;
end
$$;

grant usage on schema public
to line_pay_payment_function_owner;
grant usage on schema public to line_pay_payment_executor;

grant select, insert, update on table
  public.payments,
  public.product_orders
to service_role;

grant update (
  status,
  request_state,
  provider_trade_no,
  paid_at,
  reconciliation_required,
  line_pay_transaction_id,
  failure_reason
)
on table public.payments to line_pay_payment_function_owner;

grant update (
  payment_status,
  order_status,
  payment_request_state,
  reconciliation_required
)
on table public.product_orders to line_pay_payment_function_owner;

grant select on table public.app_environment_attestation to service_role;
grant select, insert, update on table
  public.line_pay_checkout_attempts,
  public.line_pay_request_outbox,
  public.line_pay_callback_capabilities,
  public.line_pay_callback_events
to service_role;

grant select on table
  public.payments,
  public.product_orders,
  public.line_pay_checkout_attempts,
  public.line_pay_request_outbox,
  public.line_pay_callback_capabilities,
  public.line_pay_callback_events,
  public.line_pay_payment_audit_events
to line_pay_payment_function_owner;

grant update (
  request_state,
  attempt_count,
  claim_id,
  claimed_at,
  claim_expires_at,
  upstream_transaction_id,
  sanitized_result,
  last_error_code,
  reconciliation_required,
  completed_at
)
on table public.line_pay_checkout_attempts to line_pay_payment_function_owner;

grant update (
  state,
  attempt_count,
  claim_id,
  claimed_at,
  claim_expires_at,
  last_error_code,
  completed_at
)
on table public.line_pay_request_outbox to line_pay_payment_function_owner;

grant update (consumed_at)
on table public.line_pay_callback_capabilities to line_pay_payment_function_owner;

grant update (
  state,
  provider_result_sha256,
  safe_result_code,
  last_error_code,
  completed_at
)
on table public.line_pay_callback_events to line_pay_payment_function_owner;

grant insert on table public.line_pay_payment_audit_events
to line_pay_payment_function_owner;

do $$
begin
  if exists (
    select 1
    from pg_catalog.pg_auth_members as membership
    join pg_catalog.pg_roles as granted_role
      on granted_role.oid = membership.roleid
    join pg_catalog.pg_roles as member_role
      on member_role.oid = membership.member
    where granted_role.rolname = 'line_pay_payment_function_owner'
      and member_role.rolname = current_user
      and (membership.inherit_option or membership.set_option)
  ) then
    raise exception using errcode = '42501',
      message = 'line_pay_partial_recovery_role_bridge_cleanup_postcondition_failed';
  end if;
end
$$;

do $$
begin
  if pg_catalog.has_table_privilege('anon', 'public.payments', 'insert')
     or pg_catalog.has_table_privilege('anon', 'public.payments', 'update')
     or pg_catalog.has_table_privilege('anon', 'public.payments', 'delete')
     or pg_catalog.has_table_privilege('anon', 'public.payments', 'truncate')
     or pg_catalog.has_table_privilege('authenticated', 'public.payments', 'insert')
     or pg_catalog.has_table_privilege('authenticated', 'public.payments', 'update')
     or pg_catalog.has_table_privilege('authenticated', 'public.payments', 'delete')
     or pg_catalog.has_table_privilege('authenticated', 'public.payments', 'truncate')
     or pg_catalog.has_table_privilege('anon', 'public.product_orders', 'insert')
     or pg_catalog.has_table_privilege('anon', 'public.product_orders', 'update')
     or pg_catalog.has_table_privilege('anon', 'public.product_orders', 'delete')
     or pg_catalog.has_table_privilege('anon', 'public.product_orders', 'truncate')
     or pg_catalog.has_table_privilege('authenticated', 'public.product_orders', 'insert')
     or pg_catalog.has_table_privilege('authenticated', 'public.product_orders', 'update')
     or pg_catalog.has_table_privilege('authenticated', 'public.product_orders', 'delete')
     or pg_catalog.has_table_privilege('authenticated', 'public.product_orders', 'truncate') then
    raise exception using errcode = '42501',
      message = 'line_pay_partial_recovery_public_write_postcondition_failed';
  end if;

  if not pg_catalog.has_table_privilege(
       'service_role',
       'public.payments',
       'select'
     )
     or not pg_catalog.has_table_privilege(
       'service_role',
       'public.payments',
       'insert'
     )
     or not pg_catalog.has_table_privilege(
       'service_role',
       'public.payments',
       'update'
     )
     or not pg_catalog.has_table_privilege(
       'service_role',
       'public.product_orders',
       'select'
     )
     or not pg_catalog.has_table_privilege(
       'service_role',
       'public.product_orders',
       'insert'
     )
     or not pg_catalog.has_table_privilege(
       'service_role',
       'public.product_orders',
       'update'
     ) then
    raise exception using errcode = '42501',
      message = 'line_pay_partial_recovery_service_role_postcondition_failed';
  end if;

  if pg_catalog.has_table_privilege(
       'line_pay_payment_executor',
       'public.payments',
       'select,insert,update,delete,truncate,references,trigger'
     )
     or pg_catalog.has_table_privilege(
       'line_pay_payment_executor',
       'public.line_pay_checkout_attempts',
       'select,insert,update,delete,truncate,references,trigger'
     )
     or pg_catalog.has_schema_privilege(
       'line_pay_payment_executor',
       'line_pay_private',
       'usage'
     ) then
    raise exception using errcode = '42501',
      message = 'line_pay_partial_recovery_executor_postcondition_failed';
  end if;
end
$$;

commit;
