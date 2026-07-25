import 'server-only'

export type CreateBookingCalendarEventPayload = {
  bookingId: string
  planName: string
  startTime: string
  endTime: string
  timezone?: string
}

type GoogleTokenResponse = {
  access_token?: string
  error?: string
  error_description?: string
}

type GoogleCalendarEventResponse = {
  id?: string
  htmlLink?: string
  error?: {
    message?: string
  }
}

const googleTokenUrl = 'https://oauth2.googleapis.com/token'
const calendarScope = 'https://www.googleapis.com/auth/calendar.events'
const defaultTimeoutMs = 10_000

type GoogleCalendarConfig = {
  clientEmail: string
  privateKey: string
  calendarId: string
  timezone: string
}

type GoogleCalendarAdapterDeps = {
  fetchImpl?: typeof fetch
  getConfig?: (timezone?: string) => GoogleCalendarConfig | null
  getAccessToken?: (config: GoogleCalendarConfig) => Promise<string>
  timeoutMs?: number
}

export class BookingCalendarAdapterError extends Error {
  constructor(
    public readonly code:
      | 'booking_calendar_unavailable'
      | 'booking_calendar_auth_failed'
      | 'booking_calendar_request_failed',
  ) {
    super(code)
    this.name = 'BookingCalendarAdapterError'
  }
}

function readGoogleCalendarConfig(timezone?: string): GoogleCalendarConfig | null {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  const calendarId = process.env.GOOGLE_CALENDAR_ID

  if (!clientEmail || !privateKey || !calendarId) return null

  return {
    clientEmail,
    privateKey,
    calendarId,
    timezone: timezone || process.env.GOOGLE_TIMEZONE || 'Asia/Taipei',
  }
}

function base64Url(input: string | Buffer) {
  return Buffer.from(input)
    .toString('base64')
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '')
}

async function createGoogleAccessToken(
  config: GoogleCalendarConfig,
  fetchImpl: typeof fetch,
  timeoutMs: number,
) {
  const { createSign } = await import('crypto')
  const now = Math.floor(Date.now() / 1000)
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claim = base64Url(
    JSON.stringify({
      iss: config.clientEmail,
      scope: calendarScope,
      aud: googleTokenUrl,
      exp: now + 3600,
      iat: now
    })
  )
  const unsignedToken = `${header}.${claim}`
  const signer = createSign('RSA-SHA256')
  signer.update(unsignedToken)
  signer.end()
  const signature = signer.sign(config.privateKey)
  const assertion = `${unsignedToken}.${base64Url(signature)}`

  try {
    const response = await fetchImpl(googleTokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion
      }),
      signal: AbortSignal.timeout(timeoutMs),
    })
    const data = (await response.json().catch(() => ({}))) as GoogleTokenResponse

    if (!response.ok || !data.access_token) {
      throw new BookingCalendarAdapterError('booking_calendar_auth_failed')
    }

    return data.access_token
  } catch (error) {
    if (error instanceof BookingCalendarAdapterError) throw error
    throw new BookingCalendarAdapterError('booking_calendar_auth_failed')
  }
}

function buildDescription(payload: CreateBookingCalendarEventPayload) {
  return [`預約編號：${payload.bookingId}`, `方案：${payload.planName}`].join('\n')
}

async function buildDeterministicEventId(bookingId: string) {
  const { createHash } = await import('crypto')
  return createHash('sha256').update(`booking:${bookingId}`).digest('hex')
}

export async function createBookingCalendarEvent(
  payload: CreateBookingCalendarEventPayload,
  deps: GoogleCalendarAdapterDeps = {},
): Promise<{ eventId: string; htmlLink: string }> {
  const fetchImpl = deps.fetchImpl ?? fetch
  const timeoutMs = deps.timeoutMs ?? defaultTimeoutMs
  const config = (deps.getConfig ?? readGoogleCalendarConfig)(payload.timezone)
  if (!config) {
    throw new BookingCalendarAdapterError('booking_calendar_unavailable')
  }

  const getAccessToken =
    deps.getAccessToken ??
    ((currentConfig: GoogleCalendarConfig) =>
      createGoogleAccessToken(currentConfig, fetchImpl, timeoutMs))
  const accessToken = await getAccessToken(config)
  const eventId = await buildDeterministicEventId(payload.bookingId)
  const eventsUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.calendarId)}/events`

  try {
    const response = await fetchImpl(
      eventsUrl,
      {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        id: eventId,
        summary: `WATERBOTTLE｜${payload.planName}`,
        description: buildDescription(payload),
        start: {
          dateTime: payload.startTime,
          timeZone: config.timezone
        },
        end: {
          dateTime: payload.endTime,
          timeZone: config.timezone
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 },
            { method: 'popup', minutes: 60 }
          ]
        }
      }),
      signal: AbortSignal.timeout(timeoutMs),
    })
    const data = (await response.json().catch(() => ({}))) as GoogleCalendarEventResponse

    if (response.status === 409) {
      const existingResponse = await fetchImpl(`${eventsUrl}/${eventId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        signal: AbortSignal.timeout(timeoutMs),
      })
      const existingData = (await existingResponse.json().catch(() => ({}))) as GoogleCalendarEventResponse
      if (!existingResponse.ok || existingData.id !== eventId) {
        throw new BookingCalendarAdapterError('booking_calendar_request_failed')
      }
      return {
        eventId,
        htmlLink: existingData.htmlLink || '',
      }
    }

    if (!response.ok || !data.id) {
      throw new BookingCalendarAdapterError('booking_calendar_request_failed')
    }

    return {
      eventId: data.id,
      htmlLink: data.htmlLink || '',
    }
  } catch (error) {
    if (error instanceof BookingCalendarAdapterError) throw error
    throw new BookingCalendarAdapterError('booking_calendar_request_failed')
  }
}

export async function cancelBookingCalendarEvent(
  eventId: string,
  deps: GoogleCalendarAdapterDeps = {},
): Promise<{ cancelled: boolean; skipped?: boolean }> {
  if (!eventId) {
    return {
      cancelled: false,
      skipped: true
    }
  }

  const fetchImpl = deps.fetchImpl ?? fetch
  const timeoutMs = deps.timeoutMs ?? defaultTimeoutMs
  const config = (deps.getConfig ?? readGoogleCalendarConfig)()
  if (!config) {
    throw new BookingCalendarAdapterError('booking_calendar_unavailable')
  }

  const getAccessToken =
    deps.getAccessToken ??
    ((currentConfig: GoogleCalendarConfig) =>
      createGoogleAccessToken(currentConfig, fetchImpl, timeoutMs))
  const accessToken = await getAccessToken(config)

  try {
    const response = await fetchImpl(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.calendarId)}/events/${encodeURIComponent(eventId)}`,
      {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
      signal: AbortSignal.timeout(timeoutMs),
    })

    if (!response.ok && response.status !== 410 && response.status !== 404) {
      throw new BookingCalendarAdapterError('booking_calendar_request_failed')
    }

    return { cancelled: true }
  } catch (error) {
    if (error instanceof BookingCalendarAdapterError) throw error
    throw new BookingCalendarAdapterError('booking_calendar_request_failed')
  }
}
