"use client"

import type { ZiweiCard } from "@/lib/divination/cards"
import type {
  DivinationDrawMode,
  DivinationFollowUpDisplayThread,
  DivinationInterpretation,
  DivinationMockPaymentGate,
  DivinationPosition,
} from "@/lib/divination/types"
import Image from "next/image"

type DivinationResultPreviewProps = {
  question: string
  drawMode: DivinationDrawMode | null
  card: ZiweiCard
  position: DivinationPosition
  readingId?: string
  paymentGate?: DivinationMockPaymentGate
  interpretation?: DivinationInterpretation
  followUpThread?: DivinationFollowUpDisplayThread | null
}

const drawModeLabels: Record<DivinationDrawMode, string> = {
  manual: "手動抽牌",
  auto: "自動抽牌",
}

const positionLabels: Record<DivinationPosition, string> = {
  upright: "正位",
  reversed: "反位",
}

export function DivinationResultPreview({
  question,
  drawMode,
  card,
  position,
  readingId,
  interpretation,
  followUpThread,
}: DivinationResultPreviewProps) {
  const cardImage = position === "reversed" ? card.reversedImage : card.image
  const meaning = position === "reversed" ? card.reversedMeaning : card.uprightMeaning
  const advice = position === "reversed" ? card.advice.reversed : card.advice.upright
  const finalAnswer = interpretation?.finalAnswer?.trim()
  const followUpReadings = followUpThread?.readings ?? []
  const shouldShowFollowUpHistory = followUpReadings.length >= 2

  return (
    <section className="w-full rounded-[2rem] border border-purple-100 bg-[#faf7ff] p-5 text-slate-700 shadow-[0_18px_48px_rgba(88,55,132,0.12)] md:p-6">
      <div className="rounded-[1.5rem] border border-purple-100 bg-white p-5 md:p-6">
        <div className="grid justify-items-center gap-4 text-center">
          <p className="text-sm font-semibold tracking-[0.2em] text-[#b7964b]">DIVINATION RESULT</p>
          <h3 className="font-serifTC text-2xl font-semibold text-[#4b2d73] md:text-3xl">
            紫微牌卡解讀
          </h3>
          <Image
            src={cardImage}
            alt={card.name}
            width={360}
            height={560}
            className="w-full max-w-[220px] rounded-2xl border border-[#d8b15f]/60 object-cover shadow-[0_18px_36px_rgba(88,55,132,0.16)]"
          />
        </div>

        <div className="mt-6 grid gap-4">
          <div className="grid gap-4 rounded-2xl border border-purple-100 bg-purple-50/70 p-4 leading-7 md:grid-cols-[1.2fr_0.8fr]">
            <div>
              <p className="text-sm font-semibold text-[#7b5a2b]">本次問題</p>
              <p className="mt-1 text-[#3f3450]">{question}</p>
            </div>
            <div className="grid gap-3">
              <div>
                <p className="text-sm font-semibold text-[#7b5a2b]">抽到的牌</p>
                <p className="mt-1 font-semibold text-[#4b2d73]">
                  {card.name}｜{positionLabels[position]}
                </p>
              </div>
              {drawMode ? (
                <p className="text-sm text-slate-500">抽牌方式：{drawModeLabels[drawMode]}</p>
              ) : null}
            </div>
          </div>

          {finalAnswer ? (
            <div className="grid gap-3 rounded-2xl border border-purple-100 bg-white p-5 leading-8 shadow-[0_10px_28px_rgba(88,55,132,0.08)]">
              <p className="font-semibold text-[#4b2d73]">完整解讀</p>
              <div className="grid gap-4 whitespace-pre-line text-[#3f3450]">{finalAnswer}</div>
            </div>
          ) : interpretation ? (
            <div className="grid gap-3">
              <div className="grid gap-2 rounded-2xl border border-purple-100 bg-white p-4 leading-7 shadow-[0_10px_28px_rgba(88,55,132,0.08)]">
                <p className="font-semibold text-[#4b2d73]">牌卡解讀</p>
                <p>{interpretation.summary}</p>
              </div>

              <div className="grid gap-2 rounded-2xl border border-purple-100 bg-white p-4 leading-7 shadow-[0_10px_28px_rgba(88,55,132,0.08)]">
                <p className="font-semibold text-[#4b2d73]">牌卡訊息</p>
                <p>{interpretation.cardMessage}</p>
              </div>

              <div className="grid gap-2 rounded-2xl border border-purple-100 bg-white p-4 leading-7 shadow-[0_10px_28px_rgba(88,55,132,0.08)]">
                <p className="font-semibold text-[#4b2d73]">目前狀態</p>
                <p>{interpretation.situationAnalysis}</p>
              </div>

              <div className="grid gap-2 rounded-2xl border border-purple-100 bg-white p-4 leading-7 shadow-[0_10px_28px_rgba(88,55,132,0.08)]">
                <p className="font-semibold text-[#4b2d73]">使用建議</p>
                <p>{interpretation.advice}</p>
              </div>

              <div className="grid gap-2 rounded-2xl border border-[#d8b15f]/50 bg-[#fff9eb] p-4 leading-7 text-[#67513a]">
                <p className="font-semibold text-[#7b5a2b]">溫和提醒</p>
                <p>{interpretation.reminder}</p>
              </div>
            </div>
          ) : (
            <div className="grid gap-3">
              <div className="grid gap-3 rounded-2xl border border-purple-100 bg-white p-4 leading-7 shadow-[0_10px_28px_rgba(88,55,132,0.08)]">
                <p className="font-semibold text-[#4b2d73]">牌卡基礎訊息</p>
                <div className="grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                  <p>化氣：{card.huaqi}</p>
                  <p>五行：{card.element}</p>
                </div>
                <div>
                  <p className="font-semibold text-[#7b5a2b]">核心</p>
                  <p className="mt-1">{card.core}</p>
                </div>
              </div>

              <div className="grid gap-2 rounded-2xl border border-purple-100 bg-white p-4 leading-7 shadow-[0_10px_28px_rgba(88,55,132,0.08)]">
                <p className="font-semibold text-[#4b2d73]">{positionLabels[position]}牌義</p>
                <p>{meaning}</p>
              </div>

              <div className="grid gap-2 rounded-2xl border border-[#d8b15f]/50 bg-[#fff9eb] p-4 leading-7 text-[#67513a]">
                <p className="font-semibold text-[#7b5a2b]">使用建議</p>
                <p>{advice}</p>
              </div>
            </div>
          )}

          {shouldShowFollowUpHistory ? (
            <details className="group rounded-2xl border border-purple-100 bg-purple-50/70 p-4 leading-7">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-base font-semibold text-[#4b2d73]">
                <span>查看本串追問紀錄</span>
                <span className="text-sm font-medium text-[#7b5a2b] group-open:hidden">展開</span>
                <span className="hidden text-sm font-medium text-[#7b5a2b] group-open:inline">收合</span>
              </summary>

              <div className="mt-4 grid gap-4">
                {followUpReadings.map((reading, index) => {
                  const isCurrentReading = Boolean(readingId && reading.readingId === readingId)
                  const readingPosition = reading.position ? positionLabels[reading.position] : "未記錄"
                  const readingCard = reading.cardName || reading.cardId || "未記錄"

                  return (
                    <article
                      key={reading.readingId || `${reading.question}-${index}`}
                      className="grid gap-3 rounded-2xl border border-purple-100 bg-white p-4 text-[#3f3450] shadow-[0_10px_28px_rgba(88,55,132,0.06)]"
                    >
                      <p className="font-semibold text-[#4b2d73]">
                        第 {index + 1} 題{isCurrentReading ? "（目前這題）" : ""}
                      </p>

                      <div className="grid gap-2">
                        <p className="text-sm font-semibold text-[#7b5a2b]">問題：</p>
                        <p>「{reading.question}」</p>
                      </div>

                      <div className="grid gap-2">
                        <p className="text-sm font-semibold text-[#7b5a2b]">抽到：</p>
                        <p>
                          {readingCard}｜{readingPosition}
                        </p>
                      </div>

                      <div className="grid gap-2">
                        <p className="text-sm font-semibold text-[#7b5a2b]">解答：</p>
                        <div className="whitespace-pre-line">{reading.finalAnswer}</div>
                      </div>
                    </article>
                  )
                })}
              </div>
            </details>
          ) : null}
        </div>
      </div>
    </section>
  )
}
