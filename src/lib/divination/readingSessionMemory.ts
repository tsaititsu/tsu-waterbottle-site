'use client'

import type {
  DivinationPosition,
  DivinationReadingSession,
} from '@/lib/divination/types'

export type InMemoryDivinationReadingSession = DivinationReadingSession & {
  autoMockPaid?: boolean
}

let localUserId = ''
let readingSession: InMemoryDivinationReadingSession | null = null

function cloneSession(
  session: InMemoryDivinationReadingSession,
): InMemoryDivinationReadingSession {
  return structuredClone(session)
}

export function getOrCreateDivinationLocalUserId(): string {
  if (!localUserId) {
    localUserId =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `local-${Date.now()}-${Math.random().toString(36).slice(2)}`
  }

  return localUserId
}

export function getDivinationReadingSession(): InMemoryDivinationReadingSession | null {
  return readingSession ? cloneSession(readingSession) : null
}

export function setDivinationReadingSession(
  session: InMemoryDivinationReadingSession,
): void {
  readingSession = cloneSession(session)
}

export function clearDivinationReadingSession(): void {
  readingSession = null
}

export function clearDivinationReadingMemory(): void {
  localUserId = ''
  readingSession = null
}

export function updateDivinationReadingDrawState(input: {
  readingId: string
  question: string
  drawMode: DivinationReadingSession['drawMode']
  localUserId: string
  persisted: boolean
  cardId: string
  position: DivinationPosition
}): void {
  const existing = getDivinationReadingSession()
  const base = existing?.readingId === input.readingId ? existing : null
  setDivinationReadingSession({
    ...(base ?? {}),
    readingId: input.readingId,
    question: input.question,
    drawMode: input.drawMode,
    localUserId: input.localUserId,
    persisted: input.persisted,
    cardId: input.cardId,
    position: input.position,
  })
}

export function clearDivinationReadingDrawState(readingId: string): void {
  const existing = getDivinationReadingSession()
  if (!existing || existing.readingId !== readingId) return

  const next = { ...existing }
  delete next.cardId
  delete next.position
  setDivinationReadingSession(next)
}

export function updateDivinationReadingMerchantOrderNo(input: {
  readingId: string
  merchantOrderNo: string
}): void {
  const existing = getDivinationReadingSession()
  if (!existing || existing.readingId !== input.readingId) return
  setDivinationReadingSession({
    ...existing,
    merchantOrderNo: input.merchantOrderNo,
  })
}
