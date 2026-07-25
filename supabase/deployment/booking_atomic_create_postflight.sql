do $contract$
declare
  v_function_oid oid;
  v_constraint_oid oid;
begin
  select procedure.oid
  into strict v_function_oid
  from pg_catalog.pg_proc as procedure
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = procedure.pronamespace
  join pg_catalog.pg_language as language
    on language.oid = procedure.prolang
  join pg_catalog.pg_roles as owner
    on owner.oid = procedure.proowner
  where namespace.nspname = 'public'
    and procedure.proname = 'create_booking_with_available_slot'
    and pg_catalog.oidvectortypes(procedure.proargtypes) =
      'uuid, uuid, text, text, text, text, text, text, date, time without time zone, text, boolean, text, text'
    and language.lanname = 'plpgsql'
    and owner.rolname = 'postgres'
    and procedure.prosecdef is false
    and procedure.provolatile = 'v'
    and procedure.proretset is true
    and procedure.proconfig is not distinct from
      array['search_path=""']::text[]
    and pg_catalog.md5(pg_catalog.pg_get_functiondef(procedure.oid)) =
      '61a6627113ef013df080440455aaece6'
    and pg_catalog.obj_description(procedure.oid, 'pg_proc') =
      'Atomically claims one future available consultation slot and creates its booking; service_role only.';

  if not pg_catalog.has_function_privilege(
    'service_role',
    v_function_oid,
    'EXECUTE'
  ) or pg_catalog.has_function_privilege(
    'authenticated',
    v_function_oid,
    'EXECUTE'
  ) or pg_catalog.has_function_privilege(
    'anon',
    v_function_oid,
    'EXECUTE'
  ) or exists (
    select 1
    from pg_catalog.aclexplode(
      coalesce(
        (select procedure.proacl
         from pg_catalog.pg_proc as procedure
         where procedure.oid = v_function_oid),
        pg_catalog.acldefault(
          'f',
          (select procedure.proowner
           from pg_catalog.pg_proc as procedure
           where procedure.oid = v_function_oid)
        )
      )
    ) as acl
    left join pg_catalog.pg_roles as grantee
      on grantee.oid = acl.grantee
    where acl.grantee = 0
       or grantee.rolname not in ('postgres', 'service_role')
       or acl.privilege_type <> 'EXECUTE'
       or acl.is_grantable
  ) or (
    select pg_catalog.count(*)
    from pg_catalog.pg_proc as procedure
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname = 'create_booking_with_available_slot'
  ) <> 1
  then
    raise exception using
      errcode = 'P0001',
      message = 'BOOKING_FUNCTION_ACL_MISMATCH';
  end if;

  select constraint_row.oid
  into strict v_constraint_oid
  from pg_catalog.pg_constraint as constraint_row
  join pg_catalog.pg_class as relation
    on relation.oid = constraint_row.conrelid
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = relation.relnamespace
  where namespace.nspname = 'public'
    and relation.relname = 'bookings'
    and constraint_row.conname = 'bookings_active_schedule_no_overlap'
    and constraint_row.contype = 'x'
    and constraint_row.convalidated
    and not constraint_row.condeferrable
    and not constraint_row.condeferred
    and pg_catalog.md5(
      pg_catalog.pg_get_constraintdef(constraint_row.oid, true)
    ) = '88eee14f144ab75d2151273690227c9e';
exception
  when no_data_found or too_many_rows then
    raise exception using
      errcode = 'P0001',
      message = 'BOOKING_POSTFLIGHT_IDENTITY_MISMATCH';
end;
$contract$;

savepoint booking_atomic_smoke;

insert into public.consultation_plans (
  id,
  name,
  description,
  duration_minutes,
  price_twd,
  is_active,
  sort_order
) values (
  '__codex_booking_atomic_smoke_20260725__',
  'Codex rollback-only atomic smoke',
  'Synthetic row; transaction savepoint is always rolled back.',
  60,
  1,
  true,
  2147483647
);

insert into public.consultation_availability_slots (
  id,
  start_at,
  end_at,
  is_available,
  note
) values (
  '8f3a7d4a-1111-4111-8111-8f3a7d4a1111'::uuid,
  '2099-12-30T04:00:00Z'::timestamptz,
  '2099-12-30T05:00:00Z'::timestamptz,
  true,
  'Codex rollback-only atomic smoke'
);

