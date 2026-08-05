\set ON_ERROR_STOP on
\set QUIET on
\pset format unaligned
\pset tuples_only on

do $preflight$
declare
  v_target_count integer;
begin
  if pg_catalog.to_regprocedure(
    'public.initialize_product_order_line_pay_checkout(jsonb)'
  ) is null
    or pg_catalog.to_regclass('public.product_orders') is null
    or pg_catalog.to_regclass('public.product_order_items') is null
    or pg_catalog.to_regclass('public.product_shipping_info') is null
    or pg_catalog.to_regclass('public.payments') is null
    or pg_catalog.to_regclass('public.line_pay_checkout_attempts') is null
    or pg_catalog.to_regclass('public.line_pay_request_outbox') is null
    or pg_catalog.to_regclass('public.line_pay_callback_capabilities') is null
    or pg_catalog.to_regclass('public.line_pay_payment_audit_events') is null
    or pg_catalog.to_regrole('line_pay_payment_function_owner') is null
    or pg_catalog.to_regrole('line_pay_payment_executor') is null
    or pg_catalog.to_regrole('service_role') is null
  then
    raise exception using
      errcode = '55000',
      message = 'line_pay_service_checkout_base_contract_missing';
  end if;

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

  if v_target_count <> 0 then
    raise exception using
      errcode = '55000',
      message = 'line_pay_service_checkout_partial_or_applied';
  end if;
end;
$preflight$;

select 'line_pay_service_checkout_preflight_ready';
