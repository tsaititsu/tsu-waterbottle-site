create role anon noinherit;
create role authenticated noinherit;
create role service_role noinherit;

create extension pgcrypto with schema public;

create table public.ai_chart_reports (
  id uuid primary key,
  user_id uuid,
  payment_status text not null,
  status text not null,
  report_content text,
  chart_snapshot jsonb,
  completed_at timestamptz,
  updated_at timestamptz not null default clock_timestamp(),
  error_message text
);
