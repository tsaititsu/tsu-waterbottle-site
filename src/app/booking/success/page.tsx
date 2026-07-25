'use client'

import Link from 'next/link'
import { CheckCircle2, Clock3, CircleAlert } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useRef, useState } from 'react'
import { createAsyncIdentityGuard } from '@/lib/auth/asyncIdentityGuard'
import { isTrustedPaidBooking } from '@/lib/bookings/bookingSuccess'
import type { BookingRecord } from '@/lib/bookings/types'
import { getAuthAccessToken, getMockUser, subscribeAuthChange } from '@/lib/mockAuth'

async function postJson(path: string, body: unknown, accessToken?: string | null) {
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
    },
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
  const [loadStatus, setLoadStatus] = useState<'loading' | 'loaded' | 'error'>('loading')
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'partial' | 'error'>('idle')
  const [syncMessage, setSyncMessage] = useState('')
  const syncBookingIdRef = useRef('')
  const bookingIdRef = useRef(bookingId ?? '')
  const [requestGuard] = useState(() => createAsyncIdentityGuard())

  useEffect(() => {
    const nextBookingId = bookingId ?? ''
    if (bookingIdRef.current !== nextBookingId) {
      bookingIdRef.current = nextBookingId
      requestGuard.invalidate()
    }
  }, [bookingId, requestGuard])

  useEffect(() => {
    const loadBooking = async () => {
      requestGuard.invalidate()
      setBooking(null)
      setSyncStatus('idle')
      setSyncMessage('')
      syncBookingIdRef.current = ''

      if (!bookingId || !getMockUser()) {
        setLoadStatus('error')
        return
      }

      const currentIdentity = () => ({
        resourceKey: bookingIdRef.current,
        subjectId: getMockUser()?.id ?? null,
      })
      const requestToken = requestGuard.begin(currentIdentity())
      if (!requestToken) {
        setLoadStatus('error')
        return
      }
      setLoadStatus('loading')

      try {
        const accessToken = await getAuthAccessToken()
        if (!requestGuard.isCurrent(requestToken, currentIdentity()) || !accessToken) return
        const response = await fetch(`/api/bookings/read?bookingId=${encodeURIComponent(bookingId)}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        const data = await response.json().catch(() => ({}))
        if (!requestGuard.isCurrent(requestToken, currentIdentity())) return
        if (response.ok && data.ok !== false && data.booking) {
          setBooking(data.booking)
          setLoadStatus('loaded')
        } else {
          setBooking(null)
          setLoadStatus('error')
        }
      } catch {
        if (requestGuard.isCurrent(requestToken, currentIdentity())) {
          setBooking(null)
          setLoadStatus('error')
        }
      }
    }

    void loadBooking()
    const unsubscribeAuth = subscribeAuthChange(() => {
      void loadBooking()
    })
    return () => {
      unsubscribeAuth()
      requestGuard.invalidate()
    }
  }, [bookingId, requestGuard])

  useEffect(() => {
    if (!booking || !isTrustedPaidBooking(booking) || syncBookingIdRef.current === booking.id) return
    if (booking.googleCalendarEventId && booking.emailSentToCustomer && booking.emailSentToAdmin) {
      syncBookingIdRef.current = booking.id
      setSyncStatus('success')
      setSyncMessage('Google Calendar 與 Email 已完成。')
      return
    }

    syncBookingIdRef.current = booking.id

    const syncBooking = async () => {
      const currentIdentity = () => ({
        resourceKey: bookingIdRef.current,
        subjectId: getMockUser()?.id ?? null,
      })
      const requestToken = requestGuard.begin(currentIdentity())
      if (!requestToken) return
      setSyncStatus('syncing')
      setSyncMessage('正在建立 Google Calendar 事件與寄出確認信...')

      let nextBooking = booking
      let calendarDone = Boolean(booking.googleCalendarEventId)
      let emailDone = booking.emailSentToCustomer && booking.emailSentToAdmin
      const errors: string[] = []
      let accessToken = ''
      try {
        accessToken = await getAuthAccessToken() ?? ''
      } catch {
        if (requestGuard.isCurrent(requestToken, currentIdentity())) {
          setSyncStatus('error')
          setSyncMessage('同步失敗，請稍後再試。')
        }
        return
      }
      if (!requestGuard.isCurrent(requestToken, currentIdentity()) || !accessToken) return

      if (!calendarDone) {
        try {
          if (!requestGuard.isCurrent(requestToken, currentIdentity())) return
          const calendarResult = await postJson('/api/calendar/create-event', { bookingId: booking.id }, accessToken)
          if (!requestGuard.isCurrent(requestToken, currentIdentity())) return
          nextBooking = {
            ...nextBooking,
            googleCalendarEventId: calendarResult.eventId,
            googleCalendarEventLink: calendarResult.htmlLink,
          }
          calendarDone = true
        } catch (error) {
          errors.push(error instanceof Error ? error.message : 'Google Calendar 建立失敗')
        }
      }

      if (!emailDone) {
        try {
          if (!requestGuard.isCurrent(requestToken, currentIdentity())) return
          // 安全設計：只傳 bookingId，信件收件人與內容由後端從 booking record 推導。
          await postJson('/api/email/send-booking-confirmation', { bookingId: booking.id }, accessToken)
          if (!requestGuard.isCurrent(requestToken, currentIdentity())) return
          nextBooking = {
            ...nextBooking,
            emailSentToCustomer: true,
            emailSentToAdmin: true,
          }
          emailDone = true
        } catch (error) {
          errors.push(error instanceof Error ? error.message : 'Email 寄送失敗')
        }
      }

      if (!requestGuard.isCurrent(requestToken, currentIdentity())) return
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
      requestGuard.invalidate()
    }
  }, [booking, requestGuard])

  useEffect(() => () => requestGuard.invalidate(), [requestGuard])

  const trustedPaid = isTrustedPaidBooking(booking)
  const title = loadStatus === 'error' ? '無法確認預約' : trustedPaid ? '預約成功' : '付款確認中'
  const description =
    loadStatus === 'error'
      ? '找不到這筆預約，或你沒有權限查看。請回到會員中心確認預約狀態。'
      : trustedPaid
        ? '你的水瓶先生論命預約已完成付款。系統會建立 Google Calendar 事件，並寄出確認信給你與老師。'
        : '付款結果尚未由系統確認。確認完成後才會建立 Google Calendar 事件並寄出確認信。'
  const StatusIcon = loadStatus === 'error' ? CircleAlert : trustedPaid ? CheckCircle2 : Clock3

  return (
    <section className="bg-softPurple py-16 md:py-24">
      <div className="section-shell max-w-2xl rounded-[28px] border border-borderSoft bg-white p-8 text-center shadow-soft">
        <StatusIcon className="mx-auto text-gold" size={54} />
        <h1 className="mt-5 font-serifTC text-3xl font-semibold text-deepPurple">{title}</h1>
        <p className="mt-4 leading-7 text-textMuted">{description}</p>
        {trustedPaid && syncMessage && (
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
        {trustedPaid && booking && (
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
