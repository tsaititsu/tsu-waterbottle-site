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
    <section className="overflow-hidden rounded-[2rem] border border-[#8c6a2d] bg-[#050505] p-6 text-[#f4d77d] shadow-[0_24px_70px_rgba(0,0,0,0.28)] md:p-8">
      <div className="grid gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#b7964b]">抽牌區</p>
        <div className="grid gap-2">
          <h3 className="text-2xl font-semibold tracking-[0.08em] md:text-3xl">抽一張紫微牌卡</h3>
          <p className="leading-7 text-[#d9c68e]">
            {isAutoMode ? "系統會為你隨機抽出一張牌。" : "請先洗牌，再憑直覺選擇一張牌。"}
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-2 rounded-2xl border border-[#8c6a2d]/80 bg-[#120f09] px-5 py-4 text-[#f4d77d]">
        <p>本次問題：{displayQuestion}</p>
        <p>抽牌方式：{displayDrawMode}</p>
      </div>

      <div className="mt-8 grid justify-items-center gap-6">
        {!canDraw ? (
          <div className="grid justify-items-center gap-4">
            <div className="relative h-44 w-28 overflow-hidden rounded-2xl border border-[#f1cf72] bg-[radial-gradient(circle_at_30%_20%,#5b3a96_0%,#201230_34%,#09070d_72%)] shadow-[0_18px_40px_rgba(122,82,190,0.22)]">
              <Image
                src="/cards/back.png"
                alt="紫微牌卡牌背"
                fill
                sizes="112px"
                className="object-cover"
              />
            </div>
            <p className="max-w-xl text-center leading-7 text-[#ffdf9b]">{blockedMessage}</p>
          </div>
        ) : isAutoMode ? (
          <div className="grid justify-items-center gap-4">
            <div
              className={`relative h-44 w-28 overflow-hidden rounded-2xl border border-[#f1cf72] bg-[radial-gradient(circle_at_30%_20%,#5b3a96_0%,#201230_34%,#09070d_72%)] shadow-[0_18px_40px_rgba(122,82,190,0.22)] ${
                shuffling ? "animate-pulse" : ""
              }`}
            >
              <Image
                src="/cards/back.png"
                alt="紫微牌卡牌背"
                fill
                sizes="112px"
                className="object-cover"
              />
            </div>
          </div>
        ) : !started ? (
          <div className="relative h-44 w-28 overflow-hidden rounded-2xl border border-[#f1cf72] bg-[radial-gradient(circle_at_30%_20%,#5b3a96_0%,#201230_34%,#09070d_72%)] shadow-[0_18px_40px_rgba(122,82,190,0.22)]">
            <Image
              src="/cards/back.png"
              alt="紫微牌卡牌背"
              fill
              sizes="112px"
              className="object-cover"
            />
          </div>
        ) : (
          <div
            className={`grid w-full max-w-3xl grid-cols-4 gap-3 sm:grid-cols-7 ${
              shuffling ? "animate-pulse" : ""
            }`}
          >
            {ziweiCards.map((card, index) => {
              const isPending = pendingIndex === index

              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => pickCard(index)}
                  disabled={shuffling || isInterpreting || hasResultPreview}
                  className={`group h-32 rounded-2xl border p-2 transition duration-200 sm:h-36 ${
                    isPending
                      ? "border-[#f1cf72] bg-[#251704] shadow-[0_0_24px_rgba(241,207,114,0.35)]"
                      : "border-[#8c6a2d]/80 bg-[#0b090d] hover:-translate-y-1 hover:border-[#f1cf72]"
                  } ${shuffling || isInterpreting || hasResultPreview ? "cursor-default opacity-80" : ""}`}
                  aria-label={`選擇第 ${index + 1} 張牌：${card.name}`}
                >
                  <span className="relative block h-full overflow-hidden rounded-xl border border-[#d5ad4a]/50 bg-[radial-gradient(circle_at_30%_20%,#5b3a96_0%,#1b1128_38%,#050505_76%)] transition group-hover:border-[#f1cf72]">
                    <Image
                      src="/cards/back.png"
                      alt=""
                      fill
                      sizes="(min-width: 640px) 96px, 25vw"
                      className="object-cover"
                    />
                    <span className="sr-only">紫微牌卡牌背</span>
                  </span>
                </button>
              )
            })}
          </div>
        )}

        <p
          className={`text-center leading-7 ${
            hasResultPreview ? "text-[#8af0c0]" : "text-[#f4d77d]"
          }`}
        >
          {message}
        </p>

        {errorMessage ? <p className="text-center text-[#ff9aa8]">{errorMessage}</p> : null}

        {pendingIndex !== null && !hasResultPreview ? (
          <div className="grid w-full max-w-xl gap-3 rounded-2xl border border-[#0b8f74] bg-[#041d17] p-4 text-[#bff9df]">
            <p className="text-lg font-semibold">是不是這張牌？</p>
            <div className="grid gap-2 rounded-2xl border border-[#0b8f74]/70 bg-[#02120e] p-4 leading-7">
              {pendingCard && pendingCardImage ? (
                <div className="mb-3 flex justify-center">
                  <Image
                    src={pendingCardImage}
                    alt={pendingCard.name}
                    width={360}
                    height={560}
                    className="w-full max-w-[180px] rounded-2xl border border-[#f1cf72] object-cover shadow-[0_18px_36px_rgba(0,0,0,0.36)]"
                  />
                </div>
              ) : null}
              <p>你選到：{pendingCard?.name ?? "紫微牌卡"}</p>
              <p>正反位：{pendingPosition ? positionLabels[pendingPosition] : "本機預覽暫不顯示"}</p>
              {pendingPosition === "reversed" ? (
                <p className="text-sm leading-6 text-[#d9c68e]">已顯示反位牌面。</p>
              ) : null}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={confirmCard}
                disabled={isInterpreting}
                className="rounded-full border border-[#f1cf72] bg-[#201508] px-5 py-3 font-semibold text-[#f4d77d] transition hover:bg-[#2f210c] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isInterpreting ? "建立占卜紀錄、檢查付款 Gate，並產生牌義預覽中..." : "就是這張，開始解讀"}
              </button>
              <button
                type="button"
                onClick={isAutoMode ? startAutoDraw : changeCard}
                disabled={isInterpreting}
                className="rounded-full border border-[#0b8f74] px-5 py-3 font-semibold text-[#bff9df] transition hover:bg-[#06251d] disabled:cursor-not-allowed disabled:opacity-60"
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
            className="w-full max-w-sm rounded-full border border-[#f1cf72] bg-[#1b1206] px-8 py-4 text-lg font-semibold text-[#f4d77d] transition hover:bg-[#2b1d0a] disabled:cursor-not-allowed disabled:opacity-60"
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
    </section>
  )
}
