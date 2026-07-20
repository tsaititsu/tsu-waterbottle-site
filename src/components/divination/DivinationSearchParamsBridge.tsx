'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import type { DivinationSearchParamState } from '@/lib/publicFormSearchParams'

type DivinationSearchParamsBridgeProps = {
  onChange: (state: DivinationSearchParamState) => void
}

export function DivinationSearchParamsBridge({
  onChange,
}: DivinationSearchParamsBridgeProps) {
  const searchParams = useSearchParams()
  const resetKey = searchParams.get('reset') ?? ''
  const followUpKey = searchParams.get('followUp') ?? ''

  useEffect(() => {
    onChange({ resetKey, followUpKey })
  }, [followUpKey, onChange, resetKey])

  return null
}
