\set ON_ERROR_STOP on
\set QUIET on
\pset format unaligned
\pset tuples_only on

begin;
set local lock_timeout = '15s';
set local statement_timeout = '120s';
set local idle_in_transaction_session_timeout = '30s';

lock table public.product_orders in access exclusive mode;

\ir line_pay_production_one_dollar_non_fulfillment_preflight.sql

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

\echo LINE_PAY_DEPLOY_MIGRATION_STARTED
\ir ../migrations/20260808092959_line_pay_production_one_dollar_non_fulfillment.sql
\echo LINE_PAY_DEPLOY_MIGRATION_COMMITTED

\echo LINE_PAY_DEPLOY_POSTFLIGHT_STARTED
begin;
set local lock_timeout = '15s';
set local statement_timeout = '120s';
set local idle_in_transaction_session_timeout = '30s';

lock table public.product_orders in access exclusive mode;

with current_state as (
  select
    (select pg_catalog.count(*) from public.product_orders)
      = :baseline_product_orders_count::bigint
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
    as preserved
)
select preserved as line_pay_production_one_dollar_data_preserved
from current_state
\gset

\if :line_pay_production_one_dollar_data_preserved
\else
  \echo LINE_PAY_PRODUCTION_ONE_DOLLAR_DATA_PRESERVATION_FAILED
  \quit 3
\endif

\ir line_pay_production_one_dollar_non_fulfillment_postflight.sql
\echo LINE_PAY_DEPLOY_POSTFLIGHT_STATE_EMITTED

commit;
\echo LINE_PAY_DEPLOY_POSTFLIGHT_COMMITTED
