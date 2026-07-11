import { handleBookingUpdateRequest } from './handler'
import { getUserWithEmailFromRequest } from '@/lib/supabase/auth'
import { updateSupabaseBooking } from '@/lib/supabase/bookings'
import { getSupabaseBooking } from '@/lib/supabase/bookings'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  return handleBookingUpdateRequest(req, {
    getRequesterFromRequest: getUserWithEmailFromRequest,
    getBookingById: getSupabaseBooking,
    updateBookingById: updateSupabaseBooking,
  })
}
