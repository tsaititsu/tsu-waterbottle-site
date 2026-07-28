-- Additive LINE Pay checkout aggregate initializer.
-- This migration does not enable LINE Pay Runtime and must not be applied to
-- any remote database without a separately reviewed exact-file deployment.

create or replace function public.initialize_product_order_line_pay_checkout(
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
  v_shipping_expected_keys constant text[] := array[
    'recipient_name',
    'recipient_phone',
    'recipient_email',
    'shipping_method',
    'postal_code',
    'address',
    'store_type',
    'store_id',
    'store_name',
    'store_address',
    'store_phone'
  ]::text[];
  v_user_id uuid;
  v_environment text;
  v_order_no text;
  v_merchant_order_no text;
  v_total_amount_twd numeric;
  v_idempotency_key text;
  v_request_body_sha256 text;
  v_confirm_token_hash text;
  v_cancel_token_hash text;
  v_capability_expires_at timestamptz;
  v_shipping_info jsonb;
  v_product_order_id uuid := pg_catalog.gen_random_uuid();
  v_payment_id uuid := pg_catalog.gen_random_uuid();
  v_attempt_id uuid := pg_catalog.gen_random_uuid();
  v_outbox_id uuid := pg_catalog.gen_random_uuid();
  v_confirm_capability_id uuid := pg_catalog.gen_random_uuid();
  v_cancel_capability_id uuid := pg_catalog.gen_random_uuid();
  v_existing_attempt public.line_pay_checkout_attempts%rowtype;
  v_existing_payment public.payments%rowtype;
  v_existing_order public.product_orders%rowtype;
  v_existing_outbox public.line_pay_request_outbox%rowtype;
  v_existing_confirm public.line_pay_callback_capabilities%rowtype;
  v_existing_cancel public.line_pay_callback_capabilities%rowtype;
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
     or pg_catalog.jsonb_typeof(p_payload -> 'user_id') <> 'string'
     or (p_payload ->> 'user_id')
       !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
     or pg_catalog.jsonb_typeof(p_payload -> 'environment') <> 'string'
     or p_payload ->> 'environment' not in ('sandbox', 'production')
     or pg_catalog.jsonb_typeof(p_payload -> 'order_no') <> 'string'
     or p_payload ->> 'order_no' !~ '^[A-Za-z0-9_:-]{1,100}$'
     or pg_catalog.jsonb_typeof(p_payload -> 'merchant_order_no') <> 'string'
     or p_payload ->> 'merchant_order_no' !~ '^[A-Za-z0-9_:-]{1,100}$'
     or not (
       pg_catalog.jsonb_typeof(p_payload -> 'customer_name') in ('string', 'null')
       and pg_catalog.jsonb_typeof(p_payload -> 'customer_email') in ('string', 'null')
       and pg_catalog.jsonb_typeof(p_payload -> 'customer_phone') in ('string', 'null')
       and pg_catalog.jsonb_typeof(p_payload -> 'note') in ('string', 'null')
     )
     or pg_catalog.length(coalesce(p_payload ->> 'customer_name', '')) > 200
     or pg_catalog.length(coalesce(p_payload ->> 'customer_email', '')) > 320
     or pg_catalog.length(coalesce(p_payload ->> 'customer_phone', '')) > 64
     or pg_catalog.length(coalesce(p_payload ->> 'note', '')) > 1000
     or pg_catalog.jsonb_typeof(p_payload -> 'items') <> 'array'
     or pg_catalog.jsonb_array_length(p_payload -> 'items') not between 1 and 100
     or pg_catalog.jsonb_typeof(p_payload -> 'shipping_info') <> 'object'
     or pg_catalog.jsonb_typeof(p_payload -> 'idempotency_key') <> 'string'
     or pg_catalog.length(p_payload ->> 'idempotency_key') not between 16 and 200
     or p_payload ->> 'idempotency_key' ~ '[[:space:]]'
     or pg_catalog.jsonb_typeof(p_payload -> 'request_body_sha256') <> 'string'
     or p_payload ->> 'request_body_sha256' !~ '^[0-9a-f]{64}$'
     or pg_catalog.jsonb_typeof(p_payload -> 'confirm_token_hash') <> 'string'
     or p_payload ->> 'confirm_token_hash' !~ '^[0-9a-f]{64}$'
     or pg_catalog.jsonb_typeof(p_payload -> 'cancel_token_hash') <> 'string'
     or p_payload ->> 'cancel_token_hash' !~ '^[0-9a-f]{64}$'
     or p_payload ->> 'confirm_token_hash' = p_payload ->> 'cancel_token_hash'
     or pg_catalog.jsonb_typeof(p_payload -> 'capability_expires_at') <> 'string'
     or not pg_catalog.pg_input_is_valid(
       p_payload ->> 'capability_expires_at',
       'timestamp with time zone'
     ) then
    raise exception using
      errcode = '22023',
      message = 'line_pay_initialization_invalid_input';
  end if;

  v_user_id := (p_payload ->> 'user_id')::uuid;
  v_environment := p_payload ->> 'environment';
  v_order_no := p_payload ->> 'order_no';
  v_merchant_order_no := p_payload ->> 'merchant_order_no';
  v_idempotency_key := p_payload ->> 'idempotency_key';
  v_request_body_sha256 := p_payload ->> 'request_body_sha256';
  v_confirm_token_hash := p_payload ->> 'confirm_token_hash';
  v_cancel_token_hash := p_payload ->> 'cancel_token_hash';
  v_capability_expires_at :=
    (p_payload ->> 'capability_expires_at')::timestamptz;
  v_shipping_info := p_payload -> 'shipping_info';

  if v_capability_expires_at <= pg_catalog.clock_timestamp() + interval '5 minutes'
     or v_capability_expires_at > pg_catalog.clock_timestamp() + interval '24 hours'
     or not (v_shipping_info ?& v_shipping_expected_keys)
     or exists (
       select 1
       from pg_catalog.jsonb_object_keys(v_shipping_info) as supplied(key)
       where not (supplied.key = any (v_shipping_expected_keys))
     )
     or not (
       pg_catalog.jsonb_typeof(v_shipping_info -> 'recipient_name') in ('string', 'null')
       and pg_catalog.jsonb_typeof(v_shipping_info -> 'recipient_phone') in ('string', 'null')
       and pg_catalog.jsonb_typeof(v_shipping_info -> 'recipient_email') in ('string', 'null')
       and pg_catalog.jsonb_typeof(v_shipping_info -> 'shipping_method') = 'string'
       and pg_catalog.jsonb_typeof(v_shipping_info -> 'postal_code') in ('string', 'null')
       and pg_catalog.jsonb_typeof(v_shipping_info -> 'address') in ('string', 'null')
       and pg_catalog.jsonb_typeof(v_shipping_info -> 'store_type') in ('string', 'null')
       and pg_catalog.jsonb_typeof(v_shipping_info -> 'store_id') in ('string', 'null')
       and pg_catalog.jsonb_typeof(v_shipping_info -> 'store_name') in ('string', 'null')
       and pg_catalog.jsonb_typeof(v_shipping_info -> 'store_address') in ('string', 'null')
       and pg_catalog.jsonb_typeof(v_shipping_info -> 'store_phone') in ('string', 'null')
     )
     or v_shipping_info ->> 'shipping_method' not in (
       'manual',
       'convenience_store_c2c',
       'convenience_store_b2c',
       'home_delivery'
     )
     or pg_catalog.length(coalesce(v_shipping_info ->> 'recipient_name', '')) > 200
     or pg_catalog.length(coalesce(v_shipping_info ->> 'recipient_phone', '')) > 64
     or pg_catalog.length(coalesce(v_shipping_info ->> 'recipient_email', '')) > 320
     or pg_catalog.length(coalesce(v_shipping_info ->> 'postal_code', '')) > 32
     or pg_catalog.length(coalesce(v_shipping_info ->> 'address', '')) > 500
     or pg_catalog.length(coalesce(v_shipping_info ->> 'store_type', '')) > 64
     or pg_catalog.length(coalesce(v_shipping_info ->> 'store_id', '')) > 128
     or pg_catalog.length(coalesce(v_shipping_info ->> 'store_name', '')) > 200
     or pg_catalog.length(coalesce(v_shipping_info ->> 'store_address', '')) > 500
     or pg_catalog.length(coalesce(v_shipping_info ->> 'store_phone', '')) > 64 then
    raise exception using
      errcode = '22023',
      message = 'line_pay_initialization_invalid_input';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_payload -> 'items') as entry(item)
    where pg_catalog.jsonb_typeof(entry.item) <> 'object'
       or not (
         entry.item ?& array[
           'product_slug',
           'product_name',
           'unit_price_twd',
           'quantity',
           'product_snapshot'
         ]::text[]
       )
       or exists (
         select 1
         from pg_catalog.jsonb_object_keys(entry.item) as supplied(key)
         where supplied.key not in (
           'product_slug',
           'product_name',
           'unit_price_twd',
           'quantity',
           'product_snapshot'
         )
       )
       or pg_catalog.jsonb_typeof(entry.item -> 'product_slug') <> 'string'
       or pg_catalog.length(entry.item ->> 'product_slug') not between 1 and 200
       or pg_catalog.jsonb_typeof(entry.item -> 'product_name') <> 'string'
       or pg_catalog.length(entry.item ->> 'product_name') not between 1 and 500
       or pg_catalog.jsonb_typeof(entry.item -> 'unit_price_twd') <> 'number'
       or pg_catalog.length(entry.item ->> 'unit_price_twd') > 10
       or entry.item ->> 'unit_price_twd' !~ '^[0-9]+$'
       or (entry.item ->> 'unit_price_twd')::bigint > 2147483647
       or pg_catalog.jsonb_typeof(entry.item -> 'quantity') <> 'number'
       or pg_catalog.length(entry.item ->> 'quantity') > 10
       or entry.item ->> 'quantity' !~ '^[1-9][0-9]*$'
       or (entry.item ->> 'quantity')::bigint > 2147483647
       or pg_catalog.jsonb_typeof(entry.item -> 'product_snapshot')
         not in ('object', 'null')
       or pg_catalog.octet_length(
         (entry.item -> 'product_snapshot')::text
       ) > 16384
  ) then
    raise exception using
      errcode = '22023',
      message = 'line_pay_initialization_invalid_input';
  end if;

  select pg_catalog.sum(
    ((entry.item ->> 'unit_price_twd')::numeric)
    * ((entry.item ->> 'quantity')::numeric)
  )
  into v_total_amount_twd
  from pg_catalog.jsonb_array_elements(p_payload -> 'items') as entry(item);

  if v_total_amount_twd is null
     or v_total_amount_twd <= 0
     or v_total_amount_twd > 2147483647 then
    raise exception using
      errcode = '22023',
      message = 'line_pay_initialization_items_total_mismatch';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'line_pay_initialize:' || v_environment || ':' || v_idempotency_key,
      0
    )
  );

  select attempt.*
  into v_existing_attempt
  from public.line_pay_checkout_attempts as attempt
  where attempt.environment = v_environment
    and attempt.provider = 'line_pay'
    and attempt.idempotency_key = v_idempotency_key
  for update;

  if found then
    select payment.*
    into strict v_existing_payment
    from public.payments as payment
    where payment.id = v_existing_attempt.payment_id;

    select product_order.*
    into strict v_existing_order
    from public.product_orders as product_order
    where product_order.id = v_existing_attempt.product_order_id;

    select request_outbox.*
    into strict v_existing_outbox
    from public.line_pay_request_outbox as request_outbox
    where request_outbox.checkout_attempt_id = v_existing_attempt.id
      and request_outbox.operation = 'request';

    select capability.*
    into strict v_existing_confirm
    from public.line_pay_callback_capabilities as capability
    where capability.payment_id = v_existing_payment.id
      and capability.purpose = 'confirm'
      and capability.capability_version = 1;

    select capability.*
    into strict v_existing_cancel
    from public.line_pay_callback_capabilities as capability
    where capability.payment_id = v_existing_payment.id
      and capability.purpose = 'cancel'
      and capability.capability_version = 1;

    if v_existing_attempt.user_id <> v_user_id
       or v_existing_attempt.request_body_sha256 <> v_request_body_sha256
       or v_existing_attempt.amount_twd <> v_total_amount_twd
       or v_existing_attempt.merchant_order_no <> v_merchant_order_no
       or v_existing_payment.user_id <> v_user_id
       or v_existing_payment.environment <> v_environment
       or v_existing_payment.request_idempotency_key <> v_idempotency_key
       or v_existing_payment.request_body_sha256 <> v_request_body_sha256
       or v_existing_payment.merchant_order_no <> v_merchant_order_no
       or v_existing_order.user_id <> v_user_id
       or v_existing_order.environment <> v_environment
       or v_existing_order.order_no <> v_order_no
       or v_existing_order.total_amount_twd <> v_total_amount_twd
       or v_existing_order.customer_name is distinct from
         nullif(pg_catalog.btrim(coalesce(p_payload ->> 'customer_name', '')), '')
       or v_existing_order.customer_email is distinct from
         nullif(pg_catalog.btrim(coalesce(p_payload ->> 'customer_email', '')), '')
       or v_existing_order.customer_phone is distinct from
         nullif(pg_catalog.btrim(coalesce(p_payload ->> 'customer_phone', '')), '')
       or v_existing_order.note is distinct from
         nullif(pg_catalog.btrim(coalesce(p_payload ->> 'note', '')), '')
       or v_existing_outbox.request_body_sha256 <> v_request_body_sha256
       or v_existing_confirm.token_hash <> v_confirm_token_hash
       or v_existing_cancel.token_hash <> v_cancel_token_hash
       or v_existing_confirm.expires_at <> v_capability_expires_at
       or v_existing_cancel.expires_at <> v_capability_expires_at
       or exists (
         (
           select
             item.product_slug,
             item.product_name,
             item.unit_price_twd,
             item.quantity,
             item.product_snapshot
           from public.product_order_items as item
           where item.order_id = v_existing_order.id
           except all
           select
             entry.item ->> 'product_slug',
             entry.item ->> 'product_name',
             (entry.item ->> 'unit_price_twd')::integer,
             (entry.item ->> 'quantity')::integer,
             nullif(entry.item -> 'product_snapshot', 'null'::jsonb)
           from pg_catalog.jsonb_array_elements(p_payload -> 'items') as entry(item)
         )
         union all
         (
           select
             entry.item ->> 'product_slug',
             entry.item ->> 'product_name',
             (entry.item ->> 'unit_price_twd')::integer,
             (entry.item ->> 'quantity')::integer,
             nullif(entry.item -> 'product_snapshot', 'null'::jsonb)
           from pg_catalog.jsonb_array_elements(p_payload -> 'items') as entry(item)
           except all
           select
             item.product_slug,
             item.product_name,
             item.unit_price_twd,
             item.quantity,
             item.product_snapshot
           from public.product_order_items as item
           where item.order_id = v_existing_order.id
         )
       )
       or not exists (
         select 1
         from public.product_shipping_info as shipping
         where shipping.order_id = v_existing_order.id
           and shipping.recipient_name is not distinct from
             nullif(pg_catalog.btrim(coalesce(v_shipping_info ->> 'recipient_name', '')), '')
           and shipping.recipient_phone is not distinct from
             nullif(pg_catalog.btrim(coalesce(v_shipping_info ->> 'recipient_phone', '')), '')
           and shipping.recipient_email is not distinct from
             nullif(pg_catalog.btrim(coalesce(v_shipping_info ->> 'recipient_email', '')), '')
           and shipping.shipping_method = v_shipping_info ->> 'shipping_method'
           and shipping.postal_code is not distinct from
             nullif(pg_catalog.btrim(coalesce(v_shipping_info ->> 'postal_code', '')), '')
           and shipping.address is not distinct from
             nullif(pg_catalog.btrim(coalesce(v_shipping_info ->> 'address', '')), '')
           and shipping.store_type is not distinct from
             nullif(pg_catalog.btrim(coalesce(v_shipping_info ->> 'store_type', '')), '')
           and shipping.store_id is not distinct from
             nullif(pg_catalog.btrim(coalesce(v_shipping_info ->> 'store_id', '')), '')
           and shipping.store_name is not distinct from
             nullif(pg_catalog.btrim(coalesce(v_shipping_info ->> 'store_name', '')), '')
           and shipping.store_address is not distinct from
             nullif(pg_catalog.btrim(coalesce(v_shipping_info ->> 'store_address', '')), '')
           and shipping.store_phone is not distinct from
             nullif(pg_catalog.btrim(coalesce(v_shipping_info ->> 'store_phone', '')), '')
       ) then
      raise exception using
        errcode = '23505',
        message = 'line_pay_initialization_idempotency_conflict';
    end if;

    return query
    select
      'already_initialized'::text,
      v_existing_order.id,
      v_existing_payment.id,
      v_existing_attempt.id,
      v_existing_outbox.id,
      v_existing_confirm.id,
      v_existing_cancel.id,
      v_existing_attempt.merchant_order_no,
      v_existing_attempt.request_state;
    return;
  end if;

  insert into public.product_orders (
    id,
    order_no,
    user_id,
    customer_name,
    customer_email,
    customer_phone,
    total_amount_twd,
    payment_method,
    payment_status,
    order_status,
    shipping_status,
    note,
    environment,
    fulfillment_mode,
    sandbox_test,
    currency,
    checkout_attempt_id,
    payment_request_state,
    reconciliation_required,
    state_version
  ) values (
    v_product_order_id,
    v_order_no,
    v_user_id,
    nullif(pg_catalog.btrim(coalesce(p_payload ->> 'customer_name', '')), ''),
    nullif(pg_catalog.btrim(coalesce(p_payload ->> 'customer_email', '')), ''),
    nullif(pg_catalog.btrim(coalesce(p_payload ->> 'customer_phone', '')), ''),
    v_total_amount_twd::integer,
    'line_pay',
    'pending',
    'pending_payment',
    case when v_environment = 'sandbox' then 'not_applicable' else 'not_shipped' end,
    nullif(pg_catalog.btrim(coalesce(p_payload ->> 'note', '')), ''),
    v_environment,
    case when v_environment = 'sandbox' then 'none' else 'physical' end,
    v_environment = 'sandbox',
    'TWD',
    v_attempt_id,
    'initialized',
    false,
    0
  );

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
    v_product_order_id,
    entry.item ->> 'product_slug',
    entry.item ->> 'product_name',
    (entry.item ->> 'unit_price_twd')::integer,
    (entry.item ->> 'quantity')::integer,
    (
      (entry.item ->> 'unit_price_twd')::bigint
      * (entry.item ->> 'quantity')::bigint
    )::integer,
    nullif(entry.item -> 'product_snapshot', 'null'::jsonb)
  from pg_catalog.jsonb_array_elements(p_payload -> 'items') as entry(item);

  insert into public.product_shipping_info (
    order_id,
    recipient_name,
    recipient_phone,
    recipient_email,
    shipping_method,
    postal_code,
    address,
    store_type,
    store_id,
    store_name,
    store_address,
    store_phone
  ) values (
    v_product_order_id,
    nullif(pg_catalog.btrim(coalesce(v_shipping_info ->> 'recipient_name', '')), ''),
    nullif(pg_catalog.btrim(coalesce(v_shipping_info ->> 'recipient_phone', '')), ''),
    nullif(pg_catalog.btrim(coalesce(v_shipping_info ->> 'recipient_email', '')), ''),
    v_shipping_info ->> 'shipping_method',
    nullif(pg_catalog.btrim(coalesce(v_shipping_info ->> 'postal_code', '')), ''),
    nullif(pg_catalog.btrim(coalesce(v_shipping_info ->> 'address', '')), ''),
    nullif(pg_catalog.btrim(coalesce(v_shipping_info ->> 'store_type', '')), ''),
    nullif(pg_catalog.btrim(coalesce(v_shipping_info ->> 'store_id', '')), ''),
    nullif(pg_catalog.btrim(coalesce(v_shipping_info ->> 'store_name', '')), ''),
    nullif(pg_catalog.btrim(coalesce(v_shipping_info ->> 'store_address', '')), ''),
    nullif(pg_catalog.btrim(coalesce(v_shipping_info ->> 'store_phone', '')), '')
  );

  insert into public.payments (
    id,
    user_id,
    provider,
    item_type,
    item_id,
    item_name,
    amount_twd,
    currency,
    status,
    raw_payload,
    merchant_order_no,
    product_order_id,
    environment,
    checkout_attempt_id,
    request_state,
    request_idempotency_key,
    request_body_sha256,
    reconciliation_required,
    state_version
  ) values (
    v_payment_id,
    v_user_id,
    'line_pay',
    'spiritual_product_order',
    v_product_order_id::text,
    pg_catalog.left('開運商品訂單 ' || v_order_no, 50),
    v_total_amount_twd::integer,
    'TWD',
    'pending',
    pg_catalog.jsonb_build_object(
      'linePay',
      pg_catalog.jsonb_build_object(
        'orderId', v_merchant_order_no,
        'sourceType', 'product_order',
        'sourceId', v_product_order_id::text
      )
    ),
    v_merchant_order_no,
    v_product_order_id,
    v_environment,
    v_attempt_id,
    'initialized',
    v_idempotency_key,
    v_request_body_sha256,
    false,
    0
  );

  insert into public.line_pay_checkout_attempts (
    id,
    user_id,
    product_order_id,
    payment_id,
    environment,
    idempotency_key,
    request_body_sha256,
    request_state,
    amount_twd,
    currency,
    merchant_order_no,
    reconciliation_required,
    state_version
  ) values (
    v_attempt_id,
    v_user_id,
    v_product_order_id,
    v_payment_id,
    v_environment,
    v_idempotency_key,
    v_request_body_sha256,
    'queued',
    v_total_amount_twd::integer,
    'TWD',
    v_merchant_order_no,
    false,
    0
  );

  update public.product_orders as product_order
  set payment_id = v_payment_id
  where product_order.id = v_product_order_id
    and product_order.payment_id is null;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'line_pay_initialization_order_link_failed';
  end if;

  insert into public.line_pay_request_outbox (
    id,
    checkout_attempt_id,
    payment_id,
    environment,
    idempotency_key,
    request_body_sha256,
    state
  ) values (
    v_outbox_id,
    v_attempt_id,
    v_payment_id,
    v_environment,
    v_idempotency_key,
    v_request_body_sha256,
    'queued'
  );

  insert into public.line_pay_callback_capabilities (
    id,
    payment_id,
    product_order_id,
    checkout_attempt_id,
    environment,
    purpose,
    token_hash,
    capability_version,
    expires_at
  ) values
    (
      v_confirm_capability_id,
      v_payment_id,
      v_product_order_id,
      v_attempt_id,
      v_environment,
      'confirm',
      v_confirm_token_hash,
      1,
      v_capability_expires_at
    ),
    (
      v_cancel_capability_id,
      v_payment_id,
      v_product_order_id,
      v_attempt_id,
      v_environment,
      'cancel',
      v_cancel_token_hash,
      1,
      v_capability_expires_at
    );

  return query
  select
    'initialized'::text,
    v_product_order_id,
    v_payment_id,
    v_attempt_id,
    v_outbox_id,
    v_confirm_capability_id,
    v_cancel_capability_id,
    v_merchant_order_no,
    'queued'::text;
