'use client'

import Script from 'next/script'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import {
  createGoogleAnalyticsPageViewPayload,
  GA_MEASUREMENT_ID,
  isGoogleAnalyticsProductionHost,
  sanitizeGoogleAnalyticsPath,
  shouldTrackGoogleAnalyticsPath,
} from '@/lib/analytics/googleAnalytics'

type GoogleAnalyticsPageViewPayload = ReturnType<typeof createGoogleAnalyticsPageViewPayload>

type GoogleAnalyticsCommand =
  | ['js', Date]
  | ['config', string, { send_page_view: false }]
  | ['event', 'page_view', GoogleAnalyticsPageViewPayload]

type GoogleAnalyticsFunction = (...command: GoogleAnalyticsCommand) => void

declare global {
  interface Window {
    dataLayer?: GoogleAnalyticsCommand[]
    gtag?: GoogleAnalyticsFunction
    waterbottleGoogleAnalyticsInitialized?: boolean
  }
}

function initializeGoogleAnalytics() {
  if (window.waterbottleGoogleAnalyticsInitialized) return

  window.dataLayer = window.dataLayer || []
  const gtag: GoogleAnalyticsFunction = (...command) => {
    window.dataLayer?.push(command)
  }
  window.gtag = window.gtag || gtag

  window.gtag('js', new Date())
  window.gtag('config', GA_MEASUREMENT_ID, {
    send_page_view: false,
  })
  window.waterbottleGoogleAnalyticsInitialized = true
}

export function GoogleAnalytics() {
  const pathname = usePathname()
  const [isProductionHost, setIsProductionHost] = useState(false)
  const lastTrackedPath = useRef<string | null>(null)
  const sanitizedPath = sanitizeGoogleAnalyticsPath(pathname)
  const shouldTrackPath = shouldTrackGoogleAnalyticsPath(sanitizedPath)

  useEffect(() => {
    setIsProductionHost(isGoogleAnalyticsProductionHost(window.location.hostname))
  }, [])

  useEffect(() => {
    if (!isProductionHost || !shouldTrackPath || lastTrackedPath.current === sanitizedPath) return

    initializeGoogleAnalytics()
    window.gtag?.(
      'event',
      'page_view',
      createGoogleAnalyticsPageViewPayload(sanitizedPath, window.location.origin, document.title),
    )
    lastTrackedPath.current = sanitizedPath
  }, [isProductionHost, sanitizedPath, shouldTrackPath])

  if (!isProductionHost || !shouldTrackPath) return null

  return (
    <Script
      id="google-analytics"
      src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
      strategy="afterInteractive"
      onReady={initializeGoogleAnalytics}
    />
  )
}
