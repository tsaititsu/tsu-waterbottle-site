\set ON_ERROR_STOP on

insert into auth.users (id)
values ('41000000-0000-4000-8000-000000000001')
on conflict (id) do nothing;

set role service_role;

create temporary table line_pay_initialization_payload (
  payload jsonb not null
) on commit preserve rows;

insert into line_pay_initialization_payload (payload)
values (
  pg_catalog.jsonb_build_object(
    'user_id', '41000000-0000-4000-8000-000000000001',
    'environment', 'sandbox',
    'order_no', 'PO-SANDBOX-ATOMIC-1',
    'merchant_order_no', 'LP_SANDBOX_ATOMIC_1',
    'customer_name', 'Sandbox Tester',
    'customer_email', 'sandbox@example.test',
    'customer_phone', null,
    'note', 'synthetic sandbox contract',
    'items', pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object(
        'product_slug', 'sandbox-contract-item',
        'product_name', 'Sandbox contract item',
        'unit_price_twd', 40,
        'quantity', 2,
        'product_snapshot', pg_catalog.jsonb_build_object(
          'source', 'synthetic_contract'
        )
      ),
      pg_catalog.jsonb_build_object(
        'product_slug', 'sandbox-contract-addon',
        'product_name', 'Sandbox contract addon',
        'unit_price_twd', 20,
        'quantity', 1,
        'product_snapshot', null
      )
    ),
    'shipping_info', pg_catalog.jsonb_build_object(
      'recipient_name', null,
      'recipient_phone', null,
      'recipient_email', null,
      'shipping_method', 'manual',
      'postal_code', null,
      'address', null,
      'store_type', null,
      'store_id', null,
      'store_name', null,
      'store_address', null,
      'store_phone', null
    ),
    'idempotency_key', 'sandbox-atomic-idempotency-0001',
    'request_body_sha256', pg_catalog.repeat('a', 64),
    'confirm_token_hash', pg_catalog.repeat('b', 64),
    'cancel_token_hash', pg_catalog.repeat('c', 64),
    'capability_expires_at',
      pg_catalog.to_char(
        pg_catalog.clock_timestamp() + interval '30 minutes',
        'YYYY-MM-DD"T"HH24:MI:SS.USOF'
      )
  )
);

create temporary table line_pay_initialization_first_result
on commit preserve rows
as
select *
from public.initialize_product_order_line_pay_checkout(
  (select payload from line_pay_initialization_payload)
);

create temporary table line_pay_initialization_replay_result
on commit preserve rows
as
select *
from public.initialize_product_order_line_pay_checkout(
  (select payload from line_pay_initialization_payload)
);

do $$
declare
  v_first record;
  v_replay record;
begin
  select * into strict v_first
  from line_pay_initialization_first_result;

  select * into strict v_replay
  from line_pay_initialization_replay_result;

  if v_first.result_code <> 'initialized'
     or v_first.request_state <> 'queued'
     or v_replay.result_code <> 'already_initialized'
     or v_replay.request_state <> 'queued'
     or v_first.product_order_id <> v_replay.product_order_id
     or v_first.payment_id <> v_replay.payment_id
     or v_first.attempt_id <> v_replay.attempt_id
     or v_first.outbox_id <> v_replay.outbox_id
     or v_first.confirm_capability_id <> v_replay.confirm_capability_id
     or v_first.cancel_capability_id <> v_replay.cancel_capability_id then
    raise exception 'line_pay_initialization_idempotent_result_contract_failed';
  end if;

  if not exists (
    select 1
    from public.product_orders as product_order
    where product_order.id = v_first.product_order_id
      and product_order.user_id = '41000000-0000-4000-8000-000000000001'
      and product_order.order_no = 'PO-SANDBOX-ATOMIC-1'
      and product_order.total_amount_twd = 100
      and product_order.payment_method = 'line_pay'
      and product_order.payment_status = 'pending'
      and product_order.order_status = 'pending_payment'
      and product_order.shipping_status = 'not_applicable'
      and product_order.environment = 'sandbox'
      and product_order.fulfillment_mode = 'none'
      and product_order.sandbox_test
      and product_order.currency = 'TWD'
      and product_order.payment_id = v_first.payment_id
      and product_order.checkout_attempt_id = v_first.attempt_id
      and product_order.payment_request_state = 'initialized'
      and not product_order.reconciliation_required
  ) then
    raise exception 'line_pay_initialization_product_order_contract_failed';
  end if;

  if (
    select pg_catalog.count(*)
    from public.product_order_items as item
    where item.order_id = v_first.product_order_id
  ) <> 2
  or (
    select pg_catalog.sum(item.subtotal_twd)
    from public.product_order_items as item
    where item.order_id = v_first.product_order_id
  ) <> 100 then
    raise exception 'line_pay_initialization_item_contract_failed';
  end if;

  if not exists (
    select 1
    from public.product_shipping_info as shipping
    where shipping.order_id = v_first.product_order_id
      and shipping.shipping_method = 'manual'
      and shipping.recipient_name is null
      and shipping.address is null
  ) then
    raise exception 'line_pay_initialization_shipping_contract_failed';
  end if;

  if not exists (
    select 1
    from public.payments as payment
    where payment.id = v_first.payment_id
      and payment.user_id = '41000000-0000-4000-8000-000000000001'
      and payment.provider = 'line_pay'
      and payment.item_type = 'spiritual_product_order'
      and payment.item_id = v_first.product_order_id::text
      and payment.amount_twd = 100
      and payment.currency = 'TWD'
      and payment.status = 'pending'
      and payment.merchant_order_no = 'LP_SANDBOX_ATOMIC_1'
      and payment.product_order_id = v_first.product_order_id
      and payment.environment = 'sandbox'
      and payment.checkout_attempt_id = v_first.attempt_id
      and payment.request_state = 'initialized'
      and payment.request_idempotency_key = 'sandbox-atomic-idempotency-0001'
      and payment.request_body_sha256 = pg_catalog.repeat('a', 64)
      and payment.raw_payload = pg_catalog.jsonb_build_object(
        'linePay',
        pg_catalog.jsonb_build_object(
          'orderId', 'LP_SANDBOX_ATOMIC_1',
          'sourceType', 'product_order',
          'sourceId', v_first.product_order_id::text
        )
      )
  ) then
    raise exception 'line_pay_initialization_payment_contract_failed';
  end if;

  if not exists (
    select 1
    from public.line_pay_checkout_attempts as attempt
    where attempt.id = v_first.attempt_id
      and attempt.payment_id = v_first.payment_id
      and attempt.product_order_id = v_first.product_order_id
      and attempt.request_state = 'queued'
      and attempt.amount_twd = 100
      and attempt.merchant_order_no = 'LP_SANDBOX_ATOMIC_1'
  ) then
    raise exception 'line_pay_initialization_attempt_contract_failed';
  end if;

  if not exists (
    select 1
    from public.line_pay_request_outbox as request_outbox
    where request_outbox.id = v_first.outbox_id
      and request_outbox.checkout_attempt_id = v_first.attempt_id
      and request_outbox.payment_id = v_first.payment_id
      and request_outbox.operation = 'request'
      and request_outbox.state = 'queued'
  ) then
    raise exception 'line_pay_initialization_outbox_contract_failed';
  end if;

  if (
    select pg_catalog.count(*)
    from public.line_pay_callback_capabilities as capability
    where capability.payment_id = v_first.payment_id
      and capability.product_order_id = v_first.product_order_id
      and capability.checkout_attempt_id = v_first.attempt_id
      and capability.environment = 'sandbox'
      and capability.capability_version = 1
      and capability.purpose in ('confirm', 'cancel')
  ) <> 2 then
    raise exception 'line_pay_initialization_capability_contract_failed';
  end if;
