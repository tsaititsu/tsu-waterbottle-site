'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  trackGoogleAnalyticsCtaClick,
  type GoogleAnalyticsCtaClickInput,
} from '@/lib/analytics/googleAnalytics'
import { getMockUser } from '@/lib/mockAuth'
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
  const destination = href ?? serviceEntryByItemType[itemType]

  const continueToService = async () => {
    setStarting(true)
    try {
      const canStart = beforeStart ? await beforeStart() : true
      if (canStart) router.push(destination)
    } finally {
      setStarting(false)
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
