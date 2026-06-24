import Link from 'next/link'
import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { createServerClient } from '@supabase/ssr'
import { PageHero } from '@/components/PageHero'
import { getCourseById, isCourseId, type CourseId } from '@/lib/courses'
import { shouldHideCoursesServices } from '@/lib/siteVisibility'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

type LearnPageProps = {
  params: Promise<{ id: string }>
}

async function getServerSupabaseClient() {
  if (!supabaseUrl || !supabaseAnonKey) return null

  const cookieStore = await cookies()

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
    },
  })
}

async function hasPurchasedCourse(courseId: CourseId) {
  const supabase = await getServerSupabaseClient()
  if (!supabase) redirect('/courses')

  const { data: userData, error: userError } = await supabase.auth.getUser()
  const user = userData.user

  if (userError || !user) redirect('/courses')

  const { data, error } = await supabase
    .from('course_purchases')
    .select('id')
    .eq('user_id', user.id)
    .eq('course_id', courseId)
    .eq('status', 'paid')
    .maybeSingle()

  if (error) return false
  return Boolean(data)
}

export default async function CourseLearnPage({ params }: LearnPageProps) {
  if (shouldHideCoursesServices()) {
    redirect('/')
  }

  const { id } = await params
  if (!isCourseId(id)) notFound()

  const course = getCourseById(id)
  if (!course) notFound()

  const purchased = await hasPurchasedCourse(id)

  if (!purchased) {
    return (
      <>
        <PageHero
          eyebrow="Course"
          title={`${course.title}｜${course.subtitle}`}
          description="尚未購買此課程，請先完成購買後再進入課程內容。"
        />
        <section className="bg-white py-12 md:py-16">
          <div className="section-shell rounded-2xl border border-borderSoft bg-softPurple p-8 shadow-soft">
            <p className="font-serifTC text-2xl font-semibold text-deepPurple">尚未購買此課程</p>
            <p className="mt-4 leading-7 text-textMuted">請先完成購買後再進入課程內容。</p>
            <Link className="focus-ring mt-6 inline-flex rounded-lg bg-deepPurple px-5 py-3 font-semibold text-white" href="/courses">
              返回課程頁
            </Link>
          </div>
        </section>
      </>
    )
  }

  return (
    <>
      <PageHero
        eyebrow="Course"
        title={`${course.title}｜${course.subtitle}`}
        description="課程內容建置中，正式章節與教材會在課程後台完成後開放。"
      />
      <section className="bg-white py-12 md:py-16">
        <div className="section-shell rounded-2xl border border-borderSoft bg-softPurple p-8 shadow-soft">
          <p className="font-serifTC text-2xl font-semibold text-deepPurple">課程內容建置中</p>
          <p className="mt-4 leading-7 text-textMuted">
            目前已建立課程購買與解鎖流程，影片、講義與正式單元會在後續課程後台完成後開放。
          </p>
          <Link className="focus-ring mt-6 inline-flex rounded-lg bg-deepPurple px-5 py-3 font-semibold text-white" href="/account/courses">
            回我的課程
          </Link>
        </div>
      </section>
    </>
  )
}
