# Supabase migrations

Formal database migrations should be placed here going forward.

If the project later adopts the Supabase CLI timestamped migration workflow, start from this directory and keep migration history append-only.

Existing SQL files in the root `supabase` directory are intentionally not moved in this package because some have already been manually executed in production.

## LINE Pay remediation contracts

`20260719033404_line_pay_remediation_contracts.sql` is an append-only, non-reentrant migration. It assumes the existing `payments` and `product_orders` tables are present and intentionally fails closed when those prerequisites or legacy constraints do not match the reviewed baseline.

Do not apply it directly to any remote database. Before a future Sandbox-only apply, the approved migration pipeline must perform a read-only schema drift check, duplicate-key preflight, lock/row-count assessment, and disposable PostgreSQL clean/upgrade test. Production LINE Pay remains disabled. Rollback is feature-off plus a reviewed forward-fix migration; payment, order, outbox, capability, and audit history must not be dropped.
