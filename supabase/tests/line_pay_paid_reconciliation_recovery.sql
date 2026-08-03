\set ON_ERROR_STOP on

create schema line_pay_paid_recovery_test;

create function line_pay_paid_recovery_test.seed_reconciliation(
  p_suffix integer
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_product_order_id uuid := ('50000000-0000-4000-8000-' || pg_catalog.lpad(p_suffix::text, 12, '0'))::uuid;
  v_payment_id uuid := ('70000000-0000-4000-8000-' || pg_catalog.lpad(p_suffix::text, 12, '0'))::uuid;
  v_attempt_id uuid := ('60000000-0000-4000-8000-' || pg_catalog.lpad(p_suffix::text, 12, '0'))::uuid;
  v_capability_id uuid := ('90000000-0000-4000-8000-' || pg_catalog.lpad(p_suffix::text, 12, '0'))::uuid;
  v_callback_id uuid := ('91000000-0000-4000-8000-' || pg_catalog.lpad(p_suffix::text, 12, '0'))::uuid;
  v_order_no text := 'LP-PAID-RECOVERY-' || p_suffix;
  v_transaction_id text := 'paid-recovery-transaction-' || p_suffix;
begin
  insert into public.product_orders (
    id, order_no, user_id, total_amount_twd, currency, payment_method,
    payment_status, order_status, shipping_status, environment,
    fulfillment_mode, sandbox_test, checkout_attempt_id,
    payment_request_state, reconciliation_required
  ) values (
    v_product_order_id, v_order_no,
    '40000000-0000-4000-8000-000000000002', 300, 'TWD', 'line_pay',
    'pending', 'payment_pending', 'not_applicable', 'sandbox',
    'none', true, v_attempt_id, 'reconciliation_required', true
  );

  insert into public.payments (
    id, user_id, provider, item_type, item_name, amount_twd, currency,
    status, merchant_order_no, product_order_id, environment,
    checkout_attempt_id, request_state, request_idempotency_key,
    request_body_sha256, line_pay_transaction_id, reconciliation_required
  ) values (
    v_payment_id, '40000000-0000-4000-8000-000000000002', 'line_pay',
    'product_order', 'Paid recovery sandbox fixture', 300, 'TWD', 'pending',
    v_order_no, v_product_order_id, 'sandbox', v_attempt_id,
    'reconciliation_required', v_order_no || '-idempotency', repeat('b', 64),
    v_transaction_id, true
  );

  insert into public.line_pay_checkout_attempts (
    id, user_id, product_order_id, payment_id, environment, idempotency_key,
    request_body_sha256, request_state, amount_twd, upstream_transaction_id,
    merchant_order_no, reconciliation_required
  ) values (
    v_attempt_id, '40000000-0000-4000-8000-000000000002',
    v_product_order_id, v_payment_id, 'sandbox', v_order_no || '-idempotency',
    repeat('b', 64), 'reconciliation_required', 300, v_transaction_id,
    v_order_no, true
  );

  update public.product_orders set payment_id = v_payment_id
  where id = v_product_order_id;

  insert into public.line_pay_callback_capabilities (
    id, payment_id, product_order_id, checkout_attempt_id, environment,
    purpose, token_hash, claim_id, claimed_at, claim_expires_at, expires_at
  ) values (
    v_capability_id, v_payment_id, v_product_order_id, v_attempt_id,
    'sandbox', 'confirm',
    pg_catalog.replace(v_capability_id::text, '-', '')
      || pg_catalog.replace(v_capability_id::text, '-', ''),
    null, null, null, pg_catalog.clock_timestamp() + interval '30 minutes'
  );

  insert into public.line_pay_callback_events (
    id, capability_id, payment_id, product_order_id, checkout_attempt_id,
    environment, purpose, state
  ) values (
    v_callback_id, v_capability_id, v_payment_id, v_product_order_id,
    v_attempt_id, 'sandbox', 'confirm', 'reconciliation_required'
  );

  insert into public.line_pay_payment_audit_events (
    payment_id, product_order_id, checkout_attempt_id, environment,
    event_type, from_state, to_state, request_id, evidence
  ) values (
    v_payment_id, v_product_order_id, v_attempt_id, 'sandbox',
    'reconciliation_required', 'confirmation_processing',
    'reconciliation_required', 'paid-recovery-seed-' || p_suffix,
    pg_catalog.jsonb_build_object(
      'result_code', 'reconciliation_required',
      'provider_status', 'reconciliation_required',
      'reason_code', 'confirmation_finalize_failed',
      'event_type', 'reconciliation_required'
    )
  );
end;
$$;

select line_pay_paid_recovery_test.seed_reconciliation(29);
select line_pay_paid_recovery_test.seed_reconciliation(28);
select line_pay_paid_recovery_test.seed_reconciliation(27);
select line_pay_paid_recovery_test.seed_reconciliation(26);

do $$
declare
  v_owner text;
begin
  select owner_role.rolname
  into v_owner
  from pg_catalog.pg_class as relation
  join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
  join pg_catalog.pg_roles as owner_role on owner_role.oid = relation.relowner
  where namespace.nspname = 'line_pay_private'
    and relation.relname = 'line_pay_completion_proofs';

  if v_owner <> 'line_pay_payment_function_owner' then
    raise exception 'paid_recovery_completion_proof_owner_not_repaired';
  end if;
end
$$;

set role service_role;
do $$
begin
  begin
    perform public.recover_product_order_line_pay_confirmation(
      'sandbox',
      '70000000-0000-4000-8000-000000000029',
      '50000000-0000-4000-8000-000000000029',
      '60000000-0000-4000-8000-000000000029',
      'LP-PAID-RECOVERY-29', 'paid-recovery-transaction-29', 300, 'TWD',
      '90000000-0000-4000-8000-000000000029',
      '91000000-0000-4000-8000-000000000029',
      repeat('d', 64), 'paid-recovery-service-role-denied'
    );
    raise exception 'paid_recovery_service_role_was_accepted';
  exception when insufficient_privilege then null;
  end;
end
$$;
reset role;

set session authorization authenticator;
set role line_pay_payment_executor;
do $$
declare
  v_result record;
begin
  select recovery.* into strict v_result
  from public.recover_product_order_line_pay_confirmation(
    'sandbox',
    '70000000-0000-4000-8000-000000000029',
    '50000000-0000-4000-8000-000000000029',
    '60000000-0000-4000-8000-000000000029',
    'LP-PAID-RECOVERY-29', 'paid-recovery-transaction-29', 300, 'TWD',
    '90000000-0000-4000-8000-000000000029',
    '91000000-0000-4000-8000-000000000029',
    repeat('d', 64), 'paid-recovery-success-29'
  ) as recovery;

  if v_result.result_code <> 'completed' then
    raise exception 'paid_recovery_success_result_invalid';
  end if;

  select recovery.* into strict v_result
  from public.recover_product_order_line_pay_confirmation(
    'sandbox',
    '70000000-0000-4000-8000-000000000029',
    '50000000-0000-4000-8000-000000000029',
    '60000000-0000-4000-8000-000000000029',
    'LP-PAID-RECOVERY-29', 'paid-recovery-transaction-29', 300, 'TWD',
    '90000000-0000-4000-8000-000000000029',
    '91000000-0000-4000-8000-000000000029',
    repeat('d', 64), 'paid-recovery-idempotent-29'
  ) as recovery;

  if v_result.result_code <> 'already_completed' then
    raise exception 'paid_recovery_idempotency_invalid';
  end if;

  begin
    perform public.recover_product_order_line_pay_confirmation(
      'sandbox',
      '70000000-0000-4000-8000-000000000029',
      '50000000-0000-4000-8000-000000000029',
      '60000000-0000-4000-8000-000000000029',
      'LP-PAID-RECOVERY-29', 'paid-recovery-transaction-29', 301, 'TWD',
      '90000000-0000-4000-8000-000000000029',
      '91000000-0000-4000-8000-000000000029',
      repeat('d', 64), 'paid-recovery-amount-mismatch-29'
    );
    raise exception 'paid_recovery_amount_mismatch_was_accepted';
  exception when check_violation then null;
  end;
end
$$;
reset role;
reset session authorization;

do $$
begin
  if not exists (
    select 1
    from public.payments as payment
    join public.product_orders as product_order on product_order.id = payment.product_order_id
    join public.line_pay_checkout_attempts as attempt on attempt.id = payment.checkout_attempt_id
    where payment.id = '70000000-0000-4000-8000-000000000029'
      and payment.status = 'paid'
      and payment.request_state = 'paid'
      and not payment.reconciliation_required
      and product_order.payment_status = 'paid'
      and product_order.order_status = 'paid'
      and not product_order.reconciliation_required
      and attempt.request_state = 'paid'
      and not attempt.reconciliation_required
  ) or (
    select pg_catalog.count(*) from line_pay_private.line_pay_completion_proofs
    where payment_id = '70000000-0000-4000-8000-000000000029'
  ) <> 1 or (
    select pg_catalog.count(*) from public.line_pay_payment_audit_events
    where payment_id = '70000000-0000-4000-8000-000000000029'
      and event_type = 'confirmation_completed'
  ) <> 1 then
    raise exception 'paid_recovery_success_postcondition_failed';
  end if;
end
$$;

create function line_pay_paid_recovery_test.skip_payment_update()
returns trigger language plpgsql as $$ begin return null; end $$;
create trigger paid_recovery_skip_payment
before update on public.payments for each row
when (old.id = '70000000-0000-4000-8000-000000000028')
execute function line_pay_paid_recovery_test.skip_payment_update();

set session authorization authenticator;
set role line_pay_payment_executor;
do $$
begin
  begin
    perform public.recover_product_order_line_pay_confirmation(
      'sandbox',
      '70000000-0000-4000-8000-000000000028',
      '50000000-0000-4000-8000-000000000028',
      '60000000-0000-4000-8000-000000000028',
      'LP-PAID-RECOVERY-28', 'paid-recovery-transaction-28', 300, 'TWD',
      '90000000-0000-4000-8000-000000000028',
      '91000000-0000-4000-8000-000000000028',
      repeat('e', 64), 'paid-recovery-payment-zero-rows-28'
    );
    raise exception 'paid_recovery_payment_zero_rows_was_accepted';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'line_pay_paid_recovery_payment_zero_rows' then
      raise;
    end if;
  end;
end
$$;
reset role;
reset session authorization;
drop trigger paid_recovery_skip_payment on public.payments;

create function line_pay_paid_recovery_test.skip_order_update()
returns trigger language plpgsql as $$ begin return null; end $$;
create trigger paid_recovery_skip_order
before update on public.product_orders for each row
when (old.id = '50000000-0000-4000-8000-000000000027')
execute function line_pay_paid_recovery_test.skip_order_update();

set session authorization authenticator;
set role line_pay_payment_executor;
do $$
begin
  begin
    perform public.recover_product_order_line_pay_confirmation(
      'sandbox',
      '70000000-0000-4000-8000-000000000027',
      '50000000-0000-4000-8000-000000000027',
      '60000000-0000-4000-8000-000000000027',
      'LP-PAID-RECOVERY-27', 'paid-recovery-transaction-27', 300, 'TWD',
      '90000000-0000-4000-8000-000000000027',
      '91000000-0000-4000-8000-000000000027',
      repeat('f', 64), 'paid-recovery-order-zero-rows-27'
    );
    raise exception 'paid_recovery_order_zero_rows_was_accepted';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'line_pay_paid_recovery_order_zero_rows' then
      raise;
    end if;
  end;
end
$$;
reset role;
reset session authorization;
drop trigger paid_recovery_skip_order on public.product_orders;

create function line_pay_paid_recovery_test.reject_audit_insert()
returns trigger language plpgsql as $$
begin
  if new.payment_id = '70000000-0000-4000-8000-000000000026' then
    raise exception using errcode = 'P0001', message = 'paid_recovery_audit_fixture_failure';
  end if;
  return new;
end $$;
create trigger paid_recovery_reject_audit
before insert on public.line_pay_payment_audit_events for each row
execute function line_pay_paid_recovery_test.reject_audit_insert();

set session authorization authenticator;
set role line_pay_payment_executor;
do $$
begin
  begin
    perform public.recover_product_order_line_pay_confirmation(
      'sandbox',
      '70000000-0000-4000-8000-000000000026',
      '50000000-0000-4000-8000-000000000026',
      '60000000-0000-4000-8000-000000000026',
      'LP-PAID-RECOVERY-26', 'paid-recovery-transaction-26', 300, 'TWD',
      '90000000-0000-4000-8000-000000000026',
      '91000000-0000-4000-8000-000000000026',
      repeat('a', 64), 'paid-recovery-audit-failure-26'
    );
    raise exception 'paid_recovery_audit_failure_was_accepted';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'paid_recovery_audit_fixture_failure' then
      raise;
    end if;
  end;
end
$$;
reset role;
reset session authorization;
drop trigger paid_recovery_reject_audit on public.line_pay_payment_audit_events;

do $$
declare
  v_suffix integer;
begin
  foreach v_suffix in array array[28, 27, 26]
  loop
    if not exists (
      select 1
      from public.payments as payment
      join public.product_orders as product_order on product_order.id = payment.product_order_id
      join public.line_pay_checkout_attempts as attempt on attempt.id = payment.checkout_attempt_id
      where payment.id = ('70000000-0000-4000-8000-' || pg_catalog.lpad(v_suffix::text, 12, '0'))::uuid
        and payment.status = 'pending'
        and payment.request_state = 'reconciliation_required'
        and payment.reconciliation_required
        and product_order.payment_status = 'pending'
        and product_order.order_status = 'payment_pending'
        and product_order.payment_request_state = 'reconciliation_required'
        and product_order.reconciliation_required
        and attempt.request_state = 'reconciliation_required'
        and attempt.reconciliation_required
    ) or exists (
      select 1 from line_pay_private.line_pay_completion_proofs
      where payment_id = ('70000000-0000-4000-8000-' || pg_catalog.lpad(v_suffix::text, 12, '0'))::uuid
    ) then
      raise exception 'paid_recovery_rollback_postcondition_failed_%', v_suffix;
    end if;
  end loop;
end
$$;

-- The runner keeps this helper for its two-session concurrency check.
