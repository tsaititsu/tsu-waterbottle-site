\set ON_ERROR_STOP on

-- Reviewed fail-closed recovery for the additive checkout initializer only.
-- This file is intentionally not connected to a Production workflow.
-- It is eligible for separate human authorization only while LINE Pay Runtime
-- is disabled and before any checkout_initialized audit event exists.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

lock table
  public.product_order_items,
  public.product_shipping_info,
  public.line_pay_payment_audit_events
in share row exclusive mode;

do $recovery_precondition$
declare
  v_initializer_oid oid := pg_catalog.to_regprocedure(
    'public.initialize_product_order_line_pay_checkout(jsonb)'
  );
  v_audit_helper_oid oid := pg_catalog.to_regprocedure(
    'line_pay_private.record_line_pay_checkout_initialized_audit(uuid,uuid,uuid,text)'
  );
begin
  if v_initializer_oid is null
     or v_audit_helper_oid is null
     or (
       select pg_catalog.count(*)
       from pg_catalog.pg_proc as procedure
       join pg_catalog.pg_namespace as namespace
         on namespace.oid = procedure.pronamespace
       where namespace.nspname = 'public'
         and procedure.proname =
           'initialize_product_order_line_pay_checkout'
     ) <> 1
     or exists (
       select 1
       from pg_catalog.pg_proc as procedure
       where procedure.oid = v_initializer_oid
         and (
           procedure.prosecdef
           or procedure.proowner <> (
             select role.oid
             from pg_catalog.pg_roles as role
             where role.rolname = current_user
           )
           or procedure.provolatile <> 'v'
           or procedure.proconfig is null
           or not ('search_path=""' = any (procedure.proconfig))
           or pg_catalog.obj_description(procedure.oid, 'pg_proc')
             <> 'line_pay_definition_md5:01f23508c326066dd4c7ef214c27b60e'
           or pg_catalog.md5(pg_catalog.pg_get_functiondef(procedure.oid))
             <> '01f23508c326066dd4c7ef214c27b60e'
         )
     )
     or not pg_catalog.has_function_privilege(
       'service_role',
       v_initializer_oid,
       'execute'
     )
     or exists (
       select 1
       from pg_catalog.pg_proc as procedure
       cross join lateral pg_catalog.aclexplode(procedure.proacl) as acl
       where procedure.oid = v_initializer_oid
         and acl.privilege_type = 'EXECUTE'
         and (
           acl.grantee not in (
             procedure.proowner,
             (
               select role.oid
               from pg_catalog.pg_roles as role
               where role.rolname = 'service_role'
             )
           )
           or (
             acl.grantee = (
               select role.oid
               from pg_catalog.pg_roles as role
               where role.rolname = 'service_role'
             )
             and acl.is_grantable
           )
         )
     )
     or exists (
       select 1
       from pg_catalog.pg_proc as procedure
       where procedure.oid = v_audit_helper_oid
         and (
           not procedure.prosecdef
           or procedure.proowner <> (
             select role.oid
             from pg_catalog.pg_roles as role
             where role.rolname = 'line_pay_payment_function_owner'
           )
           or procedure.provolatile <> 'v'
           or procedure.proconfig is null
           or not ('search_path=""' = any (procedure.proconfig))
           or pg_catalog.obj_description(procedure.oid, 'pg_proc')
             <> 'line_pay_definition_md5:58527777d0bd2138231218673699b634'
           or pg_catalog.md5(pg_catalog.pg_get_functiondef(procedure.oid))
             <> '58527777d0bd2138231218673699b634'
         )
     )
     or not pg_catalog.has_function_privilege(
       'service_role',
       v_audit_helper_oid,
       'execute'
     )
     or exists (
       select 1
       from pg_catalog.pg_proc as procedure
       cross join lateral pg_catalog.aclexplode(procedure.proacl) as acl
       where procedure.oid = v_audit_helper_oid
         and acl.privilege_type = 'EXECUTE'
         and (
           acl.grantee not in (
             procedure.proowner,
             (
               select role.oid
               from pg_catalog.pg_roles as role
               where role.rolname = 'service_role'
             )
           )
           or (
             acl.grantee = (
               select role.oid
               from pg_catalog.pg_roles as role
               where role.rolname = 'service_role'
             )
             and acl.is_grantable
           )
         )
     )
     or (
       select pg_catalog.count(*)
       from pg_catalog.pg_index as index_catalog
       join pg_catalog.pg_class as index_relation
         on index_relation.oid = index_catalog.indexrelid
       join pg_catalog.pg_namespace as index_namespace
         on index_namespace.oid = index_relation.relnamespace
       join pg_catalog.pg_class as table_relation
         on table_relation.oid = index_catalog.indrelid
       join pg_catalog.pg_namespace as table_namespace
         on table_namespace.oid = table_relation.relnamespace
       join pg_catalog.pg_am as access_method
         on access_method.oid = index_relation.relam
       join pg_catalog.pg_attribute as key_attribute
         on key_attribute.attrelid = table_relation.oid
        and key_attribute.attname = 'checkout_attempt_id'
        and key_attribute.attnum > 0
        and not key_attribute.attisdropped
       where index_namespace.nspname = 'public'
         and index_relation.relname =
           'line_pay_payment_audit_events_checkout_initialized_once_idx'
         and table_namespace.nspname = 'public'
         and table_relation.relname = 'line_pay_payment_audit_events'
         and access_method.amname = 'btree'
         and index_catalog.indisunique
         and index_catalog.indisvalid
         and index_catalog.indisready
         and index_catalog.indnkeyatts = 1
         and index_catalog.indnatts = 1
         and not index_catalog.indnullsnotdistinct
         and index_catalog.indexprs is null
         and index_catalog.indkey[0] = key_attribute.attnum
         and pg_catalog.pg_get_indexdef(index_catalog.indexrelid)
           ~ '\(checkout_attempt_id\)'
         and pg_catalog.pg_get_expr(
           index_catalog.indpred,
           index_catalog.indrelid
         ) = '(event_type = ''checkout_initialized''::text)'
     ) <> 1
     or (
       select pg_catalog.count(*)
       from pg_catalog.pg_policy as policy
       join pg_catalog.pg_class as relation
         on relation.oid = policy.polrelid
       join pg_catalog.pg_namespace as namespace
         on namespace.oid = relation.relnamespace
       where namespace.nspname = 'public'
         and relation.relname = 'line_pay_payment_audit_events'
         and policy.polname =
           'line_pay_payment_function_owner_checkout_initialized_audit_insert'
         and policy.polcmd = 'a'
         and policy.polpermissive
         and policy.polroles = array[
           (
             select role.oid
             from pg_catalog.pg_roles as role
             where role.rolname = 'line_pay_payment_function_owner'
           )
         ]::oid[]
         and policy.polqual is null
         and pg_catalog.pg_get_expr(policy.polwithcheck, policy.polrelid)
           = '(event_type = ''checkout_initialized''::text)'
     ) <> 1
     or (
       select pg_catalog.count(*)
       from pg_catalog.pg_policy as policy
       join pg_catalog.pg_class as relation
         on relation.oid = policy.polrelid
       join pg_catalog.pg_namespace as namespace
         on namespace.oid = relation.relnamespace
       where namespace.nspname = 'public'
         and relation.relname = 'product_order_items'
         and policy.polname =
           'line_pay_payment_function_owner_initialization_items_select'
         and policy.polcmd = 'r'
         and policy.polpermissive
         and policy.polroles = array[
           (
             select role.oid
             from pg_catalog.pg_roles as role
             where role.rolname = 'line_pay_payment_function_owner'
           )
         ]::oid[]
         and policy.polwithcheck is null
         and pg_catalog.pg_get_expr(policy.polqual, policy.polrelid) =
           '(EXISTS ( SELECT 1
   FROM product_orders product_order
  WHERE ((product_order.id = product_order_items.order_id) AND (product_order.payment_method = ''line_pay''::text))))'
     ) <> 1
     or (
       select pg_catalog.count(*)
       from pg_catalog.pg_policy as policy
       join pg_catalog.pg_class as relation
         on relation.oid = policy.polrelid
       join pg_catalog.pg_namespace as namespace
         on namespace.oid = relation.relnamespace
       where namespace.nspname = 'public'
         and relation.relname = 'product_shipping_info'
         and policy.polname =
           'line_pay_payment_function_owner_initialization_shipping_select'
         and policy.polcmd = 'r'
         and policy.polpermissive
         and policy.polroles = array[
           (
             select role.oid
             from pg_catalog.pg_roles as role
             where role.rolname = 'line_pay_payment_function_owner'
           )
         ]::oid[]
         and policy.polwithcheck is null
         and pg_catalog.pg_get_expr(policy.polqual, policy.polrelid) =
           '(EXISTS ( SELECT 1
   FROM product_orders product_order
  WHERE ((product_order.id = product_shipping_info.order_id) AND (product_order.payment_method = ''line_pay''::text))))'
     ) <> 1
     or not pg_catalog.has_table_privilege(
       'line_pay_payment_function_owner',
       'public.product_order_items',
       'select'
     )
     or not pg_catalog.has_table_privilege(
       'line_pay_payment_function_owner',
       'public.product_shipping_info',
       'select'
     )
     or pg_catalog.has_table_privilege(
       'line_pay_payment_function_owner',
       'public.product_order_items',
       'insert,update,delete,truncate,references,trigger'
     )
     or pg_catalog.has_table_privilege(
       'line_pay_payment_function_owner',
       'public.product_shipping_info',
       'insert,update,delete,truncate,references,trigger'
     )
     or (
       select pg_catalog.count(*)
       from pg_catalog.pg_class as relation
       join pg_catalog.pg_namespace as namespace
         on namespace.oid = relation.relnamespace
       cross join lateral pg_catalog.aclexplode(relation.relacl) as table_acl
       where namespace.nspname = 'public'
         and relation.relname in (
           'product_order_items',
           'product_shipping_info'
         )
         and table_acl.grantee = (
           select role.oid
           from pg_catalog.pg_roles as role
           where role.rolname = 'line_pay_payment_function_owner'
         )
         and table_acl.privilege_type = 'SELECT'
         and not table_acl.is_grantable
         and table_acl.grantor = relation.relowner
     ) <> 2
     or exists (
       select 1
       from pg_catalog.pg_class as relation
       join pg_catalog.pg_namespace as namespace
         on namespace.oid = relation.relnamespace
       cross join lateral pg_catalog.aclexplode(relation.relacl) as table_acl
       where namespace.nspname = 'public'
         and relation.relname in (
           'product_order_items',
           'product_shipping_info'
         )
         and (
           (
             table_acl.grantee = (
               select role.oid
               from pg_catalog.pg_roles as role
               where role.rolname = 'line_pay_payment_function_owner'
             )
             and (
               table_acl.privilege_type <> 'SELECT'
               or table_acl.is_grantable
               or table_acl.grantor <> relation.relowner
             )
           )
           or (
             table_acl.grantor = (
               select role.oid
               from pg_catalog.pg_roles as role
               where role.rolname = 'line_pay_payment_function_owner'
             )
             and table_acl.grantee <> table_acl.grantor
           )
         )
     ) then
    raise exception using
      errcode = '55000',
      message = 'line_pay_initialization_recovery_state_mismatch';
  end if;

  if exists (
    select 1
    from public.line_pay_payment_audit_events as audit
    where audit.event_type = 'checkout_initialized'
  ) then
    raise exception using
      errcode = '55000',
      message = 'line_pay_initialization_recovery_requires_fail_forward';
  end if;
