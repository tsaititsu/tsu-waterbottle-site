export type DivinationDrawMode = "manual" | "auto"

export type DivinationPosition = "upright" | "reversed"

export type DivinationEntitlementType = "daily_free" | "mock_paid"

export type DivinationLocalEntitlement = {
  type: DivinationEntitlementType
  amountTwd: number
  localUserId: string
  taiwanDate: string
  entitlementToken: string
}

export type DivinationMockPaymentGate = {
  mode: "mock"
  paymentId: string
  provider?: "mock"
  status: DivinationEntitlementType
  itemType: "ai_divination"
  itemName?: "紫微牌卡 AI 深度解讀"
  amountTwd: number
  currency: "TWD"
  entitlementToken?: string
}

export type DivinationPreviousReadingSummary = {
  readingId: string
  question: string
  cardId?: string
  cardName?: string
  position?: DivinationPosition
  answerSummary: string
  finalAnswer?: string
  questionType?: string
  questionSubcategory?: string
  createdAt?: string
}

export type DivinationFollowUpContext = {
  isFollowUp: true
  threadId: string
  parentReadingId: string
  previousReadings: DivinationPreviousReadingSummary[]
}

export type DivinationReadingPreview = {
  id: string
  question: string
  drawMode: DivinationDrawMode
  localUserId?: string
  cardId?: string | null
  cardName?: string | null
  position?: DivinationPosition | null
  status: "mock_created" | "waiting_draw"
  createdAt: string
}

export type CreateDivinationReadingRequest = {
  question: string
  drawMode: DivinationDrawMode
  cardId?: string
  position?: DivinationPosition
  localUserId?: string
  mockPaid?: boolean
}

export type DivinationReadingSession = {
  readingId: string
  question: string
  drawMode: DivinationDrawMode
  localUserId: string
  entitlement?: DivinationLocalEntitlement
  mockPaymentGate?: DivinationMockPaymentGate
  followUpContext?: DivinationFollowUpContext
}

export type CreateDivinationReadingSuccessResponse = {
  ok: true
  reading: DivinationReadingPreview
  entitlement?: DivinationLocalEntitlement
  mockPaymentGate?: DivinationMockPaymentGate
}

export type CreateDivinationReadingSafetyResponse = {
  ok: true
  safetyBlocked: true
  safetyReason: "self_harm" | "violence" | "prompt_injection" | "death_critical"
  interpretation: DivinationInterpretation
}

export type DivinationErrorResponse = {
  ok: false
  error: string
  message?: string
  requiresPayment?: boolean
  amountTwd?: number
}

export type CreateDivinationReadingResponse =
  | CreateDivinationReadingSuccessResponse
  | CreateDivinationReadingSafetyResponse
  | DivinationErrorResponse

export type DivinationInterpretation = {
  finalAnswer?: string
  summary: string
  cardMessage: string
  situationAnalysis: string
  advice: string
  reminder: string
}

export type DivinationCardSummary = {
  id: string
  name: string
  image: string
  reversedImage: string
  huaqi: string
  element: string
  core: string
}

export type DivinationInterpretRequest = {
  readingId?: string
  question: string
  drawMode: DivinationDrawMode
  cardId: string
  position: DivinationPosition
  localUserId?: string
  mockPaid?: boolean
  mockPaymentGate?: DivinationMockPaymentGate
  followUpContext?: DivinationFollowUpContext
}

export type DivinationInterpretSuccessResponse = {
  ok: true
  interpretation: DivinationInterpretation
  card: DivinationCardSummary
  position: DivinationPosition
  drawMode: DivinationDrawMode
  paymentGate: DivinationMockPaymentGate
}

export type DivinationInterpretResponse =
  | DivinationInterpretSuccessResponse
  | DivinationErrorResponse
