export function isLineInAppBrowser(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false
  return /\bline\/\d+(?:\.\d+)*\b/i.test(userAgent)
}
