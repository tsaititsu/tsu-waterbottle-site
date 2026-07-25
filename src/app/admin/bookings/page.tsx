'use client'

import Link from 'next/link'
import { RefreshCw, Search, ShieldCheck } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getAuthAccessToken } from '@/lib/mockAuth'
import type { AdminBookingListItem } from '@/lib/supabase/adminBookings'
import { classifyAdminBookingStatus } from './bookingStatus'

type StatusFilter = 'all' | 'pending' | 'paid' | 'cancelled' | 'failed'
type TimeFilter = 'all' | 'future' | 'past'

type AdminBookingsResponse = {
  ok?: boolean
  bookings?: AdminBookingListItem[]
  meta?: { count: number; total: number; limit: number; offset: number }
  error?: string
}

const statusFilters: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'pending', label: '待付款' },
  { value: 'paid', label: '已付款／已確認' },
  { value: 'cancelled', label: '已取消' },
  { value: 'failed', label: '失敗' },
]

const timeFilters: Array<{ value: TimeFilter; label: string }> = [
  { value: 'all', label: '全部時間' },
  { value: 'future', label: '未來預約' },
  { value: 'past', label: '過去預約' },
]

const taipeiDateTimeFormatter = new Intl.DateTimeFormat('zh-TW', {
  timeZone: 'Asia/Taipei',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const twdFormatter = new Intl.NumberFormat('zh-TW', {
  style: 'currency',
  currency: 'TWD',
  maximumFractionDigits: 0,
})

function validTimestamp(value: string) {
  const timestamp = Date.parse(value)
  return Number.isNaN(timestamp) ? null : timestamp
}

function formatTaipeiDateTime(value: string) {
  const timestamp = validTimestamp(value)
  return timestamp === null ? '時間未提供' : taipeiDateTimeFormatter.format(timestamp)
}

function formatAmount(amount: number, currency: string) {
  return currency === 'TWD' ? twdFormatter.format(amount) : `${currency} ${amount.toLocaleString('zh-TW')}`
}

function bookingIdSuffix(id: string) {
  return id.length > 8 ? id.slice(-8) : id
}

function matchesStatus(booking: AdminBookingListItem, filter: StatusFilter) {
  if (filter === 'all') return true
  return classifyAdminBookingStatus(booking) === filter
}

function matchesTime(booking: AdminBookingListItem, filter: TimeFilter, now: number) {
  if (filter === 'all') return true

  const startsAt = validTimestamp(booking.startsAt)
  if (startsAt === null) return false

  return filter === 'future' ? startsAt >= now : startsAt < now
}

function searchableText(booking: AdminBookingListItem) {
  return [
    booking.customerName,
    booking.customerEmail,
    booking.customerPhone,
    booking.lineDisplayName,
    booking.planName,
    bookingIdSuffix(booking.id),
  ]
    .filter((value): value is string => Boolean(value))
    .join(' ')
    .toLocaleLowerCase('zh-TW')
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: '待處理',
    pending_payment: '待付款',
    paid: '已付款',
    confirmed: '已確認',
    cancelled: '已取消',
    canceled: '已取消',
    failed: '失敗',
    refunded: '已退款',
  }

  return (labels[status] ?? status) || '未提供'
}

function statusTone(status: string) {
  if (['paid', 'confirmed'].includes(status)) return 'bg-[#eff8ed] text-[#26713a]'
  if (['cancelled', 'canceled', 'failed'].includes(status)) return 'bg-[#f7eeee] text-[#9a2f2f]'
  return 'bg-[#fff7e5] text-darkGold'
}

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<AdminBookingListItem[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all')
  const [referenceTime, setReferenceTime] = useState(0)
  const [totalBookings, setTotalBookings] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const requestSequenceRef = useRef(0)

  const loadBookings = useCallback(async (offset = 0) => {
    const requestSequence = ++requestSequenceRef.current
    if (offset === 0) {
      setIsLoading(true)
      setIsLoadingMore(false)
    } else {
      setIsLoadingMore(true)
    }
    setErrorMessage('')

    try {
      const accessToken = await getAuthAccessToken()
      if (requestSequence !== requestSequenceRef.current) return
      if (!accessToken) throw new Error('請先登入後再使用後台。')

      const response = await fetch(`/api/admin/bookings?limit=50&offset=${offset}`, {
        cache: 'no-store',
        headers: { authorization: `Bearer ${accessToken}` },
      })
      const data = (await response.json()) as AdminBookingsResponse
      if (requestSequence !== requestSequenceRef.current) return

      if (!response.ok || !data.ok) {
        setErrorMessage(data.error ?? '讀取預約紀錄失敗。')
        if (offset === 0) setBookings([])
        return
      }

      setBookings((current) => offset === 0 ? data.bookings ?? [] : [...current, ...(data.bookings ?? [])])
      setTotalBookings(
        Number.isSafeInteger(data.meta?.total)
          ? data.meta?.total ?? 0
          : offset + (data.bookings?.length ?? 0),
      )
      setReferenceTime(Date.now())
    } catch (error) {
      if (requestSequence !== requestSequenceRef.current) return
      if (offset === 0) setBookings([])
      setErrorMessage(error instanceof Error ? error.message : '讀取預約紀錄失敗。')
    } finally {
      if (requestSequence !== requestSequenceRef.current) return
      setIsLoading(false)
      setIsLoadingMore(false)
    }
  }, [])

  useEffect(() => {
    void loadBookings()
  }, [loadBookings])

  const summary = useMemo(() => {
    return bookings.reduce(
      (counts, booking) => {
        const bucket = classifyAdminBookingStatus(booking)
        counts.loaded += 1

        if (bucket === 'pending' || bucket === 'paid' || bucket === 'cancelled') {
          counts[bucket] += 1
        }

        return counts
      },
      { loaded: 0, pending: 0, paid: 0, cancelled: 0 },
    )
  }, [bookings])

  const visibleBookings = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLocaleLowerCase('zh-TW')

    return bookings.filter((booking) => {
      const matchesSearch = !normalizedSearch || searchableText(booking).includes(normalizedSearch)
      return matchesSearch && matchesStatus(booking, statusFilter) && matchesTime(booking, timeFilter, referenceTime)
    })
  }, [bookings, referenceTime, searchTerm, statusFilter, timeFilter])

  return (
    <main className="bg-[#faf7ff] py-10 md:py-14">
      <div className="section-shell grid min-w-0 gap-7">
        <header className="flex min-w-0 flex-col gap-5 rounded-2xl border border-borderSoft bg-white p-6 shadow-soft md:flex-row md:items-end md:justify-between md:p-8">
          <div className="min-w-0">
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold">
              <Link href="/admin" className="text-darkGold hover:text-deepPurple">
                回後台總覽
              </Link>
              <Link href="/admin/booking-slots" className="text-darkGold hover:text-deepPurple">
                前往預約時段管理
              </Link>
            </div>
            <p className="mt-4 text-sm font-semibold text-darkGold">Booking Records</p>
            <h1 className="mt-2 font-serifTC text-3xl font-semibold text-deepPurple">預約紀錄</h1>
            <p className="mt-3 max-w-3xl leading-8 text-textMuted">
              本頁為唯讀管理頁，以每批 50 筆載入遮蔽後預約摘要。修改、取消與退款功能尚未開放。
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadBookings(0)}
            disabled={isLoading || isLoadingMore}
            className="focus-ring inline-flex w-fit shrink-0 items-center gap-2 rounded-xl border border-borderSoft bg-white px-4 py-3 font-semibold text-deepPurple disabled:opacity-60"
          >
            <RefreshCw size={18} aria-hidden="true" />
            {isLoading ? '讀取中...' : '重新整理'}
          </button>
        </header>

        <section aria-label="預約紀錄摘要" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="已載入筆數" value={summary.loaded} />
          <SummaryCard label="待付款" value={summary.pending} />
          <SummaryCard label="已付款／已確認" value={summary.paid} />
          <SummaryCard label="已取消" value={summary.cancelled} />
        </section>

        <section className="min-w-0 rounded-2xl border border-borderSoft bg-white p-5 shadow-soft md:p-6">
          <div className="grid min-w-0 gap-5">
            <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(260px,1fr)_auto_auto] xl:items-end">
              <label className="grid min-w-0 gap-2 text-sm font-semibold text-textDark">
                搜尋已載入紀錄
                <span className="relative block min-w-0">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-textMuted" size={18} aria-hidden="true" />
                  <input
                    type="search"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="姓名、Email、電話、LINE、方案或編號末碼"
                    className="focus-ring w-full min-w-0 rounded-xl border border-borderSoft py-3 pl-10 pr-4 font-normal text-textDark"
                  />
                </span>
              </label>

              <FilterGroup
                label="狀態篩選"
                options={statusFilters}
                value={statusFilter}
                onChange={setStatusFilter}
              />
              <FilterGroup
                label="時間篩選"
                options={timeFilters}
                value={timeFilter}
                onChange={setTimeFilter}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-borderSoft pt-4 text-sm text-textMuted">
              <span>符合條件 {visibleBookings.length} 筆</span>
              <span>已載入 {bookings.length}／{totalBookings} 筆</span>
              <span className="inline-flex items-center gap-2 rounded-full bg-softPurple px-3 py-2 font-semibold text-deepPurple">
                <ShieldCheck size={16} aria-hidden="true" />
                Read-only
              </span>
            </div>
          </div>

          {errorMessage ? (
            <p role="alert" className="mt-5 rounded-xl bg-[#f7eeee] px-4 py-3 text-sm font-semibold text-[#9a2f2f]">
              {errorMessage}
            </p>
          ) : null}

          {isLoading ? (
            <div className="mt-6 rounded-xl bg-softPurple px-5 py-10 text-center text-textMuted" aria-live="polite">
              正在讀取預約紀錄...
            </div>
          ) : null}

          {!isLoading && !errorMessage && visibleBookings.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-borderSoft px-5 py-10 text-center text-textMuted">
              目前沒有符合搜尋與篩選條件的預約紀錄。
            </div>
          ) : null}

          {!isLoading && !errorMessage && visibleBookings.length > 0 ? (
            <>
              <div className="mt-6 hidden overflow-x-auto lg:block">
                <table className="min-w-[1220px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-borderSoft text-textMuted">
                      <th className="py-3 pr-5">預約日期／時間</th>
                      <th className="py-3 pr-5">客戶</th>
                      <th className="py-3 pr-5">聯絡方式</th>
                      <th className="py-3 pr-5">方案／金額</th>
                      <th className="py-3 pr-5">預約狀態</th>
                      <th className="py-3 pr-5">付款狀態</th>
                      <th className="py-3 pr-5">寄信狀態</th>
                      <th className="py-3">建立時間</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleBookings.map((booking) => (
                      <tr key={booking.id} className="border-b border-borderSoft/70 align-top">
                        <td className="py-4 pr-5">
                          <p className="font-semibold text-textDark">{formatTaipeiDateTime(booking.startsAt)}</p>
                          <p className="mt-1 text-xs text-textMuted">至 {formatTaipeiDateTime(booking.endsAt)}</p>
                          <p className="mt-1 text-xs text-textMuted">編號 …{bookingIdSuffix(booking.id)}</p>
                        </td>
                        <td className="max-w-[190px] py-4 pr-5">
                          <p className="break-words font-semibold text-textDark">{booking.customerName || '未提供姓名'}</p>
                          <p className="mt-1 break-words text-xs text-textMuted">LINE：{booking.lineDisplayName || '未提供'}</p>
                        </td>
                        <td className="max-w-[220px] py-4 pr-5">{contactDetails(booking)}</td>
                        <td className="py-4 pr-5">
                          <p className="font-semibold text-textDark">{booking.planName || '未提供方案'}</p>
                          <p className="mt-1 text-textMuted">{formatAmount(booking.amountTwd, booking.currency)}</p>
                        </td>
                        <td className="py-4 pr-5"><StatusBadge status={booking.status} /></td>
                        <td className="py-4 pr-5"><StatusBadge status={booking.paymentStatus} /></td>
                        <td className="py-4 pr-5"><EmailStatus booking={booking} /></td>
                        <td className="py-4 text-textMuted">{formatTaipeiDateTime(booking.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div data-mobile-booking-cards className="mt-6 grid min-w-0 gap-4 lg:hidden">
                {visibleBookings.map((booking) => (
                  <article key={booking.id} className="min-w-0 overflow-hidden rounded-2xl border border-borderSoft bg-[#fdfcff] p-5">
                    <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-textMuted">預約編號 …{bookingIdSuffix(booking.id)}</p>
                        <h2 className="mt-1 break-words font-serifTC text-xl font-semibold text-deepPurple">{booking.customerName || '未提供姓名'}</h2>
                      </div>
                      <StatusBadge status={booking.status} />
                    </div>

                    <dl className="mt-5 grid min-w-0 gap-4 text-sm">
                      <MobileDetail label="預約時間" value={`${formatTaipeiDateTime(booking.startsAt)} 至 ${formatTaipeiDateTime(booking.endsAt)}`} />
                      <MobileDetail label="方案／金額" value={`${booking.planName || '未提供方案'}／${formatAmount(booking.amountTwd, booking.currency)}`} />
                      <div className="min-w-0">
                        <dt className="font-semibold text-textMuted">聯絡方式</dt>
                        <dd className="mt-1 min-w-0 break-words text-textDark">{contactDetails(booking)}</dd>
                      </div>
                      <MobileDetail label="LINE 顯示名稱" value={booking.lineDisplayName || '未提供'} />
                      <div>
                        <dt className="font-semibold text-textMuted">付款狀態</dt>
                        <dd className="mt-2"><StatusBadge status={booking.paymentStatus} /></dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-textMuted">寄信狀態</dt>
                        <dd className="mt-2"><EmailStatus booking={booking} /></dd>
                      </div>
                      <MobileDetail label="建立時間" value={formatTaipeiDateTime(booking.createdAt)} />
                    </dl>
                  </article>
                ))}
              </div>
              {bookings.length < totalBookings ? (
                <button
                  className="focus-ring mx-auto mt-6 flex min-h-11 rounded-xl border border-deepPurple bg-white px-5 py-3 font-semibold text-deepPurple disabled:opacity-60"
                  disabled={isLoading || isLoadingMore}
                  onClick={() => void loadBookings(bookings.length)}
                  type="button"
                >
                  {isLoadingMore ? '載入中...' : '載入更多預約'}
                </button>
              ) : null}
            </>
          ) : null}
        </section>
      </div>
    </main>
  )
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <article className="rounded-2xl border border-borderSoft bg-white p-5 shadow-soft">
      <p className="text-sm font-semibold text-textMuted">{label}</p>
      <p className="mt-2 font-serifTC text-3xl font-semibold text-deepPurple">{value}</p>
    </article>
  )
}

function FilterGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: Array<{ value: T; label: string }>
  value: T
  onChange: (value: T) => void
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-sm font-semibold text-textDark">{label}</legend>
      <div className="flex min-w-0 flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={value === option.value}
            className={`rounded-full border px-3 py-2 text-sm font-semibold transition ${
              value === option.value
                ? 'border-deepPurple bg-deepPurple text-white'
                : 'border-borderSoft bg-white text-textDark hover:bg-softPurple'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusTone(status)}`}>
      {statusLabel(status)}
    </span>
  )
}

