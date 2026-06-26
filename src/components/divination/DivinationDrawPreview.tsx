"use client"

import { DivinationResultPreview } from "@/components/divination/DivinationResultPreview"
import { ziweiCards, type ZiweiCard } from "@/lib/divination/cards"
import type {
  CreateDivinationReadingResponse,
  DivinationDrawMode,
  DivinationInterpretResponse,
  DivinationInterpretation,
  DivinationMockPaymentGate,
  DivinationPosition,
} from "@/lib/divination/types"
import Image from "next/image"
import { useEffect, useRef, useState } from "react"

type DivinationDrawPreviewProps = {
  question?: string
  drawMode?: DivinationDrawMode | null
}

const initialMessage = "請先依照抽牌方式開始抽牌。"
const shufflingMessage = "洗牌中..."
const autoShufflingMessage = "系統正在為你洗牌與抽牌..."
const readyMessage = "洗牌完成，請憑直覺點選一張牌。"
const pendingMessage = "你選到一張牌。請確認是不是這張。"
const resultReadyMessage = "已產生牌義解讀預覽。"
const blockedMessage = "請先在上方填寫問題，並選擇手動抽牌或自動抽牌。"

const positionLabels: Record<DivinationPosition, string> = {
  upright: "正位",
  reversed: "反位",
}

const drawModeLabels: Record<DivinationDrawMode, string> = {
  manual: "手動抽牌",
  auto: "自動抽牌",
}

const shufflePreviewCards = [
  { rotate: "-rotate-12", translate: "-translate-x-8 translate-y-2" },
  { rotate: "-rotate-3", translate: "-translate-x-3" },
  { rotate: "rotate-3", translate: "translate-x-3 -translate-y-1" },
  { rotate: "rotate-12", translate: "translate-x-8 translate-y-2" },
]

const spreadCardTransforms = [
  "rotate-[-8deg] translate-y-3",
  "rotate-[-6deg] translate-y-2",
  "rotate-[-4deg] translate-y-1",
  "rotate-[-2deg] translate-y-0.5",
  "rotate-[-1deg]",
  "rotate-0 -translate-y-0.5",
  "rotate-[1deg] -translate-y-1",
  "rotate-[1deg] -translate-y-1",
  "rotate-0 -translate-y-0.5",
  "rotate-[-1deg]",
  "rotate-[2deg] translate-y-0.5",
  "rotate-[4deg] translate-y-1",
  "rotate-[6deg] translate-y-2",
  "rotate-[8deg] translate-y-3",
]

function getRandomPosition(): DivinationPosition {
  return Math.random() < 0.5 ? "upright" : "reversed"
}

function getRandomCardIndex() {
  return Math.floor(Math.random() * ziweiCards.length)
}

