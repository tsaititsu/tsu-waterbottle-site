'use client'

import { Suspense, useCallback, useState } from 'react'
import { BookingForm } from '@/components/BookingForm'
import { BookingSearchParamsBridge } from '@/components/BookingSearchParamsBridge'
import {
  INITIAL_BOOKING_SEARCH_PARAM_STATE,
  reconcileBookingSearchParamState,
  type BookingSearchParamState,
} from '@/lib/publicFormSearchParams'

export function BookingPageShell() {
  const [searchParamState, setSearchParamState] = useState(
    INITIAL_BOOKING_SEARCH_PARAM_STATE,
  )

  const handleSearchParamChange = useCallback((next: BookingSearchParamState) => {
    setSearchParamState((current) =>
      reconcileBookingSearchParamState(current, next),
    )
  }, [])

  return (
    <>
      <BookingForm resetKey={searchParamState.resetKey} />
      <Suspense fallback={null}>
        <BookingSearchParamsBridge onChange={handleSearchParamChange} />
      </Suspense>
    </>
  )
}
