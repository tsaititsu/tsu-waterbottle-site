\set ON_ERROR_STOP on

-- This fixture starts immediately before provider evidence is recorded. It is
-- intentionally synthetic and remains inside the disposable PostgreSQL test.
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
  '50000000-0000-4000-8000-000000000009',
  'LP-SECURITY-ORDER-1',
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
  '60000000-0000-4000-8000-000000000009',
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
  '70000000-0000-4000-8000-000000000009',
  '40000000-0000-4000-8000-000000000002',
  'line_pay',
  'product_order',
  'Sandbox security item',
  300,
  'TWD',
  'pending',
  'LP-SECURITY-ORDER-1',
  '50000000-0000-4000-8000-000000000009',
  'sandbox',
  '60000000-0000-4000-8000-000000000009',
  'confirmation_processing',
  'security-request-idempotency-1',
  repeat('b', 64),
  'security-transaction-1'
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
  '60000000-0000-4000-8000-000000000009',
  '40000000-0000-4000-8000-000000000002',
  '50000000-0000-4000-8000-000000000009',
  '70000000-0000-4000-8000-000000000009',
  'sandbox',
  'security-request-idempotency-1',
  repeat('b', 64),
  'confirmation_processing',
  300,
  'security-transaction-1',
  'LP-SECURITY-ORDER-1'
);

update public.product_orders
set payment_id = '70000000-0000-4000-8000-000000000009'
where id = '50000000-0000-4000-8000-000000000009';

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
  '90000000-0000-4000-8000-000000000009',
  '70000000-0000-4000-8000-000000000009',
  '50000000-0000-4000-8000-000000000009',
  '60000000-0000-4000-8000-000000000009',
  'sandbox',
  'confirm',
  repeat('f', 64),
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
  '91000000-0000-4000-8000-000000000009',
  '90000000-0000-4000-8000-000000000009',
  '70000000-0000-4000-8000-000000000009',
  '50000000-0000-4000-8000-000000000009',
  '60000000-0000-4000-8000-000000000009',
  'sandbox',
  'confirm',
  'claimed',
  'a0000000-0000-4000-8000-000000000040',
  pg_catalog.clock_timestamp(),
  pg_catalog.clock_timestamp() + interval '10 minutes'
);

commit;

