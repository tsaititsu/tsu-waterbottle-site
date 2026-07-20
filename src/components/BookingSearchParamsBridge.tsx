'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import type { BookingSearchParamState } from '@/lib/publicFormSearchParams'

type BookingSearchParamsBridgeProps = {
  onChange: (state: BookingSearchParamState) => void
}

export function BookingSearchParamsBridge({
  onChange,
}: BookingSearchParamsBridgeProps) {
  const searchParams = useSearchParams()
  const resetKey = searchParams.get('reset') ?? ''

  useEffect(() => {
    onChange({ resetKey })
  }, [onChange, resetKey])

  return null
}
