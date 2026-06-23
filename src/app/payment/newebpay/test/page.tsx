'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LoginModal } from '@/components/LoginModal'
import { getAuthAccessToken, getMockUser } from '@/lib/mockAuth'

type TestPaymentState = {
  message: string
  isError: boolean
}

function getStartErrorMessage(status: number, fallback?: string) {
  if (status === 401) return '請先登入會員後再建立測試付款。'
  if (status >= 500) return '建立測試付款失敗，請稍後再試。'
  return fallback ?? '建立測試付款失敗，請稍後再試。'
}

export default function NewebPayTestPage() {
  const router = useRouter()
  const [loginOpen, setLoginOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [state, setState] = useState<TestPaymentState>({ message: '', isError: false })

  const startTestPayment = async () => {
    setState({ message: '', isError: false })

    if (!getMockUser()) {
      setLoginOpen(true)
      return
    }

    const accessToken = await getAuthAccessToken()
    if (!accessToken) {
      setLoginOpen(true)
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/payments/newebpay/test/start', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      })
      const data = (await response.json().catch(() => null)) as { paymentId?: string; message?: string } | null

      if (!response.ok || !data?.paymentId) {
        setState({
          message: getStartErrorMessage(response.status, data?.message),
          isError: true,
        })
        if (response.status === 401) setLoginOpen(true)
        return
      }

      router.push(`/payment/newebpay/redirect?paymentId=${encodeURIComponent(data.paymentId)}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <section className="bg-softPurple py-16 md:py-24">
        <div className="section-shell max-w-2xl rounded-[28px] border border-borderSoft bg-white p-8 shadow-soft">
          <p className="text-sm font-semibold text-darkGold">NewebPay Test</p>
          <h1 className="mt-3 font-serifTC text-3xl font-semibold text-deepPurple">藍新金流 1 元測試</h1>
          <p className="mt-4 leading-7 text-textMuted">
            這個隱藏測試商品只用來確認藍新付款、NotifyURL 與 ReturnURL 流程。付款成功只會更新 payments，不會開通課程，也不會寫入 course_purchases。
          </p>
          <div className="mt-6 rounded-xl bg-softPurple px-5 py-4">
            <p className="font-semibold text-deepPurple">測試金額：NT$1</p>
            <p className="mt-2 text-sm leading-6 text-textMuted">測試項目：藍新金流 1 元測試</p>
          </div>
          <button
            type="button"
            onClick={() => void startTestPayment()}
            disabled={loading}
            className="focus-ring mt-7 w-full rounded-lg bg-deepPurple px-6 py-3 font-semibold text-white disabled:opacity-70"
          >
            {loading ? '建立測試付款中...' : '建立 1 元測試付款'}
          </button>
          {state.message ? (
            <p className={`mt-4 rounded-lg px-4 py-3 text-sm font-semibold ${state.isError ? 'bg-[#fff0f0] text-[#9b1c1c]' : 'bg-softPurple text-deepPurple'}`}>
              {state.message}
            </p>
          ) : null}
        </div>
      </section>
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} onSuccess={() => setLoginOpen(false)} />
    </>
  )
}
