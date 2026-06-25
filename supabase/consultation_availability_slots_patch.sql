create table if not exists public.consultation_availability_slots (
  id uuid primary key default gen_random_uuid(),
  start_at timestamptz not null,
  end_at timestamptz not null,
  is_available boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint consultation_availability_slots_time_check check (end_at > start_at)
);

create index if not exists consultation_availability_slots_start_at_idx
on public.consultation_availability_slots (start_at);

create index if not exists consultation_availability_slots_is_available_idx
on public.consultation_availability_slots (is_available);

create or replace function public.set_consultation_availability_slots_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_consultation_availability_slots_updated_at
on public.consultation_availability_slots;

create trigger set_consultation_availability_slots_updated_at
before update on public.consultation_availability_slots
for each row
execute function public.set_consultation_availability_slots_updated_at();

alter table public.consultation_availability_slots enable row level security;

drop policy if exists "Anyone can read available consultation slots"
on public.consultation_availability_slots;

create policy "Anyone can read available consultation slots"
on public.consultation_availability_slots
for select
to anon, authenticated
using (is_available = true);

revoke insert, update, delete on public.consultation_availability_slots
from anon, authenticated;

grant select on public.consultation_availability_slots
to anon, authenticated;

grant all on public.consultation_availability_slots
to service_role;
