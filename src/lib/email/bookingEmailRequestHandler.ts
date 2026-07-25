import { NextResponse } from 'next/server'
import { isAdminEmail } from '../auth/admin'

/**
 * 預約通知信 API 的安全 handler。
 *
 * 安全原則：
 * - 只接受 bookingId；取消原因只能從已取消的 booking record 推導。
 * - 完全忽略 request body 的 to / cc / bcc / subject / html，收件人一律由
 *   booking record（customer email）與 server env（ADMIN_NOTIFY_EMAIL，於
 *   sendBookingEmails 內讀取）推導。
 * - 必須登入，且只能觸發自己的 booking；ADMIN_EMAILS 內的帳號可觸發任何 booking。
 * - 已寄出過的信不重寄（idempotent）。
 * - 無法安全推導收件人（無資料庫設定）時 fail closed，不寄信。
 * - 錯誤回應只回固定文案，不外洩 key / env / stack。
 */

export const MAX_CANCELLATION_REASON_LENGTH = 300

export type BookingEmailKind = 'confirmation' | 'cancellation'

export type BookingEmailRequester = {
  id: string
  email: string | null
}

export type BookingEmailSourceRecord = {
  id: string
  userId?: string | null
  status?: string | null
  paymentStatus?: string | null
  customerName: string
  customerEmail: string
  customerPhone?: string
  planName: string
  amount: number
  startTime: string
  endTime: string
  birthDate?: string
  birthTime?: string
  birthPlace?: string
  gender?: string
  isBirthTimeAccurate?: boolean
  question?: string
  cancellationReason?: string
  emailSentToCustomer?: boolean
  emailSentToAdmin?: boolean
  cancellationEmailSentToCustomer?: boolean
  cancellationEmailSentToAdmin?: boolean
}

export type BookingEmailPayloadFromRecord = {
  bookingId: string
  customerName: string
  customerEmail: string
  planName: string
  amount: number
  startTimeText: string
  endTimeText: string
  cancellationReason?: string
}

export type ParsedBookingEmailRequest = {
  bookingId: string
}

/**
 * request contract 只允許 bookingId。任何額外欄位都 fail closed，避免未來新增
 * 敏感欄位時被舊 handler 靜默接受。
 */
export function parseBookingEmailRequestBody(body: unknown): ParsedBookingEmailRequest | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null

  const record = body as Record<string, unknown>
  if (Object.keys(record).some((key) => key !== 'bookingId')) return null
  const bookingId = typeof record.bookingId === 'string' ? record.bookingId.trim() : ''
  if (!bookingId) return null

  return { bookingId }
}

export type BookingEmailAccessDecision =
  | { allowed: true; isAdmin: boolean }
  | { allowed: false; status: 401 | 404 }

/**
 * 誰可以觸發這封信：
 * - 未登入 → 401
 * - booking 不存在 → 404
 * - ADMIN_EMAILS 內的帳號 → 允許（任何 booking）
 * - booking 的 user_id 與登入者相同 → 允許
 * - 其他 → 404，避免透露其他會員的 booking 是否存在
 */
export function resolveBookingEmailAccess(input: {
  requester: BookingEmailRequester | null
  booking: BookingEmailSourceRecord | null
  adminEmailsRaw: string | null | undefined
}): BookingEmailAccessDecision {
  const { requester, booking, adminEmailsRaw } = input

  if (!requester) return { allowed: false, status: 401 }
  if (!booking) return { allowed: false, status: 404 }

  if (isAdminEmail(requester.email, adminEmailsRaw)) {
    return { allowed: true, isAdmin: true }
  }

  if (booking.userId && requester.id === booking.userId) {
    return { allowed: true, isAdmin: false }
  }

  return { allowed: false, status: 404 }
}

export function hasBookingEmailAlreadyBeenSent(kind: BookingEmailKind, booking: BookingEmailSourceRecord): boolean {
  if (kind === 'confirmation') {
    return Boolean(booking.emailSentToCustomer && booking.emailSentToAdmin)
  }

  return Boolean(booking.cancellationEmailSentToCustomer && booking.cancellationEmailSentToAdmin)
}

