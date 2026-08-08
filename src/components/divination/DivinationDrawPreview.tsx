"use client"

import { DivinationResultPreview } from "@/components/divination/DivinationResultPreview"
import { PaymentMethodSelector } from "@/components/payments/PaymentMethodSelector"
import {
  getLinePayProductionOneDollarEntryTestButtonLabel,
  isLinePayProductionOneDollarEntryTestBlocked,
  useLinePayProductionOneDollarEntryTest,
} from "@/components/payments/useLinePayProductionOneDollarEntryTest"
import { ziweiCards, type ZiweiCard } from "@/lib/divination/cards"
import {
  DIVINATION_READING_PAYMENT_MESSAGE,
  DIVINATION_READING_PRICE_LABEL,
  DIVINATION_READING_PRICE_TWD,
} from "@/lib/divination/pricing"
import {
  buildDivinationFollowUpDraft,
  clearDivinationFollowUpDraft,
  clearDivinationFollowUpDisplayThread,
  createAnswerSummary,
  loadDivinationFollowUpDisplayThread,
  saveDivinationFollowUpDisplayReading,
  saveDivinationFollowUpDraft,
} from "@/lib/divination/followUpStorage"
import {
  clearDivinationReadingDrawState,
  clearDivinationReadingSession,
  updateDivinationReadingDrawState,
  updateDivinationReadingMerchantOrderNo,
} from "@/lib/divination/readingSessionMemory"
import type {
  DivinationDrawMode,
  DivinationFollowUpDisplayThread,
  DivinationInterpretResponse,
  DivinationInterpretation,
  DivinationMockPaymentGate,
  DivinationPosition,
  DivinationReadingSession,
} from "@/lib/divination/types"
import {
  buildNewebPayClientFormFields,
  type NewebPayClientFormField,
} from "@/lib/newebpay/clientForm"
import { isLineInAppBrowser } from "@/lib/browser/lineInAppBrowser"
import { getAuthAccessToken, subscribeAuthChange } from "@/lib/mockAuth"
import {
  getCheckoutPaymentMethodOptions,
  isLinePayCheckoutMethod,
  toStandardNewebPayCheckoutMode,
  type StandardCheckoutPaymentMethod,
} from "@/lib/payments/paymentMethods"
import {
  getServiceLinePayErrorMessage,
  requestServiceLinePayCheckout,
} from "@/lib/linePay/serviceCheckoutClient"
import { requestLinePayProductionOneDollarEntryCheckout } from "@/lib/linePay/productionOneDollarEntryClient"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"

type DivinationDrawPreviewProps = {
  readingSession?: DivinationReadingSession | null
}

type PaymentRequiredState = {
  message: string
  amountTwd: number
}

type NewebPayCreateResponse =
  | {
      ok: true
      action: string
      method: "POST"
      merchantOrderNo: string
      itemKey: string
      amount: number
      fields: {
        MerchantID: string
        TradeInfo: string
        TradeSha: string
        Version: string
      }
    }
  | {
      ok: false
      error: string
      message?: string
    }

const lineInAppBrowserPaymentNotice =
  "目前正在 LINE 內建瀏覽器。為提高付款與返回解讀頁的穩定性，建議點右上角「⋯」，選擇「以預設瀏覽器開啟」後再付款。"

function LineInAppBrowserPaymentNotice({ visible }: { visible: boolean }) {
  if (!visible) return null

  return (
    <p
      className="w-full max-w-full rounded-lg border border-darkGold/25 bg-lightGold/35 px-4 py-3 text-sm leading-6 text-textDark"
      data-testid="line-in-app-browser-payment-notice"
    >
      {lineInAppBrowserPaymentNotice}
    </p>
  )
}

const initialMessage = "請先依照抽牌方式開始抽牌。"
const autoShufflingMessage = "系統正在為你洗牌與抽牌..."
const readyMessage = "洗牌完成，請憑直覺點選一張牌。"
const pendingMessage = "你選到一張牌。請確認是不是這張。"
const resultReadyMessage = "已產生牌義解讀預覽。"
const blockedMessage = "請先在上方填寫問題，並選擇手動抽牌或自動抽牌。"
const isNewebPayEnabled = process.env.NEXT_PUBLIC_ENABLE_NEWEBPAY === "true"
const isLinePayEnabled = process.env.NEXT_PUBLIC_ENABLE_LINE_PAY === "true"

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

function getEllipticalFanTransform(
  index: number,
  radius: number,
  yRadius: number,
  selectedLift: number
) {
  const angle = -55 + index * (110 / (ziweiCards.length - 1))
  const x = Math.sin((angle * Math.PI) / 180) * radius
  const y = -Math.cos((angle * Math.PI) / 180) * yRadius + 65 - selectedLift

  return `translate(${x}px, ${y}px) rotate(${angle / 3}deg)`
}

