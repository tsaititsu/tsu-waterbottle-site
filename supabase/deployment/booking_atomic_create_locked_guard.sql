do $guard$
declare
  v_active_overlap_pairs integer;
  v_constraint_count integer;
  v_function_named_count integer;
  v_relation_count integer;
begin
  if current_setting('server_version_num')::integer / 10000 <> 17
    or pg_catalog.pg_is_in_recovery()
  then
    raise exception using
      errcode = 'P0001',
      message = 'BOOKING_ATOMIC_LOCKED_DATABASE_DRIFT';
  end if;

  select pg_catalog.count(relation.oid)::integer
  into v_relation_count
  from (
    values
      ('public'::text, 'bookings'::text),
      ('public'::text, 'consultation_availability_slots'::text),
      ('public'::text, 'consultation_plans'::text)
  ) as expected(schema_name, relation_name)
  left join pg_catalog.pg_namespace as namespace
    on namespace.nspname = expected.schema_name
  left join pg_catalog.pg_class as relation
    on relation.relnamespace = namespace.oid
   and relation.relname = expected.relation_name
   and relation.relkind = 'r';

  select pg_catalog.count(*)::integer
  into v_constraint_count
  from pg_catalog.pg_constraint as constraint_row
  join pg_catalog.pg_class as relation
    on relation.oid = constraint_row.conrelid
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = relation.relnamespace
  where namespace.nspname = 'public'
    and relation.relname = 'bookings'
    and constraint_row.conname = 'bookings_active_schedule_no_overlap';

  select pg_catalog.count(*)::integer
  into v_function_named_count
  from pg_catalog.pg_proc as procedure
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'public'
    and procedure.proname = 'create_booking_with_available_slot';

  select pg_catalog.count(*)::integer
  into v_active_overlap_pairs
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
   );

  if v_relation_count <> 3
    or v_constraint_count <> 0
    or v_function_named_count <> 0
  then
    raise exception using
      errcode = 'P0001',
      message = 'BOOKING_ATOMIC_LOCKED_SCHEMA_DRIFT';
  end if;

  if v_active_overlap_pairs <> 0 then
    raise exception using
      errcode = 'P0001',
      message = 'BOOKING_ATOMIC_LOCKED_DATA_DRIFT';
  end if;
end;
$guard$;
