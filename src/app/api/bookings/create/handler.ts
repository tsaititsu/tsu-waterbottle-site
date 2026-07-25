import { NextResponse } from 'next/server'
import { getBookingPlan } from '@/lib/bookingPlans'
import {
  LINE_SESSION_COOKIE,
  readLineSessionCookieValue,
} from '@/lib/auth/line'
import type { BookingFormInput } from '@/lib/bookings/types'
import { getUserIdFromRequest } from '@/lib/supabase/auth'
import {
  createSupabaseBooking,
  type CreateSupabaseBookingInput,
} from '@/lib/supabase/bookings'

const SLOT_UNAVAILABLE_MESSAGE = '此時段已無法預約，請重新選擇其他時段。'
const UNAUTHORIZED_MESSAGE = '請先登入會員，再建立預約。'
const INVALID_OWNER_MESSAGE = '預約資料不得包含會員識別欄位。'
const STRICT_BEARER_PATTERN = /^Bearer [^\s]+$/
const SUPABASE_USER_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DATABASE_SLOT_ID_PATTERN =
  /^db:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const BOOKING_CREATE_FIELDS = new Set([
  'slotId',
  'planId',
  'startTime',
  'endTime',
  'customerName',
  'customerEmail',
  'customerPhone',
  'lineDisplayName',
  'gender',
  'birthDate',
  'birthTime',
  'birthPlace',
  'isBirthTimeAccurate',
  'question',
  'note',
])

type BookingCreateDependencies = {
  getBearerUserId: typeof getUserIdFromRequest
  readLineSession: typeof readLineSessionCookieValue
  getPlan: typeof getBookingPlan
  createBooking: typeof createSupabaseBooking
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function readRequestCookie(req: Request, name: string) {
  const cookieHeader = req.headers.get('cookie')
  if (!cookieHeader) return null

  for (const entry of cookieHeader.split(';')) {
    const trimmed = entry.trim()
    const separatorIndex = trimmed.indexOf('=')
    if (separatorIndex < 0 || trimmed.slice(0, separatorIndex) !== name) continue

    const value = trimmed.slice(separatorIndex + 1)
    try {
      return decodeURIComponent(value)
    } catch {
      return null
    }
  }

  return null
}

function normalizeTrustedUserId(value: string | null | undefined) {
  const userId = value?.trim()
  return userId || null
}

async function resolveBookingUserId(
  req: Request,
  deps: Pick<BookingCreateDependencies, 'getBearerUserId' | 'readLineSession'>,
) {
  const authorization = req.headers.get('authorization')

  if (authorization !== null) {
    if (!STRICT_BEARER_PATTERN.test(authorization)) return null
    return normalizeTrustedUserId(await deps.getBearerUserId(req).catch(() => null))
  }

  const cookieValue = readRequestCookie(req, LINE_SESSION_COOKIE)
  if (!cookieValue) return null

  const lineUser = (() => {
    try {
      return deps.readLineSession(cookieValue)
    } catch {
      return null
    }
  })()
  const userId = normalizeTrustedUserId(lineUser?.id)

  return userId && SUPABASE_USER_ID_PATTERN.test(userId) ? userId : null
}

export async function handleBookingCreateRequest(
  req: Request,
  deps: BookingCreateDependencies,
) {
  try {
    const userId = await resolveBookingUserId(req, deps)
    if (!userId) {
      return NextResponse.json(
        { ok: false, message: UNAUTHORIZED_MESSAGE },
        { status: 401 },
      )
    }

    const body = await req.json().catch(() => null)
    if (!isPlainObject(body)) {
      return NextResponse.json(
        { ok: false, message: '預約資料不完整' },
        { status: 400 },
      )
    }

    if (Object.prototype.hasOwnProperty.call(body, 'userId')) {
      return NextResponse.json(
        { ok: false, message: INVALID_OWNER_MESSAGE },
        { status: 400 },
      )
    }
    if (Object.keys(body).some((key) => !BOOKING_CREATE_FIELDS.has(key))) {
      return NextResponse.json(
        { ok: false, message: '預約資料包含不允許的欄位。' },
        { status: 400 },
      )
    }

    const planId = typeof body.planId === 'string' ? body.planId : ''
    const plan = deps.getPlan(planId)

    if (!plan) {
      return NextResponse.json({ ok: false, message: '方案不存在' }, { status: 400 })
    }
    if (
      typeof body.slotId !== 'string' ||
      !DATABASE_SLOT_ID_PATTERN.test(body.slotId)
    ) {
      return NextResponse.json({ ok: false, message: SLOT_UNAVAILABLE_MESSAGE }, { status: 409 })
    }
    if (!body.customerName || !body.customerEmail || !body.birthDate || !body.birthTime || !body.question) {
      return NextResponse.json({ ok: false, message: '預約資料不完整' }, { status: 400 })
    }

    const slotId = body.slotId as string

    let booking
    try {
      const bookingInput: CreateSupabaseBookingInput = {
        userId,
        slotId,
        planId,
        customerName: body.customerName as string,
        customerEmail: body.customerEmail as string,
        customerPhone:
          typeof body.customerPhone === 'string' ? body.customerPhone : undefined,
        lineDisplayName:
          typeof body.lineDisplayName === 'string' ? body.lineDisplayName : undefined,
        gender: body.gender as BookingFormInput['gender'],
        birthDate: body.birthDate as string,
        birthTime: body.birthTime as string,
        birthPlace: typeof body.birthPlace === 'string' ? body.birthPlace : undefined,
        isBirthTimeAccurate: body.isBirthTimeAccurate as boolean,
        question: body.question as string,
        note: typeof body.note === 'string' ? body.note : undefined,
      }
      booking = await deps.createBooking(bookingInput)
      if (!booking) {
        return NextResponse.json(
          { ok: false, message: '預約服務暫時無法使用。' },
          { status: 503 },
        )
      }
    } catch (error) {
      const errorCode =
        error &&
        typeof error === 'object' &&
        'code' in error &&
        typeof error.code === 'string'
          ? error.code
          : null
      if (errorCode === 'booking_slot_unavailable') {
        return NextResponse.json(
          { ok: false, message: SLOT_UNAVAILABLE_MESSAGE },
          { status: 409 },
        )
      }
      if (errorCode === 'booking_plan_unavailable') {
        return NextResponse.json(
          { ok: false, message: '此方案目前無法預約。' },
          { status: 409 },
        )
      }
      throw error
    }

    const bookingId = booking.id
    return NextResponse.json({
      ok: true,
      bookingId,
      planName: booking.planName,
      amount: booking.amount,
    })
  } catch {
    console.error('建立預約失敗')

    return NextResponse.json(
      {
        ok: false,
        message: '建立預約失敗',
      },
      { status: 500 },
    )
  }
}
