'use client'

import { useState } from 'react'
import { getMockUser } from '@/lib/mockAuth'
import { joinCourseWaitlist } from '@/lib/mockPayment'
import { LoginModal } from './LoginModal'

export function CoursePreview() {
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
    <section className="bg-softPurple py-12 md:py-20">
      <div className="section-shell grid gap-8 rounded-[28px] border border-borderSoft bg-white p-7 shadow-soft md:grid-cols-[1fr_0.8fr] md:p-10">
        <div>
          <p className="text-sm font-semibold text-darkGold">Course</p>
          <h2 className="mt-2 font-serifTC text-3xl font-semibold text-deepPurple">紫微斗數線上課程 即將開課</h2>
          <p className="mt-4 max-w-xl leading-8 text-textMuted">
            適合完全不懂紫微斗數的人，想學會自己看命盤的人。
          </p>
          <button className="focus-ring mt-7 rounded-lg bg-deepPurple px-6 py-3 font-semibold text-white" onClick={handleJoin}>
            加入課程候補名單
          </button>
          {joined && <p className="mt-3 font-semibold text-darkGold">已加入候補名單，會員中心會顯示課程狀態。</p>}
        </div>
        <div className="grid content-center gap-3">
          {['初階命盤', '十四主星', '十二宮位', '流年大限'].map((item) => (
            <div key={item} className="rounded-xl border border-borderSoft bg-softPurple px-4 py-3 font-semibold text-deepPurple">
              {item}
            </div>
          ))}
        </div>
      </div>
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} onSuccess={handleJoin} />
    </section>
  )
}
