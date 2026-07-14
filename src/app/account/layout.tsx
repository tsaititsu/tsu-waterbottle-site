import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { NO_INDEX_METADATA } from '@/lib/seo/noIndexMetadata'

export const metadata: Metadata = NO_INDEX_METADATA

export default function AccountLayout({ children }: { children: ReactNode }) {
  return children
}
