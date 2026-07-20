\set ON_ERROR_STOP on

-- H1/H4: exercise reconciliation through the intended service_role caller.
begin;
set constraints all deferred;

insert into public.product_orders (
  id, order_no, user_id, total_amount_twd, currency, payment_method,
  payment_status, order_status, shipping_status, environment,
  fulfillment_mode, sandbox_test, checkout_attempt_id, payment_request_state
) values (
  '50000000-0000-4000-8000-000000000020',
  'LP-SECOND-RECON-1',
  '40000000-0000-4000-8000-000000000001',
  420,
  'TWD',
  'line_pay',
  'pending',
  'payment_pending',
  'not_applicable',
  'sandbox',
  'none',
  true,
  '60000000-0000-4000-8000-000000000020',
  'pending'
);

insert into public.payments (
  id, user_id, provider, item_type, item_name, amount_twd, currency,
  status, merchant_order_no, product_order_id, environment,
  checkout_attempt_id, request_state, request_idempotency_key,
  request_body_sha256, line_pay_transaction_id
) values (
  '70000000-0000-4000-8000-000000000020',
  '40000000-0000-4000-8000-000000000001',
  'line_pay',
  'product_order',
  'Second remediation reconciliation fixture',
  420,
  'TWD',
  'pending',
  'LP-SECOND-RECON-1',
  '50000000-0000-4000-8000-000000000020',
  'sandbox',
  '60000000-0000-4000-8000-000000000020',
  'pending',
  'second-reconciliation-idempotency-1',
  repeat('2', 64),
  'second-reconciliation-transaction-1'
);

insert into public.line_pay_checkout_attempts (
  id, user_id, product_order_id, payment_id, environment,
  idempotency_key, request_body_sha256, request_state, amount_twd,
  upstream_transaction_id, merchant_order_no
) values (
  '60000000-0000-4000-8000-000000000020',
  '40000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000020',
  '70000000-0000-4000-8000-000000000020',
  'sandbox',
  'second-reconciliation-idempotency-1',
  repeat('2', 64),
  'pending',
  420,
  'second-reconciliation-transaction-1',
  'LP-SECOND-RECON-1'
);

update public.product_orders
set payment_id = '70000000-0000-4000-8000-000000000020'
where id = '50000000-0000-4000-8000-000000000020';

insert into public.line_pay_callback_capabilities (
  id, payment_id, product_order_id, checkout_attempt_id, environment,
  purpose, token_hash, claim_id, claimed_at, claim_expires_at, expires_at
) values (
  '90000000-0000-4000-8000-000000000020',
  '70000000-0000-4000-8000-000000000020',
  '50000000-0000-4000-8000-000000000020',
  '60000000-0000-4000-8000-000000000020',
  'sandbox',
  'confirm',
  repeat('3', 64),
  'a0000000-0000-4000-8000-000000000020',
  pg_catalog.clock_timestamp(),
  pg_catalog.clock_timestamp() + interval '10 minutes',
  pg_catalog.clock_timestamp() + interval '30 minutes'
);

insert into public.line_pay_callback_events (
  id, capability_id, payment_id, product_order_id, checkout_attempt_id,
  environment, purpose, state, claim_id, claimed_at, claim_expires_at
) values (
  '91000000-0000-4000-8000-000000000020',
  '90000000-0000-4000-8000-000000000020',
  '70000000-0000-4000-8000-000000000020',
  '50000000-0000-4000-8000-000000000020',
  '60000000-0000-4000-8000-000000000020',
  'sandbox',
  'confirm',
  'claimed',
  'a0000000-0000-4000-8000-000000000020',
  pg_catalog.clock_timestamp(),
  pg_catalog.clock_timestamp() + interval '10 minutes'
);

commit;

set role service_role;
do $$
declare
  v_result text;
