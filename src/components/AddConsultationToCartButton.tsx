'use client'

import { useState } from 'react'
import { ShoppingCart } from 'lucide-react'
import { useCart } from '@/components/CartContext'

export function AddConsultationToCartButton() {
  const { addItem } = useCart()
  const [message, setMessage] = useState('')

  return (
    <div className="mt-8 rounded-2xl border border-borderSoft bg-softPurple p-5">
      <p className="text-sm font-semibold text-deepPurple">論命預約付款前</p>
      <p className="mt-1 text-textMuted">若先預覽購物流程，可先將論命服務加入購物車。</p>
      <button
        type="button"
        className="focus-ring mt-3 inline-flex items-center gap-2 rounded-lg bg-deepPurple px-4 py-2 font-semibold text-white"
        onClick={() => {
          addItem({
            id: 'booking_consultation_60',
            type: 'consultation',
            itemName: '水瓶先生論命',
            amount: 3600,
            quantity: 1
          })
          setMessage('已加入購物車')
        }}
      >
        <ShoppingCart size={18} />
        加入購物車
      </button>
      {message ? <p className="mt-2 text-sm font-semibold text-deepPurple">{message}</p> : null}
    </div>
  )
}
