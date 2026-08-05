-- Initialize the fixed Production LINE Pay NT$1 product-order test through the
-- proven aggregate initializer, then atomically remove every fulfillment path.
-- Applying this migration remotely requires a separate exact-file approval.

begin;

grant line_pay_payment_function_owner to current_user
  with inherit true, set true;

grant update (fulfillment_mode, shipping_status)
on table public.product_orders to line_pay_payment_function_owner;
grant delete on table public.product_shipping_info
to line_pay_payment_function_owner;

create policy line_pay_payment_function_owner_one_dollar_shipping_delete
on public.product_shipping_info
for delete
to line_pay_payment_function_owner
using (
  exists (
    select 1
    from public.product_orders as product_order
    where product_order.id = product_shipping_info.order_id
      and product_order.payment_method = 'line_pay'
      and product_order.environment = 'production'
      and product_order.total_amount_twd = 1
      and not product_order.sandbox_test
      and product_order.note =
        'Production 管理員 NT$1 金流測試，請勿出貨'
      and product_order.fulfillment_mode in ('physical', 'none')
      and product_order.shipping_status in ('not_shipped', 'not_applicable')
  )
);

create or replace function line_pay_private.lock_line_pay_one_dollar_product_order_test(
  p_payload jsonb,
  p_product_order_id uuid,
  p_payment_id uuid,
  p_attempt_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_payload is null
     or p_product_order_id is null
     or p_payment_id is null
     or p_attempt_id is null
     or p_payload ->> 'environment' <> 'production'
     or p_payload ->> 'customer_name' <> 'LINE Pay Production NT$1 測試'
     or pg_catalog.jsonb_typeof(p_payload -> 'customer_email') <> 'null'
     or p_payload ->> 'customer_phone' <> '0900000000'
     or p_payload ->> 'note'
       <> 'Production 管理員 NT$1 金流測試，請勿出貨'
     or p_payload -> 'items' <> pg_catalog.jsonb_build_array(
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
     )
     or not exists (
       select 1
       from public.product_orders as product_order
       join public.payments as payment
         on payment.id = product_order.payment_id
       join public.line_pay_checkout_attempts as attempt
         on attempt.id = product_order.checkout_attempt_id
       where product_order.id = p_product_order_id
         and payment.id = p_payment_id
         and attempt.id = p_attempt_id
         and product_order.user_id = (p_payload ->> 'user_id')::uuid
         and product_order.order_no = p_payload ->> 'order_no'
         and product_order.customer_name = p_payload ->> 'customer_name'
         and product_order.customer_email is null
         and product_order.customer_phone = p_payload ->> 'customer_phone'
         and product_order.note = p_payload ->> 'note'
         and product_order.total_amount_twd = 1
         and product_order.payment_method = 'line_pay'
         and product_order.environment = 'production'
         and product_order.fulfillment_mode in ('physical', 'none')
         and product_order.shipping_status in ('not_shipped', 'not_applicable')
         and not product_order.sandbox_test
         and product_order.currency = 'TWD'
         and payment.user_id = product_order.user_id
         and payment.provider = 'line_pay'
         and payment.item_type = 'spiritual_product_order'
         and payment.item_id = product_order.id::text
         and payment.amount_twd = 1
         and payment.currency = 'TWD'
         and payment.merchant_order_no = p_payload ->> 'merchant_order_no'
         and payment.product_order_id = product_order.id
         and payment.environment = 'production'
         and payment.checkout_attempt_id = attempt.id
         and payment.request_idempotency_key =
           p_payload ->> 'idempotency_key'
         and payment.request_body_sha256 =
           p_payload ->> 'request_body_sha256'
         and payment.raw_payload = pg_catalog.jsonb_build_object(
           'linePay',
           pg_catalog.jsonb_build_object(
             'orderId', p_payload ->> 'merchant_order_no',
             'sourceType', 'product_order',
             'sourceId', product_order.id::text
           )
         )
         and attempt.user_id = product_order.user_id
         and attempt.product_order_id = product_order.id
         and attempt.payment_id = payment.id
         and attempt.environment = 'production'
         and attempt.provider = 'line_pay'
         and attempt.idempotency_key = p_payload ->> 'idempotency_key'
         and attempt.request_body_sha256 =
           p_payload ->> 'request_body_sha256'
         and attempt.amount_twd = 1
         and attempt.currency = 'TWD'
         and attempt.merchant_order_no = p_payload ->> 'merchant_order_no'
     )
     or (
       select pg_catalog.count(*)
       from public.product_order_items as item
       where item.order_id = p_product_order_id
     ) <> 1
     or (
       select pg_catalog.count(*)
       from public.product_order_items as item
       where item.order_id = p_product_order_id
         and item.product_slug = 'line-pay-production-one-dollar-test'
         and item.product_name = 'LINE Pay Production NT$1 測試（不出貨）'
         and item.unit_price_twd = 1
         and item.quantity = 1
         and item.subtotal_twd = 1
         and item.product_snapshot = pg_catalog.jsonb_build_object(
           'slug', 'line-pay-production-one-dollar-test',
           'name', 'LINE Pay Production NT$1 測試（不出貨）',
           'category', '符咒商品',
           'priceTwd', 1
         )
     ) <> 1
     or (
       exists (
         select 1
         from public.product_shipping_info as shipping
         where shipping.order_id = p_product_order_id
       )
       and not exists (
         select 1
         from public.product_shipping_info as shipping
         where shipping.order_id = p_product_order_id
           and shipping.recipient_name = 'LINE Pay NT$1 測試（請勿出貨）'
           and shipping.recipient_phone = '0900000000'
           and shipping.recipient_email is null
           and shipping.shipping_method = 'manual'
           and shipping.postal_code is null
           and shipping.address = '內部金流測試訂單，請勿出貨'
           and shipping.store_type is null
           and shipping.store_id is null
           and shipping.store_name is null
           and shipping.store_address is null
           and shipping.store_phone is null
       )
     ) then
    raise exception using
      errcode = '23514',
      message = 'line_pay_one_dollar_entry_test_lock_binding_invalid';
  end if;

  if not exists (
    select 1
    from public.product_orders as product_order
    where product_order.id = p_product_order_id
      and product_order.fulfillment_mode = 'none'
      and product_order.shipping_status = 'not_applicable'
  ) then
    update public.product_orders as product_order
    set
      fulfillment_mode = 'none',
      shipping_status = 'not_applicable'
    where product_order.id = p_product_order_id
      and product_order.fulfillment_mode = 'physical'
      and product_order.shipping_status = 'not_shipped';

    if not found then
      raise exception using
        errcode = '23514',
        message = 'line_pay_one_dollar_entry_test_non_fulfillment_failed';
    end if;
  end if;

  delete from public.product_shipping_info as shipping
  where shipping.order_id = p_product_order_id;

  if not exists (
    select 1
    from public.product_orders as product_order
    where product_order.id = p_product_order_id
      and product_order.fulfillment_mode = 'none'
      and product_order.shipping_status = 'not_applicable'
  )
  or exists (
    select 1
    from public.product_shipping_info as shipping
    where shipping.order_id = p_product_order_id
  ) then
    raise exception using
      errcode = '23514',
      message = 'line_pay_one_dollar_entry_test_non_fulfillment_failed';
  end if;
end;
$$;

alter function line_pay_private.lock_line_pay_one_dollar_product_order_test(
  jsonb,
  uuid,
  uuid,
  uuid
) owner to line_pay_payment_function_owner;

revoke all on function line_pay_private.lock_line_pay_one_dollar_product_order_test(
  jsonb,
  uuid,
  uuid,
  uuid
) from public, anon, authenticated, line_pay_payment_executor;
grant execute on function line_pay_private.lock_line_pay_one_dollar_product_order_test(
  jsonb,
  uuid,
  uuid,
  uuid
) to service_role;

revoke line_pay_payment_function_owner from current_user;

create or replace function public.initialize_line_pay_one_dollar_product_order_test(
  p_payload jsonb
)
returns table (
  result_code text,
  product_order_id uuid,
  payment_id uuid,
  attempt_id uuid,
  outbox_id uuid,
  confirm_capability_id uuid,
  cancel_capability_id uuid,
  merchant_order_no text,
  request_state text
)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_expected_keys constant text[] := array[
    'user_id',
    'environment',
    'order_no',
    'merchant_order_no',
    'customer_name',
    'customer_email',
    'customer_phone',
    'note',
    'items',
    'shipping_info',
    'idempotency_key',
    'request_body_sha256',
    'confirm_token_hash',
    'cancel_token_hash',
    'capability_expires_at'
  ]::text[];
  v_result record;
  v_error_message text;
  v_replayed boolean := false;
begin
  if p_payload is null
     or pg_catalog.jsonb_typeof(p_payload) <> 'object'
     or pg_catalog.octet_length(p_payload::text) > 65536
     or not (p_payload ?& v_expected_keys)
     or exists (
       select 1
       from pg_catalog.jsonb_object_keys(p_payload) as supplied(key)
       where not (supplied.key = any (v_expected_keys))
     )
     or p_payload ->> 'environment' <> 'production'
     or p_payload ->> 'customer_name' <> 'LINE Pay Production NT$1 測試'
     or pg_catalog.jsonb_typeof(p_payload -> 'customer_email') <> 'null'
     or p_payload ->> 'customer_phone' <> '0900000000'
     or p_payload ->> 'note'
       <> 'Production 管理員 NT$1 金流測試，請勿出貨'
     or p_payload -> 'items' <> pg_catalog.jsonb_build_array(
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
     )
     or p_payload -> 'shipping_info' <> pg_catalog.jsonb_build_object(
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
     )
     or p_payload ->> 'order_no'
       !~ '^(LPONE-|PO_LINEPAY_)[A-Za-z0-9_:-]+$'
     or p_payload ->> 'merchant_order_no'
       !~ '^(LP_ONE_|LP_CART_)[A-Za-z0-9_:-]+$'
     or not (
       p_payload ->> 'idempotency_key'
         like 'line-pay-production-one-dollar:%'
       or pg_catalog.right(p_payload ->> 'idempotency_key', 10)
         = ':admin-nt1'
     ) then
    raise exception using
      errcode = '22023',
      message = 'line_pay_one_dollar_entry_test_initialization_invalid_input';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'line_pay_one_dollar_entry_test_initialize:production:'
        || (p_payload ->> 'idempotency_key'),
      0
    )
  );

  begin
    select *
    into strict v_result
    from public.initialize_product_order_line_pay_checkout(p_payload);
  exception
    when unique_violation then
      get stacked diagnostics v_error_message = message_text;
      if v_error_message <> 'line_pay_initialization_idempotency_conflict' then
        raise;
      end if;
      v_replayed := true;
  end;

  if v_replayed then
    select
      'already_initialized'::text as result_code,
      product_order.id as product_order_id,
      payment.id as payment_id,
      attempt.id as attempt_id,
      (
        select request_outbox.id
        from public.line_pay_request_outbox as request_outbox
        where request_outbox.checkout_attempt_id = attempt.id
          and request_outbox.payment_id = payment.id
          and request_outbox.provider = 'line_pay'
          and request_outbox.environment = 'production'
          and request_outbox.operation = 'request'
          and request_outbox.idempotency_key = attempt.idempotency_key
          and request_outbox.request_body_sha256 = attempt.request_body_sha256
      ) as outbox_id,
      (
        select capability.id
        from public.line_pay_callback_capabilities as capability
        where capability.checkout_attempt_id = attempt.id
          and capability.payment_id = payment.id
          and capability.product_order_id = product_order.id
          and capability.environment = 'production'
          and capability.purpose = 'confirm'
          and capability.capability_version = 1
      ) as confirm_capability_id,
      (
        select capability.id
        from public.line_pay_callback_capabilities as capability
        where capability.checkout_attempt_id = attempt.id
          and capability.payment_id = payment.id
          and capability.product_order_id = product_order.id
          and capability.environment = 'production'
          and capability.purpose = 'cancel'
          and capability.capability_version = 1
      ) as cancel_capability_id,
      attempt.merchant_order_no,
      attempt.request_state
    into v_result
    from public.line_pay_checkout_attempts as attempt
    join public.payments as payment
      on payment.id = attempt.payment_id
    join public.product_orders as product_order
      on product_order.id = attempt.product_order_id
    where attempt.environment = 'production'
      and attempt.provider = 'line_pay'
      and attempt.idempotency_key = p_payload ->> 'idempotency_key'
    for update of attempt, payment, product_order;

    if not found then
      raise exception using
        errcode = '23514',
        message = 'line_pay_one_dollar_entry_test_replay_missing';
    end if;
  end if;

  if v_result.result_code not in ('initialized', 'already_initialized')
     or v_result.product_order_id is null
     or v_result.payment_id is null
     or v_result.attempt_id is null
     or v_result.outbox_id is null
     or v_result.confirm_capability_id is null
     or v_result.cancel_capability_id is null
     or v_result.merchant_order_no <> p_payload ->> 'merchant_order_no'
     or v_result.request_state is null then
    raise exception using
      errcode = '23514',
      message = 'line_pay_one_dollar_entry_test_result_invalid';
  end if;

  perform line_pay_private.lock_line_pay_one_dollar_product_order_test(
    p_payload,
    v_result.product_order_id,
    v_result.payment_id,
    v_result.attempt_id
  );

  if not exists (
    select 1
    from public.product_orders as product_order
    join public.payments as payment
      on payment.id = product_order.payment_id
    join public.line_pay_checkout_attempts as attempt
      on attempt.id = product_order.checkout_attempt_id
    where product_order.id = v_result.product_order_id
      and payment.id = v_result.payment_id
      and attempt.id = v_result.attempt_id
      and product_order.user_id = (p_payload ->> 'user_id')::uuid
      and product_order.order_no = p_payload ->> 'order_no'
      and product_order.customer_name = p_payload ->> 'customer_name'
      and product_order.customer_email is null
      and product_order.customer_phone = p_payload ->> 'customer_phone'
      and product_order.note = p_payload ->> 'note'
      and product_order.total_amount_twd = 1
      and product_order.payment_method = 'line_pay'
      and product_order.environment = 'production'
      and product_order.fulfillment_mode = 'none'
      and product_order.shipping_status = 'not_applicable'
      and not product_order.sandbox_test
      and product_order.currency = 'TWD'
      and product_order.payment_id = payment.id
      and product_order.checkout_attempt_id = attempt.id
      and payment.user_id = product_order.user_id
      and payment.provider = 'line_pay'
      and payment.item_type = 'spiritual_product_order'
      and payment.item_id = product_order.id::text
      and payment.amount_twd = 1
      and payment.currency = 'TWD'
      and payment.merchant_order_no = p_payload ->> 'merchant_order_no'
      and payment.product_order_id = product_order.id
      and payment.environment = 'production'
      and payment.checkout_attempt_id = attempt.id
      and payment.request_idempotency_key = p_payload ->> 'idempotency_key'
      and payment.request_body_sha256 = p_payload ->> 'request_body_sha256'
      and payment.raw_payload = pg_catalog.jsonb_build_object(
        'linePay',
        pg_catalog.jsonb_build_object(
          'orderId', p_payload ->> 'merchant_order_no',
          'sourceType', 'product_order',
          'sourceId', product_order.id::text
        )
      )
      and attempt.user_id = product_order.user_id
      and attempt.product_order_id = product_order.id
      and attempt.payment_id = payment.id
      and attempt.environment = 'production'
      and attempt.provider = 'line_pay'
      and attempt.idempotency_key = p_payload ->> 'idempotency_key'
      and attempt.request_body_sha256 = p_payload ->> 'request_body_sha256'
      and attempt.amount_twd = 1
      and attempt.currency = 'TWD'
      and attempt.merchant_order_no = p_payload ->> 'merchant_order_no'
  )
  or (
    select pg_catalog.count(*)
    from public.product_order_items as item
    where item.order_id = v_result.product_order_id
  ) <> 1
  or (
    select pg_catalog.count(*)
    from public.product_order_items as item
    where item.order_id = v_result.product_order_id
      and item.product_slug = 'line-pay-production-one-dollar-test'
      and item.product_name = 'LINE Pay Production NT$1 測試（不出貨）'
      and item.unit_price_twd = 1
      and item.quantity = 1
      and item.subtotal_twd = 1
      and item.product_snapshot = pg_catalog.jsonb_build_object(
        'slug', 'line-pay-production-one-dollar-test',
        'name', 'LINE Pay Production NT$1 測試（不出貨）',
        'category', '符咒商品',
        'priceTwd', 1
      )
  ) <> 1
  or exists (
    select 1
    from public.product_shipping_info as shipping
    where shipping.order_id = v_result.product_order_id
  )
  or not exists (
    select 1
    from public.line_pay_request_outbox as request_outbox
    where request_outbox.id = v_result.outbox_id
      and request_outbox.checkout_attempt_id = v_result.attempt_id
      and request_outbox.payment_id = v_result.payment_id
      and request_outbox.provider = 'line_pay'
      and request_outbox.environment = 'production'
      and request_outbox.operation = 'request'
      and request_outbox.idempotency_key = p_payload ->> 'idempotency_key'
      and request_outbox.request_body_sha256 = p_payload ->> 'request_body_sha256'
  )
  or (
    select pg_catalog.count(*)
    from public.line_pay_callback_capabilities as capability
    where capability.id in (
      v_result.confirm_capability_id,
      v_result.cancel_capability_id
    )
      and capability.payment_id = v_result.payment_id
      and capability.product_order_id = v_result.product_order_id
      and capability.checkout_attempt_id = v_result.attempt_id
      and capability.environment = 'production'
      and capability.purpose in ('confirm', 'cancel')
      and capability.capability_version = 1
      and capability.expires_at =
        (p_payload ->> 'capability_expires_at')::timestamptz
      and capability.token_hash in (
        p_payload ->> 'confirm_token_hash',
        p_payload ->> 'cancel_token_hash'
      )
  ) <> 2 then
    raise exception using
      errcode = '23514',
      message = 'line_pay_one_dollar_entry_test_binding_invalid';
  end if;

  return query select
    case
      when v_replayed then 'already_initialized'::text
      else v_result.result_code::text
    end,
    v_result.product_order_id::uuid,
    v_result.payment_id::uuid,
    v_result.attempt_id::uuid,
    v_result.outbox_id::uuid,
    v_result.confirm_capability_id::uuid,
    v_result.cancel_capability_id::uuid,
    v_result.merchant_order_no::text,
    v_result.request_state::text;
end;
$$;

revoke all on function public.initialize_line_pay_one_dollar_product_order_test(jsonb)
from public, anon, authenticated, line_pay_payment_executor;
grant execute on function public.initialize_line_pay_one_dollar_product_order_test(jsonb)
to service_role;

comment on function public.initialize_line_pay_one_dollar_product_order_test(jsonb)
is 'Atomically initializes the fixed Production LINE Pay NT$1 product-order test without shipping or fulfillment; service_role only.';

commit;
