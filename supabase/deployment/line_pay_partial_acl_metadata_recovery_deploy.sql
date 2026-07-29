\set ON_ERROR_STOP on
\set QUIET on
\pset format unaligned
\pset tuples_only on

\echo LINE_PAY_DEPLOY_MIGRATION_STARTED
\ir ../migrations/20260729130000_line_pay_partial_acl_metadata_recovery.sql
\echo LINE_PAY_DEPLOY_MIGRATION_COMMITTED

\echo LINE_PAY_DEPLOY_POSTFLIGHT_STARTED
\ir line_pay_application_state_diagnostic.sql
\echo LINE_PAY_DEPLOY_POSTFLIGHT_STATE_EMITTED
\echo LINE_PAY_DEPLOY_POSTFLIGHT_COMMITTED
