import { NextResponse } from 'next/server'
import { ziweiCards } from '../../../../lib/divination/cards'
import {
  buildFollowUpSafetyCheckText,
  runPreOpenAISafetyCheck,
} from '../../../../lib/divination/legacyReadingEngine'
import { READING_COST_TWD } from '../../../../lib/divination/localEntitlement'
import type {
  DivinationCardSummary,
  DivinationDrawMode,
  DivinationInterpretation,
  DivinationPosition,
} from '../../../../lib/divination/types'
import {
  decideDivinationInterpretationStart,
  getDivinationReadingResumeContextForUser,
  markDivinationReadingCompleted,
  markDivinationReadingFailed,
  startDivinationReadingInterpretationIfPaid,
} from '../../../../lib/supabase/divinationReadings'
import { getUserIdFromRequest } from '../../../../lib/supabase/auth'
import { getPaymentById, type PaymentRecord } from '../../../../lib/supabase/payments'

const drawModes = new Set<DivinationDrawMode>(['manual', 'auto'])
const positions = new Set<DivinationPosition>(['upright', 'reversed'])
const paidOpenAiServiceUnavailableMessage = '付款已完成，但 AI 解讀暫時無法產生，請聯繫客服。'

type CreateInterpretationInput = {
  question: string
  drawMode: DivinationDrawMode
  card: (typeof ziweiCards)[number]
  position: DivinationPosition
  followUpContext?: unknown
}

type CreateInterpretationResult =
  | { ok: true; interpretation: DivinationInterpretation }
  | { ok: false; status: number; error: string; message: string }

export type ResumePersistedDivinationReadingDeps = {
  getUserIdFromRequest: typeof getUserIdFromRequest
  getReadingForUser: typeof getDivinationReadingResumeContextForUser
  getPaymentById: (paymentId: string) => Promise<PaymentRecord | null>
  startInterpretationIfPaid: typeof startDivinationReadingInterpretationIfPaid
  createInterpretation: (input: CreateInterpretationInput) => Promise<CreateInterpretationResult>
  markCompleted: typeof markDivinationReadingCompleted
  markFailed: typeof markDivinationReadingFailed
}

