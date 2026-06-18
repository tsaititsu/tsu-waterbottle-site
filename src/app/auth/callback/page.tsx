'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
        const { error } = await supabase.auth.exchangeCodeForSession(window.location.href)
        if (error) throw error

        if (!cancelled) {
          const next = searchParams.get('next') || '/account'
          router.replace(next.startsWith('/') ? next : '/account')
          router.refresh()
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(error instanceof Error ? `登入失敗：${error.message}` : '登入失敗，請回首頁重新登入。')
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
