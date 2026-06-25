export type DivinationDrawMode = "manual" | "auto"

export type DivinationPosition = "upright" | "reversed"

export type DivinationMockPaymentGate = {
  mode: "mock"
  paymentId: string
  provider?: "mock"
  status: "mock_paid"
  itemType: "ai_divination"
  itemName?: "紫微牌卡 AI 深度解讀"
  amountTwd: 50
  currency: "TWD"
}

export type DivinationReadingPreview = {
  id: string
  question: string
  drawMode: DivinationDrawMode
  cardId: string
  cardName: string
  position: DivinationPosition
  status: "mock_created"
  createdAt: string
}

export type CreateDivinationReadingRequest = {
  question: string
  drawMode: DivinationDrawMode
  cardId: string
  position: DivinationPosition
}

export type CreateDivinationReadingSuccessResponse = {
  ok: true
  reading: DivinationReadingPreview
  mockPaymentGate: DivinationMockPaymentGate
}

export type DivinationErrorResponse = {
  ok: false
  error: string
}

export type CreateDivinationReadingResponse =
  | CreateDivinationReadingSuccessResponse
  | DivinationErrorResponse

export type DivinationInterpretation = {
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
  mockPaymentGate?: DivinationMockPaymentGate
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
