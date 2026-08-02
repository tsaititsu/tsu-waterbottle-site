begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';
set local idle_in_transaction_session_timeout = '30s';

-- This additive migration narrows the paid transition to one atomic RPC.
-- It intentionally leaves request, cancel, and reconciliation capabilities on
-- service_role, while payment evidence + completion remain behind the
-- dedicated NOLOGIN/NOBYPASSRLS executor boundary.
do $$
declare
  v_function_name text;
  v_signature text;
  v_owner text;
begin
  for v_function_name, v_signature in
    select dependency.function_name, dependency.signature
    from (values
      ('record_product_order_line_pay_confirmation_evidence', 'text, uuid, uuid, text, text, text'),
      ('complete_product_order_line_pay_confirmation', 'text, uuid, uuid, uuid, text, text, integer, text, uuid, uuid, uuid, text, text, jsonb, timestamp with time zone'),
      ('line_pay_audit_evidence_is_valid', 'jsonb')
    ) as dependency(function_name, signature)
  loop
    select owner.rolname
    into v_owner
    from pg_catalog.pg_proc as procedure
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = procedure.pronamespace
    join pg_catalog.pg_roles as owner
      on owner.oid = procedure.proowner
    where namespace.nspname = 'public'
      and procedure.proname = v_function_name
      and pg_catalog.oidvectortypes(procedure.proargtypes) = v_signature;

    if v_owner is null then
      raise exception using
        errcode = 'P0002',
        message = 'line_pay_atomic_finalize_dependency_missing';
    end if;

    if v_function_name <> 'line_pay_audit_evidence_is_valid'
       and v_owner not in (current_user, 'line_pay_payment_function_owner') then
      raise exception using
        errcode = '42501',
        message = 'line_pay_atomic_finalize_dependency_owner_invalid';
    end if;
  end loop;

  if not exists (
    select 1
    from pg_catalog.pg_roles
    where rolname = 'line_pay_payment_executor'
      and not rolcanlogin
      and not rolinherit
      and not rolsuper
      and not rolcreatedb
      and not rolcreaterole
      and not rolreplication
      and not rolbypassrls
      and rolconnlimit = -1
      and rolconfig is null
      and rolvaliduntil is null
  ) or not exists (
    select 1
    from pg_catalog.pg_roles
    where rolname = 'line_pay_payment_function_owner'
      and not rolcanlogin
      and not rolinherit
      and not rolsuper
      and not rolcreatedb
      and not rolcreaterole
      and not rolreplication
      and not rolbypassrls
      and rolconnlimit = -1
      and rolconfig is null
      and rolvaliduntil is null
  ) or not exists (
    select 1
    from pg_catalog.pg_roles
    where rolname = 'authenticator'
  ) then
    raise exception using
      errcode = '42501',
      message = 'line_pay_atomic_finalize_role_precondition_failed';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_proc as procedure
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname = 'finalize_product_order_line_pay_confirmation'
  ) then
    raise exception using
      errcode = '42710',
      message = 'line_pay_atomic_finalize_overload_precondition_failed';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_namespace as namespace
    join pg_catalog.pg_roles as owner
      on owner.oid = namespace.nspowner
    where namespace.nspname = 'line_pay_private'
      and owner.rolname = 'line_pay_payment_function_owner'
  ) then
    raise exception using
      errcode = '42501',
      message = 'line_pay_atomic_finalize_private_schema_owner_invalid';
  end if;

  if exists (
    select 1
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
  ) then
    raise exception using
      errcode = '42501',
      message = 'line_pay_atomic_finalize_temporary_membership_conflict';
  end if;
end
$$;

-- PostgreSQL requires temporary SET capability to transfer ownership to the
-- NOLOGIN owner role. The exact current-user grant is removed below without
-- touching the separate Supabase-admin bootstrap membership.
grant line_pay_payment_function_owner to current_user
  with admin false, inherit true, set true;

grant create on schema public to line_pay_payment_function_owner;

alter function public.record_product_order_line_pay_confirmation_evidence(
  text, uuid, uuid, text, text, text
) owner to line_pay_payment_function_owner;

alter function public.complete_product_order_line_pay_confirmation(
  text, uuid, uuid, uuid, text, text, integer, text, uuid, uuid, uuid, text, text, jsonb, timestamptz
) owner to line_pay_payment_function_owner;

grant execute on function public.line_pay_audit_evidence_is_valid(jsonb)
to line_pay_payment_function_owner;

