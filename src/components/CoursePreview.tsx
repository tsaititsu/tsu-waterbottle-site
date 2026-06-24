import Link from 'next/link'
import { shouldHideCoursesServices } from '@/lib/siteVisibility'

export function CoursePreview() {
  if (shouldHideCoursesServices()) return null

  return (
    <section className="bg-softPurple py-12 md:py-20">
      <div className="section-shell grid gap-8 rounded-[28px] border border-borderSoft bg-white p-7 shadow-soft md:grid-cols-[1fr_0.8fr] md:p-10">
        <div>
          <p className="text-sm font-semibold text-darkGold">Course</p>
          <h2 className="mt-2 font-serifTC text-3xl font-semibold text-deepPurple">紫微斗數線上課程</h2>
          <p className="mt-4 max-w-xl leading-8 text-textMuted">
            從小白入門到進階解盤，依照學習階段一步一步建立紫微斗數判讀能力。
          </p>
          <Link className="focus-ring mt-7 inline-flex rounded-lg bg-deepPurple px-6 py-3 font-semibold text-white" href="/courses">
            查看課程
          </Link>
        </div>
        <div className="grid content-center gap-3">
          {['初級班｜小白專區', '進階班｜進階的解盤技巧', '高階班｜飛化與占卜技巧'].map((item) => (
            <div key={item} className="rounded-xl border border-borderSoft bg-softPurple px-4 py-3 font-semibold text-deepPurple">
              {item}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
