'use client'

import { useSearchParams } from 'next/navigation'
import { DivinationLocalPreview } from '@/components/divination/DivinationLocalPreview'

export function DivinationSearchParamsBridge() {
  const searchParams = useSearchParams()
  const resetKey = searchParams.get('reset') ?? ''
  const followUpKey = searchParams.get('followUp') ?? ''

  return <DivinationLocalPreview resetKey={resetKey} followUpKey={followUpKey} />
}
