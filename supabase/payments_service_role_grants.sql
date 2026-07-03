-- Minimal grants required for server-side NewebPay payment persistence.
-- This patch only grants access to the trusted Supabase service_role.
-- Do not grant anon or authenticated access to payments.

grant usage on schema public to service_role;

grant select, insert, update
on table public.payments
to service_role;
