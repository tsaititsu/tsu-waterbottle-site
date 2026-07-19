\set ON_ERROR_STOP on

insert into auth.users (id) values
  ('40000000-0000-4000-8000-000000000003')
on conflict (id) do nothing;

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
) values
  (
    '50000000-0000-4000-8000-000000000004',
    'LP-FAILURE-ORDER-1',
    '40000000-0000-4000-8000-000000000003',
    400,
    'TWD',
    'line_pay',
    'pending',
    'pending_payment',
    'not_applicable',
    'sandbox',
    'none',
    true,
    '60000000-0000-4000-8000-000000000004',
    'initialized'
  ),
  (
    '50000000-0000-4000-8000-000000000005',
    'LP-UNKNOWN-ORDER-1',
    '40000000-0000-4000-8000-000000000003',
    500,
    'TWD',
    'line_pay',
    'pending',
    'pending_payment',
    'not_applicable',
    'sandbox',
    'none',
    true,
    '60000000-0000-4000-8000-000000000005',
    'initialized'
  ),
  (
    '50000000-0000-4000-8000-000000000006',
    'LP-EXPIRED-ORDER-1',
    '40000000-0000-4000-8000-000000000003',
    600,
    'TWD',
    'line_pay',
    'pending',
    'payment_requesting',
    'not_applicable',
    'sandbox',
    'none',
    true,
    '60000000-0000-4000-8000-000000000006',
    'requesting'
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
) values
  (
    '70000000-0000-4000-8000-000000000004',
    '40000000-0000-4000-8000-000000000003',
    'line_pay',
    'product_order',
    'Sandbox failure item',
    400,
    'TWD',
    'pending',
    'LP-FAILURE-ORDER-1',
    '50000000-0000-4000-8000-000000000004',
    'sandbox',
    '60000000-0000-4000-8000-000000000004',
    'initialized',
    'failure-request-idempotency-1',
    repeat('9', 64)
  ),
  (
    '70000000-0000-4000-8000-000000000005',
    '40000000-0000-4000-8000-000000000003',
    'line_pay',
    'product_order',
    'Sandbox unknown item',
    500,
    'TWD',
    'pending',
    'LP-UNKNOWN-ORDER-1',
    '50000000-0000-4000-8000-000000000005',
    'sandbox',
    '60000000-0000-4000-8000-000000000005',
    'initialized',
    'unknown-request-idempotency-1',
    repeat('a', 64)
  ),
  (
    '70000000-0000-4000-8000-000000000006',
    '40000000-0000-4000-8000-000000000003',
    'line_pay',
    'product_order',
    'Sandbox expired-claim item',
    600,
    'TWD',
    'pending',
    'LP-EXPIRED-ORDER-1',
    '50000000-0000-4000-8000-000000000006',
    'sandbox',
    '60000000-0000-4000-8000-000000000006',
    'requesting',
    'expired-request-idempotency-1',
    repeat('b', 64)
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
  merchant_order_no,
  attempt_count,
  claim_id,
  claimed_at,
  claim_expires_at
) values
  (
    '60000000-0000-4000-8000-000000000004',
    '40000000-0000-4000-8000-000000000003',
    '50000000-0000-4000-8000-000000000004',
    '70000000-0000-4000-8000-000000000004',
    'sandbox',
    'failure-request-idempotency-1',
    repeat('9', 64),
    'queued',
    400,
    'LP-FAILURE-ORDER-1',
    0,
    null,
    null,
    null
  ),
  (
    '60000000-0000-4000-8000-000000000005',
    '40000000-0000-4000-8000-000000000003',
    '50000000-0000-4000-8000-000000000005',
    '70000000-0000-4000-8000-000000000005',
    'sandbox',
    'unknown-request-idempotency-1',
    repeat('a', 64),
    'queued',
    500,
    'LP-UNKNOWN-ORDER-1',
    0,
    null,
    null,
    null
  ),
  (
    '60000000-0000-4000-8000-000000000006',
    '40000000-0000-4000-8000-000000000003',
    '50000000-0000-4000-8000-000000000006',
    '70000000-0000-4000-8000-000000000006',
    'sandbox',
    'expired-request-idempotency-1',
    repeat('b', 64),
    'requesting',
    600,
    'LP-EXPIRED-ORDER-1',
    1,
    'a0000000-0000-4000-8000-000000000020',
    pg_catalog.clock_timestamp() - interval '10 minutes',
    pg_catalog.clock_timestamp() - interval '5 minutes'
  );

