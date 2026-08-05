'use client'

import { useRef, useState } from 'react'
import { getAuthAccessToken } from '@/lib/mockAuth'
import {
  startNewebPayAdminOneDollarTest,
  type NewebPayAdminOneDollarTestChannel,
  type NewebPayAdminOneDollarTestClientResult,
} from '@/lib/newebpay/adminOneDollarTestClient'

const CONFIRMATION_ID = 'newebpay-admin-one-dollar-confirmation'

const channelOptions: ReadonlyArray<{
  channel: NewebPayAdminOneDollarTestChannel
  label: string
  description: string
}> = [
  {
    channel: 'credit',
    label: '信用卡一次付清 NT$1',
    description: '藍新付款頁只啟用信用卡一次付清。',
  },
  {
    channel: 'apple_pay',
    label: 'Apple Pay NT$1',
    description: '請使用支援 Apple Pay 的 Apple 裝置與 Safari 驗收。',
  },
  {
    channel: 'atm',
    label: 'ATM 虛擬帳號 NT$1',
    description: '藍新會建立本次專用虛擬帳號，完成轉帳後再驗證通知。',
  },
]

function getErrorMessage(result: Extract<NewebPayAdminOneDollarTestClientResult, { ok: false }>) {
  if (result.error === 'admin_session_unavailable') {
    return '管理員登入 Session 無法使用，尚未建立測試付款。請重新登入後再試。'
  }
  if (result.error === 'payment_response_invalid') {
    return '測試付款回應未通過安全驗證，已停止導向。'
  }
  return '建立測試付款失敗，尚未前往藍新付款頁。'
}

export default function NewebPayOneDollarTestPanel() {
  const [confirmed, setConfirmed] = useState(false)
  const [activeChannel, setActiveChannel] = useState<NewebPayAdminOneDollarTestChannel | null>(null)
  const [message, setMessage] = useState('尚未啟動測試。')
  const lockedRef = useRef(false)

  async function startTest(channel: NewebPayAdminOneDollarTestChannel) {
    if (!confirmed || lockedRef.current) return

    lockedRef.current = true
    setActiveChannel(channel)
    setMessage('正在建立一筆 NT$1 測試付款，請勿重複操作。')

    const result = await startNewebPayAdminOneDollarTest(channel, {
      getAccessToken: getAuthAccessToken,
      fetchStart: (input, init) => fetch(input, { ...init, cache: 'no-store' }),
      navigate: (url) => window.location.assign(url),
    })

    if (!result.ok) {
      lockedRef.current = false
      setActiveChannel(null)
      setMessage(getErrorMessage(result))
    }
  }

  const locked = activeChannel !== null

  return (
    <section
      aria-labelledby="newebpay-one-dollar-test-title"
      className="rounded-2xl border border-[#d9b85f] bg-[#fffaf0] p-5 shadow-soft md:p-6"
      data-newebpay-one-dollar-test-panel
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold tracking-[0.14em] text-[#7d5a00]">正式站管理員限定</p>
          <h2
            className="mt-2 font-serifTC text-2xl font-semibold text-deepPurple"
            id="newebpay-one-dollar-test-title"
          >
            藍新金流管理員 NT$1 測試
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-textMuted">
            每次只建立一筆測試付款；測試紀錄不會開通課程、不會交付服務，也不會出貨。
            按下通道按鈕後才會前往藍新付款頁。
          </p>
        </div>
        <span className="rounded-full border border-[#d9b85f] bg-white px-3 py-1 text-xs font-semibold text-[#7d5a00]">
          Production · 真實交易
        </span>
      </div>

      <label
        className="mt-5 flex items-start gap-3 rounded-xl border border-[#ead9a6] bg-white p-4 text-sm leading-6 text-textDark"
        htmlFor={CONFIRMATION_ID}
      >
        <input
          checked={confirmed}
          className="mt-1 size-4 accent-[#7d5a00]"
          disabled={locked}
          id={CONFIRMATION_ID}
          onChange={(event) => setConfirmed(event.target.checked)}
          type="checkbox"
        />
        <span>我確認所選通道會建立一筆正式 NT$1 測試交易，並由我本人完成付款操作。</span>
      </label>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {channelOptions.map((option) => (
          <button
            className="focus-ring rounded-xl border border-[#d9b85f] bg-white p-4 text-left disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!confirmed || locked}
            key={option.channel}
            onClick={() => void startTest(option.channel)}
            type="button"
          >
            <span className="block font-semibold text-deepPurple">
              {activeChannel === option.channel ? '正在建立測試付款...' : option.label}
            </span>
            <span className="mt-2 block text-sm leading-6 text-textMuted">{option.description}</span>
          </button>
        ))}
      </div>

      <p aria-live="polite" className="mt-4 text-sm leading-6 text-textMuted" role="status">
        {message}
      </p>
    </section>
  )
}
