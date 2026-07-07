import { handleProductOrderLinePayRequest } from './handler'
import { createProductOrderLinePayPendingPayment } from '../../../../../lib/payments/productOrderPayment'
import { getProductOrderLinePayPreflightContext } from '../../../../../lib/supabase/productOrders'

export async function POST(request: Request) {
  return handleProductOrderLinePayRequest({
    request,
    env: process.env,
    productOrderReader: getProductOrderLinePayPreflightContext,
    paymentCreator: createProductOrderLinePayPendingPayment,
  })
}