create function public.finalize_product_order_line_pay_confirmation(
  p_environment text,
  p_payment_id uuid,
  p_product_order_id uuid,
  p_attempt_id uuid,
  p_merchant_order_no text,
  p_transaction_id text,
  p_amount_twd integer,
  p_currency text,
  p_capability_id uuid,
  p_callback_event_id uuid,
  p_callback_claim_id uuid,
  p_confirm_result_sha256 text,
  p_request_id text
)
returns table (
  result_code text,
  payment_id uuid,
  product_order_id uuid,
  transaction_id text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_evidence record;
begin
  -- The immutable completion proof is the sole idempotency authority. A
  -- completed retry returns before attempting to record evidence again.
  begin
    return query
    select completion.result_code,
           completion.payment_id,
           completion.product_order_id,
           completion.transaction_id
    from public.complete_product_order_line_pay_confirmation(
      p_environment,
      p_payment_id,
      p_product_order_id,
      p_attempt_id,
      p_merchant_order_no,
      p_transaction_id,
      p_amount_twd,
      p_currency,
      p_capability_id,
      p_callback_event_id,
      p_callback_claim_id,
      p_confirm_result_sha256,
      p_request_id,
      pg_catalog.jsonb_build_object(
        'result_code', 'verified',
        'evidence_sha256', p_confirm_result_sha256
      ),
      null
    ) as completion;
    return;
  exception
    when check_violation or sqlstate '55000' then
      -- A fresh claimed event has no provider evidence yet. Other contract
      -- mismatches continue into the exact evidence + completion path below,
      -- where they still fail closed and roll the entire wrapper back.
      null;
  end;

  -- record_* and complete_* execute in this wrapper's single transaction. A
  -- completion error therefore rolls the provider evidence back as well.
  select evidence.*
  into strict v_evidence
  from public.record_product_order_line_pay_confirmation_evidence(
    p_environment,
    p_callback_event_id,
    p_callback_claim_id,
    p_confirm_result_sha256,
    '0000',
    p_request_id
  ) as evidence;

  if v_evidence.result_code not in ('recorded', 'already_recorded')
     or v_evidence.callback_event_id <> p_callback_event_id
     or v_evidence.provider_result_sha256 <> p_confirm_result_sha256 then
    raise exception using
      errcode = '23514',
      message = 'line_pay_atomic_finalize_evidence_postcondition_failed';
  end if;

  return query
  select completion.result_code,
         completion.payment_id,
         completion.product_order_id,
         completion.transaction_id
  from public.complete_product_order_line_pay_confirmation(
    p_environment,
    p_payment_id,
    p_product_order_id,
    p_attempt_id,
    p_merchant_order_no,
    p_transaction_id,
    p_amount_twd,
    p_currency,
    p_capability_id,
    p_callback_event_id,
    p_callback_claim_id,
    p_confirm_result_sha256,
    p_request_id,
    pg_catalog.jsonb_build_object(
      'result_code', 'verified',
      'evidence_sha256', p_confirm_result_sha256
    ),
    null
  ) as completion;
end;
$$;

alter function public.finalize_product_order_line_pay_confirmation(
  text, uuid, uuid, uuid, text, text, integer, text, uuid, uuid, uuid, text, text
) owner to line_pay_payment_function_owner;

revoke create on schema public from line_pay_payment_function_owner;

revoke execute on function public.record_product_order_line_pay_confirmation_evidence(
  text, uuid, uuid, text, text, text
) from public, anon, authenticated, service_role, line_pay_payment_executor;

revoke execute on function public.complete_product_order_line_pay_confirmation(
  text, uuid, uuid, uuid, text, text, integer, text, uuid, uuid, uuid, text, text, jsonb, timestamptz
) from public, anon, authenticated, service_role, line_pay_payment_executor;

revoke execute on function public.finalize_product_order_line_pay_confirmation(
  text, uuid, uuid, uuid, text, text, integer, text, uuid, uuid, uuid, text, text
) from public, anon, authenticated, service_role, line_pay_payment_executor;

grant execute on function public.finalize_product_order_line_pay_confirmation(
  text, uuid, uuid, uuid, text, text, integer, text, uuid, uuid, uuid, text, text
) to line_pay_payment_executor;

grant line_pay_payment_executor to authenticator
  with admin false, inherit false, set true;

revoke line_pay_payment_function_owner from current_user
  granted by current_user;

do $$
declare
  v_wrapper_oid oid;
begin
  select procedure.oid
  into v_wrapper_oid
  from pg_catalog.pg_proc as procedure
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = procedure.pronamespace
  join pg_catalog.pg_roles as owner
    on owner.oid = procedure.proowner
  where namespace.nspname = 'public'
    and procedure.proname = 'finalize_product_order_line_pay_confirmation'
    and pg_catalog.oidvectortypes(procedure.proargtypes) =
      'text, uuid, uuid, uuid, text, text, integer, text, uuid, uuid, uuid, text, text'
    and owner.rolname = 'line_pay_payment_function_owner'
    and procedure.prosecdef
    and procedure.provolatile = 'v'
    and procedure.proconfig is not null
    and 'search_path=""' = any (procedure.proconfig);

  if v_wrapper_oid is null or (
    select pg_catalog.count(*)
    from pg_catalog.pg_proc as procedure
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname = 'finalize_product_order_line_pay_confirmation'
  ) <> 1 then
    raise exception using
      errcode = '42710',
      message = 'line_pay_atomic_finalize_signature_postcondition_failed';
  end if;

  if not pg_catalog.has_function_privilege(
       'line_pay_payment_executor', v_wrapper_oid, 'execute'
     )
     or pg_catalog.has_function_privilege('service_role', v_wrapper_oid, 'execute')
     or pg_catalog.has_function_privilege('authenticated', v_wrapper_oid, 'execute')
     or pg_catalog.has_function_privilege('anon', v_wrapper_oid, 'execute')
     or exists (
       select 1
       from pg_catalog.aclexplode(
         (select procedure.proacl from pg_catalog.pg_proc as procedure
          where procedure.oid = v_wrapper_oid)
       ) as acl
       where acl.privilege_type = 'EXECUTE'
         and acl.grantee not in (
           (select role.oid from pg_catalog.pg_roles as role
            where role.rolname = 'line_pay_payment_function_owner'),
           (select role.oid from pg_catalog.pg_roles as role
            where role.rolname = 'line_pay_payment_executor')
         )
     ) then
    raise exception using
      errcode = '42501',
      message = 'line_pay_atomic_finalize_acl_postcondition_failed';
  end if;

  if exists (
    select 1
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
      and (
        owner.rolname <> 'line_pay_payment_function_owner'
        or pg_catalog.has_function_privilege(
          'line_pay_payment_executor', procedure.oid, 'execute'
        )
        or pg_catalog.has_function_privilege('service_role', procedure.oid, 'execute')
        or pg_catalog.has_function_privilege('authenticated', procedure.oid, 'execute')
        or pg_catalog.has_function_privilege('anon', procedure.oid, 'execute')
        or exists (
          select 1
          from pg_catalog.aclexplode(procedure.proacl) as public_acl
          where public_acl.grantee = 0
            and public_acl.privilege_type = 'EXECUTE'
        )
      )
  ) then
    raise exception using
      errcode = '42501',
      message = 'line_pay_atomic_finalize_core_rpc_postcondition_failed';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_roles as role
    where role.rolname in (
      'line_pay_payment_executor',
      'line_pay_payment_function_owner'
    )
      and (
        role.rolcanlogin
        or role.rolinherit
        or role.rolsuper
        or role.rolcreatedb
        or role.rolcreaterole
        or role.rolreplication
        or role.rolbypassrls
        or role.rolconnlimit <> -1
        or role.rolconfig is not null
        or role.rolvaliduntil is not null
      )
  ) then
    raise exception using
      errcode = '42501',
      message = 'line_pay_atomic_finalize_role_attribute_postcondition_failed';
  end if;

  -- Keep the role graph exact. Hosted Supabase may retain one ADMIN-only,
  -- non-SET bootstrap membership from a superuser grantor for each dedicated
  -- role. The only new runtime edge is authenticator -> executor with SET.
  if exists (
    select 1
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
  ) or (
    select pg_catalog.count(*)
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
  ) <> 1 or coalesce((
    select case
      when role.rolsuper then bootstrap_membership.membership_count <> 0
      else bootstrap_membership.membership_count <> 2
    end
    from pg_catalog.pg_roles as role
    cross join lateral (
      select pg_catalog.count(*)::integer as membership_count
      from pg_catalog.pg_auth_members as membership
      join pg_catalog.pg_roles as granted_role
        on granted_role.oid = membership.roleid
      join pg_catalog.pg_roles as member_role
        on member_role.oid = membership.member
      join pg_catalog.pg_roles as grantor_role
        on grantor_role.oid = membership.grantor
      where granted_role.rolname in (
          'line_pay_payment_executor',
          'line_pay_payment_function_owner'
        )
        and member_role.rolname = current_user
        and grantor_role.rolsuper
        and membership.admin_option
        and not membership.inherit_option
        and not membership.set_option
    ) as bootstrap_membership
    where role.rolname = current_user
  ), true) then
    raise exception using
      errcode = '42501',
      message = 'line_pay_atomic_finalize_role_membership_allowlist_postcondition_failed';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_roles as owner
      on owner.oid = relation.relowner
    where owner.rolname = 'line_pay_payment_executor'
  ) or exists (
    select 1
    from pg_catalog.pg_class as relation
    cross join lateral pg_catalog.aclexplode(relation.relacl) as acl
    join pg_catalog.pg_roles as grantee
      on grantee.oid = acl.grantee
    where grantee.rolname = 'line_pay_payment_executor'
  ) or exists (
    select 1
    from pg_catalog.pg_attribute as attribute
    cross join lateral pg_catalog.aclexplode(attribute.attacl) as acl
    join pg_catalog.pg_roles as grantee
      on grantee.oid = acl.grantee
    where grantee.rolname = 'line_pay_payment_executor'
  ) then
    raise exception using
      errcode = '42501',
      message = 'line_pay_atomic_finalize_executor_relation_acl_postcondition_failed';
  end if;

  if (
    select pg_catalog.count(*)
    from pg_catalog.pg_proc as procedure
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = procedure.pronamespace
    join pg_catalog.pg_roles as owner
      on owner.oid = procedure.proowner
    where owner.rolname = 'line_pay_payment_function_owner'
      and pg_catalog.has_function_privilege(
        'line_pay_payment_executor', procedure.oid, 'execute'
      )
  ) <> 1 or not exists (
    select 1
    from pg_catalog.pg_proc as procedure
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = procedure.pronamespace
    join pg_catalog.pg_roles as owner
      on owner.oid = procedure.proowner
    where namespace.nspname = 'public'
      and procedure.proname = 'finalize_product_order_line_pay_confirmation'
      and pg_catalog.oidvectortypes(procedure.proargtypes) =
        'text, uuid, uuid, uuid, text, text, integer, text, uuid, uuid, uuid, text, text'
      and owner.rolname = 'line_pay_payment_function_owner'
      and pg_catalog.has_function_privilege(
        'line_pay_payment_executor', procedure.oid, 'execute'
      )
  ) then
    raise exception using
      errcode = '42501',
      message = 'line_pay_atomic_finalize_executor_rpc_allowlist_postcondition_failed';
  end if;

  if (
    select pg_catalog.count(*)
    from pg_catalog.pg_auth_members as membership
    join pg_catalog.pg_roles as granted_role
      on granted_role.oid = membership.roleid
    join pg_catalog.pg_roles as member_role
      on member_role.oid = membership.member
    where granted_role.rolname = 'line_pay_payment_executor'
      and member_role.rolname = 'authenticator'
      and not membership.admin_option
      and not membership.inherit_option
      and membership.set_option
  ) <> 1 or (
    select pg_catalog.count(*)
    from pg_catalog.pg_auth_members as membership
    join pg_catalog.pg_roles as granted_role
      on granted_role.oid = membership.roleid
    join pg_catalog.pg_roles as member_role
      on member_role.oid = membership.member
    where granted_role.rolname = 'line_pay_payment_executor'
      and member_role.rolname = 'authenticator'
  ) <> 1 or exists (
    select 1
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
  ) then
    raise exception using
      errcode = '42501',
      message = 'line_pay_atomic_finalize_membership_postcondition_failed';
  end if;

  if pg_catalog.has_table_privilege(
       'line_pay_payment_executor', 'public.payments', 'select,insert,update,delete'
     )
     or pg_catalog.has_table_privilege(
       'line_pay_payment_executor',
       'line_pay_private.line_pay_completion_proofs',
       'select,insert,update,delete'
     )
     or pg_catalog.has_schema_privilege(
       'line_pay_payment_executor', 'public', 'create'
     )
     or pg_catalog.has_schema_privilege(
       'line_pay_payment_executor', 'line_pay_private', 'usage'
     )
     or not pg_catalog.has_schema_privilege(
       'line_pay_payment_executor', 'public', 'usage'
     ) then
    raise exception using
      errcode = '42501',
      message = 'line_pay_atomic_finalize_executor_privilege_postcondition_failed';
  end if;
end
$$;

commit;
