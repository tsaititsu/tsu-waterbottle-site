'use client'

import { X } from 'lucide-react'
import { loginWithProvider } from '@/lib/mockAuth'
import { LogoMark } from './LogoMark'
import { useState } from 'react'

export type LoginModalMode = 'member' | 'admin'
type LoginProvider = 'line' | 'google'

const MEMBER_LOGIN_PROVIDERS = ['line', 'google'] as const
const ADMIN_LOGIN_PROVIDERS = ['google'] as const

export function getLoginModalProviders(mode: LoginModalMode): readonly LoginProvider[] {
  return mode === 'admin' ? ADMIN_LOGIN_PROVIDERS : MEMBER_LOGIN_PROVIDERS
}

type LoginModalProps = {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
  returnTo?: string
  mode?: LoginModalMode
}

export function LoginModal({ open, onClose, onSuccess, returnTo, mode = 'member' }: LoginModalProps) {
  const [error, setError] = useState('')
  const [loadingProvider, setLoadingProvider] = useState<LoginProvider | ''>('')

  if (!open) return null

  const providers = getLoginModalProviders(mode)
  const isAdminMode = mode === 'admin'

  const handleLogin = async (provider: LoginProvider) => {
    setError('')
    setLoadingProvider(provider)
    try {
      await loginWithProvider(provider, returnTo)
      onSuccess?.()
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : '登入失敗，請稍後再試。')
      setLoadingProvider('')
    }
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
        <h2 className="font-serifTC text-2xl font-semibold text-deepPurple">
          {isAdminMode ? '請登入管理員帳號' : '請先登入會員'}
        </h2>
        <p className="mt-3 leading-7 text-textMuted">
          {isAdminMode
            ? '請使用已加入管理員白名單的 Google 帳號登入。'
            : '登入後可以保存你的命盤、報告、占卜紀錄與預約資料。'}
        </p>
        <div className="mt-7 space-y-3">
          {providers.map((provider) => {
            const isLine = provider === 'line'
            const label = isLine
              ? '使用 LINE 登入'
              : isAdminMode
                ? '使用 Google 管理員帳號登入'
                : '使用 Google 帳號登入'

            return (
              <button
                key={provider}
                className={
                  isLine
                    ? 'focus-ring w-full rounded-lg bg-lineGreen px-4 py-3 font-semibold text-white'
                    : 'focus-ring w-full rounded-lg border border-[#D9D9E3] bg-white px-4 py-3 font-semibold text-textDark'
                }
                onClick={() => handleLogin(provider)}
                disabled={Boolean(loadingProvider)}
                type="button"
              >
                {loadingProvider === provider ? `前往 ${isLine ? 'LINE' : 'Google'}...` : label}
              </button>
            )
          })}
        </div>
        {error && <p className="mt-4 rounded-lg bg-softPurple px-4 py-3 text-sm font-semibold text-deepPurple">{error}</p>}
      </div>
    </div>
  )
}
