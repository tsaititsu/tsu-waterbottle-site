'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { getMockUser } from '@/lib/mockAuth'
import { createMockPayment, type PaymentRecord } from '@/lib/mockPayment'
import { LoginModal } from './LoginModal'
import { PaymentConfirmModal } from './PaymentConfirmModal'

type ActionButtonProps = {
  children: React.ReactNode
  itemType: PaymentRecord['itemType']
  itemName: string
  amount: number
  className?: string
  beforeStart?: () => boolean | Promise<boolean>
}

export function ActionButton({ children, itemType, itemName, amount, className = '', beforeStart }: ActionButtonProps) {
  const router = useRouter()
  const [loginOpen, setLoginOpen] = useState(false)
  const [paymentOpen, setPaymentOpen] = useState(false)

  const [starting, setStarting] = useState(false)

  const start = async () => {
    if (!getMockUser()) {
      setLoginOpen(true)
      return
    }
    setStarting(true)
    const canStart = beforeStart ? await beforeStart() : true
    setStarting(false)
    if (!canStart) return
    setPaymentOpen(true)
  }

  const confirm = () => {
    const payment = createMockPayment({ itemType, itemName, amount })
    setPaymentOpen(false)
    if (payment?.itemType === 'ai-chart' && payment.resultId) {
      router.push(`/ai-chart/result/${payment.resultId}`)
      return
    }
    if (payment?.itemType === 'booking' && payment.bookingId) {
      router.push(`/booking/success?bookingId=${payment.bookingId}`)
      return
    }
    router.push('/payment/success')
  }

  const continueAfterLogin = async () => {
    setLoginOpen(false)
    setStarting(true)
    const canStart = beforeStart ? await beforeStart() : true
    setStarting(false)
    if (!canStart) return
    setPaymentOpen(true)
  }

  return (
    <>
      <button type="button" className={className} disabled={starting} onClick={() => void start()}>
        {starting ? '準備中...' : children}
      </button>
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} onSuccess={continueAfterLogin} />
      <PaymentConfirmModal open={paymentOpen} title={itemName} amount={amount} onClose={() => setPaymentOpen(false)} onConfirm={confirm} />
    </>
  )
}