update public.product_orders
set payment_id = case id
  when '50000000-0000-4000-8000-000000000004' then '70000000-0000-4000-8000-000000000004'::uuid
  when '50000000-0000-4000-8000-000000000005' then '70000000-0000-4000-8000-000000000005'::uuid
  when '50000000-0000-4000-8000-000000000006' then '70000000-0000-4000-8000-000000000006'::uuid
end
where id in (
  '50000000-0000-4000-8000-000000000004',
  '50000000-0000-4000-8000-000000000005',
  '50000000-0000-4000-8000-000000000006'
);

insert into public.line_pay_request_outbox (
  id,
  checkout_attempt_id,
  payment_id,
  environment,
  idempotency_key,
  request_body_sha256,
  state,
  attempt_count,
  claim_id,
  claimed_at,
  claim_expires_at
) values
  (
    '80000000-0000-4000-8000-000000000004',
    '60000000-0000-4000-8000-000000000004',
    '70000000-0000-4000-8000-000000000004',
    'sandbox',
    'failure-request-idempotency-1',
    repeat('9', 64),
    'queued',
    0,
    null,
    null,
    null
  ),
  (
    '80000000-0000-4000-8000-000000000005',
    '60000000-0000-4000-8000-000000000005',
    '70000000-0000-4000-8000-000000000005',
    'sandbox',
    'unknown-request-idempotency-1',
    repeat('a', 64),
    'queued',
    0,
    null,
    null,
    null
  ),
  (
    '80000000-0000-4000-8000-000000000006',
    '60000000-0000-4000-8000-000000000006',
    '70000000-0000-4000-8000-000000000006',
    'sandbox',
    'expired-request-idempotency-1',
    repeat('b', 64),
    'claimed',
    1,
    'a0000000-0000-4000-8000-000000000020',
    pg_catalog.clock_timestamp() - interval '10 minutes',
    pg_catalog.clock_timestamp() - interval '5 minutes'
  );

commit;

do $$
declare
  v_result text;
