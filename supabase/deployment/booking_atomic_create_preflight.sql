with
database_contract as (
  select
    current_setting('server_version_num')::integer / 10000 as postgres_major,
    not pg_catalog.pg_is_in_recovery() as primary_database
),
expected_relations as (
  select *
  from (
    values
      ('public'::text, 'bookings'::text),
      ('public'::text, 'consultation_availability_slots'::text),
      ('public'::text, 'consultation_plans'::text)
  ) as expected(schema_name, relation_name)
),
relation_state as (
  select pg_catalog.count(relation.oid)::integer as relation_count
  from expected_relations as expected
  left join pg_catalog.pg_namespace as namespace
    on namespace.nspname = expected.schema_name
  left join pg_catalog.pg_class as relation
    on relation.relnamespace = namespace.oid
   and relation.relname = expected.relation_name
   and relation.relkind = 'r'
),
constraint_state as (
  select
    pg_catalog.count(*)::integer as constraint_count,
    pg_catalog.count(*) filter (
      where constraint_row.contype = 'x'
        and constraint_row.convalidated
        and not constraint_row.condeferrable
        and not constraint_row.condeferred
        and pg_catalog.md5(
          pg_catalog.pg_get_constraintdef(constraint_row.oid, true)
        ) = '88eee14f144ab75d2151273690227c9e'
    )::integer as constraint_exact_count
  from pg_catalog.pg_constraint as constraint_row
  join pg_catalog.pg_class as relation
    on relation.oid = constraint_row.conrelid
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = relation.relnamespace
  where namespace.nspname = 'public'
    and relation.relname = 'bookings'
    and constraint_row.conname = 'bookings_active_schedule_no_overlap'
),
function_state as (
  select
    pg_catalog.count(*)::integer as function_named_count,
    pg_catalog.count(*) filter (
      where pg_catalog.oidvectortypes(procedure.proargtypes) =
        'uuid, uuid, text, text, text, text, text, text, date, time without time zone, text, boolean, text, text'
    )::integer as function_signature_count,
    pg_catalog.count(*) filter (
      where pg_catalog.oidvectortypes(procedure.proargtypes) =
        'uuid, uuid, text, text, text, text, text, text, date, time without time zone, text, boolean, text, text'
        and language.lanname = 'plpgsql'
        and owner.rolname = 'postgres'
        and procedure.prosecdef is false
        and procedure.provolatile = 'v'
        and procedure.proretset is true
        and procedure.proconfig is not distinct from
          array['search_path=""']::text[]
        and pg_catalog.md5(
          pg_catalog.pg_get_functiondef(procedure.oid)
        ) = '61a6627113ef013df080440455aaece6'
        and pg_catalog.obj_description(procedure.oid, 'pg_proc') =
          'Atomically claims one future available consultation slot and creates its booking; service_role only.'
        and pg_catalog.has_function_privilege(
          'service_role',
          procedure.oid,
          'EXECUTE'
        )
        and not pg_catalog.has_function_privilege(
          'authenticated',
          procedure.oid,
          'EXECUTE'
        )
        and not pg_catalog.has_function_privilege(
          'anon',
          procedure.oid,
          'EXECUTE'
        )
        and not exists (
          select 1
          from pg_catalog.aclexplode(
            coalesce(
              procedure.proacl,
              pg_catalog.acldefault('f', procedure.proowner)
            )
          ) as acl
          left join pg_catalog.pg_roles as grantee
            on grantee.oid = acl.grantee
          where acl.grantee = 0
             or grantee.rolname not in ('postgres', 'service_role')
             or acl.privilege_type <> 'EXECUTE'
             or acl.is_grantable
        )
    )::integer as function_exact_count
  from pg_catalog.pg_proc as procedure
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = procedure.pronamespace
  join pg_catalog.pg_language as language
    on language.oid = procedure.prolang
  join pg_catalog.pg_roles as owner
    on owner.oid = procedure.proowner
  where namespace.nspname = 'public'
    and procedure.proname = 'create_booking_with_available_slot'
),
overlap_state as (
  select pg_catalog.count(*)::integer as active_overlap_pairs
  from public.bookings as left_booking
  join public.bookings as right_booking
    on left_booking.id < right_booking.id
   and left_booking.status <> 'cancelled'
   and right_booking.status <> 'cancelled'
   and pg_catalog.tstzrange(
     left_booking.starts_at,
     left_booking.ends_at,
     '[)'
   ) && pg_catalog.tstzrange(
     right_booking.starts_at,
     right_booking.ends_at,
     '[)'
   )
)
select pg_catalog.jsonb_build_object(
  'marker', 'BOOKING_ATOMIC_PREFLIGHT',
  'contract_version', 1,
  'postgres_major', database_contract.postgres_major,
  'primary_database', database_contract.primary_database,
  'relation_count', relation_state.relation_count,
  'constraint_count', constraint_state.constraint_count,
  'constraint_exact_count', constraint_state.constraint_exact_count,
  'function_named_count', function_state.function_named_count,
  'function_signature_count', function_state.function_signature_count,
  'function_exact_count', function_state.function_exact_count,
  'active_overlap_pairs', overlap_state.active_overlap_pairs
)::text
from database_contract
cross join relation_state
cross join constraint_state
cross join function_state
cross join overlap_state;