end;
$recovery_precondition$;

drop policy line_pay_payment_function_owner_initialization_items_select
on public.product_order_items;

drop policy line_pay_payment_function_owner_initialization_shipping_select
on public.product_shipping_info;

revoke select on table
  public.product_order_items,
  public.product_shipping_info
from line_pay_payment_function_owner;

revoke all on function public.initialize_product_order_line_pay_checkout(jsonb)
from public, anon, authenticated, service_role;

drop function public.initialize_product_order_line_pay_checkout(jsonb);

revoke all on function line_pay_private.record_line_pay_checkout_initialized_audit(
  uuid,
  uuid,
  uuid,
  text
) from public, anon, authenticated, service_role, line_pay_payment_executor;

drop function line_pay_private.record_line_pay_checkout_initialized_audit(
  uuid,
  uuid,
  uuid,
  text
);

drop policy line_pay_payment_function_owner_checkout_initialized_audit_insert
on public.line_pay_payment_audit_events;

drop index public.line_pay_payment_audit_events_checkout_initialized_once_idx;

do $recovery_postcondition$
begin
  if pg_catalog.to_regprocedure(
       'public.initialize_product_order_line_pay_checkout(jsonb)'
     ) is not null
     or pg_catalog.to_regprocedure(
       'line_pay_private.record_line_pay_checkout_initialized_audit(uuid,uuid,uuid,text)'
     ) is not null
     or pg_catalog.to_regclass(
       'public.line_pay_payment_audit_events_checkout_initialized_once_idx'
     ) is not null
     or exists (
       select 1
       from pg_catalog.pg_policy as policy
       join pg_catalog.pg_class as relation
         on relation.oid = policy.polrelid
       join pg_catalog.pg_namespace as namespace
         on namespace.oid = relation.relnamespace
       where namespace.nspname = 'public'
         and relation.relname = 'line_pay_payment_audit_events'
         and policy.polname =
           'line_pay_payment_function_owner_checkout_initialized_audit_insert'
     )
     or exists (
       select 1
       from pg_catalog.pg_policy as policy
       join pg_catalog.pg_class as relation
         on relation.oid = policy.polrelid
       join pg_catalog.pg_namespace as namespace
         on namespace.oid = relation.relnamespace
       where namespace.nspname = 'public'
         and relation.relname = 'product_order_items'
         and policy.polname =
           'line_pay_payment_function_owner_initialization_items_select'
     )
     or exists (
       select 1
       from pg_catalog.pg_policy as policy
       join pg_catalog.pg_class as relation
         on relation.oid = policy.polrelid
       join pg_catalog.pg_namespace as namespace
         on namespace.oid = relation.relnamespace
       where namespace.nspname = 'public'
         and relation.relname = 'product_shipping_info'
         and policy.polname =
           'line_pay_payment_function_owner_initialization_shipping_select'
     )
     or pg_catalog.has_table_privilege(
       'line_pay_payment_function_owner',
       'public.product_order_items',
       'select'
     )
     or pg_catalog.has_table_privilege(
       'line_pay_payment_function_owner',
       'public.product_shipping_info',
       'select'
     ) then
    raise exception using
      errcode = '55000',
      message = 'line_pay_initialization_recovery_postcondition_failed';
  end if;
end;
$recovery_postcondition$;

commit;
