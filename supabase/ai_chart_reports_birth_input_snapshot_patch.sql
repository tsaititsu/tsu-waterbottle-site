-- 草稿 migration：保存 AI 命盤 canonical 出生輸入 snapshot
-- 尚未在 production 執行

alter table public.ai_chart_reports
add column if not exists birth_input_snapshot jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ai_chart_reports_birth_input_snapshot_object_check'
      and conrelid = 'public.ai_chart_reports'::regclass
  ) then
    alter table public.ai_chart_reports
    add constraint ai_chart_reports_birth_input_snapshot_object_check
    check (
      birth_input_snapshot is null
      or jsonb_typeof(birth_input_snapshot) = 'object'
    );
  end if;
end $$;

create or replace function public.prevent_ai_chart_report_birth_input_snapshot_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.birth_input_snapshot is not null
    and new.birth_input_snapshot is distinct from old.birth_input_snapshot then
    raise exception 'ai_chart_report_birth_input_snapshot_immutable';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_ai_chart_report_birth_input_snapshot_change
on public.ai_chart_reports;

create trigger prevent_ai_chart_report_birth_input_snapshot_change
before update of birth_input_snapshot on public.ai_chart_reports
for each row
execute function public.prevent_ai_chart_report_birth_input_snapshot_change();
