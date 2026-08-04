import assert from 'node:assert/strict'
import { test } from 'node:test'
import { handlePublicProductOrderLinePayCapabilityCallback } from './callbackHandler'

const env = {
  NEXT_PUBLIC_ENABLE_LINE_PAY: 'true',
  LINE_PAY_ENV: 'sandbox',
  LINE_PAY_CHANNEL_ID: 'synthetic-channel-id',
  LINE_PAY_CHANNEL_SECRET: 'synthetic-channel-secret',
  LINE_PAY_CONFIRM_URL:
    'https://preview.example.com/api/product-orders/line-pay/confirm',
  LINE_PAY_CANCEL_URL:
    'https://preview.example.com/api/product-orders/line-pay/cancel',
}

function dependencies(reads: string[]) {
  return {
    env,
    readContext: async (merchantOrderNo: string) => {
      reads.push(merchantOrderNo)
      return null
    },
    database: {} as never,
    confirmPayment: async () => {
      throw new Error('must_not_confirm')
    },
  }
}

test('public callback reads its capability from the HttpOnly host cookie', async () => {
  const reads: string[] = []
  const request = new Request(
    'https://preview.example.com/api/product-orders/line-pay/confirm?orderId=LP_CART_test&transactionId=20260804001',
    {
      headers: {
        cookie: `__Host-line-pay-confirm=${'a'.repeat(43)}`,
      },
    },
  )

  const response = await handlePublicProductOrderLinePayCapabilityCallback({
    purpose: 'confirm',
    request,
    ...dependencies(reads),
  })

  assert.equal(response.status, 404)
  assert.deepEqual(reads, ['LP_CART_test'])
})

test('public callback fails closed when the capability cookie is absent', async () => {
  const reads: string[] = []
  const request = new Request(
    `https://preview.example.com/api/product-orders/line-pay/confirm?orderId=LP_CART_test&transactionId=20260804001&capability=${'z'.repeat(43)}`,
  )

  const response = await handlePublicProductOrderLinePayCapabilityCallback({
    purpose: 'confirm',
    request,
    ...dependencies(reads),
  })

  assert.equal(response.status, 400)
  assert.deepEqual(reads, [])
})
