'use client'

import { X } from 'lucide-react'
import { loginWithProvider } from '@/lib/mockAuth'
import { LogoMark } from './LogoMark'

type LoginModalProps = {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function LoginModal({ open, onClose, onSuccess }: LoginModalProps) {
  if (!open) return null

  const handleLogin = (provider: 'line' | 'google') => {
    loginWithProvider(provider)
    onSuccess?.()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-textDark/40 px-4 backdrop-blur-sm">
      <div className="w-full max-w-[440px] rounded-[20px] bg-white p-7 shadow-soft">
        <div className="mb-6 flex items-start justify-between gap-4">
          <LogoMark compact />
          <button
            className="focus-ring grid h-9 w-9 place-items-center rounded-lg text-textMuted hover:bg-softPurple"
            aria-label="關閉登入彈窗"
            onClick={onClose}
            type="button"
          >
            <X size={20} />
          </button>
        </div>
        <h2 className="font-serifTC text-2xl font-semibold text-deepPurple">請先登入會員</h2>
        <p className="mt-3 leading-7 text-textMuted">
          登入後可以保存你的命盤、報告、占卜紀錄與預約資料。
        </p>
        <div className="mt-7 space-y-3">
          <button
            className="focus-ring w-full rounded-lg bg-lineGreen px-4 py-3 font-semibold text-white"
            onClick={() => handleLogin('line')}
            type="button"
          >
            使用 LINE 登入
          </button>
          <button
            className="focus-ring w-full rounded-lg border border-[#D9D9E3] bg-white px-4 py-3 font-semibold text-textDark"
            onClick={() => handleLogin('google')}
            type="button"
          >
            使用 Google Email 登入
          </button>
        </div>
      </div>
    </div>
  )
}
