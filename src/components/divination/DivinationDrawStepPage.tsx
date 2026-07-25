"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { DivinationDrawPreview } from "./DivinationDrawPreview"
import {
  getDivinationReadingSession,
  type InMemoryDivinationReadingSession,
} from "@/lib/divination/readingSessionMemory"

export function DivinationDrawStepPage() {
  const [readingSession, setReadingSession] = useState<InMemoryDivinationReadingSession | null>(null)
  const [hasLoadedSession, setHasLoadedSession] = useState(false)

  useEffect(() => {
    setReadingSession(getDivinationReadingSession())
    setHasLoadedSession(true)
  }, [])

  if (!hasLoadedSession) {
    return (
      <section className="rounded-2xl border border-borderSoft bg-white p-6 text-textMuted shadow-soft">
        正在讀取占卜資料...
      </section>
    )
  }

  if (!readingSession) {
    return (
      <section className="rounded-2xl border border-borderSoft bg-white p-6 shadow-soft">
        <p className="font-serifTC text-2xl font-semibold text-deepPurple">尚未建立占卜問題</p>
        <p className="mt-3 leading-7 text-textMuted">
          請先回到第一步填寫問題並選擇抽牌方式，再進入抽牌頁。
        </p>
        <Link
          className="mt-5 inline-flex rounded-xl bg-deepPurple px-5 py-3 text-sm font-semibold text-white transition hover:bg-purpleMain"
          href="/ai-divination"
        >
          回到第一步
        </Link>
      </section>
    )
  }

  return (
    <section className="grid gap-4">
      <div>
        <p className="text-sm font-semibold tracking-[0.18em] text-darkGold">第二步</p>
        <p className="mt-2 leading-7 text-textMuted">
          依照你選擇的方式抽出一張紫微牌卡，先查看牌卡基礎牌義。
        </p>
      </div>
      <DivinationDrawPreview readingSession={readingSession} autoMockPaid={readingSession.autoMockPaid === true} />
    </section>
  )
}
