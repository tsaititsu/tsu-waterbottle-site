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
  public.payments,
  public.line_pay_checkout_attempts,
  public.line_pay_request_outbox,
  public.line_pay_callback_capabilities,
  public.line_pay_callback_events,
  public.line_pay_payment_audit_events,
  line_pay_private.line_pay_completion_proofs
in access exclusive mode;

\ir line_pay_atomic_confirmation_finalization_preflight.sql

select pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
  pg_catalog.jsonb_build_object(
    'product_orders', (
      select pg_catalog.jsonb_build_object(
        'count', pg_catalog.count(*),
        'digest', pg_catalog.md5(coalesce(pg_catalog.string_agg(
          pg_catalog.md5(pg_catalog.to_jsonb(row_value)::text),
          '' order by row_value.id::text
        ), ''))
      ) from public.product_orders as row_value
    ),
    'payments', (
      select pg_catalog.jsonb_build_object(
        'count', pg_catalog.count(*),
        'digest', pg_catalog.md5(coalesce(pg_catalog.string_agg(
          pg_catalog.md5(pg_catalog.to_jsonb(row_value)::text),
          '' order by row_value.id::text
        ), ''))
      ) from public.payments as row_value
    ),
    'attempts', (
      select pg_catalog.jsonb_build_object(
        'count', pg_catalog.count(*),
        'digest', pg_catalog.md5(coalesce(pg_catalog.string_agg(
          pg_catalog.md5(pg_catalog.to_jsonb(row_value)::text),
          '' order by row_value.id::text
        ), ''))
      ) from public.line_pay_checkout_attempts as row_value
    ),
    'outbox', (
      select pg_catalog.jsonb_build_object(
        'count', pg_catalog.count(*),
        'digest', pg_catalog.md5(coalesce(pg_catalog.string_agg(
          pg_catalog.md5(pg_catalog.to_jsonb(row_value)::text),
          '' order by row_value.id::text
        ), ''))
      ) from public.line_pay_request_outbox as row_value
    ),
    'capabilities', (
      select pg_catalog.jsonb_build_object(
        'count', pg_catalog.count(*),
        'digest', pg_catalog.md5(coalesce(pg_catalog.string_agg(
          pg_catalog.md5(pg_catalog.to_jsonb(row_value)::text),
          '' order by row_value.id::text
        ), ''))
      ) from public.line_pay_callback_capabilities as row_value
    ),
    'callback_events', (
      select pg_catalog.jsonb_build_object(
        'count', pg_catalog.count(*),
        'digest', pg_catalog.md5(coalesce(pg_catalog.string_agg(
          pg_catalog.md5(pg_catalog.to_jsonb(row_value)::text),
          '' order by row_value.id::text
        ), ''))
      ) from public.line_pay_callback_events as row_value
    ),
    'audit_events', (
      select pg_catalog.jsonb_build_object(
        'count', pg_catalog.count(*),
        'digest', pg_catalog.md5(coalesce(pg_catalog.string_agg(
          pg_catalog.md5(pg_catalog.to_jsonb(row_value)::text),
          '' order by row_value.id::text
        ), ''))
      ) from public.line_pay_payment_audit_events as row_value
    ),
    'completion_proofs', (
      select pg_catalog.jsonb_build_object(
        'count', pg_catalog.count(*),
        'digest', pg_catalog.md5(coalesce(pg_catalog.string_agg(
          pg_catalog.md5(pg_catalog.to_jsonb(row_value)::text),
          '' order by row_value.id::text
        ), ''))
      ) from line_pay_private.line_pay_completion_proofs as row_value
    )
  )::text,
  'UTF8'
)), 'hex') as baseline_atomic_data_fingerprint
\gset

\echo LINE_PAY_DEPLOY_MIGRATION_STARTED
\ir ../migrations/20260802160000_line_pay_atomic_confirmation_finalization.sql
\echo LINE_PAY_DEPLOY_MIGRATION_COMMITTED

