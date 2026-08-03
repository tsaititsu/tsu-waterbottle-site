\set ON_ERROR_STOP on
\set QUIET on
\pset format unaligned
\pset tuples_only on

BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY;

with
expected_relations(
  ordinal,
  relation_key,
  schema_name,
  relation_name
) as (
  values
    (1, 'product_orders', 'public', 'product_orders'),
    (2, 'payments', 'public', 'payments'),
    (3, 'checkout_attempts', 'public', 'line_pay_checkout_attempts'),
    (4, 'request_outbox', 'public', 'line_pay_request_outbox'),
    (5, 'callback_capabilities', 'public', 'line_pay_callback_capabilities'),
    (6, 'callback_events', 'public', 'line_pay_callback_events'),
    (7, 'audit_events', 'public', 'line_pay_payment_audit_events'),
    (8, 'completion_proofs', 'line_pay_private', 'line_pay_completion_proofs')
),
session_capability as (
  select
    coalesce(role.rolsuper, false) as superuser,
    coalesce(pg_catalog.has_schema_privilege(
      current_user,
      public_namespace.oid,
      'USAGE'
    ), false) as public_schema_usage,
    coalesce(pg_catalog.has_schema_privilege(
      current_user,
      private_namespace.oid,
      'USAGE'
    ), false) as private_schema_usage
  from (values (true)) as singleton(value)
  left join pg_catalog.pg_roles as role
    on role.rolname = current_user
  left join pg_catalog.pg_namespace as public_namespace
    on public_namespace.nspname = 'public'
  left join pg_catalog.pg_namespace as private_namespace
    on private_namespace.nspname = 'line_pay_private'
),
relation_privileges as (
  select
    expected.ordinal,
    expected.relation_key,
    relation.oid is not null as present,
    case expected.schema_name
      when 'public' then session_capability.public_schema_usage
      when 'line_pay_private' then session_capability.private_schema_usage
      else false
    end as schema_usage,
    coalesce(relation.relowner = role.oid, false)
      as owned_by_current_user,
    coalesce(pg_catalog.has_table_privilege(
      current_user,
      relation.oid,
      'SELECT'
    ), false) as select_privilege,
    coalesce(pg_catalog.has_table_privilege(
      current_user,
      relation.oid,
      'MAINTAIN'
    ), false) as maintain_privilege,
    coalesce(pg_catalog.has_table_privilege(
      current_user,
      relation.oid,
      'UPDATE'
    ), false) as update_privilege,
    coalesce(pg_catalog.has_table_privilege(
      current_user,
      relation.oid,
      'DELETE'
    ), false) as delete_privilege,
    coalesce(pg_catalog.has_table_privilege(
      current_user,
      relation.oid,
      'TRUNCATE'
    ), false) as truncate_privilege,
    session_capability.superuser
  from expected_relations as expected
  cross join session_capability
  left join pg_catalog.pg_namespace as namespace
    on namespace.nspname = expected.schema_name
  left join pg_catalog.pg_class as relation
    on relation.relnamespace = namespace.oid
   and relation.relname = expected.relation_name
   and relation.relkind in ('r', 'p')
  left join pg_catalog.pg_roles as role
    on role.rolname = current_user
),
relation_capability as (
  select
    ordinal,
    relation_key,
    present,
    schema_usage,
    owned_by_current_user,
    select_privilege,
    maintain_privilege,
    update_privilege,
    delete_privilege,
    truncate_privilege,
    present
      and schema_usage
      and (
        superuser
        or owned_by_current_user
        or maintain_privilege
        or update_privilege
        or delete_privilege
        or truncate_privilege
      ) as access_exclusive_lock_capable,
    present
      and schema_usage
      and select_privilege as fingerprint_read_capable
  from relation_privileges
),
decision as (
  select
    coalesce(pg_catalog.bool_and(access_exclusive_lock_capable), false)
      as lock_capability_ready,
    coalesce(pg_catalog.bool_and(fingerprint_read_capable), false)
      as fingerprint_capability_ready,
    case
      when pg_catalog.bool_or(not present)
        then 'RELATION_MISSING'
      when pg_catalog.bool_or(not schema_usage)
        then 'SCHEMA_USAGE_MISSING'
      when pg_catalog.bool_or(not access_exclusive_lock_capable)
        then 'LOCK_CAPABILITY_MISSING'
      when pg_catalog.bool_or(not fingerprint_read_capable)
        then 'FINGERPRINT_READ_CAPABILITY_MISSING'
      else 'CAPABILITY_READY'
    end as blocking_stage
  from relation_capability
),
blocking_relations as (
  select coalesce(
    pg_catalog.jsonb_agg(relation_key order by ordinal) filter (
      where case decision.blocking_stage
        when 'RELATION_MISSING' then not present
        when 'SCHEMA_USAGE_MISSING' then not schema_usage
        when 'LOCK_CAPABILITY_MISSING'
          then not access_exclusive_lock_capable
        when 'FINGERPRINT_READ_CAPABILITY_MISSING'
          then not fingerprint_read_capable
        else false
      end
    ),
    '[]'::pg_catalog.jsonb
  ) as relation_keys
  from relation_capability
  cross join decision
)
select pg_catalog.jsonb_build_object(
  'status',
    'LINE_PAY_ATOMIC_FINALIZATION_CAPABILITY_DIAGNOSTIC_COMPLETED',
  'database_identity_match',
    current_database() = 'postgres',
  'session',
    pg_catalog.jsonb_build_object(
      'superuser', session_capability.superuser,
      'public_schema_usage', session_capability.public_schema_usage,
      'private_schema_usage', session_capability.private_schema_usage
    ),
  'relations',
    (
      select pg_catalog.jsonb_object_agg(
        relation_key,
        pg_catalog.jsonb_build_object(
          'present', present,
          'schema_usage', schema_usage,
          'owned_by_current_user', owned_by_current_user,
          'select_privilege', select_privilege,
          'maintain_privilege', maintain_privilege,
          'update_privilege', update_privilege,
          'delete_privilege', delete_privilege,
          'truncate_privilege', truncate_privilege,
          'access_exclusive_lock_capable', access_exclusive_lock_capable,
          'fingerprint_read_capable', fingerprint_read_capable
        )
        order by ordinal
      )
      from relation_capability
    ),
  'decision',
    pg_catalog.jsonb_build_object(
      'lock_capability_ready', decision.lock_capability_ready,
      'fingerprint_capability_ready',
        decision.fingerprint_capability_ready,
      'blocking_stage', decision.blocking_stage,
      'blocking_relations', blocking_relations.relation_keys
    )
) as diagnostic_result
from session_capability
cross join decision
cross join blocking_relations;

ROLLBACK;
