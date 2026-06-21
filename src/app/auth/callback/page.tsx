'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { refreshAuthUser } from '@/lib/mockAuth'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'

function AuthCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [message, setMessage] = useState('正在完成登入...')

  useEffect(() => {
    let cancelled = false

    async function finishLogin() {
      try {
        const supabase = getSupabaseBrowserClient()
        const oauthError = searchParams.get('error_description') || searchParams.get('error')
        const code = searchParams.get('code')

        if (oauthError) {
          throw new Error(oauthError)
        }

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) throw error
        } else {
          const { data } = await supabase.auth.getSession()
          if (!data.session) {
            throw new Error('登入連結已失效，請回首頁重新登入。')
          }
        }

        const { data: sessionData } = await supabase.auth.getSession()
        const accessToken = sessionData.session?.access_token

        if (accessToken) {
          try {
            await fetch('/api/auth/sync-profile', {
              method: 'POST',
              headers: {
                authorization: `Bearer ${accessToken}`
              }
            })
          } catch (syncError) {
            console.warn('Profile sync failed', syncError)
          }
        }

        await refreshAuthUser()

        if (!cancelled) {
          const next = searchParams.get('next') || '/account'
          router.replace(next.startsWith('/') ? next : '/account')
          router.refresh()
        }
      } catch (error) {
        if (!cancelled) {
          const errorMessage = error instanceof Error ? error.message : ''
          const friendlyMessage =
            errorMessage.includes('code verifier') || errorMessage.includes('auth code')
              ? '登入狀態已過期，請回首頁重新按一次登入。'
              : errorMessage
                ? `登入失敗：${errorMessage}`
                : '登入失敗，請回首頁重新登入。'

          setMessage(friendlyMessage)
        }
      }
    }

    void finishLogin()
    return () => {
      cancelled = true
    }
  }, [router, searchParams])

  return <p className="font-serifTC text-2xl font-semibold text-deepPurple">{message}</p>
}

export default function AuthCallbackPage() {
  return (
    <main className="grid min-h-[60vh] place-items-center bg-white px-5 py-16">
      <div className="rounded-2xl border border-borderSoft bg-softPurple p-8 text-center shadow-soft">
        <Suspense fallback={<p className="font-serifTC text-2xl font-semibold text-deepPurple">正在完成登入...</p>}>
          <AuthCallbackContent />
        </Suspense>
      </div>
    </main>
  )
}
