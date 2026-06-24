'use client'

import { Suspense, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { LoginModal } from '@/components/LoginModal'
import { PageHero } from '@/components/PageHero'
import { getAuthAccessToken, getMockUser, subscribeAuthChange, type UserProfile } from '@/lib/mockAuth'

const lineSupportUrl = 'https://lin.ee/6Tpje1P'

type BankTransferItem = {
  itemType: string
  itemId: string
  itemName: string
  amountTwd: number
}

const transferItems: BankTransferItem[] = [
  { itemType: 'ai_divination', itemId: 'single', itemName: '紫微牌卡占卜單次', amountTwd: 50 },
  { itemType: 'ai_chart', itemId: 'full_analysis', itemName: '紫微命盤完整分析', amountTwd: 100 },
  { itemType: 'booking', itemId: 'ziwei_consultation_60min', itemName: '水瓶先生論命', amountTwd: 3600 },
  { itemType: 'course', itemId: 'basic', itemName: '初級班｜小白專區', amountTwd: 9800 },
  { itemType: 'course', itemId: 'advanced', itemName: '進階班｜進階的解盤技巧', amountTwd: 9800 },
  { itemType: 'course', itemId: 'master', itemName: '高階班｜飛化與占卜技巧', amountTwd: 9800 },
  { itemType: 'other', itemId: 'other', itemName: '其他，請於備註說明', amountTwd: 1 },
]

function BankTransferSubmitContent() {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loginOpen, setLoginOpen] = useState(false)
  const [selectedItemKey, setSelectedItemKey] = useState('course:basic')
  const [amountTwd, setAmountTwd] = useState(9800)
  const [payerName, setPayerName] = useState('')
  const [payerPhone, setPayerPhone] = useState('')
  const [payerEmail, setPayerEmail] = useState('')
  const [lineDisplayName, setLineDisplayName] = useState('')
  const [bankAccountLast5, setBankAccountLast5] = useState('')
  const [transferTime, setTransferTime] = useState('')
  const [note, setNote] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const searchParams = useSearchParams()
  const router = useRouter()
  const [prefilledBookingId, setPrefilledBookingId] = useState('')
  const [isAmountPrefilled, setIsAmountPrefilled] = useState(false)

  const selectedItem = useMemo(() => {
    const [itemType, itemId] = selectedItemKey.split(':')
    return transferItems.find((item) => item.itemType === itemType && item.itemId === itemId) ?? transferItems[0]
  }, [selectedItemKey])

  useEffect(() => {
    const syncUser = () => {
      const nextUser = getMockUser()
      setUser(nextUser)
      if (!nextUser) setLoginOpen(true)
    }

    syncUser()
    const unsubscribe = subscribeAuthChange(syncUser)
    return unsubscribe
  }, [])

  useEffect(() => {
    const itemType = searchParams?.get('itemType')
    const itemId = searchParams?.get('itemId')
    const itemName = searchParams?.get('itemName')
    const amount = Number(searchParams?.get('amountTwd'))

    if (itemType === 'booking' && itemName) {
      const bookingEntry = transferItems.find((item) => item.itemType === 'booking')
      if (bookingEntry) {
        setSelectedItemKey('booking:ziwei_consultation_60min')
        if (Number.isFinite(amount) && amount > 0) {
          setAmountTwd(amount)
          setIsAmountPrefilled(true)
        } else {
          setAmountTwd(bookingEntry.amountTwd)
          setIsAmountPrefilled(false)
        }
        setPrefilledBookingId(itemId ?? '')
      } else {
        setIsAmountPrefilled(false)
      }
    }
    if (itemType !== 'booking') {
      setIsAmountPrefilled(false)
    }
  }, [searchParams])

  useEffect(() => {
    if (!isAmountPrefilled) {
      setAmountTwd(selectedItem.amountTwd)
    }
  }, [selectedItem])

  const submitTransfer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (isSubmitting) {
      return
    }

    setIsSubmitting(true)
    setStatusMessage('')
    setErrorMessage('')

    if (!user) {
      setLoginOpen(true)
      setIsSubmitting(false)
      return
    }

    if (!payerName.trim() || !payerPhone.trim() || !selectedItem.itemName || amountTwd <= 0) {
      setErrorMessage('請填寫姓名、電話、購買項目與金額。')
      setIsSubmitting(false)
      return
    }

    if (!/^\d{5}$/.test(bankAccountLast5)) {
      setErrorMessage('您的匯款帳號後五碼必須是 5 位數字。')
      setIsSubmitting(false)
      return
    }

    const accessToken = await getAuthAccessToken()
    if (!accessToken) {
      setLoginOpen(true)
      setIsSubmitting(false)
      return
    }

    try {
        const response = await fetch('/api/bank-transfer/submit', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          itemType: selectedItem.itemType,
          itemId: selectedItem.itemType === 'booking' && prefilledBookingId ? prefilledBookingId : selectedItem.itemId === 'other' ? null : selectedItem.itemId,
          itemName: selectedItem.itemName,
          amountTwd,
          payerName,
          payerPhone,
          payerEmail,
          lineDisplayName,
          bankAccountLast5,
          transferTime,
          note,
        }),
      })
      const data = (await response.json().catch(() => null)) as { message?: string } | null

      if (!response.ok) {
        throw new Error(data?.message || '匯款回報送出失敗')
      }

      router.push('/account/bookings?bankTransferSubmitted=1')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '匯款回報送出失敗，請稍後再試。')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <PageHero
        eyebrow="Bank Transfer"
        title="匯款回報表單"
        description="完成銀行匯款後，請回報您的匯款資料。客服人工確認款項後，才會協助開通服務或確認預約。"
      />
      <section className="bg-white py-12 md:py-16">
        <div className="section-shell grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <aside className="rounded-2xl border border-borderSoft bg-softPurple p-6 shadow-soft">
            <p className="text-sm font-semibold text-darkGold">收款資訊</p>
            <h2 className="mt-2 font-serifTC text-2xl font-semibold text-deepPurple">中華郵政｜田尾郵局</h2>
            <div className="mt-5 grid gap-2 text-sm leading-7 text-textMuted">
              <p>銀行代碼：700</p>
              <p>戶名：蔡題簇</p>
              <p>局號：0081359</p>
              <p>帳號：0146512</p>
              <p className="font-semibold text-deepPurple">轉帳帳號：00813590146512</p>
            </div>
            <p className="mt-5 rounded-xl border border-lightGold bg-white px-4 py-3 text-sm font-semibold leading-7 text-darkGold">
              郵局帳號為「局號＋帳號」，轉帳時請輸入完整 14 碼：00813590146512。
            </p>
            <p className="mt-4 text-sm font-semibold leading-7 text-deepPurple">
              請填寫「您的匯款帳號後五碼」，不是本工作室收款帳號後五碼。
            </p>
          </aside>

          <form className="grid gap-5 rounded-2xl border border-borderSoft bg-white p-6 shadow-soft md:p-8" onSubmit={submitTransfer}>
            <div>
              <p className="text-sm font-semibold text-darkGold">匯款回報</p>
              <h2 className="mt-2 font-serifTC text-2xl font-semibold text-deepPurple">填寫付款資料</h2>
            </div>

            <label className="grid gap-2">
              <span className="text-sm font-semibold text-textDark">購買項目 *</span>
              <select
                className="focus-ring rounded-lg border border-borderSoft bg-white px-4 py-3"
                onChange={(event) => setSelectedItemKey(event.target.value)}
                value={selectedItemKey}
              >
                {transferItems.map((item) => (
                  <option key={`${item.itemType}:${item.itemId}`} value={`${item.itemType}:${item.itemId}`}>
                    {item.itemName}｜{item.itemId === 'other' ? '金額自行填寫' : `NT$${item.amountTwd.toLocaleString('zh-TW')}`}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-textDark">金額 *</span>
                <input className="focus-ring rounded-lg border border-borderSoft px-4 py-3" min={1} onChange={(event) => setAmountTwd(Number(event.target.value))} type="number" value={amountTwd} />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-textDark">匯款帳號後五碼 *</span>
                <input
                  className="focus-ring rounded-lg border border-borderSoft px-4 py-3"
                  inputMode="numeric"
                  maxLength={5}
                  onChange={(event) => setBankAccountLast5(event.target.value.replace(/\D/g, '').slice(0, 5))}
                  placeholder="12345"
                  value={bankAccountLast5}
                />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-textDark">姓名 *</span>
                <input className="focus-ring rounded-lg border border-borderSoft px-4 py-3" onChange={(event) => setPayerName(event.target.value)} value={payerName} />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-textDark">電話 *</span>
                <input className="focus-ring rounded-lg border border-borderSoft px-4 py-3" onChange={(event) => setPayerPhone(event.target.value)} value={payerPhone} />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-textDark">Email</span>
                <input className="focus-ring rounded-lg border border-borderSoft px-4 py-3" onChange={(event) => setPayerEmail(event.target.value)} type="email" value={payerEmail} />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-textDark">LINE 顯示名稱</span>
                <input className="focus-ring rounded-lg border border-borderSoft px-4 py-3" onChange={(event) => setLineDisplayName(event.target.value)} value={lineDisplayName} />
              </label>
            </div>

            <label className="grid gap-2">
              <span className="text-sm font-semibold text-textDark">匯款時間</span>
              <input className="focus-ring rounded-lg border border-borderSoft px-4 py-3" onChange={(event) => setTransferTime(event.target.value)} type="datetime-local" value={transferTime} />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-semibold text-textDark">備註</span>
              <textarea className="focus-ring min-h-28 rounded-lg border border-borderSoft px-4 py-3" onChange={(event) => setNote(event.target.value)} placeholder="若選擇其他項目，請在此說明購買內容。" value={note} />
            </label>

            <div className="rounded-2xl border border-[#bfe8cb] bg-[#f1fff5] p-5 text-sm leading-7 text-textMuted">
              <p>
                送出後請加入水瓶先生官方 LINE，並回覆「已匯款＋姓名＋購買項目」。
              </p>
              <a className="focus-ring mt-3 inline-flex rounded-lg bg-[#06c755] px-5 py-3 font-semibold text-white" href={lineSupportUrl} rel="noopener noreferrer" target="_blank">
                加入官方 LINE
              </a>
            </div>

            {errorMessage ? <p className="rounded-lg bg-softPurple px-4 py-3 text-sm font-semibold text-deepPurple">{errorMessage}</p> : null}
            {statusMessage ? (
              <div className="rounded-lg border border-[#bfe8cb] bg-[#f1fff5] px-4 py-3 text-sm font-semibold leading-7 text-[#078c3f]">
                <p>{statusMessage}</p>
                <a className="mt-3 inline-flex rounded-lg bg-[#06c755] px-4 py-2 text-white" href={lineSupportUrl} rel="noopener noreferrer" target="_blank">
                  加入官方 LINE
                </a>
              </div>
            ) : null}

            <button className="focus-ring rounded-lg bg-deepPurple px-4 py-3 font-semibold text-white disabled:opacity-70" disabled={isSubmitting} type="submit">
              {isSubmitting ? '送出中...' : '送出匯款回報'}
            </button>
          </form>
        </div>
      </section>
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} onSuccess={() => {
        setLoginOpen(false)
        setUser(getMockUser())
      }} />
    </>
  )
}

export default function BankTransferSubmitPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-white py-12 md:py-16">
          <div className="section-shell">
            <p className="text-sm text-textMuted">載入匯款回報頁面中...</p>
          </div>
        </div>
      }
    >
      <BankTransferSubmitContent />
    </Suspense>
  )
}
