import assert from 'node:assert/strict'
import { syncDivinationReadingAfterPayment, type DivinationPaymentContext } from './divinationSync'
import type { MarkDivinationReadingPaidInput, MarkDivinationReadingPaidResult } from '../supabase/divinationReadings'

const divinationPayment: DivinationPaymentContext = {
  paymentId: 'payment-1',
  itemType: 'ai_divination',
  itemId: '2df1a8da-3893-4b81-8d00-774a9cc0e472',
  merchantOrderNo: 'WB20260705150000ABCD',
  paidAt: '2026-07-05T15:00:00.000Z',
}

async function runWithMock(
  payment: DivinationPaymentContext,
  result: MarkDivinationReadingPaidResult,
) {
  const calls: MarkDivinationReadingPaidInput[] = []
  const syncResult = await syncDivinationReadingAfterPayment(payment, {
    markDivinationReadingPaidByPayment: async (input) => {
      calls.push(input)
      return result
    },
  })

  return {
    calls,
    syncResult,
  }
}

async function main() {
  const updated = await runWithMock(divinationPayment, {
    result: 'updated',
    readingId: divinationPayment.itemId || '',
  })

  assert.deepEqual(updated.syncResult, {
    result: 'updated',
    readingId: divinationPayment.itemId,
  })
  assert.deepEqual(updated.calls, [
    {
      readingId: divinationPayment.itemId,
      paymentId: 'payment-1',
      merchantOrderNo: 'WB20260705150000ABCD',
      paidAt: '2026-07-05T15:00:00.000Z',
    },
  ])

  const alreadyPaid = await runWithMock(divinationPayment, {
    result: 'already_paid',
    readingId: divinationPayment.itemId || '',
  })

  assert.deepEqual(alreadyPaid.syncResult, {
    result: 'already_paid',
    readingId: divinationPayment.itemId,
  })
  assert.equal(alreadyPaid.calls.length, 1)

  const notFound = await runWithMock(divinationPayment, {
    result: 'not_found',
    readingId: divinationPayment.itemId || '',
  })

  assert.deepEqual(notFound.syncResult, {
    result: 'not_found',
    readingId: divinationPayment.itemId,
  })
  assert.equal(notFound.calls.length, 1)

  const invalidState = await runWithMock(divinationPayment, {
    result: 'invalid_state',
    readingId: divinationPayment.itemId || '',
    status: 'canceled',
  })

  assert.deepEqual(invalidState.syncResult, {
    result: 'invalid_state',
    readingId: divinationPayment.itemId,
    status: 'canceled',
  })
  assert.equal(invalidState.calls.length, 1)

  for (const itemType of ['booking', 'course', null]) {
    let called = false
    const result = await syncDivinationReadingAfterPayment(
      {
        ...divinationPayment,
        itemType,
      },
      {
        markDivinationReadingPaidByPayment: async () => {
          called = true
          throw new Error('should_not_call')
        },
      },
    )

    assert.deepEqual(result, { result: 'skipped_not_divination' })
    assert.equal(called, false)
  }

  for (const payment of [
    { ...divinationPayment, paymentId: '' },
    { ...divinationPayment, itemId: null },
    { ...divinationPayment, itemId: '   ' },
    { ...divinationPayment, merchantOrderNo: null },
    { ...divinationPayment, merchantOrderNo: '   ' },
  ]) {
    let called = false
    const result = await syncDivinationReadingAfterPayment(payment, {
      markDivinationReadingPaidByPayment: async () => {
        called = true
        throw new Error('should_not_call')
      },
    })

    assert.deepEqual(result, { result: 'skipped_missing_divination_context' })
    assert.equal(called, false)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