function formatTaipeiDateTimeText(value: string) {
  return new Date(value).toLocaleString('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

/**
 * 信件內容全部由 booking record 推導，不使用外部 request 的任何內容
 * 取消原因同樣只能來自 booking record。
 */
export function buildBookingEmailPayload(
  booking: BookingEmailSourceRecord,
  options: { cancellationReason?: string } = {},
): BookingEmailPayloadFromRecord {
  const cancellationReason = options.cancellationReason ?? booking.cancellationReason

  return {
    bookingId: booking.id,
    customerName: booking.customerName,
    customerEmail: booking.customerEmail,
    planName: booking.planName,
    amount: booking.amount,
    startTimeText: formatTaipeiDateTimeText(booking.startTime),
    endTimeText: formatTaipeiDateTimeText(booking.endTime),
    ...(cancellationReason ? { cancellationReason } : {}),
  }
}

export type HandleBookingEmailRequestDeps = {
  kind: BookingEmailKind
  getRequesterFromRequest: (request: Request) => Promise<BookingEmailRequester | null>
  getBookingById: (
    bookingId: string,
    requesterId: string,
    requesterIsAdmin: boolean,
  ) => Promise<BookingEmailSourceRecord | null>
  sendEmails: (payload: BookingEmailPayloadFromRecord) => Promise<unknown>
  markEmailsSent?: (bookingId: string) => Promise<void>
  hasBookingDataSource: () => boolean
  adminEmailsRaw?: string | null
  requireTrustedPaidBooking?: boolean
}

const GENERIC_ERROR_MESSAGES: Record<BookingEmailKind, string> = {
  confirmation: '寄送預約確認信失敗，請稍後再試。',
  cancellation: '寄送預約取消信失敗，請稍後再試。',
}

export async function handleBookingEmailRequest(
  request: Request,
  deps: HandleBookingEmailRequestDeps,
): Promise<NextResponse> {
  const genericErrorMessage = GENERIC_ERROR_MESSAGES[deps.kind]

  try {
    const body = await request.json().catch(() => null)
    const parsed = parseBookingEmailRequestBody(body)

    if (!parsed) {
      return NextResponse.json({ ok: false, message: '請提供有效的預約編號。' }, { status: 400 })
    }

    const requester = await deps.getRequesterFromRequest(request).catch(() => null)
    if (!requester) {
      return NextResponse.json({ ok: false, message: '請先登入後再操作。' }, { status: 401 })
    }

    if (!deps.hasBookingDataSource()) {
      // 無法從可信資料來源推導收件人時，一律不寄信。
      return NextResponse.json({ ok: false, message: '寄信服務暫時無法使用。' }, { status: 503 })
    }

    const adminEmailsRaw = deps.adminEmailsRaw !== undefined ? deps.adminEmailsRaw : process.env.ADMIN_EMAILS
    const requesterIsAdmin = isAdminEmail(requester.email, adminEmailsRaw)
    const booking = await deps
      .getBookingById(parsed.bookingId, requester.id, requesterIsAdmin)
      .catch(() => null)
    const access = resolveBookingEmailAccess({ requester, booking, adminEmailsRaw })

    if (!access.allowed) {
      const messages: Record<401 | 404, string> = {
        401: '請先登入後再操作。',
        404: '找不到這筆預約。',
      }
      return NextResponse.json({ ok: false, message: messages[access.status] }, { status: access.status })
    }

    const safeBooking = booking as BookingEmailSourceRecord

    if (deps.kind === 'cancellation' && safeBooking.status !== 'cancelled') {
      return NextResponse.json(
        { ok: false, error: 'booking_not_cancelled', message: '預約尚未取消，無法寄出取消通知信。' },
        { status: 409 },
      )
    }

    if (
      deps.requireTrustedPaidBooking &&
      !(safeBooking.paymentStatus === 'paid' && safeBooking.status === 'confirmed')
    ) {
      return NextResponse.json(
        { ok: false, error: 'payment_not_confirmed', message: '付款尚未確認，無法寄出預約確認信。' },
        { status: 409 },
      )
    }

    if (hasBookingEmailAlreadyBeenSent(deps.kind, safeBooking)) {
      return NextResponse.json({ ok: true, alreadySent: true })
    }

    const payload = buildBookingEmailPayload(safeBooking)

    try {
      await deps.sendEmails(payload)
    } catch {
      console.error(`Failed to send booking ${deps.kind} emails`)
      return NextResponse.json({ ok: false, message: genericErrorMessage }, { status: 500 })
    }

    if (deps.markEmailsSent) {
      try {
        await deps.markEmailsSent(safeBooking.id)
      } catch {
        console.error(`Failed to mark booking ${deps.kind} emails as sent`)
        return NextResponse.json({ ok: false, message: genericErrorMessage }, { status: 500 })
      }
    }

    return NextResponse.json({ ok: true })
  } catch {
    console.error(`Unexpected booking ${deps.kind} email request error`)
    return NextResponse.json({ ok: false, message: genericErrorMessage }, { status: 500 })
  }
}
