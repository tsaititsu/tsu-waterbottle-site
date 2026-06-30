"use client"

import { DivinationResultPreview } from "@/components/divination/DivinationResultPreview"
import { ziweiCards, type ZiweiCard } from "@/lib/divination/cards"
import {
  buildDivinationFollowUpDraft,
  clearDivinationFollowUpDraft,
  clearDivinationFollowUpDisplayThread,
  createAnswerSummary,
  saveDivinationFollowUpDisplayReading,
  saveDivinationFollowUpDraft,
} from "@/lib/divination/followUpStorage"
import type {
  DivinationDrawMode,
  DivinationInterpretResponse,
  DivinationInterpretation,
  DivinationMockPaymentGate,
  DivinationPosition,
  DivinationReadingSession,
} from "@/lib/divination/types"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"

type DivinationDrawPreviewProps = {
  readingSession?: DivinationReadingSession | null
  autoMockPaid?: boolean
}

type PaymentRequiredState = {
  message: string
  amountTwd: number
}

const initialMessage = "請先依照抽牌方式開始抽牌。"
const shufflingMessage = "洗牌中..."
const autoShufflingMessage = "系統正在為你洗牌與抽牌..."
const readyMessage = "洗牌完成，請憑直覺點選一張牌。"
const pendingMessage = "你選到一張牌。請確認是不是這張。"
const resultReadyMessage = "已產生牌義解讀預覽。"
const blockedMessage = "請先在上方填寫問題，並選擇手動抽牌或自動抽牌。"
const readingSessionStorageKey = "divination_reading_session"

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

function getFanTransform(index: number) {
  const centerIndex = (ziweiCards.length - 1) / 2
  const offset = index - centerIndex
  const x = offset * 58
  const y = Math.pow(Math.abs(offset), 1.28) * 8 + 10
  const angle = offset * 2.9

  return `translate(calc(-50% + ${x}px), ${y}px) rotate(${angle}deg)`
}

function getFanZIndex(index: number) {
  const centerIndex = (ziweiCards.length - 1) / 2

  return 100 - Math.round(Math.abs(index - centerIndex) * 4)
}

function getRandomPosition(): DivinationPosition {
  return Math.random() < 0.5 ? "upright" : "reversed"
}

function getRandomCardIndex() {
  return Math.floor(Math.random() * ziweiCards.length)
}

function DivinationConsentNotice({
  checked,
  onCheckedChange,
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <div className="rounded-2xl border border-borderSoft bg-white p-4">
      <details className="group">
        <summary className="cursor-pointer list-none">
          <div className="flex items-start gap-3 text-sm leading-7 text-textMuted">
            <input
              checked={checked}
              className="mt-1 size-4 rounded border-borderSoft text-deepPurple focus:ring-deepPurple"
              onChange={(event) => onCheckedChange(event.target.checked)}
              onClick={(event) => event.stopPropagation()}
              type="checkbox"
            />
            <span>
              我已詳細閱讀並同意《AI 占卜服務說明》、《付費解讀規則》及《服務條款》，並了解占卜前相關注意事項。
              <span className="ml-1 font-semibold text-darkGold underline underline-offset-4 group-open:hidden">
                點我查看
              </span>
              <span className="ml-1 hidden font-semibold text-darkGold underline underline-offset-4 group-open:inline">
                收合內容
              </span>
            </span>
          </div>
        </summary>

        <div className="mt-4 max-h-72 space-y-5 overflow-y-auto rounded-lg bg-softPurple/60 p-4 text-sm leading-7 text-textMuted">
          <div>
            <p className="font-semibold text-deepPurple">AI 占卜服務說明</p>
            <ul className="mt-2 grid gap-1">
              <li>占卜會在水瓶先生紫微牌卡系統中完成。</li>
              <li>正式網站目前作為占卜入口與流程展示。</li>
              <li>抽牌、解讀、紀錄與問題回報，會以占卜流程內顯示為準。</li>
            </ul>
          </div>

          <div>
            <p className="font-semibold text-deepPurple">付費解讀規則</p>
            <ul className="mt-2 grid gap-2">
              <li>抽牌本身不收費；當你按下「開始解讀」並產生 AI 解讀時，本次服務費用為 NT$50。</li>
              <li>本機測試階段會使用 mock paid 流程，不會連接正式金流。</li>
              <li>正式上線後，將以正式付款流程完成付款後再產生 AI 解讀。</li>
            </ul>
          </div>

          <div>
            <p className="font-semibold text-deepPurple">服務條款</p>
            <ul className="mt-2 grid gap-2">
              <li>AI 占卜內容僅供命理與牌卡參考，不作為醫療、法律、投資、重大人生決策之唯一依據。</li>
              <li>占卜結果不保證特定事件一定發生，也不保證感情、財務、工作或其他結果必然符合期待。</li>
              <li>使用者應自行判斷與承擔實際行動結果。</li>
              <li>占卜問題應以與使用者本人有實際關聯的人事物為主。</li>
              <li>若有占卜資料、付款或系統問題，可聯繫水瓶先生官方 LINE。</li>
            </ul>
          </div>

          <div>
            <p className="font-semibold text-deepPurple">補充說明</p>
            <ul className="mt-2 grid gap-2">
              <li>目前正式網站僅作為占卜入口與流程展示，不在正式網站存放舊占卜問題、解答、會員點數或 LINE Token。</li>
                <li>若遇到登入、付款、占卜紀錄相關問題，仍以原占卜系統內處理為主。</li>
              <li>目前不搬舊會員資料、不合併點數、不碰原扣點流程。</li>
            </ul>
          </div>
        </div>
      </details>

      <p className="mt-3 text-xs leading-6 text-textMuted">
        勾選後即可進行付費解讀；本次 AI 解讀費用為 NT$50。
      </p>
    </div>
  )
}

