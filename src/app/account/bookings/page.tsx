'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { LoginModal } from '@/components/LoginModal'
import { PageHero } from '@/components/PageHero'
import { CancelBookingModal, type CancelBookingSummary } from '@/components/bookings/CancelBookingModal'
import { createAsyncIdentityGuard } from '@/lib/auth/asyncIdentityGuard'
import type { BookingMemberListItem } from '@/lib/bookings/types'
import { getAuthAccessToken, getMockUser, subscribeAuthChange, type UserProfile } from '@/lib/mockAuth'

const cancellationLimitHours = 24
const lineSupportUrl = 'https://lin.ee/6Tpje1P'

function canCancelBooking(booking: BookingMemberListItem) {
  if (booking.status !== 'confirmed' || booking.paymentStatus !== 'paid') return false
  const start = new Date(booking.startTime).getTime()
  return start - Date.now() > cancellationLimitHours * 60 * 60 * 1000
}

function paymentStatusLabel(paymentStatus: BookingMemberListItem['paymentStatus']) {
  if (paymentStatus === 'paid') return '已付款'
  if (paymentStatus === 'pending') return '待付款'
  if (paymentStatus === 'failed') return '失敗'
  if (paymentStatus === 'refunded') return '已退款'
  return '狀態未確認'
}

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

