\set ON_ERROR_STOP on

begin;
set constraints all deferred;

insert into public.product_orders (
  id,
  order_no,
  user_id,
  total_amount_twd,
  currency,
  payment_method,
  payment_status,
  order_status,
  shipping_status,
  environment,
  fulfillment_mode,
  sandbox_test,
  checkout_attempt_id,
  payment_request_state
) values (
  '50000000-0000-4000-8000-000000000003',
  'LP-CONCURRENCY-ORDER-1',
  '40000000-0000-4000-8000-000000000001',
  300,
  'TWD',
  'line_pay',
  'pending',
  'pending_payment',
  'not_applicable',
  'sandbox',
  'none',
  true,
  '60000000-0000-4000-8000-000000000003',
  'initialized'
);

insert into public.payments (
  id,
  user_id,
  provider,
  item_type,
  item_name,
  amount_twd,
  currency,
  status,
  merchant_order_no,
  product_order_id,
  environment,
  checkout_attempt_id,
  request_state,
  request_idempotency_key,
  request_body_sha256
) values (
  '70000000-0000-4000-8000-000000000003',
  '40000000-0000-4000-8000-000000000001',
  'line_pay',
  'product_order',
  'Sandbox concurrency item',
  300,
  'TWD',
  'pending',
  'LP-CONCURRENCY-ORDER-1',
  '50000000-0000-4000-8000-000000000003',
  'sandbox',
  '60000000-0000-4000-8000-000000000003',
  'initialized',
  'concurrency-request-idempotency-1',
  repeat('4', 64)
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
  merchant_order_no
) values (
  '60000000-0000-4000-8000-000000000003',
  '40000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000003',
  '70000000-0000-4000-8000-000000000003',
  'sandbox',
  'concurrency-request-idempotency-1',
  repeat('4', 64),
  'queued',
  300,
  'LP-CONCURRENCY-ORDER-1'
);

update public.product_orders
set payment_id = '70000000-0000-4000-8000-000000000003'
where id = '50000000-0000-4000-8000-000000000003';

insert into public.line_pay_request_outbox (
  checkout_attempt_id,
  payment_id,
  environment,
  idempotency_key,
  request_body_sha256
) values (
  '60000000-0000-4000-8000-000000000003',
  '70000000-0000-4000-8000-000000000003',
  'sandbox',
  'concurrency-request-idempotency-1',
  repeat('4', 64)
);

commit;
