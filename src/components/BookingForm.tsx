'use client'

import { CalendarDays, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActionButton } from './ActionButton'
import { PaymentMethodSelector } from './payments/PaymentMethodSelector'
import { createAsyncIdentityGuard } from '@/lib/auth/asyncIdentityGuard'
import { bookingPlans, getBookingPlan } from '@/lib/bookingPlans'
import { getAuthAccessToken, getMockUser, subscribeAuthChange } from '@/lib/mockAuth'
import type { BookingFormInput } from '@/lib/bookings/types'
import {
  getCheckoutPaymentMethodOptions,
  isLinePayCheckoutMethod,
  toStandardNewebPayCheckoutMode,
  type StandardCheckoutPaymentMethod,
} from '@/lib/payments/paymentMethods'
import {
  getServiceLinePayErrorMessage,
  requestServiceLinePayCheckout,
} from '@/lib/linePay/serviceCheckoutClient'
import { requestLinePayProductionOneDollarEntryCheckout } from '@/lib/linePay/productionOneDollarEntryClient'
import { useLinePayProductionOneDollarEntryTest } from './payments/useLinePayProductionOneDollarEntryTest'

const officialLineUrl = 'https://lin.ee/6Tpje1P'

function padDatePart(value: string) {
  return value.padStart(2, '0')
}

type PublicBookingSlot = {
  id: string
  startAt: string
  endAt: string
  label: string
}

type BookingFormProps = {
  resetKey?: string
}

function getBirthDateParts(value: string) {
  const [year, month, day] = value.split('-')
  return {
    year: year ?? '',
    month: month ? String(Number(month)) : '',
    day: day ? String(Number(day)) : '',
  }
}

type NewebPayCreateResponse =
  | {
      ok: true
      action: string
      method: 'POST'
      merchantOrderNo: string
      itemKey: string
      amount: number
      fields: {
        MerchantID: string
        TradeInfo: string
        TradeSha: string
        Version: string
      }
    }
  | {
      ok: false
      error?: string
    }

const isNewebPayEnabled = process.env.NEXT_PUBLIC_ENABLE_NEWEBPAY === 'true'
const isLinePayEnabled = process.env.NEXT_PUBLIC_ENABLE_LINE_PAY === 'true'

const taipeiDateInputFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Taipei',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const taipeiDateLabelFormatter = new Intl.DateTimeFormat('zh-TW', {
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

