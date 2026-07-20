with target_table as (
  select c.oid as table_oid, c.relrowsecurity as rls_enabled
  from pg_catalog.pg_class as c
  join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'profiles' and c.relkind in ('r', 'p')
),
profiles_columns as (
  select column_name from information_schema.columns
  where table_schema = 'public' and table_name = 'profiles'
),
target_policy_rows as (
  select
    p.polcmd::text as command,
    pg_catalog.pg_get_expr(p.polqual, p.polrelid) as using_expression,
    pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid) as with_check_expression,
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
    max(command) as command,
    max(using_expression) as using_expression,
    max(with_check_expression) as with_check_expression,
    coalesce(
      (select roles from target_policy_rows limit 1),
      array[]::text[]
    ) as roles
  from target_policy_rows
),
profiles_facts as (
  select
    exists(select 1 from target_table) as profiles_exists,
    coalesce((select rls_enabled from target_table), false) as rls_enabled,
    coalesce((select pg_catalog.has_table_privilege('anon', table_oid, 'UPDATE') from target_table), false) as anon_update,
    coalesce((select pg_catalog.has_table_privilege('authenticated', table_oid, 'UPDATE') from target_table), false) as authenticated_update,
    coalesce((select pg_catalog.has_column_privilege('authenticated', table_oid, 'is_admin', 'UPDATE') from target_table), false) as authenticated_is_admin_update,
    coalesce((
      select bool_or(pg_catalog.has_column_privilege('authenticated', target_table.table_oid, profiles_columns.column_name, 'UPDATE'))
      from target_table cross join profiles_columns
    ), false) as authenticated_any_column_update,
    coalesce((select pg_catalog.has_table_privilege('authenticated', table_oid, 'SELECT') from target_table), false) as authenticated_select,
    coalesce((select pg_catalog.has_table_privilege('service_role', table_oid, 'SELECT') from target_table), false) as service_role_select,
    coalesce((select pg_catalog.has_table_privilege('service_role', table_oid, 'INSERT') from target_table), false) as service_role_insert,
    coalesce((select pg_catalog.has_table_privilege('service_role', table_oid, 'UPDATE') from target_table), false) as service_role_update
),
function_candidates as (
  select
    p.oid,
    n.nspname as schema_name,
    p.proname as function_name,
    pg_catalog.pg_get_function_identity_arguments(p.oid) as identity_arguments,
    pg_catalog.pg_get_function_result(p.oid) as return_type,
    l.lanname as language,
    pg_catalog.pg_get_userbyid(p.proowner) as owner,
    p.proowner,
    p.prosecdef as security_definer,
    case p.provolatile when 'i' then 'IMMUTABLE' when 's' then 'STABLE' else 'VOLATILE' end as volatility,
    case p.proparallel when 's' then 'SAFE' when 'r' then 'RESTRICTED' else 'UNSAFE' end as parallel,
    p.proleakproof as leakproof,
    p.proconfig,
    p.proacl as raw_acl,
    pg_catalog.pg_get_functiondef(p.oid) as definition
  from pg_catalog.pg_proc as p
  join pg_catalog.pg_namespace as n on n.oid = p.pronamespace
  join pg_catalog.pg_language as l on l.oid = p.prolang
  where n.nspname = 'public' and p.proname = 'is_admin'
),
target_function as (
  select * from function_candidates where identity_arguments = ''
),
function_facts as (
  select
    'public'::text as schema_name,
    'is_admin'::text as function_name,
    coalesce((select identity_arguments from target_function), '') as identity_arguments,
    (select count(*)::integer from target_function) as function_oid_count,
    ((select count(*) from function_candidates) - (select count(*) from target_function))::integer as overload_count,
    (select return_type from target_function) as return_type,
    (select language from target_function) as language,
    (select owner from target_function) as owner,
    coalesce((select security_definer from target_function), false) as security_definer,
    (select volatility from target_function) as volatility,
    (select parallel from target_function) as parallel,
    coalesce((select leakproof from target_function), false) as leakproof,
    coalesce((select proconfig from target_function), array[]::text[]) as proconfig,
    (select regexp_replace(setting, '^search_path=', '') from target_function cross join lateral unnest(proconfig) as setting where setting like 'search_path=%') as search_path,
    (select raw_acl from target_function) as raw_acl,
    coalesce((
      select exists(
        select 1 from pg_catalog.aclexplode(coalesce(raw_acl, pg_catalog.acldefault('f', proowner)))
        where grantee = 0 and privilege_type = 'EXECUTE'
      ) from target_function
    ), false) as public_execute,
    coalesce((select pg_catalog.has_function_privilege('anon', oid, 'EXECUTE') from target_function), false) as anon_execute,
    coalesce((select pg_catalog.has_function_privilege('authenticated', oid, 'EXECUTE') from target_function), false) as authenticated_execute,
    coalesce((select pg_catalog.has_function_privilege('service_role', oid, 'EXECUTE') from target_function), false) as service_role_execute,
    coalesce((select pg_catalog.has_function_privilege(owner, oid, 'EXECUTE') from target_function), false) as owner_execute,
    (select definition from target_function) as definition
),
public_schema_target as (
  select oid, nspowner, nspacl, pg_catalog.pg_get_userbyid(nspowner) as owner
  from pg_catalog.pg_namespace where nspname = 'public'
),
public_schema_facts as (
  select
    coalesce((select owner from public_schema_target), '') as owner,
    coalesce((
      select exists(
        select 1 from pg_catalog.aclexplode(coalesce(nspacl, pg_catalog.acldefault('n', nspowner)))
        where grantee = 0 and privilege_type = 'CREATE'
      ) from public_schema_target
    ), false) as public_create,
    coalesce((select pg_catalog.has_schema_privilege('anon', oid, 'CREATE') from public_schema_target), false) as anon_create,
    coalesce((select pg_catalog.has_schema_privilege('authenticated', oid, 'CREATE') from public_schema_target), false) as authenticated_create
),
expected_policy_references(schema_name, table_name, policy_name) as (
  values
    ('public', 'ai_chart_reports', 'ai_chart_reports_select_own_or_admin'),
    ('public', 'booking_notices', 'admin_manage_notices'),
    ('public', 'booking_notices', 'public_read_active_notices'),
    ('public', 'booking_settings', 'admin_manage_booking_settings'),
    ('public', 'bookings', 'bookings_select_own_or_admin'),
    ('public', 'bookings', 'bookings_update_own_or_admin'),
    ('public', 'chart_profiles', 'chart_profiles_delete_own_or_admin'),
    ('public', 'chart_profiles', 'chart_profiles_select_own_or_admin'),
    ('public', 'chart_profiles', 'chart_profiles_update_own_or_admin'),
    ('public', 'consultation_plans', 'admin_manage_plans'),
    ('public', 'consultation_plans', 'public_read_active_plans'),
    ('public', 'course_group_links', 'admin_manage_course_group_links'),
    ('public', 'course_lessons', 'admin_manage_course_lessons'),
    ('public', 'course_modules', 'admin_manage_course_modules'),
    ('public', 'course_modules', 'course_modules_select_published_or_admin'),
    ('public', 'courses', 'admin_manage_courses'),
    ('public', 'courses', 'public_read_active_courses'),
    ('public', 'divination_readings', 'divination_readings_select_own_or_admin'),
    ('public', 'lesson_assets', 'admin_manage_lesson_assets'),
    ('public', 'payments', 'payments_select_own_or_admin'),
    ('public', 'point_transactions', 'point_transactions_select_own_or_admin'),
    ('public', 'point_wallets', 'point_wallets_select_own_or_admin'),
    ('public', 'profiles', 'profiles_select_own_or_admin'),
    ('public', 'profiles', 'profiles_update_own_or_admin')
),
policy_references_raw as (
  select n.nspname as schema_name, c.relname as table_name, p.polname as policy_name
  from pg_catalog.pg_depend as d
  join target_function on target_function.oid = d.refobjid
  join pg_catalog.pg_policy as p on p.oid = d.objid
  join pg_catalog.pg_class as c on c.oid = p.polrelid
  join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
  where d.classid = 'pg_catalog.pg_policy'::regclass
    and d.refclassid = 'pg_catalog.pg_proc'::regclass
),
policy_references_unique as (
  select distinct schema_name, table_name, policy_name from policy_references_raw
),
policy_reference_contract as (
  select not exists(
    (select * from expected_policy_references except select * from policy_references_unique)
    union all
    (select * from policy_references_unique except select * from expected_policy_references)
  ) as matches
),
policy_reference_json as (
  select coalesce(jsonb_agg(jsonb_build_object('schema', schema_name, 'table', table_name, 'policy', policy_name) order by schema_name, table_name, policy_name), '[]'::jsonb) as references
  from policy_references_raw
),
function_contract as (
  select
    function_oid_count = 1
    and overload_count = 0
    and schema_name = 'public'
    and function_name = 'is_admin'
    and identity_arguments = ''
    and return_type = 'boolean'
    and language = 'sql'
    and function_facts.owner = 'postgres'
    and security_definer
    and volatility = 'STABLE'
    and parallel = 'UNSAFE'
    and not leakproof
    and proconfig = array['search_path=public']::text[]
    and search_path = 'public'
    and raw_acl is null
    and public_execute and anon_execute and authenticated_execute and service_role_execute and owner_execute
    and btrim(replace(definition, E'\r\n', E'\n'), E'\r\n') = $approved$CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and is_admin = true
  );
