export const GA_MEASUREMENT_ID = 'G-239FT0JGEC'

export interface GoogleAnalyticsFunction {
  (command: 'js', date: Date): void
  (command: 'config', measurementId: string, options: { send_page_view: false }): void
  (command: 'event', eventName: 'page_view', payload: GoogleAnalyticsPageViewPayload): void
  (command: 'event', eventName: 'cta_click', payload: GoogleAnalyticsCtaClickPayload): void
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

export const GOOGLE_ANALYTICS_CTA_DESTINATIONS = [
  'ai_chart',
  'ai_divination',
  'booking',
  'courses',
  'spiritual_products',
  'line_official_account',
] as const

export const GOOGLE_ANALYTICS_CTA_PLACEMENTS = [
  'home_hero',
  'home_service_card',
  'home_feedback',
  'home_pricing',
  'home_course_preview',
  'header_desktop',
  'header_mobile',
  'mobile_bottom_nav',
  'footer_service',
  'footer_line',
  'floating_line',
] as const

export type GoogleAnalyticsCtaDestination =
  (typeof GOOGLE_ANALYTICS_CTA_DESTINATIONS)[number]

export type GoogleAnalyticsCtaPlacement =
  (typeof GOOGLE_ANALYTICS_CTA_PLACEMENTS)[number]

export interface GoogleAnalyticsCtaClickInput {
  destination: GoogleAnalyticsCtaDestination
  placement: GoogleAnalyticsCtaPlacement
}

export interface GoogleAnalyticsCtaClickPayload {
  cta_id: `${GoogleAnalyticsCtaPlacement}_${GoogleAnalyticsCtaDestination}`
  cta_destination: GoogleAnalyticsCtaDestination
  cta_placement: GoogleAnalyticsCtaPlacement
  source_path: string
}

const productionHosts = new Set<string>(GOOGLE_ANALYTICS_PRODUCTION_HOSTS)
const publicPaths = new Set<string>(GOOGLE_ANALYTICS_PUBLIC_PATHS)
const ctaDestinations = new Set<string>(GOOGLE_ANALYTICS_CTA_DESTINATIONS)
const ctaPlacements = new Set<string>(GOOGLE_ANALYTICS_CTA_PLACEMENTS)

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

export function createGoogleAnalyticsCtaClickPayload(
  pathname: string,
  input: GoogleAnalyticsCtaClickInput,
): GoogleAnalyticsCtaClickPayload | null {
  if (!ctaDestinations.has(input.destination) || !ctaPlacements.has(input.placement)) {
    return null
  }

  const sourcePath = sanitizeGoogleAnalyticsPath(pathname)
  if (!shouldTrackGoogleAnalyticsPath(sourcePath)) return null

  return {
    cta_id: `${input.placement}_${input.destination}`,
    cta_destination: input.destination,
    cta_placement: input.placement,
    source_path: sourcePath,
  }
}

export function trackGoogleAnalyticsCtaClick(
  target: GoogleAnalyticsWindowLike,
  hostname: string,
  pathname: string,
  input: GoogleAnalyticsCtaClickInput,
): boolean {
  if (!isGoogleAnalyticsProductionHost(hostname) || !target.gtag) return false

  const payload = createGoogleAnalyticsCtaClickPayload(pathname, input)
  if (!payload) return false

  try {
    target.gtag('event', 'cta_click', payload)
    return true
  } catch {
    return false
  }
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
