'use client'

import { usePathname } from 'next/navigation'
import { type MouseEvent, type PointerEvent as ReactPointerEvent, useCallback, useEffect, useRef, useState } from 'react'
import { trackGoogleAnalyticsCtaClick } from '@/lib/analytics/googleAnalytics'

const lineSupportUrl = 'https://lin.ee/6Tpje1P'
const storageKey = 'waterbottle-floating-line-position'
const dragThreshold = 5

type Position = {
  x: number
  y: number
}

const getDefaultPosition = () => {
  if (typeof window === 'undefined') {
    return { x: 0, y: 0 }
  }

  const margin = 24
  const buttonSize = 64

  return {
    x: Math.max(0, window.innerWidth - buttonSize - margin),
    y: Math.max(0, window.innerHeight - buttonSize - margin),
  }
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

export function FloatingLineButton() {
  const pathname = usePathname()
  const anchorRef = useRef<HTMLAnchorElement | null>(null)
  const draggingRef = useRef(false)
  const startPointRef = useRef({ x: 0, y: 0 })
  const startPositionRef = useRef({ x: 0, y: 0 })
  const movedRef = useRef(false)
  const positionRef = useRef<Position>({ x: 0, y: 0 })

  const [position, setPosition] = useState<Position>({ x: 0, y: 0 })
  const [isDesktop, setIsDesktop] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const hideOnMobileInteractionPage = pathname === '/' || pathname.startsWith('/ai-chart') || pathname.startsWith('/ai-divination')

  const updatePosition = useCallback((next: Position) => {
    positionRef.current = next
    setPosition(next)
  }, [])

  const savePosition = useCallback((next: Position) => {
    localStorage.setItem(storageKey, JSON.stringify(next))
  }, [])

  const clampToViewport = useCallback((next: Position): Position => {
    const buttonSize = anchorRef.current?.getBoundingClientRect().width || 64
    return {
      x: clamp(next.x, 0, Math.max(0, window.innerWidth - buttonSize)),
      y: clamp(next.y, 0, Math.max(0, window.innerHeight - buttonSize)),
    }
  }, [])

  useEffect(() => {
    const desktopMedia = window.matchMedia('(min-width: 768px)')

    const loadDesktopPosition = () => {
      const desktop = desktopMedia.matches
      setIsDesktop(desktop)

      if (!desktop) {
        draggingRef.current = false
        movedRef.current = false
        setIsDragging(false)
        return
      }

      let nextPosition = getDefaultPosition()
      const saved = localStorage.getItem(storageKey)

      if (saved) {
        try {
          const parsed = JSON.parse(saved) as Position
          if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
            nextPosition = parsed
          }
        } catch {
          // Ignore invalid cached desktop position.
        }
      }

      updatePosition(clampToViewport(nextPosition))
    }

    const clampDesktopPosition = () => {
      if (!desktopMedia.matches) return
      updatePosition(clampToViewport(positionRef.current))
    }

    loadDesktopPosition()
    desktopMedia.addEventListener('change', loadDesktopPosition)
    window.addEventListener('resize', clampDesktopPosition)
    window.addEventListener('orientationchange', clampDesktopPosition)
    window.addEventListener('pageshow', clampDesktopPosition)
    window.visualViewport?.addEventListener('resize', clampDesktopPosition)

    return () => {
      desktopMedia.removeEventListener('change', loadDesktopPosition)
      window.removeEventListener('resize', clampDesktopPosition)
      window.removeEventListener('orientationchange', clampDesktopPosition)
      window.removeEventListener('pageshow', clampDesktopPosition)
      window.visualViewport?.removeEventListener('resize', clampDesktopPosition)
    }
  }, [clampToViewport, updatePosition])

  const stopDrag = useCallback(() => {
    if (!draggingRef.current) return

    draggingRef.current = false
    setIsDragging(false)

    if (movedRef.current && isDesktop) {
      savePosition(positionRef.current)
    }
  }, [isDesktop, savePosition])

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLAnchorElement>) => {
    if (!draggingRef.current) return

    const dx = event.clientX - startPointRef.current.x
    const dy = event.clientY - startPointRef.current.y

    if (!movedRef.current && (Math.abs(dx) > dragThreshold || Math.abs(dy) > dragThreshold)) {
      movedRef.current = true
    }

    if (!movedRef.current) return

    const next = clampToViewport({
      x: startPositionRef.current.x + dx,
      y: startPositionRef.current.y + dy,
    })

    updatePosition(next)
  }, [clampToViewport, updatePosition])

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLAnchorElement>) => {
    if (!anchorRef.current || !isDesktop) return

    movedRef.current = false
    draggingRef.current = true
    startPointRef.current = { x: event.clientX, y: event.clientY }
    startPositionRef.current = { ...position }
    setIsDragging(true)

    anchorRef.current.setPointerCapture(event.pointerId)
  }, [isDesktop, position])

  const handlePointerUp = useCallback((event: ReactPointerEvent<HTMLAnchorElement>) => {
    if (!draggingRef.current) return

    const willOpen = !movedRef.current

    stopDrag()
    anchorRef.current?.releasePointerCapture?.(event.pointerId)

    if (!willOpen) {
      event.preventDefault()
      event.stopPropagation()
      return
    }
  }, [stopDrag])

  const handleClick = useCallback((event: MouseEvent<HTMLAnchorElement>) => {
    if (movedRef.current) {
      event.preventDefault()
      event.stopPropagation()
      movedRef.current = false
      return
    }

    trackGoogleAnalyticsCtaClick(
      window,
      window.location.hostname,
      pathname,
      {
        destination: 'line_official_account',
        placement: 'floating_line',
      },
    )
  }, [pathname])

  return (
    <a
      ref={anchorRef}
      href={lineSupportUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="加入水瓶先生官方 LINE"
      title="加入水瓶先生官方 LINE"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={stopDrag}
      onClick={handleClick}
      data-draggable={isDesktop ? 'true' : 'false'}
      data-mobile-hidden={hideOnMobileInteractionPage ? 'true' : 'false'}
      className={`floating-line-button touch-manipulation fixed z-30 flex h-12 w-12 items-center justify-center rounded-full bg-[#06c755] text-xs font-black text-white shadow-[0_12px_30px_rgba(6,199,85,0.35)] transition hover:scale-105 hover:shadow-[0_16px_36px_rgba(6,199,85,0.45)] md:touch-none md:z-50 md:h-16 md:w-16 md:text-sm ${
        hideOnMobileInteractionPage ? 'floating-line-button--mobile-hidden' : ''
      } ${
        isDesktop ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-pointer'
      }`}
      style={isDesktop ? { left: `${position.x}px`, top: `${position.y}px`, right: 'auto', bottom: 'auto' } : undefined}
    >
      LINE
    </a>
  )
}
