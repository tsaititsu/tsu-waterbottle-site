\set ON_ERROR_STOP on

-- Reviewed fail-closed recovery for the additive checkout initializer only.
-- This file is intentionally not connected to a Production workflow.
-- It is eligible for separate human authorization only while LINE Pay Runtime
-- is disabled and before any checkout_initialized audit event exists.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $recovery_precondition$
begin
  if pg_catalog.to_regprocedure(
       'public.initialize_product_order_line_pay_checkout(jsonb)'
     ) is null
     or pg_catalog.to_regprocedure(
       'line_pay_private.record_line_pay_checkout_initialized_audit(uuid,uuid,uuid,text)'
     ) is null
     or pg_catalog.to_regclass(
       'public.line_pay_payment_audit_events_checkout_initialized_once_idx'
     ) is null
     or not exists (
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
     ) then
    raise exception using
      errcode = '55000',
      message = 'line_pay_initialization_recovery_postcondition_failed';
  end if;
end;
$recovery_postcondition$;

commit;