$function$$approved$
    and public_schema_facts.owner = 'pg_database_owner'
    and not public_schema_facts.public_create
    and not public_schema_facts.anon_create
    and not public_schema_facts.authenticated_create as matches
  from function_facts cross join public_schema_facts
),
profiles_contract as (
  select
    profiles_exists and rls_enabled and not anon_update
    and not authenticated_update and not authenticated_is_admin_update and not authenticated_any_column_update
    and authenticated_select and service_role_select and service_role_insert and service_role_update
    and target_policy.count = 1 and target_policy.command = 'w'
    and target_policy.roles = array['authenticated']::text[]
    and regexp_replace(replace(lower(target_policy.using_expression), 'public.is_admin', 'is_admin'), '[[:space:]()]', '', 'g') in (
      'auth.uid=idoris_admin',
      'selectauth.uid=idorselectis_admin',
      'selectauth.uidasuid=idorselectis_adminasis_admin'
    )
    and regexp_replace(replace(lower(target_policy.with_check_expression), 'public.is_admin', 'is_admin'), '[[:space:]()]', '', 'g') in (
      'auth.uid=idoris_admin',
      'selectauth.uid=idorselectis_admin',
      'selectauth.uidasuid=idorselectis_adminasis_admin'
    )
    and regexp_replace(replace(lower(target_policy.using_expression), 'public.is_admin', 'is_admin'), '[[:space:]()]', '', 'g')
      = regexp_replace(replace(lower(target_policy.with_check_expression), 'public.is_admin', 'is_admin'), '[[:space:]()]', '', 'g') as matches
  from profiles_facts cross join target_policy
),
classification as (
  select case
    when not function_contract.matches then 'IS_ADMIN_FUNCTION_DRIFT'
    when not policy_reference_contract.matches then 'POLICY_REFERENCE_DRIFT'
    when not profiles_contract.matches then 'PROFILES_PRECONDITION_DRIFT'
    else 'SECURE_EXPECTED'
  end as status
  from function_contract cross join policy_reference_contract cross join profiles_contract
)
select jsonb_build_object(
  'status', classification.status,
  'profiles', jsonb_build_object(
    'profiles_exists', profiles_facts.profiles_exists,
    'rls_enabled', profiles_facts.rls_enabled,
    'anon_update', profiles_facts.anon_update,
    'authenticated_update', profiles_facts.authenticated_update,
    'authenticated_is_admin_update', profiles_facts.authenticated_is_admin_update,
    'authenticated_any_column_update', profiles_facts.authenticated_any_column_update,
    'authenticated_select', profiles_facts.authenticated_select,
    'service_role_select', profiles_facts.service_role_select,
    'service_role_insert', profiles_facts.service_role_insert,
    'service_role_update', profiles_facts.service_role_update
  ),
  'target_policy', jsonb_build_object(
    'count', target_policy.count,
    'command', target_policy.command,
    'roles', target_policy.roles,
    'using_expression', target_policy.using_expression,
    'with_check_expression', target_policy.with_check_expression
  ),
  'function', jsonb_build_object(
    'schema', function_facts.schema_name,
    'function_name', function_facts.function_name,
    'identity_arguments', function_facts.identity_arguments,
    'function_oid_count', function_facts.function_oid_count,
    'overload_count', function_facts.overload_count,
    'return_type', function_facts.return_type,
    'language', function_facts.language,
    'owner', function_facts.owner,
    'security_definer', function_facts.security_definer,
    'volatility', function_facts.volatility,
    'parallel', function_facts.parallel,
    'leakproof', function_facts.leakproof,
    'proconfig', function_facts.proconfig,
    'search_path', function_facts.search_path,
    'raw_acl', function_facts.raw_acl,
    'public_execute', function_facts.public_execute,
    'anon_execute', function_facts.anon_execute,
    'authenticated_execute', function_facts.authenticated_execute,
    'service_role_execute', function_facts.service_role_execute,
    'owner_execute', function_facts.owner_execute,
    'definition', function_facts.definition
  ),
  'public_schema', jsonb_build_object(
    'owner', public_schema_facts.owner,
    'public_create', public_schema_facts.public_create,
    'anon_create', public_schema_facts.anon_create,
    'authenticated_create', public_schema_facts.authenticated_create
  ),
  'policy_references', policy_reference_json.references
) as audit_result
from classification
cross join profiles_facts
cross join target_policy
cross join function_facts
cross join public_schema_facts
cross join policy_reference_json;