export function DivinationDrawPreview({ question, drawMode = null }: DivinationDrawPreviewProps) {
  const [started, setStarted] = useState(false)
  const [shuffling, setShuffling] = useState(false)
  const [pendingIndex, setPendingIndex] = useState<number | null>(null)
  const [pendingPosition, setPendingPosition] = useState<DivinationPosition | null>(null)
  const [confirmedCard, setConfirmedCard] = useState<ZiweiCard | null>(null)
  const [confirmedPosition, setConfirmedPosition] = useState<DivinationPosition | null>(null)
  const [confirmedReadingId, setConfirmedReadingId] = useState("")
  const [confirmedPaymentGate, setConfirmedPaymentGate] =
    useState<DivinationMockPaymentGate | null>(null)
  const [interpretation, setInterpretation] = useState<DivinationInterpretation | null>(null)
  const [isInterpreting, setIsInterpreting] = useState(false)
  const [message, setMessage] = useState(initialMessage)
  const [errorMessage, setErrorMessage] = useState("")
  const shuffleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const interpretRequestRef = useRef(0)

  const hasResultPreview = Boolean(confirmedCard && confirmedPosition)
  const pendingCard = pendingIndex === null ? null : ziweiCards[pendingIndex]
  const trimmedQuestion = question?.trim() ?? ""
  const canDraw = Boolean(trimmedQuestion && drawMode)
  const isManualMode = drawMode === "manual"
  const isAutoMode = drawMode === "auto"
  const displayQuestion = trimmedQuestion || "請先在上方填寫問題並選擇抽牌方式。"
  const displayDrawMode = drawMode ? drawModeLabels[drawMode] : "尚未選擇"
  const pendingCardImage = pendingCard
    ? pendingPosition === "reversed"
      ? pendingCard.reversedImage
      : pendingCard.image
    : null

  useEffect(() => {
    return () => {
      if (shuffleTimerRef.current) {
        clearTimeout(shuffleTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (shuffleTimerRef.current) {
      clearTimeout(shuffleTimerRef.current)
    }

    setStarted(false)
    setShuffling(false)
    setPendingIndex(null)
    setPendingPosition(null)
    setConfirmedCard(null)
    setConfirmedPosition(null)
    setConfirmedReadingId("")
    setConfirmedPaymentGate(null)
    setInterpretation(null)
    setIsInterpreting(false)
    interpretRequestRef.current += 1
    setErrorMessage("")
    setMessage(initialMessage)
  }, [question, drawMode])

  function startShuffle() {
    if (!canDraw || !isManualMode) {
      setErrorMessage(blockedMessage)
      return
    }

    if (shuffling || isInterpreting) return

    if (shuffleTimerRef.current) {
      clearTimeout(shuffleTimerRef.current)
    }

    interpretRequestRef.current += 1
    setStarted(true)
    setShuffling(true)
    setPendingIndex(null)
    setPendingPosition(null)
    setConfirmedCard(null)
    setConfirmedPosition(null)
    setConfirmedReadingId("")
    setConfirmedPaymentGate(null)
    setInterpretation(null)
    setIsInterpreting(false)
    setErrorMessage("")
    setMessage(shufflingMessage)

    shuffleTimerRef.current = setTimeout(() => {
      setShuffling(false)
      setMessage(readyMessage)
    }, 800)
  }

  function pickCard(index: number) {
    if (!canDraw || !isManualMode || !started || shuffling || isInterpreting || hasResultPreview) return

    setPendingIndex(index)
    setPendingPosition(getRandomPosition())
    setConfirmedCard(null)
    setConfirmedPosition(null)
    setConfirmedReadingId("")
    setConfirmedPaymentGate(null)
    setInterpretation(null)
    setErrorMessage("")
    setMessage(pendingMessage)
  }

  function changeCard() {
    if (!canDraw || shuffling || isInterpreting) return

    setPendingIndex(null)
    setPendingPosition(null)
    setConfirmedCard(null)
    setConfirmedPosition(null)
    setConfirmedReadingId("")
    setConfirmedPaymentGate(null)
    setInterpretation(null)
    setErrorMessage("")
    setMessage(readyMessage)
  }

  function startAutoDraw() {
    if (!canDraw || !isAutoMode) {
      setErrorMessage(blockedMessage)
      return
    }

    if (shuffling || isInterpreting) return

    if (shuffleTimerRef.current) {
      clearTimeout(shuffleTimerRef.current)
    }

    interpretRequestRef.current += 1
    setStarted(true)
    setShuffling(true)
    setPendingIndex(null)
    setPendingPosition(null)
    setConfirmedCard(null)
    setConfirmedPosition(null)
    setConfirmedReadingId("")
    setConfirmedPaymentGate(null)
    setInterpretation(null)
    setIsInterpreting(false)
    setErrorMessage("")
    setMessage(autoShufflingMessage)

    const drawDelayMs = 800 + Math.floor(Math.random() * 401)

    shuffleTimerRef.current = setTimeout(() => {
      setPendingIndex(getRandomCardIndex())
      setPendingPosition(getRandomPosition())
      setShuffling(false)
      setMessage(pendingMessage)
    }, drawDelayMs)
  }

  async function confirmCard() {
    if (!trimmedQuestion || !drawMode) {
      setErrorMessage(blockedMessage)
      return
    }

    if (!pendingCard || !pendingPosition) {
      setErrorMessage("請先選一張牌。")
      return
    }

    if (isInterpreting) return

    const requestId = interpretRequestRef.current + 1
    interpretRequestRef.current = requestId
    setIsInterpreting(true)
    setConfirmedReadingId("")
    setConfirmedPaymentGate(null)
    setInterpretation(null)
    setErrorMessage("")
    setMessage("建立占卜紀錄、檢查付款 Gate，並產生牌義預覽中...")

    try {
      const createResponse = await fetch("/api/divination/readings/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: trimmedQuestion,
          drawMode,
          cardId: pendingCard.id,
          position: pendingPosition,
        }),
      })
      const createData = (await createResponse.json()) as CreateDivinationReadingResponse

      if (!createResponse.ok || !createData.ok) {
        throw new Error(createData.ok === false ? createData.error : "建立占卜紀錄預覽失敗")
      }

      if (!createData.mockPaymentGate) {
        throw new Error("付款 Gate 預覽建立失敗")
      }

      const interpretResponse = await fetch("/api/divination/interpret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          readingId: createData.reading.id,
          question: trimmedQuestion,
          drawMode,
          cardId: pendingCard.id,
          position: pendingPosition,
          mockPaymentGate: createData.mockPaymentGate,
        }),
      })
      const interpretData = (await interpretResponse.json()) as DivinationInterpretResponse

      if (!interpretResponse.ok || !interpretData.ok) {
        const gateError =
          interpretResponse.status === 402 || interpretResponse.status === 403
        throw new Error(
          gateError
            ? "尚未通過付款 Gate，無法產生解讀預覽。"
            : interpretData.ok === false
              ? interpretData.error
              : "解讀預覽產生失敗"
        )
      }

      if (interpretRequestRef.current !== requestId) return

      setConfirmedCard(pendingCard)
      setConfirmedPosition(pendingPosition)
      setConfirmedReadingId(createData.reading.id)
      setConfirmedPaymentGate(interpretData.paymentGate)
      setInterpretation(interpretData.interpretation)
      setErrorMessage("")
      setMessage(resultReadyMessage)
    } catch (error) {
      if (interpretRequestRef.current !== requestId) return

      console.error(error)
      setConfirmedCard(null)
      setConfirmedPosition(null)
      setConfirmedReadingId("")
      setConfirmedPaymentGate(null)
      setInterpretation(null)
      setErrorMessage(
        error instanceof Error && error.message.includes("付款 Gate")
          ? error.message.includes("尚未通過")
            ? "尚未通過付款 Gate，無法產生解讀預覽。"
            : "付款 Gate 預覽建立失敗，請稍後再試。"
          : error instanceof Error && error.message.includes("建立占卜紀錄")
          ? "建立占卜紀錄預覽失敗，請稍後再試。"
          : "解讀預覽產生失敗，請稍後再試。"
      )
      setMessage(pendingMessage)
    } finally {
      if (interpretRequestRef.current === requestId) {
        setIsInterpreting(false)
      }
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-borderSoft bg-softPurple p-5 shadow-soft md:p-6">
      <div className="rounded-2xl border border-borderSoft bg-white p-5 md:p-6">
        <div className="grid gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-darkGold">
            Draw
          </p>
          <div className="grid gap-2">
            <h3 className="text-2xl font-semibold text-deepPurple md:text-3xl">
              第二步｜抽一張紫微牌卡
            </h3>
            <p className="leading-7 text-textMuted">
              依照你選擇的方式抽出一張紫微牌卡，先查看牌卡基礎牌義。
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 rounded-2xl border border-purple-100 bg-purple-50/70 px-4 py-4 text-sm text-textDark md:grid-cols-2">
          <p>
            <span className="font-semibold text-deepPurple">本次問題：</span>
            {displayQuestion}
          </p>
          <p>
            <span className="font-semibold text-deepPurple">抽牌方式：</span>
            {displayDrawMode}
          </p>
        </div>

        <div className="mt-6 grid justify-items-center gap-5">
          {!canDraw ? (
            <div className="grid justify-items-center gap-4 rounded-2xl border border-borderSoft bg-white px-5 py-5">
              <div className="relative h-32 w-20 overflow-hidden rounded-xl border border-darkGold/50 bg-softPurple shadow-sm">
                <Image
                  src="/cards/back.png"
                  alt="紫微牌卡牌背"
                  fill
                  sizes="80px"
                  className="object-cover"
                />
              </div>
              <p className="max-w-xl text-center leading-7 text-textMuted">{blockedMessage}</p>
            </div>
          ) : isAutoMode ? (
            <div className="grid justify-items-center gap-3 rounded-2xl border border-purple-100 bg-purple-50/60 px-5 py-4">
              {shuffling ? (
                <div className="relative h-28 w-32">
                  {shufflePreviewCards.slice(0, 3).map((card, index) => (
                    <div
                      key={index}
                      className={`absolute left-1/2 top-2 h-24 w-16 -translate-x-1/2 overflow-hidden rounded-xl border border-darkGold/50 bg-white shadow-sm ${card.rotate} ${card.translate} animate-pulse`}
                    >
                      <Image
                        src="/cards/back.png"
                        alt=""
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    </div>
                  ))}
                  <span className="sr-only">紫微牌卡洗牌中</span>
                </div>
              ) : (
                <div className="relative h-32 w-20 overflow-hidden rounded-xl border border-darkGold/50 bg-white shadow-sm">
                  <Image
                    src="/cards/back.png"
                    alt="紫微牌卡牌背"
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                </div>
              )}
              <p className="text-sm text-textMuted">
                {shuffling ? "系統正在為你洗牌與抽牌。" : "自動抽牌會直接抽出一張牌。"}
              </p>
            </div>
          ) : !started ? (
            <div className="relative h-32 w-20 overflow-hidden rounded-xl border border-darkGold/50 bg-white shadow-sm">
              <Image
                src="/cards/back.png"
                alt="紫微牌卡牌背"
                fill
                sizes="80px"
                className="object-cover"
              />
            </div>
          ) : shuffling ? (
            <div className="grid justify-items-center gap-3 rounded-2xl border border-purple-100 bg-purple-50/60 px-5 py-4">
              <div className="relative h-32 w-40">
                {shufflePreviewCards.map((card, index) => (
                  <div
                    key={index}
                    className={`absolute left-1/2 top-3 h-28 w-20 -translate-x-1/2 overflow-hidden rounded-xl border border-darkGold/50 bg-white shadow-sm ${card.rotate} ${card.translate} animate-pulse`}
                  >
                    <Image
                      src="/cards/back.png"
                      alt=""
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                  </div>
                ))}
                <span className="sr-only">紫微牌卡洗牌中</span>
              </div>
              <p className="text-sm text-textMuted">正在洗牌，請靜心感受問題……</p>
            </div>
          ) : pendingIndex === null ? (
            <div className="w-full overflow-x-auto pb-4 pt-2">
              <div className="flex min-w-max items-end justify-start gap-1 px-1 sm:justify-center sm:gap-2">
                {ziweiCards.map((card, index) => {
                  const isPending = pendingIndex === index
                  const spreadTransform = spreadCardTransforms[index] ?? ""

                  return (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => pickCard(index)}
                      disabled={shuffling || isInterpreting || hasResultPreview}
                      className={`group h-24 w-16 shrink-0 rounded-xl border p-1.5 transition duration-200 hover:-translate-y-1 focus-visible:-translate-y-1 sm:h-28 sm:w-[72px] ${spreadTransform} ${
                        isPending
                          ? "border-darkGold bg-[#fff8e8] shadow-[0_0_18px_rgba(180,142,56,0.25)]"
                          : "border-borderSoft bg-white hover:border-darkGold hover:shadow-sm"
                      } ${shuffling || isInterpreting || hasResultPreview ? "cursor-default opacity-80" : ""}`}
                      aria-label={`選擇第 ${index + 1} 張牌：${card.name}`}
                    >
                      <span className="relative block h-full overflow-hidden rounded-lg border border-purple-100 bg-softPurple transition group-hover:border-darkGold">
                        <Image
                          src="/cards/back.png"
                          alt=""
                          fill
                          sizes="(min-width: 640px) 72px, 56px"
                          className="object-cover"
                        />
                        <span className="sr-only">紫微牌卡牌背</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-purple-100 bg-purple-50/60 px-4 py-3 text-sm text-textMuted">
              已選出一張牌，請在下方確認。
            </div>
          )}

          <p
            className={`rounded-full px-4 py-2 text-center text-sm leading-6 ${
              hasResultPreview
                ? "bg-[#eefaf4] text-[#16664f]"
                : "bg-purple-50 text-textMuted"
            }`}
          >
            {message}
          </p>

          {errorMessage ? (
            <p className="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-center text-sm text-red-700">
              {errorMessage}
            </p>
          ) : null}

          {pendingIndex !== null && !hasResultPreview ? (
            <div className="grid w-full max-w-2xl gap-4 rounded-2xl border border-purple-100 bg-purple-50/70 p-4 text-textDark">
              <p className="text-lg font-semibold text-deepPurple">是不是這張牌？</p>
              <div className="grid gap-4 rounded-2xl border border-borderSoft bg-white p-4 leading-7 sm:grid-cols-[160px_1fr] sm:items-center">
                {pendingCard && pendingCardImage ? (
                  <div className="flex justify-center">
                    <Image
                      src={pendingCardImage}
                      alt={pendingCard.name}
                      width={360}
                      height={560}
                      className="w-full max-w-[160px] rounded-2xl border border-darkGold/50 object-cover shadow-sm"
                    />
                  </div>
                ) : null}
                <div className="grid gap-2">
                  <p>
                    <span className="font-semibold text-deepPurple">你選到：</span>
                    {pendingCard?.name ?? "紫微牌卡"}
                  </p>
                  <p>
                    <span className="font-semibold text-deepPurple">正反位：</span>
                    {pendingPosition ? positionLabels[pendingPosition] : "本機預覽暫不顯示"}
                  </p>
                  {pendingPosition === "reversed" ? (
                    <p className="text-sm leading-6 text-textMuted">已顯示反位牌面。</p>
                  ) : null}
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={confirmCard}
                  disabled={isInterpreting}
                  className="rounded-full bg-deepPurple px-5 py-3 font-semibold text-white transition hover:bg-[#4b176b] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isInterpreting ? "建立占卜紀錄、檢查付款 Gate，並產生牌義預覽中..." : "就是這張，開始解讀"}
                </button>
                <button
                  type="button"
                  onClick={isAutoMode ? startAutoDraw : changeCard}
                  disabled={isInterpreting}
                  className="rounded-full border border-borderSoft bg-white px-5 py-3 font-semibold text-deepPurple transition hover:border-darkGold hover:text-darkGold disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isAutoMode ? "重新自動抽牌" : "換一張"}
                </button>
              </div>
            </div>
          ) : null}

          {confirmedCard && confirmedPosition ? (
            <DivinationResultPreview
              question={trimmedQuestion}
              drawMode={drawMode}
              card={confirmedCard}
              position={confirmedPosition}
              readingId={confirmedReadingId || undefined}
              paymentGate={confirmedPaymentGate ?? undefined}
              interpretation={interpretation ?? undefined}
            />
          ) : null}

          {canDraw ? (
            <button
              type="button"
              onClick={isAutoMode ? startAutoDraw : startShuffle}
              disabled={shuffling || isInterpreting}
              className="w-full max-w-sm rounded-full bg-deepPurple px-8 py-3.5 text-base font-semibold text-white transition hover:bg-[#4b176b] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isAutoMode
                ? shuffling
                  ? "自動抽牌中..."
                  : pendingIndex !== null
                    ? "重新自動抽牌"
                    : "開始自動抽牌"
                : shuffling
                  ? "洗牌中..."
                  : started
                    ? "重新洗牌"
                    : "開始洗牌"}
            </button>
          ) : null}
        </div>
      </div>
    </section>
  )
}
