'use client'

import { Suspense, useCallback, useState } from 'react'
import { DivinationLocalPreview } from '@/components/divination/DivinationLocalPreview'
import { DivinationSearchParamsBridge } from '@/components/divination/DivinationSearchParamsBridge'
import {
  INITIAL_DIVINATION_SEARCH_PARAM_STATE,
  reconcileDivinationSearchParamState,
  type DivinationSearchParamState,
} from '@/lib/publicFormSearchParams'

export function DivinationPageShell() {
  const [searchParamState, setSearchParamState] = useState(
    INITIAL_DIVINATION_SEARCH_PARAM_STATE,
  )

  const handleSearchParamChange = useCallback(
    (next: DivinationSearchParamState) => {
      setSearchParamState((current) =>
        reconcileDivinationSearchParamState(current, next),
      )
    },
    [],
  )

  return (
    <>
      <DivinationLocalPreview
        resetKey={searchParamState.resetKey}
        followUpKey={searchParamState.followUpKey}
      />
      <Suspense fallback={null}>
        <DivinationSearchParamsBridge onChange={handleSearchParamChange} />
      </Suspense>
    </>
  )
}
