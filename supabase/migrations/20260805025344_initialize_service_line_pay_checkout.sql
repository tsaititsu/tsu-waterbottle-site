-- Add a service-order adapter around the existing, proven LINE Pay checkout
-- aggregate. This migration only defines the contract; applying it to a
-- remote database requires a separately approved exact-file deployment.

begin;

grant line_pay_payment_function_owner to current_user
  with inherit true, set true;

create or replace function line_pay_private.record_service_line_pay_checkout_initialized_audit(
  p_payment_id uuid,
  p_product_order_id uuid,
  p_checkout_attempt_id uuid,
  p_environment text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_environment not in ('sandbox', 'production')
     or not exists (
       select 1
       from public.payments as payment
       join public.product_orders as product_order
         on product_order.id = payment.product_order_id
       join public.line_pay_checkout_attempts as attempt
         on attempt.id = payment.checkout_attempt_id
       where payment.id = p_payment_id
         and product_order.id = p_product_order_id
         and attempt.id = p_checkout_attempt_id
         and payment.provider = 'line_pay'
         and payment.item_type in (
           'ai_chart_report',
           'ai_divination',
           'booking',
           'course'
         )
         and payment.item_id is not null
         and payment.environment = p_environment
         and payment.status = 'pending'
         and payment.request_state = 'initialized'
         and payment.currency = 'TWD'
         and payment.amount_twd = product_order.total_amount_twd
         and payment.amount_twd = attempt.amount_twd
         and payment.user_id = product_order.user_id
         and product_order.user_id = attempt.user_id
         and payment.merchant_order_no = attempt.merchant_order_no
         and payment.request_idempotency_key = attempt.idempotency_key
         and payment.request_body_sha256 = attempt.request_body_sha256
         and payment.state_version = 0
         and product_order.payment_method = 'line_pay'
         and product_order.environment = p_environment
         and product_order.payment_id = payment.id
         and product_order.checkout_attempt_id = attempt.id
         and product_order.payment_status = 'pending'
         and product_order.order_status = 'pending_payment'
         and product_order.shipping_status = 'not_applicable'
         and product_order.fulfillment_mode = 'none'
         and product_order.payment_request_state = 'initialized'
         and product_order.currency = 'TWD'
         and product_order.state_version = 1
         and attempt.provider = 'line_pay'
         and attempt.environment = p_environment
         and attempt.payment_id = payment.id
         and attempt.product_order_id = product_order.id
         and attempt.request_state = 'queued'
         and attempt.currency = 'TWD'
         and attempt.state_version = 0
         and not payment.reconciliation_required
         and not product_order.reconciliation_required
         and not attempt.reconciliation_required
         and (
           select pg_catalog.count(*)
           from public.product_order_items as item
           where item.order_id = product_order.id
             and item.product_name = payment.item_name
             and item.unit_price_twd = payment.amount_twd
             and item.quantity = 1
             and item.subtotal_twd = payment.amount_twd
             and item.product_snapshot = pg_catalog.jsonb_build_object(
               'sourceType', payment.item_type,
               'sourceId', payment.item_id,
               'name', payment.item_name,
               'priceTwd', payment.amount_twd,
               'fulfillmentMode', 'none'
             )
         ) = 1
         and not exists (
           select 1
           from public.product_shipping_info as shipping
           where shipping.order_id = product_order.id
         )
         and (
           select pg_catalog.count(*)
           from public.line_pay_request_outbox as request_outbox
           where request_outbox.checkout_attempt_id = attempt.id
             and request_outbox.payment_id = payment.id
             and request_outbox.provider = 'line_pay'
             and request_outbox.environment = p_environment
             and request_outbox.operation = 'request'
             and request_outbox.idempotency_key = attempt.idempotency_key
             and request_outbox.request_body_sha256 = attempt.request_body_sha256
             and request_outbox.state = 'queued'
         ) = 1
         and (
           select pg_catalog.count(*)
           from public.line_pay_callback_capabilities as capability
           where capability.payment_id = payment.id
             and capability.product_order_id = product_order.id
             and capability.checkout_attempt_id = attempt.id
             and capability.environment = p_environment
             and capability.purpose in ('confirm', 'cancel')
             and capability.capability_version = 1
             and capability.expires_at > pg_catalog.clock_timestamp()
             and capability.consumed_at is null
             and capability.revoked_at is null
         ) = 2
     ) then
    raise exception using
      errcode = '23514',
      message = 'line_pay_service_initialization_audit_binding_invalid';
  end if;

  insert into public.line_pay_payment_audit_events (
    payment_id,
    product_order_id,
    checkout_attempt_id,
    environment,
    event_type,
    from_state,
    to_state,
    evidence
  ) values (
    p_payment_id,
    p_product_order_id,
    p_checkout_attempt_id,
    p_environment,
    'checkout_initialized',
    null,
    'initialized',
    '{"reason_code":"checkout_initialized"}'::jsonb
  );
end;
$$;

alter function line_pay_private.record_service_line_pay_checkout_initialized_audit(
  uuid,
  uuid,
  uuid,
  text
) owner to line_pay_payment_function_owner;

revoke all on function line_pay_private.record_service_line_pay_checkout_initialized_audit(
  uuid,
  uuid,
  uuid,
  text
) from public, anon, authenticated, service_role, line_pay_payment_executor;
grant execute on function line_pay_private.record_service_line_pay_checkout_initialized_audit(
  uuid,
  uuid,
  uuid,
  text
) to service_role;

revoke line_pay_payment_function_owner from current_user;

create or replace function public.initialize_service_line_pay_checkout(
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
    'source_type',
    'source_id',
    'item_name',
    'amount_twd',
    'booking_id',
    'return_path',
    'idempotency_key',
    'request_body_sha256',
    'confirm_token_hash',
    'cancel_token_hash',
    'capability_expires_at'
  ]::text[];
  v_user_id uuid;
  v_environment text;
  v_order_no text;
  v_merchant_order_no text;
  v_source_type text;
  v_source_id text;
  v_item_name text;
  v_amount_twd integer;
  v_booking_id uuid;
  v_return_path text;
  v_idempotency_key text;
  v_request_body_sha256 text;
  v_confirm_token_hash text;
  v_cancel_token_hash text;
  v_capability_expires_at timestamptz;
  v_product_order_id uuid := pg_catalog.gen_random_uuid();
  v_payment_id uuid := pg_catalog.gen_random_uuid();
  v_attempt_id uuid := pg_catalog.gen_random_uuid();
  v_outbox_id uuid := pg_catalog.gen_random_uuid();
  v_confirm_capability_id uuid := pg_catalog.gen_random_uuid();
  v_cancel_capability_id uuid := pg_catalog.gen_random_uuid();
  v_existing record;
begin
  if p_payload is null
     or pg_catalog.jsonb_typeof(p_payload) <> 'object'
     or pg_catalog.octet_length(p_payload::text) > 32768
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
     or pg_catalog.jsonb_typeof(p_payload -> 'source_type') <> 'string'
     or p_payload ->> 'source_type' not in (
       'ai_chart_report',
       'ai_divination',
       'booking',
       'course'
     )
     or pg_catalog.jsonb_typeof(p_payload -> 'source_id') <> 'string'
     or pg_catalog.length(p_payload ->> 'source_id') not between 1 and 100
     or p_payload ->> 'source_id' !~ '^[A-Za-z0-9_-]+$'
     or pg_catalog.jsonb_typeof(p_payload -> 'item_name') <> 'string'
     or pg_catalog.length(pg_catalog.btrim(p_payload ->> 'item_name')) not between 1 and 500
     or pg_catalog.jsonb_typeof(p_payload -> 'amount_twd') <> 'number'
     or p_payload ->> 'amount_twd' !~ '^[1-9][0-9]{0,9}$'
     or (p_payload ->> 'amount_twd')::numeric > 2147483647
     or pg_catalog.jsonb_typeof(p_payload -> 'booking_id') not in ('string', 'null')
     or pg_catalog.jsonb_typeof(p_payload -> 'return_path') <> 'string'
     or pg_catalog.length(p_payload ->> 'return_path') not between 2 and 300
     or p_payload ->> 'return_path' !~ '^/[A-Za-z0-9/_-]+$'
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
      message = 'line_pay_service_initialization_invalid_input';
  end if;

  if (
    p_payload ->> 'source_type' = 'course'
    and p_payload ->> 'source_id' not in ('basic', 'advanced', 'master')
  )
  or (
    p_payload ->> 'source_type' <> 'course'
    and p_payload ->> 'source_id'
      !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
  )
  or (
    p_payload ->> 'source_type' = 'booking'
    and (
      pg_catalog.jsonb_typeof(p_payload -> 'booking_id') <> 'string'
      or p_payload ->> 'booking_id'
        !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
      or p_payload ->> 'booking_id' <> p_payload ->> 'source_id'
    )
  )
  or (
    p_payload ->> 'source_type' <> 'booking'
    and pg_catalog.jsonb_typeof(p_payload -> 'booking_id') <> 'null'
  )
  or (
    p_payload ->> 'source_type' = 'ai_chart_report'
    and (p_payload ->> 'return_path') <> ('/ai-chart/result/' || (p_payload ->> 'source_id'))
  )
  or (
    p_payload ->> 'source_type' = 'ai_divination'
    and (p_payload ->> 'return_path') <> ('/ai-divination/result/' || (p_payload ->> 'source_id'))
  )
  or (
    p_payload ->> 'source_type' = 'booking'
    and p_payload ->> 'return_path' <> '/account/bookings'
  )
  or (
    p_payload ->> 'source_type' = 'course'
    and p_payload ->> 'return_path' <> '/account/courses'
  ) then
    raise exception using
      errcode = '22023',
      message = 'line_pay_service_initialization_target_invalid';
  end if;

  v_user_id := (p_payload ->> 'user_id')::uuid;
  v_environment := p_payload ->> 'environment';
  v_order_no := p_payload ->> 'order_no';
  v_merchant_order_no := p_payload ->> 'merchant_order_no';
  v_source_type := p_payload ->> 'source_type';
  v_source_id := p_payload ->> 'source_id';
  v_item_name := pg_catalog.btrim(p_payload ->> 'item_name');
  v_amount_twd := (p_payload ->> 'amount_twd')::integer;
  v_booking_id := case
    when pg_catalog.jsonb_typeof(p_payload -> 'booking_id') = 'string'
      then (p_payload ->> 'booking_id')::uuid
    else null
  end;
  v_return_path := p_payload ->> 'return_path';
  v_idempotency_key := p_payload ->> 'idempotency_key';
  v_request_body_sha256 := p_payload ->> 'request_body_sha256';
  v_confirm_token_hash := p_payload ->> 'confirm_token_hash';
  v_cancel_token_hash := p_payload ->> 'cancel_token_hash';
  v_capability_expires_at := (p_payload ->> 'capability_expires_at')::timestamptz;

  if v_capability_expires_at <= pg_catalog.clock_timestamp() + interval '5 minutes'
     or v_capability_expires_at > pg_catalog.clock_timestamp() + interval '24 hours' then
    raise exception using
      errcode = '22023',
      message = 'line_pay_service_initialization_invalid_input';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'line_pay_service_initialize:' || v_environment || ':' || v_idempotency_key,
      0
    )
  );

  select
    attempt.id as attempt_id,
    attempt.payment_id,
    attempt.product_order_id,
    attempt.request_state,
    payment.item_type,
    payment.item_id,
    payment.item_name,
    payment.booking_id,
    payment.user_id,
    payment.amount_twd,
    payment.merchant_order_no,
    payment.request_body_sha256,
    payment.raw_payload,
    product_order.order_no,
    (
      select request_outbox.id
      from public.line_pay_request_outbox as request_outbox
      where request_outbox.checkout_attempt_id = attempt.id
        and request_outbox.payment_id = payment.id
        and request_outbox.provider = 'line_pay'
        and request_outbox.environment = v_environment
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
        and capability.environment = v_environment
        and capability.purpose = 'confirm'
        and capability.capability_version = 1
    ) as confirm_capability_id,
    (
      select capability.token_hash
      from public.line_pay_callback_capabilities as capability
      where capability.checkout_attempt_id = attempt.id
        and capability.payment_id = payment.id
        and capability.product_order_id = product_order.id
        and capability.environment = v_environment
        and capability.purpose = 'confirm'
        and capability.capability_version = 1
    ) as confirm_token_hash,
    (
      select capability.id
      from public.line_pay_callback_capabilities as capability
      where capability.checkout_attempt_id = attempt.id
        and capability.payment_id = payment.id
        and capability.product_order_id = product_order.id
        and capability.environment = v_environment
        and capability.purpose = 'cancel'
        and capability.capability_version = 1
    ) as cancel_capability_id,
    (
      select capability.token_hash
      from public.line_pay_callback_capabilities as capability
      where capability.checkout_attempt_id = attempt.id
        and capability.payment_id = payment.id
        and capability.product_order_id = product_order.id
        and capability.environment = v_environment
        and capability.purpose = 'cancel'
        and capability.capability_version = 1
    ) as cancel_token_hash
  into v_existing
  from public.line_pay_checkout_attempts as attempt
  join public.payments as payment on payment.id = attempt.payment_id
  join public.product_orders as product_order
    on product_order.id = attempt.product_order_id
  where attempt.environment = v_environment
    and attempt.provider = 'line_pay'
    and attempt.idempotency_key = v_idempotency_key
  for update of attempt, payment, product_order;

  if found then
    if v_existing.user_id <> v_user_id
       or v_existing.item_type <> v_source_type
       or v_existing.item_id is distinct from v_source_id
       or v_existing.item_name <> v_item_name
       or v_existing.booking_id is distinct from v_booking_id
       or v_existing.amount_twd <> v_amount_twd
       or v_existing.merchant_order_no <> v_merchant_order_no
       or v_existing.request_body_sha256 <> v_request_body_sha256
       or v_existing.order_no <> v_order_no
       or v_existing.outbox_id is null
       or v_existing.confirm_capability_id is null
       or v_existing.cancel_capability_id is null
       or v_existing.confirm_token_hash <> v_confirm_token_hash
       or v_existing.cancel_token_hash <> v_cancel_token_hash
       or v_existing.raw_payload <> pg_catalog.jsonb_build_object(
         'linePay',
         pg_catalog.jsonb_build_object(
           'orderId', v_merchant_order_no,
           'sourceType', v_source_type,
           'sourceId', v_source_id,
           'returnPath', v_return_path
         )
       ) then
      raise exception using
        errcode = '23505',
        message = 'line_pay_service_initialization_idempotency_conflict';
    end if;

    return query select
      'already_initialized'::text,
      v_existing.product_order_id,
      v_existing.payment_id,
      v_existing.attempt_id,
      v_existing.outbox_id,
      v_existing.confirm_capability_id,
      v_existing.cancel_capability_id,
      v_existing.merchant_order_no,
      v_existing.request_state;
    return;
  end if;

  insert into public.product_orders (
    id,
    order_no,
    user_id,
    total_amount_twd,
    payment_method,
    payment_status,
    order_status,
    shipping_status,
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
    v_amount_twd,
    'line_pay',
    'pending',
    'pending_payment',
    'not_applicable',
    v_environment,
    'none',
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
  ) values (
    v_product_order_id,
    pg_catalog.left('service-' || v_source_type || '-' || v_source_id, 200),
    v_item_name,
    v_amount_twd,
    1,
    v_amount_twd,
    pg_catalog.jsonb_build_object(
      'sourceType', v_source_type,
      'sourceId', v_source_id,
      'name', v_item_name,
      'priceTwd', v_amount_twd,
      'fulfillmentMode', 'none'
    )
  );

  insert into public.payments (
    id,
    user_id,
    booking_id,
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
    v_booking_id,
    'line_pay',
    v_source_type,
    v_source_id,
    v_item_name,
    v_amount_twd,
    'TWD',
    'pending',
    pg_catalog.jsonb_build_object(
      'linePay',
      pg_catalog.jsonb_build_object(
        'orderId', v_merchant_order_no,
        'sourceType', v_source_type,
        'sourceId', v_source_id,
        'returnPath', v_return_path
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
    v_amount_twd,
    'TWD',
    v_merchant_order_no,
    false,
    0
  );

  update public.product_orders
  set payment_id = v_payment_id
  where id = v_product_order_id
    and payment_id is null;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'line_pay_service_initialization_order_link_failed';
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

  perform line_pay_private.record_service_line_pay_checkout_initialized_audit(
    v_payment_id,
    v_product_order_id,
    v_attempt_id,
    v_environment
  );

  return query select
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

revoke all on function public.initialize_service_line_pay_checkout(jsonb)
from public, anon, authenticated, line_pay_payment_executor;
grant execute on function public.initialize_service_line_pay_checkout(jsonb)
to service_role;

comment on function public.initialize_service_line_pay_checkout(jsonb)
is 'Atomically initializes LINE Pay checkout aggregates for owned digital services; service_role only.';

commit;