export const defaultResumePersistedDivinationReadingDeps = {
  getUserIdFromRequest,
  getReadingForUser: getDivinationReadingResumeContextForUser,
  getPaymentById,
  startInterpretationIfPaid: startDivinationReadingInterpretationIfPaid,
  markCompleted: markDivinationReadingCompleted,
  markFailed: markDivinationReadingFailed,
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isValidInterpretation(value: unknown): value is DivinationInterpretation {
  if (!isRecord(value)) return false

  return (
    typeof value.summary === 'string' && value.summary.trim().length > 0 &&
    typeof value.cardMessage === 'string' && value.cardMessage.trim().length > 0 &&
    typeof value.situationAnalysis === 'string' && value.situationAnalysis.trim().length > 0 &&
    typeof value.advice === 'string' && value.advice.trim().length > 0 &&
    typeof value.reminder === 'string' && value.reminder.trim().length > 0
  )
}

function normalizeInterpretation(value: DivinationInterpretation): DivinationInterpretation {
  return {
    ...(typeof value.finalAnswer === 'string' && value.finalAnswer.trim()
      ? { finalAnswer: value.finalAnswer.trim() }
      : {}),
    summary: value.summary.trim(),
    cardMessage: value.cardMessage.trim(),
    situationAnalysis: value.situationAnalysis.trim(),
    advice: value.advice.trim(),
    reminder: value.reminder.trim(),
  }
}

function buildCardSummary(card: (typeof ziweiCards)[number]): DivinationCardSummary {
  return {
    id: card.id,
    name: card.name,
    image: card.image,
    reversedImage: card.reversedImage,
    huaqi: card.huaqi,
    element: card.element,
    core: card.core,
  }
}

export async function resumePersistedDivinationReadingFromDb(
  input: {
    request: Request
    readingId: string
    followUpContext?: unknown
  },
  deps: ResumePersistedDivinationReadingDeps,
) {
  const userId = await deps.getUserIdFromRequest(input.request).catch(() => null)

  if (!userId) {
    return NextResponse.json(
      { ok: false, error: 'UNAUTHORIZED', message: '請先登入後再查看占卜結果。' },
      { status: 401 },
    )
  }

  let reading

  try {
    reading = await deps.getReadingForUser(input.readingId, userId)
  } catch {
    console.warn('Divination reading resume lookup failed')
    return NextResponse.json(
      { ok: false, error: 'DIVINATION_READING_LOOKUP_FAILED', message: '占卜紀錄讀取失敗，請稍後再試。' },
      { status: 500 },
    )
  }

  if (!reading) {
    return NextResponse.json(
      { ok: false, error: 'DIVINATION_READING_NOT_FOUND', message: '找不到占卜紀錄。' },
      { status: 404 },
    )
  }

  const selectedCard = reading.cardId ? ziweiCards.find((card) => card.id === reading.cardId) : null
  const safeDrawMode = drawModes.has(reading.drawMode as DivinationDrawMode)
    ? (reading.drawMode as DivinationDrawMode)
    : null
  const safePosition = positions.has(reading.position as DivinationPosition)
    ? (reading.position as DivinationPosition)
    : null

  if (!selectedCard || !safeDrawMode || !safePosition) {
    return NextResponse.json(
      {
        ok: false,
        error: 'DIVINATION_READING_DRAW_DATA_MISSING',
        message: '這筆占卜缺少抽牌資料，請聯繫客服協助。',
      },
      { status: 409 },
    )
  }

  const card = buildCardSummary(selectedCard)
  const decision = decideDivinationInterpretationStart(reading)

  if (decision.result === 'payment_required') {
    return NextResponse.json(
      {
        ok: false,
        error: 'PAYMENT_PENDING',
        message: '正在確認付款結果，請稍後重新整理。',
        requiresPayment: true,
        amountTwd: READING_COST_TWD,
      },
      { status: 402 },
    )
  }

  if (decision.result === 'already_interpreting') {
    return NextResponse.json(
      {
        ok: false,
        error: 'DIVINATION_READING_INTERPRETING',
        message: '這筆占卜正在產生解讀，請稍後再試。',
      },
      { status: 409 },
    )
  }

  if (decision.result === 'already_completed') {
    if (!isValidInterpretation(decision.interpretation)) {
      return NextResponse.json(
        {
          ok: false,
          error: 'DIVINATION_READING_INTERPRETATION_INVALID',
          message: '解讀內容格式無法顯示，請聯繫客服協助。',
        },
        { status: 500 },
      )
    }

    return NextResponse.json({
      ok: true,
      interpretation: normalizeInterpretation(decision.interpretation),
      card,
      position: safePosition,
      drawMode: safeDrawMode,
      paymentGate: {
        mode: 'db_paid',
        paymentId: reading.paymentId,
        provider: 'newebpay',
        status: 'paid',
        itemType: 'ai_divination',
        itemName: '紫微牌卡 AI 深度解讀',
        amountTwd: READING_COST_TWD,
        currency: 'TWD',
      },
    })
  }

  if (decision.result !== 'should_interpret' || !reading.paymentId) {
    return NextResponse.json(
      { ok: false, error: 'DIVINATION_READING_INVALID_STATE', message: '這筆占卜目前不能產生解讀。' },
      { status: 409 },
    )
  }

  let payment: PaymentRecord | null

  try {
    payment = await deps.getPaymentById(reading.paymentId)
  } catch {
    console.warn('Divination resume payment lookup failed')
    return NextResponse.json(
      { ok: false, error: 'DIVINATION_PAYMENT_LOOKUP_FAILED', message: '付款狀態讀取失敗，請稍後再試。' },
      { status: 500 },
    )
  }

  if (
    !payment ||
    payment.provider !== 'newebpay' ||
    payment.status !== 'paid' ||
    payment.itemType !== 'ai_divination' ||
    payment.itemId !== reading.id ||
    payment.userId !== userId
  ) {
    return NextResponse.json(
      { ok: false, error: 'PAYMENT_PENDING', message: '正在確認付款結果，請稍後重新整理。' },
      { status: 409 },
    )
  }

  const safetyResult = runPreOpenAISafetyCheck(
    buildFollowUpSafetyCheckText(reading.question, input.followUpContext),
  )

  if (safetyResult.blocked) {
    return NextResponse.json({
      ok: true,
      interpretation: safetyResult.interpretation,
      card,
      position: safePosition,
      drawMode: safeDrawMode,
      safetyBlocked: true,
      safetyReason: safetyResult.reason,
    })
  }

  try {
    const interpretingResult = await deps.startInterpretationIfPaid(reading.id)
    if (interpretingResult.result !== 'updated') {
      return NextResponse.json(
        {
          ok: false,
          error: 'DIVINATION_READING_INTERPRETING',
          message: '這筆占卜正在產生解讀，請稍後再試。',
        },
        { status: 409 },
      )
    }
  } catch {
    console.warn('Divination reading resume interpreting update failed')
    return NextResponse.json(
      { ok: false, error: 'DIVINATION_READING_UPDATE_FAILED', message: '占卜紀錄更新失敗，請稍後再試。' },
      { status: 500 },
    )
  }

  const openAiResult = await deps.createInterpretation({
    question: reading.question,
    drawMode: safeDrawMode,
    card: selectedCard,
    position: safePosition,
    followUpContext: input.followUpContext,
  })

  if (!openAiResult.ok) {
    try {
      await deps.markFailed({ readingId: reading.id, errorMessage: openAiResult.error })
    } catch {
      console.warn('Divination reading failed update failed:', {
        errorCode: openAiResult.error,
      })
    }
    return NextResponse.json(
      { ok: false, error: openAiResult.error, message: paidOpenAiServiceUnavailableMessage },
      { status: openAiResult.status },
    )
  }

  try {
    await deps.markCompleted({
      readingId: reading.id,
      interpretation: openAiResult.interpretation,
      resultSummary: openAiResult.interpretation.finalAnswer ?? openAiResult.interpretation.summary,
    })
  } catch {
    console.warn('Divination reading completed update failed')
    return NextResponse.json(
      {
        ok: false,
        error: 'DIVINATION_READING_COMPLETE_FAILED',
        message: '占卜解讀保存失敗，請稍後再試。',
      },
      { status: 500 },
    )
  }

  return NextResponse.json({
    ok: true,
    interpretation: openAiResult.interpretation,
    card,
    position: safePosition,
    drawMode: safeDrawMode,
    paymentGate: {
      mode: 'db_paid',
      paymentId: payment.id,
      provider: 'newebpay',
      status: 'paid',
      itemType: 'ai_divination',
      itemName: '紫微牌卡 AI 深度解讀',
      amountTwd: READING_COST_TWD,
      currency: 'TWD',
    },
  })
}
