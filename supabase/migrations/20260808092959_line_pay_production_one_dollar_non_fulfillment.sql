-- Add one atomic, service-role-only initializer for Production LINE Pay NT$1
-- entry tests. The aggregate and its immutable non-fulfillment marker are
-- committed together; no provider request is made by this database contract.
-- Applying this file remotely requires a separately approved exact-file run.

begin;

grant line_pay_payment_function_owner to current_user
  with inherit true, set true;

create table line_pay_private.line_pay_production_one_dollar_non_fulfillment_orders (
  product_order_id uuid primary key
    references public.product_orders(id) on delete restrict,
  user_id uuid not null,
  entry_source text not null,
  marked_at timestamptz not null default pg_catalog.clock_timestamp(),
  constraint line_pay_production_one_dollar_non_fulfillment_source_check
    check (entry_source in (
      'ai_chart_report',
      'ai_divination',
      'cart',
      'booking'
    ))
);

alter table line_pay_private.line_pay_production_one_dollar_non_fulfillment_orders
  owner to line_pay_payment_function_owner;
alter table line_pay_private.line_pay_production_one_dollar_non_fulfillment_orders
  enable row level security;

revoke all on table
  line_pay_private.line_pay_production_one_dollar_non_fulfillment_orders
from public, anon, authenticated, service_role, line_pay_payment_executor;

grant update (fulfillment_mode, shipping_status)
on table public.product_orders
to line_pay_payment_function_owner;

