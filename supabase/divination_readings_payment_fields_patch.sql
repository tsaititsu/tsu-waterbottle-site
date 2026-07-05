-- 草稿 migration：補齊 divination_readings 正式付款欄位
-- 尚未在 production 執行
-- 執行前需先確認正式 DB 既有欄位與型別

alter table public.divination_readings
add column if not exists payment_id uuid;

alter table public.divination_readings
add column if not exists merchant_order_no text;

alter table public.divination_readings
add column if not exists draw_mode text;

alter table public.divination_readings
add column if not exists card_id text;

alter table public.divination_readings
add column if not exists card_name text;

alter table public.divination_readings
add column if not exists position text;

alter table public.divination_readings
add column if not exists status text;

alter table public.divination_readings
add column if not exists interpretation jsonb;

alter table public.divination_readings
add column if not exists error_message text;

alter table public.divination_readings
add column if not exists paid_at timestamptz;

alter table public.divination_readings
add column if not exists interpreted_at timestamptz;

alter table public.divination_readings
add column if not exists updated_at timestamptz;

alter table public.divination_readings
alter column updated_at set default now();

alter table public.divination_readings
alter column status set default 'pending_payment';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.divination_readings'::regclass
      and conname = 'divination_readings_status_check'
  ) then
    alter table public.divination_readings
    add constraint divination_readings_status_check
    check (
      status is null
      or status in (
        'pending_payment',
        'paid',
        'interpreting',
        'completed',
        'failed',
        'canceled'
      )
    ) not valid;
  end if;
end $$;

create index if not exists idx_divination_readings_payment_id
on public.divination_readings(payment_id);

create index if not exists idx_divination_readings_merchant_order_no
on public.divination_readings(merchant_order_no);

create index if not exists idx_divination_readings_status
on public.divination_readings(status);

create index if not exists idx_divination_readings_user_id_created_at
on public.divination_readings(user_id, created_at desc);

grant select, insert, update
on table public.divination_readings
to service_role;
