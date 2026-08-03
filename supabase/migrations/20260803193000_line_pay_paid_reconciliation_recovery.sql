begin;

-- Paid-provider recovery is deliberately additive. It repairs the completion
-- proof owner drift and exposes one executor-only RPC that can re-arm an
-- already persisted reconciliation aggregate before calling the existing
-- atomic completion contract. Provider verification remains an application
-- precondition; this migration never calls LINE Pay and never confirms again.

do $$
begin
  if to_regprocedure(
       'public.complete_product_order_line_pay_confirmation(text,uuid,uuid,uuid,text,text,integer,text,uuid,uuid,uuid,text,text,jsonb,timestamp with time zone)'
     ) is null
     or to_regclass('line_pay_private.line_pay_completion_proofs') is null
     or not exists (
       select 1
       from pg_catalog.pg_roles
       where rolname = 'line_pay_payment_function_owner'
     )
     or not exists (
       select 1
       from pg_catalog.pg_roles
       where rolname = 'line_pay_payment_executor'
     ) then
    raise exception using
      errcode = '55000',
      message = 'line_pay_paid_recovery_prerequisite_missing';
  end if;
end
$$;

grant line_pay_payment_function_owner to current_user
  with inherit true, set true;

alter table line_pay_private.line_pay_completion_proofs
  owner to line_pay_payment_function_owner;
alter function line_pay_private.line_pay_enforce_completion_proof()
  owner to line_pay_payment_function_owner;

grant update (claim_id, claimed_at, claim_expires_at, expires_at)
on table public.line_pay_callback_capabilities
to line_pay_payment_function_owner;

grant update (claim_id, claimed_at, claim_expires_at)
on table public.line_pay_callback_events
to line_pay_payment_function_owner;

grant create on schema public to line_pay_payment_function_owner;

