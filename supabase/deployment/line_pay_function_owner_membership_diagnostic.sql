\set ON_ERROR_STOP on
\set QUIET on
\pset format unaligned
\pset tuples_only on

BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY;

with
role_identity as (
  select
    pg_catalog.to_regrole(
      'line_pay_payment_function_owner'
    )::oid as owner_oid,
    pg_catalog.to_regrole(
      'line_pay_payment_executor'
    )::oid as executor_oid,
    (
      select role.oid
      from pg_catalog.pg_roles as role
      where role.rolname = current_user
    ) as current_user_oid
),
membership_edges as (
  select
    membership.roleid,
    membership.member,
    membership.grantor,
    membership.admin_option,
    membership.inherit_option,
    membership.set_option,
    membership.roleid = role_identity.owner_oid
      as owner_as_granted_role,
    membership.member = role_identity.owner_oid
      as owner_as_member_role,
    case
      when membership.member = role_identity.current_user_oid
        then 'current_user'
      when membership.member = role_identity.executor_oid
        then 'executor'
      when exists (
        select 1
        from pg_catalog.pg_roles as runtime_role
        where runtime_role.oid = membership.member
          and runtime_role.rolname in (
            'anon',
            'authenticated',
            'service_role'
          )
      ) then 'runtime_role'
      else 'other'
    end as granted_target_category,
    case
      when membership.roleid = role_identity.current_user_oid
        then 'current_user'
      when membership.roleid = role_identity.executor_oid
        then 'executor'
      when exists (
        select 1
        from pg_catalog.pg_roles as runtime_role
        where runtime_role.oid = membership.roleid
          and runtime_role.rolname in (
            'anon',
            'authenticated',
            'service_role'
          )
      ) then 'runtime_role'
      else 'other'
    end as owner_parent_category,
    case
      when membership.grantor = role_identity.current_user_oid
        then 'current_user'
      when membership.grantor = role_identity.owner_oid
        then 'owner'
      else 'other'
    end as grantor_category
  from pg_catalog.pg_auth_members as membership
  cross join role_identity
  where role_identity.owner_oid is not null
    and (
      membership.roleid = role_identity.owner_oid
      or membership.member = role_identity.owner_oid
    )
),
membership_counts as (
  select
    pg_catalog.count(*)::integer as total_edges,
    pg_catalog.count(*) filter (
      where owner_as_granted_role
    )::integer as owner_as_granted_role_edges,
    pg_catalog.count(*) filter (
      where owner_as_member_role
    )::integer as owner_as_member_role_edges,
    pg_catalog.count(*) filter (
      where owner_as_granted_role
        and granted_target_category = 'current_user'
    )::integer as granted_to_current_user_edges,
    pg_catalog.count(*) filter (
      where owner_as_granted_role
        and granted_target_category = 'executor'
    )::integer as granted_to_executor_edges,
    pg_catalog.count(*) filter (
      where owner_as_granted_role
        and granted_target_category = 'runtime_role'
    )::integer as granted_to_runtime_role_edges,
    pg_catalog.count(*) filter (
      where owner_as_granted_role
        and granted_target_category = 'other'
    )::integer as granted_to_other_edges,
    pg_catalog.count(*) filter (
      where owner_as_member_role
        and owner_parent_category = 'current_user'
    )::integer as owner_member_of_current_user_edges,
    pg_catalog.count(*) filter (
      where owner_as_member_role
        and owner_parent_category = 'executor'
    )::integer as owner_member_of_executor_edges,
    pg_catalog.count(*) filter (
      where owner_as_member_role
        and owner_parent_category = 'runtime_role'
    )::integer as owner_member_of_runtime_role_edges,
    pg_catalog.count(*) filter (
      where owner_as_member_role
        and owner_parent_category = 'other'
    )::integer as owner_member_of_other_edges,
    pg_catalog.count(*) filter (
      where grantor_category = 'current_user'
    )::integer as granted_by_current_user_edges,
    pg_catalog.count(*) filter (
      where grantor_category = 'owner'
    )::integer as granted_by_owner_edges,
    pg_catalog.count(*) filter (
      where grantor_category = 'other'
    )::integer as granted_by_other_edges,
    pg_catalog.count(*) filter (
      where admin_option
    )::integer as admin_option_edges,
    pg_catalog.count(*) filter (
      where inherit_option
    )::integer as inherit_option_edges,
    pg_catalog.count(*) filter (
      where set_option
    )::integer as set_option_edges
  from membership_edges
),
decision as (
  select
    role_identity.owner_oid is not null as detail_complete,
    role_identity.owner_oid is not null
      and membership_counts.total_edges = 0
      as membership_absent,
    role_identity.owner_oid is not null
      and membership_counts.total_edges = 1
      and membership_counts.owner_as_granted_role_edges = 1
      and membership_counts.owner_as_member_role_edges = 0
      and membership_counts.granted_to_current_user_edges = 1
      and membership_counts.granted_to_executor_edges = 0
      and membership_counts.granted_to_runtime_role_edges = 0
      and membership_counts.granted_to_other_edges = 0
      and membership_counts.granted_by_current_user_edges = 1
      and membership_counts.granted_by_owner_edges = 0
      and membership_counts.granted_by_other_edges = 0
      and membership_counts.admin_option_edges = 1
      and membership_counts.inherit_option_edges = 0
      and membership_counts.set_option_edges = 0
      as single_current_user_grant_only
  from role_identity
  cross join membership_counts
)
select pg_catalog.jsonb_build_object(
  'status',
    'LINE_PAY_FUNCTION_OWNER_MEMBERSHIP_DIAGNOSTIC_COMPLETED',
  'database_identity_match',
    pg_catalog.current_database() = 'postgres'
    and not pg_catalog.pg_is_in_recovery(),
  'role_present', role_identity.owner_oid is not null,
  'membership', pg_catalog.to_jsonb(membership_counts),
  'decision', pg_catalog.jsonb_build_object(
    'detail_complete', decision.detail_complete,
    'membership_absent', decision.membership_absent,
    'single_current_user_grant_only',
      decision.single_current_user_grant_only,
    'manual_review_required',
      decision.detail_complete
      and not decision.membership_absent
      and not decision.single_current_user_grant_only
  )
)::text
from role_identity
cross join membership_counts
cross join decision;

ROLLBACK;
