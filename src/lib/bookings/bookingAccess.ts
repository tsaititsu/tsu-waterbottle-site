import { isAdminEmail } from '../auth/admin'

export type BookingRequestUser = {
  id: string
  email: string | null
}

export type BookingOwnershipRecord = {
  userId?: string | null
}

export type BookingAccessDecision =
  | { allowed: true; isAdmin: boolean }
  | { allowed: false; status: 401 | 404 }

export function resolveBookingAccess(input: {
  requester: BookingRequestUser | null
  booking: BookingOwnershipRecord | null
  adminEmailsRaw: string | null | undefined
}): BookingAccessDecision {
  if (!input.requester) return { allowed: false, status: 401 }
  if (!input.booking) return { allowed: false, status: 404 }

  if (isAdminEmail(input.requester.email, input.adminEmailsRaw)) {
    return { allowed: true, isAdmin: true }
  }

  if (input.booking.userId && input.booking.userId === input.requester.id) {
    return { allowed: true, isAdmin: false }
  }

  return { allowed: false, status: 404 }
}
