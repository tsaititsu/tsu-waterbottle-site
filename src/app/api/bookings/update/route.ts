import { handleBookingUpdateRequest } from './handler'
import { getUserWithEmailFromRequest } from '@/lib/supabase/auth'
import {
  cancelSupabaseBooking,
  getSupabaseBookingForRequester,
} from '@/lib/supabase/bookings'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  return handleBookingUpdateRequest(req, {
    getRequesterFromRequest: getUserWithEmailFromRequest,
    getBookingById: getSupabaseBookingForRequester,
    cancelBooking: cancelSupabaseBooking,
    now: () => new Date(),
  })
}
