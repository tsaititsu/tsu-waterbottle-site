import { handleProductOrderLinePayConfirmRedirect } from './handler'
import { getProductOrderLinePayConfirmPaymentContext } from '../../../../../lib/payments/productOrderPayment'
import { getProductOrderLinePayConfirmContext } from '../../../../../lib/supabase/productOrders'

export async function GET(request: Request) {
  return handleProductOrderLinePayConfirmRedirect({
    request,
    env: process.env,
    paymentReader: getProductOrderLinePayConfirmPaymentContext,
    productOrderReader: getProductOrderLinePayConfirmContext,
  })
}
