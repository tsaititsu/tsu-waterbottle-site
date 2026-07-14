import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { shouldHideCoursesServices } from '@/lib/siteVisibility'
import { createPublicMetadata, PUBLIC_PAGE_METADATA } from '@/lib/seo/publicMetadata'
import CoursesPageClient from './courses-client'

export const metadata: Metadata = createPublicMetadata(PUBLIC_PAGE_METADATA.courses)

export default function CoursesPage() {
  if (shouldHideCoursesServices()) {
    redirect('/')
  }

  return <CoursesPageClient />
}
