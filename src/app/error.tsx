'use client'

import { BrandedErrorPage } from '@/components/BrandedErrorPage'

type ErrorPageProps = {
  error: Error & { digest?: string }
  reset: () => void
}

export default function ErrorPage({ reset }: ErrorPageProps) {
  return (
    <BrandedErrorPage
      code="系統提醒"
      description="剛剛發生未預期狀況。你可以重新嘗試；若問題持續，請回到首頁或聯絡客服。"
      onRetry={reset}
      title="頁面暫時無法顯示"
    />
  )
}
