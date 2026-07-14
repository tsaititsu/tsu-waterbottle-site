import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { shouldHideCoursesServices } from '@/lib/siteVisibility'
import { COURSE_LIST_JSON_LD } from '@/lib/seo/courseJsonLd'
import { serializeJsonLd } from '@/lib/seo/homepageJsonLd'
import { createPublicMetadata, PUBLIC_PAGE_METADATA } from '@/lib/seo/publicMetadata'
import CoursesPageClient from './courses-client'

export const metadata: Metadata = createPublicMetadata(PUBLIC_PAGE_METADATA.courses)

export default function CoursesPage() {
  if (shouldHideCoursesServices()) {
    redirect('/')
  }

  return (
    <>
      <script
        id="course-list-structured-data"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(COURSE_LIST_JSON_LD),
        }}
      />
      <CoursesPageClient />
    </>
  )
}
