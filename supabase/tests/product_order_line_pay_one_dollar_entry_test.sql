\set ON_ERROR_STOP on

insert into auth.users (id)
values ('41000000-0000-4000-8000-000000000001')
on conflict (id) do nothing;

set role service_role;

create temporary table line_pay_one_dollar_entry_payload (
  payload jsonb not null
) on commit preserve rows;

insert into line_pay_one_dollar_entry_payload (payload)
values (
  pg_catalog.jsonb_build_object(
    'user_id', '41000000-0000-4000-8000-000000000001',
    'environment', 'production',
    'order_no', 'LPONE-contract00000000000000000000001',
    'merchant_order_no', 'LP_ONE_contract00000000000000000000001',
    'customer_name', 'LINE Pay Production NT$1 測試',
    'customer_email', null,
    'customer_phone', '0900000000',
    'note', 'Production 管理員 NT$1 金流測試，請勿出貨',
    'items', pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object(
        'product_slug', 'line-pay-production-one-dollar-test',
        'product_name', 'LINE Pay Production NT$1 測試（不出貨）',
        'unit_price_twd', 1,
        'quantity', 1,
        'product_snapshot', pg_catalog.jsonb_build_object(
          'slug', 'line-pay-production-one-dollar-test',
          'name', 'LINE Pay Production NT$1 測試（不出貨）',
          'category', '符咒商品',
          'priceTwd', 1
        )
      )
    ),
    'shipping_info', pg_catalog.jsonb_build_object(
      'recipient_name', 'LINE Pay NT$1 測試（請勿出貨）',
      'recipient_phone', '0900000000',
      'recipient_email', null,
      'shipping_method', 'manual',
      'postal_code', null,
      'address', '內部金流測試訂單，請勿出貨',
      'store_type', null,
      'store_id', null,
      'store_name', null,
      'store_address', null,
      'store_phone', null
    ),
    'idempotency_key',
      'line-pay-production-one-dollar:contract-user-0001',
    'request_body_sha256', pg_catalog.repeat('0', 64),
    'confirm_token_hash', pg_catalog.repeat('1', 64),
    'cancel_token_hash', pg_catalog.repeat('2', 64),
    'capability_expires_at',
      pg_catalog.to_char(
        pg_catalog.clock_timestamp() + interval '30 minutes',
        'YYYY-MM-DD"T"HH24:MI:SS.USOF'
      )
  )
);

create temporary table line_pay_one_dollar_entry_first_result
on commit preserve rows
as
select *
from public.initialize_line_pay_one_dollar_product_order_test(
  (select payload from line_pay_one_dollar_entry_payload)
);

create temporary table line_pay_one_dollar_entry_replay_result
on commit preserve rows
as
select *
from public.initialize_line_pay_one_dollar_product_order_test(
  (select payload from line_pay_one_dollar_entry_payload)
);

reset role;

do $$
declare
  v_first record;
  v_replay record;
begin
  select * into strict v_first
  from line_pay_one_dollar_entry_first_result;

  select * into strict v_replay
  from line_pay_one_dollar_entry_replay_result;

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
    raise exception 'line_pay_one_dollar_entry_replay_contract_failed';
  end if;

  if not exists (
    select 1
    from public.product_orders as product_order
    join public.payments as payment
      on payment.id = product_order.payment_id
    join public.line_pay_checkout_attempts as attempt
      on attempt.id = product_order.checkout_attempt_id
    where product_order.id = v_first.product_order_id
      and product_order.total_amount_twd = 1
      and product_order.environment = 'production'
      and product_order.fulfillment_mode = 'none'
      and product_order.shipping_status = 'not_applicable'
      and not product_order.sandbox_test
      and product_order.payment_id = v_first.payment_id
      and product_order.checkout_attempt_id = v_first.attempt_id
      and payment.provider = 'line_pay'
      and payment.item_type = 'spiritual_product_order'
      and payment.item_id = product_order.id::text
      and payment.amount_twd = 1
      and attempt.amount_twd = 1
      and attempt.idempotency_key =
        'line-pay-production-one-dollar:contract-user-0001'
  )
  or exists (
    select 1
    from public.product_shipping_info as shipping
    where shipping.order_id = v_first.product_order_id
  )
  or (
    select pg_catalog.count(*)
    from public.product_order_items as item
    where item.order_id = v_first.product_order_id
  ) <> 1
  or (
    select pg_catalog.count(*)
    from public.product_order_items as item
    where item.order_id = v_first.product_order_id
      and item.product_slug = 'line-pay-production-one-dollar-test'
      and item.unit_price_twd = 1
      and item.quantity = 1
      and item.subtotal_twd = 1
  ) <> 1 then
    raise exception 'line_pay_one_dollar_entry_non_fulfillment_contract_failed';
  end if;

  if pg_catalog.has_function_privilege(
    'anon',
    'public.initialize_line_pay_one_dollar_product_order_test(jsonb)',
    'EXECUTE'
  )
  or pg_catalog.has_function_privilege(
    'authenticated',
    'public.initialize_line_pay_one_dollar_product_order_test(jsonb)',
    'EXECUTE'
  )
  or pg_catalog.has_function_privilege(
    'line_pay_payment_executor',
    'public.initialize_line_pay_one_dollar_product_order_test(jsonb)',
    'EXECUTE'
  )
  or not pg_catalog.has_function_privilege(
    'service_role',
    'public.initialize_line_pay_one_dollar_product_order_test(jsonb)',
    'EXECUTE'
  ) then
    raise exception 'line_pay_one_dollar_entry_acl_contract_failed';
  end if;
