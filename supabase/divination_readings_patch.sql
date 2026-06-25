-- 紫微牌卡占卜紀錄表
-- 注意：
-- 本檔案目前只作為 migration 草稿保存。
-- LINE Pay / 金流審核期間，不可在 production 執行。
-- 等審核通過並確認 payments schema 後，再手動檢查並執行。

create table if not exists public.divination_readings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null,
  payment_id uuid null references public.payments(id) on delete set null,
  merchant_order_no text null,
  question text not null,
  draw_mode text not null,
  card_id text not null,
  card_name text not null,
  position text not null,
  status text not null default 'pending_payment',
  interpretation jsonb null,
  error_message text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz null,
  interpreted_at timestamptz null,
  constraint divination_readings_draw_mode_check
    check (draw_mode in ('manual', 'auto')),
  constraint divination_readings_position_check
    check (position in ('upright', 'reversed')),
  constraint divination_readings_status_check
    check (
      status in (
        'pending_payment',
        'paid',
        'interpreting',
        'completed',
        'failed',
        'canceled'
      )
    )
);

create unique index if not exists divination_readings_payment_id_unique
on public.divination_readings(payment_id)
where payment_id is not null;

create index if not exists divination_readings_user_id_idx
on public.divination_readings(user_id);

create index if not exists divination_readings_status_idx
on public.divination_readings(status);

create index if not exists divination_readings_merchant_order_no_idx
on public.divination_readings(merchant_order_no);

create index if not exists divination_readings_created_at_idx
on public.divination_readings(created_at desc);

create or replace function public.set_divination_readings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_divination_readings_updated_at
on public.divination_readings;

create trigger set_divination_readings_updated_at
before update on public.divination_readings
for each row
execute function public.set_divination_readings_updated_at();

alter table public.divination_readings enable row level security;

-- 目前預計由 server route 使用 service role / admin client 操作。
-- 前台若未來要直接查詢此表，需另行新增 RLS policies。

comment on table public.divination_readings is
  '紫微牌卡占卜紀錄表，用於 NT$50 單次 AI 深度解讀付款 gate、抽牌資料與解讀結果保存。';

comment on column public.divination_readings.id is
  '占卜紀錄 id，付款與 AI 解讀流程都綁定此 id。';

comment on column public.divination_readings.user_id is
  '會員 id，用於確認占卜紀錄屬於目前登入者。';

comment on column public.divination_readings.payment_id is
  '對應 public.payments.id；同一筆 payment_id 只能綁定一筆占卜紀錄。';

comment on column public.divination_readings.merchant_order_no is
  '藍新 merchant_order_no，方便付款 return / notify 後查找對應占卜。';

comment on column public.divination_readings.question is
  '使用者輸入的占卜問題。';

comment on column public.divination_readings.draw_mode is
  '抽牌方式：manual 表示手動抽牌，auto 表示自動抽牌。';

comment on column public.divination_readings.card_id is
  '紫微牌卡 id，例如 ziwei、tianji。';

comment on column public.divination_readings.card_name is
  '紫微牌卡中文名稱，例如紫微星、天機星。';

comment on column public.divination_readings.position is
  '牌卡正反位：upright 表示正位，reversed 表示反位。';

comment on column public.divination_readings.status is
  '占卜業務狀態：pending_payment、paid、interpreting、completed、failed、canceled。';

comment on column public.divination_readings.interpretation is
  'AI 解讀 structured JSON；completed 後再次查詢應回傳既有結果，不重複呼叫 OpenAI。';

comment on column public.divination_readings.error_message is
  '付款或解讀流程失敗原因，供後台或客服排查。';

comment on column public.divination_readings.created_at is
  '占卜紀錄建立時間。';

comment on column public.divination_readings.updated_at is
  '占卜紀錄最後更新時間，由 trigger 自動更新。';

comment on column public.divination_readings.paid_at is
  '付款完成時間。';

comment on column public.divination_readings.interpreted_at is
  'AI 解讀完成時間。';
