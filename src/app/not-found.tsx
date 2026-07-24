import type { Metadata } from 'next'
import { BrandedErrorPage } from '@/components/BrandedErrorPage'

export const metadata: Metadata = {
  title: '找不到頁面',
  robots: {
    index: false,
    follow: false,
  },
}

export default function NotFound() {
  return (
    <BrandedErrorPage
      code="404"
      description="網址可能已變更，或頁面暫時不存在。你可以回到首頁，重新找到需要的服務。"
      showChartLink
      title="這個頁面找不到"
    />
  )
}
