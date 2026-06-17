'use client'

import { useState } from 'react'
import { LoginModal } from '@/components/LoginModal'
import { PageHero } from '@/components/PageHero'
import { courseItems } from '@/lib/mockData'
import { getMockUser } from '@/lib/mockAuth'
import { joinCourseWaitlist } from '@/lib/mockPayment'

export default function CoursesPage() {
  const [loginOpen, setLoginOpen] = useState(false)
  const [joined, setJoined] = useState(false)

  const handleJoin = () => {
    if (!getMockUser()) {
      setLoginOpen(true)
      return
    }
    setJoined(joinCourseWaitlist())
  }

  return (
    <>
      <PageHero
        eyebrow="Courses"
        title="紫微斗數課程"
        description="第一版先開放課程預告與候補名單，後續可擴充正式線上課程與會員觀看紀錄。"
      />
      <section className="bg-white py-12 md:py-16">
        <div className="section-shell grid gap-8 lg:grid-cols-[1fr_0.6fr]">
          <div className="grid gap-4 sm:grid-cols-2">
            {courseItems.map((item) => (
              <article key={item} className="rounded-2xl border border-borderSoft bg-white p-5 shadow-soft">
                <span className="rounded-full bg-lightGold px-3 py-1 text-xs font-semibold text-darkGold">即將開課</span>
                <h2 className="mt-4 font-serifTC text-xl font-semibold text-deepPurple">{item}</h2>
                <p className="mt-3 leading-7 text-textMuted">以清楚結構學會紫微斗數的觀念與實務應用。</p>
              </article>
            ))}
          </div>
          <aside className="h-fit rounded-2xl border border-gold bg-softPurple p-6 shadow-soft">
            <h2 className="font-serifTC text-2xl font-semibold text-deepPurple">加入課程候補名單</h2>
            <p className="mt-3 leading-7 text-textMuted">開課時優先收到通知，會員中心也會保存候補狀態。</p>
            <button className="focus-ring mt-6 w-full rounded-lg bg-deepPurple px-4 py-3 font-semibold text-white" onClick={handleJoin}>
              加入課程候補名單
            </button>
            {joined && <p className="mt-3 font-semibold text-darkGold">已加入候補名單。</p>}
          </aside>
        </div>
      </section>
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} onSuccess={handleJoin} />
    </>
  )
}