create function line_pay_private.mark_line_pay_production_one_dollar_non_fulfillment(
  p_product_order_id uuid,
  p_user_id uuid,
  p_entry_source text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_expected_slug text;
  v_entry_label text;
  v_expected_product_name text;
  v_order record;
  v_existing_marker record;
begin
  if p_product_order_id is null
     or p_user_id is null
     or p_entry_source is null
     or p_entry_source not in (
       'ai_chart_report',
       'ai_divination',
       'cart',
       'booking'
     ) then
    raise exception using
      errcode = '22023',
      message = 'line_pay_production_one_dollar_non_fulfillment_invalid_input';
  end if;

  v_expected_slug :=
    'line-pay-production-one-dollar-test-' || p_entry_source;
  v_entry_label := case p_entry_source
    when 'ai_chart_report' then 'AI 命盤分析'
    when 'ai_divination' then 'AI 紫微牌卡占卜'
    when 'cart' then '購物車'
    when 'booking' then '水瓶先生論命'
  end;
  v_expected_product_name :=
    'LINE Pay NT$1 入口測試｜' || v_entry_label
    || '（不出貨／不提供服務）';

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'line_pay_production_nt1_non_fulfillment:'
      || p_product_order_id::text,
      0
    )
  );

  select
    product_order.id,
    product_order.fulfillment_mode,
    product_order.shipping_status,
    product_order.order_status,
    product_order.payment_status,
    product_order.payment_request_state as product_order_request_state,
    product_order.reconciliation_required,
    payment.id as payment_id,
    payment.status as provider_payment_status,
    payment.request_state as payment_request_state,
    payment.reconciliation_required as payment_reconciliation_required,
    attempt.id as attempt_id,
    attempt.request_state as attempt_request_state,
    attempt.reconciliation_required as attempt_reconciliation_required
  into v_order
  from public.product_orders as product_order
  join public.payments as payment
    on payment.id = product_order.payment_id
   and payment.product_order_id = product_order.id
  join public.line_pay_checkout_attempts as attempt
    on attempt.id = product_order.checkout_attempt_id
   and attempt.product_order_id = product_order.id
   and attempt.payment_id = payment.id
  where product_order.id = p_product_order_id
    and product_order.user_id = p_user_id
    and product_order.environment = 'production'
    and product_order.payment_method = 'line_pay'
    and not product_order.sandbox_test
    and product_order.currency = 'TWD'
    and product_order.total_amount_twd = 1
    and product_order.order_no ~ '^LPONE-[0-9a-f]{32}$'
    and product_order.customer_name =
      'LINE Pay NT$1 入口測試｜' || v_entry_label
    and product_order.customer_email is null
    and product_order.customer_phone = '0900000000'
    and product_order.note =
      'Production 管理員 NT$1 入口測試｜' || v_entry_label
      || '；不出貨、不提供服務'
    and payment.user_id = p_user_id
    and payment.provider = 'line_pay'
    and payment.item_type = 'spiritual_product_order'
    and payment.item_id = product_order.id::text
    and payment.amount_twd = 1
    and payment.currency = 'TWD'
    and payment.environment = 'production'
    and payment.merchant_order_no ~ '^LP_ONE_[0-9a-f]{32}$'
    and payment.raw_payload = pg_catalog.jsonb_build_object(
      'linePay',
      pg_catalog.jsonb_build_object(
        'orderId', payment.merchant_order_no,
        'sourceType', 'product_order',
        'sourceId', product_order.id::text
      )
    )
    and attempt.user_id = p_user_id
    and attempt.provider = 'line_pay'
    and attempt.environment = 'production'
    and attempt.amount_twd = 1
    and attempt.currency = 'TWD'
    and attempt.merchant_order_no = payment.merchant_order_no
    and attempt.idempotency_key = payment.request_idempotency_key
    and attempt.request_body_sha256 = payment.request_body_sha256
    and attempt.idempotency_key ~ (
      '^line-pay-production-one-dollar:[0-9a-f]{40}:[0-9a-f-]{36}:'
      || p_entry_source || '$'
    )
  for update of product_order, payment, attempt;

  if not found
     or (
       select pg_catalog.count(*)
       from public.product_order_items as item
       where item.order_id = p_product_order_id
     ) <> 1
     or (
       select pg_catalog.count(*)
       from public.product_order_items as item
       where item.order_id = p_product_order_id
         and item.product_slug = v_expected_slug
         and item.product_name = v_expected_product_name
         and item.unit_price_twd = 1
         and item.quantity = 1
         and item.subtotal_twd = 1
         and item.product_snapshot = pg_catalog.jsonb_build_object(
           'slug', v_expected_slug,
           'name', v_expected_product_name,
           'category', '符咒商品',
           'priceTwd', 1
         )
     ) <> 1
     or (
       select pg_catalog.count(*)
       from public.product_shipping_info as shipping
       where shipping.order_id = p_product_order_id
     ) <> 1
     or (
       select pg_catalog.count(*)
       from public.product_shipping_info as shipping
       where shipping.order_id = p_product_order_id
         and shipping.shipping_method = 'manual'
         and shipping.recipient_name = 'LINE Pay NT$1 測試（請勿出貨）'
         and shipping.recipient_phone = '0900000000'
         and shipping.recipient_email is null
         and shipping.postal_code is null
         and shipping.address = '內部金流測試訂單，請勿出貨'
         and shipping.store_type is null
         and shipping.store_id is null
         and shipping.store_name is null
         and shipping.store_address is null
         and shipping.store_phone is null
     ) <> 1 then
    raise exception using
      errcode = '23514',
      message = 'line_pay_production_one_dollar_non_fulfillment_target_invalid';
  end if;

  select marker.user_id, marker.entry_source
  into v_existing_marker
  from line_pay_private.line_pay_production_one_dollar_non_fulfillment_orders
    as marker
  where marker.product_order_id = p_product_order_id;

  if found then
    if v_existing_marker.user_id <> p_user_id
       or v_existing_marker.entry_source <> p_entry_source
       or v_order.fulfillment_mode <> 'none'
       or v_order.shipping_status <> 'not_applicable'
       or v_order.order_status in ('preparing', 'shipped', 'completed') then
      raise exception using
        errcode = '23514',
        message = 'line_pay_production_one_dollar_non_fulfillment_target_invalid';
    end if;
    return;
  end if;

  if v_order.fulfillment_mode <> 'physical'
     or v_order.shipping_status <> 'not_shipped'
     or v_order.order_status <> 'pending_payment'
     or v_order.payment_status <> 'pending'
     or v_order.product_order_request_state <> 'initialized'
     or v_order.reconciliation_required
     or v_order.provider_payment_status <> 'pending'
     or v_order.payment_request_state <> 'initialized'
     or v_order.payment_reconciliation_required
     or v_order.attempt_request_state <> 'queued'
     or v_order.attempt_reconciliation_required then
    raise exception using
      errcode = '23514',
      message = 'line_pay_production_one_dollar_non_fulfillment_target_invalid';
  end if;

  insert into line_pay_private.line_pay_production_one_dollar_non_fulfillment_orders (
    product_order_id,
    user_id,
    entry_source
  ) values (
    p_product_order_id,
    p_user_id,
    p_entry_source
  );

  update public.product_orders as product_order
  set fulfillment_mode = 'none',
      shipping_status = 'not_applicable'
  where product_order.id = p_product_order_id
    and product_order.user_id = p_user_id
    and product_order.fulfillment_mode = 'physical'
    and product_order.shipping_status = 'not_shipped'
    and product_order.order_status = 'pending_payment'
    and product_order.payment_status = 'pending'
    and product_order.payment_request_state = 'initialized';

  if not found then
    raise exception using
      errcode = '23514',
      message = 'line_pay_production_one_dollar_non_fulfillment_transition_failed';
  end if;
