with target_table as (
  select
    c.oid as table_oid,
    c.relrowsecurity as rls_enabled
  from pg_catalog.pg_class as c
  join pg_catalog.pg_namespace as n
    on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'profiles'
    and c.relkind in ('r', 'p')
),
profiles_columns as (
  select profile_column.column_name
  from information_schema.columns as profile_column
  where profile_column.table_schema = 'public'
    and profile_column.table_name = 'profiles'
),
target_policy as (
  select
    p.polcmd::text as command,
    pg_catalog.pg_get_expr(p.polqual, p.polrelid) as using_expression,
    pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid) as with_check_expression,
    array(
      select
        case
          when role_oid = 0 then 'public'
          else roles.rolname
        end
      from unnest(p.polroles) as policy_roles(role_oid)
      left join pg_catalog.pg_roles as roles
        on roles.oid = policy_roles.role_oid
      order by 1
    ) as role_names
  from pg_catalog.pg_policy as p
  join target_table
    on target_table.table_oid = p.polrelid
  where p.polname = 'profiles_update_own_or_admin'
),
acl_facts as (
  select
    exists(select 1 from target_table) as profiles_exists,
    coalesce((select rls_enabled from target_table), false) as rls_enabled,
    coalesce(
      (
        select pg_catalog.has_table_privilege('anon', table_oid, 'UPDATE')
        from target_table
      ),
      false
    ) as anon_update,
    coalesce(
      (
        select pg_catalog.has_table_privilege('authenticated', table_oid, 'UPDATE')
        from target_table
      ),
      false
    ) as authenticated_update,
    coalesce(
      (
        select pg_catalog.has_column_privilege(
          'authenticated',
          table_oid,
          'is_admin',
          'UPDATE'
        )
        from target_table
      ),
      false
    ) as authenticated_is_admin_update,
    coalesce(
      (
        select bool_or(
          pg_catalog.has_column_privilege(
            'authenticated',
            target_table.table_oid,
            profiles_columns.column_name,
            'UPDATE'
          )
        )
        from profiles_columns
        cross join target_table
      ),
      false
    ) as authenticated_any_column_update,
    coalesce(
      (
        select pg_catalog.has_table_privilege('authenticated', table_oid, 'SELECT')
        from target_table
      ),
      false
    ) as authenticated_select,
    coalesce(
      (
        select pg_catalog.has_table_privilege('service_role', table_oid, 'SELECT')
        from target_table
      ),
      false
    ) as service_role_select,
    coalesce(
      (
        select pg_catalog.has_table_privilege('service_role', table_oid, 'INSERT')
        from target_table
      ),
      false
    ) as service_role_insert,
    coalesce(
      (
        select pg_catalog.has_table_privilege('service_role', table_oid, 'UPDATE')
        from target_table
      ),
      false
    ) as service_role_update
),
normalized_policy as (
  select
    command,
    role_names,
    using_expression,
    with_check_expression,
    regexp_replace(
      regexp_replace(
        replace(lower(using_expression), 'public.is_admin', 'is_admin'),
        '[[:space:]]+',
        '',
        'g'
      ),
      '[()]',
      '',
      'g'
    ) as normalized_using_expression,
    case
      when with_check_expression is null then null
      else regexp_replace(
        regexp_replace(
          replace(lower(with_check_expression), 'public.is_admin', 'is_admin'),
          '[[:space:]]+',
          '',
          'g'
        ),
        '[()]',
        '',
        'g'
      )
    end as normalized_with_check_expression
  from target_policy
),
policy_facts as (
  select
    (select count(*) from normalized_policy) = 1 as policy_exists_once,
    coalesce((select command = 'w' from normalized_policy), false)
      as command_is_update,
    coalesce(
      (select role_names = array['authenticated']::text[] from normalized_policy),
      false
    ) as roles_are_authenticated,
    coalesce((select using_expression is not null from normalized_policy), false)
      as using_exists,
    coalesce(
      (select with_check_expression is not null from normalized_policy),
      false
    ) as with_check_exists,
    coalesce(
      (
        select normalized_using_expression in (
          'auth.uid=idoris_admin',
          'selectauth.uid=idorselectis_admin',
          'selectauth.uidasuid=idorselectis_adminasis_admin'
        )
        from normalized_policy
      ),
      false
    ) as using_is_approved_applied_policy,
    coalesce(
      (
        select normalized_with_check_expression in (
          'auth.uid=idoris_admin',
          'selectauth.uid=idorselectis_admin',
          'selectauth.uidasuid=idorselectis_adminasis_admin'
        )
        from normalized_policy
      ),
      false
    ) as with_check_is_approved_applied_policy,
    coalesce(
      (
        select normalized_using_expression = normalized_with_check_expression
        from normalized_policy
      ),
      false
    ) as policy_conditions_match
),
classification as (
  select
    case
      when
        acl_facts.profiles_exists
        and acl_facts.rls_enabled
        and not acl_facts.anon_update
        and not acl_facts.authenticated_update
        and not acl_facts.authenticated_is_admin_update
        and not acl_facts.authenticated_any_column_update
        and acl_facts.authenticated_select
        and acl_facts.service_role_select
        and acl_facts.service_role_insert
        and acl_facts.service_role_update
        and policy_facts.policy_exists_once
        and policy_facts.command_is_update
        and policy_facts.roles_are_authenticated
        and policy_facts.using_exists
        and policy_facts.with_check_exists
        and policy_facts.using_is_approved_applied_policy
        and policy_facts.with_check_is_approved_applied_policy
        and policy_facts.policy_conditions_match
      then 'POSTFLIGHT_OK'
      else 'POSTFLIGHT_FAILED'
    end as state
  from acl_facts
  cross join policy_facts
)
select state as profiles_admin_deployment_state
from classification;