create function public.recover_product_order_line_pay_confirmation(
  p_environment text,
  p_payment_id uuid,
  p_product_order_id uuid,
  p_attempt_id uuid,
  p_merchant_order_no text,
  p_transaction_id text,
  p_amount_twd integer,
  p_currency text,
  p_capability_id uuid,
  p_callback_event_id uuid,
  p_confirm_result_sha256 text,
  p_request_id text
)
returns table (
  result_code text,
  payment_id uuid,
  product_order_id uuid,
  transaction_id text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments%rowtype;
  v_order public.product_orders%rowtype;
  v_attempt public.line_pay_checkout_attempts%rowtype;
  v_capability public.line_pay_callback_capabilities%rowtype;
  v_callback public.line_pay_callback_events%rowtype;
  v_claim_id uuid := pg_catalog.gen_random_uuid();
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_claim_expires_at timestamptz;
  v_row_count integer;
begin
  if p_environment <> 'sandbox'
     or p_payment_id is null
     or p_product_order_id is null
     or p_attempt_id is null
     or p_capability_id is null
     or p_callback_event_id is null
     or p_merchant_order_no is null
     or p_merchant_order_no !~ '^[A-Za-z0-9_:-]{1,100}$'
     or p_transaction_id is null
     or p_transaction_id !~ '^[A-Za-z0-9_:-]{1,128}$'
     or p_amount_twd is null
     or p_amount_twd <= 0
     or p_currency <> 'TWD'
     or p_confirm_result_sha256 is null
     or p_confirm_result_sha256 !~ '^[0-9a-f]{64}$'
     or p_request_id is null
     or p_request_id !~ '^[A-Za-z0-9_.:-]{1,128}$' then
    raise exception using
      errcode = '22023',
      message = 'line_pay_paid_recovery_invalid_input';
  end if;

  -- Preserve the canonical lock order used by complete_*.
  select payment.* into strict v_payment
  from public.payments as payment
  where payment.id = p_payment_id
  for update;

  select product_order.* into strict v_order
  from public.product_orders as product_order
  where product_order.id = p_product_order_id
  for update;

  select attempt.* into strict v_attempt
  from public.line_pay_checkout_attempts as attempt
  where attempt.id = p_attempt_id
  for update;

  select capability.* into strict v_capability
  from public.line_pay_callback_capabilities as capability
  where capability.id = p_capability_id
  for update;

  select callback_event.* into strict v_callback
  from public.line_pay_callback_events as callback_event
  where callback_event.id = p_callback_event_id
  for update;

  if v_payment.provider <> 'line_pay'
     or v_payment.environment <> p_environment
     or v_payment.product_order_id <> v_order.id
     or v_payment.checkout_attempt_id <> v_attempt.id
     or v_payment.user_id <> v_order.user_id
     or v_payment.user_id <> v_attempt.user_id
     or v_payment.merchant_order_no <> p_merchant_order_no
     or v_payment.line_pay_transaction_id <> p_transaction_id
     or v_payment.amount_twd <> p_amount_twd
     or v_payment.currency <> p_currency
     or v_order.payment_method <> 'line_pay'
     or v_order.environment <> p_environment
     or v_order.payment_id <> v_payment.id
     or v_order.checkout_attempt_id <> v_attempt.id
     or v_order.total_amount_twd <> p_amount_twd
     or v_order.currency <> p_currency
     or v_attempt.provider <> 'line_pay'
     or v_attempt.environment <> p_environment
     or v_attempt.payment_id <> v_payment.id
     or v_attempt.product_order_id <> v_order.id
     or v_attempt.merchant_order_no <> p_merchant_order_no
     or v_attempt.upstream_transaction_id <> p_transaction_id
     or v_attempt.amount_twd <> p_amount_twd
     or v_attempt.currency <> p_currency
     or v_capability.payment_id <> v_payment.id
     or v_capability.product_order_id <> v_order.id
     or v_capability.checkout_attempt_id <> v_attempt.id
     or v_capability.environment <> p_environment
     or v_capability.purpose <> 'confirm'
     or v_callback.capability_id <> v_capability.id
     or v_callback.payment_id <> v_payment.id
     or v_callback.product_order_id <> v_order.id
     or v_callback.checkout_attempt_id <> v_attempt.id
     or v_callback.environment <> p_environment
     or v_callback.purpose <> 'confirm' then
    raise exception using
      errcode = '23514',
      message = 'line_pay_paid_recovery_contract_mismatch';
  end if;

  if v_payment.status = 'paid' then
    return query
    select completion.result_code,
           completion.payment_id,
           completion.product_order_id,
           completion.transaction_id
    from public.complete_product_order_line_pay_confirmation(
      p_environment,
      p_payment_id,
      p_product_order_id,
      p_attempt_id,
      p_merchant_order_no,
      p_transaction_id,
      p_amount_twd,
      p_currency,
      p_capability_id,
      p_callback_event_id,
      coalesce(v_callback.claim_id, v_claim_id),
      p_confirm_result_sha256,
      p_request_id,
      pg_catalog.jsonb_build_object(
        'result_code', 'verified',
        'evidence_sha256', p_confirm_result_sha256
      ),
      null
    ) as completion;
    return;
  end if;

  if v_payment.status <> 'pending'
     or v_payment.request_state <> 'reconciliation_required'
     or not v_payment.reconciliation_required
     or v_order.payment_status <> 'pending'
     or v_order.order_status <> 'payment_pending'
     or v_order.payment_request_state <> 'reconciliation_required'
     or not v_order.reconciliation_required
     or v_attempt.request_state <> 'reconciliation_required'
     or not v_attempt.reconciliation_required
     or v_callback.state <> 'reconciliation_required'
     or v_capability.consumed_at is not null
     or v_capability.revoked_at is not null then
    raise exception using
      errcode = '55000',
      message = 'line_pay_paid_recovery_invalid_state';
  end if;

  v_claim_expires_at := v_now + interval '5 minutes';

  update public.payments
  set request_state = 'confirmation_processing',
      reconciliation_required = false
  where id = v_payment.id
    and status = 'pending'
    and request_state = 'reconciliation_required'
    and reconciliation_required;
  get diagnostics v_row_count = row_count;
  if v_row_count <> 1 then
    raise exception using errcode = 'P0001', message = 'line_pay_paid_recovery_payment_zero_rows';
  end if;

  update public.product_orders
  set payment_request_state = 'confirmation_processing',
      reconciliation_required = false
  where id = v_order.id
    and payment_status = 'pending'
    and order_status = 'payment_pending'
    and payment_request_state = 'reconciliation_required'
    and reconciliation_required;
  get diagnostics v_row_count = row_count;
  if v_row_count <> 1 then
    raise exception using errcode = 'P0001', message = 'line_pay_paid_recovery_order_zero_rows';
  end if;

  update public.line_pay_checkout_attempts
  set request_state = 'confirmation_processing',
      reconciliation_required = false
  where id = v_attempt.id
    and request_state = 'reconciliation_required'
    and reconciliation_required;
  get diagnostics v_row_count = row_count;
  if v_row_count <> 1 then
    raise exception using errcode = 'P0001', message = 'line_pay_paid_recovery_attempt_zero_rows';
  end if;

  update public.line_pay_callback_capabilities
  set claim_id = v_claim_id,
      claimed_at = v_now,
      claim_expires_at = v_claim_expires_at,
      expires_at = case
        when expires_at > v_claim_expires_at then expires_at
        else v_claim_expires_at
      end
  where id = v_capability.id
    and consumed_at is null
    and revoked_at is null;
  get diagnostics v_row_count = row_count;
  if v_row_count <> 1 then
    raise exception using errcode = 'P0001', message = 'line_pay_paid_recovery_capability_zero_rows';
  end if;

  update public.line_pay_callback_events
  set state = 'provider_verified',
      claim_id = v_claim_id,
      claimed_at = v_now,
      claim_expires_at = v_claim_expires_at,
      provider_result_sha256 = p_confirm_result_sha256,
      safe_result_code = '0000',
      last_error_code = null
  where id = v_callback.id
    and state = 'reconciliation_required';
  get diagnostics v_row_count = row_count;
  if v_row_count <> 1 then
    raise exception using errcode = 'P0001', message = 'line_pay_paid_recovery_callback_zero_rows';
  end if;

  insert into public.line_pay_payment_audit_events (
    payment_id,
    product_order_id,
    checkout_attempt_id,
    environment,
    event_type,
    from_state,
    to_state,
    request_id,
    evidence
  ) values (
    v_payment.id,
    v_order.id,
    v_attempt.id,
    p_environment,
    'confirmation_evidence_recorded',
    'reconciliation_required',
    'confirmation_processing',
    p_request_id,
    pg_catalog.jsonb_build_object(
      'result_code', 'verified',
      'evidence_sha256', p_confirm_result_sha256
    )
  );

  return query
  select completion.result_code,
         completion.payment_id,
         completion.product_order_id,
         completion.transaction_id
  from public.complete_product_order_line_pay_confirmation(
    p_environment,
    p_payment_id,
    p_product_order_id,
    p_attempt_id,
    p_merchant_order_no,
    p_transaction_id,
    p_amount_twd,
    p_currency,
    p_capability_id,
    p_callback_event_id,
    v_claim_id,
    p_confirm_result_sha256,
    p_request_id,
    pg_catalog.jsonb_build_object(
      'result_code', 'verified',
      'evidence_sha256', p_confirm_result_sha256
    ),
    null
  ) as completion;
exception
  when no_data_found then
    raise exception using
      errcode = 'P0002',
      message = 'line_pay_paid_recovery_context_not_found';
end;
$$;

alter function public.recover_product_order_line_pay_confirmation(
  text, uuid, uuid, uuid, text, text, integer, text, uuid, uuid, text, text
) owner to line_pay_payment_function_owner;

revoke create on schema public from line_pay_payment_function_owner;

revoke execute on function public.recover_product_order_line_pay_confirmation(
  text, uuid, uuid, uuid, text, text, integer, text, uuid, uuid, text, text
) from public, anon, authenticated, service_role, line_pay_payment_executor;

grant execute on function public.recover_product_order_line_pay_confirmation(
  text, uuid, uuid, uuid, text, text, integer, text, uuid, uuid, text, text
) to line_pay_payment_executor;

revoke line_pay_payment_function_owner from current_user
  granted by current_user;

do $$
declare
  v_proof_owner text;
  v_trigger_owner text;
begin
  select owner_role.rolname
  into v_proof_owner
  from pg_catalog.pg_class as relation
  join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
  join pg_catalog.pg_roles as owner_role on owner_role.oid = relation.relowner
  where namespace.nspname = 'line_pay_private'
    and relation.relname = 'line_pay_completion_proofs';

  select owner_role.rolname
  into v_trigger_owner
  from pg_catalog.pg_proc as procedure
  join pg_catalog.pg_namespace as namespace on namespace.oid = procedure.pronamespace
  join pg_catalog.pg_roles as owner_role on owner_role.oid = procedure.proowner
  where namespace.nspname = 'line_pay_private'
    and procedure.proname = 'line_pay_enforce_completion_proof'
    and pg_catalog.pg_get_function_identity_arguments(procedure.oid) = '';

  if v_proof_owner <> 'line_pay_payment_function_owner'
     or v_trigger_owner <> 'line_pay_payment_function_owner'
     or not pg_catalog.has_function_privilege(
       'line_pay_payment_executor',
       'public.recover_product_order_line_pay_confirmation(text,uuid,uuid,uuid,text,text,integer,text,uuid,uuid,text,text)',
       'execute'
     )
     or pg_catalog.has_function_privilege(
       'service_role',
       'public.recover_product_order_line_pay_confirmation(text,uuid,uuid,uuid,text,text,integer,text,uuid,uuid,text,text)',
       'execute'
     ) then
    raise exception using
      errcode = '55000',
      message = 'line_pay_paid_recovery_postcondition_failed';
  end if;
end
$$;

commit;
