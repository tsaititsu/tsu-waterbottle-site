export const GA_MEASUREMENT_ID = 'G-239FT0JGEC'

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
