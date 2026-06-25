'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Ban, CalendarClock, CalendarPlus, ListFilter, RefreshCw } from 'lucide-react'
import { FormEvent, useEffect, useMemo, useState, type ReactNode } from 'react'
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

type SlotFilter = 'future' | 'all' | 'available' | 'closed'

const weekdayOptions = [
  { value: 1, label: '一' },
  { value: 2, label: '二' },
  { value: 3, label: '三' },
  { value: 4, label: '四' },
  { value: 5, label: '五' },
  { value: 6, label: '六' },
  { value: 0, label: '日' },
]

const slotFilters: Array<{ value: SlotFilter; label: string }> = [
  { value: 'future', label: '只看未來時段' },
  { value: 'all', label: '全部' },
  { value: 'available', label: '開放' },
  { value: 'closed', label: '關閉' },
]

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

function isFutureSlot(slot: BookingSlot) {
  return new Date(slot.start_at).getTime() >= Date.now()
}

async function getAdminAccessToken() {
  const accessToken = await getAuthAccessToken()
  if (!accessToken) throw new Error('請先登入後再使用後台。')
  return accessToken
}

export default function AdminBookingSlotsPage() {
  const router = useRouter()
  const [user, setUser] = useState<UserProfile | null>(null)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [slots, setSlots] = useState<BookingSlot[]>([])
  const [slotFilter, setSlotFilter] = useState<SlotFilter>('future')
  const [isLoadingSlots, setIsLoadingSlots] = useState(false)
  const [isSingleSubmitting, setIsSingleSubmitting] = useState(false)
  const [isBatchSubmitting, setIsBatchSubmitting] = useState(false)
  const [isBulkClosing, setIsBulkClosing] = useState(false)
  const [message, setMessage] = useState('')
  const [singleForm, setSingleForm] = useState({
    date: '',
    startTime: '',
    endTime: '',
    note: '',
  })
  const [batchForm, setBatchForm] = useState({
    dateFrom: '',
    dateTo: '',
    weekdays: [] as number[],
    startTime: '',
    endTime: '',
    note: '',
  })
  const [closeForm, setCloseForm] = useState({
    dateFrom: '',
    dateTo: '',
    allDay: true,
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
      const accessToken = await getAdminAccessToken()
      const response = await fetch('/api/admin/booking-slots?scope=all', {
        cache: 'no-store',
        headers: { authorization: `Bearer ${accessToken}` },
      })
      const data = (await response.json()) as { ok?: boolean; slots?: BookingSlot[]; error?: string }

      if (!response.ok || !data.ok) {
        setMessage(data.error ?? '讀取預約時段失敗。')
        return
      }

      setSlots(data.slots ?? [])
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '讀取預約時段失敗。')
    } finally {
      setIsLoadingSlots(false)
    }
  }

  useEffect(() => {
    if (!user) return
    void loadSlots()
  }, [user])

  const visibleSlots = useMemo(() => {
    return slots.filter((slot) => {
      if (slotFilter === 'future') return isFutureSlot(slot)
      if (slotFilter === 'available') return slot.is_available
      if (slotFilter === 'closed') return !slot.is_available
      return true
    })
  }, [slotFilter, slots])

  const openSlotCount = useMemo(() => visibleSlots.filter((slot) => slot.is_available).length, [visibleSlots])

  const handleCreateSingleSlot = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage('')

    if (!singleForm.date || !singleForm.startTime || !singleForm.endTime) {
      setMessage('請填寫日期、開始時間與結束時間。')
      return
    }

    const startAt = taipeiInputToIso(singleForm.date, singleForm.startTime)
    const endAt = taipeiInputToIso(singleForm.date, singleForm.endTime)

    if (new Date(endAt) <= new Date(startAt)) {
      setMessage('結束時間必須晚於開始時間。')
      return
    }

    setIsSingleSubmitting(true)

    try {
      const accessToken = await getAdminAccessToken()
      const response = await fetch('/api/admin/booking-slots', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          startAt,
          endAt,
          note: singleForm.note,
        }),
      })
      const data = (await response.json()) as { ok?: boolean; error?: string }

      if (!response.ok || !data.ok) {
        setMessage(data.error ?? '新增預約時段失敗。')
        return
      }

      setSingleForm({ date: '', startTime: '', endTime: '', note: '' })
      await loadSlots()
      setMessage('已新增預約時段。')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '新增預約時段失敗。')
    } finally {
      setIsSingleSubmitting(false)
    }
  }

  const handleBatchCreateSlots = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage('')

    if (!batchForm.dateFrom || !batchForm.dateTo || !batchForm.startTime || !batchForm.endTime || batchForm.weekdays.length === 0) {
      setMessage('請填寫批次新增的日期、星期與時間。')
      return
    }

    setIsBatchSubmitting(true)

    try {
      const accessToken = await getAdminAccessToken()
      const response = await fetch('/api/admin/booking-slots/batch', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(batchForm),
      })
      const data = (await response.json()) as { ok?: boolean; createdCount?: number; skippedCount?: number; error?: string }

      if (!response.ok || !data.ok) {
        setMessage(data.error ?? '批次新增預約時段失敗。')
        return
      }

      setBatchForm({ dateFrom: '', dateTo: '', weekdays: [], startTime: '', endTime: '', note: '' })
      await loadSlots()
      setMessage(`批次新增完成：新增 ${data.createdCount ?? 0} 筆，略過重複 ${data.skippedCount ?? 0} 筆。`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '批次新增預約時段失敗。')
    } finally {
      setIsBatchSubmitting(false)
    }
  }

  const handleBulkCloseSlots = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage('')

    if (!closeForm.dateFrom || !closeForm.dateTo) {
      setMessage('請填寫要關閉的日期範圍。')
      return
    }

    if (!closeForm.allDay && (!closeForm.startTime || !closeForm.endTime)) {
      setMessage('非整天關閉時，請填寫開始與結束時間。')
      return
    }

    setIsBulkClosing(true)

    try {
      const accessToken = await getAdminAccessToken()
      const response = await fetch('/api/admin/booking-slots/bulk-close', {
        method: 'PATCH',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(closeForm),
      })
      const data = (await response.json()) as { ok?: boolean; updatedCount?: number; message?: string; error?: string }

      if (!response.ok || !data.ok) {
        setMessage(data.error ?? '批次關閉時段失敗。')
        return
      }

      await loadSlots()
      setMessage(data.message ?? `已關閉 ${data.updatedCount ?? 0} 筆時段。`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '批次關閉時段失敗。')
    } finally {
      setIsBulkClosing(false)
    }
  }

  const handleToggleSlot = async (slot: BookingSlot) => {
    setMessage('')

    try {
      const accessToken = await getAdminAccessToken()
      const response = await fetch(`/api/admin/booking-slots/${slot.id}`, {
        method: 'PATCH',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ isAvailable: !slot.is_available }),
      })
      const data = (await response.json()) as { ok?: boolean; error?: string }

      if (!response.ok || !data.ok) {
        setMessage(data.error ?? '更新預約時段失敗。')
        return
      }

      await loadSlots()
      setMessage(slot.is_available ? '已關閉此時段。' : '已重新開放此時段。')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '更新預約時段失敗。')
    }
  }

  const toggleWeekday = (weekday: number) => {
    setBatchForm((current) => ({
      ...current,
      weekdays: current.weekdays.includes(weekday)
        ? current.weekdays.filter((item) => item !== weekday)
        : [...current.weekdays, weekday].sort((a, b) => a - b),
    }))
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
            <p className="mt-3 max-w-3xl leading-8 text-textMuted">
              可新增單一時段，也可批次開放一段期間的固定星期與時段；若臨時不開放，可批次關閉既有時段。顯示時間皆以台灣時間 Asia/Taipei 為準。
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

        <div className="grid gap-6 xl:grid-cols-3">
          <section className="rounded-2xl border border-borderSoft bg-white p-6 shadow-soft">
            <FormHeader icon={<CalendarClock size={22} />} title="新增單一時段" description="只新增一筆可預約時段。" />
            <form className="mt-6 grid gap-4" onSubmit={handleCreateSingleSlot}>
              <DateInput label="日期" value={singleForm.date} onChange={(date) => setSingleForm((current) => ({ ...current, date }))} />
              <TimeRangeInputs
                startValue={singleForm.startTime}
                endValue={singleForm.endTime}
                onStartChange={(startTime) => setSingleForm((current) => ({ ...current, startTime }))}
                onEndChange={(endTime) => setSingleForm((current) => ({ ...current, endTime }))}
              />
              <NoteInput value={singleForm.note} onChange={(note) => setSingleForm((current) => ({ ...current, note }))} />
              <SubmitButton isSubmitting={isSingleSubmitting} idleText="新增時段" submittingText="新增中..." />
            </form>
          </section>

          <section className="rounded-2xl border border-borderSoft bg-white p-6 shadow-soft">
            <FormHeader icon={<CalendarPlus size={22} />} title="批次新增可預約時段" description="一次開放多天、多個星期幾的一組時段。" />
            <form className="mt-6 grid gap-4" onSubmit={handleBatchCreateSlots}>
              <DateRangeInputs
                fromValue={batchForm.dateFrom}
                toValue={batchForm.dateTo}
                onFromChange={(dateFrom) => setBatchForm((current) => ({ ...current, dateFrom }))}
                onToChange={(dateTo) => setBatchForm((current) => ({ ...current, dateTo }))}
              />

              <fieldset className="grid gap-2">
                <legend className="text-sm font-semibold text-textDark">星期幾</legend>
                <div className="flex flex-wrap gap-2">
                  {weekdayOptions.map((weekday) => (
                    <label key={weekday.value} className="cursor-pointer">
                      <input
                        type="checkbox"
                        checked={batchForm.weekdays.includes(weekday.value)}
                        onChange={() => toggleWeekday(weekday.value)}
                        className="peer sr-only"
                      />
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-borderSoft bg-white text-sm font-semibold text-textDark peer-checked:border-deepPurple peer-checked:bg-deepPurple peer-checked:text-white">
                        {weekday.label}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <TimeRangeInputs
                startValue={batchForm.startTime}
                endValue={batchForm.endTime}
                onStartChange={(startTime) => setBatchForm((current) => ({ ...current, startTime }))}
                onEndChange={(endTime) => setBatchForm((current) => ({ ...current, endTime }))}
              />
              <NoteInput value={batchForm.note} onChange={(note) => setBatchForm((current) => ({ ...current, note }))} />
              <SubmitButton isSubmitting={isBatchSubmitting} idleText="批次新增" submittingText="新增中..." />
            </form>
          </section>

          <section className="rounded-2xl border border-borderSoft bg-white p-6 shadow-soft">
            <FormHeader icon={<Ban size={22} />} title="批次關閉 / 限制預約" description="把符合日期與時間的既有時段改成關閉。" />
            <form className="mt-6 grid gap-4" onSubmit={handleBulkCloseSlots}>
              <DateRangeInputs
                fromValue={closeForm.dateFrom}
                toValue={closeForm.dateTo}
                onFromChange={(dateFrom) => setCloseForm((current) => ({ ...current, dateFrom }))}
                onToChange={(dateTo) => setCloseForm((current) => ({ ...current, dateTo }))}
              />

              <label className="flex items-center gap-3 rounded-xl border border-borderSoft bg-softPurple px-4 py-3 text-sm font-semibold text-textDark">
                <input
                  type="checkbox"
                  checked={closeForm.allDay}
                  onChange={(event) => setCloseForm((current) => ({ ...current, allDay: event.target.checked }))}
                />
                整天關閉
              </label>

              {!closeForm.allDay ? (
                <TimeRangeInputs
                  startValue={closeForm.startTime}
                  endValue={closeForm.endTime}
                  onStartChange={(startTime) => setCloseForm((current) => ({ ...current, startTime }))}
                  onEndChange={(endTime) => setCloseForm((current) => ({ ...current, endTime }))}
                />
              ) : null}

              <NoteInput value={closeForm.note} onChange={(note) => setCloseForm((current) => ({ ...current, note }))} placeholder="例如：整週不開放、下午不開放" />
              <SubmitButton isSubmitting={isBulkClosing} idleText="關閉符合條件的時段" submittingText="關閉中..." tone="danger" />
            </form>
          </section>
        </div>

        <section className="rounded-2xl border border-borderSoft bg-white p-6 shadow-soft">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="font-serifTC text-2xl font-semibold text-deepPurple">時段清單</h2>
              <p className="mt-1 text-sm text-textMuted">
                目前顯示 {visibleSlots.length} 筆，開放 {openSlotCount} 筆。
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex flex-wrap gap-2">
                {slotFilters.map((filter) => (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() => setSlotFilter(filter.value)}
                    className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                      slotFilter === filter.value
                        ? 'border-deepPurple bg-deepPurple text-white'
                        : 'border-borderSoft bg-white text-textDark hover:bg-softPurple'
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
              <span className="inline-flex items-center gap-2 rounded-full bg-softPurple px-4 py-2 text-sm font-semibold text-deepPurple">
                <ListFilter size={16} />
                {slotFilters.find((filter) => filter.value === slotFilter)?.label}
              </span>
            </div>
          </div>

          {message ? <p className="mt-5 rounded-xl bg-softPurple px-4 py-3 text-sm font-semibold text-deepPurple">{message}</p> : null}

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
                {visibleSlots.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-textMuted">
                      目前沒有符合篩選條件的預約時段。
                    </td>
                  </tr>
                ) : (
                  visibleSlots.map((slot) => (
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
    </main>
  )
}

function FormHeader({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-11 w-11 place-items-center rounded-xl bg-softPurple text-deepPurple">
        {icon}
      </div>
      <div>
        <h2 className="font-serifTC text-xl font-semibold text-deepPurple">{title}</h2>
        <p className="text-sm text-textMuted">{description}</p>
      </div>
    </div>
  )
}

function DateInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-textDark">
      {label}
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-xl border border-borderSoft px-4 py-3 font-normal text-textDark"
        required
      />
    </label>
  )
}

function DateRangeInputs({
  fromValue,
  toValue,
  onFromChange,
  onToChange,
}: {
  fromValue: string
  toValue: string
  onFromChange: (value: string) => void
  onToChange: (value: string) => void
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <DateInput label="開始日期" value={fromValue} onChange={onFromChange} />
      <DateInput label="結束日期" value={toValue} onChange={onToChange} />
    </div>
  )
}

function TimeRangeInputs({
  startValue,
  endValue,
  onStartChange,
  onEndChange,
}: {
  startValue: string
  endValue: string
  onStartChange: (value: string) => void
  onEndChange: (value: string) => void
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="grid gap-2 text-sm font-semibold text-textDark">
        開始時間
        <input
          type="time"
          value={startValue}
          onChange={(event) => onStartChange(event.target.value)}
          className="rounded-xl border border-borderSoft px-4 py-3 font-normal text-textDark"
          required
        />
      </label>

      <label className="grid gap-2 text-sm font-semibold text-textDark">
        結束時間
        <input
          type="time"
          value={endValue}
          onChange={(event) => onEndChange(event.target.value)}
          className="rounded-xl border border-borderSoft px-4 py-3 font-normal text-textDark"
          required
        />
      </label>
    </div>
  )
}

function NoteInput({
  value,
  onChange,
  placeholder = '例如：晚間時段、僅接受線上諮詢',
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-textDark">
      備註
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-24 rounded-xl border border-borderSoft px-4 py-3 font-normal text-textDark"
        placeholder={placeholder}
      />
    </label>
  )
}

function SubmitButton({
  isSubmitting,
  idleText,
  submittingText,
  tone = 'default',
}: {
  isSubmitting: boolean
  idleText: string
  submittingText: string
  tone?: 'default' | 'danger'
}) {
  return (
    <button
      type="submit"
      disabled={isSubmitting}
      className={`focus-ring rounded-xl px-5 py-3 font-semibold text-white disabled:opacity-60 ${
        tone === 'danger' ? 'bg-[#9a2f2f] hover:bg-[#842727]' : 'bg-deepPurple hover:bg-purpleMain'
      }`}
    >
      {isSubmitting ? submittingText : idleText}
    </button>
  )
}