set role service_role;
do $$
begin
  begin
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
      line_pay_transaction_id,
      provider_trade_no,
      paid_at
    ) values (
      '70000000-0000-4000-8000-000000000010',
      '40000000-0000-4000-8000-000000000002',
      'line_pay',
      'product_order',
      'Direct paid insert probe',
      300,
      'TWD',
      'paid',
      'LP-SECURITY-ORDER-1',
      '50000000-0000-4000-8000-000000000009',
      'sandbox',
      '60000000-0000-4000-8000-000000000009',
      'paid',
      'security-direct-paid-insert-1',
      repeat('1', 64),
      'security-transaction-1',
      'security-transaction-1',
      pg_catalog.clock_timestamp()
    );
    raise exception 'service_role_direct_paid_payment_insert_was_accepted';
  exception
    when check_violation then null;
  end;

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
      payment_request_state
    ) values (
      '50000000-0000-4000-8000-000000000010',
      'LP-DIRECT-PAID-INSERT-1',
      '40000000-0000-4000-8000-000000000002',
      300,
      'TWD',
      'line_pay',
      'paid',
      'paid',
      'not_shipped',
      'production',
      'physical',
      false,
      'paid'
    );
    raise exception 'service_role_direct_paid_order_insert_was_accepted';
  exception
    when check_violation then null;
  end;

  begin
    perform public.record_product_order_line_pay_confirmation_evidence(
      'sandbox',
      '91000000-0000-4000-8000-000000000009',
      'a0000000-0000-4000-8000-000000000040',
      repeat('d', 64),
      '0000',
      'service-role-evidence-denied-1'
    );
    raise exception 'service_role_provider_evidence_was_accepted';
  exception
    when insufficient_privilege then null;
  end;

  begin
    perform public.complete_product_order_line_pay_confirmation(
      'sandbox',
      '70000000-0000-4000-8000-000000000009',
      '50000000-0000-4000-8000-000000000009',
      '60000000-0000-4000-8000-000000000009',
      'LP-SECURITY-ORDER-1',
      'security-transaction-1',
      300,
      'TWD',
      '90000000-0000-4000-8000-000000000009',
      '91000000-0000-4000-8000-000000000009',
      'a0000000-0000-4000-8000-000000000040',
      repeat('d', 64),
      'service-role-finalize-denied-1',
      pg_catalog.jsonb_build_object('result_code', 'verified', 'evidence_sha256', repeat('d', 64))
    );
    raise exception 'service_role_finalize_was_accepted';
  exception
    when insufficient_privilege then null;
  end;

  begin
    update public.payments
    set status = 'paid',
        request_state = 'paid',
        provider_trade_no = line_pay_transaction_id,
        paid_at = pg_catalog.clock_timestamp()
    where id = '70000000-0000-4000-8000-000000000009';
    raise exception 'service_role_direct_pending_to_paid_was_accepted';
  exception
    when check_violation then null;
  end;

  begin
    insert into line_pay_private.line_pay_completion_proofs (
      payment_id,
      product_order_id,
      checkout_attempt_id,
      callback_event_id,
      capability_id,
      environment,
      merchant_order_no,
      transaction_id,
      amount_twd,
      currency,
      provider_result_code,
      provider_result_sha256,
      audit_event_id,
      completed_at
    ) values (
      '70000000-0000-4000-8000-000000000009',
      '50000000-0000-4000-8000-000000000009',
      '60000000-0000-4000-8000-000000000009',
      '91000000-0000-4000-8000-000000000009',
      '90000000-0000-4000-8000-000000000009',
      'sandbox',
      'LP-SECURITY-ORDER-1',
      'security-transaction-1',
      300,
      'TWD',
      '0000',
      repeat('d', 64),
      '92000000-0000-4000-8000-000000000005',
      pg_catalog.clock_timestamp()
    );
    raise exception 'service_role_completion_proof_insert_was_accepted';
  exception
    when insufficient_privilege then null;
  end;
end
$$;
reset role;

do $$
begin
  if exists (
    select 1
    from pg_catalog.pg_roles
    where rolname in ('line_pay_payment_executor', 'line_pay_payment_function_owner')
      and (rolcanlogin or rolinherit or rolsuper or rolcreatedb or rolcreaterole or rolreplication or rolbypassrls)
  ) then
    raise exception 'dedicated_role_attributes_are_not_minimal';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_auth_members as membership
    join pg_catalog.pg_roles as granted_role
      on granted_role.oid = membership.roleid
    join pg_catalog.pg_roles as member_role
      on member_role.oid = membership.member
    where granted_role.rolname in (
      'line_pay_payment_executor',
      'line_pay_payment_function_owner'
    )
       or member_role.rolname in (
         'line_pay_payment_executor',
         'line_pay_payment_function_owner'
       )
  ) then
    raise exception 'dedicated_payment_roles_have_memberships';
  end if;

  if pg_catalog.has_table_privilege(
    'line_pay_payment_executor',
    'public.payments',
    'select,insert,update,delete'
  ) or pg_catalog.has_table_privilege(
    'line_pay_payment_executor',
    'line_pay_private.line_pay_completion_proofs',
    'select,insert,update,delete'
  ) then
    raise exception 'dedicated_executor_has_table_dml';
  end if;

  if pg_catalog.has_table_privilege(
    'service_role',
    'line_pay_private.line_pay_completion_proofs',
    'insert,update,delete'
  ) then
    raise exception 'service_role_has_completion_proof_dml';
  end if;
end
$$;

set role line_pay_payment_executor;
do $$
declare
  v_outcome text;
