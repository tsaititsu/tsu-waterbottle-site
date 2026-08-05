'use client'

import { useEffect, useState } from 'react'
import { checkLinePayEntryOneDollarTestAvailability } from '@/lib/linePay/entryOneDollarTestClient'
import { getAuthAccessToken, subscribeAuthChange } from '@/lib/mockAuth'

export function useLinePayEntryOneDollarTest() {
  const [available, setAvailable] = useState(false)

  useEffect(() => {
    let active = true
    let requestVersion = 0

    const checkAvailability = async () => {
      const currentVersion = ++requestVersion
      if (active) setAvailable(false)
      const enabled = await checkLinePayEntryOneDollarTestAvailability({
        getAccessToken: getAuthAccessToken,
      })
      if (active && currentVersion === requestVersion) {
        setAvailable(enabled)
      }
    }

    void checkAvailability()
    const unsubscribe = subscribeAuthChange(() => {
      void checkAvailability()
    })

    return () => {
      active = false
      requestVersion += 1
      unsubscribe()
    }
  }, [])

  return available
}
