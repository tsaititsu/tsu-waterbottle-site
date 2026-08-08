\set ON_ERROR_STOP on
\set QUIET on
\pset format unaligned
\pset tuples_only on

BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY;

\ir line_pay_production_one_dollar_non_fulfillment_postflight.sql

ROLLBACK;