function contactDetails(booking: AdminBookingListItem) {
  return (
    <div className="grid min-w-0 gap-1">
      <span className="min-w-0 break-all text-textDark">{booking.customerEmail}</span>
      <span className="break-words text-textDark">{booking.customerPhone}</span>
    </div>
  )
}

function EmailStatus({ booking }: { booking: AdminBookingListItem }) {
  const sentCount = [
    booking.confirmationEmailSentToCustomer,
    booking.confirmationEmailSentToAdmin,
    booking.cancellationEmailSentToCustomer,
    booking.cancellationEmailSentToAdmin,
  ].filter(Boolean).length

  return (
    <div className="grid gap-1 text-xs text-textMuted">
      <span>確認信：客戶 {booking.confirmationEmailSentToCustomer ? '已寄' : '未寄'}／管理員 {booking.confirmationEmailSentToAdmin ? '已寄' : '未寄'}</span>
      <span>取消信：客戶 {booking.cancellationEmailSentToCustomer ? '已寄' : '未寄'}／管理員 {booking.cancellationEmailSentToAdmin ? '已寄' : '未寄'}</span>
      <span className="font-semibold text-textDark">共 {sentCount} / 4</span>
    </div>
  )
}

function MobileDetail({ label, value, truncate = false }: { label: string; value: string; truncate?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="font-semibold text-textMuted">{label}</dt>
      <dd className={`mt-1 break-words text-textDark ${truncate ? 'line-clamp-2' : ''}`}>{value}</dd>
    </div>
  )
}