export default function AccountBookingsPage() {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [bookings, setBookings] = useState<BookingMemberListItem[]>([])
  const [totalBookings, setTotalBookings] = useState(0)
  const [loginOpen, setLoginOpen] = useState(false)
  const [cancelingId, setCancelingId] = useState('')
  const [bookingToCancel, setBookingToCancel] = useState<BookingMemberListItem | null>(null)
  const [cancellationError, setCancellationError] = useState('')
  const [statusMessage, setStatusMessage] = useState<ReactNode>('')
  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle')
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const loadRequestGenerationRef = useRef(0)
  const cancelInFlightRef = useRef(false)
  const cancelBookingIdRef = useRef('')
  const [cancelGuard] = useState(() => createAsyncIdentityGuard())

  const loadBookings = useCallback(async (requestGeneration: number, offset = 0) => {
    if (offset > 0) setIsLoadingMore(true)
    try {
      const accessToken = await getAuthAccessToken()
      if (requestGeneration !== loadRequestGenerationRef.current || !accessToken) return
      const response = await fetch(`/api/bookings/list?limit=20&offset=${offset}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const data = await response.json().catch(() => ({}))
      if (requestGeneration !== loadRequestGenerationRef.current) return

      if (response.ok && data.ok !== false && Array.isArray(data.bookings)) {
        setBookings((current) => offset === 0 ? data.bookings : [...current, ...data.bookings])
        setTotalBookings(Number.isSafeInteger(data.meta?.total) ? data.meta.total : data.bookings.length)
        setLoadStatus('loaded')
        return
      }
      if (offset === 0) {
        setBookings([])
        setLoadStatus('error')
      }
    } catch {
      if (requestGeneration === loadRequestGenerationRef.current) {
        if (offset === 0) {
          setBookings([])
          setLoadStatus('error')
        } else {
          setStatusMessage('無法載入更多預約，請稍後再試。')
        }
      }
    } finally {
      if (requestGeneration === loadRequestGenerationRef.current) {
        setIsLoadingMore(false)
      }
    }
  }, [])

  useEffect(() => {
    const sync = () => {
      const requestGeneration = ++loadRequestGenerationRef.current
      const nextUser = getMockUser()
      setUser(nextUser)
      setLoginOpen(!nextUser)
      setBookings([])
      setTotalBookings(0)
      setBookingToCancel(null)
      cancelBookingIdRef.current = ''
      cancelGuard.invalidate()
      cancelInFlightRef.current = false
      setCancellationError('')
      setStatusMessage('')
      setIsLoadingMore(false)
      setLoadStatus(nextUser ? 'loading' : 'idle')
      if (nextUser) void loadBookings(requestGeneration)
    }

    sync()
    const unsubscribeAuth = subscribeAuthChange(sync)
    return () => {
      unsubscribeAuth()
      loadRequestGenerationRef.current += 1
      cancelGuard.invalidate()
      cancelInFlightRef.current = false
    }
  }, [cancelGuard, loadBookings])

  const closeCancellationModal = useCallback(() => {
    setBookingToCancel(null)
    setCancellationError('')
  }, [])

  function openCancellationModal(booking: BookingMemberListItem) {
    if (!canCancelBooking(booking)) {
      setStatusMessage(
        <>
          距離預約開始 {cancellationLimitHours} 小時內不可自行取消，請私訊
          <a className="underline underline-offset-4" href={lineSupportUrl} rel="noopener noreferrer" target="_blank">
            官方 LINE
          </a>
          協助。
        </>
      )
      return
    }

    setCancellationError('')
    setBookingToCancel(booking)
    cancelBookingIdRef.current = booking.id
  }

  async function cancelBooking(booking: BookingMemberListItem, reason: string) {
    if (cancelInFlightRef.current) return
    cancelBookingIdRef.current = booking.id
    const currentIdentity = () => ({
      resourceKey: cancelBookingIdRef.current,
      subjectId: getMockUser()?.id ?? null,
    })
    const requestToken = cancelGuard.begin(currentIdentity())
    if (!requestToken) return
    const isCurrentRequest = () =>
      cancelGuard.isCurrent(requestToken, currentIdentity())
    cancelInFlightRef.current = true
    setCancelingId(booking.id)
    setCancellationError('')
    setStatusMessage('正在取消預約...')

    let cancelledBooking: BookingMemberListItem
    let accessToken = ''
    try {
      accessToken = await getAuthAccessToken() ?? ''
      if (!isCurrentRequest()) return
      if (!accessToken) throw new Error('booking_access_token_missing')
      const result = await postJson(
        '/api/bookings/update',
        {
          bookingId: booking.id,
          cancellationReason: reason,
        },
        accessToken,
      ) as { booking?: BookingMemberListItem }
      if (!isCurrentRequest()) return
      if (!result.booking) throw new Error('取消預約失敗')
      cancelledBooking = result.booking
    } catch {
      if (!isCurrentRequest()) return
      setCancelingId('')
      setStatusMessage('')
      setCancellationError('取消預約失敗，請稍後再試；已輸入的取消原因會保留。')
      cancelInFlightRef.current = false
      return
    }

    if (!isCurrentRequest()) return
    setBookings((current) => current.map((item) => (
      item.id === cancelledBooking.id ? cancelledBooking : item
    )))

    const errors: string[] = []
    let calendarCancelled = Boolean(cancelledBooking.googleCalendarCancelled)
    let emailsSent = Boolean(
      cancelledBooking.cancellationEmailSentToCustomer &&
      cancelledBooking.cancellationEmailSentToAdmin
    )

    if (!calendarCancelled) {
      try {
        if (!isCurrentRequest()) return
        await postJson('/api/calendar/cancel-event', { bookingId: booking.id }, accessToken)
        if (!isCurrentRequest()) return
        calendarCancelled = true
      } catch (error) {
        errors.push(error instanceof Error ? error.message : 'Google Calendar 取消失敗')
      }
    }

    if (!emailsSent) {
      try {
        if (!isCurrentRequest()) return
        await postJson('/api/email/send-booking-cancellation', { bookingId: booking.id }, accessToken)
        if (!isCurrentRequest()) return
        emailsSent = true
      } catch (error) {
        errors.push(error instanceof Error ? error.message : '取消通知信寄送失敗')
      }
    }

    if (!isCurrentRequest()) return
    setBookings((current) => current.map((item) => (
      item.id === cancelledBooking.id
        ? {
            ...item,
            googleCalendarCancelled: calendarCancelled,
            cancellationEmailSentToCustomer: emailsSent,
            cancellationEmailSentToAdmin: emailsSent,
          }
        : item
    )))

    setCancelingId('')
    cancelInFlightRef.current = false
    closeCancellationModal()
    if (errors.length > 0) {
      setStatusMessage(`預約已標記取消，但部分同步失敗：${errors.join('；')}`)
    } else {
      setStatusMessage('預約已取消，Google Calendar 已刪除，取消通知信也已寄出。')
    }
  }

  return (
    <>
      <PageHero
        eyebrow="會員中心"
        title="我的水瓶先生論命預約"
        description="查看已付款與已確認的水瓶先生論命預約紀錄。"
      />
      <section className="bg-white py-12 md:py-16">
        <div className="section-shell grid gap-5">
          {statusMessage && <div aria-live="polite" className="rounded-2xl border border-borderSoft bg-softPurple p-4 text-sm font-semibold text-deepPurple">{statusMessage}</div>}
          {user && loadStatus === 'loaded' ? (
            <p className="text-sm text-textMuted">
              目前顯示最近 {bookings.length} 筆，共 {totalBookings} 筆預約。
            </p>
          ) : null}
          {!user ? (
            <div className="rounded-2xl border border-borderSoft bg-softPurple p-6 text-textMuted">請先登入會員查看預約紀錄。</div>
          ) : loadStatus === 'loading' ? (
            <div aria-live="polite" className="rounded-2xl border border-borderSoft bg-softPurple p-6 text-textMuted">正在讀取預約紀錄...</div>
          ) : loadStatus === 'error' ? (
            <div role="alert" className="rounded-2xl border border-borderSoft bg-softPurple p-6 text-textMuted">暫時無法讀取預約紀錄，請稍後重新整理再試。</div>
          ) : bookings.length === 0 ? (
            <div className="rounded-2xl border border-borderSoft bg-softPurple p-6">
              <p className="text-textMuted">目前尚無水瓶先生論命預約。</p>
              <Link className="focus-ring mt-5 inline-flex rounded-lg bg-deepPurple px-5 py-3 font-semibold text-white" href="/booking">
                立即預約
              </Link>
            </div>
          ) : (
            <>
              {bookings.map((booking) => (
                <article key={booking.id} className="grid gap-4 rounded-2xl border border-borderSoft bg-white p-5 shadow-soft lg:grid-cols-[1fr_auto] lg:items-center">
                <div>
                  <p className="font-serifTC text-xl font-semibold text-deepPurple">{booking.planName}</p>
                  <p className="mt-2 text-sm text-textMuted">
                    {new Date(booking.startTime).toLocaleString('zh-TW')} - {new Date(booking.endTime).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <p className="mt-2 line-clamp-2 text-sm text-textMuted">問題：{booking.question}</p>
                  <p className="mt-2 text-xs text-textMuted">建立時間：{new Date(booking.createdAt).toLocaleString('zh-TW')}</p>
                </div>
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <span className="rounded-full bg-lightGold px-3 py-1 text-xs font-semibold text-darkGold">付款：{paymentStatusLabel(booking.paymentStatus)}</span>
                  <span className="rounded-full bg-softPurple px-3 py-1 text-xs font-semibold text-deepPurple">預約：{booking.status === 'confirmed' ? '已確認' : booking.status === 'cancelled' ? '已取消' : booking.status}</span>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-textMuted ring-1 ring-borderSoft">
                    Calendar：{booking.googleCalendarCancelled ? '已取消' : booking.googleCalendarEventId ? '已建立' : '未建立'}
                  </span>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-textMuted ring-1 ring-borderSoft">
                    Email：{booking.emailSentToCustomer ? '已寄出' : '未寄出'}
                  </span>
                  {booking.status === 'cancelled' ? (
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-textMuted ring-1 ring-borderSoft">
                      取消時間：{booking.cancelledAt ? new Date(booking.cancelledAt).toLocaleString('zh-TW') : '已取消'}
                    </span>
                  ) : canCancelBooking(booking) ? (
                    <button
                      className="min-h-11 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-deepPurple ring-1 ring-deepPurple disabled:opacity-60"
                      data-testid="open-cancel-booking"
                      disabled={cancelingId === booking.id}
                      onClick={() => openCancellationModal(booking)}
                      type="button"
                    >
                      {cancelingId === booking.id ? '取消中...' : '取消預約'}
                    </button>
                  ) : (
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-textMuted ring-1 ring-borderSoft">
                      24 小時內請私訊
                      <a className="text-deepPurple underline underline-offset-4" href={lineSupportUrl} rel="noopener noreferrer" target="_blank">
                        官方 LINE
                      </a>
                    </span>
                  )}
                </div>
                </article>
              ))}
              {bookings.length < totalBookings ? (
                <button
                  className="focus-ring mx-auto min-h-11 rounded-lg border border-deepPurple bg-white px-5 py-3 font-semibold text-deepPurple disabled:opacity-60"
                  disabled={isLoadingMore}
                  onClick={() => void loadBookings(loadRequestGenerationRef.current, bookings.length)}
                  type="button"
                >
                  {isLoadingMore ? '載入中...' : '載入更多預約'}
                </button>
              ) : null}
            </>
          )}
        </div>
      </section>
      {bookingToCancel ? (
        <CancelBookingModal
          bookingId={bookingToCancel.id}
          error={cancellationError}
          loading={cancelingId === bookingToCancel.id}
          onClose={closeCancellationModal}
          onConfirm={(reason) => cancelBooking(bookingToCancel, reason)}
          open
          summary={
            {
              date: new Date(bookingToCancel.startTime).toLocaleDateString('zh-TW', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'short',
              }),
              time: `${new Date(bookingToCancel.startTime).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })} - ${new Date(bookingToCancel.endTime).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}`,
              service: bookingToCancel.planName,
            } satisfies CancelBookingSummary
          }
        />
      ) : null}
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} onSuccess={() => setLoginOpen(false)} />
    </>
  )
}