begin
  select result_code into v_result
  from public.claim_product_order_line_pay_request(
    '60000000-0000-4000-8000-000000000004',
    'sandbox',
    'failure-request-idempotency-1',
    repeat('9', 64),
    'a0000000-0000-4000-8000-000000000021',
    pg_catalog.clock_timestamp() + interval '2 minutes'
  );
  if v_result <> 'claimed' then
    raise exception 'failure_fixture_claim_failed';
  end if;

  select result_code into v_result
  from public.record_product_order_line_pay_request_failure(
    '60000000-0000-4000-8000-000000000004',
    'sandbox',
    'failure-request-idempotency-1',
    repeat('9', 64),
    'a0000000-0000-4000-8000-000000000021',
    'upstream_declined',
    'request-failure-outcome-1'
  );
  if v_result <> 'recorded' then
    raise exception 'definitive_failure_not_recorded';
  end if;

  select result_code into v_result
  from public.record_product_order_line_pay_request_failure(
    '60000000-0000-4000-8000-000000000004',
    'sandbox',
    'failure-request-idempotency-1',
    repeat('9', 64),
    'a0000000-0000-4000-8000-000000000021',
    'upstream_declined',
    'request-failure-outcome-duplicate-1'
  );
  if v_result <> 'already_recorded' then
    raise exception 'definitive_failure_duplicate_not_idempotent';
  end if;

  if not exists (
    select 1
    from public.payments as payment
    join public.product_orders as product_order on product_order.id = payment.product_order_id
    join public.line_pay_checkout_attempts as attempt on attempt.id = payment.checkout_attempt_id
    join public.line_pay_request_outbox as outbox on outbox.checkout_attempt_id = attempt.id
    where payment.id = '70000000-0000-4000-8000-000000000004'
      and payment.status = 'failed'
      and payment.request_state = 'failed'
      and product_order.payment_status = 'failed'
      and product_order.order_status = 'payment_failed'
      and product_order.payment_request_state = 'failed'
      and attempt.request_state = 'failed'
      and outbox.state = 'failed'
  ) then
    raise exception 'definitive_failure_state_contract_failed';
  end if;

  select result_code into v_result
  from public.claim_product_order_line_pay_request(
    '60000000-0000-4000-8000-000000000005',
    'sandbox',
    'unknown-request-idempotency-1',
    repeat('a', 64),
    'a0000000-0000-4000-8000-000000000022',
    pg_catalog.clock_timestamp() + interval '2 minutes'
  );
  if v_result <> 'claimed' then
    raise exception 'unknown_fixture_claim_failed';
  end if;

  select result_code into v_result
  from public.mark_product_order_line_pay_request_unknown(
    '60000000-0000-4000-8000-000000000005',
    'sandbox',
    'unknown-request-idempotency-1',
    repeat('a', 64),
    'a0000000-0000-4000-8000-000000000022',
    'upstream_timeout',
    'request-unknown-outcome-1'
  );
  if v_result <> 'recorded' then
    raise exception 'unknown_outcome_not_recorded';
  end if;

  select result_code into v_result
  from public.mark_product_order_line_pay_request_unknown(
    '60000000-0000-4000-8000-000000000005',
    'sandbox',
    'unknown-request-idempotency-1',
    repeat('a', 64),
    'a0000000-0000-4000-8000-000000000022',
    'upstream_timeout',
    'request-unknown-outcome-duplicate-1'
  );
  if v_result <> 'already_recorded' then
    raise exception 'unknown_outcome_duplicate_not_idempotent';
  end if;

  if not exists (
    select 1
    from public.payments as payment
    join public.product_orders as product_order on product_order.id = payment.product_order_id
    join public.line_pay_checkout_attempts as attempt on attempt.id = payment.checkout_attempt_id
    join public.line_pay_request_outbox as outbox on outbox.checkout_attempt_id = attempt.id
    where payment.id = '70000000-0000-4000-8000-000000000005'
      and payment.status = 'pending'
      and payment.request_state = 'reconciliation_required'
      and payment.reconciliation_required
      and product_order.payment_status = 'pending'
      and product_order.order_status = 'payment_pending'
      and product_order.payment_request_state = 'reconciliation_required'
      and product_order.reconciliation_required
      and attempt.request_state = 'unknown'
      and attempt.reconciliation_required
      and outbox.state = 'unknown'
  ) then
    raise exception 'unknown_outcome_reconciliation_contract_failed';
  end if;

  select result_code into v_result
  from public.claim_product_order_line_pay_request(
    '60000000-0000-4000-8000-000000000006',
    'sandbox',
    'expired-request-idempotency-1',
    repeat('b', 64),
    'a0000000-0000-4000-8000-000000000023',
    pg_catalog.clock_timestamp() + interval '2 minutes'
  );
  if v_result <> 'reconciliation_required' then
    raise exception 'expired_request_lease_was_reclaimed';
  end if;

  if not exists (
    select 1
    from public.payments as payment
    join public.product_orders as product_order on product_order.id = payment.product_order_id
    join public.line_pay_checkout_attempts as attempt on attempt.id = payment.checkout_attempt_id
    join public.line_pay_request_outbox as outbox on outbox.checkout_attempt_id = attempt.id
    where payment.id = '70000000-0000-4000-8000-000000000006'
      and payment.status = 'pending'
      and payment.request_state = 'reconciliation_required'
      and payment.reconciliation_required
      and product_order.order_status = 'payment_pending'
      and product_order.payment_request_state = 'reconciliation_required'
      and product_order.reconciliation_required
      and attempt.request_state = 'reconciliation_required'
      and attempt.reconciliation_required
      and attempt.attempt_count = 1
      and outbox.state = 'unknown'
      and outbox.attempt_count = 1
  ) then
    raise exception 'expired_request_lease_reconciliation_contract_failed';
  end if;
end
$$;
