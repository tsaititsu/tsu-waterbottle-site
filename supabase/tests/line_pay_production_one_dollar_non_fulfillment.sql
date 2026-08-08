\set ON_ERROR_STOP on

insert into auth.users (id)
values ('51000000-0000-4000-8000-000000000001')
on conflict (id) do nothing;

create temporary table line_pay_nt1_payload (
  payload jsonb not null
) on commit preserve rows;

insert into line_pay_nt1_payload (payload)
values (
  pg_catalog.jsonb_build_object(
    'user_id', '51000000-0000-4000-8000-000000000001',
    'environment', 'production',
    'order_no', 'LPONE-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    'merchant_order_no', 'LP_ONE_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    'customer_name', 'LINE Pay NT$1 入口測試｜AI 命盤分析',
    'customer_email', null,
    'customer_phone', '0900000000',
    'note', 'Production 管理員 NT$1 入口測試｜AI 命盤分析；不出貨、不提供服務',
    'items', pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object(
        'product_slug',
          'line-pay-production-one-dollar-test-ai_chart_report',
        'product_name',
          'LINE Pay NT$1 入口測試｜AI 命盤分析（不出貨／不提供服務）',
        'unit_price_twd', 1,
        'quantity', 1,
        'product_snapshot', pg_catalog.jsonb_build_object(
          'slug', 'line-pay-production-one-dollar-test-ai_chart_report',
          'name',
            'LINE Pay NT$1 入口測試｜AI 命盤分析（不出貨／不提供服務）',
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
      'line-pay-production-one-dollar:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb:51000000-0000-4000-8000-000000000001:ai_chart_report',
    'request_body_sha256', pg_catalog.repeat('c', 64),
    'confirm_token_hash', pg_catalog.repeat('d', 64),
    'cancel_token_hash', pg_catalog.repeat('e', 64),
    'capability_expires_at',
      pg_catalog.to_char(
        pg_catalog.clock_timestamp() + interval '30 minutes',
        'YYYY-MM-DD"T"HH24:MI:SS.USOF'
      )
  )
);

grant select on line_pay_nt1_payload to service_role;

set role service_role;

create temporary table line_pay_nt1_initialized
on commit preserve rows
as
select *
from public.initialize_line_pay_production_nt1_non_fulfillment_checkout(
  (select payload from line_pay_nt1_payload),
  'ai_chart_report'
);

create temporary table line_pay_nt1_replayed
on commit preserve rows
as
select *
from public.initialize_line_pay_production_nt1_non_fulfillment_checkout(
  (select payload from line_pay_nt1_payload),
  'ai_chart_report'
);

reset role;

do $happy_path$
declare
  v_product_order_id uuid;
begin
  select product_order_id
  into strict v_product_order_id
  from line_pay_nt1_initialized;

  if not exists (
    select 1
    from line_pay_nt1_initialized as initialized
    join line_pay_nt1_replayed as replayed
      on replayed.product_order_id = initialized.product_order_id
     and replayed.payment_id = initialized.payment_id
     and replayed.attempt_id = initialized.attempt_id
     and replayed.outbox_id = initialized.outbox_id
     and replayed.confirm_capability_id = initialized.confirm_capability_id
     and replayed.cancel_capability_id = initialized.cancel_capability_id
    where initialized.result_code = 'initialized'
      and initialized.request_state = 'queued'
      and replayed.result_code = 'already_initialized'
  )
    or not exists (
      select 1
      from public.product_orders as product_order
      where product_order.id = v_product_order_id
        and product_order.fulfillment_mode = 'none'
        and product_order.shipping_status = 'not_applicable'
        and product_order.order_status = 'pending_payment'
        and product_order.payment_status = 'pending'
        and product_order.total_amount_twd = 1
    )
    or not exists (
      select 1
      from line_pay_private.line_pay_production_one_dollar_non_fulfillment_orders
        as marker
      where marker.product_order_id = v_product_order_id
        and marker.user_id = '51000000-0000-4000-8000-000000000001'
        and marker.entry_source = 'ai_chart_report'
    )
    or (
      select pg_catalog.count(*)
      from public.product_order_items as item
      where item.order_id = v_product_order_id
    ) <> 1
    or (
      select pg_catalog.count(*)
      from public.product_shipping_info as shipping
      where shipping.order_id = v_product_order_id
    ) <> 1 then
    raise exception 'line_pay_nt1_atomic_non_fulfillment_contract_failed';
  end if;
end;
$happy_path$;

do $immutable_aggregate$
declare
  v_product_order_id uuid;
  v_rejected boolean;
begin
  select product_order_id into strict v_product_order_id
  from line_pay_nt1_initialized;

  v_rejected := false;
  begin
    update public.product_orders
    set fulfillment_mode = 'physical',
        shipping_status = 'not_shipped'
    where id = v_product_order_id;
  exception when check_violation then
    if sqlerrm <> 'line_pay_production_one_dollar_fulfillment_is_forbidden' then
      raise;
    end if;
    v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'line_pay_nt1_physical_escape_was_not_rejected';
  end if;

  v_rejected := false;
  begin
    update public.product_orders
    set order_status = 'completed'
    where id = v_product_order_id;
  exception when check_violation then
    if sqlerrm <> 'line_pay_production_one_dollar_fulfillment_is_forbidden' then
      raise;
    end if;
    v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'line_pay_nt1_completion_was_not_rejected';
  end if;

  v_rejected := false;
  begin
    insert into public.product_order_items (
      order_id,
      product_slug,
      product_name,
      unit_price_twd,
      quantity,
      subtotal_twd
    ) values (
      v_product_order_id,
      'forged-zero-value-item',
      'Forged zero value item',
      0,
      1,
      0
    );
  exception when check_violation then
    if sqlerrm <> 'line_pay_production_one_dollar_aggregate_is_immutable' then
      raise;
    end if;
    v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'line_pay_nt1_extra_item_was_not_rejected';
  end if;

  v_rejected := false;
  begin
    delete from public.product_shipping_info
    where order_id = v_product_order_id;
  exception when check_violation then
    if sqlerrm <> 'line_pay_production_one_dollar_aggregate_is_immutable' then
      raise;
    end if;
    v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'line_pay_nt1_shipping_delete_was_not_rejected';
  end if;
end;
$immutable_aggregate$;

insert into public.product_orders (
  order_no,
  user_id,
  customer_name,
  total_amount_twd,
  payment_method,
  payment_status,
  order_status,
  shipping_status,
  fulfillment_mode,
  environment,
  currency
) values (
  'NORMAL-NON-FULFILLMENT-SERVICE-1',
  '51000000-0000-4000-8000-000000000001',
  'Normal digital service',
  1,
  'bank_transfer',
  'paid',
  'paid',
  'not_applicable',
  'none',
  'production',
  'TWD'
);

update public.product_orders
set order_status = 'completed'
where order_no = 'NORMAL-NON-FULFILLMENT-SERVICE-1';

do $normal_service_unaffected$
begin
  if not exists (
    select 1 from public.product_orders
    where order_no = 'NORMAL-NON-FULFILLMENT-SERVICE-1'
      and order_status = 'completed'
  ) then
    raise exception 'normal_non_fulfillment_service_was_blocked';
  end if;
end;
$normal_service_unaffected$;

set role service_role;

-- Leave one exact aggregate intentionally unmarked so the Node harness can
-- prove that a concurrent child mutation and marker transaction serialize on
-- the same order-level advisory lock. No provider request is executed.
create temporary table line_pay_nt1_race_initialized
on commit preserve rows
as
select *
from public.initialize_product_order_line_pay_checkout(
  (
    select payload || pg_catalog.jsonb_build_object(
      'order_no', 'LPONE-eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      'merchant_order_no', 'LP_ONE_eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      'idempotency_key',
        'line-pay-production-one-dollar:ffffffffffffffffffffffffffffffffffffffff:51000000-0000-4000-8000-000000000001:ai_chart_report',
      'request_body_sha256', pg_catalog.repeat('7', 64),
      'confirm_token_hash', pg_catalog.repeat('8', 64),
      'cancel_token_hash', pg_catalog.repeat('9', 64)
    )
    from line_pay_nt1_payload
  )
);

do $atomic_rollback$
declare
  v_invalid_payload jsonb;
  v_rejected boolean := false;
begin
  select payload || pg_catalog.jsonb_build_object(
    'order_no', 'LPONE-cccccccccccccccccccccccccccccccc',
    'merchant_order_no', 'LP_ONE_cccccccccccccccccccccccccccccc',
    'idempotency_key',
      'line-pay-production-one-dollar:dddddddddddddddddddddddddddddddddddddddd:51000000-0000-4000-8000-000000000001:ai_chart_report',
    'request_body_sha256', pg_catalog.repeat('4', 64),
    'confirm_token_hash', pg_catalog.repeat('5', 64),
    'cancel_token_hash', pg_catalog.repeat('6', 64),
    'items', (payload -> 'items') || pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object(
        'product_slug', 'forged-zero-value-item',
        'product_name', 'Forged zero value item',
        'unit_price_twd', 0,
        'quantity', 1,
        'product_snapshot', pg_catalog.jsonb_build_object(
          'slug', 'forged-zero-value-item',
          'name', 'Forged zero value item',
          'category', '符咒商品',
          'priceTwd', 0
        )
      )
    )
  ) into strict v_invalid_payload
  from line_pay_nt1_payload;

  begin
    perform *
    from public.initialize_line_pay_production_nt1_non_fulfillment_checkout(
      v_invalid_payload,
      'ai_chart_report'
    );
  exception when check_violation then
    if sqlerrm <> 'line_pay_production_one_dollar_non_fulfillment_target_invalid'
    then
      raise;
    end if;
    v_rejected := true;
  end;

  if not v_rejected
     or exists (
       select 1 from public.product_orders
       where order_no = 'LPONE-cccccccccccccccccccccccccccccccc'
     )
     or exists (
       select 1 from public.line_pay_checkout_attempts
       where idempotency_key =
         'line-pay-production-one-dollar:dddddddddddddddddddddddddddddddddddddddd:51000000-0000-4000-8000-000000000001:ai_chart_report'
     ) then
    raise exception 'line_pay_nt1_atomic_rollback_contract_failed';
  end if;
end;
$atomic_rollback$;

reset role;

do $acl_contract$
declare
  v_wrapper regprocedure :=
    'public.initialize_line_pay_production_nt1_non_fulfillment_checkout(jsonb,text)'::regprocedure;
  v_private_marker regprocedure :=
    'line_pay_private.mark_line_pay_production_one_dollar_non_fulfillment(uuid,uuid,text)'::regprocedure;
begin
  if not pg_catalog.has_function_privilege('service_role', v_wrapper, 'EXECUTE')
    or pg_catalog.has_function_privilege('anon', v_wrapper, 'EXECUTE')
    or pg_catalog.has_function_privilege('authenticated', v_wrapper, 'EXECUTE')
    or pg_catalog.has_function_privilege(
      'line_pay_payment_executor', v_wrapper, 'EXECUTE'
    )
    or not pg_catalog.has_function_privilege(
      'service_role', v_private_marker, 'EXECUTE'
    )
    or pg_catalog.has_table_privilege(
      'service_role',
      'line_pay_private.line_pay_production_one_dollar_non_fulfillment_orders',
      'INSERT,UPDATE,DELETE'
    ) then
    raise exception 'line_pay_nt1_non_fulfillment_acl_contract_failed';
  end if;
end;
$acl_contract$;

select 'line_pay_production_one_dollar_non_fulfillment_contract_ready';
