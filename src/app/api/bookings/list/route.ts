import { getUserWithEmailFromRequest } from '@/lib/supabase/auth'
import { listSupabaseBookings } from '@/lib/supabase/bookings'
import { handleBookingListRequest } from './handler'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  return handleBookingListRequest(request, {
    getRequesterFromRequest: getUserWithEmailFromRequest,
    listBookingsByUserId: listSupabaseBookings,
  })
}
