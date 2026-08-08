"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { DivinationQuestionForm } from "./DivinationQuestionForm"
import { DivinationQuestionAdvisoryDialog } from "./DivinationQuestionAdvisoryDialog"
import { DivinationQuestionContextPanel } from "./DivinationQuestionContextPanel"
import { getAuthAccessToken } from "@/lib/mockAuth"
import { DIVINATION_READING_PRICE_LABEL } from "@/lib/divination/pricing"
import {
  clearDivinationFollowUpDraft,
  clearDivinationFollowUpDisplayThread,
  loadDivinationFollowUpDisplayThread,
  loadDivinationFollowUpDraft,
  toDivinationFollowUpContext,
} from "@/lib/divination/followUpStorage"
import {
  clearDivinationReadingSession,
  getOrCreateDivinationLocalUserId,
  setDivinationReadingSession,
} from "@/lib/divination/readingSessionMemory"
import type {
  CreateDivinationReadingResponse,
  DivinationDrawMode,
  DivinationFollowUpDraft,
  DivinationFollowUpDisplayThread,
  DivinationInterpretation,
  DivinationQuestionAdvisoryNotice,
  DivinationReadingSession,
} from "@/lib/divination/types"

type DrawMode = DivinationDrawMode

type QuestionSubmitPayload = {
  question: string
  mode: DrawMode
}

type DivinationLocalPreviewProps = {
  resetKey?: string
  followUpKey?: string
}

function getLocalUserId() {
  return getOrCreateDivinationLocalUserId()
}

function saveReadingSession(session: DivinationReadingSession) {
  setDivinationReadingSession(session)
}

function clearReadingSession() {
  clearDivinationReadingSession()
}

