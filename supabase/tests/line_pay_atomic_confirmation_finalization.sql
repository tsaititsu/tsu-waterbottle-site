\set ON_ERROR_STOP on

create schema line_pay_atomic_test;

create function line_pay_atomic_test.seed_confirmation(
  p_product_order_id uuid,
  p_payment_id uuid,
  p_attempt_id uuid,
  p_capability_id uuid,
  p_callback_event_id uuid,
  p_order_no text,
  p_transaction_id text
)
returns void
language plpgsql
set search_path = ''
as $$
begin
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
    p_product_order_id,
    p_order_no,
    '40000000-0000-4000-8000-000000000002',
    300,
    'TWD',
    'line_pay',
    'pending',
    'payment_pending',
    'not_applicable',
    'sandbox',
    'none',
    true,
    p_attempt_id,
    'confirmation_processing'
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
    request_body_sha256,
    line_pay_transaction_id
  ) values (
    p_payment_id,
    '40000000-0000-4000-8000-000000000002',
    'line_pay',
    'product_order',
    'Atomic sandbox test item',
    300,
    'TWD',
    'pending',
    p_order_no,
    p_product_order_id,
    'sandbox',
    p_attempt_id,
    'confirmation_processing',
    p_order_no || '-idempotency',
    repeat('b', 64),
    p_transaction_id
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
    upstream_transaction_id,
    merchant_order_no
  ) values (
    p_attempt_id,
    '40000000-0000-4000-8000-000000000002',
    p_product_order_id,
    p_payment_id,
    'sandbox',
    p_order_no || '-idempotency',
    repeat('b', 64),
    'confirmation_processing',
    300,
    p_transaction_id,
    p_order_no
  );

  update public.product_orders
  set payment_id = p_payment_id
  where id = p_product_order_id;

  insert into public.line_pay_callback_capabilities (
    id,
    payment_id,
    product_order_id,
    checkout_attempt_id,
    environment,
    purpose,
    token_hash,
    claim_id,
    claimed_at,
    claim_expires_at,
    expires_at
  ) values (
    p_capability_id,
    p_payment_id,
    p_product_order_id,
    p_attempt_id,
    'sandbox',
    'confirm',
    pg_catalog.replace(p_capability_id::text, '-', '')
      || pg_catalog.replace(p_capability_id::text, '-', ''),
    'a0000000-0000-4000-8000-000000000040',
    pg_catalog.clock_timestamp(),
    pg_catalog.clock_timestamp() + interval '10 minutes',
    pg_catalog.clock_timestamp() + interval '30 minutes'
  );

  insert into public.line_pay_callback_events (
    id,
    capability_id,
    payment_id,
    product_order_id,
    checkout_attempt_id,
    environment,
    purpose,
    state,
    claim_id,
    claimed_at,
    claim_expires_at
  ) values (
    p_callback_event_id,
    p_capability_id,
    p_payment_id,
    p_product_order_id,
    p_attempt_id,
    'sandbox',
    'confirm',
    'claimed',
    'a0000000-0000-4000-8000-000000000040',
    pg_catalog.clock_timestamp(),
    pg_catalog.clock_timestamp() + interval '10 minutes'
  );
end;
$$;

select line_pay_atomic_test.seed_confirmation(
  '50000000-0000-4000-8000-000000000019',
  '70000000-0000-4000-8000-000000000019',
  '60000000-0000-4000-8000-000000000019',
  '90000000-0000-4000-8000-000000000019',
  '91000000-0000-4000-8000-000000000019',
  'LP-ATOMIC-SUCCESS-1',
  'atomic-transaction-success-1'
);

select line_pay_atomic_test.seed_confirmation(
  '50000000-0000-4000-8000-000000000018',
  '70000000-0000-4000-8000-000000000018',
  '60000000-0000-4000-8000-000000000018',
  '90000000-0000-4000-8000-000000000018',
  '91000000-0000-4000-8000-000000000018',
  'LP-ATOMIC-ROLLBACK-1',
  'atomic-transaction-rollback-1'
);

-- Keep the evidence writer's own contract valid, but make the later payment
-- completion state invalid. This proves the wrapper rolls back evidence that
-- was actually written before complete_* rejects the aggregate.
update public.product_orders
set order_status = 'payment_failed'
where id = '50000000-0000-4000-8000-000000000018';

