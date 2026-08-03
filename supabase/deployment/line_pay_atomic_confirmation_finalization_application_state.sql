\set ON_ERROR_STOP on
\set QUIET on
\pset format unaligned
\pset tuples_only on

with catalog_state as (
  select
    pg_catalog.current_database() = 'postgres' as database_identity_match,
    (
      select pg_catalog.count(*)::integer
      from (values
        ('public.initialize_product_order_line_pay_checkout(jsonb)'),
        ('public.record_product_order_line_pay_confirmation_evidence(text,uuid,uuid,text,text,text)'),
        ('public.complete_product_order_line_pay_confirmation(text,uuid,uuid,uuid,text,text,integer,text,uuid,uuid,uuid,text,text,jsonb,timestamp with time zone)'),
        ('public.line_pay_audit_evidence_is_valid(jsonb)'),
        ('public.line_pay_sanitized_result_is_valid(jsonb)')
      ) as dependency(signature)
      where pg_catalog.to_regprocedure(dependency.signature) is not null
    ) as dependency_functions_present,
    (
      select pg_catalog.count(*)::integer
      from pg_catalog.pg_roles as role
      where role.rolname in (
        'line_pay_payment_executor',
        'line_pay_payment_function_owner',
        'authenticator'
      )
    ) as required_roles_present,
    (
      select pg_catalog.count(*)::integer
      from pg_catalog.pg_namespace as namespace
      join pg_catalog.pg_roles as owner
        on owner.oid = namespace.nspowner
      where namespace.nspname = 'line_pay_private'
        and owner.rolname = 'line_pay_payment_function_owner'
    ) as private_schema_owner_matches,
    (
      select pg_catalog.count(*)::integer
      from pg_catalog.pg_proc as procedure
      join pg_catalog.pg_namespace as namespace
        on namespace.oid = procedure.pronamespace
      where namespace.nspname = 'public'
        and procedure.proname =
          'finalize_product_order_line_pay_confirmation'
    ) as wrapper_functions_present,
    (
      select pg_catalog.count(*)::integer
      from pg_catalog.pg_proc as procedure
      join pg_catalog.pg_namespace as namespace
        on namespace.oid = procedure.pronamespace
      join pg_catalog.pg_roles as owner
        on owner.oid = procedure.proowner
      where namespace.nspname = 'public'
        and procedure.proname =
          'finalize_product_order_line_pay_confirmation'
        and pg_catalog.oidvectortypes(procedure.proargtypes) =
          'text, uuid, uuid, uuid, text, text, integer, text, uuid, uuid, uuid, text, text'
        and owner.rolname = 'line_pay_payment_function_owner'
        and procedure.prosecdef
        and procedure.provolatile = 'v'
        and procedure.proconfig is not null
        and 'search_path=""' = any (procedure.proconfig)
    ) as wrapper_contract_matches,
    (
      select pg_catalog.count(*)::integer
      from pg_catalog.pg_proc as procedure
      join pg_catalog.pg_namespace as namespace
        on namespace.oid = procedure.pronamespace
      join pg_catalog.pg_roles as owner
        on owner.oid = procedure.proowner
      where namespace.nspname = 'public'
        and procedure.proname in (
          'record_product_order_line_pay_confirmation_evidence',
          'complete_product_order_line_pay_confirmation'
        )
        and owner.rolname = 'line_pay_payment_function_owner'
        and not pg_catalog.has_function_privilege(
          'line_pay_payment_executor', procedure.oid, 'execute'
        )
        and not pg_catalog.has_function_privilege(
          'service_role', procedure.oid, 'execute'
        )
        and not pg_catalog.has_function_privilege(
          'authenticated', procedure.oid, 'execute'
        )
        and not pg_catalog.has_function_privilege(
          'anon', procedure.oid, 'execute'
        )
        and not exists (
          select 1
          from pg_catalog.aclexplode(procedure.proacl) as acl
          where acl.grantee = 0
            and acl.privilege_type = 'EXECUTE'
        )
    ) as restricted_core_functions,
    (
      select pg_catalog.count(*)::integer
      from pg_catalog.pg_auth_members as membership
      join pg_catalog.pg_roles as granted_role
        on granted_role.oid = membership.roleid
      join pg_catalog.pg_roles as member_role
        on member_role.oid = membership.member
      join pg_catalog.pg_roles as grantor_role
        on grantor_role.oid = membership.grantor
      where granted_role.rolname = 'line_pay_payment_executor'
        and member_role.rolname = 'authenticator'
        and grantor_role.rolname = current_user
        and not membership.admin_option
        and not membership.inherit_option
        and membership.set_option
    ) as authenticator_executor_memberships,
    (
      select pg_catalog.count(*)::integer
      from pg_catalog.pg_auth_members as membership
      join pg_catalog.pg_roles as granted_role
        on granted_role.oid = membership.roleid
      join pg_catalog.pg_roles as member_role
        on member_role.oid = membership.member
      join pg_catalog.pg_roles as grantor_role
        on grantor_role.oid = membership.grantor
      where (
        granted_role.rolname in (
          'line_pay_payment_executor',
          'line_pay_payment_function_owner'
        )
        or member_role.rolname in (
          'line_pay_payment_executor',
          'line_pay_payment_function_owner'
        )
      )
        and not (
          granted_role.rolname = 'line_pay_payment_executor'
          and member_role.rolname = 'authenticator'
          and grantor_role.rolname = current_user
          and not membership.admin_option
          and not membership.inherit_option
          and membership.set_option
        )
        and not (
          granted_role.rolname in (
            'line_pay_payment_executor',
            'line_pay_payment_function_owner'
          )
          and member_role.rolname = current_user
          and grantor_role.rolsuper
          and membership.admin_option
          and not membership.inherit_option
          and not membership.set_option
        )
    ) as unexpected_dedicated_role_memberships,
    (
      select pg_catalog.count(*)::integer
      from pg_catalog.pg_auth_members as membership
      join pg_catalog.pg_roles as granted_role
        on granted_role.oid = membership.roleid
      join pg_catalog.pg_roles as member_role
        on member_role.oid = membership.member
      join pg_catalog.pg_roles as grantor_role
        on grantor_role.oid = membership.grantor
      where granted_role.rolname = 'line_pay_payment_function_owner'
        and member_role.rolname = current_user
        and grantor_role.rolname = current_user
    ) as temporary_owner_memberships,
    (
      select pg_catalog.count(*)::integer
      from pg_catalog.pg_roles as role
      where role.rolname in (
        'line_pay_payment_executor',
        'line_pay_payment_function_owner'
      )
        and not role.rolcanlogin
        and not role.rolinherit
        and not role.rolsuper
        and not role.rolcreatedb
        and not role.rolcreaterole
        and not role.rolreplication
        and not role.rolbypassrls
        and role.rolconnlimit = -1
        and role.rolconfig is null
        and role.rolvaliduntil is null
    ) as safe_dedicated_roles,
    (
      select pg_catalog.count(*)::integer
      from pg_catalog.pg_class as relation
      join pg_catalog.pg_roles as owner
        on owner.oid = relation.relowner
      where owner.rolname = 'line_pay_payment_executor'
    ) as executor_owned_relations,
    (
      select pg_catalog.count(*)::integer
      from pg_catalog.pg_class as relation
      cross join lateral pg_catalog.aclexplode(relation.relacl) as acl
      join pg_catalog.pg_roles as grantee
        on grantee.oid = acl.grantee
      where grantee.rolname = 'line_pay_payment_executor'
    ) + (
      select pg_catalog.count(*)::integer
      from pg_catalog.pg_attribute as attribute
      cross join lateral pg_catalog.aclexplode(attribute.attacl) as acl
      join pg_catalog.pg_roles as grantee
        on grantee.oid = acl.grantee
      where grantee.rolname = 'line_pay_payment_executor'
    ) as executor_relation_acl_entries,
    (
      select pg_catalog.count(*)::integer
      from pg_catalog.pg_proc as procedure
      join pg_catalog.pg_roles as owner
        on owner.oid = procedure.proowner
      where owner.rolname = 'line_pay_payment_function_owner'
        and pg_catalog.has_function_privilege(
          'line_pay_payment_executor', procedure.oid, 'execute'
        )
    ) as executor_executable_owner_functions,
    coalesce((
      select
        pg_catalog.has_function_privilege(
          'line_pay_payment_executor', procedure.oid, 'execute'
        )
        and not pg_catalog.has_function_privilege(
          'service_role', procedure.oid, 'execute'
        )
        and not pg_catalog.has_function_privilege(
          'authenticated', procedure.oid, 'execute'
        )
        and not pg_catalog.has_function_privilege(
          'anon', procedure.oid, 'execute'
        )
        and not exists (
          select 1
          from pg_catalog.aclexplode(procedure.proacl) as acl
          where acl.privilege_type = 'EXECUTE'
            and acl.grantee not in (
              procedure.proowner,
              pg_catalog.to_regrole('line_pay_payment_executor')::oid
            )
        )
      from pg_catalog.pg_proc as procedure
      where procedure.oid = pg_catalog.to_regprocedure(
        'public.finalize_product_order_line_pay_confirmation(text,uuid,uuid,uuid,text,text,integer,text,uuid,uuid,uuid,text,text)'
      )
    ), false) as wrapper_acl_exact,
    (
      pg_catalog.has_function_privilege(
        'line_pay_payment_function_owner',
        'public.line_pay_audit_evidence_is_valid(jsonb)',
        'execute'
      )
      and pg_catalog.has_function_privilege(
        'line_pay_payment_function_owner',
        'public.line_pay_sanitized_result_is_valid(jsonb)',
        'execute'
      )
    ) as validator_acl_ready,
    (
      not pg_catalog.has_table_privilege(
        'line_pay_payment_executor',
        'public.payments',
        'select,insert,update,delete'
      )
      and not pg_catalog.has_table_privilege(
        'line_pay_payment_executor',
        'line_pay_private.line_pay_completion_proofs',
        'select,insert,update,delete'
      )
      and not pg_catalog.has_schema_privilege(
        'line_pay_payment_executor', 'public', 'create'
      )
      and not pg_catalog.has_schema_privilege(
        'line_pay_payment_executor', 'line_pay_private', 'usage'
      )
      and pg_catalog.has_schema_privilege(
        'line_pay_payment_executor', 'public', 'usage'
      )
    ) as executor_privilege_exact
), evaluated as (
  select *,
    dependency_functions_present = 5
      and required_roles_present = 3
      and private_schema_owner_matches = 1
      and validator_acl_ready
      as base_ready,
    wrapper_functions_present = 1
      and wrapper_contract_matches = 1
      and wrapper_acl_exact
      and restricted_core_functions = 2
      and authenticator_executor_memberships = 1
      and unexpected_dedicated_role_memberships = 0
      and temporary_owner_memberships = 0
      and safe_dedicated_roles = 2
      and executor_owned_relations = 0
      and executor_relation_acl_entries = 0
      and executor_executable_owner_functions = 1
      and executor_privilege_exact
      as atomic_exact
  from catalog_state
)
select pg_catalog.jsonb_build_object(
  'status', 'ATOMIC_FINALIZATION_STATE_DIAGNOSTIC_COMPLETED',
  'database_identity_match', database_identity_match,
  'inventory', pg_catalog.jsonb_build_object(
    'dependency_functions_present', dependency_functions_present,
    'required_roles_present', required_roles_present,
    'private_schema_owner_matches', private_schema_owner_matches,
    'wrapper_functions_present', wrapper_functions_present,
    'wrapper_contract_matches', wrapper_contract_matches,
    'restricted_core_functions', restricted_core_functions,
    'authenticator_executor_memberships', authenticator_executor_memberships,
    'unexpected_dedicated_role_memberships',
      unexpected_dedicated_role_memberships,
    'temporary_owner_memberships', temporary_owner_memberships,
    'safe_dedicated_roles', safe_dedicated_roles,
    'executor_owned_relations', executor_owned_relations,
    'executor_relation_acl_entries', executor_relation_acl_entries,
    'executor_executable_owner_functions',
      executor_executable_owner_functions
  ),
  'contracts', pg_catalog.jsonb_build_object(
    'base_ready', base_ready,
    'wrapper_acl_exact', wrapper_acl_exact,
    'validator_acl_ready', validator_acl_ready,
    'executor_privilege_exact', executor_privilege_exact,
    'atomic_exact', atomic_exact
  ),
  'application_state', case
    when base_ready and atomic_exact then 'FULL'
    when base_ready
      and wrapper_functions_present = 0
      and authenticator_executor_memberships = 0
      and temporary_owner_memberships = 0
    then 'UNAPPLIED'
    else 'PARTIAL'
  end
)::text
from evaluated;