begin
  foreach v_outcome in array array[
    'failed',
    'canceled',
    'pending',
    'timeout',
    'unknown',
    'reconciliation_required'
  ]::text[] loop
    begin
      perform public.record_product_order_line_pay_confirmation_evidence(
        'sandbox',
        '91000000-0000-4000-8000-000000000009',
        'a0000000-0000-4000-8000-000000000040',
        repeat('d', 64),
        v_outcome,
        'provider-outcome-denied-1'
      );
      raise exception 'non_success_provider_outcome_was_accepted_%', v_outcome;
    exception
      when invalid_parameter_value then null;
    end;
  end loop;

  begin
    update public.payments
    set status = 'paid'
    where id = '70000000-0000-4000-8000-000000000009';
    raise exception 'executor_table_dml_was_accepted';
  exception
    when insufficient_privilege then null;
  end;

  perform public.record_product_order_line_pay_confirmation_evidence(
    'sandbox',
    '91000000-0000-4000-8000-000000000009',
    'a0000000-0000-4000-8000-000000000040',
    repeat('d', 64),
    '0000',
    'provider-success-evidence-1'
  );

  begin
    perform public.complete_product_order_line_pay_confirmation(
      'sandbox',
      '70000000-0000-4000-8000-000000000009',
      '50000000-0000-4000-8000-000000000009',
      '60000000-0000-4000-8000-000000000009',
      'LP-SECURITY-ORDER-1',
      'security-transaction-1',
      300,
      'TWD',
      '90000000-0000-4000-8000-000000000009',
      '91000000-0000-4000-8000-000000000009',
      'a0000000-0000-4000-8000-000000000040',
      repeat('e', 64),
      'provider-hash-mismatch-1',
      pg_catalog.jsonb_build_object('result_code', 'verified', 'evidence_sha256', repeat('e', 64))
    );
    raise exception 'provider_hash_mismatch_was_accepted';
  exception
    when check_violation then null;
  end;

  perform public.complete_product_order_line_pay_confirmation(
    'sandbox',
    '70000000-0000-4000-8000-000000000009',
    '50000000-0000-4000-8000-000000000009',
    '60000000-0000-4000-8000-000000000009',
    'LP-SECURITY-ORDER-1',
    'security-transaction-1',
    300,
    'TWD',
    '90000000-0000-4000-8000-000000000009',
    '91000000-0000-4000-8000-000000000009',
    'a0000000-0000-4000-8000-000000000040',
    repeat('d', 64),
    'provider-success-finalize-1',
    pg_catalog.jsonb_build_object('result_code', 'verified', 'evidence_sha256', repeat('d', 64))
  );
end
$$;
reset role;

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
    join public.line_pay_payment_audit_events as audit_event on audit_event.id = proof.audit_event_id
    where proof.payment_id = '70000000-0000-4000-8000-000000000009'
      and proof.provider_result_code = '0000'
      and proof.provider_result_sha256 = repeat('d', 64)
      and payment.status = 'paid'
      and payment.request_state = 'paid'
      and payment.paid_at = proof.completed_at
      and product_order.payment_status = 'paid'
      and product_order.order_status = 'paid'
      and attempt.request_state = 'paid'
      and attempt.completed_at = proof.completed_at
      and capability.consumed_at = proof.completed_at
      and callback_event.state = 'completed'
      and callback_event.completed_at = proof.completed_at
      and audit_event.event_type = 'confirmation_completed'
  ) then
    raise exception 'trusted_paid_completion_proof_missing';
  end if;

  if public.line_pay_audit_evidence_is_valid(
    '{"provider_status":"opaque_unapproved_value"}'::jsonb
  ) then
    raise exception 'opaque_audit_value_was_accepted';
  end if;

  if public.line_pay_audit_evidence_is_valid(
    '{"provider_status":{"token":"nested"}}'::jsonb
  ) then
    raise exception 'nested_sensitive_audit_value_was_accepted';
  end if;

  if public.line_pay_audit_evidence_is_valid(
    '{"Provider-Status":"success"}'::jsonb
  ) then
    raise exception 'punctuation_variant_audit_key_was_accepted';
  end if;
end
$$;

