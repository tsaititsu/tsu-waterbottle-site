-- NewebPay course payment columns and indexes
-- Run this in Supabase SQL Editor before enabling NewebPay course payments.

alter table public.payments
add column if not exists item_id text;

alter table public.payments
add column if not exists merchant_order_no text;

alter table public.payments
add column if not exists provider_trade_no text;

alter table public.payments
add column if not exists notify_received_at timestamptz;

alter table public.payments
add column if not exists failure_reason text;

create unique index if not exists payments_merchant_order_no_unique
on public.payments (merchant_order_no)
where merchant_order_no is not null;

create index if not exists payments_user_item_idx
on public.payments (user_id, item_type, item_id);

create index if not exists payments_status_idx
on public.payments (status);

create index if not exists payments_provider_trade_no_idx
on public.payments (provider_trade_no);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'course_purchases_payment_id_fkey'
  ) then
    alter table public.course_purchases
    add constraint course_purchases_payment_id_fkey
    foreign key (payment_id)
    references public.payments(id)
    on delete set null;
  end if;
end $$;
