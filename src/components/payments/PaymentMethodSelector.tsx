'use client'

import { useId } from 'react'
import {
  isCheckoutPaymentMethod,
  type CheckoutPaymentMethod,
  type CheckoutPaymentMethodOption,
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
  const selectId = `payment-method-${groupId}`
  const descriptionId = `${selectId}-description`
  const selectedOption = options.find((option) => option.value === value) ?? null

  return (
    <div className={`grid gap-3 ${disabled ? 'opacity-65' : ''}`}>
      <label className="text-sm font-semibold text-deepPurple" htmlFor={selectId}>
        {legend}
      </label>
      <select
        aria-describedby={descriptionId}
        className="focus-ring min-h-12 w-full rounded-xl border border-borderSoft bg-white px-4 py-3 font-semibold text-deepPurple shadow-sm disabled:cursor-not-allowed"
        disabled={disabled}
        id={selectId}
        name={`payment-method-${groupId}`}
        onChange={(event) => {
          const method = event.target.value
          if (
            isCheckoutPaymentMethod(method)
            && options.some((option) => option.value === method)
          ) {
            onChange(method)
          }
        }}
        value={selectedOption?.value ?? ''}
      >
        {selectedOption ? null : (
          <option disabled value="">
            請選擇付款方式
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <p className="text-sm leading-6 text-textMuted" id={descriptionId}>
        {selectedOption?.description ?? '目前沒有可用的付款方式。'}
      </p>
    </div>
  )
}
