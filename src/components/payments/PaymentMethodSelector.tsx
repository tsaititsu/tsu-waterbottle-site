'use client'

import { useId } from 'react'
import type {
  CheckoutPaymentMethod,
  CheckoutPaymentMethodOption,
} from '@/lib/payments/paymentMethods'

export function PaymentMethodSelector({
  disabled = false,
  legend = '付款方式',
  onChange,
  options,
  value,
}: {
  disabled?: boolean
  legend?: string
  onChange: (method: CheckoutPaymentMethod) => void
  options: readonly CheckoutPaymentMethodOption[]
  value: CheckoutPaymentMethod
}) {
  const groupId = useId().replace(/:/g, '')

  return (
    <fieldset className="grid gap-3" disabled={disabled}>
      <legend className="text-sm font-semibold text-deepPurple">{legend}</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {options.map((option) => {
          const checked = option.value === value
          const inputId = `payment-method-${groupId}-${option.value}`

          return (
            <label
              className={`focus-within:ring-2 focus-within:ring-deepPurple/35 grid cursor-pointer gap-2 rounded-xl border p-4 transition disabled:cursor-not-allowed ${
                checked
                  ? 'border-deepPurple bg-softPurple shadow-sm'
                  : 'border-borderSoft bg-white hover:border-deepPurple/45'
              } ${disabled ? 'cursor-not-allowed opacity-65' : ''}`}
              htmlFor={inputId}
              key={option.value}
            >
              <span className="flex items-start gap-3">
                <input
                  checked={checked}
                  className="mt-1 size-4 shrink-0 accent-deepPurple"
                  id={inputId}
                  name={`payment-method-${groupId}`}
                  onChange={() => onChange(option.value)}
                  type="radio"
                  value={option.value}
                />
                <span className="font-semibold text-deepPurple">{option.label}</span>
              </span>
              <span className="pl-7 text-sm leading-6 text-textMuted">
                {option.description}
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
