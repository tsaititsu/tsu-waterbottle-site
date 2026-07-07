import { handleProductOrderLinePayRequest } from './handler'
import {
  createProductOrderLinePayPendingPayment,
  updateProductOrderLinePayPaymentMetadata,
} from '../../../../../lib/payments/productOrderPayment'
import { requestLinePayPayment } from '../../../../../lib/linePay'
import { getProductOrderLinePayPreflightContext } from '../../../../../lib/supabase/productOrders'

export async function POST(request: Request) {
  return handleProductOrderLinePayRequest({
    request,
    env: process.env,
    productOrderReader: getProductOrderLinePayPreflightContext,
    paymentCreator: createProductOrderLinePayPendingPayment,
    paymentMetadataUpdater: updateProductOrderLinePayPaymentMetadata,
    linePayRequester: (input) =>
      requestLinePayPayment({
        ...input,
        fetchFn: fetch,
      }),
  })
}
