import { handleProductOrderLinePayCancelRedirect } from './handler'
import {
  getProductOrderLinePayCancelContext,
  updateProductOrderLinePayPaymentMetadata,
} from '../../../../../lib/payments/productOrderPayment'

export async function GET(request: Request) {
  return handleProductOrderLinePayCancelRedirect({
    request,
    env: process.env,
    paymentReader: getProductOrderLinePayCancelContext,
    paymentMetadataUpdater: updateProductOrderLinePayPaymentMetadata,
  })
}
