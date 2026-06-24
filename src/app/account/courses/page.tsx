import { redirect } from 'next/navigation'
import { shouldHideCoursesServices } from '@/lib/siteVisibility'
import AccountCoursesPageClient from './account-courses-client'

export default function AccountCoursesPage() {
  if (shouldHideCoursesServices()) {
    redirect('/')
  }

  return <AccountCoursesPageClient />
}
