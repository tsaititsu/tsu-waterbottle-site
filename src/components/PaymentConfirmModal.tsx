'use client'

import { X } from 'lucide-react'

type PaymentConfirmModalProps = {
  open: boolean
  title: string
  amount: number
  onClose: () => void
  onConfirm: () => void
}

export function PaymentConfirmModal({ open, title, amount, onClose, onConfirm }: PaymentConfirmModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-textDark/40 px-4 backdrop-blur-sm">
      <div className="w-full max-w-[430px] rounded-[20px] bg-white p-7 shadow-soft">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-darkGold">付款確認</p>
            <h2 className="mt-2 font-serifTC text-2xl font-semibold text-deepPurple">{title}</h2>
          </div>
          <button className="focus-ring grid h-9 w-9 place-items-center rounded-lg text-textMuted hover:bg-softPurple" aria-label="關閉付款確認" onClick={onClose} type="button">
            <X size={20} />
          </button>
        </div>
        <div className="mt-6 rounded-2xl border border-borderSoft bg-softPurple p-5">
          <p className="text-sm text-textMuted">本次 mock 付款金額</p>
          <p className="mt-2 text-3xl font-semibold text-deepPurple">NT${amount.toLocaleString()}</p>
        </div>
        <button className="focus-ring mt-6 w-full rounded-lg bg-deepPurple px-4 py-3 font-semibold text-white" onClick={onConfirm} type="button">
          確認付款
        </button>
      </div>
    </div>
  )
}
