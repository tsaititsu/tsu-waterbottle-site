import { handleBookingCalendarRequest } from './handler'
import { createBookingCalendarEvent } from '@/lib/google/createBookingCalendarEvent'
import { getUserWithEmailFromRequest } from '@/lib/supabase/auth'
import { getSupabaseBooking, updateSupabaseBooking } from '@/lib/supabase/bookings'

export async function POST(req: Request) {
  return handleBookingCalendarRequest(req, {
    getRequesterFromRequest: getUserWithEmailFromRequest,
    getBookingById: getSupabaseBooking,
    createCalendarEvent: createBookingCalendarEvent,
    markCalendarCreated: async (bookingId, result) => {
      await updateSupabaseBooking(bookingId, {
        googleCalendarEventId: result.eventId,
        googleCalendarEventLink: result.htmlLink,
      })
    },
  })
}
