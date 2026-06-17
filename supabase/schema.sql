-- WATERBOTTLE official site database schema
-- Run this in Supabase SQL Editor after creating the project.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  email text,
  line_user_id text,
  avatar_url text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.consultation_plans (
  id text primary key,
  name text not null,
  description text not null default '',
  duration_minutes integer not null,
  price_twd integer not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.booking_settings (
  id boolean primary key default true,
  timezone text not null default 'Asia/Taipei',
  available_slots text[] not null default array['13:00', '15:00', '17:00'],
  min_booking_hours integer not null default 24,
  self_cancel_cutoff_hours integer not null default 24,
  full_refund_cutoff_hours integer not null default 72,
  official_line_url text not null default 'https://lin.ee/6Tpje1P',
  updated_at timestamptz not null default now(),
  constraint booking_settings_single_row check (id)
);

create table if not exists public.booking_notices (
  id text primary key,
  title text not null,
  content text not null,
  is_required boolean not null default true,
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  plan_id text references public.consultation_plans(id),
  plan_name text not null,
  amount_twd integer not null,
  currency text not null default 'TWD',
  status text not null default 'pending_payment',
  payment_status text not null default 'pending',
  refund_status text not null default 'none',
  customer_name text not null,
  customer_email text not null,
  customer_phone text,
  line_display_name text,
  gender text not null,
  birth_date date not null,
  birth_time time not null,
  birth_place text,
  is_birth_time_accurate boolean not null,
  question text not null,
  note text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  timezone text not null default 'Asia/Taipei',
  google_calendar_event_id text,
  google_calendar_event_link text,
  google_calendar_cancelled boolean not null default false,
  confirmation_email_sent_to_customer boolean not null default false,
  confirmation_email_sent_to_admin boolean not null default false,
  cancellation_email_sent_to_customer boolean not null default false,
  cancellation_email_sent_to_admin boolean not null default false,
  accepted_notice_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  rescheduled_from_booking_id uuid references public.bookings(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  booking_id uuid references public.bookings(id) on delete set null,
  provider text not null default 'manual',
  provider_payment_id text,
  item_type text not null,
  item_name text not null,
  amount_twd integer not null,
  currency text not null default 'TWD',
  status text not null default 'pending',
  paid_at timestamptz,
  refunded_at timestamptz,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chart_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  category text not null default '自己',
  name text,
  gender text not null,
  solar_date date not null,
  birth_time text not null,
  birth_place text,
  ziwei_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_chart_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  chart_profile_id uuid references public.chart_profiles(id) on delete set null,
  title text not null,
  product_name text not null,
  amount_twd integer not null,
  status text not null default 'paid',
  report_content text,
  created_at timestamptz not null default now()
);

create table if not exists public.point_wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.point_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  amount integer not null,
  reason text not null,
  related_reading_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.divination_readings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  external_reading_id text,
  question text,
  result_summary text,
  points_spent integer not null default 0,
  source text not null default 'ziwei-card',
  raw_payload jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

create trigger consultation_plans_touch_updated_at
before update on public.consultation_plans
for each row execute function public.touch_updated_at();

create trigger bookings_touch_updated_at
before update on public.bookings
for each row execute function public.touch_updated_at();

create trigger payments_touch_updated_at
before update on public.payments
for each row execute function public.touch_updated_at();

create trigger chart_profiles_touch_updated_at
before update on public.chart_profiles
for each row execute function public.touch_updated_at();

create index if not exists bookings_user_id_created_at_idx on public.bookings(user_id, created_at desc);
create index if not exists bookings_starts_at_idx on public.bookings(starts_at);
create index if not exists bookings_status_idx on public.bookings(status);
create index if not exists chart_profiles_user_id_idx on public.chart_profiles(user_id, created_at desc);
create index if not exists divination_readings_user_id_idx on public.divination_readings(user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.consultation_plans enable row level security;
alter table public.booking_settings enable row level security;
alter table public.booking_notices enable row level security;
alter table public.bookings enable row level security;
alter table public.payments enable row level security;
alter table public.chart_profiles enable row level security;
alter table public.ai_chart_reports enable row level security;
alter table public.point_wallets enable row level security;
alter table public.point_transactions enable row level security;
alter table public.divination_readings enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and is_admin = true
  );
$$;

create policy "profiles_select_own_or_admin" on public.profiles
for select using (auth.uid() = id or public.is_admin());

create policy "profiles_update_own_or_admin" on public.profiles
for update using (auth.uid() = id or public.is_admin());

create policy "public_read_active_plans" on public.consultation_plans
for select using (is_active = true or public.is_admin());

create policy "admin_manage_plans" on public.consultation_plans
for all using (public.is_admin()) with check (public.is_admin());

create policy "public_read_booking_settings" on public.booking_settings
for select using (true);

create policy "admin_manage_booking_settings" on public.booking_settings
for all using (public.is_admin()) with check (public.is_admin());

create policy "public_read_active_notices" on public.booking_notices
for select using (is_active = true or public.is_admin());

create policy "admin_manage_notices" on public.booking_notices
for all using (public.is_admin()) with check (public.is_admin());

create policy "bookings_select_own_or_admin" on public.bookings
for select using (auth.uid() = user_id or public.is_admin());

create policy "bookings_insert_own" on public.bookings
for insert with check (auth.uid() = user_id);

create policy "bookings_update_own_or_admin" on public.bookings
for update using (auth.uid() = user_id or public.is_admin());

create policy "payments_select_own_or_admin" on public.payments
for select using (auth.uid() = user_id or public.is_admin());

create policy "chart_profiles_select_own_or_admin" on public.chart_profiles
for select using (auth.uid() = user_id or public.is_admin());

create policy "chart_profiles_insert_own" on public.chart_profiles
for insert with check (auth.uid() = user_id);

create policy "chart_profiles_update_own_or_admin" on public.chart_profiles
for update using (auth.uid() = user_id or public.is_admin());

create policy "chart_profiles_delete_own_or_admin" on public.chart_profiles
for delete using (auth.uid() = user_id or public.is_admin());

create policy "ai_chart_reports_select_own_or_admin" on public.ai_chart_reports
for select using (auth.uid() = user_id or public.is_admin());

create policy "point_wallets_select_own_or_admin" on public.point_wallets
for select using (auth.uid() = user_id or public.is_admin());

create policy "point_transactions_select_own_or_admin" on public.point_transactions
for select using (auth.uid() = user_id or public.is_admin());

create policy "divination_readings_select_own_or_admin" on public.divination_readings
for select using (auth.uid() = user_id or public.is_admin());