set role service_role;
do $$
begin
  begin
    perform public.finalize_product_order_line_pay_confirmation(
      'sandbox',
      '70000000-0000-4000-8000-000000000019',
      '50000000-0000-4000-8000-000000000019',
      '60000000-0000-4000-8000-000000000019',
      'LP-ATOMIC-SUCCESS-1',
      'atomic-transaction-success-1',
      300,
      'TWD',
      '90000000-0000-4000-8000-000000000019',
      '91000000-0000-4000-8000-000000000019',
      'a0000000-0000-4000-8000-000000000040',
      repeat('d', 64),
      'service-role-atomic-finalize-denied'
    );
    raise exception 'service_role_atomic_finalize_was_accepted';
  exception
    when insufficient_privilege then null;
  end;
end
$$;
reset role;

set role line_pay_payment_executor;
do $$
begin
  begin
    perform public.record_product_order_line_pay_confirmation_evidence(
      'sandbox',
      '91000000-0000-4000-8000-000000000019',
      'a0000000-0000-4000-8000-000000000040',
      repeat('d', 64),
      '0000',
      'executor-split-evidence-denied'
    );
    raise exception 'executor_split_evidence_was_accepted';
  exception
    when insufficient_privilege then null;
  end;

  begin
    perform public.complete_product_order_line_pay_confirmation(
      'sandbox',
      '70000000-0000-4000-8000-000000000019',
      '50000000-0000-4000-8000-000000000019',
      '60000000-0000-4000-8000-000000000019',
      'LP-ATOMIC-SUCCESS-1',
      'atomic-transaction-success-1',
      300,
      'TWD',
      '90000000-0000-4000-8000-000000000019',
      '91000000-0000-4000-8000-000000000019',
      'a0000000-0000-4000-8000-000000000040',
      repeat('d', 64),
      'executor-split-completion-denied',
      pg_catalog.jsonb_build_object(
        'result_code', 'verified',
        'evidence_sha256', repeat('d', 64)
      ),
      null
    );
    raise exception 'executor_split_completion_was_accepted';
  exception
    when insufficient_privilege then null;
  end;

  begin
    perform public.finalize_product_order_line_pay_confirmation(
      'sandbox',
      '70000000-0000-4000-8000-000000000018',
      '50000000-0000-4000-8000-000000000018',
      '60000000-0000-4000-8000-000000000018',
      'LP-ATOMIC-ROLLBACK-1',
      'atomic-transaction-rollback-1',
      300,
      'TWD',
      '90000000-0000-4000-8000-000000000018',
      '91000000-0000-4000-8000-000000000018',
      'a0000000-0000-4000-8000-000000000040',
      repeat('e', 64),
      'atomic-rollback-1'
    );
    raise exception 'atomic_finalize_invalid_amount_was_accepted';
  exception
    when sqlstate '55000' then null;
  end;
end
$$;
reset role;

do $$
begin
  if not exists (
    select 1
    from public.line_pay_callback_events
    where id = '91000000-0000-4000-8000-000000000018'
      and state = 'claimed'
      and provider_result_sha256 is null
      and safe_result_code is null
  ) or exists (
    select 1
    from public.line_pay_payment_audit_events
    where payment_id = '70000000-0000-4000-8000-000000000018'
      and event_type in ('confirmation_evidence_recorded', 'confirmation_completed')
  ) or not exists (
    select 1
    from public.product_orders
    where id = '50000000-0000-4000-8000-000000000018'
      and order_status = 'payment_failed'
  ) then
    raise exception 'atomic_finalize_rollback_postcondition_failed';
  end if;
end
$$;

set session authorization authenticator;
set role line_pay_payment_executor;
do $$
declare
  v_result record;
