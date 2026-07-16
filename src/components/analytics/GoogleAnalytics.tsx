'use client'

import Script from 'next/script'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  bootstrapGoogleAnalytics,
  createGoogleAnalyticsPageViewPayload,
  createGoogleAnalyticsPageViewTracker,
  GA_MEASUREMENT_ID,
  isGoogleAnalyticsProductionHost,
  sanitizeGoogleAnalyticsPath,
  shouldTrackGoogleAnalyticsPath,
} from '@/lib/analytics/googleAnalytics'
import type { GoogleAnalyticsFunction } from '@/lib/analytics/googleAnalytics'

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: GoogleAnalyticsFunction
    waterbottleGoogleAnalyticsInitialized?: boolean
  }
}

export function GoogleAnalytics() {
  const pathname = usePathname()
  const [isProductionHost, setIsProductionHost] = useState(false)
  const [isBootstrapped, setIsBootstrapped] = useState(false)
  const [isScriptReady, setIsScriptReady] = useState(false)
  const [pageViewTracker] = useState(createGoogleAnalyticsPageViewTracker)
  const sanitizedPath = sanitizeGoogleAnalyticsPath(pathname)
  const shouldTrackPath = shouldTrackGoogleAnalyticsPath(sanitizedPath)

  useEffect(() => {
    setIsProductionHost(isGoogleAnalyticsProductionHost(window.location.hostname))
  }, [])

  useEffect(() => {
    if (!isProductionHost || !shouldTrackPath || isBootstrapped) return

    bootstrapGoogleAnalytics(window)
    setIsBootstrapped(true)
  }, [isBootstrapped, isProductionHost, shouldTrackPath])

  useEffect(() => {
    const gtag = window.gtag

    if (!isProductionHost || !shouldTrackPath || !isBootstrapped || !gtag) return

    pageViewTracker.processPageView(
      {
        pathname: sanitizedPath,
        payload: createGoogleAnalyticsPageViewPayload(
          sanitizedPath,
          window.location.origin,
          document.title,
        ),
      },
      isScriptReady,
      (payload) => gtag('event', 'page_view', payload),
    )
  }, [
    isBootstrapped,
    isProductionHost,
    isScriptReady,
    pageViewTracker,
    sanitizedPath,
    shouldTrackPath,
  ])

  if (!isProductionHost || !shouldTrackPath || !isBootstrapped) return null

  return (
    <Script
      id="google-analytics"
      src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
      strategy="afterInteractive"
      onReady={() => setIsScriptReady(true)}
    />
  )
}
