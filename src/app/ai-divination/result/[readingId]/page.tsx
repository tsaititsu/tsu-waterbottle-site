import type { Metadata } from 'next'
import { DivinationResultPageClient } from './DivinationResultPageClient'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '本次占卜解讀｜水瓶先生',
  robots: {
    index: false,
    follow: false,
  },
}

export default function AiDivinationResultPage() {
  return <DivinationResultPageClient />
}
