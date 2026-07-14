import type { Metadata } from 'next'
import { NO_INDEX_ROBOTS } from '@/lib/seo/noIndexMetadata'
import { DivinationResultPageClient } from './DivinationResultPageClient'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '本次占卜解讀｜水瓶先生',
  robots: NO_INDEX_ROBOTS,
}

export default function AiDivinationResultPage() {
  return <DivinationResultPageClient />
}
