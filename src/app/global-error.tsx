'use client'

import { BrandedErrorPage } from '@/components/BrandedErrorPage'

type GlobalErrorPageProps = {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalErrorPage({ reset }: GlobalErrorPageProps) {
  return (
    <html lang="zh-Hant">
      <body style={{ margin: 0 }}>
        <title>網站暫時無法載入｜WATERBOTTLE 紫微命理</title>
        <main>
          <BrandedErrorPage
            code="緊急錯誤"
            description="網站遇到暫時性問題，請稍後再試。若問題持續，請回到首頁或聯絡客服。"
            onRetry={reset}
            standalone
            title="網站暫時無法載入"
          />
        </main>
      </body>
    </html>
  )
}