begin
  select reconciliation.result_code into strict v_result
  from public.mark_product_order_line_pay_reconciliation(
    'sandbox',
    '70000000-0000-4000-8000-000000000020',
    '50000000-0000-4000-8000-000000000020',
    '60000000-0000-4000-8000-000000000020',
    'provider_result_unknown',
    'second-reconciliation-1'
  ) as reconciliation;

  if v_result <> 'marked' then
    raise exception 'reconciliation_normal_execution_failed';
  end if;

  select reconciliation.result_code into strict v_result
  from public.mark_product_order_line_pay_reconciliation(
    'sandbox',
    '70000000-0000-4000-8000-000000000020',
    '50000000-0000-4000-8000-000000000020',
    '60000000-0000-4000-8000-000000000020',
    'provider_result_unknown',
    'second-reconciliation-1'
  ) as reconciliation;

  if v_result <> 'already_marked' then
    raise exception 'reconciliation_idempotency_failed';
  end if;
end
$$;
reset role;

do $$
declare
  v_evidence jsonb;
begin
  if not exists (
    select 1
    from public.payments as payment
    join public.product_orders as product_order
      on product_order.id = payment.product_order_id
    join public.line_pay_checkout_attempts as attempt
      on attempt.id = payment.checkout_attempt_id
    join public.line_pay_callback_events as callback_event
      on callback_event.checkout_attempt_id = attempt.id
    where payment.id = '70000000-0000-4000-8000-000000000020'
      and payment.request_state = 'reconciliation_required'
      and payment.reconciliation_required
      and product_order.payment_request_state = 'reconciliation_required'
      and product_order.reconciliation_required
      and attempt.request_state = 'reconciliation_required'
      and attempt.reconciliation_required
      and attempt.last_error_code = 'provider_result_unknown'
      and callback_event.state = 'reconciliation_required'
      and callback_event.last_error_code = 'provider_result_unknown'
  ) then
    raise exception 'reconciliation_state_contract_failed';
  end if;

  select audit_event.evidence into strict v_evidence
  from public.line_pay_payment_audit_events as audit_event
  where audit_event.payment_id = '70000000-0000-4000-8000-000000000020'
    and audit_event.event_type = 'reconciliation_required';

  if v_evidence ->> 'result_code' <> 'reconciliation_required'
     or v_evidence ->> 'provider_status' <> 'reconciliation_required'
     or v_evidence ->> 'payment_id' <> '70000000-0000-4000-8000-000000000020'
     or v_evidence ->> 'product_order_id' <> '50000000-0000-4000-8000-000000000020'
     or v_evidence ->> 'checkout_attempt_id' <> '60000000-0000-4000-8000-000000000020'
     or v_evidence ->> 'callback_event_id' <> '91000000-0000-4000-8000-000000000020'
     or v_evidence ->> 'capability_id' <> '90000000-0000-4000-8000-000000000020'
     or v_evidence ->> 'environment' <> 'sandbox'
     or v_evidence ->> 'merchant_order_no' <> 'LP-SECOND-RECON-1'
     or v_evidence ->> 'transaction_id' <> 'second-reconciliation-transaction-1'
     or v_evidence ->> 'amount_twd' <> '420'
     or v_evidence ->> 'currency' <> 'TWD'
     or v_evidence ->> 'from_state' <> 'pending'
     or v_evidence ->> 'to_state' <> 'reconciliation_required'
     or v_evidence ->> 'reason_code' <> 'provider_result_unknown'
     or v_evidence ->> 'reconciliation_required' <> 'true'
     or not (v_evidence ? 'event_timestamp') then
    raise exception 'reconciliation_db_built_evidence_contract_failed';
  end if;

  if (
    select count(*)
    from public.line_pay_payment_audit_events
    where payment_id = '70000000-0000-4000-8000-000000000020'
      and event_type = 'reconciliation_required'
  ) <> 1 then
    raise exception 'reconciliation_retry_created_duplicate_audit';
  end if;
end
$$;

