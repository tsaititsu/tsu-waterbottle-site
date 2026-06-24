create table if not exists public.bank_transfer_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  item_type text not null,
  item_id text,
  item_name text not null,
  amount_twd integer not null,
  payer_name text not null,
  payer_phone text not null,
  payer_email text,
  line_display_name text,
  bank_account_last5 text not null,
  transfer_time timestamptz,
  note text,
  status text not null default 'pending_review',
  admin_note text,
  created_at timestamptz default now(),
  confirmed_at timestamptz
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'bank_transfer_submissions_status_check'
  ) then
    alter table public.bank_transfer_submissions
    add constraint bank_transfer_submissions_status_check
    check (status in ('pending_review', 'confirmed', 'rejected', 'cancelled'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'bank_transfer_submissions_last5_check'
  ) then
    alter table public.bank_transfer_submissions
    add constraint bank_transfer_submissions_last5_check
    check (bank_account_last5 ~ '^[0-9]{5}$');
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'bank_transfer_submissions_amount_check'
  ) then
    alter table public.bank_transfer_submissions
    add constraint bank_transfer_submissions_amount_check
    check (amount_twd > 0);
  end if;
end $$;

create index if not exists bank_transfer_submissions_user_id_idx
on public.bank_transfer_submissions (user_id);

create index if not exists bank_transfer_submissions_status_idx
on public.bank_transfer_submissions (status);

create index if not exists bank_transfer_submissions_created_at_idx
on public.bank_transfer_submissions (created_at desc);

alter table public.bank_transfer_submissions enable row level security;

drop policy if exists "Users can insert own bank transfer submissions" on public.bank_transfer_submissions;
drop policy if exists "Users can read own bank transfer submissions" on public.bank_transfer_submissions;

create policy "Users can insert own bank transfer submissions"
on public.bank_transfer_submissions
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can read own bank transfer submissions"
on public.bank_transfer_submissions
for select
to authenticated
using (auth.uid() = user_id);

revoke update, delete on public.bank_transfer_submissions from anon, authenticated;
grant insert, select on public.bank_transfer_submissions to authenticated;
grant all on public.bank_transfer_submissions to service_role;
