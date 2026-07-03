'use client'

import { useRef, useState } from 'react'

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

type RequestState = {
  loading: boolean
  error: string
  paymentData: Extract<NewebPayCreateResponse, { ok: true }> | null
}

type TestItemKey = 'newebpay_live_smoke_test_1' | 'booking_consultation_60'
type PaymentMode = 'credit' | 'merchant_default'

const testItems: Array<{
  itemKey: TestItemKey
  label: string
  description: string
  amount: number
}> = [
  {
    itemKey: 'newebpay_live_smoke_test_1',
    label: '藍新正式環境 1 元測試付款',
    description: '只測正式藍新付款串接，不建立預約、不開通 AI 服務、不更新付款狀態。',
    amount: 1,
  },
  {
    itemKey: 'booking_consultation_60',
    label: '水瓶先生論命 3600 元',
    description: '用來確認正式論命付款表單資料，請避免在 smoke test 誤刷。',
    amount: 3600,
  },
]

const paymentModes: Array<{
  mode: PaymentMode
  label: string
  description: string
}> = [
  {
    mode: 'credit',
    label: '信用卡一次付清',
    description: 'TradeInfo 只指定 CREDIT=1，用來測最單純的正式藍新付款流程。',
  },
  {
    mode: 'merchant_default',
    label: '商店預設付款方式',
    description: '不指定付款工具，交由藍新商店後台已啟用的付款方式顯示。',
  },
]

const isEnabled = process.env.NEXT_PUBLIC_ENABLE_NEWEBPAY === 'true'

function formatTwd(amount: number) {
  return `NT$${amount.toLocaleString('zh-TW')}`
}

