-- Local/Preview-only migration until a separate Production authorization is granted.
-- The function is the single transaction boundary for claiming an available slot
-- and inserting its booking. Any error rolls both changes back.

alter table public.bookings
add constraint bookings_active_schedule_no_overlap
exclude using gist (
  pg_catalog.tstzrange(starts_at, ends_at, '[)') with &&
)
where (status <> 'cancelled');

create or replace function public.create_booking_with_available_slot(
  p_user_id uuid,
  p_slot_id uuid,
  p_plan_id text,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_line_display_name text,
  p_gender text,
  p_birth_date date,
  p_birth_time time without time zone,
  p_birth_place text,
  p_is_birth_time_accurate boolean,
  p_question text,
  p_note text
)
returns table (
  id uuid,
  user_id uuid,
  plan_id text,
  plan_name text,
  amount_twd integer,
  currency text,
  status text,
  payment_status text,
  customer_name text,
  customer_email text,
  customer_phone text,
  line_display_name text,
  gender text,
  birth_date date,
  birth_time time without time zone,
  birth_place text,
  is_birth_time_accurate boolean,
  question text,
  note text,
  starts_at timestamptz,
  ends_at timestamptz,
  timezone text,
  google_calendar_event_id text,
  google_calendar_event_link text,
  google_calendar_cancelled boolean,
  confirmation_email_sent_to_customer boolean,
  confirmation_email_sent_to_admin boolean,
  cancellation_email_sent_to_customer boolean,
  cancellation_email_sent_to_admin boolean,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_plan_name text;
  v_plan_price_twd integer;
  v_plan_duration_minutes integer;
  v_slot_start_at timestamptz;
  v_slot_end_at timestamptz;
  v_created_booking public.bookings%rowtype;
begin
  if p_user_id is null then
    raise exception using
      errcode = 'WB003',
      message = 'booking_owner_required';
  end if;

  select
    plan.name,
    plan.price_twd,
    plan.duration_minutes
  into
    v_plan_name,
    v_plan_price_twd,
    v_plan_duration_minutes
  from public.consultation_plans as plan
  where plan.id = p_plan_id
    and plan.is_active is true;

  if not found then
    raise exception using
      errcode = 'WB001',
      message = 'booking_plan_unavailable';
  end if;

  update public.consultation_availability_slots as slot
  set
    is_available = false,
    updated_at = statement_timestamp()
  where slot.id = p_slot_id
    and slot.is_available is true
    and slot.start_at > statement_timestamp()
    and slot.end_at > slot.start_at
    and slot.end_at = slot.start_at
      + pg_catalog.make_interval(mins => v_plan_duration_minutes)
  returning slot.start_at, slot.end_at
  into v_slot_start_at, v_slot_end_at;

  if not found then
    raise exception using
      errcode = 'WB002',
      message = 'booking_slot_unavailable';
  end if;

  -- Different slot rows can still describe the same schedule. Serialize those
  -- transactions before the exclusion constraint checks the booking insert, so
  -- the losing request gets the stable unavailable error instead of a deadlock.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_slot_start_at::text || '|' || v_slot_end_at::text,
      0
    )
  );

  insert into public.bookings (
    user_id,
    plan_id,
    plan_name,
    amount_twd,
    currency,
    status,
    payment_status,
    customer_name,
    customer_email,
    customer_phone,
    line_display_name,
    gender,
    birth_date,
    birth_time,
    birth_place,
    is_birth_time_accurate,
    question,
    note,
    starts_at,
    ends_at,
    timezone,
    accepted_notice_at
  )
  values (
    p_user_id,
    p_plan_id,
    v_plan_name,
    v_plan_price_twd,
    'TWD',
    'pending_payment',
    'pending',
    p_customer_name,
    p_customer_email,
    p_customer_phone,
    p_line_display_name,
    p_gender,
    p_birth_date,
    p_birth_time,
    p_birth_place,
    p_is_birth_time_accurate,
    p_question,
    p_note,
    v_slot_start_at,
    v_slot_end_at,
    'Asia/Taipei',
    statement_timestamp()
  )
  returning *
  into v_created_booking;

  return query
  select
    v_created_booking.id,
    v_created_booking.user_id,
    v_created_booking.plan_id,
    v_created_booking.plan_name,
    v_created_booking.amount_twd,
    v_created_booking.currency,
    v_created_booking.status,
    v_created_booking.payment_status,
    v_created_booking.customer_name,
    v_created_booking.customer_email,
    v_created_booking.customer_phone,
    v_created_booking.line_display_name,
    v_created_booking.gender,
    v_created_booking.birth_date,
    v_created_booking.birth_time,
    v_created_booking.birth_place,
    v_created_booking.is_birth_time_accurate,
    v_created_booking.question,
    v_created_booking.note,
    v_created_booking.starts_at,
    v_created_booking.ends_at,
    v_created_booking.timezone,
    v_created_booking.google_calendar_event_id,
    v_created_booking.google_calendar_event_link,
    v_created_booking.google_calendar_cancelled,
    v_created_booking.confirmation_email_sent_to_customer,
    v_created_booking.confirmation_email_sent_to_admin,
    v_created_booking.cancellation_email_sent_to_customer,
    v_created_booking.cancellation_email_sent_to_admin,
    v_created_booking.cancelled_at,
    v_created_booking.cancellation_reason,
    v_created_booking.created_at,
    v_created_booking.updated_at;
exception
  when exclusion_violation then
    raise exception using
      errcode = 'WB002',
      message = 'booking_slot_unavailable';
end;
$function$;

revoke all on function public.create_booking_with_available_slot(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  date,
  time without time zone,
  text,
  boolean,
  text,
  text
) from public;

revoke all on function public.create_booking_with_available_slot(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  date,
  time without time zone,
  text,
  boolean,
  text,
  text
) from anon, authenticated;

grant execute on function public.create_booking_with_available_slot(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  date,
  time without time zone,
  text,
  boolean,
  text,
  text
) to service_role;

comment on function public.create_booking_with_available_slot(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  date,
  time without time zone,
  text,
  boolean,
  text,
  text
) is
  'Atomically claims one future available consultation slot and creates its booking; service_role only.';
