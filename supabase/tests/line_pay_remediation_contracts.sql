\set ON_ERROR_STOP on

insert into auth.users (id) values
  ('40000000-0000-4000-8000-000000000001'),
  ('40000000-0000-4000-8000-000000000002')
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
) values (
  '50000000-0000-4000-8000-000000000001',
  'LP-CONTRACT-ORDER-1',
  '40000000-0000-4000-8000-000000000001',
  100,
  'TWD',
  'line_pay',
  'pending',
  'pending_payment',
  'not_applicable',
  'sandbox',
  'none',
  true,
  '60000000-0000-4000-8000-000000000001',
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
  '70000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000001',
  'line_pay',
  'product_order',
  'Sandbox contract item',
  100,
  'TWD',
  'pending',
  'LP-CONTRACT-ORDER-1',
  '50000000-0000-4000-8000-000000000001',
  'sandbox',
  '60000000-0000-4000-8000-000000000001',
  'initialized',
  'contract-request-idempotency-1',
  repeat('a', 64)
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
  '60000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000001',
  '70000000-0000-4000-8000-000000000001',
  'sandbox',
  'contract-request-idempotency-1',
  repeat('a', 64),
  'queued',
  100,
  'LP-CONTRACT-ORDER-1'
);

update public.product_orders
set payment_id = '70000000-0000-4000-8000-000000000001'
where id = '50000000-0000-4000-8000-000000000001';

insert into public.line_pay_request_outbox (
  id,
  checkout_attempt_id,
  payment_id,
  environment,
  idempotency_key,
  request_body_sha256
) values (
  '80000000-0000-4000-8000-000000000001',
  '60000000-0000-4000-8000-000000000001',
  '70000000-0000-4000-8000-000000000001',
  'sandbox',
  'contract-request-idempotency-1',
  repeat('a', 64)
);

insert into public.line_pay_callback_capabilities (
  id,
  payment_id,
  product_order_id,
  checkout_attempt_id,
  environment,
  purpose,
  token_hash,
  expires_at
) values
  (
    '90000000-0000-4000-8000-000000000001',
    '70000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000001',
    'sandbox',
    'confirm',
    repeat('b', 64),
    pg_catalog.clock_timestamp() + interval '30 minutes'
  ),
  (
    '90000000-0000-4000-8000-000000000002',
    '70000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000001',
    'sandbox',
    'cancel',
    repeat('c', 64),
    pg_catalog.clock_timestamp() + interval '30 minutes'
  );

commit;

do $$
declare
  v_result text;
  v_transaction_id text;
  v_callback_event_id uuid;
  v_cancel_event_id uuid;
  v_count integer;
  v_marker text;
