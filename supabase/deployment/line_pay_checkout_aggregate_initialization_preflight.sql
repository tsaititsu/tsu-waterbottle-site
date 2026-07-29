\set ON_ERROR_STOP on
\set QUIET on
\pset format unaligned
\pset tuples_only on

do $preflight$
declare
  v_initializer_objects integer;
  v_audit_rows integer;
begin
  if pg_catalog.to_regclass('public.line_pay_payment_audit_events') is null
    or pg_catalog.to_regclass('public.product_order_items') is null
    or pg_catalog.to_regclass('public.product_shipping_info') is null
    or pg_catalog.to_regprocedure(
      'public.claim_product_order_line_pay_request(uuid,text,text,text,uuid,timestamp with time zone)'
    ) is null
    or pg_catalog.to_regrole('line_pay_payment_function_owner') is null
    or pg_catalog.to_regrole('service_role') is null
  then
    raise exception using
      errcode = '55000',
      message = 'line_pay_checkout_initializer_base_contract_missing';
  end if;

  select
    (
      select pg_catalog.count(*)
      from pg_catalog.pg_proc as procedure
      join pg_catalog.pg_namespace as namespace
        on namespace.oid = procedure.pronamespace
      where (
        namespace.nspname = 'public'
        and procedure.proname =
          'initialize_product_order_line_pay_checkout'
      )
      or (
        namespace.nspname = 'line_pay_private'
        and procedure.proname =
          'record_line_pay_checkout_initialized_audit'
      )
    )
    + (
      select pg_catalog.count(*)
      from pg_catalog.pg_class as relation
      join pg_catalog.pg_namespace as namespace
        on namespace.oid = relation.relnamespace
      where namespace.nspname = 'public'
        and relation.relname =
          'line_pay_payment_audit_events_checkout_initialized_once_idx'
    )
    + (
      select pg_catalog.count(*)
      from pg_catalog.pg_policy
      where polname in (
        'line_pay_payment_function_owner_checkout_initialized_audit_insert',
        'line_pay_payment_function_owner_initialization_items_select',
        'line_pay_payment_function_owner_initialization_shipping_select'
      )
    )
  into v_initializer_objects;

  if v_initializer_objects <> 0 then
    raise exception using
      errcode = '55000',
      message = 'line_pay_checkout_initializer_partial_or_applied';
  end if;

  select pg_catalog.count(*)
  into v_audit_rows
  from public.line_pay_payment_audit_events
  where event_type = 'checkout_initialized';

  if v_audit_rows <> 0 then
    raise exception using
      errcode = '55000',
      message = 'line_pay_checkout_initializer_audit_data_drift';
  end if;
end;
$preflight$;

\ir line_pay_checkout_aggregate_initialization_application_state.sql