export function DivinationDrawPreview({ readingSession = null, autoMockPaid = false }: DivinationDrawPreviewProps) {
  const router = useRouter()
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
  const [isSafetyResult, setIsSafetyResult] = useState(false)
  const [hasFollowUpDraft, setHasFollowUpDraft] = useState(false)
  const [isInterpreting, setIsInterpreting] = useState(false)
  const [isMockPaying, setIsMockPaying] = useState(false)
  const [paymentRequired, setPaymentRequired] = useState<PaymentRequiredState | null>(null)
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false)
  const [hoveredCardIndex, setHoveredCardIndex] = useState<number | null>(null)
  const [message, setMessage] = useState(initialMessage)
  const [errorMessage, setErrorMessage] = useState("")
  const shuffleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const interpretRequestRef = useRef(0)
  const autoStartedReadingIdRef = useRef("")
  const autoInterpretedReadingIdRef = useRef("")
  const savedFollowUpDraftReadingIdRef = useRef("")

  const hasResultPreview = Boolean(confirmedCard && confirmedPosition)
  const pendingCard = pendingIndex === null ? null : ziweiCards[pendingIndex]
  const trimmedQuestion = readingSession?.question.trim() ?? ""
  const drawMode = readingSession?.drawMode ?? null
  const readingId = readingSession?.readingId ?? ""
  const localUserId = readingSession?.localUserId ?? ""
  const canDraw = Boolean(trimmedQuestion && drawMode && readingId)
  const isManualMode = drawMode === "manual"
  const isAutoMode = drawMode === "auto"
  const displayQuestion = trimmedQuestion || "請先在上方填寫問題並選擇抽牌方式。"
  const displayDrawMode = drawMode ? drawModeLabels[drawMode] : "尚未選擇"
  const pendingCardImage = pendingCard
    ? pendingPosition === "reversed"
      ? pendingCard.reversedImage
      : pendingCard.image
    : null
  const hasCompletedInterpretation = Boolean(confirmedCard && confirmedPosition && interpretation)

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
    setIsSafetyResult(false)
    setHasFollowUpDraft(false)
    setIsInterpreting(false)
    setIsMockPaying(false)
    setPaymentRequired(null)
    setHasAcceptedTerms(false)
    setHoveredCardIndex(null)
    interpretRequestRef.current += 1
    autoStartedReadingIdRef.current = ""
    autoInterpretedReadingIdRef.current = ""
    savedFollowUpDraftReadingIdRef.current = ""
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
    setIsSafetyResult(false)
    setHasFollowUpDraft(false)
    setIsInterpreting(false)
    setIsMockPaying(false)
    setPaymentRequired(null)
    setHasAcceptedTerms(false)
    setHoveredCardIndex(null)
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
    setHasAcceptedTerms(false)
    setHoveredCardIndex(null)
    setConfirmedCard(null)
    setConfirmedPosition(null)
    setConfirmedReadingId("")
    setConfirmedPaymentGate(null)
    setInterpretation(null)
    setIsSafetyResult(false)
    setHasFollowUpDraft(false)
    setPaymentRequired(null)
    setErrorMessage("")
    setMessage(pendingMessage)
  }

  function changeCard() {
    if (!canDraw || shuffling || isInterpreting) return

    setPendingIndex(null)
    setPendingPosition(null)
    setHasAcceptedTerms(false)
    setHoveredCardIndex(null)
    setConfirmedCard(null)
    setConfirmedPosition(null)
    setConfirmedReadingId("")
    setConfirmedPaymentGate(null)
    setInterpretation(null)
    setIsSafetyResult(false)
    setHasFollowUpDraft(false)
    setPaymentRequired(null)
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
    setIsSafetyResult(false)
    setHasFollowUpDraft(false)
    setIsInterpreting(false)
    setIsMockPaying(false)
    setPaymentRequired(null)
    setHasAcceptedTerms(false)
    setHoveredCardIndex(null)
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
        void interpretCard(autoCard, autoPosition, { auto: true, mockPaid: autoMockPaid })
      }
    }, drawDelayMs)
  }

  async function interpretCard(
    selectedCard: ZiweiCard,
    selectedPosition: DivinationPosition,
    options?: { auto?: boolean; mockPaid?: boolean }
  ) {
    if (!trimmedQuestion || !drawMode) {
      setErrorMessage(blockedMessage)
      return
    }

    if (!readingId) {
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
    setIsSafetyResult(false)
    setHasFollowUpDraft(false)
    setPaymentRequired(null)
    setErrorMessage("")
    setMessage(options?.mockPaid ? "支付與解讀中..." : "開始解讀中...")

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
          localUserId,
          mockPaid: options?.mockPaid === true,
          ...(readingSession?.followUpContext ? { followUpContext: readingSession.followUpContext } : {}),
        }),
      })
      const interpretData = (await interpretResponse.json()) as DivinationInterpretResponse

      if (!interpretResponse.ok || !interpretData.ok) {
        if (
          interpretResponse.status === 402 &&
          interpretData.ok === false &&
          (interpretData.error === "DAILY_FREE_USED" || interpretData.error === "PAYMENT_REQUIRED") &&
          interpretData.requiresPayment
        ) {
          if (interpretRequestRef.current !== requestId) return

          setPaymentRequired({
            message: interpretData.message || "本次 AI 占卜解讀需 NT$50。",
            amountTwd: interpretData.amountTwd ?? 50,
          })
          setErrorMessage("")
          setMessage("本次 AI 占卜解讀需 NT$50。")
          return
        }

        throw new Error(
          interpretData.ok === false ? interpretData.message || interpretData.error : "解讀預覽產生失敗"
        )
      }

      if (interpretRequestRef.current !== requestId) return

      const safetyBlocked =
        "safetyBlocked" in interpretData && interpretData.safetyBlocked === true

      setConfirmedCard(selectedCard)
      setConfirmedPosition(selectedPosition)
      setConfirmedReadingId(readingId)
      setConfirmedPaymentGate(safetyBlocked ? null : interpretData.paymentGate)
      setInterpretation(interpretData.interpretation)
      setIsSafetyResult(safetyBlocked)
      setPaymentRequired(null)
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
      setIsSafetyResult(false)
      setHasFollowUpDraft(false)
      setErrorMessage(error instanceof Error ? error.message : "解讀預覽產生失敗，請稍後再試。")
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

    if (isManualMode && !hasAcceptedTerms) {
      setErrorMessage("請先閱讀並勾選同意 AI 占卜服務說明、付費解讀規則及服務條款。")
      return
    }

    await interpretCard(pendingCard, pendingPosition, { mockPaid: true })
  }

  async function handleMockPaidInterpret() {
    if (!pendingCard || !pendingPosition) {
      setErrorMessage("請先選一張牌。")
      return
    }

    if (isInterpreting || isMockPaying) return

    setIsMockPaying(true)

    try {
      await interpretCard(pendingCard, pendingPosition, { mockPaid: true })
    } finally {
      setIsMockPaying(false)
    }
  }

  function returnToDivinationStart() {
    window.sessionStorage.removeItem(readingSessionStorageKey)
    clearDivinationFollowUpDraft()
    clearDivinationFollowUpDisplayThread()
    router.push(`/ai-divination?reset=${Date.now()}`)
  }

  function continueFollowUp() {
    window.sessionStorage.removeItem(readingSessionStorageKey)
    router.push(`/ai-divination?followUp=${Date.now()}`)
  }

  useEffect(() => {
    if (!isAutoMode || !canDraw || !readingId || hasResultPreview) return
    startAutoDraw()
    // 自動模式必須只針對同一 readingId 啟動一次，內部 ref 會擋掉重複 render。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAutoMode, canDraw, readingId, hasResultPreview])

  useEffect(() => {
    if (!hasCompletedInterpretation || isSafetyResult) return
    if (!confirmedReadingId || !trimmedQuestion || !confirmedCard || !confirmedPosition) return
    if (savedFollowUpDraftReadingIdRef.current === confirmedReadingId) return

    const finalAnswer = interpretation?.finalAnswer?.trim()
    if (!finalAnswer) return

    const followUpDraft = buildDivinationFollowUpDraft({
      readingId: confirmedReadingId,
      question: trimmedQuestion,
      cardId: confirmedCard.id,
      cardName: confirmedCard.name,
      position: confirmedPosition,
      finalAnswer,
      existingFollowUpContext: readingSession?.followUpContext,
    })

    if (!followUpDraft) return

    saveDivinationFollowUpDraft(followUpDraft)
    saveDivinationFollowUpDisplayReading({
      readingId: confirmedReadingId,
      question: trimmedQuestion,
      cardId: confirmedCard.id,
      cardName: confirmedCard.name,
      position: confirmedPosition,
      finalAnswer,
      answerSummary: createAnswerSummary(finalAnswer),
      existingFollowUpContext: readingSession?.followUpContext,
    })
    savedFollowUpDraftReadingIdRef.current = confirmedReadingId
    setHasFollowUpDraft(true)
  }, [
    confirmedCard,
    confirmedPosition,
    confirmedReadingId,
    hasCompletedInterpretation,
    interpretation,
    isSafetyResult,
    readingSession?.followUpContext,
    trimmedQuestion,
  ])

  return (
    <section className="overflow-hidden rounded-2xl border border-borderSoft/80 bg-white p-5 shadow-[0_12px_32px_rgba(31,27,46,0.05)] md:p-6">
      <div className="rounded-2xl bg-white">
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
              <div className="relative h-32 w-20 overflow-hidden rounded-xl shadow-sm">
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
                      className={`absolute left-1/2 top-2 h-24 w-16 -translate-x-1/2 overflow-hidden rounded-xl shadow-sm ${card.rotate} ${card.translate} animate-pulse`}
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
                <div className="relative h-32 w-20 overflow-hidden rounded-xl shadow-sm">
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
            <div className="grid justify-items-center gap-4 px-4 py-4">
              <div className="relative h-[168px] w-[112px] overflow-hidden rounded-2xl shadow-[0_18px_42px_rgba(180,142,56,0.18)] sm:h-[210px] sm:w-[140px]">
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
            <div className="grid justify-items-center gap-4 px-4 py-4">
              <div className="relative h-40 w-56">
                {shufflePreviewCards.map((card, index) => (
                  <div
                    key={index}
                    className={`absolute left-1/2 top-3 h-32 w-24 -translate-x-1/2 overflow-hidden rounded-2xl shadow-[0_18px_42px_rgba(180,142,56,0.22)] ${card.rotate} ${card.translate} ${card.scale} animate-pulse`}
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
              <div className="overflow-x-auto pb-4 pt-2 lg:hidden">
                <div className="flex min-w-max items-end justify-start gap-1 px-1">
                  {ziweiCards.map((card, index) => {
                    const spreadTransform = spreadCardTransforms[index] ?? ""

                    return (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() => pickCard(index)}
                        disabled={shuffling || isInterpreting || hasResultPreview}
                        className={`group h-24 w-16 shrink-0 rounded-xl bg-transparent p-0 transition duration-200 hover:-translate-y-1 hover:shadow-sm focus-visible:-translate-y-1 ${spreadTransform} ${
                          shuffling || isInterpreting || hasResultPreview ? "cursor-default opacity-80" : ""
                        }`}
                        aria-label={`選擇第 ${index + 1} 張牌`}
                      >
                        <span className="relative block h-full overflow-hidden rounded-xl transition">
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

              <div className="relative hidden h-[340px] w-full max-w-5xl scroll-mt-32 lg:block">
                {ziweiCards.map((card, index) => {
                  return (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => pickCard(index)}
                      disabled={shuffling || isInterpreting || hasResultPreview}
                      onBlur={() => setHoveredCardIndex(null)}
                      onFocus={() => setHoveredCardIndex(index)}
                      onMouseEnter={() => setHoveredCardIndex(index)}
                      onMouseLeave={() => setHoveredCardIndex(null)}
                      className={`group absolute left-1/2 top-12 h-32 w-20 scroll-mt-32 rounded-xl bg-transparent p-0 transition-all duration-200 ease-out hover:-translate-y-3 hover:shadow-[0_18px_42px_rgba(180,142,56,0.28)] focus-visible:-translate-y-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-darkGold/40 ${
                        shuffling || isInterpreting || hasResultPreview ? "cursor-default opacity-80" : ""
                      }`}
                      style={{
                        transform:
                          hoveredCardIndex === index
                            ? `${getFanTransform(index)} translateY(-14px)`
                            : getFanTransform(index),
                        zIndex: pendingIndex === index ? 260 : hoveredCardIndex === index ? 220 : getFanZIndex(index),
                      }}
                      aria-label={`選擇第 ${index + 1} 張牌`}
                    >
                      <span className="pointer-events-none relative block h-full overflow-hidden rounded-xl transition duration-300 ease-out group-hover:-translate-y-4 group-hover:scale-105 group-focus-visible:-translate-y-4 group-focus-visible:scale-105">
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
            className={`px-4 py-2 text-center text-sm leading-6 ${
              hasResultPreview
                ? "rounded-full bg-[#eefaf4] text-[#16664f]"
                : isManualMode && (!started || shuffling)
                  ? "text-textMuted"
                  : "rounded-full bg-purple-50 text-textMuted"
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
              {isManualMode ? (
                <DivinationConsentNotice
                  checked={hasAcceptedTerms}
                  onCheckedChange={(checked) => {
                    setHasAcceptedTerms(checked)
                    if (checked) {
                      setErrorMessage("")
                    }
                  }}
                />
              ) : null}
              {isManualMode && paymentRequired ? (
                <p className="rounded-lg border border-darkGold/20 bg-lightGold/40 p-3 text-sm text-textDark">
                  本次 AI 占卜解讀需 NT$50。
                </p>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={confirmCard}
                  disabled={isInterpreting || (isManualMode && !hasAcceptedTerms)}
                  className="rounded-full bg-deepPurple px-5 py-3 font-semibold text-white transition hover:bg-[#4b176b] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isInterpreting || isMockPaying
                    ? "支付與解讀中..."
                    : paymentRequired
                      ? `支付 NT$${paymentRequired.amountTwd} 開始解讀（本機測試）`
                      : "支付 NT$50 開始解讀（本機測試）"}
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

          {isAutoMode && pendingCard && pendingPosition && !hasResultPreview && paymentRequired ? (
            <div className="grid w-full max-w-2xl gap-2 rounded-2xl border border-borderSoft bg-white p-4 text-textDark">
              <p className="text-sm text-textMuted">本次 AI 占卜解讀需 NT$50。</p>
              <button
                type="button"
                onClick={handleMockPaidInterpret}
                disabled={isInterpreting || isMockPaying}
                className="justify-self-start rounded-full bg-deepPurple px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#4b176b] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isInterpreting || isMockPaying
                  ? "支付與解讀中..."
                  : `支付 NT$${paymentRequired.amountTwd} 開始解讀（本機測試）`}
              </button>
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

          {canDraw && hasCompletedInterpretation ? (
            <div className="grid w-full max-w-2xl gap-3 sm:grid-cols-2">
              {!isSafetyResult && hasFollowUpDraft ? (
                <button
                  type="button"
                  onClick={continueFollowUp}
                  className="rounded-full bg-deepPurple px-8 py-3.5 text-base font-semibold text-white transition hover:bg-[#4b176b]"
                >
                  繼續追問
                </button>
              ) : null}
              <button
                type="button"
                onClick={returnToDivinationStart}
                className="rounded-full border border-borderSoft bg-white px-8 py-3.5 text-base font-semibold text-deepPurple transition hover:border-darkGold hover:text-darkGold"
              >
                返回占卜
              </button>
            </div>
          ) : null}

          {canDraw && isManualMode && !hasCompletedInterpretation ? (
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
