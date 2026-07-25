'use client'

import { clearAiChartDraftMemory } from '@/lib/ai-chart/chartDraftMemory'
import { clearAiChartPaymentSession } from '@/lib/ai-chart/paymentSession'
import { clearDivinationFollowUpMemory } from '@/lib/divination/followUpStorage'
import { clearDivinationReadingMemory } from '@/lib/divination/readingSessionMemory'

export function clearSensitiveBrowserMemory(): void {
  clearAiChartDraftMemory()
  clearAiChartPaymentSession()
  clearDivinationReadingMemory()
  clearDivinationFollowUpMemory()
}
