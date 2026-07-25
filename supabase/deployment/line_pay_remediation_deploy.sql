\set ON_ERROR_STOP on
\set QUIET on
\pset format unaligned
\pset tuples_only on

begin;
set local lock_timeout = '15s';
set local statement_timeout = '120s';
set local idle_in_transaction_session_timeout = '30s';

lock table public.product_orders, public.payments in access exclusive mode;

\set line_pay_locked_guard 1
\ir line_pay_remediation_preflight.sql
\unset line_pay_locked_guard

\if :line_pay_locked_guard_ready
\else
  \echo :line_pay_locked_guard_status
  \quit 3
\endif

select coalesce(
  pg_catalog.jsonb_object_agg(
    row_value.id::text,
    pg_catalog.encode(
      pg_catalog.sha256(pg_catalog.convert_to(
        pg_catalog.jsonb_build_object(
          'id', row_value.id,
          'user_id', row_value.user_id,
          'booking_id', row_value.booking_id,
          'provider', row_value.provider,
          'provider_payment_id', row_value.provider_payment_id,
          'item_type', row_value.item_type,
          'item_name', row_value.item_name,
          'amount_twd', row_value.amount_twd,
          'currency', row_value.currency,
          'status', row_value.status,
          'paid_at', row_value.paid_at,
          'refunded_at', row_value.refunded_at,
          'raw_payload', row_value.raw_payload,
          'created_at', row_value.created_at,
          'item_id', row_value.item_id,
          'merchant_order_no', row_value.merchant_order_no,
          'provider_trade_no', row_value.provider_trade_no,
          'notify_received_at', row_value.notify_received_at,
          'failure_reason', row_value.failure_reason
        )::text,
        'UTF8'
      )),
      'hex'
    )
    order by row_value.id
  ),
  '{}'::jsonb
)::text as baseline_payments_manifest
from public.payments as row_value
\gset

select pg_catalog.count(*)::integer as baseline_payments_row_count
from public.payments
\gset

select coalesce(
  pg_catalog.jsonb_object_agg(
    row_value.id::text,
    pg_catalog.encode(
      pg_catalog.sha256(pg_catalog.convert_to(
        pg_catalog.jsonb_build_object(
          'id', row_value.id,
          'order_no', row_value.order_no,
          'user_id', row_value.user_id,
          'customer_name', row_value.customer_name,
          'customer_email', row_value.customer_email,
          'customer_phone', row_value.customer_phone,
          'total_amount_twd', row_value.total_amount_twd,
          'payment_method', row_value.payment_method,
          'payment_status', row_value.payment_status,
          'order_status', row_value.order_status,
          'shipping_status', row_value.shipping_status,
          'payment_id', row_value.payment_id,
          'bank_transfer_submission_id',
            row_value.bank_transfer_submission_id,
          'note', row_value.note,
          'created_at', row_value.created_at,
          'updated_at', row_value.updated_at
        )::text,
        'UTF8'
      )),
      'hex'
    )
    order by row_value.id
  ),
  '{}'::jsonb
)::text as baseline_product_orders_manifest
from public.product_orders as row_value
\gset

select pg_catalog.count(*)::integer as baseline_product_orders_row_count
from public.product_orders
\gset

\ir ../migrations/20260719033404_line_pay_remediation_contracts.sql

-- The exact Migration owns its transaction and commits before returning to
-- psql. Reacquire both table locks before postflight so any write racing that
-- commit is either included in the manifest comparison or blocked until the
-- postflight transaction completes.
begin;
set local lock_timeout = '15s';
set local statement_timeout = '120s';
set local idle_in_transaction_session_timeout = '30s';

lock table public.product_orders, public.payments in access exclusive mode;

\set line_pay_baseline_manifest 1
\ir line_pay_remediation_postflight.sql
\unset line_pay_baseline_manifest

commit;
