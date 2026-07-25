import { handleBookingReadRequest } from './handler'
import { getUserWithEmailFromRequest } from '@/lib/supabase/auth'
import { getSupabaseBookingForRequester } from '@/lib/supabase/bookings'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  return handleBookingReadRequest(req, {
    getRequesterFromRequest: getUserWithEmailFromRequest,
    getBookingById: getSupabaseBookingForRequester,
  })
}