set role service_role;
do $$
begin
  begin
    update public.payments
    set provider_trade_no = 'rewritten-transaction'
    where id = '70000000-0000-4000-8000-000000000009';
    raise exception 'paid_payment_transaction_was_rewritten';
  exception when check_violation then null;
  end;

  begin
    update public.payments
    set merchant_order_no = 'LP-REWRITTEN-ORDER'
    where id = '70000000-0000-4000-8000-000000000009';
    raise exception 'paid_payment_merchant_order_was_rewritten';
  exception when check_violation then null;
  end;

  begin
    update public.payments
    set amount_twd = amount_twd + 1
    where id = '70000000-0000-4000-8000-000000000009';
    raise exception 'paid_payment_amount_was_rewritten';
  exception when check_violation then null;
  end;

  begin
    update public.payments
    set currency = 'USD'
    where id = '70000000-0000-4000-8000-000000000009';
    raise exception 'paid_payment_currency_was_rewritten';
  exception when check_violation then null;
  end;

  begin
    update public.payments
    set environment = 'production'
    where id = '70000000-0000-4000-8000-000000000009';
    raise exception 'paid_payment_environment_was_rewritten';
  exception when check_violation then null;
  end;

  begin
    update public.payments
    set product_order_id = '50000000-0000-4000-8000-000000000002'
    where id = '70000000-0000-4000-8000-000000000009';
    raise exception 'paid_payment_order_relation_was_rewritten';
  exception when check_violation then null;
  end;

  begin
    update public.payments
    set paid_at = paid_at + interval '1 second'
    where id = '70000000-0000-4000-8000-000000000009';
    raise exception 'paid_payment_timestamp_was_rewritten';
  exception when check_violation then null;
  end;

  begin
    update public.product_orders
    set checkout_attempt_id = '60000000-0000-4000-8000-000000000002'
    where id = '50000000-0000-4000-8000-000000000009';
    raise exception 'paid_order_attempt_relation_was_rewritten';
  exception when check_violation then null;
  end;

  begin
    update public.line_pay_checkout_attempts
    set upstream_transaction_id = 'rewritten-transaction'
    where id = '60000000-0000-4000-8000-000000000009';
    raise exception 'paid_attempt_transaction_was_rewritten';
  exception when check_violation then null;
  end;

  begin
    update public.line_pay_callback_events
    set provider_result_sha256 = repeat('f', 64)
    where id = '91000000-0000-4000-8000-000000000009';
    raise exception 'completed_callback_evidence_was_rewritten';
  exception when check_violation or insufficient_privilege then null;
  end;

  begin
    update public.line_pay_callback_capabilities
    set payment_id = '70000000-0000-4000-8000-000000000002'
    where id = '90000000-0000-4000-8000-000000000009';
    raise exception 'consumed_capability_binding_was_rewritten';
  exception when check_violation then null;
  end;

  begin
    update line_pay_private.line_pay_completion_proofs
    set transaction_id = 'rewritten-transaction'
    where payment_id = '70000000-0000-4000-8000-000000000009';
    raise exception 'completion_proof_was_rewritten';
  exception when insufficient_privilege then null;
  end;
end
$$;
reset role;

-- Exercise every atomic finalize stage against the rollback fixture prepared by
-- line_pay_remediation_contracts.sql. The setting contains only a stage label.
create schema test_support;

create function test_support.inject_line_pay_finalize_failure()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_stage text := pg_catalog.current_setting('test_support.line_pay_failure_stage', true);
begin
  if (v_stage = 'audit' and tg_table_schema = 'public' and tg_table_name = 'line_pay_payment_audit_events' and tg_op = 'INSERT')
     or (v_stage = 'proof' and tg_table_schema = 'line_pay_private' and tg_table_name = 'line_pay_completion_proofs' and tg_op = 'INSERT')
     or (v_stage = 'payment' and tg_table_schema = 'public' and tg_table_name = 'payments' and tg_op = 'UPDATE')
     or (v_stage = 'order' and tg_table_schema = 'public' and tg_table_name = 'product_orders' and tg_op = 'UPDATE')
     or (v_stage = 'attempt' and tg_table_schema = 'public' and tg_table_name = 'line_pay_checkout_attempts' and tg_op = 'UPDATE')
     or (v_stage = 'capability' and tg_table_schema = 'public' and tg_table_name = 'line_pay_callback_capabilities' and tg_op = 'UPDATE')
     or (v_stage = 'callback' and tg_table_schema = 'public' and tg_table_name = 'line_pay_callback_events' and tg_op = 'UPDATE') then
    raise exception 'injected_line_pay_finalize_failure_%', v_stage;
  end if;
  return new;
end;
$$;

