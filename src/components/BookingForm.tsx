'use client'

import { CalendarDays, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { useRef, useState } from 'react'
import { ActionButton } from './ActionButton'
import { bookingPlans, getBookingPlan } from '@/lib/bookingPlans'
import { getAuthAccessToken, getMockUser } from '@/lib/mockAuth'
import { hasBookingConflict, savePendingBooking, type BookingFormInput } from '@/lib/mockBooking'

const availableSlots = ['13:00', '15:00', '17:00']
const officialLineUrl = 'https://lin.ee/6Tpje1P'
const serviceNoticeRows = [
  '服務名稱：水瓶先生論命',
  '服務型態：一對一線上紫微斗數諮詢',
  '服務時間：60 分鐘',
  '價格：NT$3,600 / 1 小時',
  '諮詢方式：LINE 通話或 Zoom',
  '預約方式：付款後依網站可預約時段完成預約，或由客服協助確認時段。',
  '最長可預約時間：可預約未來 90 天內之諮詢時段。',
  '是否訂閱制：否。',
  '是否儲值式：否。',
  '改期：如需更改預約時間，請最晚於預約時間前一天告知，以便為您妥善安排。',
  '取消：預約時間三天前取消，將全額退費；若於預約時間三天內取消，恕不退費，但可更改時間，請提前告知。',
  '遲到：為保障其他客戶權益，請務必準時赴約，遲到時間將照常計算，不另行補償。',
]

function toDatetimeLocal(date: string, time: string) {
  return `${date}T${time}:00+08:00`
}

function addMinutes(dateTime: string, minutes: number) {
  const date = new Date(dateTime)
  date.setMinutes(date.getMinutes() + minutes)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${d}T${hh}:${mm}:00+08:00`
}

function getTomorrowDate() {
  const cursor = new Date()
  cursor.setDate(cursor.getDate() + 1)
  return `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`
}

function slotLabel(slot: string, durationMinutes: number) {
  return `${slot}-${addMinutes(toDatetimeLocal('2026-01-01', slot), durationMinutes).slice(11, 16)}`
}

function padDatePart(value: string) {
  return value.padStart(2, '0')
}

export function BookingForm() {
  const [planId, setPlanId] = useState(bookingPlans[0].id)
  const [paymentMethod, setPaymentMethod] = useState<'bank-transfer' | 'newebpay-coming-soon'>('bank-transfer')
  const [bookingDate, setBookingDate] = useState(getTomorrowDate())
  const [bookingTime, setBookingTime] = useState(availableSlots[0])
  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [lineDisplayName, setLineDisplayName] = useState('')
  const [gender, setGender] = useState<BookingFormInput['gender']>('female')
  const [birthYear, setBirthYear] = useState('')
  const [birthMonth, setBirthMonth] = useState('')
  const [birthDay, setBirthDay] = useState('')
  const [birthTime, setBirthTime] = useState('')
  const [birthPlace, setBirthPlace] = useState('')
  const [isBirthTimeAccurate, setIsBirthTimeAccurate] = useState<boolean | null>(null)
  const [question, setQuestion] = useState('')
  const [note, setNote] = useState('')
  const [hasAcceptedNotice, setHasAcceptedNotice] = useState(false)
  const [formError, setFormError] = useState('')
  const birthDateInputRef = useRef<HTMLInputElement | null>(null)

  const selectedPlan = getBookingPlan(planId) ?? bookingPlans[0]
  const startTime = bookingDate && bookingTime ? toDatetimeLocal(bookingDate, bookingTime) : ''
  const endTime = startTime ? addMinutes(startTime, selectedPlan.durationMinutes) : ''
  const birthDate = birthYear && birthMonth && birthDay ? `${birthYear}-${padDatePart(birthMonth)}-${padDatePart(birthDay)}` : ''

  const slotOptions = availableSlots.map((slot) => {
    const start = bookingDate ? toDatetimeLocal(bookingDate, slot) : ''
    const end = start ? addMinutes(start, selectedPlan.durationMinutes) : ''
    const tooSoon = start ? new Date(start).getTime() < Date.now() + 24 * 60 * 60 * 1000 : false
    const conflicted = start && end ? hasBookingConflict(start, end) : false
    return { slot, disabled: tooSoon || conflicted }
  })

  const buildInput = (): BookingFormInput | null => {
    const user = getMockUser()
    if (!user) {
      setFormError('請先登入會員，再進行水瓶先生論命預約。')
      return null
    }
    if (!customerName.trim() || !customerEmail.trim() || !birthDate || !birthTime || isBirthTimeAccurate === null || !question.trim()) {
      setFormError('姓名、Email、出生年月日、出生時間狀態、出生時間與想詢問的問題皆為必填欄位。')
      return null
    }
    if (!startTime || !endTime) {
      setFormError('請選擇預約日期與時間。')
      return null
    }
    if (hasBookingConflict(startTime, endTime)) {
      setFormError('這個時段已被預約，請選擇其他時間。')
      return null
    }
    if (!hasAcceptedNotice) {
      setFormError('請先勾選同意真人論命服務說明、退款政策、服務條款與預約相關規則。')
      return null
    }

    return {
      userId: user.id,
      planId,
      startTime,
      endTime,
      customerName: customerName.trim(),
      customerEmail: customerEmail.trim(),
      customerPhone: customerPhone.trim() || undefined,
      lineDisplayName: lineDisplayName.trim() || undefined,
      gender,
      birthDate,
      birthTime,
      birthPlace: birthPlace.trim() || undefined,
      isBirthTimeAccurate,
      question: question.trim(),
      note: note.trim() || undefined
    }
  }

  const prepareBookingPayment = async () => {
    const input = buildInput()
    if (!input) return false

    let bookingId: string | undefined
    try {
      const accessToken = await getAuthAccessToken()
      const response = await fetch('/api/bookings/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
        },
        body: JSON.stringify(input)
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || data.ok === false) {
        throw new Error(data.message || '建立預約失敗')
      }
      bookingId = data.bookingId
    } catch (error) {
      setFormError(error instanceof Error ? error.message : '建立預約失敗，請稍後再試。')
      return false
    }

    const pending = savePendingBooking(input, bookingId)
    if (!pending) {
      setFormError('預約資料暫存失敗，請確認是否已登入。')
      return false
    }

    if (paymentMethod === 'bank-transfer') {
      setFormError('')
      window.location.href = `/bank-transfer/submit?itemType=booking&itemId=${encodeURIComponent(bookingId ?? '')}&itemName=${encodeURIComponent(selectedPlan.name)}&amountTwd=${encodeURIComponent(String(selectedPlan.price))}`
      return false
    }

    if (paymentMethod === 'newebpay-coming-soon') {
      setFormError('藍新線上付款功能目前尚未開放，請先使用銀行匯款。')
      return false
    }

    setFormError('')
    return true
  }

  const updateBirthDateFromPicker = (value: string) => {
    const [year, month, day] = value.split('-')
    setBirthYear(year ?? '')
    setBirthMonth(month ? String(Number(month)) : '')
    setBirthDay(day ? String(Number(day)) : '')
  }

  const openBirthDatePicker = () => {
    if (!birthDateInputRef.current) return
    if (typeof birthDateInputRef.current.showPicker === 'function') {
      birthDateInputRef.current.showPicker()
      return
    }
    birthDateInputRef.current.click()
  }

  return (
    <div className="grid gap-6">
      <form className="grid gap-6 rounded-2xl border border-borderSoft bg-white p-6 shadow-soft md:p-8">
        <div>
          <p className="text-sm font-semibold text-darkGold">預約表單</p>
          <h2 className="mt-2 font-serifTC text-2xl font-semibold text-deepPurple">預約資料</h2>
        </div>

        <div className="rounded-2xl border border-deepPurple bg-softPurple p-5 shadow-soft">
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-darkGold">諮詢方案</span>
            <select
              className="focus-ring rounded-lg border border-borderSoft bg-white px-4 py-3 font-semibold text-deepPurple"
              onChange={(event) => setPlanId(event.target.value)}
              value={planId}
            >
              {bookingPlans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name}｜60 分鐘｜NT${plan.price.toLocaleString()}
                </option>
              ))}
            </select>
          </label>
          <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="font-serifTC text-2xl font-semibold text-deepPurple">{selectedPlan.name}</h3>
              <p className="mt-2 leading-7 text-textMuted">{selectedPlan.description}</p>
            </div>
            <p className="shrink-0 text-2xl font-semibold text-deepPurple">NT${selectedPlan.price.toLocaleString()}</p>
          </div>
          <div className="mt-4 flex items-center gap-2 font-semibold text-darkGold">
            <CheckCircle2 size={18} />
            {selectedPlan.durationMinutes} 分鐘
          </div>
        </div>

        <div className="grid gap-4 rounded-2xl border border-borderSoft bg-softPurple p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-deepPurple">
            <CalendarDays size={18} />
            選擇日期與時間
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-textDark">預約日期</span>
              <input
                className="focus-ring rounded-lg border border-borderSoft bg-white px-4 py-3"
                min={getTomorrowDate()}
                onChange={(event) => setBookingDate(event.target.value)}
                type="date"
                value={bookingDate}
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-textDark">預約時間</span>
              <select className="focus-ring rounded-lg border border-borderSoft bg-white px-4 py-3" onChange={(event) => setBookingTime(event.target.value)} value={bookingTime}>
                {slotOptions.map(({ slot, disabled }) => (
                  <option disabled={disabled} key={slot} value={slot}>
                    {slotLabel(slot, selectedPlan.durationMinutes)}{disabled ? '（不可預約）' : ''}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="text-sm leading-6 text-textMuted">
            目前每日開放 13:00-14:00、15:00-16:00、17:00-18:00。24 小時內不開放預約。
            <br />
            備註：另有其他時間需求，請私訊
            <a className="font-semibold text-deepPurple underline underline-offset-4" href={officialLineUrl} target="_blank" rel="noopener noreferrer">
              官方 LINE
            </a>
            。
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-textDark">姓名 *</span>
            <input className="focus-ring rounded-lg border border-borderSoft px-4 py-3" onChange={(event) => setCustomerName(event.target.value)} value={customerName} />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-textDark">Email *</span>
            <input className="focus-ring rounded-lg border border-borderSoft px-4 py-3" onChange={(event) => setCustomerEmail(event.target.value)} type="email" value={customerEmail} />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-textDark">手機</span>
            <input className="focus-ring rounded-lg border border-borderSoft px-4 py-3" onChange={(event) => setCustomerPhone(event.target.value)} value={customerPhone} />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-textDark">LINE 顯示名稱</span>
            <input className="focus-ring rounded-lg border border-borderSoft px-4 py-3" onChange={(event) => setLineDisplayName(event.target.value)} value={lineDisplayName} />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-textDark">性別 *</span>
            <select className="focus-ring rounded-lg border border-borderSoft bg-white px-4 py-3" onChange={(event) => setGender(event.target.value as BookingFormInput['gender'])} value={gender}>
              <option value="female">女</option>
              <option value="male">男</option>
            </select>
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-textDark">出生年月日（國曆）*</span>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <input
                className="focus-ring h-14 w-32 rounded-lg border border-borderSoft px-4 py-3 text-lg"
                inputMode="numeric"
                maxLength={4}
                onChange={(event) => setBirthYear(event.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="1990"
                value={birthYear}
              />
              <span className="font-semibold text-textMuted">年</span>
              <input
                className="focus-ring h-14 w-24 rounded-lg border border-borderSoft px-4 py-3 text-lg"
                inputMode="numeric"
                maxLength={2}
                onChange={(event) => setBirthMonth(event.target.value.replace(/\D/g, '').slice(0, 2))}
                placeholder="1"
                value={birthMonth}
              />
              <span className="font-semibold text-textMuted">月</span>
              <input
                className="focus-ring h-14 w-24 rounded-lg border border-borderSoft px-4 py-3 text-lg"
                inputMode="numeric"
                maxLength={2}
                onChange={(event) => setBirthDay(event.target.value.replace(/\D/g, '').slice(0, 2))}
                placeholder="31"
                value={birthDay}
              />
              <span className="font-semibold text-textMuted">日</span>
              <button
                aria-label="選擇出生年月日"
                className="focus-ring flex h-14 w-16 items-center justify-center rounded-lg border border-borderSoft bg-white text-textDark"
                onClick={openBirthDatePicker}
                type="button"
              >
                <CalendarDays size={22} />
              </button>
              <input
                ref={birthDateInputRef}
                className="sr-only"
                onChange={(event) => updateBirthDateFromPicker(event.target.value)}
                tabIndex={-1}
                type="date"
                value={birthDate}
              />
            </div>
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-textDark">出生時間 *</span>
            <input className="focus-ring rounded-lg border border-borderSoft px-4 py-3" onChange={(event) => setBirthTime(event.target.value)} type="time" value={birthTime} />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-textDark">出生地</span>
            <input
              className="focus-ring rounded-lg border border-borderSoft px-4 py-3"
              onChange={(event) => setBirthPlace(event.target.value)}
              placeholder="例如：台灣台北市、台灣彰化縣、日本東京、美國洛杉磯"
              value={birthPlace}
            />
          </label>
        </div>

        <div className="grid gap-2">
          <span className="text-sm font-semibold text-textDark">出生時間狀態 *</span>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              className={`focus-ring rounded-xl border px-4 py-4 text-sm font-semibold ${
                isBirthTimeAccurate === true ? 'border-deepPurple bg-softPurple text-deepPurple' : 'border-borderSoft bg-white text-textMuted'
              }`}
              onClick={() => setIsBirthTimeAccurate(true)}
              type="button"
            >
              我知道準確出生時間
            </button>
            <button
              className={`focus-ring rounded-xl border px-4 py-4 text-sm font-semibold ${
                isBirthTimeAccurate === false ? 'border-deepPurple bg-softPurple text-deepPurple' : 'border-borderSoft bg-white text-textMuted'
              }`}
              onClick={() => setIsBirthTimeAccurate(false)}
              type="button"
            >
              不確定準確出生時間
            </button>
          </div>
        </div>

        <label className="grid gap-2">
          <span className="text-sm font-semibold text-textDark">想詢問的問題 *</span>
          <textarea className="focus-ring min-h-32 rounded-lg border border-borderSoft px-4 py-3" onChange={(event) => setQuestion(event.target.value)} placeholder="例如：今年工作方向、感情關係、財運與流年..." value={question} />
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-semibold text-textDark">備註</span>
          <textarea className="focus-ring min-h-20 rounded-lg border border-borderSoft px-4 py-3" onChange={(event) => setNote(event.target.value)} value={note} />
        </label>

        <div className="rounded-xl border border-lightGold bg-white p-4 text-sm leading-6 text-textMuted">
          第一版為 mock 付款。正式串接後，付款成功才會建立 Google Calendar 事件與寄出 Resend 確認信。
        </div>

        <div className="rounded-2xl border border-borderSoft bg-softPurple p-5">
          <p className="text-sm font-semibold text-deepPurple">選擇付款方式</p>
          <div className="mt-4 grid gap-3">
            <label className="cursor-pointer rounded-xl border border-borderSoft bg-white p-4">
              <div className="flex items-start gap-3">
                <input
                  checked={paymentMethod === 'bank-transfer'}
                  className="mt-1 h-4 w-4 accent-deepPurple"
                  name="booking-payment-method"
                  onChange={() => setPaymentMethod('bank-transfer')}
                  type="radio"
                />
                <div>
                  <p className="font-semibold text-textDark">銀行匯款｜人工確認</p>
                  <p className="mt-1 text-sm text-textMuted">
                    匯款完成後，請填寫匯款回報表單，並加入水瓶先生官方 LINE 回覆「已匯款＋姓名＋購買項目」。客服確認款項後，將協助確認預約。
                  </p>
                </div>
              </div>
            </label>
            <label className="cursor-not-allowed rounded-xl border border-borderSoft bg-white p-4 opacity-70">
              <div className="flex items-start gap-3">
                <input
                  checked={paymentMethod === 'newebpay-coming-soon'}
                  className="mt-1 h-4 w-4 accent-deepPurple"
                  disabled
                  name="booking-payment-method"
                  onChange={() => setPaymentMethod('newebpay-coming-soon')}
                  type="radio"
                />
                <div>
                  <p className="font-semibold text-textDark">藍新線上付款｜即將開放</p>
                  <p className="mt-1 text-sm text-textMuted">
                    真人論命線上刷卡付款建置中，目前請先使用銀行匯款完成預約付款。
                  </p>
                </div>
              </div>
            </label>
          </div>
        </div>

        <div className="rounded-2xl border border-borderSoft bg-softPurple p-5">
          <details className="group">
            <summary className="cursor-pointer list-none font-serifTC text-xl font-semibold text-deepPurple">
              水瓶先生論命須知
              <span className="ml-2 text-sm font-sansTC text-textMuted group-open:hidden">點我查看</span>
              <span className="ml-2 hidden text-sm font-sansTC text-textMuted group-open:inline">收合內容</span>
            </summary>
            <div className="mt-5 grid gap-5 text-sm leading-7 text-textMuted">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-darkGold">SERVICE NOTICE</p>
              <p className="text-lg font-semibold text-deepPurple">真人論命服務說明</p>
              <div className="grid gap-3">
                {serviceNoticeRows.map((row) => (
                  <p key={row} className="rounded-xl bg-white px-4 py-3">
                    {row}
                  </p>
                ))}
              </div>
            </div>
          </details>

          <div className="mt-5 flex items-start gap-3 rounded-xl border border-borderSoft bg-white p-4 text-sm font-semibold leading-7 text-textDark">
            <input
              id="booking-terms-consent"
              checked={hasAcceptedNotice}
              className="mt-1 h-5 w-5 accent-deepPurple"
              onChange={(event) => setHasAcceptedNotice(event.target.checked)}
              type="checkbox"
            />
            <p>
              我已詳細閱讀並同意《真人論命服務說明》、
              <Link className="text-deepPurple underline underline-offset-4" href="/refund-policy">
                退款政策
              </Link>
              、
              <Link className="text-deepPurple underline underline-offset-4" href="/terms">
                服務條款
              </Link>
              ，並了解預約、改期、取消與遲到規則。
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-[#bfe8cb] bg-[#f1fff5] p-5">
          <p className="text-sm font-semibold text-[#078c3f]">官方 LINE 預約提醒</p>
          <p className="mt-2 leading-7 text-textMuted">
            官方 LINE 預約提醒
            <br />
            水瓶先生官方 LINE：
            <a className="ml-1 font-semibold text-deepPurple underline underline-offset-4" href={officialLineUrl} rel="noopener noreferrer" target="_blank">
              {officialLineUrl}
            </a>
          </p>
          <p className="mt-2 leading-7 text-textMuted">預約完成後，請加入官方 LINE 並主動回覆「已預約＋姓名」，以利客服確認預約資訊與後續安排。</p>
          <a
            className="focus-ring mt-4 inline-flex rounded-lg bg-[#06c755] px-5 py-3 text-sm font-semibold text-white shadow-soft transition hover:scale-[1.02]"
            href={officialLineUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            加入官方 LINE
          </a>
        </div>

        {formError && <p className="text-sm font-semibold text-deepPurple">{formError}</p>}

        <ActionButton
          amount={selectedPlan.price}
          beforeStart={prepareBookingPayment}
          className="focus-ring w-full rounded-lg bg-deepPurple px-4 py-3 font-semibold text-white"
          itemName={selectedPlan.name}
          itemType="booking"
        >
          {paymentMethod === 'bank-transfer' ? '建立預約並填寫匯款回報' : `前往付款 NT${selectedPlan.price.toLocaleString()}`}
        </ActionButton>
      </form>
    </div>
  )
}
