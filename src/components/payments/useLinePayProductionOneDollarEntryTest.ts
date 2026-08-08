'use client'

import { useEffect, useState } from 'react'
import { checkLinePayProductionOneDollarEntryAvailability } from '@/lib/linePay/productionOneDollarEntryClient'
import { getAuthAccessToken, subscribeAuthChange } from '@/lib/mockAuth'

export type LinePayProductionOneDollarEntryTestStatus =
  | 'checking'
  | 'enabled'
  | 'disabled'
  | 'error'

export function isLinePayProductionOneDollarEntryTestBlocked(
  status: LinePayProductionOneDollarEntryTestStatus,
) {
  return status === 'checking' || status === 'error'
}

export function getLinePayProductionOneDollarEntryTestButtonLabel(
  status: LinePayProductionOneDollarEntryTestStatus,
) {
  if (status === 'enabled') return '管理員 LINE Pay 入口測試付款 NT$1'
  if (status === 'checking') return '正在確認 LINE Pay 付款模式...'
  if (status === 'error') return '暫時無法確認 LINE Pay 付款模式'
  return null
}

export function useLinePayProductionOneDollarEntryTest() {
  const [status, setStatus] =
    useState<LinePayProductionOneDollarEntryTestStatus>('checking')

  useEffect(() => {
    let cancelled = false
    let requestVersion = 0
    let expirationTimer: ReturnType<typeof setTimeout> | null = null

    const checkAvailability = async () => {
      const currentRequestVersion = ++requestVersion
      if (expirationTimer) clearTimeout(expirationTimer)
      expirationTimer = null
      if (!cancelled) setStatus('checking')

      let accessToken: string | null
      try {
        accessToken = await getAuthAccessToken()
      } catch {
        if (!cancelled && currentRequestVersion === requestVersion) {
          setStatus('error')
        }
        return
      }
      if (!accessToken) {
        if (!cancelled && currentRequestVersion === requestVersion) {
          setStatus('disabled')
        }
        return
      }
      const availability = await checkLinePayProductionOneDollarEntryAvailability({
        accessToken,
      })
      if (!cancelled && currentRequestVersion === requestVersion) {
        setStatus(availability.status)
        if (availability.status === 'enabled') {
          const remainingMs = Date.parse(availability.enabledUntil) - Date.now()
          if (remainingMs <= 0) {
            setStatus('disabled')
            return
          }
          expirationTimer = setTimeout(
            () => void checkAvailability(),
            Math.min(remainingMs + 50, 2_147_483_647),
          )
        }
      }
    }

    void checkAvailability()
    const unsubscribe = subscribeAuthChange(() => {
      void checkAvailability()
    })

    return () => {
      cancelled = true
      requestVersion += 1
      if (expirationTimer) clearTimeout(expirationTimer)
      unsubscribe()
    }
  }, [])

  return status
}
