import 'server-only'

import { readLineSessionCookieValue } from '@/lib/auth/line'
import { getBookingPlan } from '@/lib/bookingPlans'
import { getUserIdFromRequest } from '@/lib/supabase/auth'
import { createSupabaseBooking } from '@/lib/supabase/bookings'
import type { handleBookingCreateRequest } from '@/app/api/bookings/create/handler'

export const defaultBookingCreateDependencies: Parameters<typeof handleBookingCreateRequest>[1] = {
  getBearerUserId: getUserIdFromRequest,
  readLineSession: readLineSessionCookieValue,
  getPlan: getBookingPlan,
  createBooking: createSupabaseBooking,
}
