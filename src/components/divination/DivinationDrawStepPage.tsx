"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { DivinationDrawPreview } from "./DivinationDrawPreview"
import type {
  DivinationFollowUpContext,
  DivinationPosition,
  DivinationReadingSession,
} from "@/lib/divination/types"

const readingSessionStorageKey = "divination_reading_session"

type StoredReadingSession = DivinationReadingSession & {
  autoMockPaid?: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function parseFollowUpContext(value: unknown): DivinationFollowUpContext | undefined {
  if (!isRecord(value)) return undefined
  if (value.isFollowUp !== true) return undefined
  if (typeof value.threadId !== "string" || typeof value.parentReadingId !== "string") return undefined
  if (!Array.isArray(value.previousReadings) || value.previousReadings.length === 0) return undefined

  const previousReadings = value.previousReadings
    .filter(isRecord)
    .map((reading) => ({
      readingId: typeof reading.readingId === "string" ? reading.readingId : "",
      question: typeof reading.question === "string" ? reading.question : "",
      cardId: typeof reading.cardId === "string" ? reading.cardId : undefined,
      cardName: typeof reading.cardName === "string" ? reading.cardName : undefined,
      position:
        reading.position === "upright" || reading.position === "reversed"
          ? (reading.position as DivinationPosition)
          : undefined,
      answerSummary: typeof reading.answerSummary === "string" ? reading.answerSummary : "",
      finalAnswer: typeof reading.finalAnswer === "string" ? reading.finalAnswer : undefined,
      questionType: typeof reading.questionType === "string" ? reading.questionType : undefined,
      questionSubcategory:
        typeof reading.questionSubcategory === "string" ? reading.questionSubcategory : undefined,
      createdAt: typeof reading.createdAt === "string" ? reading.createdAt : undefined,
    }))
    .filter((reading) => reading.readingId && reading.question && reading.answerSummary)

  if (previousReadings.length === 0) return undefined

  return {
    isFollowUp: true,
    threadId: value.threadId,
    parentReadingId: value.parentReadingId,
    previousReadings,
  }
}

function parseReadingSession(value: string | null): StoredReadingSession | null {
  if (!value) return null

  try {
    const parsed = JSON.parse(value) as Partial<StoredReadingSession>

    if (
      typeof parsed.readingId !== "string" ||
      typeof parsed.question !== "string" ||
      (parsed.drawMode !== "manual" && parsed.drawMode !== "auto") ||
      typeof parsed.localUserId !== "string"
    ) {
      return null
    }

    return {
      readingId: parsed.readingId,
      question: parsed.question,
      drawMode: parsed.drawMode,
      localUserId: parsed.localUserId,
      persisted: parsed.persisted === true,
      cardId: typeof parsed.cardId === "string" ? parsed.cardId : null,
      position:
        parsed.position === "upright" || parsed.position === "reversed"
          ? (parsed.position as DivinationPosition)
          : null,
      merchantOrderNo: typeof parsed.merchantOrderNo === "string" ? parsed.merchantOrderNo : null,
      entitlement: parsed.entitlement,
      mockPaymentGate: parsed.mockPaymentGate,
      followUpContext: parseFollowUpContext(parsed.followUpContext),
      autoMockPaid: parsed.autoMockPaid === true,
    }
  } catch {
    return null
  }
}

export function DivinationDrawStepPage() {
  const [readingSession, setReadingSession] = useState<StoredReadingSession | null>(null)
  const [hasLoadedSession, setHasLoadedSession] = useState(false)

  useEffect(() => {
    setReadingSession(parseReadingSession(window.sessionStorage.getItem(readingSessionStorageKey)))
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
