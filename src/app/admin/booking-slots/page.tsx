'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CalendarClock, RefreshCw } from 'lucide-react'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { getAuthAccessToken, getMockUser, subscribeAuthChange, type UserProfile } from '@/lib/mockAuth'

type BookingSlot = {
  id: string
  start_at: string
  end_at: string
  is_available: boolean
  note: string | null
  created_at: string
  updated_at: string
}

const taipeiDateFormatter = new Intl.DateTimeFormat('zh-TW', {
  timeZone: 'Asia/Taipei',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  weekday: 'short',
})

const taipeiTimeFormatter = new Intl.DateTimeFormat('zh-TW', {
  timeZone: 'Asia/Taipei',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

function formatTaipeiDate(value: string) {
  return taipeiDateFormatter.format(new Date(value))
}

function formatTaipeiTime(value: string) {
  return taipeiTimeFormatter.format(new Date(value))
}

function taipeiInputToIso(date: string, time: string) {
  return new Date(`${date}T${time}:00+08:00`).toISOString()
}

export default function AdminBookingSlotsPage() {
  const router = useRouter()
  const [user, setUser] = useState<UserProfile | null>(null)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [slots, setSlots] = useState<BookingSlot[]>([])
  const [isLoadingSlots, setIsLoadingSlots] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({
    date: '',
    startTime: '',
    endTime: '',
    note: '',
  })

  useEffect(() => {
    const sync = () => {
      const nextUser = getMockUser()
      setUser(nextUser)
      setIsCheckingAuth(false)

      if (!nextUser) {
        router.replace('/')
      }
    }

    sync()
    return subscribeAuthChange(sync)
  }, [router])

  const loadSlots = async () => {
    setIsLoadingSlots(true)
    setMessage('')

    try {
      const accessToken = await getAuthAccessToken()
      if (!accessToken) {
        setMessage('請先登入後再使用後台。')
        return
      }

      const response = await fetch('/api/admin/booking-slots', {
        cache: 'no-store',
        headers: { authorization: `Bearer ${accessToken}` },
      })
      const data = (await response.json()) as { ok?: boolean; slots?: BookingSlot[]; error?: string }

      if (!response.ok || !data.ok) {
        setMessage(data.error ?? '讀取預約時段失敗。')
        return
      }

      setSlots(data.slots ?? [])
    } catch {
      setMessage('讀取預約時段失敗。')
    } finally {
      setIsLoadingSlots(false)
    }
  }

  useEffect(() => {
    if (!user) return
    void loadSlots()
  }, [user])

  const openSlotCount = useMemo(() => slots.filter((slot) => slot.is_available).length, [slots])

  const handleCreateSlot = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage('')

    if (!form.date || !form.startTime || !form.endTime) {
      setMessage('請填寫日期、開始時間與結束時間。')
      return
    }

    const startAt = taipeiInputToIso(form.date, form.startTime)
    const endAt = taipeiInputToIso(form.date, form.endTime)

    if (new Date(endAt) <= new Date(startAt)) {
      setMessage('結束時間必須晚於開始時間。')
      return
    }

    setIsSubmitting(true)

    try {
      const accessToken = await getAuthAccessToken()
      if (!accessToken) {
        setMessage('請先登入後再使用後台。')
        return
      }

      const response = await fetch('/api/admin/booking-slots', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          startAt,
          endAt,
          note: form.note,
        }),
      })
      const data = (await response.json()) as { ok?: boolean; slot?: BookingSlot; error?: string }

      if (!response.ok || !data.ok || !data.slot) {
        setMessage(data.error ?? '新增預約時段失敗。')
        return
      }

      setSlots((current) => [...current, data.slot as BookingSlot].sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()))
      setForm({ date: '', startTime: '', endTime: '', note: '' })
      setMessage('已新增預約時段。')
    } catch {
      setMessage('新增預約時段失敗。')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleToggleSlot = async (slot: BookingSlot) => {
    setMessage('')

    try {
      const accessToken = await getAuthAccessToken()
      if (!accessToken) {
        setMessage('請先登入後再使用後台。')
        return
      }

      const response = await fetch(`/api/admin/booking-slots/${slot.id}`, {
        method: 'PATCH',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ isAvailable: !slot.is_available }),
      })
      const data = (await response.json()) as { ok?: boolean; slot?: BookingSlot; error?: string }

      if (!response.ok || !data.ok || !data.slot) {
        setMessage(data.error ?? '更新預約時段失敗。')
        return
      }

      setSlots((current) => current.map((row) => (row.id === slot.id ? data.slot as BookingSlot : row)))
      setMessage(data.slot.is_available ? '已重新開放此時段。' : '已關閉此時段。')
    } catch {
      setMessage('更新預約時段失敗。')
    }
  }

  if (isCheckingAuth) {
    return (
      <main className="bg-[#faf7ff] py-16">
        <div className="section-shell">
          <div className="rounded-2xl border border-borderSoft bg-white p-8 text-textMuted shadow-soft">
            正在確認登入狀態...
          </div>
        </div>
      </main>
    )
  }

  if (!user) return null

  return (
    <main className="bg-[#faf7ff] py-10 md:py-14">
      <div className="section-shell grid gap-7">
        <div className="flex flex-col gap-4 rounded-2xl border border-borderSoft bg-white p-6 shadow-soft md:flex-row md:items-end md:justify-between md:p-8">
          <div>
            <Link href="/admin" className="text-sm font-semibold text-darkGold hover:text-deepPurple">
              回後台總覽
            </Link>
            <p className="mt-4 text-sm font-semibold text-darkGold">Booking Slots</p>
            <h1 className="mt-2 font-serifTC text-3xl font-semibold text-deepPurple">
              水瓶先生論命｜預約時段管理
            </h1>
            <p className="mt-3 max-w-2xl leading-8 text-textMuted">
              手動建立單一可預約時段，並可暫時關閉或重新開放。顯示時間皆以台灣時間 Asia/Taipei 為準。
            </p>
          </div>
          <button
            type="button"
            onClick={loadSlots}
            disabled={isLoadingSlots}
            className="focus-ring inline-flex w-fit items-center gap-2 rounded-xl border border-borderSoft bg-white px-4 py-3 font-semibold text-deepPurple disabled:opacity-60"
          >
            <RefreshCw size={18} />
            {isLoadingSlots ? '讀取中...' : '重新整理'}
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
          <section className="rounded-2xl border border-borderSoft bg-white p-6 shadow-soft">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-softPurple text-deepPurple">
                <CalendarClock size={22} />
              </div>
              <div>
                <h2 className="font-serifTC text-2xl font-semibold text-deepPurple">新增時段</h2>
                <p className="text-sm text-textMuted">一筆資料代表一個可預約時段。</p>
              </div>
            </div>

            <form className="mt-6 grid gap-4" onSubmit={handleCreateSlot}>
              <label className="grid gap-2 text-sm font-semibold text-textDark">
                日期
                <input
                  type="date"
                  value={form.date}
                  onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
                  className="rounded-xl border border-borderSoft px-4 py-3 font-normal text-textDark"
                  required
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold text-textDark">
                  開始時間
                  <input
                    type="time"
                    value={form.startTime}
                    onChange={(event) => setForm((current) => ({ ...current, startTime: event.target.value }))}
                    className="rounded-xl border border-borderSoft px-4 py-3 font-normal text-textDark"
                    required
                  />
                </label>

                <label className="grid gap-2 text-sm font-semibold text-textDark">
                  結束時間
                  <input
                    type="time"
                    value={form.endTime}
                    onChange={(event) => setForm((current) => ({ ...current, endTime: event.target.value }))}
                    className="rounded-xl border border-borderSoft px-4 py-3 font-normal text-textDark"
                    required
                  />
                </label>
              </div>

              <label className="grid gap-2 text-sm font-semibold text-textDark">
                備註
                <textarea
                  value={form.note}
                  onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
                  className="min-h-24 rounded-xl border border-borderSoft px-4 py-3 font-normal text-textDark"
                  placeholder="例如：晚間時段、僅接受線上諮詢"
                />
              </label>

              <button
                type="submit"
                disabled={isSubmitting}
                className="focus-ring rounded-xl bg-deepPurple px-5 py-3 font-semibold text-white disabled:opacity-60"
              >
                {isSubmitting ? '新增中...' : '新增時段'}
              </button>
            </form>
          </section>

          <section className="rounded-2xl border border-borderSoft bg-white p-6 shadow-soft">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="font-serifTC text-2xl font-semibold text-deepPurple">時段清單</h2>
                <p className="mt-1 text-sm text-textMuted">
                  未來 90 天共 {slots.length} 筆，開放 {openSlotCount} 筆。
                </p>
              </div>
              {message ? <p className="rounded-xl bg-softPurple px-4 py-2 text-sm font-semibold text-deepPurple">{message}</p> : null}
            </div>

            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-borderSoft text-textMuted">
                    <th className="py-3 pr-4">日期</th>
                    <th className="py-3 pr-4">開始</th>
                    <th className="py-3 pr-4">結束</th>
                    <th className="py-3 pr-4">狀態</th>
                    <th className="py-3 pr-4">備註</th>
                    <th className="py-3 pr-2">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {slots.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-textMuted">
                        目前沒有未來 90 天的預約時段。
                      </td>
                    </tr>
                  ) : (
                    slots.map((slot) => (
                      <tr key={slot.id} className="border-b border-borderSoft/70">
                        <td className="py-4 pr-4 font-semibold text-textDark">{formatTaipeiDate(slot.start_at)}</td>
                        <td className="py-4 pr-4">{formatTaipeiTime(slot.start_at)}</td>
                        <td className="py-4 pr-4">{formatTaipeiTime(slot.end_at)}</td>
                        <td className="py-4 pr-4">
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${slot.is_available ? 'bg-[#eff8ed] text-[#26713a]' : 'bg-[#f7eeee] text-[#9a2f2f]'}`}>
                            {slot.is_available ? '開放' : '關閉'}
                          </span>
                        </td>
                        <td className="max-w-[240px] py-4 pr-4 text-textMuted">{slot.note || '無'}</td>
                        <td className="py-4">
                          <button
                            type="button"
                            onClick={() => handleToggleSlot(slot)}
                            className="rounded-lg border border-borderSoft px-3 py-2 text-sm font-semibold text-deepPurple hover:bg-softPurple"
                          >
                            {slot.is_available ? '關閉' : '重新開放'}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
