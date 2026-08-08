\set ON_ERROR_STOP on
\set QUIET on
\pset format unaligned
\pset tuples_only on

do $preflight$
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
    or pg_catalog.to_regnamespace('line_pay_private') is null
    or pg_catalog.to_regrole('service_role') is null
    or pg_catalog.to_regrole('line_pay_payment_executor') is null
    or pg_catalog.to_regrole('line_pay_payment_function_owner') is null
  then
    raise exception using
      errcode = '55000',
      message = 'line_pay_production_one_dollar_non_fulfillment_base_missing';
  end if;

  if pg_catalog.to_regprocedure(
    'public.initialize_line_pay_production_nt1_non_fulfillment_checkout(jsonb,text)'
  ) is not null
    or pg_catalog.to_regprocedure(
      'line_pay_private.mark_line_pay_production_one_dollar_non_fulfillment(uuid,uuid,text)'
    ) is not null
    or pg_catalog.to_regclass(
      'line_pay_private.line_pay_production_one_dollar_non_fulfillment_orders'
    ) is not null
    or exists (
      select 1
      from pg_catalog.pg_trigger as trigger_record
      where trigger_record.tgname in (
        'line_pay_00_production_one_dollar_order_guard',
        'line_pay_production_one_dollar_item_guard',
        'line_pay_production_one_dollar_shipping_guard'
      )
        and not trigger_record.tgisinternal
    )
  then
    raise exception using
      errcode = '55000',
      message = 'line_pay_production_one_dollar_non_fulfillment_applied';
  end if;
end;
$preflight$;

select 'line_pay_production_one_dollar_non_fulfillment_preflight_ready';
