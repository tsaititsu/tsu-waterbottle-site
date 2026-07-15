import { NextResponse } from 'next/server'
import { getBookingPlan } from '@/lib/bookingPlans'
import {
  LINE_SESSION_COOKIE,
  readLineSessionCookieValue,
} from '@/lib/auth/line'
import type { BookingFormInput } from '@/lib/mockBooking'
import { getUserIdFromRequest } from '@/lib/supabase/auth'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
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

type BookingSlotClaim = {
  id: string | null
  startAt: string
  endAt: string
  restore: () => Promise<void>
}

type BookingCreateDependencies = {
  getBearerUserId: typeof getUserIdFromRequest
  readLineSession: typeof readLineSessionCookieValue
  getPlan: typeof getBookingPlan
  getServiceClient: typeof getSupabaseAdmin
  claimDbSlot: (
    supabase: ReturnType<typeof getSupabaseAdmin>,
    slotId: string,
    now: string,
  ) => Promise<BookingSlotClaim | null>
  claimDefaultSlot: (
    supabase: ReturnType<typeof getSupabaseAdmin>,
    slotId: string,
    now: Date,
  ) => Promise<BookingSlotClaim | null>
  createBooking: typeof createSupabaseBooking
  createPaymentId: () => string
  now: () => Date
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

    const planId = typeof body.planId === 'string' ? body.planId : ''
    const plan = deps.getPlan(planId)

    if (!plan) {
      return NextResponse.json({ ok: false, message: '方案不存在' }, { status: 400 })
    }
    if (!body.slotId || typeof body.slotId !== 'string') {
      return NextResponse.json({ ok: false, message: SLOT_UNAVAILABLE_MESSAGE }, { status: 409 })
    }
    if (!body.customerName || !body.customerEmail || !body.birthDate || !body.birthTime || !body.question) {
      return NextResponse.json({ ok: false, message: '預約資料不完整' }, { status: 400 })
    }

    const supabase = deps.getServiceClient()
    const now = deps.now()
    const slotId = body.slotId as string
    const claimedSlot = slotId.startsWith('default:')
      ? await deps.claimDefaultSlot(supabase, slotId, now)
      : await deps.claimDbSlot(supabase, slotId, now.toISOString())

    if (!claimedSlot) {
      return NextResponse.json({ ok: false, message: SLOT_UNAVAILABLE_MESSAGE }, { status: 409 })
    }

    let booking
    try {
      const bookingInput: CreateSupabaseBookingInput = {
        userId,
        slotId,
        planId,
        startTime: claimedSlot.startAt,
        endTime: claimedSlot.endAt,
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
    } catch (error) {
      await claimedSlot.restore()
      throw error
    }

    const bookingId = booking?.id ?? `mock-booking-${Date.now()}`
    const paymentId = deps.createPaymentId()

    return NextResponse.json({
      ok: true,
      bookingId,
      paymentId,
      planName: plan.name,
      amount: plan.price,
      persisted: Boolean(booking),
      mockCheckoutUrl: `/booking/checkout?bookingId=${bookingId}`
    })
  } catch (error) {
    const err = error as {
      message?: string
      code?: string
      details?: string
      hint?: string
      stack?: string
    }
    console.error('建立預約失敗', {
      message: err?.message,
      code: err?.code,
      details: err?.details,
      hint: err?.hint
    })

    return NextResponse.json(
      {
        ok: false,
        message: '建立預約失敗',
      },
      { status: 500 },
    )
  }
}