export function NewebPayTestClient() {
  const formRef = useRef<HTMLFormElement | null>(null)
  const [selectedItemKey, setSelectedItemKey] = useState<TestItemKey>('newebpay_live_smoke_test_1')
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('credit')
  const [state, setState] = useState<RequestState>({
    loading: false,
    error: '',
    paymentData: null,
  })

  async function createPayment() {
    setState({ loading: true, error: '', paymentData: null })

    try {
      const response = await fetch('/api/payments/newebpay/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          itemKey: selectedItemKey,
          source: 'manual_test',
          paymentMode,
        }),
      })
      const data = (await response.json().catch(() => null)) as NewebPayCreateResponse | null

      if (!response.ok || !data?.ok) {
        const errorMessage = data && !data.ok ? data.error : undefined
        setState({
          loading: false,
          error: errorMessage ?? '建立藍新測試付款失敗，請確認環境變數設定。',
          paymentData: null,
        })
        return
      }

      setState({ loading: false, error: '', paymentData: data })
    } catch {
      setState({
        loading: false,
        error: '建立藍新測試付款失敗，請稍後再試。',
        paymentData: null,
      })
    }
  }

  function submitToNewebPay() {
    formRef.current?.submit()
  }

  return (
    <section className="bg-softPurple py-16 md:py-24">
      <div className="section-shell max-w-3xl">
        <div className="rounded-[28px] border border-borderSoft bg-white p-6 shadow-soft md:p-8">
          <p className="text-sm font-semibold text-darkGold">NewebPay Local Test</p>
          <h1 className="mt-3 font-serifTC text-3xl font-semibold text-deepPurple">藍新金流本機測試頁</h1>
          <p className="mt-4 leading-7 text-textMuted">
            此頁只用來測試 MPG Form Post，不是正式付款入口。
          </p>

          {!isEnabled ? (
            <div className="mt-7 rounded-2xl border border-borderSoft bg-softPurple px-5 py-4 text-sm font-semibold leading-6 text-deepPurple">
              藍新測試功能尚未啟用，請在 .env.local 設定 NEXT_PUBLIC_ENABLE_NEWEBPAY=true
            </div>
          ) : (
            <div className="mt-7 grid gap-5">
              <div className="rounded-2xl border border-[#f0c36d] bg-[#fff8e6] px-5 py-4 text-sm font-semibold leading-6 text-[#7a4d00]">
                目前 LINE Pay 尚未啟用，本測試預設使用信用卡一次付清 1 元付款。
                請勿使用 3600 元品項測試付款。
              </div>

              <fieldset className="grid gap-3">
                <legend className="text-sm font-semibold text-deepPurple">選擇測試品項</legend>
                {testItems.map((item) => (
                  <label
                    key={item.itemKey}
                    className="grid cursor-pointer gap-2 rounded-2xl border border-borderSoft bg-softPurple px-5 py-4 text-sm leading-6 text-textMuted transition hover:border-deepPurple/40"
                  >
                    <span className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="newebpay-test-item"
                        value={item.itemKey}
                        checked={selectedItemKey === item.itemKey}
                        onChange={() => {
                          setSelectedItemKey(item.itemKey)
                          setState({ loading: false, error: '', paymentData: null })
                        }}
                        className="mt-1"
                      />
                      <span>
                        <span className="block font-semibold text-textDark">{item.label}</span>
                        <span className="mt-1 block">{item.description}</span>
                        <span className="mt-1 block font-semibold text-deepPurple">{formatTwd(item.amount)}</span>
                      </span>
                    </span>
                  </label>
                ))}
              </fieldset>

              <fieldset className="grid gap-3">
                <legend className="text-sm font-semibold text-deepPurple">選擇付款模式</legend>
                {paymentModes.map((item) => (
                  <label
                    key={item.mode}
                    className="grid cursor-pointer gap-2 rounded-2xl border border-borderSoft bg-softPurple px-5 py-4 text-sm leading-6 text-textMuted transition hover:border-deepPurple/40"
                  >
                    <span className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="newebpay-payment-mode"
                        value={item.mode}
                        checked={paymentMode === item.mode}
                        onChange={() => {
                          setPaymentMode(item.mode)
                          setState({ loading: false, error: '', paymentData: null })
                        }}
                        className="mt-1"
                      />
                      <span>
                        <span className="block font-semibold text-textDark">{item.label}</span>
                        <span className="mt-1 block">{item.description}</span>
                      </span>
                    </span>
                  </label>
                ))}
              </fieldset>

              <button
                type="button"
                onClick={() => void createPayment()}
                disabled={state.loading}
                className="focus-ring rounded-lg bg-deepPurple px-6 py-3 font-semibold text-white disabled:opacity-70"
              >
                {state.loading ? '建立藍新測試付款中...' : '建立藍新測試付款'}
              </button>

              {state.error ? (
                <p className="rounded-xl bg-[#fff0f0] px-4 py-3 text-sm font-semibold text-[#9b1c1c]">
                  {state.error}
                </p>
              ) : null}

              {state.paymentData ? (
                <div className="grid gap-5 rounded-2xl border border-borderSoft bg-softPurple p-5">
                  <div className="grid gap-3 text-sm leading-6 text-textMuted">
                    <p>
                      <span className="font-semibold text-textDark">merchantOrderNo：</span>
                      {state.paymentData.merchantOrderNo}
                    </p>
                    <p>
                      <span className="font-semibold text-textDark">amount：</span>
                      {formatTwd(state.paymentData.amount)}
                    </p>
                    <p>
                      <span className="font-semibold text-textDark">itemKey：</span>
                      {state.paymentData.itemKey}
                    </p>
                    <p className="break-words">
                      <span className="font-semibold text-textDark">action：</span>
                      {state.paymentData.action}
                    </p>
                  </div>

                  <form ref={formRef} action={state.paymentData.action} method="POST">
                    <input type="hidden" name="MerchantID" value={state.paymentData.fields.MerchantID} />
                    <input type="hidden" name="TradeInfo" value={state.paymentData.fields.TradeInfo} />
                    <input type="hidden" name="TradeSha" value={state.paymentData.fields.TradeSha} />
                    <input type="hidden" name="Version" value={state.paymentData.fields.Version} />
                    <button
                      type="button"
                      onClick={submitToNewebPay}
                      className="focus-ring w-full rounded-lg bg-deepPurple px-6 py-3 font-semibold text-white"
                    >
                      送出到藍新付款頁
                    </button>
                  </form>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