end;
$$;

do $$
begin
  perform *
  from public.initialize_product_order_line_pay_checkout(
    (select payload - 'shipping_info' from line_pay_initialization_payload)
  );
  raise exception 'line_pay_initialization_invalid_shape_was_accepted';
exception
  when sqlstate '22023' then
    if sqlerrm <> 'line_pay_initialization_invalid_input' then
      raise;
    end if;
end;
$$;

do $$
declare
  v_oversized_payload jsonb;
begin
  select pg_catalog.jsonb_set(
    payload,
    '{items}',
    (
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'product_slug', 'oversized-contract-item-' || item_index::text,
          'product_name', 'Oversized contract item',
          'unit_price_twd', 1,
          'quantity', 1,
          'product_snapshot', pg_catalog.jsonb_build_object(
            'source', pg_catalog.repeat('x', 700)
          )
        )
      )
      from pg_catalog.generate_series(1, 100) as item_index
    )
  )
  into strict v_oversized_payload
  from line_pay_initialization_payload;

  if pg_catalog.octet_length(v_oversized_payload::text) <= 65536 then
    raise exception 'line_pay_initialization_oversized_fixture_too_small';
  end if;

  perform *
  from public.initialize_product_order_line_pay_checkout(v_oversized_payload);
  raise exception 'line_pay_initialization_oversized_payload_was_accepted';
exception
  when sqlstate '22023' then
    if sqlerrm <> 'line_pay_initialization_invalid_input' then
      raise;
    end if;
end;
$$;

do $$
declare
  v_mismatched_payload jsonb;
begin
  select pg_catalog.jsonb_set(
    payload,
    '{items,0,product_name}',
    '"Different item with same claimed body hash"'::jsonb
  )
  into strict v_mismatched_payload
  from line_pay_initialization_payload;

  perform *
  from public.initialize_product_order_line_pay_checkout(v_mismatched_payload);
  raise exception 'line_pay_initialization_mismatched_replay_was_accepted';
exception
  when unique_violation then
    if sqlerrm <> 'line_pay_initialization_idempotency_conflict' then
      raise;
    end if;
end;
$$;

do $$
declare
  v_conflict_payload jsonb;
begin
  select payload || pg_catalog.jsonb_build_object(
    'order_no', 'PO-SANDBOX-ROLLBACK-1',
    'merchant_order_no', 'LP_SANDBOX_ROLLBACK_1',
    'idempotency_key', 'sandbox-atomic-idempotency-0002',
    'request_body_sha256', pg_catalog.repeat('d', 64),
    'cancel_token_hash', pg_catalog.repeat('e', 64)
  )
  into strict v_conflict_payload
  from line_pay_initialization_payload;

  begin
    perform *
    from public.initialize_product_order_line_pay_checkout(v_conflict_payload);
    raise exception 'line_pay_initialization_late_conflict_was_accepted';
  exception
    when unique_violation then
      null;
  end;

  if exists (
    select 1
    from public.product_orders
    where order_no = 'PO-SANDBOX-ROLLBACK-1'
  )
  or exists (
    select 1
    from public.payments
    where merchant_order_no = 'LP_SANDBOX_ROLLBACK_1'
  )
  or exists (
    select 1
    from public.line_pay_checkout_attempts
    where idempotency_key = 'sandbox-atomic-idempotency-0002'
  )
  or exists (
    select 1
    from public.line_pay_request_outbox
    where idempotency_key = 'sandbox-atomic-idempotency-0002'
  ) then
    raise exception 'line_pay_initialization_late_conflict_did_not_roll_back';
  end if;
end;
$$;

reset role;