set local role service_role;

do $smoke$
declare
  v_constraint_name text;
  v_schema_name text;
  v_table_name text;
begin
  begin
    perform *
    from public.create_booking_with_available_slot(
      '8f3a7d4a-2222-4222-8222-8f3a7d4a2222'::uuid,
      '8f3a7d4a-1111-4111-8111-8f3a7d4a1111'::uuid,
      '__codex_booking_atomic_smoke_20260725__',
      'Codex Atomic Smoke',
      'codex-booking-atomic-smoke@example.invalid',
      null,
      null,
      'other',
      '2000-01-01'::date,
      '12:00:00'::time,
      'Synthetic',
      true,
      'Rollback-only atomic smoke',
      null
    );

    raise exception using
      errcode = 'P0001',
      message = 'BOOKING_ATOMIC_SMOKE_UNEXPECTED_SUCCESS';
  exception
    when foreign_key_violation then
      get stacked diagnostics
        v_constraint_name = constraint_name,
        v_schema_name = schema_name,
        v_table_name = table_name;

      if v_constraint_name <> 'bookings_user_id_fkey'
        or v_schema_name <> 'public'
        or v_table_name <> 'bookings'
      then
        raise exception using
          errcode = 'P0001',
          message = 'BOOKING_ATOMIC_SMOKE_WRONG_FAILURE';
      end if;
  end;

  if not exists (
    select 1
    from public.consultation_availability_slots as slot
    where slot.id = '8f3a7d4a-1111-4111-8111-8f3a7d4a1111'::uuid
      and slot.is_available is true
  ) or exists (
    select 1
    from public.bookings as booking
    where booking.starts_at = '2099-12-30T04:00:00Z'::timestamptz
      and booking.ends_at = '2099-12-30T05:00:00Z'::timestamptz
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'BOOKING_ATOMIC_SMOKE_ROLLBACK_FAILED';
  end if;
end;
$smoke$;

reset role;

rollback to savepoint booking_atomic_smoke;
release savepoint booking_atomic_smoke;

select pg_catalog.jsonb_build_object(
  'marker', 'BOOKING_ATOMIC_POSTFLIGHT',
  'contract_version', 1,
  'approved_source_commit',
    'cdc2a4fa49300a62782a7171ac9ab77a95a9a602',
  'migration_path',
    'supabase/migrations/20260725123441_create_booking_with_available_slot.sql',
  'migration_sha256',
    'ea02c044e19bacdfc10c81b109bb858d26d205fc58691ddfbb18ea418c9d25e1',
  'postgres_major',
    current_setting('server_version_num')::integer / 10000,
  'constraint_definition_md5',
    pg_catalog.md5(pg_catalog.pg_get_constraintdef(constraint_row.oid, true)),
  'function_definition_md5',
    pg_catalog.md5(pg_catalog.pg_get_functiondef(procedure.oid)),
  'service_role_execute',
    pg_catalog.has_function_privilege(
      'service_role',
      procedure.oid,
      'EXECUTE'
    ),
  'authenticated_execute',
    pg_catalog.has_function_privilege(
      'authenticated',
      procedure.oid,
      'EXECUTE'
    ),
  'anon_execute',
    pg_catalog.has_function_privilege('anon', procedure.oid, 'EXECUTE'),
  'security_invoker', not procedure.prosecdef,
  'rollback_atomic_smoke', true,
  'expected_failure_constraint', 'bookings_user_id_fkey',
  'synthetic_rows_persisted', false
)::text
from pg_catalog.pg_proc as procedure
join pg_catalog.pg_namespace as function_namespace
  on function_namespace.oid = procedure.pronamespace
join pg_catalog.pg_constraint as constraint_row
  on constraint_row.conname = 'bookings_active_schedule_no_overlap'
join pg_catalog.pg_class as relation
  on relation.oid = constraint_row.conrelid
join pg_catalog.pg_namespace as relation_namespace
  on relation_namespace.oid = relation.relnamespace
where function_namespace.nspname = 'public'
  and procedure.proname = 'create_booking_with_available_slot'
  and pg_catalog.oidvectortypes(procedure.proargtypes) =
    'uuid, uuid, text, text, text, text, text, text, date, time without time zone, text, boolean, text, text'
  and relation_namespace.nspname = 'public'
  and relation.relname = 'bookings';