end;
$$;

alter function line_pay_private.mark_line_pay_production_one_dollar_non_fulfillment(
  uuid,
  uuid,
  text
) owner to line_pay_payment_function_owner;
comment on function line_pay_private.mark_line_pay_production_one_dollar_non_fulfillment(
  uuid,
  uuid,
  text
) is 'line_pay_production_one_dollar_non_fulfillment_private_v2';
revoke all on function line_pay_private.mark_line_pay_production_one_dollar_non_fulfillment(
  uuid,
  uuid,
  text
) from public, anon, authenticated, line_pay_payment_executor;
grant execute on function line_pay_private.mark_line_pay_production_one_dollar_non_fulfillment(
  uuid,
  uuid,
  text
) to service_role;

create function line_pay_private.enforce_line_pay_production_one_dollar_order_guard()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'line_pay_production_nt1_non_fulfillment:' || old.id::text,
      0
    )
  );

  if exists (
    select 1
    from line_pay_private.line_pay_production_one_dollar_non_fulfillment_orders
      as marker
    where marker.product_order_id = old.id
  ) and (
    new.fulfillment_mode <> 'none'
    or new.shipping_status <> 'not_applicable'
    or new.order_status in ('preparing', 'shipped', 'completed')
  ) then
    raise exception using
      errcode = '23514',
      message = 'line_pay_production_one_dollar_fulfillment_is_forbidden';
  end if;
  return new;
end;
$$;

alter function line_pay_private.enforce_line_pay_production_one_dollar_order_guard()
  owner to line_pay_payment_function_owner;
revoke all on function line_pay_private.enforce_line_pay_production_one_dollar_order_guard()
from public, anon, authenticated, service_role, line_pay_payment_executor;

create trigger line_pay_00_production_one_dollar_order_guard
before update on public.product_orders
for each row execute function
  line_pay_private.enforce_line_pay_production_one_dollar_order_guard();

create function line_pay_private.enforce_line_pay_production_one_dollar_child_guard()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_old_order_id uuid;
  v_new_order_id uuid;
  v_old_lock bigint;
  v_new_lock bigint;
begin
  if tg_op <> 'INSERT' then
    v_old_order_id := old.order_id;
  end if;
  if tg_op <> 'DELETE' then
    v_new_order_id := new.order_id;
  end if;

  if v_old_order_id is not null then
    v_old_lock := pg_catalog.hashtextextended(
      'line_pay_production_nt1_non_fulfillment:' || v_old_order_id::text,
      0
    );
  end if;
  if v_new_order_id is not null then
    v_new_lock := pg_catalog.hashtextextended(
      'line_pay_production_nt1_non_fulfillment:' || v_new_order_id::text,
      0
    );
  end if;

  if v_old_lock is not null and v_new_lock is not null then
    perform pg_catalog.pg_advisory_xact_lock(
      least(v_old_lock, v_new_lock)
    );
    if v_old_lock <> v_new_lock then
      perform pg_catalog.pg_advisory_xact_lock(
        greatest(v_old_lock, v_new_lock)
      );
    end if;
  else
    perform pg_catalog.pg_advisory_xact_lock(
      coalesce(v_old_lock, v_new_lock)
    );
  end if;

  if exists (
    select 1
    from line_pay_private.line_pay_production_one_dollar_non_fulfillment_orders
      as marker
    where marker.product_order_id in (v_old_order_id, v_new_order_id)
  ) then
    raise exception using
      errcode = '23514',
      message = 'line_pay_production_one_dollar_aggregate_is_immutable';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

alter function line_pay_private.enforce_line_pay_production_one_dollar_child_guard()
  owner to line_pay_payment_function_owner;
revoke all on function line_pay_private.enforce_line_pay_production_one_dollar_child_guard()
from public, anon, authenticated, service_role, line_pay_payment_executor;

create trigger line_pay_production_one_dollar_item_guard
before insert or update or delete on public.product_order_items
for each row execute function
  line_pay_private.enforce_line_pay_production_one_dollar_child_guard();

create trigger line_pay_production_one_dollar_shipping_guard
before insert or update or delete on public.product_shipping_info
for each row execute function
  line_pay_private.enforce_line_pay_production_one_dollar_child_guard();

