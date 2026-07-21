\set ON_ERROR_STOP on

insert into auth.users (id) values
  ('10000000-0000-4000-8000-000000000001');

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
  provider_trade_no,
  paid_at
) values
  (
    '20000000-0000-4000-8000-000000000001',
    null,
    'manual',
    'product_order',
    'legacy bank transfer',
    500,
    'TWD',
    'pending',
    'LEGACY-BANK-1',
    null,
    null
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    'newebpay',
    'product_order',
    'legacy NewebPay pending',
    600,
    'TWD',
    'pending',
    'LEGACY-NEWEB-PENDING-1',
    null,
    null
  ),
  (
    '20000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000001',
    'newebpay',
    'product_order',
    'legacy NewebPay paid',
    700,
    'TWD',
    'paid',
    'LEGACY-NEWEB-PAID-1',
    'NEWEB-TRADE-1',
    '2026-07-01T00:00:00Z'
  ),
  (
    '20000000-0000-4000-8000-000000000004',
    null,
    'manual',
    'product_order',
    'legacy paid bank transfer',
    800,
    'TWD',
    'paid',
    'LEGACY-BANK-PAID-1',
    null,
    '2026-07-02T00:00:00Z'
  );

insert into public.product_orders (
  id,
  order_no,
  user_id,
  total_amount_twd,
  payment_method,
  payment_status,
  order_status,
  shipping_status,
  payment_id
) values
  (
    '30000000-0000-4000-8000-000000000001',
    'LEGACY-BANK-ORDER-1',
    null,
    500,
    'bank_transfer',
    'pending',
    'pending_payment',
    'not_shipped',
    '20000000-0000-4000-8000-000000000001'
  ),
  (
    '30000000-0000-4000-8000-000000000002',
    'LEGACY-NEWEB-PENDING-ORDER-1',
    '10000000-0000-4000-8000-000000000001',
    600,
    'newebpay',
    'pending',
    'pending_payment',
    'not_shipped',
    '20000000-0000-4000-8000-000000000002'
  ),
  (
    '30000000-0000-4000-8000-000000000003',
    'LEGACY-NEWEB-PAID-ORDER-1',
    '10000000-0000-4000-8000-000000000001',
    700,
    'newebpay',
    'paid',
    'paid',
    'not_shipped',
    '20000000-0000-4000-8000-000000000003'
  ),
  (
    '30000000-0000-4000-8000-000000000004',
    'LEGACY-BANK-PAID-ORDER-1',
    null,
    800,
    'bank_transfer',
    'paid',
    'paid',
    'not_shipped',
    '20000000-0000-4000-8000-000000000004'
  );
