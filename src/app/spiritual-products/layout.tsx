import type { Metadata } from 'next'
import { createPublicMetadata, PUBLIC_PAGE_METADATA } from '@/lib/seo/publicMetadata'

export const metadata: Metadata = createPublicMetadata(PUBLIC_PAGE_METADATA.spiritualProducts)

export default function SpiritualProductsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children
}