-- H2: paid/consumed/completed rows permit only an updated_at touch. The five
-- review-identified evidence fields reject different values and allow exact
-- same-value idempotent updates.
set role service_role;
do $$
begin
  update public.line_pay_checkout_attempts
  set idempotency_key = idempotency_key,
      request_body_sha256 = request_body_sha256,
      sanitized_result = sanitized_result
  where id = '60000000-0000-4000-8000-000000000009';

  update public.line_pay_callback_events
  set last_error_code = last_error_code
  where id = '91000000-0000-4000-8000-000000000009';

  update public.line_pay_callback_capabilities
  set expires_at = expires_at
  where id = '90000000-0000-4000-8000-000000000009';

  begin
    update public.line_pay_checkout_attempts
    set idempotency_key = 'rewritten-paid-idempotency-1'
    where id = '60000000-0000-4000-8000-000000000009';
    raise exception 'paid_attempt_idempotency_key_was_rewritten';
  exception when check_violation then null;
  end;

  begin
    update public.line_pay_checkout_attempts
    set request_body_sha256 = repeat('e', 64)
    where id = '60000000-0000-4000-8000-000000000009';
    raise exception 'paid_attempt_request_body_sha256_was_rewritten';
  exception when check_violation then null;
  end;

  begin
    update public.line_pay_checkout_attempts
    set sanitized_result = pg_catalog.jsonb_build_object(
      'result_code', '0000',
      'transaction_id', 'security-transaction-1',
      'merchant_order_no', 'LP-SECURITY-ORDER-1',
      'response_sha256', repeat('e', 64)
    )
    where id = '60000000-0000-4000-8000-000000000009';
    raise exception 'paid_attempt_sanitized_result_was_rewritten';
  exception when check_violation then null;
  end;

  begin
    update public.line_pay_callback_events
    set last_error_code = 'late_error'
    where id = '91000000-0000-4000-8000-000000000009';
    raise exception 'completed_callback_last_error_code_was_rewritten';
  exception when check_violation then null;
  end;

  begin
    update public.line_pay_callback_capabilities
    set expires_at = expires_at + interval '1 minute'
    where id = '90000000-0000-4000-8000-000000000009';
    raise exception 'consumed_capability_expires_at_was_rewritten';
  exception when check_violation then null;
  end;
end
$$;
reset role;

-- H3: generic service_role has no direct audit table access. An authorized
-- reconciliation transition above still wrote exactly one audit row.
set role service_role;
do $$
begin
  begin
    insert into public.line_pay_payment_audit_events (
      payment_id, product_order_id, checkout_attempt_id, environment,
      event_type, evidence
    ) values (
      '70000000-0000-4000-8000-000000000020',
      '50000000-0000-4000-8000-000000000020',
      '60000000-0000-4000-8000-000000000020',
      'sandbox',
      'request_claimed',
      '{"result_code":"claimed"}'::jsonb
    );
    raise exception 'service_role_direct_audit_insert_was_accepted';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.line_pay_payment_audit_events
    set event_type = 'request_failed'
    where id = '92000000-0000-4000-8000-000000000005';
    raise exception 'service_role_direct_audit_update_was_accepted';
  exception when insufficient_privilege then null;
  end;

  begin
    delete from public.line_pay_payment_audit_events
    where id = '92000000-0000-4000-8000-000000000005';
    raise exception 'service_role_direct_audit_delete_was_accepted';
  exception when insufficient_privilege then null;
  end;

  begin
    perform 1 from public.line_pay_payment_audit_events limit 1;
    raise exception 'service_role_direct_audit_select_was_accepted';
  exception when insufficient_privilege then null;
  end;
end
$$;
reset role;

-- H4: caller-controlled JSON is gone. State-incompatible scalar reasons are
-- rejected and a retry returns a stable result without another audit row.
set role service_role;
do $$
declare
  v_callback_event_id uuid;
  v_result text;