export function DivinationLocalPreview({ resetKey = "", followUpKey = "" }: DivinationLocalPreviewProps) {
  const router = useRouter()
  const [isCreatingReading, setIsCreatingReading] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [safetyInterpretation, setSafetyInterpretation] = useState<DivinationInterpretation | null>(null)
  const [questionAdvisory, setQuestionAdvisory] = useState<DivinationQuestionAdvisoryNotice | null>(null)
  const [pendingQuestionSubmission, setPendingQuestionSubmission] = useState<QuestionSubmitPayload | null>(null)
  const [followUpDraft, setFollowUpDraft] = useState<DivinationFollowUpDraft | null>(null)
  const [followUpDisplayThread, setFollowUpDisplayThread] = useState<DivinationFollowUpDisplayThread | null>(null)
  const resetVersionRef = useRef(0)
  const createReadingInFlightRef = useRef(false)

  async function createReadingSession(input: {
    question: string
    drawMode: DrawMode
    followUpContext?: unknown
    proceedDespiteQuestionAdvisory?: boolean
  }) {
    const localUserId = getLocalUserId()
    // 已登入時帶上 token，讓後端把占卜紀錄歸戶到會員；未登入維持匿名流程。
    const accessToken = await getAuthAccessToken()
    const response = await fetch("/api/divination/readings/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({
        question: input.question,
        drawMode: input.drawMode,
        localUserId,
        // 追問時把前文一併送到後端，讓安全判斷在建立紀錄（付款之前）就使用完整脈絡。
        followUpContext: input.followUpContext,
        proceedDespiteQuestionAdvisory: input.proceedDespiteQuestionAdvisory,
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

    if ("questionAdvisory" in data) {
      return {
        questionAdvisory: data.questionAdvisory,
      }
    }

    if ("reading" in data) {
      return {
        readingId: data.reading.id,
        question: input.question,
        drawMode: input.drawMode,
        localUserId,
        persisted: data.persisted === true,
        questionAdvisoryAcknowledgedReasons: data.questionAdvisoryAcknowledgedReasons,
      } satisfies DivinationReadingSession
    }

    throw new Error("建立占卜紀錄失敗，請稍後再試。")
  }

  async function handleQuestionSubmit(
    payload: QuestionSubmitPayload,
    options: { proceedDespiteQuestionAdvisory?: boolean } = {},
  ) {
    if (createReadingInFlightRef.current) {
      return
    }
    createReadingInFlightRef.current = true
    const requestResetVersion = resetVersionRef.current
    setIsCreatingReading(true)
    setErrorMessage("")
    setSafetyInterpretation(null)
    setQuestionAdvisory(null)

    try {
      const followUpContext = followUpKey
        ? toDivinationFollowUpContext(loadDivinationFollowUpDraft())
        : undefined
      const session = await createReadingSession({
        question: payload.question,
        drawMode: payload.mode,
        followUpContext,
        proceedDespiteQuestionAdvisory: options.proceedDespiteQuestionAdvisory,
      })

      if (session) {
        if (requestResetVersion === resetVersionRef.current) {
          if ("questionAdvisory" in session && session.questionAdvisory) {
            clearReadingSession()
            setPendingQuestionSubmission(payload)
            setQuestionAdvisory(session.questionAdvisory)
            return
          }

          if ("safetyBlocked" in session && session.safetyBlocked) {
            clearReadingSession()
            setSafetyInterpretation(session.interpretation)
            return
          }

          const readingSession = followUpContext ? { ...session, followUpContext } : session

          saveReadingSession(readingSession)
          setPendingQuestionSubmission(null)
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
        createReadingInFlightRef.current = false
        setIsCreatingReading(false)
      }
    }
  }

  function handleModifyQuestion() {
    setQuestionAdvisory(null)
    setPendingQuestionSubmission(null)
    requestAnimationFrame(() => {
      document.getElementById("divination-question-preview")?.focus()
    })
  }

  function handleContinueDespiteQuestionAdvisory() {
    if (!pendingQuestionSubmission) return

    void handleQuestionSubmit(pendingQuestionSubmission, {
      proceedDespiteQuestionAdvisory: true,
    })
  }

  useEffect(() => {
    resetVersionRef.current += 1
    createReadingInFlightRef.current = false
    setIsCreatingReading(false)
    setErrorMessage("")
    setSafetyInterpretation(null)
    setQuestionAdvisory(null)
    setPendingQuestionSubmission(null)
    setFollowUpDraft(null)
    setFollowUpDisplayThread(null)
    clearReadingSession()
    if (resetKey) {
      clearDivinationFollowUpDraft()
      clearDivinationFollowUpDisplayThread()
    }
  }, [resetKey])

  useEffect(() => {
    return () => {
      resetVersionRef.current += 1
      createReadingInFlightRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!followUpKey) {
      setFollowUpDraft(null)
      setFollowUpDisplayThread(null)
      return
    }

    const draft = loadDivinationFollowUpDraft()
    setFollowUpDraft(draft)
    setFollowUpDisplayThread(loadDivinationFollowUpDisplayThread(draft?.threadId))
  }, [followUpKey])

  const latestFollowUpReading = followUpDraft?.previousReadings.at(-1)
  const latestDisplayReading = followUpDisplayThread?.readings.at(-1)

  return (
    <section className="grid gap-6">
      <div>
        <p className="text-sm font-semibold tracking-[0.18em] text-darkGold">紫微牌卡占卜</p>
        <h2 className="mt-2 font-serifTC text-3xl font-semibold text-textDark">開始你的紫微牌卡占卜</h2>
        <p className="mt-3 max-w-3xl leading-7 text-textMuted">
          請先寫下你想詢問的問題，再選擇手動抽牌或自動抽牌。抽牌本身不收費，開始 AI 解讀時每次 {DIVINATION_READING_PRICE_LABEL}。
        </p>
        <p className="mt-2 text-sm text-textMuted">私人問題只保留在目前分頁記憶體；重新整理或切換帳號後需重新輸入。</p>
      </div>
      <section className="grid gap-4">
        <DivinationQuestionContextPanel
          isFollowUp={Boolean(followUpKey)}
          followUpReading={latestFollowUpReading}
          displayReading={latestDisplayReading}
        />
        <DivinationQuestionForm
          key={resetKey || "initial"}
          disabled={isCreatingReading}
          onQuestionSubmit={handleQuestionSubmit}
        />
        {isCreatingReading ? (
          <p aria-live="polite" className="rounded-xl border border-purple-100 bg-purple-50 px-4 py-3 text-sm leading-7 text-textMuted">
            正在建立占卜紀錄，請稍候...
          </p>
        ) : null}
        {errorMessage ? (
          <p aria-live="polite" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-7 text-red-700">
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
      {questionAdvisory ? (
        <DivinationQuestionAdvisoryDialog
          advisory={questionAdvisory}
          disabled={isCreatingReading}
          onModify={handleModifyQuestion}
          onContinue={handleContinueDespiteQuestionAdvisory}
        />
      ) : null}
    </section>
  )
}
