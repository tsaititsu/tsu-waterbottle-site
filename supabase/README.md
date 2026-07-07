# Supabase workspace

## Current management principles

- Most production SQL for this project is currently executed manually in the Supabase SQL Editor.
- SQL files that may already have been executed are not moved in this cleanup package, to avoid losing historical context.
- New formal migrations should go in `supabase/migrations`.
- Manual SQL operation notes can go in `supabase/manual-sql`.
- Seed or test data SQL can go in `supabase/seeds`.
- Supabase Edge Functions can go in `supabase/functions`.
- Storage bucket and policy notes can go in `supabase/storage`.
- RLS policy design and audit notes can go in `supabase/policies`.

## Safety rules

- Do not commit Supabase service role keys.
- Do not commit `.env.local`.
- Do not commit real customer data.
- Do not commit payment `TradeInfo` or `TradeSha`.
- Do not commit `HashKey` or `HashIV`.
- Run read-only metadata checks before executing SQL.
- Production SQL execution should be handled in a dedicated package.

## Known status

### Known executed

- `ai_chart_reports_payment_fields_patch.sql`
- `divination_readings_payment_fields_patch.sql`
- `product_orders_schema_draft.sql`

### Possible drafts

- `divination_readings_patch.sql`

### Pending confirmation

- `bank_transfer_submissions_patch.sql`
- `consultation_availability_slots_patch.sql`
- `course_permission_patch.sql`
- `course_schema_patch.sql`
- `newebpay_payments_patch.sql`
- `payments_service_role_grants.sql`
- `profile-sync.sql`
- `schema.sql`
- `seed.sql`
- `spiritual_products_post_office_shipping_patch.sql`
