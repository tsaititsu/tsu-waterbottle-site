-- Draft migration: prepare official LINE Pay provider support.
-- Not yet executed in production.
-- Execute only after a read-only metadata check confirms current constraints.
--
-- LINE Pay official payments must use provider = 'line_pay'.
-- Do not use NewebPay MPG LINEPAY=1 for this flow.
--
-- Current known state:
-- - public.payments.provider is text in the repository schema.
-- - First version can reuse public.payments without a provider schema change.
-- - product_orders.payment_method currently allows bank_transfer / newebpay only.
--
-- Important rollout guardrails:
-- - Run metadata checks before executing this migration.
-- - Do not allow product order create API to accept paymentMethod = 'line_pay'
--   until this migration has been executed and verified.
-- - Do not enable product LINE Pay frontend entry before the API and paid sync
--   are implemented and feature-flagged.

-- If production ever has a payments provider check constraint, review the
-- actual constraint definition first. A future migration can adapt it like this:
--
-- alter table public.payments
-- drop constraint if exists payments_provider_check;
--
-- alter table public.payments
-- add constraint payments_provider_check
-- check (provider in ('manual', 'newebpay', 'line_pay'));

alter table public.product_orders
drop constraint if exists product_orders_payment_method_check;

alter table public.product_orders
add constraint product_orders_payment_method_check
check (payment_method in ('bank_transfer', 'newebpay', 'line_pay'));

-- This migration intentionally does not change:
-- - product_orders.payment_status
-- - product_orders.order_status
-- - product_orders.shipping_status
-- - NewebPay payment fields or MPG parameters
