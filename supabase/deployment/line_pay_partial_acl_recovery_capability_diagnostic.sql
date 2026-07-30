\set ON_ERROR_STOP on
\set QUIET on
\pset format unaligned
\pset tuples_only on

BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY;

with
expected_roles(role_name) as (
  values
    ('line_pay_payment_executor'),
    ('line_pay_payment_function_owner')
),
expected_relations(schema_name, relation_name) as (
  values
    ('public', 'payments'),
    ('public', 'product_orders'),
    ('public', 'app_environment_attestation'),
    ('public', 'line_pay_checkout_attempts'),
    ('public', 'line_pay_request_outbox'),
    ('public', 'line_pay_callback_capabilities'),
    ('public', 'line_pay_callback_events'),
    ('public', 'line_pay_payment_audit_events'),
    ('line_pay_private', 'line_pay_completion_proofs')
),
role_membership as (
  select
    granted_role.rolname as granted_role_name,
    bool_or(member_role.rolname = current_user) as membership_present,
    bool_or(
      member_role.rolname = current_user
      and membership.admin_option
    ) as admin_option_present,
    bool_or(
      member_role.rolname = current_user
      and membership.inherit_option
    ) as inherit_option_present,
    bool_or(
      member_role.rolname = current_user
      and membership.set_option
    ) as set_option_present
  from pg_catalog.pg_auth_members as membership
  join pg_catalog.pg_roles as granted_role
    on granted_role.oid = membership.roleid
  join pg_catalog.pg_roles as member_role
    on member_role.oid = membership.member
  where granted_role.rolname in (select role_name from expected_roles)
  group by granted_role.rolname
),
role_capability as (
  select
    expected.role_name,
    coalesce(role_membership.membership_present, false)
      as membership_present,
    coalesce(role_membership.admin_option_present, false)
      as admin_option_present,
    coalesce(role_membership.inherit_option_present, false)
      as inherit_option_present,
    coalesce(role_membership.set_option_present, false)
      as set_option_present
  from expected_roles as expected
  left join role_membership
    on role_membership.granted_role_name = expected.role_name
),
relation_ownership as (
  select
    expected.schema_name,
    expected.relation_name,
    relation.oid is not null as present,
    coalesce(owner.rolname = current_user, false) as owned_by_current_user,
    coalesce(
      owner.rolname = 'line_pay_payment_function_owner',
      false
    ) as owned_by_function_owner,
    relation.relacl is not null as explicit_acl_present
  from expected_relations as expected
  left join pg_catalog.pg_namespace as namespace
    on namespace.nspname = expected.schema_name
  left join pg_catalog.pg_class as relation
    on relation.relnamespace = namespace.oid
   and relation.relname = expected.relation_name
  left join pg_catalog.pg_roles as owner
    on owner.oid = relation.relowner
),
schema_ownership as (
  select
    namespace.oid is not null as private_schema_present,
    coalesce(owner.rolname = current_user, false)
      as private_schema_owned_by_current_user,
    coalesce(owner.rolname = 'line_pay_payment_function_owner', false)
      as private_schema_owned_by_function_owner,
    namespace.nspacl is not null as private_schema_explicit_acl_present
  from (values ('line_pay_private')) as expected(schema_name)
  left join pg_catalog.pg_namespace as namespace
    on namespace.nspname = expected.schema_name
  left join pg_catalog.pg_roles as owner
    on owner.oid = namespace.nspowner
),
active_relation_write_acl as (
  select
    bool_or(
      pg_catalog.has_table_privilege(
        runtime_role.role_name,
        format('%I.%I', ownership.schema_name, ownership.relation_name),
        privilege.name
      )
    ) as write_acl_present
  from relation_ownership as ownership
  cross join (values ('anon'), ('authenticated')) as runtime_role(role_name)
  cross join (
    values ('insert'), ('update'), ('delete'), ('truncate')
  ) as privilege(name)
  where (ownership.schema_name, ownership.relation_name) in (
    ('public', 'payments'),
    ('public', 'product_orders')
  )
),
line_pay_unexpected_acl as (
  select
    bool_or(
      acl.grantee_role_name in ('public', 'anon', 'authenticated')
    ) as unexpected_runtime_acl_present
  from relation_ownership as ownership
  join pg_catalog.pg_namespace as namespace
    on namespace.nspname = ownership.schema_name
  join pg_catalog.pg_class as relation
    on relation.relnamespace = namespace.oid
   and relation.relname = ownership.relation_name
  cross join lateral (
    select
      case
        when acl.grantee = 0 then 'public'
        else grantee.rolname
      end as grantee_role_name
    from pg_catalog.aclexplode(
      coalesce(
        relation.relacl,
        pg_catalog.acldefault('r', relation.relowner)
      )
    ) as acl
    left join pg_catalog.pg_roles as grantee
      on grantee.oid = acl.grantee
  ) as acl
  where not (
    ownership.schema_name = 'public'
    and ownership.relation_name in ('payments', 'product_orders')
  )
),
inventory as (
  select
    (
      select pg_catalog.count(*)::integer
      from relation_ownership
      where present
    ) as relations_present,
    (
      select pg_catalog.count(*)::integer
      from pg_catalog.pg_roles
      where rolname in (select role_name from expected_roles)
    ) as roles_present
),
capability_summary as (
  select
    coalesce((
      select admin_option_present
      from role_capability
      where role_name = 'line_pay_payment_function_owner'
    ), false) as function_owner_admin_option_present,
    coalesce((
      select membership_present
      from role_capability
      where role_name = 'line_pay_payment_function_owner'
    ), false) as function_owner_membership_present,
    coalesce((
      select inherit_option_present
      from role_capability
      where role_name = 'line_pay_payment_function_owner'
    ), false) as function_owner_inherit_option_present,
    coalesce((
      select set_option_present
      from role_capability
      where role_name = 'line_pay_payment_function_owner'
    ), false) as function_owner_set_option_present,
    coalesce((
      select admin_option_present
      from role_capability
      where role_name = 'line_pay_payment_executor'
    ), false) as executor_admin_option_present,
    coalesce((
      select membership_present
      from role_capability
      where role_name = 'line_pay_payment_executor'
    ), false) as executor_membership_present
)
select pg_catalog.jsonb_build_object(
  'status',
    'LINE_PAY_PARTIAL_RECOVERY_CAPABILITY_DIAGNOSTIC_COMPLETED',
  'database_identity_match',
    current_database() = 'postgres',
  'inventory',
    pg_catalog.jsonb_build_object(
      'relations_present', inventory.relations_present,
      'roles_present', inventory.roles_present
    ),
  'role_capability',
    pg_catalog.jsonb_build_object(
      'function_owner_membership_present',
        capability_summary.function_owner_membership_present,
      'function_owner_admin_option_present',
        capability_summary.function_owner_admin_option_present,
      'function_owner_inherit_option_present',
        capability_summary.function_owner_inherit_option_present,
      'function_owner_set_option_present',
        capability_summary.function_owner_set_option_present,
      'executor_membership_present',
        capability_summary.executor_membership_present,
      'executor_admin_option_present',
        capability_summary.executor_admin_option_present,
      'role_bridge_grant_precondition_met',
        capability_summary.function_owner_admin_option_present
    ),
  'ownership',
    pg_catalog.jsonb_build_object(
      'payments_owned_by_current_user',
        coalesce((
          select owned_by_current_user
          from relation_ownership
          where schema_name = 'public'
            and relation_name = 'payments'
        ), false),
      'product_orders_owned_by_current_user',
        coalesce((
          select owned_by_current_user
          from relation_ownership
          where schema_name = 'public'
            and relation_name = 'product_orders'
        ), false),
      'private_schema_present',
        schema_ownership.private_schema_present,
      'private_schema_owned_by_current_user',
        schema_ownership.private_schema_owned_by_current_user,
      'private_schema_owned_by_function_owner',
        schema_ownership.private_schema_owned_by_function_owner,
      'completion_proofs_owned_by_current_user',
        coalesce((
          select owned_by_current_user
          from relation_ownership
          where schema_name = 'line_pay_private'
            and relation_name = 'line_pay_completion_proofs'
        ), false),
      'completion_proofs_owned_by_function_owner',
        coalesce((
          select owned_by_function_owner
          from relation_ownership
          where schema_name = 'line_pay_private'
            and relation_name = 'line_pay_completion_proofs'
        ), false)
    ),
  'acl_probe',
    pg_catalog.jsonb_build_object(
      'active_runtime_write_acl_present',
        coalesce(active_relation_write_acl.write_acl_present, false),
      'line_pay_runtime_acl_drift_present',
        coalesce(
          line_pay_unexpected_acl.unexpected_runtime_acl_present,
          false
        ),
      'private_schema_explicit_acl_present',
        schema_ownership.private_schema_explicit_acl_present
    ),
  'decision',
    pg_catalog.jsonb_build_object(
      'recovery_expected_to_need_role_bridge',
        schema_ownership.private_schema_owned_by_function_owner
        or coalesce((
          select owned_by_function_owner
          from relation_ownership
          where schema_name = 'line_pay_private'
            and relation_name = 'line_pay_completion_proofs'
        ), false),
      'role_bridge_available',
        capability_summary.function_owner_admin_option_present,
      'active_relation_owner_precondition_met',
        coalesce((
          select bool_and(owned_by_current_user)
          from relation_ownership
          where (schema_name, relation_name) in (
            ('public', 'payments'),
            ('public', 'product_orders')
          )
        ), false),
      'diagnostic_supports_next_recovery_decision',
        inventory.relations_present = 9
        and inventory.roles_present = 2
    )
) as diagnostic_result
from inventory
cross join capability_summary
cross join schema_ownership
cross join active_relation_write_acl
cross join line_pay_unexpected_acl;

ROLLBACK;