create trigger test_support_line_pay_finalize_audit_failure
before insert on public.line_pay_payment_audit_events
for each row execute function test_support.inject_line_pay_finalize_failure();
create trigger test_support_line_pay_finalize_proof_failure
before insert on line_pay_private.line_pay_completion_proofs
for each row execute function test_support.inject_line_pay_finalize_failure();
create trigger test_support_line_pay_finalize_payment_failure
before update on public.payments
for each row execute function test_support.inject_line_pay_finalize_failure();
create trigger test_support_line_pay_finalize_order_failure
before update on public.product_orders
for each row execute function test_support.inject_line_pay_finalize_failure();
create trigger test_support_line_pay_finalize_attempt_failure
before update on public.line_pay_checkout_attempts
for each row execute function test_support.inject_line_pay_finalize_failure();
create trigger test_support_line_pay_finalize_capability_failure
before update on public.line_pay_callback_capabilities
for each row execute function test_support.inject_line_pay_finalize_failure();
create trigger test_support_line_pay_finalize_callback_failure
before update on public.line_pay_callback_events
for each row execute function test_support.inject_line_pay_finalize_failure();

do $$
declare
  v_stage text;
  v_callback_event_id uuid;
begin
  select id into strict v_callback_event_id
  from public.line_pay_callback_events
  where capability_id = '90000000-0000-4000-8000-000000000003';

  foreach v_stage in array array[
    'audit',
    'proof',
    'payment',
    'order',
    'attempt',
    'capability',
    'callback'
  ]::text[] loop
    perform pg_catalog.set_config('test_support.line_pay_failure_stage', v_stage, false);
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
        'atomic-stage-rollback-1',
        pg_catalog.jsonb_build_object('result_code', 'verified', 'evidence_sha256', repeat('7', 64))
      );
      raise exception 'injected_finalize_stage_did_not_fail_%', v_stage;
    exception
      when others then
        if sqlerrm <> 'injected_line_pay_finalize_failure_' || v_stage then
          raise;
        end if;
    end;

    if not exists (
      select 1 from public.payments
      where id = '70000000-0000-4000-8000-000000000002'
        and status = 'pending'
        and request_state = 'confirmation_processing'
        and provider_trade_no is null
        and paid_at is null
    ) or not exists (
      select 1 from public.product_orders
      where id = '50000000-0000-4000-8000-000000000002'
        and payment_status = 'pending'
        and order_status = 'payment_pending'
        and payment_request_state = 'confirmation_processing'
    ) or not exists (
      select 1 from public.line_pay_checkout_attempts
      where id = '60000000-0000-4000-8000-000000000002'
        and request_state = 'confirmation_processing'
    ) or exists (
      select 1 from public.line_pay_callback_capabilities
      where id = '90000000-0000-4000-8000-000000000003'
        and consumed_at is not null
    ) or not exists (
      select 1 from public.line_pay_callback_events
      where id = v_callback_event_id
        and state = 'provider_verified'
        and completed_at is null
    ) or exists (
      select 1 from line_pay_private.line_pay_completion_proofs
      where payment_id = '70000000-0000-4000-8000-000000000002'
    ) or exists (
      select 1 from public.line_pay_payment_audit_events
      where payment_id = '70000000-0000-4000-8000-000000000002'
        and event_type = 'confirmation_completed'
    ) then
      raise exception 'atomic_finalize_stage_did_not_fully_rollback_%', v_stage;
    end if;
  end loop;

  perform pg_catalog.set_config('test_support.line_pay_failure_stage', '', false);
end
$$;

drop trigger test_support_line_pay_finalize_audit_failure on public.line_pay_payment_audit_events;
drop trigger test_support_line_pay_finalize_proof_failure on line_pay_private.line_pay_completion_proofs;
drop trigger test_support_line_pay_finalize_payment_failure on public.payments;
drop trigger test_support_line_pay_finalize_order_failure on public.product_orders;
drop trigger test_support_line_pay_finalize_attempt_failure on public.line_pay_checkout_attempts;
drop trigger test_support_line_pay_finalize_capability_failure on public.line_pay_callback_capabilities;
drop trigger test_support_line_pay_finalize_callback_failure on public.line_pay_callback_events;
drop function test_support.inject_line_pay_finalize_failure();
drop schema test_support;