end;
$$;

insert into public.product_order_items (
  order_id,
  product_slug,
  product_name,
  unit_price_twd,
  quantity,
  subtotal_twd,
  product_snapshot
)
select
  product_order_id,
  'tampered-extra-item',
  '不應被接受的額外商品',
  1,
  1,
  1,
  '{"tampered":true}'::jsonb
from line_pay_one_dollar_entry_first_result;

set role service_role;

do $$
begin
  perform public.initialize_line_pay_one_dollar_product_order_test(
    (select payload from line_pay_one_dollar_entry_payload)
  );
  raise exception 'line_pay_one_dollar_entry_extra_item_was_accepted';
exception
  when sqlstate '23514' then
    if sqlerrm <> 'line_pay_one_dollar_entry_test_lock_binding_invalid' then
      raise;
    end if;
end;
$$;

reset role;

delete from public.product_order_items
where product_slug = 'tampered-extra-item'
  and order_id = (
    select product_order_id
    from line_pay_one_dollar_entry_first_result
  );

create or replace function public.line_pay_test_fail_shipping_delete()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.recipient_name = 'LINE Pay NT$1 測試（請勿出貨）' then
    raise exception using
      errcode = '23514',
      message = 'line_pay_test_injected_shipping_delete_failure';
  end if;
  return old;
end;
$$;

create trigger line_pay_test_fail_shipping_delete
before delete on public.product_shipping_info
for each row
execute function public.line_pay_test_fail_shipping_delete();

set role service_role;

do $$
declare
  v_orders_before bigint;
  v_items_before bigint;
  v_shipping_before bigint;
  v_payments_before bigint;
  v_attempts_before bigint;
  v_outbox_before bigint;
  v_capabilities_before bigint;
  v_failure_payload jsonb;
begin
  select pg_catalog.count(*) into v_orders_before from public.product_orders;
  select pg_catalog.count(*) into v_items_before from public.product_order_items;
  select pg_catalog.count(*) into v_shipping_before from public.product_shipping_info;
  select pg_catalog.count(*) into v_payments_before from public.payments;
  select pg_catalog.count(*) into v_attempts_before from public.line_pay_checkout_attempts;
  select pg_catalog.count(*) into v_outbox_before from public.line_pay_request_outbox;
  select pg_catalog.count(*) into v_capabilities_before from public.line_pay_callback_capabilities;

  v_failure_payload := (select payload from line_pay_one_dollar_entry_payload)
    || pg_catalog.jsonb_build_object(
      'order_no', 'LPONE-contract-late-helper-failure',
      'merchant_order_no', 'LP_ONE_contract_late_helper_failure',
      'idempotency_key',
        'line-pay-production-one-dollar:late-helper-failure',
      'request_body_sha256', pg_catalog.repeat('3', 64),
      'confirm_token_hash', pg_catalog.repeat('4', 64),
      'cancel_token_hash', pg_catalog.repeat('5', 64)
    );

  begin
    perform public.initialize_line_pay_one_dollar_product_order_test(
      v_failure_payload
    );
    raise exception 'line_pay_one_dollar_entry_late_failure_was_accepted';
  exception
    when sqlstate '23514' then
      if sqlerrm <> 'line_pay_test_injected_shipping_delete_failure' then
        raise;
      end if;
  end;

  if v_orders_before <> (select pg_catalog.count(*) from public.product_orders)
     or v_items_before <> (select pg_catalog.count(*) from public.product_order_items)
     or v_shipping_before <> (select pg_catalog.count(*) from public.product_shipping_info)
     or v_payments_before <> (select pg_catalog.count(*) from public.payments)
     or v_attempts_before <> (select pg_catalog.count(*) from public.line_pay_checkout_attempts)
     or v_outbox_before <> (select pg_catalog.count(*) from public.line_pay_request_outbox)
     or v_capabilities_before <> (select pg_catalog.count(*) from public.line_pay_callback_capabilities) then
    raise exception 'line_pay_one_dollar_entry_late_failure_not_atomic';
  end if;
end;
$$;

reset role;

drop trigger line_pay_test_fail_shipping_delete
on public.product_shipping_info;
drop function public.line_pay_test_fail_shipping_delete();

set role service_role;

do $$
begin
  perform public.initialize_line_pay_one_dollar_product_order_test(
    pg_catalog.jsonb_set(
      (select payload from line_pay_one_dollar_entry_payload),
      '{customer_name}',
      '"不是固定測試"'::jsonb
    )
  );
  raise exception 'line_pay_one_dollar_entry_invalid_payload_was_accepted';
exception
  when sqlstate '22023' then
    if sqlerrm <> 'line_pay_one_dollar_entry_test_initialization_invalid_input' then
      raise;
    end if;
end;
$$;

reset role;
