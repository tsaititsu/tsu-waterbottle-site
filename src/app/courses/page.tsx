import { redirect } from 'next/navigation'
import { shouldHideCoursesServices } from '@/lib/siteVisibility'
import CoursesPageClient from './courses-client'

export default function CoursesPage() {
  if (shouldHideCoursesServices()) {
    redirect('/')
  }

  return <CoursesPageClient />
}
