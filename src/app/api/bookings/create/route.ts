import { defaultBookingCreateDependencies } from '@/lib/bookings/createBookingDependencies.server'
import { handleBookingCreateRequest } from './handler'

export async function POST(request: Request) {
  return handleBookingCreateRequest(request, defaultBookingCreateDependencies)
}
