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
        (to_jsonb(row_value) - 'updated_at')::text,
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

select coalesce(
  pg_catalog.jsonb_object_agg(
    row_value.id::text,
    pg_catalog.encode(
      pg_catalog.sha256(pg_catalog.convert_to(
        to_jsonb(row_value)::text,
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

\ir ../migrations/20260719033404_line_pay_remediation_contracts.sql

\set line_pay_baseline_manifest 1
\ir line_pay_remediation_postflight.sql
\unset line_pay_baseline_manifest
