'use client'

import Link from 'next/link'
import { useEffect, useState, type ReactNode } from 'react'
import { LoginModal } from '@/components/LoginModal'
import { PageHero } from '@/components/PageHero'
import { getAuthAccessToken, getMockUser, subscribeAuthChange, type UserProfile } from '@/lib/mockAuth'
import { getUserBookingRecords, subscribeBookingChange, updateBookingRecord, type BookingRecord } from '@/lib/mockBooking'

const cancellationLimitHours = 24
const lineSupportUrl = 'https://lin.ee/6Tpje1P'

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

function canCancelBooking(booking: BookingRecord) {
  if (booking.status !== 'confirmed') return false
  const start = new Date(booking.startTime).getTime()
  return start - Date.now() > cancellationLimitHours * 60 * 60 * 1000
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

export default function AccountBookingsPage() {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [bookings, setBookings] = useState<BookingRecord[]>([])
  const [loginOpen, setLoginOpen] = useState(false)
  const [cancelingId, setCancelingId] = useState('')
  const [statusMessage, setStatusMessage] = useState<ReactNode>('')

  useEffect(() => {
    let cancelled = false

    async function loadBookings() {
      try {
        const accessToken = await getAuthAccessToken()
        const response = await fetch('/api/bookings/list', {
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
        })
        const data = await response.json().catch(() => ({}))
        if (!cancelled && response.ok && data.ok !== false && Array.isArray(data.bookings)) {
          setBookings(data.bookings)
          return
        }
      } catch {
        // Keep local fallback below.
      }

      if (!cancelled) setBookings(getUserBookingRecords())
    }

    const sync = () => {
      const nextUser = getMockUser()
      setUser(nextUser)
      setLoginOpen(!nextUser)
      void loadBookings()
    }

    sync()
    const unsubscribeAuth = subscribeAuthChange(sync)
    const unsubscribeBooking = subscribeBookingChange(sync)
    return () => {
      unsubscribeAuth()
      unsubscribeBooking()
      cancelled = true
    }
  }, [])

  async function cancelBooking(booking: BookingRecord) {
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

    const reason = window.prompt('請輸入取消原因（可留空）', '') ?? ''
    const ok = window.confirm('確定要取消這筆預約嗎？系統會同步刪除 Google Calendar 事件，並寄出取消通知信。')
    if (!ok) return

    setCancelingId(booking.id)
    setStatusMessage('正在取消預約...')

    const errors: string[] = []
    let calendarCancelled = Boolean(booking.googleCalendarCancelled)
    let emailsSent = Boolean(booking.cancellationEmailSentToCustomer && booking.cancellationEmailSentToAdmin)

    if (booking.googleCalendarEventId && !calendarCancelled) {
      try {
        await postJson('/api/calendar/cancel-event', {
          eventId: booking.googleCalendarEventId
        })
        calendarCancelled = true
      } catch (error) {
        errors.push(error instanceof Error ? error.message : 'Google Calendar 取消失敗')
      }
    } else {
      calendarCancelled = true
    }

    if (!emailsSent) {
      try {
        await postJson('/api/email/send-booking-cancellation', {
          bookingId: booking.id,
          customerName: booking.customerName,
          customerEmail: booking.customerEmail,
          customerPhone: booking.customerPhone,
          planName: booking.planName,
          amount: booking.amount,
          startTimeText: formatDateTimeText(booking.startTime),
          endTimeText: formatDateTimeText(booking.endTime),
          cancellationReason: reason
        })
        emailsSent = true
      } catch (error) {
        errors.push(error instanceof Error ? error.message : '取消通知信寄送失敗')
      }
    }

    const cancelledAt = new Date().toISOString()
    const cancellationUpdates: Partial<BookingRecord> = {
      status: 'cancelled',
      googleCalendarCancelled: calendarCancelled,
      cancellationEmailSentToCustomer: emailsSent,
      cancellationEmailSentToAdmin: emailsSent,
      cancelledAt,
      cancellationReason: reason
    }
    const updated = updateBookingRecord(booking.id, cancellationUpdates)

    try {
      await postJson('/api/bookings/update', {
        bookingId: booking.id,
        updates: {
          status: 'cancelled',
          googleCalendarCancelled: calendarCancelled,
          cancellationEmailSentToCustomer: emailsSent,
          cancellationEmailSentToAdmin: emailsSent,
          cancelledAt,
          cancellationReason: reason
        }
      })
    } catch (error) {
      errors.push(error instanceof Error ? error.message : '資料庫取消狀態更新失敗')
    }

    const nextBooking = updated ?? { ...booking, ...cancellationUpdates, updatedAt: new Date().toISOString() }
    setBookings((current) => current.map((item) => (item.id === nextBooking.id ? nextBooking : item)))

    setCancelingId('')
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
          {statusMessage && <div className="rounded-2xl border border-borderSoft bg-softPurple p-4 text-sm font-semibold text-deepPurple">{statusMessage}</div>}
          {!user ? (
            <div className="rounded-2xl border border-borderSoft bg-softPurple p-6 text-textMuted">請先登入會員查看預約紀錄。</div>
          ) : bookings.length === 0 ? (
            <div className="rounded-2xl border border-borderSoft bg-softPurple p-6">
              <p className="text-textMuted">目前尚無水瓶先生論命預約。</p>
              <Link className="focus-ring mt-5 inline-flex rounded-lg bg-deepPurple px-5 py-3 font-semibold text-white" href="/booking">
                立即預約
              </Link>
            </div>
          ) : (
            bookings.map((booking) => (
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
                  <span className="rounded-full bg-lightGold px-3 py-1 text-xs font-semibold text-darkGold">付款：已付款</span>
                  <span className="rounded-full bg-softPurple px-3 py-1 text-xs font-semibold text-deepPurple">預約：{booking.status === 'confirmed' ? '已確認' : booking.status === 'cancelled' ? '已取消' : booking.status}</span>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-textMuted ring-1 ring-borderSoft">
                    Calendar：{booking.googleCalendarCancelled ? '已取消' : booking.googleCalendarEventId ? '已建立' : '未建立'}
                  </span>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-textMuted ring-1 ring-borderSoft">
                    Email：{booking.emailSentToCustomer ? '已寄出' : '未寄出'}
                  </span>
                  {booking.status !== 'cancelled' && booking.googleCalendarEventLink && (
                    <a
                      className="rounded-full bg-deepPurple px-3 py-1 text-xs font-semibold text-white"
                      href={booking.googleCalendarEventLink}
                      target="_blank"
                      rel="noreferrer"
                    >
                      開啟日曆
                    </a>
                  )}
                  {booking.status === 'cancelled' ? (
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-textMuted ring-1 ring-borderSoft">
                      取消時間：{booking.cancelledAt ? new Date(booking.cancelledAt).toLocaleString('zh-TW') : '已取消'}
                    </span>
                  ) : canCancelBooking(booking) ? (
                    <button
                      className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-deepPurple ring-1 ring-deepPurple disabled:opacity-60"
                      disabled={cancelingId === booking.id}
                      onClick={() => void cancelBooking(booking)}
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
            ))
          )}
        </div>
      </section>
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} onSuccess={() => setLoginOpen(false)} />
    </>
  )
}
