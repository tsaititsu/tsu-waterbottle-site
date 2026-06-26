"use client"

import { DivinationResultPreview } from "@/components/divination/DivinationResultPreview"
import { ziweiCards, type ZiweiCard } from "@/lib/divination/cards"
import type {
  DivinationDrawMode,
  DivinationInterpretResponse,
  DivinationInterpretation,
  DivinationMockPaymentGate,
  DivinationPosition,
  DivinationReadingSession,
} from "@/lib/divination/types"
import Image from "next/image"
import { useEffect, useRef, useState } from "react"

type DivinationDrawPreviewProps = {
  readingSession?: DivinationReadingSession | null
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
  { rotate: "-rotate-[18deg]", translate: "-translate-x-16 translate-y-6", scale: "scale-95" },
  { rotate: "-rotate-6", translate: "-translate-x-6 -translate-y-1", scale: "scale-100" },
  { rotate: "rotate-6", translate: "translate-x-6 -translate-y-2", scale: "scale-105" },
  { rotate: "rotate-[18deg]", translate: "translate-x-16 translate-y-6", scale: "scale-95" },
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

const fanAngles = [-55, -46.5, -38, -29.5, -21, -12.5, -4, 4, 12.5, 21, 29.5, 38, 46.5, 55]

function getFanTransform(index: number) {
  const angle = fanAngles[index] ?? 0
  const radius = 285
  const yRadius = 110
  const x = Math.sin((angle * Math.PI) / 180) * radius
  const y = -Math.cos((angle * Math.PI) / 180) * yRadius + 110

  return `translate(calc(-50% + ${x}px), ${y}px) rotate(${angle / 3}deg)`
}

function getRandomPosition(): DivinationPosition {
  return Math.random() < 0.5 ? "upright" : "reversed"
}

function getRandomCardIndex() {
  return Math.floor(Math.random() * ziweiCards.length)
}

export function DivinationDrawPreview({ readingSession = null }: DivinationDrawPreviewProps) {
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
  const autoStartedReadingIdRef = useRef("")
  const autoInterpretedReadingIdRef = useRef("")

  const hasResultPreview = Boolean(confirmedCard && confirmedPosition)
  const pendingCard = pendingIndex === null ? null : ziweiCards[pendingIndex]
  const trimmedQuestion = readingSession?.question.trim() ?? ""
  const drawMode = readingSession?.drawMode ?? null
  const readingId = readingSession?.readingId ?? ""
  const mockPaymentGate = readingSession?.mockPaymentGate ?? null
  const canDraw = Boolean(trimmedQuestion && drawMode && readingId && mockPaymentGate)
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
    autoStartedReadingIdRef.current = ""
    autoInterpretedReadingIdRef.current = ""
    setErrorMessage("")
    setMessage(initialMessage)
  }, [readingSession?.readingId, trimmedQuestion, drawMode])

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
    setMessage("洗牌中，請先把注意力放在你的問題上……")

    shuffleTimerRef.current = setTimeout(() => {
      setShuffling(false)
      setMessage(readyMessage)
    }, 2600)
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

    if (shuffling || isInterpreting || hasResultPreview) return

    if (autoStartedReadingIdRef.current === readingId) return
    autoStartedReadingIdRef.current = readingId

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

    const drawDelayMs = 2000 + Math.floor(Math.random() * 401)

    shuffleTimerRef.current = setTimeout(() => {
      const cardIndex = getRandomCardIndex()
      const autoCard = ziweiCards[cardIndex]
      const autoPosition = getRandomPosition()

      setPendingIndex(cardIndex)
      setPendingPosition(autoPosition)
      setShuffling(false)
      setMessage("已為你抽出牌卡，正在產生解讀……")

      if (autoCard) {
        void interpretCard(autoCard, autoPosition, { auto: true })
      }
    }, drawDelayMs)
  }

  async function interpretCard(
    selectedCard: ZiweiCard,
    selectedPosition: DivinationPosition,
    options?: { auto?: boolean }
  ) {
    if (!trimmedQuestion || !drawMode) {
      setErrorMessage(blockedMessage)
      return
    }

    if (!readingId || !mockPaymentGate) {
      setErrorMessage("請先建立占卜紀錄後再抽牌。")
      return
    }

    if (options?.auto) {
      if (autoInterpretedReadingIdRef.current === readingId) return
      autoInterpretedReadingIdRef.current = readingId
    }

    if (isInterpreting) return

    const requestId = interpretRequestRef.current + 1
    interpretRequestRef.current = requestId
    setIsInterpreting(true)
    setConfirmedReadingId("")
    setConfirmedPaymentGate(null)
    setInterpretation(null)
    setErrorMessage("")
    setMessage(options?.auto ? "已為你抽出牌卡，正在產生解讀……" : "檢查付款 Gate，並產生牌義預覽中...")

    try {
      const interpretResponse = await fetch("/api/divination/interpret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          readingId,
          question: trimmedQuestion,
          drawMode,
          cardId: selectedCard.id,
          position: selectedPosition,
          mockPaymentGate,
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

      setConfirmedCard(selectedCard)
      setConfirmedPosition(selectedPosition)
      setConfirmedReadingId(readingId)
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
          : "解讀預覽產生失敗，請稍後再試。"
      )
      setMessage(pendingMessage)
    } finally {
      if (interpretRequestRef.current === requestId) {
        setIsInterpreting(false)
      }
    }
  }

  async function confirmCard() {
    if (!pendingCard || !pendingPosition) {
      setErrorMessage("請先選一張牌。")
      return
    }

    await interpretCard(pendingCard, pendingPosition)
  }

  useEffect(() => {
    if (!isAutoMode || !canDraw || !readingId || hasResultPreview) return
    startAutoDraw()
    // 自動模式必須只針對同一 readingId 啟動一次，內部 ref 會擋掉重複 render。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAutoMode, canDraw, readingId, hasResultPreview])

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
            <div className="grid justify-items-center gap-4 rounded-2xl border border-purple-100 bg-purple-50/60 px-5 py-5">
              <div className="relative h-[168px] w-[112px] overflow-hidden rounded-2xl border border-darkGold/60 bg-white shadow-[0_18px_42px_rgba(180,142,56,0.18)] sm:h-[210px] sm:w-[140px]">
                <Image
                  src="/cards/back.png"
                  alt="紫微牌卡牌背"
                  fill
                  sizes="(min-width: 640px) 140px, 112px"
                  className="object-cover"
                />
              </div>
              <p className="max-w-xl text-center text-sm leading-7 text-textMuted">
                請在心中默念問題，洗牌後選一張牌。
              </p>
            </div>
          ) : shuffling ? (
            <div className="grid justify-items-center gap-4 rounded-2xl border border-purple-100 bg-purple-50/60 px-5 py-5">
              <div className="relative h-40 w-56">
                {shufflePreviewCards.map((card, index) => (
                  <div
                    key={index}
                    className={`absolute left-1/2 top-3 h-32 w-24 -translate-x-1/2 overflow-hidden rounded-2xl border border-darkGold/60 bg-white shadow-[0_18px_42px_rgba(180,142,56,0.22)] ${card.rotate} ${card.translate} ${card.scale} animate-pulse`}
                  >
                    <Image
                      src="/cards/back.png"
                      alt=""
                      fill
                      sizes="96px"
                      className="object-cover"
                    />
                  </div>
                ))}
                <div className="pointer-events-none absolute left-1/2 top-16 h-20 w-52 -translate-x-1/2 rounded-full bg-gradient-to-r from-transparent via-[#d6a84f]/30 to-transparent blur-xl" />
                <span className="sr-only">紫微牌卡洗牌中</span>
              </div>
              <p className="text-center text-sm leading-7 text-textMuted">
                洗牌中，請先把注意力放在你的問題上……
              </p>
            </div>
          ) : pendingIndex === null ? (
            <div className="w-full">
              <div className="overflow-x-auto pb-4 pt-2 sm:hidden">
                <div className="flex min-w-max items-end justify-start gap-1 px-1">
                  {ziweiCards.map((card, index) => {
                    const spreadTransform = spreadCardTransforms[index] ?? ""

                    return (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() => pickCard(index)}
                        disabled={shuffling || isInterpreting || hasResultPreview}
                        className={`group h-24 w-16 shrink-0 rounded-xl border border-borderSoft bg-white p-1.5 transition duration-200 hover:-translate-y-1 hover:border-darkGold hover:shadow-sm focus-visible:-translate-y-1 ${spreadTransform} ${
                          shuffling || isInterpreting || hasResultPreview ? "cursor-default opacity-80" : ""
                        }`}
                        aria-label={`選擇第 ${index + 1} 張牌`}
                      >
                        <span className="relative block h-full overflow-hidden rounded-lg border border-purple-100 bg-softPurple transition group-hover:border-darkGold">
                          <Image
                            src="/cards/back.png"
                            alt=""
                            fill
                            sizes="56px"
                            className="object-cover"
                          />
                          <span className="sr-only">紫微牌卡牌背</span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="relative hidden h-[330px] w-full max-w-5xl sm:block">
                {ziweiCards.map((card, index) => {
                  return (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => pickCard(index)}
                      disabled={shuffling || isInterpreting || hasResultPreview}
                      className={`group absolute left-1/2 top-8 h-32 w-20 rounded-xl border border-borderSoft bg-white p-1.5 transition duration-500 hover:border-darkGold hover:shadow-[0_18px_36px_rgba(180,142,56,0.2)] ${
                        shuffling || isInterpreting || hasResultPreview ? "cursor-default opacity-80" : ""
                      }`}
                      style={{
                        transform: `${getFanTransform(index)}`,
                        zIndex: index + 1,
                      }}
                      aria-label={`選擇第 ${index + 1} 張牌`}
                    >
                      <span className="relative block h-full overflow-hidden rounded-lg border border-purple-100 bg-softPurple transition duration-300 group-hover:-translate-y-4 group-hover:scale-105 group-hover:border-darkGold group-focus-visible:-translate-y-4 group-focus-visible:scale-105">
                        <Image
                          src="/cards/back.png"
                          alt=""
                          fill
                          sizes="80px"
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

          {pendingIndex !== null && !hasResultPreview && !isAutoMode ? (
            <div className="grid w-full max-w-2xl gap-4 rounded-2xl border border-purple-100 bg-purple-50/70 p-4 text-textDark">
              <p className="text-lg font-semibold text-deepPurple">是不是這張牌？</p>
              {isManualMode ? (
                <div className="rounded-2xl border border-borderSoft bg-white p-5 text-center leading-7 text-textMuted">
                  你選到一張牌。請確認是不是這張。
                </div>
              ) : (
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
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={confirmCard}
                  disabled={isInterpreting}
                  className="rounded-full bg-deepPurple px-5 py-3 font-semibold text-white transition hover:bg-[#4b176b] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isInterpreting ? "檢查付款 Gate，並產生牌義預覽中..." : "就是這張，開始解讀"}
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

          {canDraw && isManualMode ? (
            <button
              type="button"
              onClick={startShuffle}
              disabled={shuffling || isInterpreting}
              className="w-full max-w-sm rounded-full bg-deepPurple px-8 py-3.5 text-base font-semibold text-white transition hover:bg-[#4b176b] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {shuffling ? "洗牌中..." : started ? "重新洗牌" : "開始洗牌"}
            </button>
          ) : null}
        </div>
      </div>
    </section>
  )
}