begin
  select completion.*
  into strict v_result
  from public.finalize_product_order_line_pay_confirmation(
    'sandbox',
    '70000000-0000-4000-8000-000000000019',
    '50000000-0000-4000-8000-000000000019',
    '60000000-0000-4000-8000-000000000019',
    'LP-ATOMIC-SUCCESS-1',
    'atomic-transaction-success-1',
    300,
    'TWD',
    '90000000-0000-4000-8000-000000000019',
    '91000000-0000-4000-8000-000000000019',
    'a0000000-0000-4000-8000-000000000040',
    repeat('d', 64),
    'atomic-success-1'
  ) as completion;

  if v_result.result_code <> 'completed'
     or v_result.payment_id <> '70000000-0000-4000-8000-000000000019'
     or v_result.product_order_id <> '50000000-0000-4000-8000-000000000019'
     or v_result.transaction_id <> 'atomic-transaction-success-1' then
    raise exception 'atomic_finalize_success_result_invalid';
  end if;

  select completion.*
  into strict v_result
  from public.finalize_product_order_line_pay_confirmation(
    'sandbox',
    '70000000-0000-4000-8000-000000000019',
    '50000000-0000-4000-8000-000000000019',
    '60000000-0000-4000-8000-000000000019',
    'LP-ATOMIC-SUCCESS-1',
    'atomic-transaction-success-1',
    300,
    'TWD',
    '90000000-0000-4000-8000-000000000019',
    '91000000-0000-4000-8000-000000000019',
    'a0000000-0000-4000-8000-000000000040',
    repeat('d', 64),
    'atomic-success-retry-1'
  ) as completion;

  if v_result.result_code <> 'already_completed' then
    raise exception 'atomic_finalize_idempotency_result_invalid';
  end if;

  begin
    perform public.finalize_product_order_line_pay_confirmation(
      'sandbox',
      '70000000-0000-4000-8000-000000000019',
      '50000000-0000-4000-8000-000000000019',
      '60000000-0000-4000-8000-000000000019',
      'LP-ATOMIC-SUCCESS-1',
      'atomic-transaction-success-1',
      300,
      'TWD',
      '90000000-0000-4000-8000-000000000019',
      '91000000-0000-4000-8000-000000000019',
      'a0000000-0000-4000-8000-000000000040',
      repeat('f', 64),
      'atomic-conflicting-evidence-retry-1'
    );
    raise exception 'atomic_finalize_conflicting_evidence_was_accepted';
  exception
    when check_violation then null;
  end;
end
$$;
reset role;
reset session authorization;

do $$
begin
  if not exists (
    select 1
    from line_pay_private.line_pay_completion_proofs as proof
    join public.payments as payment on payment.id = proof.payment_id
    join public.product_orders as product_order on product_order.id = proof.product_order_id
    join public.line_pay_checkout_attempts as attempt on attempt.id = proof.checkout_attempt_id
    join public.line_pay_callback_capabilities as capability on capability.id = proof.capability_id
    join public.line_pay_callback_events as callback_event on callback_event.id = proof.callback_event_id
    where proof.payment_id = '70000000-0000-4000-8000-000000000019'
      and proof.provider_result_code = '0000'
      and proof.provider_result_sha256 = repeat('d', 64)
      and payment.status = 'paid'
      and payment.request_state = 'paid'
      and product_order.payment_status = 'paid'
      and product_order.order_status = 'paid'
      and attempt.request_state = 'paid'
      and capability.consumed_at is not null
      and callback_event.state = 'completed'
      and callback_event.provider_result_sha256 = repeat('d', 64)
  ) then
    raise exception 'atomic_finalize_completion_proof_missing';
  end if;

  if (
    select pg_catalog.count(*)
    from public.line_pay_payment_audit_events
    where payment_id = '70000000-0000-4000-8000-000000000019'
      and event_type = 'confirmation_evidence_recorded'
  ) <> 1 or (
    select pg_catalog.count(*)
    from public.line_pay_payment_audit_events
    where payment_id = '70000000-0000-4000-8000-000000000019'
      and event_type = 'confirmation_completed'
  ) <> 1 then
    raise exception 'atomic_finalize_audit_idempotency_failed';
  end if;

  if (
    select pg_catalog.count(*)
    from line_pay_private.line_pay_completion_proofs
    where payment_id = '70000000-0000-4000-8000-000000000019'
      and provider_result_sha256 = repeat('d', 64)
  ) <> 1 or exists (
    select 1
    from public.line_pay_payment_audit_events
    where payment_id = '70000000-0000-4000-8000-000000000019'
      and evidence ->> 'evidence_sha256' = repeat('f', 64)
  ) then
    raise exception 'atomic_finalize_conflicting_evidence_mutated_state';
  end if;
end
$$;

drop function line_pay_atomic_test.seed_confirmation(
  uuid, uuid, uuid, uuid, uuid, text, text
);
drop schema line_pay_atomic_test;
