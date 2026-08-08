begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $$
declare
  v_relation_oid oid;
begin
  v_relation_oid := pg_catalog.to_regclass('public.bank_transfer_submissions');

  if v_relation_oid is null then
    raise exception using
      errcode = 'P0001',
      message = 'bank_transfer_submissions_readonly_fence:relation_missing';
  end if;

  perform pg_catalog.set_config(
    'bank_transfer_submissions_readonly_fence.relation_oid',
    v_relation_oid::text,
    true
  );
end
$$;

lock table public.bank_transfer_submissions in access exclusive mode;

do $$
declare
  v_expected_relation_oid oid;
  v_relation_oid oid;
  v_relation_kind "char";
begin
  v_expected_relation_oid := pg_catalog.current_setting(
    'bank_transfer_submissions_readonly_fence.relation_oid',
    true
  )::oid;
  v_relation_oid := pg_catalog.to_regclass('public.bank_transfer_submissions');

  if v_relation_oid is distinct from v_expected_relation_oid then
    raise exception using
      errcode = 'P0001',
      message = 'bank_transfer_submissions_readonly_fence:relation_identity_changed';
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
  v_authenticated_oid oid;
  v_expected boolean;
  v_policy_count integer;
  v_privilege text;
  v_relation_oid oid;
  v_role name;
begin
  v_relation_oid := pg_catalog.current_setting(
    'bank_transfer_submissions_readonly_fence.relation_oid',
    true
  )::oid;

  if pg_catalog.to_regclass('public.bank_transfer_submissions')
    is distinct from v_relation_oid then
    raise exception using
      errcode = 'P0001',
      message = 'bank_transfer_submissions_readonly_fence:relation_identity_changed';
  end if;

  select role.oid
  into v_authenticated_oid
  from pg_catalog.pg_roles as role
  where role.rolname = 'authenticated';

  if v_authenticated_oid is null then
    raise exception using
      errcode = 'P0001',
      message = 'bank_transfer_submissions_readonly_fence:authenticated_role_missing';
  end if;

  foreach v_role in array array['anon', 'authenticated', 'service_role']::name[] loop
    foreach v_privilege in array array[
      'SELECT',
      'INSERT',
      'UPDATE',
      'DELETE',
      'TRUNCATE',
      'REFERENCES',
      'TRIGGER',
      'MAINTAIN'
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

  -- relacl is the authoritative table-level ACL. PUBLIC is represented by
  -- grantee OID 0; the table owner is excluded by its exact OID because owner
  -- capabilities are implicit PostgreSQL capabilities.
  if exists (
    select 1
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    cross join lateral pg_catalog.aclexplode(
      coalesce(
        relation.relacl,
        pg_catalog.acldefault('r', relation.relowner)
      )
    ) as acl
    join pg_catalog.pg_roles as grantee
      on grantee.oid = acl.grantee
    where relation.oid = v_relation_oid
      and namespace.nspname = 'public'
      and relation.relname = 'bank_transfer_submissions'
      and grantee.rolname in ('authenticated', 'service_role')
      and acl.grantor <> relation.relowner
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'bank_transfer_submissions_readonly_fence:unexpected_acl_grantor';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    cross join lateral pg_catalog.aclexplode(
      coalesce(
        relation.relacl,
        pg_catalog.acldefault('r', relation.relowner)
      )
    ) as acl
    left join pg_catalog.pg_roles as grantee
      on grantee.oid = acl.grantee
    where relation.oid = v_relation_oid
      and namespace.nspname = 'public'
      and relation.relname = 'bank_transfer_submissions'
      and (
        acl.grantee = 0
        or grantee.rolname = 'anon'
        or (
          grantee.rolname in ('authenticated', 'service_role')
          and (
            acl.privilege_type <> 'SELECT'
            or acl.is_grantable
          )
        )
        or (
          acl.grantee <> relation.relowner
          and acl.grantee <> 0
          and coalesce(grantee.rolname, '') not in (
            'anon',
            'authenticated',
            'service_role'
          )
        )
      )
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'bank_transfer_submissions_readonly_fence:catalog_acl_mismatch';
  end if;

  if (
    select pg_catalog.count(*)
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    cross join lateral pg_catalog.aclexplode(
      coalesce(
        relation.relacl,
        pg_catalog.acldefault('r', relation.relowner)
      )
    ) as acl
    join pg_catalog.pg_roles as grantee
      on grantee.oid = acl.grantee
    where relation.oid = v_relation_oid
      and namespace.nspname = 'public'
      and relation.relname = 'bank_transfer_submissions'
      and grantee.rolname in ('authenticated', 'service_role')
      and acl.privilege_type = 'SELECT'
      and not acl.is_grantable
      and acl.grantor = relation.relowner
  ) <> 2 then
    raise exception using
      errcode = 'P0001',
      message = 'bank_transfer_submissions_readonly_fence:catalog_select_acl_mismatch';
  end if;

  select pg_catalog.count(*)
  into v_policy_count
  from pg_catalog.pg_policy as policy
  join pg_catalog.pg_class as relation
    on relation.oid = policy.polrelid
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = relation.relnamespace
  where relation.oid = v_relation_oid
    and namespace.nspname = 'public'
    and relation.relname = 'bank_transfer_submissions';

  if v_policy_count <> 1 then
    raise exception using
      errcode = 'P0001',
      message = 'bank_transfer_submissions_readonly_fence:unexpected_policy_count';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_policy as policy
    join pg_catalog.pg_class as relation
      on relation.oid = policy.polrelid
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    where relation.oid = v_relation_oid
      and namespace.nspname = 'public'
      and relation.relname = 'bank_transfer_submissions'
      and policy.polname = 'Users can read own bank transfer submissions'
      and policy.polcmd = 'r'
      and policy.polroles = array[v_authenticated_oid]::oid[]
      and pg_catalog.pg_get_expr(
        policy.polqual,
        policy.polrelid,
        false
      ) = '(( SELECT auth.uid() AS uid) = user_id)'
      and policy.polwithcheck is null
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
    where relation.oid = v_relation_oid
      and namespace.nspname = 'public'
      and relation.relname = 'bank_transfer_submissions'
      and relation.relkind = 'r'
      and relation.relrowsecurity
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'bank_transfer_submissions_readonly_fence:rls_disabled';
  end if;
end
$$;

commit;
