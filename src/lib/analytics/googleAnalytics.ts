export const GA_MEASUREMENT_ID = 'G-239FT0JGEC'

export interface GoogleAnalyticsFunction {
  (command: 'js', date: Date): void
  (command: 'config', measurementId: string, options: { send_page_view: false }): void
  (command: 'event', eventName: 'page_view', payload: GoogleAnalyticsPageViewPayload): void
}

export interface GoogleAnalyticsWindowLike {
  dataLayer?: unknown[]
  gtag?: GoogleAnalyticsFunction
  waterbottleGoogleAnalyticsInitialized?: boolean
}

export const GOOGLE_ANALYTICS_PRODUCTION_HOSTS = [
  'tsu-waterbottle.com',
  'www.tsu-waterbottle.com',
] as const

export const GOOGLE_ANALYTICS_PUBLIC_PATHS = [
  '/',
  '/ai-chart',
  '/ai-divination',
  '/booking',
  '/courses',
  '/spiritual-products',
  '/contact',
  '/terms',
  '/privacy',
  '/refund-policy',
  '/consumer-rights',
] as const

const productionHosts = new Set<string>(GOOGLE_ANALYTICS_PRODUCTION_HOSTS)
const publicPaths = new Set<string>(GOOGLE_ANALYTICS_PUBLIC_PATHS)

export function isGoogleAnalyticsProductionHost(hostname: string): boolean {
  return productionHosts.has(hostname)
}

export function sanitizeGoogleAnalyticsPath(pathname: string): string {
  const normalizedPath = pathname.trim()

  if (!normalizedPath) return '/'

  const queryIndex = normalizedPath.indexOf('?')
  const hashIndex = normalizedPath.indexOf('#')
  const pathEndIndexes = [queryIndex, hashIndex].filter((index) => index >= 0)
  const pathEnd = pathEndIndexes.length > 0 ? Math.min(...pathEndIndexes) : normalizedPath.length
  const sanitizedPath = normalizedPath.slice(0, pathEnd)

  return sanitizedPath || '/'
}

export function shouldTrackGoogleAnalyticsPath(pathname: string): boolean {
  return publicPaths.has(sanitizeGoogleAnalyticsPath(pathname))
}

export function createGoogleAnalyticsPageViewPayload(
  pathname: string,
  origin: string,
  pageTitle: string,
) {
  const sanitizedPath = sanitizeGoogleAnalyticsPath(pathname)

  return {
    page_title: pageTitle,
    page_path: sanitizedPath,
    page_location: `${origin}${sanitizedPath}`,
    page_referrer: '',
  } as const
}

export type GoogleAnalyticsPageViewPayload = ReturnType<
  typeof createGoogleAnalyticsPageViewPayload
>

export function createGoogleAnalyticsQueue(dataLayer: unknown[]): GoogleAnalyticsFunction {
  function gtag() {
    // Google gtag.js requires the original Arguments object instead of a copied command array.
    // eslint-disable-next-line prefer-rest-params
    dataLayer.push(arguments)
  }

  return gtag as GoogleAnalyticsFunction
}

export function bootstrapGoogleAnalytics(
  target: GoogleAnalyticsWindowLike,
  initializedAt = new Date(),
): void {
  if (target.waterbottleGoogleAnalyticsInitialized) return

  target.dataLayer = target.dataLayer || []
  target.gtag = target.gtag || createGoogleAnalyticsQueue(target.dataLayer)
  target.gtag('js', initializedAt)
  target.gtag('config', GA_MEASUREMENT_ID, {
    send_page_view: false,
  })
  target.waterbottleGoogleAnalyticsInitialized = true
}

interface GoogleAnalyticsPageViewCandidate {
  pathname: string
  payload: GoogleAnalyticsPageViewPayload
}

type SendGoogleAnalyticsPageView = (payload: GoogleAnalyticsPageViewPayload) => void

export function createGoogleAnalyticsPageViewTracker() {
  const pendingPageViews: GoogleAnalyticsPageViewCandidate[] = []
  let lastSentPathname: string | null = null

  return {
    processPageView(
      candidate: GoogleAnalyticsPageViewCandidate,
      isScriptReady: boolean,
      sendPageView: SendGoogleAnalyticsPageView,
    ): number {
      const lastPendingPageView = pendingPageViews.at(-1)

      if (
        lastPendingPageView?.pathname !== candidate.pathname &&
        (pendingPageViews.length > 0 || lastSentPathname !== candidate.pathname)
      ) {
        pendingPageViews.push(candidate)
      }

      if (!isScriptReady) return 0

      let sentPageViews = 0

      for (const pendingPageView of pendingPageViews) {
        if (pendingPageView.pathname === lastSentPathname) continue

        sendPageView(pendingPageView.payload)
        lastSentPathname = pendingPageView.pathname
        sentPageViews += 1
      }
      pendingPageViews.length = 0

      return sentPageViews
    },
  }
}