end;
$$;

revoke all on function public.initialize_product_order_line_pay_checkout(jsonb)
from public, anon, authenticated;
grant execute on function public.initialize_product_order_line_pay_checkout(jsonb)
to service_role;

do $$
declare
  v_function_oid oid;
begin
  if (
    select pg_catalog.count(*)
    from pg_catalog.pg_proc as procedure
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname = 'initialize_product_order_line_pay_checkout'
  ) <> 1 then
    raise exception using
      errcode = '42710',
      message = 'line_pay_initialization_rpc_overload_postcondition_failed';
  end if;

  select procedure.oid
  into strict v_function_oid
  from pg_catalog.pg_proc as procedure
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'public'
    and procedure.proname = 'initialize_product_order_line_pay_checkout'
    and pg_catalog.oidvectortypes(procedure.proargtypes) = 'jsonb';

  if exists (
    select 1
    from pg_catalog.pg_proc as procedure
    where procedure.oid = v_function_oid
      and (
        procedure.prosecdef
        or procedure.proconfig is null
        or not ('search_path=""' = any (procedure.proconfig))
      )
  )
  or pg_catalog.has_function_privilege('anon', v_function_oid, 'execute')
  or pg_catalog.has_function_privilege('authenticated', v_function_oid, 'execute')
  or not pg_catalog.has_function_privilege('service_role', v_function_oid, 'execute')
  or exists (
    select 1
    from pg_catalog.pg_proc as procedure
    cross join lateral pg_catalog.aclexplode(procedure.proacl) as acl
    where procedure.oid = v_function_oid
      and acl.privilege_type = 'EXECUTE'
      and acl.grantee not in (
        procedure.proowner,
        (select role.oid from pg_catalog.pg_roles as role where role.rolname = 'service_role')
      )
  ) then
    raise exception using
      errcode = '42501',
      message = 'line_pay_initialization_rpc_security_postcondition_failed';
  end if;
end;
$$;