create function public.initialize_line_pay_production_nt1_non_fulfillment_checkout(
  p_payload jsonb,
  p_entry_source text
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
  v_initialized record;
begin
  if p_payload is null
     or p_payload ->> 'environment' <> 'production'
     or p_entry_source not in (
       'ai_chart_report',
       'ai_divination',
       'cart',
       'booking'
     ) then
    raise exception using
      errcode = '22023',
      message = 'line_pay_production_one_dollar_non_fulfillment_invalid_input';
  end if;

  select *
  into strict v_initialized
  from public.initialize_product_order_line_pay_checkout(p_payload);

  perform line_pay_private.mark_line_pay_production_one_dollar_non_fulfillment(
    v_initialized.product_order_id,
    (p_payload ->> 'user_id')::uuid,
    p_entry_source
  );

  return query select
    v_initialized.result_code::text,
    v_initialized.product_order_id::uuid,
    v_initialized.payment_id::uuid,
    v_initialized.attempt_id::uuid,
    v_initialized.outbox_id::uuid,
    v_initialized.confirm_capability_id::uuid,
    v_initialized.cancel_capability_id::uuid,
    v_initialized.merchant_order_no::text,
    v_initialized.request_state::text;
end;
$$;

comment on function public.initialize_line_pay_production_nt1_non_fulfillment_checkout(
  jsonb,
  text
) is 'line_pay_production_one_dollar_atomic_non_fulfillment_v2';
revoke all on function public.initialize_line_pay_production_nt1_non_fulfillment_checkout(
  jsonb,
  text
) from public, anon, authenticated, line_pay_payment_executor;
grant execute on function public.initialize_line_pay_production_nt1_non_fulfillment_checkout(
  jsonb,
  text
) to service_role;

revoke line_pay_payment_function_owner from current_user;

do $postcondition$
declare
  v_wrapper pg_catalog.pg_proc%rowtype;
  v_private_marker pg_catalog.pg_proc%rowtype;
  v_order_guard pg_catalog.pg_proc%rowtype;
  v_child_guard pg_catalog.pg_proc%rowtype;
begin
  select procedure.* into v_wrapper
  from pg_catalog.pg_proc as procedure
  where procedure.oid = pg_catalog.to_regprocedure(
    'public.initialize_line_pay_production_nt1_non_fulfillment_checkout(jsonb,text)'
  );
  select procedure.* into v_private_marker
  from pg_catalog.pg_proc as procedure
  where procedure.oid = pg_catalog.to_regprocedure(
    'line_pay_private.mark_line_pay_production_one_dollar_non_fulfillment(uuid,uuid,text)'
  );
  select procedure.* into v_order_guard
  from pg_catalog.pg_proc as procedure
  where procedure.oid = pg_catalog.to_regprocedure(
    'line_pay_private.enforce_line_pay_production_one_dollar_order_guard()'
  );
  select procedure.* into v_child_guard
  from pg_catalog.pg_proc as procedure
  where procedure.oid = pg_catalog.to_regprocedure(
    'line_pay_private.enforce_line_pay_production_one_dollar_child_guard()'
  );

  if v_wrapper.oid is null
    or v_wrapper.prosecdef
    or v_wrapper.provolatile <> 'v'
    or v_wrapper.proconfig is distinct from array['search_path=""']::text[]
    or v_private_marker.oid is null
    or not v_private_marker.prosecdef
    or v_private_marker.proowner <>
      pg_catalog.to_regrole('line_pay_payment_function_owner')::oid
    or v_order_guard.oid is null
    or not v_order_guard.prosecdef
    or v_order_guard.proowner <>
      pg_catalog.to_regrole('line_pay_payment_function_owner')::oid
    or v_child_guard.oid is null
    or not v_child_guard.prosecdef
    or v_child_guard.proowner <>
      pg_catalog.to_regrole('line_pay_payment_function_owner')::oid
    or pg_catalog.to_regclass(
      'line_pay_private.line_pay_production_one_dollar_non_fulfillment_orders'
    ) is null
    or not pg_catalog.has_function_privilege(
      'service_role', v_wrapper.oid, 'EXECUTE'
    )
    or pg_catalog.has_function_privilege('anon', v_wrapper.oid, 'EXECUTE')
    or pg_catalog.has_function_privilege(
      'authenticated', v_wrapper.oid, 'EXECUTE'
    )
    or pg_catalog.has_function_privilege(
      'line_pay_payment_executor', v_wrapper.oid, 'EXECUTE'
    ) then
    raise exception using
      errcode = '55000',
      message = 'line_pay_production_one_dollar_non_fulfillment_postcondition_failed';
  end if;
end;
$postcondition$;

commit;
