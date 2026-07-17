'use client'

import Link, { type LinkProps } from 'next/link'
import type { AnchorHTMLAttributes, MouseEventHandler, ReactNode } from 'react'
import {
  trackGoogleAnalyticsCtaClick,
  type GoogleAnalyticsCtaDestination,
  type GoogleAnalyticsCtaPlacement,
} from '@/lib/analytics/googleAnalytics'

type TrackedPublicCtaLinkProps = {
  href: LinkProps['href']
  destination: GoogleAnalyticsCtaDestination
  placement: GoogleAnalyticsCtaPlacement
  children: ReactNode
  className?: string
  target?: AnchorHTMLAttributes<HTMLAnchorElement>['target']
  rel?: string
  'aria-label'?: string
  title?: string
  onClick?: MouseEventHandler<HTMLAnchorElement>
}

export function TrackedPublicCtaLink({
  href,
  destination,
  placement,
  children,
  className,
  target,
  rel,
  'aria-label': ariaLabel,
  title,
  onClick,
}: TrackedPublicCtaLinkProps) {
  const handleClick: MouseEventHandler<HTMLAnchorElement> = (event) => {
    trackGoogleAnalyticsCtaClick(
      window,
      window.location.hostname,
      window.location.pathname,
      { destination, placement },
    )
    onClick?.(event)
  }

  return (
    <Link
      href={href}
      className={className}
      target={target}
      rel={rel}
      aria-label={ariaLabel}
      title={title}
      onClick={handleClick}
    >
      {children}
    </Link>
  )
}
