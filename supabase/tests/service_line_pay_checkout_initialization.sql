\set ON_ERROR_STOP on

insert into auth.users (id)
values ('41000000-0000-4000-8000-000000000001')
on conflict (id) do nothing;

insert into public.bookings (
  id,
  user_id,
  plan_name,
  amount_twd,
  customer_name,
  customer_email,
  gender,
  birth_date,
  birth_time,
  is_birth_time_accurate,
  question,
  starts_at,
  ends_at
) values (
  '42000000-0000-4000-8000-000000000001',
  '41000000-0000-4000-8000-000000000001',
  '水瓶先生論命測試',
  3600,
  'Sandbox Tester',
  'sandbox@example.test',
  'other',
  date '1990-01-01',
  time '12:00:00',
  true,
  '合約測試',
  pg_catalog.clock_timestamp() + interval '1 day',
  pg_catalog.clock_timestamp() + interval '1 day 1 hour'
);

set role service_role;

create temporary table service_line_pay_payload (
  payload jsonb not null
) on commit preserve rows;

insert into service_line_pay_payload (payload)
values (
  pg_catalog.jsonb_build_object(
    'user_id', '41000000-0000-4000-8000-000000000001',
    'environment', 'sandbox',
    'order_no', 'PO_LPSVC_CONTRACT_1',
    'merchant_order_no', 'LP_SVC_CONTRACT_1',
    'source_type', 'booking',
    'source_id', '42000000-0000-4000-8000-000000000001',
    'item_name', '水瓶先生論命測試',
    'amount_twd', 3600,
    'booking_id', '42000000-0000-4000-8000-000000000001',
    'return_path', '/account/bookings',
    'idempotency_key', 'booking-line-pay-contract-0001',
    'request_body_sha256', pg_catalog.repeat('d', 64),
    'confirm_token_hash', pg_catalog.repeat('e', 64),
    'cancel_token_hash', pg_catalog.repeat('f', 64),
    'capability_expires_at',
      pg_catalog.to_char(
        pg_catalog.clock_timestamp() + interval '30 minutes',
        'YYYY-MM-DD"T"HH24:MI:SS.USOF'
      )
  )
);

create temporary table service_line_pay_first_result
on commit preserve rows
as
select *
from public.initialize_service_line_pay_checkout(
  (select payload from service_line_pay_payload)
);

create temporary table service_line_pay_replay_result
on commit preserve rows
as
select *
from public.initialize_service_line_pay_checkout(
  (select payload from service_line_pay_payload)
);

reset role;

do $$
declare
  v_first record;
  v_replay record;
begin
  select * into strict v_first from service_line_pay_first_result;
  select * into strict v_replay from service_line_pay_replay_result;

  if v_first.result_code <> 'initialized'
    or v_first.request_state <> 'queued'
    or v_replay.result_code <> 'already_initialized'
    or v_first.product_order_id <> v_replay.product_order_id
    or v_first.payment_id <> v_replay.payment_id
    or v_first.attempt_id <> v_replay.attempt_id
    or v_first.outbox_id <> v_replay.outbox_id
    or v_first.confirm_capability_id <> v_replay.confirm_capability_id
    or v_first.cancel_capability_id <> v_replay.cancel_capability_id
  then
    raise exception 'line_pay_service_checkout_replay_contract_failed';
  end if;

  if not exists (
    select 1
    from public.product_orders as product_order
    where product_order.id = v_first.product_order_id
      and product_order.user_id = '41000000-0000-4000-8000-000000000001'
      and product_order.total_amount_twd = 3600
      and product_order.payment_method = 'line_pay'
      and product_order.fulfillment_mode = 'none'
      and product_order.shipping_status = 'not_applicable'
      and product_order.payment_id = v_first.payment_id
      and product_order.checkout_attempt_id = v_first.attempt_id
      and product_order.payment_request_state = 'initialized'
      and not product_order.reconciliation_required
  ) then
    raise exception 'line_pay_service_checkout_order_contract_failed';
  end if;

  if (
    select pg_catalog.count(*)
    from public.product_order_items as item
    where item.order_id = v_first.product_order_id
      and item.product_name = '水瓶先生論命測試'
      and item.quantity = 1
      and item.unit_price_twd = 3600
      and item.subtotal_twd = 3600
  ) <> 1
    or exists (
      select 1
      from public.product_shipping_info as shipping
      where shipping.order_id = v_first.product_order_id
    )
  then
    raise exception 'line_pay_service_checkout_item_contract_failed';
  end if;

  if not exists (
    select 1
    from public.payments as payment
    where payment.id = v_first.payment_id
      and payment.provider = 'line_pay'
      and payment.item_type = 'booking'
      and payment.item_id = '42000000-0000-4000-8000-000000000001'
      and payment.booking_id = '42000000-0000-4000-8000-000000000001'
      and payment.amount_twd = 3600
      and payment.raw_payload = pg_catalog.jsonb_build_object(
        'linePay',
        pg_catalog.jsonb_build_object(
          'orderId', 'LP_SVC_CONTRACT_1',
          'sourceType', 'booking',
          'sourceId', '42000000-0000-4000-8000-000000000001',
          'returnPath', '/account/bookings'
        )
      )
  ) then
    raise exception 'line_pay_service_checkout_payment_contract_failed';
  end if;

  if (
    select pg_catalog.count(*)
    from public.line_pay_callback_capabilities as capability
    where capability.payment_id = v_first.payment_id
      and capability.product_order_id = v_first.product_order_id
      and capability.checkout_attempt_id = v_first.attempt_id
      and capability.purpose in ('confirm', 'cancel')
  ) <> 2
    or (
      select pg_catalog.count(*)
      from public.line_pay_request_outbox as request_outbox
      where request_outbox.id = v_first.outbox_id
        and request_outbox.checkout_attempt_id = v_first.attempt_id
        and request_outbox.payment_id = v_first.payment_id
        and request_outbox.state = 'queued'
    ) <> 1
    or (
      select pg_catalog.count(*)
      from public.line_pay_payment_audit_events as audit
      where audit.payment_id = v_first.payment_id
        and audit.product_order_id = v_first.product_order_id
        and audit.checkout_attempt_id = v_first.attempt_id
        and audit.event_type = 'checkout_initialized'
    ) <> 1
  then
    raise exception 'line_pay_service_checkout_evidence_contract_failed';
  end if;
end;
$$;

do $$
begin
  if pg_catalog.has_function_privilege(
    'anon',
    'public.initialize_service_line_pay_checkout(jsonb)',
    'EXECUTE'
  )
    or pg_catalog.has_function_privilege(
      'authenticated',
      'public.initialize_service_line_pay_checkout(jsonb)',
      'EXECUTE'
    )
    or pg_catalog.has_function_privilege(
      'line_pay_payment_executor',
      'public.initialize_service_line_pay_checkout(jsonb)',
      'EXECUTE'
    )
  then
    raise exception 'line_pay_service_checkout_acl_contract_failed';
  end if;
end;
$$;
