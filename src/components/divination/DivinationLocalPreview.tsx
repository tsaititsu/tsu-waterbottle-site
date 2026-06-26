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

type PaymentRequiredState = {
  question: string
  drawMode: DrawMode
  message: string
  amountTwd: number
}

const localUserStorageKey = "divination_local_user_id"
const seedCardId = "ziwei"
const seedPosition = "upright"

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
  const [paymentRequired, setPaymentRequired] = useState<PaymentRequiredState | null>(null)
  const [isCreatingReading, setIsCreatingReading] = useState(false)
  const [isMockPaying, setIsMockPaying] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

  async function createReadingSession(input: {
    question: string
    drawMode: DrawMode
    mockPaid?: boolean
  }) {
    const localUserId = getLocalUserId()
    const response = await fetch("/api/divination/readings/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: input.question,
        drawMode: input.drawMode,
        cardId: seedCardId,
        position: seedPosition,
        localUserId,
        mockPaid: input.mockPaid === true,
      }),
    })
    const data = (await response.json()) as CreateDivinationReadingResponse

    if (!response.ok || !data.ok) {
      if (
        response.status === 402 &&
        data.ok === false &&
        data.error === "DAILY_FREE_USED" &&
        data.requiresPayment
      ) {
        setPaymentRequired({
          question: input.question,
          drawMode: input.drawMode,
          message: data.message || "今日免費占卜已使用，請使用 NT$50 單次占卜。",
          amountTwd: data.amountTwd ?? 50,
        })
        return null
      }

      throw new Error(
        data.ok === false ? data.message || data.error : "建立占卜紀錄失敗，請稍後再試。"
      )
    }

    return {
      readingId: data.reading.id,
      question: input.question,
      drawMode: input.drawMode,
      localUserId,
      entitlement: data.entitlement,
      mockPaymentGate: data.mockPaymentGate,
    } satisfies DivinationReadingSession
  }

  async function handleQuestionSubmit(payload: QuestionSubmitPayload) {
    setIsCreatingReading(true)
    setErrorMessage("")
    setPaymentRequired(null)
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

  async function handleMockPaidStart() {
    if (!paymentRequired) return

    setIsMockPaying(true)
    setErrorMessage("")

    try {
      const session = await createReadingSession({
        question: paymentRequired.question,
        drawMode: paymentRequired.drawMode,
        mockPaid: true,
      })

      if (session) {
        setPaymentRequired(null)
        setReadingSession(session)
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "建立 NT$50 單次占卜失敗，請稍後再試。"
      )
    } finally {
      setIsMockPaying(false)
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
        {paymentRequired ? (
          <div className="rounded-2xl border border-purple-100 bg-softPurple p-5 shadow-soft">
            <div className="rounded-2xl border border-borderSoft bg-white p-5">
              <p className="text-sm font-semibold tracking-[0.18em] text-darkGold">
                Payment Required
              </p>
              <h3 className="mt-2 text-xl font-semibold text-deepPurple">
                今日免費占卜已使用
              </h3>
              <p className="mt-3 leading-7 text-textMuted">
                本次占卜需 NT${paymentRequired.amountTwd}。這裡先使用本機 mock paid
                測試流程，不會接正式金流。
              </p>
              <button
                type="button"
                onClick={handleMockPaidStart}
                disabled={isMockPaying}
                className="mt-5 rounded-full bg-deepPurple px-6 py-3 text-sm font-semibold text-white transition hover:bg-purpleMain disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isMockPaying
                  ? "建立 NT$50 單次占卜中..."
                  : `使用 NT$${paymentRequired.amountTwd} 單次占卜（本機測試）`}
              </button>
            </div>
          </div>
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