begin
  select callback_event.id into strict v_callback_event_id
  from public.line_pay_callback_events as callback_event
  where callback_event.capability_id = '90000000-0000-4000-8000-000000000002';

  begin
    perform public.cancel_product_order_line_pay_payment(
      'sandbox',
      '70000000-0000-4000-8000-000000000001',
      '50000000-0000-4000-8000-000000000001',
      '60000000-0000-4000-8000-000000000001',
      '90000000-0000-4000-8000-000000000002',
      v_callback_event_id,
      'a0000000-0000-4000-8000-000000000003',
      'cancel-reason-mismatch-1',
      'payment_canceled'
    );
    raise exception 'cancel_contradictory_reason_was_accepted';
  exception when invalid_parameter_value then null;
  end;

  begin
    perform public.cancel_product_order_line_pay_payment(
      'production',
      '70000000-0000-4000-8000-000000000001',
      '50000000-0000-4000-8000-000000000001',
      '60000000-0000-4000-8000-000000000001',
      '90000000-0000-4000-8000-000000000002',
      v_callback_event_id,
      'a0000000-0000-4000-8000-000000000003',
      'cancel-environment-mismatch-1',
      'cancel_after_paid'
    );
    raise exception 'cancel_contradictory_environment_was_accepted';
  exception when check_violation then null;
  end;

  select canceled.result_code into strict v_result
  from public.cancel_product_order_line_pay_payment(
    'sandbox',
    '70000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000001',
    '90000000-0000-4000-8000-000000000002',
    v_callback_event_id,
    'a0000000-0000-4000-8000-000000000003',
    'cancel-after-paid-1',
    'cancel_after_paid'
  ) as canceled;

  if v_result <> 'already_paid' then
    raise exception 'cancel_retry_result_was_not_stable';
  end if;
end
$$;
reset role;

do $$
declare
  v_evidence jsonb;
begin
  select audit_event.evidence into strict v_evidence
  from public.line_pay_payment_audit_events as audit_event
  where audit_event.payment_id = '70000000-0000-4000-8000-000000000001'
    and audit_event.event_type = 'cancel_after_paid';

  if v_evidence ->> 'result_code' <> 'cancel_after_paid'
     or v_evidence ->> 'payment_id' <> '70000000-0000-4000-8000-000000000001'
     or v_evidence ->> 'product_order_id' <> '50000000-0000-4000-8000-000000000001'
     or v_evidence ->> 'checkout_attempt_id' <> '60000000-0000-4000-8000-000000000001'
     or v_evidence ->> 'capability_id' <> '90000000-0000-4000-8000-000000000002'
     or v_evidence ->> 'environment' <> 'sandbox'
     or v_evidence ->> 'merchant_order_no' <> 'LP-CONTRACT-ORDER-1'
     or v_evidence ->> 'transaction_id' <> '92233720368547758081234567890'
     or v_evidence ->> 'amount_twd' <> '100'
     or v_evidence ->> 'currency' <> 'TWD'
     or v_evidence ->> 'from_state' <> 'paid'
     or v_evidence ->> 'to_state' <> 'paid'
     or v_evidence ->> 'reason_code' <> 'cancel_after_paid'
     or not (v_evidence ? 'callback_event_id')
     or not (v_evidence ? 'event_timestamp') then
    raise exception 'cancel_db_built_evidence_contract_failed';
  end if;

  if (
    select count(*)
    from public.line_pay_payment_audit_events
    where payment_id = '70000000-0000-4000-8000-000000000001'
      and event_type = 'cancel_after_paid'
  ) <> 1 then
    raise exception 'cancel_retry_created_duplicate_audit';
  end if;
end
$$;

-- H1: a late audit failure must roll every reconciliation state write back.
begin;
set constraints all deferred;