function getMobileFanTransform(index: number, isPicked: boolean) {
  return getEllipticalFanTransform(index, 150, 78, isPicked ? 52 : 0)
}

function getDesktopFanTransform(index: number, isPicked: boolean) {
  return getEllipticalFanTransform(index, 340, 130, isPicked ? 72 : 0)
}

function getRandomPosition(): DivinationPosition {
  return Math.random() < 0.5 ? "upright" : "reversed"
}

function getRandomCardIndex() {
  return Math.floor(Math.random() * ziweiCards.length)
}

function updateStoredReadingSessionDrawState(input: {
  readingId: string
  question: string
  drawMode: DivinationDrawMode
  localUserId: string
  persisted: boolean
  cardId: string
  position: DivinationPosition
}) {
  updateDivinationReadingDrawState(input)
}

function clearStoredReadingSessionDrawState(readingId: string) {
  clearDivinationReadingDrawState(readingId)
}

function updateStoredReadingSessionMerchantOrderNo(input: {
  readingId: string
  merchantOrderNo: string
}) {
  updateDivinationReadingMerchantOrderNo(input)
}

function getNewebPayCheckoutErrorMessage(error?: string) {
  if (
    error === "payment_already_exists" ||
    error === "payment_duplicate_conflict" ||
    error === "divination_reading_not_payable" ||
    error === "divination_reading_already_linked"
  ) {
    return "這筆占卜已建立付款資料，請回到付款頁完成付款，或重新開始一筆占卜。"
  }

  if (error === "unauthorized") {
    return "請先登入管理員帳號後再使用測試付款。"
  }

  if (error === "admin_required") {
    return "此測試付款功能僅限管理員使用。"
  }

  if (error === "test_mode_disabled" || error === "divination_one_dollar_test_disabled") {
    return "測試付款功能目前未啟用。"
  }

  if (
    error === "divination_reading_id_required" ||
    error === "invalid_divination_reading_id" ||
    error === "divination_reading_not_found" ||
    error === "reading_not_owned"
  ) {
    return "找不到本次占卜紀錄，請重新抽牌。"
  }

  if (error === "reading_card_data_missing" || error === "invalid_divination_draw_selection") {
    return "本次抽牌資料不完整，尚未建立付款。請重新確認牌卡後再付款。"
  }

  if (error === "payment_metadata_invalid") {
    return "本次付款資料格式不完整，尚未建立付款。請稍後再試。"
  }

  if (error === "payment_reading_link_failed") {
    return "付款資料已建立，但未能連結本次占卜。請勿重複付款並聯繫客服。"
  }

  if (
    error === "payment_create_failed" ||
    error === "payment_insert_failed" ||
    error === "payment_form_create_failed"
  ) {
    return "付款資料建立失敗，請稍後再試。"
  }

  return "線上付款資料建立失敗，請稍後再試。"
}

function submitNewebPayForm(formData: {
  action: string
  method: "POST"
  fields: NewebPayClientFormField[]
}) {
  const form = document.createElement("form")
  form.method = formData.method
  form.action = formData.action
  form.style.display = "none"

  for (const { name, value } of formData.fields) {
    const input = document.createElement("input")
    input.type = "hidden"
    input.name = name
    input.value = value
    form.appendChild(input)
  }

  document.body.appendChild(form)
  form.submit()
}

function DivinationConsentNotice({
  checked,
  onCheckedChange,
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <div className="grid gap-3 rounded-xl border border-borderSoft bg-softPurple/55 p-4">
      <div>
        <p className="font-serifTC text-lg font-semibold text-deepPurple">AI 占卜解讀同意確認</p>
        <p className="mt-1 text-sm text-textMuted">紫微牌卡 AI 解讀｜{DIVINATION_READING_PRICE_LABEL} / 次</p>
      </div>

      <details className="group rounded-xl border border-borderSoft bg-white p-4">
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
              我已詳細閱讀並同意《AI 占卜解讀服務說明》、《付款與退款規則》及《服務條款》，並了解此服務為付款後產生占卜解讀結果之數位內容服務。
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
            <p className="font-semibold text-deepPurple">AI 占卜解讀服務說明</p>
            <ul className="mt-2 grid gap-1">
              <li>服務名稱：紫微牌卡 AI 解讀</li>
              <li>價格：{DIVINATION_READING_PRICE_LABEL} / 次</li>
              <li>服務內容：依照使用者填寫的問題及抽出的紫微牌卡產生 AI 解讀。</li>
              <li>交付方式：付款後於網站產生本次占卜解讀結果。</li>
            </ul>
          </div>

          <div>
            <p className="font-semibold text-deepPurple">付款與退款規則</p>
            <ul className="mt-2 grid gap-2">
              <li>本服務為數位內容服務；抽牌本身不收費，完整 AI 解讀需完成付款後才會產生。</li>
              <li>付款完成並產生解讀結果後，因服務已開始提供，原則上不接受取消或退款。</li>
              <li>若因系統異常導致付款成功但沒有產生解讀結果，可聯繫水瓶先生官方 LINE 協助處理。</li>
              <li>若使用者填錯占卜問題，或付款前未確認抽出的牌卡，導致解讀結果不符合期待，恕不提供退款。</li>
              <li>使用者送出付款前，應自行確認占卜問題與抽出的牌卡。</li>
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
        </div>
      </details>
    </div>
  )
}