begin
  select claimed.result_code into v_result
  from public.claim_product_order_line_pay_request(
    '60000000-0000-4000-8000-000000000001',
    'sandbox',
    'contract-request-idempotency-1',
    repeat('a', 64),
    'a0000000-0000-4000-8000-000000000001',
    pg_catalog.clock_timestamp() + interval '2 minutes'
  ) as claimed;

  if v_result <> 'claimed' then
    raise exception 'request_claim_contract_failed';
  end if;

  select claimed.result_code into v_result
  from public.claim_product_order_line_pay_request(
    '60000000-0000-4000-8000-000000000001',
    'sandbox',
    'contract-request-idempotency-1',
    repeat('a', 64),
    'a0000000-0000-4000-8000-000000000001',
    pg_catalog.clock_timestamp() + interval '2 minutes'
  ) as claimed;

  if v_result <> 'already_claimed' then
    raise exception 'request_duplicate_claim_contract_failed';
  end if;

  begin
    perform public.claim_product_order_line_pay_request(
      '60000000-0000-4000-8000-000000000001',
      'sandbox',
      'contract-request-idempotency-1',
      repeat('d', 64),
      'a0000000-0000-4000-8000-000000000001',
      pg_catalog.clock_timestamp() + interval '2 minutes'
    );
    raise exception 'same_key_different_body_hash_was_accepted';
  exception
    when check_violation then null;
  end;

  select recorded.result_code, recorded.upstream_transaction_id
  into v_result, v_transaction_id
  from public.record_product_order_line_pay_request_success(
    '60000000-0000-4000-8000-000000000001',
    'sandbox',
    'contract-request-idempotency-1',
    repeat('a', 64),
    'a0000000-0000-4000-8000-000000000001',
    '92233720368547758081234567890',
    'LP-CONTRACT-ORDER-1',
    pg_catalog.jsonb_build_object(
      'result_code', '0000',
      'transaction_id', '92233720368547758081234567890',
      'merchant_order_no', 'LP-CONTRACT-ORDER-1',
      'response_sha256', repeat('e', 64)
    ),
    'request-contract-1'
  ) as recorded;

  if v_result <> 'recorded'
     or v_transaction_id <> '92233720368547758081234567890' then
    raise exception 'request_success_contract_failed';
  end if;

  select replay.upstream_transaction_id into v_transaction_id
  from public.read_product_order_line_pay_request_result(
    '60000000-0000-4000-8000-000000000001',
    'sandbox',
    'contract-request-idempotency-1',
    repeat('a', 64)
  ) as replay;

  if v_transaction_id <> '92233720368547758081234567890' then
    raise exception 'transaction_id_string_replay_failed';
  end if;

  select capability.result_code, capability.callback_event_id
  into v_result, v_callback_event_id
  from public.claim_line_pay_callback_capability(
    repeat('b', 64),
    'sandbox',
    'confirm',
    '70000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000002',
    pg_catalog.clock_timestamp() + interval '2 minutes'
  ) as capability;

  if v_result <> 'claimed' then
    raise exception 'confirm_capability_claim_failed';
  end if;

  select claimed.result_code into v_result
  from public.claim_product_order_line_pay_confirmation(
    'sandbox',
    '70000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000001',
    '90000000-0000-4000-8000-000000000001',
    v_callback_event_id,
    'a0000000-0000-4000-8000-000000000002',
    '92233720368547758081234567890',
    'confirm-contract-claim-1'
  ) as claimed;

  if v_result <> 'claimed' then
    raise exception 'confirmation_state_claim_failed';
  end if;

  select evidence.result_code into v_result
  from public.record_product_order_line_pay_confirmation_evidence(
    'sandbox',
    v_callback_event_id,
    'a0000000-0000-4000-8000-000000000002',
    repeat('6', 64),
    '0000',
    'confirm-contract-evidence-1'
  ) as evidence;

  if v_result <> 'recorded' then
    raise exception 'confirmation_evidence_record_failed';
  end if;

  begin
    perform public.complete_product_order_line_pay_confirmation(
      'sandbox',
      '70000000-0000-4000-8000-000000000001',
      '50000000-0000-4000-8000-000000000001',
      '60000000-0000-4000-8000-000000000001',
      'LP-DIFFERENT-ORDER',
      '92233720368547758081234567890',
      100,
      'TWD',
      '90000000-0000-4000-8000-000000000001',
      v_callback_event_id,
      'a0000000-0000-4000-8000-000000000002',
      repeat('6', 64),
      'confirm-contract-merchant-mismatch-1',
      pg_catalog.jsonb_build_object('result_code', 'verified', 'evidence_sha256', repeat('6', 64))
    );
    raise exception 'merchant_order_mismatch_was_accepted';
  exception
    when check_violation then null;
  end;

  begin
    perform public.complete_product_order_line_pay_confirmation(
      'sandbox',
      '70000000-0000-4000-8000-000000000001',
      '50000000-0000-4000-8000-000000000001',
      '60000000-0000-4000-8000-000000000001',
      'LP-CONTRACT-ORDER-1',
      '92233720368547758081234567890',
      100,
      'USD',
      '90000000-0000-4000-8000-000000000001',
      v_callback_event_id,
      'a0000000-0000-4000-8000-000000000002',
      repeat('6', 64),
      'confirm-contract-currency-mismatch-1',
      pg_catalog.jsonb_build_object('result_code', 'verified', 'evidence_sha256', repeat('6', 64))
    );
    raise exception 'currency_mismatch_was_accepted';
  exception
    when invalid_parameter_value then null;
  end;

  begin
    perform public.complete_product_order_line_pay_confirmation(
      'production',
      '70000000-0000-4000-8000-000000000001',
      '50000000-0000-4000-8000-000000000001',
      '60000000-0000-4000-8000-000000000001',
      'LP-CONTRACT-ORDER-1',
      '92233720368547758081234567890',
      100,
      'TWD',
      '90000000-0000-4000-8000-000000000001',
      v_callback_event_id,
      'a0000000-0000-4000-8000-000000000002',
      repeat('6', 64),
      'confirm-contract-environment-mismatch-1',
      pg_catalog.jsonb_build_object('result_code', 'verified', 'evidence_sha256', repeat('6', 64))
    );
    raise exception 'environment_mismatch_was_accepted';
  exception
    when check_violation then null;
  end;

  begin
    perform public.complete_product_order_line_pay_confirmation(
      'sandbox',
      '70000000-0000-4000-8000-000000000001',
      '50000000-0000-4000-8000-000000000001',
      '60000000-0000-4000-8000-000000000001',
      'LP-CONTRACT-ORDER-1',
      '92233720368547758081234567890',
      101,
      'TWD',
      '90000000-0000-4000-8000-000000000001',
      v_callback_event_id,
      'a0000000-0000-4000-8000-000000000002',
      repeat('6', 64),
      'confirm-contract-mismatch-1',
      pg_catalog.jsonb_build_object('result_code', 'verified', 'evidence_sha256', repeat('6', 64))
    );
    raise exception 'amount_mismatch_was_accepted';
  exception
    when check_violation then null;
  end;

  if not exists (
    select 1 from public.payments
    where id = '70000000-0000-4000-8000-000000000001'
      and status = 'pending'
  ) then
    raise exception 'amount_mismatch_changed_payment';
  end if;

  select completed.result_code into v_result
  from public.complete_product_order_line_pay_confirmation(
    'sandbox',
    '70000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000001',
    'LP-CONTRACT-ORDER-1',
    '92233720368547758081234567890',
    100,
    'TWD',
    '90000000-0000-4000-8000-000000000001',
    v_callback_event_id,
    'a0000000-0000-4000-8000-000000000002',
    repeat('6', 64),
    'confirm-contract-success-1',
    pg_catalog.jsonb_build_object('result_code', 'verified', 'evidence_sha256', repeat('6', 64))
  ) as completed;

  if v_result <> 'completed' then
    raise exception 'atomic_confirmation_completion_failed';
  end if;

  if not exists (
    select 1
    from public.payments as payment
    join public.product_orders as product_order
      on product_order.id = payment.product_order_id
    where payment.id = '70000000-0000-4000-8000-000000000001'
      and payment.status = 'paid'
      and payment.request_state = 'paid'
      and payment.provider_trade_no = '92233720368547758081234567890'
      and product_order.payment_status = 'paid'
      and product_order.order_status = 'paid'
      and product_order.payment_request_state = 'paid'
  ) then
    raise exception 'atomic_confirmation_paid_rows_missing';
  end if;

  select completed.result_code into v_result
  from public.complete_product_order_line_pay_confirmation(
    'sandbox',
    '70000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000001',
    'LP-CONTRACT-ORDER-1',
    '92233720368547758081234567890',
    100,
    'TWD',
    '90000000-0000-4000-8000-000000000001',
    v_callback_event_id,
    'a0000000-0000-4000-8000-000000000002',
    repeat('6', 64),
    'confirm-contract-duplicate-1',
    pg_catalog.jsonb_build_object('result_code', 'verified', 'evidence_sha256', repeat('6', 64))
  ) as completed;

  if v_result <> 'already_completed' then
    raise exception 'duplicate_confirmation_not_idempotent';
  end if;

  select count(*) into v_count
  from public.line_pay_payment_audit_events
  where payment_id = '70000000-0000-4000-8000-000000000001'
    and event_type = 'confirmation_completed';

  if v_count <> 1 then
    raise exception 'duplicate_confirmation_created_duplicate_audit';
  end if;

  begin
    perform public.complete_product_order_line_pay_confirmation(
      'sandbox',
      '70000000-0000-4000-8000-000000000001',
      '50000000-0000-4000-8000-000000000001',
      '60000000-0000-4000-8000-000000000001',
      'LP-CONTRACT-ORDER-1',
      'different-transaction-id',
      100,
      'TWD',
      '90000000-0000-4000-8000-000000000001',
      v_callback_event_id,
      'a0000000-0000-4000-8000-000000000002',
      repeat('6', 64),
      'confirm-contract-conflict-1',
      pg_catalog.jsonb_build_object('result_code', 'verified', 'evidence_sha256', repeat('6', 64))
    );
    raise exception 'different_transaction_after_paid_was_accepted';
  exception
    when check_violation then null;
  end;

  begin
    perform public.complete_product_order_line_pay_confirmation(
      'sandbox',
      '70000000-0000-4000-8000-000000000001',
      '50000000-0000-4000-8000-000000000001',
      '60000000-0000-4000-8000-000000000001',
      'LP-CONTRACT-ORDER-1',
      '92233720368547758081234567890',
      100,
      'TWD',
      '90000000-0000-4000-8000-000000000001',
      v_callback_event_id,
      'a0000000-0000-4000-8000-000000000002',
      repeat('8', 64),
      'confirm-contract-evidence-conflict-1',
      pg_catalog.jsonb_build_object('result_code', 'verified', 'evidence_sha256', repeat('8', 64))
    );
    raise exception 'different_evidence_after_paid_was_accepted';
  exception
    when check_violation then null;
  end;

  begin
    perform public.record_product_order_line_pay_request_failure(
      '60000000-0000-4000-8000-000000000001',
      'sandbox',
      'contract-request-idempotency-1',
      repeat('a', 64),
      'a0000000-0000-4000-8000-000000000001',
      'late_failure',
      'request-failure-after-paid-1'
    );
    raise exception 'failure_after_paid_was_accepted';
  exception
    when object_not_in_prerequisite_state then null;
  end;

  if not exists (
    select 1 from public.payments
    where id = '70000000-0000-4000-8000-000000000001'
      and status = 'paid'
      and request_state = 'paid'
  ) then
    raise exception 'failure_after_paid_regressed_payment';
  end if;

  select capability.result_code, capability.callback_event_id
  into v_result, v_cancel_event_id
  from public.claim_line_pay_callback_capability(
    repeat('c', 64),
    'sandbox',
    'cancel',
    '70000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000003',
    pg_catalog.clock_timestamp() + interval '2 minutes'
  ) as capability;

  select canceled.result_code into v_result
  from public.cancel_product_order_line_pay_payment(
    'sandbox',
    '70000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000001',
    '90000000-0000-4000-8000-000000000002',
    v_cancel_event_id,
    'a0000000-0000-4000-8000-000000000003',
    'cancel-after-paid-1',
    '{"result_code":"cancel_after_paid"}'::jsonb
  ) as canceled;

  if v_result <> 'already_paid' then
    raise exception 'cancel_after_paid_did_not_return_stable_result';
  end if;

  if not exists (
    select 1 from public.payments
    where id = '70000000-0000-4000-8000-000000000001'
      and status = 'paid'
      and request_state = 'paid'
  ) then
    raise exception 'cancel_after_paid_regressed_payment';
  end if;

  begin
    update public.payments
    set request_state = 'pending'
    where id = '70000000-0000-4000-8000-000000000001';
    raise exception 'paid_to_pending_transition_was_accepted';
  exception
    when check_violation then null;
  end;

  foreach v_marker in array array[
    'fake_test_token_do_not_use',
    'fake_test_signature_do_not_use',
    'fake_test_authorization_do_not_use'
  ]::text[] loop
    begin
      insert into public.line_pay_payment_audit_events (
        payment_id,
        product_order_id,
        checkout_attempt_id,
        environment,
        event_type,
        evidence
      ) values (
        '70000000-0000-4000-8000-000000000001',
        '50000000-0000-4000-8000-000000000001',
        '60000000-0000-4000-8000-000000000001',
        'sandbox',
        'fake_marker_guard',
        pg_catalog.jsonb_build_object('result_code', v_marker)
      );
      raise exception 'fake_marker_was_persisted';
    exception
      when check_violation then null;
    end;

    begin
      update public.line_pay_callback_events
      set last_error_code = v_marker
      where id = v_callback_event_id;
      raise exception 'fake_marker_was_persisted_as_last_error';
    exception
      when check_violation then null;
    end;

    if public.line_pay_sanitized_result_is_valid(
      pg_catalog.jsonb_build_object('result_code', v_marker)
    ) then
      raise exception 'fake_marker_sanitized_result_was_accepted';
    end if;

    if public.line_pay_audit_evidence_is_valid(
      pg_catalog.jsonb_build_object('result_code', v_marker)
    ) then
      raise exception 'fake_marker_audit_evidence_was_accepted';
    end if;
  end loop;

  if exists (
    select 1 from public.line_pay_payment_audit_events
    where evidence::text ~* 'fake_test_(token|signature|authorization)_do_not_use'
  ) then
    raise exception 'fake_marker_found_in_audit';
  end if;

  if exists (
    select 1 from public.line_pay_callback_events
    where last_error_code ~* 'fake_test_(token|signature|authorization)_do_not_use'
  ) then
    raise exception 'fake_marker_found_in_last_error';
  end if;