insert into public.product_orders (
  id, order_no, user_id, total_amount_twd, currency, payment_method,
  payment_status, order_status, shipping_status, environment,
  fulfillment_mode, sandbox_test, checkout_attempt_id, payment_request_state
) values (
  '50000000-0000-4000-8000-000000000021',
  'LP-SECOND-ROLLBACK-1',
  '40000000-0000-4000-8000-000000000001',
  421,
  'TWD', 'line_pay', 'pending', 'payment_pending', 'not_applicable',
  'sandbox', 'none', true,
  '60000000-0000-4000-8000-000000000021', 'pending'
);

insert into public.payments (
  id, user_id, provider, item_type, item_name, amount_twd, currency,
  status, merchant_order_no, product_order_id, environment,
  checkout_attempt_id, request_state, request_idempotency_key,
  request_body_sha256
) values (
  '70000000-0000-4000-8000-000000000021',
  '40000000-0000-4000-8000-000000000001',
  'line_pay', 'product_order', 'Second remediation rollback fixture',
  421, 'TWD', 'pending', 'LP-SECOND-ROLLBACK-1',
  '50000000-0000-4000-8000-000000000021', 'sandbox',
  '60000000-0000-4000-8000-000000000021', 'pending',
  'second-rollback-idempotency-1', repeat('4', 64)
);

insert into public.line_pay_checkout_attempts (
  id, user_id, product_order_id, payment_id, environment,
  idempotency_key, request_body_sha256, request_state, amount_twd,
  merchant_order_no
) values (
  '60000000-0000-4000-8000-000000000021',
  '40000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000021',
  '70000000-0000-4000-8000-000000000021',
  'sandbox', 'second-rollback-idempotency-1', repeat('4', 64),
  'pending', 421, 'LP-SECOND-ROLLBACK-1'
);

update public.product_orders
set payment_id = '70000000-0000-4000-8000-000000000021'
where id = '50000000-0000-4000-8000-000000000021';

commit;

create schema line_pay_second_test_support;
create function line_pay_second_test_support.fail_reconciliation_audit()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.payment_id = '70000000-0000-4000-8000-000000000021' then
    raise exception 'injected_second_reconciliation_audit_failure';
  end if;
  return new;
end;
$$;

create trigger line_pay_second_reconciliation_audit_failure
before insert on public.line_pay_payment_audit_events
for each row execute function line_pay_second_test_support.fail_reconciliation_audit();

set role service_role;
do $$
begin
  begin
    perform public.mark_product_order_line_pay_reconciliation(
      'sandbox',
      '70000000-0000-4000-8000-000000000021',
      '50000000-0000-4000-8000-000000000021',
      '60000000-0000-4000-8000-000000000021',
      'rollback_probe',
      'second-reconciliation-rollback-1'
    );
    raise exception 'reconciliation_audit_failure_was_not_raised';
  exception when others then
    if sqlerrm <> 'injected_second_reconciliation_audit_failure' then
      raise;
    end if;
  end;
end
$$;
reset role;

do $$
begin
  if not exists (
    select 1 from public.payments
    where id = '70000000-0000-4000-8000-000000000021'
      and request_state = 'pending'
      and not reconciliation_required
  ) or not exists (
    select 1 from public.product_orders
    where id = '50000000-0000-4000-8000-000000000021'
      and payment_request_state = 'pending'
      and not reconciliation_required
  ) or not exists (
    select 1 from public.line_pay_checkout_attempts
    where id = '60000000-0000-4000-8000-000000000021'
      and request_state = 'pending'
      and not reconciliation_required
      and last_error_code is null
  ) or exists (
    select 1 from public.line_pay_payment_audit_events
    where payment_id = '70000000-0000-4000-8000-000000000021'
  ) then
    raise exception 'reconciliation_atomic_rollback_failed';
  end if;
end
$$;

drop trigger line_pay_second_reconciliation_audit_failure
on public.line_pay_payment_audit_events;
drop function line_pay_second_test_support.fail_reconciliation_audit();
drop schema line_pay_second_test_support;
