import { handleProductOrderLinePayConfirmRedirect } from './handler'
import {
  getProductOrderLinePayConfirmPaymentContext,
  markProductOrderLinePayPaymentPaid,
  updateProductOrderLinePayPaymentMetadata,
} from '../../../../../lib/payments/productOrderPayment'
import { getProductOrderLinePayConfirmContext } from '../../../../../lib/supabase/productOrders'
import { syncProductOrderAfterPaymentPaid } from '../../../../../lib/supabase/productOrderSync'
import {
  checkLinePayPaymentRequestStatus,
  confirmLinePayPayment,
  getLinePayPaymentDetails,
} from '../../../../../lib/linePay'

export async function GET(request: Request) {
  return handleProductOrderLinePayConfirmRedirect({
    request,
    env: process.env,
    paymentReader: getProductOrderLinePayConfirmPaymentContext,
    productOrderReader: getProductOrderLinePayConfirmContext,
    linePayConfirmer: async (input) => {
      const result = await confirmLinePayPayment({
        ...input,
        fetchFn: fetch,
      })

      return {
        ...result,
        amount: input.payloadInput.amount,
        currency: input.payloadInput.currency,
      }
    },
    requestStatusChecker: (input) =>
      checkLinePayPaymentRequestStatus({
        ...input,
        fetchFn: fetch,
      }),
    paymentDetailsGetter: (input) =>
      getLinePayPaymentDetails({
        ...input,
        fetchFn: fetch,
      }),
    paymentMetadataUpdater: updateProductOrderLinePayPaymentMetadata,
    paymentPaidMarker: markProductOrderLinePayPaymentPaid,
    productOrderPaidSyncer: (input) =>
      syncProductOrderAfterPaymentPaid({
        orderId: input.productOrderId,
        paymentId: input.paymentId,
      }),
  })
}