\echo LINE_PAY_DEPLOY_POSTFLIGHT_STARTED
begin;
set local lock_timeout = '15s';
set local statement_timeout = '120s';
set local idle_in_transaction_session_timeout = '30s';

lock table
  public.product_orders,
  public.payments,
  public.line_pay_checkout_attempts,
  public.line_pay_request_outbox,
  public.line_pay_callback_capabilities,
  public.line_pay_callback_events,
  public.line_pay_payment_audit_events,
  line_pay_private.line_pay_completion_proofs
in access exclusive mode;

select pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
  pg_catalog.jsonb_build_object(
    'product_orders', (
      select pg_catalog.jsonb_build_object('count', pg_catalog.count(*), 'digest',
        pg_catalog.md5(coalesce(pg_catalog.string_agg(pg_catalog.md5(pg_catalog.to_jsonb(row_value)::text), '' order by row_value.id::text), '')))
      from public.product_orders as row_value
    ),
    'payments', (
      select pg_catalog.jsonb_build_object('count', pg_catalog.count(*), 'digest',
        pg_catalog.md5(coalesce(pg_catalog.string_agg(pg_catalog.md5(pg_catalog.to_jsonb(row_value)::text), '' order by row_value.id::text), '')))
      from public.payments as row_value
    ),
    'attempts', (
      select pg_catalog.jsonb_build_object('count', pg_catalog.count(*), 'digest',
        pg_catalog.md5(coalesce(pg_catalog.string_agg(pg_catalog.md5(pg_catalog.to_jsonb(row_value)::text), '' order by row_value.id::text), '')))
      from public.line_pay_checkout_attempts as row_value
    ),
    'outbox', (
      select pg_catalog.jsonb_build_object('count', pg_catalog.count(*), 'digest',
        pg_catalog.md5(coalesce(pg_catalog.string_agg(pg_catalog.md5(pg_catalog.to_jsonb(row_value)::text), '' order by row_value.id::text), '')))
      from public.line_pay_request_outbox as row_value
    ),
    'capabilities', (
      select pg_catalog.jsonb_build_object('count', pg_catalog.count(*), 'digest',
        pg_catalog.md5(coalesce(pg_catalog.string_agg(pg_catalog.md5(pg_catalog.to_jsonb(row_value)::text), '' order by row_value.id::text), '')))
      from public.line_pay_callback_capabilities as row_value
    ),
    'callback_events', (
      select pg_catalog.jsonb_build_object('count', pg_catalog.count(*), 'digest',
        pg_catalog.md5(coalesce(pg_catalog.string_agg(pg_catalog.md5(pg_catalog.to_jsonb(row_value)::text), '' order by row_value.id::text), '')))
      from public.line_pay_callback_events as row_value
    ),
    'audit_events', (
      select pg_catalog.jsonb_build_object('count', pg_catalog.count(*), 'digest',
        pg_catalog.md5(coalesce(pg_catalog.string_agg(pg_catalog.md5(pg_catalog.to_jsonb(row_value)::text), '' order by row_value.id::text), '')))
      from public.line_pay_payment_audit_events as row_value
    ),
    'completion_proofs', (
      select pg_catalog.jsonb_build_object('count', pg_catalog.count(*), 'digest',
        pg_catalog.md5(coalesce(pg_catalog.string_agg(pg_catalog.md5(pg_catalog.to_jsonb(row_value)::text), '' order by row_value.id::text), '')))
      from line_pay_private.line_pay_completion_proofs as row_value
    )
  )::text,
  'UTF8'
)), 'hex') = :'baseline_atomic_data_fingerprint'
as line_pay_atomic_data_preserved
\gset

\if :line_pay_atomic_data_preserved
\else
  \echo ATOMIC_FINALIZATION_DATA_PRESERVATION_FAILED
  \quit 3
\endif

\ir line_pay_atomic_confirmation_finalization_postflight.sql
\echo LINE_PAY_DEPLOY_POSTFLIGHT_STATE_EMITTED

commit;
\echo LINE_PAY_DEPLOY_POSTFLIGHT_COMMITTED