end
$$;

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
  '50000000-0000-4000-8000-000000000002',
  'LP-ROLLBACK-ORDER-1',
  '40000000-0000-4000-8000-000000000002',
  200,
  'TWD',
  'line_pay',
  'pending',
  'pending_payment',
  'not_applicable',
  'sandbox',
  'none',
  true,
  '60000000-0000-4000-8000-000000000002',
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
  '70000000-0000-4000-8000-000000000002',
  '40000000-0000-4000-8000-000000000002',
  'line_pay',
  'product_order',
  'Sandbox rollback item',
  200,
  'TWD',
  'pending',
  'LP-ROLLBACK-ORDER-1',
  '50000000-0000-4000-8000-000000000002',
  'sandbox',
  '60000000-0000-4000-8000-000000000002',
  'initialized',
  'rollback-request-idempotency-1',
  repeat('1', 64)
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
  '60000000-0000-4000-8000-000000000002',
  '40000000-0000-4000-8000-000000000002',
  '50000000-0000-4000-8000-000000000002',
  '70000000-0000-4000-8000-000000000002',
  'sandbox',
  'rollback-request-idempotency-1',
  repeat('1', 64),
  'queued',
  200,
  'LP-ROLLBACK-ORDER-1'
);

update public.product_orders
set payment_id = '70000000-0000-4000-8000-000000000002'
where id = '50000000-0000-4000-8000-000000000002';

