"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { DivinationQuestionForm } from "./DivinationQuestionForm"
import type {
  CreateDivinationReadingResponse,
  DivinationDrawMode,
  DivinationInterpretation,
  DivinationReadingSession,
} from "@/lib/divination/types"

type DrawMode = DivinationDrawMode

type QuestionSubmitPayload = {
  question: string
  mode: DrawMode
  mockPaid?: boolean
}

const localUserStorageKey = "divination_local_user_id"
const readingSessionStorageKey = "divination_reading_session"

type DivinationLocalPreviewProps = {
  resetKey?: string
}

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

function saveReadingSession(session: DivinationReadingSession, options?: { autoMockPaid?: boolean }) {
  if (typeof window === "undefined") return
  window.sessionStorage.setItem(
    readingSessionStorageKey,
    JSON.stringify({
      ...session,
      autoMockPaid: options?.autoMockPaid === true,
    })
  )
}

function clearReadingSession() {
  if (typeof window === "undefined") return
  window.sessionStorage.removeItem(readingSessionStorageKey)
}

export function DivinationLocalPreview({ resetKey = "" }: DivinationLocalPreviewProps) {
  const router = useRouter()
  const [isCreatingReading, setIsCreatingReading] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [safetyInterpretation, setSafetyInterpretation] = useState<DivinationInterpretation | null>(null)
  const resetVersionRef = useRef(0)

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

    if ("safetyBlocked" in data && data.safetyBlocked) {
      return {
        safetyBlocked: true as const,
        interpretation: data.interpretation,
      }
    }

    if ("reading" in data) {
      return {
        readingId: data.reading.id,
        question: input.question,
        drawMode: input.drawMode,
        localUserId,
      } satisfies DivinationReadingSession
    }

    throw new Error("建立占卜紀錄失敗，請稍後再試。")
  }

  async function handleQuestionSubmit(payload: QuestionSubmitPayload) {
    const requestResetVersion = resetVersionRef.current
    setIsCreatingReading(true)
    setErrorMessage("")
    setSafetyInterpretation(null)

    try {
      const session = await createReadingSession({
        question: payload.question,
        drawMode: payload.mode,
      })

      if (session) {
        if (requestResetVersion === resetVersionRef.current) {
          if ("safetyBlocked" in session && session.safetyBlocked) {
            clearReadingSession()
            setSafetyInterpretation(session.interpretation)
            return
          }

          saveReadingSession(session, { autoMockPaid: payload.mode === "auto" && payload.mockPaid === true })
          router.push("/ai-divination/draw")
        }
      }
    } catch (error) {
      if (requestResetVersion === resetVersionRef.current) {
        setErrorMessage(
          error instanceof Error ? error.message : "建立占卜紀錄失敗，請稍後再試。"
        )
      }
    } finally {
      if (requestResetVersion === resetVersionRef.current) {
        setIsCreatingReading(false)
      }
    }
  }

  useEffect(() => {
    resetVersionRef.current += 1
    setIsCreatingReading(false)
    setErrorMessage("")
    setSafetyInterpretation(null)
    clearReadingSession()
  }, [resetKey])

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
        <DivinationQuestionForm key={resetKey || "initial"} onQuestionSubmit={handleQuestionSubmit} />
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
        {safetyInterpretation ? (
          <article className="rounded-2xl border border-red-100 bg-white p-5 shadow-soft">
            <p className="text-sm font-semibold tracking-[0.18em] text-darkGold">安全提醒</p>
            <h3 className="mt-2 font-serifTC text-2xl font-semibold text-deepPurple">
              這題先不進行抽牌
            </h3>
            <div className="mt-4 whitespace-pre-line leading-8 text-textMuted">
              {safetyInterpretation.finalAnswer || safetyInterpretation.summary}
            </div>
          </article>
        ) : null}
      </section>
    </section>
  )
}
