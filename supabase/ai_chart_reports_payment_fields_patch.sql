-- 草稿 migration：補齊 ai_chart_reports 正式付款欄位
-- 尚未在 production 執行
-- 執行前需先確認正式 DB 既有欄位與型別

alter table public.ai_chart_reports
add column if not exists payment_id uuid;

alter table public.ai_chart_reports
add column if not exists merchant_order_no text;

alter table public.ai_chart_reports
add column if not exists payment_status text;

alter table public.ai_chart_reports
add column if not exists paid_at timestamptz;

alter table public.ai_chart_reports
add column if not exists completed_at timestamptz;

alter table public.ai_chart_reports
add column if not exists updated_at timestamptz;

alter table public.ai_chart_reports
add column if not exists error_message text;

alter table public.ai_chart_reports
alter column payment_status set default 'pending';

alter table public.ai_chart_reports
alter column updated_at set default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ai_chart_reports_payment_status_check'
  ) then
    alter table public.ai_chart_reports
    add constraint ai_chart_reports_payment_status_check
    check (
      payment_status is null
      or payment_status in ('pending', 'paid', 'failed', 'canceled', 'refunded')
    );
  end if;
end $$;

create index if not exists idx_ai_chart_reports_payment_id
on public.ai_chart_reports(payment_id);

create index if not exists idx_ai_chart_reports_merchant_order_no
on public.ai_chart_reports(merchant_order_no);

create index if not exists idx_ai_chart_reports_payment_status
on public.ai_chart_reports(payment_status);

create index if not exists idx_ai_chart_reports_user_id_created_at
on public.ai_chart_reports(user_id, created_at desc);

grant select, insert, update
on table public.ai_chart_reports
to service_role;