insert into public.line_pay_request_outbox (
  id,
  checkout_attempt_id,
  payment_id,
  environment,
  idempotency_key,
  request_body_sha256
) values (
  '80000000-0000-4000-8000-000000000002',
  '60000000-0000-4000-8000-000000000002',
  '70000000-0000-4000-8000-000000000002',
  'sandbox',
  'rollback-request-idempotency-1',
  repeat('1', 64)
);

insert into public.line_pay_callback_capabilities (
  id,
  payment_id,
  product_order_id,
  checkout_attempt_id,
  environment,
  purpose,
  token_hash,
  expires_at
) values (
  '90000000-0000-4000-8000-000000000003',
  '70000000-0000-4000-8000-000000000002',
  '50000000-0000-4000-8000-000000000002',
  '60000000-0000-4000-8000-000000000002',
  'sandbox',
  'confirm',
  repeat('2', 64),
  pg_catalog.clock_timestamp() + interval '30 minutes'
);

commit;

do $$
declare
  v_result text;
  v_callback_event_id uuid;
begin
  select result_code into v_result
  from public.claim_product_order_line_pay_request(
    '60000000-0000-4000-8000-000000000002',
    'sandbox',
    'rollback-request-idempotency-1',
    repeat('1', 64),
    'a0000000-0000-4000-8000-000000000004',
    pg_catalog.clock_timestamp() + interval '2 minutes'
  );

  select result_code into v_result
  from public.record_product_order_line_pay_request_success(
    '60000000-0000-4000-8000-000000000002',
    'sandbox',
    'rollback-request-idempotency-1',
    repeat('1', 64),
    'a0000000-0000-4000-8000-000000000004',
    'rollback-transaction-1',
    'LP-ROLLBACK-ORDER-1',
    pg_catalog.jsonb_build_object(
      'result_code', '0000',
      'transaction_id', 'rollback-transaction-1',
      'merchant_order_no', 'LP-ROLLBACK-ORDER-1',
      'response_sha256', repeat('3', 64)
    ),
    'request-rollback-1'
  );

  select result_code, callback_event_id
  into v_result, v_callback_event_id
  from public.claim_line_pay_callback_capability(
    repeat('2', 64),
    'sandbox',
    'confirm',
    '70000000-0000-4000-8000-000000000002',
    '50000000-0000-4000-8000-000000000002',
    '60000000-0000-4000-8000-000000000002',
    'a0000000-0000-4000-8000-000000000005',
    pg_catalog.clock_timestamp() + interval '2 minutes'
  );

  select result_code into v_result
  from public.claim_product_order_line_pay_confirmation(
    'sandbox',
    '70000000-0000-4000-8000-000000000002',
    '50000000-0000-4000-8000-000000000002',
    '60000000-0000-4000-8000-000000000002',
    '90000000-0000-4000-8000-000000000003',
    v_callback_event_id,
    'a0000000-0000-4000-8000-000000000005',
    'rollback-transaction-1',
    'confirm-rollback-claim-1'
  );

  select result_code into v_result
  from public.record_product_order_line_pay_confirmation_evidence(
    'sandbox',
    v_callback_event_id,
    'a0000000-0000-4000-8000-000000000005',
    repeat('7', 64),
    '0000',
    'confirm-rollback-evidence-1'
  );