function getTaipeiDateValue(value: string) {
  const parts = taipeiDateInputFormatter.formatToParts(new Date(value))
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${lookup.year}-${lookup.month}-${lookup.day}`
}

function getTaipeiDateLabel(value: string) {
  return taipeiDateLabelFormatter.format(new Date(`${value}T00:00:00+08:00`))
}

function getTaipeiTimeRange(slot: PublicBookingSlot) {
  return `${taipeiTimeFormatter.format(new Date(slot.startAt))}–${taipeiTimeFormatter.format(new Date(slot.endAt))}`
}

function submitNewebPayForm(action: string, fields: Extract<NewebPayCreateResponse, { ok: true }>['fields']) {
  const form = document.createElement('form')
  form.method = 'POST'
  form.action = action
  form.style.display = 'none'

  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement('input')
    input.type = 'hidden'
    input.name = name
    input.value = value
    form.appendChild(input)
  }

  document.body.appendChild(form)
  form.submit()
}

export function BookingForm({ resetKey = '' }: BookingFormProps) {
  const linePayEntryTestEnabled = useLinePayProductionOneDollarEntryTest()
  const [planId, setPlanId] = useState(bookingPlans[0].id)
  const [bookingSlots, setBookingSlots] = useState<PublicBookingSlot[]>([])
  const [selectedBookingDate, setSelectedBookingDate] = useState('')
  const [selectedSlotId, setSelectedSlotId] = useState('')
  const [bookingSlotsLoading, setBookingSlotsLoading] = useState(true)
  const [bookingSlotsError, setBookingSlotsError] = useState('')
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
  const [formStatus, setFormStatus] = useState('')
  const [createdBookingId, setCreatedBookingId] = useState('')
  const [createdBookingSignature, setCreatedBookingSignature] = useState('')
  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<StandardCheckoutPaymentMethod>(() =>
      isNewebPayEnabled ? 'credit_card' : 'line_pay',
    )
  const authSubjectIdRef = useRef(getMockUser()?.id ?? null)
  const formResourceKey = useMemo(
    () =>
      JSON.stringify({
        birthDay,
        birthMonth,
        birthPlace,
        birthTime,
        birthYear,
        customerEmail,
        customerName,
        customerPhone,
        gender,
        hasAcceptedNotice,
        isBirthTimeAccurate,
        lineDisplayName,
        note,
        planId,
        selectedPaymentMethod,
        question,
        resetKey,
        selectedSlotId,
      }),
    [
      birthDay,
      birthMonth,
      birthPlace,
      birthTime,
      birthYear,
      customerEmail,
      customerName,
      customerPhone,
      gender,
      hasAcceptedNotice,
      isBirthTimeAccurate,
      lineDisplayName,
      note,
      planId,
      selectedPaymentMethod,
      question,
      resetKey,
      selectedSlotId,
    ],
  )
  const formResourceKeyRef = useRef(formResourceKey)
  const [bookingGuard] = useState(() => createAsyncIdentityGuard())
  const resetFormToBlank = useCallback(() => {
    setPlanId(bookingPlans[0].id)
    setSelectedBookingDate('')
    setSelectedSlotId('')
    setBookingSlotsError('')
    setCustomerName('')
    setCustomerEmail('')
    setCustomerPhone('')
    setLineDisplayName('')
    setGender('female')
    setBirthYear('')
    setBirthMonth('')
    setBirthDay('')
    setBirthTime('')
    setBirthPlace('')
    setIsBirthTimeAccurate(null)
    setQuestion('')
    setNote('')
    setHasAcceptedNotice(false)
    setFormError('')
    setFormStatus('')
    setCreatedBookingId('')
    setCreatedBookingSignature('')
    setSelectedPaymentMethod(isNewebPayEnabled ? 'credit_card' : 'line_pay')
  }, [])

  useEffect(() => {
    if (formResourceKeyRef.current !== formResourceKey) {
      formResourceKeyRef.current = formResourceKey
      bookingGuard.invalidate()
    }
  }, [bookingGuard, formResourceKey])

  useEffect(() => {
    const unsubscribeAuth = subscribeAuthChange(() => {
      const nextSubjectId = getMockUser()?.id ?? null
      if (nextSubjectId === authSubjectIdRef.current) return
      authSubjectIdRef.current = nextSubjectId
      bookingGuard.invalidate()
      resetFormToBlank()
    })

    return () => {
      unsubscribeAuth()
      bookingGuard.invalidate()
    }
  }, [bookingGuard, resetFormToBlank])

  const selectedPlan = getBookingPlan(planId) ?? bookingPlans[0]
  const bookingDateOptions = useMemo(() => {
    const dates = new Map<string, string>()

    for (const slot of bookingSlots) {
      const dateValue = getTaipeiDateValue(slot.startAt)
      if (!dates.has(dateValue)) {
        dates.set(dateValue, getTaipeiDateLabel(dateValue))
      }
    }

    return Array.from(dates, ([value, label]) => ({ value, label }))
  }, [bookingSlots])
  const slotsForSelectedDate = useMemo(
    () => bookingSlots.filter((slot) => getTaipeiDateValue(slot.startAt) === selectedBookingDate),
    [bookingSlots, selectedBookingDate],
  )
  const selectedBookingSlot = bookingSlots.find((slot) => slot.id === selectedSlotId) ?? null
  const startTime = selectedBookingSlot?.startAt ?? ''
  const endTime = selectedBookingSlot?.endAt ?? ''
  const birthDate = birthYear && birthMonth && birthDay ? `${birthYear}-${padDatePart(birthMonth)}-${padDatePart(birthDay)}` : ''

  useEffect(() => {
    let cancelled = false

    async function loadBookingSlots() {
      setBookingSlotsLoading(true)
      setBookingSlotsError('')

      try {
        const response = await fetch('/api/booking-slots', { cache: 'no-store' })
        const data = (await response.json().catch(() => null)) as { ok?: boolean; slots?: PublicBookingSlot[]; error?: string } | null

        if (!response.ok || data?.ok === false) {
          throw new Error(data?.error ?? '讀取可預約時段失敗。')
        }

        if (cancelled) return

        const slots = data?.slots ?? []
        setBookingSlots(slots)
        setSelectedBookingDate('')
        setSelectedSlotId('')
      } catch (error) {
        if (cancelled) return
        setBookingSlots([])
        setSelectedBookingDate('')
        setSelectedSlotId('')
        setBookingSlotsError(error instanceof Error ? error.message : '讀取可預約時段失敗。')
      } finally {
        if (!cancelled) setBookingSlotsLoading(false)
      }
    }

    void loadBookingSlots()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    resetFormToBlank()
  }, [resetKey, resetFormToBlank])

  const updateSelectedBookingDate = (dateValue: string) => {
    setSelectedBookingDate(dateValue)
    const firstSlot = bookingSlots.find((slot) => getTaipeiDateValue(slot.startAt) === dateValue)
    setSelectedSlotId(firstSlot?.id ?? '')
  }

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
    if (!selectedBookingSlot || !startTime || !endTime) {
      setFormError('請選擇預約時段。')
      return null
    }
    if (!hasAcceptedNotice) {
      setFormError('請先勾選同意真人論命服務說明、退款政策、服務條款與預約相關規則。')
      return null
    }

    return {
      slotId: selectedBookingSlot.id,
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
    const currentIdentity = () => ({
      resourceKey: formResourceKeyRef.current,
      subjectId: getMockUser()?.id ?? null,
    })
    const requestToken = bookingGuard.begin(currentIdentity())
    if (!requestToken) {
      setFormError('請先登入會員，再進行水瓶先生論命預約。')
      return false
    }
    const isCurrentRequest = () =>
      bookingGuard.isCurrent(requestToken, currentIdentity())

    setFormStatus('')
    const isLinePay = isLinePayCheckoutMethod(selectedPaymentMethod)
    if (isLinePay ? !isLinePayEnabled : !isNewebPayEnabled) {
      setFormError('目前暫時無法使用線上付款，請稍後再試或聯繫客服。')
      return false
    }

    if (isLinePay && linePayEntryTestEnabled) {
      try {
        const accessToken = await getAuthAccessToken()
        if (!isCurrentRequest() || !accessToken) return false
        setFormError('')
        setFormStatus('正在前往 LINE Pay NT$1 測試付款頁，請稍候。')
        const result = await requestLinePayProductionOneDollarEntryCheckout({
          accessToken,
          entrySource: 'booking',
        })
        if (!isCurrentRequest()) return false
        if (!result.ok) {
          setFormStatus('')
          setFormError('LINE Pay NT$1 測試付款頁建立失敗，請稍後再試。')
          return false
        }
        window.location.assign(result.paymentUrlWeb)
      } catch {
        if (isCurrentRequest()) {
          setFormStatus('')
          setFormError('LINE Pay NT$1 測試付款頁建立失敗，請稍後再試。')
        }
      }
      return false
    }

    const bookingSignature = JSON.stringify(input)
    let bookingId = createdBookingSignature === bookingSignature ? createdBookingId : ''

    if (!bookingId) {
      try {
        const accessToken = await getAuthAccessToken()
        if (!isCurrentRequest() || !accessToken) return false
        const response = await fetch('/api/bookings/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
          },
          body: JSON.stringify(input)
        })
        const data = (await response.json().catch(() => ({}))) as { ok?: boolean; message?: string; bookingId?: string }
        if (!isCurrentRequest()) return false
        if (!response.ok || data.ok === false) {
          throw new Error(data.message || '建立預約失敗')
        }
        if (!data.bookingId) {
          throw new Error('建立預約失敗')
        }
        bookingId = data.bookingId
        setCreatedBookingId(bookingId)
        setCreatedBookingSignature(bookingSignature)
      } catch (error) {
        if (isCurrentRequest()) {
          setFormError(error instanceof Error ? error.message : '建立預約失敗，請稍後再試。')
        }
        return false
      }
    }

    try {
      if (!isCurrentRequest()) return false
      setFormError('')
      setFormStatus('正在前往藍新金流付款頁，請稍候。')
      const accessToken = await getAuthAccessToken()
      if (!isCurrentRequest() || !accessToken) return false

      if (isLinePay) {
        setFormStatus('正在前往 LINE Pay 付款頁，請稍候。')
        const result = await requestServiceLinePayCheckout({
          accessToken,
          source: 'booking',
          sourceId: bookingId,
          idempotencyKey: `booking-line-pay:${bookingId}`,
        })
        if (!isCurrentRequest()) return false
        if (!result.ok) {
          setFormStatus('')
          setFormError(getServiceLinePayErrorMessage(result))
          return false
        }
        window.location.assign(result.paymentUrlWeb)
        return false
      }

      const response = await fetch('/api/payments/newebpay/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
        },
        body: JSON.stringify({
          itemKey: 'booking_consultation_60',
          source: 'booking',
          paymentMode: toStandardNewebPayCheckoutMode(selectedPaymentMethod),
          bookingId
        })
      })
      const data = (await response.json().catch(() => null)) as NewebPayCreateResponse | null
      if (!isCurrentRequest()) return false

      if (!response.ok || !data || data.ok !== true) {
        throw new Error(data?.ok === false ? data.error || '建立線上付款資料失敗' : '建立線上付款資料失敗')
      }

      if (!isCurrentRequest()) return false
      submitNewebPayForm(data.action, data.fields)
    } catch {
      if (isCurrentRequest()) {
        setFormStatus('')
        setFormError('預約已建立，但付款頁建立失敗。請稍後重試；如仍無法付款，請聯繫客服，勿重複建立預約。')
      }
    }

    return false
  }

  const updateBirthDateFromPicker = (value: string) => {
    const dateParts = getBirthDateParts(value)
    setBirthYear(dateParts.year)
    setBirthMonth(dateParts.month)
    setBirthDay(dateParts.day)
  }

  return (
    <div className="grid min-w-0 max-w-full gap-6">
      <form className="grid min-w-0 max-w-full gap-6 rounded-2xl border border-borderSoft bg-white p-6 shadow-soft md:p-8 [&_*]:min-w-0 [&_input]:max-w-full [&_select]:max-w-full [&_textarea]:max-w-full">
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

        <div className="grid gap-4 rounded-2xl border border-borderSoft bg-softPurple p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-deepPurple">
            <CalendarDays size={18} />
            選擇預約時段
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid w-full gap-2">
              <span className="text-sm font-semibold text-textDark">選擇日期</span>
              <span
                className={`relative flex h-12 w-full items-center rounded-xl border border-borderSoft bg-white px-4 md:h-14 ${
                  bookingSlotsLoading || bookingSlots.length === 0 ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                }`}
              >
                <span aria-hidden="true" className="flex w-full items-center justify-between gap-3 text-base font-semibold text-textDark md:text-lg">
                  <span>{selectedBookingDate ? getTaipeiDateLabel(selectedBookingDate) : '請選擇日期'}</span>
                  <CalendarDays className="shrink-0 text-deepPurple" size={20} />
                </span>
                <input
                  aria-label="選擇預約日期"
                  className="focus-ring absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
                  disabled={bookingSlotsLoading || bookingSlots.length === 0}
                  min={bookingDateOptions[0]?.value}
                  onChange={(event) => updateSelectedBookingDate(event.target.value)}
                  type="date"
                  value={selectedBookingDate}
                />
              </span>
            </label>
            <label className="grid w-full gap-2">
              <span className="text-sm font-semibold text-textDark">選擇時間</span>
              <select
                className="focus-ring h-14 w-full rounded-xl border border-borderSoft bg-white px-4 py-3 text-lg font-semibold text-textDark"
                disabled={bookingSlotsLoading || !selectedBookingDate || slotsForSelectedDate.length === 0}
                onChange={(event) => setSelectedSlotId(event.target.value)}
                value={selectedSlotId}
              >
                {bookingSlotsLoading ? (
                  <option value="">讀取可預約時段中...</option>
                ) : !selectedBookingDate ? (
                  <option value="">請先選擇日期</option>
                ) : slotsForSelectedDate.length > 0 ? (
                  slotsForSelectedDate.map((slot) => (
                    <option key={slot.id} value={slot.id}>
                      {getTaipeiTimeRange(slot)}
                    </option>
                  ))
                ) : (
                  <option value="">該日期沒有可預約時段</option>
                )}
              </select>
            </label>
          </div>
          {!bookingSlotsLoading && bookingSlots.length === 0 ? (
            <p className="text-sm font-semibold text-deepPurple">目前沒有可預約時段</p>
          ) : null}
          {bookingSlotsError ? <p className="text-sm font-semibold text-deepPurple">{bookingSlotsError}</p> : null}
          <p className="text-sm leading-6 text-textMuted">
            目前僅顯示後台已開放且尚未過期的時段。
            <br />
            如有其他時間需求，請私訊
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
              <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-borderSoft bg-white text-textDark md:h-14 md:w-16">
                <CalendarDays aria-hidden="true" size={22} />
                <input
                  aria-label="選擇出生年月日"
                  className="focus-ring absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  onChange={(event) => updateBirthDateFromPicker(event.target.value)}
                  type="date"
                  value={birthDate}
                />
              </span>
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

        <div className="grid gap-3 rounded-2xl border border-borderSoft bg-softPurple p-5">
          <PaymentMethodSelector
            onChange={(method) => {
              if (method === 'credit_card_installment_3' || method === 'credit_card_installment_6') return
              setSelectedPaymentMethod(method)
              setFormError('')
              setFormStatus('')
            }}
            options={getCheckoutPaymentMethodOptions({
              includeLinePay: isLinePayEnabled,
              includeNewebPay: isNewebPayEnabled,
            })}
            value={selectedPaymentMethod}
          />
          <p className="text-xs leading-6 text-textMuted">
            付款狀態由藍新或 LINE Pay 系統背景通知自動確認；ATM 請依藍新提供的本次專用虛擬帳號完成轉帳。
          </p>
          {(isLinePayCheckoutMethod(selectedPaymentMethod) ? !isLinePayEnabled : !isNewebPayEnabled) ? (
            <p className="rounded-xl border border-borderSoft bg-white p-4 text-sm font-semibold leading-6 text-deepPurple">
              目前暫時無法使用線上付款，請稍後再試或聯繫客服。
            </p>
          ) : null}
        </div>

        <div className="rounded-2xl border border-borderSoft bg-softPurple p-5">
          <details className="group">
            <summary className="cursor-pointer list-none font-serifTC text-xl font-semibold text-deepPurple">
              水瓶先生論命須知
              <span className="ml-2 text-sm font-sansTC text-textMuted group-open:hidden">點我查看</span>
              <span className="ml-2 hidden text-sm font-sansTC text-textMuted group-open:inline">收合內容</span>
            </summary>
            <div className="mt-5 space-y-4 text-sm leading-7 text-textMuted">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-darkGold">SERVICE NOTICE</p>
              <h3 className="text-lg font-semibold text-deepPurple">真人論命服務說明</h3>
              <p>水瓶先生論命為一對一線上紫微斗數諮詢，服務時間為 60 分鐘，費用為 NT$3,600／1 小時。諮詢方式以 LINE 通話或 Zoom 為主。</p>
              <p>可預約未來 90 天內的諮詢時段。完成付款後，將由客服協助確認預約資訊與後續安排。本服務不是訂閱制，也不是儲值制。</p>

              <div>
                <h4 className="font-semibold text-textDark">◆ 關於改期或取消</h4>
                <ol className="mt-2 list-decimal space-y-1 pl-5">
                  <li>改期：如需更改預約時間，請最晚於預約時間前一天告知，以便為您妥善安排。</li>
                  <li>取消：預約時間三天前取消，將全額退費；若於預約時間三天內取消，恕不退費，但可更改時間，請提前告知。</li>
                  <li>遲到：為保障其他客戶權益，請務必準時赴約，遲到時間將照常計算，不另行補償。</li>
                </ol>
              </div>

              <div>
                <h4 className="font-semibold text-textDark">◆ 關於紫微諮詢服務性質</h4>
                <ol className="mt-2 list-decimal space-y-1 pl-5">
                  <li>
                    有關任何資訊或諮詢服務，包含對命盤解讀、心靈、療癒、健康、飲食、關係、家庭、財富、收入、運勢、未來發展等方面的建議，都旨在探討潛在可能性，不保證結果，亦不具任何醫療或治療效果。
                  </li>
                  <li>諮詢結果僅供參考與協助，無法取代專業醫療建議或診斷。若您有任何健康或心理需求，請務必諮詢國家認可的專業醫師。</li>
                  <li>請務必提供正確的出生時間及出生地。若因提供錯誤資訊導致解讀失準，恕不負責。</li>
                </ol>
              </div>

              <div>
                <h4 className="font-semibold text-textDark">◆ 官方 LINE 提醒</h4>
                <p className="mt-1">
                  預約完成後，請加入水瓶先生官方 LINE，並主動回覆「已預約＋姓名」，以利客服確認預約資訊與後續安排。
                </p>
              </div>
              <p className="pt-1">
                <a
                  className="inline-flex rounded-lg bg-[#06c755] px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:scale-[1.02]"
                  href={officialLineUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  加入水瓶先生官方 LINE
                </a>
              </p>

              <div>
                <h4 className="font-semibold text-textDark">◆ 服務條款</h4>
                <p className="mt-1">
                  您同意遵守服務條款的所有規定，並承擔違反條款可能造成的任何責任。若對服務內容有任何疑問，請隨時與我們聯繫。
                </p>
              </div>
            </div>
          </details>

          <div className="mt-5 flex min-h-11 items-start gap-3 rounded-xl border border-borderSoft bg-white p-4 text-sm font-semibold leading-7 text-textDark">
            <input
              id="booking-terms-consent"
              aria-label="我已閱讀並同意真人論命服務說明、退款政策、服務條款與預約規則"
              checked={hasAcceptedNotice}
              className="mt-1 h-6 w-6 shrink-0 accent-deepPurple md:h-5 md:w-5"
              onChange={(event) => setHasAcceptedNotice(event.target.checked)}
              type="checkbox"
            />
            <p>
              <label className="cursor-pointer" htmlFor="booking-terms-consent">
                我已詳細閱讀並同意《真人論命服務說明》、
              </label>
              <Link className="text-deepPurple underline underline-offset-4" href="/refund-policy">
                退款政策
              </Link>
              <label className="cursor-pointer" htmlFor="booking-terms-consent">
                、
              </label>
              <Link className="text-deepPurple underline underline-offset-4" href="/terms">
                服務條款
              </Link>
              <label className="cursor-pointer" htmlFor="booking-terms-consent">
                ，並了解預約、改期、取消與遲到規則。
              </label>
            </p>
          </div>
        </div>

        {formError ? <p className="text-sm font-semibold text-deepPurple">{formError}</p> : null}

        {formStatus && !formError ? (
          <div className="rounded-xl border border-borderSoft bg-softPurple px-4 py-3 text-sm font-semibold text-deepPurple">
            {formStatus}
          </div>
        ) : null}

        <ActionButton
          amount={selectedPlan.price}
          beforeStart={prepareBookingPayment}
          className="focus-ring w-full rounded-lg bg-deepPurple px-4 py-3 font-semibold text-white"
          itemName={selectedPlan.name}
          itemType="booking"
          loadingText="送出中..."
        >
          {isLinePayCheckoutMethod(selectedPaymentMethod) && linePayEntryTestEnabled
            ? '管理員 LINE Pay 入口測試付款 NT$1'
            : `使用所選方式付款 NT$${selectedPlan.price.toLocaleString()}`}
        </ActionButton>
      </form>
    </div>
  )
}
