"use client"

import { useState } from "react"
import { DivinationDrawPreview } from "./DivinationDrawPreview"
import { DivinationQuestionForm } from "./DivinationQuestionForm"
import type {
  CreateDivinationReadingResponse,
  DivinationDrawMode,
  DivinationReadingSession,
} from "@/lib/divination/types"

type DrawMode = DivinationDrawMode

type QuestionSubmitPayload = {
  question: string
  mode: DrawMode
}

const localUserStorageKey = "divination_local_user_id"

function createLocalUserId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }

  return `local-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function getLocalUserId() {
  if (typeof window === "undefined") return "local-dev-user"

  const existingLocalUserId = window.localStorage.getItem(localUserStorageKey)

  if (existingLocalUserId) return existingLocalUserId

  const localUserId = createLocalUserId()
  window.localStorage.setItem(localUserStorageKey, localUserId)

  return localUserId
}

export function DivinationLocalPreview() {
  const [readingSession, setReadingSession] = useState<DivinationReadingSession | null>(null)
  const [isCreatingReading, setIsCreatingReading] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

  async function createReadingSession(input: {
    question: string
    drawMode: DrawMode
  }) {
    const localUserId = getLocalUserId()
    const response = await fetch("/api/divination/readings/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: input.question,
        drawMode: input.drawMode,
        localUserId,
      }),
    })
    const data = (await response.json()) as CreateDivinationReadingResponse

    if (!response.ok || !data.ok) {
      throw new Error(
        data.ok === false ? data.message || data.error : "建立占卜紀錄失敗，請稍後再試。"
      )
    }

    return {
      readingId: data.reading.id,
      question: input.question,
      drawMode: input.drawMode,
      localUserId,
    } satisfies DivinationReadingSession
  }

  async function handleQuestionSubmit(payload: QuestionSubmitPayload) {
    setIsCreatingReading(true)
    setErrorMessage("")
    setReadingSession(null)

    try {
      const session = await createReadingSession({
        question: payload.question,
        drawMode: payload.mode,
      })

      if (session) {
        setReadingSession(session)
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "建立占卜紀錄失敗，請稍後再試。"
      )
    } finally {
      setIsCreatingReading(false)
    }
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
        {isCreatingReading ? (
          <p className="rounded-xl border border-purple-100 bg-purple-50 px-4 py-3 text-sm leading-7 text-textMuted">
            正在建立占卜紀錄，請稍候...
          </p>
        ) : null}
        {errorMessage ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-7 text-red-700">
            {errorMessage}
          </p>
        ) : null}
      </section>
      {readingSession ? (
        <section className="grid gap-4">
          <div>
            <p className="text-sm font-semibold tracking-[0.18em] text-darkGold">第二步</p>
            <p className="mt-2 leading-7 text-textMuted">
              依照你選擇的方式抽出一張紫微牌卡，先查看牌卡基礎牌義。
            </p>
          </div>
          <DivinationDrawPreview readingSession={readingSession} />
        </section>
      ) : null}
    </section>
  )
}