end
$$;

create schema test_support;

create function test_support.fail_paid_order_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id = '50000000-0000-4000-8000-000000000002'
     and new.payment_status = 'paid' then
    raise exception 'injected_order_update_failure';
  end if;
  return new;
end;
$$;

create trigger line_pay_contract_injected_order_failure
before update on public.product_orders
for each row execute function test_support.fail_paid_order_update();

do $$
declare
  v_callback_event_id uuid;
begin
  select id into strict v_callback_event_id
  from public.line_pay_callback_events
  where capability_id = '90000000-0000-4000-8000-000000000003';

  begin
    perform public.complete_product_order_line_pay_confirmation(
      'sandbox',
      '70000000-0000-4000-8000-000000000002',
      '50000000-0000-4000-8000-000000000001',
      '60000000-0000-4000-8000-000000000002',
      'LP-ROLLBACK-ORDER-1',
      'rollback-transaction-1',
      200,
      'TWD',
      '90000000-0000-4000-8000-000000000003',
      v_callback_event_id,
      'a0000000-0000-4000-8000-000000000005',
      repeat('7', 64),
      'confirm-order-binding-mismatch-1',
      pg_catalog.jsonb_build_object('result_code', 'verified', 'evidence_sha256', repeat('7', 64))
    );
    raise exception 'order_payment_binding_mismatch_was_accepted';
  exception
    when check_violation then null;
  end;

  begin
    perform public.complete_product_order_line_pay_confirmation(
      'sandbox',
      '70000000-0000-4000-8000-000000000002',
      '50000000-0000-4000-8000-000000000002',
      '60000000-0000-4000-8000-000000000002',
      'LP-ROLLBACK-ORDER-1',
      'rollback-transaction-1',
      200,
      'TWD',
      '90000000-0000-4000-8000-000000000003',
      v_callback_event_id,
      'a0000000-0000-4000-8000-000000000005',
      repeat('7', 64),
      'confirm-rollback-1',
      pg_catalog.jsonb_build_object('result_code', 'verified', 'evidence_sha256', repeat('7', 64))
    );
    raise exception 'injected_order_failure_did_not_fire';
  exception
    when others then
      if sqlerrm <> 'injected_order_update_failure' then
        raise;
      end if;
  end;

  if not exists (
    select 1 from public.payments
    where id = '70000000-0000-4000-8000-000000000002'
      and status = 'pending'
      and request_state = 'confirmation_processing'
      and provider_trade_no is null
  ) then
    raise exception 'payment_update_was_not_rolled_back';
  end if;

  if not exists (
    select 1 from public.product_orders
    where id = '50000000-0000-4000-8000-000000000002'
      and payment_status = 'pending'
      and order_status = 'payment_pending'
      and payment_request_state = 'confirmation_processing'
  ) then
    raise exception 'order_changed_during_atomic_rollback';
  end if;

  if exists (
    select 1 from public.line_pay_callback_capabilities
    where id = '90000000-0000-4000-8000-000000000003'
      and consumed_at is not null
  ) then
    raise exception 'capability_consumed_during_atomic_rollback';
  end if;

  if not exists (
    select 1 from public.line_pay_callback_events
    where id = v_callback_event_id
      and state = 'provider_verified'
      and provider_result_sha256 = repeat('7', 64)
      and completed_at is null
  ) then
    raise exception 'callback_event_changed_during_atomic_rollback';
  end if;

  if exists (
    select 1 from public.line_pay_payment_audit_events
    where payment_id = '70000000-0000-4000-8000-000000000002'
      and event_type = 'confirmation_completed'
  ) then
    raise exception 'audit_persisted_during_atomic_rollback';
  end if;
