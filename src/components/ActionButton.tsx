'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import {
  trackGoogleAnalyticsCtaClick,
  type GoogleAnalyticsCtaClickInput,
} from '@/lib/analytics/googleAnalytics'
import { createAsyncIdentityGuard } from '@/lib/auth/asyncIdentityGuard'
import { getMockUser, subscribeAuthChange } from '@/lib/mockAuth'
import { LoginModal } from './LoginModal'

type ActionItemType = 'ai-chart' | 'ai-divination' | 'booking' | 'course'

const serviceEntryByItemType: Record<ActionItemType, string> = {
  'ai-chart': '/ai-chart',
  'ai-divination': '/ai-divination',
  booking: '/booking',
  course: '/courses',
}

type ActionButtonProps = {
  children: React.ReactNode
  itemType: ActionItemType
  itemName?: string
  amount?: number
  href?: string
  className?: string
  beforeStart?: () => boolean | Promise<boolean>
  loadingText?: string
  analytics?: GoogleAnalyticsCtaClickInput
}

export function ActionButton({
  children,
  itemType,
  href,
  className = '',
  beforeStart,
  loadingText = '準備中...',
  analytics,
}: ActionButtonProps) {
  const router = useRouter()
  const [loginOpen, setLoginOpen] = useState(false)
  const [starting, setStarting] = useState(false)
  const startingRef = useRef(false)
  const destination = href ?? serviceEntryByItemType[itemType]
  const destinationRef = useRef(destination)
  const [identityGuard] = useState(() => createAsyncIdentityGuard())

  useEffect(() => {
    if (destinationRef.current !== destination) {
      destinationRef.current = destination
      identityGuard.invalidate()
      startingRef.current = false
      setStarting(false)
    }
  }, [destination, identityGuard])

  useEffect(() => {
    const unsubscribeAuth = subscribeAuthChange(() => {
      identityGuard.invalidate()
      startingRef.current = false
      setStarting(false)
    })
    return () => {
      unsubscribeAuth()
      identityGuard.invalidate()
      startingRef.current = false
    }
  }, [identityGuard])

  const continueToService = async () => {
    if (startingRef.current) return
    startingRef.current = true
    const currentIdentity = () => ({
      resourceKey: destinationRef.current,
      subjectId: getMockUser()?.id ?? null,
    })
    const requestToken = identityGuard.begin(currentIdentity())
    if (!requestToken) {
      startingRef.current = false
      setLoginOpen(true)
      return
    }
    setStarting(true)
    try {
      const canStart = beforeStart ? await beforeStart() : true
      if (canStart && identityGuard.isCurrent(requestToken, currentIdentity())) {
        router.push(destination)
      }
    } finally {
      if (identityGuard.isCurrent(requestToken, currentIdentity())) {
        startingRef.current = false
        setStarting(false)
      }
    }
  }

  const start = async () => {
    if (analytics) {
      trackGoogleAnalyticsCtaClick(
        window,
        window.location.hostname,
        window.location.pathname,
        analytics,
      )
    }

    if (!getMockUser()) {
      setLoginOpen(true)
      return
    }
    await continueToService()
  }

  const continueAfterLogin = async () => {
    setLoginOpen(false)
    await continueToService()
  }

  return (
    <>
      <button type="button" className={className} disabled={starting} onClick={() => void start()}>
        {starting ? loadingText : children}
      </button>
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} onSuccess={continueAfterLogin} />
    </>
  )
}
