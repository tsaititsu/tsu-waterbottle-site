export type CreateBookingCalendarEventPayload = {
  bookingId: string
  customerName: string
  customerEmail: string
  customerPhone?: string
  planName: string
  startTime: string
  endTime: string
  timezone?: string
  birthDate?: string
  birthTime?: string
  birthPlace?: string
  gender?: string
  question?: string
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

function base64Url(input: string | Buffer) {
  return Buffer.from(input)
    .toString('base64')
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '')
}

async function createGoogleAccessToken(clientEmail: string, privateKey: string) {
  const { createSign } = await import('crypto')
  const now = Math.floor(Date.now() / 1000)
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claim = base64Url(
    JSON.stringify({
      iss: clientEmail,
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
  const signature = signer.sign(privateKey)
  const assertion = `${unsignedToken}.${base64Url(signature)}`

  const response = await fetch(googleTokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion
    })
  })
  const data = (await response.json()) as GoogleTokenResponse

  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || 'Google 權杖建立失敗')
  }

  return data.access_token
}

function buildDescription(payload: CreateBookingCalendarEventPayload) {
  return [
    `預約編號：${payload.bookingId}`,
    `客戶姓名：${payload.customerName}`,
    `Email：${payload.customerEmail}`,
    payload.customerPhone ? `電話：${payload.customerPhone}` : '',
    `方案：${payload.planName}`,
    payload.gender ? `性別：${payload.gender}` : '',
    payload.birthDate ? `生日：${payload.birthDate}` : '',
    payload.birthTime ? `時辰：${payload.birthTime}` : '',
    payload.birthPlace ? `出生地：${payload.birthPlace}` : '',
    payload.question ? `諮詢問題：${payload.question}` : ''
  ]
    .filter(Boolean)
    .join('\n')
}

export async function createBookingCalendarEvent(payload: CreateBookingCalendarEventPayload) {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  const calendarId = process.env.GOOGLE_CALENDAR_ID
  const timezone = payload.timezone || process.env.GOOGLE_TIMEZONE || 'Asia/Taipei'

  if (!clientEmail || !privateKey || !calendarId) {
    return {
      mocked: true,
      eventId: `mock-calendar-${payload.bookingId}`,
      htmlLink: `https://calendar.google.com/calendar/event?eid=${encodeURIComponent(payload.bookingId)}`,
      raw: payload
    }
  }

  const accessToken = await createGoogleAccessToken(clientEmail, privateKey)
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        summary: `WATERBOTTLE｜${payload.planName}｜${payload.customerName}`,
        description: buildDescription(payload),
        start: {
          dateTime: payload.startTime,
          timeZone: timezone
        },
        end: {
          dateTime: payload.endTime,
          timeZone: timezone
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 },
            { method: 'popup', minutes: 60 }
          ]
        }
      })
    }
  )
  const data = (await response.json()) as GoogleCalendarEventResponse

  if (!response.ok || !data.id) {
    throw new Error(data.error?.message || 'Google Calendar 建立事件失敗')
  }

  return {
    mocked: false,
    eventId: data.id,
    htmlLink: data.htmlLink || '',
    raw: data
  }
}

export async function cancelBookingCalendarEvent(eventId: string) {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  const calendarId = process.env.GOOGLE_CALENDAR_ID

  if (!eventId) {
    return {
      mocked: false,
      cancelled: false,
      skipped: true
    }
  }

  if (!clientEmail || !privateKey || !calendarId) {
    return {
      mocked: true,
      cancelled: true,
      eventId
    }
  }

  const accessToken = await createGoogleAccessToken(clientEmail, privateKey)
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  )

  if (!response.ok && response.status !== 410 && response.status !== 404) {
    const data = (await response.json().catch(() => ({}))) as GoogleCalendarEventResponse
    throw new Error(data.error?.message || 'Google Calendar 取消事件失敗')
  }

  return {
    mocked: false,
    cancelled: true,
    eventId
  }
}