end
$$;

drop trigger line_pay_contract_injected_order_failure on public.product_orders;
drop function test_support.fail_paid_order_update();
drop schema test_support;

do $$
begin
  begin
    update public.line_pay_checkout_attempts
    set environment = 'invalid'
    where id = '60000000-0000-4000-8000-000000000002';
    raise exception 'invalid_environment_was_accepted';
  exception
    when check_violation then null;
  end;

  begin
    insert into public.line_pay_checkout_attempts (
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
      '40000000-0000-4000-8000-000000000002',
      '50000000-0000-4000-8000-000000000002',
      null,
      'sandbox',
      'rollback-request-idempotency-1',
      repeat('8', 64),
      'initialized',
      200,
      'LP-IDEMPOTENCY-COLLISION-1'
    );
    raise exception 'idempotency_key_collision_was_accepted';
  exception
    when unique_violation then null;
  end;

  insert into public.line_pay_callback_capabilities (
    id,
    payment_id,
    product_order_id,
    checkout_attempt_id,
    environment,
    purpose,
    token_hash,
    capability_version,
    expires_at,
    created_at
  ) values (
    '90000000-0000-4000-8000-000000000004',
    '70000000-0000-4000-8000-000000000002',
    '50000000-0000-4000-8000-000000000002',
    '60000000-0000-4000-8000-000000000002',
    'sandbox',
    'cancel',
    repeat('5', 64),
    2,
    pg_catalog.clock_timestamp() - interval '5 minutes',
    pg_catalog.clock_timestamp() - interval '10 minutes'
  );

  begin
    perform public.claim_line_pay_callback_capability(
      repeat('5', 64),
      'sandbox',
      'cancel',
      '70000000-0000-4000-8000-000000000002',
      '50000000-0000-4000-8000-000000000002',
      '60000000-0000-4000-8000-000000000002',
      'a0000000-0000-4000-8000-000000000007',
      pg_catalog.clock_timestamp() + interval '2 minutes'
    );
    raise exception 'expired_capability_was_claimed';
  exception
    when others then
      if sqlerrm <> 'line_pay_callback_capability_unavailable' then
        raise;
      end if;
  end;

  begin
    insert into public.line_pay_callback_capabilities (
      payment_id,
      product_order_id,
      checkout_attempt_id,
      environment,
      purpose,
      token_hash,
      capability_version,
      expires_at
    ) values (
      '70000000-0000-4000-8000-000000000002',
      '50000000-0000-4000-8000-000000000002',
      '60000000-0000-4000-8000-000000000002',
      'sandbox',
      'cancel',
      repeat('2', 64),
      2,
      pg_catalog.clock_timestamp() + interval '30 minutes'
    );
    raise exception 'token_hash_collision_was_accepted';
  exception
    when unique_violation then null;
  end;
