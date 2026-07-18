'use client'

import { useSearchParams } from 'next/navigation'
import { BookingForm } from '@/components/BookingForm'

export function BookingSearchParamsBridge() {
  const searchParams = useSearchParams()
  const resetKey = searchParams.get('reset') ?? ''

  return <BookingForm resetKey={resetKey} />
}
