\set ON_ERROR_STOP on

begin;

set local lock_timeout = '15s';
set local statement_timeout = '120s';
set local idle_in_transaction_session_timeout = '30s';

lock table
  public.bookings,
  public.consultation_availability_slots,
  public.consultation_plans
in access exclusive mode;

\ir booking_atomic_create_preflight.sql
\ir booking_atomic_create_locked_guard.sql
\ir /approved-source/supabase/migrations/20260725123441_create_booking_with_available_slot.sql
\ir booking_atomic_create_postflight.sql

commit;