end
$$;

do $$
declare
  v_function oid;
  v_table text;
  v_name text;
begin
  foreach v_table in array array[
    'app_environment_attestation',
    'line_pay_checkout_attempts',
    'line_pay_request_outbox',
    'line_pay_callback_capabilities',
    'line_pay_callback_events',
    'line_pay_payment_audit_events'
  ]::text[] loop
    if not exists (
      select 1
      from pg_catalog.pg_class as relation
      join pg_catalog.pg_namespace as namespace
        on namespace.oid = relation.relnamespace
      where namespace.nspname = 'public'
        and relation.relname = v_table
        and relation.relrowsecurity
    ) then
      raise exception 'rls_not_enabled_for_%', v_table;
    end if;

    if pg_catalog.has_table_privilege('public_probe', 'public.' || v_table, 'select,insert,update,delete')
       or pg_catalog.has_table_privilege('anon', 'public.' || v_table, 'select,insert,update,delete')
       or pg_catalog.has_table_privilege('authenticated', 'public.' || v_table, 'select,insert,update,delete') then
      raise exception 'browser_role_table_privilege_found_for_%', v_table;
    end if;
  end loop;

  foreach v_name in array array[
    'product_orders.environment',
    'product_orders.fulfillment_mode',
    'product_orders.sandbox_test',
    'product_orders.currency',
    'product_orders.checkout_attempt_id',
    'product_orders.payment_request_state',
    'product_orders.reconciliation_required',
    'product_orders.state_version',
    'payments.product_order_id',
    'payments.environment',
    'payments.checkout_attempt_id',
    'payments.request_state',
    'payments.request_idempotency_key',
    'payments.request_body_sha256',
    'payments.line_pay_transaction_id',
    'payments.reconciliation_required',
    'payments.state_version'
  ]::text[] loop
    if not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = pg_catalog.split_part(v_name, '.', 1)
        and column_name = pg_catalog.split_part(v_name, '.', 2)
    ) then
      raise exception 'required_column_missing_%', v_name;
    end if;
  end loop;

  foreach v_name in array array[
    'payments_line_pay_contract_check',
    'payments_line_pay_reconciliation_check',
    'product_orders_line_pay_environment_check',
    'product_orders_sandbox_fulfillment_check',
    'line_pay_checkout_attempts_request_state_check',
    'line_pay_request_outbox_state_check',
    'line_pay_callback_capabilities_token_hash_check',
    'line_pay_callback_events_state_check',
    'line_pay_payment_audit_events_evidence_check',
    'line_pay_payment_audit_events_marker_check'
  ]::text[] loop
    if not exists (
      select 1 from pg_catalog.pg_constraint where conname = v_name
    ) then
      raise exception 'required_constraint_missing_%', v_name;
    end if;
  end loop;

  foreach v_name in array array[
    'line_pay_checkout_attempts_environment_key_idx',
    'line_pay_checkout_attempts_environment_transaction_idx',
    'line_pay_checkout_attempts_environment_merchant_idx',
    'line_pay_request_outbox_attempt_operation_idx',
    'line_pay_request_outbox_environment_key_idx',
    'line_pay_request_outbox_claimable_idx',
    'line_pay_request_outbox_reconciliation_idx',
    'line_pay_callback_capabilities_token_hash_idx',
    'line_pay_callback_capabilities_binding_idx',
    'line_pay_callback_capabilities_active_idx',
    'line_pay_callback_events_capability_key',
    'line_pay_callback_events_binding_idx',
    'line_pay_callback_events_reconciliation_idx',
    'product_orders_owner_id_idx',
    'payments_product_order_owner_idx'
  ]::text[] loop
    if pg_catalog.to_regclass('public.' || v_name) is null then
      raise exception 'required_index_missing_%', v_name;
    end if;
  end loop;

  for v_function in
    select procedure.oid
    from pg_catalog.pg_proc as procedure
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname in (
        'claim_product_order_line_pay_request',
        'record_product_order_line_pay_request_success',
        'record_product_order_line_pay_request_failure',
        'mark_product_order_line_pay_request_unknown',
        'read_product_order_line_pay_request_result',
        'claim_line_pay_callback_capability',
        'claim_product_order_line_pay_confirmation',
        'record_product_order_line_pay_confirmation_evidence',
        'complete_product_order_line_pay_confirmation',
        'cancel_product_order_line_pay_payment',
        'mark_product_order_line_pay_reconciliation'
      )
  loop
    select procedure.proname into strict v_name
    from pg_catalog.pg_proc as procedure
    where procedure.oid = v_function;

    if pg_catalog.has_function_privilege('public_probe', v_function, 'execute')
       or pg_catalog.has_function_privilege('anon', v_function, 'execute')
       or pg_catalog.has_function_privilege('authenticated', v_function, 'execute') then
      raise exception 'browser_role_function_execute_found';
    end if;

    if v_name in (
      'record_product_order_line_pay_confirmation_evidence',
      'complete_product_order_line_pay_confirmation'
    ) then
      if pg_catalog.has_function_privilege('service_role', v_function, 'execute')
         or not pg_catalog.has_function_privilege('line_pay_payment_executor', v_function, 'execute') then
        raise exception 'dedicated_executor_function_privilege_contract_failed_%', v_name;
      end if;

      if exists (
        select 1
        from pg_catalog.pg_proc as procedure
        where procedure.oid = v_function
          and (
            not procedure.prosecdef
            or procedure.proowner <> (
              select role.oid
              from pg_catalog.pg_roles as role
              where role.rolname = 'line_pay_payment_function_owner'
            )
            or procedure.provolatile <> 'v'
            or procedure.proconfig is null
            or not exists (
              select 1
              from unnest(procedure.proconfig) as setting
              where setting = 'search_path=""'
            )
          )
      ) then
        raise exception 'dedicated_executor_rpc_security_contract_failed_%', v_name;
      end if;
    else
      if not pg_catalog.has_function_privilege('service_role', v_function, 'execute') then
        raise exception 'service_role_function_execute_missing_%', v_name;
      end if;

      if exists (
        select 1
        from pg_catalog.pg_proc as procedure
        where procedure.oid = v_function
          and (
            procedure.prosecdef
            or procedure.proowner <> (
              select role.oid from pg_catalog.pg_roles as role where role.rolname = 'postgres'
            )
            or (
              procedure.proname = 'read_product_order_line_pay_request_result'
              and procedure.provolatile <> 's'
            )
            or (
              procedure.proname <> 'read_product_order_line_pay_request_result'
              and procedure.provolatile <> 'v'
            )
            or procedure.proconfig is null
            or not exists (
              select 1
              from unnest(procedure.proconfig) as setting
              where setting = 'search_path=""'
            )
          )
      ) then
        raise exception 'rpc_security_or_search_path_contract_failed_%', v_name;
      end if;
    end if;
  end loop;
end
$$;
