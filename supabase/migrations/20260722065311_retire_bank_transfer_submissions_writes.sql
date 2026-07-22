begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $$
declare
  v_relation_oid oid;
  v_relation_kind "char";
begin
  v_relation_oid := pg_catalog.to_regclass('public.bank_transfer_submissions');

  if v_relation_oid is null then
    raise exception using
      errcode = 'P0001',
      message = 'bank_transfer_submissions_readonly_fence:relation_missing';
  end if;

  select relation.relkind
  into v_relation_kind
  from pg_catalog.pg_class as relation
  where relation.oid = v_relation_oid;

  if v_relation_kind is distinct from 'r' then
    raise exception using
      errcode = 'P0001',
      message = 'bank_transfer_submissions_readonly_fence:unexpected_relation_kind';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_attribute as attribute
    where attribute.attrelid = v_relation_oid
      and attribute.attname = 'user_id'
      and not attribute.attisdropped
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'bank_transfer_submissions_readonly_fence:user_id_missing';
  end if;
end
$$;

alter table public.bank_transfer_submissions enable row level security;

-- Remove every table-level capability from runtime roles first. RLS and grants
-- are separate controls, so both layers are tightened explicitly.
revoke all privileges on table public.bank_transfer_submissions
from public, anon, authenticated, service_role;

drop policy if exists "Users can insert own bank transfer submissions"
on public.bank_transfer_submissions;

drop policy if exists "Users can read own bank transfer submissions"
on public.bank_transfer_submissions;

create policy "Users can read own bank transfer submissions"
on public.bank_transfer_submissions
for select
to authenticated
using ((select auth.uid()) = user_id);

grant select on table public.bank_transfer_submissions
to authenticated, service_role;

comment on table public.bank_transfer_submissions is
  'Legacy bank transfer history. New writes are retired.';

do $$
declare
  v_expected boolean;
  v_policy_count integer;
  v_privilege text;
  v_role name;
begin
  foreach v_role in array array['anon', 'authenticated', 'service_role']::name[] loop
    foreach v_privilege in array array[
      'SELECT',
      'INSERT',
      'UPDATE',
      'DELETE',
      'TRUNCATE',
      'REFERENCES',
      'TRIGGER'
    ] loop
      v_expected := v_privilege = 'SELECT'
        and v_role in ('authenticated', 'service_role');

      if pg_catalog.has_table_privilege(
        v_role,
        'public.bank_transfer_submissions',
        v_privilege
      ) is distinct from v_expected then
        raise exception using
          errcode = 'P0001',
          message = pg_catalog.format(
            'bank_transfer_submissions_readonly_fence:privilege_mismatch:%s:%s',
            v_role,
            v_privilege
          );
      end if;
    end loop;
  end loop;

  select pg_catalog.count(*)
  into v_policy_count
  from pg_catalog.pg_policies
  where schemaname = 'public'
    and tablename = 'bank_transfer_submissions';

  if v_policy_count <> 1 then
    raise exception using
      errcode = 'P0001',
      message = 'bank_transfer_submissions_readonly_fence:unexpected_policy_count';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'bank_transfer_submissions'
      and policyname = 'Users can read own bank transfer submissions'
      and cmd = 'SELECT'
      and roles = array['authenticated']::name[]
      and with_check is null
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'bank_transfer_submissions_readonly_fence:select_policy_mismatch';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = 'bank_transfer_submissions'
      and relation.relrowsecurity
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'bank_transfer_submissions_readonly_fence:rls_disabled';
  end if;
end
$$;

commit;
