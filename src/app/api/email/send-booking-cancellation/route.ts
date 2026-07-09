import { handleBookingEmailRequest } from '@/lib/email/bookingEmailRequestHandler'
import { sendBookingCancellationEmails } from '@/lib/email/sendBookingEmails'
import { hasSupabaseAdminConfig } from '@/lib/supabase/admin'
import { getUserWithEmailFromRequest } from '@/lib/supabase/auth'
import { getSupabaseBooking, updateSupabaseBooking } from '@/lib/supabase/bookings'

export const dynamic = 'force-dynamic'

// 安全設計：只接受 bookingId 與純文字取消原因（截斷長度），收件人與信件內容
// 一律由資料庫的 booking record 與 server env 推導，request body 無法指定
// to / cc / bcc / 內容。
export async function POST(req: Request) {
  return handleBookingEmailRequest(req, {
    kind: 'cancellation',
    getRequesterFromRequest: getUserWithEmailFromRequest,
    getBookingById: getSupabaseBooking,
    sendEmails: sendBookingCancellationEmails,
    markEmailsSent: async (bookingId) => {
      await updateSupabaseBooking(bookingId, {
        cancellationEmailSentToCustomer: true,
        cancellationEmailSentToAdmin: true,
      })
    },
    hasBookingDataSource: hasSupabaseAdminConfig,
  })
}
