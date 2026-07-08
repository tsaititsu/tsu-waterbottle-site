'use client'

import { useRef, useState } from 'react'
import {
  APPLE_PAY_TEST_BUTTON_LABEL,
  APPLE_PAY_TEST_LOADING_LABEL,
  APPLE_PAY_TEST_PAGE_TITLE,
  getApplePayTestCheckoutErrorMessage,
  startApplePayTestCheckout,
  type ApplePayTestFormInput,
  type ApplePayTestPaymentRequestBody,
} from './applePayTestCheckout'

type ApplePayTestState = {
  loading: boolean
  error: string
}

async function createApplePayTestPayment(body: ApplePayTestPaymentRequestBody) {
  const response = await fetch('/api/payments/newebpay/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  return response.json().catch(() => ({ ok: false, error: 'apple_pay_test_create_failed' }))
}

export function ApplePayTestClient() {
  const formContainerRef = useRef<HTMLDivElement | null>(null)
  const [state, setState] = useState<ApplePayTestState>({
    loading: false,
    error: '',
  })

  async function submitNewebPayForm(input: ApplePayTestFormInput) {
    const form = document.createElement('form')
    form.method = input.method
    form.action = input.action

    for (const field of input.fields) {
      const element = document.createElement('input')
      element.type = 'hidden'
      element.name = field.name
      element.value = field.value
      form.appendChild(element)
    }

    formContainerRef.current?.replaceChildren(form)
    form.submit()
  }

  async function startCheckout() {
    setState({ loading: true, error: '' })

    const result = await startApplePayTestCheckout({
      createPayment: createApplePayTestPayment,
      submitForm: submitNewebPayForm,
    })

    if (!result.ok) {
      setState({
        loading: false,
        error: getApplePayTestCheckoutErrorMessage(result.error),
      })
      return
    }

    setState({ loading: true, error: '' })
  }

  return (
    <section className="bg-softPurple py-16 md:py-24">
      <div className="section-shell max-w-2xl">
        <div className="rounded-[28px] border border-borderSoft bg-white p-6 shadow-soft md:p-8">
          <p className="text-sm font-semibold text-darkGold">NewebPay Internal Test</p>
          <h1 className="mt-3 font-serifTC text-3xl font-semibold text-deepPurple">{APPLE_PAY_TEST_PAGE_TITLE}</h1>
          <div className="mt-5 grid gap-4 rounded-2xl border border-[#f0c36d] bg-[#fff8e6] px-5 py-4 text-sm leading-6 text-[#7a4d00]">
            <p className="font-semibold">這是內部測試，不是正式商品。</p>
            <p>測試金額：NT$1</p>
            <p>支付方式：Apple Pay</p>
          </div>

          <button
            type="button"
            onClick={() => void startCheckout()}
            disabled={state.loading}
            className="focus-ring mt-7 w-full rounded-lg bg-deepPurple px-6 py-3 font-semibold text-white disabled:opacity-70"
          >
            {state.loading ? APPLE_PAY_TEST_LOADING_LABEL : APPLE_PAY_TEST_BUTTON_LABEL}
          </button>

          {state.error ? (
            <p className="mt-4 rounded-lg bg-[#fff0f0] px-4 py-3 text-sm font-semibold text-[#9b1c1c]">
              {state.error}
            </p>
          ) : null}
          <div ref={formContainerRef} aria-hidden="true" className="hidden" />
        </div>
      </div>
    </section>
  )
}
