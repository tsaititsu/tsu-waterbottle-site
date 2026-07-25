import { cancelBookingCalendarEvent } from '@/lib/google/createBookingCalendarEvent'
import { getUserWithEmailFromRequest } from '@/lib/supabase/auth'
import { getSupabaseBookingForRequester, updateSupabaseBooking } from '@/lib/supabase/bookings'
import { handleBookingCalendarCancellationRequest } from './handler'

export async function POST(req: Request) {
  return handleBookingCalendarCancellationRequest(req, {
    getRequesterFromRequest: getUserWithEmailFromRequest,
    getBookingById: getSupabaseBookingForRequester,
    cancelCalendarEvent: cancelBookingCalendarEvent,
    markCalendarCancelled: updateSupabaseBooking,
  })
}