export function DivinationDrawPreview({ readingSession = null }: DivinationDrawPreviewProps) {
  const linePayEntryTestStatus = useLinePayProductionOneDollarEntryTest()
  const linePayEntryTestEnabled = linePayEntryTestStatus === "enabled"
  const linePayEntryTestBlocked =
    isLinePayProductionOneDollarEntryTestBlocked(linePayEntryTestStatus)
  const linePayEntryTestButtonLabel =
    getLinePayProductionOneDollarEntryTestButtonLabel(linePayEntryTestStatus)
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
  const [displayThread, setDisplayThread] = useState<DivinationFollowUpDisplayThread | null>(null)
  const [isInterpreting, setIsInterpreting] = useState(false)
  const [isMockPaying, setIsMockPaying] = useState(false)
  const [isNewebPayCheckingOut, setIsNewebPayCheckingOut] = useState(false)
  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<StandardCheckoutPaymentMethod>(() =>
      isNewebPayEnabled ? "credit_card" : "line_pay",
    )
  // 管理員限定 NT$1 測試模式：由 admin-only API 確認可用性，非 admin 永遠 false。
  const [isAdminOneDollarTestAvailable, setIsAdminOneDollarTestAvailable] = useState(false)
  const [isMobileLineInAppBrowser, setIsMobileLineInAppBrowser] = useState(false)
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
  const isPersistedReading = readingSession?.persisted === true
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
  const showLineInAppBrowserPaymentNotice = Boolean(
    isMobileLineInAppBrowser && paymentRequired && isPersistedReading
  )

  function persistDrawState(selectedCard: ZiweiCard, selectedPosition: DivinationPosition) {
    if (!readingId || !trimmedQuestion || !drawMode) return

    updateStoredReadingSessionDrawState({
      readingId,
      question: trimmedQuestion,
      drawMode,
      localUserId,
      persisted: isPersistedReading,
      cardId: selectedCard.id,
      position: selectedPosition,
    })
  }

  function clearPersistedDrawState() {
    if (!readingId) return
    clearStoredReadingSessionDrawState(readingId)
  }

  useEffect(() => {
    return () => {
      if (shuffleTimerRef.current) {
        clearTimeout(shuffleTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const mobileMedia = window.matchMedia("(max-width: 767px)")
    const syncLineBrowserState = () => {
      setIsMobileLineInAppBrowser(
        mobileMedia.matches && isLineInAppBrowser(window.navigator.userAgent)
      )
    }

    syncLineBrowserState()
    mobileMedia.addEventListener("change", syncLineBrowserState)
    return () => mobileMedia.removeEventListener("change", syncLineBrowserState)
  }, [])

  useEffect(() => {
    // 詢問 admin-only API 是否開放 NT$1 測試模式；未登入或非 admin 會拿到 401/403，
    // 一律維持 false。任何錯誤都靜默處理，不影響正式付款流程。
    let cancelled = false
    let requestVersion = 0

    const checkAdminOneDollarTest = async () => {
      const currentRequestVersion = ++requestVersion
      if (!cancelled) setIsAdminOneDollarTestAvailable(false)

      try {
        const accessToken = await getAuthAccessToken()
        if (!accessToken) return

        const response = await fetch("/api/admin/divination-one-dollar-test", {
          cache: "no-store",
          headers: { authorization: `Bearer ${accessToken}` },
        })
        if (!response.ok) return

        const data = (await response.json().catch(() => null)) as { ok?: boolean; enabled?: boolean } | null
        if (
          !cancelled &&
          currentRequestVersion === requestVersion &&
          data?.ok === true &&
          data.enabled === true
        ) {
          setIsAdminOneDollarTestAvailable(true)
        }
      } catch {
        // 靜默：非 admin 或未登入不顯示測試入口。
      }
    }

    void checkAdminOneDollarTest()
    const unsubscribe = subscribeAuthChange(() => {
      void checkAdminOneDollarTest()
    })

    return () => {
      cancelled = true
      requestVersion += 1
      unsubscribe()
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
    setDisplayThread(null)
    setIsInterpreting(false)
    setIsMockPaying(false)
    setIsNewebPayCheckingOut(false)
    setPaymentRequired(null)
    setHasAcceptedTerms(false)
    setHoveredCardIndex(null)
    interpretRequestRef.current += 1
    autoStartedReadingIdRef.current = ""
    autoInterpretedReadingIdRef.current = ""
    savedFollowUpDraftReadingIdRef.current = ""
    setErrorMessage("")
    setMessage(initialMessage)

    const restoredCardId = readingSession?.cardId?.trim()
    const restoredPosition = readingSession?.position ?? null
    const restoredCardIndex = restoredCardId
      ? ziweiCards.findIndex((card) => card.id === restoredCardId)
      : -1

    if (restoredCardIndex >= 0 && restoredPosition) {
      setStarted(true)
      setPendingIndex(restoredCardIndex)
      setPendingPosition(restoredPosition)
      setHasAcceptedTerms(false)
      setMessage(pendingMessage)
    }
  }, [readingSession?.readingId, readingSession?.cardId, readingSession?.position, trimmedQuestion, drawMode])

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
    clearPersistedDrawState()
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
    setDisplayThread(null)
    setIsInterpreting(false)
    setIsMockPaying(false)
    setIsNewebPayCheckingOut(false)
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

    clearPersistedDrawState()
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
    setDisplayThread(null)
    setPaymentRequired(null)
    setErrorMessage("")
    setMessage(pendingMessage)
  }

  function changeCard() {
    if (!canDraw || shuffling || isInterpreting) return

    clearPersistedDrawState()
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
    setDisplayThread(null)
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
    clearPersistedDrawState()
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
    setDisplayThread(null)
    setIsInterpreting(false)
    setIsMockPaying(false)
    setIsNewebPayCheckingOut(false)
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
      setMessage("已為你抽出牌卡，正在確認解讀資格……")

      if (autoCard) {
        void interpretCard(autoCard, autoPosition, { auto: true })
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
    setDisplayThread(null)
    setPaymentRequired(null)
    setErrorMessage("")
    setMessage(options?.mockPaid ? "支付與解讀中..." : "開始解讀中...")
    persistDrawState(selectedCard, selectedPosition)

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
            message: interpretData.message || DIVINATION_READING_PAYMENT_MESSAGE,
            amountTwd: interpretData.amountTwd ?? DIVINATION_READING_PRICE_TWD,
          })
          setErrorMessage("")
          setMessage(DIVINATION_READING_PAYMENT_MESSAGE)
          return
        }

        throw new Error("解讀預覽產生失敗，請稍後再試。")
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
    } catch {
      if (interpretRequestRef.current !== requestId) return

      setConfirmedCard(null)
      setConfirmedPosition(null)
      setConfirmedReadingId("")
      setConfirmedPaymentGate(null)
      setInterpretation(null)
      setIsSafetyResult(false)
      setHasFollowUpDraft(false)
      setDisplayThread(null)
      setErrorMessage("解讀預覽產生失敗，請稍後再試。")
      setMessage(pendingMessage)
    } finally {
      if (interpretRequestRef.current === requestId) {
        setIsInterpreting(false)
      }
    }
  }

  async function handleNewebPayDivinationCheckout(options: { adminOneDollarTest?: boolean } = {}) {
    const isAdminOneDollarTest = options.adminOneDollarTest === true && isAdminOneDollarTestAvailable

    if (!pendingCard || !pendingPosition) {
      setErrorMessage("請先選一張牌。")
      return
    }

    if (!hasAcceptedTerms) {
      setErrorMessage("請先閱讀並勾選同意 AI 占卜解讀服務說明、付款與退款規則及服務條款。")
      return
    }

    if (!readingId) {
      setErrorMessage("缺少占卜紀錄，請重新開始一筆占卜。")
      return
    }

    if (!isPersistedReading) {
      setErrorMessage("這筆占卜目前無法使用線上付款，請重新建立占卜紀錄。")
      return
    }

    const isLinePay = !isAdminOneDollarTest && isLinePayCheckoutMethod(selectedPaymentMethod)
    if (isNewebPayCheckingOut || (isLinePay ? !isLinePayEnabled : !isNewebPayEnabled)) return
    if (isLinePay && linePayEntryTestBlocked) {
      setErrorMessage("暫時無法確認 LINE Pay 付款模式，請重新整理後再試。")
      return
    }

    persistDrawState(pendingCard, pendingPosition)
    setIsNewebPayCheckingOut(true)
    setErrorMessage("")
    setMessage("正在建立線上付款資料...")

    let shouldSubmitForm = false

    try {
      const accessToken = isAdminOneDollarTest || isLinePay
        ? await getAuthAccessToken()
        : null

      if (isLinePay) {
        if (!accessToken) {
          setErrorMessage("請先登入會員後再使用 LINE Pay。")
          setMessage(paymentRequired?.message || DIVINATION_READING_PAYMENT_MESSAGE)
          return
        }
        if (linePayEntryTestEnabled) {
          const testResult =
            await requestLinePayProductionOneDollarEntryCheckout({
              accessToken,
              entrySource: "ai_divination",
            })
          if (!testResult.ok) {
            setErrorMessage("LINE Pay NT$1 測試付款資料建立失敗，請稍後再試。")
            setMessage(paymentRequired?.message || DIVINATION_READING_PAYMENT_MESSAGE)
            return
          }
          setMessage("正在前往 LINE Pay NT$1 測試付款頁...")
          shouldSubmitForm = true
          window.location.assign(testResult.paymentUrlWeb)
          return
        }
        const result = await requestServiceLinePayCheckout({
          accessToken,
          source: "ai_divination",
          sourceId: readingId,
          idempotencyKey: `ai-divination-line-pay:${readingId}`,
          cardId: pendingCard.id,
          position: pendingPosition,
        })
        if (!result.ok) {
          setErrorMessage(getServiceLinePayErrorMessage(result))
          setMessage(paymentRequired?.message || DIVINATION_READING_PAYMENT_MESSAGE)
          return
        }
        setMessage("正在前往 LINE Pay 付款頁...")
        shouldSubmitForm = true
        window.location.assign(result.paymentUrlWeb)
        return
      }

      const newebPayPaymentMethod = selectedPaymentMethod as Exclude<
        StandardCheckoutPaymentMethod,
        'line_pay'
      >

      const response = await fetch("/api/payments/newebpay/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(isAdminOneDollarTest && accessToken
            ? { Authorization: `Bearer ${accessToken}` }
            : {}),
        },
        body: JSON.stringify({
          itemKey: "ai_divination_single",
          source: "ai_divination",
          paymentMode: isAdminOneDollarTest
            ? "credit"
            : toStandardNewebPayCheckoutMode(newebPayPaymentMethod),
          readingId,
          cardId: pendingCard.id,
          position: pendingPosition,
          ...(isAdminOneDollarTest ? { divinationOneDollarTest: true } : {}),
        }),
      })
      const data = (await response.json().catch(() => null)) as NewebPayCreateResponse | null

      if (!response.ok || !data?.ok) {
        const error = data && !data.ok ? data.error : undefined
        setErrorMessage(getNewebPayCheckoutErrorMessage(error))
        setMessage(paymentRequired?.message || DIVINATION_READING_PAYMENT_MESSAGE)
        return
      }

      const formFields = buildNewebPayClientFormFields(data.fields)
      if (!formFields.ok) {
        setErrorMessage("線上付款資料不完整，請稍後再試。")
        setMessage(paymentRequired?.message || DIVINATION_READING_PAYMENT_MESSAGE)
        return
      }

      updateStoredReadingSessionMerchantOrderNo({
        readingId,
        merchantOrderNo: data.merchantOrderNo,
      })
      setMessage("正在前往藍新金流付款頁...")
      shouldSubmitForm = true
      submitNewebPayForm({
        action: data.action,
        method: data.method,
        fields: formFields.fields,
      })
    } catch {
      setErrorMessage("線上付款資料建立失敗，請稍後再試。")
      setMessage(paymentRequired?.message || DIVINATION_READING_PAYMENT_MESSAGE)
    } finally {
      if (!shouldSubmitForm) {
        setIsNewebPayCheckingOut(false)
      }
    }
  }

  async function confirmCard() {
    if (!pendingCard || !pendingPosition) {
      setErrorMessage("請先選一張牌。")
      return
    }

    if (!hasAcceptedTerms) {
      setErrorMessage("請先閱讀並勾選同意 AI 占卜解讀服務說明、付款與退款規則及服務條款。")
      return
    }

    await interpretCard(pendingCard, pendingPosition, { mockPaid: !isPersistedReading })
  }

  async function handleMockPaidInterpret() {
    if (!pendingCard || !pendingPosition) {
      setErrorMessage("請先選一張牌。")
      return
    }

    if (!hasAcceptedTerms) {
      setErrorMessage("請先閱讀並勾選同意 AI 占卜解讀服務說明、付款與退款規則及服務條款。")
      return
    }

    if (isPersistedReading) return

    if (isInterpreting || isMockPaying) return

    setIsMockPaying(true)

    try {
      await interpretCard(pendingCard, pendingPosition, { mockPaid: true })
    } finally {
      setIsMockPaying(false)
    }
  }

  function returnToDivinationStart() {
    clearDivinationReadingSession()
    clearDivinationFollowUpDraft()
    clearDivinationFollowUpDisplayThread()
    setDisplayThread(null)
    router.push(`/ai-divination?reset=${Date.now()}`)
  }

  function continueFollowUp() {
    clearDivinationReadingSession()
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
    setDisplayThread(loadDivinationFollowUpDisplayThread(followUpDraft.threadId))
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
    <section className="min-w-0 max-w-full rounded-2xl border border-borderSoft/80 bg-white p-5 shadow-[0_12px_32px_rgba(31,27,46,0.05)] md:p-6">
      <div className="min-w-0 max-w-full rounded-2xl bg-white">
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

        <div className="mt-6 grid w-full min-w-0 max-w-full justify-items-center gap-5">
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
          ) : (
            <div className="w-full min-w-0 max-w-full">
              <div className="mobile-card-fan-stage relative -mx-5 flex h-[260px] w-[calc(100%+2.5rem)] min-w-0 items-center justify-center lg:hidden">
                {ziweiCards.map((card, index) => (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => pickCard(index)}
                    disabled={pendingIndex !== null || shuffling || isInterpreting || hasResultPreview}
                    className={`group absolute h-[100px] w-[72px] rounded-xl bg-transparent p-0 transition-all duration-500 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-darkGold/40 ${
                      pendingIndex !== null || shuffling || isInterpreting || hasResultPreview ? "cursor-default" : ""
                    }`}
                    data-mobile-fan-index={index}
                    data-selected={pendingIndex === index ? "true" : "false"}
                    style={{
                      transform: getMobileFanTransform(index, pendingIndex === index),
                      zIndex: index + 1,
                    }}
                    aria-label={`選擇第 ${index + 1} 張牌`}
                  >
                    <span
                      className={`mobile-card-fan-visual pointer-events-none relative block h-full w-full overflow-hidden rounded-xl transition duration-200 group-hover:-translate-y-3 group-hover:scale-110 group-focus-visible:-translate-y-3 group-focus-visible:scale-110 ${
                        pendingIndex === index
                          ? "shadow-[0_18px_42px_rgba(180,142,56,0.42)] ring-2 ring-darkGold/50"
                          : "shadow-sm"
                      }`}
                    >
                      <Image
                        src="/cards/back.png"
                        alt=""
                        fill
                        sizes="72px"
                        className="object-cover"
                      />
                      <span className="sr-only">紫微牌卡牌背</span>
                    </span>
                  </button>
                ))}
              </div>

              <div className="desktop-card-fan-stage relative hidden h-[380px] w-full max-w-5xl scroll-mt-32 items-center justify-center lg:flex">
                {ziweiCards.map((card, index) => {
                  return (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => pickCard(index)}
                      disabled={pendingIndex !== null || shuffling || isInterpreting || hasResultPreview}
                      onBlur={() => setHoveredCardIndex(null)}
                      onFocus={() => setHoveredCardIndex(index)}
                      onMouseEnter={() => setHoveredCardIndex(index)}
                      onMouseLeave={() => setHoveredCardIndex(null)}
                      className={`group absolute h-[173px] w-[125px] scroll-mt-32 rounded-xl bg-transparent p-0 transition-all duration-500 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-darkGold/40 ${
                        pendingIndex !== null || shuffling || isInterpreting || hasResultPreview ? "cursor-default" : ""
                      }`}
                      data-desktop-fan-index={index}
                      data-selected={pendingIndex === index ? "true" : "false"}
                      style={{
                        transform: getDesktopFanTransform(index, pendingIndex === index),
                        zIndex:
                          pendingIndex === null && hoveredCardIndex === index ? 220 : index + 1,
                      }}
                      aria-label={`選擇第 ${index + 1} 張牌`}
                    >
                      <span
                        className={`pointer-events-none relative block h-full overflow-hidden rounded-xl transition duration-300 ease-out group-hover:-translate-y-4 group-hover:scale-105 group-focus-visible:-translate-y-4 group-focus-visible:scale-105 ${
                          pendingIndex === index
                            ? "shadow-[0_20px_55px_rgba(180,142,56,0.46)] ring-2 ring-darkGold/60"
                            : "shadow-sm"
                        }`}
                      >
                        <Image
                          src="/cards/back.png"
                          alt=""
                          fill
                          sizes="125px"
                          className="object-cover"
                        />
                        <span className="sr-only">紫微牌卡牌背</span>
                      </span>
                    </button>
                  )
                })}
              </div>
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
            <div className="grid w-full min-w-0 max-w-2xl gap-4 rounded-2xl border border-purple-100 bg-purple-50/70 p-4 text-textDark">
              <p className="text-lg font-semibold text-deepPurple">是不是這張牌？</p>
              {isManualMode ? (
                <div className="rounded-2xl border border-borderSoft bg-white p-5 text-center leading-7 text-textMuted">
                  你選中的牌已停在上方。請確認是不是這張，再繼續解讀。
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
              <DivinationConsentNotice
                checked={hasAcceptedTerms}
                onCheckedChange={(checked) => {
                  setHasAcceptedTerms(checked)
                  if (checked) {
                    setErrorMessage("")
                  }
                }}
              />
              {isManualMode && paymentRequired ? (
                <p className="rounded-lg border border-darkGold/20 bg-lightGold/40 p-3 text-sm text-textDark">
                  {isPersistedReading
                    ? `本次 AI 占卜解讀需 ${DIVINATION_READING_PRICE_LABEL}，請完成線上付款後再產生解讀。`
                    : DIVINATION_READING_PAYMENT_MESSAGE}
                </p>
              ) : null}
              <LineInAppBrowserPaymentNotice visible={showLineInAppBrowserPaymentNotice} />
              {paymentRequired && isPersistedReading ? (
                <PaymentMethodSelector
                  disabled={isInterpreting || isNewebPayCheckingOut}
                  onChange={(method) => {
                    if (method === "credit_card_installment_3" || method === "credit_card_installment_6") return
                    setSelectedPaymentMethod(method)
                    setErrorMessage("")
                  }}
                  options={getCheckoutPaymentMethodOptions({
                    includeLinePay: isLinePayEnabled,
                    includeNewebPay: isNewebPayEnabled,
                  })}
                  value={selectedPaymentMethod}
                />
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                {paymentRequired && isPersistedReading ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleNewebPayDivinationCheckout()}
                      disabled={
                        isInterpreting
                        || isNewebPayCheckingOut
                        || !hasAcceptedTerms
                        || (
                          isLinePayCheckoutMethod(selectedPaymentMethod)
                          && linePayEntryTestBlocked
                        )
                        || (isLinePayCheckoutMethod(selectedPaymentMethod)
                          ? !isLinePayEnabled
                          : !isNewebPayEnabled)
                      }
                      className="min-h-11 w-full rounded-full bg-deepPurple px-5 py-3 font-semibold text-white transition hover:bg-[#4b176b] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isNewebPayCheckingOut
                        ? "建立線上付款資料中..."
                        : isLinePayCheckoutMethod(selectedPaymentMethod)
                          ? linePayEntryTestButtonLabel
                            ?? `LINE Pay 付款 NT$${paymentRequired.amountTwd}`
                          : isNewebPayEnabled
                            ? `使用所選方式付款 NT$${paymentRequired.amountTwd}`
                          : "線上付款尚未啟用"}
                    </button>
                    {isAdminOneDollarTestAvailable && !linePayEntryTestEnabled ? (
                      <button
                        type="button"
                        onClick={() => handleNewebPayDivinationCheckout({ adminOneDollarTest: true })}
                        disabled={isInterpreting || isNewebPayCheckingOut || !isNewebPayEnabled || !hasAcceptedTerms}
                        className="min-h-11 w-full rounded-full border border-deepPurple bg-white px-5 py-3 font-semibold text-deepPurple transition hover:bg-softPurple disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        管理員 Apple Pay 測試付款 NT$1
                      </button>
                    ) : null}
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={confirmCard}
                    disabled={isInterpreting || !hasAcceptedTerms}
                    className="min-h-11 w-full rounded-full bg-deepPurple px-5 py-3 font-semibold text-white transition hover:bg-[#4b176b] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isInterpreting || isMockPaying
                      ? "支付與解讀中..."
                      : paymentRequired
                        ? `支付 NT$${paymentRequired.amountTwd} 開始解讀`
                        : isPersistedReading
                          ? "就是這張，開始解讀"
                          : `支付 ${DIVINATION_READING_PRICE_LABEL} 開始解讀`}
                  </button>
                )}
                <button
                  type="button"
                  onClick={isAutoMode ? startAutoDraw : changeCard}
                  disabled={isInterpreting}
                  className="min-h-11 w-full rounded-full border border-borderSoft bg-white px-5 py-3 font-semibold text-deepPurple transition hover:border-darkGold hover:text-darkGold disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isAutoMode ? "重新自動抽牌" : "換一張"}
                </button>
              </div>
            </div>
          ) : null}

          {isAutoMode && pendingCard && pendingPosition && !hasResultPreview && paymentRequired ? (
            <div className="grid w-full max-w-2xl gap-2 rounded-2xl border border-borderSoft bg-white p-4 text-textDark">
              <div className="grid gap-4 rounded-2xl border border-borderSoft bg-softPurple/45 p-4 sm:grid-cols-[160px_1fr] sm:items-center">
                {pendingCardImage ? (
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
                <div className="grid gap-2 leading-7">
                  <p className="text-lg font-semibold text-deepPurple">已為你抽出這張牌</p>
                  <p>
                    <span className="font-semibold text-deepPurple">牌卡：</span>
                    {pendingCard.name}
                  </p>
                  <p>
                    <span className="font-semibold text-deepPurple">正反位：</span>
                    {positionLabels[pendingPosition]}
                  </p>
                </div>
              </div>
              <p className="text-sm text-textMuted">
                {isPersistedReading
                  ? `本次 AI 占卜解讀需 ${DIVINATION_READING_PRICE_LABEL}，請完成線上付款後再產生解讀。`
                  : DIVINATION_READING_PAYMENT_MESSAGE}
              </p>
              <DivinationConsentNotice
                checked={hasAcceptedTerms}
                onCheckedChange={(checked) => {
                  setHasAcceptedTerms(checked)
                  if (checked) {
                    setErrorMessage("")
                  }
                }}
              />
              <LineInAppBrowserPaymentNotice visible={showLineInAppBrowserPaymentNotice} />
              {isPersistedReading ? (
                <PaymentMethodSelector
                  disabled={isInterpreting || isNewebPayCheckingOut}
                  onChange={(method) => {
                    if (method === "credit_card_installment_3" || method === "credit_card_installment_6") return
                    setSelectedPaymentMethod(method)
                    setErrorMessage("")
                  }}
                  options={getCheckoutPaymentMethodOptions({
                    includeLinePay: isLinePayEnabled,
                    includeNewebPay: isNewebPayEnabled,
                  })}
                  value={selectedPaymentMethod}
                />
              ) : null}
              {isPersistedReading ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleNewebPayDivinationCheckout()}
                    disabled={
                      isInterpreting
                      || isNewebPayCheckingOut
                      || !hasAcceptedTerms
                      || (
                        isLinePayCheckoutMethod(selectedPaymentMethod)
                        && linePayEntryTestBlocked
                      )
                      || (isLinePayCheckoutMethod(selectedPaymentMethod)
                        ? !isLinePayEnabled
                        : !isNewebPayEnabled)
                    }
                    className="rounded-full bg-deepPurple px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#4b176b] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isNewebPayCheckingOut
                      ? "建立線上付款資料中..."
                      : isLinePayCheckoutMethod(selectedPaymentMethod)
                        ? linePayEntryTestButtonLabel
                          ?? `LINE Pay 付款 NT$${paymentRequired.amountTwd}`
                        : isNewebPayEnabled
                          ? `使用所選方式付款 NT$${paymentRequired.amountTwd}`
                        : "線上付款尚未啟用"}
                  </button>
                  {isAdminOneDollarTestAvailable && !linePayEntryTestEnabled ? (
                    <button
                      type="button"
                      onClick={() => handleNewebPayDivinationCheckout({ adminOneDollarTest: true })}
                      disabled={isInterpreting || isNewebPayCheckingOut || !isNewebPayEnabled || !hasAcceptedTerms}
                      className="rounded-full border border-deepPurple bg-white px-5 py-3 text-sm font-semibold text-deepPurple transition hover:bg-softPurple disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      管理員 Apple Pay 測試付款 NT$1
                    </button>
                  ) : null}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleMockPaidInterpret}
                  disabled={isInterpreting || isMockPaying || !hasAcceptedTerms}
                  className="justify-self-start rounded-full bg-deepPurple px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#4b176b] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isInterpreting || isMockPaying
                    ? "支付與解讀中..."
                    : `支付 NT$${paymentRequired.amountTwd} 開始解讀`}
                </button>
              )}
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
              followUpThread={!isSafetyResult ? displayThread : null}
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
              className="min-h-11 w-full max-w-sm rounded-full bg-deepPurple px-8 py-3.5 text-base font-semibold text-white transition hover:bg-[#4b176b] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {shuffling ? "洗牌中..." : started ? "重新洗牌" : "開始洗牌"}
            </button>
          ) : null}
        </div>
      </div>
    </section>
  )
}
