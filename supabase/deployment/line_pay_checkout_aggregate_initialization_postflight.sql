\set ON_ERROR_STOP on
\set QUIET on
\pset format unaligned
\pset tuples_only on

do $postflight$
declare
  v_count integer;
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
  then
    raise exception using
      errcode = '55000',
      message = 'line_pay_checkout_initializer_postflight_missing';
  end if;

  select pg_catalog.count(*)
  into v_count
  from pg_catalog.pg_policy
  where polname in (
    'line_pay_payment_function_owner_checkout_initialized_audit_insert',
    'line_pay_payment_function_owner_initialization_items_select',
    'line_pay_payment_function_owner_initialization_shipping_select'
  );

  if v_count <> 3 then
    raise exception using
      errcode = '55000',
      message = 'line_pay_checkout_initializer_policy_postflight_failed';
  end if;
end;
$postflight$;

\ir line_pay_checkout_aggregate_initialization_application_state.sql
