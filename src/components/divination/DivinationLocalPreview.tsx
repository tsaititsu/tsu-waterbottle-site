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
    <>
      <section className="grid gap-4">
        <div>
          <p className="text-sm font-semibold tracking-[0.18em] text-darkGold">本機開發預覽</p>
          <p className="mt-2 leading-7 text-textMuted">
            以下為正式網站內建占卜流程預覽，尚未連接付款、抽牌與 AI 解讀。
          </p>
        </div>
        <DivinationQuestionForm onQuestionSubmit={handleQuestionSubmit} />
      </section>
      <section className="grid gap-4">
        <div>
          <p className="text-sm font-semibold tracking-[0.18em] text-darkGold">抽牌流程預覽</p>
          <p className="mt-2 leading-7 text-textMuted">
            以下為正式網站內建抽牌流程預覽，尚未連接付款、牌義與 AI 解讀。
          </p>
        </div>
        <DivinationDrawPreview question={question} drawMode={drawMode} />
      </section>
    </>
  )
}
