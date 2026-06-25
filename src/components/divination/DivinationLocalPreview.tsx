"use client"

import { useState } from "react"
import { DivinationDrawPreview } from "./DivinationDrawPreview"
import { DivinationQuestionForm } from "./DivinationQuestionForm"

type DrawMode = "manual" | "auto"

type QuestionSubmitPayload = {
  question: string
  mode: DrawMode
}

export function DivinationLocalPreview() {
  const [question, setQuestion] = useState("")
  const [drawMode, setDrawMode] = useState<DrawMode | null>(null)

  function handleQuestionSubmit(payload: QuestionSubmitPayload) {
    setQuestion(payload.question)
    setDrawMode(payload.mode)
  }

  return (
    <section className="grid gap-6">
      <div>
        <p className="text-sm font-semibold tracking-[0.18em] text-darkGold">紫微牌卡占卜流程體驗</p>
        <h2 className="mt-2 font-serifTC text-3xl font-semibold text-textDark">開始你的紫微牌卡占卜</h2>
        <p className="mt-3 max-w-3xl leading-7 text-textMuted">
          請先寫下你想詢問的問題，再選擇手動抽牌或自動抽牌。目前先提供牌卡基礎牌義預覽，正式 AI 深度解讀將於後續開放。
        </p>
      </div>
      <section className="grid gap-4">
        <div>
          <p className="text-sm font-semibold tracking-[0.18em] text-darkGold">第一步</p>
          <p className="mt-2 leading-7 text-textMuted">
            填寫一個清楚的問題，選擇你想要的抽牌方式。
          </p>
        </div>
        <DivinationQuestionForm onQuestionSubmit={handleQuestionSubmit} />
      </section>
      <section className="grid gap-4">
        <div>
          <p className="text-sm font-semibold tracking-[0.18em] text-darkGold">第二步</p>
          <p className="mt-2 leading-7 text-textMuted">
            依照你選擇的方式抽出一張紫微牌卡，先查看牌卡基礎牌義。
          </p>
        </div>
        <DivinationDrawPreview question={question} drawMode={drawMode} />
      </section>
    </section>
  )
}
