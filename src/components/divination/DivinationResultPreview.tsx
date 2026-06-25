"use client"

import type { ZiweiCard } from "@/lib/divination/cards"
import Image from "next/image"

type DrawMode = "manual" | "auto"
type PreviewPosition = "upright" | "reversed"

type DivinationResultPreviewProps = {
  question: string
  drawMode: DrawMode | null
  card: ZiweiCard
  position: PreviewPosition
}

const drawModeLabels: Record<DrawMode, string> = {
  manual: "手動抽牌",
  auto: "自動抽牌",
}

const positionLabels: Record<PreviewPosition, string> = {
  upright: "正位",
  reversed: "反位",
}

export function DivinationResultPreview({
  question,
  drawMode,
  card,
  position,
}: DivinationResultPreviewProps) {
  const cardImage = position === "reversed" ? card.reversedImage : card.image
  const meaning = position === "reversed" ? card.reversedMeaning : card.uprightMeaning
  const advice = position === "reversed" ? card.advice.reversed : card.advice.upright

  return (
    <section className="w-full rounded-[2rem] border border-[#8c6a2d] bg-[#080706] p-5 text-[#f4d77d] shadow-[0_18px_48px_rgba(0,0,0,0.32)] md:p-6">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,220px)_1fr]">
        <div className="grid justify-items-center gap-3">
          <p className="text-sm font-semibold tracking-[0.2em] text-[#b7964b]">牌義解讀預覽</p>
          <Image
            src={cardImage}
            alt={card.name}
            width={360}
            height={560}
            className="w-full max-w-[180px] rounded-2xl border border-[#f1cf72] object-cover shadow-[0_18px_36px_rgba(0,0,0,0.36)]"
          />
          <p className="rounded-full border border-[#0b8f74] px-4 py-2 text-sm text-[#bff9df]">
            此區先提供牌卡基礎牌義，尚未接入正式 AI 深度解讀。
          </p>
        </div>

        <div className="grid gap-4">
          <div className="grid gap-2 rounded-2xl border border-[#0b8f74]/70 bg-[#02120e] p-4 leading-7 text-[#bff9df]">
            <p>本次問題：{question}</p>
            <p>抽牌方式：{drawMode ? drawModeLabels[drawMode] : "尚未選擇"}</p>
            <p>抽到牌卡：{card.name}</p>
            <p>正反位：{positionLabels[position]}</p>
          </div>

          <div className="grid gap-2 rounded-2xl border border-[#8c6a2d]/70 bg-[#120f09] p-4 leading-7">
            <p>化氣：{card.huaqi}</p>
            <p>五行：{card.element}</p>
            <div>
              <p className="font-semibold text-[#f6df9d]">核心</p>
              <p className="mt-1 text-[#d9c68e]">{card.core}</p>
            </div>
          </div>

          <div className="grid gap-2 rounded-2xl border border-[#8c6a2d]/70 bg-[#120f09] p-4 leading-7">
            <p className="font-semibold text-[#f6df9d]">牌義</p>
            <p className="text-[#d9c68e]">{meaning}</p>
          </div>

          <div className="grid gap-2 rounded-2xl border border-[#8c6a2d]/70 bg-[#120f09] p-4 leading-7">
            <p className="font-semibold text-[#f6df9d]">建議</p>
            <p className="text-[#d9c68e]">{advice}</p>
          </div>
        </div>
      </div>
    </section>
  )
}
