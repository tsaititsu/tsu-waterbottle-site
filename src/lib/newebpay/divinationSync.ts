import {
  markDivinationReadingPaidByPayment,
  type MarkDivinationReadingPaidResult,
} from '../supabase/divinationReadings'

export type DivinationPaymentContext = {
  paymentId: string
  itemType: string | null
  itemId: string | null
  merchantOrderNo: string | null
  paidAt?: string | null
}

export type DivinationSyncResult =
  | { result: 'updated'; readingId: string }
  | { result: 'already_paid'; readingId: string }
  | { result: 'not_found'; readingId: string }
  | { result: 'invalid_state'; readingId: string; status: string | null }
  | { result: 'skipped_not_divination' }
  | { result: 'skipped_missing_divination_context' }

type MarkDivinationReadingPaidHandler = typeof markDivinationReadingPaidByPayment

function hasText(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function mapMarkResult(result: MarkDivinationReadingPaidResult): DivinationSyncResult {
  return result
}

export async function syncDivinationReadingAfterPayment(
  payment: DivinationPaymentContext,
  deps: {
    markDivinationReadingPaidByPayment?: MarkDivinationReadingPaidHandler
  } = {},
): Promise<DivinationSyncResult> {
  if (payment.itemType !== 'ai_divination') {
    return {
      result: 'skipped_not_divination',
    }
  }

  if (!hasText(payment.paymentId) || !hasText(payment.itemId) || !hasText(payment.merchantOrderNo)) {
    return {
      result: 'skipped_missing_divination_context',
    }
  }

  const markPaid = deps.markDivinationReadingPaidByPayment ?? markDivinationReadingPaidByPayment
  const result = await markPaid({
    readingId: payment.itemId.trim(),
    paymentId: payment.paymentId.trim(),
    merchantOrderNo: payment.merchantOrderNo.trim(),
    paidAt: payment.paidAt,
  })

  return mapMarkResult(result)
}
