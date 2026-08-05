\set ON_ERROR_STOP on
\set QUIET on
\pset format unaligned
\pset tuples_only on

do $postflight$
declare
  v_public_function pg_catalog.pg_proc%rowtype;
  v_private_function pg_catalog.pg_proc%rowtype;
  v_target_count integer;
begin
  select procedure.*
  into v_public_function
  from pg_catalog.pg_proc as procedure
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'public'
    and procedure.oid = pg_catalog.to_regprocedure(
      'public.initialize_service_line_pay_checkout(jsonb)'
    );

  select procedure.*
  into v_private_function
  from pg_catalog.pg_proc as procedure
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'line_pay_private'
    and procedure.oid = pg_catalog.to_regprocedure(
      'line_pay_private.record_service_line_pay_checkout_initialized_audit(uuid,uuid,uuid,text)'
    );

  select pg_catalog.count(*)
  into v_target_count
  from pg_catalog.pg_proc as procedure
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = procedure.pronamespace
  where (
    namespace.nspname = 'public'
    and procedure.proname = 'initialize_service_line_pay_checkout'
  ) or (
    namespace.nspname = 'line_pay_private'
    and procedure.proname =
      'record_service_line_pay_checkout_initialized_audit'
  );

  if v_public_function.oid is null
    or v_private_function.oid is null
    or v_target_count <> 2
    or v_public_function.prosecdef
    or v_public_function.provolatile <> 'v'
    or v_public_function.prokind <> 'f'
    or v_public_function.proconfig is distinct from array['search_path=""']::text[]
    or not v_private_function.prosecdef
    or v_private_function.provolatile <> 'v'
    or v_private_function.prokind <> 'f'
    or v_private_function.proconfig is distinct from array['search_path=""']::text[]
    or v_private_function.proowner <>
      pg_catalog.to_regrole('line_pay_payment_function_owner')::oid
    or not pg_catalog.has_function_privilege(
      'service_role',
      v_public_function.oid,
      'EXECUTE'
    )
    or not pg_catalog.has_function_privilege(
      'service_role',
      v_private_function.oid,
      'EXECUTE'
    )
    or pg_catalog.has_function_privilege(
      'anon',
      v_public_function.oid,
      'EXECUTE'
    )
    or pg_catalog.has_function_privilege(
      'authenticated',
      v_public_function.oid,
      'EXECUTE'
    )
    or pg_catalog.has_function_privilege(
      'line_pay_payment_executor',
      v_public_function.oid,
      'EXECUTE'
    )
    or pg_catalog.has_function_privilege(
      'anon',
      v_private_function.oid,
      'EXECUTE'
    )
    or pg_catalog.has_function_privilege(
      'authenticated',
      v_private_function.oid,
      'EXECUTE'
    )
    or pg_catalog.has_function_privilege(
      'line_pay_payment_executor',
      v_private_function.oid,
      'EXECUTE'
    )
    or not (
      not exists (
        select 1
        from pg_catalog.pg_auth_members as membership
        where membership.roleid =
          pg_catalog.to_regrole('line_pay_payment_function_owner')::oid
          or membership.member =
            pg_catalog.to_regrole('line_pay_payment_function_owner')::oid
      )
      or (
        (
          select pg_catalog.count(*)
          from pg_catalog.pg_auth_members as membership
          where membership.roleid =
            pg_catalog.to_regrole('line_pay_payment_function_owner')::oid
            or membership.member =
              pg_catalog.to_regrole('line_pay_payment_function_owner')::oid
        ) = 1
        and exists (
          select 1
          from pg_catalog.pg_auth_members as membership
          join pg_catalog.pg_roles as grantor
            on grantor.oid = membership.grantor
          where membership.roleid =
            pg_catalog.to_regrole('line_pay_payment_function_owner')::oid
            and membership.member = (
              select role.oid
              from pg_catalog.pg_roles as role
              where role.rolname = current_user
            )
            and grantor.rolsuper
            and membership.admin_option
            and not membership.inherit_option
            and not membership.set_option
        )
      )
    )
    or pg_catalog.strpos(
      pg_catalog.pg_get_functiondef(v_public_function.oid),
      'line_pay_service_initialization_target_invalid'
    ) = 0
    or pg_catalog.strpos(
      pg_catalog.pg_get_functiondef(v_private_function.oid),
      'line_pay_service_initialization_audit_binding_invalid'
    ) = 0
  then
    raise exception using
      errcode = '55000',
      message = 'line_pay_service_checkout_postflight_contract_failed';
  end if;
end;
$postflight$;

select 'line_pay_service_checkout_postflight_ready';
