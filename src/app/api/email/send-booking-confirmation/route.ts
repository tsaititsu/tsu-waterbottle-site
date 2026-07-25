import { handleBookingEmailRequest } from '@/lib/email/bookingEmailRequestHandler'
import { sendBookingConfirmationEmails } from '@/lib/email/sendBookingEmails'
import { hasSupabaseAdminConfig } from '@/lib/supabase/admin'
import { getUserWithEmailFromRequest } from '@/lib/supabase/auth'
import { getSupabaseBookingForRequester, updateSupabaseBooking } from '@/lib/supabase/bookings'

export const dynamic = 'force-dynamic'

// 安全設計：只接受 bookingId，收件人與信件內容一律由資料庫的 booking record
// 與 server env 推導，request body 無法指定 to / cc / bcc / 內容。
export async function POST(req: Request) {
  return handleBookingEmailRequest(req, {
    kind: 'confirmation',
    getRequesterFromRequest: getUserWithEmailFromRequest,
    getBookingById: getSupabaseBookingForRequester,
    requireTrustedPaidBooking: true,
    sendEmails: sendBookingConfirmationEmails,
    markEmailsSent: async (bookingId) => {
      await updateSupabaseBooking(bookingId, {
        emailSentToCustomer: true,
        emailSentToAdmin: true,
      })
    },
    hasBookingDataSource: hasSupabaseAdminConfig,
  })
}
