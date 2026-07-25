import 'server-only'

export type BookingEmailPayload = {
  bookingId: string
  customerName: string
  customerEmail: string
  planName: string
  amount: number
  startTimeText: string
  endTimeText: string
  cancellationReason?: string
}

type ResendEmailResponse = {
  id?: string
  message?: string
  name?: string
}

const resendEndpoint = 'https://api.resend.com/emails'
const defaultTimeoutMs = 10_000

type BookingEmailConfig = {
  apiKey: string
  from: string
  adminEmail: string
}

type BookingEmailAdapterDeps = {
  fetchImpl?: typeof fetch
  getConfig?: () => BookingEmailConfig | null
  timeoutMs?: number
}

export class BookingEmailAdapterError extends Error {
  constructor(
    public readonly code: 'booking_email_unavailable' | 'booking_email_delivery_failed',
  ) {
    super(code)
    this.name = 'BookingEmailAdapterError'
  }
}

function readBookingEmailConfig(): BookingEmailConfig | null {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL
  const adminEmail = process.env.ADMIN_NOTIFY_EMAIL

  return apiKey && from && adminEmail ? { apiKey, from, adminEmail } : null
}

function escapeHtml(value: string | number | boolean | undefined) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function formatPrice(amount: number) {
  return `NT$${amount.toLocaleString('zh-TW')}`
}

function optionalRow(label: string, value?: string) {
  if (value === undefined || value === '') return ''
  return `<p><strong>${escapeHtml(label)}：</strong>${escapeHtml(value)}</p>`
}

function bookingHtml(payload: BookingEmailPayload, variant: 'customer' | 'admin') {
  const customerName = payload.customerName || '客人'
  const title = variant === 'customer' ? '水瓶先生論命預約確認' : `${customerName} 諮詢預約`
  const intro =
    variant === 'customer'
      ? '你的預約已完成付款並建立紀錄，請確認以下預約資訊。'
      : '網站收到一筆付款完成的水瓶先生論命預約，請確認以下資訊。'

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Noto Sans TC', 'Microsoft JhengHei', Arial, sans-serif; color: #221a33; line-height: 1.7; max-width: 640px;">
      <h1 style="color: #3b0b73; font-size: 28px; margin: 0 0 16px;">${title}</h1>
      <p style="font-size: 16px; margin: 0 0 24px;">${intro}</p>
      <div style="border: 1px solid #e7dff0; border-radius: 18px; padding: 22px; background: #fbf8ff;">
        <p><strong>預約編號：</strong>${escapeHtml(payload.bookingId)}</p>
        <p><strong>姓名：</strong>${escapeHtml(payload.customerName)}</p>
        <p><strong>Email：</strong>${escapeHtml(payload.customerEmail)}</p>
        <p><strong>方案：</strong>${escapeHtml(payload.planName)}</p>
        <p><strong>金額：</strong>${escapeHtml(formatPrice(payload.amount))}</p>
        <p><strong>時間：</strong>${escapeHtml(payload.startTimeText)} - ${escapeHtml(payload.endTimeText)}</p>
      </div>
      <p style="color: #6f6878; font-size: 14px; margin-top: 24px;">這封信由 WATERBOTTLE 預約系統自動寄出。</p>
    </div>
  `
}

function cancellationHtml(payload: BookingEmailPayload, variant: 'customer' | 'admin') {
  const customerName = payload.customerName || '客人'
  const title = variant === 'customer' ? '水瓶先生論命預約取消確認' : `${customerName} 取消諮詢預約`
  const intro =
    variant === 'customer'
      ? '你的水瓶先生論命預約已取消。若有退款或改期需求，請等待官方協助處理。'
      : '客人已取消水瓶先生論命預約，請確認以下資訊並處理後續退款或改期。'

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Noto Sans TC', 'Microsoft JhengHei', Arial, sans-serif; color: #221a33; line-height: 1.7; max-width: 640px;">
      <h1 style="color: #3b0b73; font-size: 28px; margin: 0 0 16px;">${title}</h1>
      <p style="font-size: 16px; margin: 0 0 24px;">${intro}</p>
      <div style="border: 1px solid #e7dff0; border-radius: 18px; padding: 22px; background: #fbf8ff;">
        <p><strong>預約編號：</strong>${escapeHtml(payload.bookingId)}</p>
        <p><strong>姓名：</strong>${escapeHtml(payload.customerName)}</p>
        <p><strong>Email：</strong>${escapeHtml(payload.customerEmail)}</p>
        <p><strong>方案：</strong>${escapeHtml(payload.planName)}</p>
        <p><strong>金額：</strong>${escapeHtml(formatPrice(payload.amount))}</p>
        <p><strong>原預約時間：</strong>${escapeHtml(payload.startTimeText)} - ${escapeHtml(payload.endTimeText)}</p>
        ${optionalRow('取消原因', payload.cancellationReason)}
      </div>
      <p style="color: #6f6878; font-size: 14px; margin-top: 24px;">這封信由 WATERBOTTLE 預約系統自動寄出。</p>
    </div>
  `
}

