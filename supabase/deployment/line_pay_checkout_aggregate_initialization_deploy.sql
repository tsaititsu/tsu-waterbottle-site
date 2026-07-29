\set ON_ERROR_STOP on
\set QUIET on
\pset format unaligned
\pset tuples_only on

begin;
set local lock_timeout = '15s';
set local statement_timeout = '120s';
set local idle_in_transaction_session_timeout = '30s';

lock table
  public.product_orders,
  public.product_order_items,
  public.product_shipping_info,
  public.payments,
  public.line_pay_checkout_attempts,
  public.line_pay_request_outbox,
  public.line_pay_callback_capabilities,
  public.line_pay_payment_audit_events
in access exclusive mode;

\ir line_pay_checkout_aggregate_initialization_preflight.sql

select pg_catalog.count(*)::integer as baseline_product_orders_count
from public.product_orders
\gset
select pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
  coalesce(pg_catalog.string_agg(
    pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
      pg_catalog.to_jsonb(row_value)::text,
      'UTF8'
    )), 'hex'),
    '' order by row_value.id::text
  ), ''),
  'UTF8'
)), 'hex') as baseline_product_orders_digest
from public.product_orders as row_value
\gset
select pg_catalog.count(*)::integer as baseline_product_order_items_count
from public.product_order_items
\gset
select pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
  coalesce(pg_catalog.string_agg(
    pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
      pg_catalog.to_jsonb(row_value)::text,
      'UTF8'
    )), 'hex'),
    '' order by row_value.id::text
  ), ''),
  'UTF8'
)), 'hex') as baseline_product_order_items_digest
from public.product_order_items as row_value
\gset
select pg_catalog.count(*)::integer as baseline_product_shipping_info_count
from public.product_shipping_info
\gset
select pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
  coalesce(pg_catalog.string_agg(
    pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
      pg_catalog.to_jsonb(row_value)::text,
      'UTF8'
    )), 'hex'),
    '' order by row_value.id::text
  ), ''),
  'UTF8'
)), 'hex') as baseline_product_shipping_info_digest
from public.product_shipping_info as row_value
\gset
select pg_catalog.count(*)::integer as baseline_payments_count
from public.payments
\gset
select pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
  coalesce(pg_catalog.string_agg(
    pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
      pg_catalog.to_jsonb(row_value)::text,
      'UTF8'
    )), 'hex'),
    '' order by row_value.id::text
  ), ''),
  'UTF8'
)), 'hex') as baseline_payments_digest
from public.payments as row_value
\gset
select pg_catalog.count(*)::integer as baseline_audit_count
from public.line_pay_payment_audit_events
\gset
select pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
  coalesce(pg_catalog.string_agg(
    pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
      pg_catalog.to_jsonb(row_value)::text,
      'UTF8'
    )), 'hex'),
    '' order by row_value.id::text
  ), ''),
  'UTF8'
)), 'hex') as baseline_audit_digest
from public.line_pay_payment_audit_events as row_value
\gset

\echo LINE_PAY_DEPLOY_MIGRATION_STARTED
\ir ../migrations/20260728053215_line_pay_checkout_aggregate_initialization.sql
\echo LINE_PAY_DEPLOY_MIGRATION_COMMITTED

\echo LINE_PAY_DEPLOY_POSTFLIGHT_STARTED
begin;
set local lock_timeout = '15s';
set local statement_timeout = '120s';
set local idle_in_transaction_session_timeout = '30s';

lock table
  public.product_orders,
  public.product_order_items,
  public.product_shipping_info,
  public.payments,
  public.line_pay_checkout_attempts,
  public.line_pay_request_outbox,
  public.line_pay_callback_capabilities,
  public.line_pay_payment_audit_events
in access exclusive mode;

with current_state as (
  select
    (select pg_catalog.count(*) from public.product_orders)
      = :baseline_product_orders_count::bigint
    and (select pg_catalog.count(*) from public.product_order_items)
      = :baseline_product_order_items_count::bigint
    and (select pg_catalog.count(*) from public.product_shipping_info)
      = :baseline_product_shipping_info_count::bigint
    and (select pg_catalog.count(*) from public.payments)
      = :baseline_payments_count::bigint
    and (select pg_catalog.count(*) from public.line_pay_payment_audit_events)
      = :baseline_audit_count::bigint
    and (
      select pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
        coalesce(pg_catalog.string_agg(
          pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
            pg_catalog.to_jsonb(row_value)::text,
            'UTF8'
          )), 'hex'),
          '' order by row_value.id::text
        ), ''),
        'UTF8'
      )), 'hex')
      from public.product_orders as row_value
    ) = :'baseline_product_orders_digest'
    and (
      select pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
        coalesce(pg_catalog.string_agg(
          pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
            pg_catalog.to_jsonb(row_value)::text,
            'UTF8'
          )), 'hex'),
          '' order by row_value.id::text
        ), ''),
        'UTF8'
      )), 'hex')
      from public.product_order_items as row_value
    ) = :'baseline_product_order_items_digest'
    and (
      select pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
        coalesce(pg_catalog.string_agg(
          pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
            pg_catalog.to_jsonb(row_value)::text,
            'UTF8'
          )), 'hex'),
          '' order by row_value.id::text
        ), ''),
        'UTF8'
      )), 'hex')
      from public.product_shipping_info as row_value
    ) = :'baseline_product_shipping_info_digest'
    and (
      select pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
        coalesce(pg_catalog.string_agg(
          pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
            pg_catalog.to_jsonb(row_value)::text,
            'UTF8'
          )), 'hex'),
          '' order by row_value.id::text
        ), ''),
        'UTF8'
      )), 'hex')
      from public.payments as row_value
    ) = :'baseline_payments_digest'
    and (
      select pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
        coalesce(pg_catalog.string_agg(
          pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
            pg_catalog.to_jsonb(row_value)::text,
            'UTF8'
          )), 'hex'),
          '' order by row_value.id::text
        ), ''),
        'UTF8'
      )), 'hex')
      from public.line_pay_payment_audit_events as row_value
    ) = :'baseline_audit_digest'
    as preserved
)
select preserved as line_pay_initializer_data_preserved
from current_state
\gset

\if :line_pay_initializer_data_preserved
\else
  \echo INITIALIZER_DATA_PRESERVATION_FAILED
  \quit 3
\endif

\ir line_pay_checkout_aggregate_initialization_postflight.sql
\echo LINE_PAY_DEPLOY_POSTFLIGHT_STATE_EMITTED

commit;
\echo LINE_PAY_DEPLOY_POSTFLIGHT_COMMITTED
