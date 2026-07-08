import { handleProductOrderLinePayCancelRedirect } from './handler'
import {
  getProductOrderLinePayCancelContext,
  updateProductOrderLinePayPaymentMetadata,
} from '../../../../../lib/payments/productOrderPayment'
import {
  redirectLinePayHandlerResponseToCart,
  resolveLinePayCancelCartRedirectStatus,
} from '../redirect'

export async function GET(request: Request) {
  const response = await handleProductOrderLinePayCancelRedirect({
    request,
    env: process.env,
    paymentReader: getProductOrderLinePayCancelContext,
    paymentMetadataUpdater: updateProductOrderLinePayPaymentMetadata,
  })

  return redirectLinePayHandlerResponseToCart({
    request,
    response,
    resolveStatus: resolveLinePayCancelCartRedirectStatus,
  })
}
