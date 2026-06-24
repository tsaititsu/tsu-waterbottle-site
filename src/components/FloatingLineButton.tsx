'use client'

import { type MouseEvent, type PointerEvent as ReactPointerEvent, useCallback, useEffect, useRef, useState } from 'react'

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

  const isDesktop = window.innerWidth >= 768
  const margin = isDesktop ? 24 : 20
  const buttonSize = isDesktop ? 64 : 56

  return {
    x: Math.max(0, window.innerWidth - buttonSize - margin),
    y: Math.max(0, window.innerHeight - buttonSize - margin),
  }
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

export function FloatingLineButton() {
  const anchorRef = useRef<HTMLAnchorElement | null>(null)
  const draggingRef = useRef(false)
  const startPointRef = useRef({ x: 0, y: 0 })
  const startPositionRef = useRef({ x: 0, y: 0 })
  const movedRef = useRef(false)

  const [position, setPosition] = useState<Position>({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    setPosition(getDefaultPosition())

    const saved = localStorage.getItem(storageKey)
    if (!saved) return

    try {
      const parsed = JSON.parse(saved) as Position
      if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
        const buttonSize = anchorRef.current?.getBoundingClientRect().width || 56
        const nextPosition = {
          x: clamp(parsed.x, 0, Math.max(0, window.innerWidth - buttonSize)),
          y: clamp(parsed.y, 0, Math.max(0, window.innerHeight - buttonSize)),
        }
        setPosition(nextPosition)
      }
    } catch {
      // ignore invalid cached position
    }
  }, [])

  useEffect(() => {
    const handleResize = () => {
      const buttonSize = anchorRef.current?.getBoundingClientRect().width || 56
      setPosition((current) => ({
        x: clamp(current.x, 0, Math.max(0, window.innerWidth - buttonSize)),
        y: clamp(current.y, 0, Math.max(0, window.innerHeight - buttonSize)),
      }))
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const savePosition = useCallback((next: Position) => {
    localStorage.setItem(storageKey, JSON.stringify(next))
  }, [])

  const clampToViewport = useCallback((next: Position): Position => {
    const buttonSize = anchorRef.current?.getBoundingClientRect().width || 56
    return {
      x: clamp(next.x, 0, Math.max(0, window.innerWidth - buttonSize)),
      y: clamp(next.y, 0, Math.max(0, window.innerHeight - buttonSize)),
    }
  }, [])

  const stopDrag = useCallback(() => {
    if (!draggingRef.current) return

    draggingRef.current = false
    setIsDragging(false)

    window.removeEventListener('pointermove', handlePointerMove)
    window.removeEventListener('pointerup', stopDrag)

    if (movedRef.current) {
      savePosition(position)
    }
  }, [position, savePosition])

  const handlePointerMove = useCallback((event: PointerEvent) => {
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

    setPosition(next)
  }, [clampToViewport])

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLAnchorElement>) => {
    if (!anchorRef.current) return

    movedRef.current = false
    draggingRef.current = true
    startPointRef.current = { x: event.clientX, y: event.clientY }
    startPositionRef.current = { ...position }
    setIsDragging(true)

    anchorRef.current.setPointerCapture(event.pointerId)

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', stopDrag)
  }, [handlePointerMove, position, stopDrag])

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
    }
  }, [])

  return (
    <a
      ref={anchorRef}
      href={lineSupportUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="加入水瓶先生官方 LINE"
      title="加入水瓶先生官方 LINE"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onClick={handleClick}
      className={`touch-none fixed z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#06c755] text-sm font-black text-white shadow-[0_12px_30px_rgba(6,199,85,0.35)] transition hover:scale-105 hover:shadow-[0_16px_36px_rgba(6,199,85,0.45)] md:h-16 md:w-16 ${
        isDragging ? 'cursor-grabbing' : 'cursor-grab'
      }`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
    >
      LINE
    </a>
  )
}