async function sendResendEmail(input: {
  apiKey: string
  from: string
  to: string
  subject: string
  html: string
  idempotencyKey: string
}, fetchImpl: typeof fetch, timeoutMs: number) {
  try {
    const response = await fetchImpl(resendEndpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': input.idempotencyKey,
      },
      body: JSON.stringify({
        from: input.from,
        to: input.to,
        subject: input.subject,
        html: input.html,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    })

    const data = (await response.json().catch(() => ({}))) as ResendEmailResponse

    if (!response.ok || !data.id) {
      throw new BookingEmailAdapterError('booking_email_delivery_failed')
    }

    return { id: data.id }
  } catch (error) {
    if (error instanceof BookingEmailAdapterError) throw error
    throw new BookingEmailAdapterError('booking_email_delivery_failed')
  }
}

export async function sendBookingConfirmationEmails(
  payload: BookingEmailPayload,
  deps: BookingEmailAdapterDeps = {},
): Promise<{ customerEmailId: string; adminEmailId: string }> {
  const config = (deps.getConfig ?? readBookingEmailConfig)()
  if (!config) throw new BookingEmailAdapterError('booking_email_unavailable')
  const fetchImpl = deps.fetchImpl ?? fetch
  const timeoutMs = deps.timeoutMs ?? defaultTimeoutMs

  const [customerEmailResult, adminEmailResult] = await Promise.allSettled([
    sendResendEmail({
      apiKey: config.apiKey,
      from: config.from,
      to: payload.customerEmail,
      subject: `水瓶先生論命預約確認｜${payload.planName}`,
      html: bookingHtml(payload, 'customer'),
      idempotencyKey: `booking-confirmation-customer/${payload.bookingId}`,
    }, fetchImpl, timeoutMs),
    sendResendEmail({
      apiKey: config.apiKey,
      from: config.from,
      to: config.adminEmail,
      subject: `${payload.customerName || '客人'} 諮詢預約`,
      html: bookingHtml(payload, 'admin'),
      idempotencyKey: `booking-confirmation-admin/${payload.bookingId}`,
    }, fetchImpl, timeoutMs)
  ])

  if (customerEmailResult.status !== 'fulfilled' || adminEmailResult.status !== 'fulfilled') {
    throw new BookingEmailAdapterError('booking_email_delivery_failed')
  }

  return {
    customerEmailId: customerEmailResult.value.id,
    adminEmailId: adminEmailResult.value.id,
  }
}

export async function sendBookingCancellationEmails(
  payload: BookingEmailPayload,
  deps: BookingEmailAdapterDeps = {},
): Promise<{ customerEmailId: string; adminEmailId: string }> {
  const config = (deps.getConfig ?? readBookingEmailConfig)()
  if (!config) throw new BookingEmailAdapterError('booking_email_unavailable')
  const fetchImpl = deps.fetchImpl ?? fetch
  const timeoutMs = deps.timeoutMs ?? defaultTimeoutMs

  const [customerEmailResult, adminEmailResult] = await Promise.allSettled([
    sendResendEmail({
      apiKey: config.apiKey,
      from: config.from,
      to: payload.customerEmail,
      subject: `水瓶先生論命預約取消確認｜${payload.planName}`,
      html: cancellationHtml(payload, 'customer'),
      idempotencyKey: `booking-cancellation-customer/${payload.bookingId}`,
    }, fetchImpl, timeoutMs),
    sendResendEmail({
      apiKey: config.apiKey,
      from: config.from,
      to: config.adminEmail,
      subject: `${payload.customerName || '客人'} 取消諮詢預約`,
      html: cancellationHtml(payload, 'admin'),
      idempotencyKey: `booking-cancellation-admin/${payload.bookingId}`,
    }, fetchImpl, timeoutMs)
  ])

  if (customerEmailResult.status !== 'fulfilled' || adminEmailResult.status !== 'fulfilled') {
    throw new BookingEmailAdapterError('booking_email_delivery_failed')
  }

  return {
    customerEmailId: customerEmailResult.value.id,
    adminEmailId: adminEmailResult.value.id,
  }
}
