'use client'

import { useEffect, useRef } from 'react'
import type { NewebPayMpgForm } from '@/lib/newebpay/types'

type NewebPayAutoSubmitFormProps = {
  form: NewebPayMpgForm
}

export function NewebPayAutoSubmitForm({ form }: NewebPayAutoSubmitFormProps) {
  const formRef = useRef<HTMLFormElement | null>(null)

  useEffect(() => {
    formRef.current?.submit()
  }, [])

  return (
    <form ref={formRef} action={form.actionUrl} method="POST" className="mt-7 grid gap-4">
      <input type="hidden" name="MerchantID" value={form.MerchantID} />
      <input type="hidden" name="TradeInfo" value={form.TradeInfo} />
      <input type="hidden" name="TradeSha" value={form.TradeSha} />
      <input type="hidden" name="Version" value={form.Version} />
      <button type="submit" className="focus-ring rounded-lg bg-deepPurple px-6 py-3 font-semibold text-white">
        前往藍新付款頁
      </button>
    </form>
  )
}
