'use client'

import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useRef, useState } from 'react'
import { getBookingById, updateBookingRecord, type BookingRecord } from '@/lib/mockBooking'

function formatDateTimeText(value: string) {
  return new Date(value).toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
}

async function postJson(path: string, body: unknown) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || data.ok === false) {
    throw new Error(data.message || '同步失敗')
  }
  return data
}

function BookingSuccessContent() {
  const searchParams = useSearchParams()
  const bookingId = searchParams.get('bookingId')
  const [booking, setBooking] = useState<BookingRecord | null>(null)
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'partial' | 'error'>('idle')
  const [syncMessage, setSyncMessage] = useState('')
  const syncStartedRef = useRef(false)

  useEffect(() => {
    if (!bookingId) return
    const localBooking = getBookingById(bookingId)
    if (localBooking) {
      setBooking(localBooking)
      return
    }

    let cancelled = false
    const loadBooking = async () => {
      try {
        const response = await fetch(`/api/bookings/read?bookingId=${encodeURIComponent(bookingId)}`)
        const data = await response.json().catch(() => ({}))
        if (!cancelled && response.ok && data.ok !== false && data.booking) {
          setBooking(data.booking)
        }
      } catch {
        if (!cancelled) setBooking(null)
      }
    }

    void loadBooking()
    return () => {
      cancelled = true
    }
  }, [bookingId])

  useEffect(() => {
    if (!booking || syncStartedRef.current) return
    if (booking.googleCalendarEventId && booking.emailSentToCustomer && booking.emailSentToAdmin) {
      setSyncStatus('success')
      setSyncMessage('Google Calendar 與 Email 已完成。')
      return
    }

    syncStartedRef.current = true
    let cancelled = false

    const syncBooking = async () => {
      setSyncStatus('syncing')
      setSyncMessage('正在建立 Google Calendar 事件與寄出確認信...')

      let nextBooking = booking
      let calendarDone = Boolean(booking.googleCalendarEventId)
      let emailDone = booking.emailSentToCustomer && booking.emailSentToAdmin
      const errors: string[] = []

      try {
        await postJson('/api/bookings/update', {
          bookingId: booking.id,
          updates: {
            status: 'confirmed',
            paymentId: booking.paymentId ?? `mock-payment-${booking.id}`
          }
        })
      } catch (error) {
        errors.push(error instanceof Error ? error.message : '付款狀態寫入資料庫失敗')
      }

      if (!calendarDone) {
        try {
          const calendarResult = await postJson('/api/calendar/create-event', {
            bookingId: booking.id,
            customerName: booking.customerName,
            customerEmail: booking.customerEmail,
            customerPhone: booking.customerPhone,
            planName: booking.planName,
            startTime: booking.startTime,
            endTime: booking.endTime,
            timezone: booking.timezone,
            birthDate: booking.birthDate,
            birthTime: booking.birthTime,
            birthPlace: booking.birthPlace,
            gender: booking.gender,
            question: booking.question
          })
          const updated = updateBookingRecord(booking.id, {
            googleCalendarEventId: calendarResult.eventId,
            googleCalendarEventLink: calendarResult.htmlLink
          })
          await postJson('/api/bookings/update', {
            bookingId: booking.id,
            updates: {
              googleCalendarEventId: calendarResult.eventId,
              googleCalendarEventLink: calendarResult.htmlLink
            }
          })
          if (updated) nextBooking = updated
          calendarDone = true
        } catch (error) {
          errors.push(error instanceof Error ? error.message : 'Google Calendar 建立失敗')
        }
      }

      if (!emailDone) {
        try {
          await postJson('/api/email/send-booking-confirmation', {
            bookingId: booking.id,
            customerName: booking.customerName,
            customerEmail: booking.customerEmail,
            customerPhone: booking.customerPhone,
            planName: booking.planName,
            amount: booking.amount,
            startTimeText: formatDateTimeText(booking.startTime),
            endTimeText: formatDateTimeText(booking.endTime),
            birthDate: booking.birthDate,
            birthTime: booking.birthTime,
            birthPlace: booking.birthPlace,
            gender: booking.gender,
            isBirthTimeAccurate: booking.isBirthTimeAccurate,
            question: booking.question
          })
          const updated = updateBookingRecord(booking.id, {
            emailSentToCustomer: true,
            emailSentToAdmin: true
          })
          await postJson('/api/bookings/update', {
            bookingId: booking.id,
            updates: {
              emailSentToCustomer: true,
              emailSentToAdmin: true
            }
          })
          if (updated) nextBooking = updated
          emailDone = true
        } catch (error) {
          errors.push(error instanceof Error ? error.message : 'Email 寄送失敗')
        }
      }

      if (cancelled) return
      setBooking(nextBooking)

      if (calendarDone && emailDone) {
        setSyncStatus('success')
        setSyncMessage('Google Calendar 已建立，確認信也已寄出。')
      } else if (calendarDone || emailDone) {
        setSyncStatus('partial')
        setSyncMessage(`部分完成：${errors.join('；')}`)
      } else {
        setSyncStatus('error')
        setSyncMessage(errors.join('；') || '同步失敗，請稍後再試。')
      }
    }

    void syncBooking()

    return () => {
      cancelled = true
    }
  }, [booking])

  return (
    <section className="bg-softPurple py-16 md:py-24">
      <div className="section-shell max-w-2xl rounded-[28px] border border-borderSoft bg-white p-8 text-center shadow-soft">
        <CheckCircle2 className="mx-auto text-gold" size={54} />
        <h1 className="mt-5 font-serifTC text-3xl font-semibold text-deepPurple">預約成功</h1>
        <p className="mt-4 leading-7 text-textMuted">
          你的水瓶先生論命預約已完成付款。系統會建立 Google Calendar 事件，並寄出確認信給你與老師。
        </p>
        {syncMessage && (
          <p
            className={`mt-4 rounded-xl px-4 py-3 text-sm font-semibold ${
              syncStatus === 'success'
                ? 'bg-softPurple text-deepPurple'
                : syncStatus === 'error'
                  ? 'bg-lightGold text-darkGold'
                  : 'bg-white text-textMuted ring-1 ring-borderSoft'
            }`}
          >
            {syncMessage}
          </p>
        )}
        {booking && (
          <div className="mt-6 rounded-2xl border border-borderSoft bg-softPurple p-5 text-left">
            <p className="font-semibold text-deepPurple">{booking.planName}</p>
            <p className="mt-2 text-sm text-textMuted">
              {new Date(booking.startTime).toLocaleString('zh-TW')} - {new Date(booking.endTime).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}
            </p>
            <p className="mt-2 text-sm text-textMuted">預約人：{booking.customerName}</p>
            {booking.googleCalendarEventLink && (
              <a className="mt-3 inline-flex text-sm font-semibold text-deepPurple underline" href={booking.googleCalendarEventLink} target="_blank" rel="noreferrer">
                開啟 Google Calendar 事件
              </a>
            )}
          </div>
        )}
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <Link className="focus-ring rounded-lg bg-deepPurple px-6 py-3 font-semibold text-white" href="/account/bookings">
            查看我的預約
          </Link>
          <Link className="focus-ring rounded-lg border border-borderSoft bg-white px-6 py-3 font-semibold text-deepPurple" href="/">
            返回首頁
          </Link>
        </div>
      </div>
    </section>
  )
}

export default function BookingSuccessPage() {
  return (
    <Suspense fallback={null}>
      <BookingSuccessContent />
    </Suspense>
  )
}
