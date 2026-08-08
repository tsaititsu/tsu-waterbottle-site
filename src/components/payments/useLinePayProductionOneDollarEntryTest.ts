'use client'

import { useEffect, useState } from 'react'
import { checkLinePayProductionOneDollarEntryAvailability } from '@/lib/linePay/productionOneDollarEntryClient'
import { getAuthAccessToken, subscribeAuthChange } from '@/lib/mockAuth'

export function useLinePayProductionOneDollarEntryTest() {
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    let cancelled = false
    let requestVersion = 0

    const checkAvailability = async () => {
      const currentRequestVersion = ++requestVersion
      if (!cancelled) setEnabled(false)

      const accessToken = await getAuthAccessToken().catch(() => null)
      if (!accessToken) return
      const available = await checkLinePayProductionOneDollarEntryAvailability({
        accessToken,
      })
      if (!cancelled && currentRequestVersion === requestVersion) {
        setEnabled(available)
      }
    }

    void checkAvailability()
    const unsubscribe = subscribeAuthChange(() => {
      void checkAvailability()
    })

    return () => {
      cancelled = true
      requestVersion += 1
      unsubscribe()
    }
  }, [])

  return enabled
}
