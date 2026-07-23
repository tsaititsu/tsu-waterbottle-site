import { BrandedErrorPage } from '@/components/BrandedErrorPage'

export default function NotFound() {
  return (
    <BrandedErrorPage
      code="404"
      description="網址可能已變更，或頁面暫時不存在。你可以回到首頁，重新找到需要的服務。"
      title="這個頁面找不到"
    />
  )
}
