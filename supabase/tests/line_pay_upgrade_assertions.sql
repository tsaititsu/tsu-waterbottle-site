\set ON_ERROR_STOP on

do $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from public.product_orders
  where id in (
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000003',
    '30000000-0000-4000-8000-000000000004'
  )
    and environment = 'production'
    and fulfillment_mode = 'physical'
    and currency = 'TWD'
    and not sandbox_test
    and checkout_attempt_id is null;

  if v_count <> 4 then
    raise exception 'upgrade_product_order_backfill_contract_failed';
  end if;

  select count(*) into v_count
  from public.payments
  where id in (
    '20000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000003',
    '20000000-0000-4000-8000-000000000004'
  )
    and environment = 'production'
    and checkout_attempt_id is null
    and request_state is null
    and not reconciliation_required;

  if v_count <> 4 then
    raise exception 'upgrade_payment_backfill_contract_failed';
  end if;

  if not exists (
    select 1 from public.product_orders
    where id = '30000000-0000-4000-8000-000000000001'
      and user_id is null
      and payment_method = 'bank_transfer'
      and payment_status = 'pending'
      and order_status = 'pending_payment'
  ) then
    raise exception 'legacy_nullable_owner_or_bank_transfer_changed';
  end if;

  if not exists (
    select 1 from public.payments
    where id = '20000000-0000-4000-8000-000000000003'
      and provider = 'newebpay'
      and status = 'paid'
      and provider_trade_no = 'NEWEB-TRADE-1'
      and paid_at = '2026-07-01T00:00:00Z'
  ) then
    raise exception 'legacy_newebpay_paid_history_changed';
  end if;

  if not exists (
    select 1
    from public.payments as payment
    join public.product_orders as product_order
      on product_order.payment_id = payment.id
    where payment.id = '20000000-0000-4000-8000-000000000004'
      and payment.provider = 'manual'
      and payment.status = 'paid'
      and payment.paid_at = '2026-07-02T00:00:00Z'
      and product_order.payment_method = 'bank_transfer'
      and product_order.payment_status = 'paid'
      and product_order.order_status = 'paid'
      and product_order.environment = 'production'
      and not product_order.sandbox_test
  ) then
    raise exception 'legacy_bank_transfer_paid_history_changed';
  end if;
end
$$;
