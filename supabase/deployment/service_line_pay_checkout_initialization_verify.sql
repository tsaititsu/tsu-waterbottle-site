\set ON_ERROR_STOP on
\set QUIET on
\pset format unaligned
\pset tuples_only on

BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY;

\ir service_line_pay_checkout_initialization_postflight.sql

ROLLBACK;
